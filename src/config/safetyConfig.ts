/**
 * Safety switches (10 Nov 2026; docs/moderation.md "Bots").
 *
 * TURNSTILE_SITE_KEY: Cloudflare Turnstile's public site key (Cloudflare dashboard → Turnstile → the Joulz widget).
 * Empty: Turnstile is off everywhere and every screen behaves as today. Set it (in a PR) only once:
 *   1. the secret key is in the Worker (GitHub secret TURNSTILE_SECRET_KEY, deployed by deploy-cloudflare.yml), and
 *   2. AFTER that PR is live, Supabase's captcha protection is switched on with the same secret.
 * The order matters: with Supabase's captcha on and no site key here, phones can't make new guests.
 */
import { checkOverride } from "@/lib/checkOverride";

export const TURNSTILE_SITE_KEY = "0x4AAAAAAF7p4429yWwcQSDR";

/**
 * Cloudflare's published test site keys (1x… passes, 2x… blocks, 3x… forces a challenge): the only keys a browser
 * under automation may use, so checks never load the live widget.
 */
export function isTurnstileTestSiteKey(key: string): boolean {
  return /^[123]x0{20}[A-F]{2}$/.test(key);
}

/**
 * Turnstile is on for the phone when the site key is set (checks stand in through window.__DUELZ_TURNSTILE_SITE_KEY__).
 * Under automation (navigator.webdriver, the browser checks) only a check's test-key override counts; otherwise
 * Turnstile is off there. Real phones are unchanged.
 */
export function turnstileSiteKey(): string {
  if (typeof window !== "undefined") {
    const override = checkOverride("__DUELZ_TURNSTILE_SITE_KEY__");
    const automated = typeof navigator !== "undefined" && navigator.webdriver === true;
    if (automated) return typeof override === "string" && isTurnstileTestSiteKey(override) ? override : "";
    if (typeof override === "string") return override;
  }
  return TURNSTILE_SITE_KEY;
}
