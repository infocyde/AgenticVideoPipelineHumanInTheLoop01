// Asked Claude's cold open and outro (16:9). The open is the question: each beat sets a small label ("YOU ASKED") and
// the question itself (the beat's `sub`) in italic serif, typed in word by word, with the beat's visual in a print
// beside it. Then the title card: the brand mark, the kicker, the big word and the topic. The outro sets its lines
// quietly, one after another, and ends on a subscribe button.
import React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { clamp, useEpisode, useTheme } from "../../context";
import type { Asset } from "../../lib/resolve";
import { toFrame } from "../../lib/timing";
import { AC, Heading, Label, Mark, PAGE, Paper, Print, prog, useFit } from "./parts";

/** The question, typed in a word at a time from `since`, with a blinking caret until it's done. */
const Question: React.FC<{ text: string; since: number; width: number; maxSize: number; align?: "left" | "center" }> = ({ text, since, width, maxSize, align = "left" }) => {
  const { fonts } = useTheme();
  const fit = useFit(text, width - 60, maxSize, 46, 4);
  if (!fit || since < 0) return null;
  const per = 2.2; // frames per word
  let k = 0;
  const total = fit.lines.reduce((n, l) => n + l.split(" ").length, 0);
  const done = since >= total * per;
  const caretOn = !done || Math.floor(since / 15) % 2 === 0;
  return (
    <div style={{ position: "relative", width, fontFamily: fonts.display, fontStyle: "italic", fontWeight: 500, fontSize: fit.size, lineHeight: 1.16, color: AC.ink, textAlign: align }}>
      <span style={{ position: "absolute", left: align === "left" ? -fit.size * 0.62 : undefined, top: -fit.size * 0.08, color: AC.clay, fontStyle: "normal" }}>{align === "left" ? "“" : ""}</span>
      {fit.lines.map((l, i) => (
        <div key={i} style={{ whiteSpace: "nowrap" }}>
          {l.split(" ").map((w, j) => {
            const at = k++ * per;
            const o = interpolate(since, [at, at + 5], [0, 1], clamp);
            return (
              <span key={j} style={{ opacity: o }}>
                {w}
                {j < l.split(" ").length - 1 ? " " : ""}
              </span>
            );
          })}
          {i === fit.lines.length - 1 && (
            <span style={{ display: "inline-block", width: fit.size * 0.06, height: fit.size * 0.82, marginLeft: fit.size * 0.12, background: AC.clay, verticalAlign: "-0.08em", opacity: caretOn ? 1 : 0 }} />
          )}
        </div>
      ))}
    </div>
  );
};

