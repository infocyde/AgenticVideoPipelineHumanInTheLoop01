// Synthesize a sound effect with the explainer sound kit (.claude/skills/explainer/lib/sound.js) and add it to an
// episode (public/episodes/<slug>/sfx/<name>.mp3) or to the shared library (public/library/sfx/<name>.mp3).
// Credited OWN WORK; the notes record exactly how to make it again. assets.json is refreshed for an episode.
//
// Usage:
//   npm run sfx -- list                                             kit sounds and their options
//   npm run sfx -- <slug> <name> --sound <kit sound> [options]      one kit sound, e.g. --sound stamp --gain 1.2
//   npm run sfx -- <slug> <name> --recipe [file.js]                 a layered recipe (default episodes/<slug>/sfx/<name>.js)
//   npm run sfx -- --library <name> --sound … | --recipe <file.js>  add to public/library instead (every episode)
// Options for --sound: --gain <x> --f <Hz or note, e.g. 820 or E6> --dur <s> --pan <-1..1> --material <marker|chalk|pencil|pen|brush|sharpie>
//                      --n <count> --rate <s> --top <Hz>
// Always: --length <s> (render window, default 3; trailing silence is trimmed) --force (replace an existing file)
//
// A recipe is one function of the kit, with times in seconds from the start of the sound:
//   (k) => { k.play('thud', 0, { f: 90 }); k.play('glitch', 0.04); k.noise(0, { dur: 0.6, color: 'pink', filter: 'lowpass', f: [[0, 3000], [0.6, 200]] }); }
// Level: normalized like the library (about -16 LUFS integrated, true peak no higher than -1.8 dBTP). Set the playback
// volume in episode.json (audio.sfxExtra[].volume), not in the sound.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { type Credit, OWN_LICENSE } from "../src/kit/schema.ts";
import { scanAssets } from "./lib/assets.ts";
import { launchBrowser, newContext } from "./lib/browser.ts";
import { fail, info, ok, parseArgs, paths, PUBLIC, readJson, ROOT, SLUG_RE, warn } from "./lib/util.ts";

const KIT = join(ROOT, ".claude", "skills", "explainer", "lib", "sound.js");
const LIBRARY = join(PUBLIC, "library");
const usage = "npm run sfx -- <slug> <name> --sound <kit sound> | --recipe [file.js]   (or --library <name> …, or list)";
const { positional, flags } = parseArgs();
const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string).trim() : undefined);
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");

// Options a kit sound reads, and what they mean (for `list`).
const OPTS: Record<string, string> = {
  gain: "drive into the kit compressor (the output level is normalized anyway)", f: "pitch / filter frequency in Hz or a note (E6)", dur: "length in s (whoosh, swish, riser, buzz, stroke, paper, tape, roller, erase, neon)",
  pan: "-1 left .. 1 right", material: "stroke surface: marker, chalk, pencil, pen, brush, sharpie", n: "count (typing keys, sparkle notes, text blips)",
  rate: "seconds between hits (typing, text)", top: "whoosh peak frequency in Hz",
};
const NUM_OPTS = ["gain", "dur", "pan", "n", "rate", "top"];

