// Shared helpers for the pipeline scripts: paths, argument parsing and console output.
import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PUBLIC = join(ROOT, "public");

/** True when the module at `url` is the script being run (not imported). */
export const isMain = (url: string) => !!process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === url;

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const paths = (slug: string) => {
  const src = join(ROOT, "episodes", slug);
  const pub = join(PUBLIC, "episodes", slug);
  return {
    src,
    pub,
    out: join(ROOT, "out", slug),
    episode: join(src, "episode.json"),
    script: join(src, "voiceover.txt"),
    heard: join(src, "heard.txt"),
    article: join(src, "article.md"),
    timing: join(pub, "timing.json"),
    assets: join(pub, "assets.json"),
    credits: join(pub, "credits.json"),
    // music videos
    lyrics: join(src, "lyrics.txt"),
    /** Vocal stem and transcription cache (npm run lyrics); git-ignored with the episode folder. */
    stems: join(src, "stems"),
    lyricsDiff: join(src, "lyrics-diff.txt"),
  };
};

const c = (code: number) => (s: string) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
export const red = c(31);
export const green = c(32);
export const yellow = c(33);
export const dim = c(2);
export const bold = c(1);

export const ok = (msg: string) => console.log(`${green("✔")} ${msg}`);
export const warn = (msg: string) => console.log(`${yellow("⚠")} ${msg}`);
export const info = (msg: string) => console.log(`${dim("•")} ${msg}`);

/** Print a failure message and exit non-zero. */
export const fail = (msg: string): never => {
  console.error(`${red("✖")} ${msg}`);
  process.exit(1);
};

/** Parse `<slug> [--flag] [--key=value | --key value]` from argv. */
export const parseArgs = (argv = process.argv.slice(2)) => {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      rest.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split(/=(.*)/s);
      if (v !== undefined) flags[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) flags[k] = argv[++i];
      else flags[k] = true;
    } else positional.push(a);
  }
  return { positional, flags, rest };
};

/** Read the slug argument and make sure the episode exists. */
export const requireSlug = (usage: string, mustExist = true): string => {
  const slug = parseArgs().positional[0];
  if (!slug) fail(`Missing episode slug.\n  usage: ${usage}`);
  if (!SLUG_RE.test(slug)) fail(`"${slug}" is not a valid slug (lowercase letters, digits and single dashes, e.g. 2026-10-24-threat-brief).`);
  if (mustExist && !existsSync(paths(slug).episode)) fail(`No episode at episodes/${slug}/episode.json. Create it with: npm run new -- ${slug}`);
  return slug;
};

export const readJson = <T = unknown>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;

/** Run a command, inheriting stdio unless told otherwise. Returns the exit code. */
export const run = (cmd: string, args: string[], opts: SpawnSyncOptions = {}) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, ...opts });
  if (r.error) throw r.error;
  return r.status ?? 1;
};

/** Path to an executable in node_modules/.bin, with the Windows .cmd suffix where needed. */
export const bin = (name: string) => join(ROOT, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);

/** Python inside the kit's .venv (used only by alignment). */
export const venvPython = () =>
  process.platform === "win32" ? join(ROOT, ".venv", "Scripts", "python.exe") : join(ROOT, ".venv", "bin", "python");

/** Python inside .venv-music (PyTorch + CUDA: npm run compose, and Demucs / librosa / MMS for npm run lyrics). */
export const musicPython = () =>
  process.platform === "win32" ? join(ROOT, ".venv-music", "Scripts", "python.exe") : join(ROOT, ".venv-music", "bin", "python");

// Articles, conjunctions and short prepositions stay lowercase inside a title (AP style).
const MINOR = new Set(["a", "an", "the", "and", "but", "or", "nor", "as", "at", "by", "for", "in", "of", "off", "on", "per", "to", "via", "vs"]);

/** Title case for a YouTube title: "Poland's military buildup (Short 2)" -> "Poland's Military Buildup (Short 2)".
 *  Words that already have a capital (GPT-6.1, ChatGPT, FORTRESS) or start with a digit are left as written. */
export const titleCase = (title: string) => {
  const words = title.split(" ");
  return words
    .map((word, i) => {
      // Always capitalized: the first and last word, and the first word after a colon or inside parentheses.
      const edge = i === 0 || i === words.length - 1 || /[:(]$/.test(words[i - 1] ?? "") || word.startsWith("(");
      const parts = word.split("-");
      return parts
        .map((part, j) => {
          const m = part.match(/^([^\p{L}\p{N}]*)(.*)$/su)!;
          const [, lead, core] = m;
          if (!core || /\p{Lu}/u.test(core) || /^\p{N}/u.test(core)) return part;
          // The last part of a hyphenated word is capitalized too ("Break-In").
          const capital = (edge && j === 0) || (j > 0 && j === parts.length - 1);
          if (MINOR.has(core.replace(/[^\p{L}]+$/u, "")) && !capital) return part;
          return lead + core[0].toUpperCase() + core.slice(1);
        })
        .join("-");
    })
    .join(" ");
};

export const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};
