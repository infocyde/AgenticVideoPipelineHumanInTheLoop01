// The timeline shared by every format: scenes in order, broadcast chrome on top, audio underneath.
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { MusicBed, SfxTrack, Voiceover } from "../components/Audio";
import { Captions, Grain, Ticker, TopBar } from "../components/Chrome";
import { IssuesOverlay } from "../components/IssuesOverlay";
import { useEpisode } from "../context";
import { ColdOpen } from "../scenes/ColdOpen";
import { CreditsCard } from "../scenes/CreditsCard";
import { EndCard } from "../scenes/EndCard";
import { Outro } from "../scenes/Outro";
import { Segment } from "../scenes/Segment";
import { SourcesCard } from "../scenes/SourcesCard";
import { SplitSegment } from "../scenes/SplitSegment";
import { TextSection } from "../scenes/TextSection";
import { layoutOf } from "../themes";

export const Brief: React.FC<{ slam: boolean }> = ({ slam }) => {
  const { timeline, theme } = useEpisode();
  const { coldOpen, segments, texts, outro, sourcesCard, creditsCard, endScreen } = timeline;
  const chromeEnd = outro.to;
  const SegmentScene = layoutOf(theme.id) === "split" ? SplitSegment : Segment;

  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      <Sequence durationInFrames={Math.max(1, coldOpen.to)}>
        <ColdOpen />
      </Sequence>

      {segments.map((s) => (
        <Sequence key={s.index} from={s.from} durationInFrames={Math.max(1, s.to - s.from)}>
          <SegmentScene s={s} slam={slam} />
        </Sequence>
      ))}

      {texts.map((t) => (
        <Sequence key={`t${t.index}`} from={t.from} durationInFrames={Math.max(1, t.to - t.from)}>
          <TextSection t={t} />
        </Sequence>
      ))}

      <Sequence from={outro.from} durationInFrames={Math.max(1, outro.to - outro.from)}>
        <Outro />
      </Sequence>

      {sourcesCard && (
        <Sequence from={sourcesCard.from} durationInFrames={sourcesCard.to - sourcesCard.from}>
          <SourcesCard />
        </Sequence>
      )}

      {creditsCard && (
        <Sequence from={creditsCard.from} durationInFrames={creditsCard.to - creditsCard.from}>
          <CreditsCard />
        </Sequence>
      )}

      {endScreen && (
        <Sequence from={endScreen.from} durationInFrames={endScreen.to - endScreen.from}>
          <EndCard />
        </Sequence>
      )}

      <Grain />
      <Sequence durationInFrames={chromeEnd} layout="none">
        <TopBar />
      </Sequence>
      <Sequence from={coldOpen.to} durationInFrames={Math.max(1, outro.from - coldOpen.to)} layout="none">
        <Ticker />
      </Sequence>
      <Captions />
      <IssuesOverlay />

      <Voiceover />
      <MusicBed />
      <SfxTrack />
    </AbsoluteFill>
  );
};
