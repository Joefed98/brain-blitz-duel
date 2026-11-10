/**
 * Safety switches (10 Nov 2026; docs/moderation.md "Bots").
 *
 * TURNSTILE_SITE_KEY: Cloudflare Turnstile's public site key (Cloudflare dashboard → Turnstile → the Joulz widget).
 * Empty: Turnstile is off everywhere and every screen behaves as today. Set it (in a PR) only once:
 *   1. the secret key is in the Worker (GitHub secret TURNSTILE_SECRET_KEY, deployed by deploy-cloudflare.yml), and
 *   2. AFTER that PR is live, Supabase's captcha protection is switched on with the same secret.
 * The order matters: with Supabase's captcha on and no site key here, phones can't make new guests.
 */
export const TURNSTILE_SITE_KEY = "";

/** Turnstile is on for the phone when the site key is set (checks stand in through window.__DUELZ_TURNSTILE_SITE_KEY__). */
export function turnstileSiteKey(): string {
  if (typeof window !== "undefined") {
    const override = (window as unknown as { __DUELZ_TURNSTILE_SITE_KEY__?: unknown }).__DUELZ_TURNSTILE_SITE_KEY__;
    if (typeof override === "string") return override;
  }
  return TURNSTILE_SITE_KEY;
}
