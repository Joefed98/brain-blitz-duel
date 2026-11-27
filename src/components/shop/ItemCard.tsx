import { Button, Icon } from "@/design/components";
import { Coin } from "@/components/app/CoinCounter";
import { formatCoins } from "@/lib/shop/packs";
import type { ShopCard } from "@/lib/shop/types";

import { Heart, RARITY_NAMES, ShopArt } from "./ShopArt";

/**
 * One of today's items (the style guide's Shop mockup, "Today"; P3, 22 Nov 2026: the still filling the card's top half,
 * the name in its rarity's colour): the item's approved still with the wishlist heart, its name, its rarity and kind, and its price button in coins (the £ value is shown once, on the confirmation). The
 * price button opens the confirm sheet. Too few coins: the price with a plain "Get coins" button beside it, no pop-up.
 * Owned: a quiet "Owned" in place of the price.
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
    <article className="shop-tile" data-rarity={item.rarity} data-shop-item={item.id} data-owned={item.owned ? "" : undefined}>
      <div className="shop-tile-art" data-skin-off="">
        <ShopArt id={item.id} />
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
      </div>
      {/* The rarity is the name's colour (P3, 22 Nov 2026; mockup shop-e-phone), and its word leads the kind line. */}
      <h3 className="shop-tile-name" data-rarity={item.rarity}>
        {item.name}
      </h3>
      <p className="shop-tile-meta">
        <span className="shop-rarity-word" data-rarity={item.rarity}>
          {RARITY_NAMES[item.rarity]}
        </span>
        <span className="shop-tile-kind"> {item.label.toLocaleLowerCase("en-GB")}</span>
      </p>
      {item.owned ? (
        <span className="shop-owned" data-shop-owned>
          <Icon name="check" size={18} />
          Owned
        </span>
      ) : short ? (
        <div className="shop-short" data-shop-short={item.id}>
          <span className="shop-coins" data-shop-price={item.price}>
            <Coin size={18} />
            {formatCoins(item.price)}
          </span>
          <Button variant="secondary" size={44} onClick={onGetCoins} data-shop-get-coins>
            Get coins
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          size={48}
          block
          className="shop-price"
          onClick={() => onBuy(item)}
          aria-label={`${item.name}, ${item.label}, ${formatCoins(item.price)} coins`}
          data-shop-item-buy={item.id}
          data-shop-price={item.price}
        >
          <Coin size={20} />
          {formatCoins(item.price)}
        </Button>
      )}
    </article>
  );
}
