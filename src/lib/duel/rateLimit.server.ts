/**
 * Per-user rate limits for the room and chat server functions (pre-beta
 * security audit, docs/security-audit-oct-2026.md). Counters live in
 * public.rate_limit_hits through public.take_rate_limit (migration
 * 20261016120000_rate_limits.sql), which only the service role can call.
 *
 * Fails open: if the migration is not applied yet or the database errors, the
 * call is allowed and a warning logged, so a missing table never blocks play.
 * Never used on a game, answer or scoring path.
 *
 * Security fix M4 (Nov 2026 audit): a limit marked `failClosed` (making rooms and challenges, which build puzzles and
 * draw bank boards) refuses the call on a database error; only a missing counter function (the migration not applied
 * yet) still lets it through, so publishing before the migration stays safe. Signed-out paths (practice, the intro-demo
 * key) and the create paths also count per network address (`withinIpRateLimit`), so signing in again doesn't reset them.
 */

import type { Db } from "@/lib/data/db.server";
import { takeRateLimit } from "@/lib/data/limits.server";

export interface RateLimit {
  bucket: string;
  max: number;
  windowSeconds: number;
  /** Refuse on a database error (but not on a missing counter function). */
  failClosed?: boolean;
}

/** Creating rooms: 20 an hour per user. */
export const CREATE_ROOM_LIMIT: RateLimit = { bucket: "create-room", max: 20, windowSeconds: 3600, failClosed: true };
/** Room-code lookups (link preview and join, shared): 60 per 10 minutes, so codes can't be brute-forced. */
export const ROOM_LOOKUP_LIMIT: RateLimit = { bucket: "room-lookup", max: 60, windowSeconds: 600 };
/** Starting a daily (21 Oct 2026): 30 per 10 minutes, far above two dailies' worth of retries. */
export const DAILY_START_LIMIT: RateLimit = { bucket: "daily-start", max: 30, windowSeconds: 600 };
/** Making friend challenges (22 Oct 2026): 10 an hour, on top of the database count (challenge.server.ts). */
export const CHALLENGE_CREATE_LIMIT: RateLimit = { bucket: "challenge-create", max: 10, windowSeconds: 3600, failClosed: true };
/** Chat reports: 20 per 10 minutes. */
export const REPORT_LIMIT: RateLimit = { bucket: "report", max: 20, windowSeconds: 600 };

/** Account calls (10 Nov 2026: sign-up, rename, deletion, status): 60 per 10 minutes per user. */
export const ACCOUNT_LIMIT: RateLimit = { bucket: "account", max: 60, windowSeconds: 600 };
/** Username availability checks while typing: 120 per 10 minutes per user. */
export const USERNAME_CHECK_LIMIT: RateLimit = { bucket: "username-check", max: 120, windowSeconds: 600 };

/** Safety calls (10 Nov 2026: the status on open, a warning seen, a forced rename): 60 per 10 minutes per user. */
export const SAFETY_LIMIT: RateLimit = { bucket: "safety", max: 60, windowSeconds: 600 };

/** Coins and items (wave 2: the wallet, inventory and loadout reads, equipping, the avatar): 240 per 10 minutes per user. */
export const ECONOMY_LIMIT: RateLimit = { bucket: "economy", max: 240, windowSeconds: 600 };
/** Public cards (another player's look, read by profiles, rooms and friends): 600 per 10 minutes per user. */
/** Practice challenges' list (wave 2 C1b): 120 reads per 10 minutes per user. */
export const CHALLENGES_LIMIT: RateLimit = { bucket: "challenges", max: 120, windowSeconds: 600 };
export const PUBLIC_CARD_LIMIT: RateLimit = { bucket: "public-card", max: 600, windowSeconds: 600 };
/** Practice progress reads and the one-time note (wave 2 C1a), per player. */
export const PRACTICE_PROGRESS_LIMIT: RateLimit = { bucket: "practice-progress", max: 240, windowSeconds: 600 };
/** Reading ratings, placement and the tier ladder (wave 3, W3a), per player. */
export const RATINGS_READ_LIMIT: RateLimit = { bucket: "ratings-read", max: 600, windowSeconds: 600 };

