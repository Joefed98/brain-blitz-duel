/**
 * Letterfall round plumbing. The phone sends the seed, its tile taps and Enter
 * presses with the sim tick each applied on, the tick it reached, checkpoints
 * and the score it believes it earned; the server replays with the STORED seed
 * (and the same dictionary) and keeps its own score.
 */

import {
  wfWord,
  wordfallCheckpoint,
  wordfallGameFor,
  WF_CHECKPOINT_INTERVAL,
  WF_CHECKPOINT_KEYS,
  WF_PAR,
  WF_RUN_TICKS,
  type WordfallCheckpoint,
  type WordfallState,
} from "@/lib/arcade/wordfall";
import { makeArcadeRun, type FlatReplay, type FlatRun } from "./arcadeRun";

const runs = new Map<number, ReturnType<typeof makeArcadeRun<WordfallState, WordfallCheckpoint>>>();

function runFor(rev?: number) {
  const game = wordfallGameFor(rev);
  const key = rev ?? 1;
  let run = runs.get(key);
  if (!run) {
    run = makeArcadeRun<WordfallState, WordfallCheckpoint>({
      tag: "wordfall",
      game,
      checkpoint: wordfallCheckpoint,
      keys: WF_CHECKPOINT_KEYS,
      interval: WF_CHECKPOINT_INTERVAL,
    });
    runs.set(key, run);
  }
  return run;
}

export function encodeWordfallRun(run: FlatRun<WordfallCheckpoint>, rev?: number): string {
  return runFor(rev).encode(run);
}

export function decodeWordfallRun(raw: string, rev?: number): FlatRun<WordfallCheckpoint> {
  return runFor(rev).decode(raw);
}

export interface WordfallFacts {
  points: number;
  par: number;
  words: number;
  cleared: number;
  invalid: number;
  submits: number;
  taps: number;
  longest: number;
  /** Best words, uppercase, best first. */
  best: string[];
  /** True when a tile could not enter a full column. */
  overflow: boolean;
  /** True when the run lasted the full 90 s. */
  survived: boolean;
  finished: boolean;
}

export function wordfallFacts(state: WordfallState): WordfallFacts {
  return {
    points: state.points,
    par: WF_PAR,
    words: state.words,
    cleared: state.cleared,
    invalid: state.invalid,
    submits: state.submits,
    taps: state.taps,
    longest: state.longest,
    best: state.best.map((letters) => wfWord(letters).toUpperCase()),
    overflow: state.over === 1,
    survived: state.over !== 1 && state.tick >= WF_RUN_TICKS,
    finished: state.points >= WF_PAR,
  };
}

export type WordfallResult = FlatReplay<WordfallState, WordfallCheckpoint> & WordfallFacts;

/** The single place a Letterfall score is worked out (needs the dictionary installed). */
export function replayWordfallRun(seed: number, raw: string, rev?: number): WordfallResult {
  const result = runFor(rev).replay(seed, raw);
  return { ...result, ...wordfallFacts(result.state) };
}
