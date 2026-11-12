/**
 * Practice challenges on the phone (wave 2 C1b): the server's progress for the lists, and the queue of completion
 * moments. Nothing here completes a challenge: completion and coins happen only in the server's grading of a Practice
 * run (src/lib/challenges/challenges.server.ts); the phone only shows what the server answered.
 *
 * The completion moment never covers a result (wave 1's rule): a graded run's completions are queued on the device
 * and shown on the Practice list, the tab page the player returns to, never over a round, its reveal or any result.
 *
 * Under automation (the checks' browsers) the server isn't asked unless the page sets
 * `window.__DUELZ_ALLOW_CHALLENGES__`; checks may also hand the lists an answer through `window.__DUELZ_CHALLENGES__`.
 */
import { useEffect, useState } from "react";

import { checkOverride } from "@/lib/checkOverride";

/** One challenge's state from the server (getMyChallengesFn's row). */
export interface ServerChallengeRow {
  id: string;
  best: number;
  done: boolean;
  doneAt: string | null;
  coins: number;
  paid: boolean;
}

export interface ServerChallenges {
  account: boolean;
  rows: ServerChallengeRow[];
}

/** A completion the server reported on a graded run. */
export interface ChallengeMoment {
  id: string;
  coins: number;
  paid: boolean;
}

export const CHALLENGE_MOMENTS_KEY = "duelz-challenge-moments:v1";
/** The most moments kept waiting (a long offline sync can complete many at once). */
const MOMENTS_MAX = 12;


function cleanMoments(raw: unknown): ChallengeMoment[] {
  if (!Array.isArray(raw)) return [];
  const out: ChallengeMoment[] = [];
  for (const m of raw) {
    const x = m as Partial<ChallengeMoment> | null;
    if (!x || typeof x.id !== "string" || !/^[a-z0-9]+\.[a-z0-9-]+$/.test(x.id)) continue;
    out.push({ id: x.id, coins: x.coins === 100 || x.coins === 250 ? x.coins : 0, paid: x.paid === true });
  }
  return out.slice(-MOMENTS_MAX);
}

/** Queues the completions a graded run returned (from the server's answer only). */
export function queueChallengeMoments(list: unknown): void {
  const add = cleanMoments(list);
  if (!add.length) return;
  try {
    const now = cleanMoments(JSON.parse(window.localStorage.getItem(CHALLENGE_MOMENTS_KEY) ?? "[]"));
    const ids = new Set(now.map((m) => m.id));
    window.localStorage.setItem(CHALLENGE_MOMENTS_KEY, JSON.stringify([...now, ...add.filter((m) => !ids.has(m.id))].slice(-MOMENTS_MAX)));
  } catch {
    /* Storage blocked: the list still shows the challenge as done. */
  }
}

/** Takes the waiting moments (once): the Practice list shows them. */
export function takeChallengeMoments(): ChallengeMoment[] {
  try {
    const raw = window.localStorage.getItem(CHALLENGE_MOMENTS_KEY);
    window.localStorage.removeItem(CHALLENGE_MOMENTS_KEY);
    return cleanMoments(JSON.parse(raw ?? "[]"));
  } catch {
    return [];
  }
}

function serverAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (navigator.webdriver && !checkOverride("__DUELZ_ALLOW_CHALLENGES__")) return false;
  return navigator.onLine !== false;
}

/** The caller's challenge progress from the server, or null (offline, busy, under automation, or no answer yet). */
export async function fetchServerChallenges(): Promise<ServerChallenges | null> {
  const stand = checkOverride<ServerChallenges>("__DUELZ_CHALLENGES__");
  if (stand) return stand;
  if (!serverAllowed()) return null;
  try {
    const { getMyChallengesFn } = await import("./challenges.functions");
    const answer = await getMyChallengesFn();
    if (!answer || "busy" in answer) return null;
    return answer;
  } catch {
    return null;
  }
}

/**
 * The server's progress for a list: null until (and unless) it answers; asked again each time `refresh` changes
 * (Practice passes whether its list is on screen), never while it is false.
 */
export function useServerChallenges(refresh: unknown = true): ServerChallenges | null {
  const [state, setState] = useState<ServerChallenges | null>(null);
  useEffect(() => {
    if (refresh === false) return;
    let live = true;
    void fetchServerChallenges().then((answer) => {
      if (live && answer) setState(answer);
    });
    return () => {
      live = false;
    };
  }, [refresh]);
  return state;
}
