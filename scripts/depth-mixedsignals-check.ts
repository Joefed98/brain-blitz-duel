/**
 * depth-mixedsignals-check (25 Oct 2026, depth to 200: docs/depth/d3-speed-attention.md "Mixed Signals"):
 * Mixed Signals' clashRev 8 (sort streak, "don't sort" words, gold words; scores to 200).
 *
 *  1. Legacy identity: 192 runs recorded on unmodified main (scripts/fixtures/depth-mixedsignals-legacy.json.gz,
 *     scripts/depth-mixedsignals-record.ts) on every older stamp (clashRev 7…3, the 52- and 18-word queues and the
 *     open stream) grade to their stored score, verdict and time, and replay to the same final checkpoint.
 *  2. Rooms, practice and the intro example deal clashRev 8; the game's maximum is 200.
 *  3. The rules: the plan (5 "don't sort" and 5 gold words, one of each per block, never side by side, the same
 *     for every player), a word let fall counts right and judges no gate, a touch on it is wrong and breaks the
 *     streak, inputs in its first 0.1 s are ignored, gold points double on a streak, an unfinished run is at most
 *     110 and a finish at least 120, a scripted perfect run scores 200 and a perfect run without the gold words
 *     cannot.
 *  4. Old versus new from the puzzle-fairness kit's players (40 room seeds each): median, top 10 % and best on
 *     clashRev 7 and clashRev 8. Average and good stay within 10 % of clashRev 7's medians, near-perfect lands
 *     140–170, the elite player 185–200; spam stays low.
 *
 *   bun scripts/depth-mixedsignals-check.ts   # ~25 s
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { gradeRoomAnswer } from "../src/lib/duel/roomGrade.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { replayColourClashRun } from "../src/lib/duel/colourClash";
import { buildStroop } from "../src/puzzles/stroop";
import {
  clashCheckpoint, clashDepthKindAt, clashGatesAt, clashLaneCount, clashRuleAt, clashVariantOf, colourClashDepthGame,
  CLASH_DROP, CLASH_GOLD_POINTS, CLASH_GOLDS, CLASH_INPUT_LANE, CLASH_QUEUE, CLASH_REV_DEPTH, CLASH_SET_LANE, CLASH_SKIP_GRACE_TICKS,
  CLASH_SKIPS, CLASH_WORLD_W, type ClashState,
} from "../src/lib/arcade/colourClash";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import type { PuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { hashText, makeRng, type Skill } from "./puzzle-fairness/kit";
import { pinPreTopup } from "../src/lib/duel/depthTopup";

// The puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md) deals newer stamps; this check proves the stamps it was
// written for, so new deals are pinned to them (depth-topup-check proves the top-up's).
pinPreTopup(true);

const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const quiet = <T>(fn: () => T): T => {
  const error = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = error;
  }
};

/* ============================== 1. Legacy identity ============================== */
interface LegacyRun { stamp: Record<string, unknown>; seed: number; label: string; answer: string; score: number; isCorrect: boolean; storedMs: number; checkpoint: unknown }
const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/depth-mixedsignals-legacy.json.gz")).toString()) as { runs: LegacyRun[] };
ok(legacy.runs.length === 192, `legacy fixture holds 192 runs (${legacy.runs.length})`);
for (const run of legacy.runs) {
  const p = { type: "stroop", seed: run.seed, ...run.stamp, speedPar: 1, puzzleScoreRev: 3 } as unknown as PuzzleData;
  const g = quiet(() => gradeAnswer(p, run.answer, 0));
  const tag = `${JSON.stringify(run.stamp)} ${run.label} ${run.seed}`;
  ok(g.score === run.score && g.isCorrect === run.isCorrect && g.storedMs === run.storedMs, `legacy ${tag}: grades to ${run.score}/${run.isCorrect} (got ${g.score}/${g.isCorrect})`);
  const r = replayColourClashRun(run.seed, run.answer, clashVariantOf(p as never));
  ok(JSON.stringify(clashCheckpoint(r.state)) === JSON.stringify(run.checkpoint), `legacy ${tag}: replays to the same final state`);
  ok(r.depth === undefined && r.state.depth === undefined, `legacy ${tag}: no depth play`);
}

