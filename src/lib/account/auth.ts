/**
 * The phone's account plumbing (10 Nov 2026; docs/accounts/README.md): the Supabase Auth calls and the server calls in
 * the order the sign-up and sign-in screens (a later session) will make them. No screens here.
 *
 * Sign-up from a guest (the device already holds an anonymous session, session.ts):
 *   1. startSignUpFn({ method: "email", dateOfBirth, username })  the age gate and name, before any email is sent
 *   2. sendSignUpEmail(email)       links the email to THIS auth user (same id): one email with a magic link and a
 *                                   6-digit code ("existing-account" when the email already has an account)
 *   3. verifyEmailCode(email, code, "sign-up")  or the link opens the app and supabase-js reads the session from it
 *   4. completeSignUpFn({ username, dateOfBirth, colour, country: regionCountry(),
 *                         turnstileToken: await signUpTurnstileToken() })   (null while Turnstile is off)
 *
 * Sign-in to an existing account on a phone with guest progress:
 *   1. guestProgressFn()            what stays behind on the guest id, for the warning (rememberLeftGuest keeps the id)
 *   2. sendSignInEmail(email)       never creates a user
 *   3. verifyEmailCode(email, code, "sign-in"), then noteSignInFn({ method: "email" })
 *   The guest's rows stay on the guest id and nothing moves.
 *
 * Google (behind GOOGLE_SIGN_IN_ENABLED) links to the guest with linkIdentity, or signs in with signInWithOAuth.
 * Apple (APPLE_SIGN_IN_ENABLED) the same. Both switches are off.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { APP_URL } from "@/config/appUrl";
import { APPLE_SIGN_IN_ENABLED, GOOGLE_SIGN_IN_ENABLED } from "@/config/accountConfig";

/** Where an account email's link lands (the dashboard's redirect allow-list must include it). */
export const AUTH_REDIRECT_URL = `${APP_URL}/profile`;

export type AuthOutcome =
  | { ok: true }
  | { ok: false; reason: "existing-account" | "no-account" | "bad-code" | "expired" | "rate-limited" | "off" | "error"; message: string };

const MESSAGES = {
  "existing-account": "That email already has an account. Sign in instead.",
  "no-account": "There’s no account with that email.",
  "bad-code": "That code doesn’t match. Check the email and try again.",
  expired: "That code has expired. Send a new one.",
  "rate-limited": "Too many emails. Wait a minute and try again.",
  off: "That way of signing in isn’t available yet. Use your email.",
  error: "Something went wrong. Try again.",
} as const;

function fail(reason: keyof typeof MESSAGES): AuthOutcome {
  return { ok: false, reason, message: MESSAGES[reason] };
}

interface AuthErrorLike {
  code?: string | undefined;
  status?: number | undefined;
  message?: string | undefined;
}

/** Supabase Auth's error codes, read into the few outcomes the screens show. */
export function authOutcome(error: AuthErrorLike | null | undefined): AuthOutcome {
  if (!error) return { ok: true };
  const code = error.code ?? "";
  const text = error.message ?? "";
  if (code === "email_exists" || code === "user_already_exists" || /already (been )?registered/i.test(text))
    return fail("existing-account");
  if (code === "otp_disabled" || code === "user_not_found" || /signups not allowed/i.test(text)) return fail("no-account");
  if (code === "otp_expired" || /expired/i.test(text)) return fail("expired");
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || error.status === 429)
    return fail("rate-limited");
  if (/invalid|token/i.test(text)) return fail("bad-code");
  return fail("error");
}

type Client = SupabaseClient;

async function browserClient(): Promise<Client> {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase as unknown as Client;
}

/**
 * Sign-up from a guest: links `email` to the device's own anonymous auth user (Supabase keeps the id). Supabase sends
 * the "Change email address" template (supabase/templates/email_change.html): the link and the 6-digit code.
 */
export async function sendSignUpEmail(email: string, client?: Client): Promise<AuthOutcome> {
  const c = client ?? (await browserClient());
  const { error } = await c.auth.updateUser({ email: email.trim() }, { emailRedirectTo: AUTH_REDIRECT_URL });
  return authOutcome(error);
}

