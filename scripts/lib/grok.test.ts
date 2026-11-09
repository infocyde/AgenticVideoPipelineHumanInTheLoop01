import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { creditSchema } from "../../src/kit/schema.ts";
import { aiCreditAllowed, generatedClips, generatedStills } from "./check.ts";
import { checkProps, checkStillProps, fitStill, grabFrames, grokCredit, grokStillCredit, postId, publicImageUrl } from "./grok.ts";

const POST = "https://grok.com/imagine/post/3b5a680f-e896-4a31-a713-0ed3420f9edd?conversation=1f3285e2";
const made = (over = {}) =>
  grokCredit({ file: "clips/wave_rise.mp4", name: "wave_rise", post: POST, prompt: "The wave rises", resolution: "480p", seconds: 6, props: ["surfer_drop.jpg"], created: "2026-11-07T00:00:00.000Z", ...over });

test("postId reads the id from a grok.com post link", () => {
  assert.equal(postId(POST), "3b5a680f-e896-4a31-a713-0ed3420f9edd");
});

test("postId refuses a link that isn't a grok.com Imagine post", () => {
  assert.throws(() => postId("https://example.com/imagine/post/abc"), /grok\.com/);
  assert.throws(() => postId("https://grok.com/imagine"), /post/);
  assert.throws(() => postId("not a url"), /grok\.com/);
});

test("checkProps accepts up to four images and no images at all", () => {
  assert.deepEqual(checkProps([]), []);
  assert.deepEqual(checkProps(["a.jpg", "b.png", "c.webp", "d.jpeg"]), []);
});

test("checkProps refuses a fifth image", () => {
  assert.match(checkProps(["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg"]).join(), /at most 4/);
});

test("checkProps accepts a role before each image", () => {
  assert.deepEqual(checkProps(["first:a.jpg", "middle:b.png", "ref:c.webp", "last:d.jpg"]), []);
  assert.deepEqual(checkProps(["loop:a.jpg"]), []);
});

test("checkProps refuses an unknown role", () => {
  assert.match(checkProps(["start:a.jpg"]).join(), /start/);
});

test("checkProps refuses two first frames or two last frames", () => {
  assert.match(checkProps(["first:a.jpg", "first:b.jpg"]).join(), /one first/);
  assert.match(checkProps(["last:a.jpg", "last:b.jpg"]).join(), /one last/);
});

test("checkProps refuses a file that isn't an image", () => {
  assert.match(checkProps(["a.mp4"]).join(), /a\.mp4/);
});

test("grokCredit is a valid AI-GENERATED credit with its provenance", () => {
  const c = creditSchema.parse(made());
  assert.equal(c.license, "AI-GENERATED");
  assert.equal(c.generator?.provider, "grok-imagine");
  assert.equal(c.generator?.predictionId, "3b5a680f-e896-4a31-a713-0ed3420f9edd");
  assert.equal(c.generator?.prompt, "The wave rises");
  assert.deepEqual(c.generator?.input, { resolution: "480p", seconds: 6, props: ["surfer_drop.jpg"], speed: "Speed" });
  assert.equal(c.sourceUrl, "https://grok.com/imagine/post/3b5a680f-e896-4a31-a713-0ed3420f9edd");
});

test("a Grok clip may carry AI-GENERATED, a clip from anywhere else may not", () => {
  assert.equal(aiCreditAllowed(creditSchema.parse(made())), true);
  const other = creditSchema.parse({ ...made(), generator: { ...made().generator, provider: "somewhere" } });
  assert.equal(aiCreditAllowed(other), false);
});

test("Grok's provider doesn't open up other folders", () => {
  assert.equal(aiCreditAllowed(creditSchema.parse(made({ file: "sfx/wave.mp3" }))), false);
});

test("stills and composed beds are still allowed", () => {
  const still = creditSchema.parse({ ...made(), file: "images/x.jpg", generator: { provider: "replicate", model: "flux", prompt: "p", created: "2026-11-07" } });
  const bed = creditSchema.parse({ ...made(), file: "music/bed.mp3", generator: { provider: "local", model: "stabilityai/stable-audio-3-medium", prompt: "p", created: "2026-11-07" } });
  assert.equal(aiCreditAllowed(still), true);
  assert.equal(aiCreditAllowed(bed), true);
});

