/**
 * Development only (review screenshots, scripts/shots/e8-shots.ts): a practice run that starts part-way
 * through a recorded run. When `window.__duelzArcadeWarp` names this game, `init` plays the recorded inputs
 * up to `tick` on the recorded seed, so the stage opens mid-play with the features the screenshot needs.
 * Production builds return the game unchanged (import.meta.env.DEV is false), and nothing is recorded or sent
 * differently: the warped run is a practice run like any other.
 */
import type { ArcadeGame, ArcadeInputEvent } from "./engine";

interface Warp {
  game: string;
  seed: number;
  tick: number;
  events: readonly ArcadeInputEvent[];
}

export function devWarp<S>(key: string, game: ArcadeGame<S, ArcadeInputEvent | null>): ArcadeGame<S, ArcadeInputEvent | null> {
  if (!import.meta.env.DEV || typeof window === "undefined") return game;
  const warp = (window as unknown as { __duelzArcadeWarp?: Warp }).__duelzArcadeWarp;
  if (!warp || warp.game !== key) return game;
  return {
    ...game,
    init: () => {
      const events = new Map(warp.events.map((e) => [e.t, e]));
      let state = game.init(warp.seed);
      for (let t = 1; t <= warp.tick && !game.isOver(state); t++) state = game.step(state, events.get(t) ?? null);
      return state;
    },
  };
}