/* ============================== 2. Stamps ============================== */
const dealt = generatePuzzle("stroop") as unknown as { clashRev?: number };
ok(dealt.clashRev === CLASH_REV_DEPTH, `rooms deal clashRev 8 (${dealt.clashRev})`);
ok(buildStroop().clashRev === CLASH_REV_DEPTH, "the puzzle module's own generator deals clashRev 8");
ok(roundMaxFor("stroop") === 200, "Mixed Signals' maximum is 200");

/* ============================== 3. Rules ============================== */
type Ev = Omit<ArcadeInputEvent, "t">;
/** Steps the depth game with a picker; returns the final state. */
function play(seed: number, pick: (s: ClashState, t: number) => Ev | null): ClashState {
  let s = colourClashDepthGame.init(seed);
  while (!colourClashDepthGame.isOver(s) && s.tick < colourClashDepthGame.runTicks) {
    const t = s.tick + 1;
    const ev = pick(s, t);
    s = colourClashDepthGame.step(s, ev ? ({ ...ev, t } as ArcadeInputEvent) : null);
  }
  return s;
}
/** The perfect oracle: steer to the right gate and drop `lag` ticks after a word appears; leave "don't sort" words. */
function oracle(opts: { lag?: number; skipGold?: boolean; touchSkip?: number } = {}): (s: ClashState, t: number) => Ev | null {
  const lag = opts.lag ?? 18;
  return (s, t) => {
    const item = s.items.at(-1)!;
    const age = t - item.spawn;
    if (item.kind === 1) return opts.touchSkip !== undefined && s.items.length - 1 === opts.touchSkip && age === CLASH_SKIP_GRACE_TICKS + 2 ? { k: CLASH_INPUT_LANE, a: CLASH_DROP, b: 0, c: 0, d: 0 } : null;
    // Steer at `lag`, drop 6 ticks later (it lands about 20 ticks after); a word that would land across a 15 s
    // swap waits for the swap first, as a player watching the banner does.
    let start = item.spawn + lag;
    if (Math.floor((start + 28) / 900) !== Math.floor(start / 900)) start = Math.floor((start + 28) / 900) * 900 + 1;
    const land = start + 28;
    const gates = clashGatesAt(s, land);
    const want = clashRuleAt(s, land) === 0 ? item.ink : item.word;
    let lane = gates.indexOf(want);
    if (opts.skipGold && item.kind === 2) lane = (lane + 1) % gates.length;
    if (t === start) return { k: CLASH_INPUT_LANE, a: CLASH_SET_LANE, b: Math.floor(((lane + 0.5) * CLASH_WORLD_W) / clashLaneCount(t)), c: 0, d: 0 };
    if (t === start + 6) return { k: CLASH_INPUT_LANE, a: CLASH_DROP, b: 0, c: 0, d: 0 };
    return null;
  };
}

for (let n = 0; n < 200; n++) {
  const seed = 31_000 + n * 97;
  const a = colourClashDepthGame.init(seed);
  const b = colourClashDepthGame.init(seed);
  const d = a.depth!;
  ok(JSON.stringify(a) === JSON.stringify(b), `seed ${seed}: the plan is the same every time`);
  ok(d.skips.length === CLASH_SKIPS && d.goldAt.length === CLASH_GOLDS, `seed ${seed}: 5 "don't sort" and 5 gold words`);
  const all = [...d.skips, ...d.goldAt].sort((x, y) => x - y);
  ok(all.every((v, i) => v >= 5 && v < CLASH_QUEUE && (i === 0 || v - all[i - 1]! >= 2)), `seed ${seed}: specials from word 6, never side by side (${all.join(",")})`);
  ok(clashDepthKindAt(d, 0) === 0 && a.items[0]!.kind === undefined, `seed ${seed}: the first word is plain`);
}

