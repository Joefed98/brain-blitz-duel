// Item 6 (12 Oct 2026): between-round screens keep their timers as the
// maximum but move on as soon as every connected active player has tapped
// Ready (intro) or Continue (results, standings). The move stays server-side
// and idempotent: guarded writes, exercised here against an in-memory store.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  allContinued,
  allIntroReady,
  betweenScreenDue,
  continueMark,
  hasContinued,
  waitedOn,
} from "../src/lib/duel/roomFlow";
import { leaveBetweenRoundScreen, recordContinue } from "../src/lib/duel/roomPhase.server";
import {
  DISCONNECT_MS,
  INTRO_MS,
  INTRO_WAIT_MS,
  NEXT_ROUND_AUTO_MS,
  STANDINGS_MS,
  type DuelPlayerRow,
} from "../src/lib/duel/types";
import { memoryDb } from "./fixtures/memoryDb";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const seen = (msAgo: number) => new Date(NOW - msAgo).toISOString();
function player(slot: number, extra: Partial<DuelPlayerRow> = {}): DuelPlayerRow {
  return {
    id: `p${slot}`,
    duel_id: "room",
    player_slot: slot,
    display_name: `P${slot}`,
    user_id: `u${slot}`,
    ready_round: 0,
    intro_ready_round: 0,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: seen(1_000),
    status: "active",
    joined_at: seen(60_000),
    ...extra,
  };
}

// Timers are unchanged: they stay the most any screen waits.
assert.equal(INTRO_WAIT_MS, 30_000);
assert.equal(INTRO_MS, 33_000);
assert.equal(NEXT_ROUND_AUTO_MS, 8_000);
assert.equal(STANDINGS_MS, 10_000);

// Marks: one rising mark per screen; earlier screens never count for later ones.
assert.equal(continueMark(1, "result"), 2);
assert.equal(continueMark(1, "standings"), 3);
assert.equal(continueMark(2, "result"), 4);
const marks = [1, 2, 3, 4, 5, 6, 7].flatMap((r) => [
  continueMark(r, "result"),
  continueMark(r, "standings"),
]);
assert.deepEqual(
  marks,
  [...marks].sort((a, b) => a - b),
);
assert.equal(new Set(marks).size, marks.length);
assert.equal(
  hasContinued(player(1, { ready_round: 3 }), 2, "result"),
  false,
  "round 1 standings tap is not round 2",
);
assert.equal(hasContinued(player(1, { ready_round: 5 }), 2, "result"), true);

// Who is waited for: connected active players only.
const room = [
  player(1, { ready_round: 4 }),
  player(2, { ready_round: 4 }),
  player(3, { ready_round: 0 }),
  player(4, { status: "inactive" }),
  player(5, { status: "left" }),
  player(6, { last_seen_at: seen(DISCONNECT_MS + 1) }),
];
assert.deepEqual(
  waitedOn(room, NOW).map((p) => p.player_slot),
  [1, 2, 3],
);
assert.equal(allContinued(room, 2, "result", NOW), false, "P3 hasn't tapped");
assert.equal(betweenScreenDue("result", 1_000, room, 2, NOW), false);
assert.equal(
  betweenScreenDue("result", NEXT_ROUND_AUTO_MS, room, 2, NOW),
  true,
  "timer is the maximum",
);
assert.equal(betweenScreenDue("standings", NEXT_ROUND_AUTO_MS, room, 2, NOW), false);
assert.equal(betweenScreenDue("standings", STANDINGS_MS, room, 2, NOW), true);
assert.equal(
  betweenScreenDue("result", 0, room, 2, NOW, true),
  true,
  "older clients' host Next still works",
);
room[2]!.ready_round = 4;
assert.equal(
  allContinued(room, 2, "result", NOW),
  true,
  "inactive, left and disconnected never hold it",
);
assert.equal(betweenScreenDue("result", 0, room, 2, NOW), true);
assert.equal(
  allContinued([player(1, { status: "left" })], 1, "result", NOW),
  false,
  "nobody to wait for: timer only",
);

// Intro Ready uses the same rule.
assert.equal(
  allIntroReady(
    [player(1, { intro_ready_round: 2 }), player(2, { last_seen_at: seen(DISCONNECT_MS + 5) })],
    2,
    NOW,
  ),
  true,
);
assert.equal(allIntroReady([player(1, { intro_ready_round: 2 }), player(2)], 2, NOW), false);

