/**
 * The phone's side of tournaments (wave 4, W4b; docs/tournaments/interface.md section 3): one backend over the server
 * functions, a hub hook and small helpers for the screens. Nothing here decides a place, a prize or an entry: the
 * server does, and the phone shows what it answers.
 *
 * A browser under automation (navigator.webdriver: the repo's browser checks) never calls the server from here unless
 * the page sets window.__DUELZ_ALLOW_TOURNAMENTS__ (read through checkOverride); checks may also stand in for the server with
 * setTournamentsBackend. The check-only switch is read only outside production: a production build replaces
 * `import.meta.env.PROD` with true, so on joulz.uk it is never read (tournaments-check proves the built bundle).
 * Until the hub answers, the Tournaments tab shows exactly what it showed before (public games), so every existing
 * screen check is unchanged.
 */
import { useCallback, useEffect, useState } from "react";

import { checkOverride } from "@/lib/checkOverride";

import type { ArenaBoard, ArenaPoll, EnterOutcome, ScoreAttackBoard, TournamentEventView, TournamentHub, TrophyView } from "./types";

export interface TournamentsBackend {
  hub(): Promise<TournamentHub | null>;
  event(eventId: string): Promise<TournamentEventView | null>;
  enter(eventId: string, entry: string): Promise<EnterOutcome>;
  remind(eventId: string, on: boolean): Promise<{ ok: boolean; reminded: boolean }>;
  arenaReady(eventId: string): Promise<ArenaPoll>;
  arenaPoll(eventId: string): Promise<ArenaPoll | null>;
  arenaLeave(eventId: string): Promise<void>;
  arenaBoard(eventId: string): Promise<ArenaBoard | null>;
  scoreAttackStart(eventId: string): Promise<{ ok: true; roomId: string } | { ok: false; message: string }>;
  scoreAttackBoard(eventId: string): Promise<ScoreAttackBoard | null>;
  trophies(): Promise<TrophyView[]>;
}

let injected: TournamentsBackend | null = null;

/** Checks stand in for the server (null: back to the real one). */
export function setTournamentsBackend(next: TournamentsBackend | null): void {
  injected = next;
}

/** Whether this is a browser under automation that hasn't asked for tournaments (the repo's browser checks). */
export function tournamentsAutomated(): boolean {
  if (typeof window === "undefined") return true;
  if (typeof navigator === "undefined" || navigator.webdriver !== true) return false;
  if (import.meta.env.PROD) return true;
  return checkOverride<boolean>("__DUELZ_ALLOW_TOURNAMENTS__") !== true;
}

const unbusy = <T>(value: T | { busy: true } | null | undefined): T | null =>
  value && typeof value === "object" && "busy" in value ? null : ((value ?? null) as T | null);

async function real(): Promise<TournamentsBackend> {
  const fns = await import("./tournaments.functions");
  return {
    hub: async () => unbusy(await fns.tournamentHubFn()),
    event: async (eventId) => fns.tournamentEventFn({ data: { eventId } }),
    enter: async (eventId, entry) => fns.tournamentEnterFn({ data: { eventId, entry } }),
    remind: async (eventId, on) => fns.tournamentRemindFn({ data: { eventId, on } }),
    arenaReady: async (eventId) => fns.arenaReadyFn({ data: { eventId } }),
    arenaPoll: async (eventId) => unbusy(await fns.arenaPollFn({ data: { eventId } })),
    arenaLeave: async (eventId) => {
      await fns.arenaLeaveFn({ data: { eventId } });
    },
    arenaBoard: async (eventId) => unbusy(await fns.arenaBoardFn({ data: { eventId } })),
    scoreAttackStart: async (eventId) => fns.scoreAttackStartFn({ data: { eventId } }),
    scoreAttackBoard: async (eventId) => unbusy(await fns.scoreAttackBoardFn({ data: { eventId } })),
    trophies: async () => fns.myTrophiesFn(),
  };
}

/** The backend to call, or null (automation without the switch: nothing is called). */
export async function tournamentsBackend(): Promise<TournamentsBackend | null> {
  if (injected) return injected;
  if (tournamentsAutomated()) return null;
  try {
    return await real();
  } catch {
    return null;
  }
}

/** The hub for the Tournaments tab: null until (and unless) the server answers with tournaments open. */
export function useTournamentHub(): { hub: TournamentHub | null; refresh: () => void } {
  const [hub, setHub] = useState<TournamentHub | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    void (async () => {
      const b = await tournamentsBackend();
      if (!b) return;
      try {
        const answer = await b.hub();
        if (live && answer && answer.open) setHub(answer);
      } catch {
        // offline or refused: the tab keeps what it shows
      }
    })();
    return () => {
      live = false;
    };
  }, [tick]);
  return { hub, refresh };
}

/** One event for its page (re-read with `refresh`). */
export function useTournamentEvent(eventId: string): { event: TournamentEventView | null; loaded: boolean; refresh: () => void } {
  const [event, setEvent] = useState<TournamentEventView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    void (async () => {
      const b = await tournamentsBackend();
      if (!b) {
        if (live) setLoaded(true);
        return;
      }
      try {
        const answer = await b.event(eventId);
        if (live) setEvent(answer);
      } catch {
        // keep what is shown
      } finally {
        if (live) setLoaded(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [eventId, tick]);
  return { event, loaded, refresh };
}

/** The caller's trophies (Profile's cabinet): empty until the server answers, and for anyone with none. */
export function useMyTrophies(enabled: boolean): TrophyView[] {
  const [trophies, setTrophies] = useState<TrophyView[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void (async () => {
      const b = await tournamentsBackend();
      if (!b) return;
      try {
        const answer = await b.trophies();
        if (live && Array.isArray(answer)) setTrophies(answer);
      } catch {
        // none shown
      }
    })();
    return () => {
      live = false;
    };
  }, [enabled]);
  return trophies;
}

/* ------------------------------------------------------------------ words for screens */

/** "Free", "50 coins", "Score Attack ticket", "Category Cup ticket". */
export function entryLabel(entry: string, coins: number): string {
  if (entry === "free") return "Free";
  if (entry === "coins") return `${coins.toLocaleString("en-GB")} coins`;
  if (entry === "ticket_score_attack") return "Score Attack ticket";
  if (entry === "ticket_category_cup") return "Category Cup ticket";
  return entry;
}

/** "18:22" from milliseconds (minutes and seconds; hours when long). */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
