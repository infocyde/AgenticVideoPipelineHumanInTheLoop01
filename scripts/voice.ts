// Local text-to-speech for the voiceover (replaces ElevenLabs): voiceover.txt -> public/episodes/<slug>/voiceover.mp3,
// then `align`. Engine and voice come from config.yaml (voice:), and can be overridden per run.
// Engines run in .venv-tts (Python 3.12 + CUDA PyTorch), made by `npm run setup:voice`. See scripts/voice.py.
//
// Usage:
//   npm run voice -- <slug> [--engine chatterbox|kokoro|qwen|qwen-cloud] [--model turbo|standard] [--reference voices/x.wav]
//   qwen-cloud: Qwen3-TTS on Replicate (official qwen/qwen3-tts), all sentences in parallel (--concurrency N); needs REPLICATE_API_TOKEN
//                           [--voice am_michael] [--speed 1] [--seed 7] [--force] [--no-align]
//   --reference none   use the standard model's built-in voice instead of the clip in config.yaml
//   npm run voice -- --sample "A line to try." [same overrides]   writes out/voice-samples/<engine>-<voice>.mp3
//   npm run voice -- --voices                                     list Kokoro's preset voices
//   npm run voice -- --record [name] [--seconds 25] [--device "Mic name"] [--no-play]
//                     record your voice from the mic into voices/<name>.wav (default narrator), check it, play a cloned sample
//   --force       replace an existing voiceover.mp3 (kept as voiceover.prev.mp3), or re-record an existing voices/<name>.wav
//   --ignore-off  voice one episode while config.yaml has voice.enabled: false (still never overwrites without --force)
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { basename, join, relative, resolve } from "node:path";
import type { EpisodeInput } from "../src/kit/schema.ts";
import { loadConfig } from "./lib/config.ts";
import { getSecret } from "./lib/env.ts";
import { fail, info, ok, parseArgs, paths, readJson, requireSlug, ROOT, run, warn } from "./lib/util.ts";

const { flags } = parseArgs();
const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string).trim() : undefined);
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");

// --- config.yaml (voice:)
const v = loadConfig().voice;

// Chatterbox and Kokoro run in .venv-tts; Qwen3-TTS in .venv-qwen (it pins a different transformers).
const venvPy = (dir: string) => (process.platform === "win32" ? join(ROOT, dir, "Scripts", "python.exe") : join(ROOT, dir, "bin", "python"));
const py = venvPy(".venv-tts");
if (!existsSync(py)) fail("The TTS environment isn't installed. Run: npm run setup:voice  (one time, about 4 GB)");
const voicePy = join(ROOT, "scripts", "voice.py");
const refDefault = v.reference ?? v.chatterbox.reference ?? "";

if (flags.voices) {
  listClips();
  console.log("Kokoro presets (--engine kokoro --voice <id>):");
  process.exit(run(py, [voicePy, "--voices"]));
}

/** Print the reference clips in voices/ with their length (each is a voice: --reference voices/<name>.wav). */
function listClips() {
  const dir = join(ROOT, "voices");
  const clips = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(wav|flac|mp3)$/i.test(f)) : [];
  if (!clips.length) return console.log("Your voices: none yet (npm run voice -- --record)\n");
  const len = (f: string) => Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", join(dir, f)], { encoding: "utf8" }).stdout.trim());
  const current = refDefault ? basename(refDefault) : "";
  console.log("Your voices (cloned by Chatterbox or Qwen; use with --reference voices/<file>, or set voice.reference):");
  for (const f of clips) console.log(`  ${f === current ? "*" : " "} voices/${f.padEnd(24)} ${len(f).toFixed(1)}s${f === current ? "   (config.yaml default)" : ""}`);
  console.log("");
}

