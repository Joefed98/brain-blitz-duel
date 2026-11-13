/**
 * cosmetics-withdrawn-check (13 Nov 2026, Joe's rule: every cosmetic offered must look premium; docs/cosmetics-review):
 * withdrawn items, card backs in more games and the Card Table bundle, through the real migrations on a local
 * PostgreSQL 16 and the real server code (scripts/server-fn-harness.ts), at a fixed scenario time (never today's date).
 *
 * What it proves:
 *  1. The list: exactly the review's non-Keep items are withdrawn (the migration's list, docs/cosmetics-review's
 *     verdicts), each a catalogue item; Keep items aren't.
 *  2. Never sold: the shop query leaves them out; a purchase answers not_for_sale; `sellable` refuses them; 60 days of
 *     daily picks never show one; a day recorded before an item was withdrawn shows the next backup in its place;
 *     a week whose bundle holds a withdrawn item has no bundle (nothing recorded, buying refused).
 *  3. Never given: a pass, earned or starter grant answers withdrawn (only Joe's own grant still gives one); a new
 *     account's starter set is the starters that aren't withdrawn; the Championship frame's grant stays off.
 *  4. Owners keep them: an owner's inventory and equipped slot are untouched, and an owned item still equips.
 *  5. The pass: a withdrawn level shows as a gap ("Being redrawn"), isn't claimable (refused "withdrawn") and pays
 *     nothing; restored, it is claimable and pays the item.
 *  6. Joe's functions: economy.restore_item (one line) brings an item back to the shop query and gives it to everyone
 *     it was owed to (starters, season rewards, recorded Championship winners), logged; economy.withdraw_item takes one
 *     away, logged; neither is reachable by anon, authenticated or the service role.
 *  7. Customise lists a withdrawn item only for its owner.
 *  8. The Card Table bundle is Proposal A (Aurora in place of the Full House felts and Royal; 5,500), on sale once Joe
 *     restored the three card backs (20261116600200); a bundle still holding a withdrawn item stays unsold.
 *  9. Card backs: Summit, Thirteen and Five Hands draw the account's back (and only the back); a result in those games
 *     stores it; other games don't.
 * 10. The Top 500 frame: given with the Top 500 badge (Joe, 13 Nov 2026), dormant while withdrawn; restoring it gives it
 *     to every badge holder.
 *
 *   bun scripts/cosmetics-withdrawn-check.ts   (~10 s; needs the PostgreSQL 16 binaries, as economy-check)
 */
import { readFileSync } from "node:fs";

import { accountToken, ANON_KEY, installServerFnPlugin, postgresBin, SERVICE_KEY, startLocalDb, startRestServer, type LocalDb, type RestServer } from "./server-fn-harness";

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
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^cosmetics-withdrawn-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};

