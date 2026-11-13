/**
 * skins-db-check (wave 2, E1; 11 Nov 2026; docs/skins.md "Card backs" and "Replays and ghosts"): the two skins
 * migrations on a local PostgreSQL 16 with every migration applied in order, and the ghost-looks server function
 * through the server-function harness.
 *
 *   1. Card backs (20261112090000_card_back_slot.sql): accounts that got a Free Cell back before the migration (placed
 *      directly, granted by Joe's tool, bought with coins and equipped through A1's functions) own the card back after
 *      it (same how and spend line) and have it in the `card-back` slot; a sweep of every table finds no row still
 *      naming an old id outside the rename table and append-only history; refunding the old purchase still works; the old ids are gone from
 *      the catalogue, inventories and loadouts, recorded in catalogue_renamed, and can never be inserted again (the old
 *      seed applied again adds nothing); a second run of the migration changes nothing; the catalogue's card backs
 *      match catalogue.json field for field.
 *   2. Result looks (20261112090100_result_looks.sql): a room result and a Daily result store the owner's equipped
 *      look for the round's game (skin, theme, and on Full House the card back), read by the database from the
 *      loadout; a guest, an account with nothing equipped and a game without skins store NULL; every other column is
 *      exactly what was inserted (score, answer, time, extra: the look never touches a score). Clients can't call the
 *      look functions.
 *   3. Ghosts: roomGameLooksFn gives a room's players their looks for the game, refuses (empty) a caller who is not in
 *      the room, a game without skins and a malformed room id, and leaves out players who left. Play again's archive
 *      (20261112090200_archive_result_look.sql) keeps each result's look.
 *
 *   bun scripts/skins-db-check.ts      (~10 s, no browser; needs the PostgreSQL 16 binaries, as CI has)
 */
import { readdirSync, readFileSync } from "node:fs";

import {
  ANON_KEY,
  accountToken,
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

const quietLog = console.log;
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE|ok)|^skins-db-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};

const ANA = "00000000-0000-4000-8000-0000000000a1"; // owns and equips Neon card back before the move, plus skins
const BEN = "00000000-0000-4000-8000-0000000000b2"; // an account with nothing equipped
const CAT = "00000000-0000-4000-8000-0000000000c3"; // a guest
const DEV = "00000000-0000-4000-8000-0000000000d4"; // granted Royal Damask by Joe's tool (not equipped), not in the room
const EVA = "00000000-0000-4000-8000-0000000000e5"; // bought Holo Foil with coins and equipped it, both through A1's functions
const CARD_BACK_MIGRATION = "20261112090000_card_back_slot.sql";

