/**
 * The one wordmark (design foundation F4, 6 Nov 2026): APP_NAME uppercased in Archivo 900 at 118 %
 * width, every letter white, then the gold bolt (LogoMark, --jz-gold). The app header draws it in CSS
 * (AppWordmark, polish-layout/app-pages.css .ap-wordmark); the share card draws it on a canvas, which
 * can't set a width axis, so it uses WORDMARK_FAMILY, a face of the app's own Archivo file pinned to
 * that weight and width (a variable font is drawn at the face's single width, clamped to it).
 * scripts/og-image.ts draws it with the same numbers. Both shapes come from logoGeometry.ts.
 */
import { APP_NAME } from "@/lib/brand";

export const WORDMARK_TEXT = APP_NAME.toUpperCase();
export const WORDMARK_WEIGHT = 900;
/** Archivo's width axis, percent. */
export const WORDMARK_STRETCH = 118;
/** The header's proportions: the bolt as tall as the font size, the gap between them 6 / 22 of it. */
export const WORDMARK_MARK_EM = 1;
export const WORDMARK_GAP_EM = 6 / 22;
export const WORDMARK_LETTER_SPACING_EM = 0.01;
/** The canvas face (see above). */
export const WORDMARK_FAMILY = "Joulz Wordmark";
const WORDMARK_FONT_URL = "/fonts/archivo-var-latin.woff2";

let loading: Promise<boolean> | null = null;

/** Adds WORDMARK_FAMILY to the page's fonts once; resolves false where it can't (the canvas then falls back to Archivo 900). */
export function loadWordmarkFace(): Promise<boolean> {
  if (typeof document === "undefined" || typeof FontFace === "undefined" || !document.fonts) return Promise.resolve(false);
  loading ??= (async () => {
    try {
      const face = new FontFace(WORDMARK_FAMILY, `url(${WORDMARK_FONT_URL}) format("woff2")`, {
        weight: String(WORDMARK_WEIGHT),
        stretch: `${WORDMARK_STRETCH}%`,
      });
      await face.load();
      document.fonts.add(face);
      return true;
    } catch {
      loading = null;
      return false;
    }
  })();
  return loading;
}

/** The canvas font for the wordmark at `px`. */
export function wordmarkCanvasFont(px: number): string {
  return `${WORDMARK_WEIGHT} ${px}px "${WORDMARK_FAMILY}", "Archivo", system-ui, sans-serif`;
}