// --- settings for this run: config.yaml, then command-line overrides
const engine = (str("engine") ?? v.engine) as "chatterbox" | "kokoro" | "qwen" | "qwen-cloud";
if (!["chatterbox", "kokoro", "qwen", "qwen-cloud"].includes(engine)) fail(`--engine must be chatterbox, kokoro, qwen or qwen-cloud`);
const cloud = engine === "qwen-cloud";
const model = (str("model") ?? v.chatterbox.model) as "turbo" | "standard";
const refArg = str("reference") === "none" ? "" : (str("reference") ?? refDefault); // --reference none: the standard model's built-in voice
const reference = engine !== "kokoro" && refArg ? resolve(ROOT, refArg) : "";
const qwenSize = (str("size") ?? v.qwen.size) as "1.7B" | "0.6B";
const num = (k: string, d: number) => (str(k) === undefined ? d : Number(str(k)));
const settings = {
  engine,
  model,
  reference,
  exaggeration: num("exaggeration", v.chatterbox.exaggeration),
  cfg_weight: num("cfg-weight", v.chatterbox.cfg_weight),
  voice: str("voice") ?? v.kokoro.voice,
  speed: num("speed", v.kokoro.speed),
  pause: num("pause", v.pause),
  seed: num("seed", v.seed),
  qwen_size: qwenSize,
  language: str("language") ?? v.qwen.language,
  ref_text: "", // Qwen: transcript of the reference clip, filled in by refText()
  cloud_concurrency: num("concurrency", v.qwen.cloud_concurrency),
};

// --- record a reference clip of your voice
if (flags.record) await record();

// The on/off switch applies to episodes; --sample always works so you can audition voices before turning it on.
const isSample = str("sample") !== undefined || !!flags.sample;
const testOut = str("out"); // --out <file>: voice an episode's script to a separate file (a test take; the episode is untouched)
if (!isSample && !testOut && !v.enabled && !flags["ignore-off"]) fail("Local TTS is off (config.yaml: voice.enabled: false), so this episode's voiceover is recorded outside the kit. Set it to true, or pass --ignore-off for a one-off.");
if (engine !== "kokoro") {
  if (reference && !existsSync(reference)) fail(`No reference clip at ${rel(reference)}. Record one with: npm run voice -- --record  (see voices/README.md), or set voice.reference in config.yaml.`);
  if (!reference && (engine === "qwen" || cloud)) fail("Qwen3-TTS clones a voice, so it needs a reference clip (voice.reference in config.yaml, or --reference voices/<name>.wav).");
  if (!reference && model === "turbo") fail("Chatterbox Turbo needs a reference clip (voice.reference in config.yaml). Or use --model standard for its built-in voice, or --engine kokoro.");
}
if (engine === "qwen") {
  if (!existsSync(venvPy(".venv-qwen"))) fail("The Qwen3-TTS environment isn't installed. Run: npm run setup:voice -- --qwen  (one time)");
  settings.ref_text = refText(reference);
}
const replicate = cloud ? getSecret("REPLICATE_API_TOKEN") : null;
if (cloud) {
  if (!replicate) fail("qwen-cloud runs on Replicate: put REPLICATE_API_TOKEN in .env (or the environment).");
  if (!existsSync(py) && !existsSync(venvPy(".venv-qwen"))) fail("qwen-cloud needs a voice environment for joining the sentences (numpy, soundfile). Run: npm run setup:voice  (one time)");
  settings.ref_text = refText(reference);
}
const label =
  engine === "kokoro" ? `kokoro ${settings.voice}`
  : engine === "qwen" ? `qwen3-tts ${qwenSize} cloning ${rel(reference)}`
  : cloud ? `qwen3-tts on Replicate cloning ${rel(reference)}`
  : `chatterbox ${model}${reference ? ` cloning ${rel(reference)}` : " (built-in voice)"}`;

// --- one test line, no episode
if (isSample) {
  const text = str("sample") || "Tonight's brief: three systems, one question. How fast can they be replaced?";
  const dir = join(ROOT, "out", "voice-samples");
  mkdirSync(dir, { recursive: true });
  const who = reference ? basename(reference).replace(/\.[^.]+$/, "") : "default";
  const tag = engine === "kokoro" ? `kokoro-${settings.voice}` : engine === "qwen" ? `qwen-${qwenSize}-${who}` : cloud ? `qwen-cloud-${who}` : `chatterbox-${model}-${who}`;
  const txt = join(dir, `${tag}.txt`);
  writeFileSync(txt, text + "\n");
  const mp3 = synth(txt, join(dir, `${tag}.mp3`), dir);
  ok(`${rel(mp3)}  (${label})`);
  process.exit(0);
}

