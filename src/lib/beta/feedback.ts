/**
 * Send feedback (22 Oct 2026): the beta's Tally form (TALLY_URL in src/config/betaConfig.ts), opened
 * with a reference for this device and the app version in its address, so feedback can be matched to
 * the beta's recordings and a build without asking anyone who they are. While TALLY_URL is empty every
 * feedback link is hidden.
 *
 * The reference (13 Nov 2026) is a keyed hash of the device's id, made by the server with its own secret
 * (feedback.functions.ts, FEEDBACK_HMAC_KEY): Joe can match it from the dashboard, the form never sees the id.
 */
import { APP_BUILD_ID } from "@/lib/appVersion";

import { betaValue } from "./betaValues";

/** A feedback reference: 32 lower-case hex digits (the first 128 bits of the keyed hash). */
export const FEEDBACK_REF = /^[0-9a-f]{32}$/;

/**
 * The form's address with `device` (the server's keyed reference for this device, left out until it's
 * known or when the server has no key) and `version` (the build id) as query parameters, which Tally
 * reads into hidden fields of the same names. Only a reference is ever added; anything else (a raw id
 * included) is left out. Null when there is no valid form address.
 */
export function feedbackUrl(
  base: string,
  deviceRef: string | null,
  version: string = APP_BUILD_ID,
): string | null {
  const trimmed = base.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (deviceRef && FEEDBACK_REF.test(deviceRef)) url.searchParams.set("device", deviceRef);
    url.searchParams.set("version", version);
    return url.toString();
  } catch {
    return null;
  }
}

/** The configured form, or null while TALLY_URL is empty (every feedback link hidden). */
export function feedbackBase(): string {
  return betaValue("TALLY_URL");
}
