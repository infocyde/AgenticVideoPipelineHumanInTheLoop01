// Dot-matrix world map: land drawn as a lattice of dots (an SVG pattern fill, so it costs no more than the plain map),
// highlighted countries in brighter cyan dots over a soft fill, hostile ones in magenta, pins as lime crosshairs with
// sonar rings. Same focus/zoom behavior and props as the shared WorldMap.
import { geoGraticule10, geoMercator, geoNaturalEarth1, geoPath } from "d3-geo";
import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { feature } from "topojson-client";
import topology from "world-atlas/countries-110m.json";
import { useTheme } from "../../context";
import type { MapFocus, Pin } from "../../schema";
import { F } from "./fx";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const countries = (feature(topology as any, (topology as any).objects.countries) as any).features as { properties: { name: string } }[];

type Bbox = [[number, number], [number, number]];
const widen = ([[w, s], [e, n]]: Bbox, k: number): Bbox => {
  const cx = (w + e) / 2, cy = (s + n) / 2, hw = ((e - w) / 2) * k, hh = ((n - s) / 2) * k;
  return [
    [Math.max(-179, cx - hw), Math.max(-75, cy - hh)],
    [Math.min(179, cx + hw), Math.min(80, cy + hh)],
  ];
};
const lerpBox = (a: Bbox, b: Bbox, t: number): Bbox => [
  [a[0][0] + (b[0][0] - a[0][0]) * t, a[0][1] + (b[0][1] - a[0][1]) * t],
  [a[1][0] + (b[1][0] - a[1][0]) * t, a[1][1] + (b[1][1] - a[1][1]) * t],
];

let uid = 0;

export const DotMap: React.FC<{
  width: number;
  height: number;
  focus?: MapFocus;
  allPins?: Pin[];
  zoomFrames?: number;
  pinDelay?: number;
  showLabels?: boolean;
  /** Dot pitch in px (smaller = finer lattice). */
  pitch?: number;
  settled?: boolean;
}> = ({ width, height, focus, allPins, zoomFrames = 36, pinDelay = 14, showLabels = true, pitch = 7, settled = false }) => {
  const current = useCurrentFrame();
  const frame = settled ? current + 10_000 : current;
  const { fonts, map } = useTheme();
  const id = useMemo(() => `dm${uid++}`, []);
  const t = interpolate(frame, [0, zoomFrames], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  const projection = useMemo(() => {
    if (!focus) return geoNaturalEarth1().fitExtent([[10, 10], [width - 10, height - 10]], { type: "Sphere" });
    const [[w, s], [e, n]] = lerpBox(widen(focus.bbox, 2.6), focus.bbox, t);
    return geoMercator().fitExtent([[20, 20], [width - 20, height - 20]], { type: "MultiPoint", coordinates: [[w, s], [e, n], [w, n], [e, s]] });
  }, [focus, t, width, height]);
  const path = geoPath(projection);
  const pins = focus?.pins ?? allPins ?? [];
  const highlight = new Set(focus?.highlight ?? []);
  const hostile = new Set(focus?.hostile ?? []);
  const r = pitch * 0.24;
  const dots = (pid: string, color: string, rad = r) => (
    <pattern id={pid} width={pitch} height={pitch} patternUnits="userSpaceOnUse">
      <circle cx={pitch / 2} cy={pitch / 2} r={rad} fill={color} />
    </pattern>
  );

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        {dots(`${id}l`, "rgba(150,166,255,0.42)")}
        {dots(`${id}h`, F.cyan, r * 1.35)}
        {dots(`${id}x`, F.magenta, r * 1.35)}
        <radialGradient id={`${id}g`}>
          <stop offset="0%" stopColor={F.lime} stopOpacity={0.8} />
          <stop offset="100%" stopColor={F.lime} stopOpacity={0} />
        </radialGradient>
      </defs>
      <path d={path(geoGraticule10()) ?? ""} fill="none" stroke={map.graticule} strokeWidth={1} />
      {countries.map((c, i) => {
        const name = c.properties.name;
        const hi = highlight.has(name), hx = hostile.has(name);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = path(c as any) ?? "";
        return (
          <g key={i}>
            {(hi || hx) && <path d={d} fill={hi ? "rgba(61,240,255,0.12)" : "rgba(255,79,216,0.12)"} stroke={hi ? F.cyan : F.magenta} strokeWidth={1.2} strokeOpacity={0.8} />}
            <path d={d} fill={`url(#${id}${hi ? "h" : hx ? "x" : "l"})`} stroke="none" />
          </g>
        );
      })}
      {pins.map((p, i) => {
        const xy = projection([p.lon, p.lat]);
        if (!xy) return null;
        const local = frame - pinDelay - i * 6;
        if (local < 0) return null;
        const pop = interpolate(local, [0, 8], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) });
        const ring = (local % 36) / 36;
        const flip = xy[0] > width - 190;
        const arm = 16 * pop;
        return (
          <g key={i} transform={`translate(${xy[0]},${xy[1]})`}>
            <circle r={38 * pop} fill={`url(#${id}g)`} opacity={0.45} />
            <circle r={8 + ring * 40} fill="none" stroke={F.lime} strokeWidth={1.6} opacity={(1 - ring) * pop} />
            <circle r={8 + ((ring + 0.5) % 1) * 40} fill="none" stroke={F.cyan} strokeWidth={1} opacity={(1 - ((ring + 0.5) % 1)) * pop * 0.6} />
            <path d={`M${-arm},0H${-5}M5,0H${arm}M0,${-arm}V-5M0,5V${arm}`} stroke={F.lime} strokeWidth={2} />
            <rect x={-3.5} y={-3.5} width={7} height={7} fill={F.lime} transform="rotate(45)" opacity={pop} />
            {showLabels && (
              <text
                x={flip ? -22 : 22}
                y={-14}
                textAnchor={flip ? "end" : "start"}
                fill={map.label}
                opacity={pop}
                style={{ font: `700 18px ${fonts.mono}`, letterSpacing: 2 }}
                paintOrder="stroke"
                stroke={map.labelHalo}
                strokeWidth={4}
              >
                {p.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};
