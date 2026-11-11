import { Button } from "@/design/components";
import { Coin } from "@/components/app/CoinCounter";
import { formatCoins } from "@/lib/shop/packs";
import type { ShopCard } from "@/lib/shop/types";

import { Heart, RarityTag, ShopArt } from "./ShopArt";

/**
 * One shop item (mockup docs/art/wave-2/screens/shop.png, "Today"): the rarity tag and the heart over the item's
 * picture, its name and kind, and its price in coins only (the £ value is shown once, on the confirmation). Too few
 * coins: a plain "Get coins" button beside the price, no pop-up. Owned: "Owned" in place of the price.
 */
export function ItemCard({
  item,
  balance,
  onBuy,
  onWish,
  onGetCoins,
}: {
  item: ShopCard;
  balance: number;
  onBuy: (item: ShopCard) => void;
  onWish: (item: ShopCard) => void;
  onGetCoins: () => void;
}) {
  const short = !item.owned && balance < item.price;
  return (
    <article className="shop-item" data-rarity={item.rarity} data-shop-item={item.id} data-owned={item.owned ? "" : undefined}>
      <button
        type="button"
        className="shop-item-face press"
        onClick={() => onBuy(item)}
        disabled={item.owned}
        aria-label={item.owned ? `${item.name}, owned` : `${item.name}, ${item.label}, ${formatCoins(item.price)} coins`}
      >
        <span className="shop-item-art">
          <ShopArt id={item.id} />
          <RarityTag rarity={item.rarity} />
        </span>
        <span className="shop-item-name">{item.name}</span>
        <span className="shop-item-kind">{item.label}</span>
      </button>
      <button
        type="button"
        className="shop-heart press"
        aria-pressed={item.wished}
        aria-label={item.wished ? `Remove ${item.name} from your wishlist` : `Add ${item.name} to your wishlist`}
        onClick={() => onWish(item)}
        data-shop-heart={item.id}
      >
        <Heart on={item.wished} />
      </button>
      <div className="shop-item-price">
        {item.owned ? (
          <span className="shop-owned" data-shop-owned>
            Owned
          </span>
        ) : (
          <span className="shop-coins" data-shop-price={item.price}>
            <Coin size={16} />
            {formatCoins(item.price)}
          </span>
        )}
        {short ? (
          <Button variant="secondary" size={44} onClick={onGetCoins} data-shop-get-coins>
            Get coins
          </Button>
        ) : null}
      </div>
    </article>
  );
}
