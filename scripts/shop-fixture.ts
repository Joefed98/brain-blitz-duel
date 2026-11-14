/**
 * The Shop and Plus parts' stand-ins for the screen harness (theme-check and no-wrap-check through SHOP_SCREENS in
 * scripts/screens/shop.ts; the Shop pages session, 14 Nov 2026). Real catalogue items only, each one kept by the
 * cosmetics review (never a withdrawn one): today's four from the catalogue's names, rarities and prices, and this
 * week's bundle from src/lib/shop/bundles.ts (Card Table, the mockup's), as getShopFn answers them.
 */
import { readFileSync } from "node:fs";

import { BUNDLES } from "../src/lib/shop/bundles";
import { itemLabel, type ShopCard, type ShopView } from "../src/lib/shop/types";
import type { PlusStatus } from "../src/lib/plus/plus.server";

type Raw = { id: string; name: string; kind: string; game: string | null; rarity: string | null; shop_price_coins: number | null; animated: boolean };

const ITEMS = new Map((JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: Raw[] }).items.map((i) => [i.id, i]));

function card(id: string, owned = false, wished = false): ShopCard {
  const raw = ITEMS.get(id);
  if (!raw || raw.shop_price_coins === null) throw new Error(`shop-fixture: ${id} is not a shop item`);
  return {
    id,
    name: raw.name,
    label: itemLabel(raw),
    rarity: (raw.rarity ?? "Epic").toLowerCase() as ShopCard["rarity"],
    price: raw.shop_price_coins,
    animated: raw.animated,
    owned,
    wished,
  };
}

export const SHOP_ACCOUNT = {
  kind: "account",
  userId: "u-shop",
  username: "TheInventor_2026",
  colour: 4,
  playerNumber: 1,
  founding: true,
  country: null,
  createdAt: "2026-11-10T12:00:00.000Z",
  status: "active",
  isUnder18: false,
  deletion: null,
};

export interface HarnessShop {
  account: Record<string, unknown>;
  view: ShopView;
}

/**
 * `bundle: false`: a week with no bundle on sale. `ownedBundle`: every bundle item owned. `teen`: an account under 18
 * (coin packs shown with the age line, no buttons).
 */
export function shopFixture(opts: { bundle?: boolean; ownedBundle?: boolean; teen?: boolean } = {}): HarnessShop {
  const def = BUNDLES.find((b) => b.id === "card-table")!;
  const items = def.items.map((id, i) => card(id, opts.ownedBundle === true || i === 4));
  const full = items.filter((i) => !i.owned).reduce((a, b) => a + b.price, 0);
  return {
    account: { ...SHOP_ACCOUNT, isUnder18: opts.teen === true },
    view: {
      open: true,
      day: "2026-11-14",
      balance: 1250,
      tester: true,
      packsAllowed: opts.teen !== true,
      today: [card("frame.gold", false, true), card("name-colour.sapphire"), card("celebration.fireworks", true), card("game-skin.apex.molten-gold")],
      bundle:
        opts.bundle === false
          ? null
          : {
              id: def.id,
              name: def.name,
              blurb: def.blurb,
              size: def.size,
              weekStart: "2026-11-09",
              items,
              price: opts.ownedBundle ? null : Math.round((def.price * full) / items.reduce((a, b) => a + b.price, 0)),
              full,
            },
      wishlist: ["frame.gold"],
    },
  };
}

/** Joulz Plus as plusStatusFn answers it: a tester not yet a member, or a member (`member`). */
export function plusFixture(opts: { member?: boolean } = {}): PlusStatus {
  return {
    open: true,
    tester: true,
    member: opts.member ? { plan: "yearly", test: true, startedAt: "2026-11-12T10:00:00.000Z", showMark: false } : null,
    monthsPaid: opts.member ? 1 : 0,
    premiumPass: opts.member === true,
    earlyAccess: [],
  };
}
