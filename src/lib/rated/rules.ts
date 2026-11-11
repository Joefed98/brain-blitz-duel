/**
 * The rated screens' display rules (wave 3, session W3c): which picker options show, when the opponent's score hides,
 * how a recorded run's age reads, and the words. Pure: no React, no server, so rated-screens-check proves each one.
 *
 * Nothing here decides a result, a rating or a match: the server does (backend.ts).
 */
import { ARCADE_GROUPS } from "@/lib/duel/arcadeGroups";
import { puzzleName } from "@/lib/duel/catalogue";
import type { PuzzleType } from "@/lib/duel/types";

import type { BestOf, MatchSize, PlacementResult, RatedOptions, RatedPick } from "./backend";
import { PLACEMENT_MATCHES } from "./tiers";

/* ------------------------------------------------------------------ the hidden finish (mockup 06) */

/** The final share of each game's time in which the opponent's score is hidden: 20 %. */
export const HIDDEN_FINISH_SHARE = 0.2;

/**
 * Whether the opponent's score is hidden: from the moment 20 % of the game's time is left (exactly 20 % hides it),
 * until the game's result reveals it. Integer arithmetic, so the boundary is exact: hidden when left × 5 ≤ limit.
 * A game with no clock (limit ≤ 0) never hides.
 */
export function opponentScoreHidden(leftMs: number, limitMs: number): boolean {
  if (!(limitMs > 0)) return false;
  const left = Math.max(0, Math.round(leftMs));
  return left * 5 <= Math.round(limitMs);
}

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
  const id = pick.slice(4);
  return PUZZLE_CATEGORY_LABELS[id] ?? ARCADE_GROUPS.find((g) => g.id === id)?.label ?? id;
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
  if (!pick.startsWith("cat:")) return false;
  return ARCADE_GROUPS.some((g) => g.id === pick.slice(4));
}

/** The order the picker lists picks in (mockup 02): Mixed, All puzzles, All arcade, then categories. */
const PICK_ORDER: readonly RatedPick[] = [
  "mixed",
  "puzzles",
  "arcade",
  ...(Object.keys(PUZZLE_CATEGORY_LABELS).map((c) => `cat:${c}` as const)),
  ...ARCADE_GROUPS.map((g) => `cat:${g.id}` as const),
];

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

/** "Recorded run, 2 h ago" from the run's real time (DESIGN.md: commas, no " · "). */
export function recordedAgo(recordedAt: string, nowMs: number): string {
  const at = Date.parse(recordedAt);
  if (!Number.isFinite(at)) return "Recorded run";
  const s = Math.max(0, Math.floor((nowMs - at) / 1000));
  if (s < 60) return "Recorded run, just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `Recorded run, ${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Recorded run, ${h} h ago`;
  const d = Math.floor(h / 24);
  return `Recorded run, ${d} ${d === 1 ? "day" : "days"} ago`;
}

/** "First meeting", "You lead 3–1", "Sam leads 2–1", "Level 2–2". */
export function headToHeadLine(h: { won: number; lost: number }, them: string): string {
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
export function nearMissText(n: { type: PuzzleType; offBest: number }): { game: string; line: string } {
  return { game: puzzleName(n.type), line: `${n.offBest} off your best` };
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
