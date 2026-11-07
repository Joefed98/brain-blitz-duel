/**
 * room-scoring-check (6 Nov 2026; scoringMode.ts): the room scoring choice, Total score or Placings.
 *
 *  1. The points table for every room size (2: 1, 0; 3: 3, 1, 0; 4: 5, 3, 1, 0; 5–8: 10 … 0; 9–16: 15 … 1,
 *     then 0) and a missing or unknown stored mode reading as Total score.
 *  2. Total score: standings() with the mode given are exactly the standings without it (no new fields, the
 *     same order and positions) on seeded rooms of 2, 8 and 16 players, so every room before this is unchanged.
 *  3. Placings on rooms of 2, 8 and 16: each round's place and points, ties sharing the place and the higher
 *     points, most points first, level points split by the total score, then the tie-break time, then shared;
 *     the hand-worked rooms agree with an independent recount on 300 seeded rooms.
 *  4. The two-player outcome, the podium's awards and Play again's saved winner follow the room's mode.
 *  5. The server (roomSettings.server.ts on an in-memory duels table): the host stores Placings, a guest or a
 *     started room is refused, junk is refused, a phone that sends no scoring leaves it alone, and before the
 *     migration (the column missing) Total score still saves and Placings is refused with a message.
 *  6. The settings sheet (happy-dom): no Scoring control without the column; with it, Total score chosen by
 *     default and Placings sent on Save.
 */
import { podiumAwards } from "../src/lib/duel/podiumAwards";
import { changeRoomSettings } from "../src/lib/duel/roomSettings.server";
import { encodeRoomSettings } from "../src/lib/duel/roomSettings";
import { tieWinnerRecord } from "../src/lib/duel/historyWinner.server";
import { duelOutcome, duelPlacings, standings, type Standing, type TieRound } from "../src/lib/duel/scoring";
import {
  hasScoringColumn,
  placingPoints,
  placingTable,
  readScoringMode,
  roomScoringMode,
  roundPlacings,
} from "../src/lib/duel/scoringMode";
import { tieMarks } from "../src/lib/duel/tieDisplay";
import { placedOf, shownGain, shownTotal } from "../src/lib/duel/resultPresentation";
import type { DuelPlayerRow, DuelRow, RoundResultRow } from "../src/lib/duel/types";

const failures: string[] = [];
let checks = 0;
const check = (ok: boolean, message: string) => {
  checks++;
  if (!ok) {
    failures.push(message);
    if (failures.length <= 40) console.log(`FAIL ${message}`);
  }
};
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ------------------------------------------------------------------ fixtures */
function player(slot: number, over: Partial<DuelPlayerRow> = {}): DuelPlayerRow {
  return {
    id: `p${slot}`,
    duel_id: "d1",
    player_slot: slot,
    display_name: `P${slot}`,
    user_id: `u${slot}`,
    ready_round: 0,
    intro_ready_round: 0,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: "2026-11-06T10:00:00Z",
    status: "active",
    joined_at: "2026-11-06T10:00:00Z",
    ...over,
  } as DuelPlayerRow;
}
function result(slot: number, round: number, score: number, msRemaining = 10_000): RoundResultRow {
  return {
    id: `r${slot}-${round}`,
    duel_id: "d1",
    player_slot: slot,
    round_number: round,
    answer: null,
    is_correct: score > 0,
    ms_remaining: msRemaining,
    reaction_avg_ms: null,
    correct_count: null,
    errors: null,
    extra: null,
    score,
    submitted_at: "2026-11-06T10:00:00Z",
  };
}
/** Every round's tie-break clock (a stamped room): 60 s rounds. */
const tieFor = (rounds: number): TieRound[] => Array.from({ length: rounds }, () => ({ limitMs: 60_000, phaseLimitMs: 60_000, flash: false }));
const players = (n: number) => Array.from({ length: n }, (_, i) => player(i + 1));
const rng = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);