test("generatedClips names the Grok clips, not the stills", () => {
  const still = creditSchema.parse({ ...made(), file: "images/x.jpg", generator: { provider: "replicate", model: "flux", prompt: "p", created: "2026-11-07" } });
  assert.deepEqual([...generatedClips([creditSchema.parse(made()), still])], ["wave_rise"]);
});

const still = (over = {}) =>
  grokStillCredit({ file: "images/lighthouse_dusk.jpg", name: "lighthouse_dusk", post: POST, prompt: "A lighthouse at dusk", aspect: "16:9", props: [], created: "2026-11-07T00:00:00.000Z", ...over });

test("grokStillCredit is a valid AI-GENERATED still credit with its provenance", () => {
  const c = creditSchema.parse(still({ props: ["lighthouse_day.jpg"] }));
  assert.equal(c.license, "AI-GENERATED");
  assert.equal(c.title, "AI-generated illustration: lighthouse_dusk");
  assert.equal(c.generator?.provider, "grok-imagine");
  assert.match(c.generator?.model ?? "", /image/i);
  assert.equal(c.generator?.predictionId, "3b5a680f-e896-4a31-a713-0ed3420f9edd");
  assert.deepEqual(c.generator?.input, { aspect: "16:9", props: ["lighthouse_day.jpg"], speed: "Speed" });
  assert.equal(c.sourceUrl, "https://grok.com/imagine/post/3b5a680f-e896-4a31-a713-0ed3420f9edd");
});

test("a Grok still is allowed, counts as an AI still (on-screen note) and not as a clip", () => {
  const c = creditSchema.parse(still());
  assert.equal(aiCreditAllowed(c), true);
  assert.deepEqual([...generatedStills([c])], ["lighthouse_dusk"]);
  assert.deepEqual([...generatedClips([c])], []);
});

test("checkStillProps takes up to five reference images (Image mode's limit) and refuses keyframe roles", () => {
  assert.deepEqual(checkStillProps(["a.jpg", "ref:b.png"]), []);
  assert.deepEqual(checkStillProps(["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg"]), []);
  assert.match(checkStillProps(["first:a.jpg"]).join(), /first/);
  assert.match(checkStillProps(["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"]).join(), /at most 5/);
});

test("publicImageUrl is the public copy of a plain generation", () => {
  assert.equal(publicImageUrl(POST), "https://imagine-public.x.ai/imagine-public/images/3b5a680f-e896-4a31-a713-0ed3420f9edd.jpg");
});

test("fitStill fills 16:9 and 9:16 frames and leaves other shapes at their size", () => {
  const dir = mkdtempSync(join(tmpdir(), "grok-still-"));
  try {
    const size = (f: string) => execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", f], { encoding: "utf8" }).trim();
    const make = (s: string) => {
      const f = join(dir, `${s}.jpg`);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `color=gray:s=${s}:d=1`, "-frames:v", "1", f]);
      return f;
    };
    fitStill(make("1792x1008"), join(dir, "wide.jpg"), "16:9");
    fitStill(make("720x1280"), join(dir, "tall.jpg"), "9:16");
    fitStill(make("1024x1024"), join(dir, "square.jpg"), "1:1");
    assert.equal(size(join(dir, "wide.jpg")), "1920,1080");
    assert.equal(size(join(dir, "tall.jpg")), "1080,1920");
    assert.equal(size(join(dir, "square.jpg")), "1024,1024");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("grabFrames saves the clip's real first and last frames", () => {
  const dir = mkdtempSync(join(tmpdir(), "grok-frames-"));
  try {
    const clip = join(dir, "clip.mp4");
    // One second of red, then one second of blue.
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=red:s=64x64:r=24:d=1", "-f", "lavfi", "-i", "color=blue:s=64x64:r=24:d=1", "-filter_complex", "[0][1]concat=n=2:v=1", "-pix_fmt", "yuv420p", clip]);
    const { first, last } = grabFrames(clip, dir);
    const rgb = (f: string) => [...execFileSync("ffmpeg", ["-v", "error", "-i", f, "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]).subarray(0, 3)];
    const [fr, , fb] = rgb(first);
    const [lr, , lb] = rgb(last);
    assert.ok(fr > 200 && fb < 60, `first frame should be red, got ${fr},${fb}`);
    assert.ok(lb > 200 && lr < 60, `last frame should be blue, got ${lr},${lb}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
