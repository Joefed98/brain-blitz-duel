/**
 * Colour Flood floodRev 3 (19 Oct 2026): cycling colours never finishes
 * (docs/scoring-report-oct-2026.md (e) bug 2; Joe's rule).
 *
 * 1. The fast cycle simulator (floodCycleTaps) agrees with the phone and server's replayFlood.
 * 2. Every board in the floodRev 3 bank (every board that can be dealt): 400 distinct, par in the
 *    band, the stored route floods in par, and no blind cycling order (every order of 2–5
 *    distinct colours, any start; 320) floods it within the limit, par + 2. The floodRev 2 bank
 *    is measured for the before figure.
 * 3. 2,000 seeded deals through generatePuzzle: stamped floodRev 3 with moveLimit par + 2, drawn
 *    from the floodRev 3 bank, the par route at half time grades a finish (120+), and the fairness kit's cycle-colours spam
 *    (and its four other starting colours) graded by the real server grader never finishes.
 * 4. Older stamps unchanged: a floodRev 2 board that a cycle floods within its stored limit still
 *    grades as a finish (stored rounds are never regraded); the floodRev 1 / 2 limit rule reads
 *    the stored limit as before.
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { encodeFloodMoves, floodApply, floodSolved, replayFlood } from "../src/lib/duel/flood";
import {
  FLOOD_BANK,
  FLOOD_BANK_SIZE,
  FLOOD_BANK_V3,
  FLOOD_CYCLE_ORDERS,
  floodCycleBest,
  floodCycleTaps,
} from "../src/lib/duel/flood.server";
import {
  FLOOD_LIMIT_DEALT,
  FLOOD_LIMIT_REV2,
  FLOOD_LIMIT_REV3,
  FLOOD_REV2_SPARE_MOVES,
  floodMoveLimit,
} from "../src/lib/duel/moveLimits";
import { FLOOD_COLOURS, FLOOD_MAX_PAR, FLOOD_MIN_PAR, type FloodPuzzleData } from "../src/lib/duel/types";

const started = performance.now();
const failures: string[] = [];
const fail = (msg: string) => {
  if (failures.length < 40) console.error(`FAIL ${msg}`);
  failures.push(msg);
};

/** The phone's tap list for a blind cycle: a tap on the current colour is ignored; it stops on the flood or the limit. */
function cycleTapList(grid: number[], order: readonly number[], limit: number, taps = 120): number[] {
  let g = grid;
  const moves: number[] = [];
  for (let i = 0; i < taps && moves.length < limit; i++) {
    const c = order[i % order.length]!;
    if (c === g[0]) continue;
    g = floodApply(g, c);
    moves.push(c);
    if (floodSolved(g)) break;
  }
  return moves;
}

/* 1. The fast simulator agrees with replayFlood. */
if (FLOOD_CYCLE_ORDERS.length !== 320) fail(`expected 320 cycling orders, got ${FLOOD_CYCLE_ORDERS.length}`);
let agreed = 0;
for (const [b, p] of [...FLOOD_BANK, ...FLOOD_BANK_V3].entries()) {
  for (const order of [FLOOD_CYCLE_ORDERS[b % 320]!, FLOOD_CYCLE_ORDERS[(b * 7 + 3) % 320]!, [0, 1, 2, 3, 4]]) {
    for (const limit of [p.par + FLOOD_REV2_SPARE_MOVES, 40]) {
      const tapList = cycleTapList(p.grid, order, limit, 400);
      const replay = replayFlood(p.grid, tapList, undefined, limit);
      const expected = replay.solved ? replay.moves : null;
      if (floodCycleTaps(p.grid, order, limit) !== expected) fail(`board ${b} order ${order.join("")} limit ${limit}: simulator ${floodCycleTaps(p.grid, order, limit)} vs replay ${expected}`);
      agreed++;
    }
  }
}
console.log(`simulator: ${agreed} cycle runs agree with replayFlood`);

/* 2. Every floodRev 3 bank board is cycle-proof within par + 2; the floodRev 2 bank for the before figure. */
const cycleFinishable = (bank: FloodPuzzleData[]) =>
  bank.filter((p) => floodCycleBest(p.grid, p.par + FLOOD_REV2_SPARE_MOVES) !== null).length;
