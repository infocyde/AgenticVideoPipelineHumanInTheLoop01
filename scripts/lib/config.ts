// config.yaml: kit-wide settings (local TTS, Shorts, local music beds, image generation). Every key is optional; defaults below.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { fail, ROOT } from "./util.ts";

export const configSchema = z.object({
  voice: z
    .object({
      enabled: z.boolean().default(false),
      engine: z.enum(["chatterbox", "kokoro", "qwen", "qwen-cloud"]).default("chatterbox"),
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
      qwen: z
        .object({
          size: z.enum(["1.7B", "0.6B"]).default("1.7B"),
          language: z.string().default("English"),
          cloud_concurrency: z.number().int().min(1).max(32).default(8), // qwen-cloud: sentences sent to Replicate at once
        })
        .prefault({}),
      pause: z.number().min(0).max(3).default(0.35),
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
  music_gen: z
    .object({
      enabled: z.boolean().default(false),
      model: z.enum(["medium", "small-music"]).default("medium"),
      steps: z.number().int().min(1).max(100).default(8),
      lufs: z.number().min(-30).max(-10).default(-20.3), // integrated loudness of the bed (the library bed's level)
    })
    .prefault({}),
  licensing: z
    .object({
      press_images: z.boolean().default(false), // allow official manufacturer press images (license "PRESS")
      stock_media: z.enum(["off", "music-video"]).default("off"), // free stock sites (license "STOCK"), music videos only
    })
    .prefault({}),
  youtube: z
    .object({
      search_youtube: z.boolean().default(true), // search YouTube, read transcripts, use CC BY clips
      use_video_as_citation: z.boolean().default(true), // a video may be a cited source (else leads only)
    })
    .prefault({}),
  x_posts: z
    .object({
      enabled: z.boolean().default(false), // posts by official / well-known accounts may be cited and shown (npm run xpost)
    })
    .prefault({}),
  image_gen: z
    .object({
      mode: z.enum(["local_render", "cloud_render", "mixed"]).default("mixed"),
      local: z
        .object({
          sdcpp: z.string().default("models/image/sdcpp/sd-cli.exe"),
          model: z.string().default("models/image/z_image_turbo-Q4_K.gguf"),
          text_encoder: z.string().default("models/image/Qwen3-4B-Instruct-2507-Q4_K_M.gguf"),
          vae: z.string().default("models/image/flux1_ae.safetensors"),
          width: z.number().int().min(256).max(2048).default(1600),
          height: z.number().int().min(256).max(2048).default(896),
          steps: z.number().int().min(1).max(100).default(8),
          cfg: z.number().min(1).max(10).default(1.5),
          shift: z.number().min(0).max(20).default(3),
          sampler: z.string().default("euler"),
          scheduler: z.string().default("discrete"),
          negative_prompt: z.string().default("blurry, out of focus, low quality, jpeg artifacts, noise, oversaturated, overexposed, watermark, signature, logo, text, caption, letters, garbled text, deformed, distorted, extra limbs, malformed hands, bad anatomy, duplicate, cropped, frame, border"),
          offload_to_cpu: z.boolean().default(true),
          flash_attention: z.boolean().default(true),
          vae_tiling: z.boolean().default(false),
        })
        .prefault({}),
      cloud: z
        .object({
          resolution: z.enum(["768sq", "1k", "1.5k", "2k", "4k"]).default("2k"),
          safety: z.number().int().min(0).max(4).default(2),
        })
        .prefault({}),
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
