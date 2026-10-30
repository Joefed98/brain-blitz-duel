/**
 * Builds scripts/fixtures/replay-runs.json: one stored round per replayable
 * engine game (the 22 arcade games, Letterfall, Tenfall, Bonk, Pull! and Mixed
 * Signals) on the revision live rooms stamp today. Each puzzle comes from the
 * real room generator (generatePuzzle), each run from the skill-band bots
 * (scripts/arcade-skill-bands/bots, "great" level) or, for the five engine games
 * without one, a seeded scripted driver; the stored score is what the server's
 * own grading path (gradeAnswer) stores for that answer. Script only: floats
 * and Math are fine here, because the output is an input log the sim replays.
 *
 * Rebuild only when the replay fixtures must change (a new game or revision):
 *   bun scripts/replay-fixtures.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync } from "node:fs";

import "../src/lib/duel/wordfallDict.server";
import {
  encodeInputEvents,
  inputAt,
  recordInput,
  type ArcadeInputEvent,
  type InputRange,
} from "../src/lib/arcade/engine";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { replayGameFor, REPLAY_TYPES } from "../src/lib/replay/steppers";
import { Human } from "./arcade-skill-bands/human";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import type { SkillBot } from "./arcade-skill-bands/bot";

/** The revision field each arcade puzzle stamps. */
const REV_KEY: Record<string, string> = {
  hover: "hoverRev",
  skyline: "skylineRev",
  bintoss: "binRev",
  bullseye: "bullRev",
  matchup: "matchupRev",
  breaker: "brkRev",
  rally: "rallyRev",
  slice: "sliceRev",
  bubble: "bubbleRev",
  beat: "beatRev",
  snake: "snakeRev",
  cross: "crossRev",
  wavefront: "wavRev",
  flip: "flipRev",
  junction: "junctionRev",
  inkbridge: "inkRev",
  burst: "burstRev",
  orbit: "orbitRev",
  swing: "swingRev",
  snip: "snipRev",
  tilt: "tiltRev",
  balltrack: "btRev",
  pinball: "pinRev",
  homerun: "homerunRev",
  freekick: "freekickRev",
  racing: "racingRev",
};

/** A fixed seed per game, so a rebuild deals the same rooms (the generator's own seed is overwritten where it is free). */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface FixtureRun {
  type: string;
  label: string;
  puzzle: PuzzleData;
  answer: string;
  score: number;
}

/**
 * Greedy lookahead driver for Bonk, Pull!, Tenfall and Mixed Signals: every few
 * ticks it tries each candidate input (a coarse grid over the declared ranges),
 * plays each forward with no input for a short window and takes the one that
 * scores best, if it beats doing nothing. Logged through recordInput like the phone.
 */
function greedy(type: string, puzzle: PuzzleData, game: any): string {
  const ranges = (game.inputRanges ?? []) as readonly InputRange[];
  const steps = (r: readonly [number, number], n: number) => {
    if (r[1] <= r[0]) return [r[0]];
    const out = new Set<number>();
    for (let i = 0; i < n; i++) out.add(Math.round(r[0] + ((r[1] - r[0]) * (i + 0.5)) / n));
    return [...out];
  };
  const grid = type === "whack" ? 9 : type === "stroop" ? 4 : type === "tendrop" ? 6 : 7;
  const candidates: Omit<ArcadeInputEvent, "t">[] = [];
  for (const range of ranges)
    for (const a of steps(range.a, grid))
      for (const b of steps(range.b, type === "stroop" ? 1 : grid))
        candidates.push({ k: range.k, a, b, c: range.c[0], d: range.d[0] });
  const every = type === "whack" ? 6 : 12;
  const look = type === "whack" ? 4 : 50;
  const ahead = (s: any, first: ArcadeInputEvent | null) => {
    let x = game.step(s, first);
    for (let i = 1; i < look && !game.isOver(x); i++) x = game.step(x, null);
    return game.score(x) * 1000 + (x.hits ?? x.correct ?? x.cleared ?? 0);
  };
  const events: ArcadeInputEvent[] = [];
  const seed = (puzzle as any).seed as number;
  let state = game.init(seed);
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    if (t % every === 0) {
      let best: ArcadeInputEvent | null = null;
      let bestValue = ahead(state, null);
      for (const c of candidates) {
        const ev = { t, ...c };
        const value = ahead(state, ev);
        if (value > bestValue) {
          bestValue = value;
          best = ev;
        }
      }
      recordInput(events, best, ranges);
    }
    state = game.step(state, inputAt(events, t));
  }
  return `${seed}|${game.score(state)}|${encodeInputEvents(events)}|${state.tick}|`;
}

/**
 * Tenfall: taps the visible tile that lands the running total exactly on the
 * target, else the one that gets closest without passing it (a reaction's
 * worth of ticks between taps). Logged through recordInput like the phone.
 */
