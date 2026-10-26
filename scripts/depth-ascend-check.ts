/**
 * depth-ascend-check (25 Oct 2026, Depth to 200; docs/depth/d3-speed-attention.md): Ascend `tapRev: 5`, FEATURE:
 * the flow streak (src/lib/duel/depth/ascend.ts).
 *
 *  1. Legacy: 120 runs recorded on main (scripts/fixtures/depth-speed-legacy.json.gz, tapRev 1 on puzzleScoreRev 3)
 *     grade exactly as stored.
 *  2. Rooms and practice deal tapRev 5. On every kit run its score is exactly the same log's tapRev 1 score (rev 3's
 *     finish or progress, at most 150) plus its flow points: the extra 50 only through the flow.
 *  3. The flow: ×1 for a streak's first 3 right taps, ×2 from the 4th, ×3 from the 8th, ×4 from the 12th; each right
 *     tap earns its multiplier less one; a wrong tap or a pause over 1 s ends the streak; ignored taps (a disc
 *     already cleared) change nothing; at most 50.
 *  4. A clean run at 400 ms a disc scores 200; the same pace with one wrong tap or one long pause does not.
 *  5. Rooms grade the same; spam earns no flow; the old vs new distribution.
 *
 *   bun scripts/depth-ascend-check.ts   # ~5 s
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { gradeRoomAnswer } from "../src/lib/duel/roomGrade.server";
import { encodeNumberTaps, TAP_REV, TAP_REV_DEPTH, type NumberTap } from "../src/lib/duel/tapLog";
import { ASCEND_FLOW_GAP_MS, ascendFlow, flowMultiplier, liveFlowMultiplier } from "../src/lib/duel/depth/ascend";
import { ASCEND_DEPTH_INTRO, ascendDepthHelp } from "../src/lib/duel/depth/speedTexts";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import type { NumberHuntPuzzleData, PuzzleData } from "../src/lib/duel/types";
import { DEPTH_LEVELS, distTable, legacyMismatches, makeOk, median, playAnswer, quantile, roomPuzzle, SEEDS, spamAnswers, type Dist } from "./depth-speed-lib";

const { ok, finish } = makeOk();
const lines: string[] = [];

/* 1. Legacy */
const legacy = legacyMismatches("numhunt");
ok(legacy.runs >= 120 && legacy.bad.length === 0, `legacy: ${legacy.bad.length} of ${legacy.runs} stored tapRev 1 runs changed: ${legacy.bad.slice(0, 3).join("; ")}`);

/* 3. Flow rules */
ok([1, 2, 3, 4, 7, 8, 11, 12, 30].map(flowMultiplier).join() === "1,1,1,2,2,3,3,4,4", "multiplier ×1 to 3, ×2 from 4, ×3 from 8, ×4 from 12");
const p0 = roomPuzzle("numhunt", 11) as NumberHuntPuzzleData;
const nOf = (i: number) => p0.spots[i]!.n;
const clean = (pace: number, from = 0, count = 24): NumberTap[] => Array.from({ length: count }, (_, i) => ({ n: nOf(from + i), t: 500 + (from + i) * pace }));
ok(ascendFlow(p0, clean(400)).points === 50 && ascendFlow(p0, clean(400)).best === 4, "24 quick taps in a row: 50 (51 capped), ×4");
const withWrong = [...clean(400, 0, 6), { n: nOf(9), t: 500 + 6 * 400 - 100 }, ...clean(400, 6, 18)];
ok(ascendFlow(p0, withWrong).points < ascendFlow(p0, clean(400)).points, "a wrong tap ends the streak");
const withPause = clean(400).map((tap, i) => (i >= 10 ? { ...tap, t: tap.t + ASCEND_FLOW_GAP_MS } : tap));
ok(ascendFlow(p0, withPause).points < 50, "a pause over 1 s ends the streak");
const atGap = clean(ASCEND_FLOW_GAP_MS);
ok(ascendFlow(p0, atGap).points === 50, "exactly 1 s apart still flows");
const withIgnored = [...clean(400, 0, 5), { n: nOf(1), t: 500 + 5 * 400 - 50 }, ...clean(400, 5, 19)];
ok(ascendFlow(p0, withIgnored).points === ascendFlow(p0, clean(400)).points, "a tap on a cleared disc changes nothing");
const flow = ascendFlow(p0, clean(400, 0, 9));
ok(liveFlowMultiplier(flow, flow.lastAt! + 500) === 3 && liveFlowMultiplier(flow, flow.lastAt! + ASCEND_FLOW_GAP_MS + 1) === 1, "the live multiplier drops to ×1 once the pause runs out");

