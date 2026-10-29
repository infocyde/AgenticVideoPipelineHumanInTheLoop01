import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { type Credit, creditSchema } from "../../src/kit/schema.ts";
import { xpostIssues } from "./check.ts";
import { isXUrl, parsePost, postId, sourceEntry, xpostCredit } from "./xpost.ts";

const syndicated = {
  __typename: "Tweet",
  id_str: "1585341984679469056",
  text: "Entering Twitter HQ &amp; more – see https://t.co/abc https://t.co/D68z4K2wq7",
  display_text_range: [0, 53],
  created_at: "2022-10-26T18:45:57.000Z",
  entities: { urls: [{ url: "https://t.co/abc", expanded_url: "https://example.com/hq" }] },
  mediaDetails: [{ type: "video" }],
  user: { name: "Elon Musk", screen_name: "elonmusk", is_blue_verified: true, highlighted_label: { description: "X" } },
};

test("postId reads x.com and twitter.com status links and bare ids, nothing else", () => {
  assert.equal(postId("https://x.com/elonmusk/status/1585341984679469056?s=20"), "1585341984679469056");
  assert.equal(postId("https://twitter.com/jack/status/20"), "20");
  assert.equal(postId("https://mobile.twitter.com/i/web/status/1234567890"), "1234567890");
  assert.equal(postId("1585341984679469056"), "1585341984679469056");
  assert.equal(postId("https://x.com/i/lists/1672634236292169729"), undefined);
  assert.equal(postId("https://x.com/elonmusk"), undefined);
  assert.equal(postId("https://example.com/a/status/123456"), undefined);
});

test("isXUrl matches x.com and twitter.com hosts only", () => {
  assert.ok(isXUrl("https://www.x.com/a"));
  assert.ok(isXUrl("https://twitter.com/a"));
  assert.ok(!isXUrl("https://notx.com/a"));
  assert.ok(!isXUrl("not a url"));
});

test("parsePost trims the media link, expands links, decodes entities and reads the badge", () => {
  const post = parsePost(syndicated);
  assert.equal(post.text, "Entering Twitter HQ & more – see https://example.com/hq");
  assert.equal(post.url, "https://x.com/elonmusk/status/1585341984679469056");
  assert.equal(post.badge, "verified, affiliated with X");
  assert.deepEqual(post.media, ["video"]);
  assert.equal(post.created, "2022-10-26T18:45:57.000Z");
});

test("parsePost unwraps visibility results and rejects tombstones", () => {
  assert.equal(parsePost({ __typename: "TweetWithVisibilityResults", tweet: syndicated }).handle, "elonmusk");
  assert.throws(() => parsePost({ __typename: "TweetTombstone" }), /deleted, protected/);
  assert.throws(() => parsePost(null), /empty response/);
});

test("sourceEntry quotes the first eight words with the date", () => {
  const s = sourceEntry({ ...parsePost(syndicated), text: "one two three four five six seven eight nine ten" });
  assert.equal(s.title, '@elonmusk on X: "one two three four five six seven eight…" (Oct 26, 2022)');
  assert.equal(s.url, "https://x.com/elonmusk/status/1585341984679469056");
});

test("xpostCredit is a valid X POST credit, and one without its record is rejected", () => {
  const c = xpostCredit(parsePost(syndicated), "images/musk_post.png", "Owner of X, speaking for the company", "2026-10-28");
  assert.equal(creditSchema.safeParse(c).success, true);
  assert.equal(c.author, "Elon Musk (@elonmusk)");
  const bare = creditSchema.safeParse({ file: "images/x.png", title: "x", author: "y", license: "X POST", sourceUrl: "https://x.com/a/status/1" });
  assert.equal(bare.success, false);
});

// --- check rules ---
const post = (o: Partial<Credit> = {}): Credit => ({ ...xpostCredit(parsePost(syndicated), "images/musk_post.png", "basis", "2026-10-28"), ...o });
const src = [{ url: "https://x.com/elonmusk/status/1585341984679469056" }];
const proofDir = () => {
  const d = mkdtempSync(join(tmpdir(), "xpost-"));
  mkdirSync(join(d, "raw", "xpost", "1585341984679469056"), { recursive: true });
  writeFileSync(join(d, "raw", "xpost", "1585341984679469056", "post.png"), "");
  return d;
};

test("off: an X link in sources and an X POST credit are errors", () => {
  const r = xpostIssues([post()], src, [], false);
  assert.equal(r.filter((i) => i.level === "error").length, 2);
  assert.ok(r.some((i) => /leads only/.test(i.msg)));
});

test("on: a cited post with its proof and a screenshot in images/ is clean", () => {
  assert.deepEqual(xpostIssues([post()], src, [proofDir()], true), []);
});

test("on: a post without proof warns; a profile link is an error", () => {
  assert.ok(xpostIssues([], src, [], true).some((i) => i.level === "warning" && /npm run xpost/.test(i.msg)));
  assert.ok(xpostIssues([], [{ url: "https://x.com/elonmusk" }], [], true).some((i) => i.level === "error" && /cite the post itself/.test(i.msg)));
});

test("on: an X POST screenshot can't be a clip or the thumbnail", () => {
  assert.ok(xpostIssues([post({ file: "clips/a.mp4" })], [], [], true).some((i) => /only for images/.test(i.msg)));
  assert.ok(xpostIssues([post()], [], [], true, "musk_post").some((i) => i.where === "thumbnail.visual"));
});
