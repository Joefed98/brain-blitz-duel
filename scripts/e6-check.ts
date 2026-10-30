/**
 * Expansion E6 (25 Oct 2026, docs/expansions/e6.md): Coral Pop bubbleRev 8, Gemstone matchupRev 9 and Ball
 * Tracker btRev 7, each raised to 200 (docs/scoring-200.md).
 *
 *  1. Old rounds: 48 skill-band runs recorded with the code on main before the change on bubbleRev 5–7,
 *     matchupRev 6–8 and btRev 4–6 (scripts/fixtures/e6-legacy.json, scripts/e6-legacy.ts) replay through
 *     today's server path to the same score and the same final state (FNV-1a of the whole state), unflagged;
 *     their start states carry none of the new fields. 24 runs on the new stamps (scripts/fixtures/e6-runs.json)
 *     replay the same way.
 *  2. Rooms deal the new stamps; ROUND_MAX is 200 for the three; the intro demos stay stopped until recorded on them.
 *  3. Coral Pop: the 95-bubble reef, the danger line just above the gun, six chests in rows 3–9 never touching;
 *     a chest falling with a cluster pays, one destroyed by a mine or torpedo does not (crafted fields); bank
 *     shots and combos recounted independently from the state over bot runs.
 *  4. Gemstone: the 7 × 10 board in a 390 × 720 world; a frozen gem refuses a swap; a treasure gem is never
 *     matched or blasted and leaves the board only by being collected on the bottom row (over bot runs); goals
 *     never go below zero and a level is met exactly when its goal is.
 *  5. Ball Tracker: every one of the 300 btRev 7 bank courses brings all 36 marbles home on btRev 7 with its
 *     stored playbook; gold marbles, boosters and crossovers sit where the rules say; a crafted crossover meeting
 *     knocks both marbles out; a booster speeds a marble's next three steps; BT_V7_LAST_LAND_MIN is the earliest
 *     the last marble can land (search over the bank).
 *  6. Scores: each new stamp scores 0 with no input, never above 200, the base and feature parts add up to the
 *     stored score, and 200 is reachable (the top of both curves; Ball Tracker's near-perfect bot reaches it
 *     through the server replay).
 *
 *   bun scripts/e6-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import type { E6Record } from "./e6-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { bandTotal } from "../src/lib/arcade/scoreBands";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import type { PuzzleType } from "../src/lib/duel/types";
import {
  bubbleGameFor,
  bubbleReefParts,
  bubCheckpoint,
  bubDangerLine,
  bubRowsOf,
  bubV8FeatureBonus,
  BUB_BOMB,
  BUB_CHEST,
  BUB_COLS,
  BUB_INPUT_SHOT,
  BUB_LINE,
  BUB_REV_REEF,
  BUB_REV_CREDIT,
  BUB_REV_BLAST,
  BUB_REV_STD,
  BUB_V10_BOMB_RADIUS,
  BUB_V8_BAND_CURVE,
  BUB_V8_CHESTS,
  BUB_V8_FEATURE_CURVE,
  BUB_V8_LINE,
  BUB_V8_ROWS,
  BUB_V8_START_ROWS,
  type BubState,
} from "../src/lib/arcade/bubble";
import {
  matchupGameFor,
  matchupGoalsParts,
  matchupIndex,
  matchupRowsOf,
  MATCHUP_REV_GOALS,
  MATCHUP_REV_STD,
  MATCHUP_SIZE,
  MATCHUP_TREASURE,
  MATCHUP_V9_BAND_CURVE,
  MATCHUP_V9_FEATURE_CURVE,
  MATCHUP_V9_ROWS,
  MATCHUP_V9_TREASURE_ROW,
  MATCHUP_V9_WORLD_H,
  matchupWorldHFor,
  type MatchupState,
} from "../src/lib/arcade/matchup";
import {
  btCheckpoint,
  btLayout,
  btNext,
  btRotatable,
  btV7Parts,
  makeBallTrackGame,
  BT_HOPPER_COL,
  BT_REV_RUSH,
  BT_STEP_TICKS,
  BT_V7_BALLS,
  BT_V7_BAND_CURVE,
  BT_V7_BOOST_STEPS,
  BT_V7_BOOST_TICKS,
  BT_V7_DROP_TICKS,
  BT_V7_FEATURE_CURVE,
  BT_V7_GOLDS,
  BT_V7_H,
  BT_V7_LAST_LAND_MIN,
  BT_V7_ROWS,
  BT_COLS,
  type BtBall,
  type BtState,
} from "../src/lib/arcade/ballTrack";
import { replayBallTrackRun } from "../src/lib/duel/ballTrack";
import { BALL_TRACK_BANK_V7 } from "../src/lib/duel/ballTrackBankV7.server";
import { decodeInputEvents } from "../src/lib/arcade/engine";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
}
const section = (title: string) => console.log(`— ${title}`);

/* ============================== 1. Recorded runs ============================== */
section("Old rounds replay exactly; runs on the new stamps replay");
const NEW_FIELDS: Record<string, string[]> = {
  bubble: ["reef", "chests", "banks", "combos", "streak", "bounce", "shotBase"],
  matchup: ["goals", "ice", "goalLeft", "treasures", "cascadeExtra", "plan"],
  balltrack: ["r7", "golds", "boosts", "combos", "crashes"],
};
for (const file of ["scripts/fixtures/e6-legacy.json", "scripts/fixtures/e6-runs.json"]) {
  const fixture = JSON.parse(readFileSync(file, "utf8")) as { runs: E6Record[] };
  const legacy = file.includes("legacy");
  ok(fixture.runs.length === (legacy ? 48 : 24), `${file}: ${fixture.runs.length} runs`);
  for (const run of fixture.runs) {
    const spec: any = GAME_BY_TYPE.get(run.type as never)!;
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = spec.replay(run.seed, raw, run.rev);
    const tag = `${run.type} rev ${run.rev} ${run.level} (seed ${run.seed})`;
    ok(!result.flagged, `${tag}: replays flagged (${result.reason ?? ""})`);
    ok(result.score === run.score, `${tag}: stored ${run.score}, replays ${result.score}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `${tag}: final state differs`);
    if (legacy) {
      const start = spec.gameFor(run.rev, run.seed).init(run.seed);
      ok(NEW_FIELDS[run.type]!.every((k) => !(k in start)), `${tag}: an old start state carries a new field`);
    }
  }
}

/* ============================== 2. Stamps ============================== */
section("Rooms deal the new stamps; the maximum is 200; demos stay stopped");
const dealt = (type: PuzzleType) => generatePuzzle(type) as unknown as Record<string, unknown>;
// Coral Pop moved on to bubbleRev 11 (29 Oct 2026, the arcade scoring standard; bubble-standard-check); bubbleRev 10 replays here as before.
ok(dealt("bubble").bubbleRev === BUB_REV_STD, "Coral Pop: rooms deal bubbleRev 11 (bubbleRev 10's successor)");
// Gemstone moved on to matchupRev 10 (27 Oct 2026, phone-test notes; gemstone-rev10-check); matchupRev 9 replays here as before.
// The arcade scoring standard then moved it on to matchupRev 11 (gemstone-standard-check).
ok(dealt("matchup").matchupRev === MATCHUP_REV_STD, "Gemstone: rooms deal matchupRev 11 (a successor of matchupRev 9)");
{
  const bt = dealt("balltrack");
  // The arcade scoring standard (29 Oct 2026) deals btRev 8: btRev 7's play and bank, re-scored (arcade-standard-check).
  ok(bt.btRev === BT_REV_RUSH + 1, "Ball Tracker: rooms deal btRev 8 (btRev 7's play on the scoring standard)");
  ok((bt.course as any)?.rows === BT_V7_ROWS && (bt.course as any)?.balls.length === BT_V7_BALLS, "Ball Tracker: a 13-row, 36-marble course from the btRev 7 bank");
}
for (const type of ["bubble", "matchup", "balltrack"]) ok(roundMaxFor(type) === 200, `${type}: ROUND_MAX is 200`);
{
  const demo = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/bubbleRev !== BUB_REV_STD\) return null/.test(demo), "Coral Pop's demo stays stopped until recorded on bubbleRev 11 (its successor to 10)");
  ok(/matchupRev !== MATCHUP_REV_STD\) return null/.test(demo), "Gemstone's demo stays stopped until recorded on matchupRev 11 (a successor of 9)");
  // btRev 8 (the arcade scoring standard) keeps btRev 7's play: a demo recorded on either plays.
  ok(/!btIsV7Play\(demo\.puzzle\.btRev\)\) return null/.test(demo), "Ball Tracker's demo stays stopped until recorded on btRev 7 (or 8, the same play)");
}

/* ============================== 3. Coral Pop ============================== */
section("Coral Pop bubbleRev 8: the deeper reef, chests, bank shots and combos");
const reef = bubbleGameFor(BUB_REV_REEF);
for (const seed of [1, 7, 12345, 987654321]) {
  const s = reef.init(seed) as BubState;
  const chests = s.grid.flatMap((v, i) => (v === BUB_CHEST ? [i] : []));
  ok(bubRowsOf(s.grid) === BUB_V8_ROWS && s.startCount === 95, `seed ${seed}: a ${BUB_V8_START_ROWS}-row reef of 95 bubbles in ${BUB_V8_ROWS} rows (${s.startCount})`);
  ok(chests.length === BUB_V8_CHESTS && chests.every((i) => Math.floor(i / BUB_COLS) >= 3 && Math.floor(i / BUB_COLS) <= 9), `seed ${seed}: ${BUB_V8_CHESTS} chests in rows 3–9`);
  ok(bubDangerLine(s) === BUB_V8_LINE && s.worldH === 730, `seed ${seed}: the danger line at ${BUB_V8_LINE} in the 730 tank`);
  ok(!s.queue.includes(BUB_CHEST), `seed ${seed}: no chest in the queue`);
}
/** A crafted field: row 0 full (colour 3, but (0,4) and (0,5) colour 2), a chest at (1,4) under them, (1,5) colour 2. */
function craftedReef(shot: number): BubState {
  const s = reef.init(1) as BubState;
  const grid = new Array<number>(s.grid.length).fill(0);
  for (let col = 0; col < BUB_COLS; col++) grid[col] = col === 4 || col === 5 ? 2 : 3;
  grid[BUB_COLS + 4] = BUB_CHEST;
  grid[BUB_COLS + 5] = 2;
  const queue = [...s.queue];
  queue[0] = shot;
  return { ...s, grid, queue, queueAt: 0, startCount: 12 };
}
function shootUp(s0: BubState): BubState {
  // Slightly right of straight up, so it sticks under (1,5) rather than tying between two cells under the chest.
  let s = reef.step(s0, { t: 1, k: BUB_INPUT_SHOT, a: 100, b: -4096, c: 0, d: 0 });
  for (let i = 0; i < 400 && s.flightColour !== 0; i++) s = reef.step(s, null);
  return s;
}
{
  const popped = shootUp(craftedReef(2));
  ok(!popped.grid.includes(BUB_CHEST) && popped.chests === 1, `a colour-2 shot pops the pair over the chest and the chest falls and pays (chests ${popped.chests})`);
  const bombed = shootUp(craftedReef(BUB_BOMB));
  ok(!bombed.grid.slice(0, 2 * BUB_COLS).includes(BUB_CHEST) && bombed.chests === 0, `a mine that destroys the chest pays nothing (chests ${bombed.chests})`);
  const drilled = shootUp(craftedReef(BUB_LINE));
  ok(!drilled.grid.includes(BUB_CHEST) && drilled.chests === 0, `a torpedo that drills the chest pays nothing (chests ${drilled.chests})`);
  const missed = shootUp(craftedReef(1));
  ok(missed.grid.includes(BUB_CHEST) && missed.chests === 0 && missed.streak === 0, "a shot that pops nothing leaves the chest and ends the streak");
}
// Bank shots and combos recounted from the states of real runs (wall bounces = vx sign flips in flight).
{
  const spec: any = GAME_BY_TYPE.get("bubble" as never)!;
  const { bot } = await import("./arcade-skill-bands/bots/bubble.ts");
  let paid = 0;
  for (const [level, n] of [["good", 0], ["near", 1]] as const) {
    const seed = spec.seedFor(n);
    const events = bot({ game: reef, seed, rev: BUB_REV_REEF, human: new Human("bubble", seed, level) }).events ?? [];
    const byTick = new Map(events.map((e: any) => [e.t, e]));
    let s = reef.init(seed) as BubState;
    let banks = 0, combos = 0, streak = 0, flips = 0, base = 0, lastShots = 0;
    while (!reef.isOver(s)) {
      const prev = s;
      s = reef.step(s, (byTick.get(s.tick + 1) as any) ?? null);
      if (prev.flightColour === 0 && s.flightColour !== 0) flips = 0;
      if (s.flightColour !== 0 && prev.flightColour !== 0 && Math.sign(s.vx) !== Math.sign(prev.vx)) flips++;
      if (s.flightColour !== 0 && prev.flightColour === 0 && prev.vx !== 0 && Math.sign(s.vx) !== Math.sign(prev.vx)) void 0;
      if (s.shots > lastShots) {
        const removed = s.popped + s.dropped - base;
        // A bounce on the landing tick itself shows only in the final vx (it is kept after the flight).
        const bounced = flips > 0 || (prev.flightColour !== 0 && Math.sign(s.vx) !== Math.sign(prev.vx));
        if (removed > 0) {
          streak++;
          if (streak >= 2) combos++;
          if (bounced) banks++;
        } else streak = 0;
        base = s.popped + s.dropped;
        lastShots = s.shots;
        flips = 0;
      }
    }
    ok(banks === s.banks && combos === s.combos, `${level}: banks ${s.banks} and combos ${s.combos} match the recount (${banks}, ${combos})`);
    paid += s.chests ?? 0;
    const parts = bubbleReefParts(s);
    ok(reef.score(s) === bandTotal(parts, Boolean(s.acted), 200), `${level}: the score is its breakdown`);
  }
  ok(paid > 0, "chests pay in real play");
}

/* ============================== 3b. Coral Pop bubbleRev 10 ============================== */
section("Coral Pop bubbleRev 10 (phone notes): the mine blasts two rings; everything else is bubbleRev 9");
{
  const credit = bubbleGameFor(BUB_REV_CREDIT);
  const blast = bubbleGameFor(BUB_REV_BLAST);
  for (const seed of [1, 7, 12345, 987654321, 2_000_000_011]) {
    const b = blast.init(seed) as BubState;
    const c = credit.init(seed) as BubState;
    ok(b.bombR === BUB_V10_BOMB_RADIUS && JSON.stringify({ ...b, bombR: undefined }) === JSON.stringify(c), `seed ${seed}: bubbleRev 10 starts as bubbleRev 9 (field, queue, chests) with the blast radius ${BUB_V10_BOMB_RADIUS}`);
    ok(c.bombR === undefined && (reef.init(seed) as BubState).bombR === undefined, `seed ${seed}: older starts carry no blast radius`);
    ok(bubCheckpoint(b).checksum !== bubCheckpoint(c).checksum, `seed ${seed}: the checksum folds the radius in`);
  }
  /** A full reef five rows deep (colour 3), the mine first in the queue, shot straight up. */
  const minedReef = (game: typeof blast): BubState => {
    const s = game.init(1) as BubState;
    const grid = new Array<number>(s.grid.length).fill(0);
    for (let i = 0; i < 5 * BUB_COLS; i++) grid[i] = 3;
    const queue = [...s.queue];
    queue[0] = BUB_BOMB;
    return { ...s, grid, queue, queueAt: 0, startCount: 5 * BUB_COLS };
  };
  const fire = (game: typeof blast, s0: BubState): BubState => {
    let s = game.step(s0, { t: 1, k: BUB_INPUT_SHOT, a: 100, b: -4096, c: 0, d: 0 });
    for (let i = 0; i < 400 && s.flightColour !== 0; i++) s = game.step(s, null);
    return s;
  };
  const old = fire(credit, minedReef(credit));
  const big = fire(blast, minedReef(blast));
  ok(old.lastSpecial === BUB_BOMB && big.lastSpecial === BUB_BOMB && old.lastSpecialCell === big.lastSpecialCell, `the mine lands on the same cell on both stamps (${old.lastSpecialCell})`);
  ok((old.lastSpecialCleared ?? 0) > 0 && (old.lastSpecialCleared ?? 0) <= 6, `bubbleRev 9's mine clears one ring (${old.lastSpecialCleared})`);
  ok((big.lastSpecialCleared ?? 0) >= (old.lastSpecialCleared ?? 0) + 4 && (big.lastSpecialCleared ?? 0) <= 18, `bubbleRev 10's mine clears two rings (${big.lastSpecialCleared}, was ${old.lastSpecialCleared})`);
  // Real play through the server replay on the new stamp.
  const spec: any = GAME_BY_TYPE.get("bubble" as never)!;
  const { bot } = await import("./arcade-skill-bands/bots/bubble.ts");
  for (const [level, n] of [["weak", 0], ["good", 1], ["near", 2]] as const) {
    const seed = spec.seedFor(n);
    const events = bot({ game: blast, seed, rev: BUB_REV_BLAST, human: new Human("bubble", seed, level) }).events ?? [];
    const byTick = new Map(events.map((e: any) => [e.t, e]));
    let s = blast.init(seed) as BubState;
    const checkpoints: unknown[] = [];
    while (!blast.isOver(s) && s.tick < blast.runTicks) {
      s = blast.step(s, (byTick.get(s.tick + 1) as any) ?? null);
      if (s.tick % 300 === 0) checkpoints.push(spec.checkpoint(s));
    }
    const claimed = blast.score(s);
    const result = spec.replay(seed, spec.encode({ seed, claimedScore: claimed, events, endTick: s.tick, checkpoints }, BUB_REV_BLAST, seed), BUB_REV_BLAST);
    ok(!result.flagged && result.score === claimed && claimed > 0 && claimed <= 200, `${level}: a bubbleRev 10 run (${claimed}) replays through the server to ${result.score}`);
  }
}

/* ============================== 4. Gemstone ============================== */
section("Gemstone matchupRev 9: the taller board, goals, ice, treasure and cascades");
const goals = matchupGameFor(MATCHUP_REV_GOALS);
ok(matchupWorldHFor(MATCHUP_REV_GOALS) === MATCHUP_V9_WORLD_H && matchupWorldHFor(8) === 560, "the 720 world on matchupRev 9 only");
for (const seed of [1, 99, 424242]) {
  const s = goals.init(seed) as MatchupState;
  ok(matchupRowsOf(s.cells) === MATCHUP_V9_ROWS && s.cells.length === 70, `seed ${seed}: a 7 × 10 board`);
  ok(s.cells.indexOf(MATCHUP_TREASURE) >= MATCHUP_V9_TREASURE_ROW * MATCHUP_SIZE && s.cells.indexOf(MATCHUP_TREASURE) < (MATCHUP_V9_TREASURE_ROW + 1) * MATCHUP_SIZE, `seed ${seed}: the first treasure in row ${MATCHUP_V9_TREASURE_ROW}`);
  ok((s.ice ?? []).reduce((n, v) => n + v, 0) === 4 && (s.ice ?? []).every((v, i) => !v || i >= 4 * MATCHUP_SIZE), `seed ${seed}: four frozen cells, rows 4–9`);
  // A frozen gem refuses a swap (with any neighbour).
  const iced = (s.ice ?? []).indexOf(1);
  const r = Math.floor(iced / MATCHUP_SIZE), c = iced % MATCHUP_SIZE;
  const nb = c + 1 < MATCHUP_SIZE ? [r, c + 1] : [r, c - 1];
  const after = goals.step(s, { t: 1, k: 3, a: r, b: c, c: nb[0]!, d: nb[1]! }) as MatchupState;
  ok(after.swaps === 0 && after.lastInvalidTick === 1, `seed ${seed}: a swap with a frozen gem is refused`);
}
{
  const spec: any = GAME_BY_TYPE.get("matchup" as never)!;
  const { bot } = await import("./arcade-skill-bands/bots/matchup.ts");
  let collected = 0, levelsMet = 0;
  for (const level of ["average", "near"] as const)
    for (let n = 0; n < 4; n++) {
      const seed = spec.seedFor(n);
      const events = bot({ game: goals, seed, rev: MATCHUP_REV_GOALS, human: new Human("matchup", seed, level) }).events ?? [];
      const byTick = new Map(events.map((e: any) => [e.t, e]));
      let s = goals.init(seed) as MatchupState;
      while (!goals.isOver(s)) {
        const prev = s;
        s = goals.step(s, (byTick.get(s.tick + 1) as any) ?? null) as MatchupState;
        if (s.swaps === prev.swaps) continue;
        const gone = (s.treasures ?? 0) - (prev.treasures ?? 0);
        const before = prev.cells.filter((k) => k === MATCHUP_TREASURE).length;
        const nowOn = s.cells.filter((k) => k === MATCHUP_TREASURE).length;
        const placed = (s.treasurePlaced ?? 0) - (prev.treasurePlaced ?? 0);
        ok(before - nowOn + placed === gone, `${level} #${n} tick ${s.tick}: a treasure left the board without being collected`);
        ok((s.goalLeft ?? []).every((x) => x >= 0), `${level} #${n}: a goal below zero`);
        if ((s.levels ?? 0) > (prev.levels ?? 0)) {
          levelsMet++;
          ok((s.level ?? 0) === (prev.level ?? 0) + 1, `${level} #${n}: a level met moves to the next`);
        }
        ok((s.cascadeExtra ?? 0) >= (prev.cascadeExtra ?? 0) && (s.lastSteps > 1 || s.cascadeExtra === prev.cascadeExtra), `${level} #${n}: cascade extra only from cascade steps`);
      }
      collected += s.treasures ?? 0;
      ok(goals.score(s) === bandTotal(matchupGoalsParts(s), Boolean(s.acted), 200), `${level} #${n}: the score is its breakdown`);
    }
  ok(collected > 0 && levelsMet > 0, `treasure is collected (${collected}) and goals are met (${levelsMet}) in real play`);
}

/* ============================== 5. Ball Tracker ============================== */
section("Ball Tracker btRev 7: the bank, gold marbles, boosters, crossovers and the earliest landing");
ok(BT_V7_H === 58 + 13 * 100 + 42, "the 13-row board is 700 × 1400");
ok(BALL_TRACK_BANK_V7.length === 300, `300 bank courses (${BALL_TRACK_BANK_V7.length})`);
let earliest = Infinity;
for (const [index, entry] of BALL_TRACK_BANK_V7.entries()) {
  const c = entry.course;
  const layout = btLayout(c);
  const rot = new Set(btRotatable(c));
  ok(c.rows === BT_V7_ROWS && c.balls.length === BT_V7_BALLS && layout.rows === BT_V7_ROWS, `course ${index}: 13 rows, 36 marbles`);
  ok((c.gold ?? []).length === BT_V7_GOLDS && (c.gold ?? []).every((g) => g >= 2 && g < BT_V7_BALLS), `course ${index}: ${BT_V7_GOLDS} gold marbles`);
  ok((c.boost ?? []).length === 3 && (c.cross ?? []).length === 2, `course ${index}: three boosters and two crossovers`);
  ok([...(c.boost ?? []), ...(c.cross ?? [])].every((cell) => c.fixed.includes(cell) && !rot.has(cell) && layout.kind[cell] === 1 && cell % BT_COLS !== BT_HOPPER_COL), `course ${index}: boosters and crossovers are fixed straights off the hopper column`);
  ok((c.cross ?? []).every((cell) => rot.has(cell - BT_COLS)), `course ${index}: a marble can drop into each crossover`);
  ok(!(c.boost ?? []).some((cell) => (c.cross ?? []).includes(cell)), `course ${index}: no booster on a crossover`);
  if (index % 3 === 0 || process.env["CHECKS_FULL"]) {
    // The stored playbook proves the course on the btRev 7 rules: all 36 home.
    const game = makeBallTrackGame(c, BT_REV_RUSH);
    const log = new Map(decodeInputEvents(entry.playbook).map((e) => [e.t, e]));
    let s = game.init(1);
    while (!game.isOver(s)) s = game.step(s, log.get(s.tick + 1) ?? null);
    ok(s.home === BT_V7_BALLS && s.lastLand === entry.endTick, `course ${index}: its playbook brings ${s.home} of 36 home (ends ${s.lastLand}, stored ${entry.endTick})`);
  }
  earliest = Math.min(earliest, entry.endTick);
}
{
  // The earliest the last marble can land, over every course: the last release, then the fastest route
  // (boosters taken at their best) into any cup at any layout.
  let best = Infinity;
  const release = 1 + (BT_V7_BALLS - 1) * BT_V7_DROP_TICKS;
  for (const { course: c } of BALL_TRACK_BANK_V7) {
    const rot = new Set(btRotatable(c));
    const kind = btLayout(c).kind;
    for (const trays of [c.trays, c.relay.trays, c.shuffle.trays]) {
      const fixedTrays = { ...c, trays, relay: { tick: 1e9, trays }, shuffle: { tick: 1e9, trays } };
      const seen = new Map<string, number>();
      const queue: { cell: number; above: boolean; b: number; t: number }[] = [{ cell: BT_HOPPER_COL, above: true, b: 0, t: release + BT_STEP_TICKS }];
      while (queue.length) {
        queue.sort((a, b) => a.t - b.t);
        const n = queue.shift()!;
        const key = `${n.cell}|${n.above}|${n.b}`;
        if ((seen.get(key) ?? Infinity) <= n.t) continue;
        seen.set(key, n.t);
        const b = c.boost?.includes(n.cell) ? BT_V7_BOOST_STEPS : n.b;
        const dt = b > 0 ? BT_V7_BOOST_TICKS : BT_STEP_TICKS;
        for (const v of kind[n.cell] === 2 ? [false] : rot.has(n.cell) ? [false, true] : [false]) {
          const next = btNext(n.cell, n.above, v, fixedTrays, 0, 0);
          if (next.cell >= 100) best = Math.min(best, n.t + dt);
          else if (next.cell >= 0) queue.push({ cell: next.cell, above: next.fromAbove, b: b > 0 ? b - 1 : 0, t: n.t + dt });
        }
      }
    }
  }
  ok(best === BT_V7_LAST_LAND_MIN, `the earliest last landing is ${best} (BT_V7_LAST_LAND_MIN ${BT_V7_LAST_LAND_MIN})`);
  ok(earliest >= BT_V7_LAST_LAND_MIN, `no proving playbook lands its last marble before it (${earliest})`);
}
{
  // Crafted: a marble rolling along a row into a crossover meets one dropping into it from above: both are lost.
  const c = BALL_TRACK_BANK_V7[0]!.course;
  const game = makeBallTrackGame(c, BT_REV_RUSH);
  const x = c.cross![0]!;
  const dir = Math.floor(x / BT_COLS) % 2 === 0 ? 1 : -1;
  const base = game.init(1);
  // The tile before it along the row: a row-start corner turns a marble from above along the row; a tube must lie flat.
  const sideAbove = btLayout(c).kind[x - dir] === 2 ? 1 : 0;
  const side: BtBall = { id: 0, colour: 0, cell: x - dir, from: x - 2 * dir, above: sideAbove, arrived: 0, at: 1, steps: 3, bst: 0 };
  const top: BtBall = { id: 1, colour: 1, cell: x - BT_COLS, from: x - 2 * BT_COLS, above: 1, arrived: 0, at: 1, steps: 3, bst: 0 };
  const vert = [...base.vert];
  vert[x - BT_COLS] = 1;
  vert[x - dir] = 0;
  const met = game.step({ ...base, tick: 1, next: BT_V7_BALLS, balls: [side, top], vert }, null);
  ok(met.balls.length === 0 && met.lost === 2 && met.crashes === 1 && met.streak === 0, `two marbles meeting in a crossover are both knocked out (lost ${met.lost}, crashes ${met.crashes})`);
  // One alone passes straight through: from above it goes down, along the row it goes on.
  const alone = game.step({ ...base, tick: 1, next: BT_V7_BALLS, balls: [top], vert }, null);
  ok(alone.balls[0]?.cell === x && alone.balls[0]?.above === 1, "a marble from above enters the crossover");
  ok(btNext(x, true, false, c).cell === x + BT_COLS && btNext(x, false, false, c).cell === x + dir, "a crossover passes a marble from above down, along the row on");
  // A booster: the next three steps take half the time.
  const boost = c.boost![0]!;
  const bdir = Math.floor(boost / BT_COLS) % 2 === 0 ? 1 : -1;
  const runner: BtBall = { id: 0, colour: 0, cell: boost - bdir, from: boost - 2 * bdir, above: btLayout(c).kind[boost - bdir] === 2 ? 1 : 0, arrived: 0, at: 1, steps: 3, bst: 0 };
  const flat = [...base.vert];
  flat[boost - bdir] = 0;
  let s: BtState = { ...base, tick: 0, next: BT_V7_BALLS, balls: [runner], vert: flat };
  s = game.step(s, null);
  ok(s.balls[0]?.cell === boost && s.balls[0]?.at === s.tick + BT_V7_BOOST_TICKS && s.balls[0]?.bst === BT_V7_BOOST_STEPS - 1, "a marble on a booster moves on at double speed");
  ok(btCheckpoint(s).checksum !== btCheckpoint({ ...s, balls: s.balls.map((b) => ({ ...b, bst: 0 })) }).checksum, "the boost is in the checkpoint checksum");
}

/* ============================== 6. Scores ============================== */
section("Scores: 0 with no input, never above 200, 200 at the top of both curves");
{
  const idle = <S>(game: { init: (seed: number) => S; step: (s: S, i: null) => S; isOver: (s: S) => boolean; score: (s: S) => number }, seed: number) => {
    let s = game.init(seed);
    while (!game.isOver(s)) s = game.step(s, null);
    return game.score(s);
  };
  ok(idle(reef, 5) === 0 && idle(goals, 5) === 0 && idle(makeBallTrackGame(BALL_TRACK_BANK_V7[3]!.course, BT_REV_RUSH), 1) === 0, "no input scores 0 on each new stamp");
  const top = (curve: { units: readonly number[]; points: readonly number[] }) => curve.points[curve.points.length - 1]!;
  ok(top(BUB_V8_BAND_CURVE) === 140 && top(BT_V7_BAND_CURVE) === 140 && top(MATCHUP_V9_BAND_CURVE) === 150, "base curves top out at 140 (finish games, + up to 10) and 150 (Gemstone)");
  ok(top(BUB_V8_FEATURE_CURVE) === 50 && top(MATCHUP_V9_FEATURE_CURVE) === 50 && top(BT_V7_FEATURE_CURVE) === 50, "each feature bonus tops out at 50");
  // Coral Pop: a reef cleared at once with every feature maxed is 200; one bubble fewer is not.
  const s0 = reef.init(1) as BubState;
  const full: BubState = { ...s0, acted: 1, cleared: true, endedTick: 600, grid: s0.grid.map(() => 0), chests: 6, banks: 30, combos: 30 };
  ok(reef.score(full) === 200 && bubV8FeatureBonus(full) === 50, `a fast clear with every feature is 200 (${reef.score(full)})`);
  ok(reef.score({ ...full, cleared: false, grid: s0.grid.map((_, i) => (i === 0 ? 1 : 0)), chests: 0, banks: 0, combos: 0 }) < 150, "a near-clear without features stays under 150");
  const g0 = goals.init(1) as MatchupState;
  ok(goals.score({ ...g0, acted: 1, raw: 3200, levels: 4, iceBroken: 10, treasures: 2, cascadeExtra: 400 }) === 200, "Gemstone: the base curve's top with 52+ feature points is 200");
  ok(goals.score({ ...g0, acted: 1, raw: 3200 }) === 150, "Gemstone: without features its top is 150");
  // Ball Tracker: the near-perfect bot reaches 200 through the server replay on some course.
  const spec: any = GAME_BY_TYPE.get("balltrack" as never)!;
  const { bot } = await import("./arcade-skill-bands/bots/balltrack.ts");
  let best = 0;
  for (let n = 0; n < 30 && best < 200; n++) {
    const seed = spec.seedFor(n);
    const game = spec.gameFor(BT_REV_RUSH, seed);
    const events = bot({ game, seed, rev: BT_REV_RUSH, human: new Human("balltrack", seed, "near") }).events ?? [];
    let s = game.init(seed);
    const cps: unknown[] = [];
    const byTick = new Map(events.map((e: any) => [e.t, e]));
    while (!game.isOver(s)) {
      s = game.step(s, byTick.get(s.tick + 1) ?? null);
      if (s.tick % 300 === 0) cps.push(btCheckpoint(s));
    }
    const raw = spec.encode({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints: cps }, BT_REV_RUSH, seed);
    const result = replayBallTrackRun(game.course, seed, raw, BT_REV_RUSH);
    ok(!result.flagged && result.score <= 200, `balltrack near #${n}: replays unflagged within 200`);
    ok(result.score === bandTotal(btV7Parts(result.state), Boolean(result.state.acted), 200), `balltrack near #${n}: the score is its breakdown`);
    best = Math.max(best, result.score);
  }
  ok(best === 200, `Ball Tracker: 200 reached through the server replay (best ${best})`);
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL e6-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS e6-check: ${checks} checks — old Coral Pop, Gemstone and Ball Tracker rounds replay exactly; the new stamps' reef, goals, ice, treasure, bank, boosters, crossovers and scores to 200`);
