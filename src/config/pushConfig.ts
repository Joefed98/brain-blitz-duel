import { checkOverride } from "@/lib/checkOverride";

/**
 * Phone notifications (wave 2 train B, session B2, 11 Nov 2026; docs/push-notifications.md).
 *
 * PUSH_PUBLIC_KEY: Joulz's own VAPID public key (base64url, 87 characters: the uncompressed P-256 point). It is a public
 * value, safe in the phone's bundle. Empty: notifications are off everywhere: nothing asks, nothing subscribes, the
 * settings show no Notifications panel and the server sends nothing. Set it (in a PR) only once the matching private
 * key is in the Worker as the secret VAPID_PRIVATE_KEY (GitHub secret of the same name, deployed by
 * deploy-cloudflare.yml). `bun scripts/push-vapid-keys.ts` makes the pair; the doc has the steps.
 */
export const PUSH_PUBLIC_KEY = "";

/** The VAPID subject: who the push services may contact about our pushes (a URL of ours, no personal address). */
export const PUSH_SUBJECT = "https://joulz.uk";

/**
 * Whether notifications are on for the phone: the public key is set. Checks stand in through
 * window.__DUELZ_PUSH_PUBLIC_KEY__ (read through checkOverride, src/lib/checkOverride.ts), but never in production: a production build replaces `import.meta.env.PROD` with true,
 * so the first statement returns the setting before any override is read, and the rest is dropped from the bundle (as
 * shopSwitch.ts and badgesApi.ts do). push-notifications-check fails if that guard moves. Under automation
 * (navigator.webdriver, the browser checks) notifications are off unless a check sets the override.
 */
export function pushPublicKey(): string {
  // Plain import.meta.env.PROD so Vite replaces it with true in a production build.
  if (import.meta.env.PROD) return PUSH_PUBLIC_KEY;
  if (typeof window !== "undefined") {
    const override = checkOverride("__DUELZ_PUSH_PUBLIC_KEY__");
    const automated = typeof navigator !== "undefined" && navigator.webdriver === true;
    if (typeof override === "string") return override;
    if (automated) return "";
  }
  return PUSH_PUBLIC_KEY;
}
