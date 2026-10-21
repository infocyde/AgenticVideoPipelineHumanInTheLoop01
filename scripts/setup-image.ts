// One-time setup for local image generation (npm run generate with image_gen.mode local_render or mixed):
// stable-diffusion.cpp (sd-cli, CUDA 12 build) and Z-Image Turbo as GGUF, in models/image/ (git-ignored).
//   z_image_turbo-Q4_K.gguf              Tongyi-MAI Z-Image Turbo, sd.cpp's Q4_K conversion (leejet/Z-Image-Turbo-GGUF), Apache-2.0
//   Qwen3-4B-Instruct-2507-Q4_K_M.gguf   its text encoder, the one sd.cpp documents (unsloth GGUF), Apache-2.0
//   flux1_ae.safetensors                 the FLUX.1 VAE Z-Image uses (Comfy-Org/z_image_turbo), Apache-2.0
//   sdcpp/                               sd-cli.exe + DLLs (leejet/stable-diffusion.cpp release, MIT)
// Files already on disk elsewhere are hard-linked (no extra space) with --from <folder>: it looks for the same names
// there, in models/<kind>/ and sdcpp/ (the layout of a MOSS Studio checkout). Anything not found is downloaded.
// Usage: npm run setup:image [--from C:\_activeDev\moss_image] [--force]
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, linkSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { fail, info, ok, parseArgs, ROOT, warn } from "./lib/util.ts";

const { flags } = parseArgs();
const DIR = join(ROOT, "models", "image");
const SDCPP = join(DIR, "sdcpp");
const from = typeof flags.from === "string" ? flags.from : undefined;
if (from && !existsSync(from)) fail(`--from ${from} doesn't exist.`);
mkdirSync(SDCPP, { recursive: true });

const MODELS = [
  { file: "z_image_turbo-Q4_K.gguf", url: "https://huggingface.co/leejet/Z-Image-Turbo-GGUF/resolve/main/z_image_turbo-Q4_K.gguf", kind: "diffusion_models" },
  { file: "Qwen3-4B-Instruct-2507-Q4_K_M.gguf", url: "https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf", kind: "text_encoders" },
  { file: "flux1_ae.safetensors", url: "https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/vae/ae.safetensors", kind: "vae" },
];

/** Hard-link (or copy, across drives) src to dest. */
const link = (src: string, dest: string) => {
  try {
    linkSync(src, dest);
    return "linked";
  } catch {
    copyFileSync(src, dest);
    return "copied";
  }
};
const download = (url: string, dest: string) => {
  info(`downloading ${url.replace(/^https:\/\/[^/]+\//, "")}`);
  const r = spawnSync("curl", ["-L", "--fail", "--progress-bar", "-o", `${dest}.part`, url], { stdio: "inherit" });
  if (r.status !== 0) fail(`download failed: ${url}`);
  rmSync(dest, { force: true });
  spawnSync(process.platform === "win32" ? "cmd" : "mv", process.platform === "win32" ? ["/c", "move", "/y", `${dest}.part`, dest] : [`${dest}.part`, dest], { stdio: "ignore" });
};

// --- models
for (const m of MODELS) {
  const dest = join(DIR, m.file);
  if (existsSync(dest) && !flags.force) {
    ok(`${m.file} (already there)`);
    continue;
  }
  rmSync(dest, { force: true });
  const local = from ? [join(from, "models", m.kind, m.file), join(from, m.file)].find(existsSync) : undefined;
  if (local) ok(`${m.file} (${link(local, dest)} from ${local})`);
  else {
    download(m.url, dest);
    ok(`${m.file} (${(statSync(dest).size / 2 ** 30).toFixed(2)} GB)`);
  }
}

// --- stable-diffusion.cpp
const cli = join(SDCPP, process.platform === "win32" ? "sd-cli.exe" : "sd-cli");
if (existsSync(cli) && !flags.force) ok("sd-cli (already there)");
else if (from && existsSync(join(from, "sdcpp", "sd-cli.exe"))) {
  let n = 0;
  for (const f of readdirSync(join(from, "sdcpp"), { withFileTypes: true })) {
    if (!f.isFile() || !/\.(exe|dll|txt)$/i.test(f.name)) continue;
    rmSync(join(SDCPP, f.name), { force: true });
    link(join(from, "sdcpp", f.name), join(SDCPP, f.name));
    n++;
  }
  ok(`sd-cli + ${n - 1} files linked from ${join(from, "sdcpp")}`);
} else {
  if (process.platform !== "win32") fail("Off Windows, build stable-diffusion.cpp yourself and put sd-cli in models/image/sdcpp/ (https://github.com/leejet/stable-diffusion.cpp).");
  info("finding the latest stable-diffusion.cpp Windows CUDA 12 build");
  const rel = spawnSync("curl", ["-sL", "https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest"], { encoding: "utf8" });
  const assets = (JSON.parse(rel.stdout || "{}").assets ?? []) as { name: string; browser_download_url: string }[];
  const want = [assets.find((a) => /bin-win-cuda12-x64\.zip$/.test(a.name)), assets.find((a) => /^cudart-sd-bin-win-cu12-x64\.zip$/.test(a.name))];
  if (want.some((a) => !a)) fail("couldn't find the CUDA 12 Windows zips in the latest stable-diffusion.cpp release; download them by hand into models/image/sdcpp/ (see its releases page).");
  for (const a of want) {
    const zip = join(DIR, a!.name);
    download(a!.browser_download_url, zip);
    if (spawnSync("tar", ["-xf", zip, "-C", SDCPP], { stdio: "inherit" }).status !== 0) fail(`couldn't unpack ${a!.name}`);
    rmSync(zip, { force: true });
  }
  ok("stable-diffusion.cpp unpacked into models/image/sdcpp/");
}

const v = spawnSync(cli, ["--help"], { encoding: "utf8" });
if (v.status !== 0 && !/usage/i.test(v.stdout + v.stderr)) warn("sd-cli didn't start: check the CUDA runtime DLLs are next to it.");
ok(`local image generation ready in ${DIR.replace(ROOT, ".")}`);
console.log('Try it: npm run generate -- --sample "a cargo drone over a desert test range at dusk, documentary photography"');
