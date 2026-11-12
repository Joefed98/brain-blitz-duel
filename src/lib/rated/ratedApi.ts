/**
 * The phone's view of rated play (wave 3, session W3c), shared by Home's rank panel and Play card, Profile and the card
 * pill. Read once per app open through the rated backend (backend.ts) and on demand after a match.
 *
 * Testers only while rated play is testers only: `status.open` is the server's answer for this player (W3b's switch).
 * A device with no backend, a guest, a non-tester or a failed call sees null, and every rated screen draws nothing,
 * so Home, Profile and the card stay exactly as they were.
 */
import { useEffect, useState } from "react";

import { useAccount } from "@/lib/account/accountApi";
import { checkOverride } from "@/lib/checkOverride";

import { ratedBackend, setRatedBackend, type RatedBackend, type RatedStatus } from "./backend";

/**
 * Checks only: a stand-in backend handed to the page (a browser check sets `window.__DUELZ_RATED_BACKEND__` before
 * the app starts). Never in production: a production build replaces `import.meta.env.PROD` with true, so this
 * returns null before reading the window and the build drops the rest; nobody can open rated screens from the
 * browser console on joulz.uk.
 */
export function ratedOverride(): RatedBackend | null {
  if (import.meta.env.PROD) return null;
  const o = checkOverride<unknown>("__DUELZ_RATED_BACKEND__");
  return o && typeof o === "object" && typeof (o as RatedBackend).status === "function" ? (o as RatedBackend) : null;
}

let current: RatedStatus | null = null;
let whoFor: string | null = null;
let loading: Promise<RatedStatus | null> | null = null;
const listeners = new Set<(s: RatedStatus | null) => void>();

function publish(next: RatedStatus | null): RatedStatus | null {
  current = next;
  for (const fn of listeners) fn(next);
  return next;
}

/** The backend in use: a check's page stand-in, else the bound one (null until W3a and W3b land). */
export async function backendNow(): Promise<RatedBackend | null> {
  const page = ratedOverride();
  if (page) {
    setRatedBackend(page);
    return page;
  }
  return ratedBackend();
}

/** Reads the status again (after a match, or when the account changes). */
export function refreshRated(): Promise<RatedStatus | null> {
  loading = (async () => {
    try {
      const backend = await backendNow();
      if (!backend) return publish(null);
      const status = await backend.status();
      return publish(status && status.open ? status : null);
    } catch {
      return publish(null);
    }
  })();
  return loading;
}

/** Checks only: forget the shared status (between mounts). */
export function resetRated(): void {
  current = null;
  whoFor = null;
  loading = null;
}

/**
 * Rated play's status for this device, or null (rated play not open to this player, not known yet). An account or a
 * guest: W3b answers whether it is open (testers only at first; guests too once RATED_PLAY_FOR_EVERYONE is on). An
 * incomplete sign-up is never asked.
 */
export function useRatedStatus(): RatedStatus | null {
  const account = useAccount();
  const known = account.kind === "account" || account.kind === "guest";
  // Only a string id names the player (anything else reads as unknown, never converted to text).
  const raw: unknown = "userId" in account ? account.userId : null;
  const id = typeof raw === "string" ? raw : "";
  const who = account.kind === "account" ? id : account.kind === "guest" ? `guest:${id}` : null;
  const [state, setState] = useState<RatedStatus | null>(known ? current : null);
  useEffect(() => {
    if (!known) {
      setState(null);
      return;
    }
    if (whoFor !== who) {
      whoFor = who;
      current = null;
      loading = null;
    }
    listeners.add(setState);
    if (current) setState(current);
    else void (loading ?? refreshRated());
    return () => {
      listeners.delete(setState);
    };
  }, [known, who]);
  return known ? state : null;
}
