import { Button } from "@/design/components";
import { Coin } from "@/components/app/CoinCounter";
import { formatCoins } from "@/lib/shop/packs";
import type { ShopBundleView } from "@/lib/shop/types";

import { ShopArt } from "./ShopArt";

/**
 * This week's bundle as the Shop's hero card (the style guide's Shop mockup; angled cuts, Joulz's key-element shape;
 * P3, 22 Nov 2026, mockup shop-e-phone: an obsidian hero with a gold edge light and its item stills large): the kicker,
 * the name, how many items and what they'd cost one by one (a factual price, never a pressure label), the gold price button, and up to three of its items' approved stills. No "best value" or any
 * other pressure label. Coins only: the £ value is on the confirmation. The price button opens the bundle's sheet (its items
 * and the purchase). Drawn only while a bundle is on sale.
 */
export function BundleCard({
  bundle,
  balance,
  onView,
}: {
  bundle: ShopBundleView;
  balance: number;
  onView: () => void;
}) {
  const count = bundle.items.length;
  const owned = bundle.price === null;
  return (
    <section
      className="shop-hero jz-cut-lg"
      data-shop-bundle={bundle.id}
      data-shop-short={!owned && balance < bundle.price! ? "" : undefined}
      aria-labelledby="shop-bundle-title"
    >
      <div className="shop-hero-text">
        <span className="shop-hero-kicker">This week’s bundle</span>
        <h2 id="shop-bundle-title" className="shop-hero-title">
          {bundle.name}
        </h2>
        <p className="shop-hero-line" data-shop-bundle-full={bundle.full}>
          {count} {count === 1 ? "item" : "items"}
          {!owned && bundle.full > bundle.price! ? ` · ${formatCoins(bundle.full)} separately` : ""}
        </p>
        {owned ? (
          <Button variant="secondary" size={48} className="shop-price" onClick={onView} data-shop-bundle-buy data-shop-owned>
            Owned · See items
          </Button>
        ) : (
          <Button
            variant="gold"
            size={52}
            className="shop-price"
            onClick={onView}
            aria-label={`${bundle.name}, ${count} items, ${formatCoins(bundle.price!)} coins`}
            data-shop-bundle-buy
            data-shop-bundle-price={bundle.price}
          >
            <Coin size={20} />
            {formatCoins(bundle.price!)}
          </Button>
        )}
      </div>
      <div className="shop-hero-art" aria-hidden="true" data-count={Math.min(3, count)}>
        {bundle.items.slice(0, 3).map((item) => (
          <ShopArt key={item.id} id={item.id} />
        ))}
      </div>
    </section>
  );
}
