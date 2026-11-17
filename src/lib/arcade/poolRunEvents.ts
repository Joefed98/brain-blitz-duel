/**
 * Cue Ball's run events for the reveal's run summary (the Sports overhaul, phase 2 step 4; display only): this player's
 * own stored input log replayed tick by tick through the same sim and the same event rules as the server's replay
 * (sportsKit.replaySportsRun), noting each moment as it happens: every ball potted (which ball, which pocket, in
 * order, and whether it counted), every foul and where the cue ball lay, every scratch, the best run of pots, the
 * black's fate and the time it went down. Nothing here is sent, stored or scored: the server's replay scored the run.
 */
import { checkInputEvents, type ArcadeInputEvent } from "./engine";
import { decodeSportsRun } from "./sportsKit";
import { poolBlackOpen, poolGameFor, poolIsStripe, POOL_BLACK, POOL_CUE, POOL_POCKETS, POOL_SPOTS, type PoolBall, type PoolState } from "./pool";

export interface PoolPotEvent {
  /** The sim's ball id (1–7 the player's set, 9–15 the other set, 8 the black). */
  id: number;
  /** POOL_POCKETS index it dropped into (the nearest pocket to where it went down). */
  pocket: number;
  tick: number;
  /** One of the player's seven (or the black after them), not a foul's ball. */
  mine: boolean;
}

export type PoolFoulKind = "wrong-first" | "no-ball" | "their-ball-potted";

export interface PoolFoulEvent {
  /** Where the cue ball lay when the foul was called (world px). */
  x: number;
  y: number;
  tick: number;
  kind: PoolFoulKind;
}

export interface PoolRunEvents {
  pots: PoolPotEvent[];
  fouls: PoolFoulEvent[];
  /** Scratches (the cue ball potted): the pocket each went into. */
  scratches: { pocket: number; tick: number }[];
  /** The player's seven down at the end. */
  spots: number;
  /** "down" legally, "early" (potted before the seven), or "up" (still on the table). */
  black: "down" | "early" | "up";
  /** Seconds on the clock (lost time included) when the black went down legally; null otherwise. */
  clearedAt: number | null;
  streakBest: number;
  shots: number;
  /** The final state (for the table's remaining balls). */
  state: PoolState;
}

const px = (u: number) => u / 256;

/** The pocket a downed ball went into: the nearest to where it went down (as the renderer's drop does). */
export function poolPocketIndex(b: Pick<PoolBall, "x" | "y">): number {
  let best = 0;
  let bestD = Infinity;
  POOL_POCKETS.forEach((p, i) => {
    const d = (p.x - b.x) * (p.x - b.x) + (p.y - b.y) * (p.y - b.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Replays `raw` on `seed` at its stamp and collects the run's events (the same steps as the server's replay). */
export function poolRunEvents(seed: number, raw: string, rev?: number | null, level?: unknown): PoolRunEvents {
  const game = poolGameFor(rev, undefined, level);
  const run = decodeSportsRun(raw, game.runTicks);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, game.runTicks) : 0;
  const check = checkInputEvents(run.events, game.runTicks, game.inputRanges ?? []);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const lastTick = endTick > 0 && endTick < game.runTicks ? endTick : game.runTicks;
  const pots: PoolPotEvent[] = [];
  const fouls: PoolFoulEvent[] = [];
  const scratches: { pocket: number; tick: number }[] = [];
  let state = game.init(seed);
  for (let tick = 1; tick <= lastTick; tick++) {
    const prev = state;
    state = game.step(state, events.get(tick) ?? null);
    // Balls that went down this tick.
    for (const b of state.balls) {
      const was = prev.balls.find((p) => p.id === b.id);
      if (!b.down || !was || was.down) continue;
      if (b.id === POOL_CUE) continue;
      const mine = !poolIsStripe(b.id) && (b.id !== POOL_BLACK || poolBlackOpen(prev));
      pots.push({ id: b.id, pocket: poolPocketIndex(b), tick: state.tick, mine });
    }
    const cue = prev.balls.find((b) => b.id === POOL_CUE)!;
    // A scratch (the cue ball potted) is counted when the shot settles; the cue ball lies where it went down.
    if (state.scratches > prev.scratches) scratches.push({ pocket: poolPocketIndex(cue), tick: state.tick });
    // A foul is called when the shot settles: the cue ball's resting place is the spot it was called at.
    if (state.fouls > prev.fouls) {
      const kind: PoolFoulKind = state.shotStripes > 0 ? "their-ball-potted" : state.firstHit < 0 ? "no-ball" : "wrong-first";
      const at = cue.down ? POOL_POCKETS[poolPocketIndex(cue)]! : cue;
      fouls.push({ x: px(at.x), y: px(at.y), tick: state.tick, kind });
    }
    if (game.isOver(state)) break;
  }
  return {
    pots,
    fouls,
    scratches,
    spots: state.spotsDown,
    black: state.black === 1 ? "down" : state.black === 2 ? "early" : "up",
    clearedAt: state.black === 1 && state.finishAt > 0 ? Math.round((state.finishAt / 60) * 10) / 10 : null,
    streakBest: state.streakBest,
    shots: state.shots,
    state,
  };
}
