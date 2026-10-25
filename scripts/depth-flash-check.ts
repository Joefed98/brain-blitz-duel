/**
 * depth-flash-check (25 Oct 2026, Depth to 200; docs/depth/d3-speed-attention.md): Flash `tapRev: 5`, STRETCH
 * plus the steady-hand bonus (src/lib/duel/depth/flash.ts).
 *
 *  1. Legacy: 140 runs recorded on main (scripts/fixtures/depth-speed-legacy.json.gz, tapRev 4) grade exactly as
 *     stored (score, figures, extra), and every older stamp keeps its own curve.
 *  2. Rooms and practice deal tapRev 5; its curve is tapRev 4's from 165 ms down, never rises with a slower
 *     average, and stretches to 185 at 120 ms; the steady-hand bonus (15 within 50 ms, 8 within 80 ms) needs every
 *     flash hit with no false start; the score is the curve plus the bonus less false starts, at most 200.
 *  3. A perfect run (every flash at 120 ms) scores 200; 200 needs the bonus (no run without it beats 185).
 *  4. Stored answers on tapRev 5 grade the same in a room; spam stays at 0.
 *  5. The old vs new distribution (the kits' players and an elite one on 80 room seeds): solid players within
 *     ±10 % of today, near-perfect 150–165 at the top, elite 190–200.
 *
 *   bun scripts/depth-flash-check.ts   # ~5 s
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { gradeRoomAnswer } from "../src/lib/duel/roomGrade.server";
import { encodeTapTimes, TAP_REV_DEPTH, TAP_REV_ONE_CURVE } from "../src/lib/duel/tapLog";
import { scoreReaction } from "../src/lib/duel/scoring";
import { FLASH_REV5_CURVE, flashSteadyBonus, scoreFlashDepth } from "../src/lib/duel/depth/flash";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { knots } from "../src/lib/duel/depth200";
import { FLASH_DEPTH_INTRO, flashDepthHelp } from "../src/lib/duel/depth/speedTexts";
import type { PuzzleData, ReactionPuzzleData } from "../src/lib/duel/types";
import { DEPTH_LEVELS, distTable, legacyMismatches, makeOk, median, playAnswer, quantile, roomPuzzle, SEEDS, spamAnswers, type Dist } from "./depth-speed-lib";

const { ok, finish } = makeOk();
const lines: string[] = [];

/* 1. Legacy */
const legacy = legacyMismatches("reaction");
ok(legacy.runs >= 140 && legacy.bad.length === 0, `legacy: ${legacy.bad.length} of ${legacy.runs} stored tapRev 4 runs changed: ${legacy.bad.slice(0, 3).join("; ")}`);
for (const rev of [0, 2, 3, 4]) for (const ms of [120, 150, 200, 400]) {
  const expected = scoreReaction(ms, 1, rev);
  ok(expected <= 150, `tapRev ${rev}: its own curve stays capped at 150 (${ms} ms)`);
}

/* 2. The stamp and the rules */
ok((generatePuzzle("reaction") as ReactionPuzzleData).tapRev === TAP_REV_DEPTH, "new Flash puzzles deal tapRev 5");
ok(roundMaxFor("reaction") === 200, "Flash's round maximum is 200");
for (let ms = 165; ms <= 1300; ms++) ok(knots(FLASH_REV5_CURVE, ms) === scoreReaction(ms, 0, TAP_REV_ONE_CURVE), `curve = tapRev 4 from 165 ms (${ms})`);
for (let ms = 100; ms <= 1300; ms++) ok(knots(FLASH_REV5_CURVE, ms) <= knots(FLASH_REV5_CURVE, ms - 1), `a slower average never scores more (${ms})`);
ok(knots(FLASH_REV5_CURVE, 150) === 155 && knots(FLASH_REV5_CURVE, 120) === 185 && knots(FLASH_REV5_CURVE, 100) === 185, "anchors: 150 ms 155, 120 ms (and faster) 185");
ok(flashSteadyBonus([200, 230, 249], 0) === 15 && flashSteadyBonus([200, 251], 0) === 8 && flashSteadyBonus([200, 281], 0) === 0, "steady: 15 within 50 ms, 8 within 80, else 0");
ok(flashSteadyBonus([200, 210, null], 0) === 0 && flashSteadyBonus([200, 210, 1200], 0) === 0 && flashSteadyBonus([200, 210], 1) === 0, "steady needs every flash hit and no false start");
for (const fs of [0, 1, 2, 3, 6]) for (const ms of [120, 140, 180, 260]) {
  const s = scoreFlashDepth([ms, ms + 10, ms + 20], fs);
  ok(s.score === Math.max(0, Math.min(200, s.curve + s.steady - s.falseStartCost)) && s.falseStartCost === scoreReaction(500, 0, 4) - scoreReaction(500, fs, 4), `score = curve + steady − false starts (${ms}, ${fs})`);
}

