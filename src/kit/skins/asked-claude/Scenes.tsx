// Asked Claude segments and text sections (16:9). Both read like a page: a serif text column on the left, the print
// (the visual, shown whole in a frame) on the right. A section with no visual sets its text alone, larger, like a
// note. Numbered segments carry a big italic numeral ("reason 2") and the stats as a short list of facts.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { WorldMap } from "../../components/WorldMap";
import { useEpisode } from "../../context";
import type { ResolvedSegment, ResolvedText } from "../../lib/resolve";
import { segmentOffset, toFrame } from "../../lib/timing";
import { AC, Body, Heading, Label, PAGE, Paper, Print, prog, visualsOf } from "./parts";

/** One fact: the value in sage serif, its label under it, a hairline above. */
const Fact: React.FC<{ value: string; label: string; since: number }> = ({ value, label, since }) => {
  const { theme } = useEpisode();
  const p = prog(since, 0, 14);
  return (
    <div style={{ borderTop: `1.5px solid ${AC.rule}`, padding: "14px 0 12px", opacity: p, transform: `translateY(${(1 - p) * 16}px)`, display: "flex", alignItems: "baseline", gap: 22 }}>
      <span style={{ fontFamily: theme.fonts.display, fontWeight: 600, fontSize: 54, lineHeight: 1, color: AC.sage, whiteSpace: "nowrap" }}>{value}</span>
      <span style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 25, lineHeight: 1.25, color: AC.inkSoft }}>{label}</span>
    </div>
  );
};

export const AskedSegment: React.FC<{ s: ResolvedSegment; slam: boolean }> = ({ s, slam }) => {
  const frame = useCurrentFrame();
  const { theme } = useEpisode();
  const { fonts } = theme;
  const { seg } = s;
  const dur = s.to - s.from;
  const f = frame - segmentOffset(slam); // list format: start 12 frames early (no number slam to wait for)
  const visuals = visualsOf(s.visuals, s.from);
  const hasPrint = visuals.length > 0 || !!seg.map;
  const col = hasPrint ? PAGE.column : { ...PAGE.solo, width: 1300 };
  const numIn = prog(f, 0, 18);
  const isTop = seg.emphasis === "top";
  // Facts appear on their cues; the latest three stay on the page.
  const shown = s.stats.map((st) => ({ st, since: frame - (toFrame(st.at) - s.from) })).filter((x) => x.since >= 0);
  const facts = shown.slice(-3);
  const inner = { w: PAGE.print.width - 28, h: PAGE.print.height - 28 };
  return (
    <AbsoluteFill>
      <Paper />
      <div style={{ position: "absolute", left: col.left, top: col.top - 20, width: col.width }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <span
            style={{
              fontFamily: fonts.display,
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: 128,
              lineHeight: 0.9,
              color: AC.clay,
              opacity: numIn,
              transform: `translateY(${(1 - numIn) * 24}px)`,
            }}
          >
            {s.num}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {isTop && f >= 6 && (
              <span
                style={{
                  alignSelf: "flex-start",
                  fontFamily: fonts.mono,
                  fontWeight: 700,
                  fontSize: 18,
                  letterSpacing: 3,
                  color: "#fff8ef",
                  background: AC.clay,
                  borderRadius: 999,
                  padding: "5px 14px",
                  opacity: prog(f, 6, 10),
                }}
              >
                {seg.emphasisLabel ?? theme.copy.topEmphasisLabel}
              </span>
            )}
            <Label text={seg.region} since={f - 6} color={AC.inkSoft} size={21} />
          </div>
        </div>
        <div style={{ marginTop: 26 }}>
          <Heading text={seg.headline} since={f - 10} width={col.width} maxSize={hasPrint ? 80 : 104} minSize={50} maxLines={3} />
        </div>
        {seg.subhead && f >= 22 && (
          <div style={{ marginTop: 14, fontFamily: fonts.body, fontWeight: 600, fontSize: 30, color: AC.inkSoft, opacity: prog(f, 22, 12) }}>{seg.subhead}</div>
        )}
        {facts.length > 0 && (
          <div style={{ marginTop: 34, width: Math.min(col.width, 760) }}>
            {facts.map(({ st, since }, i) => (
              <Fact key={`${st.value}-${i}`} value={st.value} label={st.label} since={since} />
            ))}
          </div>
        )}
      </div>
      {hasPrint && (
        <Print box={PAGE.print} visuals={visuals} durationInFrames={dur} seed={s.index * 3 + 1} enterAt={Math.max(0, 6 + segmentOffset(slam))}>
          {!visuals.length && seg.map && (
            <AbsoluteFill style={{ background: AC.card }}>
              <WorldMap width={inner.w} height={inner.h} focus={seg.map} zoomFrames={40} pinDelay={18} />
            </AbsoluteFill>
          )}
        </Print>
      )}
    </AbsoluteFill>
  );
};

export const AskedText: React.FC<{ t: ResolvedText }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { seg } = t;
  const dur = t.to - t.from;
  const visuals = visualsOf(t.visuals, t.from);
  // textAt: the words wait for that cue (e.g. after a visual that needs the page to itself).
  const f = frame - (t.textAt !== undefined ? Math.max(0, toFrame(t.textAt) - t.from) : 0);

  if (seg.layout === "full" && visuals.length) {
    return (
      <AbsoluteFill>
        <Paper />
        <div style={{ position: "absolute", left: PAGE.full.left, top: PAGE.full.top - 58 }}>{seg.label && <Label text={seg.label} since={frame - 2} />}</div>
        <Print box={PAGE.full} visuals={visuals} durationInFrames={dur} seed={t.index * 5 + 2} enterAt={2} />
      </AbsoluteFill>
    );
  }

  if (!visuals.length) {
    // The text alone: the page's quiet moment ("My short answer", "Where I could be wrong").
    const solo = PAGE.solo;
    return (
      <AbsoluteFill>
        <Paper quote quoteOpacity={0.07 * prog(frame, 0, 30)} />
        {/* Centered in the page between the header and the captions. */}
        <AbsoluteFill style={{ top: 120, bottom: 170, justifyContent: "center" }}>
          <div style={{ marginLeft: solo.left, width: solo.width }}>
            {seg.label && <Label text={seg.label} since={f - 2} size={24} />}
            <div style={{ marginTop: seg.label ? 30 : 0 }}>
              <Heading text={seg.heading} since={f - 8} width={solo.width} maxSize={112} minSize={64} maxLines={3} />
            </div>
            {seg.body && <Body text={seg.body} since={f - 22} size={40} width={1200} />}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const col = PAGE.column;
  return (
    <AbsoluteFill>
      <Paper />
      <div style={{ position: "absolute", left: col.left, top: col.top, width: col.width }}>
        {seg.label && <Label text={seg.label} since={f - 2} />}
        <div style={{ marginTop: seg.label ? 26 : 0 }}>
          <Heading text={seg.heading} since={f - 8} width={col.width} maxSize={84} minSize={50} maxLines={4} />
        </div>
        {seg.body && <Body text={seg.body} since={f - 22} size={32} width={col.width - 20} />}
      </div>
      <Print box={PAGE.print} visuals={visuals} durationInFrames={dur} seed={t.index * 5 + 2} />
    </AbsoluteFill>
  );
};
