/**
 * Beta recording (16 Oct 2026, docs/beta-sql.md gaps G1–G4). Additive only:
 * nothing here changes a game, score, timing, input or replay. Proves:
 *
 *  - G1: Play again (restart_duel_room, migration 20261016130300) copies the
 *    room's round_results and its departed players into round_results_archive
 *    and duel_players_archive, tagged with the game index, before its deletes;
 *    the reset itself is unchanged, and a failed copy never fails Play again;
 *    the archive stores each round's effective time limit and version stamps
 *    (migration 20261016170000), by practice_plays' rule, from the
 *    duel_secrets.round_records startRoomFn writes at the deal;
 *  - G2: a graded practice play writes one practice_plays row (outcome only)
 *    from practiceGradeFn, with the caller's device id, and never throws or
 *    waits past the recording timeout;
 *  - G3: the round's start and its end reason (all answered vs the timer), and
 *    the game's start and end, are recorded once however many calls race;
 *  - G4: the join method (host, code, link, Play again) is recorded;
 *  - the new tables have RLS on and no client grants.
 *
 * TypeScript writes run against the in-memory store the other room checks use
 * (scripts/fixtures/memoryDb.ts) plus source wiring. The SQL runs for real on a
 * throwaway local PostgreSQL (every migration in order, on the Supabase stub
 * docs/beta-sql.md section 5 describes) when PostgreSQL's binaries are found
 * (/usr/lib/postgresql/<n>/bin, as on GitHub's Ubuntu runners); without them
 * that part prints a NOTE and only the SQL text is checked.
 *
 *   bun scripts/beta-recording-check.ts
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  RECORD_TIMEOUT_MS,
  gameIndexOf,
  joinViaFrom,
  practicePlayRow,
  recordJoin,
  recordPracticePlay,
  recordRoomEvent,
  recordRoundRecords,
  revisionStamps,
  roundRecords,
} from "../src/lib/duel/betaRecord.server";
import { puzzleTimeLimitMs, typeTimeLimitMs } from "../src/lib/duel/registry";
import { finishGame, leaveBetweenRoundScreen, setPhase } from "../src/lib/duel/roomPhase.server";
import type { DuelPlayerRow } from "../src/lib/duel/types";
import { memoryDb } from "./fixtures/memoryDb";

let passes = 0;
let failures = 0;
function check(ok: boolean, message: string) {
  if (ok) passes++;
  else {
    failures++;
    console.log(`  FAIL ${message}`);
  }
}

const EVENT_KEY = ["duel_id", "game_index", "round_number", "event"];
const quiet = console.warn;
const warnings: string[] = [];
console.warn = (...args: unknown[]) => void warnings.push(args.map(String).join(" "));

/* ---------------- G3: round and game events, once each ---------------- */
function store(phase: string, extra: Record<string, unknown> = {}) {
  return memoryDb(
    {
      duels: [
        {
          id: "room",
          status: "in_progress",
          current_round: 3,
          phase,
          phase_started_at: "2026-10-16T12:00:00.000Z",
          round_count: 6,
          disbanded_at: null,
          tournament_history: [{ winner: "Ana" }, { winner: "Ben" }],
          ...extra,
        },
      ],
      duel_players: [],
    },
    { unique: { room_events: EVENT_KEY } },
  );
}
const events = (db: ReturnType<typeof store>) =>
  (db.tables["room_events"] ?? []) as Record<string, unknown>[];

{
  // A burst of phones and timers closing round 3: the room moves once, the event lands once.
  const db = store("puzzle");
  const stamps = await Promise.all(
    [0, 1, 2, 3].map(() => setPhase(db.client, "room", 3, "puzzle", "reveal")),
  );
  check(
    stamps.filter(Boolean).length === 1,
    `setPhase: exactly one racing call moved the room (${stamps.filter(Boolean).length})`,
  );
  check(
    (await setPhase(db.client, "room", 3, "puzzle", "reveal")) === null,
    "setPhase: a stale call returns null",
  );
  check(db.tables["duels"]![0]!["phase"] === "reveal", "setPhase: the room is in the reveal");
  for (const reason of ["all_answered", "timer", "all_answered"] as const)
    await recordRoomEvent(db.client, {
      duel_id: "room",
      game_index: 2,
      round_number: 3,
      event: "round_ended",
      reason,
    });
  check(
    events(db).length === 1 && events(db)[0]!["reason"] === "all_answered",
    "round_ended: recorded once, the first reason kept (later racers hit the unique key quietly)",
  );
  check(
    !warnings.some((w) => /room_events/.test(w)),
    "round_ended: duplicates are not logged as failures",
  );
}