/* ------------------------------------------------------------------ 1. table and reading */
check(eq(placingTable(2), [1, 0]), "2 players: 1, 0");
check(eq(placingTable(3), [3, 1, 0]), "3 players: 3, 1, 0");
check(eq(placingTable(4), [5, 3, 1, 0]), "4 players: 5, 3, 1, 0");
for (const n of [5, 6, 7, 8]) check(eq(placingTable(n), [10, 7, 5, 4, 3, 2, 1, 0]), `${n} players: 10, 7, 5, 4, 3, 2, 1, 0`);
for (const n of [9, 12, 16]) check(eq(placingTable(n), [15, 12, 10, 8, 6, 5, 4, 3, 2, 1]), `${n} players: 15, 12, 10, 8, 6, 5, 4, 3, 2, 1`);
check(placingPoints(16, 11) === 0 && placingPoints(16, 16) === 0 && placingPoints(16, 10) === 1, "16 players: 11th to 16th score 0, 10th 1");
check(placingPoints(5, 5) === 3 && placingPoints(8, 8) === 0, "5–8 players: the table read by place (5th of 5 scores 3, 8th of 8 scores 0)");
check(readScoringMode(undefined) === "total" && readScoringMode(null) === "total" && readScoringMode("PLACINGS") === "total" && readScoringMode(7) === "total", "a missing or unknown mode reads as Total score");
check(readScoringMode("placings") === "placings" && readScoringMode("total") === "total", "stored modes read as themselves");
check(roomScoringMode({ room_code: "ABCD" }) === "total" && !hasScoringColumn({ room_code: "ABCD" }), "a room row from before the migration: Total score, no column");
check(roomScoringMode({ scoring_mode: "placings" }) === "placings" && hasScoringColumn({ scoring_mode: "total" }), "a room row with the column reads its mode");
const tiedRound = roundPlacings([{ slot: 1, score: 140 }, { slot: 2, score: 140 }, { slot: 3, score: 90 }, { slot: 4, score: 0 }]);
check(eq(tiedRound.map((r) => [r.place, r.points]), [[1, 5], [1, 5], [3, 1], [4, 0]]), `a tie shares the place and the higher points (${JSON.stringify(tiedRound)})`);

/* ------------------------------------------------------------------ 2. Total score is unchanged */
function seededRoom(n: number, rounds: number, seed: number) {
  const r = rng(seed);
  const ps = players(n);
  const results: RoundResultRow[] = [];
  for (let round = 1; round <= rounds; round++)
    for (const p of ps) if (r() > 0.08) results.push(result(p.player_slot, round, Math.floor(r() * 9) * 20, Math.floor(r() * 4) * 5000));
  return { ps, results };
}
for (const n of [2, 8, 16]) {
  let same = true;
  for (let seed = 1; seed <= 40; seed++) {
    const { ps, results } = seededRoom(n, 6, seed * 7 + n);
    for (let through = 1; through <= 6; through++) {
      const before = standings(ps, results, through, undefined, tieFor(6));
      const after = standings(ps, results, through, undefined, tieFor(6), "total");
      if (!eq(before, after) || after.some((row) => "points" in row || "roundPlace" in row)) same = false;
    }
  }
  check(same, `${n} players, Total score: standings identical with or without the mode, no placing fields (40 rooms × 6 rounds)`);
}

/* ------------------------------------------------------------------ 3. Placings, hand-worked rooms */
// Two players over three rounds: P1 wins two rounds, P2 one with a far bigger score.
{
  const ps = players(2);
  const results = [result(1, 1, 100), result(2, 1, 90), result(1, 2, 80), result(2, 2, 60), result(1, 3, 10), result(2, 3, 200)];
  const total = standings(ps, results, 3, undefined, tieFor(3), "total");
  const plac = standings(ps, results, 3, undefined, tieFor(3), "placings");
  check(total[0]!.slot === 2 && total[0]!.total === 350, "2 players, Total score: the bigger total wins (P2 350 to 190)");
  check(plac[0]!.slot === 1 && plac[0]!.points === 2 && plac[1]!.points === 1, `2 players, Placings: two round wins beat one (${plac.map((r) => `${r.name} ${r.points}`).join(", ")})`);
  check(plac[1]!.roundPlace === 1 && plac[1]!.roundPoints === 1 && plac[0]!.roundPlace === 2 && plac[0]!.roundPoints === 0, "2 players, Placings: the last round's place and points on each row");
  check(duelOutcome(results, 1, 2, tieFor(3), "placings", 3) === "win" && duelOutcome(results, 2, 1, tieFor(3), "placings", 3) === "loss", "2 players, Placings: the two-player outcome follows the points");
  check(duelOutcome(results, 1, 2, tieFor(3)) === "loss" && duelOutcome(results, 1, 2, tieFor(3), "total", 3) === "loss", "2 players, Total score: the two-player outcome is the old one");
  check(eq(duelPlacings(results, 1, 2, 3), { mine: 2, theirs: 1, lastMine: 0, lastTheirs: 1 }), "2 players, Placings: the final screen's points and the last round's");
  // A level round gives both the higher point; then level on points the total breaks it.
  const level = [result(1, 1, 100), result(2, 1, 100), result(1, 2, 50), result(2, 2, 70)];
  const lv = standings(ps, level, 2, undefined, tieFor(2), "placings");
  check(lv.every((r) => r.roundPlace !== undefined) && lv.find((r) => r.slot === 1)!.points === 1 && lv.find((r) => r.slot === 2)!.points === 2, "2 players: a level round gives each 1 point");
  const levelPoints = [result(1, 1, 100), result(2, 1, 40), result(1, 2, 50), result(2, 2, 70)];
  const lp = standings(ps, levelPoints, 2, undefined, tieFor(2), "placings");
  check(lp[0]!.slot === 1 && lp[0]!.position === 1 && lp[1]!.position === 2 && lp[0]!.points === lp[1]!.points, "2 players: level on points, the higher total score (150 to 110) wins");
  check(duelOutcome(levelPoints, 1, 2, tieFor(2), "placings", 2) === "win", "2 players: level on points, the outcome goes to the higher total");
}

