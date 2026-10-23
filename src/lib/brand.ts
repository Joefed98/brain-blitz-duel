/**
 * The app's public name and pitch: "Joulz" since the beta (22 Oct 2026; "Duelz" before). Renaming
 * the app is a one-line change to APP_NAME (plus public/manifest.webmanifest, which is static JSON;
 * brand-copy-check fails until the two agree). Only what players see reads it: internal names
 * (storage keys "duelz…", the build id, the "Duelz Mono" font family, tables, the repo) keep the old
 * name so nothing stored on a phone is lost. Copy stays neutral on player and round counts because
 * rooms take 2–10 players and 1–7 rounds.
 */
export const APP_NAME = "Joulz";
export const APP_TAGLINE = "Play skill games live with friends.";
export const APP_DESCRIPTION = `${APP_TAGLINE} Everyone plays the same games at the same moment, and the highest score wins.`;
export const APP_TITLE = `${APP_NAME} — Live skill games with friends`;
/**
 * The app logo (black square, yellow lightning bolt): the PWA icon, the touch icon and
 * the High Rise flag all draw this one file, so a new logo needs only a new file here.
 */
export const APP_LOGO_URL = "/icon-512.png";
/**
 * The app's own icons (Prompt R, 23 Oct 2026): the inverted logo mark on the gold shine, drawn by
 * scripts/brand-icons.ts. The home-screen icon, the manifest's icons and the browser tab's favicon;
 * the in-game flag and burst keep APP_LOGO_URL. `mark` is the mark's height as a share of the icon.
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
 * Player icons (src/components/duel/playerIcons.tsx): the one switch for the whole feature. Off,
 * everyone shows their initial in their colour and the lobby hides the icon picker; stored icons
 * are kept, just not drawn. Colours are not affected.
 */
export const PLAYER_ICONS_ENABLED = true;
