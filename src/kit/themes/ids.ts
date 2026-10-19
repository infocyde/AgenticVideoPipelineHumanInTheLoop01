// Theme ids, importable from Node scripts (the theme modules themselves load web fonts).
// Keep in sync with the registry in index.ts; TypeScript enforces it.
export const THEME_IDS = ["threat-brief", "clean-light", "after-dark", "military", "military-comparisons", "erotic"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

/**
 * How a theme lays out a numbered segment:
 * - "overlay": full-bleed b-roll, text block over it on the left, locator map card on the right.
 * - "split": b-roll framed on the left, headline and a building spec sheet of stats on the right, map card over the left.
 */
export type ThemeLayout = "overlay" | "split";
export const THEME_LAYOUT: Record<ThemeId, ThemeLayout> = {
  "threat-brief": "overlay",
  "clean-light": "overlay",
  "after-dark": "overlay",
  military: "overlay",
  "military-comparisons": "split",
  erotic: "split",
};
export const layoutOf = (id: string): ThemeLayout => THEME_LAYOUT[id as ThemeId] ?? "overlay";
