/**
 * Account server functions (10 Nov 2026; docs/accounts/README.md): a thin shell over account.server.ts, each behind
 * requireSupabaseAuth and a per-user rate limit, on the service-role client. The phone's half is src/lib/account/auth.ts.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { nullable, num, optional, record, text } from "@/lib/validate";

async function setup(userId: string, limit: "account" | "username") {
  const { adminDb } = await import("@/lib/data/db.server");
  const client = await adminDb();
  const { ACCOUNT_LIMIT, USERNAME_CHECK_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  const allowed = await withinRateLimit(client, userId, limit === "account" ? ACCOUNT_LIMIT : USERNAME_CHECK_LIMIT);
  return { client, allowed, account: await import("./account.server") };
}

/*
 * Input checks (Security C2, 14 Nov 2026; src/lib/validate.ts): type and size only. The rules themselves (a username's
 * characters, a real date, an email's shape, a known method) stay with account.server.ts, so its answers are unchanged.
 */
const USERNAME_MAX = 64;
const METHOD_MAX = 32;
const DATE_MAX = 32;
const COUNTRY_MAX = 8;
const EMAIL_MAX = 320;
/** A Turnstile or Auth captcha token (Cloudflare's are about 2 KB at most). */
const CAPTCHA_MAX = 4096;

function usernameInput(input: unknown): { username: string } {
  return { username: text(record(input)["username"], USERNAME_MAX, "username") };
}

const BUSY = { ok: false as const, reason: "busy" as const, message: "That’s a lot of tries. Give it a few minutes." };

/** Guest, signed in but not signed up, or the account (deletion pending, rename allowance, under-18 rule). */
export const accountStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { client, allowed, account } = await setup(context.userId, "account");
    if (!allowed) return BUSY;
    return account.accountStatus(client, context.userId, Date.now());
  });

/** Whether a username may be taken (rules, filter, reserved, look-alikes, availability), with three suggestions. */
export const checkUsernameFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { username: string }) => usernameInput(input))
  .handler(async ({ data, context }) => {
    const { client, allowed, account } = await setup(context.userId, "username");
    if (!allowed) return BUSY;
    return account.checkUsername(client, context.userId, data?.username);
  });

/** Sign-up's first step, before any email: the method, the age rule (under 13 refused, nothing stored), the name. */
export const startSignUpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { method: string; dateOfBirth: string; username?: string }) => {
    const body = record(input);
    return {
      method: text(body["method"], METHOD_MAX, "method"),
      dateOfBirth: text(body["dateOfBirth"], DATE_MAX, "dateOfBirth"),
      username: optional(body["username"], (v) => text(v, USERNAME_MAX, "username")),
    };
  })
  .handler(async ({ data, context }) => {
    const { client, allowed, account } = await setup(context.userId, "account");
    if (!allowed) return BUSY;
    return account.startSignUp(client, context.userId, data ?? {}, Date.now());
  });

