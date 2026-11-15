/**
 * rated-stakes-check (phase 2 step 3, Joe 14 Nov 2026; src/lib/rated/stakes.server.ts): a rated player's stakes,
 * "Win +N · Lose −N", through the real server functions (ratedStakesFn, ratedStakesEstimateFn) and W3a's real ratings
 * engine on a local PostgreSQL 16 with every migration applied (scripts/server-fn-harness.ts). No browser (~15 s).
 *
 * What it proves:
 *   (a) a matched rated 1v1: the stakes are exactly what settling the match applies. Two placed players' stakes are
 *       read through ratedStakesFn, then the match is settled through W3b's settleMatch and W3a's finishRatedMatch with
 *       one of them winning outright: the winner's applied Joulz Rating change (as the result screen shows it, rounded
 *       after less rounded before) equals their `win`, the loser's equals their `loss`. A second match, won the other
 *       way, proves the other two figures. A non-player, a bad id and an account id get nothing.
 *   (b) before matching: the estimate equals the engine's change against a real opponent stored with exactly the
 *       player's ratings; a win is up and a loss down, nearly mirror images; a best of 5 stakes more than a best of 3;
 *       4- and 8-player formats and the single-category picks have none; a player rated play isn't open to gets none.
 *   placement: a player in placement gets no stakes from either function (the line is hidden).
 *   and the answers hold no ids.
 */
