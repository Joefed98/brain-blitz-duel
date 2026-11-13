/**
 * The content security policy, trialled report-only (13 Nov 2026; docs/security/csp-trial.md). Production responses
 * carry `Content-Security-Policy-Report-Only` with this policy and `Reporting-Endpoints` naming /csp-report, so
 * browsers report what the policy would refuse and refuse nothing. The enforced header stays frame-ancestors only
 * (securityHeaders.ts).
 *
 * The two inline boot scripts in the root's <head> (PLAY_CARDS_BOOT, OFFLINE_BOOT) are allowed by their SHA-256
 * hashes. The per-request hydration scripts TanStack Start writes are left out on purpose: the trial's reports show
 * what they need (a nonce, or 'unsafe-inline') before anything is enforced.
 */
import { OFFLINE_BOOT } from "@/lib/offline/online";
import { PLAY_CARDS_BOOT } from "@/lib/playCards";

/** The path browsers send reports to (src/server.ts answers it). */
export const CSP_REPORT_PATH = "/csp-report";
/** The Reporting API group the policy's report-to names. */
export const CSP_REPORT_GROUP = "csp";

/** Cloudflare Turnstile (src/lib/safety/turnstile.ts): its script, its frame and its calls. */
const TURNSTILE = "https://challenges.cloudflare.com";
const FONT_CSS = "https://fonts.googleapis.com";
const FONT_FILES = "https://fonts.gstatic.com";

/** The inline scripts the policy allows by hash, in the order the root writes them. */
export const INLINE_BOOT_SCRIPTS: readonly string[] = [PLAY_CARDS_BOOT, OFFLINE_BOOT];

/** CSP's hash source for one inline script: 'sha256-<base64 of the SHA-256 of its text>'. */
export async function scriptHash(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  let binary = "";
  for (const b of digest) binary += String.fromCharCode(b);
  return `'sha256-${btoa(binary)}'`;
}

/** The Supabase project's origins (https and wss) from its URL, or none when it isn't a web address. */
export function supabaseSources(supabaseUrl: string | undefined): string[] {
  if (!supabaseUrl) return [];
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return [];
    return [url.origin, `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`];
  } catch {
    return [];
  }
}

/** Sentry's ingest origin from a DSN (empty DSN: none), for crash reports when they are switched on. */
export function sentrySources(dsn: string | undefined): string[] {
  if (!dsn) return [];
  try {
    return [new URL(dsn).origin];
  } catch {
    return [];
  }
}

/** The policy text for these hashes and sources. Pure. */
export function cspPolicy(input: { hashes: readonly string[]; connect: readonly string[] }): string {
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", ...input.hashes, TURNSTILE]],
    ["style-src", ["'self'", "'unsafe-inline'", FONT_CSS]],
    ["font-src", ["'self'", FONT_FILES, "data:"]],
    ["img-src", ["'self'", "data:", "blob:"]],
    ["media-src", ["'self'", "data:", "blob:"]],
    ["connect-src", ["'self'", ...input.connect, TURNSTILE]],
    ["frame-src", [TURNSTILE]],
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["report-uri", [CSP_REPORT_PATH]],
    ["report-to", [CSP_REPORT_GROUP]],
  ];
  return directives.map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}

let cached: Promise<string> | null = null;

/** This server's policy (hashed once per process). */
export function serverCspPolicy(env: { supabaseUrl?: string; sentryDsn?: string }): Promise<string> {
  cached ??= (async () => {
    const hashes = await Promise.all(INLINE_BOOT_SCRIPTS.map(scriptHash));
    return cspPolicy({ hashes, connect: [...supabaseSources(env.supabaseUrl), ...sentrySources(env.sentryDsn)] });
  })();
  return cached;
}

/** The report-only headers for a response to `requestUrl`: the policy and the reporting endpoint on its own origin. */
export async function cspReportOnlyHeaders(requestUrl: string, env: { supabaseUrl?: string; sentryDsn?: string }): Promise<Record<string, string>> {
  let origin = "";
  try {
    origin = new URL(requestUrl).origin;
  } catch {
    return {};
  }
  return {
    "Content-Security-Policy-Report-Only": await serverCspPolicy(env),
    "Reporting-Endpoints": `${CSP_REPORT_GROUP}="${origin}${CSP_REPORT_PATH}"`,
  };
}
