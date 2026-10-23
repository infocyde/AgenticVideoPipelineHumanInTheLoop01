// Frontier Shorts (1080×1920). Same vocabulary as the 16:9 scenes, stacked: number and region, the floating window,
// the headline, two metric tiles, captions. Everything stays clear of the Shorts interface: nothing important in the
// top ~140px, the bottom ~400px, or the right ~150px of the lower half.
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import type { CaptionBox } from "../../components/Chrome";
import { useEpisode, useTheme } from "../../context";
import { allPins, firstPins, type ResolvedSegment, type ResolvedText } from "../../lib/resolve";
import { MAP_EXIT, segmentOffset, toFrame } from "../../lib/timing";
import type { MapFocus } from "../../schema";
import { CaptionWords, EqMark } from "./Chrome";
import { DotMap } from "./DotMap";
import { Bloom, Chip, Decode, F, Field, focusPull, GradientText, pad2, prog, RiseLines, Sweep } from "./fx";
import { MediaStack, visualLabel, Window, windowEnter } from "./Media";
import { AllPins, FocusLine, FrontierCTA, scanGradient, scanShift, useFitText } from "./Open";
import { FrontierHeadline, MetricRow, Subhead, TopFrame, visualsOf } from "./Segment";
import { BodyCard } from "./Text";

const W = 1080;
const X = 70;
const TEXT_W = W - 2 * X;
export const SHORT_CAPTIONS: CaptionBox = { left: X, right: 160, bottom: 420, fontSize: 60 };

/** A tall frame shows a small box as one blob of country; zoom out around it so the region reads in context. */
const widen = (m: MapFocus, k = 1.8): MapFocus => {
  const [[w, s], [e, n]] = m.bbox;
  const cx = (w + e) / 2, cy = (s + n) / 2, hw = ((e - w) / 2) * k, hh = ((n - s) / 2) * k;
  return { ...m, bbox: [[Math.max(-180, cx - hw), Math.max(-85, cy - hh)], [Math.min(180, cx + hw), Math.min(85, cy + hh)]] };
};

const Scrims: React.FC = () => (
  <>
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(5,6,10,0.9) 0%, rgba(5,6,10,0.5) 28%, transparent 50%)" }} />
    <AbsoluteFill style={{ background: "linear-gradient(0deg, rgba(5,6,10,0.94) 0%, rgba(5,6,10,0.6) 28%, transparent 48%)" }} />
  </>
);

export const FrontierShortTopBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, theme } = useEpisode();
  const p = prog(frame, 0, 14);
  return (
    <div style={{ position: "absolute", top: 150, left: X, opacity: p, transform: `translateY(${(1 - p) * -40}px)`, fontFamily: theme.fonts.mono, letterSpacing: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, color: theme.colors.text, fontSize: 28, fontWeight: F.weights.monoBold }}>
        <EqMark size={26} />
        {episode.brand.name}
      </div>
      <div style={{ marginTop: 6, marginLeft: 50, color: theme.colors.dim, fontSize: 22 }}>{episode.brand.dateLabel}</div>
    </div>
  );
};

const VSignal: React.FC<{ text: string; sub?: string; index: number; count: number }> = ({ text, sub, index, count }) => {
  const frame = useCurrentFrame();
  const { fonts, copy, colors } = useTheme();
  const fit = useFitText(text, TEXT_W, 140, 70, 2);
  if (!fit) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 620 }}>
      <Chip text={`${copy.tickerLabel} ${pad2(index + 1)}/${pad2(count)}`} since={frame} size={26} />
      <div style={{ marginTop: 30, textAlign: "center", fontFamily: fonts.display, fontWeight: F.weights.display, fontSize: fit.size, lineHeight: 1.04, ...focusPull(frame, 1.12, 22) }}>
        {fit.lines.map((l, i) => (
          <div key={i}>
            <GradientText gradient={scanGradient} shift={scanShift(frame - i * 3)} style={{ backgroundSize: "300% 100%", filter: "drop-shadow(0 6px 30px rgba(2,3,8,0.85))" }}>
              {l}
            </GradientText>
          </div>
        ))}
      </div>
      {sub && (
        <div style={{ marginTop: 26, maxWidth: TEXT_W, textAlign: "center", fontFamily: fonts.mono, fontWeight: F.weights.monoBold, fontSize: 32, letterSpacing: 5, color: colors.text, textShadow: "0 2px 16px rgba(0,0,0,0.9)" }}>
          <Decode text={sub} since={frame - 8} per={0.5} scramble={6} />
        </div>
      )}
    </AbsoluteFill>
  );
};

