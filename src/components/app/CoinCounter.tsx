import { useRouter } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useState } from "react";

import { useAccount } from "@/lib/account/accountApi";
import { useMyIdentity } from "@/lib/identity/identityApi";
import { useShopOn } from "@/lib/identity/shopSwitch";

/** The coin: a gold disc with the bolt (the coin art on the Shop mockup), decorative. */
export function Coin({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 20 20" className="jz-coin">
      <circle cx="10" cy="10" r="9" className="jz-coin-face" />
      <circle cx="10" cy="10" r="6.6" className="jz-coin-ring" />
      <path d="M11.2 4.6 6.9 10.8h2.8l-1 4.6 4.4-6.4h-2.8z" className="jz-coin-bolt" />
    </svg>
  );
}

/**
 * The header's coin counter (wave 2): an account's balance from A1's getMyWallet(); a tap opens Shop > Coins.
 * Guests never see it, and nobody sees it while the Shop switch is off for them (src/config/shopConfig.ts). Nothing
 * is drawn until the balance is known (never a made-up 0).
 */
/**
 * The last balance this device saw for the account (P1, 21 Nov 2026, the earlier plan's row A2: the header draws it
 * from the first frame, then the live balance replaces it in place, so the counter never pops in). Display only, kept
 * per account; never sent or trusted.
 */
export const COINS_KEY = "duelz-coins:v1";

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

function readCoins(userId: string): number | null {
  try {
    const raw = JSON.parse(localStorage.getItem(COINS_KEY) ?? "null") as { user?: unknown; coins?: unknown } | null;
    return raw && raw.user === userId && typeof raw.coins === "number" && Number.isFinite(raw.coins) ? raw.coins : null;
  } catch {
    return null;
  }
}

/** The balance the counter shows, or null when it draws nothing (a guest, the Shop off, the balance not known yet). */
export function useCoinCount(): number | null {
  const shop = useShopOn();
  const account = useAccount();
  const { coins } = useMyIdentity();
  const userId = account.kind === "account" ? account.userId : null;
  const [cached, setCached] = useState<number | null>(null);
  useBeforePaint(() => setCached(userId ? readCoins(userId) : null), [userId]);
  useEffect(() => {
    if (!userId || coins === null || coins === undefined) return;
    try {
      localStorage.setItem(COINS_KEY, JSON.stringify({ user: userId, coins }));
    } catch {
      /* storage blocked: the counter just waits for the balance next time */
    }
  }, [userId, coins]);
  return shop && userId ? (coins ?? cached) : null;
}

export function CoinCounter({ place = "header" }: { place?: "header" | "rail" }) {
  const router = useRouter();
  const coins = useCoinCount();
  if (coins === null) return null;
  const shown = coins.toLocaleString("en-GB");
  return (
    <button
      type="button"
      data-coin-counter={place}
      aria-label={`${shown} coins. Get coins`}
      onClick={() => void router.navigate({ to: "/shop", search: { part: "shop", section: "coins" } as never })}
      className="jz-coins press"
    >
      <Coin />
      <span className="jz-coins-value">{shown}</span>
    </button>
  );
}
