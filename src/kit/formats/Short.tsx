// YouTube Shorts: the same timeline as an episode (hook beats + title, 1–3 scenes, outro), laid out for a vertical
// 1080×1920 frame. Text stays inside the area the Shorts interface leaves clear: nothing important in the top ~140px,
// the bottom ~400px (title, channel, music) or the right ~150px of the lower half (like/comment/share buttons).
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { MusicBed, SfxTrack, Voiceover } from "../components/Audio";
import { Backdrop, type BackdropVisual } from "../components/Backdrop";
import { Captions, GlitchCut, Grain } from "../components/Chrome";
import { fitLines, Headline, useFontsReady } from "../components/Headline";
import { IssuesOverlay } from "../components/IssuesOverlay";
import { SlamText, SubscribeCTA } from "../components/Titles";
import { WorldMap } from "../components/WorldMap";
import { clamp, useEpisode, useTheme } from "../context";
import { allPins, firstPins, type ResolvedSegment, type ResolvedText } from "../lib/resolve";
import { MAP_EXIT, segmentOffset, toFrame } from "../lib/timing";
import { CreditsCard } from "../scenes/CreditsCard";
import { EndCard } from "../scenes/EndCard";
import { SourcesCard } from "../scenes/SourcesCard";
import { useSkin } from "../skins";
import type { MapFocus } from "../schema";
import { alpha } from "../themes";

export const SHORT_WIDTH = 1080;
export const SHORT_HEIGHT = 1920;
const X = 70; // left margin
const TEXT_W = SHORT_WIDTH - 2 * X;
// Captions sit on a small paper pill in the bottom band (no wash over the picture).
const CAPTIONS = { left: X, right: 160, bottom: 470, fontSize: 68, panel: true };
/** Text panels: solid paper cards that carry legibility, so the b-roll needs no fades. */
const PANEL_W = TEXT_W - 90; // clear of the Shorts buttons on the right
const PANEL_PAD = 30;
const SHORT_VIGNETTE = 0.3;
const NOTE_SIZE = 26;
/** YouTube source tag (SourceTag): right, below the player's icons and beside the brand bar, wrapping before it. */
const TAG = { tagInset: X, tagTop: 150, tagSize: 20, tagMaxWidth: 560 };

/** A tall frame shows a small bounding box as one blob of country; zoom out around it so the region reads in context. */
const widen = (m: MapFocus, k = 2.2): MapFocus => {
  const [[w, s], [e, n]] = m.bbox;
  const cx = (w + e) / 2, cy = (s + n) / 2, hw = ((e - w) / 2) * k, hh = ((n - s) / 2) * k;
  return { ...m, bbox: [[Math.max(-180, cx - hw), Math.max(-85, cy - hh)], [Math.min(180, cx + hw), Math.min(85, cy + hh)]] };
};

