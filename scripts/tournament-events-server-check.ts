/**
 * tournament-events-server-check (wave 4, W4c; docs/tournaments/events.md): the Category Cup and the Joulz Championship
 * end to end on a local PostgreSQL 16 with every migration applied, through the real server functions and the real
 * flow on W4b's tournaments (scripts/server-fn-harness.ts). The month's Score Attack standings and Joules are stood in
 * through `setTournamentPlatform`; most match rooms are small stand-in rooms (`setBigRoomMaker`), one is W3b's real
 * dealt match room. No browser (~15 s).
 *
 * What it proves:
 * - both switched off at launch: W4b's event read, entry, the live part and the hall of fame all refuse for a tester,
 *   W4b's tick makes neither, and no event of either kind is made;
 * - entry through W4b's enterEvent: accounts only, 150 coins or a Category Cup ticket taken once, too few coins refused
 *   with nothing taken, entering twice takes nothing more, the Championship can't be entered, entry closed at the start;
 * - W4b's tick reminds every entrant once before the start;
 * - the 16-entrant minimum: 3 entrants at the start call the cup off and W4b refunds every entry once (coins and ticket);
 * - the Swiss: 17 players play 5 rounds; each round paired with no rematch and one bye (never twice to anyone), its
 *   rooms made a minute after the round before, a no-show room settled at its deadline; places from the standings;
 *   prizes 3,000 / 1,800 / 900 / 300 (4th–8th), trophies, the Swiss Champion badge and W4b's Champion, Joules, each paid
 *   once, a repeated tick paying nothing more; `swiss_round_paired` per round;
 * - a flagged run (the server's own stored extra.flagged): that player loses the match, gets no place, prize, badge or
 *   Joules, is logged once in moderation.tournament_flags (Joe's queue lists it), and sees the under-review line;
 * - the Knockout: qualifiers from the month's Score Attack standings (guests and repeats skipped, 64 at most, seeded in
 *   order, entered free by the server), byes to the top seeds, a level match to the higher seed, the semi losers'
 *   third-place match (a flagged side losing it and placing nowhere), the final; prizes 10,000 / 5,000 / 2,500 / 500,
 *   the Knockout Champion badge (with its 250), the Championship frame and the hall of fame, paid once and logged;
 *   15 qualifiers: not held (nobody entered or paid), 16: held (Joe, 11 Nov 2026); `knockout_match_played` per played
 *   match (never a walkover);
 * - real match rooms: both players seated, never a rated match, Play again refused with the event's own line, quick
 *   phrases only for an under-18 in its chat; no rated match ever made;
 * - the analytics migration keeps every event allowed before.
 */
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
import { BIG_EVENT_PLAY_AGAIN_LINE } from "../src/lib/tournaments/eventRules";

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
console.log("PASS: the Category Cup and the Joulz Championship run on W4b's tournaments, refund and pay once, flag for review, switched off by default.");
process.exit(0);