function tenfallBot(puzzle: PuzzleData, game: any): string {
  const seed = (puzzle as any).seed as number;
  const ranges = (game.inputRanges ?? []) as readonly InputRange[];
  const events: ArcadeInputEvent[] = [];
  let state = game.init(seed);
  let wait = 0;
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    if (wait > 0) wait -= 1;
    else {
      const target = state.plan.targets[state.stage];
      let best: { col: number; y: number; gap: number } | null = null;
      for (const tile of state.tiles) {
        const top = tile.y / 256;
        if (top < 0 || top > TD_H - TD_CONFIG.tileH) continue;
        const result = tdApply(tile.tile, state.total);
        if (result === null || target === undefined || result > target || result === state.total)
          continue;
        const gap = target - result;
        if (!best || gap < best.gap)
          best = { col: tile.col, y: Math.round(top + TD_CONFIG.tileH / 2), gap };
      }
      if (best) {
        recordInput(events, { t, k: TD_INPUT_TAP, a: best.col, b: best.y, c: 0, d: 0 }, ranges);
        wait = 14;
      }
    }
    state = game.step(state, inputAt(events, t));
  }
  return `${seed}|${game.score(state)}|${encodeInputEvents(events)}|${state.tick}|`;
}
import { tdApply, TD_CONFIG, TD_H, TD_INPUT_TAP } from "../src/lib/arcade/tenDrop";

/* Letterfall: the scripted word-finding bot from scripts/wordfall-check.ts (section 3), unchanged in play. */
const PREFIXES = (() => {
  const set = new Set<string>();
  for (const word of decodeWordfallWords(WORDFALL_WORDS_FC))
    for (let i = 1; i <= word.length; i++) set.add(word.slice(0, i));
  return set;
})();
interface Cell {
  col: number;
  index: number;
  id: number;
  letter: number;
}
function bestWord(state: WordfallState): Cell[] | null {
  const cells: Cell[][] = state.well.map((stack, col) => {
    const out: Cell[] = [];
    for (let index = 0; index < stack.length; index++) {
      const t = stack[index]!;
      if (!wfSettled(t, index)) break;
      out.push({ col, index, id: t.id, letter: t.l });
    }
    return out;
  });
  const heights = state.well.map((s) => s.length);
  let best: Cell[] | null = null;
  let bestValue = -1;
  const path: Cell[] = [];
  const used = new Set<number>();
  const visit = (cell: Cell, word: string) => {
    const w = word + wfSpelling(cell.letter);
    if (!PREFIXES.has(w) || path.length >= 12) return;
    path.push(cell);
    used.add(cell.id);
    if (w.length >= 3 && isWordfallWord(w)) {
      let danger = 0;
      for (const c of path) danger += heights[c.col]! * heights[c.col]!;
      const value = wfWordPoints(w.length) * 1000 + danger;
      if (value > bestValue) {
        bestValue = value;
        best = [...path];
      }
    }
    for (let dc = -1; dc <= 1; dc++)
      for (let di = -1; di <= 1; di++) {
        const next = cells[cell.col + dc]?.[cell.index + di];
        if (next && !used.has(next.id)) visit(next, w);
      }
    path.pop();
    used.delete(cell.id);
  };
  for (const column of cells) for (const cell of column) visit(cell, "");
  const chosen = best as Cell[] | null;
  if (!chosen) return null;
  const length = chosen.reduce((n, c) => n + wfSpelling(c.letter).length, 0);
  const tallest = Math.max(...heights);
  const late = state.tick > WF_RUN_TICKS - 240;
  return length >= 5 || tallest >= 7 || late ? chosen : null;
}
function wordfallBot(puzzle: PuzzleData, game: any): string {
  const seed = (puzzle as any).seed as number;
  let state = game.init(seed) as WordfallState;
  const log: ArcadeInputEvent[] = [];
  let plan: Cell[] = [];
  let step = 0;
  while (!game.isOver(state)) {
    const t = state.tick + 1;
    let cand: ArcadeInputEvent | null = null;
    if (step === 0 && state.chain.length === 0) plan = bestWord(state) ?? [];
    if (plan.length) {
      if (step < plan.length) {
        const cell = plan[step]!;
        cand = {
          t,
          k: WF_INPUT_TAP,
          a: WF_WELL_X + cell.col * WF_CELL + WF_CELL / 2,
          b: WF_WELL_Y + wfRestY(cell.index) / 256 + WF_CELL / 2,
          c: 0,
          d: 0,
        };
      } else cand = { t, k: WF_INPUT_ENTER, a: 0, b: 0, c: 0, d: 0 };
      step++;
      if (step > plan.length) {
        plan = [];
        step = 0;
      }
    }
    recordInput(log, cand, game.inputRanges);
    state = game.step(state, inputAt(log, t));
  }
  return `${seed}|${game.score(state)}|${encodeInputEvents(log)}|${state.tick}|`;
}
import { decodeWordfallWords, isWordfallWord } from "../src/lib/arcade/wordfallDict";
import { WORDFALL_WORDS_FC } from "../src/lib/arcade/wordfallWords.data";
import {
  wfRestY,
  wfSettled,
  wfSpelling,
  wfWordPoints,
  WF_CELL,
  WF_INPUT_ENTER,
  WF_INPUT_TAP,
  WF_RUN_TICKS,
  WF_WELL_X,
  WF_WELL_Y,
  type WordfallState,
} from "../src/lib/arcade/wordfall";

