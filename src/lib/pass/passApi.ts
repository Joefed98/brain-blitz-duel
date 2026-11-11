/**
 * The phone's copy of the Season pass (wave 2, session D2; docs/economy/pass.md): the pass view from getPassFn, shared
 * by the Shop tab's Pass part, the Play tab's pass card, the level-up notice and the results Joules line. Asked for a
 * signed-in account only; whether this account has a pass is kept per player number (`duelz-pass:v1`) so the Play tab's
 * card and the Joules line ask only where there is one.
 *
 * Never asked under automation (other checks see no new request) unless a check sets `window.__DUELZ_ALLOW_PASS__`,
 * which production builds ignore (`overrideAllowed(import.meta.env.PROD, …)`; pass-check proves it).
 */
import { useEffect, useState } from "react";

import { useAccount } from "@/lib/account/accountApi";

import type { RoundResultRow } from "@/lib/duel/types";

import type { PassActionResult, PassClosed, PassView } from "./types";

import { checkOverride } from "@/lib/checkOverride";

const PASS_KEY = "duelz-pass:v1";

/** A check-only override counts only outside production builds. */
export function overrideAllowed(prod: boolean, flag: unknown): boolean {
  return !prod && flag === true;
}

function automationBlocked(): boolean {
  if (typeof navigator === "undefined" || !navigator.webdriver) return false;
  // Read through checkOverride (main #375: every check-only stand-in goes through it), kept behind overrideAllowed.
  return !overrideAllowed(import.meta.env.PROD, checkOverride("__DUELZ_ALLOW_PASS__"));
}

function store(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Whether this player number had a pass at the last answer (null: never asked on this device). */
export function cachedPass(playerNumber: number | null): boolean {
  if (!playerNumber) return false;
  try {
    const parsed = JSON.parse(store()?.getItem(PASS_KEY) ?? "null") as { n?: unknown; open?: unknown } | null;
    return !!parsed && parsed.n === playerNumber && parsed.open === true;
  } catch {
    return false;
  }
}

function writeCache(playerNumber: number, open: boolean): void {
  try {
    store()?.setItem(PASS_KEY, JSON.stringify({ n: playerNumber, open }));
  } catch {
    /* asked again next time */
  }
}

export type PhonePass =
  | { state: "none" }
  | { state: "loading" }
  | { state: "closed"; reason: PassClosed["reason"] }
  | { state: "open"; view: PassView };

let current: PhonePass = { state: "none" };
let currentFor: string | null = null;
let inFlight: Promise<void> | null = null;
const listeners = new Set<(p: PhonePass) => void>();

function publish(next: PhonePass): void {
  current = next;
  for (const fn of listeners) fn(next);
}

/** Asks the server for the pass (deduplicated); a failure leaves what was shown. */
export async function refreshPass(userId: string, playerNumber: number): Promise<void> {
  if (typeof window === "undefined" || automationBlocked()) return;
  if (inFlight && currentFor === userId) return inFlight;
  if (currentFor !== userId) publish({ state: "loading" });
  currentFor = userId;
  inFlight = (async () => {
    try {
      const { getPassFn } = await import("./pass.functions");
      const answer = (await getPassFn()) as PassView | PassClosed;
      if (answer.open) {
        writeCache(playerNumber, true);
        publish({ state: "open", view: answer });
      } else {
        if (answer.reason !== "busy" && answer.reason !== "error") writeCache(playerNumber, false);
        publish({ state: "closed", reason: answer.reason });
      }
    } catch {
      if (current.state === "loading") publish({ state: "closed", reason: "error" });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Checks only: puts an answer in place for an account (as setShopStatusSource stands in for D1's server). */
export function standInPass(userId: string, pass: PhonePass): void {
  currentFor = userId;
  publish(pass);
}

/** Puts a server answer (a claim's or a purchase's view) in place. */
export function showView(view: PassView): void {
  publish({ state: "open", view });
}

/**
 * The pass for this device's account. `ask` false reads only what is known (the Play tab's card asks only where the
 * device has seen a pass before, so no one else sends a new request).
 */
export function usePass(ask: boolean = true): PhonePass {
  const account = useAccount();
  const [state, setState] = useState<PhonePass>(current);
  useEffect(() => {
    listeners.add(setState);
    setState(current);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  const userId = account.kind === "account" ? account.userId : null;
  const playerNumber = account.kind === "account" ? account.playerNumber : null;
  useEffect(() => {
    if (ask && userId && playerNumber) void refreshPass(userId, playerNumber);
  }, [ask, userId, playerNumber]);
  if (account.kind !== "account") return { state: "none" };
  return currentFor === userId ? state : { state: "none" };
}

export async function claimReward(track: "free" | "premium", level: number): Promise<PassActionResult> {
  const { claimPassRewardFn } = await import("./pass.functions");
  const out = (await claimPassRewardFn({ data: { track, level } })) as PassActionResult;
  if (out.ok) showView(out.view);
  return out;
}

export async function testPremium(): Promise<PassActionResult> {
  const { testPremiumFn } = await import("./pass.functions");
  const out = (await testPremiumFn()) as PassActionResult;
  if (out.ok) showView(out.view);
  return out;
}

export async function markLevelSeen(level: number): Promise<void> {
  try {
    const { passLevelSeenFn } = await import("./pass.functions");
    await passLevelSeenFn({ data: { level } });
    if (current.state === "open" && current.view.levelNotice !== null && current.view.levelNotice <= level)
      publish({ state: "open", view: { ...current.view, levelNotice: null } });
  } catch {
    /* shown again next time */
  }
}

/** The Joules this account earned from `sinceMs` on (null: no pass, or not asked). */
export async function joulesSince(sinceMs: number, playerNumber: number | null): Promise<number | null> {
  if (typeof window === "undefined" || automationBlocked() || !cachedPass(playerNumber)) return null;
  try {
    const { passJoulesSinceFn } = await import("./pass.functions");
    const out = (await passJoulesSinceFn({ data: { sinceMs } })) as { joules: number } | null;
    return out ? out.joules : null;
  } catch {
    return null;
  }
}

/** This player's first stored result in a room game (ms): where the game's Joules start (the results line). */
export function firstOwnResultMs(results: readonly Pick<RoundResultRow, "player_slot" | "submitted_at">[], mySlot: number): number | null {
  const times = results.filter((r) => r.player_slot === mySlot).map((r) => Date.parse(r.submitted_at)).filter(Number.isFinite);
  return times.length ? Math.min(...times) : null;
}
