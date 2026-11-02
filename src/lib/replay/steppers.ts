/**
 * Round replays (display only): rebuilds a stored arcade or engine round tick by
 * tick from the stored puzzle and the stored run string, with the game's own
 * sim. Nothing here writes to a sim, a score or stored data — a stepper is the
 * server replay loop (src/lib/duel/<game>.ts `replay…Run`) opened up so the
 * phone can draw every tick and seek. scripts/replay-check.ts proves, for every
 * game and stored fixture run, that the stepper's final state is deep-equal to
 * the server replay's and its score equals the stored score.
 *
 * Every engine run string shares "seed|claimedScore|inputs|endTick|checkpoints[~diag]";
 * `inputs` is a tap-tick list for tap games (Hover, High Rise) and t:k:a:b:c:d
 * events for the rest.
 */
import {
  checkInputEvents,
  decodeInputEvents,
  sanitizeTaps,
  type ArcadeGame,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";
import type { PuzzleData } from "@/lib/duel/types";

import { hoverGameFor } from "@/lib/arcade/hover";
import { skylineGameFor } from "@/lib/arcade/skyline";
import { binTossGameFor } from "@/lib/arcade/binToss";
import { bullseyeGame, bullseyeInitFor } from "@/lib/arcade/bullseye";
import { matchupGameFor } from "@/lib/arcade/matchup";
import { breakerGameFor } from "@/lib/arcade/breaker";
import { pinballGameForAny } from "@/lib/arcade/pinball4";
import { minesweeperGameFor } from "@/lib/arcade/minesweeper";
import { mahjongGameFor } from "@/lib/arcade/mahjong";
import { homerunGameFor } from "@/lib/arcade/homerun";
import { freekickGameFor } from "@/lib/arcade/freekick";
import { racingGameFor } from "@/lib/arcade/racing";
import { freecellGameFor } from "@/lib/arcade/cards/freecell";
import { tripeaksGameFor } from "@/lib/arcade/cards/tripeaks";
import { pokerSquaresGameFor } from "@/lib/arcade/cards/pokerSquares";
import { fiveHandsGameFor } from "@/lib/arcade/cards/fiveHands";
import { minigolfGameFor } from "@/lib/arcade/minigolf";
import { poolGameFor } from "@/lib/arcade/pool";
import { curlingGameFor } from "@/lib/arcade/curling";
import { blockfallGameFor } from "@/lib/arcade/blockfall";
import { alleyRollGameFor } from "@/lib/arcade/alleyroll";
import { rallyGameFor } from "@/lib/arcade/rally";
import { sliceGameFor } from "@/lib/arcade/slice";
import { bubbleGameFor } from "@/lib/arcade/bubble";
import { beatGameFor } from "@/lib/arcade/beat";
import { snakeGameFor } from "@/lib/arcade/snake";
import { crossGameFor } from "@/lib/arcade/cross";
import { wavefrontGameFor } from "@/lib/arcade/wavefront";
import { flipGameFor } from "@/lib/arcade/flip";
import { junctionGameFor } from "@/lib/arcade/junction";
import { inkBridgeGameFor } from "@/lib/arcade/inkBridge";
import { burstGameFor } from "@/lib/arcade/burst";
import {
  orbitGame,
  ORBIT_REV3,
  ORBIT_REV4,
  ORBIT_REV_BAND,
  ORBIT_REV_TUNED,
  ORBIT_REV_SWEPT,
  ORBIT_REV_TALL,
  ORBIT_REV_TARGET, ORBIT_REV_STRICT, orbitXpRev,
} from "@/lib/arcade/orbit";
import {
  buildCourse3,
  decodeOrbitHoles,
  decodeRev3Planets,
  initBandFrom,
  initRev3From,
  initRev4From,
  initTunedFrom,
  initSweptFrom,
  initTallFrom,
  initTargetFrom, initStrictFrom,
  orbitStartForPuzzle,
  orbitRev3Game,
  ORBIT_REV3_WORLD_W,
} from "@/lib/arcade/orbitRev3";
import { swingGameFor } from "@/lib/arcade/swing";
import { snipGameFor } from "@/lib/arcade/snip";
import { tiltGameFor } from "@/lib/arcade/tilt";
import { makeBallTrackGame } from "@/lib/arcade/ballTrack";
import { whackGameFor } from "@/lib/arcade/whack";
import { clayGameFor } from "@/lib/arcade/clayShoot";
import { tenDropGame, tenDropInit } from "@/lib/arcade/tenDrop";
import { wordfallGameFor } from "@/lib/arcade/wordfall";
import { clashVariantOf, colourClashGameFor } from "@/lib/arcade/colourClash";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyGame = ArcadeGame<any, any>;

/** The stored run's parts, as every engine replay reads them. */
export interface ParsedRun {
  seed: number;
  claimedScore: number;
  inputField: string;
  endTick: number;
}

export function parseRun(raw: string): ParsedRun {
  const [seedPart = "", scorePart = "", inputPart = "", tickPart = ""] = (
    String(raw ?? "").split("~")[0] ?? ""
  ).split("|");
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    inputField: inputPart,
    endTick: Number.parseInt(tickPart, 10) || 0,
  };
}

