/**
 * Puzzle top-up check (26 Oct 2026, docs/depth/topup-oct-2026.md).
 *
 *   1. Legacy: every case in scripts/fixtures/depth-topup-legacy.json.gz (room puzzles on the stamps rooms dealt before
 *      the top-up, nothing, spam, every kit level's drafts and finish; recorded on main 6b42ef3 by
 *      scripts/depth-topup-record.ts) grades to exactly the stored score, verdict, time and extra.
 *   2. Deals: rooms deal each retuned game's new stamp, the puzzle otherwise exactly the one dealt before (pinPreTopup
 *      deals the old stamp). Mixed Signals' clashRev 9 plays clashRev 8 exactly (same state, no desync).
 *   3. The bar, on fresh seeds no tuning saw (scripts/depth-topup-bands.ts, each batch's own players): the good median
 *      within 10 % of the stamp before; near-perfect median 165–175 (150–165 for stretch-only games) with its top 10 %
 *      under about 185; the elite median at least about 175 and its top 10 % 190–200; no average or good run at 0;
 *      random play no higher than before (within a few points); nothing above 200.
 *
 *   bun scripts/depth-topup-check.ts [--part=k/n] [--seeds=40]
 *
 * Script-only.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { pinPreTopup } from "../src/lib/duel/depthTopup";
import { replayColourClashRun } from "../src/lib/duel/colourClash";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";
import { freshSeeds, measure, STRETCH_ONLY, TOPUP_GAMES, type GameMeasure } from "./depth-topup-bands";
import { TOPUP_FIXTURE, type TopupFixture } from "./depth-topup-record";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const [PART, PARTS] = (opt("part") ?? "1/1").split("/").map(Number) as [number, number];
const SEEDS = Number(opt("seeds") ?? 40);

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const quiet = <T>(f: () => T): T => {
  const e = console.error;
  console.error = () => {};
  try {
    return f();
  } finally {
    console.error = e;
  }
};

/** The stamp each retuned game's new deals carry: [field, live value before the top-up, the top-up's]. */
export const TOPUP_STAMPS: Partial<Record<PuzzleType, [string, number, number]>> = {
  reaction: ["tapRev", 5, 6],
  stopwatch: ["tapRev", 5, 6],
  chain: ["chainDepthRev", 1, 2],
  stroop: ["clashRev", 8, 9],
  symscan: ["scanRev", 2, 3],
  countup: ["countRev", 3, 4],
  wordsmith: ["wordsmithRev", 3, 4],
  tilegrid: ["tileGridRev", 1, 2],
  wordslide: ["wordSlideRev", 1, 2],
  wordhunt: ["wordHuntRev", 3, 4],
  strikeout: ["strikeoutRev", 5, 6],
  swapword: ["swapwordRev", 4, 5],
  letterwheel: ["wheelRev", 2, 3],
  safe: ["depthRev", 1, 2],
  sudoku: ["depthRev", 1, 2],
  flood: ["depthRev", 1, 2],
  shikaku: ["depthRev", 1, 2],
  blockparty: ["blockRev", 1, 2],
  pipes: ["pipesRev", 1, 2],
  laser: ["laserRev", 1, 2],
  rings: ["ringsRev", 1, 2],
  push: ["pushRev", 1, 2],
};
/** Measured and passing the bar before the top-up, so unchanged (no new stamp): Pull!, Cryptogrid, Chroma Lines. Lookout is left unchanged (docs). */
const UNCHANGED: PuzzleType[] = ["clayshoot", "codeword", "flow", "wordsearch"];

/** Known exceptions the bar allows (docs/depth/topup-oct-2026.md "Exceptions"). */
const ZERO_ALLOWANCE: Partial<Record<PuzzleType, number>> = {
  // An average player who runs out of time before the first try, with one dial (a guess's worth) set right.
  safe: 1,
};

const RETUNED = Object.keys(TOPUP_STAMPS) as PuzzleType[];
const inPart = <T>(xs: readonly T[]): T[] => xs.filter((_, i) => i % PARTS === PART - 1);

function deal(type: PuzzleType, seed: number, old: boolean): PuzzleData {
  const prev = pinPreTopup(old);
  try {
    const group = TOPUP_GAMES[type];
    return group === "logic" || group === "d4" ? withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed })) : roomPuzzle(type, seed);
  } finally {
    pinPreTopup(prev);
  }
}

/* ============================== 1. Legacy ============================== */
if (PART === 1) {
  const f = JSON.parse(gunzipSync(readFileSync(TOPUP_FIXTURE)).toString()) as TopupFixture;
  ok(f.cases.length >= 5000, `the legacy fixture has its cases (${f.cases.length})`);
  let bad = 0;
  for (const c of f.cases) {
    const puzzle = f.puzzles[`${c.type}:${c.seed}`]!;
    const g = quiet(() => gradeAnswer(puzzle, c.answer, c.ms));
    const same = g.score === c.score && g.isCorrect === c.isCorrect && g.storedMs === c.storedMs && JSON.stringify(g.extra ?? null) === JSON.stringify(c.extra);
    if (!same && bad++ < 30) failures.push(`legacy ${c.type} ${c.seed} ${c.label}: stored ${c.score}${c.isCorrect ? "✓" : ""}, now ${g.score}${g.isCorrect ? "✓" : ""}`);
    checks++;
  }
  ok(bad === 0, `every legacy case grades exactly as stored (${bad} differ)`);
  // Every recorded puzzle carries the stamp rooms dealt before the top-up.
  for (const [key, p] of Object.entries(f.puzzles)) {
    const stamp = TOPUP_STAMPS[p.type];
    if (stamp) ok((p as unknown as Record<string, unknown>)[stamp[0]] === stamp[1], `legacy ${key}: recorded on ${stamp[0]} ${stamp[1]}`);
  }
}

