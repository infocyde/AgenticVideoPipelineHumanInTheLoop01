// Turns a music-video registry entry (episode.json + timing.json + assets.json + credits.json) into its composition
// and thumbnail, the music-video counterpart of Episode.tsx.
import React, { useMemo } from "react";
import { z } from "zod";
import { SaveProps } from "./components/SaveProps";
import { ErrorCard, type RegistryEntry } from "./Episode";
import { MusicVideo } from "./formats/MusicVideo";
import { MUSIC_VIDEO_ROLL, musicVideoCredits, pagedCreditColumns, parseCredits } from "./lib/credits";
import { resolveMusicVideo } from "./lib/resolveMusicVideo";
import { type MusicVideoCtx, MusicVideoProvider } from "./musicVideoContext";
import { MusicVideoThumbnail } from "./MusicVideoThumbnail";
import { assetsSchema, musicVideoSchema, timingSchema } from "./schema";
import { getTheme } from "./themes";

/** Composition props: the whole episode.json, editable in Studio's props panel. */
export const mvCompositionSchema = z.object({ episode: musicVideoSchema });
export type MvCompositionProps = z.input<typeof mvCompositionSchema>;

export type LoadedMusicVideo = { ok: true; ctx: MusicVideoCtx } | { ok: false; slug: string; errors: string[] };

/** Parse and resolve a music video. Never throws, so one broken episode doesn't take Studio down. */
export const loadMusicVideo = (entry: RegistryEntry, raw: unknown = entry.episode): LoadedMusicVideo => {
  const { slug } = entry;
  const ep = musicVideoSchema.safeParse(raw);
  if (!ep.success) return { ok: false, slug, errors: ep.error.issues.map((i) => `episode.json ${i.path.join(".") || "(root)"}: ${i.message}`) };
  if (entry.timing == null) return { ok: false, slug, errors: [`timing.json missing: run \`npm run lyrics -- ${slug}\``] };
  const t = timingSchema.safeParse(entry.timing);
  if (!t.success) return { ok: false, slug, errors: [`timing.json invalid: ${t.error.issues[0]?.message}`] };
  const episode = ep.data;
  const assets = assetsSchema.parse(entry.assets ?? {});
  const credits = musicVideoCredits(episode, parseCredits(entry.credits));
  const timeline = resolveMusicVideo(episode, t.data, assets, pagedCreditColumns(credits, false, MUSIC_VIDEO_ROLL).length);
  return { ok: true, ctx: { episode, timeline, assets, credits, theme: getTheme(episode.theme), base: `episodes/${slug}` } };
};

export const makeMusicVideoComponents = (entry: RegistryEntry) => {
  const useLoaded = (episode: unknown) => useMemo(() => loadMusicVideo(entry, episode), [episode]);

  // Studio-only: saves props-panel edits to episode.json (Studio's own Save can't, see SaveProps).
  const save = (episode: unknown) => <SaveProps slug={entry.slug} episode={episode} original={entry.episode} schema={musicVideoSchema} />;

  const Video: React.FC<MvCompositionProps> = ({ episode }) => {
    const loaded = useLoaded(episode);
    if (!loaded.ok) return <>{<ErrorCard slug={loaded.slug} errors={loaded.errors} />}{save(episode)}</>;
    return (
      <MusicVideoProvider value={loaded.ctx}>
        <MusicVideo />
        {save(episode)}
      </MusicVideoProvider>
    );
  };

  const Thumb: React.FC<MvCompositionProps> = ({ episode }) => {
    const loaded = useLoaded(episode);
    if (!loaded.ok) return <ErrorCard slug={loaded.slug} errors={loaded.errors} />;
    return (
      <MusicVideoProvider value={loaded.ctx}>
        <MusicVideoThumbnail />
        {save(episode)}
      </MusicVideoProvider>
    );
  };

  return { Video, Thumb };
};