/* 3. 200 */
let perfect = 0;
let noBonusTop = 0;
for (const seed of SEEDS.slice(0, 20)) {
  const p = roomPuzzle("reaction", seed) as ReactionPuzzleData;
  const g = gradeAnswer(p, encodeTapTimes(p.flashes.map((f) => f + 120)), 0);
  if (g.score === 200) perfect++;
  // Fastest reactions, but spread over more than 80 ms: no bonus, so the curve's 185 at most.
  const spread = gradeAnswer(p, encodeTapTimes(p.flashes.map((f, i) => f + (i % 2 ? 105 : 190))), 0);
  noBonusTop = Math.max(noBonusTop, spread.score);
}
ok(perfect === 20, `every flash at 120 ms scores 200 (${perfect} of 20)`);
ok(noBonusTop < 200, `without the steady hand no run reaches 200 (best ${noBonusTop})`);

/* 4. Rooms and spam */
const dist: Dist[] = [];
const spamTop: number[] = [];
for (const [level] of Object.entries(DEPTH_LEVELS)) dist.push({ level, old: [], now: [] });
for (const seed of SEEDS) {
  const p = roomPuzzle("reaction", seed);
  const old = { ...(p as object), tapRev: TAP_REV_ONE_CURVE } as unknown as PuzzleData;
  for (const d of dist) {
    const answer = playAnswer("reaction", p, d.level, seed);
    const now = gradeAnswer(p, answer, 0);
    d.old.push(gradeAnswer(old, answer, 0).score);
    d.now.push(now.score);
    if (seed % 8 === 0) {
      const room = gradeRoomAnswer(p, { phase: "reveal", phaseStartedAt: new Date(100_000).toISOString(), nowMs: 100_100 }, answer, 0).graded;
      ok(room.score === now.score, `room = practice (${d.level} ${seed})`);
    }
    ok(now.score >= 0 && now.score <= 200 && Number.isInteger(now.score), `a whole score 0–200 (${d.level} ${seed})`);
  }
  for (const s of spamAnswers("reaction", p, seed)) spamTop.push(gradeAnswer(p, s.answer, 0).score);
}
ok(Math.max(...spamTop) === 0, `spam scores 0 (best ${Math.max(...spamTop)})`);

/* 5. Distribution */
const row = (l: string) => dist.find((d) => d.level === l)!;
for (const l of ["average", "good", "great"]) {
  const o = median(row(l).old), n = median(row(l).now);
  ok(Math.abs(n - o) <= 0.1 * o, `${l}: median ${o} → ${n} (within ±10 %)`);
}
ok(quantile(row("near").now, 0.9) >= 150 && quantile(row("near").now, 0.9) <= 170, `near-perfect top 10 % ${quantile(row("near").now, 0.9)} in 150–170`);
ok(median(row("elite").now) >= 185 && Math.max(...row("elite").now) >= 190, `elite median ${median(row("elite").now)}, best ${Math.max(...row("elite").now)} (190–200 at the top)`);
ok(Math.max(...row("great").now) < 190, `only elite play reaches 190 (great's best ${Math.max(...row("great").now)})`);
ok(flashDepthHelp().includes("{max}") && !/\b200\b/.test(flashDepthHelp().replace(/200 ms/g, "")) && FLASH_DEPTH_INTRO.includes("{max}"), "the texts are written with {max}, never 200");
ok(/\b200\b/.test(PUZZLE_INSTRUCTIONS.reaction.score) && /\b200\b/.test(INTRO_SCORE.reaction) && INTRO_SCORE.reaction.length <= 90, `help and intro read 200: "${INTRO_SCORE.reaction}"`);

lines.push("Flash (tapRev 4 → tapRev 5), 80 room seeds per level:", ...distTable(dist));
finish("depth-flash-check", `${legacy.runs} legacy runs identical, tapRev 5 curve and steady hand, 200 on a perfect run, distribution`, lines);
