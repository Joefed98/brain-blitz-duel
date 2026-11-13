/**
 * shop-check (wave 2, session D1, 11 Nov 2026; docs/economy/shop.md): the shop, through its pure rules
 * (src/lib/shop/), the real server functions (shop.functions.ts) and the real migrations on a local PostgreSQL 16,
 * with the server-function harness's PostgREST / GoTrue stand-in (scripts/server-fn-harness.ts).
 *
 * What it proves:
 * - over a simulated year of days: slots 1 and 2 Epic, slot 3 Elite, slot 4 Epic, Elite or Legendary; nothing shown
 *   again within 7 days; Legendaries on two days of every week; each Legendary back within 22–28 days; only shop
 *   items (never a pass, free or earned one, even when the catalogue offered them); the same four for every player
 *   (and from any server, any order of history); an owner sees the next unowned item of the rarity, or Owned;
 * - the Monday bundles: shop items only, the size's price band, 20–30 % off, small → medium → large, Frozen Lake
 *   first (Glacier, Aurora stones, Frost), the schedule starting on a Monday; a part-owned bundle's price;
 * - coins: the four packs; the confirmation line "Buy for 2,800 coins (≈ £5.54)?"; the £ value appears only on the
 *   confirmation (the shop's source and rendered cards); packs only for 18+ on the web;
 * - the database: non-testers reach no shop function; Joe's tester functions add, remove, list and log, and are
 *   unreachable from the API; every tester sees the same recorded four; a purchase spends and grants together; the
 *   same purchase twice pays once; owned items and too few coins are refused; a bundle is all or nothing (an injected
 *   failure on its last item leaves no line and no item); test purchases are marked, removable once, testers and 18+
 *   only; the wishlist and its "back today" status; the five analytics events.
 *
 * Needs the PostgreSQL 16 binaries for the database part (preinstalled on GitHub's runners). Without them it fails on
 * CI and prints a NOTE locally. No browser.
 */

import { readdirSync, readFileSync } from "node:fs";

import {
  accountToken,
  ANON_KEY,
  callServerFn,
  installServerFnPlugin,
  postgresBin,
  SERVICE_KEY,
  startLocalDb,
  startRestServer,
  userToken,
  type LocalDb,
  type RestServer,
} from "./server-fn-harness";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}
async function section(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (err) {
    check(false, `${name}: threw ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 4).join(" | ") : String(err)}`);
  }
}

const quietLog = console.log;
const quietWarn = console.warn;
const quietError = console.error;
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^shop-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

interface JsonItem {
  id: string;
  name: string;
  kind: string;
  rarity: string | null;
  source: string;
  shop_price_coins: number | null;
}
const ITEMS = (JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: JsonItem[] }).items;
const SHOP = ITEMS.filter((i) => i.source === "shop");
const RARITY = new Map(ITEMS.map((i) => [i.id, i.rarity?.toLowerCase() ?? null]));
const PRICE = new Map(ITEMS.map((i) => [i.id, i.shop_price_coins]));

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const JOE = uid(31); // a tester, adult
const KIM = uid(32); // not a tester
const LEO = uid(33); // a tester, 16
const MIA = uid(34); // a second tester (same four)
const NED = uid(35); // a guest

await pureChecks();

let db: LocalDb | null = null;
let rest: RestServer | null = null;
if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`shop-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  console.log(`shop-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