{
  const s = play(424_242, oracle());
  const r = colourClashDepthGame.score(s);
  ok(s.wrong === 0 && s.correct === CLASH_QUEUE && s.depth!.passed === CLASH_SKIPS && s.depth!.best === CLASH_QUEUE, `the perfect oracle sorts all 52 clean (${s.correct}/${s.wrong}, passed ${s.depth!.passed}, best ${s.depth!.best})`);
  ok(s.depth!.golds === CLASH_GOLDS && s.depth!.goldPts === CLASH_GOLDS * CLASH_GOLD_POINTS * 2, `every gold word on a streak earns double (${s.depth!.goldPts})`);
  ok(r === 200, `a quick, clean run with every gold word scores 200 (${r}, finish ${(s.finishTick / 60).toFixed(1)} s)`);
  const noGold = play(424_242, oracle({ skipGold: true }));
  ok(colourClashDepthGame.score(noGold) < 160, `the same run sorting every gold word wrong cannot reach 200 (${colourClashDepthGame.score(noGold)})`);
  const touched = play(424_242, oracle({ touchSkip: s.depth!.skips[1]! }));
  ok(touched.wrong === 1 && touched.depth!.touched === 1 && touched.depth!.best < CLASH_QUEUE, `touching a "don't sort" word is a wrong word and breaks the streak (${touched.wrong}, best ${touched.depth!.best})`);
  ok(colourClashDepthGame.score(touched) < 190, `one touch keeps the run off the top (${colourClashDepthGame.score(touched)})`);
  // Inputs inside the grace window are ignored (no touch, no lane change).
  const early = play(424_242, (st, t) => {
    const item = st.items.at(-1)!;
    if (item.kind === 1 && t - item.spawn === CLASH_SKIP_GRACE_TICKS) return { k: CLASH_INPUT_LANE, a: CLASH_DROP, b: 0, c: 0, d: 0 };
    return oracle()(st, t);
  });
  ok(early.depth!.touched === 0 && early.wrong === 0, "an input in a \"don't sort\" word's first 0.1 s is ignored");
  // Doing nothing: every word falls into the lane it spawned in; unfinished at most 110.
  const idle = play(424_242, () => null);
  ok(colourClashDepthGame.score(idle) <= 110, `an idle run scores at most 110 (${colourClashDepthGame.score(idle)})`);
}
// Through the server: a perfect run graded from its log, and identically as a room.
{
  const kit = (KITS as Record<string, (typeof KITS)[keyof typeof KITS]>)["stroop"]!;
  for (const seed of [7001, 7002, 7003]) {
    const p = roomPuzzle("stroop", seed);
    const steps = kit.play(p, makeRng(hashText(`depth:${seed}`)), { level: "near", pace: 0.3, err: 0, reactionMs: 140, reactionSd: 10 }, puzzleTimeLimitMs(p)).steps;
    const answer = steps.at(-1)!.answer;
    const g = quiet(() => gradeAnswer(p, answer, 0));
    const room = quiet(() => gradeRoomAnswer(p, { phase: "reveal", phaseStartedAt: new Date(100_000).toISOString(), nowMs: 100_100 }, answer, 0).graded);
    ok(room.score === g.score && room.isCorrect === g.isCorrect, `room ${seed}: a room grades the same (${room.score} vs ${g.score})`);
    const depth = (g.extra?.["depth"] ?? null) as Record<string, number> | null;
    ok(depth !== null && depth["base"]! + depth["gold"]! + depth["streak"]! + depth["stretch"]! === g.score, `room ${seed}: the stored parts add up to the score (${g.score})`);
    ok(g.isCorrect === (g.score >= 120), `room ${seed}: a finish is 120+ and only a finish (${g.score})`);
  }
}

