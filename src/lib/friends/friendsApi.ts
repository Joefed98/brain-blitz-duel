/**
 * Friends on the phone (wave 2 B1; docs/friends.md): the server calls the screens use, the badge's count, the pending
 * invite token (a link opened before sign-up) and the app's presence heartbeat. Nothing here decides a rule; the
 * server answers.
 */
import { useEffect, useState } from "react";

import type { FriendCard, FriendProfile, Overview, SearchHit } from "@/lib/data/friends.server";
import type { ReportReason } from "@/lib/safety/reports";

import { PENDING_INVITE_KEY, PRESENCE_BEAT_MS, inviteTokenFrom, refusal, type FriendsRefusal } from "./friends";

export type { FriendCard, FriendProfile, Overview, SearchHit };

type Answer<T> = ({ ok: true } & T) | FriendsRefusal;

type Functions = typeof import("./friends.functions");
let override: Partial<Functions> | null = null;

/** Checks only: stands in for the server functions (friends-ui-check); null puts the real ones back. */
export function setFriendsFunctionsForChecks(stand: Partial<Functions> | null): void {
  override = stand;
}

async function fns(): Promise<Functions> {
  if (override) return override as Functions;
  return import("./friends.functions");
}

/** Runs a call; a network failure answers the plain "can't reach us" refusal. */
async function call<T>(run: () => Promise<Answer<T>>): Promise<Answer<T>> {
  try {
    return await run();
  } catch {
    return refusal("error");
  }
}

export const friendsApi = {
  overview: () => call(async () => (await fns()).friendsOverviewFn() as Promise<Answer<{ overview: Overview }>>),
  profile: (playerId: string) =>
    call(async () => (await fns()).friendProfileFn({ data: { playerId } }) as Promise<Answer<{ profile: FriendProfile }>>),
  search: (query: string) =>
    call(async () => (await fns()).friendSearchFn({ data: { query } }) as Promise<Answer<{ results: SearchHit[] }>>),
  request: (playerId: string) =>
    call(async () => (await fns()).friendRequestFn({ data: { playerId } }) as Promise<Answer<{ outcome: string }>>),
  requestByLink: (token: string) =>
    call(async () => (await fns()).friendLinkRequestFn({ data: { token } }) as Promise<Answer<{ outcome: string; owner: FriendCard }>>),
  respond: (requestId: string, accept: boolean) =>
    call(async () => (await fns()).friendRespondFn({ data: { requestId, accept } }) as Promise<Answer<{ outcome: string }>>),
  remove: (playerId: string) =>
    call(async () => (await fns()).friendRemoveFn({ data: { playerId } }) as Promise<Answer<{ removed: boolean }>>),
  block: (playerId: string) =>
    call(async () => (await fns()).friendBlockFn({ data: { playerId } }) as Promise<Answer<{ removed: boolean }>>),
  unblock: (playerId: string) =>
    call(async () => (await fns()).friendUnblockFn({ data: { playerId } }) as Promise<Answer<{ unblocked: boolean }>>),
  report: (playerId: string, reason: ReportReason) =>
    call(async () => (await fns()).friendReportFn({ data: { playerId, reason } }) as Promise<Answer<{ message: string }>>),
  invite: (playerId: string) =>
    call(async () => (await fns()).friendInviteFn({ data: { playerId } }) as Promise<Answer<{ code: string }>>),
  challenge: (playerId: string, code: string) =>
    call(async () => (await fns()).friendChallengeFn({ data: { playerId, code } }) as Promise<Answer<{ sent: true }>>),
  myLink: (reset = false) =>
    call(async () => (await fns()).friendLinkFn({ data: { reset } }) as Promise<Answer<{ token: string; link: string }>>),
  linkOwner: (token: string) =>
    call(async () => (await fns()).friendLinkOwnerFn({ data: { token } }) as Promise<Answer<{ owner: FriendCard | null }>>),
  setShowOnline: (show: boolean | null) =>
    call(async () => (await fns()).friendShowOnlineFn({ data: { show } }) as Promise<Answer<{ showOnline: boolean }>>),
};

/* ------------------------------------------------------------------ the badge */

/** How many friend requests wait for this account (0 for a guest, and until the server answers). */
export function useWaitingRequests(enabled: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void (async () => {
      try {
        const n = await (await fns()).friendsWaitingFn();
        if (live && typeof n === "number") setCount(n);
      } catch {
        /* no badge */
      }
    })();
    return () => {
      live = false;
    };
  }, [enabled]);
  return count;
}

/* ------------------------------------------------------------------ a link opened before sign-up */

function store(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Keeps a link's token until this device has an account (sign-up, then the request is sent). */
export function rememberInvite(token: string): void {
  try {
    store()?.setItem(PENDING_INVITE_KEY, JSON.stringify({ token, at: Date.now() }));
  } catch {
    /* storage blocked: the link still works when opened again */
  }
}

/** The kept token (a week at most), or null. */
export function pendingInvite(): string | null {
  try {
    const raw = store()?.getItem(PENDING_INVITE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { token?: unknown; at?: unknown };
    if (typeof p.at !== "number" || Date.now() - p.at > 7 * 86_400_000) return null;
    return inviteTokenFrom(p.token);
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    store()?.removeItem(PENDING_INVITE_KEY);
  } catch {
    /* nothing kept */
  }
}

/* ------------------------------------------------------------------ the heartbeat */

/**
 * The app's presence for friends' statuses: while a signed-in device has the app open and visible, one beat a minute
 * ("practice" on the Practice tab and its rounds, else "app"). Rooms keep their own heartbeat (duel_presence), which the
 * server reads too. Guests never beat (the device's account copy decides, so a guest makes no call at all), nor does a
 * browser under automation unless a check allows it.
 */
export function startPresence(isAccount: () => boolean, activity: () => "app" | "practice"): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as unknown as { __DUELZ_ALLOW_PRESENCE__?: boolean };
  if (navigator.webdriver && !w.__DUELZ_ALLOW_PRESENCE__) return () => {};
  let timer: number | undefined;
  const beat = async () => {
    if (document.visibilityState !== "visible" || !isAccount()) return;
    try {
      await (await fns()).friendBeatFn({ data: { activity: activity() } });
    } catch {
      /* the next beat tries again */
    }
  };
  const schedule = () => {
    window.clearInterval(timer);
    if (document.visibilityState === "visible") {
      void beat();
      timer = window.setInterval(() => void beat(), PRESENCE_BEAT_MS);
    }
  };
  document.addEventListener("visibilitychange", schedule);
  schedule();
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", schedule);
  };
}
