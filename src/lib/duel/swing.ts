/** Swing round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  swingCheckpoint,
  swingGame,
  swingGameFor,
  SWING_REV,
  SWING_REV_BAND,
  SWING_REV_TUNED,
  SWING_REV_TUNEC,
  SWING_REV_SPREAD,
  SWING_REV_TALL,
  SWING_REV_TARGET, SWING_REV_STRICT, SWING_REV_EXPAND, SWING_REV_ASSAULT, SWING_REV_REWORK, SWING_REV_DARK, SWING_REV_SLIDE, SWING_REV_BIG,
  SWING_REV_V2,
  SWING_REV_V3,
  SWING_CHECKPOINT_INTERVAL,
  SWING_CHECKPOINT_KEYS,
  swingExtra,
  swingLevelGame,
  swingPuzzleLevel,
  type SwingCheckpoint,
  type SwingLevel,
  type SwingState,
} from "@/lib/arcade/swing";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const run = makeArcadeRun<SwingState, SwingCheckpoint>({
  tag: "swing",
  game: swingGame,
  checkpoint: swingCheckpoint,
  keys: SWING_CHECKPOINT_KEYS,
  interval: SWING_CHECKPOINT_INTERVAL,
});

const tallRunV9 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_TALL), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
/** swingRev 10 (scoring targets): swingRev 9 play on the lifted curve. */
const targetRunV10 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_TARGET), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
/** swingRev 13 (the expansion): the deeper, wider cavern with combos, gems, speed gates and set-route ledges, scored to 200. */
const expandRunV13 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_EXPAND), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
/** swingRev 14 (the assault course): sections of ledges, hooks and squeezes, restarts on a miss, scored to 200. */
const assaultRunV14 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_ASSAULT), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
/** swingRev 15 (the swinging course): mostly hook-to-hook swinging with short ledge runs, scored to 200. */
const reworkRunV15 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_REWORK), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
/** swingRev 16 (the dark ledge runs): rev 15's course, longer, over 90 s (its game's runTicks), the ledge runs dark. */
/** swingRev 17 (the sliding hooks and the clean-swing streak): rev 16's 90 s, scored to 200 on its own parts. */
const slideRunV17 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_SLIDE), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
/** swingRev 18 (the bigger hero): rev 17 on a 14 px body. */
const bigRunV18 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_BIG), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
const darkRunV16 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_DARK), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
const strictRunV11 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_STRICT), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
const spreadRunV8 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_SPREAD), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
const tunecRunV7 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_TUNEC), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
const tunedRunV6 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_TUNED), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
const bandRunV5 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_BAND), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
const chaseRunV4 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
const dragonRunV3 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_V3), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });
const dragonRunV2 = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingGameFor(SWING_REV_V2), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL });

export type SwingResult = FlatReplay<SwingState, SwingCheckpoint> & ReturnType<typeof swingExtra>;

export const encodeSwingRun = run.encode;
export const decodeSwingRun = run.decode;

const levelRuns = new Map<SwingLevel, typeof run>();
/** swingRev 18 at a level (the puzzle's stored `level`): the same run format, the level's course and rules. */
function levelRun(level: SwingLevel): typeof run {
  let r = levelRuns.get(level);
  if (!r) levelRuns.set(level, (r = makeArcadeRun<SwingState, SwingCheckpoint>({ tag: "swing", game: swingLevelGame(level), checkpoint: swingCheckpoint, keys: SWING_CHECKPOINT_KEYS, interval: SWING_CHECKPOINT_INTERVAL })));
  return r;
}

/** The single place a Swing score is worked out. */
/** `observe` (display only, the reveal's run picture): called with each state the replay steps to. */
/** `level`: the puzzle's stored level (swingRev 18 only; absent or Normal, today's run exactly). */
export function replaySwingRun(seed: number, raw: string, rev?: number, observe?: (state: SwingState) => void, level?: unknown): SwingResult {
  const lvl = swingPuzzleLevel(rev, level);
  const picked = lvl ? levelRun(lvl) : rev === SWING_REV_BIG ? bigRunV18 : rev === SWING_REV_SLIDE ? slideRunV17 : rev === SWING_REV_DARK ? darkRunV16 : rev === SWING_REV_REWORK ? reworkRunV15 : rev === SWING_REV_ASSAULT ? assaultRunV14 : rev === SWING_REV_EXPAND ? expandRunV13 : rev === SWING_REV_STRICT ? strictRunV11 : rev === SWING_REV_TARGET ? targetRunV10 : rev === SWING_REV_TALL ? tallRunV9 : rev === SWING_REV_SPREAD ? spreadRunV8 : rev === SWING_REV_TUNEC ? tunecRunV7 : rev === SWING_REV_TUNED ? tunedRunV6 : rev === SWING_REV_BAND ? bandRunV5 : rev === SWING_REV ? chaseRunV4 : rev === SWING_REV_V3 ? dragonRunV3 : rev === SWING_REV_V2 ? dragonRunV2 : run;
  const result = picked.replay(seed, raw, observe);
  return { ...result, ...swingExtra(result.state) };
}
