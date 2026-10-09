/**
 * Swish smaller-bucket revision: proves every throw can still score.
 * For many seeds it searches a launch per throw (stepping the real sim),
 * records the full ten-basket run, then replays it through the server path.
 * Also checks the original bucket is untouched for rounds without binRev.
 */
import {
  BINTOSS_AIM, BINTOSS_INPUT_FLICK, BINTOSS_REV, BINTOSS_THROWS, BINTOSS_VX_MAX, BINTOSS_VY_MAX,
  binTossGame, binTossGameFor, binTossHalf, binTossRimInset, type BinTossState,
} from "../src/lib/arcade/binToss.ts";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine.ts";
import { encodeBinTossRun, replayBinTossRun } from "../src/lib/duel/binToss.ts";

let failures = 0;
const fail = (m: string) => { failures++; console.error("FAIL", m); };

// Dimensions.
for (const i of [0, 3]) {
  const o = binTossHalf(i), n = binTossHalf(i, BINTOSS_REV);
  const oc = o - binTossRimInset(), nc = n - binTossRimInset(BINTOSS_REV);
  console.log(`throw ${i + 1}: opening ${(2 * o / 256).toFixed(1)}→${(2 * n / 256).toFixed(1)} px, catch zone ${(2 * oc / 256).toFixed(1)}→${(2 * nc / 256).toFixed(1)} px (${(100 * (1 - nc / oc)).toFixed(1)}% smaller)`);
}
if (binTossGameFor(undefined).init(5).rev !== undefined) fail("old bucket state gained rev");
if (binTossGameFor(BINTOSS_REV).init(5).rev !== BINTOSS_REV) fail("new state lacks rev");

const game = binTossGameFor(BINTOSS_REV);
const candidates: [number, number][] = [];
for (let vy = -BINTOSS_VY_MAX; vy <= -400; vy += 40)
  for (let vx = 0; vx <= BINTOSS_VX_MAX; vx += 24) candidates.push([vx, vy]);

function solve(seed: number): ArcadeInputEvent[] | null {
  let state: BinTossState = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  while (!game.isOver(state)) {
    if (state.phase !== BINTOSS_AIM) { state = game.step(state, null); continue; }
    let found: { s: BinTossState; e: ArcadeInputEvent } | null = null;
    for (const [vx, vy] of candidates) {
      const e: ArcadeInputEvent = { t: state.tick + 1, k: BINTOSS_INPUT_FLICK, a: vx, b: vy, c: 0 };
      let s = game.step(state, e);
      const before = s.resolved;
      while (s.resolved === before && !game.isOver(s)) s = game.step(s, null);
      if (s.baskets === s.resolved) { found = { s, e }; break; }
    }
    if (!found) return null;
    events.push(found.e);
    state = found.s;
  }
  return state.baskets === BINTOSS_THROWS ? events : null;
}

const SEEDS = Number(process.argv[2] ?? 40);
let perfect = 0;
for (let n = 0; n < SEEDS; n++) {
  const seed = 1 + n * 7919;
  const events = solve(seed);
  if (!events) { fail(`seed ${seed}: no ten-basket run found`); continue; }
  let state = game.init(seed);
  const map = new Map(events.map((e) => [e.t, e]));
  while (!game.isOver(state)) state = game.step(state, map.get(state.tick + 1) ?? null);
  const raw = encodeBinTossRun({ seed, events, claimedScore: game.score(state), endTick: 0, checkpoints: [] } as never);
  const replay = replayBinTossRun(seed, raw, BINTOSS_REV);
  if (replay.baskets !== BINTOSS_THROWS || !replay.perfect) fail(`seed ${seed}: replay ${replay.baskets}/10`);
  else perfect++;
  const old = replayBinTossRun(seed, raw);
  if (n < 3) console.log(`seed ${seed}: new bucket ${replay.baskets}/10 score ${replay.score}; same throws on old bucket ${old.baskets}/10`);
}
// Old-bucket rounds keep the original game object.
if (binTossGameFor(undefined) !== binTossGame) fail("unstamped rounds no longer use the original bucket");
console.log(`${perfect}/${SEEDS} seeds: all ten throws scored and server replay confirmed`);
if (failures) process.exit(1);
console.log("bintoss-small-bucket-check OK");
