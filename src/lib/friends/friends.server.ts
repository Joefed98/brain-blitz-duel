/**
 * Friends: the server's rules (wave 2 B1, 11 Nov 2026; docs/friends.md). Every call names the caller by their auth user
 * id (from requireSupabaseAuth, never from the phone), checks it has an account, applies the limits, then calls one
 * function in src/lib/data/friends.server.ts. The SQL checks the same rules again.
 *
 * - Accounts only. A guest gets `account` from everything but `linkOwner` (a guest opening a link sees whose it is).
 * - Search is for adults (18+) and never returns an under-18 account; under-18s can't search. Invite links work for
 *   everyone.
 * - A decline is never told to the sender; a request to a player who has blocked the caller answers "sent" and stores
 *   nothing.
 * - Analytics (src/lib/data/events.server.ts): friend_request_sent (props.via), friend_added (props.via),
 *   friend_removed, friend_blocked. The events for phone notifications (B2) are written by the SQL into
 *   public.friend_events: friend_request_received, friend_request_accepted, friend_challenge_received,
 *   room_invite_received.
 */

import { accountAgeFlags } from "@/lib/account/account.server";
import type { Db } from "@/lib/data/db.server";
import { recordEvents } from "@/lib/data/events.server";
import {
  blockPlayer,
  inviteToken,
  inviteToRoom,
  insertPlayerReport,
  linkOwner as readLinkOwner,
  presenceBeat,
  readAreFriends,
  readFriendProfile,
  readOverview,
  readFriendCount,
  readWaitingCount,
  removeFriendship,
  respondToRequest,
  searchPlayers,
  sendChallenge as sendChallengeData,
  sendFriendRequest,
  setShowOnline as writeShowOnline,
  unblockPlayer,
  type FriendCard,
  type FriendProfile,
  type Overview,
  type RequestVia,
  type SearchHit,
} from "@/lib/data/friends.server";
import { UNIQUE_VIOLATION } from "@/lib/data/db.server";
import { withinRateLimit, type RateLimit } from "@/lib/duel/rateLimit.server";
import { REPORT_LIMIT } from "@/lib/duel/rateLimit.server";
import { isReportReason, REPORT_THANKS } from "@/lib/safety/reports";
import { awardBadge, cardBadgesFor } from "@/lib/badges/badges.server";
import { STARTER_TITLE } from "@/lib/badges/catalogue";
import { publicCardsFor } from "@/lib/economy/economy.server";
import { accountOf, toPublic } from "@/lib/identity/publicIds.server";

import {
  FRIENDS_CAP,
  INVITE_TOKEN_ALPHABET,
  INVITE_TOKEN_LENGTH,
  inviteLink,
  inviteTokenFrom,
  playerIdOk,
  refusal,
  SEARCH_RESULTS,
  type FriendLook,
  searchQueryOk,
  type FriendsRefusal,
} from "./friends";

/* ------------------------------------------------------------------ limits (per user) */

/** Friend requests sent (search or link): 20 an hour. */
export const FRIEND_REQUEST_LIMIT: RateLimit = { bucket: "friend-request", max: 20, windowSeconds: 3600, failClosed: true };
/** Username searches: 60 per 10 minutes. */
export const FRIEND_SEARCH_LIMIT: RateLimit = { bucket: "friend-search", max: 60, windowSeconds: 600 };
/** Invite link resets: 5 a day. */
export const FRIEND_LINK_RESET_LIMIT: RateLimit = { bucket: "friend-link-reset", max: 5, windowSeconds: 86_400, failClosed: true };
/** Room invites and challenges sent to friends: 30 an hour. */
export const FRIEND_INVITE_LIMIT: RateLimit = { bucket: "friend-invite", max: 30, windowSeconds: 3600, failClosed: true };
/** Accept, decline, remove, block, unblock, the setting: 120 per 10 minutes. */
export const FRIEND_ACTION_LIMIT: RateLimit = { bucket: "friend-action", max: 120, windowSeconds: 600 };
/** Reads (the list, a profile, the badge, a link's owner, the caller's link): 600 per 10 minutes. */
export const FRIEND_READ_LIMIT: RateLimit = { bucket: "friend-read", max: 600, windowSeconds: 600 };
/** The app's heartbeat (one a minute while open): 30 per 10 minutes. */
export const FRIEND_PRESENCE_LIMIT: RateLimit = { bucket: "friend-presence", max: 30, windowSeconds: 600 };

