/**
 * depth-bangon-check (25 Oct 2026, Depth to 200; docs/depth/d3-speed-attention.md): Bang On `tapRev: 5`, FEATURES:
 * the dead-centre line and the zone streak (src/lib/duel/depth/bangOn.ts).
 *
 *  1. Legacy: 140 runs recorded on main (scripts/fixtures/depth-speed-legacy.json.gz, tapRev 4) grade exactly as
 *     stored; older stamps keep their own curves (at most 150).
 *  2. Rooms and practice deal tapRev 5. On every kit run its score is exactly tapRev 4's score for the same log
 *     plus 2 per dead-centre stop plus the zone streak's points (the n-th watch in a row in the zone n − 1, at
 *     most 4): the extra 50 only through the features, and without them nothing above 150.
 *  3. The marks: a stop is in the zone when the marker is within the zone's half-width of its centre (the drawn
 *     gold band), dead centre within 12 ms of the line (and always in the zone); a miss is neither.
 *  4. A perfect run (every watch stopped on its centre crossing) scores 200; the same run 3 ms off the line on
 *     alternate watches loses only the dead-centre points it missed.
 *  5. Rooms grade the same; spam stays low; the old vs new distribution (solid players roughly where they were).
 *
 *   bun scripts/depth-bangon-check.ts   # ~5 s
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { gradeRoomAnswer } from "../src/lib/duel/roomGrade.server";
import { encodeTapTimes, replayBangOn, TAP_REV_DEPTH, TAP_REV_ONE_CURVE } from "../src/lib/duel/tapLog";
import { scoreStopWatch } from "../src/lib/duel/scoring";
import { markerState, targetCentre, watchLifeMs, watchStop } from "../src/lib/duel/stopWatch";
import { BANGON_CENTRE_MS, bangOnMarks, scoreBangOnDepth, streakPointsAt } from "../src/lib/duel/depth/bangOn";
import { BANGON_DEPTH_INTRO, bangOnDepthHelp } from "../src/lib/duel/depth/speedTexts";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { STOPWATCH_GAP_MS, STOPWATCH_LEAD_IN_MS, type PuzzleData, type StopWatchPuzzleData, type StopWatchSpec } from "../src/lib/duel/types";
import { DEPTH_LEVELS, distTable, legacyMismatches, makeOk, median, playAnswer, roomPuzzle, SEEDS, spamAnswers, type Dist } from "./depth-speed-lib";
import { pinPreTopup } from "../src/lib/duel/depthTopup";

// The puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md) deals newer stamps; this check proves the stamps it was
// written for, so new deals are pinned to them (depth-topup-check proves the top-up's).
pinPreTopup(true);

const { ok, finish } = makeOk();
const lines: string[] = [];

/* 1. Legacy */
const legacy = legacyMismatches("stopwatch");
ok(legacy.runs >= 140 && legacy.bad.length === 0, `legacy: ${legacy.bad.length} of ${legacy.runs} stored tapRev 4 runs changed: ${legacy.bad.slice(0, 3).join("; ")}`);
for (const rev of [0, 2, 3, 4]) for (const d of [0, 5, 40, 200]) ok(scoreStopWatch(d, rev) <= 150, `tapRev ${rev} stays at most 150 (${d} ms)`);

