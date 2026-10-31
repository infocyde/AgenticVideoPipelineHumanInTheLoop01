// ElevenLabs account helpers for `npm run voice` (engine elevenlabs): voices on the account, name -> voice_id, quota.
// The key (ELEVENLABS_API_KEY, from the environment or a .env here or in a parent folder) is never printed.
import { getSecret } from "./env.ts";

const API = "https://api.elevenlabs.io/v1";

export type ElevenVoice = { voice_id: string; name: string; category: string };
export type ElevenQuota = { tier: string; used: number; limit: number; reset: Date | null };
/** A call the key isn't allowed to make (restricted keys): which permission it lacks, e.g. "voices_read". */
export class MissingPermission extends Error {
  constructor(readonly permission: string, message: string) {
    super(message);
  }
}

export const elevenKey = (): string | null => getSecret("ELEVENLABS_API_KEY")?.value ?? null;

async function get<T>(key: string, path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: { "xi-api-key": key } });
  if (r.ok) return (await r.json()) as T;
  const body = (await r.json().catch(() => ({}))) as { detail?: { status?: string; message?: string } | string };
  const d = typeof body.detail === "object" ? body.detail : { message: String(body.detail ?? r.statusText) };
  if (d.status === "missing_permissions") throw new MissingPermission(d.message?.match(/permission (\w+)/)?.[1] ?? "?", d.message ?? "");
  throw new Error(`ElevenLabs ${path}: ${r.status} ${d.status ?? ""} ${d.message ?? ""}`.trim());
}

/** Every voice the account can use (its own clones, premade voices, library voices added to My Voices). */
export const elevenVoices = async (key: string): Promise<ElevenVoice[]> =>
  (await get<{ voices: ElevenVoice[] }>(key, "/voices")).voices.map(({ voice_id, name, category }) => ({ voice_id, name, category }));

/** Characters used and left this billing period, or null when the key may not read it (needs User: Read). */
export async function elevenQuota(key: string): Promise<ElevenQuota | null> {
  try {
    const s = await get<{ tier: string; character_count: number; character_limit: number; next_character_count_reset_unix?: number }>(key, "/user/subscription");
    return { tier: s.tier, used: s.character_count, limit: s.character_limit, reset: s.next_character_count_reset_unix ? new Date(s.next_character_count_reset_unix * 1000) : null };
  } catch {
    return null;
  }
}

export const quotaLine = (q: ElevenQuota | null): string =>
  q
    ? `${q.used.toLocaleString()} of ${q.limit.toLocaleString()} characters used (${(q.limit - q.used).toLocaleString()} left, ${q.tier} plan${q.reset ? `, resets ${q.reset.toLocaleDateString()}` : ""})`
    : "quota not readable with this key (give it the User: Read permission to see it)";

const looksLikeId = (s: string) => /^[A-Za-z0-9]{20}$/.test(s);
const squash = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

/**
 * The voice to use: `voiceId` when given (no lookup), else `voice` matched case-insensitively against the account's
 * voice names (then ignoring spaces, _ and -), else `voice` as a raw voice_id. Throws a readable message on failure.
 */
export async function resolveElevenVoice(key: string, voice: string, voiceId?: string | null): Promise<ElevenVoice> {
  if (voiceId) return { voice_id: voiceId, name: voice || voiceId, category: "set by voice_id" };
  let voices: ElevenVoice[];
  try {
    voices = await elevenVoices(key);
  } catch (e) {
    if (e instanceof MissingPermission) {
      if (looksLikeId(voice)) return { voice_id: voice, name: voice, category: "unknown (key can't read voices)" };
      throw new Error(
        `This ElevenLabs key can't list voices (it lacks the Voices: Read permission), so the name "${voice}" can't be looked up.\n` +
          `  Either edit the key at elevenlabs.io/app/settings/api-keys and allow Voices: Read (and User: Read, to see the quota),\n` +
          `  or copy the voice's ID (My Voices -> the voice -> "ID") into config.yaml voice.elevenlabs.voice_id.`,
      );
    }
    throw e;
  }
  const hit =
    voices.find((x) => x.voice_id === voice) ??
    voices.find((x) => x.name.toLowerCase() === voice.toLowerCase()) ??
    voices.find((x) => squash(x.name) === squash(voice)) ??
    voices.find((x) => x.name.toLowerCase().startsWith(`${voice.toLowerCase()} `)); // "Name - description" style names
  if (hit) return hit;
  if (looksLikeId(voice)) return { voice_id: voice, name: voice, category: "not in My Voices" };
  throw new Error(`No ElevenLabs voice named "${voice}" on this account. Voices it has:\n${voices.map((x) => `  ${x.name}  (${x.category})`).join("\n")}\nAdd it to My Voices in ElevenLabs, or set voice.elevenlabs.voice to one of these.`);
}
