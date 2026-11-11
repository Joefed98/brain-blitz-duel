/**
 * tournament-events-server-check (wave 4, W4c; docs/tournaments/events.md): the Category Cup and the Joulz Championship
 * end to end on a local PostgreSQL 16 with every migration applied, through the real server functions and the real
 * event flow (scripts/server-fn-harness.ts). W4b's Score Attack standings, D2's Joules and the reminders are stood in
 * through `setTournamentPlatform`; most match rooms are small stand-in rooms, one is a real started room (W3b's
 * `createStartedRoom` with a fresh deal). No browser (~15 s).
 *
 * What it proves:
 * - both switches off: every server function refuses (the event page, entering, leaving, the hall of fame) and no row
 *   is made;
 * - entry: accounts only (a guest is refused), 150 coins or a Category Cup ticket taken once, too few coins refused
 *   with nothing taken, entering twice refused, leaving before the start refunds once, re-entering pays again, entry
 *   closed at the start;
 * - the reminder goes to every entrant once, 15 minutes before;
 * - the 16-entrant minimum: 3 entrants at the start cancel the cup and refund every entry once (coins and the ticket);
 * - the Swiss: 17 players play 5 rounds; each round paired on the same points with no rematch and one bye (never twice
 *   to anyone), its rooms made a minute after the round before, a no-show room settled at its deadline; places from
 *   the standings; the prizes (3,000 / 1,800 / 900 / 300 for 4th–8th), trophies, the Swiss Champion badge and Joules
 *   paid once, a second tick paying nothing more; `swiss_round_paired` per round;
 * - the Knockout: qualifiers from Score Attack (guests and repeats skipped, 64 at most, seeded in order), byes to the
 *   top seeds, a level match to the higher seed, the semi losers' third-place match, the final; the prizes (10,000 /
 *   5,000 / 2,500 / 1,000 / 500), trophies, the Knockout Champion badge (with its 250), the Championship frame and the
 *   hall of fame, paid once; no qualifiers cancels; `knockout_match_played` per played match (never a walkover);
 * - a real match room: both players seated, never a rated match, Play again refused, quick phrases only for an
 *   under-18 in its chat; ratings never called;
 * - the analytics migration keeps every event allowed before.
 */
import {
  callServerFn,
  installServerFnPlugin,
  postgresBin,
  SERVICE_KEY,
  ANON_KEY,
  startLocalDb,
  startRestServer,
  accountToken,
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
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^tournament-events-server-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
};

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

let db: LocalDb | null = null;
let rest: RestServer | null = null;

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log("tournament-events-server-check: 0 passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL");
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: not run (CI runs it)");
  console.log("tournament-events-server-check: skipped locally");
  process.exit(0);
}

