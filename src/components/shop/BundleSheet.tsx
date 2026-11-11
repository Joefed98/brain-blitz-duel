import { Button, Sheet } from "@/design/components";
import { Coin } from "@/components/app/CoinCounter";
import { formatCoins } from "@/lib/shop/packs";
import type { ShopBundleView, ShopCard } from "@/lib/shop/types";

import { RarityTag, ShopArt } from "./ShopArt";

/**
 * The bundle's items: buy the bundle (the unowned part at the same share off), or any item on its own at full price
 * this week. Coins only here; tapping a price opens the confirmation (the £ value, once).
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
  onBuyBundle: () => void;
  onBuyItem: (item: ShopCard) => void;
  onGetCoins: () => void;
  onClose: () => void;
}) {
  const short = bundle.price !== null && balance < bundle.price;
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
            <span className="shop-bundle-price">
              <Coin size={18} />
              <span className="shop-bundle-now">{formatCoins(bundle.price)}</span>
              {bundle.full > bundle.price ? <s className="shop-bundle-was">{formatCoins(bundle.full)}</s> : null}
            </span>
            {short ? (
              <Button variant="secondary" size={52} onClick={onGetCoins} data-shop-get-coins>
                Get coins
              </Button>
            ) : (
              <Button variant="gold" size={52} onClick={onBuyBundle} data-shop-buy-bundle>
                Buy bundle
              </Button>
            )}
          </div>
        )
      }
    >
      <p className="shop-bundle-blurb">{bundle.blurb}</p>
      <ul className="shop-bundle-list">
        {bundle.items.map((item) => (
          <li key={item.id} className="shop-bundle-row" data-shop-bundle-item={item.id}>
            <ShopArt id={item.id} className="shop-bundle-thumb" />
            <span className="shop-bundle-row-text">
              <span className="shop-item-name">{item.name}</span>
              <span className="shop-item-kind">
                <RarityTag rarity={item.rarity} /> {item.label}
              </span>
            </span>
            {item.owned ? (
              <span className="shop-owned">Owned</span>
            ) : (
              <Button variant="secondary" size={44} onClick={() => onBuyItem(item)} aria-label={`Buy ${item.name} on its own for ${formatCoins(item.price)} coins`}>
                <Coin size={14} /> {formatCoins(item.price)}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
