// Skin registry: themes that bring their own scenes (see types.ts). A theme without a skin uses the shared scenes.
import { useEpisode } from "../context";
import type { ThemeId } from "../themes/ids";
import { frontierSkin } from "./frontier";
import type { Skin } from "./types";

const skins: Partial<Record<ThemeId, Skin>> = {
  frontier: frontierSkin,
};

const NONE: Skin = {};
export const getSkin = (themeId: string): Skin => skins[themeId as ThemeId] ?? NONE;
export const useSkin = (): Skin => getSkin(useEpisode().theme.id);

export type { Skin } from "./types";
