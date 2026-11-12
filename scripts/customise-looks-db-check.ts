/**
 * customise-looks-db-check (12 Nov 2026; ~10 s, no browser; needs the PostgreSQL 16 binaries, as CI has): Customise's
 * Games tab path end to end on a local PostgreSQL with every migration applied, through A1's real server functions
 * (src/lib/economy/economy.functions.ts) in the server-function harness, the phone's own reading of the answer
 * (normaliseLoadout, the stage's look source in src/lib/identity/gameLooks.ts, src/lib/skins/equipped.ts) and the
 * games' real renderers (scripts/skins/frames.ts, deck-frames.ts).
 *
 *  1. Equip each kind from one device: a card back, a game skin and a world theme, each in its own slot.
 *  2. Not owned: an unowned card back, skin and world theme are refused and nothing is stored; an owned skin in another
 *     game's slot is refused; a guest can't equip.
 *  3. The look follows the account: a second device (a second session of the same account) and the first device after
 *     a reload read the same looks, and the games' live stage looks have them.
 *  4. It shows in the game: drawn with the look the stage reads, each game's frames differ from its default frames
 *     (Full House's deck for the card back, Cue Ball for its skin and world, Apex for its skin).
 *  5. Unequip each kind: the slot empties, the item stays owned, and the games draw their default frames exactly.
 *
 *   bun scripts/customise-looks-db-check.ts
 */
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
  if (/^\s*(FAIL|NOTE)|^customise-looks-db-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};

const ANA = "00000000-0000-4000-8000-0000000000a1";
const GUEST = "00000000-0000-4000-8000-0000000000c3";

