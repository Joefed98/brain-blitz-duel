/**
 * Security fix M5 (Nov 2026 audit): the response headers every page and server call carries in a production build
 * (src/server.ts adds them; the dev server, which Lovable's editor and the checks use, is left alone).
 *
 * - `Content-Security-Policy: frame-ancestors …`: no other site may frame the app (clickjacking Create, Join,
 *   Disband, and later purchases). Lovable's editor (lovable.dev) still may, so its preview keeps working.
 *   A script and connect policy (hashing the two inline boot scripts, allowing Supabase, Google Fonts and Sentry)
 *   needs a pass in a browser first; it is not set here.
 * - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
 * - `Strict-Transport-Security` on HTTPS requests only (one year; subdomains are not included).
 *
 * A header the response already has is kept as it is.
 */
export const FRAME_ANCESTORS = "frame-ancestors 'self' https://lovable.dev https://*.lovable.dev";

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": FRAME_ANCESTORS,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export const HSTS = "max-age=31536000";

/** The headers to add to a response to this request URL (HSTS only over HTTPS). */
export function securityHeadersFor(url: string): Record<string, string> {
  const out: Record<string, string> = { ...SECURITY_HEADERS };
  try {
    if (new URL(url).protocol === "https:") out["Strict-Transport-Security"] = HSTS;
  } catch {
    // Not a full URL: no HSTS.
  }
  return out;
}

/** The response with the security headers added (a copy, since a fetched response's headers can be immutable). */
export function withSecurityHeaders(response: Response, url: string): Response {
  const headers = new Headers(response.headers);
  let changed = false;
  for (const [name, value] of Object.entries(securityHeadersFor(url))) {
    if (headers.has(name)) continue;
    headers.set(name, value);
    changed = true;
  }
  if (!changed) return response;
  // 101 and the other bodiless statuses can't be rebuilt; they carry no page to frame.
  if (response.status < 200 || response.status === 204 || response.status === 304) return response;
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
