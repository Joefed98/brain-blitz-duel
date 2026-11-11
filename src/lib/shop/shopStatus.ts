/**
 * The phone's copy of the shop status (wave 2, session D1): whether this account is a tester (so the Shop tab shows),
 * and which wishlisted items are back today (the in-app notice and the Shop tab's dot, its only badge). Asked once
 * per app open for a signed-in account, from shopStatusFn; the tester answer is kept on the device per player number
 * (`duelz-shop-tester:v1`) so the tab is there at first paint next time. Never asked for a guest, and never under
 * automation unless a check allows it (`window.__DUELZ_ALLOW_SHOP__`), so no other check sees a new request.
 *
 * The dot shows until the shop is opened that day; each item's notice shows once per day it is back
 * (`duelz-shop-seen:v1`).
 */
import { checkOverride } from "@/lib/checkOverride";
import { useEffect, useState } from "react";

import { useAccount } from "@/lib/account/accountApi";

import type { ShopStatus } from "./types";

const TESTER_KEY = "duelz-shop-tester:v1";
const SEEN_KEY = "duelz-shop-seen:v1";

export interface PhoneShopStatus {
  tester: boolean;
  back: { id: string; name: string }[];
  day: string | null;
  /** The account this answer is for (null: not asked yet); the Shop page waits for it before sending anyone away. */
  for: string | null;
}

let current: PhoneShopStatus = { tester: false, back: [], day: null, for: null };
/** The player number `current` answers for. */
let currentNumber: number | null = null;
let askedFor: string | null = null;

/** What answers the status: the server's shopStatusFn, or a check's stand-in for it (setShopStatusSource). */
type StatusSource = (account: { userId: string; playerNumber: number }) => Promise<ShopStatus>;
let source: StatusSource | null = null;

/**
 * Checks only: a stand-in for the server's answer (the tester list), as setIdentityBackend stands in for A1. Set, it
 * is asked even under automation; null goes back to the server.
 */
export function setShopStatusSource(fn: StatusSource | null): void {
  source = fn;
}

/** Checks only: forget this app open's answer, so the next account (or the same one) asks again. */
export function resetShopStatus(): void {
  askedFor = null;
  currentNumber = null;
  publish({ tester: false, back: [], day: null, for: null });
}

/**
 * The player numbers this device knows are on the tester list: this account's answer from the server (this app open)
 * or, until it arrives, the answer kept from the last one. Removed from the list, the next answer takes it away.
 */
export function knownTesters(): number[] {
  if (currentNumber !== null && current.for !== null) return current.tester ? [currentNumber] : [];
  try {
    const raw = store()?.getItem(TESTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { n?: unknown; tester?: unknown };
    return typeof parsed.n === "number" && parsed.tester === true ? [parsed.n] : [];
  } catch {
    return [];
  }
}
const listeners = new Set<(s: PhoneShopStatus) => void>();

function store(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function publish(next: PhoneShopStatus): void {
  current = next;
  for (const fn of listeners) fn(next);
}

/** The cached tester answer for a player number (null: never asked on this device). */
export function cachedTester(playerNumber: number | null): boolean {
  if (!playerNumber) return false;
  try {
    const raw = store()?.getItem(TESTER_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { n?: unknown; tester?: unknown };
    return parsed.n === playerNumber && parsed.tester === true;
  } catch {
    return false;
  }
}

function writeTester(playerNumber: number, tester: boolean): void {
  try {
    store()?.setItem(TESTER_KEY, JSON.stringify({ n: playerNumber, tester }));
  } catch {
    /* storage off: asked again next open */
  }
}

interface Seen {
  /** The day the shop was last opened. */
  opened?: string;
  /** Item ids announced, per day. */
  announced?: Record<string, string[]>;
}

function readSeen(): Seen {
  try {
    const raw = store()?.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as Seen) : {};
  } catch {
    return {};
  }
}

function writeSeen(seen: Seen): void {
  try {
    store()?.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* nothing kept */
  }
}

function automationBlocked(): boolean {
  if (typeof navigator === "undefined" || !navigator.webdriver) return false;
  // Through checkOverride (main #375): the allow switch is ignored in a production build.
  return checkOverride<boolean>("__DUELZ_ALLOW_SHOP__") !== true;
}

/** Asks the server (once per app open per account); a failure leaves the cached answer. */
export async function refreshShopStatus(userId: string, playerNumber: number, force = false): Promise<void> {
  if (typeof window === "undefined") return;
  if (!force && askedFor === userId) return;
  askedFor = userId;
  const answered = (status: ShopStatus) => {
    writeTester(playerNumber, status.tester);
    currentNumber = playerNumber;
    publish({ tester: status.tester, back: status.back, day: status.day, for: userId });
  };
  const unanswered = () => {
    currentNumber = null;
    publish({ tester: cachedTester(playerNumber), back: [], day: null, for: userId });
  };
  if (source) {
    try {
      answered(await source({ userId, playerNumber }));
    } catch {
      askedFor = null;
      unanswered();
    }
    return;
  }
  if (automationBlocked()) {
    unanswered();
    return;
  }
  try {
    const { shopStatusFn } = await import("./shop.functions");
    answered((await shopStatusFn()) as ShopStatus);
  } catch {
    askedFor = null;
    unanswered();
  }
}

/** The status for this device's account, asked for once the account is known. */
export function useShopStatus(): PhoneShopStatus {
  const account = useAccount();
  const [state, setState] = useState<PhoneShopStatus>(current);
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
    if (userId && playerNumber) void refreshShopStatus(userId, playerNumber);
  }, [userId, playerNumber]);
  return account.kind === "account" ? state : { tester: false, back: [], day: null, for: null };
}

/** Whether the shop status has been answered for this device's account (a guest: nothing to wait for). */
export function shopStatusSettled(account: { kind: string; userId?: string | null }, status: PhoneShopStatus): boolean {
  return account.kind !== "account" || (!!account.userId && status.for === account.userId);
}

/** The Shop tab's dot: a wishlisted item is back today and the shop hasn't been opened today. */
export function shopDotFor(status: PhoneShopStatus, seen: Seen = readSeen()): boolean {
  return status.back.length > 0 && status.day !== null && seen.opened !== status.day;
}

/** The items to announce now (back today, not yet announced today), marking them announced. */
export function takeBackNotice(status: PhoneShopStatus): { id: string; name: string }[] {
  if (!status.day || !status.back.length) return [];
  const seen = readSeen();
  const done = new Set(seen.announced?.[status.day] ?? []);
  const fresh = status.back.filter((b) => !done.has(b.id));
  if (!fresh.length) return [];
  writeSeen({ ...seen, announced: { [status.day]: [...done, ...fresh.map((b) => b.id)] } });
  return fresh;
}

/** The shop was opened today: the dot goes. */
export function markShopOpened(day: string): void {
  const seen = readSeen();
  if (seen.opened === day) return;
  writeSeen({ ...seen, opened: day });
  publish({ ...current });
}
