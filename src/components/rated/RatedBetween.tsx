/**
 * The format slot's Between screen in the room route (wave 3, session W3c): after each game of a rated 4- or 8-player
 * match, in place of the room's own round result and standings, W3d's Between (formatScreens.tsx) with the games so
 * far and the time until the next game starts (between.ts). Renders nothing for a 1v1 (no Between: the room's own
 * screens play) or a format with no screens, so the room route then draws exactly what it drew before.
 */
import type { RatedFormat } from "@/lib/rated/matchmaking";
import { msUntilNextGame, type BetweenPhase } from "@/lib/rated/between";

import { screensFor, type FormatScreens } from "./formatScreens";

/** The Between screen a format plays between games, or null (every 1v1). */
export function betweenFor(format: RatedFormat, screens: (f: RatedFormat) => FormatScreens | null = screensFor) {
  return screens(format)?.Between ?? null;
}

export function RatedBetween({
  matchId,
  format,
  phase,
  elapsedMs,
  round,
  totalRounds,
  screens = screensFor,
}: {
  matchId: string;
  format: RatedFormat;
  phase: BetweenPhase;
  /** Time since the room's current phase started. */
  elapsedMs: number;
  /** The game just played (1-based) and the match's games. */
  round: number;
  totalRounds: number;
  /** The slot (checks stand in a placings row). */
  screens?: (f: RatedFormat) => FormatScreens | null;
}) {
  const Between = betweenFor(format, screens);
  if (!Between) return null;
  return (
    <div data-rated-between={format}>
      <Between
        matchId={matchId}
        format={format}
        game={round}
        games={totalRounds}
        msUntilNext={msUntilNextGame(phase, elapsedMs, round, totalRounds)}
      />
    </div>
  );
}
