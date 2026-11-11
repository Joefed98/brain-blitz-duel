/**
 * Accounts on the server (10 Nov 2026; docs/accounts/README.md). The server decides everything that matters: who has
 * an account, the age rules, usernames and their limits, deletion. account.functions.ts is a thin shell over these;
 * every database call goes through src/lib/data/profiles.server.ts; events through src/lib/data/events.server.ts.
 *
 * An account is a profile row on the device's own auth user. A guest becomes a player with an account by confirming
 * an email (or Google) on the same auth user (Supabase links the identity to the anonymous user, keeping its id), then
 * completing sign-up here, so every result, attempt, challenge, practice play and beta row stays theirs, uncopied.
 */

import { APPLE_SIGN_IN_ENABLED, GOOGLE_SIGN_IN_ENABLED } from "@/config/accountConfig";
import type { Db } from "@/lib/data/db.server";
import { recordEvents } from "@/lib/data/events.server";
import {
  clearDeletionRequested,
  createProfile,
  markDeletionRequested,
  readAuthUser,
  readDateOfBirth,
  readGuestProgress,
  readProfile,
  renameProfile,
  signOutEverywhere,
  readUsernameStatus,
  type GuestProgress,
  type ProfileRow,
} from "@/lib/data/profiles.server";
import { PLAYER_COLOUR_COUNT } from "@/lib/duel/playerLook";
import { checkUsernameRules, refusalWithSuggestions, type RefusalReason } from "@/lib/names/names.server";

import { ageBand, isUnder18, parseDateOfBirth, UNDER_13_MESSAGE } from "./age";
import { countryCode } from "./country";
import { renameAllowance, renameWaitMessage, type RenameAllowance } from "./usernameRules";

export type SignInMethod = "email" | "google" | "apple";
export const SIGN_IN_METHODS: readonly SignInMethod[] = ["email", "google", "apple"];

/** How long a deletion request waits before the daily clean-up removes the account. */
export const DELETION_GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AccountRefusalReason =
  | RefusalReason
  | "under13"
  | "date"
  | "colour"
  | "method"
  | "guest"
  | "no_account"
  | "deleting"
  | "wait"
  | "busy"
  | "error";

export interface AccountRefusal {
  ok: false;
  reason: AccountRefusalReason;
  message: string;
  /** Three names to offer instead (username refusals only). */
  suggestions?: string[];
}

/** What the player's own phone is told about their account (never the date of birth). */
export interface AccountView {
  kind: "account";
  userId: string;
  username: string;
  colour: number;
  playerNumber: number;
  founding: boolean;
  country: string | null;
  createdAt: string;
  status: string;
  /** The server's age rule for 13–17s; false from the 18th birthday. */
  isUnder18: boolean;
  /** When a deletion is pending: when it was asked for and when the account goes (cancelling is offered). */
  deletion: { requestedAt: string; purgeAt: string } | null;
  /** Whether the username may change now (free, limited) or when it next may. */
  rename: RenameAllowance;
}

export type AccountStatus =
  | { kind: "guest"; userId: string }
  /** Signed in with a confirmed email (or Google) but sign-up not completed: no account yet. */
  | { kind: "incomplete"; userId: string }
  | AccountView;

const refuse = (reason: AccountRefusalReason, message: string, suggestions?: string[]): AccountRefusal =>
  suggestions ? { ok: false, reason, message, suggestions } : { ok: false, reason, message };

const ERROR_MESSAGE = "Something went wrong. Try again.";

export function accountView(profile: ProfileRow, nowMs: number): AccountView {
  const requested = profile.deletion_requested_at;
  return {
    kind: "account",
    userId: profile.user_id,
    username: profile.username,
    colour: profile.colour,
    playerNumber: profile.player_number,
    founding: profile.founding,
    country: profile.country,
    createdAt: profile.created_at,
    status: profile.status,
    isUnder18: isUnder18(profile.date_of_birth, nowMs),
    deletion: requested
      ? { requestedAt: requested, purgeAt: new Date(Date.parse(requested) + DELETION_GRACE_DAYS * DAY_MS).toISOString() }
      : null,
    rename: renameAllowance(profile, nowMs),
  };
}