const browser = await launchBrowser();
try {
  const ctx = await newContext(browser, {});
  const page = await ctx.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ content: readFileSync(KIT, "utf8") });
  const sounds = await page.evaluate(() => {
    const w = window as unknown as { SOUND: { kit: (c: BaseAudioContext, o: unknown) => { sounds: string[] } } };
    return w.SOUND.kit(new OfflineAudioContext(2, 48, 48000), {}).sounds;
  });

  if (positional[0] === "list") {
    console.log(`Kit sounds (${KIT.replace(ROOT, "").replace(/\\/g, "/").slice(1)}):\n  ${sounds.join(", ")}`);
    console.log(`\nOptions for --sound:\n${Object.entries(OPTS).map(([k, v]) => `  --${k.padEnd(9)} ${v}`).join("\n")}`);
    console.log(`\nRecipes also get k.tone(t, {...}) and k.noise(t, {...}) for anything new; see the primitives in sound.js.`);
    process.exit(0);
  }

  // --- where it goes
  const lib = !!flags.library;
  const slug = lib ? undefined : positional[0];
  const name = lib ? (typeof flags.library === "string" ? (flags.library as string) : positional[0]) : positional[1];
  if (!lib) {
    if (!slug || !SLUG_RE.test(slug)) fail(`Give an episode slug, or --library.\n  usage: ${usage}`);
    if (!existsSync(paths(slug!).episode)) fail(`No episode at episodes/${slug}/episode.json.`);
  }
  if (!name || !/^[a-z0-9_-]+$/.test(name)) fail(`Give the sound a name (lowercase letters, digits, _ or -), e.g. sonar_ping.\n  usage: ${usage}`);
  const base = lib ? LIBRARY : paths(slug!).pub;
  const out = join(base, "sfx", `${name}.mp3`);
  const creditsFile = lib ? join(LIBRARY, "credits.json") : paths(slug!).credits;
  if (existsSync(out) && !flags.force) fail(`${rel(out)} already exists. Pick another name, or pass --force to replace it.`);
  if (!lib && existsSync(join(LIBRARY, "sfx", `${name}.mp3`))) warn(`"${name}" is also a library sound: this episode's file replaces it here, including where the sfx preset uses it.`);

  // --- what it is
  let recipe = "";
  let how = "";
  const sound = str("sound");
  if (sound) {
    if (!sounds.includes(sound)) fail(`Unknown kit sound "${sound}". Kit sounds: ${sounds.join(", ")}`);
    const o: Record<string, string | number> = {};
    for (const k of Object.keys(OPTS)) {
      const v = str(k);
      if (v === undefined) continue;
      if (NUM_OPTS.includes(k)) {
        const n = Number(v);
        if (!Number.isFinite(n)) fail(`--${k} must be a number`);
        o[k] = n;
      } else o[k] = k === "f" && Number.isFinite(Number(v)) ? Number(v) : v;
    }
    recipe = `(k) => { k.play(${JSON.stringify(sound)}, 0, ${JSON.stringify(o)}); }`;
    how = `kit sound "${sound}"${Object.keys(o).length ? ` with ${Object.entries(o).map(([k, v]) => `--${k} ${v}`).join(" ")}` : ""}`;
  } else if (flags.recipe) {
    const file = typeof flags.recipe === "string" ? resolve(ROOT, flags.recipe as string) : lib ? "" : join(paths(slug!).src, "sfx", `${name}.js`);
    if (!file) fail("For a library sound, give the recipe file: --recipe <path/to/name.js>");
    if (!existsSync(file)) fail(`No recipe at ${rel(file)}. Write one function of the kit, e.g.\n  (k) => { k.play('thud', 0, { f: 90 }); k.play('glitch', 0.04); }`);
    recipe = readFileSync(file, "utf8").trim().replace(/;$/, "");
    how = `recipe ${rel(file)}`;
  } else {
    fail(`Say what to make: --sound <kit sound> or --recipe.\n  usage: ${usage}\n  npm run sfx -- list   shows the kit sounds`);
  }
  const length = Number(str("length") ?? 3);
  if (!(length > 0 && length <= 30)) fail("--length must be between 0 and 30 seconds");

  // --- render in the page: offline Web Audio -> trimmed 16-bit stereo WAV
  info(`synthesizing ${how}…`);
  const r = await page.evaluate(async ({ src, length }) => {
    const w = window as unknown as { SOUND: { renderOffline: (f: unknown, d: number, sr: number, o: unknown) => Promise<{ inter: Float32Array; peak: number }> } };
    let fn: (k: unknown) => void;
    try { fn = (0, eval)(`(${src})`); } catch (e) { return { error: `recipe does not parse: ${(e as Error).message}` }; }
    if (typeof fn !== "function") return { error: "the recipe must be a single function: (k) => { … }" };
    const sr = 48000;
    let res: { inter: Float32Array; peak: number };
    try { res = await w.SOUND.renderOffline(fn, length, sr, {}); } catch (e) { return { error: (e as Error).message }; }
    const inter = res.inter;
    let last = 0;
    for (let i = inter.length - 1; i >= 0; i--) if (Math.abs(inter[i]) > 1e-3) { last = i; break; }
    if (!last) return { error: "the sound is silent" };
    const frames = Math.min(inter.length / 2, Math.floor(last / 2) + Math.round(0.03 * sr)), n = frames * 2;
    const fade = Math.round(0.01 * sr); // 10 ms fade-out so the cut never clicks
    const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const tag = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    tag(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); tag(8, "WAVE"); tag(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); tag(36, "data"); v.setUint32(40, n * 2, true);
    const peak = res.peak || 1;
    for (let i = 0; i < n; i++) {
      const f = Math.floor(i / 2), g = f >= frames - fade ? (frames - f) / fade : 1;
      const s = Math.max(-1, Math.min(1, (inter[i] / peak) * 0.7 * g)); // pre-scale to -3 dBFS; ffmpeg sets the final level
      v.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true);
    }
    const u8 = new Uint8Array(buf); let bin = "";
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return { b64: btoa(bin), seconds: frames / sr, cut: last / 2 / sr >= length - 0.05 };
  }, { src: recipe, length });
  if ("error" in r) fail(r.error!);
  if (r.cut) warn(`the sound is still ringing at the end of the ${length}s window: raise --length.`);

  // --- level like the library, then MP3
  const tmp = join(ROOT, "out", "sfx-tmp");
  mkdirSync(tmp, { recursive: true });
  const wav = join(tmp, `${name}.wav`);
  writeFileSync(wav, Buffer.from(r.b64!, "base64"));
  const probe = spawnSync("ffmpeg", ["-hide_banner", "-i", wav, "-af", "loudnorm=print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const m = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf("{")).replace(/}[\s\S]*$/, "}")) as { input_i: string; input_tp: string };
  const I = Number(m.input_i), TP = Number(m.input_tp);
  const gain = Math.min(Number.isFinite(I) ? -16.3 - I : Infinity, -1.8 - TP);
  mkdirSync(dirname(out), { recursive: true });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", wav, "-af", `volume=${gain.toFixed(2)}dB`, "-c:a", "libmp3lame", "-q:a", "2", out]);
  rmSync(tmp, { recursive: true, force: true });

  // --- credit + assets
  const file = `sfx/${name}.mp3`;
  const credits: Credit[] = existsSync(creditsFile) ? readJson<Credit[]>(creditsFile) : [];
  const episode = lib ? undefined : readJson<{ brand?: { name?: string } }>(paths(slug!).episode);
  const entry: Credit = {
    file,
    title: `Sound effect: ${name}`,
    author: episode?.brand?.name ? `${episode.brand.name} (synthesized)` : "Own work (synthesized)",
    license: OWN_LICENSE,
    notes: `Synthesized with npm run sfx from the explainer sound kit, ${sound ? how : `${how}: ${recipe.replace(/\s+/g, " ").slice(0, 600)}`}. Duration ${r.seconds!.toFixed(2)}s.`,
  };
  writeFileSync(creditsFile, JSON.stringify([...credits.filter((c) => c.file !== file), entry], null, 2) + "\n");
  if (slug) scanAssets(slug);

  ok(`${rel(out)}  (${r.seconds!.toFixed(2)}s, ${Number.isFinite(I) ? `${(I + gain).toFixed(1)} LUFS, ` : ""}peak ${(TP + gain).toFixed(1)} dBTP)`);
  console.log(`
Next:
  • LISTEN to it before using it.
  • Use it on a spoken cue: "audio": { "sfxExtra": [{ "sfx": "${name}", "cue": "<spoken phrase>", "volume": 0.5 }] }${lib ? `
  • It's in the shared library now: run npm run assets -- <slug> in each episode that should see it.` : ""}`);
} finally {
  await browser.close();
}