/* ============================== 2. Deals ============================== */
for (const type of inPart(RETUNED)) {
  const [field, before, after] = TOPUP_STAMPS[type]!;
  for (const seed of [11, 4242, 987_001]) {
    const now = deal(type, seed, false) as unknown as Record<string, unknown>;
    const old = deal(type, seed, true) as unknown as Record<string, unknown>;
    ok(now[field] === after, `${type} seed ${seed}: rooms deal ${field} ${after} (${String(now[field])})`);
    ok(old[field] === before, `${type} seed ${seed}: pinPreTopup deals ${field} ${before} (${String(old[field])})`);
    // Lightbender's dev readout times its own generation (stats.generationMs): wall clock, never part of the board.
    const strip = (p: Record<string, unknown>) => JSON.stringify({ ...p, [field]: 0, ...(p["stats"] ? { stats: { ...(p["stats"] as object), generationMs: 0 } } : {}) });
    ok(strip(now) === strip(old), `${type} seed ${seed}: the board is the one dealt before (only ${field} differs)`);
  }
}
if (inPart(RETUNED).includes("stroop")) {
  // clashRev 9 plays clashRev 8 exactly: the same run replays to the same state and checkpoints on both.
  for (const seed of [5001, 5002, 5003]) {
    const p = deal("stroop", seed, false) as Extract<PuzzleData, { type: "stroop" }>;
    for (const level of ["good", "near"] as const) {
      const answer = KITS.stroop!.play(p, makeRng(hashText(`topup-ms:${seed}:${level}`)), SKILLS[level], puzzleTimeLimitMs(p)).steps.at(-1)!.answer;
      const a = replayColourClashRun(p.seed, answer, 9);
      const b = replayColourClashRun(p.seed, answer, 8);
      // The run carries the score the phone's clashRev 9 sim claimed, so only clashRev 9 accepts it; the play must match on 8.
      ok(!a.flagged && a.desyncTick === null && b.desyncTick === null, `stroop ${seed} ${level}: the run replays on clashRev 9, and on clashRev 8 with no desync (${a.reason ?? ""})`);
      ok(a.correct === b.correct && a.wrong === b.wrong && a.state.finishTick === b.state.finishTick && a.depth?.base === b.depth?.base, `stroop ${seed} ${level}: clashRev 9 plays clashRev 8 (same words, finish and base)`);
      ok((a.depth?.gold ?? 0) >= (b.depth?.gold ?? 0) && (a.depth?.streak ?? 0) >= (b.depth?.streak ?? 0), `stroop ${seed} ${level}: clashRev 9's gold and streak never below clashRev 8's`);
    }
  }
}

/* ============================== 3. The bar ============================== */
const rows: string[] = [];
const fresh = freshSeeds(SEEDS);
for (const type of inPart([...RETUNED, ...UNCHANGED])) {
  const now = measure(type, fresh);
  const before: GameMeasure = measure(type, fresh, true);
  const l = now.levels;
  const label = `${type} (fresh seeds)`;
  rows.push(`${type}: good ${before.levels.good.median} → ${l.good.median}, near ${before.levels.near.median} → ${l.near.median} / ${l.near.top10}, elite ${before.levels.elite.median} → ${l.elite.median} / ${l.elite.top10}, zeros ${l.average.zeros}/${l.good.zeros}, random ${before.random.median}/${before.random.top10} → ${now.random.median}/${now.random.top10}`);
  if (UNCHANGED.includes(type)) {
    ok(JSON.stringify(now) === JSON.stringify(before), `${label}: unchanged by the top-up`);
    continue;
  }
  const g0 = before.levels.good.median;
  ok(Math.abs(l.good.median - g0) <= Math.max(3, 0.1 * g0), `${label}: good median within 10 % (${g0} → ${l.good.median})`);
  const [lo, hi] = STRETCH_ONLY.has(type) ? [150, 165] : [165, 175];
  ok(l.near.median >= lo && l.near.median <= hi, `${label}: near-perfect median ${lo}–${hi} (${l.near.median})`);
  ok(l.near.top10 <= 187, `${label}: near-perfect top 10 % about 185 or under (${l.near.top10})`);
  ok(l.elite.median >= 175, `${label}: elite median at least 175 (${l.elite.median})`);
  ok(l.elite.top10 >= 190 && l.elite.top10 <= 200, `${label}: elite top 10 % 190–200 (${l.elite.top10})`);
  ok(l.average.zeros + l.good.zeros <= (ZERO_ALLOWANCE[type] ?? 0), `${label}: no average or good run scores 0 (${l.average.zeros} / ${l.good.zeros})`);
  ok(now.random.median <= before.random.median + 3 && now.random.top10 <= before.random.top10 + 15, `${label}: random play stays near where it was (${before.random.median}/${before.random.top10} → ${now.random.median}/${now.random.top10})`);
  ok(Object.values(l).every((d) => d.top10 <= 200), `${label}: nothing above 200`);
}

for (const r of rows) console.log(r);
if (failures.length) {
  console.log(failures.slice(0, 60).map((f) => `  ✗ ${f}`).join("\n"));
  console.log(`FAIL depth-topup-check${PARTS > 1 ? ` part ${PART}/${PARTS}` : ""}: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS depth-topup-check${PARTS > 1 ? ` part ${PART}/${PARTS}` : ""}: ${checks} checks — legacy grades identical, new stamps deal the same boards, the bar holds on ${SEEDS} fresh seeds`);
