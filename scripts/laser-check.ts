/** Laser-only generator, placement/replay and timing checks; no browser tests. */
import { generateLaser } from "../src/lib/duel/laser.server";
import { decodeLaserAnswer, encodeLaserAnswer, flipMirror, isSplitter, laserStep, reflect, verifyLaser } from "../src/lib/duel/laser";
import { withSeededRandom } from "../src/lib/duel/random";
import { scoreLaser } from "../src/lib/duel/scoring";
import { LASER_TIME_MS, type BeamDir, type LaserPuzzleData, type MirrorPlacement } from "../src/lib/duel/types";
import { INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import { gradeSubmission } from "../src/lib/duel/grade";
import { laserPuzzle } from "../src/puzzles/laser";

function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

// Independent DFS of beam states, with rotation at the current cell rather than
// the production tracer's arrival-time branching and queued path rendering.
function independent(p: LaserPuzzleData, pieces: MirrorPlacement[]) {
  const at = new Map(pieces.map((piece) => [piece.cell, piece.kind]));
  const seen = new Set<string>(); const lit = new Set<number>(); let bomb = false;
  const walk = (cell: number, heading: BeamDir) => {
    const key = `${cell}:${heading}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (p.bombs.includes(cell)) { bomb = true; return; }
    if (p.gems.includes(cell) && p.directionalGems?.every((g) => g.cell !== cell || g.from === heading)) lit.add(cell);
    const piece = at.get(cell);
    let headings: BeamDir[] = [heading];
    if (piece && isSplitter(piece)) {
      if ((piece === "S|") !== (heading === "U" || heading === "D")) return;
      headings = piece === "S|" ? ["L", "R"] : ["U", "D"];
    } else if (piece) headings = [reflect(heading, piece)];
    for (const dir of headings) {
      const next = laserStep(cell, dir);
      if (next !== null && !p.blocks.includes(next)) walk(next, dir);
    }
  };
  walk(p.source, p.dir);
  return !bomb && p.gems.every((gem) => lit.has(gem));
}

check(LASER_TIME_MS === 60_000 && laserPuzzle.timeLimitMs === 60_000, "60s registry limit");
const fixed = withSeededRandom(INTRO_EXAMPLE_SEED, generateLaser);
check(JSON.stringify({ ...fixed, stats: undefined }) === JSON.stringify({ ...withSeededRandom(INTRO_EXAMPLE_SEED, generateLaser), stats: undefined }), "fixed intro reproducibility");
const times: number[] = []; const counts: Record<number, number> = {};
for (let seed = 0; seed < 200; seed++) {
  const start = performance.now();
  const p = withSeededRandom(seed, generateLaser);
  times.push(performance.now() - start);
  counts[p.mirrors] = (counts[p.mirrors] ?? 0) + 1;
  const solution = p.solution ?? [];
  check(p.mirrors === 7 || p.mirrors === 8, "mirror reduction");
  check(p.splitterPieces === 1 && !p.splitters?.length, "movable splitter inventory");
  check(solution.length === p.mirrors + 1 && solution.filter((piece) => isSplitter(piece.kind)).length === 1, "exact inventory witness");
  check(p.gems.length === 6 && p.directionalGems?.length === 2, "six gems");
  check(verifyLaser(p, solution).solved && independent(p, solution), "independent solution trace");
  const fullMask = (1 << solution.length) - 1;
  for (let mask = 0; mask < fullMask; mask++) {
    const subset = solution.filter((_, i) => (mask & (1 << i)) !== 0);
    check(!independent(p, subset), "redundant supplied piece");
  }
  check(p.stats?.subsetsTested === fullMask, "exhaustive witness subset proof");
  // Without branching a beam exits at the first outward-facing edge gem, so
  // both terminal gems can never be lit with mirrors alone at ANY placement.
  for (const g of p.directionalGems ?? []) check(laserStep(g.cell, g.from) === null, "splitter structural necessity");
  const rotated = solution.map((piece) => isSplitter(piece.kind) ? { ...piece, kind: flipMirror(piece.kind) } : piece);
  check(!verifyLaser(p, rotated).solved, "splitter orientation matters");
  for (let fires = 1; fires <= 3; fires++) {
    const answer = encodeLaserAnswer(solution, fires);
    const wire = decodeLaserAnswer(answer, p.mirrors + 1);
    check(JSON.stringify(wire.mirrors) === JSON.stringify(solution), "placement wire round trip");
    const result = gradeSubmission(p, answer, 30_000, 60_000);
    check(result.isCorrect && result.score === [150, 135, 120][fires - 1], "server shot/speed score");
  }
  check(!verifyLaser({ ...p, splitterPieces: 0 }, solution).solved, "server rejects unprovided splitter");
  const onlySplitter = solution.filter((piece) => isSplitter(piece.kind));
  check(!verifyLaser({ ...p, mirrors: 0 }, solution).solved, "server rejects excess mirrors");
  check(verifyLaser(p, [...onlySplitter, ...onlySplitter]).mirrorsPlaced === 0, "duplicate piece rejected");
}
check(scoreLaser(true, 6, 1, 60_000, 60_000) === 150, "full speed score unchanged");
check(scoreLaser(false, 3, 2, 30_000, 60_000) === 45, "partial score unchanged");
const sorted = [...times].sort((a,b) => a-b);
console.log(JSON.stringify({ layouts: times.length, mirrorCounts: counts, generationMs: {
  min: sorted[0], median: sorted[100], p95: sorted[190], max: sorted.at(-1), mean: times.reduce((a,b) => a+b,0)/times.length,
}, fixedExampleMs: fixed.stats?.generationMs, timesMs: times.map((t) => Math.round(t * 100)/100) }));
check(times.every((t) => t < 1000), "generation exceeds one second: precompute a bank");
console.log("Laser: 200 exact-piece solutions, independent exhaustive subsets, required oriented splitter, server grading and 60s scores passed.");