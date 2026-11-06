/**
 * The page skin (polish-layout/theme.css, 19 Oct 2026, presentation only): the screens that carry
 * it and the self-hosted fonts the root route preloads. theme-check and no-wrap-check read these.
 */

/**
 * The app's one font, Archivo (public/fonts, SIL Open Font License; @font-face in src/design/tokens.css),
 * preloaded with the stylesheet. Saira, Manrope and "Duelz Mono" were dropped in design foundation F1
 * (6 Nov 2026, DESIGN.md: one font).
 */
export const THEME_FONTS = ["/fonts/archivo-var-latin.woff2"] as const;

/** The tab screens' one family (data-app-page: headings, body, numbers, buttons). */
export const APP_PAGE_FAMILY = "Archivo";

/** The font families the skin's tokens name (--th-font-head, --th-font-body, --th-font-mono): Archivo, all three, since F1. */
export const THEME_FAMILIES = { head: APP_PAGE_FAMILY, body: APP_PAGE_FAMILY, mono: APP_PAGE_FAMILY } as const;

/**
 * A skinned screen's background glows (data-skin): each tab screen its own, the room's screens
 * one quieter set.
 */
export type ThemeSkin = "play" | "practice" | "tournaments" | "profile" | "room";
