/**
 * The phone's view of its seasons (wave 4, session W4d; docs/seasons/README.md): the season peak and history on
 * Profile, and the reward notice on the tab pages. Nothing here decides a rule: the server answers what was held and
 * what was granted. Accounts only (a guest has no season).
 *
 * A browser under automation (navigator.webdriver: the repo's browser checks) never calls the server from here unless
 * the page sets window.__DUELZ_ALLOW_SEASONS__, which is never read in a production build (import.meta.env.PROD);
 * checks may also stand in for the server with setSeasonsBackend.
 */
import { useEffect, useState } from "react";

import { useAccount } from "@/lib/account/accountApi";

import type { MySeasons, SeasonHistoryEntry } from "./types";

export interface SeasonsBackend {
  mine(): Promise<MySeasons | { busy: true }>;
  seen(season: string): Promise<{ ok: boolean }>;
}

let injected: SeasonsBackend | null = null;

/** Checks stand in for the server (null: back to the real one). */
export function setSeasonsBackend(backend: SeasonsBackend | null): void {
  injected = backend;
  resetSeasons();
}

/**
 * A browser under automation that hasn't asked for seasons (the repo's browser checks). The check-only switch is read
 * only outside production: a production build replaces `import.meta.env.PROD` with true, so on joulz.uk it is never
 * read (seasons-screens-check proves the guard).
 */
export function seasonsAutomated(): boolean {
  if (typeof window === "undefined") return true;
  if (typeof navigator === "undefined" || navigator.webdriver !== true) return false;
  if (import.meta.env.PROD) return true;
  return (window as { __DUELZ_ALLOW_SEASONS__?: boolean }).__DUELZ_ALLOW_SEASONS__ !== true;
}

async function backend(): Promise<SeasonsBackend | null> {
  if (injected) return injected;
  if (seasonsAutomated()) return null;
  try {
    const fns = await import("./seasons.functions");
    return {
      mine: () => fns.getMySeasonsFn(),
      seen: (season) => fns.seasonRewardSeenFn({ data: { season } }),
    };
  } catch {
    return null;
  }
}

export interface SeasonsState {
  /** Whether the server answered. */
  live: boolean;
  seasons: MySeasons | null;
}

const EMPTY: SeasonsState = { live: false, seasons: null };
let current: SeasonsState = EMPTY;
let loading: Promise<SeasonsState> | null = null;
let readAt = 0;
const READ_AGAIN_MS = 60_000;
const listeners = new Set<(v: SeasonsState) => void>();

function publish(next: SeasonsState): SeasonsState {
  current = next;
  for (const fn of listeners) fn(next);
  return next;
}

export function refreshSeasons(): Promise<SeasonsState> {
  const run = (async () => {
    const b = await backend();
    if (!b) return publish(EMPTY);
    try {
      const answer = await b.mine();
      if (!answer || "busy" in answer) {
        loading = null;
        return publish(current.live ? current : EMPTY);
      }
      readAt = Date.now();
      return publish({ live: true, seasons: answer });
    } catch {
      loading = null;
      return publish(current.live ? current : EMPTY);
    }
  })();
  loading = run;
  return run;
}

/** The signed-in account's seasons (EMPTY for a guest or before the account is known). */
export function useMySeasons(): SeasonsState {
  const account = useAccount();
  const [state, setState] = useState<SeasonsState>(current);
  const isAccount = account.kind === "account";
  useEffect(() => {
    if (!isAccount) return;
    listeners.add(setState);
    if (!loading || (readAt > 0 && Date.now() - readAt > READ_AGAIN_MS)) void refreshSeasons();
    else setState(current);
    return () => {
      listeners.delete(setState);
    };
  }, [isAccount]);
  return isAccount ? state : EMPTY;
}

export function resetSeasons(): void {
  loading = null;
  readAt = 0;
  publish(EMPTY);
}

/** The oldest season reward whose notice hasn't been shown. */
export function unseenSeasonReward(state: SeasonsState): SeasonHistoryEntry | null {
  if (!state.live || !state.seasons?.account) return null;
  return state.seasons.history.find((h) => !h.seen) ?? null;
}

/** The notice was shown (or closed): drop it here and on the server. */
export async function markSeasonRewardShown(season: string): Promise<void> {
  const mine = current.seasons;
  if (mine?.account) {
    publish({ ...current, seasons: { ...mine, history: mine.history.map((h) => (h.season === season ? { ...h, seen: true } : h)) } });
  }
  const b = await backend();
  try {
    await b?.seen(season);
  } catch {
    // Shown again next open; harmless.
  }
}