const QuestionBeat: React.FC<{ label: string; question?: string; visual?: string; asset: Asset | null; note?: string; dur: number; index: number }> = ({
  label,
  question,
  visual,
  asset,
  note,
  dur,
  index,
}) => {
  const frame = useCurrentFrame();
  // No question: the label is the line (e.g. a one-word beat), set as a heading.
  const body = (width: number, maxSize: number, align: "left" | "center") =>
    question ? (
      <div style={{ marginTop: 34, marginLeft: align === "left" ? 56 : 0 }}>
        <Question text={question} since={frame - 10} width={width - (align === "left" ? 56 : 0)} maxSize={maxSize} align={align} />
      </div>
    ) : (
      <div style={{ marginTop: 30 }}>
        <Heading text={label} since={frame - 6} width={width} maxSize={maxSize} minSize={56} maxLines={3} align={align} />
      </div>
    );
  if (asset) {
    const col = PAGE.column;
    return (
      <AbsoluteFill>
        <Paper />
        <div style={{ position: "absolute", left: col.left, top: col.top + 10, width: col.width + 20 }}>
          {question && <Label text={label} since={frame} size={24} />}
          {body(col.width + 20, 76, "left")}
        </div>
        <Print box={PAGE.print} visuals={[{ name: visual!, asset, note, from: 0 }]} durationInFrames={dur} seed={index} enterAt={2} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <Paper quote quoteOpacity={0.06} />
      <AbsoluteFill style={{ top: 120, bottom: 170, justifyContent: "center" }}>
        <div style={{ marginLeft: 240, width: 1440 }}>
          {question && <Label text={label} since={frame} size={24} />}
          {body(1440, 96, "left")}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Title card: the mark settles, the kicker sets, the big word arrives on its cue, the topic rises beside it. */
const TitleCard: React.FC<{ kicker: string; big: string; small: string; bigAt: number }> = ({ kicker, big, small, bigAt }) => {
  const frame = useCurrentFrame();
  const { fonts } = useTheme();
  const markIn = prog(frame, 0, 18, Easing.out(Easing.back(1.6)));
  const kickIn = prog(frame, 6, 14);
  const since = frame - bigAt;
  const bigIn = prog(since, 0, 16, Easing.out(Easing.back(1.4)));
  const lines = small.split("\n");
  const bigSize = big.length <= 2 ? 300 : big.length <= 4 ? 230 : 180;
  const rule = prog(since, 10, 24);
  return (
    <AbsoluteFill>
      <Paper quote quoteOpacity={0.05} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ transform: `scale(${0.6 + 0.4 * markIn})`, opacity: Math.min(1, markIn * 1.4) }}>
            <Mark size={92} />
          </div>
          <div style={{ marginTop: 26, fontFamily: fonts.mono, fontWeight: 700, fontSize: 30, letterSpacing: 12, color: AC.inkSoft, opacity: kickIn }}>{kicker}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 46, marginTop: 18 }}>
            {big && (
              <span style={{ fontFamily: fonts.display, fontStyle: "italic", fontWeight: 500, fontSize: bigSize, lineHeight: 1, color: AC.clay, opacity: since >= 0 ? Math.min(1, bigIn * 1.5) : 0, transform: `scale(${0.85 + 0.15 * bigIn})` }}>
                {big}
              </span>
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {lines.map((l, i) => {
                const p = prog(since, 3 + i * 4, 16);
                return (
                  <div key={i} style={{ overflow: "hidden", paddingBottom: 18, marginBottom: -18 }}>
                    <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: lines.length > 1 ? 112 : 132, lineHeight: 1.02, color: AC.ink, opacity: p, transform: `translateY(${(1 - p) * 60}px)` }}>{l}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: 34, height: 3, width: 760 * rule, background: AC.clay, borderRadius: 2 }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const AskedColdOpen: React.FC = () => {
  const { episode, timeline } = useEpisode();
  const { beats, title, to } = timeline.coldOpen;
  const titleFrom = toFrame(title.start);
  const t = episode.coldOpen.title;
  return (
    <AbsoluteFill>
      {beats.map(({ beat, start, end, asset }, i) => {
        const from = toFrame(start);
        const dur = Math.max(1, Math.min(toFrame(end), titleFrom) - from);
        const question = beat.sub ?? (beat.accent ? `${beat.stamp} ${beat.accent}` : undefined);
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <QuestionBeat label={beat.stamp} question={beat.sub ? question : undefined} visual={beat.visual} asset={beat.map ? null : asset} note={beat.note} dur={dur} index={i} />
          </Sequence>
        );
      })}
      <Sequence from={titleFrom} durationInFrames={Math.max(1, to - titleFrom)}>
        <TitleCard kicker={t.kicker} big={t.big} small={t.small} bigAt={toFrame(title.bigAt) - titleFrom} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------------------------------------ outro

/** One outro line in serif, the accent words in clay italic, rising in. */
const OutroLine: React.FC<{ text: string; accent?: string; since: number; maxSize: number }> = ({ text, accent, since, maxSize }) => {
  const { fonts } = useTheme();
  const full = `${text}${accent ? ` ${accent}` : ""}`;
  const fit = useFit(full, 1500, maxSize, 64, 2);
  if (!fit || since < 0) return null;
  const p = prog(since, 0, 18);
  return (
    <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: fit.size, lineHeight: 1.06, textAlign: "center", color: AC.ink, opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
      {fit.lines.map((l, i) => {
        const acc = accent && i === fit.lines.length - 1 && l.endsWith(accent) ? accent : "";
        return (
          <div key={i} style={{ whiteSpace: "nowrap" }}>
            {acc ? l.slice(0, l.length - acc.length) : l}
            {acc && <span style={{ color: AC.clay, fontStyle: "italic", fontWeight: 500 }}>{acc}</span>}
          </div>
        );
      })}
    </div>
  );
};

/** Subscribe pill: settles in, the cursor clicks it at frame 14 (the click sound is at CTA_CLICK_FRAME = 17), it fills. */
const CTA: React.FC<{ since: number; label: string; doneLabel: string }> = ({ since, label, doneLabel }) => {
  const { fonts } = useTheme();
  if (since < 0) return null;
  const click = since - 14;
  const pop = prog(since, 0, 10, Easing.out(Easing.back(1.6))) * (click >= 0 && click < 6 ? 0.95 : 1);
  const done = click >= 3;
  const cx = interpolate(since, [0, 14], [380, 150], { ...clamp, easing: Easing.out(Easing.cubic) });
  const cy = interpolate(since, [0, 14], [170, 40], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "relative", marginTop: 56 }}>
      <div
        style={{
          transform: `scale(${pop})`,
          borderRadius: 999,
          border: `3px solid ${AC.clay}`,
          background: done ? AC.clay : AC.card,
          color: done ? "#fff8ef" : AC.clay,
          fontFamily: fonts.body,
          fontWeight: 800,
          fontSize: 44,
          padding: "18px 58px",
          display: "flex",
          alignItems: "center",
          gap: 18,
          whiteSpace: "nowrap",
          boxShadow: "0 18px 40px -20px rgba(60,40,20,0.5)",
        }}
      >
        {done ? `${doneLabel} ✓` : label}
      </div>
      <svg width="52" height="52" viewBox="0 0 24 24" style={{ position: "absolute", left: cx + 160, top: cy + 30 }}>
        <path d="M4 2 L4 20 L9 15 L12 22 L15 21 L12 14 L19 14 Z" fill={AC.ink} stroke="#fff8ef" strokeWidth={1.4} />
      </svg>
    </div>
  );
};

export const AskedOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useEpisode();
  const { from, lines, cta } = timeline.outro;
  const at = lines.map((l) => toFrame(l.at) - from);
  const ctaAt = cta ? toFrame(cta.at) - from : null;
  const last = lines.length - 1;
  return (
    <AbsoluteFill>
      <Paper quote quoteOpacity={0.08} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 120 }}>
        {lines.map(({ line }, i) => {
          if (frame < at[i]) return null;
          if (i < last) {
            const out = interpolate(frame, [at[i + 1] - 6, at[i + 1]], [1, 0], clamp);
            if (out <= 0) return null;
            return (
              <div key={i} style={{ position: "absolute", opacity: out, transform: `translateY(${(1 - out) * -30}px)` }}>
                <OutroLine text={line.text} accent={line.accent} since={frame - at[i]} maxSize={120} />
              </div>
            );
          }
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <OutroLine text={line.text} accent={line.accent} since={frame - at[i]} maxSize={lines.length > 1 ? 150 : 130} />
              {ctaAt !== null && frame >= ctaAt && <CTA since={frame - ctaAt} label={cta?.label ?? episode.outro.cta?.label ?? theme.copy.ctaLabel} doneLabel={theme.copy.ctaDoneLabel} />}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