/* ============================== 4. Old versus new ============================== */
const LEVELS: Record<string, Skill> = {
  average: { level: "average", pace: 1.7, err: 0.2, reactionMs: 300, reactionSd: 55 },
  good: { level: "good", pace: 1.0, err: 0.1, reactionMs: 230, reactionSd: 40 },
  great: { level: "great", pace: 0.72, err: 0.05, reactionMs: 190, reactionSd: 30 },
  near: { level: "near", pace: 0.5, err: 0.015, reactionMs: 160, reactionSd: 20 },
  elite: { level: "near" as Skill["level"], pace: 0.3, err: 0.003, reactionMs: 140, reactionSd: 15 },
};
const kit = (KITS as Record<string, (typeof KITS)[keyof typeof KITS]>)["stroop"]!;
const SEEDS = Array.from({ length: Number(process.env.DEPTH_SEEDS ?? 60) }, (_, n) => 5000 + n * 17);
const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return { median: s[Math.floor(s.length / 2)]!, p90: s[Math.floor(s.length * 0.9)]!, best: s[s.length - 1]!, mean: Math.round(s.reduce((a, b) => a + b, 0) / Math.max(1, s.length)) };
};
const table: Record<string, Record<number, ReturnType<typeof stats>>> = {};
for (const rev of [7, CLASH_REV_DEPTH]) {
  for (const [lv, skill] of Object.entries(LEVELS)) {
    const scores = SEEDS.map((seed) => {
      const p = { ...(roomPuzzle("stroop", seed) as object), clashRev: rev } as unknown as PuzzleData;
      const answer = kit.play(p, makeRng(hashText(`depth-ms:${seed}:${lv}`)), skill, puzzleTimeLimitMs(p)).steps.at(-1)!.answer;
      return quiet(() => gradeAnswer(p, answer, 0)).score;
    });
    (table[lv] ??= {})[rev] = stats(scores);
  }
  const spam = SEEDS.slice(0, 10).flatMap((seed) => {
    const p = { ...(roomPuzzle("stroop", seed) as object), clashRev: rev } as unknown as PuzzleData;
    return kit.spam(p, makeRng(hashText(`depth-ms-spam:${seed}`)), puzzleTimeLimitMs(p)).map((s) => quiet(() => gradeAnswer(p, s.answer, 0)).score);
  });
  (table["spam"] ??= {})[rev] = stats(spam);
}
const near = (a: number, b: number, pct: number) => Math.abs(a - b) <= Math.max(3, (b * pct) / 100);
// The solid levels by their mean (their medians sit on a step of the unfinished curve and jump with the seed set).
ok(near(table["average"]![8]!.mean, table["average"]![7]!.mean, 10), `average stays within 10 % (mean ${table["average"]![7]!.mean} → ${table["average"]![8]!.mean})`);
ok(near(table["good"]![8]!.mean, table["good"]![7]!.mean, 10), `good stays within 10 % (mean ${table["good"]![7]!.mean} → ${table["good"]![8]!.mean})`);
ok(table["near"]![8]!.median >= 140 && table["near"]![8]!.median <= 170, `near-perfect lands 140–170 (${table["near"]![8]!.median})`);
ok(table["elite"]![8]!.median >= 185 && table["elite"]![8]!.best <= 200, `the elite player reaches 185–200 (${table["elite"]![8]!.median}, best ${table["elite"]![8]!.best})`);
ok(table["elite"]![7]!.best <= 150, "clashRev 7 never scored past 150");
ok(table["spam"]![8]!.median <= 10 && table["spam"]![8]!.p90 <= 25, `spam stays low (${table["spam"]![8]!.median} / ${table["spam"]![8]!.p90})`);
const order = ["average", "good", "great", "near", "elite"];
for (let i = 1; i < order.length; i++) ok(table[order[i]!]![8]!.median >= table[order[i - 1]!]![8]!.median, `${order[i]} never below ${order[i - 1]} on clashRev 8`);

console.log(`Mixed Signals, clashRev 7 → clashRev 8 (${SEEDS.length} room seeds per level; median / top 10 % / best)`);
console.log("level    | clashRev 7 (mean · med / p90 / best) | clashRev 8 (mean · med / p90 / best)");
for (const lv of [...order, "spam"]) {
  const o = table[lv]![7]!, n = table[lv]![8]!;
  const cell = (x: ReturnType<typeof stats>) => `${String(x.mean).padStart(3)} · ${String(x.median).padStart(3)} / ${String(x.p90).padStart(3)} / ${String(x.best).padStart(3)}`;
  console.log(`${lv.padEnd(8)} | ${cell(o).padEnd(36)} | ${cell(n)}`);
}
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} depth-mixedsignals checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} depth-mixedsignals checks`);