type Item = { id: string; source: string; kind: string; rarity: string | null };
const { catalogueItems } = await import("./catalogue-files");
const ITEMS = catalogueItems<Item>();
const MIGRATION = readFileSync("supabase/migrations/20261116600000_catalogue_withdrawn.sql", "utf8");
const WITHDRAWN = [...MIGRATION.slice(MIGRATION.indexOf("FROM (VALUES")).matchAll(/\('([a-z0-9.-]+)'\)/g)].map((m) => m[1]!);
/** Joe's restores since (13 Nov 2026: the card backs, 20261116600200_restore_card_backs.sql). */
const RESTORE = readFileSync("supabase/migrations/20261116600200_restore_card_backs.sql", "utf8");
const RESTORED = new Set([...RESTORE.matchAll(/economy\.restore_item\('([a-z0-9.-]+)'/g)].map((m) => m[1]!));
const W = new Set(WITHDRAWN.filter((id) => !RESTORED.has(id)));

/* =================================================================== pure */
{
  check(WITHDRAWN.length === 72 && new Set(WITHDRAWN).size === 72, `the migration withdraws 72 items, each once (${WITHDRAWN.length})`);
  check([...RESTORED].sort().join() === "card-back.holo-foil,card-back.neon,card-back.royal-damask" && W.size === 69, `Joe restored the three card backs, one line each: 69 stay withdrawn (${W.size})`);
  check(WITHDRAWN.every((id) => ITEMS.some((i) => i.id === id)), "every withdrawn id is a catalogue item");
  const review = readFileSync("docs/cosmetics-review/verdicts.json", "utf8");
  const verdicts = JSON.parse(review) as Record<string, string>;
  const notKeep = ITEMS.filter((i) => verdicts[i.id] !== "Keep").map((i) => i.id).sort();
  check(JSON.stringify([...WITHDRAWN].sort()) === JSON.stringify(notKeep), "exactly the review's items not marked Keep are withdrawn");
  check(ITEMS.every((i) => verdicts[i.id] !== undefined), "every catalogue item has a verdict");
  const { sellable } = await import("../src/lib/shop/dailyShop");
  check(!sellable({ source: "shop", exclusive: false, priceCoins: 1000, rarity: "epic", withdrawn: true }) && sellable({ source: "shop", exclusive: false, priceCoins: 1000, rarity: "epic", withdrawn: false }), "sellable refuses a withdrawn shop item, keeps a live one");
  const { ownsItem, sourceLine } = await import("../src/lib/identity/customise");
  const starter = { id: "card-art.grid", name: "Grid", kind: "card-art", rarity: null, source: "free-starter", passLevel: null, shopPrice: null, animated: false };
  check(ownsItem({ ...starter, withdrawn: false }, new Set()) && !ownsItem({ ...starter, withdrawn: true }, new Set()) && ownsItem({ ...starter, withdrawn: true }, new Set(["card-art.grid"])), "a withdrawn starter is only an owner's");
  check(sourceLine({ ...starter, source: "shop", rarity: "epic", withdrawn: true }, true) === null && sourceLine({ ...starter, source: "pass-free", passLevel: 6, withdrawn: true }, true) === null, "a withdrawn item says nowhere it comes from (it isn't offered)");
  const { BUNDLES } = await import("../src/lib/shop/bundles");
  const ct = BUNDLES.find((b) => b.id === "card-table")!;
  check(ct.items.join() === "card-back.holo-foil,card-back.royal-damask,card-art.aurora,card-art.crimson,card-art.emerald" && ct.price === 5500 && ct.size === "medium", "Card Table is Proposal A: the two backs, Aurora, Crimson, Emerald for 5,500");
  check(!ct.items.some((id) => id.startsWith("game-skin.full-house.") || id === "card-art.royal"), "no Full House felt and no Royal in Card Table");
  const L = await import("../src/lib/arcade/skins/look");
  check(["pokersquares", "tripeaks", "pyramid", "fivehands"].every(L.isCardBackGame) && !L.isCardBackGame("freecell") && !L.isCardBackGame("mahjong"), "card backs on Full House, Summit, Thirteen and Five Hands; not Free Cell (face up) or Mahjong (tiles)");
  for (const g of ["tripeaks", "pyramid", "fivehands"]) {
    const s = L.lookFromStored(g, { skin: "game-skin.apex.molten-gold", world: "world-theme.apex.neon-night", back: "card-back.neon" });
    check(s.back === "card-back.neon" && s.skin === null && s.world === null, `${g}: a stored look gives the back only`);
    check(L.lookFromStored(g, { back: "card-back.made-up" }) === L.NO_LOOK, `${g}: an unknown back draws the default`);
  }
  check(L.lookFromStored("freecell", { back: "card-back.neon" }) === L.NO_LOOK, "Free Cell never takes a back");
  for (const f of ["tripeaks", "pyramid", "fiveHands"]) {
    const src = readFileSync(`src/puzzles/${f}.tsx`, "utf8");
    check(/useGameLookRef\("(tripeaks|pyramid|fivehands)"\)/.test(src) && /withCardsLook\(lookRef\.current, \(\) => art\.draw/.test(src), `${f}: the live stage draws inside the account's card back`);
  }
}

/* =================================================================== the database */
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ANA = uid(71); // tester, owns a withdrawn item before the withdrawal
const BOB = uid(72); // a new account after it
const CAL = uid(73); // season reward
const DEE = uid(74); // Championship winner
const NOW = Date.parse("2026-11-18T12:00:00Z"); // a Wednesday of week 2 (Card Table's week)

async function databaseChecks(db: LocalDb): Promise<void> {
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const refused = (sql: string) => {
    const out = db.psql(`BEGIN; ${sql}; ROLLBACK;`);
    return out.ok && !/ERROR/.test(out.err) ? "" : out.err;
  };
  const owns = (id: string, item: string) => q(`SELECT count(*) FROM inventory_items WHERE user_id = '${id}' AND item_id = '${item}'`) === "1";
  const { adminDb } = await import("../src/lib/data/db.server");
  const economy = await import("../src/lib/economy/economy.server");
  const shop = await import("../src/lib/shop/shop.server");
  const pass = await import("../src/lib/pass/pass.server");
  const admin = await adminDb();

  await section("the list", async () => {
    const live = q(`SELECT string_agg(id, ',' ORDER BY id) FROM catalogue_items WHERE withdrawn_at IS NOT NULL`).split(",");
    check(live.join() === [...W].sort().join(), `the database withdraws exactly the list (${live.length})`);
    const shopIds = q(`SELECT string_agg(id, ',' ORDER BY id) FROM catalogue_shop`).split(",");
    const keepShop = ITEMS.filter((i) => i.source === "shop" && !W.has(i.id)).map((i) => i.id).sort();
    check(shopIds.join() === keepShop.join(), `the shop query is the shop items not withdrawn (${shopIds.length})`);
    economy.forgetCatalogueCache();
    const cat = await economy.catalogue(admin, NOW);
    check(cat.length === ITEMS.length && cat.filter((i) => i.withdrawn).length === W.size, "the server's catalogue marks them withdrawn (every item still listed)");
  });

  await section("owners keep them", async () => {
    // Ana owned Lava and had it equipped before the withdrawal (rows as a purchase would leave them).
    q(`SELECT public.create_profile('${ANA}', 'Ana_Owner', 3::smallint, DATE '1990-01-01', 'GB')`);
    q(`INSERT INTO inventory_items (user_id, item_id, how) VALUES ('${ANA}', 'card-art.lava', 'grant')`);
    check(q(`SELECT public.economy_equip('${ANA}', 'card-art', 'card-art.lava')`) === "equipped", "an owned withdrawn item still equips");
    check(owns(ANA, "card-art.lava") && q(`SELECT item_id FROM loadout_slots WHERE user_id = '${ANA}' AND slot = 'card-art'`) === "card-art.lava", "it stays owned and in its slot");
    check(q(`SELECT economy.add_item('${ANA}', 'card-art.lava', 'pass')`) === "owned", "a grant to its owner answers owned (nothing changes)");
  });

  await section("never given", async () => {
    q(`SELECT public.create_profile('${BOB}', 'Bob_New', 4::smallint, DATE '1990-01-01', 'GB')`);
    const starters = ITEMS.filter((i) => i.source === "free-starter" && !W.has(i.id)).map((i) => i.id).sort();
    check(q(`SELECT string_agg(item_id, ',' ORDER BY item_id) FROM inventory_items WHERE user_id = '${BOB}'`) === starters.join(), `a new account's starters: those not withdrawn (${starters.join(", ")})`);
    for (const how of ["pass", "earned", "starter"])
      check(q(`SELECT economy.add_item('${BOB}', 'frame.bronze', '${how}')`) === "withdrawn" && !owns(BOB, "frame.bronze"), `a '${how}' grant of a withdrawn item answers withdrawn and gives nothing`);
    check((await economy.grantItem(admin, { userId: BOB, itemId: "frame.founding", how: "earned" })) === "withdrawn", "the server's grant answers withdrawn (the Founding frame)");
    check((await economy.grantItem(admin, { userId: BOB, itemId: "frame.championship", how: "earned" })) === "withdrawn" && !owns(BOB, "frame.championship"), "the Championship frame's grant stays off (no art)");
    check(q(`SELECT economy.add_item('${BOB}', 'card-art.aurora', 'earned')`) === "granted", "a live item is still given");
    check(q(`SELECT economy.grant_item('Bob_New', 'card-art.static', 'check: Joe may still give one by hand')`) === "granted" && owns(BOB, "card-art.static"), "Joe's own grant still gives a withdrawn item");
  });

  await section("never sold", async () => {
    const p = await economy.purchaseItem(admin, { userId: ANA, itemId: "card-art.royal", key: "w:royal" });
    check(p.status === "not_for_sale", `buying a withdrawn shop item: not_for_sale (${p.status})`);
    q(`SELECT shop.add_tester('Ana_Owner', 'check')`);
    q(`SELECT economy.grant_coins('Ana_Owner', 20000, 'check')`);
    const pool = shop.poolOf(await shop.shopItems(admin));
    check(pool.every((p) => !W.has(p.id)) && pool.length === ITEMS.filter((i) => i.source === "shop" && !W.has(i.id)).length, "the daily shop's pool leaves them out");
    const { pickShopDays } = await import("../src/lib/shop/dailyShop");
    const days = pickShopDays("2026-11-16", "2027-01-14", pool, []);
    check(days.every((d) => d.items.every((id) => !W.has(id)) && Object.values(d.backups).flat().every((id) => !W.has(id))), "60 days of picks never show a withdrawn item");
    // A day recorded before the withdrawal: Royal and Lava in it. The view shows backups in their place.
    const today = "2026-11-18";
    const recorded = pickShopDays(today, today, pool, [])[0]!;
    const day = { ...recorded, items: ["card-art.royal", recorded.items[1], recorded.items[2], recorded.items[3]] as typeof recorded.items };
    q(`INSERT INTO shop_days (day, items, rarities, backups) VALUES ('${today}', ARRAY['${day.items.join("','")}'], ARRAY['${day.rarities.join("','")}'], '${JSON.stringify(day.backups)}'::jsonb)`);
    const view = await shop.shopViewFor(admin, ANA, NOW, "daily");
    check(view.open === true && view.today.length === 4 && view.today.every((c) => !W.has(c.id)), `a recorded day's withdrawn pick shows a backup in its place (${view.open ? view.today.map((c) => c.id).join(", ") : "closed"})`);
    check(view.open === true && view.bundle?.id === "card-table" && view.bundle.items.map((i) => i.id).join() === "card-back.holo-foil,card-back.royal-damask,card-art.aurora,card-art.crimson,card-art.emerald" && view.bundle.price === 5500, "Card Table's week (Proposal A, its backs restored): on sale for 5,500");
    // A week whose bundle still holds a withdrawn item: no bundle, nothing recorded, buying refused (no partial bundles).
    const later = Date.parse("2026-11-25T12:00:00Z"); // week 3, Black and Gold (Obsidian, Shockwave withdrawn)
    q(`INSERT INTO shop_days (day, items, rarities, backups) SELECT '2026-11-25', items, rarities, backups FROM shop_days WHERE day = '${today}'`);
    const v3 = await shop.shopViewFor(admin, ANA, later, "daily");
    check(v3.open === true && v3.bundle === null, "Black and Gold's week (Obsidian and Shockwave withdrawn): no bundle");
    check(q(`SELECT count(*) FROM shop_weeks WHERE week_start = '2026-11-23'`) === "0", "and nothing recorded for that week");
    const bb = await shop.buyBundle(admin, ANA, "00000000-0000-4000-8000-000000000999", later);
    check(bb.ok === false && bb.reason === "not_today", "buying that week's bundle is refused");
  });

  await section("the pass", async () => {
    q(`SELECT pass.set_season_dates('s1', '2026-11-16T00:00:00Z', NULL, 'check')`);
    await admin.rpc("pass_credit_joules", {
      p_user_id: ANA,
      p_season: "s1",
      p_epoch: Date.parse("2026-11-16T00:00:00Z"),
      p_rows: Array.from({ length: 4 }, (_, i) => ({ key: `w:${i}`, kind: "weekly", base: 2000, at: new Date(Date.parse("2026-11-17T12:00:00Z") + i).toISOString() })) as never,
    } as never);
    const v = await pass.passViewFor(admin, ANA, NOW);
    check(v.open === true && v.level >= 6, `the tester reached level 6 (${v.open ? v.level : "closed"})`);
    const bronze = v.open ? v.levels[5]!.free : null;
    check(bronze?.state === "withdrawn" && bronze.itemId === null && bronze.title === pass.WITHDRAWN_TITLE, "free level 6 (Bronze, withdrawn): a gap, being redrawn, no item shown");
    check(v.open === true && v.levels[1]!.free?.state === "claimable", "free level 2 (100 coins): claimable as before");
    const c = await pass.claimReward(admin, ANA, { track: "free", level: 6 }, NOW);
    check(c.ok === false && c.reason === "withdrawn" && !owns(ANA, "frame.bronze"), "claiming it is refused (withdrawn) and gives nothing");
    check(v.open === true && v.levels.every((l) => [l.free, l.premium].every((cell) => !cell || cell.state !== "withdrawn" || cell.itemId === null)), "no withdrawn cell names its item");
    // Joe restores Bronze: the level is claimable and pays the frame.
    const r = JSON.parse(q(`SELECT economy.restore_item('frame.bronze', 'check: redrawn')`)) as { item: string };
    check(r.item === "frame.bronze", "economy.restore_item answers the item");
    economy.forgetCatalogueCache();
    const v2 = await pass.passViewFor(admin, ANA, NOW);
    check(v2.open === true && v2.levels[5]!.free?.state === "claimable", "restored: the level is claimable");
    const c2 = await pass.claimReward(admin, ANA, { track: "free", level: 6 }, NOW);
    check(c2.ok === true && owns(ANA, "frame.bronze"), "and pays the frame");
  });

  await section("Joe's functions", async () => {
    // Season rewards and Championship winners owed a withdrawn item get it when it is restored.
    q(`SELECT public.create_profile('${CAL}', 'Cal_Season', 5::smallint, DATE '1990-01-01', 'GB')`);
    q(`SELECT public.create_profile('${DEE}', 'Dee_Champ', 6::smallint, DATE '1990-01-01', 'GB')`);
    q(`INSERT INTO public.season_rewards (season_id, season_start, user_id, tier, peak_label, rated_matches, mark, frame_item, card_art, test)
       VALUES ('s1', '2026-11-16T00:00:00Z', '${CAL}', 'volt', 'Volt II', 12, 'S1', 'frame.s1-volt', 'card-art.tier.volt', false)`);
    q(`INSERT INTO public.tournament_events (id, kind, title, pick, starts_at, ends_at, status) VALUES ('championship:2026-11', 'championship', 'Joulz Championship', 'mixed', '2026-11-29T19:00:00Z', '2026-11-29T21:00:00Z', 'finished') ON CONFLICT DO NOTHING`);
    const champ = db.psql(`INSERT INTO public.tournament_awards (event_id, user_id, kind, place) VALUES ('championship:2026-11', '${DEE}', 'frame', 1)`);
    check(!owns(CAL, "frame.s1-volt") && !owns(DEE, "frame.championship"), "while withdrawn, nobody owed them has them");
    const s = JSON.parse(q(`SELECT economy.restore_item('frame.s1-volt', 'check')`)) as { given: number };
    check(s.given === 1 && owns(CAL, "frame.s1-volt") && q(`SELECT 'frame.s1-volt' = ANY(granted_items) FROM season_rewards WHERE user_id = '${CAL}'`) === "t", "restoring a season frame gives it to every season reward naming it (listed as granted)");
    if (champ.ok) {
      const c = JSON.parse(q(`SELECT economy.restore_item('frame.championship', 'check')`)) as { given: number };
      check(c.given === 1 && owns(DEE, "frame.championship"), "restoring the Championship frame gives it to every recorded winner");
    } else check(false, `the Championship award row could be recorded (${champ.err.slice(0, 160)})`);
    const before = Number(q(`SELECT count(*) FROM inventory_items WHERE item_id = 'card-art.grid'`));
    const g = JSON.parse(q(`SELECT economy.restore_item('card-art.grid', 'check')`)) as { given: number };
    const profiles = Number(q(`SELECT count(*) FROM profiles`));
    check(Number(q(`SELECT count(*) FROM inventory_items WHERE item_id = 'card-art.grid'`)) === profiles && g.given === profiles - before, "restoring a starter gives it to every account");
    check(q(`SELECT count(*) FROM catalogue_shop WHERE id = 'card-art.royal'`) === "0", "Royal still withdrawn");
    q(`SELECT economy.restore_item('card-art.royal', 'check')`);
    check(q(`SELECT count(*) FROM catalogue_shop WHERE id = 'card-art.royal'`) === "1", "restored: back in the shop query (one line)");
    check(q(`SELECT economy.withdraw_item('card-art.royal', 'check: again')`) === "withdrawn" && q(`SELECT count(*) FROM catalogue_shop WHERE id = 'card-art.royal'`) === "0", "economy.withdraw_item takes one away (one line)");
    check(Number(q(`SELECT count(*) FROM economy.admin_log WHERE action IN ('restore_item', 'withdraw_item')`)) === 9, "every restore and withdrawal is logged (the migration's three card backs too)");
    check(/note/.test(refused(`SELECT economy.restore_item('card-art.lava', '')`)), "a note is required");
    for (const role of ["anon", "authenticated", "service_role"])
      check(/permission denied/.test(refused(`SET LOCAL ROLE ${role}; SELECT economy.restore_item('card-art.lava', 'x')`)) && /permission denied/.test(refused(`SET LOCAL ROLE ${role}; SELECT economy.withdraw_item('card-art.lava', 'x')`)), `${role} can't reach Joe's withdraw and restore`);
  });

  await section("the Top 500 frame", async () => {
    const { grantTop500Frame } = await import("../src/lib/rated/rewards.server");
    check((await grantTop500Frame(admin, CAL)) === "no_badge" && !owns(CAL, "frame.top-500"), "no Top 500 badge: no frame");
    q(`INSERT INTO player_badges (user_id, badge) VALUES ('${CAL}', 'top-500')`);
    economy.forgetCatalogueCache();
    check((await grantTop500Frame(admin, CAL)) === "withdrawn" && !owns(CAL, "frame.top-500"), "with the badge, while the frame is withdrawn: dormant, nothing given");
    const r = JSON.parse(q(`SELECT economy.restore_item('frame.top-500', 'check')`)) as { given: number };
    check(r.given === 1 && owns(CAL, "frame.top-500") && q(`SELECT how FROM inventory_items WHERE user_id = '${CAL}' AND item_id = 'frame.top-500'`) === "earned", "restored: every badge holder gets it, earned");
    check((await grantTop500Frame(admin, CAL)) === "owned", "and the grant at the badge's moment answers owned after that (kept forever)");
    const src = readFileSync("src/lib/rated/rewards.server.ts", "utf8");
    check(/const \{ awarded \} = await evaluateBadges\(client, userId, nowMs\);\s*await grantTop500Frame\(client, userId\);/.test(src), "the frame is given where the rated badges are awarded (the same moment as the badge)");
  });

  await section("card backs stored with results", async () => {
    q(`INSERT INTO inventory_items (user_id, item_id, how) VALUES ('${BOB}', 'card-back.neon', 'grant') ON CONFLICT DO NOTHING`);
    check(q(`SELECT public.economy_equip('${BOB}', 'card-back', 'card-back.neon')`) === "equipped", "a card back equips");
    for (const g of ["pokersquares", "tripeaks", "pyramid", "fivehands"])
      check(q(`SELECT public.result_look_for('${BOB}', '${g}')::text`) === '{"back": "card-back.neon"}', `${g}: a result stores the player's back`);
    for (const g of ["freecell", "mahjong", "pool"]) check(q(`SELECT coalesce(public.result_look_for('${BOB}', '${g}')::text, 'none')`) === "none", `${g}: no back stored`);
  });
}

let db: LocalDb | null = null;
let rest: RestServer | null = null;
if (!postgresBin()) {
  console.log = quietLog;
  if (process.env["CI"]) {
    console.log(`cosmetics-withdrawn-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  console.log(`cosmetics-withdrawn-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}
try {
  db = startLocalDb("cosmetics-withdrawn-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  db.psql(`INSERT INTO auth.users (id, is_anonymous, email) VALUES
    ('${ANA}', false, 'ana@example.com'), ('${BOB}', false, 'bob@example.com'), ('${CAL}', false, 'cal@example.com'), ('${DEE}', false, 'dee@example.com')`);
  void accountToken;
  await installServerFnPlugin();
  await databaseChecks(db);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}
console.log = quietLog;
console.log(`cosmetics-withdrawn-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: withdrawn items are offered nowhere, owners keep them, Joe restores one in a line, and card backs reach Summit, Thirteen and Five Hands.");
process.exit(0);
