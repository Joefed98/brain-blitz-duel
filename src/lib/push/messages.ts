/**
 * What each notification says and opens (wave 2 train B, session B2). Short, plain and useful; never a score, an
 * answer, a price or a nudge to buy. The only name shown is the friend's username (accounts' public name).
 */

import { OPENED_PARAM, type PushEvent } from "./rules";

/** The payload the service worker shows (sw.push.js). */
export interface PushPayload {
  event: PushEvent;
  title: string;
  body: string;
  /** A same-site path, opened on a tap (with ?notif=<event> added). */
  url: string;
  /** Notifications with the same tag replace each other on the phone. */
  tag: string;
}

export interface MessageInput {
  /** The friend's username (friend events, invites, challenges). */
  from?: string | null;
  /** A room code (invites) or challenge code (challenges). */
  code?: string | null;
  /** A tournament's name (wave 4). */
  title?: string | null;
  /** The current streak (the reminder). */
  streak?: number | null;
}

const clip = (s: string | null | undefined, n: number) => (s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, n).trim();
const CODE_RE = /^[A-Za-z0-9]{4,8}$/;

/** The notification for one event. */
export function messageFor(event: PushEvent, input: MessageInput = {}): PushPayload {
  const from = clip(input.from, 20) || "A friend";
  const code = typeof input.code === "string" && CODE_RE.test(input.code) ? input.code.toUpperCase() : null;
  switch (event) {
    case "friend_request":
      return { event, title: "New friend request", body: `${from} wants to be friends on Joulz.`, url: "/profile", tag: "friend-request" };
    case "friend_accepted":
      return { event, title: "Friend request accepted", body: `You and ${from} are now friends.`, url: "/profile", tag: "friend-accepted" };
    case "friend_challenge":
      return {
        event,
        title: `${from} challenged you`,
        body: "Can you beat their score?",
        url: code ? `/challenge?code=${code}` : "/",
        tag: code ? `challenge-${code}` : "challenge",
      };
    case "room_invite":
      return {
        event,
        title: `${from} invited you to a room`,
        body: code ? `Room ${code} is waiting. Tap to join.` : "Tap to join.",
        url: code ? `/duel/${code}` : "/",
        tag: code ? `invite-${code}` : "invite",
      };
    case "tournament_starting":
      return {
        event,
        title: "Your tournament is starting",
        body: clip(input.title, 60) ? `${clip(input.title, 60)} starts soon.` : "It starts soon.",
        url: "/tournaments",
        tag: "tournament",
      };
    case "daily_streak": {
      const n = typeof input.streak === "number" && input.streak > 1 ? Math.floor(input.streak) : null;
      return {
        event,
        title: "Keep your Daily streak going",
        body: n ? `You’re on ${n} days. Today’s Daily closes at midnight.` : "Today’s Daily closes at midnight.",
        url: "/daily",
        tag: "daily-streak",
      };
    }
  }
}

/** A tap's link: the path with ?notif=<event> (notification_opened). */
export function openedUrl(payload: Pick<PushPayload, "url" | "event">): string {
  const sep = payload.url.includes("?") ? "&" : "?";
  return `${payload.url}${sep}${OPENED_PARAM}=${payload.event}`;
}
