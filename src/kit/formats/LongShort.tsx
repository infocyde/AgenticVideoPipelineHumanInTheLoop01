// Long Shorts ("long": true on a Short, 1–2.5 min): scenes for the vertical frame that never crop a visual. Every image,
// infographic, explainer and clip sits whole in a framed card at its own aspect ratio (fitted into MEDIA_BOX), over a
// soft blurred copy of itself; the headline sits above the card and the stat below it, so no text covers footage.
// A chapter rail across the top shows how far through the video the viewer is (a long Short needs that more than a
// 30-second one). Stays inside the area the Shorts interface leaves clear, like Short.tsx: nothing important in the
// top ~140px, the bottom ~400px or the right ~150px of the lower half. Any theme can use it; "dispatch" is made for it.
// Same timing contract as the shared Short scenes (scene cuts, stat and visual cues, MAP_EXIT), so the sounds still land.
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, Img, interpolate, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { CaptionBox } from "../components/Chrome";
import { fitLines, Headline, useFontsReady } from "../components/Headline";
import { SourceTag } from "../components/SourceTag";
import { WorldMap } from "../components/WorldMap";
import { clamp, useEpisode, useTheme } from "../context";
import { allPins, type Asset, firstPins, type ResolvedSegment, type ResolvedText, type ResolvedVisual, type Timeline } from "../lib/resolve";
import { FPS, MAP_EXIT, segmentOffset, toFrame } from "../lib/timing";
import { tagChannel } from "../lib/youtube";
import type { Skin } from "../skins/types";
import { alpha } from "../themes";

const X = 60;
const W = 1080 - 2 * X;
/** The rail under the brand, the chapter line, the headline, then the card. */
const RAIL_TOP = 196;
const LABEL_TOP = 226;
const HEAD_TOP = 270;
/** Visuals are fitted (never cropped) into this box; the card takes the visual's own shape. */
export const MEDIA_BOX = { top: 470, width: W, height: 680 };
/** Captions on a pill above the Shorts interface's bottom band, under the stat. */
export const LONG_CAPTIONS: CaptionBox = { left: X, right: 160, bottom: 430, fontSize: 60, panel: true };
const NOTE_SIZE = 22;
const DEFAULT_ASPECT = 16 / 9;

const pad2 = (n: number) => String(n).padStart(2, "0");
const ease = { ...clamp, easing: Easing.out(Easing.cubic) };

/** The card's size: the visual's aspect ratio, as large as fits the box. */
export const fitBox = (asset: Asset | null, box = MEDIA_BOX) => {
  const aspect = asset?.width && asset?.height ? asset.width / asset.height : DEFAULT_ASPECT;
  const w = Math.min(box.width, box.height * aspect);
  return { width: Math.round(w), height: Math.round(w / aspect) };
};

/** Every chapter (numbered segments and text sections) in spoken order. */
const chaptersOf = (t: Timeline) => [...t.segments, ...t.texts].map((c) => ({ from: c.from, to: c.to })).sort((a, b) => a.from - b.from);
const chapterIndex = (t: Timeline, from: number) => chaptersOf(t).findIndex((c) => c.from === from);

/** The media itself: a slow drift on photos and footage, none on graphics (they show edge to edge). */
const Media: React.FC<{ asset: Asset; frames: number; grade: boolean; drift: boolean; fill?: "cover" | "contain" }> = ({ asset, frames, grade, drift, fill = "cover" }) => {
  const frame = useCurrentFrame();
  const { backdrop } = useTheme();
  const s = drift ? interpolate(frame, [0, frames], [1, 1.06], clamp) : 1;
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: fill, filter: grade ? backdrop.filter : "none", transform: `scale(${s})` };
  if (asset.kind === "image") return <Img src={staticFile(asset.file)} style={style} />;
  // Slow a short clip down (to at most half speed) to fill the slot, then loop, as the Backdrop does.
  const rate = Math.max(0.5, Math.min(1, asset.duration / (frames / FPS)));
  const loopFrames = Math.max(1, Math.floor(((asset.duration - 0.1) / rate) * FPS));
  return (
    <Loop durationInFrames={loopFrames}>
      <OffthreadVideo src={staticFile(asset.file)} muted playbackRate={rate} style={style} />
    </Loop>
  );
};

