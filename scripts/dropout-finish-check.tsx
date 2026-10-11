// Item 7 (12 Oct 2026): when everyone else leaves or drops out of a game, the
// player still here gets no dead end: the rounds carry on on their timers
// (absent players score 0 a round) and "Finish now" ends the game as their win.
// Stored rounds and scores are never written.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { DropoutBanner } from "../src/components/duel/DropoutBanner";
import { absentRivals, canFinishNow, endedByForfeit } from "../src/lib/duel/roomFlow";
import { finishGame } from "../src/lib/duel/roomPhase.server";
import { duelOutcome, totalScore, totalScoreThrough } from "../src/lib/duel/scoring";
import { DISCONNECT_MS, type DuelPlayerRow, type RoundResultRow } from "../src/lib/duel/types";
import { memoryDb } from "./fixtures/memoryDb";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const seen = (msAgo: number) => new Date(NOW - msAgo).toISOString();
function player(slot: number, extra: Partial<DuelPlayerRow> = {}): DuelPlayerRow {
  return {
    id: `p${slot}`,
    duel_id: "room",
    player_slot: slot,
    display_name: slot === 1 ? "Ana" : "Ben",
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
const gone = seen(DISCONNECT_MS + 1);

// Who may finish.
assert.equal(canFinishNow([player(1), player(2)], "u1", NOW), false, "both here");
assert.equal(
  canFinishNow([player(1), player(2, { last_seen_at: gone })], "u1", NOW),
  true,
  "rival dropped out",
);
assert.equal(
  canFinishNow([player(1), player(2, { status: "left" })], "u1", NOW),
  true,
  "rival tapped Leave",
);
assert.equal(canFinishNow([player(1, { status: "left" }), player(2)], "u1", NOW), false, "I left");
assert.equal(canFinishNow([player(1)], "u1", NOW), false, "never had a rival");
assert.equal(
  canFinishNow([player(1), player(2, { last_seen_at: gone }), player(3)], "u1", NOW),
  false,
  "a third player is still here",
);
assert.deepEqual(
  absentRivals([player(1), player(2, { last_seen_at: gone })], "u1", NOW).map(
    (p) => p.display_name,
  ),
  ["Ben"],
);

// How a finished room reads.
const finished = { status: "finished", disbanded_at: null };
assert.equal(endedByForfeit({ ...finished, phase: "winner_reveal" }), false, "normal finish");
assert.equal(endedByForfeit({ ...finished, phase: "standings" }), false, "older rooms' finish");
assert.equal(
  endedByForfeit({ ...finished, phase: "puzzle", disbanded_at: seen(0) }),
  false,
  "disbanded",
);
for (const phase of ["intro", "puzzle", "reveal", "result"])
  assert.equal(endedByForfeit({ ...finished, phase }), true, phase);
assert.equal(endedByForfeit({ status: "in_progress", phase: "result", disbanded_at: null }), false);

// Absent players score 0 a round; stored scores and the outcome rule are unchanged.
const result = (slot: number, round: number, score: number): RoundResultRow =>
  ({
    id: `${slot}-${round}`,
    duel_id: "room",
    player_slot: slot,
    round_number: round,
    answer: "x",
    is_correct: score >= 100,
    ms_remaining: 1000,
    reaction_avg_ms: null,
    correct_count: null,
    score,
    created_at: seen(0),
  }) as unknown as RoundResultRow;
const results = [result(1, 1, 60), result(2, 1, 140), result(1, 2, 90), result(1, 3, 70)];
assert.equal(totalScoreThrough(results, 2, 3), 140, "rounds 2 and 3 add 0 for the absent player");
assert.equal(totalScore(results, 1), 220);
assert.equal(duelOutcome(results, 1, 2), "win");

// The server finish: refused while a rival is here; once alone, exactly one
// finish, absent players stored as left, round_results never written.
function store(phase: string, players: DuelPlayerRow[]) {
  return memoryDb({
    duels: [{ id: "room", status: "in_progress", current_round: 3, phase, disbanded_at: null }],
    duel_players: players.map((p) => ({ ...p })),
    round_results: results.map((r) => ({ ...r })),
  });
}
const roomRow = {
  id: "room",
  status: "in_progress",
  current_round: 3,
  disbanded_at: null,
} as const;
{
  const players = [player(1), player(2)];
  const db = store("result", players);
  const refused = await finishGame(db.client, { ...roomRow, phase: "result" }, players, "u1", NOW);
  assert.equal(refused.ok, false);
  assert.equal(db.writes.length, 0);
}
{
  const db = store("winner_reveal", [player(1), player(2, { last_seen_at: gone })]);
  const refused = await finishGame(
    db.client,
    { ...roomRow, phase: "winner_reveal" },
    [player(1), player(2, { last_seen_at: gone })],
    "u1",
    NOW,
  );
  assert.equal(refused.ok, false, "the winner reveal is already ending the game");
  assert.equal(db.writes.length, 0);
}
{
  const players = [player(1), player(2, { last_seen_at: gone })];
  const db = store("puzzle", players);
  const before = JSON.stringify(db.tables["round_results"]);
  const outcomes = await Promise.all(
    [0, 1, 2].map(() => finishGame(db.client, { ...roomRow, phase: "puzzle" }, players, "u1", NOW)),
  );
  assert.equal(outcomes.filter((o) => o.ok && o.finished).length, 1, "finished exactly once");
  const room = db.tables["duels"]![0]!;
  assert.equal(room["status"], "finished");
  assert.equal(room["phase"], "puzzle", "the phase is left as it was");
  assert.equal(endedByForfeit(room as never), true);
  assert.deepEqual(
    db.tables["duel_players"]!.map((p) => p["status"]),
    ["active", "left"],
  );
  assert.equal(JSON.stringify(db.tables["round_results"]), before, "round results untouched");
  assert(db.writes.every((w) => w.table !== "round_results"));
}

// The banner: who left, the scores, and Finish now.
const banner = renderToStaticMarkup(
  <DropoutBanner absentNames={["Ben"]} myTotal={220} absentTotal={140} onFinish={async () => {}} />,
);
assert.match(banner, /Ben left the game/);
assert.match(banner, /You 220 · Ben 140/);
assert.match(banner, /they score 0/);
assert.match(banner, /Finish now/);

// Wiring: no dead-end screen; the banner sits on the between-round screens.
const route = readFileSync("src/routes/duel.$code.tsx", "utf8");
assert.doesNotMatch(route, /Opponent disconnected|dropped out of the duel/);
assert.match(route, /canFinishNow\(players, me\.user_id, now\)/);
assert.equal(
  (route.match(/\{dropout\}/g) ?? []).length,
  4,
  "intro, two result layouts and standings",
);
assert.match(route, /endedByForfeit\(duel\)/);
assert.match(route, /left the game\. You win\./);
const server = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
const finishFn = server.slice(server.indexOf("export const finishNowFn"));
assert.match(finishFn, /finishGame\(client, room, players, context\.userId, Date\.now\(\)\)/);
assert.doesNotMatch(finishFn.slice(0, finishFn.indexOf("});")), /round_results/);

console.log(
  "PASS: Finish now only for the last player here, finishes once, marks absent players left, never writes round results; absent rounds score 0; forfeit finishes read as wins; banner shows names, scores and Finish now; no dead-end screen. No device test.",
);
