// Frontier's cold open and outro (16:9): signal stamps over full-bleed media, the dot-matrix "all fronts" map, the
// title card with an iridescent numeral and a lattice ripple, outro lines that pull into focus, and a glass CTA.
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { fitLines, useFontsReady } from "../../components/Headline";
import { clamp, useEpisode, useTheme } from "../../context";
import { allPins, firstPins } from "../../lib/resolve";
import { toFrame } from "../../lib/timing";
import type { Pin } from "../../schema";
import { DotMap } from "./DotMap";
import { Bloom, Chip, Decode, F, Field, focusPull, GradientText, pad2, prog, RiseLines, Sweep } from "./fx";
import { MediaStack } from "./Media";

/** Fitted display type (Sora), or Geist when `face="body"`. */
export const useFitText = (text: string, width: number, maxSize: number, minSize: number, maxLines: number, face: "display" | "body" = "display") => {
  const { fonts } = useTheme();
  const ready = useFontsReady();
  const family = face === "display" ? fonts.display : fonts.body;
  const weight = face === "display" ? F.weights.display : F.weights.caption;
  return useMemo(
    () => (ready ? fitLines({ text, width, maxSize, minSize, maxLines, fontFamily: family, fontWeight: weight }) : null),
    [ready, text, width, maxSize, minSize, maxLines, family, weight],
  );
};

/** A highlight that runs once through white type (`since` = frames since it lands). */
export const scanGradient = "linear-gradient(100deg, #ffffff 0%, #ffffff 40%, #3df0ff 48%, #c8ff3d 52%, #ffffff 60%, #ffffff 100%)";
export const scanShift = (since: number) => interpolate(since, [2, 22], [100, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) });

/** Signal stamp: "● SIGNAL 02/05" chip, the stamp pulling into focus with a light run through it, decoded subline. */
const SignalStamp: React.FC<{ text: string; sub?: string; index: number; count: number }> = ({ text, sub, index, count }) => {
  const frame = useCurrentFrame();
  const { fonts, colors, copy } = useTheme();
  const fit = useFitText(text, 1560, 128, 64, 1);
  const rule = prog(frame, 6, 14);
  if (!fit) return null;
  return (
    <div style={{ position: "absolute", left: 120, top: 360 }}>
      <Chip text={`${copy.tickerLabel} ${pad2(index + 1)}/${pad2(count)}`} since={frame} size={22} />
      <div style={{ marginTop: 26, fontFamily: fonts.display, fontWeight: F.weights.display, fontSize: fit.size, lineHeight: 1.02, whiteSpace: "nowrap", transformOrigin: "left center", ...focusPull(frame, 1.12, 22) }}>
        <GradientText gradient={scanGradient} shift={scanShift(frame)} style={{ backgroundSize: "300% 100%", filter: "drop-shadow(0 6px 30px rgba(2,3,8,0.8))" }}>
          {fit.lines[0]}
        </GradientText>
      </div>
      <div style={{ marginTop: 18, height: 3, width: 520 * rule, background: F.iris, boxShadow: `0 0 16px ${F.cyan}` }} />
      {sub && (
        <div style={{ marginTop: 18, fontFamily: fonts.mono, fontWeight: F.weights.monoBold, fontSize: 28, letterSpacing: 5, color: colors.text, textShadow: "0 2px 16px rgba(0,0,0,0.9)" }}>
          <Decode text={sub} since={frame - 8} per={0.5} scramble={6} />
        </div>
      )}
    </div>
  );
};

