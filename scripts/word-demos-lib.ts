/**
 * The Word games' intro demos (the Word overhaul, 15 Nov 2026; the merge captain's demo plan, as Action's): each of the
 * nine games' intro example dealt exactly as practice deals it (practiceDealFn's example branch, so on the stamps rooms
 * deal today), played by the game's near-perfect kit player (scripts/puzzle-fairness/kits-word.ts) and graded through the
 * server's own gradeAnswer as a phone sends it (standard-lib's gradeSteps). The fixture
 * (scripts/fixtures/word-demos.json, `bun scripts/word-demos-record.ts`) stores each run; word-demos-check proves every
 * stored run still scores exactly what the server's grade says, on the stamps rooms deal. Nothing here saves a demo to
 * any database: the manual "Save intro demos" workflow does that after the final merge. Script-only.
 */
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { INTRO_EXAMPLE_ID, INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import { dealWordStar } from "../src/lib/duel/wordStar";
import { generateWordsmithExample } from "../src/lib/duel/wordsmith.server";
import { dealWordOverhaul } from "../src/lib/duel/wordOverhaul.server";
import { bankedIntroExample } from "../src/lib/duel/puzzleBank.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { SKILLS, hashText, makeRng, type Step } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { asPhoneSends, gradeSteps } from "./standard-lib";
import { splitPuzzle } from "../src/lib/duel/secrets";

/** The digest of a public half as the phone holds it (keys in the order served). */
export function publicDigestOf(pub: PuzzleData): number {
  return hashText(JSON.stringify(pub));
}

/** The nine Word games, in the order the fixture lists them. */
export const WORD_DEMO_TYPES = ["wordsmith", "tilegrid", "wordslide", "wordhunt", "wordsearch", "letterwheel", "strikeout", "codeword", "swapword"] as const satisfies readonly PuzzleType[];
export type WordDemoType = (typeof WORD_DEMO_TYPES)[number];

/** The level the demo player plays at. */
export const WORD_DEMO_LEVEL = "near" as const;

/**
 * The open games (word finds with no finish: Nucleus, Forage) keep finding words until the buzzer; an intro demo shows
 * the first 30 s of the run (the moves made by then, graded as the phone sends them at the buzzer).
 */
export const DEMO_OPEN_TYPES: ReadonlySet<string> = new Set(["wordsmith", "wordhunt"]);
export const DEMO_OPEN_CAP_MS = 30_000;

export interface WordDemoRun {
  type: WordDemoType;
  exampleId: string;
  /** hashText of the dealt example (public and private halves). */
  exampleDigest: number;
  /** hashText of the example's public half, the deal the phone is served (the save script compares the served deal). */
  publicDigest: number;
  /** The example's top-level version stamps, as a deal signature reads them. */
  stamps: Record<string, number>;
  /** The kit player's drafts, each at its round-clock ms, as the phone sends them. */
  steps: Step[];
  timed: boolean;
  score: number;
  isCorrect: boolean;
  seconds: number;
}

/** The intro example exactly as practiceDealFn deals it for a Word game (src/lib/duel/practice.functions.ts). */
export function wordIntroExample(type: WordDemoType): PuzzleData {
  return bankedIntroExample(type) ?? withSeededRandom(INTRO_EXAMPLE_SEED, () => type === "wordsmith" ? dealWordStar(dealWordOverhaul(generateWordsmithExample())) : generatePuzzle(type, {}));
}

export function exampleStamps(puzzle: PuzzleData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(puzzle as unknown as Record<string, unknown>)) {
    if (typeof v === "number" && (/Rev$/.test(k) || /Version$/.test(k) || k === "speedPar")) out[k] = v;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** Plays and grades one game's demo run. */
export function playWordDemo(type: WordDemoType): WordDemoRun {
  const kit = KITS[type];
  if (!kit) throw new Error(`no kit for ${type}`);
  const puzzle = wordIntroExample(type);
  const limit = puzzleTimeLimitMs(puzzle);
  const play = kit.play(puzzle, makeRng(hashText(`word-demo:${type}:${INTRO_EXAMPLE_ID}`)), SKILLS[WORD_DEMO_LEVEL], limit);
  const all = asPhoneSends(puzzle, play.steps);
  const steps = DEMO_OPEN_TYPES.has(type) ? all.filter((s) => s.atMs <= DEMO_OPEN_CAP_MS) : all;
  const run = gradeSteps(puzzle, steps, play.timed);
  return {
    type,
    exampleId: INTRO_EXAMPLE_ID,
    exampleDigest: hashText(JSON.stringify(puzzle)),
    publicDigest: publicDigestOf(splitPuzzle(puzzle).pub as PuzzleData),
    stamps: exampleStamps(puzzle),
    steps,
    timed: play.timed,
    score: run.score,
    isCorrect: run.isCorrect,
    seconds: run.seconds,
  };
}
