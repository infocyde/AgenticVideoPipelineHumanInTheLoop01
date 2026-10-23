import assert from "node:assert/strict";
import { test } from "node:test";
import { creditSchema } from "../../src/kit/schema.ts";
import { aiFromTags, apiRequest, pexelsHits, pickFile, pixabayHits, redactKey, stockCredit, titleFromSlug } from "./stock.ts";

const pixabayVideo = {
  hits: [
    {
      id: 125,
      pageURL: "https://pixabay.com/videos/id-125/",
      tags: "ocean, waves, ai generated",
      duration: 12,
      user: "Coverr-Free-Footage",
      user_id: 1281706,
      videos: {
        large: { url: "", width: 0, height: 0 },
        medium: { url: "https://cdn.pixabay.com/video/125_medium.mp4", width: 1920, height: 1080 },
        small: { url: "https://cdn.pixabay.com/video/125_small.mp4", width: 1280, height: 720 },
      },
    },
  ],
};

test("pixabayHits picks the 1080p file, skips an empty large, builds the profile URL and flags AI tags", () => {
  const [h] = pixabayHits(pixabayVideo, "video");
  assert.equal(h.fileUrl, "https://cdn.pixabay.com/video/125_medium.mp4");
  assert.equal(h.width, 1920);
  assert.equal(h.authorUrl, "https://pixabay.com/users/Coverr-Free-Footage-1281706/");
  assert.equal(h.ai, true);
  assert.equal(h.duration, 12);
});

test("pixabayHits scales image dimensions to the 1280 px largeImageURL", () => {
  const [h] = pixabayHits({ hits: [{ id: 9, pageURL: "https://pixabay.com/photos/x-9/", tags: "city", largeImageURL: "https://cdn.pixabay.com/9_1280.jpg", imageWidth: 4000, imageHeight: 2000 }] }, "image");
  assert.equal(h.width, 1280);
  assert.equal(h.height, 640);
  assert.equal(h.ai, false);
});

test("pexelsHits reads a search list and a single video, mp4 only", () => {
  const video = {
    id: 1093662,
    url: "https://www.pexels.com/video/waves-crashing-on-rocks-1093662/",
    duration: 9,
    user: { name: "Jane Doe", url: "https://www.pexels.com/@jane" },
    video_files: [
      { link: "https://videos.pexels.com/a.mp4", width: 3840, height: 2160, file_type: "video/mp4" },
      { link: "https://videos.pexels.com/b.mp4", width: 1920, height: 1080, file_type: "video/mp4" },
      { link: "https://videos.pexels.com/c.m3u8", width: 1920, height: 1080, file_type: "application/x-mpegURL" },
    ],
  };
  const [fromSearch] = pexelsHits({ videos: [video] }, "video");
  const [single] = pexelsHits(video, "video");
  assert.equal(fromSearch.fileUrl, "https://videos.pexels.com/b.mp4");
  assert.equal(single.title, "Waves crashing on rocks");
  assert.equal(single.author, "Jane Doe");
});

test("pickFile prefers the smallest file at least 1920 wide, else the widest", () => {
  assert.equal(pickFile([{ width: 3840, height: 2160 }, { width: 1920, height: 1080 }])?.width, 1920);
  assert.equal(pickFile([{ width: 960, height: 540 }, { width: 1280, height: 720 }])?.width, 1280);
});

test("aiFromTags catches common AI tags without matching words that contain 'ai'", () => {
  assert.equal(aiFromTags(["Generative AI", "space"]), true);
  assert.equal(aiFromTags(["AI"]), true);
  assert.equal(aiFromTags(["rain", "train", "air show"]), false);
});

test("titleFromSlug turns a Pexels page URL into a title", () => {
  assert.equal(titleFromSlug("https://www.pexels.com/photo/old-tank-in-a-field-221/"), "Old tank in a field");
  assert.equal(titleFromSlug("https://example.com/"), "");
});

test("apiRequest puts the Pixabay key in the query and the Pexels key in a header; redactKey hides it", () => {
  const px = apiRequest("pixabay", "video", "SECRET", { query: "storm" });
  assert.match(px.url, /^https:\/\/pixabay\.com\/api\/videos\/\?key=SECRET&q=storm/);
  assert.equal(redactKey(px.url).includes("SECRET"), false);
  const pe = apiRequest("pexels", "image", "SECRET", { id: "42" });
  assert.equal(pe.url, "https://api.pexels.com/v1/photos/42");
  assert.equal(pe.headers.Authorization, "SECRET");
});

test("stockCredit makes a valid STOCK credit with provenance", () => {
  const [h] = pixabayHits(pixabayVideo, "video");
  const c = stockCredit(h, "clips/waves.mp4", "2026-10-23", [2, 6]);
  assert.equal(creditSchema.safeParse(c).success, true);
  assert.equal(c.stock?.site, "Pixabay");
  assert.equal(c.stock?.ai, true);
  assert.match(c.notes ?? "", /used 2\.0–6\.0 s/);
});

test("a STOCK credit without its stock record is rejected", () => {
  const r = creditSchema.safeParse({ file: "clips/x.mp4", title: "x", author: "y", license: "STOCK", sourceUrl: "https://pixabay.com/videos/id-1/" });
  assert.equal(r.success, false);
});