/** Every limit, for the checks and the docs. */
export const FRIEND_LIMITS = {
  request: FRIEND_REQUEST_LIMIT,
  search: FRIEND_SEARCH_LIMIT,
  linkReset: FRIEND_LINK_RESET_LIMIT,
  invite: FRIEND_INVITE_LIMIT,
  action: FRIEND_ACTION_LIMIT,
  read: FRIEND_READ_LIMIT,
  presence: FRIEND_PRESENCE_LIMIT,
} as const;

type Ok<T> = { ok: true } & T;
export type Answer<T> = Ok<T> | FriendsRefusal;

/** The Friendly badge (C2's catalogue: "Add 5 friends", Common): earned at this many friends. */
export const FRIENDLY_AT = 5;

/**
 * Awards Friendly to each player who now has 5 or more friends, through C2's badge_award (which awards a badge once:
 * a second call answers "owned" and records nothing). Called whenever a friendship is made (both players) and when a
 * player opens their list (a catch-up if an award ever failed). Never fails the call it rides on.
 */
export async function awardFriendly(client: Db, userIds: readonly string[]): Promise<void> {
  for (const userId of userIds) {
    try {
      const { data: count, error } = await readFriendCount(client, userId);
      if (error || count < FRIENDLY_AT) continue;
      await awardBadge(client, userId, "friendly", { friends: count });
    } catch (err) {
      console.warn(`[friends] friendly badge: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/** The caller's account and age, or a refusal (a guest). */
async function caller(client: Db, userId: string): Promise<{ isUnder18: boolean } | FriendsRefusal> {
  const flags = await accountAgeFlags(client, userId, Date.now());
  if (!flags.account) return refusal("account");
  return { isUnder18: flags.isUnder18 !== false };
}

async function limited(client: Db, userId: string, limit: RateLimit): Promise<boolean> {
  return withinRateLimit(client, userId, limit);
}

/* ------------------------------------------------------------------ cards */

/**
 * The card looks of every player a screen lists, in one go (the cards read 100 ids at a time, in parallel; never one
 * read a friend). Only accounts have a look; a read that fails leaves every look out (the screens draw the colour and
 * initial), never the list.
 */
export async function cardLooksFor(client: Db, ids: readonly string[]): Promise<Map<string, FriendLook>> {
  const unique = [...new Set(ids)];
  const out = new Map<string, FriendLook>();
  if (!unique.length) return out;
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += 100) chunks.push(unique.slice(i, i + 100));
    const [cards, badgeRows] = await Promise.all([
      publicCardsFor(client, unique),
      Promise.all(chunks.map((chunk) => cardBadgesFor(client, chunk))).then((rows) => rows.flat()),
    ]);
    const badges = new Map(badgeRows.map((b) => [b.playerId, b]));
    for (const [id, card] of cards) {
      if (!card.account) continue;
      const b = badges.get(id);
      out.set(id, {
        cardArt: card.cardArt,
        frame: card.frame,
        nameColour: card.nameColour,
        avatar: { id: card.avatarId ?? "captain-joulz", colour: card.colour ?? 0, gem: card.gem },
        title: b?.title ?? STARTER_TITLE,
        badges: b?.badges.slice(0, 3) ?? [],
      });
    }
  } catch {
    out.clear();
  }
  return out;
}

function withLook<T extends FriendCard>(card: T, looks: Map<string, FriendLook>): T {
  const look = looks.get(card.id);
  return look ? { ...card, look } : card;
}

/* ------------------------------------------------------------------ public ids */

/**
 * Security C3: phones know players by public id only. Every card, search hit and blocked row this module answers names
 * its player by public id; every player id a phone sends is a public id, converted back here. One that names nobody (an
 * account id, or a public id no one has) becomes NOBODY, so the SQL answers it as it answers an unknown player.
 */
const NOBODY = "00000000-0000-0000-0000-000000000000";

async function accountFor(client: Db, target: unknown): Promise<string> {
  return (playerIdOk(target) && (await accountOf(client, target))) || NOBODY;
}

async function shownAs<T extends { id: string }>(client: Db, rows: readonly T[]): Promise<T[]> {
  const ids = await toPublic(client, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, id: ids.get(r.id) ?? "" }));
}

/* ------------------------------------------------------------------ reads */

/** The Friends list (friends with status, requests, invites, challenges, blocked, the setting). */
export async function overview(client: Db, userId: string): Promise<Answer<{ overview: Overview }>> {
  const who = await caller(client, userId);
  if ("ok" in who) return who;
  if (!(await limited(client, userId, FRIEND_READ_LIMIT))) return refusal("busy");
  const { data, error } = await readOverview(client, userId, FRIENDS_CAP);
  if (error || !data) return refusal(error ? "error" : "account");
  if (data.count >= FRIENDLY_AT) await awardFriendly(client, [userId]);
  const looks = await cardLooksFor(client, [
    ...data.friends.map((f) => f.id),
    ...data.incoming.map((f) => f.id),
    ...data.invites.map((f) => f.id),
    ...data.challenges.map((f) => f.id),
  ]);
  const outgoing = await toPublic(client, data.outgoing);
  return {
    ok: true,
    overview: {
      ...data,
      friends: await shownAs(client, data.friends.map((f) => withLook(f, looks))),
      incoming: await shownAs(client, data.incoming.map((f) => withLook(f, looks))),
      outgoing: data.outgoing.map((id) => outgoing.get(id) ?? ""),
      invites: await shownAs(client, data.invites.map((f) => withLook(f, looks))),
      challenges: await shownAs(client, data.challenges.map((f) => withLook(f, looks))),
      blocked: await shownAs(client, data.blocked),
    },
  };
}

/** How many requests wait for the caller (0 for a guest: the badge never shows for them). */
export async function waitingCount(client: Db, userId: string): Promise<number> {
  if (!(await limited(client, userId, FRIEND_READ_LIMIT))) return 0;
  const { data } = await readWaitingCount(client, userId);
  return data;
}

/** Another player's profile as the caller sees it; not found when there's nothing to show (or they blocked the caller). */
export async function profile(client: Db, userId: string, target: unknown): Promise<Answer<{ profile: FriendProfile }>> {
  if (!playerIdOk(target)) return refusal("not_found");
  const who = await caller(client, userId);
  if ("ok" in who) return who;
  if (!(await limited(client, userId, FRIEND_READ_LIMIT))) return refusal("busy");
  const account = await accountFor(client, target);
  if (account === NOBODY) return refusal("not_found");
  const { data, error } = await readFriendProfile(client, userId, account);
  if (error) return refusal("error");
  if (!data) return refusal("not_found");
  // A blocked player's profile shows no card (their name and Unblock only).
  if (data.relation === "blocked") return { ok: true, profile: { ...data, card: (await shownAs(client, [data.card]))[0]! } };
  const looks = await cardLooksFor(client, [data.card.id]);
  return { ok: true, profile: { ...data, card: (await shownAs(client, [withLook(data.card, looks)]))[0]! } };
}

/** Search by username: adults only, and never an under-18 account. */
export async function search(client: Db, userId: string, query: unknown): Promise<Answer<{ results: SearchHit[] }>> {
  const who = await caller(client, userId);
  if ("ok" in who) return who;
  if (who.isUnder18) return refusal("under18");
  if (!searchQueryOk(query)) return refusal("query");
  if (!(await limited(client, userId, FRIEND_SEARCH_LIMIT))) return refusal("busy");
  const { data, error } = await searchPlayers(client, userId, query, SEARCH_RESULTS);
  if (error) return refusal("error");
  const looks = await cardLooksFor(client, data.map((h) => h.id));
  return { ok: true, results: await shownAs(client, data.map((h) => withLook(h, looks))) };
}

/** Whose invite link a token is (open to guests: the link's landing says who asked). */
export async function linkOwner(client: Db, userId: string, token: unknown): Promise<Answer<{ owner: FriendCard | null }>> {
  const clean = inviteTokenFrom(token);
  if (!clean) return { ok: true, owner: null };
  if (!(await limited(client, userId, FRIEND_READ_LIMIT))) return refusal("busy");
  const { data, error } = await readLinkOwner(client, clean);
  if (error) return refusal("error");
  if (!data) return { ok: true, owner: null };
  return { ok: true, owner: (await shownAs(client, [withLook(data, await cardLooksFor(client, [data.id]))]))[0]! };
}

function newToken(): string {
  const bytes = new Uint8Array(INVITE_TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += INVITE_TOKEN_ALPHABET[b % INVITE_TOKEN_ALPHABET.length];
  return out;
}

/** The caller's invite link (made on first ask); `reset` retires the old one and makes another. */
export async function myLink(client: Db, userId: string, reset: boolean): Promise<Answer<{ token: string; link: string }>> {
  const who = await caller(client, userId);
  if ("ok" in who) return who;
  if (!(await limited(client, userId, reset ? FRIEND_LINK_RESET_LIMIT : FRIEND_READ_LIMIT))) return refusal("busy");
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await inviteToken(client, { userId, token: newToken(), reset });
    if (error?.code === UNIQUE_VIOLATION) continue;
    if (error || !data) return refusal(error ? "error" : "account");
    return { ok: true, token: data, link: inviteLink(data) };
  }
  return refusal("error");
}

/* ------------------------------------------------------------------ requests */

export type SendOutcome = "sent" | "accepted" | "friends";

async function send(
  client: Db,
  userId: string,
  to: string,
  via: RequestVia,
): Promise<Answer<{ outcome: SendOutcome; friend: FriendCard | null }>> {
  if (!(await limited(client, userId, FRIEND_REQUEST_LIMIT))) return refusal("busy");
  const { data, error } = await sendFriendRequest(client, { from: userId, to, via, cap: FRIENDS_CAP });
  if (error || !data) return refusal("error");
  switch (data.result) {
    case "sent":
      if (data.created) recordEvents({ event: "friend_request_sent", playerId: userId, props: { via } });
      if (data.created) notifySoon(client);
      return { ok: true, outcome: "sent", friend: null };
    case "accepted":
      recordEvents({ event: "friend_added", playerId: userId, props: { via } });
      await awardFriendly(client, [userId, to]);
      notifySoon(client);
      return { ok: true, outcome: "accepted", friend: null };
    case "friends":
      return { ok: true, outcome: "friends", friend: null };
    case "not_account":
      return refusal("account");
    default:
      return refusal(data.result);
  }
}

/** A request to a player found by search (both adults; the SQL checks it again). */
export async function requestById(client: Db, userId: string, target: unknown): Promise<Answer<{ outcome: SendOutcome }>> {
  const who = await caller(client, userId);
  if ("ok" in who) return who;
  if (who.isUnder18) return refusal("under18");
  if (!playerIdOk(target)) return refusal("not_found");
  return send(client, userId, await accountFor(client, target), "search");
}

/** A request through someone's invite link (works for everyone, under-18s included). */
export async function requestByLink(
  client: Db,
  userId: string,
  token: unknown,
): Promise<Answer<{ outcome: SendOutcome; owner: FriendCard }>> {
  const who = await caller(client, userId);
  if ("ok" in who) return who;
  const clean = inviteTokenFrom(token);
  if (!clean) return refusal("not_found");
  const { data: owner, error } = await readLinkOwner(client, clean);
  if (error) return refusal("error");
  if (!owner) return refusal("not_found");
  if (owner.id === userId) return refusal("self");
  const sent = await send(client, userId, owner.id, "link");
  return sent.ok ? { ok: true, outcome: sent.outcome, owner: (await shownAs(client, [owner]))[0]! } : sent;
}

/** Accepts or declines a request sent to the caller. A decline tells nobody. */
export async function respond(
  client: Db,
  userId: string,
  requestId: unknown,
  accept: unknown,
): Promise<Answer<{ outcome: "accepted" | "declined" | "gone" }>> {
  const who = await caller(client, userId);
  if ("ok" in who) return who;
  if (!playerIdOk(requestId) || typeof accept !== "boolean") return refusal("not_found");
  if (!(await limited(client, userId, FRIEND_ACTION_LIMIT))) return refusal("busy");
  const { data, error } = await respondToRequest(client, { userId, requestId, accept, cap: FRIENDS_CAP });
  if (error || !data) return refusal("error");
  if (data.result === "missing") return { ok: true, outcome: "gone" };
  if (data.result === "cap" || data.result === "their_cap") return refusal(data.result);
  if (data.result === "accepted") {
    recordEvents({ event: "friend_added", playerId: userId, props: { via: data.via ?? "link" } });
    await awardFriendly(client, data.friend ? [userId, data.friend] : [userId]);
    notifySoon(client);
  }
  return { ok: true, outcome: data.result };
}

/** Removes a friend. Silent: they aren't told. */
export async function remove(client: Db, userId: string, friendId: unknown): Promise<Answer<{ removed: boolean }>> {
  const who = await caller(client, userId);
  if ("ok" in who) return who;
  if (!playerIdOk(friendId)) return refusal("not_found");
  if (!(await limited(client, userId, FRIEND_ACTION_LIMIT))) return refusal("busy");
  const { data, error } = await removeFriendship(client, userId, await accountFor(client, friendId));
  if (error) return refusal("error");
  if (data) recordEvents({ event: "friend_removed", playerId: userId });
  return { ok: true, removed: data };
}

/** Blocks a player: no requests, invites, challenges or status either way, and the friendship goes. */
export async function block(client: Db, userId: string, target: unknown): Promise<Answer<{ removed: boolean }>> {
  const who = await caller(client, userId);
  if ("ok" in who) return who;
  if (!playerIdOk(target)) return refusal("not_found");
  if (!(await limited(client, userId, FRIEND_ACTION_LIMIT))) return refusal("busy");
  const { data, error } = await blockPlayer(client, userId, await accountFor(client, target));
  if (error || !data) return refusal("error");
  if (data.result !== "blocked") return refusal(data.result);
  if (data.created) recordEvents({ event: "friend_blocked", playerId: userId });
  return { ok: true, removed: data.removed };
}

export async function unblock(client: Db, userId: string, target: unknown): Promise<Answer<{ unblocked: boolean }>> {
  const who = await caller(client, userId);
  if ("ok" in who) return who;
  if (!playerIdOk(target)) return refusal("not_found");
  if (!(await limited(client, userId, FRIEND_ACTION_LIMIT))) return refusal("busy");
  const { data, error } = await unblockPlayer(client, userId, await accountFor(client, target));
  if (error) return refusal("error");
  return { ok: true, unblocked: data };
}

/** A report from a player's profile, through wave 1's flow (the same counting, mute and review list). */
export async function report(client: Db, userId: string, target: unknown, reason: unknown): Promise<Answer<{ message: string }>> {
  const who = await caller(client, userId);
  if ("ok" in who) return who;
  if (!playerIdOk(target) || !isReportReason(reason)) return refusal("not_found");
  const reported = await accountFor(client, target);
  if (reported === NOBODY || reported === userId) return refusal("not_found");
  if (!(await withinRateLimit(client, userId, REPORT_LIMIT))) return refusal("busy");
  const shown = await readFriendProfile(client, userId, reported);
  if (shown.error) return refusal("error");
  const { error } = await insertPlayerReport(client, {
    reporterId: userId,
    reportedId: reported,
    reason,
    reportedName: shown.data?.card.username ?? null,
  });
  if (error) return refusal("error");
  recordEvents({ event: "report_sent", playerId: userId, props: { reason } });
  return { ok: true, message: REPORT_THANKS };
}

/* ------------------------------------------------------------------ playing together */

/** Invites a friend to the caller's open lobby (found by the server). */
export async function inviteFriendToRoom(client: Db, userId: string, friendId: unknown): Promise<Answer<{ code: string }>> {
  const who = await caller(client, userId);
  if ("ok" in who) return who;
  if (!playerIdOk(friendId)) return refusal("not_friends");
  if (!(await limited(client, userId, FRIEND_INVITE_LIMIT))) return refusal("busy");
  const { data, error } = await inviteToRoom(client, userId, await accountFor(client, friendId));
  if (error || !data) return refusal("error");
  if (data.result !== "sent") return refusal(data.result);
  notifySoon(client);
  return { ok: true, code: data.code ?? "" };
}

/** Sends the caller's own open challenge (the existing friend challenge flow) to a friend. */
export async function sendChallenge(
  client: Db,
  userId: string,
  friendId: unknown,
  code: unknown,
): Promise<Answer<{ sent: true }>> {
  const who = await caller(client, userId);
  if ("ok" in who) return who;
  if (!playerIdOk(friendId)) return refusal("not_friends");
  if (typeof code !== "string" || !/^[A-Za-z0-9]{6}$/.test(code)) return refusal("not_found");
  if (!(await limited(client, userId, FRIEND_INVITE_LIMIT))) return refusal("busy");
  const { data, error } = await sendChallengeData(client, userId, await accountFor(client, friendId), code.toUpperCase());
  if (error || !data) return refusal("error");
  if (data.result !== "sent") return refusal(data.result);
  notifySoon(client);
  return { ok: true, sent: true };
}

/* ------------------------------------------------------------------ status */

/** "Show when I'm online": true, false or null (back to the default: on for adults, off for under-18s). */
export async function setShowOnline(client: Db, userId: string, show: unknown): Promise<Answer<{ showOnline: boolean }>> {
  const who = await caller(client, userId);
  if ("ok" in who) return who;
  if (show !== null && typeof show !== "boolean") return refusal("error");
  if (!(await limited(client, userId, FRIEND_ACTION_LIMIT))) return refusal("busy");
  const { error } = await writeShowOnline(client, userId, show);
  if (error) return refusal("error");
  return { ok: true, showOnline: show ?? !who.isUnder18 };
}

/** The app's heartbeat (accounts only; a guest's is ignored). */
export async function beat(client: Db, userId: string, activity: unknown): Promise<{ ok: boolean }> {
  const kind = activity === "practice" ? "practice" : "app";
  if (!(await limited(client, userId, FRIEND_PRESENCE_LIMIT))) return { ok: false };
  const { data } = await presenceBeat(client, userId, kind);
  return { ok: data };
}

/**
 * Whether two players are friends, for the chat policy (src/lib/safety/chatPolicy.ts `chatPolicy(context, player,
 * { friends })`): waves 3 and 4 ask this before letting friends type to each other where strangers otherwise get
 * quick phrases. A failure answers false (the stricter policy).
 */
export async function areFriends(client: Db, a: string, b: string): Promise<boolean> {
  if (!playerIdOk(a) || !playerIdOk(b) || a === b) return false;
  const { data, error } = await readAreFriends(client, a, b);
  return !error && data;
}

/**
 * Phone notifications (B2): the friend event this change recorded (public.friend_events) is sent in the background
 * (src/lib/push/notify.server.ts dispatchFriendEvents; the Cron Trigger's five-minute sweep catches anything missed).
 * Never awaited, never throws; nothing while the push keys aren't set.
 */
function notifySoon(client: Db): void {
  void import("@/lib/push/notify.server").then((m) => m.dispatchFriendEventsSoon(client)).catch(() => {});
}
