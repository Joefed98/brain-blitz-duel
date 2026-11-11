import { Button } from "@/design/components";
import { Coin } from "@/components/app/CoinCounter";
import { formatCoins } from "@/lib/shop/packs";
import type { ShopBundleView } from "@/lib/shop/types";

import { ShopArt } from "./ShopArt";

/**
 * This week's bundle (mockup: "This week’s bundle · 5 items"): the title, up to three item pictures, the line, and
 * the price in coins with the separate price struck through. Coins only: the £ value is on the confirmation.
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
      className="shop-bundle jz-cut-lg"
      data-shop-bundle={bundle.id}
      data-shop-short={!owned && balance < bundle.price! ? "" : undefined}
      aria-labelledby="shop-bundle-title"
    >
      <p className="shop-bundle-kicker">
        This week’s bundle · {count} {count === 1 ? "item" : "items"}
      </p>
      <h2 id="shop-bundle-title" className="shop-bundle-title">
        {bundle.name}
      </h2>
      <div className="shop-bundle-art" aria-hidden="true">
        {bundle.items.slice(0, 3).map((item) => (
          <ShopArt key={item.id} id={item.id} />
        ))}
      </div>
      <p className="shop-bundle-blurb">{bundle.blurb} Each can also be bought on its own this week.</p>
      <div className="shop-bundle-foot">
        {owned ? (
          <span className="shop-owned" data-shop-owned>
            Owned
          </span>
        ) : (
          <span className="shop-bundle-price" data-shop-bundle-price={bundle.price}>
            <Coin size={18} />
            <span className="shop-bundle-now">{formatCoins(bundle.price!)}</span>
            {bundle.full > bundle.price! ? (
              <s className="shop-bundle-was" aria-label={`was ${formatCoins(bundle.full)}`}>
                {formatCoins(bundle.full)}
              </s>
            ) : null}
          </span>
        )}
        <Button variant="secondary" size={48} onClick={onView} data-shop-view-bundle>
          View bundle
        </Button>
      </div>
    </section>
  );
}
