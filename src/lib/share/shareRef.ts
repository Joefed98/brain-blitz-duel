/**
 * The share loop's beta counts on the phone: a Share tap, an arrival from a shared link (?ref=share)
 * and whether that visitor then finishes a room. Each goes to recordShareEventFn
 * (share.functions.ts), fire-and-forget: a failure (offline, the migration not applied yet) is
 * ignored and nothing on screen waits for it.
 *
 * An arrival is counted once per device (the first shared link it opens), remembered in device
 * storage; the first room that device then sees to its final screen is counted once as
 * arrival_finished.
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
}

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

/**
 * On a page load: counts an arrival from a shared link once per device. Returns true when it
 * counted one (the root route calls it once per load).
 */
export function noteShareArrival(
  location: { search: string; pathname: string },
  record: ShareRecorder = sendShareEvent,
  now: number = Date.now(),
): boolean {
  if (!isShareRef(location.search) || readShareArrival()) return false;
  const code = /^\/duel\/([A-Za-z]{4})\/?$/.exec(location.pathname)?.[1]?.toUpperCase() ?? null;
  const arrival: ShareArrival = { at: now, landing: code ? "room" : "home", roomCode: code };
  writeShareArrival(arrival);
  record({ event: "arrival", landing: arrival.landing, roomCode: arrival.roomCode });
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
}
