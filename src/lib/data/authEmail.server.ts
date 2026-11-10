/**
 * The two Supabase Auth calls that send an account email (10 Nov 2026, the sign-up screens), made from the server so
 * they pass the per-network and per-address rate limits first (account.server.ts `requestEmailCode`). Server only;
 * each function issues exactly one call, as supabase-js would make it from the phone:
 * - sign-in: POST /auth/v1/otp, never creating a user (the "Magic link" template: a link and a 6-digit code);
 * - sign-up: PUT /auth/v1/user as the guest itself (its own access token), linking the email to that same user (the
 *   "Change email address" template).
 * The phone still verifies the code itself (auth.ts verifyEmailCode), so the session stays on the phone.
 */

export interface AuthCallError {
  code?: string | undefined;
  status?: number;
  message?: string;
}

function authBase(): { url: string; key: string } | null {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

async function call(path: string, init: RequestInit, redirectTo: string, bearer: string | null): Promise<{ error: AuthCallError | null }> {
  const base = authBase();
  if (!base) return { error: { code: "unconfigured", status: 500, message: "Auth isn't configured" } };
  const headers: Record<string, string> = { "content-type": "application/json", apikey: base.key };
  headers["authorization"] = `Bearer ${bearer ?? base.key}`;
  try {
    const res = await fetch(`${base.url}/auth/v1${path}?redirect_to=${encodeURIComponent(redirectTo)}`, { ...init, headers });
    if (res.ok) return { error: null };
    const body = (await res.json().catch(() => ({}))) as { error_code?: string; code?: string | number; msg?: string; message?: string };
    return {
      error: {
        code: body.error_code ?? (typeof body.code === "string" ? body.code : undefined),
        status: res.status,
        message: body.msg ?? body.message ?? `HTTP ${res.status}`,
      },
    };
  } catch (err) {
    return { error: { code: "network", status: 0, message: err instanceof Error ? err.message : String(err) } };
  }
}

/** Sends the sign-in email (link and code) to an existing account; an unknown email gets nothing ("otp_disabled"). */
export function sendSignInCode(email: string, redirectTo: string): Promise<{ error: AuthCallError | null }> {
  return call("/otp", { method: "POST", body: JSON.stringify({ email, create_user: false }) }, redirectTo, null);
}

/** Links `email` to the caller's own auth user (its access token) and sends the code ("email_exists" when taken). */
export function sendEmailChangeCode(accessToken: string, email: string, redirectTo: string): Promise<{ error: AuthCallError | null }> {
  return call("/user", { method: "PUT", body: JSON.stringify({ email }) }, redirectTo, accessToken);
}
