/**
 * The page skin (polish-layout/theme.css, 19 Oct 2026, presentation only): the screens that carry
 * it and the self-hosted fonts the root route preloads. theme-check and no-wrap-check read these.
 */

/**
 * The app's one font, Archivo (public/fonts, SIL Open Font License; @font-face in src/design/tokens.css),
 * preloaded with the stylesheet (DESIGN.md: one font).
 */
export const THEME_FONTS = ["/fonts/archivo-var-latin.woff2"] as const;

/** The tab screens' one family (data-app-page: headings, body, numbers, buttons). */
export const APP_PAGE_FAMILY = "Archivo";

/** The skin's head, body and number faces: Archivo, all three (one font; the --th-* aliases were retired in S1, 27 Nov 2026). */
export const THEME_FAMILIES = { head: APP_PAGE_FAMILY, body: APP_PAGE_FAMILY, mono: APP_PAGE_FAMILY } as const;

/**
 * A skinned screen's background glows (data-skin): each tab screen its own, the room's screens
 * one quieter set.
 */
export type ThemeSkin = "play" | "practice" | "tournaments" | "shop" | "profile" | "room";