/** The whole frame behind the card: a blurred, dimmed copy of the visual (drawn small and scaled up, so it's cheap). */
const BlurField: React.FC<{ asset: Asset; frames: number }> = ({ asset, frames }) => {
  const { colors } = useTheme();
  return (
    <AbsoluteFill style={{ background: colors.bg, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 270, height: 480, transform: "scale(4)", transformOrigin: "0 0", filter: "blur(9px) brightness(0.42) saturate(1.15)" }}>
        <Media asset={asset} frames={frames} grade={false} drift={false} />
      </div>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${alpha(colors.bg, 0.78)} 0%, ${alpha(colors.bg, 0.2)} 30%, ${alpha(colors.bg, 0.2)} 58%, ${alpha(colors.bg, 0.85)} 100%)` }} />
    </AbsoluteFill>
  );
};

/** A framed card at the top of the media box, entering with a short rise (a feed card arriving) when its sequence starts. */
const Card: React.FC<{ size: { width: number; height: number }; pulse?: number; children: React.ReactNode }> = ({ size, pulse = 0, children }) => {
  const frame = useCurrentFrame();
  const { colors } = useTheme();
  const k = interpolate(frame, [0, 9], [0, 1], ease);
  return (
    <div
      style={{
        position: "absolute",
        top: MEDIA_BOX.top,
        left: (1080 - size.width) / 2,
        width: size.width,
        height: size.height,
        overflow: "hidden",
        borderRadius: 18,
        background: colors.bg,
        outline: `${3 + pulse * 3}px solid ${pulse > 0 ? colors.accent : colors.line}`,
        boxShadow: `0 28px 80px rgba(0,0,0,0.55)${pulse > 0 ? `, 0 0 ${40 + 60 * pulse}px ${alpha(colors.accent, 0.35)}` : ""}`,
        opacity: k,
        transform: `translateY(${(1 - k) * 70}px) scale(${0.96 + 0.04 * k})`,
      }}
    >
      {children}
    </div>
  );
};

/** Note pill (file footage, AI illustration) and the YouTube source tag, inside the card's corners. */
const CardTags: React.FC<{ asset: Asset; note?: string }> = ({ asset, note }) => {
  const { colors, fonts } = useTheme();
  const channel = tagChannel(asset);
  return (
    <>
      {note && (
        <div style={{ position: "absolute", right: 14, bottom: 14, zIndex: 5, fontFamily: fonts.mono, fontSize: NOTE_SIZE, letterSpacing: 2, color: colors.dim, background: colors.noteBg, padding: "4px 10px", borderRadius: 6 }}>
          {note}
        </div>
      )}
      {channel && <SourceTag channel={channel} inset={14} size={20} maxWidth={W - 60} />}
    </>
  );
};

type CardVisual = { name: string; asset: Asset; note?: string; grade?: boolean; from: number };

/** The card (and the blurred field behind it) for each visual in turn; the bottom of the current card, for the stat. */
const MediaStage: React.FC<{ visuals: CardVisual[]; dur: number; pulse?: number; mapUntil?: number; map?: React.ReactNode }> = ({ visuals, dur, pulse = 0, mapUntil = 0, map }) => {
  const frame = useCurrentFrame();
  const { colors } = useTheme();
  return (
    <AbsoluteFill>
      {map && frame < mapUntil && (
        <>
          <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${colors.panel} 0%, ${colors.bg} 70%)` }} />
          <Card size={{ width: MEDIA_BOX.width, height: MEDIA_BOX.height }} pulse={pulse}>
            {map}
          </Card>
        </>
      )}
      {visuals.map((v, i) => {
        const from = Math.max(mapUntil, i === 0 ? 0 : v.from);
        const end = visuals[i + 1]?.from ?? dur;
        if (end <= from) return null;
        const slot = end - from;
        const graphic = !!v.asset.infographic;
        return (
          <Sequence key={i} from={from} durationInFrames={slot} layout="none">
            <BlurField asset={v.asset} frames={slot} />
            <Card size={fitBox(v.asset)} pulse={pulse}>
              <Media asset={v.asset} frames={slot} grade={v.grade !== false && !graphic} drift={!graphic} />
              <CardTags asset={v.asset} note={v.note} />
            </Card>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/** The visual showing at `frame`, to place the stat under its card. */
const currentAsset = (visuals: CardVisual[], frame: number, mapUntil: number): Asset | null => {
  if (frame < mapUntil) return null;
  let a: Asset | null = visuals[0]?.asset ?? null;
  visuals.forEach((v, i) => {
    if (i > 0 && frame >= v.from) a = v.asset;
  });
  return a;
};
const cardBottom = (asset: Asset | null, hasCard: boolean) => (hasCard ? MEDIA_BOX.top + (asset ? fitBox(asset).height : MEDIA_BOX.height) : MEDIA_BOX.top);

const toCard = (vs: ResolvedVisual[], from: number): CardVisual[] =>
  vs.flatMap((v, i) => (v.asset ? [{ name: v.name, asset: v.asset, note: v.note, grade: v.grade, from: i === 0 ? 0 : toFrame(v.at) - from }] : []));

/** Chapter line: "02 / 06" in the accent, then the region (or a text section's label), typed on. */
const ChapterLine: React.FC<{ k: number; n: number; text: string; chip?: string; pulse?: number }> = ({ k, n, text, chip, pulse = 0 }) => {
  const frame = useCurrentFrame();
  const { colors, fonts } = useTheme();
  const chars = Math.floor(interpolate(frame, [4, 4 + text.length * 0.8], [0, text.length], clamp));
  return (
    <div style={{ position: "absolute", top: LABEL_TOP, left: X, width: W, display: "flex", alignItems: "center", gap: 18, fontFamily: fonts.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, whiteSpace: "nowrap", overflow: "hidden" }}>
      {chip && <span style={{ color: colors.onAccent, background: colors.accent, padding: "2px 12px", borderRadius: 4, opacity: 0.65 + 0.35 * pulse }}>{chip}</span>}
      {k >= 0 && (
        <span style={{ color: colors.accent }}>
          {pad2(k + 1)}
          <span style={{ color: colors.dim }}> / {pad2(n)}</span>
        </span>
      )}
      <span style={{ color: colors.highlight }}>{text.slice(0, chars)}</span>
    </div>
  );
};

/** One stat at a time under the card: big value, accent rule, typed label. */
const Stat: React.FC<{ value: string; label: string; since: number; top: number }> = ({ value, label, since, top }) => {
  const { colors, fonts } = useTheme();
  const k = interpolate(since, [0, 7], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.5)) });
  const chars = Math.floor(interpolate(since, [5, 5 + label.length * 0.7], [0, label.length], clamp));
  return (
    <div style={{ position: "absolute", top, left: X, width: W - 90, display: "flex", alignItems: "center", gap: 26, opacity: Math.min(1, k * 1.5) }}>
      <div style={{ width: 10, alignSelf: "stretch", background: colors.accent, borderRadius: 5, transform: `scaleY(${k})` }} />
      <div>
        <div style={{ fontFamily: fonts.display, fontSize: 108, lineHeight: 0.92, color: colors.highlight, whiteSpace: "nowrap", transform: `translateX(${(1 - k) * -30}px)` }}>{value}</div>
        <div style={{ marginTop: 8, fontFamily: fonts.mono, fontWeight: 700, fontSize: 32, letterSpacing: 2, lineHeight: 1.2, color: colors.text, textTransform: "uppercase" }}>{label.slice(0, chars)}</div>
      </div>
    </div>
  );
};

/** Each chapter rises in as a whole, like the next card in a feed. */
const ChapterIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const k = interpolate(frame, [0, 8], [0, 1], ease);
  return <AbsoluteFill style={{ opacity: k, transform: `translateY(${(1 - k) * 90}px)` }}>{children}</AbsoluteFill>;
};

