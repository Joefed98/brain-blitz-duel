import { APP_URL } from "../config/appUrl";

/**
 * The app's public name and pitch: "Joulz" since the beta (22 Oct 2026; "Duelz" before). Renaming
 * the app is a one-line change to APP_NAME (plus public/manifest.webmanifest, which is static JSON;
 * brand-copy-check fails until the two agree). Only what players see reads it: internal names
 * (storage keys "duelz…", the build id, the "Duelz Mono" font family, tables, the repo) keep the old
 * name so nothing stored on a phone is lost. Copy stays neutral on player and round counts because
 * rooms take 2–16 players and 1–7 rounds.
 */
export const APP_NAME = "Joulz";
export const APP_TAGLINE = "Play skill games live with friends.";
export const APP_DESCRIPTION = `${APP_TAGLINE} Everyone plays the same games at the same moment, and the highest score wins.`;
export const APP_TITLE = `${APP_NAME} — Live skill games with friends`;
/** The published site (APP_URL, src/config/appUrl.ts); link previews need absolute URLs. */
export { APP_URL };
/** A page's canonical address: its path on APP_URL, with no query string or hash. */
export function canonicalUrl(pathname: string): string {
  const path = `/${pathname.split(/[?#]/)[0]!.replace(/^\/+/, "")}`;
  return `${APP_URL}${path}`;
}
/**
 * The link preview (Open Graph and Twitter card, Prompt Q, 23 Oct 2026): what a shared link shows in
 * Messages, WhatsApp and the like. The 1200 × 630 image (public/og-image.png: the one wordmark, JOULZ
 * and the --jz-gold bolt, on --jz-bg, the line below in --jz-text-3; design foundation F4) is drawn
 * once by `bun scripts/og-image.ts`.
 */
export const LINK_PREVIEW = {
  title: APP_NAME,
  description: "Live brain games with friends. Same games, same moment, highest score wins.",
  url: `${APP_URL}/`,
  image: `${APP_URL}/og-image.png`,
  imageWidth: 1200,
  imageHeight: 630,
  imageAlt: `${APP_NAME}: the ${APP_NAME.toUpperCase()} wordmark and the gold lightning mark`,
} as const;
/**
 * The solve burst's logo (src/lib/fx/signature.ts): since design foundation F4 (6 Nov 2026) the current
 * bolt in the ring-gold metal (--jz-gold-metal) on --jz-bg, 512 px, drawn by scripts/brand-icons.ts
 * (the burst rounds its corners and lights it gold).
 */
export const APP_LOGO_URL = "/icon-512.png";
/**
 * The app's own icons (Prompt R, 23 Oct 2026; design foundation F4, 6 Nov 2026): the black logo mark
 * on the ring-gold metal (--jz-gold-metal), drawn by scripts/brand-icons.ts. The home-screen icon, the
 * manifest's icons and the browser tab's favicon; the burst keeps APP_LOGO_URL. `mark` is the mark's
 * height as a share of the icon.
 */
export const APP_ICONS = [
  { href: "/app-icon-180.png", size: 180, bleed: true, mark: 0.58, use: "apple-touch-icon" },
  { href: "/app-icon-192.png", size: 192, bleed: false, mark: 0.58, use: "any" },
  { href: "/app-icon-512.png", size: 512, bleed: false, mark: 0.58, use: "any" },
  { href: "/app-icon-maskable-512.png", size: 512, bleed: true, mark: 0.46, use: "maskable" },
  { href: "/favicon-32.png", size: 32, bleed: false, mark: 0.66, use: "favicon" },
  { href: "/favicon-16.png", size: 16, bleed: false, mark: 0.7, use: "favicon" },
] as const;
/**
 * The iPhone home-screen app's launch screens (apple-touch-startup-image, design foundation F4, 6 Nov
 * 2026): the gold bolt centred on --jz-bg, no text, one portrait PNG per current iPhone screen (CSS
 * points × the pixel ratio), drawn by scripts/brand-icons.ts and linked from the root route's head with
 * a media query that only that screen matches. iOS shows nothing (the manifest's background colour)
 * on a screen without one. `mark` is the bolt's height as a share of the screen's width.
 */
export const APP_SPLASH_MARK = 0.3;
export const APP_SPLASHES = [
  { w: 375, h: 667, dpr: 2 }, // iPhone SE (2nd and 3rd generation), 8
  { w: 414, h: 896, dpr: 2 }, // iPhone 11, XR
  { w: 375, h: 812, dpr: 3 }, // iPhone X, XS, 11 Pro, 12 mini, 13 mini
  { w: 414, h: 896, dpr: 3 }, // iPhone XS Max, 11 Pro Max
  { w: 390, h: 844, dpr: 3 }, // iPhone 12, 13, 14, 12 Pro, 13 Pro, 16e
  { w: 428, h: 926, dpr: 3 }, // iPhone 12 Pro Max, 13 Pro Max, 14 Plus
  { w: 393, h: 852, dpr: 3 }, // iPhone 14 Pro, 15, 15 Pro, 16
  { w: 430, h: 932, dpr: 3 }, // iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  { w: 402, h: 874, dpr: 3 }, // iPhone 16 Pro, 17, 17 Pro
  { w: 440, h: 956, dpr: 3 }, // iPhone 16 Pro Max, 17 Pro Max
  { w: 420, h: 912, dpr: 3 }, // iPhone Air
].map((s) => ({
  ...s,
  href: `/splash/splash-${s.w * s.dpr}x${s.h * s.dpr}.png`,
  media: `(device-width: ${s.w}px) and (device-height: ${s.h}px) and (-webkit-device-pixel-ratio: ${s.dpr}) and (orientation: portrait)`,
}));
/**
 * High Rise's flag (skyline.renderer.ts) draws the app's own icon, the manifest's 512 px one, so the flag and
 * the home-screen icon are the same logo (arcade-tuning-a-check). The solve burst keeps APP_LOGO_URL.
 */
export const APP_FLAG_LOGO_URL: string = APP_ICONS.find((icon) => icon.use === "any" && icon.size === 512)!.href;
/**
 * Player icons (src/components/duel/playerIcons.tsx): the one switch for the whole feature. Off,
 * everyone shows their initial in their colour and the lobby hides the icon picker; stored icons
 * are kept, just not drawn. Colours are not affected.
 */
export const PLAYER_ICONS_ENABLED = true;
