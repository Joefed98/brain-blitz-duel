/**
 * Friends (wave 2 B1, 11 Nov 2026; docs/friends.md): the numbers and words shared by the phone and the server.
 * Nothing here decides a rule; the server (friends.server.ts) and the SQL do.
 */

import { APP_URL } from "@/config/appUrl";

/** The most friends a player may have (checked for both players when a request is accepted). */
export const FRIENDS_CAP = 200;

/** Search: a prefix of a username, 2–16 letters, numbers or underscores. */
export const SEARCH_MIN = 2;
export const SEARCH_MAX = 16;
export const SEARCH_RESULTS = 10;
const SEARCH_SHAPE = /^[A-Za-z0-9_]{2,16}$/;

/** An invite link's token: 12 lower-case letters and digits (the alphabet leaves out look-alikes). */
export const INVITE_TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const INVITE_TOKEN_LENGTH = 12;
const TOKEN_SHAPE = /^[a-z0-9]{12}$/;

/** How long a friend is shown as online after the phone's last heartbeat, and how often the phone beats. */
export const ONLINE_WINDOW_MS = 150_000;
export const PRESENCE_BEAT_MS = 60_000;

/** The phone keeps an invite token seen before sign-up here, and sends the request once it has an account. */
export const PENDING_INVITE_KEY = "duelz-friend-invite:v1";

export function searchQueryOk(value: unknown): value is string {
  return typeof value === "string" && SEARCH_SHAPE.test(value);
}

export function inviteTokenOk(value: unknown): value is string {
  return typeof value === "string" && TOKEN_SHAPE.test(value);
}

/** A token from a link's query, cleaned (letters lower-cased), or null. */
export function inviteTokenFrom(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim().toLowerCase();
  return inviteTokenOk(token) ? token : null;
}

/** The link a player shares to be added. */
export function inviteLink(token: string): string {
  return `${APP_URL}/friends?invite=${encodeURIComponent(token)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function playerIdOk(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Why a friends call was refused; the words go to the screen as they are. */
export type FriendsRefusalReason =
  | "busy"
  | "account"
  | "under18"
  | "query"
  | "cap"
  | "their_cap"
  | "blocked"
  | "not_found"
  | "self"
  | "no_room"
  | "room_full"
  | "not_friends"
  | "error";

export interface FriendsRefusal {
  ok: false;
  reason: FriendsRefusalReason;
  message: string;
}

export const FRIENDS_MESSAGES: Record<FriendsRefusalReason, string> = {
  busy: "That’s a lot of tries. Give it a few minutes.",
  account: "Friends need an account.",
  under18: "Search is for players 18 and over. Share your invite link instead.",
  query: "Type at least two letters of a username.",
  cap: `You’ve reached ${FRIENDS_CAP} friends. Remove one to add another.`,
  their_cap: `They’ve reached ${FRIENDS_CAP} friends.`,
  blocked: "You’ve blocked this player. Unblock them first.",
  not_found: "That player isn’t here any more.",
  self: "That’s your own link.",
  no_room: "Make or join a room first.",
  room_full: "Your room is full.",
  not_friends: "You’re not friends any more.",
  error: "Can’t reach us. Try again.",
};

export function refusal(reason: FriendsRefusalReason): FriendsRefusal {
  return { ok: false, reason, message: FRIENDS_MESSAGES[reason] };
}

/** Friends' statuses as the list writes them. */
export type StatusLike =
  | { kind: "room"; code: string; players: number; maxPlayers: number }
  | { kind: "playing"; code: string }
  | { kind: "practice" }
  | { kind: "online" }
  | { kind: "offline"; lastSeen: string | null }
  | { kind: "hidden" };

/** Online now (any status but offline or hidden). */
export function isOnline(status: StatusLike | null | undefined): boolean {
  return !!status && status.kind !== "offline" && status.kind !== "hidden";
}

/** "12 min ago", "2 h ago" (under a day), "Yesterday" (the UK day before), "3 days ago", or "" when not known. */
export function lastSeenText(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "";
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const mins = Math.max(0, Math.floor((nowMs - at) / 60_000));
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  const day = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { timeZone: "Europe/London" });
  const yesterday = day(nowMs - 86_400_000);
  if (hours < 24) return `${hours} h ago`;
  if (day(at) === yesterday) return "Yesterday";
  const days = Math.max(1, Math.round((nowMs - at) / 86_400_000));
  if (days < 30) return `${days} days ago`;
  return "A while ago";
}

/** The status line under a friend's name. */
export function statusText(status: StatusLike | null | undefined, nowMs: number): string {
  if (!status) return "";
  switch (status.kind) {
    case "room":
      return `In room ${status.code}, ${status.players} of ${status.maxPlayers}`;
    case "playing":
      return "In a game";
    case "practice":
      return "Playing Practice";
    case "online":
      return "Online";
    case "offline":
      return lastSeenText(status.lastSeen, nowMs);
    case "hidden":
      return "";
  }
}

/** A friend's lobby they can join from the list (a room waiting with a seat free). */
export function joinableRoom(status: StatusLike | null | undefined): string | null {
  return status?.kind === "room" && status.players < status.maxPlayers ? status.code : null;
}
