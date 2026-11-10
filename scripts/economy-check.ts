/**
 * economy-check (wave 2 A1, 10 Nov 2026; docs/economy/README.md): coins and items, through the real server functions
 * (src/lib/economy/economy.functions.ts), the real server helpers (economy.server.ts) and the real migrations on a
 * local PostgreSQL 16, with the server-function harness's PostgREST / GoTrue stand-in (scripts/server-fn-harness.ts).
 *
 * What it proves:
 * - the catalogue matches docs/art/wave-2/catalogue.json item for item, field for field, and the counts hold: 110
 *   items, 52 shop (30 Epic, 15 Elite, 7 Legendary at 1,000 / 1,600 / 2,800), 10 free-track, 30 premium-track, 18 free
 *   or earned; nothing outside the shop is priced, every Legendary animates, the shop query returns exactly the 52;
 * - the table refuses a priced non-shop item, a shop Rare, a wrong price, a still Legendary, a non-exclusive pass item;
 * - the ledger: credit, spend and refund; the same idempotency key pays once; two spends at once that together
 *   exceed the balance: exactly one succeeds; the balance is always the lines' sum; lines can't be changed;
 * - guests have nothing; anon, authenticated and the service role can't insert, update or delete any economy row, and
 *   a player reads only their own;
 * - ownership and equipping: owned item in its slot, refusals for not owned, wrong slot, unknown slot and guest, the
 *   default back on unequip, the reaction set, the gem refusing locked colours;
 * - every new sign-up and every account from before the migration owns the 8 free card arts and the Plain frame;
 * - Joe's admin functions work, are logged with who, what and when, and are unreachable for anon, authenticated and
 *   the service role; an account's removal takes its economy rows with it;
 * - the four analytics events.
 *
 * Needs the PostgreSQL 16 binaries (preinstalled on GitHub's runners). Without them it fails on CI and prints a NOTE
 * locally. No browser.
 */

import { readFileSync } from "node:fs";

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
  if (/^\s*(FAIL|NOTE)|^economy-check|^PASS/.test(line)) quietLog(...args);
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
  game: string | null;
  rarity: string | null;
  source: string;
  pass_level: number | null;
  shop_price_coins: number | null;
  bundle: string | null;
  animated: boolean;
  exclusive_forever: boolean;
  finish_or_note: string | null;
  png: string;
  html: string;
}
const ITEMS = (JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: JsonItem[] }).items;

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ANA = uid(21); // signs up through completeSignUpFn
const BEN = uid(22); // an account from before the migration (backfill)
const CAT = uid(23); // a guest
const DEV = uid(24); // an account for Joe's tools, later removed
const ELI = uid(25); // a second account (RLS)

let db: LocalDb | null = null;
let rest: RestServer | null = null;

await pureChecks();

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`economy-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  console.log(`economy-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

