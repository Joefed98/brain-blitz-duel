/**
 * When the phone asks for its safety notices (safety, 10 Nov 2026; docs/moderation.md): once per app open, on a tab
 * page (never over a round), only for a device that already has a session (asking never makes a guest), online.
 * A browser under automation (the repo's browser checks: each a fresh device with nothing on record) never asks unless
 * the page sets window.__DUELZ_ALLOW_SAFETY__, as the offline packs do.
 */

export const NOTICE_PATHS = ["/", "/practice", "/tournaments", "/profile"] as const;

export function noticesWanted(pathname: string, env: { webdriver?: boolean; allow?: boolean; online?: boolean } = {}): boolean {
  if (!(NOTICE_PATHS as readonly string[]).includes(pathname.replace(/\/+$/, "") || "/")) return false;
  if (env.online === false) return false;
  if (env.webdriver && !env.allow) return false;
  return true;
}

export interface SafetyNotices {
  ok: true;
  banned: boolean;
  /** The ban's plain notice (with the support address), or null. */
  bannedMessage: string | null;
  bannedUntil: string | null;
  mutedUntil: string | null;
  /** A warning to show once (then ackWarning), or null. */
  warning: string | null;
  /** A forced rename: the player must pick a new name; `tempName` is what they are called until then. */
  rename: { kind: "account" | "guest"; tempName: string | null } | null;
}
