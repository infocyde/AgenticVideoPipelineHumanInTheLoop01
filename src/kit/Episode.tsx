// Turns one registry entry (episode.json + timing.json + assets.json) into the props-driven compositions.
import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { SaveProps } from "./components/SaveProps";
import { EpisodeProvider, type EpisodeCtx } from "./context";
import { Countdown } from "./formats/Countdown";
import { List } from "./formats/List";
import { Short } from "./formats/Short";
import { PunchThumbnail } from "./PunchThumbnail";
import { parseCredits, usedCredits } from "./lib/credits";
import { resolveEpisode } from "./lib/resolve";
import { assetsSchema, type Episode, episodeSchema, type Timing, timingSchema } from "./schema";
import { getSkin } from "./skins";
import { getTheme } from "./themes";
import { Thumbnail } from "./Thumbnail";

export type RegistryEntry = {
  slug: string;
  episode: unknown;
  timing: unknown;
  assets: unknown;
  /** public/episodes/<slug>/credits.json and public/library/credits.json (null when missing). */
  credits: unknown;
  libraryCredits: unknown;
};

/** Composition props: the whole episode.json, editable in Studio's props panel. */
export const compositionSchema = z.object({ episode: episodeSchema });
export type CompositionProps = z.input<typeof compositionSchema>;

const EMPTY_TIMING: Timing = { duration: 10, estimated: true, words: [] };

export type Loaded =
  | { ok: true; ctx: EpisodeCtx }
  | { ok: false; slug: string; errors: string[] };

/** Parse and resolve an episode. Never throws, so one broken episode doesn't take Studio down. */
export const loadEpisode = (entry: RegistryEntry, rawEpisode: unknown = entry.episode): Loaded => {
  const { slug, timing: rawTiming, assets: rawAssets } = entry;
  const ep = episodeSchema.safeParse(rawEpisode);
  if (!ep.success) {
    return { ok: false, slug, errors: ep.error.issues.map((i) => `episode.json ${i.path.join(".") || "(root)"}: ${i.message}`) };
  }
  const errors: string[] = [];
  let timing = EMPTY_TIMING;
  if (rawTiming == null) errors.push(`timing.json missing: run \`npm run align -- ${slug}\` (or \`--estimate\`)`);
  else {
    const t = timingSchema.safeParse(rawTiming);
    if (t.success) timing = t.data;
    else errors.push(`timing.json invalid: ${t.error.issues[0]?.message}`);
  }
  const assets = assetsSchema.parse(rawAssets ?? {});
  const episode: Episode = ep.data;
  if (errors.length) return { ok: false, slug, errors };
  const timeline = resolveEpisode(episode, timing, assets);
  const credits = usedCredits(episode, timeline, assets, parseCredits(entry.credits), parseCredits(entry.libraryCredits));
  return { ok: true, ctx: { episode, timeline, assets, credits, theme: getTheme(episode.theme), base: `episodes/${slug}` } };
};

export const ErrorCard: React.FC<{ slug: string; errors: string[] }> = ({ slug, errors }) => (
  <AbsoluteFill style={{ background: "#1a0606", color: "#fff", padding: 80, fontFamily: "monospace", fontSize: 30, lineHeight: 1.4 }}>
    <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 30, color: "#ff6b6b" }}>{slug} can't be shown yet</div>
    {errors.slice(0, 14).map((e, i) => (
      <div key={i}>• {e}</div>
    ))}
  </AbsoluteFill>
);

/** Builds the video and thumbnail components for one registry entry. */
export const makeEpisodeComponents = (entry: RegistryEntry) => {
  const useLoaded = (episode: unknown) =>
    useMemo(() => loadEpisode(entry, episode), [episode]);

  // Studio-only: saves props-panel edits to episode.json (Studio's own Save can't, see SaveProps).
  const save = (episode: unknown) => <SaveProps slug={entry.slug} episode={episode} original={entry.episode} schema={episodeSchema} />;

  const Video: React.FC<CompositionProps> = ({ episode }) => {
    const loaded = useLoaded(episode);
    if (!loaded.ok) return <>{<ErrorCard slug={loaded.slug} errors={loaded.errors} />}{save(episode)}</>;
    const { format } = loaded.ctx.episode;
    const Format = format === "short" ? Short : format === "list" ? List : Countdown;
    return (
      <EpisodeProvider value={loaded.ctx}>
        <Format />
        {save(episode)}
      </EpisodeProvider>
    );
  };

  const Thumb: React.FC<CompositionProps> = ({ episode }) => {
    const loaded = useLoaded(episode);
    if (!loaded.ok) return <ErrorCard slug={loaded.slug} errors={loaded.errors} />;
    const Thumbnail_ = loaded.ctx.episode.thumbnail?.layout === "punch" ? PunchThumbnail : (getSkin(loaded.ctx.theme.id).Thumbnail ?? Thumbnail);
    return (
      <EpisodeProvider value={loaded.ctx}>
        <Thumbnail_ />
        {save(episode)}
      </EpisodeProvider>
    );
  };

  return { Video, Thumb };
};
