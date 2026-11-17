/**
 * Which Attention intro demos may play (the Attention overhaul's stage 3, 15 Nov 2026): only one recorded on the stamp
 * rooms deal today (Eagle Eye scanRev 5, Double Take spotRev 4, Tally countRev 7, Matchmaker pairRev 4; Labyrinth and
 * Bomb Defusal on today's deal) and on Normal (no `level`), so a demo recorded before the overhaul, or on a level's
 * board, stops (the intro shows its still) until one is recorded on today's deal. introDemo.functions.ts asks this; the
 * phone's presentation tag (wordInput.ts ATTENTION_OVERHAUL_DEMOS) stops older touch layouts the same way.
 */
import { NORMAL, puzzleLevel } from "@/lib/levels/levels";
import { COUNT_REV_MARKS, PAIR_REV_CLEAR, SCAN_REV_MINUTE, SPOT_REV_NEXT } from "./attentionOverhaul";
import type { PuzzleData } from "./types";

export const ATTENTION_DEMO_GAMES = ["symscan", "spotdiff", "countup", "maze", "bomb", "pairmatch"] as const;

export function attentionDemoPlays(type: string, puzzle: PuzzleData | null | undefined): boolean {
  if (!(ATTENTION_DEMO_GAMES as readonly string[]).includes(type)) return true;
  if (!puzzle || puzzle.type !== type || puzzleLevel(puzzle) !== NORMAL) return false;
  if (puzzle.type === "symscan") return puzzle.scanRev === SCAN_REV_MINUTE;
  if (puzzle.type === "spotdiff") return puzzle.spotRev === SPOT_REV_NEXT;
  if (puzzle.type === "countup") return puzzle.countRev === COUNT_REV_MARKS;
  if (puzzle.type === "pairmatch") return puzzle.pairRev === PAIR_REV_CLEAR;
  if (puzzle.type === "bomb") return puzzle.bombVersion === 3 && !puzzle.bombInstant;
  return true;
}
