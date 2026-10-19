import React, { useMemo } from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { useEpisode } from "../context";
import { musicEnvelope } from "../lib/music";
import { sfxCues } from "../lib/sfx";
import { FPS, toFrame } from "../lib/timing";
import type { AssetManifest } from "../schema";

/** Resolve `audio.music.file`: a music name from the manifest (episode or library), else a path under public/. */
export const musicFile = (assets: AssetManifest, file: string) => assets.music[file] ?? (file.includes("/") ? { file } : null);

export const Voiceover: React.FC = () => {
  const { assets } = useEpisode();
  return assets.voiceover ? <Audio src={staticFile(assets.voiceover.file)} /> : null;
};

/** Music bed with optional ducking under the voice (see lib/music.ts). */
export const MusicBed: React.FC = () => {
  const { episode, timeline, assets } = useEpisode();
  const music = episode.audio.music;
  const env = useMemo(() => (music ? musicEnvelope(timeline, music) : []), [music, timeline]);
  if (!music) return null;
  const m = musicFile(assets, music.file);
  if (!m) return null;
  const loop = (m.duration ?? Infinity) < timeline.durationInFrames / FPS;
  return <Audio src={staticFile(m.file)} loop={loop} volume={(f) => env[Math.min(env.length - 1, Math.max(0, f))] ?? 0} />;
};

/** One <Audio> per sound-effect hit from the episode's preset. Sounds missing from the library are skipped (check reports them). */
export const SfxTrack: React.FC = () => {
  const { episode, timeline, assets } = useEpisode();
  const cues = useMemo(() => sfxCues(episode, timeline), [episode, timeline]);
  return (
    <>
      {cues.map((c, i) => {
        const file = assets.sfx[c.sfx]?.file;
        return file ? (
          <Sequence key={i} from={toFrame(c.at)} layout="none">
            <Audio src={staticFile(file)} volume={c.volume} />
          </Sequence>
        ) : null;
      })}
    </>
  );
};
