/**
 * The rated screens' display rules (wave 3, session W3c): which picker options show, when the opponent's score hides,
 * how a recorded run's age reads, and the words. Pure: no React, no server, so rated-screens-check proves each one.
 *
 * Nothing here decides a result, a rating or a match: the server does (backend.ts).
 */
import { ARCADE_GROUPS } from "@/lib/duel/arcadeGroups";
import { RATED_CHOICES } from "./matchmaking";
import { puzzleName } from "@/lib/duel/catalogue";
import type { PuzzleType } from "@/lib/duel/types";

import type { BestOf, MatchSize, PlacementResult, RatedOptions, RatedPick } from "./backend";
import { PLACEMENT_MATCHES } from "./tierDisplay";

/* ------------------------------------------------------------------ the hidden finish (mockup 06) */

/**
 * The hidden finish is W3b's rule (src/lib/rated/matchmaking.ts): the opponent's score is hidden from the moment 20 %
 * of the game's time is left (`elapsedMs >= limitMs × 0.8`) until the game's result; the server hides it too
 * (ratedOpponentScoreFn). One rule, re-exported here for the screens.
 */
export { HIDDEN_FINISH_SHARE, opponentScoreHidden } from "./matchmaking";

/* ------------------------------------------------------------------ the picker (mockup 02, launch set) */

const PUZZLE_CATEGORY_LABELS: Record<string, string> = {
  word: "Word",
  number: "Number",
  speed: "Speed",
  attention: "Attention",
  pattern: "Pattern",
  logic: "Logic",
};

export function pickLabel(pick: RatedPick): string {
  if (pick === "mixed") return "Mixed";
  if (pick === "puzzles") return "All puzzles";
  if (pick === "arcade") return "All arcade";
  return PUZZLE_CATEGORY_LABELS[pick] ?? ARCADE_GROUPS.find((g) => g.id === pick)?.label ?? pick;
}

/** The line under a pick on the Play card and in the picker. */
export function pickNote(pick: RatedPick): string {
  if (pick === "mixed") return "A game from any category";
  if (pick === "puzzles") return "Puzzle games only";
  if (pick === "arcade") return "Arcade games only";
  return isArcadePick(pick) ? "Arcade, one group" : "Puzzles, one category";
}

/** Which ratings a pick moves besides the Joulz Rating (mockup 02's "Moves Puzzles and Arcade"). */
export function pickMoves(pick: RatedPick): string {
  if (pick === "mixed") return "Moves Puzzles and Arcade";
  if (pick === "puzzles") return "Moves Puzzles";
  if (pick === "arcade") return "Moves Arcade";
  return isArcadePick(pick) ? "Moves Arcade" : "Moves Puzzles";
}

export function isArcadePick(pick: RatedPick): boolean {
  if (pick === "arcade") return true;
  return ARCADE_GROUPS.some((g) => g.id === pick);
}

/** The order the picker lists picks in (mockup 02): Mixed, All puzzles, All arcade, then categories (W3b's order). */
const PICK_ORDER: readonly RatedPick[] = RATED_CHOICES;

/**
 * The picks the picker shows: only what is switched on, in the mockup's order, never anything else (a pick the
 * screens don't know how to name is left out rather than shown raw).
 */
export function shownPicks(options: RatedOptions): RatedPick[] {
  const on = new Set(options.picks);
  return PICK_ORDER.filter((p) => on.has(p));
}

export function shownBestOf(options: RatedOptions): BestOf[] {
  return ([3, 5, 7] as const).filter((n) => options.bestOf.includes(n));
}

export function shownSizes(options: RatedOptions): MatchSize[] {
  return ([2, 4, 8] as const).filter((n) => options.sizes.includes(n));
}

/** The pick the Play card starts on: the last one played if still on, else Mixed if on, else the first on. */
export function defaultPick(options: RatedOptions, last: RatedPick | null): RatedPick | null {
  const shown = shownPicks(options);
  if (last && shown.includes(last)) return last;
  if (shown.includes("mixed")) return "mixed";
  return shown[0] ?? null;
}

export function sizeLabel(n: MatchSize): string {
  return n === 2 ? "1v1" : `${n} players`;
}

export function bestOfLabel(n: BestOf): string {
  return `Best of ${n}`;
}

/* ------------------------------------------------------------------ VS (mockup 04) */

/** "First meeting", "You lead 3–1", "Sam leads 2–1", "Level 2–2"; null when the server has no record to show. */
export function headToHeadLine(h: { won: number; lost: number } | null, them: string): string | null {
  if (!h) return null;
  if (h.won + h.lost === 0) return "First meeting";
  if (h.won > h.lost) return `You lead ${h.won}–${h.lost}`;
  if (h.lost > h.won) return `${them} leads ${h.lost}–${h.won}`;
  return `Level ${h.won}–${h.lost}`;
}

/* ------------------------------------------------------------------ searching (mockup 03) */

/** "0:04". */
export function clockText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ placement (mockups 11 and 12) */

/** The line under the placement boxes on Home (mockup 11). */
export function placementHomeLine(played: number): string {
  const left = PLACEMENT_MATCHES - played;
  if (left <= 0) return "Your Joulz Rating and tier are on their way.";
  return `Your Joulz Rating and tier appear after match ${PLACEMENT_MATCHES}.`;
}

/** The placement result's line (mockup 12), from the results so far including this match. */
export function placementResultLine(results: readonly PlacementResult[]): string {
  const left = PLACEMENT_MATCHES - results.length;
  const won = results.filter((r) => r === "won").length;
  const start = won > results.length - won ? "Strong start. " : "";
  if (left <= 0) return "That’s all five. Here’s where you stand.";
  if (left === 1) return `${start}One more and your rating and tier are revealed.`;
  return `${start}${left} more and your rating and tier are revealed.`;
}

/** "2 won, 1 lost". */
export function wonLostText(won: number, lost: number): string {
  return `${won} won, ${lost} lost`;
}

/* ------------------------------------------------------------------ the result (mockup 07) */

/** "Chroma Lines: 12 off your best" (DESIGN.md section 10's words). */
export function nearMissText(n: { type: string; offBest: number }): { game: string; line: string } {
  return { game: puzzleName(n.type as PuzzleType), line: `${n.offBest} off your best` };
}

/** The seconds left on the rematch offer (8 s after the result), at `nowMs`. */
export function rematchSecondsLeft(until: string | null, nowMs: number): number {
  if (!until) return 0;
  const at = Date.parse(until);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, Math.ceil((at - nowMs) / 1000));
}

/** The rematch offer's length (mockup 07). */
export const REMATCH_SECONDS = 8;

/* ------------------------------------------------------------------ why a match moved no ratings (Joe, 11 Nov 2026) */

/** The result's line when W3a's answer says nothing moved, by its reason. */
export const FROZEN_LINES = {
  under_review: "This match is under review, so ratings didn’t change.",
  same_opponent_today: "Ratings don’t change from your 4th match against the same player in a day.",
} as const;