// Server writes against an in-memory store.
const stamp = "2026-10-12T11:59:58.000Z";
function store(phase: string, round = 2, roundCount = 6) {
  return memoryDb({
    duels: [
      {
        id: "room",
        status: "in_progress",
        current_round: round,
        phase,
        phase_started_at: stamp,
        round_count: roundCount,
      },
    ],
    duel_players: [player(1), player(2), player(3)].map((p) => ({ ...p })),
  });
}
const duelRow = (db: ReturnType<typeof store>) => db.tables["duels"]![0]!;

// Continue taps only ever raise the mark.
{
  const db = store("result");
  await recordContinue(db.client, "p1", 2, "standings");
  await recordContinue(db.client, "p1", 2, "result");
  assert.equal(db.tables["duel_players"]![0]!["ready_round"], continueMark(2, "standings"));
}

// A burst of last taps, timer expiries and host Nexts moves the screen once.
for (const [from, round, count, to, nextRound] of [
  ["result", 2, 6, "standings", 2],
  ["result", 6, 6, "winner_reveal", 6],
  ["standings", 2, 6, "round_title", 3],
] as const) {
  const db = store(from, round, count);
  const snapshot = { id: "room", phase: from, round_count: count };
  await Promise.all([0, 1, 2, 3].map(() => leaveBetweenRoundScreen(db.client, snapshot, round)));
  const moved = db.writes.filter((w) => w.table === "duels" && w.matched > 0);
  assert.equal(moved.length, 1, `${from} r${round}: moved ${moved.length} times`);
  assert.equal(duelRow(db)["phase"], to);
  assert.equal(duelRow(db)["current_round"], nextRound);
  // A stale call (the room has already moved on) writes nothing.
  await leaveBetweenRoundScreen(db.client, snapshot, round);
  assert.equal(db.writes.filter((w) => w.table === "duels" && w.matched > 0).length, 1);
}

// End to end: three players tap in turn; the screen leaves on the third tap only.
{
  const db = store("result");
  const players = () => db.tables["duel_players"] as unknown as DuelPlayerRow[];
  for (const [index, id] of ["p1", "p2", "p3"].entries()) {
    await recordContinue(db.client, id, 2, "result");
    const fresh = players().map((p) => ({ ...p, last_seen_at: seen(500) }));
    if (allContinued(fresh, 2, "result", NOW))
      await leaveBetweenRoundScreen(db.client, { id: "room", phase: "result", round_count: 6 }, 2);
    assert.equal(
      duelRow(db)["phase"],
      index < 2 ? "result" : "standings",
      `after tap ${index + 1}`,
    );
  }
}

// Wiring: the server uses these rules and no client ever writes the phase itself.
const server = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
const advance = server.slice(
  server.indexOf("export const advancePhaseFn"),
  server.indexOf("export type { SubmitExtra }"),
);
assert.match(
  advance,
  /betweenScreenDue\(room\.phase, elapsed, players, round, Date\.now\(\), hostNext\)/,
);
assert.match(advance, /leaveBetweenRoundScreen\(client, room, round\)/);
assert.match(advance, /allIntroReady\(players, round, Date\.now\(\)\)/);
const continueFn = server.slice(
  server.indexOf("export const continueFn"),
  server.indexOf("export const finishNowFn"),
);
assert.match(continueFn, /room\.current_round !== round/);
assert.match(continueFn, /room\.phase !== data\.phase/);
assert.match(
  continueFn,
  /recordContinue\(client, player\.id, round, room\.phase\)[\s\S]*allContinued\([\s\S]*leaveBetweenRoundScreen/,
);
const route = readFileSync("src/routes/duel.$code.tsx", "utf8");
assert.match(route, /allContinued\(roomPlayers, round, phase, now\)/);
assert.match(route, /continueOn\(duel\.id, round, phase\)/);
for (const file of ["RoundResultsTable", "RoundResult", "Standings", "DuelOverall"]) {
  const source = readFileSync(`src/components/duel/${file}.tsx`, "utf8");
  assert.match(source, /<ContinueFooter/, `${file} has no Continue`);
  assert.doesNotMatch(source, /isHost|onNext/, `${file} still has a host-only Next`);
}

console.log(
  "PASS: Ready/Continue wait only for connected active players, timers stay the maximum (8 s / 10 s / 33 s), marks only rise, bursts of taps and expiries move each screen exactly once, stale calls write nothing; server and all four screens wired. No device test.",
);
