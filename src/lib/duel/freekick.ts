/** Top Bins (`freekick`) round plumbing: the server replays with the STORED seed and stamp and keeps its own score. */

import {
  freekickCheckpoint,
  freekickGameFor,
  freekickStdParts,
  FK_OUT_GOAL,
  FK_OUT_UNTAKEN,
  FREEKICK_CHECKPOINT_INTERVAL,
  FREEKICK_CHECKPOINT_KEYS,
  FREEKICK_KICKS,
  FREEKICK_REV_2,
  FREEKICK_REV_3,
  FREEKICK_REV_4,
  FREEKICK_REV_5,
  FREEKICK_REV_6,
  FREEKICK_REV_STD,
  fkLevelOf,
  FK_M,
  type FreekickCheckpoint,
  type FreekickState,
} from "@/lib/arcade/freekick";
import type { StdPart } from "@/lib/arcade/arcadeStandard";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";

const runFor = (rev: number) =>
  makeArcadeRun<FreekickState, FreekickCheckpoint>({
    tag: "freekick",
    game: freekickGameFor(rev),
    checkpoint: freekickCheckpoint,
    keys: FREEKICK_CHECKPOINT_KEYS,
    interval: FREEKICK_CHECKPOINT_INTERVAL,
    emptyIsZero: true,
  });
const run = runFor(FREEKICK_REV_STD);
const runV2 = runFor(FREEKICK_REV_2);
const runV3 = runFor(FREEKICK_REV_3);
const runV4 = runFor(FREEKICK_REV_4);
/** freekickRev 5's run at each level (and rev 6's: the same game scored with Easy's and Normal's ease). */
const runsV5 = new Map<string, ReturnType<typeof runFor>>();
function runV5(level?: string | null, rev: number = FREEKICK_REV_5) {
  const l = fkLevelOf(level);
  const key = `${rev}:${l}`;
  let r = runsV5.get(key);
  if (!r) {
    r = makeArcadeRun<FreekickState, FreekickCheckpoint>({
      tag: "freekick",
      game: freekickGameFor(rev, l),
      checkpoint: freekickCheckpoint,
      keys: FREEKICK_CHECKPOINT_KEYS,
      interval: FREEKICK_CHECKPOINT_INTERVAL,
      emptyIsZero: true,
    });
    runsV5.set(key, r);
  }
  return r;
}

export interface FreekickResult extends FlatReplay<FreekickState, FreekickCheckpoint> {
  /** Goals scored, kicks taken, targets hit, goals curled round the wall, the best run of goals. */
  goals: number;
  taken: number;
  targets: number;
  curled: number;
  best: number;
  /** Per kick: its outcome (FK_OUT_*; −1 not reached). */
  outs: number[];
  /** All ten kicks taken. */
  finished: boolean;
  std: true;
  parts: StdPart[];
}

export const encodeFreekickRun = run.encode;
export const decodeFreekickRun = run.decode;

/**
 * The single place a Top Bins score is worked out (freekickRev 6 and 5 at the stored level, 4 rev 4, 3 rev 3, 2 rev 2;
 * anything else rev 1).
 */
export function replayFreekickRun(seed: number, raw: string, rev?: number | null, level?: string | null): FreekickResult {
  const r = rev ?? FREEKICK_REV_STD;
  const result = (r >= FREEKICK_REV_5 ? runV5(level, r >= FREEKICK_REV_6 ? FREEKICK_REV_6 : FREEKICK_REV_5) : r >= FREEKICK_REV_4 ? runV4 : r >= FREEKICK_REV_3 ? runV3 : r >= FREEKICK_REV_2 ? runV2 : run).replay(seed, raw);
  const s = result.state;
  const taken = s.outs.filter((o) => o >= 0 && o !== FK_OUT_UNTAKEN).length;
  return {
    ...result,
    goals: s.outs.filter((o) => o === FK_OUT_GOAL).length,
    taken,
    targets: s.targets,
    curled: s.curled,
    best: s.best,
    outs: s.outs.slice(),
    finished: taken === FREEKICK_KICKS,
    std: true,
    parts: freekickStdParts(s) ?? [],
  };
}

/** One kick of a run for the reveal (display only): its outcome, where it crossed the goal line (m), the strike and the flags. */
export interface FreekickKickSummary {
  out: number;
  /** Crossing point in metres (x across, + right; y up), or null when it never reached the goal line. */
  at: { x: number; y: number } | null;
  strike: number;
  target: boolean;
  skill: boolean;
}

/**
 * Each kick of a stored run, replayed on the stored stamp and level (display only: the reveal's goal-frame picture;
 * the score is always replayFreekickRun's). Kicks never reached are left out.
 */
export function freekickKickSummaries(seed: number, raw: string, rev?: number | null, level?: string | null): FreekickKickSummary[] {
  const game = freekickGameFor(rev ?? FREEKICK_REV_STD, level);
  const events = new Map(decodeFreekickRun(raw).events.map((e) => [e.t, e]));
  const out: FreekickKickSummary[] = [];
  let s = game.init(seed);
  let guard = 0;
  while (!game.isOver(s) && guard++ < 20_000) {
    const before = s.outs[s.k] ?? -1;
    const k = s.k;
    const strike = s.strike ?? 0;
    s = game.step(s, events.get(s.tick + 1) ?? null);
    const now = s.outs[k] ?? -1;
    if (before < 0 && now >= 0) {
      const f = s.fl;
      const crossed = f && (f.crossX !== 0 || f.crossY !== 0);
      const flags = s.flags[k] ?? 0;
      out.push({ out: now, at: crossed ? { x: f.crossX / FK_M, y: f.crossY / FK_M } : null, strike, target: (flags & 1) === 1, skill: (flags & 8) === 8 });
    }
  }
  return out;
}