/** The sign-in method an auth user's identities show (Google or Apple when linked, else email). */
export function methodOf(user: { identities?: { provider: string }[] | null; app_metadata?: { provider?: string } }): SignInMethod {
  const providers = new Set((user.identities ?? []).map((i) => i.provider));
  if (providers.has("google")) return "google";
  if (providers.has("apple")) return "apple";
  return "email";
}

/** Whether a sign-in method is switched on (src/config/accountConfig.ts). */
export function methodEnabled(method: SignInMethod): boolean {
  if (method === "google") return GOOGLE_SIGN_IN_ENABLED;
  if (method === "apple") return APPLE_SIGN_IN_ENABLED;
  return true;
}

function methodFrom(raw: unknown): SignInMethod | null {
  return SIGN_IN_METHODS.includes(raw as SignInMethod) ? (raw as SignInMethod) : null;
}

const METHOD_OFF_MESSAGE = "That way of signing in isn’t available yet. Use your email.";

/** The caller's account status: guest, signed in but not signed up, or the account. */
export async function accountStatus(client: Db, userId: string, nowMs: number): Promise<AccountStatus | AccountRefusal> {
  const { data: profile, error } = await readProfile(client, userId);
  if (error) return refuse("error", ERROR_MESSAGE);
  if (profile) return accountView(profile, nowMs);
  const { data: user } = await readAuthUser(client, userId);
  if (user && user.is_anonymous === false) return { kind: "incomplete", userId };
  return { kind: "guest", userId };
}

/** A date of birth's verdict: the parsed date, or a refusal (under 13 is recorded, with no date and no age). */
function checkDateOfBirth(raw: unknown, userId: string, nowMs: number): { dateOfBirth: string } | AccountRefusal {
  const dateOfBirth = parseDateOfBirth(raw, nowMs);
  if (!dateOfBirth) return refuse("date", "Enter your date of birth.");
  if (ageBand(dateOfBirth, nowMs) === "under13") {
    recordEvents({ event: "under_thirteen_refused", playerId: userId });
    return refuse("under13", UNDER_13_MESSAGE);
  }
  return { dateOfBirth };
}

/** A username's verdict for this user: its rules, then the database (taken by another account, or held). */
export async function checkUsername(
  client: Db,
  userId: string,
  raw: unknown,
): Promise<{ ok: true; username: string } | AccountRefusal> {
  const free = async (name: string) => (await readUsernameStatus(client, name, userId)).data === "free";
  const rules = checkUsernameRules(raw);
  if (!rules.ok) {
    const info = await refusalWithSuggestions("username", rules.reason, { free });
    return refuse(rules.reason, info.message, info.suggestions);
  }
  const { data: status, error } = await readUsernameStatus(client, rules.username, userId);
  if (error || !status) return refuse("error", ERROR_MESSAGE);
  if (status !== "free") {
    const info = await refusalWithSuggestions("username", status, { base: rules.username, free });
    return refuse(status, info.message, info.suggestions);
  }
  return { ok: true, username: rules.username };
}

/**
 * The sign-up's first step, before any email is sent: the method is on, the date of birth is 13 or over (an
 * under-13 is refused here, with nothing stored), and the username (when given) is allowed and free.
 */
export async function startSignUp(
  client: Db,
  userId: string,
  input: { method?: unknown; dateOfBirth?: unknown; username?: unknown },
  nowMs: number,
): Promise<{ ok: true; isUnder18: boolean } | AccountRefusal> {
  const method = methodFrom(input.method);
  if (!method) return refuse("method", METHOD_OFF_MESSAGE);
  if (!methodEnabled(method)) return refuse("method", METHOD_OFF_MESSAGE);
  const dob = checkDateOfBirth(input.dateOfBirth, userId, nowMs);
  if ("ok" in dob) return dob;
  if (input.username !== undefined) {
    const name = await checkUsername(client, userId, input.username);
    if (!name.ok) return name;
  }
  recordEvents({ event: "sign_up_started", playerId: userId, props: { method } });
  return { ok: true, isUnder18: isUnder18(dob.dateOfBirth, nowMs) };
}