/** Sign-in to an existing account: the magic link and the code (supabase/templates/magic_link.html). Never creates a user. */
export async function sendSignInEmail(email: string, client?: Client): Promise<AuthOutcome> {
  const c = client ?? (await browserClient());
  // Safety (10 Nov 2026): with Turnstile on, Supabase Auth's captcha protection checks the token on /otp.
  const captchaToken = await signInCaptchaToken();
  const { error } = await c.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false, emailRedirectTo: AUTH_REDIRECT_URL, ...(captchaToken ? { captchaToken } : {}) },
  });
  return authOutcome(error);
}

/** The Turnstile token for a sign-in email (Supabase Auth's captcha on /otp). Null while Turnstile is off. */
export async function signInCaptchaToken(): Promise<string | null> {
  const { getTurnstileToken, turnstileEnabled } = await import("@/lib/safety/turnstile");
  return turnstileEnabled() ? getTurnstileToken("sign-in") : null;
}

/**
 * The Turnstile token completeSignUpFn takes as `turnstileToken` (safety, 10 Nov 2026): fetched right before the call,
 * since a token is one-use and lasts five minutes. Null while Turnstile is off (the server then doesn't ask).
 */
export async function signUpTurnstileToken(): Promise<string | null> {
  const { getTurnstileToken, turnstileEnabled } = await import("@/lib/safety/turnstile");
  return turnstileEnabled() ? getTurnstileToken("sign-up") : null;
}

/**
 * The 6-digit code typed instead of opening the link (an iPhone home-screen app often opens links in Safari).
 * "sign-up" confirms the email linked to the guest (type email_change); "sign-in" signs in to the account (type email).
 */
export async function verifyEmailCode(
  email: string,
  code: string,
  mode: "sign-up" | "sign-in",
  client?: Client,
): Promise<AuthOutcome & { userId?: string | undefined }> {
  const c = client ?? (await browserClient());
  const token = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(token)) return fail("bad-code");
  const { data, error } = await c.auth.verifyOtp({
    email: email.trim(),
    token,
    type: mode === "sign-up" ? "email_change" : "email",
  });
  const outcome = authOutcome(error);
  return outcome.ok ? { ok: true, userId: data.user?.id ?? data.session?.user?.id } : outcome;
}

/** Google: links to the guest ("sign-up", same id) or signs in to an existing account. Off until switched on. */
export async function startGoogle(mode: "sign-up" | "sign-in", client?: Client): Promise<AuthOutcome> {
  if (!GOOGLE_SIGN_IN_ENABLED) return fail("off");
  return startOAuth("google", mode, client);
}

/** Apple: as Google. Off until switched on. */
export async function startApple(mode: "sign-up" | "sign-in", client?: Client): Promise<AuthOutcome> {
  if (!APPLE_SIGN_IN_ENABLED) return fail("off");
  return startOAuth("apple", mode, client);
}

async function startOAuth(provider: "google" | "apple", mode: "sign-up" | "sign-in", client?: Client): Promise<AuthOutcome> {
  const c = client ?? (await browserClient());
  const options = { redirectTo: AUTH_REDIRECT_URL };
  const { error } =
    mode === "sign-up" ? await c.auth.linkIdentity({ provider, options }) : await c.auth.signInWithOAuth({ provider, options });
  return authOutcome(error);
}

/** Signs this device out (the next call makes it a fresh guest, session.ts ensureSession). */
export async function signOutDevice(client?: Client): Promise<AuthOutcome> {
  const c = client ?? (await browserClient());
  const { error } = await c.auth.signOut({ scope: "local" });
  return authOutcome(error);
}

/* ------------------------------------------------------------------ guests left behind */

export const LEFT_GUESTS_KEY = "duelz-left-guests:v1";

/**
 * Remembers the guest id a phone leaves behind when it signs in to an existing account (its rows stay on that id),
 * so a later merge, if Joe wants one, knows which guest it was. Only ids, at most 5, newest last.
 */
export function rememberLeftGuest(guestUserId: string, atMs: number = Date.now()): void {
  try {
    if (typeof window === "undefined") return;
    const list = leftGuests().filter((g) => g.id !== guestUserId);
    list.push({ id: guestUserId, at: atMs });
    window.localStorage.setItem(LEFT_GUESTS_KEY, JSON.stringify(list.slice(-5)));
  } catch {
    /* storage blocked */
  }
}

export function leftGuests(): { id: string; at: number }[] {
  try {
    if (typeof window === "undefined") return [];
    const parsed = JSON.parse(window.localStorage.getItem(LEFT_GUESTS_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((g): g is { id: string; at: number } => !!g && typeof g.id === "string" && typeof g.at === "number")
      : [];
  } catch {
    return [];
  }
}