/** Starting a room (dealing every round): 30 an hour per user. */
export const START_ROOM_LIMIT: RateLimit = { bucket: "start-room", max: 30, windowSeconds: 3600 };
/** Starting a challenge attempt: 30 per 10 minutes per user. */
export const CHALLENGE_START_LIMIT: RateLimit = { bucket: "challenge-start", max: 30, windowSeconds: 600 };
/** Profile's challenge list: 60 per 10 minutes per user. */
export const CHALLENGE_LIST_LIMIT: RateLimit = { bucket: "challenge-list", max: 60, windowSeconds: 600 };
/** A room round's live word and move checks: 1,500 per 10 minutes per user (as practice's per address). */
export const ROOM_CHECK_LIMIT: RateLimit = { bucket: "room-check", max: 1500, windowSeconds: 600 };
/** Lobby colour and icon changes: 60 per 10 minutes per user. */
export const PLAYER_LOOK_LIMIT: RateLimit = { bucket: "player-look", max: 60, windowSeconds: 600 };
/**
 * Chat (L3): the room's gap and per-room cap as atomic buckets, so parallel sends can't all pass the read-then-insert
 * checks: one message per gap window, and the room's cap per room (a week's window outlives any room).
 */
export function chatGapLimit(gapMs: number): RateLimit {
  return { bucket: "chat-gap", max: 1, windowSeconds: Math.max(1, Math.ceil(gapMs / 1000)) };
}
export function chatRoomLimit(roomId: string, max: number): RateLimit {
  return { bucket: `chat-room:${String(roomId).slice(0, 64)}`, max, windowSeconds: 7 * 24 * 3600 };
}
/** Share and terms beta events (L4): 60 per 10 minutes per user. */
export const BETA_EVENT_LIMIT: RateLimit = { bucket: "beta-event", max: 60, windowSeconds: 600 };
/**
 * Account emails (the sign-up screens): every sign-in lookup or sign-up code request counts once per network (so
 * nobody can test many addresses to find who plays) and once per email address (so nobody can flood an inbox).
 */
export const IP_ACCOUNT_EMAIL_LIMIT: RateLimit = { bucket: "ip-account-email", max: 10, windowSeconds: 600, failClosed: true };
export const EMAIL_CODE_LIMIT: RateLimit = { bucket: "email-code", max: 5, windowSeconds: 3600, failClosed: true };
/** The save-your-progress prompt's three events (saveProgress.functions.ts): a handful a game at most. */
export const SAVE_PROGRESS_LIMIT: RateLimit = { bucket: "save-progress", max: 20, windowSeconds: 600, failClosed: true };
/** The identity screens' three events (identityEvents.functions.ts): a profile view, Customise, a refused equip. */
export const IDENTITY_EVENT_LIMIT: RateLimit = { bucket: "identity-events", max: 40, windowSeconds: 600, failClosed: true };
/** Phone notifications (push.functions.ts): saving or removing a device, the switches, the ask, an open. */
export const PUSH_LIMIT: RateLimit = { bucket: "push", max: 40, windowSeconds: 600, failClosed: true };
/** Analytics events from the phone (recordClientEventsFn): 30 calls of up to 20 events per 10 minutes a device. */
export const ANALYTICS_CLIENT_LIMIT: RateLimit = { bucket: "analytics-client", max: 30, windowSeconds: 600, failClosed: true };

/* Per network address (M4): generous, since a school or a household shares one address. */
/** Making rooms from one address: 60 an hour. */
export const IP_CREATE_ROOM_LIMIT: RateLimit = { bucket: "ip-create-room", max: 60, windowSeconds: 3600, failClosed: true };
/** Making challenges from one address: 30 an hour. */
export const IP_CHALLENGE_CREATE_LIMIT: RateLimit = { bucket: "ip-challenge-create", max: 30, windowSeconds: 3600, failClosed: true };
/** Practice deals (signed out): 400 per 10 minutes. */
export const IP_PRACTICE_DEAL_LIMIT: RateLimit = { bucket: "ip-practice-deal", max: 400, windowSeconds: 600 };
/**
 * Practice packs (each up to 60 deals): 100 an hour (20 until 11 Nov 2026, Joe's decision in session C1a: a new
 * phone's first top-up takes 16 calls and its next visit as many again, so 20 held back a second visit in the hour).
 */
