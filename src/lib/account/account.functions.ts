/**
 * Account server functions (10 Nov 2026; docs/accounts/README.md): a thin shell over account.server.ts, each behind
 * requireSupabaseAuth and a per-user rate limit, on the service-role client. The phone's half is src/lib/account/auth.ts.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function setup(userId: string, limit: "account" | "username") {
  const { adminDb } = await import("@/lib/data/db.server");
  const client = await adminDb();
  const { ACCOUNT_LIMIT, USERNAME_CHECK_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  const allowed = await withinRateLimit(client, userId, limit === "account" ? ACCOUNT_LIMIT : USERNAME_CHECK_LIMIT);
  return { client, allowed, account: await import("./account.server") };
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
  .inputValidator((input: { username: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, allowed, account } = await setup(context.userId, "username");
    if (!allowed) return BUSY;
    return account.checkUsername(client, context.userId, data?.username);
  });

/** Sign-up's first step, before any email: the method, the age rule (under 13 refused, nothing stored), the name. */
export const startSignUpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { method: string; dateOfBirth: string; username?: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, allowed, account } = await setup(context.userId, "account");
    if (!allowed) return BUSY;
    return account.startSignUp(client, context.userId, data ?? {}, Date.now());
  });

/** Completes sign-up once the email (or Google) is confirmed on this device's auth user: the profile is created. */
export const completeSignUpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { username: string; dateOfBirth: string; colour: number; country?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { client, allowed, account } = await setup(context.userId, "account");
    if (!allowed) return BUSY;
    return account.completeSignUp(client, context.userId, data ?? {}, Date.now());
  });

/** Changes the username within its limits. */
export const changeUsernameFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { username: string }) => input)
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
  .inputValidator((input: { method?: string }) => input)
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
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const { client, account } = await emailSetup();
    return account.requestEmailCode(client, "sign-in", data?.email, null);
  });

/** The sign-up email: links the address to the caller's own guest and sends its code. Rate limited as sign-in's. */
export const requestSignUpEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const { client, account } = await emailSetup();
    return account.requestEmailCode(client, "sign-up", data?.email, await bearerToken());
  });
