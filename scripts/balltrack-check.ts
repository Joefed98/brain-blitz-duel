/**
 * Ball Track proofs: every bank playbook routes all balls through the server path,
 * and 200 self-replay runs (random taps over bank courses) match the server.
 *   bun scripts/balltrack-check.ts
 */
import { BALL_TRACK_BANK } from "../src/lib/duel/ballTrackBank.server";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { decodeInputEvents, inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { btCheckpoint, btRotatable, btScoreOf, btSpeedBonus, makeBallTrackGame, BT_BALLS, BT_CHECKPOINT_INTERVAL, BT_COLS, BT_ROWS, BT_KIND, BT_K_ROTATE, BT_DROP_TICKS, BT_STEP_TICKS, BT_RUN_TICKS, type BtCheckpoint } from "../src/lib/arcade/ballTrack";
import { hasLowerShortcut, routeTo } from "./ball-track-bank";
import { encodeBallTrackRun, replayBallTrackRun } from "../src/lib/duel/ballTrack";

let fails = 0;
const fail = (m: string) => { fails++; if (fails < 10) console.error(m); };

function play(index: number, choose: (tick: number) => Omit<ArcadeInputEvent, "t"> | null) {
  const entry = BALL_TRACK_BANK[index]!;
  const game = makeBallTrackGame(entry.course);
  let state = game.init(index + 1);
  const log: ArcadeInputEvent[] = [];
  const cps: BtCheckpoint[] = [];
  while (!game.isOver(state)) {
    const e = choose(state.tick + 1);
    if (e) recordInput(log, { ...e, t: state.tick + 1 }, game.inputRanges);
    state = game.step(state, inputAt(log, state.tick + 1));
    if (state.tick % BT_CHECKPOINT_INTERVAL === 0) cps.push(btCheckpoint(state));
  }
  const score = game.score(state);
  const raw = appendClientCounters(encodeBallTrackRun(entry.course, { seed: index + 1, claimedScore: score, events: log, endTick: state.tick, checkpoints: cps }), arcadeCounters("balltrack", state, score));
  const res = replayBallTrackRun(entry.course, index + 1, raw);
  if (JSON.stringify(res.state) !== JSON.stringify(state) || res.score !== score || res.flagged || res.inputDiag.clamped || res.inputDiag.dropped) fail(`course ${index}: replay mismatch`);
  return { state, score };
}

let solved = 0, apart = 0;
const dropSets = new Set<string>();
if (BT_BALLS !== 20 || BT_DROP_TICKS !== 120 || BT_STEP_TICKS !== 14 || BT_ROWS !== 9 || BT_COLS !== 7 || BT_RUN_TICKS !== 3600) fail("Pace constants");
for (let home = 0; home <= BT_BALLS; home++) for (let wrong = 0; wrong <= BT_BALLS - home; wrong++) {
  if (btScoreOf(home, wrong) !== Math.max(0, Math.min(150, Math.round(120 * home / BT_BALLS) - 5 * wrong + btSpeedBonus(home, BT_RUN_TICKS)))) fail("Scoring formula");
if (btSpeedBonus(BT_BALLS, BT_RUN_TICKS - 20 * 60) !== 30 || btSpeedBonus(BT_BALLS, BT_RUN_TICKS - 15 * 60) !== 23 || btSpeedBonus(BT_BALLS, BT_RUN_TICKS - 10 * 60) !== 15 || btSpeedBonus(BT_BALLS - 1, 0) !== 0) fail("Speed bonus");
}
BALL_TRACK_BANK.forEach((entry, i) => {
  const c = entry.course;
  const upper = c.fixed.filter(x => x < 42);
  const extra = c.fixed.length;
  if (upper.length < 8 || upper.length > 10 || new Set(c.fixed).size !== extra || c.fixed.some((x) => x >= 56 || (x < 42 && x % BT_COLS === 3) || BT_KIND[x] !== 1)) fail(`course ${i}: fixed set`);
  const rotatable = new Set(btRotatable(c));
  let triples = 0;
  for (let col = 0; col < BT_COLS; col++) {
    let run = 0;
    for (let row = 0; row < BT_ROWS; row++) {
      run = rotatable.has(row * BT_COLS + col) ? run + 1 : 0;
      if (run === 3) triples++;
      if (run > 3) fail(`course ${i}: four vertically adjacent rotatable tubes`);
    }
  }
  if ([...rotatable].some(c => c >= 56)) fail(`course ${i}: bottom row rotatable`);
  if ([...rotatable].filter(c => c >= 42 && c < 49).length > 2 || [...rotatable].filter(c => c >= 49 && c < 56).length > 4) fail(`course ${i}: lower-row limits`);
  const drops = (t: number[]) => t.flatMap((x, col) => (x >= 0 ? [col] : [])).join(",");
  if (c.trays[0] !== -1 || new Set(c.trays.filter(t => t >= 0)).size !== 4 || drops(c.trays) !== drops(c.shuffle.trays) || new Set(c.shuffle.trays.filter(t => t >= 0)).size !== 4) fail(`course ${i}: tray columns`);
  if (c.trays.some((t, col) => t >= 0 && c.shuffle.trays[col] === t) || c.shuffle.tick < 1200 || c.shuffle.tick > 2400) fail(`course ${i}: shuffle`);
  dropSets.add(drops(c.trays));
  const hz = c.trays.flatMap((t, col) => (col > 0 && t < 0 ? [col] : []));
  if (hz.length === 2 && hz[1]! - hz[0]! > 1) apart++;
  if (hasLowerShortcut(c) || c.trays.some((t,col) => t >= 0 && !routeTo(c,col))) fail(`course ${i}: tray reachability / early route`);
  if (c.trays.filter((t) => t >= 0).length !== 4 || c.balls.length !== BT_BALLS) fail(`course ${i}: trays/balls`);
  const counts = Array.from({ length: 4 }, (_, colour) => c.balls.filter((b) => b === colour).length).sort();
  if (counts.join(",") !== "5,5,5,5") fail(`course ${i}: colour balance`);
  if (c.balls.some((b, j) => j >= 2 && b === c.balls[j - 1] && b === c.balls[j - 2])) fail(`course ${i}: three consecutive colours`);
  const events = new Map(decodeInputEvents(entry.playbook).map((e) => [e.t, e]));
  const { state, score } = play(i, (t) => events.get(t) ?? null);
  if (state.home === BT_BALLS && state.wrong === 0 && state.lost === 0 && score === 120 + btSpeedBonus(BT_BALLS, state.lastLand) && state.actions === entry.par) solved++;
  else fail(`course ${i}: playbook did not route all ${BT_BALLS} (${state.home}, score ${score})`);
});

if (dropSets.size < 6 || apart < 50) fail(`bottom-row variety: ${dropSets.size} drop layouts, ${apart} non-adjacent horizontals`);
let same = 0;
for (let run = 0; run < 200; run++) {
  let r = 0x9e3779b9 ^ run;
  const rnd = (n: number) => { r = (Math.imul(r ^ (r >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0; return r % n; };
  const before = fails;
  play(run, () => (rnd(100) < 4 ? { k: BT_K_ROTATE, a: rnd(BT_COLS * BT_ROWS), b: 0, c: 0, d: 0 } : null));
  if (fails === before) same++;
}
console.log(`ball track: ${solved}/${BALL_TRACK_BANK.length} playbooks route all ${BT_BALLS} home · self-replay identity ${same}/200`);
if (fails) throw Error(`${fails} failures`);
