/**
 * Deterministic picks for the results-screen highlight and the podium's play
 * of the game (display only). The round winner is whoever the standings put
 * first for that round alone, so ties break exactly as the standings break
 * them (scoring.ts `standings`: quicker answer time, then slot).
 */
import { standings } from "@/lib/duel/scoring";
import type { DuelPlayerRow, RoundResultRow } from "@/lib/duel/types";
import { MOMENT_TABLE, type Moment } from "./moments";

/** The round's winner (slot), or null when nobody scored. */
export function roundWinnerSlot(
  players: DuelPlayerRow[],
  results: RoundResultRow[],
  round: number,
): number | null {
  const rows = results.filter((r) => r.round_number === round);
  if (rows.length === 0) return null;
  const answered = new Set(rows.map((r) => r.player_slot));
  // The players who answered, so a quiet player can't shift positions.
  const table = standings(
    players.filter((p) => answered.has(p.player_slot)),
    rows,
    round,
  );
  const top = table[0];
  return top && top.roundScore > 0 ? top.slot : null;
}

/** The best score in the round apart from the winner's (0 when alone). */
export function runnerUpScore(
  results: RoundResultRow[],
  round: number,
  winnerSlot: number,
): number {
  return results
    .filter((r) => r.round_number === round && r.player_slot !== winnerSlot)
    .reduce((best, r) => Math.max(best, r.score), 0);
}

export interface HighlightClip {
  moment: Moment;
  /** Sim ticks the clip covers. */
  start: number;
  end: number;
  /** Half speed between these ticks. */
  slowFrom: number;
  slowTo: number;
  /** Wall-clock length at normal speed outside the slow part. */
  seconds: number;
}

/** Slow-motion speed around the key tick. */
export const SLOW_SPEED = 0.5;

/**
 * The results screen moves on 8 s after it opens (the room's auto-advance), so the
 * whole highlight fits in about 7.5 s: two moments of about 3.7 s each, or one
 * of about 7.3 s, never longer than the time the screen has left.
 */
export const HIGHLIGHT_BUDGET_S = 7.5;
/** Below this much time left a highlight isn't started at all (the slim bar shows instead). */
export const HIGHLIGHT_MIN_S = 1.5;

function clipAround(
  moment: Moment,
  endTick: number,
  lead: number,
  tail: number,
  slowHalf: number,
): HighlightClip {
  const start = Math.max(0, moment.tick - lead);
  const end = Math.min(endTick, moment.tick + tail);
  const slowFrom = Math.max(start, moment.tick - slowHalf);
  const slowTo = Math.min(end, moment.tick + slowHalf);
  const slow = slowTo - slowFrom;
  const seconds = (end - start - slow) / 60 + slow / (60 * SLOW_SPEED);
  return { moment, start, end, slowFrom, slowTo, seconds };
}

const total = (clips: readonly HighlightClip[]) => clips.reduce((s, c) => s + c.seconds, 0);

/**
 * Clips around the picked moments (at most two), half speed either side of
 * each key tick, fitted inside `budgetS` seconds: a second moment that doesn't
 * fit is dropped (the heavier one stays), then the lead-in is shortened.
 */
export function planHighlight(
  picked: readonly Moment[],
  endTick: number,
  budgetS = HIGHLIGHT_BUDGET_S,
): HighlightClip[] {
  const budget = Math.min(HIGHLIGHT_BUDGET_S, budgetS);
  if (budget < HIGHLIGHT_MIN_S || picked.length === 0) return [];
  const two = picked.slice(0, 2);
  if (two.length === 2) {
    const clips = two.map((m) => clipAround(m, endTick, 135, 45, 21));
    if (total(clips) <= budget + 1e-9) return clips;
  }
  // One moment: the heavier (then the earlier) of the picks, with a longer lead-in when there is time.
  const one = [...two].sort((a, b) => b.weight - a.weight || a.tick - b.tick)[0]!;
  const tail = budget >= 3 ? 75 : 20;
  const slowHalf = budget >= 3 ? 30 : 10;
  // seconds = (lead + tail − 2·slowHalf) / 60 + 2·slowHalf / 30
  const lead = Math.max(
    10,
    Math.min(300, Math.floor((budget - (2 * slowHalf) / 30) * 60 - tail + 2 * slowHalf)),
  );
  const clip = clipAround(one, endTick, lead, tail, slowHalf);
  return clip.seconds <= budget + 1e-9 ? [clip] : [];
}

/** The podium's play of the game: one longer clip (about 10–15 s), slowed for 1.5 s around the key tick. */
export function planPlayOfTheGame(moment: Moment, endTick: number): HighlightClip {
  const start = Math.max(0, moment.tick - 420);
  const end = Math.min(endTick, moment.tick + 120);
  const slowFrom = Math.max(start, moment.tick - 45);
  const slowTo = Math.min(end, moment.tick + 45);
  const slow = slowTo - slowFrom;
  return {
    moment,
    start,
    end,
    slowFrom,
    slowTo,
    seconds: (end - start - slow) / 60 + slow / (60 * SLOW_SPEED),
  };
}

/** No moment fired: the run's last few seconds stand in, captioned with the score. */
export function finalMomentsClip(
  endTick: number,
  game: string,
  caption: string,
  budgetS = HIGHLIGHT_BUDGET_S,
): HighlightClip | null {
  if (budgetS < HIGHLIGHT_MIN_S) return null;
  const length = Math.round(Math.min(4, budgetS) * 60);
  const moment: Moment = {
    game,
    id: "final",
    tick: endTick,
    weight: 0,
    category: "finish",
    caption,
    at: null,
  };
  const start = Math.max(0, endTick - length);
  return {
    moment,
    start,
    end: endTick,
    slowFrom: endTick,
    slowTo: endTick,
    seconds: (endTick - start) / 60,
  };
}

/** One candidate for the play of the game. */
export interface PlayCandidate {
  round: number;
  slot: number;
  kind: "arcade" | "timelapse" | "card";
  weight: number;
  /** The player's lead over the round's second-best score. */
  margin: number;
  caption: string;
  moment?: Moment;
}

export function playValue(c: PlayCandidate): number {
  return c.weight + Math.max(0, c.margin);
}

/** The single best moment of the game: weight plus margin, then the earlier round, then the earlier tick. */
export function pickPlayOfTheGame(candidates: readonly PlayCandidate[]): PlayCandidate | null {
  const sorted = [...candidates].sort(
    (a, b) =>
      playValue(b) - playValue(a) ||
      a.round - b.round ||
      (a.moment?.tick ?? 0) - (b.moment?.tick ?? 0) ||
      a.slot - b.slot,
  );
  return sorted[0] ?? null;
}

export function momentWeight(game: string, id: string): number {
  return MOMENT_TABLE.find((r) => r.game === game && r.id === id)?.weight ?? 0;
}
