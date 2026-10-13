/**
 * Tie-break time (13 Oct 2026, tieBreak.ts). Players level on points are split
 * by the total time they used, each round adding the time actually spent
 * against its own limit (the puzzle's stored timeLimitMs, else the registry
 * limit; the run length for arcade and engine rounds; Flash keeps its average
 * reaction; no answer = the whole limit). Proves:
 *
 *  - new rooms stamp every puzzle `tieRev: 1`, and the tie rounds carry the
 *    right limits (puzzle-own, registry, arcade run, engine run);
 *  - rooms mixing 45, 60, 90 and 120 s rounds rank by the real time used,
 *    including a missed round, a Mixed Signals finish, an arcade run and Flash;
 *  - rooms played before (unstamped, or not every round stamped) rank exactly
 *    as the original formula did;
 *  - equal totals with equal times still draw and share a position;
 *  - Mixed Signals stores its finishing time from the sim's finishing tick on
 *    stamped rounds (0 before), and its reveal bonus is the bonus in the score.
 *
 *   bun scripts/tie-break-check.ts
 */
import { buildRoomPuzzles, gradeAnswer } from "../src/lib/duel/generate.server";
import { PUZZLE_TYPES, puzzleDef, puzzleRunMs, puzzleTimeLimitMs, typeTimeLimitMs, usesArcadeClock } from "../src/lib/duel/registry";
import { duelOutcome, roundTimeUsedMs, standings, totalAnswerMs, type TieRound } from "../src/lib/duel/scoring";
import { TIE_REV, roomTieRounds, tieRoundFor } from "../src/lib/duel/tieBreak";
import { ROUND_MS, type DuelPlayerRow, type PuzzleData, type PuzzleType, type RoundResultRow } from "../src/lib/duel/types";
import { encodeColourClashRun, replayColourClashRun } from "../src/lib/duel/colourClash";
import {
  CLASH_CHECKPOINT_INTERVAL, CLASH_DROP, CLASH_INPUT_LANE, CLASH_SET_LANE, CLASH_WORLD_W, CLASH_REV3_RUN_TICKS, clashCheckpoint,
  clashGatesAt, clashLaneCount, clashRuleAt, clashTimeBonusOf, colourClashRev3Game, type ClashState,
} from "../src/lib/arcade/colourClash";
import { TICKS_PER_SECOND, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { buildStroop } from "../src/puzzles/stroop";

let failures = 0;
let passes = 0;
function check(ok: boolean, message: string) {
  if (ok) passes++;
  else {
    failures++;
    console.log(`  FAIL ${message}`);
  }
}

/* ---------------- stamping ---------------- */
let stamped = 0;
let rooms = 0;
for (let seed = 1; seed <= 40; seed++) {
  const { puzzles } = buildRoomPuzzles({ seed, categories: ["word", "number", "speed", "attention", "pattern", "logic", "arcade"] as never });
  rooms++;
  if (puzzles.every((p) => (p as { tieRev?: number }).tieRev === TIE_REV) && roomTieRounds(puzzles) !== null) stamped++;
}
check(stamped === rooms, `stamping: ${stamped}/${rooms} new rooms stamp every round tieRev ${TIE_REV}`);

// Limits: arcade and engine rounds use the run, everything else its own clock.
let limitsOk = true;
for (const type of PUZZLE_TYPES) {
  const puzzle = { type, tieRev: TIE_REV } as unknown as PuzzleData;
  const round = tieRoundFor(puzzle);
  const run = puzzleRunMs(puzzle);
  const expected = usesArcadeClock(type) ? run! : typeTimeLimitMs(type);
  if (round.limitMs !== expected || round.phaseLimitMs !== puzzleTimeLimitMs(puzzle) || round.flash !== (type === "reaction")) {
    limitsOk = false;
    console.log(`  ${type}: ${JSON.stringify(round)} expected limit ${expected}`);
  }
}
check(limitsOk, "limits: every type's tie round uses its registry limit, or its run length for arcade and engine rounds");
const ownLimit = tieRoundFor({ type: "tower", timeLimitMs: 120_000, tieRev: TIE_REV } as unknown as PuzzleData);
check(ownLimit.limitMs === 120_000, "limits: a puzzle's stored timeLimitMs wins over the registry limit");
check(tieRoundFor({ type: "stroop", tieRev: TIE_REV } as unknown as PuzzleData).limitMs === 75_000, "limits: Mixed Signals counts its 75 s run");

/* ---------------- fixtures ---------------- */
function typeWithLimit(ms: number): PuzzleType {
  const type = PUZZLE_TYPES.find((t) => !usesArcadeClock(t) && t !== "reaction" && typeTimeLimitMs(t) === ms && !puzzleDef(t).prepMs);
  if (!type) throw new Error(`no puzzle type with a ${ms} ms limit`);
  return type;
}
const arcadeType = PUZZLE_TYPES.find((t) => puzzleDef(t).category === "arcade")!;

function row(slot: number, round: number, score: number, msRemaining: number, reactionAvg: number | null = null): RoundResultRow {
  return {
    id: `${slot}-${round}`, duel_id: "room", player_slot: slot, round_number: round, answer: "x", is_correct: score > 0,
    ms_remaining: msRemaining, reaction_avg_ms: reactionAvg, correct_count: null, errors: null, extra: null, score,
    submitted_at: "2026-10-13T00:00:00Z",
  };
}
function player(slot: number): DuelPlayerRow {
  return {
    id: `p${slot}`, duel_id: "room", player_slot: slot, display_name: `P${slot}`, user_id: `u${slot}`, ready_round: 0,
    intro_ready_round: 0, muted_by_host: false, last_reaction_at: null, last_seen_at: "2026-10-13T00:00:00Z",
    status: "active", joined_at: "2026-10-13T00:00:00Z",
  };
}
/** The original sum, written out independently of scoring.ts. */
function legacyTotal(results: RoundResultRow[], slot: number): number {
  let sum = 0;
  for (const r of results) if (r.player_slot === slot) sum += r.reaction_avg_ms !== null ? r.reaction_avg_ms : ROUND_MS - r.ms_remaining;
  return sum;
}

// A room of 45, 60, 90 and 120 s rounds (120 s from a stored timeLimitMs),
// plus Mixed Signals, an arcade run and Flash.
const t45 = typeWithLimit(45_000);
const t60 = typeWithLimit(60_000);
const t90 = typeWithLimit(90_000);
const roomPuzzles = [
  { type: t45 },
  { type: t60 },
  { type: t90 },
  { type: "tower", timeLimitMs: 120_000 },
  { type: "stroop" },
  { type: arcadeType },
  { type: "reaction" },
].map((p) => ({ ...p, tieRev: TIE_REV })) as unknown as PuzzleData[];
const tie = roomTieRounds(roomPuzzles)!;
check(tie !== null && tie.length === 7, "mixed room: stamped rounds give seven tie rounds");
const limits = tie.map((r) => r.limitMs);
const phase = tie.map((r) => r.phaseLimitMs);
console.log(`  mixed room: ${roomPuzzles.map((p, i) => `${p.type} ${limits[i]! / 1000} s`).join(", ")}`);

/** Builds a player's rows from the time used per round (null = no answer; Flash: avg reaction). */
function rowsFor(slot: number, used: (number | null)[], scores: number[]): RoundResultRow[] {
  const out: RoundResultRow[] = [];
  used.forEach((ms, i) => {
    if (ms === null) return;
    if (tie[i]!.flash) out.push(row(slot, i + 1, scores[i]!, 0, ms));
    else out.push(row(slot, i + 1, scores[i]!, phase[i]! - ms));
  });
  return out;
}
const scores = [100, 100, 100, 100, 100, 100, 100];
// Player 1 is quick on the long rounds; player 2 on the short ones. Truth: the
// plain sum of time used (no answer = the whole limit).
const p1Used = [44_000, 59_000, 20_000, 30_000, 50_000, limits[5]!, 300];
const p2Used = [10_000, 12_000, 89_000, 119_000, 75_000, limits[5]!, 280];
const results = [...rowsFor(1, p1Used, scores), ...rowsFor(2, p2Used, scores)];
const truth1 = p1Used.reduce<number>((a, b) => a + (b ?? 0), 0);
const truth2 = p2Used.reduce<number>((a, b) => a + (b ?? 0), 0);
check(totalAnswerMs(results, 1, tie) === truth1 && totalAnswerMs(results, 2, tie) === truth2,
  `mixed room: totals are the time used (${totalAnswerMs(results, 1, tie)} vs ${truth1}, ${totalAnswerMs(results, 2, tie)} vs ${truth2})`);
check(duelOutcome(results, 1, 2, tie) === (truth1 < truth2 ? "win" : "loss"), "mixed room: the quicker total wins the tie");
const table = standings([player(1), player(2)], results, 7, undefined, tie);
check(table[0]!.slot === (truth1 < truth2 ? 1 : 2) && table[0]!.position === 1 && table[1]!.position === 2, "mixed room: standings rank the quicker total first");

// Every round adds its time used: a 120 s round with 100 s left adds 20 s, not -70 s.
check(roundTimeUsedMs(row(1, 4, 0, 100_000), tie[3]!) === 20_000, "120 s round: 100 s left adds 20 s used");
check(roundTimeUsedMs(row(1, 1, 0, 0), tie[0]!) === 45_000, "45 s round: no time left adds 45 s, not 30 s");
check(roundTimeUsedMs(undefined, tie[2]!) === 90_000, "90 s round: no answer adds the whole 90 s");
check(roundTimeUsedMs(row(1, 6, 0, phase[5]!), tie[5]!) === 0 && roundTimeUsedMs(row(1, 6, 0, 0), tie[5]!) === limits[5],
  "arcade round: held to the run length");
check(roundTimeUsedMs(row(1, 7, 0, 0, 312), tie[6]!) === 312, "Flash: keeps its average reaction time");

// A missed round costs its whole limit, so skipping can't buy the tie-break.
const skipper = [...rowsFor(1, [44_000, 59_000, null, 30_000, 50_000, limits[5]!, 300], scores)];
const finisher = [...rowsFor(2, [44_000, 59_000, 89_999, 30_000, 50_000, limits[5]!, 300], scores)];
check(duelOutcome([...skipper, ...finisher], 1, 2, tie) === "loss", "missed round: answering at the buzzer still beats not answering");
check(legacyTotal([...skipper, ...finisher], 1) < legacyTotal([...skipper, ...finisher], 2), "missed round: (the old sum let the skipper win)");

// Many random mixed rooms: the ranking always follows the plain sum of time used.
let rankingOk = true;
let seedState = 7;
const rand = (n: number) => {
  seedState = (Math.imul(seedState, 1103515245) + 12345) >>> 0;
  return seedState % n;
};
for (let trial = 0; trial < 500; trial++) {
  const players = [1, 2, 3, 4].map(player);
  const used = players.map(() => tie.map((r, i) => (rand(12) === 0 ? null : r.flash ? 150 + rand(1_000) : rand(limits[i]! + 1))));
  const flat = players.flatMap((p, k) => rowsFor(p.player_slot, used[k]!, scores));
  const sums = used.map((u, k) => u.reduce<number>((a, b, i) => a + (b ?? limits[i]!), 0) + 0 * k);
  const ranked = standings(players, flat.map((r) => ({ ...r, score: 100 })), 7, undefined, tie);
  // Every missing row scores 0, so compare only among equal totals.
  const totals = new Map(ranked.map((r) => [r.slot, r.total]));
  for (let a = 0; a < 4; a++)
    for (let b = 0; b < 4; b++) {
      const ra = ranked.find((r) => r.slot === a + 1)!;
      const rb = ranked.find((r) => r.slot === b + 1)!;
      if (totals.get(a + 1) !== totals.get(b + 1)) continue;
      if (sums[a]! < sums[b]! && !(ra.position < rb.position)) rankingOk = false;
      if (sums[a] === sums[b] && ra.position !== rb.position) rankingOk = false;
    }
}
check(rankingOk, "500 random four-player mixed rooms: level totals rank by the plain sum of time used");

/* ---------------- older rooms ---------------- */
const unstamped = roomPuzzles.map(({ tieRev: _t, ...p }) => p as unknown as PuzzleData);
check(roomTieRounds(unstamped) === null, "older rooms: unstamped rounds give no tie rounds");
const partly = [...roomPuzzles.slice(0, 6), unstamped[6]!];
check(roomTieRounds(partly) === null, "older rooms: a room whose rounds are not all stamped keeps the original tie-break");
let legacyOk = true;
for (let trial = 0; trial < 300; trial++) {
  const flat: RoundResultRow[] = [];
  for (const slot of [1, 2, 3])
    for (let round = 1; round <= 6; round++) {
      if (rand(10) === 0) continue;
      const reaction = rand(4) === 0 ? 200 + rand(800) : null;
      flat.push(row(slot, round, 50 + 50 * rand(2), rand(120_001), reaction));
    }
  const old = roomTieRounds(unstamped);
  for (const slot of [1, 2, 3]) if (totalAnswerMs(flat, slot, old) !== legacyTotal(flat, slot) || totalAnswerMs(flat, slot) !== legacyTotal(flat, slot)) legacyOk = false;
  const expect = (a: number, b: number) => {
    const sa = flat.filter((r) => r.player_slot === a).reduce((s, r) => s + r.score, 0);
    const sb = flat.filter((r) => r.player_slot === b).reduce((s, r) => s + r.score, 0);
    if (sa !== sb) return sa > sb ? "win" : "loss";
    const ta = legacyTotal(flat, a);
    const tb = legacyTotal(flat, b);
    return ta < tb ? "win" : ta > tb ? "loss" : "draw";
  };
  if (duelOutcome(flat, 1, 2, old) !== expect(1, 2) || duelOutcome(flat, 2, 3) !== expect(2, 3)) legacyOk = false;
  const ranked = standings([player(1), player(2), player(3)], flat, 6, undefined, old);
  const sorted = [1, 2, 3].map((s) => ({ s, total: flat.filter((r) => r.player_slot === s).reduce((a, r) => a + r.score, 0), ms: legacyTotal(flat, s) }));
  for (const x of sorted)
    for (const y of sorted) {
      const px = ranked.find((r) => r.slot === x.s)!.position;
      const py = ranked.find((r) => r.slot === y.s)!.position;
      const better = x.total > y.total || (x.total === y.total && x.ms < y.ms);
      if (better && !(px < py)) legacyOk = false;
    }
}
check(legacyOk, "older rooms: 300 random rooms rank, total and decide exactly as the original formula");

/* ---------------- draws ---------------- */
const same = [...rowsFor(1, p1Used, scores), ...rowsFor(2, p1Used, scores)];
check(duelOutcome(same, 1, 2, tie) === "draw", "draws: equal totals with equal times still draw");
const drawTable = standings([player(1), player(2)], same, 7, undefined, tie);
check(drawTable[0]!.position === 1 && drawTable[1]!.position === 1, "draws: level players share a position");
const sameOld = [row(1, 1, 80, 12_000), row(2, 1, 80, 12_000)];
check(duelOutcome(sameOld, 1, 2) === "draw", "draws: older rooms still draw on equal totals and times");

/* ---------------- Mixed Signals ---------------- */
function strong(state: ClashState): ArcadeInputEvent | null {
  const item = state.items.at(-1);
  if (!item || state.dropping) return null;
  const gates = clashGatesAt(state, state.tick + 1);
  const wanted = clashRuleAt(state, state.tick + 1) === 0 ? item.ink : item.word;
  const lane = gates.indexOf(wanted);
  if (lane !== state.lane) {
    const lanes = clashLaneCount(state.tick + 1);
    return { t: state.tick + 1, k: CLASH_INPUT_LANE, a: CLASH_SET_LANE, b: Math.floor(((lane + 0.5) * CLASH_WORLD_W) / lanes), c: 0, d: 0 };
  }
  return { t: state.tick + 1, k: CLASH_INPUT_LANE, a: CLASH_DROP, b: 0, c: 0, d: 0 };
}
let clashOk = true;
let bonusOk = true;
let bonusDiffers = 0;
for (let seed = 1; seed <= 12; seed++) {
  // Stamped speedPar like every live round, so the score uses the par curve.
  const puzzle = { ...buildStroop(), seed, speedPar: 1 };
  let s = colourClashRev3Game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const cps: ReturnType<typeof clashCheckpoint>[] = [];
  while (!colourClashRev3Game.isOver(s) && s.tick < CLASH_REV3_RUN_TICKS) {
    const e = strong(s);
    const sent = e && e.t % 2 === 0 ? e : null;
    if (sent) events.push(sent);
    s = colourClashRev3Game.step(s, sent);
    if (s.tick % CLASH_CHECKPOINT_INTERVAL === 0) cps.push(clashCheckpoint(s));
  }
  const raw = encodeColourClashRun({ seed, claimedScore: colourClashRev3Game.score(s), events, endTick: s.tick, checkpoints: cps });
  const finishMs = Math.round((s.finishTick * 1000) / TICKS_PER_SECOND);
  const limit = puzzleTimeLimitMs(puzzle as PuzzleData);
  // The phone submits a moment after the finish.
  const claimed = limit - finishMs - 400;
  const fresh = gradeAnswer({ ...puzzle, tieRev: TIE_REV } as unknown as PuzzleData, raw, claimed);
  const old = gradeAnswer(puzzle as unknown as PuzzleData, raw, claimed);
  const used = roundTimeUsedMs(row(1, 1, fresh.score, fresh.storedMs), tieRoundFor({ ...puzzle, tieRev: TIE_REV } as unknown as PuzzleData));
  if (s.finishTick <= 0 || fresh.storedMs !== claimed || old.storedMs !== 0 || fresh.score !== old.score || Math.abs(used - finishMs - 400) > 1) {
    clashOk = false;
    console.log(`  seed ${seed}: finish ${finishMs} ms stored ${fresh.storedMs} (old ${old.storedMs}) used ${used}`);
  }
  // A claim of more time than the finish allows is held to the finishing tick.
  const greedy = gradeAnswer({ ...puzzle, tieRev: TIE_REV } as unknown as PuzzleData, raw, limit);
  if (greedy.storedMs !== limit - finishMs) clashOk = false;
  // The reveal bonus is the bonus in the score, on whatever curve scored it.
  const replay = replayColourClashRun(seed, raw, 3);
  const unfinished = colourClashRev3Game.score({ ...replay.state, finishTick: 0 });
  const reveal = (fresh.extra as { reveal?: { lines: string[]; tiles: { label: string; value: string }[] } }).reveal;
  const line = reveal?.lines.find((l) => l.startsWith("time bonus"));
  if (replay.timeBonus !== fresh.score - unfinished || line !== `time bonus +${fresh.score - unfinished}`) {
    bonusOk = false;
    console.log(`  seed ${seed}: reveal ${JSON.stringify(line)} replay ${replay.timeBonus} vs score ${fresh.score} − ${unfinished}`);
  }
  if (clashTimeBonusOf(replay.state) !== replay.timeBonus) bonusDiffers++;
}
check(clashOk, "Mixed Signals: stamped rounds store the finishing time from the sim's finishing tick (older rounds 0), score unchanged");
check(bonusOk, "Mixed Signals: the reveal's time bonus equals the bonus inside the stored score");
console.log(`  Mixed Signals: the old linear line would have differed on ${bonusDiffers}/12 strong runs`);
const idle = gradeAnswer({ ...buildStroop(), seed: 3, tieRev: TIE_REV } as unknown as PuzzleData, "", 0);
check(idle.storedMs === 0 && roundTimeUsedMs(row(1, 1, 0, idle.storedMs), tieRoundFor({ type: "stroop", tieRev: TIE_REV } as unknown as PuzzleData)) === 75_000,
  "Mixed Signals: an unfinished run used the whole 75 s run");

console.log(`tie-break-check: ${passes} passed, ${failures} failed`);
if (failures) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
