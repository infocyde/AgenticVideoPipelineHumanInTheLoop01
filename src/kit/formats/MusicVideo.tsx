// A music video: full-frame shots cut on sung words or beats, lyric subtitles one line at a time, a title card over the
// opening shot and a paged credits roll. The song is the only audio. Timing comes from lib/resolveMusicVideo.ts.
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Easing, getRemotionEnvironment, Img, interpolate, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { KenBurns } from "../components/Backdrop";
import { GlitchCut } from "../components/Chrome";
import { clamp } from "../context";
import { pagedCreditColumns } from "../lib/credits";
import type { ResolvedShot } from "../lib/resolveMusicVideo";
import { FPS, toFrame } from "../lib/timing";
import { useMusicVideo } from "../musicVideoContext";
import { CreditsRoll } from "../scenes/CreditsCard";

/** Subtitle box: centred above the bottom edge, at most two rows. */
const SUB = { bottom: 96, maxWidth: 1500, fontSize: 52 };
/** Frames a subtitle fades in and out over. */
const SUB_FADE = 4;

const ShotLayer: React.FC<{ s: ResolvedShot }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { theme } = useMusicVideo();
  const slot = Math.max(1, s.to - s.from);
  const media: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
  let picture: React.ReactNode = null;
  if (s.asset?.kind === "image") {
    picture = (
      <KenBurns frames={slot} seed={s.index}>
        <Img src={staticFile(s.asset.file)} style={media} />
      </KenBurns>
    );
  } else if (s.asset?.kind === "clip") {
    // Play from the in-point at full speed; a clip too short for its slot is slowed (to half speed at most), then looped.
    const left = Math.max(0.1, s.asset.duration - s.in);
    const rate = Math.max(0.5, Math.min(1, left / (slot / FPS)));
    const loopFrames = Math.max(1, Math.floor(((left - 0.1) / rate) * FPS));
    const video = <OffthreadVideo src={staticFile(s.asset.file)} muted playbackRate={rate} trimBefore={toFrame(s.in)} style={media} />;
    picture = loopFrames < slot ? <Loop durationInFrames={loopFrames}>{video}</Loop> : video;
  }
  const t = s.shot.transition;
  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      {picture}
      {t === "glitch" && s.index > 0 && <GlitchCut seed={s.index * 7 + 3} />}
      {t === "flash" && s.index > 0 && <AbsoluteFill style={{ background: "#fff", opacity: interpolate(frame, [0, 4], [0.9, 0], clamp) }} />}
      {s.shot.note && (
        <div
          style={{
            position: "absolute",
            right: 64,
            top: 56,
            fontFamily: theme.fonts.mono,
            fontSize: 18,
            letterSpacing: 3,
            color: theme.colors.dim,
            background: theme.colors.noteBg,
            padding: "4px 10px",
          }}
        >
          {s.shot.note}
        </div>
      )}
    </AbsoluteFill>
  );
};

const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useMusicVideo();
  if (!episode.subtitles || frame >= timeline.credits.from) return null;
  const shot = timeline.shots.find((s) => frame >= s.from && frame < s.to);
  if (shot?.shot.subtitles === false) return null;
  const sec = frame / FPS;
  const line = timeline.subtitles.find((l) => sec >= l.start && sec < l.end);
  if (!line) return null;
  const opacity = Math.min(1, ((sec - line.start) * FPS) / SUB_FADE, ((line.end - sec) * FPS) / SUB_FADE);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: SUB.bottom, display: "flex", justifyContent: "center", opacity }}>
      <div
        style={{
          maxWidth: SUB.maxWidth,
          textAlign: "center",
          fontFamily: theme.fonts.body,
          fontWeight: 700,
          fontSize: SUB.fontSize,
          lineHeight: 1.2,
          color: theme.colors.text,
          textShadow: `${theme.effects.captionShadow}, 0 2px 12px rgba(0,0,0,0.85)`,
          WebkitTextStroke: "5px rgba(0,0,0,0.55)",
          paintOrder: "stroke fill",
        }}
      >
        {line.text}
      </div>
    </div>
  );
};

const TitleCard: React.FC<{ frames: number }> = ({ frames }) => {
  const frame = useCurrentFrame();
  const { episode, theme } = useMusicVideo();
  const { colors, fonts, effects } = theme;
  const inT = interpolate(frame, [0, 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const out = interpolate(frame, [frames - 18, frames], [1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 120, bottom: 230, opacity: inT * out, transform: `translateY(${(1 - inT) * 30}px)` }}>
      <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 40, letterSpacing: 6, textTransform: "uppercase", color: colors.accent, textShadow: effects.textShadow }}>
        {episode.song.artist}
      </div>
      <div style={{ fontFamily: fonts.display, fontSize: 120, lineHeight: 1, color: colors.text, textShadow: effects.textShadow, marginTop: 6 }}>{episode.song.title}</div>
      {episode.song.subtitle && (
        <div style={{ fontFamily: fonts.mono, fontSize: 34, letterSpacing: 3, color: colors.text, opacity: 0.85, textShadow: effects.textShadow, marginTop: 10 }}>
          {episode.song.subtitle}
        </div>
      )}
    </div>
  );
};

/** Studio-only list of unresolved cues and missing media (renders are blocked by `check` instead). */
const Issues: React.FC = () => {
  const { timeline, theme } = useMusicVideo();
  if (!getRemotionEnvironment().isStudio) return null;
  const errors = timeline.issues.filter((i) => i.level === "error");
  if (!errors.length) return null;
  return (
    <div style={{ position: "absolute", left: 24, top: 24, maxWidth: 900, padding: "14px 18px", background: "rgba(140,0,0,0.88)", color: "#fff", fontFamily: theme.fonts.mono, fontSize: 20, lineHeight: 1.35, border: "2px solid #ff6b6b" }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        {errors.length} problem{errors.length > 1 ? "s" : ""} (npm run check -- {timeline.slug}) · hidden in renders
      </div>
      {errors.slice(0, 8).map((e, i) => (
        <div key={i}>
          <span style={{ opacity: 0.7 }}>{e.where}:</span> {e.msg}
        </div>
      ))}
      {errors.length > 8 && <div style={{ opacity: 0.7 }}>…and {errors.length - 8} more</div>}
    </div>
  );
};

export const MusicVideo: React.FC = () => {
  const { episode, timeline, assets, credits, theme } = useMusicVideo();
  const pages = useMemo(() => pagedCreditColumns(credits, false), [credits]);
  const pageFrames = toFrame(episode.credits.seconds);
  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      {timeline.shots.map((s) => (
        <Sequence key={s.index} from={s.from} durationInFrames={Math.max(1, s.to - s.from)}>
          <ShotLayer s={s} />
        </Sequence>
      ))}
      {episode.subtitles && (
        <Sequence durationInFrames={Math.max(1, timeline.credits.from)} layout="none">
          <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0) 32%)" }} />
        </Sequence>
      )}
      {timeline.titleCard && (
        <Sequence from={timeline.titleCard.from} durationInFrames={timeline.titleCard.to - timeline.titleCard.from} layout="none">
          <TitleCard frames={timeline.titleCard.to - timeline.titleCard.from} />
        </Sequence>
      )}
      <Subtitles />
      {pages.map((columns, i) => (
        <Sequence key={`credits${i}`} from={timeline.credits.from + i * pageFrames} durationInFrames={pageFrames}>
          <CreditsRoll credits={credits} theme={theme} mapData={false} columns={columns} />
        </Sequence>
      ))}
      <Issues />
      {assets.voiceover && <Audio src={staticFile(assets.voiceover.file)} />}
    </AbsoluteFill>
  );
};
