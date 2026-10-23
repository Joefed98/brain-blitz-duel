/**
 * Send feedback (22 Oct 2026): the beta's Tally form (TALLY_URL in src/config/betaConfig.ts), opened
 * with this device's anonymous id and the app version in its address, so feedback can be matched to
 * the beta's recordings and a build without asking anyone who they are. While TALLY_URL is empty every
 * feedback link is hidden.
 */
import { APP_BUILD_ID } from "@/lib/appVersion";

import { betaValue } from "./betaValues";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The form's address with `device` (the anonymous sign-in id every device has, session.ts; left out
 * until it's known) and `version` (the build id) as query parameters, which Tally reads into hidden
 * fields of the same names. Null when there is no valid form address.
 */
export function feedbackUrl(
  base: string,
  deviceId: string | null,
  version: string = APP_BUILD_ID,
): string | null {
  const trimmed = base.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (deviceId && UUID.test(deviceId)) url.searchParams.set("device", deviceId);
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
