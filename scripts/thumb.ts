// Render the episode's Thumbnail still. Usage: npm run thumb -- <slug>   ->  out/<slug>/thumbnail.png
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fail, ok, paths, requireSlug, ROOT, run } from "./lib/util.ts";
import { sync } from "./sync.ts";

const slug = requireSlug("npm run thumb -- <slug>");
sync();
const out = paths(slug).out;
mkdirSync(out, { recursive: true });
const file = join(out, "thumbnail.png");
const code = run(process.execPath, [join(ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js"), "still", "src/index.ts", `${slug}-thumb`, file, "--image-format=png"]);
if (code !== 0) fail(`remotion still exited with code ${code}`);
ok(`out/${slug}/thumbnail.png (1280×720)`);
