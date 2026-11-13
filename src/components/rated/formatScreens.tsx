/**
 * Which screens a rated format plays through (wave 3, session W3c), so the /rated route stays format-blind. W3b's
 * formats are bo3 / bo5 / bo7 (a 1v1, "duel") and ffa4 / ffa8 (4 and 8 players, "placings", W3d #376,
 * docs/rated/multiplayer.md).
 *
 * The route asks `screensFor(format)`: the search screen in place of Searching, an optional screen between games, and
 * the result screen in place of MatchResult. A 1v1 uses W3c's own (VS and the room route sit between). The placings
 * row is W3d's `MultiFilling`, `MultiStandings` and `MultiFinal`, fitted to these props in multi/MultiFormat.tsx; the
 * picker never offers it while W3b's switches are off (off at launch).
 */
import type { ComponentType } from "react";

import type { RatedPick, RatedResult, SearchProgress } from "@/lib/rated/backend";
import type { RatedPlayer } from "@/lib/rated/backend";
import type { RatedFormat } from "@/lib/rated/matchmaking";

import { MultiBetween, MultiResult, MultiSearch } from "./multi/MultiFormat";
import { MatchResult, Searching } from "./RatedMatchScreens";

export type FormatKind = "duel" | "placings";

export function formatKind(format: RatedFormat): FormatKind {
  return format === "ffa4" || format === "ffa8" ? "placings" : "duel";
}

/** What every search screen is given. */
export interface SearchScreenProps {
  me: RatedPlayer;
  /** W3b's format being searched for (ffa4 / ffa8 for a 4- or 8-player match): read this, never the pick text. */
  format: RatedFormat;
  /** The pick (Mixed, All puzzles…), or null. */
  pick: RatedPick | null;
  /** For display only: "Mixed, 8 players". */
  pickText: string;
  progress: SearchProgress | null;
  onCancel: () => void;
}

/** What every result screen is given (MatchResult's props). */
export interface ResultScreenProps {
  result: RatedResult;
  nowMs: number;
  onNext: () => void;
  onRematch: () => void;
  onTiers: () => void;
  onChallenge: () => Promise<{ ok: true; code: string } | { ok: false; message: string }>;
  onReveal: () => void;
}

/** What the Between screen is given: the room route draws it after each game of a 4- or 8-player match. */
export interface BetweenScreenProps {
  matchId: string;
  format: RatedFormat;
  /** Games played so far (1-based) and the match's games. */
  game: number;
  games: number;
  /**
   * Time until the next game starts (its title card), from the room's own phase clock (msUntilNextGame, between.ts);
   * null after the last game. It can end sooner when every player taps Continue.
   */
  msUntilNext: number | null;
}

export interface FormatScreens {
  Search: ComponentType<SearchScreenProps>;
  Result: ComponentType<ResultScreenProps>;
  /** Between games (W3d's standings); a 1v1 has none (the room's own round result plays between). */
  Between?: ComponentType<BetweenScreenProps>;
  /** Show VS before the games (a 1v1's two cards); W3d's filling screen leads straight in. */
  vs: boolean;
}

const FORMAT_SCREENS: Record<FormatKind, FormatScreens | null> = {
  duel: { Search: Searching, Result: MatchResult, vs: true },
  // W3d (#376): MultiFilling, MultiStandings and MultiFinal, fitted to these props (multi/MultiFormat.tsx).
  placings: { Search: MultiSearch, Between: MultiBetween, Result: MultiResult, vs: false },
};

export function screensFor(format: RatedFormat): FormatScreens | null {
  return FORMAT_SCREENS[formatKind(format)];
}