/* 2, 4, 5. Stamp, features only, 200, distribution */
ok((generatePuzzle("numhunt") as NumberHuntPuzzleData).tapRev === TAP_REV_DEPTH, "new Ascend puzzles deal tapRev 5");
ok(roundMaxFor("numhunt") === 200, "Ascend's round maximum is 200");
let perfect = 0;
let broken = 0;
for (const seed of SEEDS.slice(0, 20)) {
  const p = roomPuzzle("numhunt", seed) as NumberHuntPuzzleData;
  const run = (taps: NumberTap[]) => gradeAnswer(p, encodeNumberTaps(taps), 60_000).score;
  const at = (i: number, t: number) => ({ n: p.spots[i]!.n, t });
  // 400 ms a disc, all inside the first layout (24 × 400 ms < 15 s).
  const taps = Array.from({ length: 24 }, (_, i) => at(i, 400 + i * 400));
  if (run(taps) === 200) perfect++;
  const wrong = [...taps.slice(0, 12), at(20, 400 + 11 * 400 + 100), ...taps.slice(12)];
  const pause = taps.map((tap, i) => (i >= 12 ? { ...tap, t: tap.t + 1_200 } : tap));
  if (run(wrong) < 200 && run(pause) < 200) broken++;
}
ok(perfect === 20, `a clean run at 400 ms a disc scores 200 (${perfect} of 20)`);
ok(broken === 20, `one wrong tap or one long pause keeps it under 200 (${broken} of 20)`);

const dist: Dist[] = Object.keys(DEPTH_LEVELS).map((level) => ({ level, old: [], now: [] }));
const spamFlow: number[] = [];
for (const seed of SEEDS) {
  const p = roomPuzzle("numhunt", seed);
  const old = { ...(p as object), tapRev: TAP_REV } as unknown as PuzzleData;
  for (const d of dist) {
    const answer = playAnswer("numhunt", p, d.level, seed);
    const now = gradeAnswer(p, answer, 60_000);
    const before = gradeAnswer(old, answer, 60_000);
    const dep = now.extra?.["depth"] as { base: number; flow: number };
    ok(dep.base === before.score && now.score === Math.min(200, before.score + dep.flow) && now.isCorrect === before.isCorrect && now.storedMs === before.storedMs, `${d.level} ${seed}: tapRev 1's ${before.score} + flow ${dep.flow} = ${now.score}`);
    d.old.push(before.score);
    d.now.push(now.score);
    if (seed % 8 === 0) {
      const room = gradeRoomAnswer(p, { phase: "reveal", phaseStartedAt: new Date(100_000).toISOString(), nowMs: 100_100 }, answer, 60_000).graded;
      const roomOld = gradeRoomAnswer(old, { phase: "reveal", phaseStartedAt: new Date(100_000).toISOString(), nowMs: 100_100 }, answer, 60_000).graded;
      ok(room.score === Math.min(200, roomOld.score + dep.flow), `room: tapRev 1's room grade plus the same flow (${d.level} ${seed})`);
    }
  }
  for (const s of spamAnswers("numhunt", p, seed)) spamFlow.push((gradeAnswer(p, s.answer, 60_000).extra?.["depth"] as { flow: number }).flow);
}
ok(Math.max(...spamFlow) <= 2, `spam earns no flow to speak of (most ${Math.max(...spamFlow)})`);
const row = (l: string) => dist.find((d) => d.level === l)!;
for (const l of ["average", "good"]) {
  const o = median(row(l).old), n = median(row(l).now);
  ok(n >= o && n - o <= 0.1 * o, `${l}: median ${o} → ${n} (roughly where it was)`);
}
ok(Math.max(...row("elite").now) >= 190 && quantile(row("great").now, 0.9) < 190, `elite reaches 190+ (best ${Math.max(...row("elite").now)}), great's top 10 % ${quantile(row("great").now, 0.9)} does not`);
ok(ascendDepthHelp().includes("{max}") && ASCEND_DEPTH_INTRO.includes("{max}") && /\b200\b/.test(INTRO_SCORE.numhunt) && INTRO_SCORE.numhunt.length <= 90, `texts with {max}: "${INTRO_SCORE.numhunt}"`);

lines.push("Ascend (tapRev 1 → tapRev 5), 80 room seeds per level:", ...distTable(dist));
finish("depth-ascend-check", `${legacy.runs} legacy runs identical, flow rules, the flow the only route above 150, 200 on a clean quick run, distribution`, lines);
