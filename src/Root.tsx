import React from "react";
import { Composition, Folder, Still } from "remotion";
import { registry } from "./episodes.generated";
import { type CompositionProps, compositionSchema, loadEpisode, makeEpisodeComponents } from "./kit/Episode";
import { FPS, HEIGHT, WIDTH } from "./kit/lib/timing";
import { SHORT_HEIGHT, SHORT_WIDTH } from "./kit/formats/Short";
import { loadMusicVideo, makeMusicVideoComponents, type MvCompositionProps, mvCompositionSchema } from "./kit/MusicVideoEpisode";
import { episodeSchema, isMusicVideo, musicVideoSchema } from "./kit/schema";
import { THUMB_HEIGHT, THUMB_WIDTH } from "./kit/Thumbnail";

// One composition (id = slug) and one thumbnail still (id = <slug>-thumb) per folder in episodes/.
// The list comes from src/episodes.generated.ts, which `npm run sync` rewrites.
// Music videos (format "music-video") have their own schema, timeline and components (kit/MusicVideoEpisode.tsx).
const entries = registry.filter((e) => !isMusicVideo(e.episode)).map((entry) => ({ entry, ...makeEpisodeComponents(entry) }));
const musicVideos = registry.filter((e) => isMusicVideo(e.episode)).map((entry) => ({ entry, ...makeMusicVideoComponents(entry) }));

const durationFor = (slug: string, episode: unknown) => {
  const entry = registry.find((e) => e.slug === slug)!;
  const loaded = loadEpisode(entry, episode);
  return loaded.ok ? loaded.ctx.timeline.durationInFrames : FPS * 10;
};
const musicVideoDuration = (slug: string, episode: unknown) => {
  const loaded = loadMusicVideo(registry.find((e) => e.slug === slug)!, episode);
  return loaded.ok ? loaded.ctx.timeline.durationInFrames : FPS * 10;
};

export const RemotionRoot: React.FC = () => (
  <>
    {entries.map(({ entry, Video, Thumb }) => {
      // Studio's props panel gets the episode with the schema's defaults filled in: it crashes on a list field
      // that is absent (e.g. audio.sfxOff), instead of treating it as empty. An invalid episode is passed as is,
      // so the composition can show its errors.
      const parsed = episodeSchema.safeParse(entry.episode);
      const defaultProps = { episode: parsed.success ? parsed.data : entry.episode } as CompositionProps;
      // Shorts (aspect 9:16) render vertical and have no 16:9 thumbnail still (YouTube picks a frame).
      const vertical = parsed.success && parsed.data.aspect === "9:16";
      return (
        <Folder key={entry.slug} name={entry.slug}>
          <Composition
            id={entry.slug}
            component={Video}
            schema={compositionSchema}
            defaultProps={defaultProps}
            calculateMetadata={({ props }) => ({ durationInFrames: durationFor(entry.slug, props.episode) })}
            durationInFrames={FPS * 10}
            fps={FPS}
            width={vertical ? SHORT_WIDTH : WIDTH}
            height={vertical ? SHORT_HEIGHT : HEIGHT}
          />
          {!vertical && <Still id={`${entry.slug}-thumb`} component={Thumb} schema={compositionSchema} defaultProps={defaultProps} width={THUMB_WIDTH} height={THUMB_HEIGHT} />}
        </Folder>
      );
    })}
    {musicVideos.map(({ entry, Video, Thumb }) => {
      const parsed = musicVideoSchema.safeParse(entry.episode);
      const defaultProps = { episode: parsed.success ? parsed.data : entry.episode } as MvCompositionProps;
      return (
        <Folder key={entry.slug} name={entry.slug}>
          <Composition
            id={entry.slug}
            component={Video}
            schema={mvCompositionSchema}
            defaultProps={defaultProps}
            calculateMetadata={({ props }) => ({ durationInFrames: musicVideoDuration(entry.slug, props.episode) })}
            durationInFrames={FPS * 10}
            fps={FPS}
            width={WIDTH}
            height={HEIGHT}
          />
          <Still id={`${entry.slug}-thumb`} component={Thumb} schema={mvCompositionSchema} defaultProps={defaultProps} width={THUMB_WIDTH} height={THUMB_HEIGHT} />
        </Folder>
      );
    })}
  </>
);
