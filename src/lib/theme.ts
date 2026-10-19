/**
 * The page skin (polish-layout/theme.css, 19 Oct 2026, presentation only): the screens that carry
 * it and the self-hosted fonts the root route preloads. theme-check and no-wrap-check read these.
 */

/** The skin's fonts (public/fonts, SIL Open Font License), preloaded with the stylesheet. */
export const THEME_FONTS = [
  "/fonts/saira-600-800-latin.woff2",
  "/fonts/manrope-500-800-latin.woff2",
  "/fonts/jetbrains-mono-600-700-latin.woff2",
] as const;

/** The font families the skin's tokens name (--th-font-head, --th-font-body, --th-font-mono). */
export const THEME_FAMILIES = { head: "Saira", body: "Manrope", mono: "Duelz Mono" } as const;

/**
 * A skinned screen's background glows (data-skin): each tab screen its own, the room's screens
 * one quieter set.
 */
export type ThemeSkin = "play" | "practice" | "tournaments" | "profile" | "room";