/** Optional paper wash at the top and bottom (`fade` on a beat or segment); off by default, since text sits on panels. */
const Scrims: React.FC<{ strength?: number }> = ({ strength = 0 }) => {
  const { colors } = useTheme();
  if (strength <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity: strength }}>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${alpha(colors.bg, 0.88)} 0%, ${alpha(colors.bg, 0.55)} 30%, transparent 52%)` }} />
      <AbsoluteFill style={{ background: `linear-gradient(0deg, ${alpha(colors.bg, 0.92)} 0%, ${alpha(colors.bg, 0.6)} 26%, transparent 46%)` }} />
    </AbsoluteFill>
  );
};

/** Brand and date, top left (the top right belongs to the Shorts player's own icons). */
const Panel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  const { colors } = useTheme();
  return <div style={{ background: colors.panel, padding: PANEL_PAD, boxShadow: "0 12px 40px rgba(0,0,0,0.2)", ...style }}>{children}</div>;
};

const ShortTopBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, theme } = useEpisode();
  const { colors, fonts } = theme;
  const blink = Math.floor(frame / 15) % 2 === 0;
  const enter = interpolate(frame, [0, 12], [-80, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "absolute", top: 140, left: X, transform: `translateY(${enter}px)`, fontFamily: fonts.mono, letterSpacing: 4, background: colors.panel, padding: "12px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, color: colors.text, fontSize: 30, fontWeight: 700 }}>
        <div style={{ width: 16, height: 16, borderRadius: 8, background: colors.accent, opacity: blink ? 1 : 0.25, boxShadow: `0 0 16px ${colors.accent}` }} />
        {episode.brand.name}
      </div>
      <div style={{ marginTop: 6, marginLeft: 30, color: colors.dim, fontSize: 28 }}>{episode.brand.dateLabel}</div>
    </div>
  );
};

/** Big auto-fitting display text (stamps, title words). */
const useFit = (text: string, width: number, maxSize: number, minSize: number, maxLines: number) => {
  const { fonts } = useTheme();
  const ready = useFontsReady();
  return useMemo(
    () => (ready ? fitLines({ text, width, maxSize, minSize, maxLines, fontFamily: fonts.display, uppercase: true }) : null),
    [ready, text, width, maxSize, minSize, maxLines, fonts.display],
  );
};

const STAMP_TOP = { top: 330, center: 640, bottom: 1020 } as const;

/** Rubber stamp on a paper panel, wrapping to two lines if it must; `at` keeps it off the action. */
const VStamp: React.FC<{ text: string; sub?: string; at?: keyof typeof STAMP_TOP }> = ({ text, sub, at = "center" }) => {
  const frame = useCurrentFrame();
  const { colors, fonts, effects } = useTheme();
  const fit = useFit(text, PANEL_W - 150, 150, 84, 2);
  const s = interpolate(frame, [0, 6], [1.8, 1], { ...clamp, easing: Easing.out(Easing.exp) });
  const o = interpolate(frame, [0, 3], [0, 1], clamp);
  if (!fit) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: STAMP_TOP[at] }}>
      <div style={{ opacity: o, transform: `scale(${s}) rotate(-3deg)`, textAlign: "center", background: colors.panel, padding: "26px 34px", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
        <div
          style={{
            display: "inline-block",
            border: `7px solid ${colors.accent}`,
            padding: "12px 30px",
            fontFamily: fonts.display,
            fontSize: fit.size,
            lineHeight: 1,
            color: colors.accent,
            letterSpacing: 4,
            textShadow: effects.accentGlow(30),
          }}
        >
          {fit.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
        {sub && <div style={{ marginTop: 22, fontFamily: fonts.mono, fontWeight: 700, fontSize: 36, letterSpacing: 5, color: colors.text, maxWidth: PANEL_W }}>{sub}</div>}
      </div>
    </AbsoluteFill>
  );
};

/** Hook beats (stamp over b-roll, or the map with every pin), then the title card stacked vertically. */
const ShortColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useEpisode();
  const { colors, fonts, effects } = theme;
  const { beats, title, to } = timeline.coldOpen;
  const titleFrom = toFrame(title.start);
  const t = episode.coldOpen.title;
  const since = frame - toFrame(title.bigAt);
  const s = interpolate(since, [0, 6], [2.2, 1], { ...clamp, easing: Easing.out(Easing.exp) });
  const o = interpolate(since, [0, 3], [0, 1], clamp);
  const pre = interpolate(frame - titleFrom, [0, 8], [0, 1], clamp);
  const rule = interpolate(since, [10, 20], [0, 1], clamp);
  const smallLines = t.small.split("\n");
  return (
    <AbsoluteFill>
      {beats.map(({ beat, start, end, asset }, i) => {
        const from = toFrame(start);
        const dur = Math.max(1, Math.min(toFrame(end), titleFrom) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            {beat.map === "all-pins" ? (
              <AbsoluteFill style={{ background: colors.bg }}>
                <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                  <WorldMap width={SHORT_WIDTH} height={1300} allPins={firstPins(episode)} pinDelay={0} zoomFrames={1} showLabels={false} />
                </AbsoluteFill>
                <Sequence from={4} layout="none">
                  <VStamp text={`${beat.stamp}${beat.accent ? ` ${beat.accent}` : ""}`} sub={beat.sub} />
                </Sequence>
              </AbsoluteFill>
            ) : (
              <>
                {asset && <Backdrop visuals={[{ name: beat.visual!, asset, note: beat.note, from: 0 }]} durationInFrames={dur} seed={i} gradients={false} noteInset={X} noteSize={NOTE_SIZE} {...TAG} />}
                <Scrims strength={beat.fade ?? 0} />
                <Sequence from={4} layout="none">
                  <VStamp text={beat.stamp} sub={beat.sub} at={beat.stampAt} />
                </Sequence>
              </>
            )}
            {i > 0 && <GlitchCut seed={i * 5} />}
          </Sequence>
        );
      })}
      <Sequence from={titleFrom} durationInFrames={Math.max(1, to - titleFrom)}>
        <AbsoluteFill style={{ background: colors.bg, justifyContent: "center", alignItems: "center", paddingBottom: 200 }}>
          <div style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 40, letterSpacing: 12, color: colors.dim, opacity: pre }}>{t.kicker}</div>
          <div style={{ fontFamily: fonts.display, fontSize: t.big.length <= 2 ? 440 : t.big.length <= 4 ? 320 : 220, lineHeight: 1, color: colors.accent, opacity: o, transform: `scale(${s})`, textShadow: effects.accentGlow(90) }}>
            {t.big}
          </div>
          <div style={{ fontFamily: fonts.display, fontSize: 150, lineHeight: 0.95, color: colors.text, opacity: o, textAlign: "center" }}>
            {smallLines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
          <div style={{ marginTop: 26, height: 8, width: 700 * rule, background: colors.accent }} />
        </AbsoluteFill>
        <GlitchCut seed={beats.length * 5} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** A stat inside the segment panel: big value, rule, typed label (larger than the 16:9 card's label, for phones). */
const ShortStat: React.FC<{ value: string; label: string; since: number }> = ({ value, label, since }) => {
  const { colors, fonts } = useTheme();
  const scale = interpolate(since, [0, 6], [1.4, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const opacity = interpolate(since, [0, 3], [0, 1], clamp);
  const bar = interpolate(since, [2, 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const chars = Math.floor(interpolate(since, [4, 4 + label.length * 0.7], [0, label.length], clamp));
  return (
    <div style={{ marginTop: 24, opacity }}>
      <div style={{ fontFamily: fonts.display, fontSize: 112, lineHeight: 0.95, color: colors.highlight, transform: `scale(${scale})`, transformOrigin: "left center", whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ height: 6, width: 360 * bar, background: colors.accent, margin: "12px 0 10px" }} />
      <div style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 36, letterSpacing: 2, color: colors.text, textTransform: "uppercase", lineHeight: 1.2 }}>
        {label.slice(0, chars)}
        {chars < label.length && <span style={{ color: colors.accent }}>█</span>}
      </div>
    </div>
  );
};

/** One item: b-roll full height (after its map, if it has one), region, headline and the stats stacked below it. */
const ShortSegment: React.FC<{ s: ResolvedSegment }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { theme } = useEpisode();
  const { colors, fonts } = theme;
  const { seg } = s;
  const dur = s.to - s.from;
  const o = segmentOffset(false);
  const isTop = seg.emphasis === "top";
  const regionChars = Math.floor(interpolate(frame, [4, 4 + seg.region.length * 0.8], [0, seg.region.length], clamp));
  const headlineWipe = interpolate(frame, [8, 22], [100, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const statFrames = s.stats.map((st) => toFrame(st.at) - s.from);
  const activeStat = statFrames.reduce((acc, f, i) => (frame >= f ? i : acc), -1);
  const alarmPulse = isTop ? (Math.sin(frame / 4) + 1) / 2 : 0;
  // A segment with a map opens on it full height, then glitch-cuts to the b-roll (the "mapExit" sound lands here).
  const mapEnd = seg.map ? MAP_EXIT + o : 0;
  const visuals: BackdropVisual[] = s.visuals.flatMap((v, i) =>
    v.asset ? [{ name: v.name, asset: v.asset, note: v.note, grade: v.grade, from: i === 0 ? 0 : toFrame(v.at) - s.from }] : [],
  );
  // overlay: where the text panel sits ('none', or the older card: "none", hides it).
  const place = seg.overlay ?? (seg.card === "none" ? "none" : "top");
  const panelIn = interpolate(frame, [2, 10], [0, 1], clamp);
  // exitAt: the panel fades away at that cue and stays off (e.g. when a graphic needs the frame).
  const exitFrom = s.exitAt !== undefined ? toFrame(s.exitAt) - s.from : null;
  const panelOut = exitFrom === null ? 0 : interpolate(frame, [exitFrom, exitFrom + 10], [0, 1], clamp);

  return (
    <AbsoluteFill>
      {visuals.length ? <Backdrop visuals={visuals} durationInFrames={dur} seed={s.num * 3} gradients={false} noteInset={X} noteSize={NOTE_SIZE} {...TAG} /> : <AbsoluteFill style={{ background: colors.bg }} />}
      {seg.map && (!visuals.length || frame < mapEnd) && (
        <AbsoluteFill style={{ background: colors.bg, opacity: visuals.length ? 1 : 0.6 }}>
          <WorldMap width={SHORT_WIDTH} height={SHORT_HEIGHT} focus={widen(seg.map)} showLabels={!!visuals.length} />
        </AbsoluteFill>
      )}
      {seg.map && visuals.length > 0 && frame >= mapEnd && (
        <Sequence from={mapEnd} layout="none">
          <GlitchCut seed={s.num * 11} />
        </Sequence>
      )}
      <Scrims strength={seg.fade ?? 0} />
      {isTop && <AbsoluteFill style={{ boxShadow: `inset 0 0 ${80 + alarmPulse * 120}px ${colors.accent}${Math.round((0.35 + alarmPulse * 0.35) * 255).toString(16).padStart(2, "0")}` }} />}

      {place !== "none" && (
        <div style={{ position: "absolute", left: X, width: PANEL_W, opacity: panelIn * (1 - panelOut), ...(place === "bottom" ? { bottom: 660 } : { top: 285 }) }}>
          <Panel>
            {isTop && (
              <span style={{ display: "inline-block", marginBottom: 18, fontFamily: fonts.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: colors.onAccent, background: colors.accent, padding: "6px 14px", opacity: 0.6 + alarmPulse * 0.4 }}>
                {seg.emphasisLabel ?? theme.copy.topEmphasisLabel}
              </span>
            )}
            <div style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 38, letterSpacing: 5, color: colors.highlight }}>{seg.region.slice(0, regionChars)}</div>
            <Headline text={seg.headline} width={PANEL_W - 2 * PANEL_PAD} wipe={headlineWipe} maxSize={96} minSize={64} maxLines={3} />
            {activeStat >= 0 && <ShortStat key={activeStat} value={seg.stats[activeStat].value} label={seg.stats[activeStat].label} since={frame - statFrames[activeStat]} />}
          </Panel>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Text section: label, heading and body over its visuals (or the map). */
const ShortText: React.FC<{ t: ResolvedText }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { episode, theme } = useEpisode();
  const { colors, fonts, effects } = theme;
  const { seg } = t;
  const label = seg.label ?? "";
  const barIn = interpolate(frame, [4, 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const labelChars = Math.floor(interpolate(frame, [8, 8 + label.length * 0.8], [0, label.length], clamp));
  const wipe = interpolate(frame, [12, 26], [100, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const bodyIn = interpolate(frame, [24, 38], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const visuals: BackdropVisual[] = t.visuals.flatMap((v, i) => (v.asset ? [{ name: v.name, asset: v.asset, note: v.note, grade: v.grade, from: i === 0 ? 0 : toFrame(v.at) - t.from }] : []));
  return (
    <AbsoluteFill>
      {visuals.length ? (
        <Backdrop visuals={visuals} durationInFrames={t.to - t.from} seed={t.index * 5 + 1} gradients={false} noteInset={X} noteSize={NOTE_SIZE} {...TAG} />
      ) : (
        <AbsoluteFill style={{ background: colors.bg, justifyContent: "center", alignItems: "center", opacity: 0.5 }}>
          <WorldMap width={SHORT_WIDTH} height={1300} allPins={allPins(episode)} pinDelay={0} zoomFrames={1} showLabels={false} />
        </AbsoluteFill>
      )}
      <div style={{ position: "absolute", left: X, top: 285, width: PANEL_W, background: colors.panel, padding: PANEL_PAD, boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, height: 40 }}>
          <div style={{ width: 90 * barIn, height: 7, background: colors.accent, boxShadow: effects.accentGlow(16) }} />
          {label && <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 32, letterSpacing: 6, color: colors.accent, textTransform: "uppercase" }}>{label.slice(0, labelChars)}</span>}
        </div>
        <Headline text={seg.heading} width={PANEL_W - 2 * PANEL_PAD} wipe={wipe} maxSize={96} minSize={64} maxLines={4} />
        {seg.body && (
          <div
            style={{
              marginTop: 30,
              paddingLeft: 26,
              borderLeft: `5px solid ${colors.highlight}`,
              fontFamily: fonts.body,
              fontWeight: 600,
              fontSize: 42,
              lineHeight: 1.3,
              color: colors.text,
              textShadow: effects.textShadow,
              opacity: bodyIn,
              transform: `translateY(${(1 - bodyIn) * 24}px)`,
            }}
          >
            {seg.body}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** Outro lines slam in centered; the last one stays with the CTA ("full video on the channel") under it. */
const ShortOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode, timeline, theme } = useEpisode();
  const { colors, effects, copy } = theme;
  const { from, lines, cta } = timeline.outro;
  const at = lines.map((l) => toFrame(l.at) - from);
  const ctaAt = cta ? toFrame(cta.at) - from : null;
  const last = lines.length - 1;
  const pins = allPins(episode);
  return (
    <AbsoluteFill style={{ background: colors.bg }}>
      {pins.length > 0 && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 0.7 }}>
          <WorldMap width={SHORT_WIDTH} height={1300} allPins={pins} pinDelay={0} zoomFrames={1} showLabels={false} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: effects.outroScrim }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 260 }}>
        <div style={{ width: TEXT_W, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          {lines.map(({ line }, i) => {
            if (frame < at[i]) return null;
            if (i < last) {
              const out = interpolate(frame, [at[i + 1] - 4, at[i + 1]], [1, 0], clamp);
              if (out <= 0) return null;
              return (
                <div key={i} style={{ opacity: out, position: "absolute", width: TEXT_W }}>
                  <SlamText since={frame - at[i]} size={120} text={line.text} accent={line.accent} />
                </div>
              );
            }
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <SlamText since={frame - at[i]} size={lines.length > 1 ? 150 : 130} text={line.text} accent={line.accent} />
                {ctaAt !== null && frame >= ctaAt && (
                  <SubscribeCTA since={frame - ctaAt} label={cta?.label ?? episode.outro.cta?.label ?? copy.ctaLabel} doneLabel={copy.ctaDoneLabel} />
                )}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** The vertical timeline: same scenes, chrome and audio as an episode, without the ticker. */
export const Short: React.FC = () => {
  const { timeline, theme } = useEpisode();
  const { coldOpen, segments, texts, outro, sourcesCard, creditsCard, endScreen } = timeline;
  const skin = useSkin();
  const v = skin.short ?? {};
  const Open = v.ColdOpen ?? ShortColdOpen;
  const Seg = v.Segment ?? ShortSegment;
  const Text = v.Text ?? ShortText;
  const OutroScene = v.Outro ?? ShortOutro;
  const Bar = v.TopBar ?? ShortTopBar;
  const Caps = v.Captions ?? Captions;
  const finish = skin.Finish ? <skin.Finish /> : <Grain vignette={SHORT_VIGNETTE} />;
  const End = skin.EndCard ?? EndCard;
  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      <Sequence durationInFrames={Math.max(1, coldOpen.to)}>
        <Open />
      </Sequence>
      {segments.map((s) => (
        <Sequence key={s.index} from={s.from} durationInFrames={Math.max(1, s.to - s.from)}>
          <Seg s={s} />
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
      {finish}
      <Sequence durationInFrames={outro.to} layout="none">
        <Bar />
      </Sequence>
      <Caps box={CAPTIONS} />
      <IssuesOverlay />
      <Voiceover />
      <MusicBed />
      <SfxTrack />
    </AbsoluteFill>
  );
};