export const FrontierShortColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useEpisode();
  const { fonts, colors } = theme;
  const { beats, title, to } = timeline.coldOpen;
  const titleFrom = toFrame(title.start);
  const t = episode.coldOpen.title;
  const since = frame - toFrame(title.bigAt);
  const rule = prog(since, 8, 16);
  const lines = t.small.split("\n");
  return (
    <AbsoluteFill>
      {beats.map(({ beat, start, end, asset }, i) => {
        const from = toFrame(start);
        const dur = Math.max(1, Math.min(toFrame(end), titleFrom) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            {beat.map === "all-pins" ? (
              <AllPins pins={firstPins(episode)} text={beat.stamp} accent={beat.accent} width={W} height={1300} top={330} textWidth={TEXT_W} maxSize={120} />
            ) : (
              <>
                {asset ? <MediaStack visuals={[{ name: beat.visual!, asset, note: beat.note, from: 0 }]} durationInFrames={dur} seed={i} noteInset={X} noteSize={22} tagInset={X} tagTop={150} tagSize={20} tagMaxWidth={560} /> : <Field ripple={0} />}
                <Scrims />
                <Sequence from={4} layout="none">
                  <VSignal text={beat.stamp} sub={beat.sub} index={i} count={beats.length} />
                </Sequence>
              </>
            )}
            {i > 0 && <Sweep />}
          </Sequence>
        );
      })}
      <Sequence from={titleFrom} durationInFrames={Math.max(1, to - titleFrom)}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 220 }}>
          <Field ripple={since} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontFamily: fonts.mono, fontWeight: F.weights.monoBold, fontSize: 36, letterSpacing: 10, color: colors.dim }}>
              <Decode text={t.kicker} since={frame - titleFrom} per={0.8} scramble={8} caret />
            </div>
            <div style={{ marginTop: 10, fontFamily: fonts.display, fontWeight: F.weights.display, fontSize: t.big.length <= 2 ? 420 : t.big.length <= 4 ? 300 : 210, lineHeight: 1.02, filter: "drop-shadow(0 0 50px rgba(139,107,255,0.45))", ...focusPull(since, 1.35, 30) }}>
              <GradientText shift={(frame * 0.7) % 100}>{t.big}</GradientText>
            </div>
            <RiseLines
              lines={lines}
              since={since - 3}
              size={140}
              lineHeight={0.98}
              style={{ textAlign: "center", fontFamily: fonts.body, fontWeight: F.weights.caption, letterSpacing: "-0.02em", color: colors.text, textTransform: "uppercase" }}
            />
            <div style={{ marginTop: 30, height: 4, width: 760 * rule, background: F.iris, borderRadius: 2, boxShadow: `0 0 16px ${F.cyan}` }} />
          </div>
          <Bloom since={since} strength={0.3} />
        </AbsoluteFill>
        <Sweep />
      </Sequence>
    </AbsoluteFill>
  );
};

/** One item, stacked: number + region, the window (the map first if there is one), headline, two metric tiles. */
export const FrontierShortSegment: React.FC<{ s: ResolvedSegment }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { theme } = useEpisode();
  const { fonts, copy } = theme;
  const { seg } = s;
  const dur = s.to - s.from;
  const o = segmentOffset(false);
  const isTop = seg.emphasis === "top";
  const statFrames = s.stats.map((st) => toFrame(st.at) - s.from);
  const visuals = visualsOf(s.visuals, s.from);
  // A segment with a map opens on it in the window, then sweeps to the b-roll at MAP_EXIT (the "mapExit" sound).
  const mapEnd = seg.map ? MAP_EXIT + o : 0;
  const showMap = seg.map && (!visuals.length || frame < mapEnd);
  const box = { left: 60, top: 330, width: 960, height: 540 };
  const badgeIn = prog(frame, 2, 10);
  return (
    <AbsoluteFill>
      <Field ripple={frame - 2} cx="20%" cy="15%" />
      <div style={{ position: "absolute", left: X, top: 236, display: "flex", alignItems: "center", gap: 20, opacity: badgeIn }}>
        <span style={{ fontFamily: fonts.display, fontWeight: F.weights.display, fontSize: 64, lineHeight: 1 }}>
          <GradientText gradient={F.numeral} style={{ backgroundSize: "100% 100%" }}>
            {pad2(s.num)}
          </GradientText>
        </span>
        {isTop ? (
          <div style={{ fontFamily: fonts.mono, fontWeight: F.weights.monoBold, fontSize: 24, letterSpacing: 4, color: F.ink, background: F.iris, borderRadius: 999, padding: "8px 18px" }}>
            {seg.emphasisLabel ?? copy.topEmphasisLabel}
          </div>
        ) : (
          <Chip text={seg.region} since={frame - 4} size={24} />
        )}
      </div>
      <Window box={box} enter={windowEnter(frame, 2)} tilt={-4} label={showMap ? undefined : visualLabel(visuals, frame)} glow={isTop ? 0.6 : 0}>
        {visuals.length && !showMap ? <MediaStack visuals={visuals} durationInFrames={dur} seed={s.num * 3} noteSize={20} tagSize={18} tagMaxWidth={660} /> : <Field ripple={frame - 6} />}
        {showMap && (
          <AbsoluteFill style={{ background: F.ink }}>
            <DotMap width={box.width - 4} height={box.height - 4} focus={widen(seg.map!)} showLabels pitch={6} />
          </AbsoluteFill>
        )}
        {seg.map && visuals.length > 0 && frame >= mapEnd && (
          <Sequence from={mapEnd} layout="none">
            <Sweep />
          </Sequence>
        )}
      </Window>
      {isTop && <TopFrame />}
      <div style={{ position: "absolute", left: X, top: 910, width: TEXT_W }}>
        {isTop && (
          <div style={{ marginBottom: 16 }}>
            <Chip text={seg.region} since={frame - 4} size={24} />
          </div>
        )}
        <FrontierHeadline text={seg.headline} since={frame - 8} width={TEXT_W} maxSize={seg.subhead ? 72 : 80} minSize={52} maxLines={isTop || seg.subhead ? 2 : 3} />
        {seg.subhead && <Subhead text={seg.subhead} since={frame - 18} size={34} />}
      </div>
      <MetricRow stats={s.stats} statFrames={statFrames} left={X} top={1172} width={TEXT_W} height={162} gap={18} max={2} />
    </AbsoluteFill>
  );
};