/**
 * Completes sign-up on a confirmed (no longer anonymous) auth user: the profile is created with the username, colour,
 * date of birth and country. Under 13: refused, nothing stored. Idempotent: a second call returns the account.
 */
export async function completeSignUp(
  client: Db,
  userId: string,
  input: { username?: unknown; dateOfBirth?: unknown; colour?: unknown; country?: unknown },
  nowMs: number,
): Promise<AccountView | AccountRefusal> {
  const existing = await readProfile(client, userId);
  if (existing.error) return refuse("error", ERROR_MESSAGE);
  if (existing.data) return accountView(existing.data, nowMs);
  const { data: user } = await readAuthUser(client, userId);
  if (!user || user.is_anonymous !== false) return refuse("guest", "Confirm your email first.");
  const method = methodOf(user);
  if (!methodEnabled(method)) return refuse("method", METHOD_OFF_MESSAGE);
  const dob = checkDateOfBirth(input.dateOfBirth, userId, nowMs);
  if ("ok" in dob) return dob;
  const colour = Number(input.colour);
  if (!Number.isInteger(colour) || colour < 0 || colour >= PLAYER_COLOUR_COUNT) return refuse("colour", "Pick a colour.");
  const name = await checkUsername(client, userId, input.username);
  if (!name.ok) return name;
  const country = countryCode(input.country);
  const { data: status, error } = await createProfile(client, {
    userId,
    username: name.username,
    colour,
    dateOfBirth: dob.dateOfBirth,
    country,
  });
  if (error || !status) return refuse("error", ERROR_MESSAGE);
  if (status === "guest") return refuse("guest", "Confirm your email first.");
  if (status === "taken" || status === "held") {
    const info = await refusalWithSuggestions("username", status, {
      base: name.username,
      free: async (n) => (await readUsernameStatus(client, n, userId)).data === "free",
    });
    return refuse(status, info.message, info.suggestions);
  }
  const { data: profile } = await readProfile(client, userId);
  if (!profile) return refuse("error", ERROR_MESSAGE);
  if (status === "created") recordEvents({ event: "sign_up_completed", playerId: userId, props: { method } });
  return accountView(profile, nowMs);
}

/** Changes the username under the limits (free once within 7 days, then once every 90; the old name held 30 days). */
export async function changeUsername(
  client: Db,
  userId: string,
  raw: unknown,
  nowMs: number,
): Promise<AccountView | AccountRefusal> {
  const { data: profile, error } = await readProfile(client, userId);
  if (error) return refuse("error", ERROR_MESSAGE);
  if (!profile) return refuse("no_account", "Make an account first.");
  if (profile.deletion_requested_at) return refuse("deleting", "Your account is being deleted. Cancel that first.");
  const allowance = renameAllowance(profile, nowMs);
  if (allowance.kind === "wait") return refuse("wait", renameWaitMessage(allowance.nextAt));
  const name = await checkUsername(client, userId, raw);
  if (!name.ok) return name;
  if (name.username === profile.username) return accountView(profile, nowMs);
  const { data: status, error: renameError } = await renameProfile(client, {
    userId,
    username: name.username,
    kind: allowance.kind,
    expectedChangedAt: profile.username_changed_at,
  });
  if (renameError || !status) return refuse("error", ERROR_MESSAGE);
  if (status === "stale") return refuse("busy", "Your username just changed. Try again.");
  if (status === "missing") return refuse("no_account", "Make an account first.");
  if (status === "taken" || status === "held") {
    const info = await refusalWithSuggestions("username", status, {
      base: name.username,
      free: async (n) => (await readUsernameStatus(client, n, userId)).data === "free",
    });
    return refuse(status, info.message, info.suggestions);
  }
  recordEvents({ event: "username_changed", playerId: userId, props: { kind: allowance.kind } });
  const { data: after } = await readProfile(client, userId);
  return after ? accountView(after, nowMs) : refuse("error", ERROR_MESSAGE);
}