/* 2–3. Stamp, features only, marks */
ok((generatePuzzle("stopwatch") as StopWatchPuzzleData).tapRev === TAP_REV_DEPTH, "new Bang On puzzles deal tapRev 5");
ok(roundMaxFor("stopwatch") === 200, "Bang On's round maximum is 200");
const dist: Dist[] = Object.keys(DEPTH_LEVELS).map((level) => ({ level, old: [], now: [] }));
const spamTop: number[] = [];
let marksChecked = 0;
for (const seed of SEEDS) {
  const p = roomPuzzle("stopwatch", seed) as StopWatchPuzzleData;
  const old = { ...p, tapRev: TAP_REV_ONE_CURVE } as unknown as PuzzleData;
  for (const d of dist) {
    const answer = playAnswer("stopwatch", p, d.level, seed);
    const now = gradeAnswer(p, answer, 0);
    const before = gradeAnswer(old, answer, 0);
    const dep = now.extra?.["depth"] as { curve: number; centre: number; streak: number; centreHits: number; streakWatches: number; zone: boolean[]; dead: boolean[] };
    ok(dep.curve === before.score && now.score === Math.min(200, before.score + dep.centre + dep.streak), `${d.level} ${seed}: tapRev 4's ${before.score} + centre ${dep.centre} + streak ${dep.streak} = ${now.score}`);
    let run = 0;
    const streak = dep.zone.reduce((sum, z) => sum + Math.max(0, Math.min(4, (run = z ? run + 1 : 0) - 1)), 0);
    ok(dep.centre === 2 * dep.centreHits && dep.streak === streak, `${d.level} ${seed}: 2 per centre stop, the streak's ${streak}`);
    // Marks against the drawn band: recompute from the replay.
    const replay = replayBangOn(p.watches, answer.startsWith("log1:") ? answer.slice(5).split(",").filter(Boolean).map(Number) : [], 60_000);
    replay.results.forEach((r, i) => {
      marksChecked++;
      const spec = p.watches[i]!;
      if (r.distance === null) return ok(!dep.zone[i] && !dep.dead[i], `${seed} watch ${i}: a miss is neither`);
      const e = r.at - r.start;
      const off = Math.abs(markerState(spec, e).pos - targetCentre(spec, e));
      ok(dep.zone[i] === off <= spec.half + 1e-9, `${seed} watch ${i}: zone = within the band`);
      ok(dep.dead[i] === (dep.zone[i]! && r.distance <= BANGON_CENTRE_MS), `${seed} watch ${i}: dead centre within ${BANGON_CENTRE_MS} ms`);
    });
    d.old.push(before.score);
    d.now.push(now.score);
    if (seed % 8 === 0) ok(gradeRoomAnswer(p, { phase: "reveal", phaseStartedAt: new Date(100_000).toISOString(), nowMs: 100_100 }, answer, 0).graded.score === now.score, `room = practice (${d.level} ${seed})`);
  }
  // Spam's feature points (its tapRev 4 score is the old curve's business).
  for (const s of spamAnswers("stopwatch", p, seed)) spamTop.push(gradeAnswer(p, s.answer, 0).score - gradeAnswer(old, s.answer, 0).score);
}
ok(bangOnMarks([], []).marks.length === 0, "no watches, no marks");
ok([1, 2, 3, 4, 5, 10].map(streakPointsAt).join() === "0,1,2,3,4,4" && [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].reduce((a, n) => a + streakPointsAt(n), 0) === 30, "streak points 0, 1, 2, 3, then 4; ten in a row 30");

/* 4. 200 */
function bestStop(spec: StopWatchSpec): number {
  let best = 0;
  let bestD = Infinity;
  for (let e = 0; e < watchLifeMs(spec); e++) {
    const d = watchStop(spec, e).distance;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
    if (d === 0) break;
  }
  return best;
}
function perfectLog(watches: StopWatchSpec[], offBy = (_: number) => 0): number[] {
  const taps: number[] = [];
  let start = STOPWATCH_LEAD_IN_MS;
  watches.forEach((spec, i) => {
    const at = start + bestStop(spec) + offBy(i);
    taps.push(at);
    start = at + STOPWATCH_GAP_MS;
  });
  return taps;
}
let perfect = 0;
for (const seed of SEEDS.slice(0, 20)) {
  const p = roomPuzzle("stopwatch", seed) as StopWatchPuzzleData;
  const g = gradeAnswer(p, encodeTapTimes(perfectLog(p.watches)), 0);
  if (g.score === 200) perfect++;
  else lines.push(`perfect ${seed}: ${g.score} ${JSON.stringify(g.extra?.["depth"])}`);
}
ok(perfect === 20, `every watch stopped on its centre crossing scores 200 (${perfect} of 20)`);
// Without any centre stop and no streak the most is tapRev 4's 150.
ok(scoreBangOnDepth([], [], 10).score === 0, "an empty run scores 0");

/* 5. Distribution and texts */
const row = (l: string) => dist.find((d) => d.level === l)!;
for (const l of ["average", "good"]) {
  const o = median(row(l).old), n = median(row(l).now);
  ok(n - o <= 0.12 * o && n >= o, `${l}: median ${o} → ${n} (roughly where it was)`);
}
ok(Math.max(...row("elite").now) >= 185, `elite best ${Math.max(...row("elite").now)} reaches the top band`);
ok(Math.max(...spamTop) <= 10 && median(spamTop) === 0, `spam's feature points: median ${median(spamTop)}, most ${Math.max(...spamTop)} (≤ 10)`);
ok(marksChecked > 1000, `${marksChecked} stops' marks checked`);
ok(bangOnDepthHelp().includes("{max}") && BANGON_DEPTH_INTRO.includes("{max}") && /\b200\b/.test(INTRO_SCORE.stopwatch) && INTRO_SCORE.stopwatch.length <= 90, `texts with {max}: "${INTRO_SCORE.stopwatch}"`);

lines.push("Bang On (tapRev 4 → tapRev 5), 80 room seeds per level:", ...distTable(dist));
finish("depth-bangon-check", `${legacy.runs} legacy runs identical, features only above tapRev 4, marks, 200 on a perfect run, distribution`, lines);
