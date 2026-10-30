/**
 * The arcade scoring standard (29 Oct 2026, docs/arcade-standard/snake.md): Meteor (`snake`), snakeRev 11.
 *
 * perfect(): a true perfect run would eat each of the 7 gold stars on the first tick it can be eaten, which the board
 * cannot be planned (each appears on its own square, wherever the meteor is), so the run's final state is built the way the sim
 * reaches it: a real snakeRev 11 world (room seed 0), a played run (`acted`) that survived the clock with the core's full
 * count of stars, every gold star eaten with its whole life left (goldLeft = 7 × its life, what eating each on its first
 * tick adds), the combo, lane-ride and warp counters at their caps. It is scored by the sim's own scoring function
 * (snakeStdGame.score) and broken into parts by snakeStdParts, the function the reveal and grading read.
 */
import { roomSeed } from "../arcade-skill-bands/games";
import {
  snakeGameFor,
  snakeStdParts,
  SNAKE_REV_STD,
  SNAKE_RUN_TICKS,
  SNAKE_STD_CAPS,
  SNAKE_STD_CORE_MAX,
  SNAKE_STD_CORE_STARS,
  SNAKE_STD_LANE_POINTS,
  SNAKE_STD_WARP_POINTS,
  type SnakeState,
} from "../../src/lib/arcade/snake";
import type { StdEntry, StdRun } from "./entry";

export const entry: StdEntry = {
  type: "snake",
  field: "snakeRev",
  rev: SNAKE_REV_STD,
  parts: [
    { key: "core", label: `Stars eaten (straight line, full at ${SNAKE_STD_CORE_STARS})`, max: SNAKE_STD_CORE_MAX },
    { key: "gold", label: "Gold stars (7 dealt, each up to 40 ÷ 7, falling to 0 as it fades)", max: SNAKE_STD_CAPS.gold },
    { key: "combo", label: "Combos (1 a star from the third in a row, each within 3 s)", max: SNAKE_STD_CAPS.combo },
    { key: "lane", label: "Lane rides (1 a ride of 10 squares in a row along a lane)", max: SNAKE_STD_CAPS.lane },
    { key: "warp", label: "Warp stars (+2 a star within 2 s of a wormhole trip)", max: SNAKE_STD_CAPS.warp },
  ],
  perfect(): StdRun[] {
    const game = snakeGameFor(SNAKE_REV_STD);
    const start = game.init(roomSeed(0)) as SnakeState;
    const life = start.goldLife!;
    const golds = start.golds!.length;
    const final: SnakeState = {
      ...start,
      acted: 1,
      tick: SNAKE_RUN_TICKS,
      endedTick: SNAKE_RUN_TICKS,
      eaten: SNAKE_STD_CORE_STARS,
      goldsEaten: golds,
      goldLeft: golds * life,
      comboPts: SNAKE_STD_CAPS.combo,
      laneRides: SNAKE_STD_CAPS.lane / SNAKE_STD_LANE_POINTS,
      warpPts: SNAKE_STD_CAPS.warp,
      warpsUsed: SNAKE_STD_CAPS.warp / SNAKE_STD_WARP_POINTS,
    };
    const score = game.score(final);
    return [{ label: "a built final state, the sim's score", score, parts: { ...snakeStdParts(final) } }];
  },
};
