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
import { useSkin } from "../skins";
import { layoutOf } from "../themes";

export const Brief: React.FC<{ slam: boolean }> = ({ slam }) => {
  const { timeline, theme } = useEpisode();
  const { coldOpen, segments, texts, outro, sourcesCard, creditsCard, endScreen } = timeline;
  const chromeEnd = outro.to;
  const skin = useSkin();
  const SegmentScene = skin.Segment ?? (layoutOf(theme.id) === "split" ? SplitSegment : Segment);
  const Open = skin.ColdOpen ?? ColdOpen;
  const Text = skin.Text ?? TextSection;
  const OutroScene = skin.Outro ?? Outro;
  const End = skin.EndCard ?? EndCard;
  const Finish = skin.Finish ?? Grain;
  const Bar = skin.TopBar ?? TopBar;
  const Rail = skin.Ticker === undefined ? Ticker : skin.Ticker;
  const Caps = skin.Captions ?? Captions;

  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      <Sequence durationInFrames={Math.max(1, coldOpen.to)}>
        <Open />
      </Sequence>

      {segments.map((s) => (
        <Sequence key={s.index} from={s.from} durationInFrames={Math.max(1, s.to - s.from)}>
          <SegmentScene s={s} slam={slam} />
        </Sequence>
      ))}

      {texts.map((t) => (
        <Sequence key={`t${t.index}`} from={t.from} durationInFrames={Math.max(1, t.to - t.from)}>
          <Text t={t} />
        </Sequence>
      ))}

      <Sequence from={outro.from} durationInFrames={Math.max(1, outro.to - outro.from)}>
        <OutroScene />
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
          <End />
        </Sequence>
      )}

      <Finish />
      <Sequence durationInFrames={chromeEnd} layout="none">
        <Bar />
      </Sequence>
      {Rail && (
        <Sequence from={coldOpen.to} durationInFrames={Math.max(1, outro.from - coldOpen.to)} layout="none">
          <Rail />
        </Sequence>
      )}
      <Caps />
      <IssuesOverlay />

      <Voiceover />
      <MusicBed />
      <SfxTrack />
    </AbsoluteFill>
  );
};