// Eight players, two rounds, ties in both.
{
  const ps = players(8);
  // Round 1: P1 150, P2 150 (share 1st: 10 each), P3 120 (3rd: 5), P4–P8 100,90,80,70,0.
  // Round 1 also: P4 4th (4), P5 5th (3), P6 6th (2), P7 7th (1), P8 8th (0).
  // Round 2: P8 200 (10), P3 180 (7), P1 100 and P2 100 (share 3rd: 5 each), then P4 90 is 5th (3), P5 80 6th (2),
  // P6 70 7th (1), P7 no answer 8th (0).
  const results = [
    result(1, 1, 150), result(2, 1, 150), result(3, 1, 120), result(4, 1, 100), result(5, 1, 90), result(6, 1, 80), result(7, 1, 70), result(8, 1, 0),
    result(8, 2, 200), result(3, 2, 180), result(1, 2, 100, 20_000), result(2, 2, 100, 5_000), result(4, 2, 90), result(5, 2, 80), result(6, 2, 70),
  ];
  const t = standings(ps, results, 2, undefined, tieFor(2), "placings");
  const pts = (slot: number) => t.find((r) => r.slot === slot)!.points;
  check(eq([1, 2, 3, 4, 5, 6, 7, 8].map(pts), [15, 15, 12, 7, 5, 3, 1, 10]), `8 players: points through two rounds (${[1, 2, 3, 4, 5, 6, 7, 8].map(pts).join(", ")})`);
  const r1 = standings(ps, results, 1, undefined, tieFor(2), "placings");
  check(r1.filter((r) => r.roundPlace === 1).length === 2 && r1.find((r) => r.slot === 3)!.roundPlace === 3 && r1.find((r) => r.slot === 3)!.roundPoints === 5, "8 players: two level on 150 share 1st (10 each), the next is 3rd (5)");
  // P1 and P2 level on 15 points and on total (250); P1 used less time in round 2 (20 s left vs 5 s): P1 first.
  check(t[0]!.slot === 1 && t[1]!.slot === 2 && t[0]!.position === 1 && t[1]!.position === 2, "8 players: level on points and score, the existing time tie-break splits them");
  check(t[2]!.slot === 3 && t[3]!.slot === 8, `8 players: then P3 (12) and P8 (10) (${t.map((r) => r.slot).join(",")})`);
  const marks = tieMarks(t.map(placedOf));
  check(marks.get(1)!.note === "Level on 15 pts · ahead on time" && marks.get(2)!.note === "Level on 15 pts · behind on time", `8 players: the tie note names points and time (${marks.get(1)!.note})`);
  check(shownTotal(t[0]!) === 15 && shownGain(t[0]!) === "3rd +5", `8 players: the row shows points and the round's place ("${shownGain(t[0]!)}")`);
  // Fully level on everything: shared place.
  const twin = [result(1, 1, 100, 10_000), result(2, 1, 100, 10_000), ...[3, 4, 5, 6, 7, 8].map((s) => result(s, 1, 10))];
  const tw = standings(ps, twin, 1, undefined, tieFor(1), "placings");
  check(tw[0]!.position === 1 && tw[1]!.position === 1 && tw[2]!.position === 3, "8 players: level on points, score and time share the place");
  check(tw.slice(2).every((r) => r.points === 5 && r.position === 3), "8 players: six level on 10 share 3rd and its 5 points");
  // Level on points, split by score.
  const byScore = [result(1, 1, 100), result(2, 1, 90), result(1, 2, 10), result(2, 2, 120), ...[3, 4, 5, 6, 7, 8].flatMap((s) => [result(s, 1, 0), result(s, 2, 0)])];
  const bs = standings(ps, byScore, 2, undefined, tieFor(2), "placings");
  check(bs[0]!.slot === 2 && bs[0]!.points === bs[1]!.points && tieMarks(bs.map(placedOf)).get(2)!.note === "Level on 17 pts · ahead on score", `8 players: level on points (17), the higher score (210 to 110) first, noted "on score" (${tieMarks(bs.map(placedOf)).get(2)!.note})`);
}