// --- a whole episode
const slug = requireSlug("npm run voice -- <slug> [--engine …] [--force]");
const p = paths(slug);
if (!existsSync(p.script)) fail(`episodes/${slug}/voiceover.txt is missing. Write (and get approval for) the script first.`);
let voName = "voiceover.mp3";
try {
  voName = readJson<EpisodeInput>(p.episode).audio?.voiceover ?? voName;
} catch {
  /* default name */
}
const out = join(p.pub, voName);

if (testOut) {
  const dest = resolve(ROOT, testOut.endsWith(".mp3") ? testOut : `${testOut}.mp3`);
  if (dest === resolve(out)) fail(`--out is this episode's own ${voName}. Drop --out to replace it (with --force), or pick another file name.`);
  if (existsSync(dest) && !flags.force) fail(`${rel(dest)} already exists. Pick another name, or pass --force to replace it.`);
  const work = join(p.out, "voice-test");
  mkdirSync(work, { recursive: true });
  const t0 = new Date();
  info(`start ${t0.toLocaleTimeString()}: voicing episodes/${slug}/voiceover.txt with ${label} (test take; ${voName}, timing.json and voice.json are not touched)`);
  const tmp = synth(p.script, join(work, "take.mp3"), work);
  mkdirSync(join(dest, ".."), { recursive: true });
  renameSync(tmp, dest);
  const t1 = new Date();
  const took = (t1.getTime() - t0.getTime()) / 1000;
  const length = Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dest], { encoding: "utf8" }).stdout.trim());
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  ok(`${rel(dest)}`);
  console.log(`  start  ${t0.toLocaleTimeString()}\n  end    ${t1.toLocaleTimeString()}\n  took   ${mmss(took)} (${took.toFixed(0)} s, model load included)\n  output ${mmss(length)} (${length.toFixed(1)} s), ${(length / took).toFixed(1)}x realtime`);
  process.exit(0);
}

if (existsSync(out) && !flags.force) fail(`public/episodes/${slug}/${voName} already exists (a recording, or an earlier take). Pass --force to replace it; the old file is kept as ${voName.replace(/\.mp3$/, "")}.prev.mp3.`);

const work = join(p.out, "voice");
mkdirSync(work, { recursive: true });
info(`voicing episodes/${slug}/voiceover.txt with ${label}…`);
const tmpMp3 = synth(p.script, join(work, "voiceover.mp3"), work);
if (existsSync(out)) renameSync(out, out.replace(/\.mp3$/, ".prev.mp3"));
mkdirSync(p.pub, { recursive: true });
renameSync(tmpMp3, out);
const script = readFileSync(p.script, "utf8");
writeFileSync(
  join(p.src, "voice.json"),
  JSON.stringify({ ...settings, reference: reference ? rel(reference) : null, made: new Date().toISOString(), scriptSha1: createHash("sha1").update(script).digest("hex") }, null, 2) + "\n",
);
ok(`public/episodes/${slug}/${voName}  (${label}; settings in episodes/${slug}/voice.json)`);