/**
 * A rename forced by moderation (no tool calls it yet): the same name rules, any time, counting towards neither limit,
 * logged in accounts.admin_log. Server only; never a server function.
 */
export async function forceRename(
  client: Db,
  userId: string,
  raw: unknown,
  note: string,
): Promise<{ ok: true; username: string } | AccountRefusal> {
  const name = await checkUsername(client, userId, raw);
  if (!name.ok) return name;
  const { data: status, error } = await renameProfile(client, {
    userId,
    username: name.username,
    kind: "forced",
    expectedChangedAt: null,
    note,
  });
  if (error || !status) return refuse("error", ERROR_MESSAGE);
  if (status !== "renamed") return refuse(status === "missing" ? "no_account" : status === "stale" ? "busy" : status, `Not renamed (${status}).`);
  return { ok: true, username: name.username };
}

/**
 * Asks for the account to be deleted: hidden from other players at once ("Deleted player"), signed out everywhere,
 * removed by the daily clean-up after DELETION_GRACE_DAYS unless the player signs in and cancels.
 */
export async function requestAccountDeletion(
  client: Db,
  userId: string,
  accessToken: string | null,
  nowMs: number,
): Promise<{ ok: true; purgeAt: string } | AccountRefusal> {
  const { data: profile, error } = await readProfile(client, userId);
  if (error) return refuse("error", ERROR_MESSAGE);
  if (!profile) return refuse("no_account", "There’s no account to delete.");
  let requestedAt = profile.deletion_requested_at;
  if (!requestedAt) {
    const marked = await markDeletionRequested(client, userId, new Date(nowMs).toISOString());
    if (marked.error) return refuse("error", ERROR_MESSAGE);
    requestedAt = marked.data[0]?.deletion_requested_at ?? new Date(nowMs).toISOString();
    recordEvents({ event: "account_deletion_requested", playerId: userId });
  }
  if (accessToken) {
    const out = await signOutEverywhere(client, accessToken);
    if (out.error) console.warn(`[account] sign out everywhere: ${out.error.message}`);
  }
  // Signed out everywhere, so no device keeps notifications (B2; docs/push-notifications.md).
  const { removeAllSubscriptions } = await import("@/lib/push/push.server");
  await removeAllSubscriptions(client, userId);
  return { ok: true, purgeAt: new Date(Date.parse(requestedAt) + DELETION_GRACE_DAYS * DAY_MS).toISOString() };
}

/** Cancels a pending deletion (signing back in within the 30 days). */
export async function cancelAccountDeletion(client: Db, userId: string, nowMs: number): Promise<AccountView | AccountRefusal> {
  const { data: profile, error } = await readProfile(client, userId);
  if (error) return refuse("error", ERROR_MESSAGE);
  if (!profile) return refuse("no_account", "There’s no account here.");
  if (profile.deletion_requested_at) {
    const cleared = await clearDeletionRequested(client, userId);
    if (cleared.error) return refuse("error", ERROR_MESSAGE);
  }
  const { data: after } = await readProfile(client, userId);
  return after ? accountView(after, nowMs) : refuse("error", ERROR_MESSAGE);
}

/**
 * What stays behind on this guest id when the phone signs in to an existing account instead (the guest's rows are
 * never moved), for the warning the screens show. Device-only records (practice bests, stars, the device's room
 * record) stay on the phone whichever player is signed in.
 */
export async function guestProgress(client: Db, userId: string): Promise<{ ok: true; progress: GuestProgress; hasProgress: boolean } | AccountRefusal> {
  const { data, error } = await readGuestProgress(client, userId);
  if (error || !data) return refuse("error", ERROR_MESSAGE);
  const progress = {
    rooms: Number(data.rooms) || 0,
    dailies: Number(data.dailies) || 0,
    challenges: Number(data.challenges) || 0,
    practice: Number(data.practice) || 0,
    account: data.account === true,
  };
  return { ok: true, progress, hasProgress: progress.rooms + progress.dailies + progress.challenges + progress.practice > 0 };
}