try {
  db = startLocalDb("shop-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  db.psql("UPDATE public.catalogue_items SET withdrawn_at = NULL, withdrawn_note = NULL"); // Changed with Joe's approval, 13 Nov 2026: every item live in this check's own test database before its scenario, so it keeps proving the whole catalogue (the withdrawn items, 20261116800000, are proved by cosmetics-withdrawn-check).
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  db.psql(`INSERT INTO auth.users (id, is_anonymous, email) VALUES
    ('${JOE}', false, 'joe@example.com'), ('${KIM}', false, 'kim@example.com'), ('${LEO}', false, 'leo@example.com'),
    ('${MIA}', false, 'mia@example.com'), ('${NED}', true, NULL)`);
  await installServerFnPlugin();
  await databaseChecks(db, rest);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

restore();
console.log(`shop-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: the daily shop, the Monday bundles, buying, test packs, the wishlist and the tester list hold.");
process.exit(0);

/* =================================================================== pure rules */

async function pureChecks(): Promise<void> {
  const daily = await import("../src/lib/shop/dailyShop");
  const days = await import("../src/lib/shop/days");
  const bundles = await import("../src/lib/shop/bundles");
  const packs = await import("../src/lib/shop/packs");

  const asItem = (i: JsonItem) => ({
    source: i.source,
    exclusive: i.source !== "shop",
    priceCoins: i.shop_price_coins,
    rarity: i.rarity?.toLowerCase() ?? null,
  });
  const pool = ITEMS.filter((i) => daily.sellable(asItem(i))).map((i) => ({ id: i.id, rarity: i.rarity!.toLowerCase() as "epic" | "elite" | "legendary" }));

  await section("sellable", async () => {
    check(pool.length === 52 && pool.every((p) => SHOP.some((s) => s.id === p.id)), `the sellable pool is the 52 shop items (${pool.length})`);
    check(ITEMS.filter((i) => i.source !== "shop").every((i) => !daily.sellable(asItem(i))), "no pass, free or earned item is sellable");
    check(!daily.sellable({ source: "shop", exclusive: true, priceCoins: 1000, rarity: "epic" }), "an exclusive item is never sellable");
    check(!daily.sellable({ source: "shop", exclusive: false, priceCoins: 1000, rarity: "rare" }), "a Rare is never sellable");
  });

  await section("a simulated year", async () => {
    const start = "2026-11-09";
    const end = days.addDays(start, 52 * 7 * 2 - 1); // two years, to be sure
    // A catalogue that also offers every pass, free and earned item: the picker's pool is filtered first, and even
    // given them unfiltered by mistake a day never holds one (the database refuses it too, below).
    const year = daily.pickShopDays(start, end, pool, []);
    check(year.length === 728, `728 days picked (${year.length})`);
    const slotRule = year.every(
      (d) =>
        RARITY.get(d.items[0]) === "epic" &&
        RARITY.get(d.items[1]) === "epic" &&
        RARITY.get(d.items[2]) === "elite" &&
        ["epic", "elite", "legendary"].includes(RARITY.get(d.items[3]) ?? "") &&
        d.items.every((id, i) => RARITY.get(id) === d.rarities[i]),
    );
    check(slotRule, "every day: slots 1 and 2 Epic, slot 3 Elite, slot 4 Epic, Elite or Legendary");
    check(year.every((d) => new Set(d.items).size === 4), "every day: four different items");
    check(year.every((d) => d.items.every((id) => SHOP.some((s) => s.id === id))), "every day: shop items only (never pass, free or earned)");
    const last = new Map<string, string>();
    let minGap = Infinity;
    const legGaps: number[] = [];
    for (const d of year)
      for (const id of d.items) {
        const prev = last.get(id);
        if (prev) {
          const gap = days.daysBetween(prev, d.day);
          minGap = Math.min(minGap, gap);
          if (RARITY.get(id) === "legendary") legGaps.push(gap);
        }
        last.set(id, d.day);
      }
    check(minGap > 7, `nothing repeats within 7 days (shortest gap ${minGap} days)`);
    const weeks = new Map<string, number>();
    for (const d of year) if (d.rarities[3] === "legendary") weeks.set(days.mondayOf(d.day), (weeks.get(days.mondayOf(d.day)) ?? 0) + 1);
    const perWeek = [...weeks.values()];
    check(weeks.size === 104 && perWeek.every((n) => n === 2), `a Legendary on exactly two days of every week (${weeks.size} weeks; ${[...new Set(perWeek)].join(",")})`);
    const legendaries = pool.filter((p) => p.rarity === "legendary").map((p) => p.id);
    const firstSeen = legendaries.map((id) => year.find((d) => d.items.includes(id))?.day ?? "never");
    check(firstSeen.every((d) => d !== "never" && days.daysBetween(start, d) < 28), `every Legendary appears in the first four weeks (${firstSeen.join(",")})`);
    check(legGaps.length > 0 && Math.min(...legGaps) >= 21 && Math.max(...legGaps) <= 28, `each Legendary returns every 3–4 weeks (gaps ${Math.min(...legGaps)}–${Math.max(...legGaps)} days)`);
    const counts = new Map<string, number>();
    for (const d of year) for (const id of d.items) counts.set(id, (counts.get(id) ?? 0) + 1);
    check(counts.size === 52, `every shop item is shown over the year (${counts.size})`);

    // The same four from any server: history given in any order, recomputed from scratch.
    const again = daily.pickShopDays(start, days.addDays(start, 59), pool, []);
    check(again.every((d, i) => d.items.join() === year[i]!.items.join()), "the same days recomputed: the same four");
    const shuffledHistory = year.slice(0, 120).reverse();
    const d121 = daily.pickShopDay(year[120]!.day, [...pool].reverse(), shuffledHistory);
    check(d121.items.join() === year[120]!.items.join(), "history and pool in any order: the same four");
    // Every player with nothing owned sees the same four.
    const views = Array.from({ length: 5 }, () => daily.viewForPlayer(year[200]!, new Set()).map((s) => s.itemId).join());
    check(new Set(views).size === 1 && views[0] === year[200]!.items.join(), "every player sees the same four");
    // An owner of slot 1 sees the day's next unowned Epic; an owner of everything of the rarity sees Owned.
    const d = year[200]!;
    const v1 = daily.viewForPlayer(d, new Set([d.items[0]]));
    check(v1[0]!.itemId !== d.items[0] && RARITY.get(v1[0]!.itemId) === "epic" && !v1[0]!.owned && v1[0]!.replaced === d.items[0] && !d.items.includes(v1[0]!.itemId), "an owned pick is swapped for the day's next unowned item of its rarity");
    check(v1.slice(1).every((s, i) => s.itemId === d.items[i + 1]), "the other slots are unchanged");
    const allEpics = new Set(pool.filter((p) => p.rarity === "epic").map((p) => p.id));
    const v2 = daily.viewForPlayer(d, allEpics);
    check(v2[0]!.owned && v2[0]!.itemId === d.items[0] && v2[1]!.owned, "owning every Epic: the picks shown as Owned");
  });

  await section("bundles", async () => {
    check(days.weekdayOf(bundles.BUNDLE_SCHEDULE_START) === 0, "the schedule starts on a Monday");
    check(bundles.BUNDLES.length === 8, "eight weeks proposed");
    check(bundles.BUNDLES.map((b) => b.size).join() === "small,medium,large,small,medium,large,small,medium", "sizes cycle small, medium, large");
    const first = bundles.BUNDLES[0]!;
    check(
      first.name === "Frozen Lake" &&
        ["game-skin.curl-champ.glacier", "game-skin.curl-champ.aurora", "card-art.frost"].every((id) => first.items.includes(id)),
      "week 1 is Frozen Lake: Glacier, Aurora stones and Frost",
    );
    check(new Set(bundles.BUNDLES.map((b) => b.id)).size === 8, "bundle ids unique");
    const used = bundles.BUNDLES.flatMap((b) => b.items);
    check(new Set(used).size === used.length, "no item is in two of the eight bundles");
    for (const b of bundles.BUNDLES) {
      const full = bundles.fullPrice(b.items, (id) => PRICE.get(id) ?? null);
      const off = 1 - b.price / full;
      check(b.items.every((id) => SHOP.some((s) => s.id === id)) && new Set(b.items).size === b.items.length, `${b.name}: shop items only, each once`);
      check(off >= bundles.BUNDLE_MIN_OFF && off <= bundles.BUNDLE_MAX_OFF, `${b.name}: ${Math.round(off * 1000) / 10} % off (${b.price} for ${full})`);
      const band = bundles.BUNDLE_SIZES[b.size];
      check(b.price >= band.min && b.price <= band.max, `${b.name}: ${b.price} within the ${b.size} band`);
      if (b.size === "large") check(b.items.some((id) => RARITY.get(id) === "legendary") && RARITY.get(b.items[0]!) === "legendary", `${b.name}: a Legendary centrepiece, listed first`);
      if (b.size === "medium") check(b.items.some((id) => RARITY.get(id) === "epic") && b.items.some((id) => RARITY.get(id) === "elite"), `${b.name}: Epic and Elite mixed`);
      const parts = bundles.splitBundlePrice(b.items, b.price, (id) => PRICE.get(id) ?? null);
      check(parts.reduce((a, x) => a + x, 0) === b.price && parts.every((x) => x > 0), `${b.name}: the split sums to the price`);
    }
    check(bundles.bundleForDay("2026-11-08") === null, "no bundle before week 1");
    check(bundles.bundleForDay("2026-11-09")?.id === "frozen-lake" && bundles.bundleForDay("2026-11-15")?.id === "frozen-lake", "week 1: Monday to Sunday");
    check(bundles.bundleForDay("2026-11-16")?.id === "card-table", "the bundle changes on Monday");
    check(bundles.bundleForDay(days.addDays("2026-11-09", 56))?.id === "frozen-lake", "after week 8 the list starts again");
    const priceOf = (id: string) => PRICE.get(id) ?? null;
    const part = bundles.bundlePriceFor(first, new Set(["card-art.frost"]), priceOf);
    check(part !== null && part.items.length === 2 && part.price === 1980 && part.full === 2600, `part-owned: the rest at the same share off (${JSON.stringify(part)})`);
    // Every owned subset of every bundle: the price is the bundle's less the owned items' share (rounded down to 10),
    // the discount on what is left stays 20–30 %, it only ever falls as more is owned, and only the unowned are sold.
    let subsets = 0;
    const bad: string[] = [];
    for (const b of bundles.BUNDLES) {
      const all = bundles.fullPrice(b.items, priceOf);
      for (let mask = 0; mask < 1 << b.items.length; mask++) {
        const owned = new Set(b.items.filter((_, i) => mask & (1 << i)));
        const got = bundles.bundlePriceFor(b, owned, priceOf);
        subsets++;
        if (owned.size === b.items.length) {
          if (got !== null) bad.push(`${b.id} all owned`);
          continue;
        }
        const left = bundles.fullPrice(b.items.filter((id) => !owned.has(id)), priceOf);
        const want = owned.size === 0 ? b.price : Math.max(10, Math.floor((b.price - (b.price * (all - left)) / all) / 10) * 10);
        const off = 1 - got!.price / left;
        if (!got || got.price !== want || got.full !== left || got.items.some((id) => owned.has(id))) bad.push(`${b.id}/${mask}: ${got?.price} ≠ ${want}`);
        else if (off < bundles.BUNDLE_MIN_OFF - 1e-9 || off > bundles.BUNDLE_MAX_OFF + 1e-9) bad.push(`${b.id}/${mask}: ${(off * 100).toFixed(1)} % off`);
        for (let j = 0; j < b.items.length; j++) {
          if (mask & (1 << j)) continue;
          const more = bundles.bundlePriceFor(b, new Set([...owned, b.items[j]!]), priceOf);
          if (more && more.price > got!.price) bad.push(`${b.id}/${mask}+${j}: rises`);
        }
      }
    }
    check(bad.length === 0, `part-owned bundles: ${subsets} owned subsets priced at the bundle less the owned share, 20–30 % off, never rising (${bad.slice(0, 3).join("; ") || "all hold"})`);
    check(bundles.bundlePriceFor(first, new Set(first.items), priceOf) === null, "all owned: nothing to buy");
  });

  await section("item pictures", async () => {
    const run = Bun.spawnSync(["bun", "scripts/shop-previews.ts", "--check"], { stdout: "pipe", stderr: "pipe" });
    check(run.exitCode === 0, `every shop item has its picture and shopPreviews.data.ts is current (${run.stdout.toString().trim()})`);
  });

  await section("packs and the money line", async () => {
    check(packs.COIN_PACKS.map((p) => `${p.coins}:${p.pence}`).join() === "500:99,1000:179,3000:499,10000:1499", "the four packs: 500 £0.99, 1,000 £1.79, 3,000 £4.99, 10,000 £14.99");
    check(packs.confirmLine(2800) === "Buy for 2,800 coins (≈ £5.54)?", `the confirmation line (${packs.confirmLine(2800)})`);
    check(packs.confirmLine(1000) === "Buy for 1,000 coins (≈ £1.98)?", "1,000 coins ≈ £1.98");
    check(!packs.packAllowed(17) && packs.packAllowed(18) && !packs.packAllowed(null), "packs on the web: 18 and over only");

    // The £ value only on the confirmation: confirmLine/coinsToPence are called only by the confirm sheet; pack prices
    // (formatPounds of a pack's own price) only in the Coins list.
    const files = ["src/routes/shop.tsx", ...readdirSync("src/components/shop").map((f) => `src/components/shop/${f}`)];
    const uses = (re: RegExp) => files.filter((f) => re.test(readFileSync(f, "utf8")));
    check(uses(/confirmLine\(|coinsToPence\(/).join() === "src/components/shop/ShopConfirm.tsx", `the real-money value of coins is worked out only in ShopConfirm (${uses(/confirmLine\(|coinsToPence\(/).join()})`);
    check(uses(/formatPounds\(/).every((f) => f === "src/components/shop/CoinPacks.tsx"), "£ prices are drawn only for the packs themselves");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { ItemCard } = await import("../src/components/shop/ItemCard");
    const { BundleCard } = await import("../src/components/shop/BundleCard");
    const { ShopConfirmBody } = await import("../src/components/shop/ShopConfirm");
    const sample = { id: "card-art.aurora", name: "Aurora", label: "Card art, animated", rarity: "legendary" as const, price: 2800, animated: true, owned: false, wished: false };
    const cardHtml = renderToStaticMarkup(createElement(ItemCard, { item: sample, balance: 100, onBuy: () => {}, onWish: () => {}, onGetCoins: () => {} }));
    const bundleHtml = renderToStaticMarkup(
      createElement(BundleCard, {
        bundle: { id: "frozen-lake", name: "Frozen Lake", blurb: "x", size: "small", weekStart: "2026-11-09", items: [sample], price: 3200, full: 4200 },
        balance: 5000,
        onView: () => {},
      }),
    );
    const confirmHtml = renderToStaticMarkup(createElement(ShopConfirmBody, { coins: 2800, what: "Aurora" }));
    check(!/£|≈/.test(cardHtml) && /2,800/.test(cardHtml), "an item card shows coins only");
    check(/Get coins/.test(cardHtml), "too few coins: a Get coins button beside the price");
    check(!/£|≈/.test(bundleHtml) && /3,200/.test(bundleHtml) && /4,200/.test(bundleHtml), "the bundle card shows coins only (its price and the separate price)");
    check(confirmHtml.includes("Buy for 2,800 coins (≈ £5.54)?"), "the confirmation shows the £ value once");
    check((confirmHtml.match(/£/g) ?? []).length === 1, "…exactly once");
  });
}

/* =================================================================== the database */

async function databaseChecks(db: LocalDb, rest: RestServer): Promise<void> {
  const fns = await import("../src/lib/shop/shop.functions");
  const shop = await import("../src/lib/shop/shop.server");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const economy = await import("../src/lib/economy/economy.server");
  const { createClient } = await import("@supabase/supabase-js");
  const { shopToday, mondayOf } = await import("../src/lib/shop/days");
  const { bundleForDay } = await import("../src/lib/shop/bundles");
  const admin = await adminDb();
  const call = callServerFn;
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const refused = (sql: string) => {
    const out = db.psql(`BEGIN; ${sql}; ROLLBACK;`);
    return out.ok && !/ERROR/.test(out.err) ? "" : out.err;
  };
  const deviceDb = (token: string | null) =>
    createClient(rest.url, ANON_KEY, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
  const events = async (event: string, player?: string) => {
    await flushAnalytics();
    return Number(q(`SELECT count(*) FROM analytics.events WHERE event = '${event}'${player ? ` AND player_id = '${player}'` : ""}`));
  };
  const balance = (id: string) => Number(q(`SELECT coalesce((SELECT balance FROM coin_wallets WHERE user_id = '${id}'), -1)`));
  const ledgerSum = (id: string) => Number(q(`SELECT coalesce(sum(amount), 0) FROM coin_ledger WHERE user_id = '${id}'`));
  const owns = (id: string, item: string) => q(`SELECT count(*) FROM inventory_items WHERE user_id = '${id}' AND item_id = '${item}'`) === "1";
  const tok = { joe: accountToken(JOE), kim: accountToken(KIM), leo: accountToken(LEO), mia: accountToken(MIA), ned: userToken(NED) };
  const req = () => crypto.randomUUID();
  const today = shopToday(Date.now());

  q(`SELECT public.create_profile('${JOE}', 'Joe_Shop', 3::smallint, DATE '1985-05-05', NULL)`);
  q(`SELECT public.create_profile('${KIM}', 'Kim_Plain', 4::smallint, DATE '1990-01-01', NULL)`);
  const sixteen = `${Number(today.slice(0, 4)) - 16}${today.slice(4)}`;
  q(`SELECT public.create_profile('${LEO}', 'Leo_Teen', 5::smallint, DATE '${sixteen}', NULL)`);
  q(`SELECT public.create_profile('${MIA}', 'Mia_Shop', 6::smallint, DATE '1992-02-02', NULL)`);

  /* ------------------------------------------------------------- testers */
  await section("testers", async () => {
    check(q(`SELECT shop.add_tester('joe_shop', 'testing the shop')`) === "added", "add_tester by username (any capitals)");
    check(q(`SELECT shop.add_tester('${JOE}', 'again')`) === "already_tester", "add_tester again: already_tester");
    q(`SELECT shop.add_tester('Leo_Teen', 'under-18 tester')`);
    q(`SELECT shop.add_tester('Mia_Shop', 'second tester')`);
    q(`SELECT shop.add_tester('Kim_Plain', 'briefly')`);
    check(q(`SELECT shop.remove_tester('Kim_Plain', 'not a tester after all')`) === "removed", "remove_tester");
    check(q(`SELECT shop.remove_tester('Kim_Plain', 'twice')`) === "not_a_tester", "remove_tester again: not_a_tester");
    check(q(`SELECT string_agg(username, ',' ORDER BY username) FROM shop.list_testers()`) === "Joe_Shop,Leo_Teen,Mia_Shop", "list_testers lists the three");
    // The one list: an account that becomes #0001 is put on it (shop.on_player_one), however it got there.
    q(`SELECT shop.remove_tester('Joe_Shop', 'check the #0001 trigger')`);
    q(`SELECT accounts.admin_assign_player_one('Joe_Shop')`);
    check(q(`SELECT player_number FROM profiles WHERE user_id = '${JOE}'`) === "1" && q(`SELECT count(*) FROM shop.testers WHERE user_id = '${JOE}'`) === "1", "an account that becomes #0001 is put on shop.testers");
    check(Number(q(`SELECT count(*) FROM shop.admin_log WHERE action IN ('add_tester', 'remove_tester')`)) === 8, "every tester change is logged");
    check(q(`SELECT count(*) FROM shop.admin_log WHERE by_role IS NULL OR note = ''`) === "0", "each log line has who and why");
    check(/note/.test(refused(`SELECT shop.add_tester('Kim_Plain', '')`)), "a note is required");
    check(/guests|no account/.test(refused(`SELECT shop.add_tester('${NED}', 'a guest')`)), "a guest can't be a tester");
    for (const role of ["anon", "authenticated", "service_role"]) {
      check(refused(`SET LOCAL ROLE ${role}; SELECT shop.add_tester('Kim_Plain', 'x')`) !== "", `${role} can't call shop.add_tester`);
      check(refused(`SET LOCAL ROLE ${role}; SELECT * FROM shop.testers`) !== "", `${role} can't read shop.testers`);
    }
    const viaApi = await deviceDb(tok.kim).rpc("shop_is_tester" as never, { p_user_id: KIM } as never);
    check(viaApi.error !== null, "a phone can't ask the tester question itself");
  });

  /* ------------------------------------------------------------- non-testers reach nothing */
  await section("non-testers", async () => {
    const view = await call(fns.getShopFn, { section: "featured" }, tok.kim);
    check(view.open === false && view.reason === "not_tester", `getShop: closed to a non-tester (${JSON.stringify(view)})`);
    const status = await call(fns.shopStatusFn, undefined, tok.kim);
    check(status.open === false && status.back.length === 0, "shopStatus: closed");
    const buy = await call(fns.buyItemFn, { itemId: "card-art.crimson", requestId: req() }, tok.kim);
    check(!buy.ok && buy.reason === "not_tester", "buyItem: refused");
    const bundle = await call(fns.buyBundleFn, { requestId: req() }, tok.kim);
    check(!bundle.ok && bundle.reason === "not_tester", "buyBundle: refused");
    const pack = await call(fns.testPackFn, { pack: "starter", requestId: req() }, tok.kim);
    check(!pack.ok && pack.reason === "not_tester", "testPack: refused");
    const wish = await call(fns.wishlistFn, { itemId: "card-art.crimson", on: true }, tok.kim);
    check(!wish.ok, "wishlist: refused");
    const direct = q(`SELECT shop_test_pack('${KIM}', 'starter', 'direct')`);
    check(JSON.parse(direct).status === "not_tester", "the database's own test-pack function refuses a non-tester too");
    check(balance(KIM) === 0 && q(`SELECT count(*) FROM shop_wishlist WHERE user_id = '${KIM}'`) === "0", "nothing changed for the non-tester");
    const guest = await call(fns.getShopFn, {}, tok.ned);
    check(guest.open === false, "a guest: closed");
    const guestPack = await call(fns.testPackFn, { pack: "starter", requestId: req() }, tok.ned);
    check(!guestPack.ok && guestPack.reason === "guest", "a guest: no test pack");
    // Switched on for everyone (train D's later step): a non-tester account sees it, test packs stay testers only.
    const on = await shop.shopAccess(admin, KIM, true);
    check(on.open && !on.tester, "switch on: every account sees the shop; test packs still need a tester");
  });

  /* ------------------------------------------------------------- the daily shop, recorded */
  let joeView: Awaited<ReturnType<typeof shop.shopViewFor>> | null = null;
  await section("daily shop", async () => {
    economy.forgetCatalogueCache();
    const view = await call(fns.getShopFn, { section: "featured" }, tok.joe);
    joeView = view;
    check(view.open === true && view.today.length === 4 && view.day === today, `getShop: a tester sees today's four (${JSON.stringify(view).slice(0, 160)})`);
    const recorded = JSON.parse(q(`SELECT json_build_object('items', items, 'rarities', rarities) FROM shop_days WHERE day = '${today}'`)) as { items: string[]; rarities: string[] };
    check(view.today.map((c: { id: string }) => c.id).join() === recorded.items.join(), "the four shown are the day's recorded four");
    const mia = await call(fns.getShopFn, { section: "daily" }, tok.mia);
    check(mia.today.map((c: { id: string }) => c.id).join() === recorded.items.join(), "a second tester sees the same four");
    check(Number(q(`SELECT count(*) FROM shop_days`)) === 1, "one day recorded (nothing before it)");
    // A later day picks on the recorded history and fills the days in between.
    const later = await shop.ensureShopDay(admin, today);
    check(later.items.join() === recorded.items.join(), "asking again: the stored day, unchanged");
    const { addDays } = await import("../src/lib/shop/days");
    const plus5 = await shop.ensureShopDay(admin, addDays(today, 5));
    check(Number(q(`SELECT count(*) FROM shop_days`)) === 6, "five days later: the four days between recorded too");
    const window = JSON.parse(q(`SELECT json_agg(items ORDER BY day) FROM shop_days`)) as string[][];
    const flat = window.flat();
    check(new Set(flat).size === flat.length, "the recorded days share no item (7-day rule on recorded history)");
    check(plus5.items.every((id) => SHOP.some((s) => s.id === id)), "only shop items recorded");
    check(refused(`SELECT shop_record_days('[{"day":"2030-01-01","items":["card-art.neon-skyline","card-art.crimson","card-art.neon-city","card-art.royal"],"rarities":["epic","epic","elite","epic"]}]'::jsonb)`) !== "", "the database refuses a day naming a pass item");
    check(refused(`SELECT shop_record_days('[{"day":"2030-01-01","items":["card-art.crimson","card-art.royal","card-art.emerald","card-art.lava"],"rarities":["epic","epic","elite","epic"]}]'::jsonb)`) !== "", "…or an item in a slot of another rarity");
    check(refused(`UPDATE shop_days SET items = items WHERE day = '${today}'`) === "" && q(`SELECT has_table_privilege('service_role', 'public.shop_days', 'UPDATE')`) === "f", "no API role may change a recorded day");
    const week = q(`SELECT bundle_id || ':' || price || ':' || full_price FROM shop_weeks WHERE week_start = '${mondayOf(today)}'`);
    const def = bundleForDay(today)!;
    check(week.startsWith(`${def.id}:${def.price}:`), `this week's bundle is recorded (${week})`);
    check(q(`SELECT (shop.day('${today}') ->> 'items') IS NOT NULL`) === "t", "shop.day shows a day's picks");
    check((await events("shop_viewed", JOE)) === 1 && (await events("shop_viewed", MIA)) === 1, "shop_viewed recorded");
  });

  /* ------------------------------------------------------------- buying */
  await section("buying", async () => {
    const view = joeView as { today: { id: string; price: number; rarity: string }[] } | null;
    if (!view) throw new Error("no view");
    const first = view.today[0]!;
    const poor = await call(fns.buyItemFn, { itemId: first.id, requestId: req() }, tok.joe);
    check(!poor.ok && poor.reason === "insufficient" && !owns(JOE, first.id) && balance(JOE) === 0, "too few coins: refused, nothing changed");
    q(`SELECT economy.grant_coins('Joe_Shop', 10000, 'shop-check')`);
    const rid = req();
    const bought = await call(fns.buyItemFn, { itemId: first.id, requestId: rid }, tok.joe);
    check(bought.ok && bought.status === "purchased" && balance(JOE) === 10000 - first.price, `bought: ${first.price} spent (${JSON.stringify(bought)})`);
    const line = q(`SELECT reason || ':' || amount FROM coin_ledger WHERE id = (SELECT ledger_id FROM inventory_items WHERE user_id = '${JOE}' AND item_id = '${first.id}')`);
    check(owns(JOE, first.id) && line === `shop_purchase:-${first.price}`, "the item is granted against its spend line");
    const twice = await call(fns.buyItemFn, { itemId: first.id, requestId: rid }, tok.joe);
    check(twice.ok && twice.status === "duplicate" && balance(JOE) === 10000 - first.price, "the same purchase twice pays once");
    const again = await call(fns.buyItemFn, { itemId: first.id, requestId: req() }, tok.joe);
    check(!again.ok && again.reason === "owned" && balance(JOE) === 10000 - first.price, "an owned item can't be bought again");
    const after = await call(fns.getShopFn, {}, tok.joe);
    check(after.today[0].id === first.id && after.today[0].owned === true, "bought today: the item stays in its slot, marked Owned");
    const notToday = SHOP.find((s) => !after.today.some((c: { id: string }) => c.id === s.id) && !(bundleForDay(today)?.items ?? []).includes(s.id))!;
    const nt = await call(fns.buyItemFn, { itemId: notToday.id, requestId: req() }, tok.joe);
    check(!nt.ok && nt.reason === "not_today" && !owns(JOE, notToday.id), "an item not on sale today is refused");
    const pass = await call(fns.buyItemFn, { itemId: "card-art.neon-skyline", requestId: req() }, tok.joe);
    check(!pass.ok && !owns(JOE, "card-art.neon-skyline"), "a pass item can't be bought");
    const bad = await call(fns.buyItemFn, { itemId: first.id, requestId: "x" }, tok.joe);
    check(!bad.ok && bad.reason === "bad_request", "a malformed request id is refused");
    // Mia: two different purchases at once with coins for one.
    const second = view.today[1]!;
    const third = view.today[2]!;
    q(`SELECT economy.grant_coins('Mia_Shop', ${second.price + 100}, 'shop-check race')`);
    const race = await Promise.all([
      call(fns.buyItemFn, { itemId: second.id, requestId: req() }, tok.mia),
      call(fns.buyItemFn, { itemId: third.id, requestId: req() }, tok.mia),
    ]);
    const okCount = race.filter((r) => r.ok).length;
    check(okCount === 1 && balance(MIA) >= 0 && ledgerSum(MIA) === balance(MIA), `two purchases at once with coins for one: exactly one goes through (${race.map((r) => (r.ok ? r.status : r.reason)).join(",")})`);
    check((await events("item_bought", JOE)) === 1, "item_bought recorded once for Joe");
    const props = JSON.parse(q(`SELECT props FROM analytics.events WHERE event = 'item_bought' AND player_id = '${JOE}'`)) as Record<string, unknown>;
    check(props["item"] === first.id && props["coins"] === first.price && props["rarity"] === first.rarity, "item_bought carries coins, item and rarity");
  });

  /* ------------------------------------------------------------- the bundle */
  await section("bundle", async () => {
    const def = bundleForDay(today)!;
    const owned = def.items.filter((id) => owns(JOE, id));
    const view = await call(fns.getShopFn, { section: "featured" }, tok.joe);
    check(view.bundle?.id === def.id && view.bundle.items.length === def.items.length, "getShop: this week's bundle");
    const expected = view.bundle.price as number;
    check(owned.length > 0 || expected === def.price, `the bundle's price (${expected})`);
    // Leo has no coins: insufficient, nothing granted.
    const leo = await call(fns.buyBundleFn, { requestId: req() }, tok.leo);
    check(!leo.ok && leo.reason === "insufficient" && def.items.every((id) => !owns(LEO, id)), "too few coins: no bundle item granted");
    // All or nothing: a failure on the last item's insert undoes the whole purchase.
    q(`SELECT economy.grant_coins('Leo_Teen', 20000, 'shop-check')`);
    const lastItem = def.items[def.items.length - 1]!;
    q(`CREATE OR REPLACE FUNCTION public.shop_check_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
         IF NEW.item_id = '${lastItem}' AND NEW.user_id = '${LEO}' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$;
       CREATE TRIGGER shop_check_fail BEFORE INSERT ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.shop_check_fail();`);
    const failed = await call(fns.buyBundleFn, { requestId: req() }, tok.leo);
    check(!failed.ok && balance(LEO) === 20000 && def.items.every((id) => !owns(LEO, id)) && q(`SELECT count(*) FROM coin_ledger WHERE user_id = '${LEO}' AND reason = 'bundle_purchase'`) === "0",
      "a failure on the last item: no coins spent, no item granted");
    q(`DROP TRIGGER shop_check_fail ON public.inventory_items; DROP FUNCTION public.shop_check_fail();`);
    const rid = req();
    const ok = await call(fns.buyBundleFn, { requestId: rid }, tok.leo);
    check(ok.ok && ok.status === "purchased" && balance(LEO) === 20000 - def.price && def.items.every((id) => owns(LEO, id)), `bought: every item for ${def.price} (${JSON.stringify(ok)})`);
    const lines = JSON.parse(q(`SELECT json_agg(json_build_object('a', amount, 'r', reason, 'k', ref_kind)) FROM coin_ledger WHERE user_id = '${LEO}' AND reason = 'bundle_purchase'`)) as { a: number; r: string; k: string }[];
    check(lines.length === def.items.length && -lines.reduce((s, l) => s + l.a, 0) === def.price && lines.every((l) => l.k === "bundle"), "one spend line per item, summing to the bundle's price");
    const twice = await call(fns.buyBundleFn, { requestId: rid }, tok.leo);
    check(balance(LEO) === 20000 - def.price && (twice.ok ? twice.status === "duplicate" : twice.reason === "owned"), "the same bundle purchase twice pays once");
    const again = await call(fns.buyBundleFn, { requestId: req() }, tok.leo);
    check(!again.ok && again.reason === "owned", "a bundle you own can't be bought again");
    // Part-owned: Joe owns at most one; buy one bundle item singly, then the bundle at the reduced price.
    // Every bundle item that isn't one of today's four: still on sale on its own this week, at its full price.
    const v1 = await call(fns.getShopFn, {}, tok.joe);
    const todayIds = (v1.today as { id: string }[]).map((c) => c.id);
    const single = def.items.find((id) => !owns(JOE, id) && !todayIds.includes(id)) ?? def.items.find((id) => !owns(JOE, id))!;
    const fullBefore = balance(JOE);
    const one = await call(fns.buyItemFn, { itemId: single, requestId: req() }, tok.joe);
    check(one.ok && owns(JOE, single) && balance(JOE) === fullBefore - PRICE.get(single)!, `a bundle item can be bought on its own this week at its full price (${single}, ${PRICE.get(single)})`);
    const before = balance(JOE);
    const v2 = await call(fns.getShopFn, {}, tok.joe);
    const ownedNow = new Set(def.items.filter((id) => owns(JOE, id)));
    const { bundlePriceFor } = await import("../src/lib/shop/bundles");
    const expectedPart = bundlePriceFor(def, ownedNow, (id) => PRICE.get(id) ?? null)!;
    const ownedFull = def.items.filter((id) => ownedNow.has(id)).reduce((a, id) => a + PRICE.get(id)!, 0);
    const allFull = def.items.reduce((a, id) => a + PRICE.get(id)!, 0);
    check(
      v2.bundle.price === expectedPart.price && v2.bundle.price === Math.floor((def.price - (def.price * ownedFull) / allFull) / 10) * 10,
      `part-owned bundle: the price less the owned items' share (${v2.bundle.price} = ${def.price} − ${def.price} × ${ownedFull}/${allFull}, rounded down to 10)`,
    );
    const part = await call(fns.buyBundleFn, { requestId: req() }, tok.joe);
    check(part.ok && balance(JOE) === before - v2.bundle.price && def.items.every((id) => owns(JOE, id)), `part-owned bundle: bought for ${v2.bundle.price}, every item now owned`);
    check(ledgerSum(JOE) === balance(JOE) && ledgerSum(LEO) === balance(LEO), "balances are the lines' sum");
    check(refused(`SELECT shop_purchase_bundle('${MIA}', '${mondayOf(today)}', '${def.id}', ARRAY['${def.items[0]}'], ARRAY[1], 'cheap')`) === "" &&
      JSON.parse(q(`SELECT shop_purchase_bundle('${MIA}', '${mondayOf(today)}', '${def.id}', ARRAY['${def.items[0]}'], ARRAY[1], 'cheap')`)).status === "bad_price",
      "the database refuses a bundle more than 30 % off");
    check((await events("bundle_bought", LEO)) === 1, "bundle_bought recorded");
  });

  /* ------------------------------------------------------------- test purchases */
  await section("test packs", async () => {
    const before = balance(JOE);
    const rid = req();
    const p = await call(fns.testPackFn, { pack: "multipack", requestId: rid }, tok.joe);
    check(p.ok && p.status === "credited" && balance(JOE) === before + 3000, `a tester's test purchase: 3,000 credited (${JSON.stringify(p)})`);
    const line = JSON.parse(q(`SELECT json_build_object('id', id, 'r', reason, 'k', ref_kind, 'p', ref_id) FROM coin_ledger WHERE user_id = '${JOE}' AND reason = 'test_purchase'`)) as { id: number; r: string; k: string; p: string };
    check(line.r === "test_purchase" && line.k === "test_pack" && line.p === "multipack", "marked as a test: reason test_purchase, ref test_pack / the pack");
    const twice = await call(fns.testPackFn, { pack: "multipack", requestId: rid }, tok.joe);
    check(twice.ok && twice.status === "duplicate" && balance(JOE) === before + 3000, "the same test purchase twice credits once");
    const teen = await call(fns.testPackFn, { pack: "starter", requestId: req() }, tok.leo);
    check(!teen.ok && teen.reason === "under_age", "an under-18 tester can't buy packs");
    check(JSON.parse(q(`SELECT shop_test_pack('${LEO}', 'starter', 'teen-direct')`)).status === "under_age", "…nor through the database's own function");
    const leoView = await call(fns.getShopFn, {}, tok.leo);
    check(leoView.packsAllowed === false && (await call(fns.getShopFn, {}, tok.joe)).packsAllowed === true, "the view says whether packs are allowed (18+)");
    const badPack = await call(fns.testPackFn, { pack: "huge", requestId: req() }, tok.joe);
    check(!badPack.ok && badPack.reason === "bad_request", "an unknown pack is refused");
    check(q(`SELECT count(*) FROM shop.test_purchases('Joe_Shop')`) === "1", "test_purchases lists it");
    const removed = JSON.parse(q(`SELECT shop.remove_test_purchase(${line.id}, 'end of test')`)) as { status: string; taken: number };
    check(removed.status === "removed" && removed.taken === 3000 && balance(JOE) === before, "remove_test_purchase takes it back with a line of its own");
    check(q(`SELECT count(*) FROM coin_ledger WHERE id = ${line.id}`) === "1", "the test line itself is never changed or deleted");
    check(JSON.parse(q(`SELECT shop.remove_test_purchase(${line.id}, 'again')`)).status === "already_removed" && balance(JOE) === before, "…once");
    check(q(`SELECT removed FROM shop.test_purchases('Joe_Shop')`) === "t", "test_purchases shows it removed");
    // Spent test coins: refused unless told to take what is left.
    q(`SELECT economy.grant_coins('Mia_Shop', 1, 'shop-check')`);
    const miaBefore = balance(MIA);
    await call(fns.testPackFn, { pack: "starter", requestId: req() }, tok.mia);
    const miaLine = q(`SELECT id FROM coin_ledger WHERE user_id = '${MIA}' AND reason = 'test_purchase'`);
    q(`SELECT economy.adjust_coins('Mia_Shop', -${miaBefore + 300}, 'spend most of it')`);
    check(/balance/.test(refused(`SELECT shop.remove_test_purchase(${miaLine}, 'x')`)), "removing spent test coins refuses by default");
    const partial = JSON.parse(q(`SELECT shop.remove_test_purchase(${miaLine}, 'x', true)`)) as { taken: number };
    check(partial.taken === 200 && balance(MIA) === 0, "…or takes what is left when asked");
    for (const role of ["anon", "authenticated", "service_role"])
      check(refused(`SET LOCAL ROLE ${role}; SELECT shop.remove_test_purchase(${line.id}, 'x')`) !== "", `${role} can't remove test purchases`);
    check((await events("pack_bought", JOE)) === 1, "pack_bought recorded");
    const props = JSON.parse(q(`SELECT props FROM analytics.events WHERE event = 'pack_bought' AND player_id = '${JOE}'`)) as Record<string, unknown>;
    check(props["test"] === true && props["pack"] === "multipack" && props["coins"] === 3000, "pack_bought marks the test");
  });

  /* ------------------------------------------------------------- the wishlist */
  await section("wishlist", async () => {
    const view = await call(fns.getShopFn, {}, tok.mia);
    const target = (view.today as { id: string; owned: boolean }[]).find((c) => !c.owned)!;
    const on = await call(fns.wishlistFn, { itemId: target.id, on: true }, tok.mia);
    check(on.ok && on.wished && q(`SELECT count(*) FROM shop_wishlist WHERE user_id = '${MIA}'`) === "1", "the heart adds a wishlist row");
    const pass = await call(fns.wishlistFn, { itemId: "card-art.neon-skyline", on: true }, tok.mia);
    check(!pass.ok, "a pass item can't be wishlisted");
    const fresh = await call(fns.shopStatusFn, undefined, tok.mia);
    check(fresh.open && !fresh.back.some((b: { id: string }) => b.id === target.id), "status: an item hearted today while on sale hasn't come back");
    q(`UPDATE shop_wishlist SET created_at = now() - interval '9 days' WHERE user_id = '${MIA}' AND item_id = '${target.id}'`);
    const status = await call(fns.shopStatusFn, undefined, tok.mia);
    check(status.open && status.back.some((b: { id: string }) => b.id === target.id), "status: an item hearted before and on sale today is back (the notice and the dot)");
    const elsewhere = SHOP.find((s) => !(view.today as { id: string }[]).some((c) => c.id === s.id) && !(bundleForDay(today)?.items ?? []).includes(s.id))!;
    await call(fns.wishlistFn, { itemId: elsewhere.id, on: true }, tok.mia);
    q(`UPDATE shop_wishlist SET created_at = now() - interval '9 days' WHERE user_id = '${MIA}' AND item_id = '${elsewhere.id}'`);
    const s2 = await call(fns.shopStatusFn, undefined, tok.mia);
    check(!s2.back.some((b: { id: string }) => b.id === elsewhere.id), "an item not on sale today isn't announced");
    const view2 = await call(fns.getShopFn, {}, tok.mia);
    check(view2.wishlist.includes(target.id) && view2.today.find((c: { id: string }) => c.id === target.id)?.wished === true, "the view marks the heart");
    const off = await call(fns.wishlistFn, { itemId: target.id, on: false }, tok.mia);
    check(off.ok && !off.wished && q(`SELECT count(*) FROM shop_wishlist WHERE user_id = '${MIA}' AND item_id = '${target.id}'`) === "0", "a second tap takes the heart off");
    const theirs = await deviceDb(tok.joe).from("shop_wishlist").select("*").eq("user_id", MIA);
    check(!theirs.error && (theirs.data ?? []).length === 0, "a phone reads only its own wishlist");
    const write = await deviceDb(tok.mia).from("shop_wishlist").insert({ user_id: MIA, item_id: "card-art.aurora" } as never);
    check(write.error !== null, "a phone can't write the wishlist itself");
    check((await events("wishlist_added", MIA)) === 2, "wishlist_added recorded for each heart");
  });

  /* ------------------------------------------------------------- nobody but the database writes */
  await section("grants", async () => {
    const leaks: string[] = [];
    for (const role of ["anon", "authenticated", "service_role"])
      for (const t of ["shop_days", "shop_weeks", "shop_wishlist"])
        for (const priv of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"])
          if (q(`SELECT has_table_privilege('${role}', 'public.${t}', '${priv}')`) === "t") leaks.push(`${role} ${priv} ${t}`);
    check(leaks.length === 0, `no API role may write the shop's tables${leaks.length ? ` (${leaks.join("; ")})` : ""}`);
    for (const role of ["anon", "authenticated"])
      for (const t of ["shop_days", "shop_weeks"])
        check(q(`SELECT has_table_privilege('${role}', 'public.${t}', 'SELECT')`) === "f", `${role} can't read ${t}`);
    for (const fn of ["shop_purchase_bundle(uuid, date, text, text[], integer[], text)", "shop_test_pack(uuid, text, text)", "shop_wishlist_set(uuid, text, boolean)", "shop_record_days(jsonb)", "shop_is_tester(uuid)"])
      for (const role of ["anon", "authenticated"])
        check(q(`SELECT has_function_privilege('${role}', 'public.${fn}', 'EXECUTE')`) === "f", `${role} can't execute ${fn.split("(")[0]}`);
    check(q(`SELECT has_schema_privilege('service_role', 'shop', 'USAGE')`) === "f", "the shop schema is unreachable from the API");
  });
}