// Sixteen players: one round, everyone different, then a left player.
{
  const ps = players(16);
  const results = ps.map((p) => result(p.player_slot, 1, 200 - p.player_slot * 10));
  const t = standings(ps, results, 1, undefined, tieFor(1), "placings");
  check(eq(t.map((r) => r.points), [15, 12, 10, 8, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0]), `16 players: one round's points by place (${t.map((r) => r.points).join(",")})`);
  check(eq(t.slice(10).map((r) => r.position), [11, 12, 13, 14, 15, 16]), "16 players: 11th–16th on 0 points rank by their total score");
  const allLevel = ps.map((p) => result(p.player_slot, 1, 50));
  const al = standings(ps, allLevel, 1, undefined, tieFor(1), "placings");
  check(al.every((r) => r.points === 15 && r.position === 1 && r.roundPlace === 1), "16 players: all level share 1st and its 15 points");
  const left = [...ps.slice(0, 15), player(16, { status: "left" })];
  const lt = standings(left, results, 1, undefined, tieFor(1), "placings");
  check(lt.length === 15 && lt[0]!.points === 15 && lt[14]!.points === 0, "16 seats, one left: 15 listed, ranked among themselves (the 9–16 table)");
}

/* ------------------------------------------------------------------ 3b. against an independent recount */
function recount(ps: DuelPlayerRow[], results: RoundResultRow[], through: number) {
  const inRoom = ps.filter((p) => p.status !== "left");
  const table = (n: number) => (n <= 2 ? [1, 0] : n === 3 ? [3, 1, 0] : n === 4 ? [5, 3, 1, 0] : n <= 8 ? [10, 7, 5, 4, 3, 2, 1, 0] : [15, 12, 10, 8, 6, 5, 4, 3, 2, 1]);
  const pts = new Map(inRoom.map((p) => [p.player_slot, 0]));
  const total = new Map(inRoom.map((p) => [p.player_slot, 0]));
  for (let round = 1; round <= through; round++) {
    const score = (slot: number) => results.find((r) => r.player_slot === slot && r.round_number === round)?.score ?? 0;
    for (const p of inRoom) {
      const place = 1 + inRoom.filter((o) => score(o.player_slot) > score(p.player_slot)).length;
      pts.set(p.player_slot, pts.get(p.player_slot)! + (table(inRoom.length)[place - 1] ?? 0));
      total.set(p.player_slot, total.get(p.player_slot)! + score(p.player_slot));
    }
  }
  return { pts, total };
}
for (const n of [2, 8, 16]) {
  let ok = true;
  let detail = "";
  for (let seed = 1; seed <= 100; seed++) {
    const { ps, results } = seededRoom(n, 6, seed * 13 + n);
    const through = 1 + (seed % 6);
    const t: Standing[] = standings(ps, results, through, undefined, tieFor(6), "placings");
    const { pts, total } = recount(ps, results, through);
    for (const row of t) if (row.points !== pts.get(row.slot) || row.total !== total.get(row.slot)) ((ok = false), (detail ||= `seed ${seed} slot ${row.slot}`));
    for (let i = 1; i < t.length; i++) {
      const a = t[i - 1]!;
      const b = t[i]!;
      const ordered = a.points! > b.points! || (a.points === b.points && (a.total > b.total || (a.total === b.total && a.answerMs <= b.answerMs)));
      const shared = a.points === b.points && a.total === b.total && a.answerMs === b.answerMs;
      if (!ordered || (shared ? b.position !== a.position : b.position !== i + 1)) ((ok = false), (detail ||= `seed ${seed} order at ${i}`));
    }
  }
  check(ok, `${n} players, Placings: 100 seeded rooms match an independent recount, ordered by points, then score, then time ${detail}`);
}