/** All-fronts beat: the dot-matrix world with every segment's pin, the line across the top. */
export const AllPins: React.FC<{ pins: Pin[]; text: string; accent?: string; width: number; height: number; top: number; textWidth: number; maxSize: number }> = ({
  pins,
  text,
  accent,
  width,
  height,
  top,
  textWidth,
  maxSize,
}) => {
  const frame = useCurrentFrame();
  const { fonts } = useTheme();
  const full = `${text}${accent ? ` ${accent}` : ""}`;
  const fit = useFitText(full, textWidth, maxSize, 56, 2);
  const z = interpolate(frame, [0, 90], [1, 1.06]);
  return (
    <AbsoluteFill>
      <Field ripple={frame} />
      <AbsoluteFill style={{ transform: `scale(${z})`, justifyContent: "center", alignItems: "center" }}>
        <DotMap width={width} height={height} allPins={pins} pinDelay={4} zoomFrames={1} showLabels={false} pitch={8} />
      </AbsoluteFill>
      {fit && (
        <div style={{ position: "absolute", left: 0, right: 0, top, textAlign: "center", fontFamily: fonts.display, fontWeight: F.weights.display, fontSize: fit.size, lineHeight: 1.05, ...focusPull(frame - 2, 1.15) }}>
          {fit.lines.map((l, i) => {
            // The accent words (at the end) get the iridescent fill.
            const acc = accent && i === fit.lines.length - 1 && l.endsWith(accent) ? accent : "";
            return (
              <div key={i}>
                <span style={{ color: "#fff", textShadow: "0 8px 40px rgba(5,6,10,0.9)" }}>{acc ? l.slice(0, l.length - acc.length) : l}</span>
                {acc && <GradientText shift={(frame * 0.8) % 100}>{acc}</GradientText>}
              </div>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Title card: kicker decodes, the big word pulls into focus in iridescent type, the lattice ripples out, the small lines rise. */
const TitleCard: React.FC<{ kicker: string; big: string; small: string; bigAt: number }> = ({ kicker, big, small, bigAt }) => {
  const frame = useCurrentFrame();
  const { fonts, colors } = useTheme();
  const since = frame - bigAt;
  const bigSize = big.length <= 2 ? 360 : big.length <= 4 ? 270 : 200;
  const rule = prog(since, 8, 16);
  const lines = small.split("\n");
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Field ripple={since} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontFamily: fonts.mono, fontWeight: F.weights.monoBold, fontSize: 32, letterSpacing: 12, color: colors.dim }}>
          <Decode text={kicker} since={frame} per={0.8} scramble={8} caret />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 48, marginTop: 16 }}>
          <span style={{ fontFamily: fonts.display, fontWeight: F.weights.display, fontSize: bigSize, lineHeight: 1, filter: "drop-shadow(0 0 50px rgba(139,107,255,0.45))", ...focusPull(since, 1.35, 30) }}>
            <GradientText shift={(frame * 0.7) % 100}>{big}</GradientText>
          </span>
          <RiseLines
            lines={lines}
            since={since - 3}
            size={lines.length > 1 ? 118 : 140}
            lineHeight={0.98}
            style={{ fontFamily: fonts.body, fontWeight: F.weights.caption, letterSpacing: "-0.02em", color: colors.text, textTransform: "uppercase" }}
          />
        </div>
        <div style={{ position: "relative", marginTop: 28, height: 3, width: 1000, background: "rgba(160,180,255,0.12)", borderRadius: 2 }}>
          <div style={{ width: `${rule * 100}%`, height: "100%", background: F.iris, borderRadius: 2 }} />
          {rule > 0 && rule < 1 && <div style={{ position: "absolute", left: `${rule * 100}%`, top: -5, width: 13, height: 13, marginLeft: -6, borderRadius: 7, background: "#fff", boxShadow: `0 0 18px 4px ${F.cyan}` }} />}
        </div>
      </div>
      <Bloom since={since} strength={0.3} />
    </AbsoluteFill>
  );
};

export const FrontierColdOpen: React.FC = () => {
  const { episode, timeline, theme } = useEpisode();
  const { beats, title, to } = timeline.coldOpen;
  const titleFrom = toFrame(title.start);
  const pins = firstPins(episode);
  const t = episode.coldOpen.title;
  return (
    <AbsoluteFill>
      {beats.map(({ beat, start, end, asset }, i) => {
        const from = toFrame(start);
        const dur = Math.max(1, Math.min(toFrame(end), titleFrom) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            {beat.map === "all-pins" ? (
              <AllPins pins={pins} text={beat.stamp} accent={beat.accent} width={1920} height={1000} top={110} textWidth={1640} maxSize={120} />
            ) : (
              <>
                {asset ? <MediaStack visuals={[{ name: beat.visual!, asset, note: beat.note, from: 0 }]} durationInFrames={dur} seed={i} noteInset={64} noteSize={18} tagInset={64} tagTop={100} /> : <Field ripple={0} />}
                <AbsoluteFill style={{ background: theme.backdrop.sideGradient }} />
                <AbsoluteFill style={{ background: theme.backdrop.bottomGradient }} />
                <Sequence from={4} layout="none">
                  <SignalStamp text={beat.stamp} sub={beat.sub} index={i} count={beats.length} />
                </Sequence>
              </>
            )}
            {i > 0 && <Sweep />}
          </Sequence>
        );
      })}
      <Sequence from={titleFrom} durationInFrames={Math.max(1, to - titleFrom)}>
        <TitleCard kicker={t.kicker} big={t.big} small={t.small} bigAt={toFrame(title.bigAt) - titleFrom} />
        <Sweep />
      </Sequence>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------------------------------------ outro

/** One outro line pulling into focus (Geist, fitted), accent words iridescent. */
export const FocusLine: React.FC<{ since: number; text: string; accent?: string; width: number; maxSize: number }> = ({ since, text, accent, width, maxSize }) => {
  const frame = useCurrentFrame();
  const { fonts } = useTheme();
  const fit = useFitText(`${text}${accent ? ` ${accent}` : ""}`, width, maxSize, 64, 2, "body");
  if (!fit || since < 0) return null;
  return (
    <div style={{ fontFamily: fonts.body, fontWeight: F.weights.caption, fontSize: fit.size, lineHeight: 1.0, letterSpacing: "-0.02em", textAlign: "center", ...focusPull(since, 1.22, 22) }}>
      {fit.lines.map((l, i) => {
        const acc = accent && i === fit.lines.length - 1 && l.endsWith(accent) ? accent : "";
        return (
          <div key={i} style={{ whiteSpace: "nowrap" }}>
            <span style={{ color: "#fff", textShadow: "0 8px 40px rgba(5,6,10,0.9)" }}>{acc ? l.slice(0, l.length - acc.length) : l}</span>
            {acc && <GradientText shift={(frame * 0.8) % 100}>{acc}</GradientText>}
          </div>
        );
      })}
    </div>
  );
};

/** Glass pill CTA: pops in, a cursor clicks it at frame 14 (the click sound is at CTA_CLICK_FRAME = 17), it fills with the iridescent gradient. */
export const FrontierCTA: React.FC<{ since: number; label: string; doneLabel: string; size?: number }> = ({ since, label, doneLabel, size = 46 }) => {
  const { fonts } = useTheme();
  if (since < 0) return null;
  const click = since - 14;
  const pop = interpolate(since, [0, 8], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) }) * (click >= 0 && click < 6 ? 0.94 : 1);
  const done = click >= 3;
  const cx = interpolate(since, [0, 14], [420, 170], { ...clamp, easing: Easing.out(Easing.cubic) });
  const cy = interpolate(since, [0, 14], [200, 46], { ...clamp, easing: Easing.out(Easing.cubic) });
  const ring = click >= 0 ? prog(click, 0, 14) : 0;
  return (
    <div style={{ position: "relative", marginTop: 54 }}>
      <div style={{ transform: `scale(${pop})`, borderRadius: 999, padding: 2, background: F.iris, boxShadow: `0 0 ${done ? 70 : 40}px rgba(61,240,255,${done ? 0.45 : 0.3})` }}>
        <div
          style={{
            borderRadius: 999,
            background: done ? F.iris : "rgba(10,12,22,0.86)",
            color: done ? F.ink : "#fff",
            fontFamily: fonts.body,
            fontWeight: F.weights.caption,
            fontSize: size,
            letterSpacing: "-0.01em",
            padding: `${size * 0.42}px ${size * 1.3}px`,
            display: "flex",
            alignItems: "center",
            gap: size * 0.4,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: size * 0.42, height: size * 0.42, borderRadius: 999, background: done ? F.ink : F.lime, boxShadow: done ? undefined : `0 0 14px ${F.lime}` }} />
          {done ? `${doneLabel} ✓` : label}
        </div>
      </div>
      {click >= 0 && ring < 1 && (
        <div style={{ position: "absolute", left: cx + 196 - 40 * ring, top: cy + 34 - 40 * ring, width: 80 * ring, height: 80 * ring, borderRadius: 999, border: `2px solid ${F.cyan}`, opacity: 1 - ring }} />
      )}
      <svg width="54" height="54" viewBox="0 0 24 24" style={{ position: "absolute", left: cx + 196, top: cy + 34, filter: `drop-shadow(0 0 8px ${F.cyan})` }}>
        <path d="M4 2 L4 20 L9 15 L12 22 L15 21 L12 14 L19 14 Z" fill="#fff" stroke={F.ink} strokeWidth={1.2} />
      </svg>
    </div>
  );
};

export const FrontierOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useEpisode();
  const { effects, copy } = theme;
  const { from, lines, cta } = timeline.outro;
  const at = lines.map((l) => toFrame(l.at) - from);
  const ctaAt = cta ? toFrame(cta.at) - from : null;
  const last = lines.length - 1;
  const pins = allPins(episode);
  const zoom = interpolate(frame, [0, 240], [1.1, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const lastHit = at.reduce((acc, f) => (frame >= f ? f : acc), 0);
  return (
    <AbsoluteFill>
      <Field ripple={frame - lastHit} />
      {pins.length > 0 && (
        <AbsoluteFill style={{ transform: `scale(${zoom})`, justifyContent: "center", alignItems: "center", opacity: 0.55 }}>
          <DotMap width={1920} height={1000} allPins={pins} pinDelay={0} zoomFrames={1} showLabels={false} pitch={8} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: effects.outroScrim }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 140 }}>
        {lines.map(({ line }, i) => {
          if (frame < at[i]) return null;
          if (i < last) {
            const out = interpolate(frame, [at[i + 1] - 5, at[i + 1]], [1, 0], clamp);
            if (out <= 0) return null;
            return (
              <div key={i} style={{ position: "absolute", opacity: out, filter: out < 1 ? `blur(${(1 - out) * 16}px)` : undefined }}>
                <FocusLine since={frame - at[i]} text={line.text} accent={line.accent} width={1600} maxSize={130} />
              </div>
            );
          }
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <FocusLine since={frame - at[i]} text={line.text} accent={line.accent} width={1600} maxSize={lines.length > 1 ? 180 : 150} />
              {ctaAt !== null && frame >= ctaAt && <FrontierCTA since={frame - ctaAt} label={cta?.label ?? episode.outro.cta?.label ?? copy.ctaLabel} doneLabel={copy.ctaDoneLabel} />}
            </div>
          );
        })}
      </AbsoluteFill>
      <Bloom since={frame - lastHit} strength={0.22} />
    </AbsoluteFill>
  );
};
