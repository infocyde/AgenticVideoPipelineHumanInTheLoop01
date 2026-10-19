import { geoGraticule10, geoMercator, geoNaturalEarth1, geoPath } from "d3-geo";
import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { feature } from "topojson-client";
import topology from "world-atlas/countries-110m.json";
import { useTheme } from "../context";
import type { MapFocus, Pin } from "../schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const countries = (feature(topology as any, (topology as any).objects.countries) as any).features as {
  properties: { name: string };
}[];

type Bbox = [[number, number], [number, number]];

const widen = ([[w, s], [e, n]]: Bbox, k: number): Bbox => {
  const cx = (w + e) / 2;
  const cy = (s + n) / 2;
  const hw = ((e - w) / 2) * k;
  const hh = ((n - s) / 2) * k;
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

/** d3-geo world map: zooms in on `focus` from a widened box, pulsing pins, highlight/hostile tints. */
export const WorldMap: React.FC<{
  width: number;
  height: number;
  focus?: MapFocus; // omit for the full-world view
  allPins?: Pin[];
  zoomFrames?: number; // animate in from a wider view over this many frames
  pinDelay?: number;
  showLabels?: boolean;
  /** Draw the end state (zoomed, every pin popped), e.g. for a still. */
  settled?: boolean;
}> = ({ width, height, focus, allPins, zoomFrames = 36, pinDelay = 14, showLabels = true, settled = false }) => {
  const current = useCurrentFrame();
  const frame = settled ? current + 10_000 : current;
  const { map, fonts } = useTheme();
  const gradId = useMemo(() => `pinGlow${uid++}`, []);
  const t = interpolate(frame, [0, zoomFrames], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  const projection = useMemo(() => {
    if (!focus) {
      return geoNaturalEarth1().fitExtent(
        [
          [10, 10],
          [width - 10, height - 10],
        ],
        { type: "Sphere" },
      );
    }
    const [[w, s], [e, n]] = lerpBox(widen(focus.bbox, 2.6), focus.bbox, t);
    return geoMercator().fitExtent(
      [
        [20, 20],
        [width - 20, height - 20],
      ],
      { type: "MultiPoint", coordinates: [[w, s], [e, n], [w, n], [e, s]] },
    );
  }, [focus, t, width, height]);

  const path = geoPath(projection);
  const pins = focus?.pins ?? allPins ?? [];
  const highlight = new Set(focus?.highlight ?? []);
  const hostile = new Set(focus?.hostile ?? []);

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <radialGradient id={gradId}>
          <stop offset="0%" stopColor={map.pin} stopOpacity={0.9} />
          <stop offset="100%" stopColor={map.pin} stopOpacity={0} />
        </radialGradient>
      </defs>
      <path d={path(geoGraticule10()) ?? ""} fill="none" stroke={map.graticule} strokeWidth={1} />
      {countries.map((c, i) => {
        const name = c.properties.name;
        const isHi = highlight.has(name);
        const isHostile = hostile.has(name);
        return (
          <path
            key={i}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            d={path(c as any) ?? ""}
            fill={isHi ? map.highlightFill : isHostile ? map.hostileFill : map.land}
            stroke={isHi ? map.highlightStroke : isHostile ? map.hostileStroke : map.landEdge}
            strokeWidth={isHi ? 1.6 : 0.7}
          />
        );
      })}
      {pins.map((p, i) => {
        const xy = projection([p.lon, p.lat]);
        if (!xy) return null;
        const local = frame - pinDelay - i * 6;
        if (local < 0) return null;
        const pop = interpolate(local, [0, 8], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) });
        const ring = (local % 30) / 30;
        const flip = xy[0] > width - 170;
        return (
          <g key={i} transform={`translate(${xy[0]},${xy[1]})`}>
            <circle r={40 * pop} fill={`url(#${gradId})`} opacity={0.5} />
            <circle r={6 + ring * 34} fill="none" stroke={map.pin} strokeWidth={2} opacity={(1 - ring) * pop} />
            <circle r={7 * pop} fill={map.pin} stroke={map.pinStroke} strokeWidth={2} />
            {showLabels && (
              <text
                x={flip ? -14 : 14}
                textAnchor={flip ? "end" : "start"}
                y={-12}
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
