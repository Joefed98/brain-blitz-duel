import { useCallback, useEffect, useRef, useState } from "react";

import { EmptyState, SectionHeader, Skeleton } from "@/design/components";
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

type Pending = { item: ShopCard; requestId: string };

/**
 * The Shop part (phase 2 step 3, the Shop pages session, 14 Nov 2026; docs/design/style-guide phone/ and desktop/
 * shop.png): this week's bundle as the hero card (only while one is on sale), Today (the day's items as tiles, "Changes
 * daily": no countdown, no "only 3 left", no random boxes) and the coin packs, one page. The title and the coin counter
 * are the page header's. Prices are coins only; the confirm sheet shows the £ value once. The server decides
 * everything (what is on sale, prices, ownership, withdrawn items never offered); this draws its answer.
 *
 * `section` (the route's ?section=) is where the page was opened: "coins" (the coin counter, Get coins) scrolls to
 * the packs. shop_viewed is recorded once for it.
 */
export function ShopFront({ section }: { section: Section }) {
  const [view, setView] = useState<ShopView | ShopClosed | null | "loading">("loading");
  const [pending, setPending] = useState<Pending | null>(null);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [bundleRequest, setBundleRequest] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const lastSection = useRef<Section | null>(null);
  const coinsRef = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(async (record?: Section) => {
    const next = await loadShop(record);
    setView(next);
    if (next && next.open) markShopOpened(next.day);
  }, []);

  useEffect(() => {
    // shop_viewed once per section the page is opened at.
    const record = lastSection.current === section ? undefined : section;
    lastSection.current = section;
    void reload(record);
  }, [section, reload]);

  const open = view !== "loading" && view !== null && view.open ? view : null;
  const closed = view !== "loading" && view !== null && !view.open ? view.reason : null;

  const toCoins = useCallback(() => {
    coinsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);
  // Opened at Coins (the coin counter): the packs, once the page has drawn.
  useEffect(() => {
    if (open && section === "coins") coinsRef.current?.scrollIntoView({ block: "start" });
  }, [open !== null, section]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const confirmItem = async (): Promise<string | null> => {
    if (!pending) return null;
    const result = await buyItem(pending.item.id, pending.requestId);
    if (!result.ok) {
      void reload();
      return result.message;
    }
    setSaid(`${pending.item.name} is yours.`);
    await reload();
    return null;
  };

  const confirmBundle = async (): Promise<string | null> => {
    const requestId = bundleRequest ?? newRequestId();
    const result = await buyBundle(requestId);
    if (!result.ok) {
      void reload();
      return result.message;
    }
    setSaid(`${open?.bundle?.name ?? "The bundle"} is yours.`);
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
          {open.bundle ? (
            <BundleCard
              bundle={open.bundle}
              balance={open.balance}
              onView={() => {
                setBundleRequest(newRequestId());
                setBundleOpen(true);
              }}
            />
          ) : null}
          <section className="shop-section" aria-labelledby="shop-today-title" data-shop-today>
            <SectionHeader id="shop-today-title" title="Today" right={<span className="shop-note">Changes daily</span>} />
            <div className="shop-grid">
              {open.today.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  balance={open.balance}
                  onBuy={(it) => setPending({ item: it, requestId: newRequestId() })}
                  onWish={(it) => void wish(it)}
                  onGetCoins={toCoins}
                />
              ))}
            </div>
          </section>
          <div ref={coinsRef} className="shop-coins-anchor">
            <CoinPacks tester={open.tester} allowed={open.packsAllowed} onTestPurchase={packBuy} />
          </div>
          {bundleOpen && open.bundle ? (
            <BundleSheet
              bundle={open.bundle}
              balance={open.balance}
              onBuyBundle={confirmBundle}
              onBuyItem={(it) => {
                setBundleOpen(false);
                setPending({ item: it, requestId: newRequestId() });
              }}
              onGetCoins={() => {
                setBundleOpen(false);
                toCoins();
              }}
              onClose={() => setBundleOpen(false)}
            />
          ) : null}
          {pending ? (
            <ShopConfirm
              title={pending.item.name}
              what={pending.item.label}
              art={pending.item.id}
              rarity={pending.item.rarity}
              coins={pending.item.price}
              onBuy={confirmItem}
              onClose={() => setPending(null)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
