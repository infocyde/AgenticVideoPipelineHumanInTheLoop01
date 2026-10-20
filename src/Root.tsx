import React from "react";
import { Composition, Folder, Still } from "remotion";
import { registry } from "./episodes.generated";
import { type CompositionProps, compositionSchema, loadEpisode, makeEpisodeComponents } from "./kit/Episode";
import { FPS, HEIGHT, WIDTH } from "./kit/lib/timing";
import { episodeSchema } from "./kit/schema";
import { THUMB_HEIGHT, THUMB_WIDTH } from "./kit/Thumbnail";

// One composition (id = slug) and one thumbnail still (id = <slug>-thumb) per folder in episodes/.
// The list comes from src/episodes.generated.ts, which `npm run sync` rewrites.
const entries = registry.map((entry) => ({ entry, ...makeEpisodeComponents(entry) }));

const durationFor = (slug: string, episode: unknown) => {
  const entry = registry.find((e) => e.slug === slug)!;
  const loaded = loadEpisode(entry, episode);
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
            width={WIDTH}
            height={HEIGHT}
          />
          <Still id={`${entry.slug}-thumb`} component={Thumb} schema={compositionSchema} defaultProps={defaultProps} width={THUMB_WIDTH} height={THUMB_HEIGHT} />
        </Folder>
      );
    })}
  </>
);
