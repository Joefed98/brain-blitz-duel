/**
 * The share loop's beta counts on the phone: a Share tap, an arrival from a shared link (?ref=share)
 * and whether that visitor then finishes a room. Each goes to recordShareEventFn
 * (share.functions.ts), fire-and-forget: a failure (offline, the migration not applied yet) is
 * ignored and nothing on screen waits for it.
 *
 * An arrival is counted once per device (the first shared link it opens), remembered in device
 * storage; the first room that device then sees to its final screen is counted once as
 * arrival_finished.
 *
 * A shared link is always a room's (roomShare.ts); when it's opened, JoinFromLink sends a newcomer
 * to the lobby while they can join, else to the home (?ref=share&room=CODE).
 * An arrival that lands on the home (not a room's lobby, which is its own welcome) sees the Play
 * tab's one-time welcome card (ShareWelcomeCard) on that visit only; it's counted as arrival_welcome:
 * "shown" once, then "dismissed", "practice" or "public" once.
 */
import type { ShareEventInput } from "@/lib/duel/share.functions";

import { SHARE_REF } from "./roomShare";

const ARRIVAL_KEY = "duelz-share-arrival:v1";

export interface ShareArrival {
  at: number;
  landing: "home" | "room";
  roomCode: string | null;
  /** Set once the arrival's first finished room is counted. */
  finished?: boolean;
  /** The welcome card: "shown", then how it was closed. */
  welcome?: "shown" | WelcomeOutcome;
}

/** How a shared-link arrival closed the welcome card: the ✕, or one of its two buttons. */
export type WelcomeOutcome = "dismissed" | "practice" | "public";

export type ShareRecorder = (event: ShareEventInput) => void;

/** Sends one event to the server after making sure the device has its session; never throws. */
export const sendShareEvent: ShareRecorder = (event) => {
  void (async () => {
    try {
      const { ensureSession } = await import("@/lib/duel/session");
      await ensureSession();
      const { recordShareEventFn } = await import("@/lib/duel/share.functions");
      await recordShareEventFn({ data: event });
    } catch {
      /* beta counts never get in the way */
    }
  })();
};

let memory: ShareArrival | null | undefined;
/** True when this page load is the device's arrival from a shared link. */
let arrivedThisLoad = false;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readShareArrival(): ShareArrival | null {
  if (memory !== undefined) return memory;
  try {
    const raw = JSON.parse(storage()?.getItem(ARRIVAL_KEY) ?? "null") as ShareArrival | null;
    memory = raw && Number.isFinite(raw.at) ? raw : null;
  } catch {
    memory = null;
  }
  return memory;
}

function writeShareArrival(arrival: ShareArrival): void {
  memory = arrival;
  try {
    storage()?.setItem(ARRIVAL_KEY, JSON.stringify(arrival));
  } catch {
    /* this visit only when storage is blocked */
  }
}

/** True when a page's query says it was opened from a shared link. */
export function isShareRef(search: string): boolean {
  try {
    return new URLSearchParams(search).get("ref") === SHARE_REF;
  } catch {
    return false;
  }
}

const ROOM_CODE = /^[A-Za-z]{4}$/;

function writeArrival(arrival: ShareArrival, record: ShareRecorder): void {
  writeShareArrival(arrival);
  arrivedThisLoad = true;
  record({ event: "arrival", landing: arrival.landing, roomCode: arrival.roomCode });
}

/**
 * On a page load: counts an arrival from a shared link on the home once per device (`room` is the
 * room whose link redirected here). Returns true when it counted one. A room link (/duel/CODE) is
 * not counted here: where it leads is decided once the room is known (noteShareLobbyArrival, or a
 * redirect to the home that is counted here).
 */
export function noteShareArrival(
  location: { search: string; pathname: string },
  record: ShareRecorder = sendShareEvent,
  now: number = Date.now(),
): boolean {
  if (!isShareRef(location.search) || readShareArrival()) return false;
  if (/^\/duel\//.test(location.pathname)) return false;
  let room: string | null = null;
  try {
    room = new URLSearchParams(location.search).get("room");
  } catch {
    /* no room */
  }
  writeArrival(
    {
      at: now,
      landing: "home",
      roomCode: room && ROOM_CODE.test(room) ? room.toUpperCase() : null,
    },
    record,
  );
  return true;
}

/** A shared room link opened while a newcomer can join: counts the arrival as landing in the lobby. */
export function noteShareLobbyArrival(
  roomCode: string,
  record: ShareRecorder = sendShareEvent,
  now: number = Date.now(),
): boolean {
  if (readShareArrival()) return false;
  writeArrival(
    {
      at: now,
      landing: "room",
      roomCode: ROOM_CODE.test(roomCode) ? roomCode.toUpperCase() : null,
    },
    record,
  );
  return true;
}

/**
 * Where a shared room link leads, decided when it's opened (from the room's preview): true while a
 * newcomer can join (its lobby, not disbanded, a seat free), so they go straight to the lobby's join;
 * false (finished, playing, disbanded, full or not found) sends them to the home with the welcome card.
 */
export function shareLinkJoinable(
  preview:
    { found: false } | { found: true; state: string; playerCount: number; maxPlayers: number },
): boolean {
  return preview.found && preview.state === "lobby" && preview.playerCount < preview.maxPlayers;
}

/** The home's query a shared room link redirects to: ?ref=share&room=CODE. */
export function shareHomeSearch(roomCode: string): { ref: string; room: string } {
  return { ref: SHARE_REF, room: roomCode.toUpperCase() };
}

/**
 * True while the Play tab should show the welcome card: this page load is the device's first
 * arrival from a shared link, it landed on the home, and the card hasn't been closed. Counts the
 * arrival itself first (a child route's effect runs before the root's, and a shared room link's
 * redirect reaches the home without a page load).
 */
export function shareWelcomeDue(
  location: { search: string; pathname: string },
  record: ShareRecorder = sendShareEvent,
): boolean {
  noteShareArrival(location, record);
  const arrival = readShareArrival();
  return (
    arrivedThisLoad &&
    arrival?.landing === "home" &&
    (!arrival.welcome || arrival.welcome === "shown")
  );
}

/** Counts the welcome card being shown (once) or closed (once). Returns true when it counted. */
export function noteShareWelcome(
  welcome: "shown" | WelcomeOutcome,
  record: ShareRecorder = sendShareEvent,
): boolean {
  const arrival = readShareArrival();
  if (!arrival) return false;
  if (welcome === "shown" ? arrival.welcome : arrival.welcome && arrival.welcome !== "shown")
    return false;
  writeShareArrival({ ...arrival, welcome });
  record({ event: "arrival_welcome", welcome });
  return true;
}

/** On a room's final screen: counts a shared-link arrival's first finished room, once. */
export function noteShareFinish(
  room: {
    duelId: string;
    gameIndex: number;
    roomCode: string;
    place: number | null;
    players: number;
    rounds: number;
  },
  record: ShareRecorder = sendShareEvent,
): boolean {
  const arrival = readShareArrival();
  if (!arrival || arrival.finished) return false;
  writeShareArrival({ ...arrival, finished: true });
  record({
    event: "arrival_finished",
    duelId: room.duelId,
    gameIndex: room.gameIndex,
    roomCode: room.roomCode,
    place: room.place,
    players: room.players,
    rounds: room.rounds,
  });
  return true;
}

/** Test hook: forget the in-memory copy (storage is read again). */
export function resetShareArrivalMemory(): void {
  memory = undefined;
  arrivedThisLoad = false;
}