try {
  db = startLocalDb("tournament-events-check-");
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
console.log(`tournament-events-server-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: the Category Cup and the Joulz Championship run, refund and pay once on a real database, switched off by default.");
process.exit(0);

async function runAll(db: LocalDb): Promise<void> {
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const fns = await import("../src/lib/tournaments/events.functions");
  const flow = await import("../src/lib/tournaments/eventsFlow.server");
  const { setTournamentPlatform } = await import("../src/lib/tournaments/platform.server");
  const { setRatingsBackend } = await import("../src/lib/rated/ratings.server");
  const duel = await import("../src/lib/duel/duel.functions");
  const { tournamentChatText } = await import("../src/lib/tournaments/eventChat.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const client = await adminDb();
  const ON = { category_cup: true, championship: true } as const;

  let ratingCalls = 0;
  setRatingsBackend({
    matchRating: async () => ({ rating: 1000, placement: false }),
    recordRatedMatch: async () => {
      ratingCalls++;
    },
    startingRating: 1000,
    beginnerMax: 1000,
  });
  const reminders: string[][] = [];
  const joules: string[] = [];
  let top: string[] = [];
  setTournamentPlatform({
    scoreAttackTop: async () => top,
    awardJoules: async (_c, input) => {
      joules.push(input.key);
    },
    remind: async (_c, input) => {
      reminders.push([...input.userIds]);
    },
  });

  // Accounts: 24 for the cups, 70 for the Championships; a guest; a 15-year-old.
  const P = Array.from({ length: 24 }, (_, i) => uid(100 + i));
  const Q = Array.from({ length: 70 }, (_, i) => uid(300 + i));
  const GUEST = uid(9);
  const KID = uid(10);
  const users = [...P, ...Q, KID];
  q(`INSERT INTO auth.users (id, is_anonymous, email) VALUES ${users.map((u, i) => `('${u}', false, 'u${i}@example.test')`).join(", ")}, ('${GUEST}', true, NULL)`);
  users.forEach((u, i) => {
    const name = u === KID ? "Kiddo_K" : `Player_${String(i).padStart(3, "0")}`;
    const dob = u === KID ? "2011-06-01" : "1990-01-01";
    q(`SELECT public.create_profile('${u}', '${name}', ${i % 32}::smallint, DATE '${dob}', NULL)`);
  });
  for (const u of [...P, ...Q, KID]) q(`SELECT public.economy_credit('${u}', 1000, 'admin_adjustment', NULL, NULL, 'seed:${u}')`);
  const balance = (u: string) => Number(q(`SELECT coalesce((SELECT balance FROM coin_wallets WHERE user_id = '${u}'), -1)`));
  const tickets = (u: string) => Number(q(`SELECT coalesce((SELECT count FROM consumable_balances WHERE user_id = '${u}' AND kind = 'ticket_category_cup'), 0)`));
  q(`SELECT public.economy_grant_consumable('${P[16]}', 'ticket_category_cup', 1, 'admin_adjustment', NULL, NULL, 'seed-ticket:${P[16]}')`);
  q(`SELECT public.economy_grant_consumable('${P[20]}', 'ticket_category_cup', 1, 'admin_adjustment', NULL, NULL, 'seed-ticket:${P[20]}')`);

  // Stand-in match rooms: a started room with three stored games; `finish` stores the results and ends it.
  let roomN = 0;
  const makeRoom = async (_c: unknown, input: { players: string[] }) => {
    roomN++;
    const code = `T${String(roomN).padStart(3, "0")}`.slice(0, 4).replace(/0/g, "Z");
    const games = JSON.stringify([{ type: "gridlock", tieRev: 1 }, { type: "gridlock", tieRev: 1 }, { type: "gridlock", tieRev: 1 }]);
    const id = q(`INSERT INTO duels (room_code, round_order, status, phase, current_round, round_count, puzzles_public, max_players)
      VALUES ('${code}${roomN}', '["gridlock","gridlock","gridlock"]', 'in_progress', 'starting', 1, 3, '${games}', 2) RETURNING id`).split("\n")[0]!.trim();
    input.players.forEach((u, i) => q(`INSERT INTO duel_players (duel_id, player_slot, user_id, display_name, status) VALUES ('${id}', ${i + 1}, '${u}', 'P${i + 1}', 'active')`));
    return { id, code: `${code}${roomN}` };
  };
  /** Stores a match's three games (side a's and b's scores; equal ms left) and ends the room. */
  const finish = (roomId: string, a: number[], b: number[]) => {
    const rows = [0, 1, 2].flatMap((g) => [`('${roomId}', 1, ${g + 1}, ${a[g]}, 5000, true, 'x')`, `('${roomId}', 2, ${g + 1}, ${b[g]}, 5000, true, 'x')`]);
    q(`INSERT INTO round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer) VALUES ${rows.join(", ")}`);
    q(`UPDATE duels SET status = 'finished', phase = 'finished', phase_started_at = now() WHERE id = '${roomId}'`);
  };
  const tick = async (eventId: string, nowMs: number, real = false) => flow.tickEvent(client, eventId, nowMs, { switches: ON, ...(real ? {} : { makeRoom }) });
  const eventRow = (id: string) => JSON.parse(q(`SELECT row_to_json(e) FROM tournament_events e WHERE id = '${id}'`)) as Record<string, string | number | null>;
  const matchesOf = (id: string) =>
    JSON.parse(q(`SELECT coalesce(json_agg(m ORDER BY round, stage, slot), '[]') FROM tournament_matches m WHERE event_id = '${id}'`)) as {
      id: string;
      round: number;
      stage: string;
      slot: number;
      player_a: string | null;
      player_b: string | null;
      seed_a: number | null;
      seed_b: number | null;
      duel_id: string | null;
      status: string;
      winner: string | null;
      walkover: boolean;
    }[];

  /* ------------------------------------------------------------------ switched off */
  await section("off", async () => {
    const view = await callServerFn(fns.tournamentEventFn, { kind: "category_cup" }, accountToken(P[0]!));
    const champ = await callServerFn(fns.tournamentEventFn, { kind: "championship" }, accountToken(P[0]!));
    const enter = await callServerFn(fns.enterTournamentEventFn, { kind: "category_cup", payWith: "coins" }, accountToken(P[0]!));
    const leave = await callServerFn(fns.leaveTournamentEventFn, { kind: "category_cup" }, accountToken(P[0]!));
    const hall = await callServerFn(fns.hallOfFameFn, {}, accountToken(P[0]!));
    check("off" in view && "off" in champ, "switched off: the event page answers “isn’t running” for both events");
    check(enter.ok === false && enter.reason === "off" && leave.ok === false && leave.reason === "off", "switched off: entering and leaving are refused by the server");
    check(Array.isArray(hall) && hall.length === 0, "switched off: the hall of fame is empty");
    check(q(`SELECT count(*) FROM tournament_events`) === "0" && balance(P[0]!) === 1000, "switched off: no event made and no coin taken");
    const viewFlow = await flow.eventView(client, "category_cup", P[0]!, Date.now());
    check(viewFlow === null, "switched off: the flow's own view refuses too (the defaults read the config)");
  });

  /* ------------------------------------------------------------------ the cup */
  const S1 = "2027-03-06"; // a Saturday (GMT)
  const start1 = Date.parse(`${S1}T19:00:00Z`);
  let cupId = "";
  await section("entry", async () => {
    const before = start1 - 3_600_000;
    const guest = await flow.enterCup(client, GUEST, "coins", before, ON);
    check(guest.ok === false && guest.reason === "account", "a guest can't enter (accounts only)");
    check(q(`SELECT count(*) FROM tournament_events`) === "0", "a guest's refused entry makes nothing");
    await flow.eventView(client, "category_cup", P[0]!, before, { switches: ON });
    await flow.eventView(client, "category_cup", P[1]!, before, { switches: ON });
    cupId = q(`SELECT id FROM tournament_events WHERE event_key = 'category_cup:${S1}'`);
    check(cupId.length === 36 && q(`SELECT count(*) FROM tournament_events`) === "1" && q(`SELECT category FROM tournament_events WHERE id = '${cupId}'`) === "strategy", `the cup is made once with its week's category (21 weeks after Word: Strategy) (${q(`SELECT category FROM tournament_events`)})`);
    q(`UPDATE coin_wallets SET balance = 100 WHERE user_id = '${P[23]}'`);
    const poor = await flow.enterCup(client, P[23]!, "coins", before, ON);
    check(poor.ok === false && poor.reason === "coins" && balance(P[23]!) === 100, "too few coins: refused, nothing taken");
    const noTicket = await flow.enterCup(client, P[0]!, "ticket", before, ON);
    check(noTicket.ok === false && noTicket.reason === "ticket", "no ticket: refused");
    for (let i = 0; i < 16; i++) {
      const r = await flow.enterCup(client, P[i]!, "coins", before, ON);
      if (!r.ok) check(false, `P${i} enters (${JSON.stringify(r)})`);
    }
    const t = await flow.enterCup(client, P[16]!, "ticket", before, ON);
    check(t.ok === true && tickets(P[16]!) === 0 && balance(P[16]!) === 1000, "a Category Cup ticket enters instead of the coins");
    check([0, 5, 15].every((i) => balance(P[i]!) === 850), "150 coins taken from each coin entry");
    const again = await flow.enterCup(client, P[0]!, "coins", before, ON);
    check(again.ok === false && again.reason === "already" && balance(P[0]!) === 850, "entering twice: refused, nothing more taken");
    const left = await flow.leaveCup(client, P[3]!, before, ON);
    check(left.ok === true && balance(P[3]!) === 1000, "leaving before the start refunds the 150");
    const leftAgain = await flow.leaveCup(client, P[3]!, before, ON);
    check(leftAgain.ok === false && balance(P[3]!) === 1000, "leaving twice refunds nothing more");
    const back = await flow.enterCup(client, P[3]!, "coins", before, ON);
    check(back.ok === true && balance(P[3]!) === 850, "re-entering pays again (a new entry key)");
    check(q(`SELECT count(*) FROM tournament_entries WHERE event_id = '${cupId}' AND status = 'entered'`) === "17", "17 entered");
    const view = await flow.eventView(client, "category_cup", P[0]!, before, { switches: ON });
    check(view?.status === "open" && view.entrants === 17 && view.me.entered && view.rules.length > 5 && view.prizes[0] === "1st: 3,000 coins", "the event page: open, 17 entered, prizes and rules");
    const late = await flow.enterCup(client, P[18]!, "coins", start1 + 1000, ON);
    check(late.ok === false && late.reason === "closed" && balance(P[18]!) === 1000, "entry closes at the start");
  });

  await section("swiss", async () => {
    await tick(cupId, start1 - 20 * 60_000);
    check(reminders.length === 0, "no reminder 20 minutes before");
    await tick(cupId, start1 - 14 * 60_000);
    await tick(cupId, start1 - 10 * 60_000);
    check(reminders.length === 1 && reminders[0]!.length === 17, `one reminder to all 17 entrants 15 minutes before (${reminders.map((r) => r.length).join()})`);

    let now = start1;
    await tick(cupId, now);
    let ev = eventRow(cupId);
    check(ev["status"] === "running" && ev["rounds_total"] === 5 && ev["field"] === 17 && ev["current_round"] === 1, `the cup starts: running, 17 players, 5 rounds (${ev["status"]}, ${ev["rounds_total"]})`);
    const met = new Set<string>();
    const byes = new Map<string, number>();
    let rematch = 0;
    for (let round = 1; round <= 5; round++) {
      ev = eventRow(cupId);
      const ms = matchesOf(cupId).filter((m) => m.round === round);
      check(ms.length === 9 && ms.filter((m) => m.player_b === null).length === 1, `round ${round}: 8 matches and a bye`);
      for (const m of ms) {
        if (!m.player_b) {
          byes.set(m.player_a!, (byes.get(m.player_a!) ?? 0) + 1);
          continue;
        }
        const k = [m.player_a, m.player_b].sort().join("|");
        if (met.has(k)) rematch++;
        met.add(k);
      }
      if (round > 1) {
        // Rooms only once the minute's break is over.
        check(ms.every((m) => m.player_b === null || m.status === "pending"), `round ${round}: no rooms before the break ends`);
        now += 61_000;
        await tick(cupId, now);
      }
      const playing = matchesOf(cupId).filter((m) => m.round === round && m.player_b);
      check(playing.every((m) => m.status === "playing" && m.duel_id), `round ${round}: every match has its room`);
      playing.forEach((m, i) => {
        if (round === 3 && i === 0) return; // a no-show: settled at the deadline
        const draw = round === 2 && i === 1;
        finish(m.duel_id!, draw ? [100, 100, 100] : [150, 80, 120], draw ? [100, 100, 100] : i % 2 ? [160, 90, 130] : [100, 70, 110]);
      });
      now += 5_000;
      await tick(cupId, now);
      if (round === 3) {
        check(matchesOf(cupId).filter((m) => m.round === 3 && m.status === "playing").length === 1, "a room nobody played isn't settled before its deadline");
        now += flow.MATCH_DEADLINE_MS;
        await tick(cupId, now);
        check(matchesOf(cupId).filter((m) => m.round === 3).every((m) => m.status === "settled"), "…and is settled at its deadline (a no-show scores 0)");
      }
    }
    ev = eventRow(cupId);
    check(rematch === 0, "five rounds: never the same opponent twice");
    check([...byes.values()].every((v) => v === 1) && byes.size === 5, "one bye a round, never twice to the same player");
    check(ev["status"] === "finished" && typeof ev["paid_at"] === "string", `the cup finishes and pays (${ev["status"]})`);
    const places = JSON.parse(q(`SELECT json_agg(final_place ORDER BY final_place) FROM tournament_entries WHERE event_id = '${cupId}' AND status = 'entered'`)) as number[];
    check(places.join() === Array.from({ length: 17 }, (_, i) => i + 1).join(), "every entrant has a unique final place 1–17");
    const at = (place: number) => q(`SELECT user_id FROM tournament_entries WHERE event_id = '${cupId}' AND final_place = ${place}`);
    const paidWith = (u: string) => q(`SELECT paid_with FROM tournament_entries WHERE event_id = '${cupId}' AND user_id = '${u}'`);
    const start = (u: string) => (paidWith(u) === "ticket" ? 1000 : 850);
    const prize = [3000, 1800, 900, 300, 300, 300, 300, 300, 0, 0];
    check(prize.every((p, i) => balance(at(i + 1)) === start(at(i + 1)) + p), `prizes: 3,000 / 1,800 / 900 and 300 for 4th–8th, nothing for 9th (${prize.map((_, i) => balance(at(i + 1))).join(" ")})`);
    check(q(`SELECT string_agg(cup, ',' ORDER BY place) FROM tournament_trophies WHERE event_id = '${cupId}'`) === "gold,silver,bronze", "trophies: gold, silver and bronze to 1st–3rd");
    check(q(`SELECT count(*) FROM player_badges WHERE badge = 'swiss-champion'`) === "1" && q(`SELECT user_id FROM player_badges WHERE badge = 'swiss-champion'`) === at(1), "the Swiss Champion badge to the winner");
    check(joules.filter((k) => k.includes(cupId)).length === 17, "150 Joules for each of the 17 finishers");
    const lines = q(`SELECT count(*) FROM coin_ledger WHERE reason = 'tournament_prize'`);
    const payouts = q(`SELECT count(*) FROM tournament_payouts WHERE event_id = '${cupId}'`);
    q(`UPDATE tournament_events SET paid_at = NULL WHERE id = '${cupId}'`); // as if a payout tick had died
    await tick(cupId, now + 1000);
    await tick(cupId, now + 2000);
    check(q(`SELECT count(*) FROM coin_ledger WHERE reason = 'tournament_prize'`) === lines && q(`SELECT count(*) FROM tournament_payouts WHERE event_id = '${cupId}'`) === payouts && balance(at(1)) === start(at(1)) + 3000, "paid once: a repeated payout tick pays nothing more");
    check(joules.filter((k) => k.includes(cupId)).length === 17, "Joules once");
    const view = await flow.eventView(client, "category_cup", at(1), now, { switches: ON });
    check(view?.standings.length === 17 && view.standings[0]!.me && view.me.finalPlace === 1, "the event page shows the final standings");
    await flushAnalytics();
    check(q(`SELECT count(*) FROM analytics.events WHERE event = 'swiss_round_paired'`) === "5" && q(`SELECT string_agg(props->>'round', ',' ORDER BY (props->>'round')::int) FROM analytics.events WHERE event = 'swiss_round_paired'`) === "1,2,3,4,5" && q(`SELECT DISTINCT props->>'players' FROM analytics.events WHERE event = 'swiss_round_paired'`) === "17", "swiss_round_paired once a round, with the round and players");
    check(ratingCalls === 0 && q(`SELECT count(*) FROM rated_matches`) === "0", "no rating touched: no rated match, ratings never called");
  });

  /* ------------------------------------------------------------------ cancelled */
  await section("cancel", async () => {
    const S2 = "2027-03-13";
    const start2 = Date.parse(`${S2}T19:00:00Z`);
    const before = start2 - 3_600_000;
    for (const i of [17, 18]) await flow.enterCup(client, P[i]!, "coins", before, ON);
    await flow.enterCup(client, P[20]!, "ticket", before, ON);
    check(balance(P[17]!) === 850 && tickets(P[20]!) === 0, "three enter");
    const id = q(`SELECT id FROM tournament_events WHERE event_key = 'category_cup:${S2}'`);
    await tick(id, start2);
    const ev = eventRow(id);
    check(ev["status"] === "cancelled" && ev["cancelled_reason"] === "too_few", "fewer than 16 at the start: cancelled");
    check(balance(P[17]!) === 1000 && balance(P[18]!) === 1000 && tickets(P[20]!) === 1, "every entry refunded (coins and the ticket)");
    await tick(id, start2 + 5000);
    await tick(id, start2 + 9000);
    check(balance(P[17]!) === 1000 && tickets(P[20]!) === 1 && q(`SELECT count(*) FROM tournament_entries WHERE event_id = '${id}' AND status = 'refunded' AND refunded_at IS NOT NULL`) === "3", "refunded once");
  });

  /* ------------------------------------------------------------------ the Championship */
  await section("knockout", async () => {
    const month = "2027-03";
    const day = Date.parse("2027-03-28T18:00:00Z"); // the last Sunday, 7 pm BST
    const A = Q.slice(0, 5);
    top = [GUEST, A[0]!, A[1]!, A[0]!, A[2]!, A[3]!, A[4]!];
    const view0 = await flow.eventView(client, "championship", A[0]!, day - 3_600_000, { switches: ON });
    check(view0?.status === "open" && view0.title.includes("March 2027"), `the Championship: open before the day (${view0?.title})`);
    const entry = await flow.enterCup(client, A[0]!, "coins", day - 3_600_000, { category_cup: false, championship: true });
    check(entry.ok === false && entry.reason === "off", "the cup's own switch guards entering the cup");
    const id = q(`SELECT id FROM tournament_events WHERE event_key = 'championship:${month}'`);
    await tick(id, day);
    let ev = eventRow(id);
    check(ev["status"] === "running" && ev["field"] === 5 && ev["bracket_size"] === 8 && ev["rounds_total"] === 3, `qualifiers from Score Attack: 5 accounts (the guest and a repeat skipped), a bracket of 8 (${ev["field"]}, ${ev["bracket_size"]})`);
    const seeds = q(`SELECT string_agg(seed::text, ',' ORDER BY seed) FROM tournament_entries WHERE event_id = '${id}'`);
    check(seeds === "1,2,3,4,5" && q(`SELECT user_id FROM tournament_entries WHERE event_id = '${id}' AND seed = 1`) === A[0], "seeded in Score Attack order");
    let r1 = matchesOf(id).filter((m) => m.round === 1);
    check(r1.filter((m) => m.walkover).length === 3 && r1.filter((m) => m.walkover).every((m) => [1, 2, 3].includes(m.seed_a ?? m.seed_b ?? 0)), "byes: seeds 1, 2 and 3 go through without playing");
    const played = r1.find((m) => !m.walkover)!;
    check(played.seed_a === 4 && played.seed_b === 5 && played.status === "playing", "4 v 5 is played");
    finish(played.duel_id!, [100, 100, 100], [100, 100, 100]);
    await tick(id, day + 10_000);
    r1 = matchesOf(id).filter((m) => m.round === 1);
    check(r1.find((m) => !m.walkover)!.winner === A[3], "a level match goes to the higher seed (4)");
    await tick(id, day + 80_000);
    let semis = matchesOf(id).filter((m) => m.round === 2);
    check(semis.length === 2 && semis.every((m) => m.status === "playing"), "the semi-finals, a minute later");
    const semiOf = (s: number) => semis.find((m) => m.seed_a === s || m.seed_b === s)!;
    // 4 beats 1; 2 beats 3.
    const s1 = semiOf(1);
    finish(s1.duel_id!, s1.seed_a === 1 ? [10, 10, 10] : [150, 150, 150], s1.seed_a === 1 ? [150, 150, 150] : [10, 10, 10]);
    const s2 = semiOf(2);
    finish(s2.duel_id!, s2.seed_a === 2 ? [150, 150, 150] : [10, 10, 10], s2.seed_a === 2 ? [10, 10, 10] : [150, 150, 150]);
    await tick(id, day + 90_000);
    await tick(id, day + 160_000);
    const last = matchesOf(id).filter((m) => m.round === 3);
    const final = last.find((m) => m.stage === "knockout")!;
    const third = last.find((m) => m.stage === "third_place")!;
    check(!!final && !!third && [final.seed_a, final.seed_b].sort().join() === "2,4" && [third.seed_a, third.seed_b].sort().join() === "1,3", "the final (2 v 4) and the semi losers' third-place match (1 v 3)");
    finish(final.duel_id!, final.seed_a === 2 ? [150, 90, 150] : [90, 150, 90], final.seed_a === 2 ? [90, 150, 90] : [150, 90, 150]);
    finish(third.duel_id!, third.seed_a === 3 ? [150, 150, 150] : [0, 0, 0], third.seed_a === 3 ? [0, 0, 0] : [150, 150, 150]);
    await tick(id, day + 170_000);
    ev = eventRow(id);
    check(ev["status"] === "finished" && typeof ev["paid_at"] === "string", "the Championship finishes and pays");
    const place = (u: string) => Number(q(`SELECT final_place FROM tournament_entries WHERE event_id = '${id}' AND user_id = '${u}'`));
    check(place(A[1]!) === 1 && place(A[3]!) === 2 && place(A[2]!) === 3 && place(A[0]!) === 4 && place(A[4]!) === 5, "places: final winner 1st, loser 2nd, third-place winner 3rd, loser 4th, the quarter-final loser 5th");
    check(balance(A[1]!) === 1000 + 10000 + 250 && balance(A[3]!) === 6000 && balance(A[2]!) === 3500 && balance(A[0]!) === 2000 && balance(A[4]!) === 1500, `prizes: 10,000 (+250 for the Legendary badge) / 5,000 / 2,500 / 1,000 / 500 (${A.map((u) => balance(u)).join(" ")})`);
    check(q(`SELECT count(*) FROM player_badges WHERE badge = 'knockout-champion' AND user_id = '${A[1]}'`) === "1", "the Knockout Champion badge to the winner");
    check(q(`SELECT how FROM inventory_items WHERE user_id = '${A[1]}' AND item_id = 'frame.championship'`) === "earned", "the animated Championship frame to the winner");
    check(q(`SELECT user_id FROM tournament_hall_of_fame WHERE month = '${month}'`) === A[1], "the winner joins the hall of fame");
    check(q(`SELECT string_agg(cup, ',' ORDER BY place) FROM tournament_trophies WHERE event_id = '${id}'`) === "gold,silver,bronze", "trophies to 1st–3rd");
    await tick(id, day + 200_000);
    check(balance(A[1]!) === 11250 && q(`SELECT count(*) FROM inventory_items WHERE item_id = 'frame.championship'`) === "1", "paid once");
    await flushAnalytics();
    check(q(`SELECT count(*) FROM analytics.events WHERE event = 'knockout_match_played'`) === "5", `knockout_match_played for each played match, never a walkover (${q(`SELECT count(*) FROM analytics.events WHERE event = 'knockout_match_played'`)})`);
    const v = await flow.eventView(client, "championship", A[1]!, day + 200_000, { switches: ON });
    check(v?.bracket.length === 8 && v.me.finalPlace === 1 && v.bracket.some((b) => b.stage === "third_place"), "the event page draws the bracket and the third-place match");
  });

  await section("qualification", async () => {
    // 64 at most: 66 accounts and 4 guests in the standings.
    const day = Date.parse("2027-04-25T18:00:00Z");
    top = [GUEST, ...Q.slice(0, 66)];
    const id0 = await flow.ensureEvent(client, "championship", day - 1000);
    await tick(id0.id, day);
    const ev = eventRow(id0.id);
    const r1 = matchesOf(id0.id).filter((m) => m.round === 1);
    check(ev["field"] === 64 && ev["bracket_size"] === 64 && ev["rounds_total"] === 6 && r1.length === 32 && r1.every((m) => !m.walkover), "the top 64 qualify: a full bracket of 32 first-round matches, no byes");
    check(q(`SELECT count(*) FROM tournament_entries WHERE event_id = '${id0.id}' AND user_id IN ('${Q[64]}', '${Q[65]}')`) === "0", "the 65th and 66th don't qualify");
    // No qualifiers: cancelled, nothing paid.
    top = [];
    const may = await flow.ensureEvent(client, "championship", Date.parse("2027-05-30T17:00:00Z"));
    await tick(may.id, Date.parse("2027-05-30T18:00:00Z"));
    check(eventRow(may.id)["status"] === "cancelled" && eventRow(may.id)["cancelled_reason"] === "no_qualifiers", "no qualifiers: cancelled");
  });

  await section("real room", async () => {
    const day = Date.parse("2027-06-27T18:00:00Z");
    const [x, kid] = [Q[68]!, KID];
    top = [x, kid];
    const ev = await flow.ensureEvent(client, "championship", day - 1000);
    await tick(ev.id, day, true);
    const final = matchesOf(ev.id)[0]!;
    check(eventRow(ev.id)["bracket_size"] === 2 && final.status === "playing" && !!final.duel_id, "two qualifiers: a live final in a real started room");
    const room = JSON.parse(q(`SELECT row_to_json(d) FROM duels d WHERE id = '${final.duel_id}'`)) as { status: string; round_count: number; host_user_id: string };
    const seated = q(`SELECT string_agg(user_id::text || ':' || player_slot, ',' ORDER BY player_slot) FROM duel_players WHERE duel_id = '${final.duel_id}'`);
    check(room.status === "in_progress" && room.round_count === 3 && seated === `${x}:1,${kid}:2`, `the room: started, three games, both players seated (${room.status}, ${seated})`);
    check(q(`SELECT count(*) FROM rated_matches WHERE duel_id = '${final.duel_id}'`) === "0", "never a rated match");
    const kidChat = await tournamentChatText(client, final.duel_id!, kid, "hello there", Date.now());
    const adultChat = await tournamentChatText(client, final.duel_id!, x, "hello there", Date.now());
    check(kidChat?.ok === false && adultChat?.ok === true, "chat: quick phrases only for an under-18, an adult types");
    check((await tournamentChatText(client, (await makeRoom(null, { players: [x] })).id, x, "hi", Date.now())) === null, "an ordinary room's chat is unchanged");
    finish(final.duel_id!, [150, 150, 10], [10, 10, 150]);
    const again = await callServerFn(duel.rematchFn, { roomId: final.duel_id }, accountToken(room.host_user_id));
    check(again?.ok === false && /can’t be played again/.test(again.message ?? ""), `Play again is refused in a tournament room (${JSON.stringify(again).slice(0, 80)})`);
    await tick(ev.id, day + 60_000, true);
    check(eventRow(ev.id)["status"] === "finished" && q(`SELECT user_id FROM tournament_hall_of_fame WHERE month = '2027-06'`) === x, "settled from the room's own grading: the winner takes the final");
    const hall = await flow.hallOfFame(client, ON);
    check(hall.length === 2 && hall[0]!.month === "2027-06" && hall[1]!.month === "2027-03" && hall[0]!.label === "June 2027" && hall[0]!.name.startsWith("Player_"), `the hall of fame: every winner by month, newest first (${hall.map((h) => `${h.month} ${h.name}`).join("; ")})`);
    check(ratingCalls === 0 && q(`SELECT count(*) FROM rated_matches`) === "0", "ratings never called");
  });

  await section("guest view", async () => {
    const v = await flow.eventView(client, "category_cup", GUEST, Date.parse("2027-03-19T12:00:00Z"), { switches: ON });
    check(v?.me.account === false && v.me.entered === false, "a guest sees the page but isn't an account");
    const viaFn = await callServerFn(fns.enterTournamentEventFn, { kind: "championship", payWith: "coins" }, userToken(GUEST));
    check(viaFn.ok === false && viaFn.reason === "off", "the server function reads the real switches (the Championship is off at launch)");
  });

  await section("analytics list", async () => {
    const def = q(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'analytics.events'::regclass AND conname = 'events_event_check'`);
    const { ANALYTICS_EVENTS } = await import("../src/lib/analytics/events");
    check(ANALYTICS_EVENTS.every((e) => def.includes(`'${e}'`)), "the table's list keeps every event (the new two added, none dropped)");
  });
}