const LongSegment: React.FC<{ s: ResolvedSegment }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { timeline, theme } = useEpisode();
  const { colors } = theme;
  const { seg } = s;
  const dur = s.to - s.from;
  const k = chapterIndex(timeline, s.from);
  const n = chaptersOf(timeline).length;
  const isTop = seg.emphasis === "top";
  const pulse = isTop ? (Math.sin(frame / 5) + 1) / 2 : 0;
  const visuals = toCard(s.visuals, s.from);
  // A segment with a map opens on it in the card, then cuts to the visuals (the "mapExit" sound lands here).
  const mapUntil = seg.map && visuals.length ? MAP_EXIT + segmentOffset(false) : 0;
  const statFrames = s.stats.map((st) => toFrame(st.at) - s.from);
  const active = statFrames.reduce((acc, f, i) => (frame >= f ? i : acc), -1);
  const shown = seg.overlay !== "none" && seg.card !== "none";
  const exitFrom = s.exitAt !== undefined ? toFrame(s.exitAt) - s.from : null;
  const out = exitFrom === null ? 0 : interpolate(frame, [exitFrom, exitFrom + 10], [0, 1], clamp);
  const wipe = interpolate(frame, [8, 22], [100, 0], ease);
  const hasCard = visuals.length > 0 || !!seg.map;
  const bottom = cardBottom(currentAsset(visuals, frame, mapUntil), hasCard);
  const map = seg.map ? <WorldMap width={MEDIA_BOX.width} height={MEDIA_BOX.height} focus={seg.map} showLabels /> : null;
  return (
    <ChapterIn>
      {!visuals.length && <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${colors.panel} 0%, ${colors.bg} 70%)` }} />}
      {hasCard && <MediaStage visuals={visuals} dur={dur} pulse={pulse} mapUntil={visuals.length ? mapUntil : dur} map={map} />}
      {shown && (
        <div style={{ opacity: 1 - out }}>
          <ChapterLine k={k} n={n} text={seg.region} chip={isTop ? (seg.emphasisLabel ?? theme.copy.topEmphasisLabel) : undefined} pulse={pulse} />
          <div style={{ position: "absolute", top: HEAD_TOP, left: X, width: W }}>
            <Headline text={seg.headline} width={W} wipe={wipe} maxSize={86} minSize={56} maxLines={2} />
          </div>
          {active >= 0 && <Stat key={active} value={seg.stats[active].value} label={seg.stats[active].label} since={frame - statFrames[active]} top={bottom + 34} />}
        </div>
      )}
    </ChapterIn>
  );
};

const LongText: React.FC<{ t: ResolvedText }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useEpisode();
  const { colors, fonts } = theme;
  const { seg } = t;
  const dur = t.to - t.from;
  const visuals = toCard(t.visuals, t.from);
  const k = chapterIndex(timeline, t.from);
  const n = chaptersOf(timeline).length;
  const wipe = interpolate(frame, [10, 24], [100, 0], ease);
  const bodyIn = interpolate(frame, [22, 36], [0, 1], ease);
  const exitFrom = t.exitAt !== undefined ? toFrame(t.exitAt) - t.from : null;
  const out = exitFrom === null ? 0 : interpolate(frame, [exitFrom, exitFrom + 10], [0, 1], clamp);
  const pins = allPins(episode);
  const map = !visuals.length && pins.length ? <WorldMap width={MEDIA_BOX.width} height={MEDIA_BOX.height} allPins={pins} pinDelay={0} zoomFrames={1} showLabels={false} /> : null;
  const hasCard = visuals.length > 0 || !!map;
  const bottom = cardBottom(currentAsset(visuals, frame, 0), hasCard);
  return (
    <ChapterIn>
      {!visuals.length && <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${colors.panel} 0%, ${colors.bg} 70%)` }} />}
      {hasCard && <MediaStage visuals={visuals} dur={dur} mapUntil={visuals.length ? 0 : dur} map={map} />}
      <div style={{ opacity: 1 - out }}>
        <ChapterLine k={k} n={n} text={seg.label ?? ""} />
        <div style={{ position: "absolute", top: HEAD_TOP, left: X, width: W }}>
          <Headline text={seg.heading} width={W} wipe={wipe} maxSize={86} minSize={56} maxLines={2} />
        </div>
        {seg.body && (
          <div
            style={{
              position: "absolute",
              top: bottom + 34,
              left: X,
              width: W - 90,
              paddingLeft: 24,
              borderLeft: `6px solid ${colors.accent}`,
              fontFamily: fonts.body,
              fontWeight: 600,
              fontSize: 38,
              lineHeight: 1.28,
              color: colors.text,
              opacity: bodyIn,
              transform: `translateY(${(1 - bodyIn) * 20}px)`,
            }}
          >
            {seg.body}
          </div>
        )}
      </div>
    </ChapterIn>
  );
};

