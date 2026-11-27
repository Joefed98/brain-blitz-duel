import { useState } from "react";

import { Button, SectionHeader, Sheet } from "@/design/components";
import { COIN_PACKS, formatCoins, formatPounds, PACK_AGE_MESSAGE, type CoinPack } from "@/lib/shop/packs";

import { KitArt } from "./KitArt";

/**
 * The four coin packs (the style guide's desktop Shop mockup, "Coins"): a tile each with a stack of the art kit's coin
 * (one to four by size), the coins and the price. No value labels (Joe's rule: no pressure). There are no real payments yet: on a tester account a pack's button makes a
 * test purchase (its coins credited with no payment, marked as a test on the ledger). Coin packs are for players 18
 * and over on the web: a younger account sees the packs with the age line and no buttons.
 */
export function CoinPacks({
  tester,
  allowed,
  onTestPurchase,
}: {
  tester: boolean;
  allowed: boolean;
  /** Resolves to an error message, or null when credited. */
  onTestPurchase: (pack: CoinPack) => Promise<string | null>;
}) {
  const [pack, setPack] = useState<CoinPack | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buy = async () => {
    if (!pack || busy) return;
    setBusy(true);
    setError(null);
    const message = await onTestPurchase(pack);
    setBusy(false);
    if (message) setError(message);
    else setPack(null);
  };
  return (
    <section className="shop-section" aria-labelledby="shop-coins-title" data-shop-packs id="shop-coins">
      <SectionHeader id="shop-coins-title" title="Coins" />
      {!allowed ? (
        <p className="shop-note" data-shop-pack-age>
          {PACK_AGE_MESSAGE}
        </p>
      ) : null}
      <ul className="shop-packs">
        {COIN_PACKS.map((p, i) => (
          <li key={p.id} className="shop-pack" data-shop-pack={p.id}>
            <span className="shop-pack-art" aria-hidden="true" data-count={i + 1}>
              {Array.from({ length: i + 1 }, (_, n) => (
                <KitArt key={n} name="coin" size={44} />
              ))}
            </span>
            <span className="shop-pack-coins">{formatCoins(p.coins)} coins</span>
            {allowed && tester ? (
              <Button variant="secondary" size={48} block onClick={() => setPack(p)} aria-label={`${formatCoins(p.coins)} coins, ${formatPounds(p.pence)}, test purchase`}>
                {formatPounds(p.pence)}
              </Button>
            ) : (
              <span className="shop-pack-price">{formatPounds(p.pence)}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="shop-note">No random boxes. Coins can’t be cashed out or traded.</p>
      {pack ? (
        <Sheet
          title="Test purchase"
          closeLabel="Cancel"
          onClose={() => setPack(null)}
          className="shop-sheet"
      data={{ "data-shop-test-sheet": "" }}
          footer={
            <div className="shop-confirm-actions">
              <Button variant="secondary" size={52} onClick={() => setPack(null)}>
                Cancel
              </Button>
              <Button variant="gold" size={52} onClick={() => void buy()} disabled={busy} data-shop-test-buy>
                {busy ? "Adding…" : "Test purchase"}
              </Button>
            </div>
          }
        >
          <p className="shop-confirm-line">
            Add {formatCoins(pack.coins)} coins with no payment? This is a tester purchase, marked as a test.
          </p>
          {error ? (
            <p className="shop-confirm-error" role="alert">
              {error}
            </p>
          ) : null}
        </Sheet>
      ) : null}
    </section>
  );
}