{
  // The winner reveal ends the game (completed), once, tagged with the game index.
  const db = store("result", { current_round: 6 });
  const room = {
    id: "room",
    phase: "result" as const,
    round_count: 6,
    tournament_history: [{}, {}] as never,
  };
  await Promise.all([0, 1, 2].map(() => leaveBetweenRoundScreen(db.client, room, 6)));
  const ended = events(db).filter((e) => e["event"] === "game_ended");
  check(
    db.tables["duels"]![0]!["phase"] === "winner_reveal",
    "game end: the room reached the winner reveal",
  );
  check(
    ended.length === 1 &&
      ended[0]!["reason"] === "completed" &&
      ended[0]!["game_index"] === 2 &&
      ended[0]!["round_number"] === 0,
    `game end: one game_ended 'completed' for game 2 (${JSON.stringify(ended)})`,
  );
  // A mid-game result → standings move records nothing.
  const mid = store("result");
  await leaveBetweenRoundScreen(mid.client, { id: "room", phase: "result", round_count: 6 }, 3);
  check(events(mid).length === 0, "game end: a mid-game standings move records nothing");
  // Older rooms that end on the last standings.
  const old = store("standings", { current_round: 6 });
  await leaveBetweenRoundScreen(old.client, { id: "room", phase: "standings", round_count: 6 }, 6);
  check(
    events(old).length === 1 &&
      events(old)[0]!["reason"] === "completed" &&
      events(old)[0]!["game_index"] === 0,
    "game end: older rooms ending on the last standings record 'completed' once",
  );
}

{
  // Finish now: one game_ended 'finish_now'; a refused finish records nothing.
  const now = Date.parse("2026-10-16T12:00:00Z");
  const player = (slot: number, seenAgo: number): DuelPlayerRow => ({
    id: `p${slot}`,
    duel_id: "room",
    player_slot: slot,
    display_name: `P${slot}`,
    user_id: `u${slot}`,
    ready_round: 0,
    intro_ready_round: 0,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: new Date(now - seenAgo).toISOString(),
    status: "active",
    joined_at: new Date(now - 600_000).toISOString(),
  });
  const alone = [player(1, 1_000), player(2, 600_000)];
  const db = store("puzzle");
  db.tables["duel_players"] = alone.map((p) => ({ ...p }));
  const room = {
    id: "room",
    status: "in_progress" as const,
    phase: "puzzle" as const,
    current_round: 3,
    disbanded_at: null,
    tournament_history: [{}] as never,
  };
  await Promise.all([0, 1].map(() => finishGame(db.client, room, alone, "u1", now)));
  const ended = events(db);
  check(
    ended.length === 1 && ended[0]!["reason"] === "finish_now" && ended[0]!["game_index"] === 1,
    "Finish now: one game_ended 'finish_now'",
  );
  const refused = store("puzzle");
  await finishGame(refused.client, room, [player(1, 1_000), player(2, 1_000)], "u1", now);
  check(events(refused).length === 0, "Finish now: a refused finish records nothing");
}

check(
  gameIndexOf({ tournament_history: [] }) === 0 &&
    gameIndexOf({ tournament_history: [{}, {}, {}] }) === 3 &&
    gameIndexOf({}) === 0,
  "game index: the Play again count (0 for the first game)",
);

