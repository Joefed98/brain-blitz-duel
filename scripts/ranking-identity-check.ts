/**
 * B3 (docs/audit-nov-2026/architecture.md): rooms, standings, the podium's awards, async boards, the Daily and
 * challenges rank through one module, src/lib/duel/ranking.ts. Proves:
 *   1. today's standings, duelOutcome, podiumAwards and rankBoard give exactly the output main gave before the move
 *      (scripts/fixtures/ranking-identity.json.gz, recorded by scripts/ranking-identity-record.ts on main 318fd42) on
 *      3,000 seeded rooms (2–16 players, 1–12 rounds, Total score and Placings, stamped and unstamped tie-break rooms,
 *      ties on points, totals and time, left and inactive players, missed rounds) and 2,000 Daily boards;
 *   2. the rooms cover the cases that matter (shared places, ties broken by time, Placings changing the order);
 *   3. ranking.ts's rules: the order, shared places, display order within a shared place, and duelOutcome agreeing
 *      with the places for every pair.
 * ~15 s.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { COUNTS, FIXTURE, makeRoom, rankingIdentity } from "./ranking-identity-lib";
import { compareRank, placesOf, outcomeOf } from "../src/lib/duel/ranking";
import { duelOutcome, standings } from "../src/lib/duel/scoring";

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string) {
  checks++;
  if (!cond) {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
}

// 1. Identity with main.
{
  const want = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as Record<string, string>;
  const got = rankingIdentity(COUNTS.rooms, COUNTS.boards);
  const keys = Object.keys(want);
  ok(keys.length === 23000 && Object.keys(got).length === keys.length, `digest count ${Object.keys(got).length} = ${keys.length}`);
  let diff = 0;
  for (const k of keys) {
    if (got[k] !== want[k]) {
      diff++;
      if (diff <= 10) console.log(`  differs: ${k}`);
    }
  }
  ok(diff === 0, `every ranking digest identical to main (${diff} of ${keys.length} differ)`);
}

// 2. Coverage: the seeded rooms really exercise ties and Placings.
{
  let shared = 0;
  let byTime = 0;
  let placingsReorder = 0;
  for (let seed = 1; seed <= COUNTS.rooms; seed++) {
    const room = makeRoom(seed);
    const total = standings(room.players, room.results, room.rounds, new Map(), room.tie, "total");
    const plac = standings(room.players, room.results, room.rounds, new Map(), room.tie, "placings");
    if (new Set(total.map((r) => r.position)).size < total.length) shared++;
    if (total.some((a, i) => total.some((b, j) => i !== j && a.total === b.total && a.position !== b.position))) byTime++;
    if (total.map((r) => r.slot).join() !== plac.map((r) => r.slot).join()) placingsReorder++;
  }
  console.log(`  rooms with a shared place ${shared}, a total tie broken by time ${byTime}, Placings reordering ${placingsReorder}`);
  ok(shared > 200 && byTime > 200 && placingsReorder > 200, "the seeded rooms cover shared places, time tie-breaks and Placings");
}

// 3. ranking.ts's rules.
{
  const rows = [
    { id: "a", total: 100, timeMs: 5 },
    { id: "b", total: 120, timeMs: 9 },
    { id: "c", total: 100, timeMs: 5 },
    { id: "d", total: 100, timeMs: 4 },
    { id: "e", total: 90, timeMs: 1 },
  ];
  const placed = placesOf(rows);
  ok(placed.map((p) => `${p.row.id}${p.place}`).join(" ") === "b1 d2 a3 c3 e5", `places: ${placed.map((p) => `${p.row.id}${p.place}`).join(" ")}`);
  const byId = placesOf(rows, (a, b) => b.id.localeCompare(a.id));
  ok(byId.map((p) => `${p.row.id}${p.place}`).join(" ") === "b1 d2 c3 a3 e5", "a display order only reorders within a shared place");
  const pts = placesOf([
    { total: 300, timeMs: 1, points: 3 },
    { total: 100, timeMs: 1, points: 5 },
  ]);
  ok(pts[0]!.row.points === 5 && pts[0]!.place === 1, "points rank before the total");
  ok(compareRank({ total: 1, timeMs: 1 }, { total: 1, timeMs: 1 }) === 0, "level rows compare 0");
  ok(outcomeOf({ total: 2, timeMs: 9 }, { total: 1, timeMs: 1 }) === "win" && outcomeOf({ total: 1, timeMs: 2 }, { total: 1, timeMs: 1 }) === "loss" && outcomeOf({ total: 1, timeMs: 1 }, { total: 1, timeMs: 1 }) === "draw", "outcomeOf");
  // duelOutcome agrees with the two players' standings among themselves.
  let disagree = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const room = makeRoom(seed);
    const two = room.players.filter((p) => p.status !== "left").slice(0, 2);
    if (two.length < 2) continue;
    for (const mode of ["total", "placings"] as const) {
      const table = standings(two, room.results, room.rounds, new Map(), room.tie, mode);
      const me = table.find((r) => r.slot === two[0]!.player_slot)!;
      const them = table.find((r) => r.slot === two[1]!.player_slot)!;
      const want = me.position < them.position ? "win" : me.position > them.position ? "loss" : "draw";
      if (duelOutcome(room.results, two[0]!.player_slot, two[1]!.player_slot, room.tie, mode, room.rounds) !== want) disagree++;
    }
  }
  ok(disagree === 0, `duelOutcome agrees with standings' places for two players (${disagree} disagree)`);
}

console.log(failures.length ? `FAIL: ${failures.length} of ${checks} checks failed` : `ranking-identity-check: ${checks} passed`);
process.exit(failures.length ? 1 : 0);
