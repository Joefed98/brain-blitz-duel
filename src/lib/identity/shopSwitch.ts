/**
 * Whether this device sees the Shop tab, the /shop page and the coin counter (src/config/shopConfig.ts).
 * The switch on: everyone (the coin counter still only for accounts). Off: only the accounts in the preview list,
 * by player number. Read from the device's account copy at first paint (duelz-account:v1) and then the server's
 * answer, so the preview account's fifth tab doesn't wait for the network; nothing on screen moves for anyone
 * else (the tab bar is fixed to the bottom).
 */
import { useEffect, useState } from "react";

import { SHOP_PREVIEW_PLAYERS, SHOP_TAB_ENABLED } from "@/config/shopConfig";
import { cachedAccount, useAccount, type PhoneAccount } from "@/lib/account/accountApi";

/**
 * Checks only: the switch forced on or off. A check's page sets `window.__DUELZ_SHOP_TAB__` (true / false) before the
 * app starts, as with the first-open onboarding's override; a dev server started with `VITE_DUELZ_SHOP_TAB=on` turns
 * it on for every page it serves, so the existing tab checks can run with five tabs. Production builds never read
 * the variable (import.meta.env.DEV is false there).
 */
export function shopOverride(): boolean | null {
  if (typeof window !== "undefined") {
    const o = (window as unknown as { __DUELZ_SHOP_TAB__?: unknown }).__DUELZ_SHOP_TAB__;
    if (o === true || o === false) return o;
  }
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  if (env?.["DEV"] === true && env["VITE_DUELZ_SHOP_TAB"] === "on") return true;
  return null;
}

/** Pure: the switch, the preview list and who this is (a player number, or null for a guest). */
export function shopOnFor(
  playerNumber: number | null,
  config: { enabled: boolean; preview: readonly number[] } = { enabled: SHOP_TAB_ENABLED, preview: SHOP_PREVIEW_PLAYERS },
): boolean {
  if (config.enabled) return true;
  return playerNumber !== null && playerNumber > 0 && config.preview.includes(playerNumber);
}

/** The signed-in player's number, or null (guests, sign-up not finished, not known yet). */
export function playerNumberOf(account: PhoneAccount): number | null {
  return account.kind === "account" ? account.playerNumber : null;
}

/** The Shop switch for this device: the cached account until the server answers. */
export function useShopOn(): boolean {
  const account = useAccount();
  const [cached, setCached] = useState<number | null>(null);
  useEffect(() => {
    setCached(cachedAccount()?.playerNumber ?? null);
  }, []);
  const forced = shopOverride();
  if (forced !== null) return forced;
  if (SHOP_TAB_ENABLED) return true;
  if (account.kind === "unknown") return shopOnFor(cached);
  return shopOnFor(playerNumberOf(account));
}