if (flags["no-align"]) {
  console.log(`\nNext: listen to it, then npm run align -- ${slug}`);
} else {
  info("aligning…");
  const code = run(process.execPath, [join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"), join(ROOT, "scripts", "align.ts"), slug]);
  if (code !== 0) fail("align failed (see above).");
  console.log(`\nListen to it: a word the TTS misread shows up as a mismatch in align's report and in episodes/${slug}/heard.txt.
Fix it by respelling the word in voiceover.txt for the ear (it is also the caption text), then run npm run voice -- ${slug} --force.`);
}

/** Run voice.py on a text file, return the MP3 path. */
function synth(textFile: string, mp3: string, dir: string): string {
  const args = join(dir, "voice-args.json");
  const wav = mp3.replace(/\.mp3$/, ".wav");
  writeFileSync(args, JSON.stringify({ ...settings, text: textFile, out: wav }));
  const python = settings.engine === "qwen" || (cloud && !existsSync(py)) ? venvPy(".venv-qwen") : py;
  const env = { ...process.env, PYTHONIOENCODING: "utf-8", HF_HUB_DISABLE_SYMLINKS_WARNING: "1", ...(replicate ? { REPLICATE_API_TOKEN: replicate.value } : {}) };
  const code = run(python, [voicePy, args], { env });
  if (code !== 0 || !existsSync(wav)) fail("speech synthesis failed (see above).");
  if (run("ffmpeg", ["-v", "error", "-y", "-i", wav, "-ar", "44100", "-c:a", "libmp3lame", "-q:a", "2", mp3]) !== 0) fail("ffmpeg could not encode the MP3.");
  rmSync(wav);
  rmSync(args);
  return mp3;
}

/**
 * Transcript of a reference clip, which Qwen3-TTS clones from together with the audio. Cached next to the clip as
 * voices/<name>.txt (edit it if Whisper got a word wrong); made the first time with the Whisper model `align` uses.
 */
function refText(clip: string): string {
  const txt = clip.replace(/\.[^.]+$/, ".txt");
  if (existsSync(txt)) return readFileSync(txt, "utf8").trim();
  const alignPy = venvPy(".venv");
  if (!existsSync(alignPy)) fail(`Qwen needs a transcript of ${rel(clip)}. Write it to ${rel(txt)}, or run npm run setup:align so it can be transcribed automatically.`);
  info(`transcribing ${rel(clip)} for Qwen (once; saved as ${rel(txt)})…`);
  // Decode with ffmpeg like align.py does: faster-whisper's own decoder (PyAV) breaks on some av versions.
  const code = [
    "import subprocess, sys",
    "import numpy as np",
    "from faster_whisper import WhisperModel",
    "raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], capture_output=True, check=True).stdout",
    "audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0",
    "m = WhisperModel('medium.en', device='cpu', compute_type='int8')",
    "segs, _ = m.transcribe(audio, beam_size=5)",
    "open(sys.argv[2], 'w', encoding='utf-8').write(' '.join(s.text.strip() for s in segs) + '\\n')",
  ].join("\n");
  if (run(alignPy, ["-c", code, clip, txt], { env: { ...process.env, PYTHONIOENCODING: "utf-8" } }) !== 0 || !existsSync(txt)) fail(`Couldn't transcribe ${rel(clip)}. Write what it says to ${rel(txt)} and try again.`);
  const t = readFileSync(txt, "utf8").trim();
  info(`  "${t.length > 120 ? `${t.slice(0, 117)}…` : t}"`);
  return t;
}

/** Record voices/<name>.wav from the microphone, check it, and play a sample of the clone. */
async function record(): Promise<never> {
  const valid = (n: string) => /^[a-z0-9_-]+$/.test(n);
  const clip = (n: string) => join(ROOT, "voices", `${n}.wav`);
  let name = typeof flags.record === "string" ? (flags.record as string) : "";
  if (!name) {
    // No name given: suggest the first free one and, in a terminal, ask.
    let suggestion = "narrator";
    for (let i = 2; existsSync(clip(suggestion)); i++) suggestion = `narrator${i}`;
    name = suggestion;
    if (process.stdin.isTTY) {
      listClips();
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      for (;;) {
        const a = (await rl.question(`Name for this voice (lowercase, e.g. calm, punchy, deep) [${suggestion}]: `)).trim().toLowerCase() || suggestion;
        if (!valid(a)) { console.log("  Use lowercase letters, digits, _ or -."); continue; }
        if (existsSync(clip(a)) && !flags.force && !/^y/i.test(await rl.question(`  voices/${a}.wav exists. Record over it? [y/N] `))) continue;
        name = a;
        break;
      }
      rl.close();
      flags.force = true; // the overwrite question was answered above
    }
  }
  if (!valid(name)) fail("Name the voice with lowercase letters, digits, _ or -, e.g. --record calm");
  const seconds = Number(str("seconds") ?? 25);
  const wav = clip(name);
  if (existsSync(wav) && !flags.force) fail(`${rel(wav)} already exists. Pass --force to record over it, or pick another name (--record ${name}2).`);
  console.log(`Saving as ${rel(wav)}${typeof flags.record === "string" || process.stdin.isTTY ? "" : `  (name it yourself with: npm run voice -- --record <name>)`}`);
  const input = micInput();
  const passage = [
    "Overnight, air defense units reported a new pattern of attacks along the southern front.",
    "Analysts say the shift matters less for what it destroyed than for what it reveals about supply.",
    "Here is what we know, what we don't, and why it matters for the weeks ahead.",
    "Stay with us. This one moves fast.",
  ];
  console.log(`\nMic: ${input.label}\nRead this in your channel voice: same pace and energy as a real episode. Don't rush; pauses are fine.\n`);
  passage.forEach((l) => console.log(`    ${l}`));
  console.log("");
  for (const n of [3, 2, 1]) {
    process.stdout.write(`\r  Recording starts in ${n}…  `);
    await new Promise((r) => setTimeout(r, 1000));
  }
  mkdirSync(join(ROOT, "out", "voice-record"), { recursive: true });
  const raw = join(ROOT, "out", "voice-record", `${name}.raw.wav`);
  const ff = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...input.args, "-t", String(seconds), "-ac", "1", "-ar", "48000", raw], { stdio: ["ignore", "inherit", "inherit"] });
  const t0 = Date.now();
  const tick = setInterval(() => process.stdout.write(`\r  ● RECORDING, read now   ${Math.max(0, seconds - Math.floor((Date.now() - t0) / 1000))}s left  `), 250);
  const code = await new Promise<number>((r) => ff.on("close", (c) => r(c ?? 1)));
  clearInterval(tick);
  process.stdout.write("\r  ■ done.                                   \n");
  if (code !== 0 || !existsSync(raw)) fail('Recording failed. Check the mic in Windows sound settings, or name one with --device "<name>" (ffmpeg -list_devices true -f dshow -i dummy lists them).');

  // Trim silence at both ends and take out rumble; otherwise the voice is left untouched (the clone copies it as is).
  mkdirSync(join(ROOT, "voices"), { recursive: true });
  const trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15";
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af", `highpass=f=70,${trim},areverse,${trim},areverse`, "-ar", "48000", "-c:a", "pcm_s16le", wav]);
  rmSync(wav.replace(/\.wav$/, ".txt"), { force: true }); // a new take needs a new transcript (Qwen); made on first use
  const q = analyze(raw, wav);
  console.log(`  length ${q.length.toFixed(1)}s · speech ${q.speech.toFixed(0)} dBFS · background ${q.noise.toFixed(0)} dBFS (${(q.speech - q.noise).toFixed(0)} dB clear) · peak ${q.peak.toFixed(1)} dBFS`);
  const problems = [
    q.peak > -0.5 && "it clipped (too loud): sit back a little or lower the mic level",
    q.speech < -38 && "it's quiet: move closer to the mic or raise its level in Windows sound settings",
    q.speech - q.noise < 25 && "there's a lot of background noise: find a quieter, softer room, and turn off fans",
    q.length < 8 && "it's short: read the whole passage (10-20 s of speech is ideal)",
  ].filter(Boolean) as string[];
  problems.forEach((m) => warn(m));
  ok(`${rel(wav)}${problems.length ? " (usable, but a cleaner take will clone better: run again with --force)" : ""}`);

  // Clone it straight away so you can hear the result: Chatterbox Turbo, or Qwen with --engine qwen (or engine: qwen).
  const sampleEngine = (str("engine") ?? v.engine) === "qwen" && existsSync(venvPy(".venv-qwen")) ? "qwen" : "chatterbox";
  Object.assign(settings, { engine: sampleEngine, model: "turbo", reference: wav, ref_text: sampleEngine === "qwen" ? refText(wav) : "" });
  const dir = join(ROOT, "out", "voice-samples");
  mkdirSync(dir, { recursive: true });
  const txt = join(dir, `clone-${name}.txt`);
  writeFileSync(txt, "This is my cloned voice, reading a line it has never heard. Tonight's brief: drones, decoys, and the arithmetic of air defense.\n");
  info("making a sample in the cloned voice…");
  const mp3 = synth(txt, join(dir, `clone-${name}.mp3`), dir);
  ok(`${rel(mp3)}  (your voice, cloned by ${sampleEngine === "qwen" ? "Qwen3-TTS" : "Chatterbox Turbo"})`);
  if (!flags["no-play"] && process.platform === "win32") spawn("cmd", ["/c", "start", "", mp3], { detached: true, stdio: "ignore" }).unref();
  console.log(`\nUse it: config.yaml -> voice.chatterbox.reference: voices/${name}.wav (and enabled: true to voice episodes with it).`);
  process.exit(0);
}

