/** The shape of a skill-band bot and the drive helpers every bot shares. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { inputAt, recordInput, recordTap, tapAt, type ArcadeGame, type ArcadeInputEvent } from "../../src/lib/arcade/engine";
import type { Human } from "./human";

export interface BotCtx {
  /** The game for the revision being measured (sim + score). */
  game: ArcadeGame<any, any>;
  /** The stored puzzle seed. */
  seed: number;
  /** Revision stamped on the puzzle. */
  rev: number | null;
  human: Human;
  /**
   * The Oct 2026 competence fixes (docs/arcade-bands-elite.md: bots that under-played, Rainbow
   * Bridge first). Off unless the band tool sets it, so the checks that run bots keep the bots
   * they were proved with.
   */
  fixes?: boolean;
}

/** A bot returns the input log the phone would submit: events, or taps for tap-only games. */
export interface BotResult {
  events?: ArcadeInputEvent[];
  taps?: number[];
}

export type SkillBot = (ctx: BotCtx) => BotResult;

/**
 * Steps a game to its end with a per-tick event picker (the event's `t` is
 * filled in), recording the log the way the phone does. The picker sees the
 * state before the tick is applied.
 */
export function driveEvents<S extends { tick: number }>(
  game: ArcadeGame<S, ArcadeInputEvent | null>,
  pick: (state: S, t: number) => Omit<ArcadeInputEvent, "t"> | null,
  init?: S,
): { events: ArcadeInputEvent[]; state: S } {
  let state = init ?? game.init(0);
  const events: ArcadeInputEvent[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    const ev = pick(state, t);
    if (ev) recordInput(events, { ...ev, t }, game.inputRanges ?? []);
    state = game.step(state, inputAt(events, t));
  }
  return { events, state };
}

/** Same for tap games: `pick` returns true to tap on this tick. */
export function driveTaps<S extends { tick: number }>(
  game: ArcadeGame<S, boolean>,
  pick: (state: S, t: number) => boolean,
  init?: S,
): { taps: number[]; state: S } {
  let state = init ?? game.init(0);
  const taps: number[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    if (pick(state, t)) recordTap(taps, t);
    state = game.step(state, tapAt(taps, t));
  }
  return { taps, state };
}

/** Steps a forked state n ticks with no input (lookahead for perception, not for play). */
export function idle<S>(game: ArcadeGame<S, any>, state: S, n: number, none: unknown = null): S {
  let s = state;
  for (let i = 0; i < n && !game.isOver(s); i++) s = game.step(s, none);
  return s;
}

/**
 * A queue of planned events keyed by tick. Bots schedule what the human will do
 * (after reaction and timing error) and the drive loop plays them in order; two
 * on one tick slide to the next free tick, as a phone's one-event-per-tick log does.
 */
export class Plan {
  private q = new Map<number, Omit<ArcadeInputEvent, "t">>();
  at(t: number, ev: Omit<ArcadeInputEvent, "t">): number {
    let at = Math.max(1, Math.round(t));
    while (this.q.has(at)) at++;
    this.q.set(at, ev);
    return at;
  }
  take(t: number): Omit<ArcadeInputEvent, "t"> | null {
    const ev = this.q.get(t) ?? null;
    if (ev) this.q.delete(t);
    return ev;
  }
  clear(): void {
    this.q.clear();
  }
  get size(): number {
    return this.q.size;
  }
  /** Drops everything planned after tick t. */
  dropAfter(t: number): void {
    for (const k of [...this.q.keys()]) if (k > t) this.q.delete(k);
  }
}
