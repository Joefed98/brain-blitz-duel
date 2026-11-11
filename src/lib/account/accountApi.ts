/**
 * The phone's account state (10 Nov 2026, the sign-up screens; docs/accounts/README.md "Sign-up screens"): whether
 * this device is a guest, part-way through sign-up, or signed in, with the account's public look. A signed-in device
 * keeps a small copy (`duelz-account:v1`: username, colour, player number, founding; never an email, a date of birth
 * or a country) so screens can show the username from their first paint; the server's answer replaces it.
 *
 * Everything that decides goes through the backend (account.functions.ts, auth.ts); nothing here checks a rule.
 */
import { useEffect, useState } from "react";

import { setStoredName } from "@/lib/duel/session";

import type { AccountStatus, AccountView } from "./account.server";
import type { SaveProgressFrom, SaveProgressMethod, SaveProgressPrompt } from "./saveProgress";

export const ACCOUNT_CACHE_KEY = "duelz-account:v1";

export interface AccountCard {
  username: string;
  colour: number;
  playerNumber: number;
  founding: boolean;
}

export type PhoneAccount =
  | { kind: "unknown" }
  | { kind: "guest"; userId: string | null }
  | { kind: "incomplete"; userId: string; email: string | null }
  | (AccountView & { email: string | null });

function store(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The device's copy of its account's card, or null for a guest. */
export function cachedAccount(): AccountCard | null {
  try {
    const raw = store()?.getItem(ACCOUNT_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<AccountCard>;
    if (typeof p.username !== "string" || !p.username) return null;
    return {
      username: p.username,
      colour: Number.isInteger(p.colour) ? (p.colour as number) : 0,
      playerNumber: Number.isInteger(p.playerNumber) ? (p.playerNumber as number) : 0,
      founding: p.founding === true,
    };
  } catch {
    return null;
  }
}

function writeCache(card: AccountCard | null): void {
  try {
    if (card) store()?.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(card));
    else store()?.removeItem(ACCOUNT_CACHE_KEY);
  } catch {
    /* storage blocked */
  }
}

let current: PhoneAccount = { kind: "unknown" };
let loading: Promise<PhoneAccount> | null = null;
const listeners = new Set<(a: PhoneAccount) => void>();

function publish(next: PhoneAccount): PhoneAccount {
  current = next;
  if (next.kind === "account") {
    writeCache({ username: next.username, colour: next.colour, playerNumber: next.playerNumber, founding: next.founding });
    // Name boxes show the username (the server stores it whatever is typed: playerName.server.ts).
    setStoredName(next.username);
  } else if (next.kind !== "unknown") writeCache(null);
  for (const fn of listeners) fn(next);
  return next;
}

async function client() {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

/** Reads the device's account state now (a guest's is answered by its session alone, with no server call). */
export function refreshAccount(): Promise<PhoneAccount> {
  loading = (async () => {
    try {
      const supabase = await client();
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      if (!user || user.is_anonymous !== false) return publish({ kind: "guest", userId: user?.id ?? null });
      const { accountStatusFn } = await import("./account.functions");
      const status = (await accountStatusFn()) as AccountStatus | { ok: false; message: string };
      const email = user.email ?? null;
      if ("ok" in status) return current.kind === "unknown" ? publish({ kind: "guest", userId: user.id }) : current;
      if (status.kind === "account") return publish({ ...status, email });
      if (status.kind === "incomplete") return publish({ kind: "incomplete", userId: user.id, email });
      return publish({ kind: "guest", userId: user.id });
    } catch {
      return current.kind === "unknown" ? publish({ kind: "guest", userId: null }) : current;
    }
  })();
  return loading;
}

export function accountNow(): PhoneAccount {
  return current;
}

/** Sets the state from an answer the screens already hold (sign-up completed, a username changed). */
export function setAccount(view: AccountView, email: string | null): void {
  publish({ ...view, email });
}

/** The account state, read once per page load and shared by every screen. */
export function useAccount(): PhoneAccount {
  const [state, setState] = useState<PhoneAccount>(current);
  useEffect(() => {
    listeners.add(setState);
    if (current.kind === "unknown") void (loading ?? refreshAccount());
    else setState(current);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}

/**
 * The username a signed-in device plays under (shown in name boxes instead of a typed name), or null for a guest.
 * Read from the device's copy after mount, then from the server's answer.
 */
export function useAccountName(): string | null {
  const account = useAccount();
  const [cached, setCached] = useState<string | null>(null);
  useEffect(() => {
    setCached(cachedAccount()?.username ?? null);
  }, []);
  if (account.kind === "account") return account.username;
  if (account.kind === "unknown") return cached;
  return null;
}

/** Signs this device out: the event first (best effort), then the session; the next call makes a fresh guest. */
export async function signOutAccount(): Promise<void> {
  // Phone notifications (B2): this device's subscription goes first, while the session can still remove it.
  try {
    const { forgetPushOnSignOut } = await import("@/lib/push/pushClient");
    await forgetPushOnSignOut();
  } catch {
    /* best effort */
  }
  try {
    const { noteSignOutFn } = await import("./account.functions");
    await noteSignOutFn();
  } catch {
    /* best effort */
  }
  const { signOutDevice } = await import("./auth");
  await signOutDevice();
  setStoredName("");
  publish({ kind: "guest", userId: null });
}

/* ------------------------------------------------------------------ save-your-progress events */

/** Records one of the prompt's three events in the background (never under automation unless a check allows it). */
export function recordSaveProgress(
  event: "save_progress_shown" | "save_progress_tapped" | "save_progress_dismissed",
  props: { prompt: SaveProgressPrompt; from?: SaveProgressFrom; method?: SaveProgressMethod },
): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __DUELZ_ALLOW_ANALYTICS__?: boolean };
  if (navigator.webdriver && !w.__DUELZ_ALLOW_ANALYTICS__) return;
  void (async () => {
    try {
      const { recordSaveProgressFn } = await import("./saveProgress.functions");
      await recordSaveProgressFn({ data: { event, ...props } });
    } catch {
      /* fire and forget */
    }
  })();
}