/* ------------------------------------------------------------------ 4. awards and Play again's winner */
{
  const ps = players(3);
  const results = [result(1, 1, 150), result(2, 1, 140), result(3, 1, 0), result(1, 2, 150), result(2, 2, 140), result(3, 2, 0), result(1, 3, 0), result(2, 3, 10), result(3, 3, 200)];
  // Total: P1 300, P2 290, P3 200. Placings: P1 3+3+0 = 6, P2 1+1+1 = 3, P3 0+0+3 = 3 (P2 ahead on score).
  const rounds = [1, 2, 3].map(() => ({ type: "gridlock" as const, name: "Gridlock" }));
  const total = podiumAwards(ps, results, rounds as never, tieFor(3));
  const totalAgain = podiumAwards(ps, results, rounds as never, tieFor(3), "total");
  check(eq(total, totalAgain), "awards: Total score gives exactly the awards as before");
  const plac = podiumAwards(ps, results, rounds as never, tieFor(3), "placings");
  check(plac.length > 0 && plac.every((a) => [1, 2, 3].includes(a.slot)), "awards: a Placings room's awards go to its players");
  const room = { puzzles_public: [1, 2, 3].map(() => ({ type: "gridlock", tieRev: 1 })), round_count: 3, tournament_history: [] } as unknown as DuelRow;
  const backResults = [result(1, 1, 10), result(2, 1, 0), result(3, 1, 5), result(1, 2, 10), result(2, 2, 0), result(3, 2, 5), result(1, 3, 0), result(2, 3, 300), result(3, 3, 5)];
  // Total: P2 300 wins. Placings: P1 3+3+0 = 6, P3 1+1+1 = 3, P2 0+0+3 = 3: P1 wins.
  check(tieWinnerRecord(room, ps, backResults)?.winner === "P2", "Play again: a Total score room saves its points leader");
  check(tieWinnerRecord({ ...room, scoring_mode: "total" }, ps, backResults)?.winner === "P2", "Play again: scoring_mode 'total' saves the same");
  check(tieWinnerRecord({ ...room, scoring_mode: "placings" }, ps, backResults)?.winner === "P1", "Play again: a Placings room saves the most placing points");
}