import { ANON_KEY, callServerFn, installServerFnPlugin, postgresBin, SERVICE_KEY, startLocalDb, startRestServer, userToken, type LocalDb, type RestServer } from "./server-fn-harness";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) {
    passes++;
    if (process.env["STAKES_VERBOSE"]) quietLog(`  ok ${label}`);
  }
  else {
    failures.push(label);
    quietLog(`  FAIL ${label}`);
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
  if (/^\s*(FAIL|NOTE)|^rated-stakes-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = uid(901);
const B = uid(902);
const NEWBIE = uid(903);
const OUTSIDER = uid(904);
const TWIN = uid(905);
/** Placement opponents, a fresh one for every match (W3a freezes a pair from their 4th match in a day). */
const OPP = Array.from({ length: 12 }, (_, i) => uid(920 + i));
/**
 * Section (b)'s player (fix, 15 Nov 2026): placed only through the fixed placement matches below (one Puzzles and one
 * Arcade game each, the same result), so their Puzzles and Arcade ratings and recent games are equal by construction.
 * A's history includes section (a)'s matches, dealt on random room seeds, which can pull A's two pools apart; the
 * Joulz Rating then re-weights them as a match adds games, so a win and a loss stop being mirror images (the engine's
 * rule: the stakes can be unequal). The "equally rated" estimate's assertions need a player whose pools are equal.
 */
const EQ = uid(906);
const EQ_OPP = Array.from({ length: 5 }, (_, i) => uid(940 + i));

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log("rated-stakes-check: 0 passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL");
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: not run (CI runs it)");
  console.log("rated-stakes-check: skipped locally");
  process.exit(0);
}

let db: LocalDb | null = null;
let rest: RestServer | null = null;
try {
  db = startLocalDb("rated-stakes-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  await installServerFnPlugin();
  await runAll(db);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

restore();
console.log(`rated-stakes-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: a matched match's stakes are exactly what settling it applies for a win and a loss; the estimate is the engine's change against an equally rated opponent; none in placement.");
process.exit(0);

async function runAll(db: LocalDb): Promise<void> {
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const fns = await import("../src/lib/rated/rated.functions");
  const rated = await import("../src/lib/rated/rated.server");
  const stakesMod = await import("../src/lib/rated/stakes.server");
  const { setRatingsBackend, ratingsReady, poolAndCategory } = await import("../src/lib/rated/ratingsAdapter.server");
  const { recordRatedMatch, previewRatedMatch } = await import("../src/lib/rated/ratings.server");
  const { ACTIVE_PUZZLE_TYPES } = await import("../src/lib/duel/catalogue");
  const { adminDb } = await import("../src/lib/data/db.server");
  const client = await adminDb();
  const call = callServerFn;
  type Stakes = { win: number; loss: number } | null;

  const everyone = [A, B, NEWBIE, OUTSIDER, TWIN, ...OPP, EQ, ...EQ_OPP];
  q(`INSERT INTO auth.users (id) VALUES ${everyone.map((u) => `('${u}')`).join(", ")}`);
  q(`SET session_replication_role = replica; INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth, player_number) VALUES
    ${everyone.map((u, i) => `('${u}', 'Stake_${i}', 'stake_${i}', ${i % 32}, DATE '1990-01-01', ${700 + i})`).join(", ")}`);
  if (q(`SELECT to_regclass('shop.testers') IS NULL`) === "t")
    q(`CREATE SCHEMA IF NOT EXISTS shop; CREATE TABLE shop.testers (user_id uuid PRIMARY KEY, note text NOT NULL DEFAULT '')`);
  // Every player but the outsider may play rated (rated play is testers-only while the switch is off).
  q(`INSERT INTO shop.testers (user_id, note) SELECT u, 'rated-stakes-check' FROM unnest(ARRAY[${everyone.filter((u) => u !== OUTSIDER).map((u) => `'${u}'`).join(",")}]::uuid[]) AS u ON CONFLICT DO NOTHING`);
  setRatingsBackend(null);
  await ratingsReady();

  const game = (pool: "puzzles" | "arcade") => ACTIVE_PUZZLE_TYPES.find((t) => poolAndCategory(t)?.pool === pool)!;
  /** A decided best of 3 between two live players through W3a's real recordRatedMatch. */
  const play = async (a: string, b: string, aWins: boolean) => {
    const games = [game("puzzles"), game("arcade")].map((type) => {
      const pc = poolAndCategory(type)!;
      return { type, pool: pc.pool, category: pc.category, version: "classic" as const, signature: "", scores: { [a]: aWins ? 1 : 0, [b]: aWins ? 0 : 1 } };
    });
    const out = await recordRatedMatch(client, {
      matchId: crypto.randomUUID(),
      format: { kind: "duel", bestOf: 3 },
      choice: "mixed",
      players: [
        { playerId: a, side: "live" },
        { playerId: b, side: "live" },
      ],
      games,
      rematchOf: null,
    });
    if (!out.ok) throw new Error(`recordRatedMatch: ${JSON.stringify(out)}`);
  };
  const placed = (u: string) => q(`SELECT coalesce((SELECT placement_played FROM public.rated_profiles WHERE player_id = '${u}'), 0)`);

  // A rated live match made in the past (as rated-server-check's), so every time below is before the server's clock.
  const make = async (ids: [string, string]) => {
    const t0 = Date.now() - 300_000;
    const matchId = crypto.randomUUID();
    await rated.createLiveMatch(
      client,
      {
        matchId,
        format: "bo3",
        choice: "mixed",
        rematchOf: null,
        players: ids.map((u) => ({ userId: u, format: "bo3" as const, choice: "mixed" as const, rating: 1000, joinedAtMs: t0, placement: false })),
      },
      t0,
    );
    const room = q(`SELECT duel_id FROM public.mm_matches WHERE id = '${matchId}'`);
    const slot = (u: string) => Number(q(`SELECT slot FROM public.mm_match_players WHERE match_id = '${matchId}' AND user_id = '${u}'`));
    return { matchId, room, slot };
  };
  /** Settles a match with `winner` taking the first two games (the outright win the stakes describe). */
  const settleWon = async (m: Awaited<ReturnType<typeof make>>, winner: string, loser: string) => {
    const w = m.slot(winner);
    const l = m.slot(loser);
    q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer, extra) VALUES
       ('${m.room}', ${w}, 1, 150, 1000, true, 'x', NULL), ('${m.room}', ${l}, 1, 100, 1000, true, 'x', NULL),
       ('${m.room}', ${w}, 2, 160, 1000, true, 'x', NULL), ('${m.room}', ${l}, 2, 90, 1000, true, 'x', NULL)`);
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = 2, phase_started_at = now() WHERE id = '${m.room}'`);
    const s = await rated.settleMatch(client, m.matchId, Date.now());
    const out = s.state === "settled" ? s.result.ratings : null;
    if (!out || !out.ok) throw new Error(`settle: ${JSON.stringify(s.state === "settled" ? s.result.ratings : s)}`);
    return (id: string) => stakesMod.stakeOf(out.players.find((p) => p.playerId === id));
  };
  const noIds = (v: unknown) => !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(JSON.stringify(v));

  await section("placement: no stakes", async () => {
    const m = await make([NEWBIE, OPP[11]!]);
    const viaFn = (await call(fns.ratedStakesFn, { matchId: m.matchId }, userToken(NEWBIE))) as Stakes;
    check(viaFn === null, `a player in placement gets no stakes for a match (${JSON.stringify(viaFn)})`);
    const est = (await call(fns.ratedStakesEstimateFn, { format: "bo3", choice: "mixed" }, userToken(NEWBIE))) as Stakes;
    check(est === null, `a player in placement gets no estimate (${JSON.stringify(est)})`);
    // Four placement matches in: still none (the fifth would only reveal a rating).
    for (let i = 0; i < 4; i++) await play(NEWBIE, OPP[i]!, i % 2 === 0);
    check(placed(NEWBIE) === "4", `four placement matches recorded (${placed(NEWBIE)})`);
    check((await call(fns.ratedStakesEstimateFn, { format: "bo3", choice: "mixed" }, userToken(NEWBIE))) === null, "four placement matches in: still no estimate");
  });

  // A and B through placement, each against fresh opponents.
  for (let i = 0; i < 5; i++) await play(A, OPP[i]!, i !== 2);
  for (let i = 0; i < 5; i++) await play(B, OPP[5 + i]!, i === 0 || i === 3);
  for (let i = 0; i < 5; i++) await play(EQ, EQ_OPP[i]!, i !== 1);
  check(placed(A) === "5" && placed(B) === "5", `both players placed on W3a's engine (${placed(A)}, ${placed(B)})`);
  const eqPools = q(`SELECT string_agg(key || ':' || rating::text || ':' || rd::text, ',' ORDER BY key) FROM public.rated_ratings WHERE player_id = '${EQ}' AND key IN ('puzzles', 'arcade')`);
  const [eqArc, eqPuz] = eqPools.split(",").map((x) => x.split(":").slice(1).join(":"));
  check(placed(EQ) === "5" && !!eqArc && eqArc === eqPuz, `section (b)'s player is placed with Puzzles and Arcade exactly equal (${eqPools})`);

  await section("(a) a matched match: exactly what settling applies", async () => {
    // Match 1: A wins outright.
    const m1 = await make([A, B]);
    const a1 = (await call(fns.ratedStakesFn, { matchId: m1.matchId }, userToken(A))) as Stakes;
    const b1 = (await call(fns.ratedStakesFn, { matchId: m1.matchId }, userToken(B))) as Stakes;
    check(!!a1 && !!b1 && a1.win > 0 && a1.loss < 0 && b1.win > 0 && b1.loss < 0, `both placed players have stakes, a win up and a loss down (A ${JSON.stringify(a1)}, B ${JSON.stringify(b1)})`);
    check(noIds(a1) && noIds(b1), "the answer holds no ids");
    check(
      JSON.stringify(await stakesMod.matchStakes(client, m1.matchId, A)) === JSON.stringify(a1),
      "the server function answers matchStakes for the caller",
    );
    const applied1 = await settleWon(m1, A, B);
    check(a1 !== null && applied1(A) === a1.win, `settling A's win applies A's stated win exactly (stated ${a1?.win}, applied ${applied1(A)})`);
    check(b1 !== null && applied1(B) === b1.loss, `settling B's loss applies B's stated loss exactly (stated ${b1?.loss}, applied ${applied1(B)})`);
    check((await call(fns.ratedStakesFn, { matchId: m1.matchId }, userToken(A))) === null, "a settled match has no stakes any more");

    // Match 2: B wins outright, from the state match 1 left.
    const m2 = await make([A, B]);
    const a2 = (await call(fns.ratedStakesFn, { matchId: m2.matchId }, userToken(A))) as Stakes;
    const b2 = (await call(fns.ratedStakesFn, { matchId: m2.matchId }, userToken(B))) as Stakes;
    const applied2 = await settleWon(m2, B, A);
    check(b2 !== null && applied2(B) === b2.win, `settling B's win applies B's stated win exactly (stated ${b2?.win}, applied ${applied2(B)})`);
    check(a2 !== null && applied2(A) === a2.loss, `settling A's loss applies A's stated loss exactly (stated ${a2?.loss}, applied ${applied2(A)})`);
    check(a1 !== null && a2 !== null && JSON.stringify(a1) !== JSON.stringify(a2), "the stakes follow the stored ratings (they changed after match 1)");

    // Nobody else gets a match's stakes.
    const m3 = await make([A, B]);
    check((await call(fns.ratedStakesFn, { matchId: m3.matchId }, userToken(OPP[0]!))) === null, "a player not in the match gets nothing");
    check((await call(fns.ratedStakesFn, { matchId: crypto.randomUUID() }, userToken(A))) === null, "an unknown match id answers nothing");
    let refused = false;
    try {
      await call(fns.ratedStakesFn, { matchId: "not-an-id" }, userToken(A));
    } catch {
      refused = true;
    }
    check(refused, "a malformed match id is refused by the input check (validate.ts)");
  });

  await section("(b) before matching: an estimate against an equally rated opponent", async () => {
    const est = (await call(fns.ratedStakesEstimateFn, { format: "bo3", choice: "mixed" }, userToken(EQ))) as Stakes;
    check(!!est && est.win > 0 && est.loss < 0, `a placed player's estimate: a win up, a loss down (${JSON.stringify(est)})`);
    check(!!est && Math.abs(est.win + est.loss) <= 1, `against an equal opponent a win and a loss are near mirror images (${JSON.stringify(est)})`);
    check(noIds(est), "the answer holds no ids");
    // A real opponent stored with exactly A's ratings: the engine's own change against them matches the estimate.
    q(`SET session_replication_role = replica; INSERT INTO public.rated_ratings (player_id, key, rating, rd, volatility, matches, last_at)
       SELECT '${TWIN}', key, rating, rd, volatility, matches, last_at FROM public.rated_ratings WHERE player_id = '${EQ}'`);
    const vsTwin = async (aWins: boolean) => {
      const games = [game("puzzles"), game("arcade")].map((type) => {
        const pc = poolAndCategory(type)!;
        return { type, pool: pc.pool, category: pc.category, version: "classic" as const, signature: "", scores: { [EQ]: aWins ? 1 : 0, [TWIN]: aWins ? 0 : 1 } };
      });
      const changes = await previewRatedMatch(client, {
        matchId: crypto.randomUUID(),
        format: { kind: "duel", bestOf: 3 },
        choice: "mixed",
        players: [
          { playerId: EQ, side: "live" },
          { playerId: TWIN, side: "live" },
        ],
        games,
        rematchOf: null,
      });
      return stakesMod.stakeOf(changes?.find((c) => c.playerId === EQ));
    };
    const real = { win: await vsTwin(true), loss: await vsTwin(false) };
    check(!!est && real.win === est.win && real.loss === est.loss, `the estimate is the engine's change against a stored, equally rated opponent (${JSON.stringify(est)} v ${JSON.stringify(real)})`);
    const bo5 = (await call(fns.ratedStakesEstimateFn, { format: "bo5", choice: "mixed" }, userToken(EQ))) as Stakes;
    check(!!est && !!bo5 && bo5.win > est.win && bo5.loss < est.loss, `a best of 5 stakes more than a best of 3 (${JSON.stringify(bo5)} v ${JSON.stringify(est)})`);
    const puzzlesOnly = (await call(fns.ratedStakesEstimateFn, { format: "bo3", choice: "puzzles" }, userToken(EQ))) as Stakes;
    check(!!puzzlesOnly && puzzlesOnly.win > 0 && puzzlesOnly.loss < 0, `All puzzles has its own estimate (${JSON.stringify(puzzlesOnly)})`);
    check((await call(fns.ratedStakesEstimateFn, { format: "ffa4", choice: "mixed" }, userToken(EQ))) === null, "4 players: no estimate (switched off; placings aren't a win or a loss)");
    check((await call(fns.ratedStakesEstimateFn, { format: "bo3", choice: "logic" }, userToken(EQ))) === null, "a single-category pick: no estimate (the ratings engine doesn't rate it)");
    check((await call(fns.ratedStakesEstimateFn, { format: "bo3", choice: "mixed" }, userToken(OUTSIDER))) === null, "a player rated play isn't open to gets no estimate");
    let refused = false;
    try {
      await call(fns.ratedStakesEstimateFn, { format: "best of 3", choice: "mixed" }, userToken(EQ));
    } catch {
      refused = true;
    }
    check(refused, "an unknown format is refused by the input check (validate.ts)");
    check(q(`SELECT count(*) FROM public.rated_profiles WHERE player_id = '${TWIN}'`) === "0", "reading stakes writes nothing (no rated row for anyone it imagined)");
  });
}
