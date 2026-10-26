/**
 * The room puzzle a seed dealt before the Logic depth revision (25 Oct 2026, docs/depth/d6-logic.md), exactly as
 * scripts/puzzle-fairness/run.ts's roomPuzzle built it then: today's deal without the depth stamp (and Blackout's /
 * Polypotions' public par), and for the four bigger-board games the old board from the same seeded draw (Mosaic 7 × 7,
 * Tents and Trees 8 × 8, Shikaku 10 × 10 from their kept legacy generators; Lamplighter 9 × 9 from the bank rooms drew
 * from then, kept as scripts/fixtures/lightup-bank-9x9.json.gz). Script-only: the checks that replay answers recorded
 * before the change (depth-d6-check, scoring-bands-check, scoring-rev3-check) and depth-d6-bands.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { bankIndexFor } from "../src/lib/duel/puzzleBank.server";
import { generateLegacyNonogram } from "../src/lib/duel/nonogram.server";
import { generateLegacyShikaku } from "../src/lib/duel/shikaku.server";
import { generateLegacyTents } from "../src/lib/duel/tents.server";
import { withSeededRandom } from "../src/lib/duel/random";
import type { LightUpPuzzleData, PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { roomPuzzle } from "./puzzle-fairness/run";

export const DEPTH_BIGGER_BOARDS: ReadonlySet<PuzzleType> = new Set<PuzzleType>(["nonogram", "tents", "shikaku", "lightup"]);

export function stripDepth(puzzle: PuzzleData): PuzzleData {
  const { depthRev: _d, ...rest } = puzzle as PuzzleData & { depthRev?: number; par?: number };
  if (puzzle.type === "lightsout" || puzzle.type === "tubes") delete (rest as { par?: number }).par;
  return rest as PuzzleData;
}

let legacyLightUp: LightUpPuzzleData[] | null = null;
function legacyLightUpBank(): LightUpPuzzleData[] {
  legacyLightUp ??= (JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/lightup-bank-9x9.json.gz", import.meta.url))).toString("utf8")) as { bank: LightUpPuzzleData[] }).bank;
  return legacyLightUp;
}

/** The old board alone (no stamps) a room seed drew before the depth revision; null when the board did not change. */
export function legacyBoard(type: PuzzleType, seed: number): PuzzleData | null {
  switch (type) {
    case "nonogram":
      return withSeededRandom(seed, () => generateLegacyNonogram());
    case "tents":
      return withSeededRandom(seed, () => generateLegacyTents());
    case "shikaku":
      return withSeededRandom(seed, () => generateLegacyShikaku());
    case "lightup": {
      const bank = legacyLightUpBank();
      return JSON.parse(JSON.stringify(bank[bankIndexFor("lightup", seed, bank.length)])) as PuzzleData;
    }
    default:
      return null;
  }
}

/** The room puzzle (type, seed) as rooms stored it before the depth revision. */
export function legacyRoomPuzzle(type: PuzzleType, seed: number): PuzzleData {
  const dealt = roomPuzzle(type, seed);
  const board = legacyBoard(type, seed);
  if (!board) return stripDepth(dealt);
  // The old board with the stamps the deal carries (speedPar, puzzleScoreRev…), never the new board's fields.
  const stamps = Object.fromEntries(Object.entries(dealt as object).filter(([k]) => /(?:Rev|Version)$|^speedPar$/.test(k)));
  return stripDepth({ ...(board as object), ...stamps } as PuzzleData);
}

/** Kept name for depth-d6-bands. */
export const legacyDepthPuzzle = legacyRoomPuzzle;