if (FLOOD_BANK_V3.length !== FLOOD_BANK_SIZE) fail(`floodRev 3 bank has ${FLOOD_BANK_V3.length} boards`);
if (new Set(FLOOD_BANK_V3.map((p) => p.grid.join(","))).size !== FLOOD_BANK_V3.length) fail("floodRev 3 bank has duplicate boards");
const pars = new Map<number, number>();
let closest = Infinity;
for (const [i, p] of FLOOD_BANK_V3.entries()) {
  if (p.par < FLOOD_MIN_PAR || p.par > FLOOD_MAX_PAR) fail(`v3 board ${i}: par ${p.par}`);
  const route = replayFlood(p.grid, p.solution ?? []);
  if (!route.solved || route.moves !== p.par) fail(`v3 board ${i}: stored route does not flood in par`);
  pars.set(p.par, (pars.get(p.par) ?? 0) + 1);
  const best = floodCycleBest(p.grid, 60);
  if (best !== null && best <= p.par + FLOOD_REV2_SPARE_MOVES) fail(`v3 board ${i}: a cycle floods it in ${best} taps (par ${p.par})`);
  if (best !== null) closest = Math.min(closest, best - p.par);
}
const before = cycleFinishable(FLOOD_BANK);
console.log(
  `floodRev 3 bank: ${FLOOD_BANK_V3.length} boards, par ${[...pars].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}×${v}`).join(" ")}; ` +
    `no cycling order (320) floods any within par + ${FLOOD_REV2_SPARE_MOVES} (closest cycle: par + ${closest}). ` +
    `Before: ${before} of ${FLOOD_BANK.length} floodRev 2 boards were cycle-finishable`,
);
if (before === 0) fail("the floodRev 2 bank shows no cycle-finishable board: the before measurement is broken");

/* 3. 2,000 seeded deals. */
const V3_KEYS = new Set(FLOOD_BANK_V3.map((p) => p.grid.join(",")));
const SEEDS = 2000;
let spamGrades = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  const f = withSeededRandom(seed, () => generatePuzzle("flood")) as FloodPuzzleData;
  const lim = f.par + FLOOD_REV2_SPARE_MOVES;
  if (f.floodRev !== FLOOD_LIMIT_REV3 || FLOOD_LIMIT_DEALT !== FLOOD_LIMIT_REV3) fail(`seed ${seed}: dealt floodRev ${f.floodRev}`);
  if (f.moveLimit !== lim || floodMoveLimit(f) !== lim) fail(`seed ${seed}: limit ${f.moveLimit} for par ${f.par}`);
  if (!V3_KEYS.has(f.grid.join(","))) fail(`seed ${seed}: board not from the floodRev 3 bank`);
  if (seed <= 200) {
    const route = gradeAnswer(f, encodeFloodMoves(f.solution ?? []), 30_000);
    if (!route.isCorrect || route.score < 120) fail(`seed ${seed}: the par route scored ${route.score}`);
  }
  // The kit's cycle-colours spam (i % 5 at 2 taps a second for 60 s) from each starting colour.
  for (let start = 0; start < FLOOD_COLOURS; start++) {
    const order = Array.from({ length: FLOOD_COLOURS }, (_, k) => (start + k) % FLOOD_COLOURS);
    const g = gradeAnswer(f, encodeFloodMoves(cycleTapList(f.grid, order, lim)), 0);
    spamGrades++;
    if (g.isCorrect) fail(`seed ${seed}: cycling ${order.join("")} finished (score ${g.score})`);
  }
}
console.log(`${SEEDS} seeded deals: floodRev ${FLOOD_LIMIT_REV3}, limit par + ${FLOOD_REV2_SPARE_MOVES}, all from the cycle-proof bank; ${spamGrades} cycle-spam answers graded unfinished`);

/* 4. Older stamps unchanged. */
let legacyShown = 0;
for (const p of FLOOD_BANK) {
  const lim = p.par + FLOOD_REV2_SPARE_MOVES;
  const order = FLOOD_CYCLE_ORDERS.find((o) => floodCycleTaps(p.grid, o, lim) !== null);
  if (!order) continue;
  const taps = encodeFloodMoves(cycleTapList(p.grid, order, lim));
  for (const rev of [1, FLOOD_LIMIT_REV2]) {
    const stored: FloodPuzzleData = { ...p, floodRev: rev, moveLimit: lim };
    if (floodMoveLimit(stored) !== lim) fail(`floodRev ${rev}: the stored limit is not read`);
    if (!gradeAnswer(stored, taps, 0).isCorrect) fail(`floodRev ${rev}: a stored cycle finish no longer grades as a finish`);
  }
  if (++legacyShown >= 30) break;
}
console.log(`older stamps: ${legacyShown} stored floodRev 1 / 2 cycle finishes still grade as finishes (no regrade)`);

const secs = ((performance.now() - started) / 1000).toFixed(1);
if (failures.length) {
  console.log(`flood-cycle-check: FAIL (${failures.length} failures, ${secs} s)`);
  process.exit(1);
}
console.log(`flood-cycle-check: PASS (${secs} s)`);
