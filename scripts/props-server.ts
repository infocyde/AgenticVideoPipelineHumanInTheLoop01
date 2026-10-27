// Save edits from Remotion Studio's props panel back to episodes/<slug>/episode.json.
// Studio's own "Save" button can't work in this kit: it rewrites a literal defaultProps object in src/Root.tsx, but
// Root builds every composition's props from episode.json in a loop. Instead, the Studio-only "Save to episode.json"
// button (src/kit/components/SaveProps.tsx) posts the edited episode here. It is validated against the schema and
// only the fields that differ from the file are written (schema defaults Studio fills in aren't added), so the file
// keeps its layout. Studio then hot-reloads, since episode.json is imported by src/episodes.generated.ts.
//
// Started by `npm run preview` alongside Studio. On its own: npm run props-server [-- --port 3011]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { episodeSchema, isMusicVideo, musicVideoSchema } from "../src/kit/schema.ts";
import { fail, info, isMain, ok, parseArgs, paths, SLUG_RE, warn } from "./lib/util.ts";

export const PROPS_PORT = 3011;

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
const isObj = (v: unknown): v is Record<string, Json> => typeof v === "object" && v !== null && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Apply what changed from `before` (the file as Studio saw it, defaults filled in) to `after` onto `raw` (the file). */
const applyChanges = (raw: Json | undefined, before: Json | undefined, after: Json): Json => {
  if (!isObj(after) || !isObj(before)) return after;
  const out: Record<string, Json> = isObj(raw) ? { ...raw } : {};
  for (const k of Object.keys(after)) {
    if (k in before && same(before[k], after[k])) continue;
    out[k] = applyChanges(isObj(raw) ? raw[k] : undefined, before[k], after[k]);
  }
  for (const k of Object.keys(before)) if (!(k in after)) delete out[k];
  return out;
};

export const saveEpisode = (slug: string, edited: unknown): { ok: true; changed: boolean } | { ok: false; error: string } => {
  if (!SLUG_RE.test(slug)) return { ok: false, error: `"${slug}" is not a valid slug` };
  const file = paths(slug).episode;
  if (!existsSync(file)) return { ok: false, error: `no episodes/${slug}/episode.json` };
  const raw = JSON.parse(readFileSync(file, "utf8")) as Json;
  const schema = isMusicVideo(raw) ? musicVideoSchema : episodeSchema;
  const parsed = schema.safeParse(edited);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: `not saved, the edit doesn't validate: ${i.path.join(".") || "(root)"}: ${i.message}` };
  }
  const before = schema.safeParse(raw);
  const next = applyChanges(raw, (before.success ? before.data : raw) as Json, edited as Json);
  if (same(next, raw)) return { ok: true, changed: false };
  writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  return { ok: true, changed: true };
};

export const startPropsServer = (port = PROPS_PORT): Server => {
  const server = createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return void res.writeHead(204).end();
    const m = req.url?.match(/^\/save\/([^/?]+)$/);
    if (req.method !== "POST" || !m) return void res.writeHead(404).end();
    let body = "";
    req.on("data", (c: Buffer) => {
      body += c.toString();
      if (body.length > 5_000_000) req.destroy();
    });
    req.on("end", () => {
      let result: ReturnType<typeof saveEpisode>;
      try {
        result = saveEpisode(decodeURIComponent(m[1]), JSON.parse(body).episode);
      } catch (e) {
        result = { ok: false, error: `bad request: ${(e as Error).message}` };
      }
      if (result.ok) (result.changed ? ok : info)(`props: ${result.changed ? "saved" : "no changes for"} episodes/${m[1]}/episode.json`);
      else warn(`props: ${m[1]}: ${result.error}`);
      res.writeHead(result.ok ? 200 : 400, { "Content-Type": "application/json" }).end(JSON.stringify(result));
    });
  });
  server.on("error", (e: NodeJS.ErrnoException) =>
    warn(e.code === "EADDRINUSE" ? `props server: port ${port} is in use (another preview running?); Studio edits can't be saved from this one` : `props server: ${e.message}`),
  );
  // All interfaces, like Studio, so the button also works when Studio is opened from another computer on the network.
  server.listen(port, "0.0.0.0", () => info(`props server on port ${port}: Studio's "Save to episode.json" button writes episode.json`));
  return server;
};

if (isMain(import.meta.url)) {
  const { flags } = parseArgs();
  const port = typeof flags.port === "string" ? Number(flags.port) : PROPS_PORT;
  if (!Number.isInteger(port)) fail("--port must be a number");
  startPropsServer(port);
}
