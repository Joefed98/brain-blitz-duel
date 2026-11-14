import { useState } from "react";

import { Button, Sheet } from "@/design/components";
import { Coin } from "@/components/app/CoinCounter";
import { confirmLine, formatCoins } from "@/lib/shop/packs";
import type { ShopRarity } from "@/lib/shop/dailyShop";

import { RARITY_NAMES, ShopArt } from "./ShopArt";

/**
 * The purchase confirmation: the item's picture, its name, rarity and kind, its price in coins, and the ONE place an
 * item's or bundle's real-money value is shown, once, at the Starter pack's rate ("Buy for 2,800 coins (≈ £5.54)?",
 * packs.ts confirmLine). Buy and Cancel; the answer (bought, or the server's refusal) is the caller's to show.
 */
export function ShopConfirmBody({ coins, what, art, rarity }: { coins: number; what: string; art?: string | undefined; rarity?: ShopRarity | undefined }) {
  return (
    <div className="shop-confirm" data-shop-confirm>
      {art ? (
        <span className="shop-confirm-art" data-skin-off="">
          <ShopArt id={art} />
        </span>
      ) : null}
      <p className="shop-confirm-what">
        {rarity ? (
          <span className="shop-rarity-word" data-rarity={rarity}>
            {RARITY_NAMES[rarity]} ·{" "}
          </span>
        ) : null}
        {what}
      </p>
      <p className="shop-confirm-price" data-shop-confirm-price={coins}>
        <Coin size={22} />
        {formatCoins(coins)}
      </p>
      <p className="shop-confirm-line" data-shop-confirm-line>
        {confirmLine(coins)}
      </p>
    </div>
  );
}

export function ShopConfirm({
  coins,
  what,
  title,
  art,
  rarity,
  onBuy,
  onClose,
}: {
  coins: number;
  what: string;
  title: string;
  /** The item's id: its approved still at the top of the sheet. */
  art?: string;
  rarity?: ShopRarity;
  /** Resolves to an error message, or null when bought (the sheet closes). */
  onBuy: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buy = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await onBuy();
    setBusy(false);
    if (message) setError(message);
    else onClose();
  };
  return (
    <Sheet
      title={title}
      closeLabel="Cancel"
      onClose={onClose}
      className="shop-sheet"
      data={{ "data-shop-confirm-sheet": "" }}
      footer={
        <div className="shop-confirm-actions">
          <Button variant="secondary" size={52} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="gold" size={52} onClick={() => void buy()} disabled={busy} data-shop-buy>
            {busy ? "Buying…" : "Buy"}
          </Button>
        </div>
      }
    >
      <ShopConfirmBody coins={coins} what={what} art={art} rarity={rarity} />
      {error ? (
        <p className="shop-confirm-error" role="alert" data-shop-error>
          {error}
        </p>
      ) : null}
    </Sheet>
  );
}