export const FrontierShortText: React.FC<{ t: ResolvedText }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { episode } = useEpisode();
  const { seg } = t;
  const visuals = visualsOf(t.visuals, t.from);
  const pins = allPins(episode);
  const box = { left: 132, top: 330, width: 816, height: 459 };
  return (
    <AbsoluteFill>
      <Field ripple={frame - 2} cx="80%" cy="15%" />
      <div style={{ position: "absolute", left: X, top: 236 }}>{seg.label && <Chip text={seg.label} since={frame - 4} size={24} dot={F.lime} />}</div>
      <Window box={box} enter={windowEnter(frame, 2)} tilt={4} label={visualLabel(visuals, frame)}>
        {visuals.length ? (
          <MediaStack visuals={visuals} durationInFrames={t.to - t.from} seed={t.index * 5 + 1} noteSize={18} tagSize={18} tagMaxWidth={520} />
        ) : pins.length ? (
          <DotMap width={box.width - 4} height={box.height - 4} allPins={pins} pinDelay={4} zoomFrames={1} showLabels={false} pitch={6} />
        ) : (
          <Field ripple={frame - 6} />
        )}
      </Window>
      <div style={{ position: "absolute", left: X, top: 830, width: TEXT_W }}>
        <FrontierHeadline text={seg.heading} since={frame - 10} width={TEXT_W} maxSize={84} minSize={52} maxLines={3} />
        {seg.body && <BodyCard text={seg.body} since={frame - 22} size={32} />}
      </div>
    </AbsoluteFill>
  );
};

export const FrontierShortOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useEpisode();
  const { copy, effects } = theme;
  const { from, lines, cta } = timeline.outro;
  const at = lines.map((l) => toFrame(l.at) - from);
  const ctaAt = cta ? toFrame(cta.at) - from : null;
  const last = lines.length - 1;
  const pins = allPins(episode);
  const lastHit = at.reduce((acc, f) => (frame >= f ? f : acc), 0);
  return (
    <AbsoluteFill>
      <Field ripple={frame - lastHit} />
      {pins.length > 0 && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 0.55 }}>
          <DotMap width={W} height={1300} allPins={pins} pinDelay={0} zoomFrames={1} showLabels={false} pitch={8} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: effects.outroScrim }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 260 }}>
        {lines.map(({ line }, i) => {
          if (frame < at[i]) return null;
          if (i < last) {
            const out = 1 - prog(frame, at[i + 1] - 5, 5);
            if (out <= 0) return null;
            return (
              <div key={i} style={{ position: "absolute", opacity: out }}>
                <FocusLine since={frame - at[i]} text={line.text} accent={line.accent} width={TEXT_W} maxSize={120} />
              </div>
            );
          }
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <FocusLine since={frame - at[i]} text={line.text} accent={line.accent} width={TEXT_W} maxSize={lines.length > 1 ? 150 : 130} />
              {ctaAt !== null && frame >= ctaAt && <FrontierCTA since={frame - ctaAt} label={cta?.label ?? episode.outro.cta?.label ?? copy.ctaLabel} doneLabel={copy.ctaDoneLabel} size={50} />}
            </div>
          );
        })}
      </AbsoluteFill>
      <Bloom since={frame - lastHit} strength={0.22} />
    </AbsoluteFill>
  );
};

/** Shorts captions: their own box (lower than the shared one, clear of the metric tiles). */
export const FrontierShortCaptions: React.FC<{ box?: CaptionBox }> = () => <CaptionWords box={SHORT_CAPTIONS} />;