/* ------------------------------------------------------------------ 5. the server */
interface Row { id: string; room_code: string; host_user_id: string; status: string; disbanded_at: string | null; selected_categories: unknown; scoring_mode?: string }
function fakeClient(rows: Row[], hasColumn: boolean) {
  const writes: Record<string, unknown>[] = [];
  const table = () => {
    const filters: [string, unknown][] = [];
    let patch: Record<string, unknown> | null = null;
    const match = () => rows.filter((r) => filters.every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v));
    const q = {
      select: () => q,
      update: (p: Record<string, unknown>) => ((patch = p), q),
      eq: (k: string, v: unknown) => (filters.push([k, v]), q),
      maybeSingle: async () => {
        if (patch && !hasColumn && "scoring_mode" in patch)
          return { data: null, error: { code: "PGRST204", message: "Could not find the 'scoring_mode' column of 'duels' in the schema cache" } };
        const hit = match();
        if (patch) {
          writes.push(structuredClone(patch));
          for (const r of hit) Object.assign(r, structuredClone(patch));
        }
        return { data: hit[0] ? { ...hit[0] } : null, error: null };
      },
    };
    return q;
  };
  return { writes, client: { from: (name: string) => (name === "duels" ? table() : (() => { throw new Error(`unexpected table ${name}`); })()) } };
}
const row = (over: Partial<Row> = {}): Row => ({ id: "r1", room_code: "ABCD", host_user_id: "host", status: "waiting", disbanded_at: null, selected_categories: [], scoring_mode: "total", ...over });
const settings = { picks: ["logic", "retro"], rounds: 6 };
const quiet = console.log;
console.log = () => {};
try {
  {
    const r = row();
    const { client } = fakeClient([r], true);
    const res = await changeRoomSettings(client, "r1", "host", { ...settings, scoring: "placings" });
    console.log = quiet;
    check(res.ok && r.scoring_mode === "placings" && eq(r.selected_categories, encodeRoomSettings({ picks: ["logic", "retro"], rounds: 6 })), "server: the host stores Placings with the settings");
    console.log = () => {};
    const back = await changeRoomSettings(client, "r1", "host", { ...settings, scoring: "total" });
    console.log = quiet;
    check(back.ok && r.scoring_mode === "total", "server: the host switches back to Total score");
    console.log = () => {};
  }
  for (const [label, over, user, scoring] of [
    ["a guest", {}, "guest", "placings"],
    ["a started room", { status: "in_progress" }, "host", "placings"],
    ["an unknown mode", {}, "host", "points"],
    ["a non-string mode", {}, "host", 1],
  ] as const) {
    const r = row(over as Partial<Row>);
    const { client } = fakeClient([r], true);
    const res = await changeRoomSettings(client, "r1", user, { ...settings, scoring });
    console.log = quiet;
    check(!res.ok && r.scoring_mode === "total", `server: ${label} is refused, the mode unchanged (${res.ok ? "stored" : res.message})`);
    console.log = () => {};
  }
  {
    const r = row({ scoring_mode: "placings" });
    const { client, writes } = fakeClient([r], true);
    const res = await changeRoomSettings(client, "r1", "host", settings);
    console.log = quiet;
    check(res.ok && r.scoring_mode === "placings" && writes.every((w) => !("scoring_mode" in w)), "server: settings sent without a mode leave the room's mode alone");
    console.log = () => {};
  }
  {
    const r = row();
    delete r.scoring_mode;
    const { client } = fakeClient([r], false);
    const total = await changeRoomSettings(client, "r1", "host", { ...settings, scoring: "total" });
    console.log = quiet;
    check(total.ok && eq(r.selected_categories, encodeRoomSettings({ picks: ["logic", "retro"], rounds: 6 })) && !("scoring_mode" in r), "server, before the migration: Total score saves the settings without the column");
    console.log = () => {};
    const before = JSON.stringify(r.selected_categories);
    const plac = await changeRoomSettings(client, "r1", "host", { picks: ["logic"], rounds: 3, scoring: "placings" });
    console.log = quiet;
    check(!plac.ok && /isn't available yet/.test(plac.message) && JSON.stringify(r.selected_categories) === before, "server, before the migration: Placings is refused with a message and nothing changes");
    console.log = () => {};
    const none = await changeRoomSettings(client, "r1", "host", settings);
    console.log = quiet;
    check(none.ok, "server, before the migration: settings without a mode save as before");
  }
} finally {
  console.log = quiet;
}

/* ------------------------------------------------------------------ 6. the sheet */
const { Window } = await import("happy-dom");
const win = new Window({ url: "https://joulz.uk/duel/ABCD" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "KeyboardEvent", "PointerEvent", "HTMLFormElement", "HTMLInputElement", "HTMLButtonElement", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "MutationObserver", "CustomEvent"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  const bind = typeof value === "function" && !/^[A-Z]/.test(key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
(win as unknown as { ResizeObserver: unknown }).ResizeObserver = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { RoomSettingsSheet } = await import("../src/components/duel/RoomSettingsSheet");
const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as unknown as HTMLElement[];
const click = async (el: HTMLElement | null) => act(async () => void el?.click());
for (const withColumn of [false, true]) {
  let saved: unknown[] | null = null;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root.render(
      React.createElement(RoomSettingsSheet, {
        initial: { picks: ["word", "retro"], rounds: 6 },
        ...(withColumn ? { scoring: "total" as const } : {}),
        onSave: async (s, mode) => void (saved = [s, mode]),
        onClose: () => {},
      }),
    );
  });
  if (!withColumn) {
    check($$("[data-room-scoring-mode]").length === 0, "sheet, before the migration: no Scoring control");
    await click($("[data-room-settings-save]"));
    check(saved !== null && saved[1] === undefined, "sheet, before the migration: Save sends no mode");
  } else {
    check($$("[data-room-scoring-mode]").length === 2, "sheet: Scoring offers Total score and Placings");
    check($("[data-room-scoring-mode='total']")?.getAttribute("aria-pressed") === "true", "sheet: Total score chosen for a Total room");
    await click($("[data-room-scoring-mode='placings']"));
    check($("[data-room-scoring-mode='placings']")?.getAttribute("aria-pressed") === "true" && /points by place/.test($("[data-room-scoring-note]")?.textContent ?? ""), "sheet: Placings chosen, its note explains it");
    await click($("[data-room-settings-save]"));
    check(saved !== null && saved[1] === "placings", "sheet: Save sends Placings");
  }
  await act(async () => root.unmount());
  host.remove();
}

if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${checks} room-scoring check(s)`);
  process.exit(1);
}
console.log(
  `PASS: ${checks} checks: the points table for 2 to 16 players, Total score standings unchanged, Placings on 2, 8 and 16 players (ties share the higher points; most points, then total score, then time), the two-player outcome, awards and Play again's winner by mode, the server's writes before and after the migration, and the sheet's Scoring control`,
);