/** ffmpeg input args for the default microphone (or --device). */
function micInput(): { args: string[]; label: string } {
  const dev = str("device");
  if (process.platform === "darwin") return { args: ["-f", "avfoundation", "-i", `:${dev ?? "0"}`], label: dev ?? "default input" };
  if (process.platform !== "win32") return { args: ["-f", "pulse", "-i", dev ?? "default"], label: dev ?? "default" };
  let name = dev;
  if (!name) {
    // Prefer a plugged-in mic (USB, headset, podcast mics) over the laptop's built-in array.
    const r = textOf("ffmpeg", ["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"]);
    const mics = [...r.matchAll(/"([^"]+)" \(audio\)/g)].map((m) => m[1]);
    if (!mics.length) fail('No microphone found. Plug one in, or name it with --device "<name>".');
    name = mics.find((m) => /usb|headset|yeti|rode|shure|blue|hyperx|fifine|samson|elgato|focusrite|scarlett/i.test(m)) ?? mics.find((m) => !/array|built-?in|internal/i.test(m)) ?? mics[0];
    if (mics.length > 1) console.log(`Mics found: ${mics.map((m) => (m === name ? `[${m}]` : m)).join(", ")}  (pick another with --device "<name>")`);
  }
  return { args: ["-f", "dshow", "-i", `audio=${name}`], label: name! };
}

