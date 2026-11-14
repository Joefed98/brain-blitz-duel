import { useState } from "react";

import { Button, Icon, Sheet } from "@/design/components";
import { Coin } from "@/components/app/CoinCounter";
import { formatCoins } from "@/lib/shop/packs";
import type { ShopBundleView, ShopCard } from "@/lib/shop/types";

import { RARITY_NAMES, ShopArt } from "./ShopArt";
import { ShopConfirmBody } from "./ShopConfirm";

/**
 * The bundle's confirm sheet: its items (each can also be bought on its own this week, at full price, through its own
 * confirmation), then the bundle's price and the £ value once (ShopConfirmBody) with Buy bundle. Too few coins: Get
 * coins in Buy's place. Every item owned: says so, nothing to buy.
 */
export function BundleSheet({
  bundle,
  balance,
  onBuyBundle,
  onBuyItem,
  onGetCoins,
  onClose,
}: {
  bundle: ShopBundleView;
  balance: number;
  /** Resolves to an error message, or null when bought (the sheet closes). */
  onBuyBundle: () => Promise<string | null>;
  onBuyItem: (item: ShopCard) => void;
  onGetCoins: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const short = bundle.price !== null && balance < bundle.price;
  const unowned = bundle.items.filter((i) => !i.owned).length;
  const buy = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await onBuyBundle();
    setBusy(false);
    if (message) setError(message);
  };
  return (
    <Sheet
      title={bundle.name}
      closeLabel="Close bundle"
      onClose={onClose}
      className="shop-sheet"
      data={{ "data-shop-bundle-sheet": bundle.id }}
      footer={
        bundle.price === null ? (
          <p className="shop-owned" data-shop-owned>
            You own every item in this bundle.
          </p>
        ) : (
          <div className="shop-confirm-actions">
            <Button variant="secondary" size={52} onClick={onClose}>
              Cancel
            </Button>
            {short ? (
              <Button variant="secondary" size={52} onClick={onGetCoins} data-shop-get-coins>
                Get coins
              </Button>
            ) : (
              <Button variant="gold" size={52} onClick={() => void buy()} disabled={busy} data-shop-buy-bundle>
                {busy ? "Buying…" : "Buy bundle"}
              </Button>
            )}
          </div>
        )
      }
    >
      <ul className="shop-bundle-list">
        {bundle.items.map((item) => (
          <li key={item.id} className="shop-bundle-row" data-shop-bundle-item={item.id}>
            <ShopArt id={item.id} className="shop-bundle-thumb" />
            <span className="shop-bundle-row-text">
              <span className="shop-bundle-row-name">{item.name}</span>
              <span className="shop-bundle-row-kind">
                <span className="shop-rarity-word" data-rarity={item.rarity}>
                  {RARITY_NAMES[item.rarity]}
                </span>{" "}
                · {item.label}
              </span>
            </span>
            {item.owned ? (
              <span className="shop-owned">
                <Icon name="check" size={18} />
                Owned
              </span>
            ) : (
              <Button variant="secondary" size={44} onClick={() => onBuyItem(item)} aria-label={`Buy ${item.name} on its own for ${formatCoins(item.price)} coins`}>
                <Coin size={16} />
                {formatCoins(item.price)}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {bundle.price !== null ? <ShopConfirmBody coins={bundle.price} what={`${unowned} ${unowned === 1 ? "item" : "items"}, together`} /> : null}
      {error ? (
        <p className="shop-confirm-error" role="alert" data-shop-error>
          {error}
        </p>
      ) : null}
    </Sheet>
  );
}
