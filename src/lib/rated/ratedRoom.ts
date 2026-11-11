/**
 * Which room is a rated match (wave 3, session W3c). W3b plays a rated match as an ordinary room on the existing room
 * route; the rated screens note the room's code and match id here (sessionStorage, this tab) as they open it, so the
 * room route draws the rated header score and hands the finished room to the rated result. Device storage only: the
 * room itself, its grading and its phases are W3b's and the room's own, unchanged.
 *
 * And the live arcade score for the header: an arcade stage publishes its sim's own running score here once a second
 * while a rated room asks for it (display only; read, never written back to the sim).
 */
import { useEffect, useState } from "react";

const KEY = "duelz-rated-room:v1:";

function store(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Notes that the room `code` plays rated match `matchId` (before opening it). */
export function noteRatedRoom(code: string, matchId: string): void {
  try {
    store()?.setItem(KEY + code.toUpperCase(), matchId);
  } catch {
    /* storage blocked */
  }
}

/** The rated match the room `code` plays, if this tab opened it as one. */
export function ratedMatchForRoom(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return store()?.getItem(KEY + code.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

/** The room's rated match id (null for every ordinary room: nothing changes there). */
export function useRatedRoom(code: string | null | undefined): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    setId(ratedMatchForRoom(code));
  }, [code]);
  return id;
}

/* ------------------------------------------------------------------ the live arcade score (display only) */

let wanted = 0;
let live: number | null = null;

/** A rated header is up: arcade stages should publish their running score. Returns the release. */
export function wantLiveScore(): () => void {
  wanted += 1;
  live = null;
  return () => {
    wanted = Math.max(0, wanted - 1);
    if (!wanted) live = null;
  };
}

export function liveScoreWanted(): boolean {
  return wanted > 0;
}

export function publishLiveScore(score: number | null): void {
  live = score !== null && Number.isFinite(score) ? Math.max(0, Math.round(score)) : null;
}

export function readLiveScore(): number | null {
  return live;
}