/** stdout + stderr of a command, whatever its exit code (ffmpeg prints the device list on stderr, and older builds exit 1). */
function textOf(cmd: string, args: string[]): string {
  const r = spawnSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return `${r.stdout ?? ""}${r.stderr ?? ""}`;
}

/** Levels of a take: background noise from the raw file (it includes the pause before you start), speech from the trimmed one. */
function analyze(raw: string, trimmed: string) {
  const pcm = (f: string) => {
    const b = execFileSync("ffmpeg", ["-v", "error", "-i", f, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"], { maxBuffer: 1 << 28 });
    const n = Math.floor(b.byteLength / 4);
    return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + n * 4)); // copy: the Buffer may not be 4-byte aligned
  };
  const windows = (x: Float32Array) => {
    const out: number[] = [];
    for (let i = 0; i + 800 <= x.length; i += 800) {
      let s = 0;
      for (let j = i; j < i + 800; j++) s += x[j] * x[j];
      out.push(10 * Math.log10(s / 800 + 1e-12));
    }
    return out.sort((a, b) => a - b);
  };
  const pct = (a: number[], q: number) => a[Math.min(a.length - 1, Math.floor(a.length * q))] ?? -120;
  const r = pcm(raw), t = pcm(trimmed);
  let peak = 0;
  for (const x of r) peak = Math.max(peak, Math.abs(x));
  return { length: t.length / 16000, speech: pct(windows(t), 0.9), noise: pct(windows(r), 0.08), peak: 20 * Math.log10(peak + 1e-12) };
}