/**
 * --add=tendrop,stroop,snip appends fresh runs for those games (a new revision on
 * main) to the existing file and keeps every stored run already there, so older
 * revisions stay covered.
 */
const ADD =
  process.argv
    .find((a) => a.startsWith("--add="))
    ?.slice(6)
    .split(",")
    .filter(Boolean) ?? null;
const FIXTURE_URL = new URL("./fixtures/replay-runs.json", import.meta.url);

async function main() {
  const out: FixtureRun[] = [];
  for (const type of ADD ?? REPLAY_TYPES) {
    const puzzle = generatePuzzle(type as PuzzleType);
    const spec = GAME_BY_TYPE.get(type as never);
    let answer: string;
    if (spec) {
      const rev = (puzzle as any)[REV_KEY[type]!] ?? null;
      const seed = (puzzle as any).seed as number;
      const mod = await import(
        new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url).href
      );
      const bot = mod.bot as SkillBot;
      const game = replayGameFor(puzzle)!;
      const human = new Human(type, seed, "great");
      const result = bot({ game, seed, rev, human });
      const events = result.events ?? [];
      const taps = result.taps ?? [];
      const byTick = new Map(events.map((e) => [e.t, e]));
      const tapSet = new Set(taps);
      let state = game.init(seed);
      while (!game.isOver(state) && state.tick < game.runTicks) {
        const t = state.tick + 1;
        state = game.step(state, spec.taps ? tapSet.has(t) : (byTick.get(t) ?? null));
      }
      const score = game.score(state);
      answer = spec.encode(
        {
          seed,
          claimedScore: score,
          events,
          inputs: taps,
          taps: [],
          endTick: state.tick,
          checkpoints: [],
        },
        rev,
        seed,
      );
    } else {
      // The server's own start state for the stored revision (Tenfall tenRev 1 rides in it).
      const game = replayGameFor(puzzle)!;
      answer =
        type === "wordfall"
          ? wordfallBot(puzzle, game)
          : type === "tendrop"
            ? tenfallBot(puzzle, game)
            : greedy(type, puzzle, game);
    }
    // Fixture runs carry no checkpoints, so the server logs a desync per run; that log is noise here.
    const error = console.error;
    console.error = () => {};
    const graded = gradeAnswer(puzzle, answer, 0);
    console.error = error;
    out.push({
      type,
      label: `${spec ? "great bot" : "scripted"}, today's revision${ADD ? ` (added ${new Date().toISOString().slice(0, 10)})` : ""}`,
      puzzle,
      answer: graded.answer ?? answer,
      score: graded.score,
    });
    console.log(`${type.padEnd(10)} score ${graded.score}`);
  }
  if (ADD) {
    const existing = JSON.parse(readFileSync(FIXTURE_URL, "utf8")) as {
      recorded: string;
      runs: FixtureRun[];
      puzzles: unknown[];
    };
    writeFileSync(
      FIXTURE_URL,
      JSON.stringify({ ...existing, runs: [...existing.runs, ...out] }) + "\n",
    );
    console.log(`appended ${out.length} runs`);
    return;
  }
  // Two solved puzzle rounds for the time-lapse (the stored answer is the puzzle's own minimum solution).
  const puzzles: {
    type: string;
    puzzle: PuzzleData;
    answer: string;
    isCorrect: boolean;
    score: number;
  }[] = [];
  for (const type of ["unblock", "flood"] as const) {
    const puzzle = generatePuzzle(type) as any;
    const answer =
      type === "unblock" ? String(puzzle.solution) : (puzzle.solution as number[]).join(",");
    const graded = gradeAnswer(puzzle, answer, 20_000);
    puzzles.push({
      type,
      puzzle,
      answer: graded.answer ?? answer,
      isCorrect: graded.isCorrect,
      score: graded.score,
    });
    console.log(`${type.padEnd(10)} score ${graded.score} (time-lapse fixture)`);
  }
  writeFileSync(
    FIXTURE_URL,
    JSON.stringify({ recorded: new Date().toISOString().slice(0, 10), runs: out, puzzles }) + "\n",
  );
  console.log(`wrote ${out.length} runs`);
}

await main();
