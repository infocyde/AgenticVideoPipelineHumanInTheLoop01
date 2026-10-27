// Render the episode's Thumbnail still. Usage: npm run thumb -- <slug>   ->  out/<slug>/thumbnail.png
// With thumbnail.variants (up to 3, for YouTube's Test & Compare): thumbnail-1.png … plus thumbnail.png = variant 1.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fail, ok, paths, requireSlug, ROOT, run } from "./lib/util.ts";
import { sync } from "./sync.ts";

const slug = requireSlug("npm run thumb -- <slug>");
sync();
const p = paths(slug);
mkdirSync(p.out, { recursive: true });

const still = (file: string, propsFile?: string) => {
  const args = [join(ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js"), "still", "src/index.ts", `${slug}-thumb`, file, "--image-format=png"];
  if (propsFile) args.push(`--props=${propsFile}`);
  const code = run(process.execPath, args);
  if (code !== 0) fail(`remotion still exited with code ${code}`);
};

const episode = JSON.parse(readFileSync(p.episode, "utf8"));
const { variants = [], ...base } = episode.thumbnail ?? {};
if (!variants.length) {
  still(join(p.out, "thumbnail.png"));
  ok(`out/${slug}/thumbnail.png (1280×720)`);
} else {
  // Each variant renders the same still with the episode's thumbnail swapped for base + variant, passed as props.
  const work = join(p.src, "work");
  mkdirSync(work, { recursive: true });
  (variants as object[]).forEach((v, i) => {
    const propsFile = join(work, `thumb-props-${i + 1}.json`);
    writeFileSync(propsFile, JSON.stringify({ episode: { ...episode, thumbnail: { ...base, ...v } } }));
    still(join(p.out, `thumbnail-${i + 1}.png`), propsFile);
  });
  copyFileSync(join(p.out, "thumbnail-1.png"), join(p.out, "thumbnail.png"));
  ok(`out/${slug}/thumbnail-1…${variants.length}.png (1280×720; upload all to Test & Compare), thumbnail.png = variant 1`);
}