async function runAll(db: LocalDb): Promise<void> {
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const w4bFns = await import("../src/lib/tournaments/tournaments.functions");
  const fns = await import("../src/lib/tournaments/events.functions");
  const server = await import("../src/lib/tournaments/tournaments.server");
  const flow = await import("../src/lib/tournaments/eventsFlow.server");
  const { setTournamentPlatform } = await import("../src/lib/tournaments/platform.server");
  const { tournamentChatText } = await import("../src/lib/tournaments/tournamentChat.server");
  const duel = await import("../src/lib/duel/duel.functions");
  const { readEvent } = await import("../src/lib/data/tournaments.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const client = await adminDb();
  const ON = { forEveryone: true, kinds: { arena: true, score_attack: true, category_cup: true, championship: true } } as const;

  const joules: string[] = [];
  let top: string[] = [];
  setTournamentPlatform({
    scoreAttackTop: async () => top,
    awardJoules: async (_c, input) => {
      joules.push(`${input.eventId}|${input.userId}`);
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
    q(`SELECT public.create_profile('${u}', '${name}', ${i % 32}::smallint, DATE '${u === KID ? "2011-06-01" : "1990-01-01"}', NULL)`);
  });
  for (const u of users) q(`SELECT public.economy_credit('${u}', 1000, 'admin_adjustment', NULL, NULL, 'seed:${u}')`);
  const balance = (u: string) => Number(q(`SELECT coalesce((SELECT balance FROM coin_wallets WHERE user_id = '${u}'), -1)`));
  const tickets = (u: string) => Number(q(`SELECT coalesce((SELECT count FROM consumable_balances WHERE user_id = '${u}' AND kind = 'ticket_category_cup'), 0)`));
  for (const u of [P[16]!, P[20]!]) q(`SELECT public.economy_grant_consumable('${u}', 'ticket_category_cup', 1, 'admin_adjustment', NULL, NULL, 'seed-ticket:${u}')`);
  // P[0] is a tester (D1's list; made here when D1 isn't merged in), so W4b's own gate lets them through to the switch.
  if (q(`SELECT to_regclass('shop.testers') IS NULL`) === "t")
    q(`CREATE SCHEMA IF NOT EXISTS shop; CREATE TABLE shop.testers (user_id uuid PRIMARY KEY, note text NOT NULL DEFAULT '')`);
  q(`INSERT INTO shop.testers (user_id, note) VALUES ('${P[0]}', 'tournament-events-server-check') ON CONFLICT DO NOTHING`);

  // Stand-in match rooms: a started room with three stored games; `finish` stores the results and ends it.
  let roomN = 0;
  const makeRoom = async (_c: unknown, input: { players: string[] }) => {
    roomN++;
    const games = JSON.stringify([{ type: "gridlock", tieRev: 1 }, { type: "gridlock", tieRev: 1 }, { type: "gridlock", tieRev: 1 }]);
    const code = `Q${roomN}`;
    const id = q(`INSERT INTO duels (room_code, round_order, status, phase, current_round, round_count, puzzles_public, max_players)
      VALUES ('${code}', '["gridlock","gridlock","gridlock"]', 'in_progress', 'starting', 1, 3, '${games}', 2) RETURNING id`).split("\n")[0]!.trim();
    input.players.forEach((u, i) => q(`INSERT INTO duel_players (duel_id, player_slot, user_id, display_name, status) VALUES ('${id}', ${i + 1}, '${u}', 'P${i + 1}', 'active')`));
    return { id, code };
  };
  flow.setBigRoomMaker(makeRoom);
  /** Stores a match's three games (side a's and b's scores, equal time) and ends the room; `flag` flags that side's game 2. */
  const finish = (roomId: string, a: number[], b: number[], flag: 1 | 2 | null = null) => {
    const extra = (slot: number, g: number) => (flag === slot && g === 1 ? `'{"flagged": true, "flagReason": "desync"}'::jsonb` : "NULL");
    const rows = [0, 1, 2].flatMap((g) => [
      `('${roomId}', 1, ${g + 1}, ${a[g]}, 5000, true, 'x', ${extra(1, g)})`,
      `('${roomId}', 2, ${g + 1}, ${b[g]}, 5000, true, 'x', ${extra(2, g)})`,
    ]);
    q(`INSERT INTO round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer, extra) VALUES ${rows.join(", ")}`);
    q(`UPDATE duels SET status = 'finished', phase = 'finished', phase_started_at = now() WHERE id = '${roomId}'`);
  };
  const advance = async (eventId: string, nowMs: number) => {
    const row = (await readEvent(client, eventId)).data;
    if (row) await server.advanceEvent(client, row, nowMs);
  };
  const ensure = async (id: string) => server.ensureEvent(client, id, ON);
  const enter = (u: string, eventId: string, entry: string, nowMs: number) => server.enterEvent(client, u, { eventId, entry }, nowMs, ON);
  const eventRow = (id: string) => JSON.parse(q(`SELECT row_to_json(e) FROM tournament_events e WHERE id = '${id}'`)) as Record<string, string | number | null>;
  const roundsRow = (id: string) => JSON.parse(q(`SELECT coalesce((SELECT row_to_json(r)::text FROM tournament_rounds r WHERE event_id = '${id}'), 'null')`)) as Record<string, string | number | null> | null;
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
      flagged_a: boolean;
      flagged_b: boolean;
    }[];

  /* ------------------------------------------------------------------ switched off */
  const CUP1 = "category_cup:2027-03-06:1900"; // a Saturday (GMT); 21 weeks after Word: Strategy
  await section("off", async () => {
    const tok = accountToken(P[0]!);
    const view = await callServerFn(w4bFns.tournamentEventFn, { eventId: CUP1 }, tok);
    const champ = await callServerFn(w4bFns.tournamentEventFn, { eventId: "championship:2027-03" }, tok);
    const entry = await callServerFn(w4bFns.tournamentEnterFn, { eventId: CUP1, entry: "coins" }, tok);
    const live = await callServerFn(fns.bigEventFn, { eventId: CUP1 }, tok);
    const hall = await callServerFn(fns.hallOfFameFn, {}, tok);
    check(view === null && champ === null, "switched off: W4b's event read answers nothing for either (a tester asking)");
    check(entry?.ok === false && entry.reason === "kind_off", `switched off: entering is refused by the server (${entry?.reason})`);
    check(live === null && Array.isArray(hall) && hall.length === 0, "switched off: the live part and the hall of fame answer nothing");
    await server.runTournamentTick(client, Date.parse("2027-03-06T18:55:00Z"));
    check(q(`SELECT count(*) FROM tournament_events WHERE kind IN ('category_cup', 'championship')`) === "0" && balance(P[0]!) === 1000, "switched off: no event made (W4b's tick included) and no coin taken");
  });

  /* ------------------------------------------------------------------ the cup */
  const start1 = Date.parse("2027-03-06T19:00:00Z");
  await section("entry", async () => {
    const before = start1 - 3_600_000;
    const guest = await enter(GUEST, CUP1, "coins", before);
    check(guest.ok === false && guest.reason === "account", "a guest can't enter (accounts only)");
    q(`UPDATE coin_wallets SET balance = 100 WHERE user_id = '${P[23]}'`);
    const poor = await enter(P[23]!, CUP1, "coins", before);
    check(poor.ok === false && poor.reason === "insufficient" && balance(P[23]!) === 100, "too few coins: refused, nothing taken");
    const noTicket = await enter(P[0]!, CUP1, "ticket_category_cup", before);
    check(noTicket.ok === false && noTicket.reason === "no_ticket", "no ticket: refused");
    const free = await enter(P[0]!, CUP1, "free", before);
    check(free.ok === false && free.reason === "bad_entry", "no free way in");
    for (let i = 0; i < 16; i++) {
      const r = await enter(P[i]!, CUP1, "coins", before);
      if (!r.ok) check(false, `P${i} enters (${JSON.stringify(r)})`);
    }
    const t = await enter(P[16]!, CUP1, "ticket_category_cup", before);
    check(t.ok === true && tickets(P[16]!) === 0 && balance(P[16]!) === 1000, "a Category Cup ticket enters instead of the coins");
    check([0, 5, 15].every((i) => balance(P[i]!) === 850), "150 coins taken from each coin entry");
    await enter(P[0]!, CUP1, "coins", before);
    check(balance(P[0]!) === 850 && q(`SELECT entrants FROM tournament_events WHERE id = '${CUP1}'`) === "17", "entering twice takes nothing more; 17 entered");
    check(eventRow(CUP1)["title"] === "Strategy Cup" && eventRow(CUP1)["pick"] === "strategy", `the week's category (${eventRow(CUP1)["title"]})`);
    const late = await enter(P[18]!, CUP1, "coins", start1 + 1000);
    check(late.ok === false && late.reason === "closed" && balance(P[18]!) === 1000, "entry closes at the start");
  });

  let flaggedUser = "";
  await section("swiss", async () => {
    await server.runTournamentTick(client, start1 - 9 * 60_000, ON);
    check(q(`SELECT count(*) FROM tournament_reminders WHERE event_id = '${CUP1}' AND notified_at IS NOT NULL`) === "17", "W4b's tick reminds all 17 entrants before the start");
    let now = start1;
    await advance(CUP1, now);
    const rr = roundsRow(CUP1)!;
    check(eventRow(CUP1)["status"] === "live" && rr["rounds_total"] === 5 && rr["field"] === 17 && rr["current_round"] === 1, `the cup starts: live, 17 players, 5 rounds (${eventRow(CUP1)["status"]}, ${rr["rounds_total"]})`);
    const met = new Set<string>();
    const byes = new Map<string, number>();
    let rematch = 0;
    for (let round = 1; round <= 5; round++) {
      const ms = matchesOf(CUP1).filter((m) => m.round === round);
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
        check(ms.every((m) => m.player_b === null || m.status === "pending"), `round ${round}: no rooms before the minute's break ends`);
        now += 61_000;
        await advance(CUP1, now);
      }
      const playing = matchesOf(CUP1).filter((m) => m.round === round && m.player_b);
      check(playing.every((m) => m.status === "playing" && m.duel_id), `round ${round}: every match has its room`);
      playing.forEach((m, i) => {
        if (round === 3 && i === 0) return; // a no-show: settled at the deadline
        const draw = round === 2 && i === 1;
        // Round 4's first match: side a wins on the board, but its second game's run was flagged by the server.
        const flag = round === 4 && i === 0 ? 1 : null;
        if (flag) flaggedUser = m.player_a!;
        finish(m.duel_id!, draw ? [100, 100, 100] : [150, 80, 120], draw ? [100, 100, 100] : i % 2 ? [160, 90, 130] : [100, 70, 110], flag);
      });
      now += 5_000;
      await advance(CUP1, now);
      if (round === 3) {
        check(matchesOf(CUP1).filter((m) => m.round === 3 && m.status === "playing").length === 1, "a room nobody played isn't settled before its deadline");
        now += flow.MATCH_DEADLINE_MS;
        await advance(CUP1, now);
        check(matchesOf(CUP1).filter((m) => m.round === 3).every((m) => m.status === "settled"), "…and is settled at its deadline (a no-show scores 0)");
      }
      if (round === 4) {
        const fm = matchesOf(CUP1).find((m) => m.round === 4 && m.player_a === flaggedUser)!;
        check(fm.flagged_a && !fm.flagged_b && fm.winner === fm.player_b, "the flagged side loses the match it won on the board; the opponent takes it");
      }
    }
    check(rematch === 0, "five rounds: never the same opponent twice");
    check([...byes.values()].every((v) => v === 1) && byes.size === 5, "one bye a round, never twice to the same player");
    check(eventRow(CUP1)["status"] === "finished" && typeof roundsRow(CUP1)?.["awarded_at"] === "string", `the cup finishes and pays (${eventRow(CUP1)["status"]})`);
    const places = JSON.parse(q(`SELECT json_agg(place ORDER BY place) FROM tournament_results WHERE event_id = '${CUP1}'`)) as number[];
    check(places.length === 16 && places.join() === Array.from({ length: 16 }, (_, i) => i + 1).join(), `16 places 1–16 (the flagged player has none) (${places.length})`);
    check(q(`SELECT count(*) FROM tournament_results WHERE event_id = '${CUP1}' AND user_id = '${flaggedUser}'`) === "0", "the flagged player: no place");
    const at = (place: number) => q(`SELECT user_id FROM tournament_results WHERE event_id = '${CUP1}' AND place = ${place}`);
    const start = (u: string) => (q(`SELECT entry FROM tournament_entries WHERE event_id = '${CUP1}' AND user_id = '${u}'`) === "ticket_category_cup" ? 1000 : 850);
    const prize = [3000, 1800, 900, 300, 300, 300, 300, 300, 0, 0];
    const got = prize.map((_, i) => balance(at(i + 1)) - start(at(i + 1)));
    check(got.join() === prize.join(), `prizes: 3,000 / 1,800 / 900 and 300 for 4th–8th, nothing for 9th (${got.join(" ")})`);
    check(balance(flaggedUser) === start(flaggedUser), "the flagged player: no prize");
    check(q(`SELECT string_agg(medal, ',' ORDER BY place) FROM tournament_trophies WHERE event_id = '${CUP1}'`) === "gold,silver,bronze", "trophies: gold, silver and bronze to 1st–3rd");
    check(q(`SELECT user_id FROM player_badges WHERE badge = 'swiss-champion'`) === at(1) && q(`SELECT count(*) FROM player_badges WHERE badge = 'champion' AND user_id = '${at(1)}'`) === "1", "the Swiss Champion badge (and W4b's Champion) to the winner");
    check(q(`SELECT count(*) FROM player_badges WHERE badge = 'entrant' AND user_id = '${flaggedUser}'`) === "0", "the flagged player: no badge");
    check(joules.filter((k) => k.startsWith(CUP1)).length === 16 && !joules.includes(`${CUP1}|${flaggedUser}`), "Joules for the 16 placed finishers, none for the flagged player");
    const flags = q(`SELECT count(*) FROM moderation.tournament_flags WHERE event_id = '${CUP1}' AND player_id = '${flaggedUser}' AND reason = 'desync' AND game_idx = 1`);
    const queue = q(`SELECT count(*) FROM moderation.tournament_flag_queue() WHERE player_id = '${flaggedUser}'`);
    check(flags === "1" && queue === "1", `the flag is logged once for Joe's review and in his queue (${flags}, ${queue})`);
    const lines = q(`SELECT count(*) FROM coin_ledger WHERE reason = 'tournament_prize'`);
    q(`UPDATE tournament_rounds SET awarded_at = NULL WHERE event_id = '${CUP1}'`); // as if the awards tick had died
    await advance(CUP1, now + 1000);
    await server.payEvent(client, CUP1, now + 2000);
    check(q(`SELECT count(*) FROM coin_ledger WHERE reason = 'tournament_prize'`) === lines && balance(at(1)) === start(at(1)) + 3000 && joules.filter((k) => k.startsWith(CUP1)).length === 16, "paid once: a repeated tick and payout pay nothing more");
    const mineView = await flow.bigEventView(client, CUP1, at(1));
    check(mineView?.standings.length === 16 && mineView.standings[0]!.me && mineView.underReview === null, "the live part shows the standings (the flagged player left out)");
    // Joe, 11 Nov 2026: every row a nameplate strip from A1's public cards, the player's own cosmetics in it.
    q(`SELECT public.economy_grant_item('${at(1)}', 'frame.gold', 'grant'), public.economy_grant_item('${at(1)}', 'name-colour.chrome', 'grant')`);
    q(`SELECT public.economy_equip('${at(1)}', 'frame', 'frame.gold'), public.economy_equip('${at(1)}', 'name-colour', 'name-colour.chrome')`);
    const dressed = await flow.bigEventView(client, CUP1, at(1));
    const top = dressed?.standings[0];
    check(top?.player.kind === "account" && top.player.frame === "frame.gold" && top.player.nameColour === "name-colour.chrome" && top.player.name === top.name && !!top.player.avatar, `standings rows carry the player's strip with their own frame and name colour (${JSON.stringify(top?.player).slice(0, 120)})`);
    check(!!dressed && dressed.standings.every((r) => r.player.kind === "account" && r.player.name === r.name && r.player.colour >= 0), "every standings row is an account's strip (avatar, colour, username)");
    const flaggedView = await flow.bigEventView(client, CUP1, flaggedUser);
    check(typeof flaggedView?.underReview === "string" && /under review/.test(flaggedView.underReview), "the flagged player sees that their result is under review");
    await flushAnalytics();
    check(q(`SELECT string_agg(props->>'round', ',' ORDER BY (props->>'round')::int) FROM analytics.events WHERE event = 'swiss_round_paired'`) === "1,2,3,4,5" && q(`SELECT DISTINCT props->>'players' FROM analytics.events WHERE event = 'swiss_round_paired'`) === "17", "swiss_round_paired once a round, with the round and players");
    check(q(`SELECT count(*) FROM rated_matches`) === "0" && q(`SELECT count(*) FROM mm_matches`) === "0", "no rated match made");
  });

  /* ------------------------------------------------------------------ called off */
  await section("cancel", async () => {
    const id = "category_cup:2027-03-13:1900";
    const start2 = Date.parse("2027-03-13T19:00:00Z");
    for (const i of [17, 18]) await enter(P[i]!, id, "coins", start2 - 3_600_000);
    await enter(P[20]!, id, "ticket_category_cup", start2 - 3_600_000);
    check(balance(P[17]!) === 850 && tickets(P[20]!) === 0, "three enter");
    await advance(id, start2);
    check(eventRow(id)["status"] === "cancelled" && eventRow(id)["cancel_reason"] === "too_few", "fewer than 16 at the start: called off");
    check(balance(P[17]!) === 1000 && balance(P[18]!) === 1000 && tickets(P[20]!) === 1, "W4b refunds every entry (coins and the ticket)");
    await advance(id, start2 + 5000);
    check(balance(P[17]!) === 1000 && tickets(P[20]!) === 1 && roundsRow(id) === null, "refunded once; no rounds made");
  });

  /* ------------------------------------------------------------------ the Championship */
  /** Ends every playing match of a round, the higher seed winning (side a is slot 1), except where `aWins` says. */
  const playRound = (id: string, round: number, aWins?: (m: ReturnType<typeof matchesOf>[number]) => boolean) => {
    for (const m of matchesOf(id).filter((x) => x.round === round && x.status === "playing" && x.duel_id)) {
      const a = aWins ? aWins(m) : (m.seed_a ?? 99) < (m.seed_b ?? 99);
      finish(m.duel_id!, a ? [150, 150, 150] : [10, 10, 10], a ? [10, 10, 10] : [150, 150, 150]);
    }
  };

  await section("knockout", async () => {
    const id = "championship:2027-03";
    const day = Date.parse("2027-03-28T18:00:00Z"); // the last Sunday, 7 pm BST
    const A = Q.slice(0, 17);
    top = [GUEST, A[0]!, A[1]!, A[0]!, ...A.slice(2)];
    await ensure(id);
    const refused = await enter(A[0]!, id, "free", day - 3_600_000);
    check(refused.ok === false && refused.reason === "bad_entry", "the Championship can't be entered");
    await advance(id, day);
    const rr = roundsRow(id)!;
    check(eventRow(id)["status"] === "live" && rr["field"] === 17 && rr["bracket_size"] === 32 && rr["rounds_total"] === 5, `qualifiers from Score Attack: 17 accounts (the guest and a repeat skipped), a bracket of 32 (${rr["field"]}, ${rr["bracket_size"]}, ${rr["rounds_total"]})`);
    check(q(`SELECT string_agg(seed::text, ',' ORDER BY seed) FROM tournament_seeds WHERE event_id = '${id}'`) === Array.from({ length: 17 }, (_, i) => i + 1).join(",") && q(`SELECT user_id FROM tournament_seeds WHERE event_id = '${id}' AND seed = 1`) === A[0], "seeded in Score Attack order");
    check(q(`SELECT count(*) FROM tournament_entries WHERE event_id = '${id}' AND entry = 'free' AND coins = 0`) === "17" && q(`SELECT entrants FROM tournament_events WHERE id = '${id}'`) === "17", "the qualifiers are entered free by the server");
    const r1 = matchesOf(id).filter((m) => m.round === 1);
    const byes = r1.filter((m) => m.walkover && (m.seed_a ?? m.seed_b) !== null);
    check(r1.length === 16 && byes.length === 15 && byes.every((m) => (m.seed_a ?? m.seed_b ?? 99) <= 15), `byes: seeds 1–15 go through without playing (${byes.length})`);
    const played = r1.find((m) => !m.walkover)!;
    check(played.seed_a === 16 && played.seed_b === 17 && played.status === "playing", "16 v 17 is played");
    finish(played.duel_id!, [100, 100, 100], [100, 100, 100]);
    let t = day + 10_000;
    await advance(id, t);
    check(matchesOf(id).find((m) => m.round === 1 && !m.walkover)!.winner === A[15], "a level match goes to the higher seed (16)");
    // Rounds 2 (last 16) and 3 (quarter-finals): the higher seed wins each.
    for (const round of [2, 3]) {
      t += 70_000;
      await advance(id, t);
      check(matchesOf(id).filter((m) => m.round === round).every((m) => m.status === "playing"), `round ${round}'s rooms, a minute after the round before settles`);
      playRound(id, round);
      t += 10_000;
      await advance(id, t);
    }
    t += 70_000;
    await advance(id, t);
    const semis = matchesOf(id).filter((m) => m.round === 4);
    check(semis.length === 2 && semis.every((m) => m.status === "playing") && semis.map((m) => `${m.seed_a}v${m.seed_b}`).sort().join() === "1v4,2v3", `the semi-finals: 1 v 4 and 2 v 3 (${semis.map((m) => `${m.seed_a}v${m.seed_b}`).join(", ")})`);
    playRound(id, 4, (m) => m.seed_a === 2); // 4 beats 1, 2 beats 3
    t += 10_000;
    await advance(id, t);
    t += 70_000;
    await advance(id, t);
    const last = matchesOf(id).filter((m) => m.round === 5);
    const final = last.find((m) => m.stage === "knockout")!;
    const third = last.find((m) => m.stage === "third_place")!;
    check(!!final && !!third && [final.seed_a, final.seed_b].sort().join() === "2,4" && [third.seed_a, third.seed_b].sort().join() === "1,3", "the final (2 v 4) and the semi losers' third-place match (1 v 3)");
    finish(final.duel_id!, final.seed_a === 2 ? [150, 90, 150] : [90, 150, 90], final.seed_a === 2 ? [90, 150, 90] : [150, 90, 150]);
    // Seed 1 wins the third-place match on the board, but its run is flagged: seed 3 takes it, seed 1 places nowhere.
    const seed1Slot: 1 | 2 = third.seed_a === 1 ? 1 : 2;
    finish(third.duel_id!, seed1Slot === 1 ? [150, 150, 150] : [0, 0, 0], seed1Slot === 1 ? [0, 0, 0] : [150, 150, 150], seed1Slot);
    t += 10_000;
    await advance(id, t);
    check(eventRow(id)["status"] === "finished" && typeof roundsRow(id)?.["awarded_at"] === "string", "the Championship finishes and pays");
    const place = (u: string) => q(`SELECT coalesce((SELECT place::text FROM tournament_results WHERE event_id = '${id}' AND user_id = '${u}'), 'none')`);
    const places = A.map(place);
    check(places.join(" ") === ["none", "1", "3", "2", "5", "5", "5", "5", "9", "9", "9", "9", "9", "9", "9", "9", "17"].join(" "), `places: final winner 1st, loser 2nd, the third-place match's unflagged side 3rd, the flagged one none, quarter-final losers 5th, earlier losers 9th and 17th (${places.join(" ")})`);
    const balances = A.map((u) => balance(u));
    check(balances.join(" ") === [1000, 11250, 3500, 6000, 1500, 1500, 1500, 1500, ...Array(9).fill(1000)].join(" "), `prizes: 10,000 (+250 for the Legendary badge) / 5,000 / 2,500 / 500 for 5th–8th, none to the flagged or below 8th (${balances.join(" ")})`);
    check(q(`SELECT count(*) FROM player_badges WHERE badge = 'knockout-champion' AND user_id = '${A[1]}'`) === "1", "the Knockout Champion badge to the winner");
    check(q(`SELECT how FROM inventory_items WHERE user_id = '${A[1]}' AND item_id = 'frame.championship'`) === "earned", "the animated Championship frame to the winner");
    check(q(`SELECT user_id FROM tournament_hall_of_fame WHERE month = '2027-03'`) === A[1], "the winner joins the hall of fame");
    check(q(`SELECT string_agg(medal, ',' ORDER BY place) FROM tournament_trophies WHERE event_id = '${id}'`) === "gold,silver,bronze", "trophies to 1st–3rd");
    check(q(`SELECT count(*) FROM moderation.tournament_flags WHERE event_id = '${id}' AND player_id = '${A[0]}'`) === "1", "the flagged run is logged for review");
    await advance(id, t + 30_000);
    check(balance(A[1]!) === 11250 && q(`SELECT count(*) FROM inventory_items WHERE item_id = 'frame.championship'`) === "1" && q(`SELECT count(*) FROM tournament_awards WHERE event_id = '${id}' AND kind = 'frame'`) === "1", "paid once, and logged");
    await flushAnalytics();
    const playedN = q(`SELECT count(*) FROM analytics.events WHERE event = 'knockout_match_played'`);
    check(playedN === "17", `knockout_match_played for each played match (1 + 8 + 4 + 2 + 2), never a walkover (${playedN})`);
    const v = await flow.bigEventView(client, id, A[1]!);
    check(v?.bracket.length === 32 && v.bracket.some((b) => b.stage === "third_place"), `the live part draws the bracket and the third-place match (${v?.bracket.length})`);
    q(`SELECT public.economy_equip('${A[1]}', 'frame', 'frame.championship')`);
    const won = (await flow.bigEventView(client, id, A[0]!))?.bracket.find((b) => b.stage === "knockout" && b.round === 5);
    const champ = won?.winner === "a" ? won.playerA : won?.playerB;
    check(champ?.kind === "account" && champ.frame === "frame.championship" && !!won && [won.playerA, won.playerB].every((p) => p?.kind === "account"), `bracket rows carry both players' strips, the champion in the Championship frame (${champ?.frame})`);
    const byeRows = (await flow.bigEventView(client, id, A[0]!))?.bracket.filter((b) => b.walkover && b.round === 1) ?? [];
    check(byeRows.length === 15 && byeRows.every((b) => (b.playerA === null) !== (b.playerB === null)), "a bye's empty side has no strip");
  });

  await section("qualification", async () => {
    const id = "championship:2027-04";
    top = [GUEST, ...Q.slice(0, 66)];
    await ensure(id);
    await advance(id, Date.parse("2027-04-25T18:00:00Z"));
    const rr = roundsRow(id)!;
    const r1 = matchesOf(id).filter((m) => m.round === 1);
    check(rr["field"] === 64 && rr["bracket_size"] === 64 && rr["rounds_total"] === 6 && r1.length === 32 && r1.every((m) => !m.walkover), "the top 64 qualify: a full bracket of 32 first-round matches, no byes");
    check(q(`SELECT count(*) FROM tournament_seeds WHERE event_id = '${id}' AND user_id IN ('${Q[64]}', '${Q[65]}')`) === "0", "the 65th and 66th don't qualify");
    // 15 qualifiers (Joe, 11 Nov 2026): not held that month; nobody entered or paid, so nothing to refund.
    const may = "championship:2027-05";
    const fifteen = Q.slice(20, 35);
    top = [GUEST, ...fifteen];
    await ensure(may);
    await advance(may, Date.parse("2027-05-30T18:00:00Z"));
    check(eventRow(may)["status"] === "cancelled" && eventRow(may)["cancel_reason"] === "not_held", `15 qualifiers: not held (${eventRow(may)["status"]}, ${eventRow(may)["cancel_reason"]})`);
    check(q(`SELECT count(*) FROM tournament_entries WHERE event_id = '${may}'`) === "0" && q(`SELECT count(*) FROM tournament_seeds WHERE event_id = '${may}'`) === "0" && roundsRow(may) === null && fifteen.every((u) => balance(u) === 1000), "nobody entered, seeded or paid; nothing refunded");
    const view = await server.eventFor(client, fifteen[0]!, may, Date.parse("2027-05-30T18:01:00Z"), ON);
    check(view?.cancelReason === "not_held", "the Tournaments tab is told it wasn't held");
    // 16 qualifiers: held, a full bracket of 16.
    const aug = "championship:2027-08";
    top = Q.slice(20, 36);
    await ensure(aug);
    await advance(aug, Date.parse("2027-08-29T18:00:00Z"));
    const ra = roundsRow(aug);
    check(eventRow(aug)["status"] === "live" && ra?.["field"] === 16 && ra["bracket_size"] === 16 && matchesOf(aug).filter((m) => m.round === 1).every((m) => !m.walkover), "16 qualifiers: held, a bracket of 16 with no byes");
  });

  await section("real room", async () => {
    flow.setBigRoomMaker(null); // W3b's real dealt match room
    const id = "championship:2027-06";
    const day = Date.parse("2027-06-27T18:00:00Z");
    const x = Q[68]!;
    const kid = KID;
    const rest = Q.slice(50, 64);
    top = [x, kid, ...rest];
    await ensure(id);
    await advance(id, day);
    const r1 = matchesOf(id).filter((m) => m.round === 1);
    check(roundsRow(id)?.["bracket_size"] === 16 && r1.length === 8 && r1.every((m) => m.status === "playing" && !!m.duel_id), "16 qualifiers: eight first-round matches in real started rooms");
    const mine = r1.find((m) => m.player_a === x)!;
    const kids = r1.find((m) => m.player_a === kid)!;
    const room = JSON.parse(q(`SELECT row_to_json(d) FROM duels d WHERE id = '${mine.duel_id}'`)) as { status: string; round_count: number; host_user_id: string };
    const seated = q(`SELECT string_agg(user_id::text || ':' || player_slot, ',' ORDER BY player_slot) FROM duel_players WHERE duel_id = '${mine.duel_id}'`);
    check(room.status === "in_progress" && room.round_count === 3 && seated === `${x}:1,${rest[13]}:2`, `the room: started, three games, seed 1 v seed 16 seated (${room.status}, ${seated})`);
    check(q(`SELECT count(*) FROM mm_matches WHERE duel_id IN (${r1.map((m) => `'${m.duel_id}'`).join(", ")})`) === "0", "never a rated match");
    const kidChat = await tournamentChatText(client, kids.duel_id!, kid, "hello there", Date.now());
    const adultChat = await tournamentChatText(client, mine.duel_id!, x, "hello there", Date.now());
    check(kidChat?.ok === false && adultChat?.ok === true, "chat: quick phrases only for an under-18, an adult types");
    playRound(id, 1);
    const again = await callServerFn(duel.rematchFn, { roomId: mine.duel_id }, accountToken(room.host_user_id));
    check(again?.ok === false && again.message === BIG_EVENT_PLAY_AGAIN_LINE, `Play again is refused in a Championship room, with the event's own line (${JSON.stringify(again).slice(0, 90)})`);
    check(BIG_EVENT_PLAY_AGAIN_LINE === "Your next match opens when the round does.", "the line for a Cup or Championship room");
    let t = day + 10_000;
    await advance(id, t);
    check(matchesOf(id).filter((m) => m.round === 1).every((m) => m.status === "settled" && m.winner === m.player_a), "settled from the rooms' own grading: each higher seed through");
    flow.setBigRoomMaker(makeRoom); // the later rounds on stand-in rooms
    for (const round of [2, 3, 4]) {
      t += 70_000;
      await advance(id, t);
      playRound(id, round);
      t += 10_000;
      await advance(id, t);
    }
    check(eventRow(id)["status"] === "finished" && q(`SELECT user_id FROM tournament_hall_of_fame WHERE month = '2027-06'`) === x, "the winner takes the final");
    const hall = await flow.hallOfFame(client);
    check(hall.length === 2 && hall[0]!.month === "2027-06" && hall[1]!.month === "2027-03" && hall[0]!.label === "June 2027" && hall[0]!.name.startsWith("Player_"), `the hall of fame: every winner by month, newest first (${hall.map((h) => `${h.month} ${h.name}`).join("; ")})`);
    // Joe, 12 Nov 2026: an under-18 is "Hidden player" on every list other players can see, shown only to their direct
    // opponent in their own match (the your-match row, and the room) and to themself.
    const named = (v: Awaited<ReturnType<typeof flow.bigEventView>>) =>
      (v?.bracket ?? []).flatMap((b) => [b.playerA, b.playerB]).filter((p) => p?.name === "Kiddo_K").length;
    const hiddenIn = (v: Awaited<ReturnType<typeof flow.bigEventView>>) =>
      (v?.bracket ?? []).flatMap((b) => [b.playerA, b.playerB]).filter((p) => p?.kind === "hidden").length;
    const xView = await flow.bigEventView(client, id, x);
    const finalX = xView?.bracket.find((b) => b.stage === "knockout" && b.round === 4);
    check(named(xView) === 0 && hiddenIn(xView) >= 4 && [finalX?.playerA, finalX?.playerB].some((p) => p?.kind === "hidden" && p.avatar === null && p.frame === null && p.colour === -1), `the bracket hides the under-18 from other entrants, the final included (${named(xView)} named, ${hiddenIn(xView)} hidden)`);
    check(xView?.myMatch?.opponent === "Kiddo_K" && xView.myMatch.opponentPlayer?.kind === "account", `the direct opponent in their own match sees them (${xView?.myMatch?.opponent})`);
    const otherView = await flow.bigEventView(client, id, rest[0]!);
    check(named(otherView) === 0 && otherView?.myMatch?.opponent !== "Kiddo_K", "an entrant who never played them sees only Hidden player");
    const kidView = await flow.bigEventView(client, id, kid);
    check(named(kidView) === 4 && hiddenIn(kidView) === 0, `the under-18 sees their own name in the bracket (${named(kidView)})`);
    const roomName = q(`SELECT display_name FROM duel_players WHERE duel_id = (SELECT duel_id FROM tournament_matches WHERE event_id = '${id}' AND round = 1 AND (player_a = '${kid}' OR player_b = '${kid}')) AND user_id = '${kid}'`);
    check(roomName === "Kiddo_K", `the match room seats them by username, as in ordinary rooms (${roomName})`);
    // The hall of fame is open to anyone: an under-18 winner is a "Hidden player", no avatar, colour or cosmetics.
    await ensure("championship:2027-09");
    q(`INSERT INTO tournament_hall_of_fame (month, event_id, user_id) VALUES ('2027-09', 'championship:2027-09', '${kid}')`);
    const hall2 = await flow.hallOfFame(client);
    const hid = hall2.find((h) => h.month === "2027-09");
    check(hid?.name === "Hidden player" && hid.player.kind === "hidden" && hid.player.avatar === null && hid.player.frame === null && hid.player.colour === -1, `the hall of fame hides an under-18 winner (${JSON.stringify(hid?.player)})`);
    check(hall2.find((h) => h.month === "2027-06")?.player.kind === "account", "an adult winner keeps their strip in the hall of fame");
    q(`DELETE FROM tournament_hall_of_fame WHERE month = '2027-09'`);
    check(q(`SELECT count(*) FROM rated_matches`) === "0" && q(`SELECT count(*) FROM mm_matches`) === "0", "no rated match ever made (W3a's ratings and W3b's matches both empty)");
  });

  await section("guest", async () => {
    const out = await callServerFn(fns.bigEventFn, { eventId: CUP1 }, userToken(GUEST));
    check(out === null, "a guest gets nothing from the live part while it's off");
  });

  await section("analytics list", async () => {
    const def = q(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'analytics.events'::regclass AND conname = 'events_event_check'`);
    const { ANALYTICS_EVENTS } = await import("../src/lib/analytics/events");
    check(ANALYTICS_EVENTS.every((e) => def.includes(`'${e}'`)), "the table's list keeps every event (the new two added, none dropped)");
  });
}
