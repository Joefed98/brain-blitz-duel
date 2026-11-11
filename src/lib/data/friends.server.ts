/**
 * Friends' data (wave 2 B1, 11 Nov 2026; docs/friends.md): the service-role functions of
 * supabase/migrations/20261111120000_friends.sql, one call each, and the report of a player outside any room through
 * wave 1's own report function (`file_room_report`, with no room). Server only. The rules that decide what a caller may
 * do are in src/lib/friends/friends.server.ts and, again, in the SQL.
 */

import type { Db, Json } from "./db.server";
import type { Result } from "./rooms.server";
import type { ReportFiled } from "./chat.server";
import type { StatusLike } from "@/lib/friends/friends";
import type { ReportReason } from "@/lib/safety/reports";

/** A player's public fields as the friends functions return them. */
export interface FriendCard {
  id: string;
  username: string;
  colour: number;
  playerNumber: number;
  founding: boolean;
}

export type FriendStatus = StatusLike;

export type Relation = "friends" | "requested" | "incoming" | "none";

export interface SearchHit extends FriendCard {
  relation: Relation;
}

export type RequestVia = "search" | "link";

export type SendResult = "sent" | "accepted" | "friends" | "blocked" | "cap" | "their_cap" | "not_found" | "self" | "not_account";

export interface SendAnswer {
  result: SendResult;
  created: boolean;
  requestId?: string | null;
}

export type RespondResult = "accepted" | "declined" | "missing" | "cap" | "their_cap";

export interface RespondAnswer {
  result: RespondResult;
  friend?: string;
  via?: RequestVia;
}

export interface BlockAnswer {
  result: "blocked" | "not_found" | "self";
  removed: boolean;
  created: boolean;
}

export interface InviteAnswer {
  result: "sent" | "no_room" | "not_friends" | "room_full";
  code?: string;
  created: boolean;
}

export interface ChallengeSendAnswer {
  result: "sent" | "not_friends" | "not_found";
  created: boolean;
}

export interface HeadToHead {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  last: ("win" | "loss" | "draw")[];
  best: { game: string; wins: number; played: number } | null;
}

export interface OverviewFriend extends FriendCard {
  since: string;
  status: FriendStatus;
}

export interface Overview {
  friends: OverviewFriend[];
  incoming: (FriendCard & { requestId: string; via: RequestVia; at: string })[];
  outgoing: string[];
  invites: (FriendCard & { code: string; at: string })[];
  challenges: (FriendCard & { code: string; at: string; expiresAt: string })[];
  blocked: { id: string; username: string }[];
  count: number;
  cap: number;
  showOnline: boolean;
  showOnlineSetting: boolean | null;
  adult: boolean;
}

export interface FriendProfile {
  card: FriendCard;
  relation: "self" | "friends" | "requested" | "incoming" | "none" | "blocked";
  requestId: string | null;
  status: FriendStatus | null;
  headToHead: HeadToHead | null;
  myRoom: { code: string } | null;
}

/** A jsonb answer read as the shape the SQL builds (the SQL is the one place that shape is made). */
function jsonAs<T>(value: Json | null | undefined): T | null {
  return value === null || value === undefined ? null : (value as unknown as T);
}

export async function searchPlayers(client: Db, userId: string, query: string, limit: number): Promise<Result<SearchHit[]>> {
  const { data, error } = await client.rpc("friends_search", { p_user: userId, p_query: query, p_limit: limit });
  return { data: jsonAs<SearchHit[]>(data) ?? [], error };
}

export async function sendFriendRequest(
  client: Db,
  input: { from: string; to: string; via: RequestVia; cap: number },
): Promise<Result<SendAnswer | null>> {
  const { data, error } = await client.rpc("friends_send_request", {
    p_from: input.from,
    p_to: input.to,
    p_via: input.via,
    p_cap: input.cap,
  });
  return { data: jsonAs<SendAnswer>(data), error };
}

export async function respondToRequest(
  client: Db,
  input: { userId: string; requestId: string; accept: boolean; cap: number },
): Promise<Result<RespondAnswer | null>> {
  const { data, error } = await client.rpc("friends_respond", {
    p_user: input.userId,
    p_request: input.requestId,
    p_accept: input.accept,
    p_cap: input.cap,
  });
  return { data: jsonAs<RespondAnswer>(data), error };
}

