/**
 * Intro demo replay check: for each of the 26 engine games, a synthetic
 * recorded log is replayed the way the intro does (run stopped at tick 480 via
 * runAtTick) and compared with a direct sim run of the same inputs to tick 480.
 *   bun scripts/intro-demo-check.ts
 */
import { checkInputEvents, encodeInputEvents, rngBelow, type ArcadeGame, type ArcadeInputEvent } from "@/lib/arcade/engine";
import { DEMO_LENGTH_TICKS, runAtTick } from "@/lib/arcade/introDemo";
import { generatePuzzle } from "@/lib/duel/generate.server";
import type { PuzzleData, PuzzleType } from "@/lib/duel/types";

import { hoverGame } from "@/lib/arcade/hover";
import { skylineGame } from "@/lib/arcade/skyline";
import { binTossGame } from "@/lib/arcade/binToss";
import { bullseyeGame, bullseyeInit } from "@/lib/arcade/bullseye";
import { matchupGame } from "@/lib/arcade/matchup";
import { breakerGame } from "@/lib/arcade/breaker";
import { rallyGame } from "@/lib/arcade/rally";
import { sliceGame } from "@/lib/arcade/slice";
import { bubbleGame } from "@/lib/arcade/bubble";
import { beatGame } from "@/lib/arcade/beat";
import { snakeGame } from "@/lib/arcade/snake";
import { crossGame } from "@/lib/arcade/cross";
import { wavefrontGame } from "@/lib/arcade/wavefront";
import { flipGame } from "@/lib/arcade/flip";
import { junctionGame } from "@/lib/arcade/junction";
import { inkBridgeGame } from "@/lib/arcade/inkBridge";
import { burstGame } from "@/lib/arcade/burst";
import { orbitGame } from "@/lib/arcade/orbit";
import { swingGame } from "@/lib/arcade/swing";
import { snipGame } from "@/lib/arcade/snip";
import { tiltGame } from "@/lib/arcade/tilt";
import { makeBallTrackGame } from "@/lib/arcade/ballTrack";
import { whackGame } from "@/lib/arcade/whack";
import { clayGameFor } from "@/lib/arcade/clayShoot";
import { tenDropGame } from "@/lib/arcade/tenDrop";
import { colourClashGame } from "@/lib/arcade/colourClash";

import { replayHoverRun } from "@/lib/duel/hover";
import { replaySkylineRun } from "@/lib/duel/skyline";
import { replayBinTossRun } from "@/lib/duel/binToss";
import { replayBullseyeRun } from "@/lib/duel/bullseye";
import { replayMatchupRun } from "@/lib/duel/matchup";
import { replayBreakerRun } from "@/lib/duel/breaker";
import { replayRallyRun } from "@/lib/duel/rally";
import { replaySliceRun } from "@/lib/duel/slice";
import { replayBubbleRun } from "@/lib/duel/bubble";
import { replayBeatRun } from "@/lib/duel/beat";
import { replaySnakeRun } from "@/lib/duel/snake";
import { replayCrossRun } from "@/lib/duel/cross";
import { replayWavefrontRun } from "@/lib/duel/wavefront";
import { replayFlipRun } from "@/lib/duel/flip";
import { replayJunctionRun } from "@/lib/duel/junction";
import { replayInkBridgeRun } from "@/lib/duel/inkBridge";
import { replayBurstRun } from "@/lib/duel/burst";
import { replayOrbitRun } from "@/lib/duel/orbit";
import { replaySwingRun } from "@/lib/duel/swing";
import { replaySnipRun } from "@/lib/duel/snip";
import { replayTiltRun } from "@/lib/duel/tilt";
import { replayBallTrackRun } from "@/lib/duel/ballTrack";
import { replayWhackRun } from "@/lib/duel/whack";
import { replayClayRun } from "@/lib/duel/clayShoot";
import { replayTenDropRun } from "@/lib/duel/tenDrop";
import { replayColourClashRun } from "@/lib/duel/colourClash";
import { clashVariantOf } from "@/lib/arcade/colourClash";

type AnyGame = ArcadeGame<unknown, unknown>;
interface Case {
  type: PuzzleType;
  game: (p: PuzzleData) => AnyGame;
  init?: (p: PuzzleData, seed: number) => unknown;
  replay: (p: PuzzleData, seed: number, raw: string) => { state: unknown };
}
const g = (game: unknown) => () => game as AnyGame;
const r = (fn: (seed: number, raw: string) => { state: unknown }) => (_p: PuzzleData, s: number, raw: string) => fn(s, raw);