/** Hook stamps: one big line, or two smaller ones, so the stamp stays between the rail and the card (~200px). */
const useStampFit = (text: string) => {
  const { fonts } = useTheme();
  const ready = useFontsReady();
  return useMemo(() => {
    if (!ready) return null;
    const fit = (maxSize: number, minSize: number) => fitLines({ text, width: W, maxSize, minSize, maxLines: 2, fontFamily: fonts.display, uppercase: true });
    const one = fit(160, 64);
    return one.lines.length === 1 ? one : fit(104, 64);
  }, [ready, text, fonts.display]);
};

/** A hook beat: the stamp where the headline goes, the visual (or the map of every pin) in the card, the sub under it. */
const HookBeat: React.FC<{ stamp: string; sub?: string; asset: Asset | null; visual?: string; note?: string; allPinsMap: boolean; dur: number }> = ({ stamp, sub, asset, visual, note, allPinsMap, dur }) => {
  const frame = useCurrentFrame();
  const { episode, theme } = useEpisode();
  const { colors, fonts } = theme;
  const fit = useStampFit(stamp);
  const s = interpolate(frame, [2, 8], [1.5, 1], { ...clamp, easing: Easing.out(Easing.exp) });
  const o = interpolate(frame, [2, 5], [0, 1], clamp);
  const visuals: CardVisual[] = asset && visual ? [{ name: visual, asset, note, from: 0 }] : [];
  const map = allPinsMap ? <WorldMap width={MEDIA_BOX.width} height={MEDIA_BOX.height} allPins={firstPins(episode)} pinDelay={0} zoomFrames={1} showLabels={false} /> : null;
  const hasCard = visuals.length > 0 || !!map;
  const subTop = cardBottom(asset, hasCard) + 40;
  return (
    <AbsoluteFill>
      {!visuals.length && <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${colors.panel} 0%, ${colors.bg} 70%)` }} />}
      {hasCard && <MediaStage visuals={visuals} dur={dur} mapUntil={visuals.length ? 0 : dur} map={map} />}
      {fit && (
        <div style={{ position: "absolute", left: X, width: W, top: hasCard ? MEDIA_BOX.top - 36 - fit.lines.length * fit.size * 0.92 : 640, textAlign: hasCard ? "left" : "center", opacity: o, transform: `scale(${s})`, transformOrigin: hasCard ? "left bottom" : "center" }}>
          <div style={{ fontFamily: fonts.display, fontSize: fit.size, lineHeight: 0.92, color: colors.accent, textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {fit.lines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </div>
      )}
      {sub && (
        <div style={{ position: "absolute", left: X, width: W - 90, top: hasCard ? subTop : 900, fontFamily: fonts.mono, fontWeight: 700, fontSize: 34, letterSpacing: 4, lineHeight: 1.3, color: colors.text, opacity: interpolate(frame, [8, 14], [0, 1], clamp), textAlign: hasCard ? "left" : "center" }}>
          {sub}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Hook beats, then the title card: kicker, big word, small lines and the chapter count (the viewer sees the length). */
const LongColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useEpisode();
  const { colors, fonts } = theme;
  const { beats, title, to } = timeline.coldOpen;
  const titleFrom = toFrame(title.start);
  const t = episode.coldOpen.title;
  const since = frame - toFrame(title.bigAt);
  const s = interpolate(since, [0, 6], [2, 1], { ...clamp, easing: Easing.out(Easing.exp) });
  const o = interpolate(since, [0, 3], [0, 1], clamp);
  const pre = interpolate(frame - titleFrom, [0, 8], [0, 1], clamp);
  const rule = interpolate(since, [10, 22], [0, 1], ease);
  const n = chaptersOf(timeline).length;
  return (
    <AbsoluteFill>
      {beats.map(({ beat, start, end, asset }, i) => {
        const from = toFrame(start);
        const dur = Math.max(1, Math.min(toFrame(end), titleFrom) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <HookBeat stamp={`${beat.stamp}${beat.accent ? ` ${beat.accent}` : ""}`} sub={beat.sub} asset={beat.map === "all-pins" ? null : asset} visual={beat.visual} note={beat.note} allPinsMap={beat.map === "all-pins"} dur={dur} />
          </Sequence>
        );
      })}
      <Sequence from={titleFrom} durationInFrames={Math.max(1, to - titleFrom)}>
        <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, ${colors.panel} 0%, ${colors.bg} 72%)`, justifyContent: "center", alignItems: "center", paddingBottom: 220 }}>
          <div style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 38, letterSpacing: 10, color: colors.dim, opacity: pre }}>{t.kicker}</div>
          <div style={{ fontFamily: fonts.display, fontSize: t.big.length <= 2 ? 460 : t.big.length <= 4 ? 330 : 230, lineHeight: 0.95, color: colors.accent, opacity: o, transform: `scale(${s})` }}>{t.big}</div>
          <div style={{ fontFamily: fonts.display, fontSize: 150, lineHeight: 0.92, color: colors.text, opacity: o, textAlign: "center", textTransform: "uppercase" }}>
            {t.small.split("\n").map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
          <div style={{ marginTop: 34, height: 8, width: 640 * rule, background: colors.accent, borderRadius: 4 }} />
          {n > 1 && <div style={{ marginTop: 26, fontFamily: fonts.mono, fontWeight: 700, fontSize: 32, letterSpacing: 8, color: colors.highlight, opacity: rule }}>{n} CHAPTERS</div>}
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

/** Brand and date top left, and the chapter rail under them: one segment per chapter, filling as it plays. */
const LongTopBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useEpisode();
  const { colors, fonts } = theme;
  const enter = interpolate(frame, [0, 12], [0, 1], ease);
  const chapters = chaptersOf(timeline);
  const gap = chapters.length > 8 ? 6 : 10;
  return (
    <div style={{ position: "absolute", top: 140, left: X, width: W, opacity: enter, transform: `translateY(${(1 - enter) * -30}px)` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 20, fontFamily: fonts.mono, fontWeight: 700, letterSpacing: 4 }}>
        <span style={{ color: colors.text, fontSize: 28 }}>{episode.brand.name}</span>
        <span style={{ color: colors.dim, fontSize: 24 }}>{episode.brand.dateLabel}</span>
      </div>
      {chapters.length > 1 && (
        <div style={{ position: "absolute", top: RAIL_TOP - 140, left: 0, width: W, height: 8, display: "flex", gap }}>
          {chapters.map((c, i) => {
            const p = interpolate(frame, [c.from, c.to], [0, 1], clamp);
            const live = frame >= c.from && frame < c.to;
            return (
              <div key={i} style={{ flex: 1, height: "100%", borderRadius: 4, background: alpha(colors.text, 0.18), overflow: "hidden" }}>
                <div style={{ width: `${p * 100}%`, height: "100%", background: colors.accent, boxShadow: live ? `0 0 14px ${alpha(colors.accent, 0.7)}` : undefined }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** The long-Short scene set, used by Short.tsx for `"long": true` unless the theme's skin brings its own Short scenes. */
export const longShortScenes: NonNullable<Skin["short"]> = {
  ColdOpen: LongColdOpen,
  Segment: LongSegment,
  Text: LongText,
  TopBar: LongTopBar,
};
