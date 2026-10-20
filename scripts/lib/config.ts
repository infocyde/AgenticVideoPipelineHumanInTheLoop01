// config.yaml: kit-wide settings (local TTS, Shorts). Every key is optional; defaults below.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { fail, ROOT } from "./util.ts";

export const configSchema = z.object({
  voice: z
    .object({
      enabled: z.boolean().default(false),
      engine: z.enum(["chatterbox", "kokoro", "qwen"]).default("chatterbox"),
      reference: z.string().nullish(), // the clip Chatterbox and Qwen clone (voices/<name>.wav)
      chatterbox: z
        .object({
          model: z.enum(["turbo", "standard"]).default("turbo"),
          reference: z.string().nullish(), // older place for voice.reference; still read
          exaggeration: z.number().min(0).max(2).default(0.5),
          cfg_weight: z.number().min(0).max(1).default(0.5),
        })
        .prefault({}),
      kokoro: z.object({ voice: z.string().default("am_michael"), speed: z.number().min(0.5).max(2).default(1) }).prefault({}),
      qwen: z.object({ size: z.enum(["1.7B", "0.6B"]).default("1.7B"), language: z.string().default("English") }).prefault({}),
      pause: z.number().min(0).max(3).default(0.3),
      seed: z.number().int().default(7),
    })
    .prefault({}),
  shorts: z
    .object({
      enabled: z.boolean().default(false),
      count: z.number().int().min(1).max(3).default(2),
      maxSeconds: z.number().min(15).max(180).default(60),
    })
    .prefault({}),
});
export type Config = z.output<typeof configSchema>;

export const CONFIG_FILE = join(ROOT, "config.yaml");

/** Read and validate config.yaml (missing file = all defaults). Exits with a readable message when it's invalid. */
export const loadConfig = (): Config => {
  const raw = existsSync(CONFIG_FILE) ? (parse(readFileSync(CONFIG_FILE, "utf8")) ?? {}) : {};
  const r = configSchema.safeParse(raw);
  if (!r.success) return fail(`config.yaml: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return r.data;
};