/** Everything a replay needs about one game, for one stored puzzle. */
interface GameSource {
  game: AnyGame;
  /** Start state when the game's own init(seed) is not the one the server uses. */
  init?: () => any;
  /** Tap games take a boolean per tick; the rest take an event or null. */
  taps?: boolean;
  /** Tenfall: a short endTick always stops the replay (the run can end early). */
  endAlwaysStops?: boolean;
  /** Letterfall's replay checks words: the dictionary must be loaded first. */
  needsDict?: boolean;
}

const rev = (p: PuzzleData, key: string): number | undefined => {
  const value = (p as unknown as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
};
const seedOf = (p: PuzzleData): number => ("seed" in p ? Number((p as { seed: number }).seed) : 1);

function orbitSource(p: PuzzleData): GameSource {
  const orbitRev = rev(p, "orbitRev");
  // orbitRev 12 (the expansion to 200) and 13 (the arcade standard): the stamped course, holes and features.
  if (orbitXpRev(orbitRev) && p.type === "orbit") {
    const start = orbitStartForPuzzle(p);
    if (start) return { game: orbitRev3Game as AnyGame, init: start };
  }
  if (
    orbitRev === ORBIT_REV3 ||
    orbitRev === ORBIT_REV4 ||
    orbitRev === ORBIT_REV_BAND ||
    orbitRev === ORBIT_REV_TUNED ||
    orbitRev === ORBIT_REV_SWEPT ||
    orbitRev === ORBIT_REV_TALL ||
    orbitRev === ORBIT_REV_TARGET ||
    orbitRev === ORBIT_REV_STRICT ||
    orbitRev === ORBIT_REV_STRICT
  ) {
    const raw = p as unknown as {
      planets?: Parameters<typeof decodeRev3Planets>[0];
      holes?: Parameters<typeof decodeOrbitHoles>[0];
    };
    const seed = seedOf(p);
    const start = () => {
      const planets =
        raw.planets && raw.planets.length > 0
          ? decodeRev3Planets(raw.planets)
          : buildCourse3(seed, ORBIT_REV3_WORLD_W).planets;
      const holes = decodeOrbitHoles(raw.holes ?? []);
      return orbitRev === ORBIT_REV_STRICT
        ? initStrictFrom(planets, ORBIT_REV3_WORLD_W, holes)
        : orbitRev === ORBIT_REV_TARGET
        ? initTargetFrom(planets, ORBIT_REV3_WORLD_W, holes)
        : orbitRev === ORBIT_REV_TALL
        ? initTallFrom(planets, ORBIT_REV3_WORLD_W, holes)
        : orbitRev === ORBIT_REV_SWEPT
        ? initSweptFrom(planets, ORBIT_REV3_WORLD_W, holes)
        : orbitRev === ORBIT_REV_TUNED
        ? initTunedFrom(planets, ORBIT_REV3_WORLD_W, holes)
        : orbitRev === ORBIT_REV_BAND
          ? initBandFrom(planets, ORBIT_REV3_WORLD_W, holes)
          : orbitRev === ORBIT_REV4
            ? initRev4From(planets, ORBIT_REV3_WORLD_W, holes)
            : initRev3From(planets, ORBIT_REV3_WORLD_W);
    };
    return { game: orbitRev3Game as AnyGame, init: start };
  }
  return { game: orbitGame as AnyGame };
}

/** One entry per replayable type: the arcade games plus Letterfall, Tenfall, Bonk, Pull! and Mixed Signals. */
const SOURCES: Record<string, (p: PuzzleData) => GameSource> = {
  hover: (p) => ({ game: hoverGameFor(rev(p, "hoverRev")) as AnyGame, taps: true }),
  skyline: (p) => ({ game: skylineGameFor(rev(p, "skylineRev")) as AnyGame, taps: true }),
  bintoss: (p) => ({ game: binTossGameFor(rev(p, "binRev")) as AnyGame }),
  bullseye: (p) => ({
    game: bullseyeGame as AnyGame,
    init: () =>
      bullseyeInitFor(
        seedOf(p),
        (p as unknown as { winds?: number[] }).winds ?? [],
        rev(p, "bullRev"),
      ),
  }),
  matchup: (p) => ({ game: matchupGameFor(rev(p, "matchupRev")) as AnyGame }),
  breaker: (p) => ({ game: breakerGameFor(rev(p, "brkRev")) as AnyGame }),
  pinball: (p) => ({ game: pinballGameForAny(rev(p, "pinRev")) as AnyGame }),
  minesweeper: (p) => ({ game: minesweeperGameFor(rev(p, "minesRev")) as AnyGame }),
  mahjong: (p) => ({ game: mahjongGameFor(rev(p, "mahjongRev")) as AnyGame }),
  homerun: (p) => ({ game: homerunGameFor(rev(p, "homerunRev")) as AnyGame }),
  freekick: (p) => ({ game: freekickGameFor(rev(p, "freekickRev")) as AnyGame }),
  racing: (p) => ({ game: racingGameFor(rev(p, "racingRev")) as AnyGame }),
  freecell: (p) => ({ game: freecellGameFor(rev(p, "freecellRev")) as AnyGame }),
  tripeaks: (p) => ({ game: tripeaksGameFor(rev(p, "tripeaksRev")) as AnyGame }),
  pokersquares: (p) => ({ game: pokerSquaresGameFor(rev(p, "pokerSquaresRev")) as AnyGame }),
  fivehands: (p) => ({ game: fiveHandsGameFor(rev(p, "fiveHandsRev")) as AnyGame }),
  curling: (p) => ({ game: curlingGameFor(rev(p, "curlRev") ?? 1) as AnyGame }),
  blockfall: (p) => ({ game: blockfallGameFor(rev(p, "blockfallRev")) as AnyGame }),
  alleyroll: (p) => ({ game: alleyRollGameFor(rev(p, "alleyRollRev")) as AnyGame }),
  pool: (p) => ({ game: poolGameFor(rev(p, "poolRev")) as AnyGame }),
  minigolf: (p) => ({ game: minigolfGameFor(p.type === "minigolf" ? p.pars : undefined, p.type === "minigolf" ? p.golfRev : undefined) as AnyGame }),
  rally: (p) => ({ game: rallyGameFor(rev(p, "rallyRev")) as AnyGame }),
  slice: (p) => ({ game: sliceGameFor(rev(p, "sliceRev")) as AnyGame }),
  bubble: (p) => ({ game: bubbleGameFor(rev(p, "bubbleRev")) as AnyGame }),
  beat: (p) => ({ game: beatGameFor(rev(p, "beatRev")) as AnyGame }),
  snake: (p) => ({ game: snakeGameFor(rev(p, "snakeRev")) as AnyGame }),
  cross: (p) => ({ game: crossGameFor(rev(p, "crossRev")) as AnyGame }),
  wavefront: (p) => ({ game: wavefrontGameFor(rev(p, "wavRev")) as AnyGame }),
  flip: (p) => ({ game: flipGameFor(rev(p, "flipRev")) as AnyGame }),
  junction: (p) => ({ game: junctionGameFor(rev(p, "junctionRev")) as AnyGame }),
  inkbridge: (p) => ({ game: inkBridgeGameFor(rev(p, "inkRev")) as AnyGame }),
  burst: (p) => ({ game: burstGameFor(rev(p, "burstRev")) as AnyGame }),
  orbit: orbitSource,
  swing: (p) => ({ game: swingGameFor(rev(p, "swingRev")) as AnyGame }),
  snip: (p) => ({ game: snipGameFor(rev(p, "snipRev")) as AnyGame }),
  tilt: (p) => ({ game: tiltGameFor(rev(p, "tiltRev")) as AnyGame }),
  balltrack: (p) => ({
    game: makeBallTrackGame(
      (p as unknown as { course: Parameters<typeof makeBallTrackGame>[0] }).course,
      rev(p, "btRev"),
    ) as AnyGame,
  }),
  whack: (p) => ({ game: whackGameFor(rev(p, "whackRev")) as AnyGame }),
  clayshoot: (p) => ({ game: clayGameFor(rev(p, "clayRev")) as AnyGame }),
  // tenRev 1 (puzzle score shape) rides in the start state, as replayTenDropRun's tenDropInit puts it.
  tendrop: (p) => ({
    game: tenDropGame as AnyGame,
    init: () => tenDropInit(seedOf(p), rev(p, "tenRev")),
    endAlwaysStops: true,
  }),
  wordfall: (p) => ({ game: wordfallGameFor(rev(p, "wordfallRev")) as AnyGame, needsDict: true }),
  stroop: (p) => ({ game: colourClashGameFor(clashVariantOf(p as never)) as AnyGame }),
};

/** Types a stored round can be replayed for. */
export const REPLAY_TYPES = Object.keys(SOURCES);

export function canReplay(type: string): boolean {
  return type in SOURCES;
}

/** The sim (with the server's start state) a stored round replays on; for scripts that drive a fresh run. */
export function replayGameFor(puzzle: PuzzleData): AnyGame | null {
  const source = SOURCES[puzzle.type]?.(puzzle);
  if (!source) return null;
  const init = source.init;
  return init ? { ...source.game, init: () => init() } : source.game;
}

export interface ReplayStepper<S = any> {
  type: string;
  /** The game's fixed run length. */
  runTicks: number;
  /** The last tick the server's replay steps to (the run may end sooner by isOver). */
  lastTick: number;
  needsDict: boolean;
  init: () => S;
  /** Applies the stored input for `tick` (the next tick after state.tick). */
  step: (state: S, tick: number) => S;
  isOver: (state: S) => boolean;
  score: (state: S) => number;
}

/** A stepper for this stored round, or null when the type has no engine replay. */
export function makeStepper(puzzle: PuzzleData, answer: string): ReplayStepper | null {
  const source = SOURCES[puzzle.type]?.(puzzle);
  if (!source) return null;
  const { game } = source;
  const runTicks = game.runTicks;
  const run = parseRun(answer);
  const endTick = run.endTick > 0 ? Math.min(run.endTick, runTicks) : 0;
  const lastTick = source.endAlwaysStops
    ? endTick > 0
      ? endTick
      : runTicks
    : endTick > 0 && endTick < runTicks
      ? endTick
      : runTicks;
  const seed = seedOf(puzzle);
  let input: (tick: number) => unknown;
  if (source.taps) {
    const ticks = run.inputField
      .split(",")
      .map((part) => Number.parseInt(part, 10))
      .filter((tick) => Number.isInteger(tick));
    const taps = new Set(sanitizeTaps(ticks, runTicks).ticks);
    input = (tick) => taps.has(tick);
  } else {
    const events = new Map<number, ArcadeInputEvent>();
    for (const event of checkInputEvents(
      decodeInputEvents(run.inputField),
      runTicks,
      game.inputRanges ?? [],
    ).events)
      events.set(event.t, event);
    input = (tick) => events.get(tick) ?? null;
  }
  return {
    type: puzzle.type,
    runTicks,
    lastTick,
    needsDict: source.needsDict === true,
    init: source.init ?? (() => game.init(seed)),
    step: (state, tick) => game.step(state, input(tick)),
    isOver: (state) => game.isOver(state),
    score: (state) => game.score(state),
  };
}

export interface ReplayEnd<S = any> {
  state: S;
  /** The last tick that ran (the server's replayTick). */
  ticks: number;
  score: number;
}

/** Plays the stored round to its end exactly as the server replay does. */
export function replayToEnd<S>(
  stepper: ReplayStepper<S>,
  onTick?: (state: S, tick: number, previous: S) => void,
): ReplayEnd<S> {
  let state = stepper.init();
  let ticks = 0;
  for (let tick = 1; tick <= stepper.lastTick; tick++) {
    const previous = state;
    state = stepper.step(state, tick);
    ticks = tick;
    onTick?.(state, tick, previous);
    if (stepper.isOver(state)) break;
  }
  return { state, ticks, score: stepper.score(state) };
}
