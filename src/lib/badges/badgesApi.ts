/**
 * The phone's view of its badges, title and Daily record (wave 2, train C, session C2). Shared by Profile, Customise,
 * the player card, the badge-earned moment and the Daily screens. Nothing here decides a rule: the server answers
 * what is earned, what is on the card and what the streak is.
 *
 * - Badges are accounts only (a guest has none; its card has no title).
 * - The first read in an app open is syncMyBadges, which also settles the rewards every account is owed (the sign-up
 *   reward, the Founding Player's badge, coins and frame) and awards any badge earned; later reads reuse it.
 * - The Daily record is the server's (guests too); until it answers, screens show the device's own record.
 *
 * A browser under automation (navigator.webdriver: the repo's browser checks) never calls the server from here unless
 * the page sets window.__DUELZ_ALLOW_BADGES__ (as the safety notices and the offline packs do); checks may also stand
 * in for the server with setBadgesBackend.
 */
import { useEffect, useState } from "react";

import { useAccount } from "@/lib/account/accountApi";
import { dailyStreak, readDailyRecord } from "@/lib/duel/dailyRecord";
import { ukDayKey } from "@/lib/duel/daily";

import type { BadgeChangeResult, DailyAccountRecord, MyBadges } from "./types";

export interface BadgesBackend {
  sync(): Promise<MyBadges | { busy: true }>;
  setCard(badges: string[]): Promise<BadgeChangeResult>;
  setTitle(title: string | null): Promise<BadgeChangeResult>;
  markSeen(badges: string[]): Promise<{ ok: boolean }>;
  dailyRecord(): Promise<DailyAccountRecord | { busy: true }>;
}

let injected: BadgesBackend | null = null;

/** Checks stand in for the server (null: back to the real one). */
export function setBadgesBackend(backend: BadgesBackend | null): void {
  injected = backend;
  resetBadges();
}

function automated(): boolean {
  if (typeof window === "undefined") return true;
  const w = window as { __DUELZ_ALLOW_BADGES__?: boolean };
  return typeof navigator !== "undefined" && navigator.webdriver === true && w.__DUELZ_ALLOW_BADGES__ !== true;
}

