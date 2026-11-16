/**
 * Screenshot drivers for Home Run (homerunRev 5, the innings) and Top Bins (freekickRev 5, the layered kick): no
 * mid-play inputs (the untouched frame shows the scene); the "full" reveal swaps in a great-level bot's run on the
 * puzzle's own seed, stamp and level, so the reveal's picture shows a real run (hits on the field, kicks on the goal).
 */
import type { Driver } from "../driver";
import { homerunCheckpoint, homerunGameFor, HOMERUN_CHECKPOINT_INTERVAL } from "../../../src/lib/arcade/homerun";
import { freekickCheckpoint, freekickGameFor, FREEKICK_CHECKPOINT_INTERVAL } from "../../../src/lib/arcade/freekick";
import { encodeHomerunRun } from "../../../src/lib/duel/homerun";
import { encodeFreekickRun } from "../../../src/lib/duel/freekick";
import { Human } from "../../arcade-skill-bands/human";
import { botV5 as homerunBot } from "../../arcade-skill-bands/bots/homerun";
import { botV5 as freekickBot } from "../../arcade-skill-bands/bots/freekick";
import type { ArcadeGame, ArcadeInputEvent } from "../../../src/lib/arcade/engine";

/* eslint-disable @typescript-eslint/no-explicit-any */
function encoded(game: ArcadeGame<any, any>, seed: number, events: ArcadeInputEvent[], checkpoint: (s: any) => any, interval: number, encode: (r: any) => string): string {
  const at = new Map(events.map((e) => [e.t, e]));
  const checkpoints = [];
  let s = game.init(seed);
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % interval === 0) checkpoints.push(checkpoint(s));
  }
  return encode({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
}

export const homerunDriver: Driver = {
  board: "[data-game-arena='canvas'] canvas",
  answer: (puzzle) => {
    const seed = puzzle.seed as number;
    const game = homerunGameFor(puzzle.homerunRev, puzzle.level);
    const { events } = homerunBot({ game, seed, rev: puzzle.homerunRev, human: new Human("homerun", seed, "great") });
    return encoded(game, seed, events, homerunCheckpoint, HOMERUN_CHECKPOINT_INTERVAL, encodeHomerunRun);
  },
};

export const freekickDriver: Driver = {
  board: "[data-game-arena='canvas'] canvas",
  answer: (puzzle) => {
    const seed = puzzle.seed as number;
    const game = freekickGameFor(puzzle.freekickRev, puzzle.level);
    const { events } = freekickBot({ game, seed, rev: puzzle.freekickRev, human: new Human("freekick", seed, "great") });
    return encoded(game, seed, events, freekickCheckpoint, FREEKICK_CHECKPOINT_INTERVAL, encodeFreekickRun);
  },
};
