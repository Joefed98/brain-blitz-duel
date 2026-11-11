import { useCallback, useEffect, useRef, useState } from "react";

import { Coin } from "@/components/app/CoinCounter";
import { EmptyState, Segmented, Skeleton } from "@/design/components";
import { buyBundle, buyItem, loadShop, newRequestId, setWish, testPack } from "@/lib/shop/shopApi";
import { markShopOpened } from "@/lib/shop/shopStatus";
import { formatCoins, type CoinPack } from "@/lib/shop/packs";
import type { ShopCard, ShopClosed, ShopView } from "@/lib/shop/types";

import { BundleCard } from "./BundleCard";
import { BundleSheet } from "./BundleSheet";
import { CoinPacks } from "./CoinPacks";
import { ItemCard } from "./ItemCard";
import { ShopConfirm } from "./ShopConfirm";

type Section = "featured" | "daily" | "coins";

type Pending = { kind: "item"; item: ShopCard; requestId: string } | { kind: "bundle"; requestId: string };

/**
 * The Shop part (wave 2, session D1; mockup docs/art/wave-2/screens/shop.png): the title with the balance, Featured ·
 * Daily · Coins, this week's bundle, today's four ("New items at midnight": no countdown, no "only 3 left", no random
 * boxes) and the coin packs. Prices are coins only; the confirmation shows the £ value once. The server decides
 * everything (what is on sale, prices, ownership); this draws its answer.
 */
export function ShopFront({
  section,
  onSection,
  onGetCoins,
}: {
  section: Section;
  onSection: (section: Section) => void;
  onGetCoins: () => void;
}) {
  const [view, setView] = useState<ShopView | ShopClosed | null | "loading">("loading");
  const [pending, setPending] = useState<Pending | null>(null);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const lastSection = useRef<Section | null>(null);

  const reload = useCallback(async (record?: Section) => {
    const next = await loadShop(record);
    setView(next);
    if (next && next.open) markShopOpened(next.day);
  }, []);

  useEffect(() => {
    // shop_viewed once per section shown.
    const record = lastSection.current === section ? undefined : section;
    lastSection.current = section;
    void reload(record);
  }, [section, reload]);

  const open = view !== "loading" && view !== null && view.open ? view : null;
  const closed = view !== "loading" && view !== null && !view.open ? view.reason : null;

  const wish = async (item: ShopCard) => {
    if (!open) return;
    const next = !item.wished;
    const flip = (c: ShopCard) => (c.id === item.id ? { ...c, wished: next } : c);
    setView({
      ...open,
      today: open.today.map(flip),
      bundle: open.bundle ? { ...open.bundle, items: open.bundle.items.map(flip) } : null,
      wishlist: next ? [...open.wishlist, item.id] : open.wishlist.filter((id) => id !== item.id),
    });
    const saved = await setWish(item.id, next);
    if (saved === null) void reload();
  };

  const confirmBuy = async (): Promise<string | null> => {
    if (!pending) return null;
    const result = pending.kind === "item" ? await buyItem(pending.item.id, pending.requestId) : await buyBundle(pending.requestId);
    if (!result.ok) {
      void reload();
      return result.message;
    }
    setSaid(pending.kind === "item" ? `${pending.item.name} is yours.` : `${open?.bundle?.name ?? "The bundle"} is yours.`);
    setBundleOpen(false);
    await reload();
    return null;
  };

  const packBuy = async (pack: CoinPack): Promise<string | null> => {
    const result = await testPack(pack.id, newRequestId());
    if (!result.ok) return result.message;
    setSaid(`${formatCoins(pack.coins)} test coins added.`);
    await reload();
    return null;
  };

  return (
    <div className="shop-front" data-shop-front={section}>
      <div className="shop-head">
        <h1 className="ap-title">Shop</h1>
        {open ? (
          <span className="shop-balance" data-shop-balance={open.balance} aria-label={`${formatCoins(open.balance)} coins`}>
            <Coin size={26} />
            {formatCoins(open.balance)}
          </span>
        ) : null}
      </div>
      <Segmented<Section>
        label="Shop sections"
        radio
        value={section}
        onChange={onSection}
        options={[
          { value: "featured", label: "Featured", data: { "data-shop-section": "featured" } },
          { value: "daily", label: "Daily", data: { "data-shop-section": "daily" } },
          { value: "coins", label: "Coins", data: { "data-shop-section": "coins" } },
        ]}
      />
      {said ? (
        <p className="shop-said" role="status" data-shop-said>
          {said}
        </p>
      ) : null}

      {view === "loading" ? (
        <div className="shop-loading" aria-busy="true" aria-label="Loading the shop">
          <Skeleton height={200} />
          <Skeleton height={160} />
        </div>
      ) : !open ? (
        <div className="shop-soon" data-shop-soon={section}>
          <EmptyState
            layout="card"
            tone="cool"
            title={closed === "busy" ? "One moment" : closed === "not_tester" || closed === "guest" ? "Opening soon" : "Couldn’t load the shop"}
            body={
              closed === "busy"
                ? "That’s a lot of taps. Try again in a minute."
                : closed === "not_tester" || closed === "guest"
                  ? "The shop opens when Season 1 starts."
                  : "Check your connection and try again."
            }
          />
        </div>
      ) : (
        <>
          {section === "featured" && open.bundle ? (
            <BundleCard bundle={open.bundle} balance={open.balance} onView={() => setBundleOpen(true)} />
          ) : null}
          {section !== "coins" ? (
            <section className="shop-section" aria-labelledby="shop-today-title" data-shop-today>
              <div className="shop-section-head">
                <h2 id="shop-today-title" className="shop-section-title">
                  Today
                </h2>
                <span className="shop-section-rule" aria-hidden="true" />
                <span className="shop-note">New items at midnight</span>
              </div>
              <div className="shop-grid">
                {open.today.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    balance={open.balance}
                    onBuy={(it) => setPending({ kind: "item", item: it, requestId: newRequestId() })}
                    onWish={(it) => void wish(it)}
                    onGetCoins={onGetCoins}
                  />
                ))}
              </div>
              <p className="shop-note">Tap the heart to get a notice when an item comes back.</p>
            </section>
          ) : null}
          {section !== "daily" ? (
            <CoinPacks tester={open.tester} allowed={open.packsAllowed} onTestPurchase={packBuy} />
          ) : null}
          {bundleOpen && open.bundle ? (
            <BundleSheet
              bundle={open.bundle}
              balance={open.balance}
              onBuyBundle={() => {
                setBundleOpen(false);
                setPending({ kind: "bundle", requestId: newRequestId() });
              }}
              onBuyItem={(it) => {
                setBundleOpen(false);
                setPending({ kind: "item", item: it, requestId: newRequestId() });
              }}
              onGetCoins={() => {
                setBundleOpen(false);
                onGetCoins();
              }}
              onClose={() => setBundleOpen(false)}
            />
          ) : null}
          {pending ? (
            <ShopConfirm
              title={pending.kind === "item" ? pending.item.name : (open.bundle?.name ?? "Bundle")}
              what={pending.kind === "item" ? pending.item.label : `${open.bundle?.items.filter((i) => !i.owned).length ?? 0} items`}
              coins={pending.kind === "item" ? pending.item.price : (open.bundle?.price ?? 0)}
              onBuy={confirmBuy}
              onClose={() => setPending(null)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
