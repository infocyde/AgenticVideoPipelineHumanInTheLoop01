// Theme registry. To add a theme, create a file like threat-brief.ts and list it here (and in ids.ts).
import { afterDark } from "./after-dark";
import { cleanLight } from "./clean-light";
import { military } from "./military";
import { militaryComparisons } from "./military-comparisons";
import { threatBrief } from "./threat-brief";
import type { ThemeId } from "./ids";
import type { Theme } from "./types";

export const themes: Record<ThemeId, Theme> = {
  "threat-brief": threatBrief,
  "clean-light": cleanLight,
  "after-dark": afterDark,
  military,
  "military-comparisons": militaryComparisons,
};
export const DEFAULT_THEME: ThemeId = "threat-brief";

export const getTheme = (id: string): Theme => themes[id as ThemeId] ?? themes[DEFAULT_THEME];

export { alpha } from "./types";
export type { Theme } from "./types";
export { layoutOf, type ThemeLayout } from "./ids";