try {
  db = startLocalDb("economy-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  db.psql(`INSERT INTO auth.users (id, is_anonymous, email) VALUES
    ('${ANA}', false, 'ana@example.com'), ('${BEN}', false, 'ben@example.com'), ('${CAT}', true, NULL),
    ('${DEV}', false, 'dev@example.com'), ('${ELI}', false, 'eli@example.com')`);
  await installServerFnPlugin();
  await databaseChecks(db, rest);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

restore();
console.log(`economy-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: the catalogue, the coin ledger, consumables, ownership, equipping and Joe's tools hold.");
process.exit(0);

/* =================================================================== pure rules */

async function pureChecks(): Promise<void> {
  await section("slots", async () => {
    const slots = await import("../src/lib/economy/slots");
    check(ITEMS.length === 110, `catalogue.json holds 110 items (${ITEMS.length})`);
    check(new Set(ITEMS.map((i) => i.id)).size === ITEMS.length, "catalogue.json: every id is unique");
    check(ITEMS.every((i) => (slots.ITEM_KINDS as readonly string[]).includes(i.kind)), "every kind is in ITEM_KINDS");
    check(ITEMS.every((i) => (slots.ITEM_SOURCES as readonly string[]).includes(i.source)), "every source is in ITEM_SOURCES");
    check(ITEMS.filter((i) => i.game).every((i) => slots.GAME_TYPE_BY_NAME[i.game!]), "every skinned game has a PuzzleType id");
    const { GAME_DISPLAY_NAMES: GAME_NAMES } = await import("../src/lib/duel/gameNames");
    check(
      Object.entries(slots.GAME_TYPE_BY_NAME).every(([name, type]) => (GAME_NAMES as Record<string, string>)[type] === name),
      "GAME_TYPE_BY_NAME matches gameNames.ts",
    );
    const everySlotFilled = ITEMS.every((i) => {
      const s = slots.itemSlot(i);
      return s === "reaction" ? slots.slotAccepts("reaction-1", s) : slots.isLoadoutSlot(s) && slots.slotAccepts(s, s);
    });
    check(everySlotFilled, "every item has a loadout slot it fits");
    check(
      slots.LOADOUT_SLOTS.filter((s) => s.startsWith("reaction-")).length === slots.REACTION_SLOTS && !slots.isLoadoutSlot(`reaction-${slots.REACTION_SLOTS + 1}`),
      `the reaction set is exactly ${slots.REACTION_SLOTS} slots`,
    );
    check(!slots.slotAccepts("card-art", "frame") && !slots.slotAccepts("game-skin:pool", "game-skin:racing"), "slotAccepts refuses the wrong slot");
    check(slots.AVATAR_IDS.length === 32, "32 avatars");
    const avatars = JSON.parse(readFileSync("docs/art/avatars/avatars.json", "utf8")) as {
      avatars: { slug: string }[];
      gems: Record<string, unknown>;
    };
    check(avatars.avatars.map((a) => a.slug).join() === slots.AVATAR_IDS.join(), "AVATAR_IDS are avatars.json's slugs, in order");
    check(
      Object.keys(avatars.gems).map((g) => g.toLowerCase().replace(/\s+/g, "-")).join() === slots.GEM_IDS.join(),
      "GEM_IDS are avatars.json's gems, slugged",
    );
    const starters = ITEMS.filter((i) => i.source === "free-starter").map((i) => i.id);
    check(starters.length === 9 && starters.filter((s) => s.startsWith("card-art.")).length === 8 && starters.includes("frame.plain"), "starters: 8 free card arts and the Plain frame");
    check(starters.includes(slots.SLOT_DEFAULTS["card-art"]!) && starters.includes(slots.SLOT_DEFAULTS["frame"]!), "slot defaults are starter items");
  });
}

/* =================================================================== the database */

async function databaseChecks(db: LocalDb, rest: RestServer): Promise<void> {
  const fns = await import("../src/lib/economy/economy.functions");
  const economy = await import("../src/lib/economy/economy.server");
  const account = await import("../src/lib/account/account.functions");
  const data = await import("../src/lib/data/economy.server");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const { createClient } = await import("@supabase/supabase-js");
  const slots = await import("../src/lib/economy/slots");
  const admin = await adminDb();
  const call = callServerFn;
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  /** Runs SQL that must fail; answers the error text ("" if it succeeded). */
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
  const owned = (id: string) => q(`SELECT string_agg(item_id, ',' ORDER BY item_id) FROM inventory_items WHERE user_id = '${id}'`);
  const STARTERS = ITEMS.filter((i) => i.source === "free-starter").map((i) => i.id).sort().join(",");
  const tok = { ana: accountToken(ANA), ben: accountToken(BEN), cat: userToken(CAT), dev: accountToken(DEV), eli: accountToken(ELI) };

  /* ------------------------------------------------------------- the catalogue */
  await section("catalogue", async () => {
    const rows = JSON.parse(q(`SELECT json_agg(c ORDER BY sort_order) FROM catalogue_items c`)) as Record<string, unknown>[];
    check(rows.length === ITEMS.length, `the table holds ${ITEMS.length} items (${rows.length})`);
    const byId = new Map(rows.map((r) => [r["id"] as string, r]));
    const mismatches: string[] = [];
    ITEMS.forEach((item, i) => {
      const r = byId.get(item.id);
      if (!r) return mismatches.push(`${item.id} missing`);
      const want: Record<string, unknown> = {
        name: item.name,
        kind: item.kind,
        game: item.game,
        game_type: item.game ? slots.GAME_TYPE_BY_NAME[item.game] : null,
        rarity: item.rarity ? item.rarity.toLowerCase() : null,
        source: item.source,
        pass_level: item.pass_level,
        price_coins: item.shop_price_coins,
        bundle: item.bundle,
        animated: item.animated,
        exclusive: item.source !== "shop",
        exclusive_forever: item.exclusive_forever,
        note: item.finish_or_note,
        png_path: item.png,
        html_path: item.html,
        slot: slots.itemSlot(item),
        sort_order: i + 1,
      };
      for (const [k, v] of Object.entries(want)) if (r[k] !== v) mismatches.push(`${item.id}.${k}: ${JSON.stringify(r[k])} ≠ ${JSON.stringify(v)}`);
    });
    check(mismatches.length === 0, `every item matches catalogue.json field for field${mismatches.length ? ` (${mismatches.slice(0, 4).join("; ")})` : ""}`);
    const count = (where: string) => Number(q(`SELECT count(*) FROM catalogue_items WHERE ${where}`));
    check(count("source = 'shop'") === 52, "52 shop items");
    check(count("source = 'shop' AND rarity = 'epic' AND price_coins = 1000") === 30, "30 Epic at 1,000");
    check(count("source = 'shop' AND rarity = 'elite' AND price_coins = 1600") === 15, "15 Elite at 1,600");
    check(count("source = 'shop' AND rarity = 'legendary' AND price_coins = 2800") === 7, "7 Legendary at 2,800");
    check(count("source = 'pass-free'") === 10, "10 free-track items");
    check(count("source = 'pass-premium'") === 30, "30 premium-track items");
    check(count("source IN ('free-starter', 'earned-season-peak-tier', 'earned-founding-player', 'earned-top-500')") === 18, "18 free or earned");
    check(count("source <> 'shop' AND price_coins IS NOT NULL") === 0, "nothing outside the shop is priced");
    check(count("source <> 'shop' AND NOT exclusive") === 0 && count("source = 'shop' AND exclusive") === 0, "exclusive exactly when not from the shop");
    check(count("rarity = 'legendary' AND NOT animated") === 0, "every Legendary animates");
    check(count("source = 'shop' AND rarity IN ('common', 'rare')") === 0, "Common and Rare are never sold");

    const shopIds = ITEMS.filter((i) => i.source === "shop").map((i) => i.id).sort().join();
    const shop = await data.readShopItems(admin);
    check(!shop.error && shop.data.map((r) => r.id).sort().join() === shopIds, "the shop query (server) returns exactly the 52 shop items");
    const anonShop = await deviceDb(null).from("catalogue_shop").select("id, exclusive, source");
    const anonRows = (anonShop.data ?? []) as { id: string; exclusive: boolean; source: string }[];
    check(!anonShop.error && anonRows.map((r) => r.id).sort().join() === shopIds && anonRows.every((r) => !r.exclusive && r.source === "shop"), "the shop query (a phone) returns the same 52, none exclusive");
    check(Number(q(`SELECT count(*) FROM catalogue_shop WHERE exclusive OR source <> 'shop'`)) === 0, "no shop query row is exclusive");

    const base = `INSERT INTO catalogue_items (id, name, kind, slot, rarity, source, pass_level, price_coins, animated, exclusive) VALUES`;
    check(refused(`${base} ('frame.x', 'X', 'frame', 'frame', 'rare', 'pass-free', 3, 1000, false, true)`) !== "", "refused: a priced pass item");
    check(refused(`${base} ('frame.x', 'X', 'frame', 'frame', 'rare', 'shop', NULL, 1000, false, false)`) !== "", "refused: a Rare in the shop");
    check(refused(`${base} ('frame.x', 'X', 'frame', 'frame', 'epic', 'shop', NULL, 900, false, false)`) !== "", "refused: an Epic at 900");
    check(refused(`${base} ('frame.x', 'X', 'frame', 'frame', 'epic', 'shop', NULL, NULL, false, false)`) !== "", "refused: a shop item without a price");
    check(refused(`${base} ('frame.x', 'X', 'frame', 'frame', 'legendary', 'shop', NULL, 2800, false, false)`) !== "", "refused: a Legendary that doesn't animate");
    check(refused(`${base} ('frame.x', 'X', 'frame', 'frame', 'epic', 'pass-premium', 4, NULL, false, false)`) !== "", "refused: a pass item not marked exclusive");
    check(refused(`${base} ('frame.x', 'X', 'frame', 'frame', 'epic', 'shop', NULL, 1000, false, true)`) !== "", "refused: a shop item marked exclusive");
    check(refused(`${base} ('frame.x', 'X', 'frame', 'card-art', 'epic', 'shop', NULL, 1000, false, false)`) !== "", "refused: an item in another kind's slot");
    check(refused(`${base} ('frame.x', 'X', 'frame', 'frame', 'epic', 'shop', NULL, 1000, false, false)`) === "", "accepted: a well-formed shop Epic (rolled back)");

    const viaFn = await call(fns.getCatalogue, undefined, null);
    check(Array.isArray(viaFn) && viaFn.length === 110 && viaFn[0].id === ITEMS[0]!.id && viaFn.every((i: { id: string }) => typeof i.id === "string"), "getCatalogue: all 110 items in order, no sign-in needed");
    const neon = (viaFn as { id: string; priceCoins: number | null; exclusive: boolean; slot: string }[]).find((i) => i.id === "card-art.neon-skyline");
    check(neon?.priceCoins === null && neon.exclusive === true && neon.slot === "card-art", "getCatalogue: a pass item has no price and is exclusive");
  });

  /* ------------------------------------------------------------- starter items */
  await section("starter items", async () => {
    const made = await call(account.completeSignUpFn, { username: "Ana_Econ", dateOfBirth: "1994-03-02", colour: 4, country: "GB" }, tok.ana);
    check(made?.kind === "account", `sign-up: Ana's account is made (${JSON.stringify(made).slice(0, 120)})`);
    check(owned(ANA) === STARTERS, "sign-up: a new account owns the 8 free card arts and the Plain frame");
    check(balance(ANA) === 0 && q(`SELECT avatar_id FROM loadouts WHERE user_id = '${ANA}'`) === "captain-joulz", "sign-up: a wallet at 0 and the default avatar");
    check(Number(q(`SELECT count(*) FROM inventory_items WHERE user_id = '${ANA}' AND how = 'starter' AND ledger_id IS NULL`)) === 9, "sign-up: granted as starter, no coins");
    check((await events("item_granted", ANA)) === 9, "sign-up: one item_granted event per starter item");

    // An account that existed before the economy: its economy rows taken away by hand, then the seed migration again.
    q(`SELECT public.create_profile('${BEN}', 'Ben_Before', 2::smallint, DATE '1990-01-01', NULL)`);
    q(`DELETE FROM loadouts WHERE user_id = '${BEN}'; DELETE FROM inventory_items WHERE user_id = '${BEN}'; DELETE FROM coin_wallets WHERE user_id = '${BEN}';`);
    check(owned(BEN) === "", "backfill: Ben starts with nothing (as an account from before the migration)");
    const again = db.psql(readFileSync("supabase/migrations/20261110160100_economy_catalogue.sql", "utf8"));
    check(again.ok && !/ERROR/.test(again.err), `backfill: the seed migration applies again (${again.err.slice(0, 120)})`);
    check(owned(BEN) === STARTERS && balance(BEN) === 0 && q(`SELECT count(*) FROM loadouts WHERE user_id = '${BEN}'`) === "1", "backfill: an existing account gets its wallet, loadout and starter items");
    check(Number(q(`SELECT count(*) FROM catalogue_items`)) === 110, "backfill: applying it again adds no item");
    const core = db.psql(readFileSync("supabase/migrations/20261110160000_economy.sql", "utf8"));
    check(core.ok && !/ERROR/.test(core.err), `the core migration applies again (idempotent) (${core.err.slice(0, 120)})`);
    check(
      Number(q(`SELECT count(*) FROM profiles p WHERE (SELECT count(*) FROM inventory_items i JOIN catalogue_items c ON c.id = i.item_id WHERE i.user_id = p.user_id AND c.source = 'free-starter') <> 9`)) === 0,
      "every account owns every starter item",
    );
  });

  // DEV and ELI become accounts the same way the server makes them.
  q(`SELECT public.create_profile('${DEV}', 'Dev_Admin', 7::smallint, DATE '1988-01-01', NULL)`);
  q(`SELECT public.create_profile('${ELI}', 'Eli_Other', 8::smallint, DATE '1989-01-01', NULL)`);

  /* ------------------------------------------------------------- the ledger */
  await section("ledger", async () => {
    economy.forgetCatalogueCache();
    const c1 = await economy.creditCoins(admin, { userId: ANA, amount: 1000, reason: "signup_reward", ref: { kind: "reward", id: "signup" }, key: `signup_reward:${ANA}` });
    check(c1.status === "credited" && c1.balance === 1000, `credit: 1,000 credited (${JSON.stringify(c1)})`);
    const c2 = await economy.creditCoins(admin, { userId: ANA, amount: 1000, reason: "signup_reward", key: `signup_reward:${ANA}` });
    check(c2.status === "duplicate" && balance(ANA) === 1000, "credit: the same key pays once");
    const bad = await economy.creditCoins(admin, { userId: ANA, amount: 5, reason: "made_up", key: "x" });
    check(bad.status === "bad_reason" && balance(ANA) === 1000, "credit: an unknown reason is refused");
    const s1 = await economy.spendCoins(admin, { userId: ANA, amount: 300, reason: "shop_purchase", ref: { kind: "purchase", id: "p1" }, key: "spend:p1" });
    check(s1.status === "spent" && s1.balance === 700 && balance(ANA) === 700, "spend: 300 spent, 700 left");
    const s2 = await economy.spendCoins(admin, { userId: ANA, amount: 300, reason: "shop_purchase", key: "spend:p1" });
    check(s2.status === "duplicate" && balance(ANA) === 700, "spend: the same key charges once");
    const over = await economy.spendCoins(admin, { userId: ANA, amount: 701, reason: "shop_purchase", key: "spend:over" });
    check(over.status === "insufficient" && balance(ANA) === 700, "spend: never below zero");
    const r1 = await economy.refundCoins(admin, ANA, s1.line_id!);
    check(r1.status === "refunded" && r1.balance === 1000, "refund: the spend is given back");
    const r2 = await economy.refundCoins(admin, ANA, s1.line_id!);
    check(r2.status === "duplicate" && balance(ANA) === 1000, "refund: a line is refunded once");
    const r3 = await economy.refundCoins(admin, ANA, c1.line_id!);
    check(r3.status === "not_a_spend", "refund: a credit can't be refunded");
    check(ledgerSum(ANA) === balance(ANA), "the balance is the sum of the lines");
    const lineCount = Number(q(`SELECT count(*) FROM coin_ledger WHERE user_id = '${ANA}'`));
    check(lineCount === 3 && q(`SELECT string_agg(balance_after::text, ',' ORDER BY id) FROM coin_ledger WHERE user_id = '${ANA}'`) === "1000,700,1000", "one line per change, each with its balance after");

    const guest = await economy.creditCoins(admin, { userId: CAT, amount: 100, reason: "ad_reward", key: "g1" });
    check(guest.status === "no_account" && balance(CAT) === -1 && Number(q(`SELECT count(*) FROM coin_ledger WHERE user_id = '${CAT}'`)) === 0, "guests: no coins, no wallet, no lines");
    const guestFk = refused(`INSERT INTO coin_ledger (user_id, amount, reason, idempotency_key, balance_after) VALUES ('${CAT}', 5, 'ad_reward', 'k', 5)`);
    check(guestFk !== "", "guests: the database refuses a line for a user without a profile");

    check(/never changed/.test(refused(`UPDATE coin_ledger SET amount = 999999 WHERE user_id = '${ANA}'`)), "lines can't be changed, even by the owner role");
    check(/never changed/.test(refused(`DELETE FROM coin_ledger WHERE user_id = '${ANA}'`)), "lines can't be removed while the account exists");
    check(refused(`UPDATE coin_wallets SET balance = -5 WHERE user_id = '${ANA}'`) !== "", "a wallet can't go below zero");

    check((await events("coins_credited", ANA)) === 2 && (await events("coins_spent", ANA)) === 1, "events: coins_credited (credit, refund) and coins_spent");
    const props = JSON.parse(q(`SELECT props FROM analytics.events WHERE event = 'coins_spent' AND player_id = '${ANA}'`)) as Record<string, unknown>;
    check(props["reason"] === "shop_purchase" && props["amount"] === 300, "events: coins_spent carries reason and amount");
  });

  /* ------------------------------------------------------------- two spends at once */
  await section("concurrency", async () => {
    await economy.creditCoins(admin, { userId: ELI, amount: 1000, reason: "admin_adjustment", key: "eli:start" });
    const pair = await Promise.all([
      data.spendCoinsRpc(admin, { userId: ELI, amount: 700, reason: "shop_purchase", key: "eli:a" }),
      data.spendCoinsRpc(admin, { userId: ELI, amount: 700, reason: "shop_purchase", key: "eli:b" }),
    ]);
    const statuses = pair.map((p) => p.data?.status).sort().join();
    check(statuses === "insufficient,spent" && balance(ELI) === 300, `two spends of 700 on 1,000 at once: exactly one succeeds (${statuses}, ${balance(ELI)})`);
    await economy.creditCoins(admin, { userId: ELI, amount: 700, reason: "admin_adjustment", key: "eli:top" });
    const ten = await Promise.all(
      Array.from({ length: 10 }, (_, i) => data.spendCoinsRpc(admin, { userId: ELI, amount: 150, reason: "shop_purchase", key: `eli:ten:${i}` })),
    );
    const spent = ten.filter((t) => t.data?.status === "spent").length;
    check(spent === 6 && balance(ELI) === 100 && ten.every((t) => !t.error), `ten spends of 150 on 1,000 at once: exactly six succeed (${spent}, ${balance(ELI)})`);
    const same = await Promise.all([
      data.creditCoinsRpc(admin, { userId: ELI, amount: 50, reason: "ad_reward", key: "eli:same" }),
      data.creditCoinsRpc(admin, { userId: ELI, amount: 50, reason: "ad_reward", key: "eli:same" }),
    ]);
    check(same.map((s) => s.data?.status).sort().join() === "credited,duplicate" && balance(ELI) === 150, "the same key twice at once pays once");
    check(ledgerSum(ELI) === balance(ELI), "after the races the balance is still the lines' sum");
  });

  /* ------------------------------------------------------------- nobody but the database writes */
  await section("grants and RLS", async () => {
    const tables = ["catalogue_items", "coin_wallets", "coin_ledger", "consumable_balances", "consumable_ledger", "consumable_kinds", "economy_reasons", "inventory_items", "loadouts", "loadout_slots", "gem_unlocks"];
    const leaks: string[] = [];
    for (const role of ["anon", "authenticated", "service_role"])
      for (const t of tables)
        for (const priv of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"])
          if (q(`SELECT has_table_privilege('${role}', 'public.${t}', '${priv}')`) === "t") leaks.push(`${role} ${priv} ${t}`);
    check(leaks.length === 0, `no API role may insert, update or delete economy rows${leaks.length ? ` (${leaks.slice(0, 4).join("; ")})` : ""}`);

    const eli = deviceDb(tok.eli);
    const tries = await Promise.all([
      eli.from("coin_ledger").insert({ user_id: ELI, amount: 5000, reason: "ad_reward", idempotency_key: "hack", balance_after: 5000 }),
      eli.from("coin_wallets").update({ balance: 99999 }).eq("user_id", ELI),
      eli.from("coin_ledger").delete().eq("user_id", ELI),
      eli.from("inventory_items").insert({ user_id: ELI, item_id: "card-art.aurora", how: "grant" }),
      eli.from("loadout_slots").insert({ user_id: ELI, slot: "card-art", item_id: "card-art.aurora" }),
      eli.from("consumable_balances").insert({ user_id: ELI, kind: "streak_freeze", count: 9 }),
      eli.from("catalogue_items").update({ price_coins: 1 }).eq("id", "card-art.aurora"),
      eli.from("gem_unlocks").insert({ user_id: ELI, gem: "diamond" }),
      deviceDb(null).from("coin_ledger").insert({ user_id: ELI, amount: 5, reason: "ad_reward", idempotency_key: "anon", balance_after: 5 }),
      admin.from("coin_ledger").insert({ user_id: ELI, amount: 5, reason: "ad_reward", idempotency_key: "svc", balance_after: 5 }),
      admin.from("coin_wallets").update({ balance: 5 }).eq("user_id", ELI),
      admin.from("inventory_items").insert({ user_id: ELI, item_id: "card-art.aurora", how: "grant" }),
    ]);
    check(tries.every((t) => t.error), `a phone (signed in or not) and the service role are refused every direct write (${tries.map((t) => (t.error ? "x" : "OK")).join("")})`);
    check(balance(ELI) === 150 && !owned(ELI).includes("aurora"), "nothing changed");
    const rpcFromPhone = await eli.rpc("economy_credit", { p_user_id: ELI, p_amount: 5000, p_reason: "ad_reward", p_ref_kind: null, p_ref_id: null, p_key: "phone" });
    const rpcEquip = await eli.rpc("economy_equip", { p_user_id: ANA, p_slot: "card-art", p_item_id: null });
    check(!!rpcFromPhone.error && !!rpcEquip.error && balance(ELI) === 150, "a phone can't call the economy's server functions");

    const ownLines = await eli.from("coin_ledger").select("user_id");
    const ownRows = (ownLines.data ?? []) as { user_id: string }[];
    check(!ownLines.error && ownRows.length > 0 && ownRows.every((r) => r.user_id === ELI), "a player reads their own lines and only theirs");
    for (const t of ["coin_wallets", "inventory_items", "loadouts", "consumable_balances", "loadout_slots"]) {
      const other = await eli.from(t as "coin_wallets").select("user_id").eq("user_id", ANA);
      check(!other.error && (other.data ?? []).length === 0, `RLS: ${t} shows nothing of another player`);
    }
    const anonWallet = await deviceDb(null).from("coin_wallets").select("user_id");
    check((anonWallet.data ?? []).length === 0, "RLS: a signed-out phone reads no wallet");
  });

  /* ------------------------------------------------------------- the wallet and consumables */
  await section("wallet and consumables", async () => {
    const g1 = await economy.grantConsumable(admin, { userId: ANA, kind: "streak_freeze", amount: 2, reason: "pass_reward", key: "pass:s1:5" });
    const g2 = await economy.grantConsumable(admin, { userId: ANA, kind: "streak_freeze", amount: 2, reason: "pass_reward", key: "pass:s1:5" });
    check(g1.status === "granted" && g1.count === 2 && g2.status === "duplicate", "consumables: granted once per key");
    await economy.grantConsumable(admin, { userId: ANA, kind: "ticket_score_attack", amount: 1, reason: "plus_monthly", key: "plus:2026-11" });
    const u1 = await economy.useConsumable(admin, { userId: ANA, kind: "streak_freeze", amount: 1, reason: "admin_adjustment", key: "use:1" });
    const u2 = await economy.useConsumable(admin, { userId: ANA, kind: "streak_freeze", amount: 5, reason: "admin_adjustment", key: "use:2" });
    check(u1.status === "used" && u1.count === 1 && u2.status === "insufficient", "consumables: used, never below zero");
    const badKind = await economy.grantConsumable(admin, { userId: ANA, kind: "golden_ticket", amount: 1, reason: "pass_reward", key: "k" });
    const guest = await economy.grantConsumable(admin, { userId: CAT, kind: "streak_freeze", amount: 1, reason: "pass_reward", key: "k" });
    check(badKind.status === "bad_kind" && guest.status === "no_account", "consumables: an unknown kind and a guest are refused");
    check(q(`SELECT count FROM consumable_balances WHERE user_id = '${ANA}' AND kind = 'streak_freeze'`) === String(Number(q(`SELECT sum(amount) FROM consumable_ledger WHERE user_id = '${ANA}' AND kind = 'streak_freeze'`))), "consumables: the count is the lines' sum");

    const w = await call(fns.getMyWallet, undefined, tok.ana);
    check(w.account === true && w.balance === 1000 && w.consumables.streak_freeze === 1 && w.consumables.ticket_score_attack === 1 && w.consumables.ticket_category_cup === 0, `getMyWallet: balance and consumable counts (${JSON.stringify(w).slice(0, 160)})`);
    check(w.recent.length === 3 && w.recent[0].reason === "refund" && w.recent.every((l: { id: number }) => typeof l.id === "number"), "getMyWallet: the latest lines, newest first");
    const gw = await call(fns.getMyWallet, undefined, tok.cat);
    check(gw.account === false && gw.balance === null && gw.consumables === null, "getMyWallet: a guest gets none");
  });

  /* ------------------------------------------------------------- buying (for the shop session) */
  await section("purchase", async () => {
    economy.forgetCatalogueCache();
    const p1 = await economy.purchaseItem(admin, { userId: ANA, itemId: "frame.gold", key: "buy:gold" });
    check(p1.status === "purchased" && p1.price === 1000 && balance(ANA) === 0, `purchase: an Epic for 1,000 (${JSON.stringify(p1)})`);
    const line = q(`SELECT ledger_id FROM inventory_items WHERE user_id = '${ANA}' AND item_id = 'frame.gold'`);
    check(line === String(p1.line_id) && q(`SELECT how FROM inventory_items WHERE user_id = '${ANA}' AND item_id = 'frame.gold'`) === "shop", "purchase: owned, with the spend line");
    const p2 = await economy.purchaseItem(admin, { userId: ANA, itemId: "frame.gold", key: "buy:gold" });
    check(p2.status === "duplicate" && balance(ANA) === 0, "purchase: the same key charges once");
    await economy.creditCoins(admin, { userId: ANA, amount: 5000, reason: "admin_adjustment", key: "ana:top" });
    const p3 = await economy.purchaseItem(admin, { userId: ANA, itemId: "frame.gold", key: "buy:gold:2" });
    check(p3.status === "owned" && balance(ANA) === 5000, "purchase: an owned item isn't bought twice");
    for (const id of ["card-art.neon-skyline", "card-art.joulz-navy", "frame.founding", "card-art.tier.volt"]) {
      const r = await economy.purchaseItem(admin, { userId: ANA, itemId: id, key: `buy:${id}` });
      check(r.status === "not_for_sale", `purchase: ${id} is not for sale`);
    }
    const poor = await economy.purchaseItem(admin, { userId: ELI, itemId: "card-art.aurora", key: "eli:aurora" });
    check(poor.status === "insufficient" && !owned(ELI).includes("aurora"), "purchase: not enough coins, nothing given");
    check((await events("item_granted", ANA)) === 10, "events: item_granted on a purchase");
  });

  /* ------------------------------------------------------------- equipping */
  await section("equipping", async () => {
    economy.forgetCatalogueCache();
    const start = await call(fns.getMyLoadout, undefined, tok.ana);
    check(start.slots["card-art"] === "card-art.joulz-navy" && start.slots["frame"] === "frame.plain" && start.slots["name-colour"] === null && Object.keys(start.equipped).length === 0, "loadout: defaults before anything is equipped");
    check(slots.LOADOUT_SLOTS.every((s) => s in start.slots), "loadout: every slot is named");
    const e1 = await call(fns.equip, { slot: "frame", itemId: "frame.gold" }, tok.ana);
    check(e1.ok === true && e1.loadout.slots.frame === "frame.gold" && e1.loadout.equipped.frame === "frame.gold", "equip: an owned frame in the frame slot");
    const e2 = await call(fns.equip, { slot: "card-art", itemId: "card-art.grid" }, tok.ana);
    check(e2.ok === true && e2.loadout.slots["card-art"] === "card-art.grid", "equip: a starter card art");
    const notOwned = await call(fns.equip, { slot: "card-art", itemId: "card-art.aurora" }, tok.ana);
    check(notOwned.ok === false && notOwned.reason === "not_owned", "equip: refused, not owned");
    const wrong = await call(fns.equip, { slot: "card-art", itemId: "frame.gold" }, tok.ana);
    check(wrong.ok === false && wrong.reason === "wrong_slot", "equip: refused, wrong slot");
    const unknownSlot = await call(fns.equip, { slot: "hat", itemId: "frame.gold" }, tok.ana);
    check(unknownSlot.ok === false && unknownSlot.reason === "unknown_slot", "equip: refused, unknown slot");
    const unknownItem = await call(fns.equip, { slot: "frame", itemId: "frame.nope" }, tok.ana);
    check(unknownItem.ok === false && unknownItem.reason === "unknown_item", "equip: refused, unknown item");
    const guest = await call(fns.equip, { slot: "card-art", itemId: "card-art.grid" }, tok.cat);
    check(guest.ok === false && guest.reason === "guest", "equip: refused, guest");
    const direct = await data.equipRpc(admin, { userId: ANA, slot: "frame", itemId: "frame.obsidian" });
    check(direct.data === "not_owned", "equip: the database itself refuses an item not owned");
    const un = await call(fns.equip, { slot: "frame", itemId: null }, tok.ana);
    check(un.ok === true && un.loadout.slots.frame === "frame.plain" && !("frame" in un.loadout.equipped), "unequip: the slot returns to its default");

    // Skins, world themes and the reaction set (granted as a pass would).
    for (const id of ["game-skin.cue-ball.neon-8-ball", "world-theme.cue-ball.neon-table", "reaction.spark", "reaction.zap", "reaction.banter", "celebration.circuit-overload", "celebration.power-surge"])
      check((await economy.grantItem(admin, { userId: ANA, itemId: id, how: "pass" })) === "granted", `grant: ${id}`);
    check((await economy.grantItem(admin, { userId: ANA, itemId: "reaction.spark", how: "pass" })) === "owned", "grant: an item is owned at most once");
    check((await economy.grantItem(admin, { userId: CAT, itemId: "reaction.spark", how: "pass" })) === "no_account", "grant: a guest gets no items");
    const skin = await call(fns.equip, { slot: "game-skin:pool", itemId: "game-skin.cue-ball.neon-8-ball" }, tok.ana);
    const skinWrong = await call(fns.equip, { slot: "game-skin:racing", itemId: "game-skin.cue-ball.neon-8-ball" }, tok.ana);
    const theme = await call(fns.equip, { slot: "world-theme:pool", itemId: "world-theme.cue-ball.neon-table" }, tok.ana);
    check(skin.ok && theme.ok && skinWrong.ok === false && skinWrong.reason === "wrong_slot", "equip: a skin and a world theme per game, never another game's");
    const entrance = await call(fns.equip, { slot: "podium-entrance", itemId: "celebration.circuit-overload" }, tok.ana);
    const celebration = await call(fns.equip, { slot: "celebration", itemId: "celebration.power-surge" }, tok.ana);
    const entranceWrong = await call(fns.equip, { slot: "celebration", itemId: "celebration.circuit-overload" }, tok.ana);
    check(entrance.ok && celebration.ok && entranceWrong.ok === false, "equip: the podium entrance and the celebration in their own slots");
    const r1 = await call(fns.equip, { slot: "reaction-1", itemId: "reaction.spark" }, tok.ana);
    const r2 = await call(fns.equip, { slot: "reaction-2", itemId: "reaction.zap" }, tok.ana);
    const moved = await call(fns.equip, { slot: "reaction-3", itemId: "reaction.spark" }, tok.ana);
    check(r1.ok && r2.ok && moved.ok && moved.loadout.slots["reaction-1"] === null && moved.loadout.slots["reaction-3"] === "reaction.spark", "reactions: a set; one reaction sits in one slot at a time");
    const over = await call(fns.equip, { slot: `reaction-${slots.REACTION_SLOTS + 1}`, itemId: "reaction.banter" }, tok.ana);
    check(over.ok === false && over.reason === "unknown_slot", `reactions: at most ${slots.REACTION_SLOTS}`);
    check((await events("item_equipped", ANA)) >= 7, "events: item_equipped");

    // Removing an item (Joe's tool) unequips it.
    q(`SELECT economy.remove_item('Ana_Econ', 'reaction.zap', 'check: removing unequips')`);
    const after = await call(fns.getMyLoadout, undefined, tok.ana);
    check(after.slots["reaction-2"] === null && !owned(ANA).includes("reaction.zap"), "an item removed from the inventory leaves its slot");
    // A refund of a bought item takes it back and out of its slot.
    await call(fns.equip, { slot: "frame", itemId: "frame.gold" }, tok.ana);
    const goldLine = Number(q(`SELECT ledger_id FROM inventory_items WHERE user_id = '${ANA}' AND item_id = 'frame.gold'`));
    const refund = await economy.refundCoins(admin, ANA, goldLine);
    const afterRefund = await call(fns.getMyLoadout, undefined, tok.ana);
    check(refund.status === "refunded" && refund.item_removed === "frame.gold" && afterRefund.slots.frame === "frame.plain" && balance(ANA) === 6000, "refund: a bought item goes back with its coins, out of its slot");

    const inv = await call(fns.getMyInventory, undefined, tok.ana);
    check(Array.isArray(inv) && inv.length === 9 + 6 && inv.every((i: { name: string; how: string }) => i.name && i.how), "getMyInventory: owned items with their catalogue fields");
    const gInv = await call(fns.getMyInventory, undefined, tok.cat);
    const gLoad = await call(fns.getMyLoadout, undefined, tok.cat);
    check(Array.isArray(gInv) && gInv.length === 0 && gLoad === null, "a guest owns nothing and has no loadout");
  });

  /* ------------------------------------------------------------- the avatar and the gem */
  await section("avatar", async () => {
    const ok = await call(fns.setAvatar, { avatarId: "orbit", colour: 12, gem: null }, tok.ana);
    check(ok.ok === true && ok.loadout.avatarId === "orbit" && ok.loadout.colour === 12 && ok.loadout.gem === null, "setAvatar: one of the 32 in one of the 32 colours");
    check(q(`SELECT colour FROM profiles WHERE user_id = '${ANA}'`) === "12", "setAvatar: the colour is the profile's colour");
    const badAvatar = await call(fns.setAvatar, { avatarId: "pikachu", colour: 1, gem: null }, tok.ana);
    const badColour = await call(fns.setAvatar, { avatarId: "orbit", colour: 32, gem: null }, tok.ana);
    check(badAvatar.reason === "bad_avatar" && badColour.reason === "bad_colour", "setAvatar: refuses an unknown avatar or colour");
    const locked = await call(fns.setAvatar, { avatarId: "orbit", colour: 12, gem: "amber" }, tok.ana);
    check(locked.ok === false && locked.reason === "gem_locked", "the gem refuses a colour not unlocked (none are, until C1)");
    const direct = await data.setAvatarRpc(admin, { userId: ANA, avatarId: "orbit", colour: 12, gem: "ruby" });
    check(direct.data === "gem_locked", "the database itself refuses a locked gem");
    check(refused(`UPDATE loadouts SET gem = 'ruby' WHERE user_id = '${ANA}'`) !== "", "the loadout's foreign key refuses a locked gem even for the owner role");
    q(`INSERT INTO gem_unlocks (user_id, gem) VALUES ('${ANA}', 'amber')`); // as C1 will
    const unlocked = await call(fns.setAvatar, { avatarId: "orbit", colour: 12, gem: "amber" }, tok.ana);
    check(unlocked.ok === true && unlocked.loadout.gem === "amber" && unlocked.loadout.unlockedGems.join() === "amber", "the gem accepts an unlocked colour");
    const guest = await call(fns.setAvatar, { avatarId: "orbit", colour: 1, gem: null }, tok.cat);
    check(guest.ok === false && guest.reason === "guest", "setAvatar: refused, guest");

    // The builder's options (Joe's addendum): each option must belong to that avatar.
    const opts = await call(fns.getAvatarOptions, undefined, null);
    const avatarsJson = JSON.parse(readFileSync("docs/art/avatars/avatars.json", "utf8")) as { avatars: { slug: string; accent: string }[] };
    check(
      avatarsJson.avatars.every((a) => opts[a.slug]?.accent.default === a.accent.toLowerCase() && opts[a.slug].accent.options.join() === a.accent.toLowerCase() && opts[a.slug].background.default === slots.AVATAR_SCENE_BACKGROUND),
      "getAvatarOptions: every avatar's own accent and scene background from docs/art/avatars/, as defaults",
    );
    check(slots.AVATAR_IDS.every((a) => opts[a].feature.options.length === 0 && opts[a].accessory.options.length === 0), "getAvatarOptions: no feature or accessory options yet (the art defines none: the gap in the README)");
    const orbitAccent = opts["orbit"].accent.default as string;
    const hoverAccent = opts["hover"].accent.default as string;
    const withOpts = await call(fns.setAvatar, { avatarId: "orbit", colour: 12, accent: orbitAccent, background: "scene", gem: "amber" }, tok.ana);
    check(withOpts.ok === true && withOpts.loadout.avatar.accent === orbitAccent && withOpts.loadout.avatar.background === "scene" && withOpts.loadout.avatar.feature === null, "setAvatar: stores the accent and background with the avatar");
    const foreign = await call(fns.setAvatar, { avatarId: "orbit", colour: 12, accent: hoverAccent === orbitAccent ? "#000000" : hoverAccent, gem: null }, tok.ana);
    const noFeature = await call(fns.setAvatar, { avatarId: "orbit", colour: 12, feature: "horns", gem: null }, tok.ana);
    const noAccessory = await call(fns.setAvatar, { avatarId: "orbit", colour: 12, accessory: "neon-bolt", gem: null }, tok.ana);
    const noBackground = await call(fns.setAvatar, { avatarId: "orbit", colour: 12, background: "beach", gem: null }, tok.ana);
    check([foreign, noFeature, noAccessory, noBackground].every((r) => r.ok === false && r.reason === "bad_option"), "setAvatar: refuses another avatar's accent and any feature, accessory or background that isn't the avatar's");
    const directOpt = await data.setAvatarRpc(admin, { userId: ANA, avatarId: "hover", colour: 3, accent: orbitAccent === hoverAccent ? "#000000" : orbitAccent, gem: null });
    check(directOpt.data === "bad_option", "the database itself checks each option belongs to the avatar");
    const kept = q(`SELECT avatar_id || ',' || coalesce(accent, '') || ',' || coalesce(gem, '') FROM loadouts WHERE user_id = '${ANA}'`);
    check(kept === `orbit,${orbitAccent},amber`, "a refused change leaves the look as it was");
    const neonBolt = ITEMS.find((i) => i.id === "avatar-accessory.neon-bolt");
    check(neonBolt?.kind === "avatar-accessory" && slots.LOADOUT_SLOTS.includes("avatar-accessory"), "the Neon Bolt item is the avatar-accessory loadout slot, apart from the avatar's own accessory option");
    const newAcc = q(`SELECT avatar_id || ',' || (accent IS NULL) || ',' || (feature IS NULL) || ',' || (accessory IS NULL) || ',' || (background IS NULL) FROM loadouts WHERE user_id = '${BEN}'`);
    check(newAcc === "captain-joulz,true,true,true,true" && q(`SELECT colour FROM profiles WHERE user_id = '${BEN}'`) === "2", "a new account starts as Captain Joulz's helmet in its own colour");
  });

  /* ------------------------------------------------------------- public cards */
  await section("public cards", async () => {
    await call(fns.equip, { slot: "card-art", itemId: "card-art.grid" }, tok.ana);
    const card = await call(fns.getPublicCard, { playerId: ANA }, tok.eli);
    check(card.account === true && card.username === "Ana_Econ" && card.avatarId === "orbit" && card.avatar?.background === "scene" && card.colour === 12 && card.gem === "amber" && card.cardArt === "card-art.grid" && card.frame === "frame.plain" && card.nameColour === null && typeof card.playerNumber === "number" && card.founding === true, `getPublicCard: an account's card (${JSON.stringify(card).slice(0, 200)})`);
    check(!("balance" in card) && !("dateOfBirth" in card) && !("country" in card), "getPublicCard: no balance, date of birth or country");
    const guest = await call(fns.getPublicCard, { playerId: CAT }, tok.eli);
    check(guest.account === false && guest.username === null && guest.cardArt === "card-art.joulz-navy" && guest.frame === "frame.plain" && guest.avatarId === null && guest.colour === null, "getPublicCard: a guest gets the default card (no avatar: colour plus initial)");
    const bad = await call(fns.getPublicCard, { playerId: "not-an-id" }, tok.eli);
    check(bad === null, "getPublicCard: a bad id gets null");
    q(`UPDATE profiles SET deletion_requested_at = now() WHERE user_id = '${ELI}'`);
    const leaving = await call(fns.getPublicCard, { playerId: ELI }, tok.ana);
    const leavingEquip = await data.equipRpc(admin, { userId: ELI, slot: "card-art", itemId: "card-art.grid" });
    const leavingSpend = await economy.spendCoins(admin, { userId: ELI, amount: 1, reason: "shop_purchase", key: "leaving" });
    check(leaving.account === false && leavingEquip.data === "no_account" && leavingSpend.status === "no_account", "an account waiting for deletion: the default card, no equipping or spending");
    q(`UPDATE profiles SET deletion_requested_at = NULL WHERE user_id = '${ELI}'`);
  });

  /* ------------------------------------------------------------- Joe's tools */
  await section("admin", async () => {
    const out = (sql: string) => db.psql(sql);
    const g = out(`SELECT economy.grant_coins('Dev_Admin', 500, 'check: a make-good')`);
    check(g.ok && /"credited"|"ok"/.test(g.out) && balance(DEV) === 500, `grant_coins: 500 credited (${g.out.trim()}${g.err})`);
    const g2 = out(`SELECT economy.grant_coins('${DEV}', 1000, 'check: a missed sign-up reward', 'signup_reward')`);
    check(g2.ok && balance(DEV) === 1500 && q(`SELECT reason FROM coin_ledger WHERE user_id = '${DEV}' ORDER BY id DESC LIMIT 1`) === "signup_reward", "grant_coins: by user id, with a reason");
    const a = out(`SELECT economy.adjust_coins('dev_admin', -200, 'check: a duplicate grant')`);
    check(a.ok && balance(DEV) === 1300, "adjust_coins: down 200");
    check(/insufficient/.test(out(`SELECT economy.adjust_coins('Dev_Admin', -99999, 'check')`).err), "adjust_coins: never below zero");
    check(/give a note/.test(out(`SELECT economy.grant_coins('Dev_Admin', 5, '  ')`).err), "a note is required");
    check(/no account/.test(out(`SELECT economy.grant_coins('${CAT}', 5, 'check')`).err), "a guest can't be given coins");
    check(out(`SELECT economy.grant_item('Dev_Admin', 'frame.diamond', 'check: a prize')`).out.trim() === "granted" && owned(DEV).includes("frame.diamond"), "grant_item: given");
    check(/no item/.test(out(`SELECT economy.grant_item('Dev_Admin', 'frame.nope', 'check')`).err), "grant_item: an unknown item is refused");
    check(out(`SELECT economy.remove_item('Dev_Admin', 'frame.diamond', 'check: by mistake')`).out.trim() === "removed" && !owned(DEV).includes("frame.diamond"), "remove_item: taken away");
    check(/starter/.test(out(`SELECT economy.remove_item('Dev_Admin', 'frame.plain', 'check')`).err), "remove_item: a starter item stays");
    check(out(`SELECT economy.grant_consumable('Dev_Admin', 'ticket_category_cup', 3, 'check: tickets')`).ok && q(`SELECT count FROM consumable_balances WHERE user_id = '${DEV}' AND kind = 'ticket_category_cup'`) === "3", "grant_consumable: 3 tickets");
    const summary = JSON.parse(q(`SELECT economy.account_summary('Dev_Admin')`)) as { balance: number; ledger_sum: number; items: string[] };
    check(summary.balance === 1300 && summary.ledger_sum === 1300 && summary.items.includes("frame.plain"), "account_summary: balance, the lines' sum, items");
    const log = q(`SELECT string_agg(action || ':' || (by_role <> '') || ':' || (note <> ''), ',' ORDER BY id) FROM economy.admin_log WHERE user_id = '${DEV}'`);
    check(log === "grant_coins:true:true,grant_coins:true:true,adjust_coins:true:true,grant_item:true:true,remove_item:true:true,grant_consumable:true:true", `every admin change is logged with who, what, when and the note (${log})`);
    check(Number(q(`SELECT count(*) FROM coin_ledger WHERE user_id = '${DEV}' AND ref_kind = 'admin' AND idempotency_key LIKE 'admin:%'`)) === 3, "admin lines name their log line");
    check((await events("coins_credited", DEV)) === 2 && (await events("coins_spent", DEV)) === 1 && (await events("item_granted", DEV)) === 10, "events: the admin tools record theirs");

    const fnsList = q(`SELECT string_agg(p.oid::regprocedure::text, ' ') FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'economy'`).split(" ");
    const reachable: string[] = [];
    for (const role of ["anon", "authenticated", "service_role"]) {
      if (q(`SELECT has_schema_privilege('${role}', 'economy', 'USAGE')`) === "t") reachable.push(`${role} USAGE economy`);
      for (const f of fnsList) if (q(`SELECT has_function_privilege('${role}', '${f}', 'EXECUTE')`) === "t") reachable.push(`${role} ${f}`);
      if (q(`SELECT has_table_privilege('${role}', 'economy.admin_log', 'SELECT')`) === "t") reachable.push(`${role} admin_log`);
    }
    check(fnsList.length >= 10 && reachable.length === 0, `the economy schema (admin functions and log) is unreachable for anon, authenticated and service_role${reachable.length ? ` (${reachable.slice(0, 3).join("; ")})` : ""}`);
    const viaApi = await admin.rpc("grant_coins" as "economy_credit", { p_player: "Dev_Admin", p_amount: 5, p_note: "x" } as never);
    check(!!viaApi.error && balance(DEV) === 1300, "the admin functions can't be called through the API");
    const publicFns = q(`SELECT string_agg(p.oid::regprocedure::text, ' ') FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname LIKE 'economy\\_%' AND p.proname <> 'economy_public_cards'`).split(" ");
    const open = publicFns.filter((f) => ["anon", "authenticated"].some((r) => q(`SELECT has_function_privilege('${r}', '${f}', 'EXECUTE')`) === "t"));
    check(publicFns.length === 9 && open.length === 0, `the server's economy functions are for the service role only (${publicFns.length}${open.length ? `; ${open.join(" ")}` : ""})`);
  });

  /* ------------------------------------------------------------- an account removed */
  await section("removal", async () => {
    const before = Number(q(`SELECT count(*) FROM coin_ledger WHERE user_id = '${DEV}'`));
    const r = db.psql(`SELECT accounts.forget_user('${DEV}')`);
    check(r.ok && !/ERROR/.test(r.err) && before > 0, `forget_user removes an account with coins, items and lines (${r.err.slice(0, 160)})`);
    const left = q(`SELECT (SELECT count(*) FROM coin_ledger WHERE user_id = '${DEV}') + (SELECT count(*) FROM coin_wallets WHERE user_id = '${DEV}') + (SELECT count(*) FROM inventory_items WHERE user_id = '${DEV}') + (SELECT count(*) FROM consumable_ledger WHERE user_id = '${DEV}') + (SELECT count(*) FROM loadouts WHERE user_id = '${DEV}')`);
    check(left === "0", "its economy rows go with it");
    check(q(`SELECT count(*) FROM economy.admin_log WHERE user_id = '${DEV}'`) === "0" && Number(q(`SELECT count(*) FROM economy.admin_log WHERE user_id IS NULL AND action = 'grant_coins'`)) >= 2, "its admin-log lines stay without its id");
  });
}
