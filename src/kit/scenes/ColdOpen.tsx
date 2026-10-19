import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { GlitchCut } from "../components/Chrome";
import { EveryFront, Stamp, TitleCard } from "../components/Titles";
import { useEpisode } from "../context";
import { firstPins } from "../lib/resolve";
import { toFrame } from "../lib/timing";

/** Hook beats (stamp over b-roll, or the all-fronts map), each cut on its spoken cue, then the title card. */
export const ColdOpen: React.FC = () => {
  const { episode, timeline } = useEpisode();
  const { beats, title, to } = timeline.coldOpen;
  const titleFrom = toFrame(title.start);
  const pins = firstPins(episode);

  return (
    <AbsoluteFill>
      {beats.map(({ beat, start, end, asset }, i) => {
        const from = toFrame(start);
        const dur = Math.max(1, Math.min(toFrame(end), titleFrom) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            {beat.map === "all-pins" ? (
              <EveryFront pins={pins} text={beat.stamp} accent={beat.accent} />
            ) : (
              <>
                {asset && <Backdrop visuals={[{ name: beat.visual!, asset, note: beat.note, from: 0 }]} durationInFrames={dur} seed={i} />}
                <Sequence from={4} layout="none">
                  <Stamp text={beat.stamp} sub={beat.sub} />
                </Sequence>
              </>
            )}
            {i > 0 && <GlitchCut seed={i * 5} />}
          </Sequence>
        );
      })}
      <Sequence from={titleFrom} durationInFrames={Math.max(1, to - titleFrom)}>
        <TitleCard
          kicker={episode.coldOpen.title.kicker}
          big={episode.coldOpen.title.big}
          small={episode.coldOpen.title.small}
          bigAt={toFrame(title.bigAt) - titleFrom}
        />
        <GlitchCut seed={beats.length * 5} />
      </Sequence>
    </AbsoluteFill>
  );
};