export const IP_PRACTICE_PACK_LIMIT: RateLimit = { bucket: "ip-practice-pack", max: 100, windowSeconds: 3600 };
/** Practice grades, live and queued: 600 per 10 minutes. */
export const IP_PRACTICE_GRADE_LIMIT: RateLimit = { bucket: "ip-practice-grade", max: 600, windowSeconds: 600 };
/** Practice word and move checks: 1,500 per 10 minutes. */
export const IP_PRACTICE_CHECK_LIMIT: RateLimit = { bucket: "ip-practice-check", max: 1500, windowSeconds: 600 };
/**
 * New guests from one address (safety, 10 Nov 2026; docs/moderation.md): 200 an hour (Supabase Auth's own anonymous
 * limit was 30). Guests are made by Supabase Auth, so the count runs in the database, in Auth's Before User Created
 * hook (`public.before_user_created_guest_limit`, supabase/migrations/20261110150200_new_guest_limit.sql), on the same
 * `take_rate_limit` and the same `addressKey` hash; moderation-check proves the numbers and the hash match.
 * `withinNewGuestLimit` is the same count from server code.
 */
export const NEW_GUEST_LIMIT: RateLimit = { bucket: "new-guest", max: 200, windowSeconds: 3600 };
/** Intro-demo key guesses (M7): 20 an hour. */
export const IP_DEMO_KEY_LIMIT: RateLimit = { bucket: "ip-demo-key", max: 20, windowSeconds: 3600 };

/** A counter function that isn't there yet (the migration not applied): PostgREST's PGRST202, Postgres' 42883. */
export function missingCounter(error: { code?: unknown; message?: unknown } | null | undefined): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const message = String(error.message ?? "");
  if (code === "PGRST202" || code === "42883" || code === "42P01") return true;
  return /take_rate_limit|rate_limit_hits/.test(message) && /not find|does not exist/i.test(message);
}

/** True when the caller is still within the limit (this call counted). */
export async function withinRateLimit(client: Db, userId: string, limit: RateLimit): Promise<boolean> {
  try {
    const { data, error } = await takeRateLimit(client, userId, limit.bucket, limit.max, limit.windowSeconds);
    if (error) {
      const allow = !limit.failClosed || missingCounter(error);
      console.warn(`[rate-limit] ${limit.bucket}: ${error.message} (${allow ? "allowed" : "refused"})`);
      return allow;
    }
    return data !== false;
  } catch (err) {
    const allow = !limit.failClosed;
    console.warn(`[rate-limit] ${limit.bucket}: ${err instanceof Error ? err.message : String(err)} (${allow ? "allowed" : "refused"})`);
    return allow;
  }
}

/**
 * The caller's network address, as the edge reports it (Cloudflare's cf-connecting-ip first, then the proxy's
 * forwarded address); null where there is no request (checks) or no address.
 */
export async function callerAddress(): Promise<string | null> {
  try {
    const { getRequest, getRequestIP } = await import("@tanstack/react-start/server");
    const headers = getRequest()?.headers;
    const cf = headers?.get("cf-connecting-ip")?.trim();
    if (cf) return cf;
    return getRequestIP({ xForwardedFor: true }) ?? null;
  } catch {
    return null;
  }
}

/** A uuid-shaped key for a network address (the counter table is keyed by uuid; the address itself is never stored). */
export async function addressKey(address: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`duelz-ip:${address}`)));
  const hex = Array.from(bytes.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** withinRateLimit keyed on the caller's network address; allowed when there is no address or no database. */
export async function withinIpRateLimit(limit: RateLimit, client?: Db): Promise<boolean> {
  const address = await callerAddress();
  if (!address) return true;
  let db = client;
  if (!db) {
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) return true;
    const { adminDb } = await import("@/lib/data/db.server");
    db = await adminDb();
  }
  return withinRateLimit(db, await addressKey(address), limit);
}

/** One new guest from `address` counted against NEW_GUEST_LIMIT (the hook's count, from server code and the checks). */
export async function withinNewGuestLimit(client: Db, address: string): Promise<boolean> {
  return withinRateLimit(client, await addressKey(address), NEW_GUEST_LIMIT);
}

/** A uuid-shaped key for an email address (lower-cased; the address itself is never stored in the counter table). */
export async function emailKey(email: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`duelz-email:${email.trim().toLowerCase()}`)),
  );
  const hex = Array.from(bytes.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** withinRateLimit keyed on an email address (EMAIL_CODE_LIMIT). */
export async function withinEmailRateLimit(client: Db, email: string, limit: RateLimit): Promise<boolean> {
  return withinRateLimit(client, await emailKey(email), limit);
}
