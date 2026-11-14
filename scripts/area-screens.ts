/**
 * The page areas' screens, found automatically (check plumbing, 14 Nov 2026, approved by Joe): theme-check and
 * no-wrap-check draw the core list (THEME_SCREENS in scripts/theme-screens.ts, which ends at APPEARANCE_SCREENS and
 * never grows again) followed by every area file in scripts/screens/, in file-name order.
 *
 * The one shape: an area file is `scripts/screens/<area>.ts` with a default export, a function taking no arguments
 * and returning that area's ThemeScreen[]:
 *
 *   export default function shopScreens(): ThemeScreen[] { … }
 *
 * Helper files that hold no screens end in `-fixture.ts` (e.g. scripts/screens/profile-fixture.ts) and are skipped.
 * Any other file without that default export fails loudly here, so a new area can't be silently left out.
 *
 * A new area adds only its own file: nobody edits THEME_SCREENS or the theme / no-wrap parts in .github/ci/shards.ts.
 */
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { THEME_SCREENS, VIEWPORTS, themeDraws, type ThemeScreen, type ThemeViewport } from "./theme-screens";

export const AREA_DIR = join("scripts", "screens");

/** The area files (not the `-fixture.ts` helpers), sorted by file name: the order their screens are drawn in. */
export function areaFiles(dir: string = AREA_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => /\.tsx?$/.test(f) && !/-fixture\.tsx?$/.test(f))
    .sort();
}

/** Every area's screens, file by file in areaFiles() order. */
export async function areaScreens(dir: string = AREA_DIR): Promise<{ file: string; screens: ThemeScreen[] }[]> {
  const out: { file: string; screens: ThemeScreen[] }[] = [];
  for (const file of areaFiles(dir)) {
    const mod = (await import(pathToFileURL(resolve(dir, file)).href)) as { default?: unknown };
    if (typeof mod.default !== "function")
      throw new Error(
        `${join(dir, file)}: an area screen file must default-export a function returning its ThemeScreen[] ` +
          `(helpers that hold no screens end in -fixture.ts); see scripts/area-screens.ts`,
      );
    const screens = (mod.default as () => unknown)();
    if (!Array.isArray(screens) || screens.some((s) => !s || typeof (s as ThemeScreen).name !== "string"))
      throw new Error(`${join(dir, file)}: its default export must return ThemeScreen[]`);
    out.push({ file, screens: screens as ThemeScreen[] });
  }
  return out;
}

/** Every screen theme-check and no-wrap-check draw: the core list, then every area's. */
export async function allThemeScreens(): Promise<ThemeScreen[]> {
  return [...THEME_SCREENS, ...(await areaScreens()).flatMap((a) => a.screens)];
}

/**
 * The light theme (2b, 14 Nov 2026): every screen again in light, one size each, drawn by theme-check after every
 * other draw. Screens that already set a theme are left out (they are drawn as they are), and the extra sizes are
 * dropped (the light tokens don't depend on the size).
 */
export function lightScreens(screens: ThemeScreen[]): ThemeScreen[] {
  return screens
    .filter((s) => !(s.globals && "__harnessTheme" in s.globals))
    .map((s) => {
      const { sizes: _sizes, ...rest } = s;
      return { ...rest, name: `light: ${s.name}`, globals: { ...(s.globals ?? {}), __harnessTheme: "light" } };
    });
}

export type Draw = { screen: ThemeScreen; viewport: ThemeViewport };

/** theme-check's draws: the dark screens at the first viewport, then their extra sizes, then the light screens. */
export function themeCheckDraws(screens: ThemeScreen[], viewport: ThemeViewport = VIEWPORTS[0]!): Draw[] {
  const dark = screens.filter((s) => !s.name.startsWith("light: "));
  const light = screens.filter((s) => s.name.startsWith("light: "));
  return [
    ...dark.map((screen) => ({ screen, viewport })),
    ...dark.flatMap((screen) => (screen.sizes ?? []).map((v) => ({ screen, viewport: v }))),
    ...light.map((screen) => ({ screen, viewport })),
  ];
}

/** Every theme-check draw of a whole run (dark and light). The intro colours run once more, in part 1. */
export async function allThemeCheckDraws(): Promise<Draw[]> {
  const screens = await allThemeScreens();
  return themeCheckDraws([...screens, ...lightScreens(screens)]);
}

/** Every no-wrap-check draw of a whole run: each screen at VIEWPORTS, then the extra sizes. */
export async function allNoWrapDraws(): Promise<Draw[]> {
  return themeDraws(await allThemeScreens(), VIEWPORTS);
}