const CASES: Case[] = [
  { type: "hover", game: g(hoverGame), replay: r(replayHoverRun) },
  { type: "skyline", game: g(skylineGame), replay: r(replaySkylineRun) },
  { type: "bintoss", game: g(binTossGame), replay: r(replayBinTossRun) },
  {
    type: "bullseye",
    game: g(bullseyeGame),
    init: (p, s) => bullseyeInit(s, p.type === "bullseye" ? p.winds : []),
    replay: (p, s, raw) => replayBullseyeRun(s, raw, p.type === "bullseye" ? p.winds : []),
  },
  { type: "matchup", game: g(matchupGame), replay: r(replayMatchupRun) },
  { type: "breaker", game: g(breakerGame), replay: r(replayBreakerRun) },
  { type: "rally", game: g(rallyGame), replay: r(replayRallyRun) },
  { type: "slice", game: g(sliceGame), replay: r(replaySliceRun) },
  { type: "bubble", game: g(bubbleGame), replay: r(replayBubbleRun) },
  { type: "beat", game: g(beatGame), replay: r(replayBeatRun) },
  { type: "snake", game: g(snakeGame), replay: r(replaySnakeRun) },
  { type: "cross", game: g(crossGame), replay: r(replayCrossRun) },
  { type: "wavefront", game: g(wavefrontGame), replay: r(replayWavefrontRun) },
  { type: "flip", game: g(flipGame), replay: r(replayFlipRun) },
  { type: "junction", game: g(junctionGame), replay: r(replayJunctionRun) },
  { type: "inkbridge", game: g(inkBridgeGame), replay: r(replayInkBridgeRun) },
  { type: "burst", game: g(burstGame), replay: r(replayBurstRun) },
  { type: "orbit", game: g(orbitGame), replay: r(replayOrbitRun) },
  { type: "swing", game: g(swingGame), replay: r(replaySwingRun) },
  { type: "snip", game: g(snipGame), replay: r(replaySnipRun) },
  { type: "tilt", game: g(tiltGame), replay: r(replayTiltRun) },
  {
    type: "balltrack",
    game: (p) => makeBallTrackGame((p as Extract<PuzzleData, { type: "balltrack" }>).course) as unknown as AnyGame,
    replay: (p, s, raw) => replayBallTrackRun((p as Extract<PuzzleData, { type: "balltrack" }>).course, s, raw),
  },
  { type: "whack", game: g(whackGame), replay: r(replayWhackRun) },
  {
    type: "clayshoot",
    game: (p) => clayGameFor(p.type === "clayshoot" ? p.clayRev : undefined) as unknown as AnyGame,
    replay: (p, s, raw) => replayClayRun(s, raw, p.type === "clayshoot" ? p.clayRev : undefined),
  },
  { type: "tendrop", game: g(tenDropGame), replay: r(replayTenDropRun) },
  { type: "stroop", game: g(colourClashGame), replay: (p: PuzzleData, s: number, raw: string) => replayColourClashRun(s, raw, clashVariantOf(p as never)) },
];

const quietError = console.error;
let failures = 0;
for (const c of CASES) {
  const puzzle = generatePuzzle(c.type, {} as never) as PuzzleData;
  const seed = "seed" in puzzle ? Number(puzzle.seed) : 1;
  const game = c.game(puzzle);
  let rng = (seed ^ 0x5eed) | 0;
  const pick = (lo: number, hi: number) => {
    const next = rngBelow(rng, hi - lo + 1);
    rng = next.state;
    return lo + next.value;
  };
  const ranges = game.inputRanges ?? [];
  let field: string;
  let direct: unknown;
  let state = c.init ? c.init(puzzle, seed) : game.init(seed);
  if (ranges.length === 0) {
    const taps: number[] = [];
    for (let t = 5; t <= DEMO_LENGTH_TICKS; t += pick(6, 30)) taps.push(t);
    field = taps.join(",");
    const set = new Set(taps);
    for (let t = 1; t <= DEMO_LENGTH_TICKS; t++) {
      state = game.step(state, set.has(t));
      if (game.isOver(state)) break;
    }
  } else {
    const events: ArcadeInputEvent[] = [];
    for (let t = 5; t <= DEMO_LENGTH_TICKS; t += pick(4, 24)) {
      const range = ranges[pick(0, ranges.length - 1)]!;
      events.push({
        t,
        k: range.k,
        a: pick(range.a[0], range.a[1]),
        b: pick(range.b[0], range.b[1]),
        c: pick(range.c[0], range.c[1]),
        d: pick(range.d[0], range.d[1]),
      });
    }
    field = encodeInputEvents(events);
    const check = checkInputEvents(events, game.runTicks, ranges);
    const map = new Map(check.events.map((e) => [e.t, e]));
    for (let t = 1; t <= DEMO_LENGTH_TICKS; t++) {
      state = game.step(state, map.get(t) ?? null);
      if (game.isOver(state)) break;
    }
  }
  direct = state;
  const recorded = `${seed}|0|${field}|0|`;
  console.error = () => {};
  const demo = c.replay(puzzle, seed, runAtTick(recorded, DEMO_LENGTH_TICKS)).state;
  console.error = quietError;
  const ok = JSON.stringify(demo) === JSON.stringify(direct);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${c.type}`);
}
console.log(failures === 0 ? "All 26 intro demos replay without desync." : `${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