if (!postgresBin()) {
  if (process.env["CI"]) check(false, "the PostgreSQL 16 binaries are needed (CI has them)");
  else quietLog("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  quietLog(`customise-looks-db-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

let db: LocalDb | null = null;
let rest: RestServer | null = null;
try {
  db = startLocalDb("customise-looks-db-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  const q = (sql: string) => {
    const out = db!.psql(sql);
    if (!out.ok) throw new Error(`${sql.slice(0, 80)}: ${out.err}`);
    return out.out;
  };
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  q(`INSERT INTO auth.users (id, is_anonymous, email) VALUES ('${ANA}', false, 'ana@example.com'), ('${GUEST}', true, NULL);
     INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth) VALUES ('${ANA}', 'Ana_1', 'ana_1', 3, DATE '1990-01-01');`);
  for (const id of ["card-back.holo-foil", "game-skin.apex.molten-gold", "game-skin.cue-ball.pixel-pool", "world-theme.cue-ball.neon-table"])
    check(q(`SELECT economy.grant_item('Ana_1', '${id}', 'customise-looks-db-check')`) === "granted", `(set-up) ${id} granted`);
  await installServerFnPlugin();

  const fns = await import("../src/lib/economy/economy.functions");
  const { normaliseLoadout } = await import("../src/lib/identity/backend");
  const equipped = await import("../src/lib/skins/equipped");
  const { installGameLookSource } = await import("../src/lib/identity/gameLooks");
  const backendMod = await import("../src/lib/identity/backend");
  const { NO_LOOK } = await import("../src/lib/arcade/skins/look");
  const { drawFrames, digest } = await import("./skins/frames");
  const { deckFrames } = await import("./skins/deck-frames");

  const phone1 = accountToken(ANA);
  const phone2 = accountToken(ANA); // a second session of the same account: another device
  const equip = (token: string, slot: string, itemId: string | null) =>
    callServerFn<{ ok: boolean; reason?: string; loadout?: unknown }>(fns.equip, { slot, itemId }, token);
  const stored = (slot: string) => q(`SELECT coalesce((SELECT item_id FROM public.loadout_slots WHERE user_id = '${ANA}' AND slot = '${slot}'), 'none')`);
  /** One device's look source, as the app installs it (gameLooks.ts) over that device's own A1 binding. */
  const onDevice = (token: string) => {
    backendMod.setIdentityBackend({
      getCatalogue: async () => [],
      getMyWallet: async () => null,
      getMyInventory: async () => [],
      getMyLoadout: async () => (await callServerFn(fns.getMyLoadout, undefined, token)) as never,
      getAvatarOptions: async () => ({}),
      equip: async () => ({ ok: false, reason: "x", message: "x" }),
      setAvatar: async () => ({ ok: false, reason: "x", message: "x" }),
      getPublicCard: async () => null,
    });
    installGameLookSource();
    equipped.forgetGameLooks();
  };
  const frames = async (game: "pool" | "racing", look: unknown) => (await drawFrames(game, look as never)).map(digest).join(",");
  const deck = async (look: unknown) => (await deckFrames(process.cwd(), look as never)).map((f) => f.digest).join(",");
  const defaults = { pool: await frames("pool", NO_LOOK), racing: await frames("racing", NO_LOOK), deck: await deck(NO_LOOK) };
  check(defaults.pool === (await frames("pool", undefined)) && defaults.deck === (await deck(undefined)), "(set-up) the default look draws exactly as no look");

  // 1. Equip each kind.
  const SLOTS: [string, string][] = [
    ["card-back", "card-back.holo-foil"],
    ["game-skin:racing", "game-skin.apex.molten-gold"],
    ["game-skin:pool", "game-skin.cue-ball.pixel-pool"],
    ["world-theme:pool", "world-theme.cue-ball.neon-table"],
  ];
  for (const [slot, id] of SLOTS) {
    const r = await equip(phone1, slot, id);
    check(r.ok === true && stored(slot) === id, `equip ${id} into ${slot} (${r.ok ? "ok" : r.reason}; stored ${stored(slot)})`);
    check(normaliseLoadout(r.loadout)?.gameLooks?.[slot] === id, `the answer's loadout carries ${slot}`);
  }

  // 2. Not owned.
  for (const [slot, id] of [
    ["card-back", "card-back.royal-damask"],
    ["game-skin:racing", "game-skin.apex.racing-stripes"],
    ["world-theme:racing", "world-theme.apex.neon-night"],
  ] as const) {
    const was = stored(slot);
    const r = await equip(phone1, slot, id);
    check(r.ok === false && stored(slot) === was, `an unowned ${id} is refused and nothing stored (${r.ok ? "ok" : r.reason})`);
  }
  {
    const r = await equip(phone1, "game-skin:pool", "game-skin.apex.molten-gold");
    check(r.ok === false && stored("game-skin:pool") === "game-skin.cue-ball.pixel-pool", `an owned skin in another game's slot is refused (${r.ok ? "ok" : r.reason})`);
    const g = await equip(userToken(GUEST), "card-back", "card-back.holo-foil");
    check(g.ok === false, `a guest can't equip (${g.ok ? "ok" : g.reason})`);
  }

  // 3. The look follows the account, and 4. shows in the game.
  for (const [name, token] of [["a second device", phone2], ["the first device after a reload", phone1]] as const) {
    const read = normaliseLoadout(await callServerFn(fns.getMyLoadout, undefined, token));
    check(SLOTS.every(([slot, id]) => read?.gameLooks?.[slot] === id), `${name} reads every equipped look`);
    onDevice(token);
    const fh = await equipped.gameLookOf("pokersquares");
    const pool = await equipped.gameLookOf("pool");
    const apex = await equipped.gameLookOf("racing");
    check(fh.back === "card-back.holo-foil" && pool.skin === "game-skin.cue-ball.pixel-pool" && pool.world === "world-theme.cue-ball.neon-table" && apex.skin === "game-skin.apex.molten-gold", `${name}: the live stages' looks have them (${JSON.stringify({ fh, pool, apex })})`);
    if (token === phone2) {
      check((await deck(fh)) !== defaults.deck, "Full House's deck draws the Holo Foil back (its frames differ from the default's)");
      check((await frames("pool", pool)) !== defaults.pool, "Cue Ball draws its skin and world (its frames differ from the default's)");
      check((await frames("racing", apex)) !== defaults.racing, "Apex draws its skin (its frames differ from the default's)");
    }
  }

  // 5. Unequip each kind.
  for (const [slot, id] of SLOTS) {
    const r = await equip(phone1, slot, null);
    check(r.ok === true && stored(slot) === "none", `unequip ${slot} (${r.ok ? "ok" : r.reason})`);
    check(q(`SELECT count(*) FROM public.inventory_items WHERE user_id = '${ANA}' AND item_id = '${id}'`) === "1", `${id} stays owned`);
  }
  onDevice(phone2);
  const fh = await equipped.gameLookOf("pokersquares");
  const pool = await equipped.gameLookOf("pool");
  const apex = await equipped.gameLookOf("racing");
  check(fh === NO_LOOK && pool === NO_LOOK && apex === NO_LOOK, "after unequipping, the other device's games read the default look");
  check((await deck(fh)) === defaults.deck && (await frames("pool", pool)) === defaults.pool && (await frames("racing", apex)) === defaults.racing, "and draw their default frames exactly");
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

quietLog(`customise-looks-db-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  quietLog("FAIL");
  process.exit(1);
}
quietLog("PASS: equipped looks are owned-only, stored on the account, read by every device and drawn by the games.");
process.exit(0);