if (!postgresBin()) {
  if (process.env["CI"]) check(false, "the PostgreSQL 16 binaries are needed (CI has them)");
  else console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  quietLog(`skins-db-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

const all = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
let db: LocalDb | null = null;
let rest: RestServer | null = null;
try {
  db = startLocalDb("skins-db-check-", { applyMigrations: false });
  const q = (sql: string) => {
    const out = db!.psql(sql);
    if (!out.ok) throw new Error(`${sql.slice(0, 80)}: ${out.err}`);
    return out.out;
  };
  const apply = (file: string) => db!.psql(readFileSync(`supabase/migrations/${file}`, "utf8"));
  const before = all.filter((f) => f < CARD_BACK_MIGRATION);
  let failed = "";
  for (const f of before) if (!failed && !apply(f).ok) failed = f;
  check(!failed, `the migrations before the card backs apply${failed ? ` (${failed})` : ""}`);

  // Accounts before the move.
  q(`INSERT INTO auth.users (id, is_anonymous, email) VALUES
       ('${ANA}', false, 'ana@example.com'), ('${BEN}', false, 'ben@example.com'), ('${CAT}', true, NULL), ('${DEV}', false, 'dev@example.com'), ('${EVA}', false, 'eva@example.com');
     INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth) VALUES
       ('${ANA}', 'Ana_1', 'ana_1', 3, DATE '1990-01-01'), ('${BEN}', 'Ben_2', 'ben_2', 4, DATE '1990-01-01'), ('${DEV}', 'Dev_4', 'dev_4', 5, DATE '1990-01-01'), ('${EVA}', 'Eva_5', 'eva_5', 6, DATE '1990-01-01');`);
  const oldSlot = q(`SELECT slot FROM public.catalogue_items WHERE id = 'game-skin.free-cell.neon-card-back'`);
  check(oldSlot !== "", "before the move the catalogue holds the Free Cell backs");
  const keep = "name, rarity, source, pass_level, price_coins, bundle, animated, exclusive, exclusive_forever, note, sort_order";
  const oldRows = q(`SELECT string_agg((to_jsonb(c) - 'id')::text, E'\\n' ORDER BY c.id) FROM (SELECT id, ${keep} FROM public.catalogue_items WHERE id LIKE 'game-skin.free-cell.%' ) c`);
  // Every way a row can point at a catalogue id before the move: a pass item placed directly, Joe's grant tool (a test
  // item, logged), a shop purchase with coins (a spend line naming the item, the inventory row tied to it) and A1's equip.
  q(`INSERT INTO public.inventory_items (user_id, item_id, how) VALUES ('${ANA}', 'game-skin.free-cell.neon-card-back', 'pass');
     INSERT INTO public.loadout_slots (user_id, slot, item_id) VALUES ('${ANA}', '${oldSlot}', 'game-skin.free-cell.neon-card-back');`);
  check(q(`SELECT economy.grant_item('Dev_4', 'game-skin.free-cell.royal-damask', 'check: a test item')`) === "granted", "before the move: Joe's tool grants a Free Cell back");
  q(`SELECT public.economy_credit('${EVA}', 2000, 'admin_adjustment', 'admin', 'check', 'skins-db-check-credit')`);
  const bought = q(`SELECT public.economy_purchase_item('${EVA}', 'game-skin.free-cell.holo-foil', 'skins-db-check-buy')::text`);
  check(/"ok"|"bought"|"owned"|status/.test(bought) && q(`SELECT count(*) FROM public.inventory_items WHERE user_id = '${EVA}' AND item_id = 'game-skin.free-cell.holo-foil' AND ledger_id IS NOT NULL`) === "1", `before the move: a Free Cell back bought with coins (${bought})`);
  const equipped = q(`SELECT public.economy_equip('${EVA}', '${oldSlot}', 'game-skin.free-cell.holo-foil')`);
  check(q(`SELECT item_id FROM public.loadout_slots WHERE user_id = '${EVA}' AND slot = '${oldSlot}'`) === "game-skin.free-cell.holo-foil", `before the move: the bought back equipped through economy_equip (${equipped})`);
  const evaLine = q(`SELECT ledger_id FROM public.inventory_items WHERE user_id = '${EVA}' AND item_id = 'game-skin.free-cell.holo-foil'`);
  const evaBalance = q(`SELECT balance FROM public.coin_wallets WHERE user_id = '${EVA}'`);

  const after = all.filter((f) => f >= CARD_BACK_MIGRATION);
  failed = "";
  for (const f of after) {
    const out = apply(f);
    if (!failed && !out.ok) failed = `${f}: ${out.err.split("\n").find((l) => /ERROR/.test(l)) ?? out.err}`;
  }
  check(!failed, `the card-back migration and every later one apply over existing owners${failed ? ` (${failed})` : ""}`);

  // 1. Card backs.
  check(q(`SELECT how FROM public.inventory_items WHERE user_id = '${ANA}' AND item_id = 'card-back.neon'`) === "pass", "an owner of Neon card back owns card-back.neon, acquired as before");
  check(q(`SELECT how FROM public.inventory_items WHERE user_id = '${DEV}' AND item_id = 'card-back.royal-damask'`) === "grant", "an owner of Royal Damask owns card-back.royal-damask");
  check(q(`SELECT item_id FROM public.loadout_slots WHERE user_id = '${ANA}' AND slot = 'card-back'`) === "card-back.neon", "an equipped Free Cell back is equipped in the card-back slot");
  check(q(`SELECT count(*) FROM public.loadout_slots WHERE user_id = '${DEV}'  AND slot = 'card-back'`) === "0", "an owned but unequipped back stays unequipped");
  check(q(`SELECT how || ' ' || ledger_id FROM public.inventory_items WHERE user_id = '${EVA}' AND item_id = 'card-back.holo-foil'`) === `shop ${evaLine}`, "a back bought with coins is owned as card-back.holo-foil, tied to the same spend line");
  check(q(`SELECT item_id FROM public.loadout_slots WHERE user_id = '${EVA}' AND slot = 'card-back'`) === "card-back.holo-foil" && q(`SELECT count(*) FROM public.loadout_slots WHERE user_id = '${EVA}' AND slot = '${oldSlot}'`) === "0", "a back equipped through economy_equip sits in the card-back slot, the old slot empty");
  check(q(`SELECT balance FROM public.coin_wallets WHERE user_id = '${EVA}'`) === evaBalance, "the move charges and refunds nothing");
  // The sweep: no row anywhere still points at an old id, except the rename table itself and append-only history
  // (the coin ledger's spend line, Joe's admin log and analytics events record what happened under the id of the time;
  // nothing reads them to find an item: a refund goes by the line's id).
  const HISTORY = new Set(["public.catalogue_renamed.old_id", "public.coin_ledger.ref_id", "public.coin_ledger.idempotency_key", "economy.admin_log.detail", "analytics.events.props"]);
  const cols = q(`SELECT string_agg(table_schema || '.' || table_name || '.' || column_name, ',') FROM information_schema.columns c
                   JOIN information_schema.tables t USING (table_schema, table_name)
                  WHERE t.table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                    AND data_type IN ('text', 'character varying', 'jsonb', 'json', 'ARRAY')`).split(",");
  const found: string[] = [];
  for (const col of cols) {
    const [schema, table, column] = col.split(".");
    const n = q(`SELECT count(*) FROM "${schema}"."${table}" WHERE "${column}"::text LIKE '%game-skin.free-cell.%'`);
    if (n !== "0") found.push(`${col} (${n})`);
  }
  const stray = found.filter((f) => !HISTORY.has(f.split(" ")[0]!));
  check(cols.length > 50 && stray.length === 0, `no table points at an old id after the move (swept ${cols.length} columns; history kept: ${found.filter((f) => HISTORY.has(f.split(" ")[0]!)).join(", ") || "none"}${stray.length ? `; STRAY: ${stray.join(", ")}` : ""})`);
  check(found.some((f) => f.startsWith("public.coin_ledger.ref_id")), "the sweep sees the purchase's spend line (it would see a stray row)");
  check(q(`SELECT count(*) FROM public.catalogue_items WHERE id LIKE 'game-skin.free-cell.%'`) === "0" && q(`SELECT count(*) FROM public.inventory_items WHERE item_id LIKE 'game-skin.free-cell.%'`) === "0" && q(`SELECT count(*) FROM public.loadout_slots WHERE item_id LIKE 'game-skin.free-cell.%'`) === "0", "the old ids are gone from the catalogue, inventories and loadouts");
  check(q(`SELECT string_agg(old_id || '>' || new_id, ',' ORDER BY old_id) FROM public.catalogue_renamed`) === "game-skin.free-cell.holo-foil>card-back.holo-foil,game-skin.free-cell.neon-card-back>card-back.neon,game-skin.free-cell.royal-damask>card-back.royal-damask", "the renames are recorded old → new");
  const total = q(`SELECT count(*) FROM public.catalogue_items`);
  // Changed with Joe's approval, 13 Nov 2026: 110 → 118, the wave-4 catalogue's 8 items (W4c's Championship frame and
  // W4d's seven Season 1 frames) added by later migrations, which this check applies; the card-back move still adds nothing.
  check(total === "118", `the catalogue still holds 118 items (${total})`);
  const again = apply("20261110160100_economy_catalogue.sql");
  // Changed with Joe's approval, 13 Nov 2026: 110 → 118, the same wave-4 items as above.
  check(again.ok && q(`SELECT count(*) FROM public.catalogue_items`) === "118" && q(`SELECT count(*) FROM public.catalogue_items WHERE id LIKE 'game-skin.free-cell.%'`) === "0", "the old seed applied again adds nothing (no old id comes back)");
  const rerun = apply(CARD_BACK_MIGRATION);
  check(rerun.ok && q(`SELECT count(*) FROM public.inventory_items WHERE item_id LIKE 'card-back.%'`) === "3" && q(`SELECT count(*) FROM public.loadout_slots WHERE slot = 'card-back'`) === "2", "a second run of the card-back migration changes nothing");
  // Old ids in name order (holo-foil, neon-card-back, royal-damask) map to the new ids in the same order.
  const newRows = q(`SELECT string_agg((to_jsonb(c) - 'id')::text, E'\\n' ORDER BY c.id) FROM (SELECT id, ${keep} FROM public.catalogue_items WHERE id LIKE 'card-back.%' ) c`);
  check(oldRows !== "" && newRows === oldRows, "the card backs keep every field of the old items (name, rarity, source, pass level, price, bundle, animation, exclusivity, note, order)");
  check(q(`SELECT string_agg(id || ' ' || kind || ' ' || slot || ' ' || coalesce(game, '-') || ' ' || png_path || ' ' || html_path, ',' ORDER BY id) FROM public.catalogue_items WHERE kind = 'card-back'`) ===
    "card-back.holo-foil card-back card-back - items/card-back/holo-foil.png items/card-back/holo-foil.html,card-back.neon card-back card-back - items/card-back/neon.png items/card-back/neon.html,card-back.royal-damask card-back card-back - items/card-back/royal-damask.png items/card-back/royal-damask.html", "the card backs are kind and slot card-back, of no game, with their art under items/card-back/");
  const cat = JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: { id: string; kind: string; png: string; html: string }[] };
  check(JSON.stringify(cat.items.filter((i) => i.kind === "card-back").map((i) => [i.id, i.png, i.html]).sort()) === JSON.stringify(q(`SELECT string_agg(id || '|' || png_path || '|' || html_path, ',' ORDER BY id) FROM public.catalogue_items WHERE kind = 'card-back'`).split(",").map((r) => r.split("|"))), "catalogue.json and the table agree on the card backs");
  // A refund of the old purchase line still finds and removes the renamed item (it goes by the line, not the id).
  const refund = q(`SELECT public.economy_refund('${EVA}', ${evaLine})::text`);
  check(q(`SELECT count(*) FROM public.inventory_items WHERE user_id = '${EVA}' AND item_id = 'card-back.holo-foil'`) === "0" && q(`SELECT count(*) FROM public.loadout_slots WHERE user_id = '${EVA}' AND slot = 'card-back'`) === "0" && q(`SELECT balance FROM public.coin_wallets WHERE user_id = '${EVA}'`) === "2000", `refunding the pre-move purchase removes card-back.holo-foil and its slot and returns the coins (${refund})`);
  for (const role of ["anon", "authenticated"]) {
    const tried = db.psql(`SET ROLE ${role}; SELECT public.result_look_for('${ANA}', 'pool');`);
    check(!tried.ok, `${role} can't call result_look_for`);
    const ghosts = db.psql(`SET ROLE ${role}; SELECT * FROM public.room_game_looks(gen_random_uuid(), 'racing');`);
    check(!ghosts.ok, `${role} can't call room_game_looks`);
  }

  // 2. Result looks. Ana equips a Cue Ball skin and theme, an Apex paint and keeps Neon card back.
  q(`INSERT INTO public.inventory_items (user_id, item_id, how) VALUES
       ('${ANA}', 'game-skin.cue-ball.galaxy-set', 'grant'), ('${ANA}', 'world-theme.cue-ball.neon-table', 'grant'), ('${ANA}', 'game-skin.apex.molten-gold', 'grant');
     INSERT INTO public.loadout_slots (user_id, slot, item_id) VALUES
       ('${ANA}', 'game-skin:pool', 'game-skin.cue-ball.galaxy-set'), ('${ANA}', 'world-theme:pool', 'world-theme.cue-ball.neon-table'), ('${ANA}', 'game-skin:racing', 'game-skin.apex.molten-gold');`);
  const ROOM = "00000000-0000-4000-9000-000000000001";
  const puzzles = JSON.stringify([{ type: "pool" }, { type: "pokersquares" }, { type: "gridlock" }, { type: "racing" }]);
  q(`INSERT INTO public.duels (id, room_code, round_order, puzzles_public) VALUES ('${ROOM}', 'SKN1', '["pool","pokersquares","gridlock","racing"]', '${puzzles}');
     INSERT INTO public.duel_players (duel_id, player_slot, display_name, user_id) VALUES
       ('${ROOM}', 1, 'Ana', '${ANA}'), ('${ROOM}', 2, 'Ben', '${BEN}'), ('${ROOM}', 3, 'Cat', '${CAT}');`);
  const row = (slot: number, round: number) => `('${ROOM}', ${slot}, ${round}, ${100 + slot * 7 + round}, 'ans${slot}${round}', ${40 + round}, '{"k":${slot}}')`;
  q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, answer, ms_remaining, extra) VALUES
       ${[1, 2, 3].flatMap((s) => [1, 2, 3, 4].map((r) => row(s, r))).join(", ")}`);
  const look = (slot: number, round: number) => q(`SELECT coalesce(look::text, 'NULL') FROM public.round_results WHERE duel_id = '${ROOM}' AND player_slot = ${slot} AND round_number = ${round}`);
  check(look(1, 1) === `{"skin": "game-skin.cue-ball.galaxy-set", "world": "world-theme.cue-ball.neon-table"}`, `a room result stores the owner's skin and theme for its game (${look(1, 1)})`);
  check(look(1, 2) === `{"back": "card-back.neon"}`, `a Full House result stores the owner's card back (${look(1, 2)})`);
  check(look(1, 4) === `{"skin": "game-skin.apex.molten-gold"}`, `an Apex result stores the owner's car paint (${look(1, 4)})`);
  check(look(1, 3) === "NULL", "a game without skins stores no look");
  check([1, 2, 3, 4].every((r) => look(2, r) === "NULL"), "an account with nothing equipped stores no look");
  check([1, 2, 3, 4].every((r) => look(3, r) === "NULL"), "a guest stores no look");
  const kept = q(`SELECT count(*) FROM public.round_results WHERE duel_id = '${ROOM}' AND score = 100 + player_slot * 7 + round_number AND answer = 'ans' || player_slot || round_number AND ms_remaining = 40 + round_number AND extra = jsonb_build_object('k', player_slot)`);
  check(kept === "12", `every room result keeps its score, answer, time and extra exactly as inserted (${kept} of 12)`);
  // The look can't be forged: whatever the insert carries, the database's own read replaces it.
  q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, look) VALUES ('${ROOM}', 2, 5, 9, '{"skin":"game-skin.cue-ball.galaxy-set"}')`);
  check(look(2, 5) === "NULL", "a look sent with a result is ignored (Ben owns nothing)");

  const AROOM = "00000000-0000-4000-9000-000000000002";
  q(`INSERT INTO public.async_rooms (id, kind, room_key, seed, round_count, opens_at, closes_at, puzzles_public)
       VALUES ('${AROOM}', 'daily_arcade', 'daily_arcade:2026-11-11', 7, 3, now(), now() + interval '1 day', '[{"type":"racing"},{"type":"pool"},{"type":"gridlock"}]');
     INSERT INTO public.async_attempts (room_id, user_id, display_name) VALUES ('${AROOM}', '${ANA}', 'Ana'), ('${AROOM}', '${CAT}', 'Cat');
     INSERT INTO public.async_results (room_id, attempt_id, user_id, round_number, started_at, score)
       SELECT '${AROOM}', a.id, a.user_id, r, now(), 50 + r FROM public.async_attempts a, generate_series(1, 3) r WHERE a.room_id = '${AROOM}';`);
  const alook = (user: string, round: number) => q(`SELECT coalesce(look::text, 'NULL') FROM public.async_results WHERE room_id = '${AROOM}' AND user_id = '${user}' AND round_number = ${round}`);
  check(alook(ANA, 1) === `{"skin": "game-skin.apex.molten-gold"}` && alook(ANA, 2) === `{"skin": "game-skin.cue-ball.galaxy-set", "world": "world-theme.cue-ball.neon-table"}` && alook(ANA, 3) === "NULL", "a Daily result stores the owner's look for each round's game");
  check([1, 2, 3].every((r) => alook(CAT, r) === "NULL"), "a guest's Daily result stores no look");
  check(q(`SELECT count(*) FROM public.async_results WHERE room_id = '${AROOM}' AND score = 50 + round_number`) === "6", "every Daily result keeps its score");

  // 3. Ghosts through the server function.
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  await installServerFnPlugin();
  const { roomGameLooksFn } = await import("../src/lib/identity/roomLooks.functions");
  const ask = (token: string, roomId: string, game: string) => callServerFn<Record<string, { skin: string | null; world: string | null; back?: string | null }>>(roomGameLooksFn, { roomId, game }, token);
  const seen = await ask(userToken(BEN), ROOM, "racing");
  check(JSON.stringify(Object.keys(seen)) === `["1"]` && seen["1"]?.skin === "game-skin.apex.molten-gold", `a player in the room sees the others' car paints by slot (${JSON.stringify(seen)})`);
  const pool = await ask(accountToken(ANA), ROOM, "pool");
  check(pool["1"]?.skin === "game-skin.cue-ball.galaxy-set" && pool["1"]?.world === "world-theme.cue-ball.neon-table", "the looks are for the game asked");
  check(Object.keys(await ask(userToken(DEV), ROOM, "racing")).length === 0, "a caller not in the room gets nothing");
  check(Object.keys(await ask(userToken(BEN), ROOM, "gridlock")).length === 0, "a game without skins gets nothing");
  check(Object.keys(await ask(userToken(BEN), "not-a-room", "racing")).length === 0, "a malformed room id gets nothing");
  q(`UPDATE public.duel_players SET status = 'left' WHERE duel_id = '${ROOM}' AND player_slot = 1`);
  check(Object.keys(await ask(userToken(BEN), ROOM, "racing")).length === 0, "a player who left shows no ghost look");

  // Play again: the archive keeps each result's look (20261112090200_archive_result_look.sql), restart_duel_room as it was.
  const looksBefore = q(`SELECT string_agg(id || '=' || coalesce(look::text, 'NULL'), ',' ORDER BY id) FROM public.round_results WHERE duel_id = '${ROOM}'`);
  q(`UPDATE public.duels SET status = 'finished', host_user_id = '${BEN}' WHERE id = '${ROOM}'`);
  check(q(`SELECT public.restart_duel_room('${ROOM}', '${BEN}')`) === "t", "Play again runs on the room");
  const archived = q(`SELECT string_agg(id || '=' || coalesce(look::text, 'NULL'), ',' ORDER BY id) FROM public.round_results_archive WHERE duel_id = '${ROOM}'`);
  check(looksBefore !== "" && archived === looksBefore && /galaxy-set/.test(archived), "the archive keeps every result's look, the same as the result row's");
  check(q(`SELECT count(*) FROM public.round_results WHERE duel_id = '${ROOM}'`) === "0", "the results themselves are cleared as before");
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

console.log = quietLog;
console.log(`skins-db-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: card backs moved with their owners, results store their owner's look and nothing else, ghosts read only for the room");