async function backend(): Promise<BadgesBackend | null> {
  if (injected) return injected;
  if (automated()) return null;
  try {
    const fns = await import("./badges.functions");
    return {
      sync: () => fns.syncMyBadges(),
      setCard: (badges) => fns.setMyCardBadges({ data: { badges } }),
      setTitle: (title) => fns.setMyTitle({ data: { title } }),
      markSeen: (badges) => fns.markBadgesSeen({ data: { badges } }),
      dailyRecord: () => fns.getMyDailyRecord(),
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ badges */

export interface BadgesState {
  /** Whether the server answered. */
  live: boolean;
  badges: MyBadges | null;
}

const EMPTY: BadgesState = { live: false, badges: null };
let current: BadgesState = EMPTY;
let loading: Promise<BadgesState> | null = null;
/** When the last sync answered; a tab page opened after SYNC_AGAIN_MS syncs again (new badges, progress). */
let syncedAt = 0;
export const SYNC_AGAIN_MS = 60_000;
const listeners = new Set<(v: BadgesState) => void>();

function publish(next: BadgesState): BadgesState {
  current = next;
  for (const fn of listeners) fn(next);
  return next;
}

/**
 * Syncs with the server (settles the rewards every account is owed, awards earned badges) and publishes the answer.
 * A sync that fails or is refused clears `loading`, so the next tab page tries again: the sign-up coins can't be
 * missed for want of one good answer (the server's keys keep a retry from ever paying twice).
 */
export function refreshBadges(): Promise<BadgesState> {
  const run = (async () => {
    const b = await backend();
    if (!b) return publish(EMPTY);
    try {
      const answer = await b.sync();
      if (!answer || "busy" in answer) {
        loading = null;
        return publish(current.live ? current : EMPTY);
      }
      syncedAt = Date.now();
      return publish({ live: true, badges: answer });
    } catch {
      loading = null;
      return publish(current.live ? current : EMPTY);
    }
  })();
  loading = run;
  return run;
}

/**
 * Waits (at most `ms`) for the rewards to be settled before the coin counter reads the balance, so a new account's
 * sign-up coins are in the first balance it shows. Starts a sync if none has run.
 */
export async function rewardsSettled(ms = 4000): Promise<void> {
  const settled = loading ?? refreshBadges();
  await Promise.race([settled.catch(() => undefined), new Promise((r) => setTimeout(r, ms))]);
}

/** The signed-in account's badges (EMPTY for a guest or before the account is known). */
export function useMyBadges(): BadgesState {
  const account = useAccount();
  const [state, setState] = useState<BadgesState>(current);
  const isAccount = account.kind === "account";
  useEffect(() => {
    if (!isAccount) return;
    listeners.add(setState);
    if (!loading || (syncedAt > 0 && Date.now() - syncedAt > SYNC_AGAIN_MS)) void refreshBadges();
    else setState(current);
    return () => {
      listeners.delete(setState);
    };
  }, [isAccount]);
  return isAccount ? state : EMPTY;
}

export function resetBadges(): void {
  loading = null;
  syncedAt = 0;
  publish(EMPTY);
  dailyLoading = null;
  publishDaily(null);
}

function applyChange(answer: BadgeChangeResult): BadgeChangeResult {
  if (!answer.ok) return answer;
  // A save answers no progress (only a sync works it out): keep what the last sync said.
  const kept = current.badges?.account ? current.badges.progress : {};
  publish({ live: true, badges: answer.badges.account ? { ...answer.badges, progress: { ...kept, ...answer.badges.progress } } : answer.badges });
  return answer;
}

const NOT_READY: BadgeChangeResult = { ok: false, reason: "error", message: "Saving isn’t ready yet. Try again soon." };
const OFFLINE: BadgeChangeResult = { ok: false, reason: "error", message: "That didn’t save. Check your connection and try again." };

export async function saveCardBadges(badges: string[]): Promise<BadgeChangeResult> {
  const b = await backend();
  if (!b) return NOT_READY;
  try {
    return applyChange(await b.setCard(badges));
  } catch {
    return OFFLINE;
  }
}

export async function saveTitle(title: string | null): Promise<BadgeChangeResult> {
  const b = await backend();
  if (!b) return NOT_READY;
  try {
    return applyChange(await b.setTitle(title));
  } catch {
    return OFFLINE;
  }
}

/** The badge-earned moment was shown: drop them from `unseen` here and on the server. */
export async function markBadgesShown(slugs: string[]): Promise<void> {
  if (!slugs.length) return;
  const mine = current.badges;
  if (mine?.account) {
    publish({
      ...current,
      badges: {
        ...mine,
        unseen: mine.unseen.filter((s) => !slugs.includes(s)),
        earned: mine.earned.map((e) => (slugs.includes(e.slug) ? { ...e, seen: true } : e)),
      },
    });
  }
  const b = await backend();
  try {
    await b?.markSeen(slugs);
  } catch {
    /* shown again next open: harmless */
  }
}

/* ------------------------------------------------------------------ the Daily record */

/** The record the Daily screens draw: the server's, or the device's own while it hasn't answered. */
export interface DailyView {
  source: "server" | "device";
  days: string[];
  best: Partial<Record<"puzzle" | "arcade", number>>;
  totals: Record<string, Partial<Record<"puzzle" | "arcade", number>>>;
  streak: number;
  playedToday: boolean;
  /** Days a streak freeze covered (server only). */
  frozenDays: string[];
}

let daily: DailyAccountRecord | null = null;
let dailyLoading: Promise<DailyAccountRecord | null> | null = null;
const dailyListeners = new Set<(v: DailyAccountRecord | null) => void>();

function publishDaily(next: DailyAccountRecord | null): DailyAccountRecord | null {
  daily = next;
  for (const fn of dailyListeners) fn(next);
  return next;
}

/** Re-reads the Daily record from the server (after a Daily is started, say). */
export function refreshDailyRecord(): Promise<DailyAccountRecord | null> {
  dailyLoading = (async () => {
    const b = await backend();
    if (!b) return publishDaily(null);
    try {
      const answer = await b.dailyRecord();
      if (!answer || "busy" in answer) return daily;
      return publishDaily(answer);
    } catch {
      return daily;
    }
  })();
  return dailyLoading;
}

/** The device's record in the same shape (shown until the server answers, and when it can't). */
export function deviceDailyView(nowMs: number = Date.now()): DailyView {
  const record = readDailyRecord();
  const today = ukDayKey(nowMs);
  return {
    source: "device",
    days: record.days,
    best: record.best,
    totals: record.totals,
    streak: dailyStreak(record.days, today),
    playedToday: record.days.includes(today),
    frozenDays: [],
  };
}

export function serverDailyView(r: DailyAccountRecord): DailyView {
  return {
    source: "server",
    days: r.days,
    best: r.best,
    totals: r.totals,
    streak: r.streak,
    playedToday: r.playedToday,
    frozenDays: r.frozenDays,
  };
}

/**
 * The Daily record for the screens: null on the first render (server-rendered pages draw no number), then the
 * device's, then the server's once it answers (the server wins).
 */
export function useDailyRecord(): DailyView | null {
  const [view, setView] = useState<DailyView | null>(null);
  useEffect(() => {
    setView(daily ? serverDailyView(daily) : deviceDailyView());
    const on = (r: DailyAccountRecord | null) => setView(r ? serverDailyView(r) : deviceDailyView());
    dailyListeners.add(on);
    if (!dailyLoading) void refreshDailyRecord();
    return () => {
      dailyListeners.delete(on);
    };
  }, []);
  return view;
}
