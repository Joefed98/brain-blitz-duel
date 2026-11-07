/**
 * The standings' broadcast reveal (7 Nov 2026; presentation only). The rows start in the order after the
 * round before, then land from last place up to 2nd, one at a time, each counting up to its total and
 * sliding to its place; after a short hold 1st place lands with a gold light sweep across its row. A
 * shared first place lands together in that last step. Pure timing and ordering: Standings
 * (useStandingsReveal) plays it, standings-reveal-check proves it.
 *
 * The whole reveal ends within STANDINGS_REVEAL_END_MS of the screen opening for any room size (the
 * stagger shrinks as rooms grow), well inside the standings screen's display time; Continue and its
 * countdown are untouched.
 */
import type { Standing } from "@/lib/duel/scoring";

/** The first row lands this long after the screen opens (ms). */
export const REVEAL_START_MS = 120;
/** A row's count-up and slide to its place (ms). */
export const REVEAL_ROW_MS = 320;
/** The pause after 2nd place has landed, before 1st (ms). */
export const REVEAL_HOLD_MS = 220;
/** 1st place's count-up (ms). */
export const REVEAL_FIRST_COUNT_MS = 350;
/** The gold light sweep across 1st place's row (ms); it starts as 1st lands. */
export const REVEAL_SWEEP_MS = 600;
/** The gap between rows landing: at most this, shrinking for big rooms (ms). */
export const REVEAL_STAGGER_MAX_MS = 200;
export const REVEAL_STAGGER_MIN_MS = 40;
/** Everything, sweep included, has ended by this long after the screen opens, for any room size (ms). */
export const STANDINGS_REVEAL_END_MS = 2300;

export interface StandingsRevealPlan {
  /** The slots landing at each step, in order: one row a step from last place up, then every 1st place together. */
  steps: number[][];
  /** When each step lands (ms from the screen opening). */
  stepAt: number[];
  /** The gap between the rows before 1st. */
  staggerMs: number;
  /** When the reveal has fully ended (sweep included). */
  endMs: number;
}

/** `rows` in the server's final order (position, then the room's tie-break). */
export function standingsRevealPlan(rows: readonly Pick<Standing, "slot" | "position">[]): StandingsRevealPlan {
  if (!rows.length) return { steps: [], stepAt: [], staggerMs: 0, endMs: 0 };
  const firsts = rows.filter((row) => row.position === 1).map((row) => row.slot);
  const rest = rows.filter((row) => row.position !== 1).map((row) => row.slot).reverse();
  const k = rest.length;
  const budget = STANDINGS_REVEAL_END_MS - REVEAL_START_MS - REVEAL_ROW_MS - REVEAL_HOLD_MS - Math.max(REVEAL_SWEEP_MS, REVEAL_FIRST_COUNT_MS);
  const staggerMs =
    k > 1 ? Math.max(REVEAL_STAGGER_MIN_MS, Math.min(REVEAL_STAGGER_MAX_MS, Math.floor(budget / (k - 1)))) : 0;
  const stepAt = rest.map((_, i) => REVEAL_START_MS + i * staggerMs);
  const firstAt = k ? stepAt[k - 1]! + REVEAL_ROW_MS + REVEAL_HOLD_MS : REVEAL_START_MS;
  const steps = rest.map((slot) => [slot]);
  if (firsts.length) {
    steps.push(firsts);
    stepAt.push(firstAt);
  }
  const endMs = firsts.length ? firstAt + Math.max(REVEAL_SWEEP_MS, REVEAL_FIRST_COUNT_MS) : (stepAt[k - 1] ?? 0) + REVEAL_ROW_MS;
  return { steps, stepAt, staggerMs, endMs };
}

/**
 * The rows as drawn once `landed` steps have landed: the landed rows hold their final places at the bottom
 * of the list, the rest fill the places above in the order after the round before. Every step is a
 * permutation of `rows`; after the last step it is `rows` exactly.
 */
export function standingsRevealOrder<T extends Pick<Standing, "slot" | "position" | "previousPosition">>(
  rows: readonly T[],
  plan: StandingsRevealPlan,
  landed: number,
): T[] {
  const done = new Set(plan.steps.slice(0, landed).flat());
  if (done.size >= rows.length) return [...rows];
  const waiting = rows
    .filter((row) => !done.has(row.slot))
    .sort((a, b) => (a.previousPosition ?? a.position) - (b.previousPosition ?? b.position) || a.slot - b.slot);
  const settled = rows.filter((row) => done.has(row.slot));
  return [...waiting, ...settled];
}