/* ---------------- G3/G4 wiring in the room server functions ---------------- */
const server = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
const slice = (from: string, to: string) => server.slice(server.indexOf(from), server.indexOf(to));
const advance = slice("export const advancePhaseFn", "export type { SubmitExtra }");
const intro = advance.slice(
  advance.indexOf('if (room.phase === "intro")'),
  advance.indexOf('if (room.phase === "puzzle")'),
);
const puzzleBranch = advance.slice(
  advance.indexOf('if (room.phase === "puzzle")'),
  advance.indexOf('if (room.phase === "reveal")'),
);
check(
  /const at = await setPhase\(client, room\.id, round, "intro", "puzzle"\);\s*if \(at\)\s*await recordRoomEvent\([\s\S]*event: "round_started",\s*at,/.test(
    intro,
  ),
  "wiring: the clock's start (intro → puzzle) records round_started once, at the phase's own stamp",
);
check(
  /const allIn = waitingOn\.length > 0 && answered >= waitingOn\.length;\s*const timeUp = elapsed > puzzleDurationMs\(puzzle\) \+ 800;\s*if \(allIn \|\| timeUp\) \{\s*const at = await setPhase\(client, room\.id, round, "puzzle", "reveal"\);\s*if \(at\)\s*await recordRoomEvent\([\s\S]*event: "round_ended",\s*reason: allIn \? "all_answered" : "timer",/.test(
    puzzleBranch,
  ),
  "wiring: advancePhaseFn closes the round as before and records 'all_answered' or 'timer' from the branch that closed it",
);
const submit = slice("export const submitAnswerFn", "export const readyUpFn");
check(
  /if \(answered >= waitingOn\) \{\s*const at = await setPhase\(client, room\.id, data\.roundNumber, "puzzle", "reveal"\);\s*if \(at\)\s*await recordRoomEvent\([\s\S]*reason: "all_answered",/.test(
    submit,
  ),
  "wiring: the last answer closing the round records 'all_answered'",
);
check(
  submit.indexOf("recordRoomEvent") > submit.indexOf('from("round_results").insert'),
  "wiring: the event is written after the answer is stored, never before",
);
const start = slice("export const startRoomFn", "export const setRoomModesFn");
check(
  /if \(claimed\) \{[\s\S]*duel_secrets[\s\S]*recordRoomEvent\(client, \{[\s\S]*event: "game_started",\s*at: startedAt,/.test(
    start,
  ),
  "wiring: the host's claimed start records game_started at the stored start stamp",
);
check(
  /if \(claimed\) \{[\s\S]*from\("duel_secrets"\)\.upsert[\s\S]*if \(error\) throw[\s\S]*await recordRoundRecords\(\s*client,\s*room\.id,\s*roundRecords\(puzzles[\s\S]*puzzleTimeLimitMs\(/.test(
    start,
  ),
  "wiring: the claimed start stores every dealt round's record (puzzleTimeLimitMs, as practice) after the secrets",
);
const leave = slice("export const leaveRoomFn", "export const disbandRoomFn");
const disband = slice("export const disbandRoomFn", "export const checkHostPresenceFn");
check(
  /if \(room\.status === "in_progress"\)\s*await recordRoomEvent\([\s\S]*reason: "host_left"/.test(
    leave,
  ),
  "wiring: a host leaving mid-game records game_ended 'host_left'",
);
check(
  /if \(room\.status === "in_progress"\)\s*await recordRoomEvent\([\s\S]*reason: "disbanded"/.test(
    disband,
  ),
  "wiring: disbanding mid-game records game_ended 'disbanded'",
);

const create = server.slice(
  server.indexOf("async function createRoomRow"),
  server.indexOf("/** How many answers are in for a round. */"),
);
check(
  /await insertPlayer\(client, room\.id, 1, userId, displayName(?:, look)?\);\s*await recordJoin\(client, \{[^}]*via: "host" \}\);/.test(
    create,
  ),
  "wiring: the room's creator is recorded as joining by 'host'",
);
const joinFn = slice("export const joinRoomFn", "/** Host only: generates the rounds");
check(
  /withinRateLimit\(client, context\.userId, ROOM_LOOKUP_LIMIT\)[\s\S]*const via = joinViaFrom\(data\.via\);/.test(
    joinFn,
  ),
  "wiring: joinRoomFn keeps its room-lookup rate limit first, then reads the join method",
);
check(
  /await insertPlayer\(client, room\.id, slot, context\.userId, data\.displayName(?:, data\.look \?\? \{\})?\);\s*await recordJoin\(client, \{[\s\S]*via,\s*\}\);/.test(
    joinFn,
  ),
  "wiring: a new player's join records its method",
);
check(
  /update\(\{ status: "active" \}\)\.eq\("id", mine\.id\);\s*await recordJoin\(client, \{[\s\S]*rejoin: true,/.test(
    joinFn,
  ),
  "wiring: a lobby rejoin is recorded as a rejoin",
);
const preview = slice("export const roomPreviewFn", "export const joinRoomFn");
const createFn = slice("export const createRoomFn", "export const roomPreviewFn");
check(
  /withinRateLimit\(client, context\.userId, ROOM_LOOKUP_LIMIT\)/.test(preview) &&
    /withinRateLimit\(client, context\.userId, CREATE_ROOM_LIMIT\)/.test(createFn),
  "wiring: the #86 rate limits on room creation and code lookups are still in place",
);
check(
  /await joinRoomByCode\(code\.trim\(\)\.toUpperCase\(\), trimmed, "code"\)/.test(
    readFileSync("src/routes/index.tsx", "utf8"),
  ),
  "wiring: the home screen's code boxes join with via 'code'",
);
check(
  /await joinRoomByCode\(roomCode, trimmed, "link"\)/.test(
    readFileSync("src/components/duel/JoinFromLink.tsx", "utf8"),
  ),
  "wiring: the room link's join card joins with via 'link'",
);
check(
  /joinRoomFn\(\{\s*data: \{ roomCode, displayName, (?:look: rememberedLook\(\), )?\.\.\.\(via \? \{ via \} : \{\}\) \},?\s*\}\)/.test(
    readFileSync("src/lib/duel/api.ts", "utf8"),
  ),
  "wiring: api.ts passes the method through",
);
check(
  joinViaFrom("code") === "code" &&
    joinViaFrom("link") === "link" &&
    joinViaFrom("host") === null &&
    joinViaFrom(undefined) === null &&
    joinViaFrom("x'; drop") === null,
  "join method: only 'code' and 'link' are taken from the phone (anything else is stored as unknown)",
);
{
  const db = memoryDb({});
  await recordJoin(db.client, {
    duel_id: "room",
    user_id: "u2",
    player_slot: 2,
    game_index: 1,
    via: "link",
  });
  const row = db.tables["room_joins"]?.[0];
  check(
    row?.["via"] === "link" && row?.["rejoin"] === false && row?.["game_index"] === 1,
    "room_joins: a join writes one row with its method and game",
  );
}

/* ---------------- G2: practice plays ---------------- */
{
  const puzzle = {
    type: "breaker",
    seed: 7,
    brkRev: 6,
    speedPar: 1,
    tieRev: 1,
    bombVersion: 3,
    answerWord: "secret",
    timeLimitMs: 93_000,
  };
  check(
    JSON.stringify(revisionStamps(puzzle)) ===
      JSON.stringify({ brkRev: 6, speedPar: 1, tieRev: 1, bombVersion: 3 }),
    "practice: revision keeps the numeric stamps only (no seed, answer or limit)",
  );
  const arcade = practicePlayRow({
    userId: "dev-1",
    puzzle,
    example: false,
    claimedMsRemaining: 0,
    timeLimitMs: 93_000,
    graded: {
      score: 812.4,
      isCorrect: true,
      storedMs: 0,
      extra: { endedSeconds: 61.5, flagged: false },
    },
  });
  check(
    arcade.user_id === "dev-1" &&
      arcade.game_id === "breaker" &&
      arcade.score === 812 &&
      arcade.timed_out &&
      arcade.duration_ms === 61_500 &&
      arcade.time_limit_ms === 93_000 &&
      !arcade.flagged &&
      !arcade.example,
    `practice: an arcade run's row (${JSON.stringify(arcade)})`,
  );
  check(
    !Object.keys(arcade).some((k) => /answer|seed|sealed|extra/.test(k)) &&
      !JSON.stringify(arcade).includes("secret"),
    "practice: the row holds no answer, seed or puzzle content",
  );
  const solved = practicePlayRow({
    userId: null,
    puzzle: { type: "sudoku", sudokuRev: 1 },
    example: true,
    claimedMsRemaining: 52_000,
    timeLimitMs: 90_000,
    graded: { score: 640, isCorrect: true, storedMs: 52_000, extra: null },
  });
  check(
    !solved.timed_out &&
      solved.duration_ms === 38_000 &&
      solved.ms_remaining === 52_000 &&
      solved.example &&
      solved.user_id === null,
    "practice: a solve with time left is not a timeout and its duration is the time used",
  );
  const wild = practicePlayRow({
    userId: "d",
    puzzle: { type: "sudoku" },
    example: false,
    claimedMsRemaining: 999_999,
    timeLimitMs: 90_000,
    graded: { score: 0, isCorrect: false, storedMs: 0, extra: null },
  });
  check(
    wild.duration_ms === 0 && !wild.timed_out,
    "practice: an impossible time claim is held to the clock",
  );

  const db = memoryDb({});
  await recordPracticePlay(
    db.client,
    (userId) => ({ ...arcade, user_id: userId }),
    async () => "device-42",
  );
  check(
    db.tables["practice_plays"]?.length === 1 &&
      db.tables["practice_plays"]![0]!["user_id"] === "device-42",
    "practice: one graded play writes one practice_plays row with the caller's device id",
  );

  // Failures never reach the player.
  const broken = {
    from: () => ({
      insert: () => {
        throw new Error('relation "practice_plays" does not exist');
      },
    }),
  };
  let threw = false;
  try {
    await recordPracticePlay(
      broken,
      () => arcade,
      async () => "d",
    );
    await recordRoomEvent(broken, {
      duel_id: "r",
      game_index: 0,
      round_number: 1,
      event: "round_started",
    });
    await recordJoin(broken, {
      duel_id: "r",
      user_id: "u",
      player_slot: 1,
      game_index: 0,
      via: "code",
    });
  } catch {
    threw = true;
  }
  check(
    !threw && warnings.filter((w) => /does not exist/.test(w)).length === 3,
    "best-effort: a missing table is logged and play carries on",
  );
  const erroring = {
    from: () => ({
      insert: async () => ({ error: { code: "42501", message: "permission denied" } }),
    }),
  };
  await recordRoomEvent(erroring, {
    duel_id: "r",
    game_index: 0,
    round_number: 1,
    event: "round_started",
  });
  check(
    warnings.some((w) => /permission denied/.test(w)),
    "best-effort: a database error is logged, not thrown",
  );
  const hanging = { from: () => ({ insert: () => new Promise(() => {}) }) };
  const t0 = Date.now();
  await recordPracticePlay(
    hanging,
    () => arcade,
    async () => "d",
  );
  const waited = Date.now() - t0;
  check(
    waited >= RECORD_TIMEOUT_MS - 50 &&
      waited < RECORD_TIMEOUT_MS + 500 &&
      warnings.some((w) => /gave up/.test(w)),
    `best-effort: a hung write is abandoned after ${RECORD_TIMEOUT_MS} ms (${waited} ms)`,
  );
  const slowAuth = Date.now();
  await recordPracticePlay(
    memoryDb({}).client,
    () => arcade,
    () => new Promise(() => {}),
  );
  check(
    Date.now() - slowAuth < RECORD_TIMEOUT_MS + 500,
    "best-effort: a hung identity lookup is abandoned inside the same window",
  );
}
const practice = readFileSync("src/lib/duel/practice.functions.ts", "utf8");
const grade = practice.slice(
  practice.indexOf("export const practiceGradeFn"),
  practice.indexOf("export const practiceCheckWordFn"),
);
check(
  /const graded = gradeAnswer\(puzzle, data\.answer, data\.msRemaining, data\.extra\);[\s\S]*await recordPracticePlay\(supabaseAdmin, \(userId\) =>\s*practicePlayRow\(\{[\s\S]*claimedMsRemaining: data\.msRemaining,[\s\S]*graded,[\s\S]*\}\)[\s\S]*return \{\s*puzzle,\s*isCorrect: graded\.isCorrect,\s*score: graded\.score,/.test(
    grade,
  ),
  "wiring: practiceGradeFn grades exactly as before, then records the play, then returns the same result",
);
check(
  !/requireSupabaseAuth/.test(grade) &&
    /callerUserId/.test(readFileSync("src/lib/duel/betaRecord.server.ts", "utf8")),
  "wiring: practice stays open without a session (the device id is read from the bearer token if there is one)",
);

/* ---------------- G1: each round's effective limit and stamps ---------------- */
{
  const own = { type: "breaker", brkRev: 6, speedPar: 1, seed: 3, timeLimitMs: 120_000 };
  const plain = { type: "sudoku", sudokuRev: 1, speedPar: 1, answer: "secret" };
  const limit = (p: Record<string, unknown> & { type: string }) => puzzleTimeLimitMs(p as never);
  const rounds = roundRecords([own, plain], limit);
  check(
    typeTimeLimitMs("sudoku") > 0 && rounds[1]!.time_limit_ms === typeTimeLimitMs("sudoku"),
    `rounds: a round without its own limit records its game's default (${rounds[1]!.time_limit_ms})`,
  );
  check(rounds[0]!.time_limit_ms === 120_000, "rounds: a round's own timeLimitMs wins");
  for (const [i, puzzle] of [own, plain].entries()) {
    const practice = practicePlayRow({
      userId: null,
      puzzle,
      example: false,
      claimedMsRemaining: 0,
      timeLimitMs: puzzleTimeLimitMs(puzzle as never),
      graded: { score: 0, isCorrect: false, storedMs: 0 },
    });
    check(
      practice.time_limit_ms === rounds[i]!.time_limit_ms &&
        JSON.stringify(practice.revision) === JSON.stringify(rounds[i]!.revision),
      `rounds: ${puzzle.type}'s record matches the practice_plays row for the same puzzle (${JSON.stringify(rounds[i])})`,
    );
  }
  check(
    !JSON.stringify(rounds).includes("secret") && !JSON.stringify(rounds).includes("seed"),
    "rounds: the records hold no answer or seed",
  );

  const db = memoryDb({ duel_secrets: [{ duel_id: "room", puzzles_private: [] }] });
  await recordRoundRecords(db.client, "room", rounds);
  check(
    JSON.stringify(db.tables["duel_secrets"]![0]!["round_records"]) === JSON.stringify(rounds),
    "rounds: stored on the room's duel_secrets row",
  );
  let threw = false;
  const before = warnings.length;
  try {
    await recordRoundRecords(
      {
        from: () => ({
          update: () => ({
            eq: async () => ({ error: { message: 'column "round_records" does not exist' } }),
          }),
        }),
      },
      "room",
      rounds,
    );
  } catch {
    threw = true;
  }
  check(
    !threw && warnings.slice(before).some((w) => /round_records/.test(w)),
    "rounds: a missing column is logged, never thrown into the room's start",
  );
}

/* ---------------- G1 SQL: archive before delete (text) ---------------- */
const migrations = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort();
const ours = [
  "20261016130000_beta_room_joins.sql",
  "20261016130100_beta_room_events.sql",
  "20261016130200_beta_practice_plays.sql",
  "20261016130300_beta_play_again_archive.sql",
  "20261016170000_beta_archive_round_records.sql",
];
check(
  ours.every((f) => migrations.includes(f)) &&
    ours.every((f) => f > "20261016120000_rate_limits.sql"),
  "migrations: the five beta migrations exist and sort after the rate-limit migration",
);
const restartDefs = migrations.filter((f) =>
  /FUNCTION public\.restart_duel_room/.test(readFileSync(`supabase/migrations/${f}`, "utf8")),
);
check(
  restartDefs.at(-1) === "20261016170000_beta_archive_round_records.sql" &&
    restartDefs.at(-2) === "20261016130300_beta_play_again_archive.sql",
  `migrations: the round-records fix-up is restart_duel_room's latest definition, after the archive (${restartDefs.slice(-2)})`,
);
const archiveSql = readFileSync(`supabase/migrations/${restartDefs.at(-1)}`, "utf8");
const body = archiveSql.slice(
  archiveSql.indexOf("CREATE OR REPLACE FUNCTION public.restart_duel_room"),
);
const at = (needle: string) => body.indexOf(needle);
check(
  at("INSERT INTO public.round_results_archive") > 0 &&
    at("INSERT INTO public.round_results_archive") < at("DELETE FROM public.round_results"),
  "SQL: round_results are archived before they are deleted",
);
check(
  at("INSERT INTO public.duel_players_archive") > 0 &&
    at("INSERT INTO public.duel_players_archive") < at("DELETE FROM public.duel_players"),
  "SQL: departed players are archived before they are deleted",
);
const previous = readFileSync(`supabase/migrations/${restartDefs.at(-2)}`, "utf8");
const norm = (sql: string) =>
  sql
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([(),=<>|'])\s*/g, "$1")
    .trim();
for (const statement of [
  "DELETE FROM public.round_results WHERE duel_id=p_room_id",
  "DELETE FROM public.duel_secrets WHERE duel_id=p_room_id",
  "DELETE FROM public.duel_players WHERE duel_id=p_room_id AND status='left'",
  "UPDATE public.duel_players SET status='active',ready_round=0,intro_ready_round=0 WHERE duel_id=p_room_id",
  "ORDER BY points DESC,p.player_slot LIMIT 1",
])
  check(
    norm(previous).includes(statement) && norm(body).includes(statement),
    `SQL: unchanged from the previous definition: ${statement}`,
  );
{
  // The fix-up changes only what the archive insert stores; the rest of the function is the same.
  const prevBody = previous.slice(
    previous.indexOf("CREATE OR REPLACE FUNCTION public.restart_duel_room"),
  );
  const between = (sql: string, from: string, to: string) =>
    norm(sql.slice(sql.indexOf(from), to ? sql.indexOf(to) : undefined));
  for (const [from, to] of [
    ["SELECT * INTO v_room", "v_game_index :="],
    ["INSERT INTO public.duel_players_archive", ""],
  ] as const)
    check(
      between(body, from, to) === between(prevBody, from, to) && between(body, from, to) !== "",
      `SQL: restart_duel_room unchanged from the previous definition from "${from}"${to ? ` to "${to}"` : " to the end"}`,
    );
}
for (const sql of ours.map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))) {
  for (const table of [...sql.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].map(
    (m) => m[1]!,
  ))
    check(
      new RegExp(`REVOKE ALL ON public\\.${table} FROM PUBLIC, anon, authenticated;`).test(sql) &&
        new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`).test(sql) &&
        !new RegExp(`CREATE POLICY[^;]*${table}`).test(sql) &&
        !new RegExp(`GRANT [^;]*ON public\\.${table} TO (anon|authenticated)`).test(sql),
      `SQL: ${table} has RLS on, no policies and no client grants`,
    );
}

/* ---------------- G1–G4 SQL, run for real ---------------- */
function postgresBin(): string | null {
  const roots = ["/usr/lib/postgresql"];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const version of readdirSync(root).sort().reverse()) {
      const bin = join(root, version, "bin");
      if (
        existsSync(join(bin, "initdb")) &&
        existsSync(join(bin, "pg_ctl")) &&
        existsSync(join(bin, "psql"))
      )
        return bin;
    }
  }
  return null;
}

const bin = postgresBin();
if (!bin) {
  console.log("  NOTE no PostgreSQL binaries found: the SQL was checked as text only");
} else {
  const dir = mkdtempSync(join(tmpdir(), "beta-recording-"));
  chmodSync(dir, 0o777);
  const asRoot = process.getuid?.() === 0;
  const run = (cmd: string, args: string[]) =>
    asRoot
      ? spawnSync("runuser", ["-u", "postgres", "--", cmd, ...args], { encoding: "utf8" })
      : spawnSync(cmd, args, { encoding: "utf8" });
  const data = join(dir, "data");
  let started = false;
  try {
    const init = run(join(bin, "initdb"), ["-D", data, "-A", "trust", "-U", "postgres"]);
    if (init.status !== 0) throw new Error(`initdb: ${init.stderr}`);
    const up = run(join(bin, "pg_ctl"), [
      "-D",
      data,
      "-o",
      `-k ${dir} -c listen_addresses='' -c fsync=off`,
      "-l",
      join(dir, "log"),
      "-w",
      "start",
    ]);
    if (up.status !== 0) throw new Error(`pg_ctl: ${up.stderr}${up.stdout}`);
    started = true;
    const psql = (sql: string, user = "postgres") => {
      const file = join(dir, "q.sql");
      writeFileSync(file, sql);
      const out = spawnSync(
        join(bin, "psql"),
        [
          "-h",
          dir,
          "-U",
          user,
          "-d",
          "postgres",
          "-X",
          "-q",
          "-tA",
          "-v",
          "ON_ERROR_STOP=1",
          "-f",
          file,
        ],
        { encoding: "utf8" },
      );
      return {
        ok: out.status === 0,
        out: (out.stdout ?? "").trim(),
        err: (out.stderr ?? "").trim(),
      };
    };
    const stub = psql(`
      CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE ROLE client_probe LOGIN IN ROLE anon, authenticated;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, created_at timestamptz DEFAULT now(), last_sign_in_at timestamptz, is_anonymous boolean DEFAULT true);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      SET client_min_messages = error; CREATE PUBLICATION supabase_realtime;`);
    if (!stub.ok) throw new Error(`stub: ${stub.err}`);
    let applied = 0;
    for (const file of migrations) {
      const out = psql(readFileSync(`supabase/migrations/${file}`, "utf8"));
      check(
        out.ok,
        `SQL: migration ${file} applies (${out.err.split("\n").find((l) => /ERROR/.test(l)) ?? ""})`,
      );
      if (!out.ok) break;
      applied++;
    }
    console.log(
      `  applied ${applied}/${migrations.length} migrations to a local PostgreSQL (${bin})`,
    );

    // Every source column has a home in the archive.
    const cols = (table: string) =>
      psql(
        `SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}'`,
      ).out.split(",");
    for (const [source, archive] of [
      ["round_results", "round_results_archive"],
      ["duel_players", "duel_players_archive"],
    ] as const) {
      const missing = cols(source).filter(
        (c) =>
          !cols(archive).includes(c) &&
          // Display-only player fields stay out of the archive: the last reaction time, and the
          // player colour and icon (20261017120000_player_colour_icon.sql).
          !(source === "duel_players" && ["last_reaction_at", "colour", "icon"].includes(c)),
      );
      check(
        missing.length === 0,
        `SQL: ${archive} keeps every ${source} column (${missing.join(", ") || "all"})`,
      );
    }

    const ROOM = "11111111-1111-1111-1111-111111111111";
    const HOST = "a0000000-0000-0000-0000-000000000001";
    const STAY = "a0000000-0000-0000-0000-000000000002";
    const GONE = "a0000000-0000-0000-0000-000000000003";
    const playGame = (order: string[], roundRecords?: unknown[]) =>
      psql(`
      UPDATE public.duels SET status = 'finished', phase = 'winner_reveal', current_round = ${order.length}, round_count = ${order.length},
        round_order = '${JSON.stringify(order)}'::jsonb,
        puzzles_public = '${JSON.stringify(order.map((type, i) => (i === 0 ? { type, timeLimitMs: 120000 } : { type })))}'::jsonb
      WHERE id = '${ROOM}';
      INSERT INTO public.duel_secrets (duel_id, puzzles_private, round_records)
        VALUES ('${ROOM}', '[]'::jsonb, ${roundRecords ? `'${JSON.stringify(roundRecords)}'::jsonb` : "NULL"})
        ON CONFLICT (duel_id) DO NOTHING;
      INSERT INTO public.round_results (duel_id, player_slot, round_number, score, is_correct, ms_remaining, extra)
      SELECT '${ROOM}', slot, round, 100 * slot + round, true, 1000 * round, '{"flagged": false}'::jsonb
      FROM generate_series(1, 3) slot, generate_series(1, ${order.length}) round;`);
    const setup = psql(`
      INSERT INTO public.duels (id, room_code, status, host_user_id, round_order) VALUES ('${ROOM}', 'BETA', 'waiting', '${HOST}', '[]'::jsonb);
      INSERT INTO public.duel_players (duel_id, player_slot, user_id, display_name, status) VALUES
        ('${ROOM}', 1, '${HOST}', 'Host', 'active'), ('${ROOM}', 2, '${STAY}', 'Stay', 'active'), ('${ROOM}', 3, '${GONE}', 'Gone', 'left');`);
    check(setup.ok, `SQL: test room set up (${setup.err})`);
    const game1 = playGame(
      ["wordsmith", "breaker"],
      [
        { time_limit_ms: 120000, revision: { speedPar: 1 } },
        { time_limit_ms: 93000, revision: { brkRev: 6 } },
      ],
    );
    check(game1.ok, `SQL: game 1 played (${game1.err})`);
    const before = psql(`SELECT count(*) FROM public.round_results WHERE duel_id = '${ROOM}'`).out;
    const restarted = psql(`SELECT public.restart_duel_room('${ROOM}', '${HOST}')`);
    check(
      restarted.ok && restarted.out === "t",
      `SQL: Play again succeeds (${restarted.out} ${restarted.err})`,
    );
    check(
      !/WARNING/.test(restarted.err),
      `SQL: Play again archived without a warning (${restarted.err})`,
    );
    const archived =
      psql(`SELECT count(*), count(DISTINCT round_number), min(game_index), max(game_index),
        string_agg(DISTINCT game_id, ',' ORDER BY game_id), max(time_limit_ms) FILTER (WHERE round_number = 1),
        count(*) FILTER (WHERE user_id = '${GONE}'), sum(score), bool_and(extra = '{"flagged": false}'::jsonb)
      FROM public.round_results_archive WHERE duel_id = '${ROOM}'`).out;
    check(
      before === "6" &&
        archived === `6|2|0|0|breaker,wordsmith|120000|2|${(100 + 200 + 300) * 2 + 3 * 3}|t`,
      `SQL: game 1's 6 answers archived as game 0 with game ids, the puzzle's own limit, device ids, scores and extras (${archived})`,
    );
    const limits = psql(
      `SELECT string_agg(DISTINCT round_number || ':' || time_limit_ms || ':' || revision::text, ',') FROM public.round_results_archive WHERE duel_id = '${ROOM}'`,
    ).out;
    check(
      limits === '1:120000:{"speedPar": 1},2:93000:{"brkRev": 6}',
      `SQL: each archived round carries the limit it used (the game default too) and its stamps (${limits})`,
    );
    check(
      psql(`SELECT count(*) FROM public.round_results WHERE duel_id = '${ROOM}'`).out === "0",
      "SQL: round_results are still cleared by Play again",
    );
    const playersArchived = psql(
      `SELECT count(*), max(user_id::text), max(status), max(game_index), max(display_name) FROM public.duel_players_archive WHERE duel_id = '${ROOM}'`,
    ).out;
    check(
      playersArchived === `1|${GONE}|left|0|Gone`,
      `SQL: the departed player is archived for game 0 (${playersArchived})`,
    );
    check(
      psql(`SELECT count(*) FROM public.duel_players WHERE duel_id = '${ROOM}'`).out === "2",
      "SQL: the departed player is still removed from the room",
    );
    const room = psql(
      `SELECT status, current_round, round_order, jsonb_array_length(tournament_history), tournament_history -> 0 ->> 'winner' FROM public.duels WHERE id = '${ROOM}'`,
    ).out;
    check(
      room === "waiting|0|[]|1|Gone",
      `SQL: the reset and its history entry are unchanged (${room})`,
    );
    const joins = psql(
      `SELECT string_agg(user_id::text || ':' || via || ':' || game_index, ',' ORDER BY player_slot) FROM public.room_joins WHERE duel_id = '${ROOM}'`,
    ).out;
    check(
      joins === `${HOST}:play_again:1,${STAY}:play_again:1`,
      `SQL: the two players carried over are recorded as joining game 1 by Play again (${joins})`,
    );

    // A second Play again archives game 1 under its own index.
    psql(
      `UPDATE public.duel_players SET status = 'left' WHERE duel_id = '${ROOM}' AND player_slot = 2`,
    );
    playGame(["tilt", "breaker"]); // dealt without round records (a room started before the fix-up)
    psql(`SELECT public.restart_duel_room('${ROOM}', '${HOST}')`);
    const second = psql(
      `SELECT game_index, count(*), string_agg(DISTINCT game_id, ',') FROM public.round_results_archive WHERE duel_id = '${ROOM}' GROUP BY game_index ORDER BY game_index`,
    ).out;
    const legacy = psql(
      `SELECT count(*), count(time_limit_ms), count(revision), max(time_limit_ms) FROM public.round_results_archive WHERE duel_id = '${ROOM}' AND game_index = 1`,
    ).out;
    check(
      legacy === "6|3|0|120000",
      `SQL: a room dealt without round records keeps the old rule (own timeLimitMs, else null; revision null) (${legacy})`,
    );
    check(
      second === "0|6|breaker,wordsmith\n1|6|breaker,tilt",
      `SQL: the second Play again archives game 1 separately (${second.replace("\n", " / ")})`,
    );
    check(
      psql(
        `SELECT count(*) FROM public.duel_players_archive WHERE duel_id = '${ROOM}' AND game_index = 1 AND user_id = '${STAY}'`,
      ).out === "1",
      "SQL: a player who left in game 1 is archived for game 1",
    );

    // Refused Play again (not the host / not finished) archives nothing.
    const refused = psql(
      `SELECT public.restart_duel_room('${ROOM}', '${STAY}'); SELECT count(*) FROM public.round_results_archive;`,
    ).out;
    check(
      refused === "f\n12",
      `SQL: a refused Play again archives nothing (${refused.replace("\n", " / ")})`,
    );

    // Best-effort: with the archive gone, Play again still works exactly as before.
    psql(`ALTER TABLE public.round_results_archive RENAME TO round_results_archive_off`);
    playGame(["sudoku"]);
    const blocked = psql(`SELECT public.restart_duel_room('${ROOM}', '${HOST}')`);
    check(
      blocked.ok &&
        blocked.out === "t" &&
        /WARNING:\s+restart_duel_room: archive skipped/.test(blocked.err) &&
        psql(`SELECT count(*) FROM public.round_results WHERE duel_id = '${ROOM}'`).out === "0",
      `SQL: a failed archive is a WARNING and Play again still resets the room (${blocked.out})`,
    );
    psql(`ALTER TABLE public.round_results_archive_off RENAME TO round_results_archive`);

    // Events: one per (room, game, round, event).
    const dup =
      psql(`INSERT INTO public.room_events (duel_id, game_index, round_number, event, reason) VALUES ('${ROOM}', 0, 2, 'round_ended', 'timer');
      INSERT INTO public.room_events (duel_id, game_index, round_number, event, reason) VALUES ('${ROOM}', 0, 2, 'round_ended', 'all_answered');`);
    check(
      !dup.ok && /23505|duplicate key/.test(dup.err),
      "SQL: room_events keeps one row per room, game, round and event",
    );
    const badReason = psql(
      `INSERT INTO public.room_events (duel_id, round_number, event, reason) VALUES ('${ROOM}', 3, 'round_ended', 'whenever')`,
    );
    check(!badReason.ok, "SQL: room_events refuses an unknown reason");
    const practiceRow =
      psql(`INSERT INTO public.practice_plays (user_id, game_id, revision, score, is_correct, timed_out, duration_ms, time_limit_ms, ms_remaining, example, flagged)
      VALUES ('${HOST}', 'breaker', '{"brkRev": 6}', 812, true, true, 61500, 93000, 0, false, false) RETURNING game_id, created_at IS NOT NULL`);
    check(
      practiceRow.ok && practiceRow.out.startsWith("breaker|t"),
      `SQL: practice_plays takes the row practiceGradeFn writes (${practiceRow.err})`,
    );

    // No client reads or writes.
    for (const table of [
      "round_results_archive",
      "duel_players_archive",
      "room_events",
      "room_joins",
      "practice_plays",
    ]) {
      const read = psql(`SELECT count(*) FROM public.${table}`, "client_probe");
      const write = psql(`DELETE FROM public.${table}`, "client_probe");
      check(
        !read.ok && !write.ok && /permission denied/.test(read.err),
        `SQL: anon/authenticated can't read or write ${table}`,
      );
    }
    const restartGrant =
      psql(`SELECT has_function_privilege('anon', 'public.restart_duel_room(uuid, uuid)', 'EXECUTE')
      OR has_function_privilege('authenticated', 'public.restart_duel_room(uuid, uuid)', 'EXECUTE')`).out;
    check(restartGrant === "f", "SQL: clients still can't call restart_duel_room");
  } catch (err) {
    console.log(
      `  NOTE local PostgreSQL unavailable (${err instanceof Error ? err.message.split("\n")[0] : String(err)}): the SQL was checked as text only`,
    );
  } finally {
    if (started) run(join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"]);
    rmSync(dir, { recursive: true, force: true });
  }
}

console.warn = quiet;
console.log(`beta-recording-check: ${passes} passed, ${failures} failed`);
if (failures) {
  console.log("FAIL");
  process.exit(1);
}
console.log(
  "PASS: Play again archives before deleting, practice plays, round and game events and join methods are recorded best-effort; new tables are server-only.",
);
