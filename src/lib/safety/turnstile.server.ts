/**
 * Cloudflare Turnstile, verified on the server (safety, 10 Nov 2026; docs/moderation.md "Bots"). Used on account
 * sign-up's last step (completeSignUpFn), where the account is made. Guest creation (Supabase anonymous sign-in) and
 * sign-in emails are verified by Supabase Auth's own captcha protection, with the same secret.
 *
 * On when the site key (src/config/safetyConfig.ts) and the Worker secret TURNSTILE_SECRET_KEY are both set. With the
 * site key set but no secret, it logs a warning and allows, so a missing secret never locks sign-ups.
 *
 * Cloudflare's published test keys (used by moderation-check): secret 1x0000000000000000000000000000000AA always
 * passes, 2x0000000000000000000000000000000AA always fails, 3x0000000000000000000000000000000AA answers "token
 * already spent"; site keys 1x00000000000000000000BB (invisible, passes) and 2x00000000000000000000BB (invisible,
 * blocks); any token with a test secret, e.g. XXXX.DUMMY.TOKEN.XXXX.
 */

import { TURNSTILE_SITE_KEY } from "@/config/safetyConfig";

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * The server's view of the switch: the site key from safetyConfig.ts, or (checks only) the TURNSTILE_SITE_KEY env;
 * siteverify's address, or (checks only) TURNSTILE_VERIFY_URL, a local stand-in answering as Cloudflare does for its
 * test secrets.
 */
function serverSiteKey(): string {
  return TURNSTILE_SITE_KEY || process.env["TURNSTILE_SITE_KEY"] || "";
}
function verifyUrl(): string {
  return process.env["TURNSTILE_VERIFY_URL"] || TURNSTILE_VERIFY_URL;
}

/** The message a refused sign-up shows. */
export const TURNSTILE_REFUSED_MESSAGE = "We couldn’t check this device. Refresh the page and try again.";

export interface TurnstileOptions {
  /** The secret (default: the Worker's TURNSTILE_SECRET_KEY). */
  secret?: string | undefined;
  /** The site key (default: safetyConfig's). */
  siteKey?: string | undefined;
  /** The caller's address, sent to Cloudflare as remoteip (never stored). */
  remoteIp?: string | null | undefined;
  /** The fetch to use (checks pass a stand-in). */
  fetchImpl?: typeof fetch;
}

/** Whether the server check is on. */
export function turnstileOn(options: Pick<TurnstileOptions, "secret" | "siteKey"> = {}): boolean {
  const siteKey = options.siteKey ?? serverSiteKey();
  const secret = options.secret ?? process.env["TURNSTILE_SECRET_KEY"] ?? "";
  if (siteKey && !secret) console.warn("[turnstile] site key set but TURNSTILE_SECRET_KEY missing (allowed)");
  return Boolean(siteKey && secret);
}

/** True when the token passes (or the check is off). Never throws; a network failure refuses. */
export async function verifyTurnstile(token: unknown, options: TurnstileOptions = {}): Promise<boolean> {
  if (!turnstileOn(options)) return true;
  const secret = options.secret ?? process.env["TURNSTILE_SECRET_KEY"] ?? "";
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (options.remoteIp) body.set("remoteip", options.remoteIp);
  try {
    const res = await (options.fetchImpl ?? fetch)(verifyUrl(), {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { success?: unknown };
    return json.success === true;
  } catch (err) {
    console.warn(`[turnstile] verify failed: ${err instanceof Error ? err.message : String(err)} (refused)`);
    return false;
  }
}