/** Records a sign-in (after the phone's verify) for a permanent user. */
export async function noteSignIn(client: Db, userId: string, rawMethod: unknown): Promise<{ ok: boolean }> {
  const { data: user } = await readAuthUser(client, userId);
  if (!user || user.is_anonymous !== false) return { ok: false };
  const method = methodFrom(rawMethod) ?? methodOf(user);
  recordEvents({ event: "sign_in", playerId: userId, props: { method } });
  return { ok: true };
}

/** Records a sign-out (the phone signs out right after). */
export function noteSignOut(userId: string): { ok: true } {
  recordEvents({ event: "sign_out", playerId: userId });
  return { ok: true };
}

/**
 * The age rules' input for other server code (chat with strangers, purchases): whether the caller has an account and,
 * if so, whether they are under 18 today (it lifts on the 18th birthday by itself). Guests: account false, null.
 */
export async function accountAgeFlags(
  client: Db,
  userId: string,
  nowMs: number,
): Promise<{ account: boolean; isUnder18: boolean | null }> {
  const { data: dob } = await readDateOfBirth(client, userId);
  if (!dob) return { account: false, isUnder18: null };
  return { account: true, isUnder18: isUnder18(dob, nowMs) };
}

/* ------------------------------------------------------------------ account emails, rate limited */

/** The longest email address accepted (RFC 5321's path limit). */
const EMAIL_MAX = 254;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailCodeOutcome =
  | { ok: true }
  | { ok: false; reason: "existing-account" | "no-account" | "rate-limited" | "invalid" | "expired" | "bad-code" | "off" | "error"; message: string };

const TOO_MANY = "Too many tries. Wait a few minutes and try again.";

/**
 * Sends a sign-in email (`kind` "sign-in": an existing account only; "no-account" tells the screens it's a new player)
 * or a sign-up email (`kind` "sign-up": links the address to the caller's own guest user, with its access token), after
 * two limits through take_rate_limit: IP_ACCOUNT_EMAIL_LIMIT per network (every lookup counts, found or not) and
 * EMAIL_CODE_LIMIT per address (every request for that address counts, from any network). Over either limit nothing is
 * sent and nothing is looked up.
 */
export async function requestEmailCode(
  client: Db,
  kind: "sign-in" | "sign-up",
  rawEmail: unknown,
  accessToken: string | null,
  captchaToken: string | null = null,
): Promise<EmailCodeOutcome> {
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  if (!email || email.length > EMAIL_MAX || !EMAIL_SHAPE.test(email))
    return { ok: false, reason: "invalid", message: "Enter your email address." };
  const { EMAIL_CODE_LIMIT, IP_ACCOUNT_EMAIL_LIMIT, withinEmailRateLimit, withinIpRateLimit } = await import(
    "@/lib/duel/rateLimit.server"
  );
  if (!(await withinIpRateLimit(IP_ACCOUNT_EMAIL_LIMIT, client))) return { ok: false, reason: "rate-limited", message: TOO_MANY };
  if (!(await withinEmailRateLimit(client, email, EMAIL_CODE_LIMIT))) return { ok: false, reason: "rate-limited", message: TOO_MANY };
  const { AUTH_REDIRECT_URL, authOutcome } = await import("./auth");
  const { sendEmailChangeCode, sendSignInCode } = await import("@/lib/data/authEmail.server");
  if (kind === "sign-up") {
    if (!accessToken) return { ok: false, reason: "error", message: ERROR_MESSAGE };
    const { error } = await sendEmailChangeCode(accessToken, email, AUTH_REDIRECT_URL);
    return authOutcome(error) as EmailCodeOutcome;
  }
  const token = typeof captchaToken === "string" && captchaToken.length <= 2048 ? captchaToken : null;
  const { error } = await sendSignInCode(email, AUTH_REDIRECT_URL, token);
  return authOutcome(error) as EmailCodeOutcome;
}