export async function removeFriendship(client: Db, userId: string, friendId: string): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("friends_remove", { p_user: userId, p_friend: friendId });
  return { data: data === true, error };
}

export async function blockPlayer(client: Db, userId: string, targetId: string): Promise<Result<BlockAnswer | null>> {
  const { data, error } = await client.rpc("friends_block", { p_user: userId, p_target: targetId });
  return { data: jsonAs<BlockAnswer>(data), error };
}

export async function unblockPlayer(client: Db, userId: string, targetId: string): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("friends_unblock", { p_user: userId, p_target: targetId });
  return { data: data === true, error };
}

/** The caller's invite token (their current one, or `token` when they have none or reset); null for a guest. */
export async function inviteToken(
  client: Db,
  input: { userId: string; token: string; reset: boolean },
): Promise<Result<string | null>> {
  const { data, error } = await client.rpc("friends_invite_token", {
    p_user: input.userId,
    p_token: input.token,
    p_reset: input.reset,
  });
  return { data: typeof data === "string" ? data : null, error };
}

export async function linkOwner(client: Db, token: string): Promise<Result<FriendCard | null>> {
  const { data, error } = await client.rpc("friends_link_owner", { p_token: token });
  return { data: jsonAs<FriendCard>(data), error };
}

export async function setShowOnline(client: Db, userId: string, show: boolean | null): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("friends_set_show_online", { p_user: userId, p_show: show });
  return { data: data === true, error };
}

export async function presenceBeat(client: Db, userId: string, activity: "app" | "practice"): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("friends_presence_beat", { p_user: userId, p_activity: activity });
  return { data: data === true, error };
}

export async function inviteToRoom(client: Db, from: string, to: string): Promise<Result<InviteAnswer | null>> {
  const { data, error } = await client.rpc("friends_room_invite", { p_from: from, p_to: to });
  return { data: jsonAs<InviteAnswer>(data), error };
}

export async function sendChallenge(client: Db, from: string, to: string, code: string): Promise<Result<ChallengeSendAnswer | null>> {
  const { data, error } = await client.rpc("friends_challenge_send", { p_from: from, p_to: to, p_code: code });
  return { data: jsonAs<ChallengeSendAnswer>(data), error };
}

/** Whether two players are friends (and neither has blocked the other). */
export async function readAreFriends(client: Db, a: string, b: string): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("friends_are_friends", { p_a: a, p_b: b });
  return { data: data === true, error };
}

export async function readOverview(client: Db, userId: string, cap: number): Promise<Result<Overview | null>> {
  const { data, error } = await client.rpc("friends_overview", { p_user: userId, p_cap: cap });
  return { data: jsonAs<Overview>(data), error };
}

export async function readWaitingCount(client: Db, userId: string): Promise<Result<number>> {
  const { data, error } = await client.rpc("friends_waiting", { p_user: userId });
  return { data: typeof data === "number" ? data : 0, error };
}

export async function readFriendProfile(client: Db, viewer: string, target: string): Promise<Result<FriendProfile | null>> {
  const { data, error } = await client.rpc("friends_profile", { p_viewer: viewer, p_target: target });
  return { data: jsonAs<FriendProfile>(data), error };
}

/**
 * A report about a player from their profile (no room, no message), through wave 1's report function: the same
 * counting (one a reporter a player a UK day), the same automatic mute and the same review list.
 */
export async function insertPlayerReport(
  client: Db,
  row: { reporterId: string; reportedId: string; reason: ReportReason; reportedName: string | null },
): Promise<Result<ReportFiled | null>> {
  const { data, error } = await client.rpc("file_room_report", {
    p_duel_id: null,
    p_message_id: null,
    p_reporter_user_id: row.reporterId,
    p_reported_user_id: row.reportedId,
    p_reason: row.reason,
    p_message_text: null,
    p_reported_name: row.reportedName,
  });
  if (error || !data || typeof data !== "object") return { data: null, error };
  const filed = data as { counts?: unknown; muted?: unknown };
  return { data: { counts: filed.counts === true, muted: filed.muted === true }, error: null };
}