/** Completes sign-up once the email (or Google) is confirmed on this device's auth user: the profile is created. */
export const completeSignUpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      username: string;
      dateOfBirth: string;
      colour: number;
      country?: string | null;
      /** Safety (10 Nov 2026): auth.ts signUpTurnstileToken(); checked only while Turnstile is on. */
      turnstileToken?: string | null;
    }) => {
      const body = record(input);
      return {
        username: text(body["username"], USERNAME_MAX, "username"),
        dateOfBirth: text(body["dateOfBirth"], DATE_MAX, "dateOfBirth"),
        colour: num(body["colour"], "colour"),
        country: optional(body["country"], (v) => nullable(v, (c) => text(c, COUNTRY_MAX, "country"))),
        turnstileToken: optional(body["turnstileToken"], (v) => nullable(v, (t) => text(t, CAPTCHA_MAX, "turnstileToken"))),
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { client, allowed, account } = await setup(context.userId, "account");
    if (!allowed) return BUSY;
    const { TURNSTILE_REFUSED_MESSAGE, verifyTurnstile } = await import("@/lib/safety/turnstile.server");
    const { callerAddress } = await import("@/lib/duel/rateLimit.server");
    if (!(await verifyTurnstile(data?.turnstileToken, { remoteIp: await callerAddress() })))
      return { ok: false as const, reason: "turnstile" as const, message: TURNSTILE_REFUSED_MESSAGE };
    const result = await account.completeSignUp(client, context.userId, data ?? {}, Date.now());
    // Practice challenges (wave 2 C1b): a guest's completed challenges pay their coins now that it is an account.
    if (!("ok" in result && result.ok === false)) {
      try {
        const { payPendingChallengeRewards } = await import("@/lib/challenges/challenges.server");
        await payPendingChallengeRewards(client, context.userId);
      } catch (err) {
        console.warn(`[challenges] sign-up payout: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return result;
  });

/** Changes the username within its limits. */
export const changeUsernameFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { username: string }) => usernameInput(input))
  .handler(async ({ data, context }) => {
    const { client, allowed, account } = await setup(context.userId, "account");
    if (!allowed) return BUSY;
    return account.changeUsername(client, context.userId, data?.username, Date.now());
  });

/** Asks for the account's deletion: hidden at once, signed out everywhere, removed after 30 days. */
export const requestAccountDeletionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { client, allowed, account } = await setup(context.userId, "account");
    if (!allowed) return BUSY;
    const { getRequest } = await import("@tanstack/react-start/server");
    const header = getRequest()?.headers?.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    return account.requestAccountDeletion(client, context.userId, token, Date.now());
  });

/** Cancels a pending deletion (offered when the player signs back in within the 30 days). */
export const cancelAccountDeletionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { client, allowed, account } = await setup(context.userId, "account");
    if (!allowed) return BUSY;
    return account.cancelAccountDeletion(client, context.userId, Date.now());
  });

/** What this device's guest id holds, for the warning before signing in to another account (it stays here). */
export const guestProgressFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { client, allowed, account } = await setup(context.userId, "account");
    if (!allowed) return BUSY;
    return account.guestProgress(client, context.userId);
  });

/** Records a sign-in (the phone calls it after verifying). Best effort. */
export const noteSignInFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { method?: string }) => {
    const body = record(input);
    return { method: optional(body["method"], (v) => text(v, METHOD_MAX, "method")) };
  })
  .handler(async ({ data, context }) => {
    const { client, allowed, account } = await setup(context.userId, "account");
    if (!allowed) return { ok: false };
    return account.noteSignIn(client, context.userId, data?.method);
  });

/** Records a sign-out (the phone calls it just before signing out). Best effort. */
export const noteSignOutFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { allowed, account } = await setup(context.userId, "account");
    if (!allowed) return { ok: false };
    return account.noteSignOut(context.userId);
  });

async function bearerToken(): Promise<string | null> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const header = getRequest()?.headers?.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

async function emailSetup() {
  const { adminDb } = await import("@/lib/data/db.server");
  return { client: await adminDb(), account: await import("./account.server") };
}

/**
 * The sign-in email (an existing account only), which is also the lookup that tells the screens sign-in from sign-up
 * ("no-account"). Rate limited per network and per address through take_rate_limit (requestEmailCode).
 */
export const requestSignInEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; captchaToken?: string | null }) => {
    const body = record(input);
    return {
      email: text(body["email"], EMAIL_MAX, "email"),
      captchaToken: optional(body["captchaToken"], (v) => nullable(v, (t) => text(t, CAPTCHA_MAX, "captchaToken"))),
    };
  })
  .handler(async ({ data }) => {
    const { client, account } = await emailSetup();
    // Safety (10 Nov 2026): auth.ts signInCaptchaToken(), passed on to Supabase Auth's captcha check (null while off).
    return account.requestEmailCode(client, "sign-in", data?.email, null, data?.captchaToken ?? null);
  });

/** The sign-up email: links the address to the caller's own guest and sends its code. Rate limited as sign-in's. */
export const requestSignUpEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => ({ email: text(record(input)["email"], EMAIL_MAX, "email") }))
  .handler(async ({ data }) => {
    const { client, account } = await emailSetup();
    return account.requestEmailCode(client, "sign-up", data?.email, await bearerToken());
  });
