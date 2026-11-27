/**
 * Meteor's comet planner held to the human limits (D5's ladder, 23 Nov 2026; docs/arcade-standard/snake.md "Levels (D5,
 * 23 Nov 2026)"): the proof that a dealt snakeRev 16 seed's 200 is in reach of the best humans.
 *
 * The planner is the skill-band bot's flawless player (scripts/arcade-skill-bands/bots/snake.ts: it routes to each star
 * and each gold star it can reach in time, rides the speed lanes on purpose, takes the wormholes and steers round rocks
 * and their shadows), made a person exactly at Joe's limits:
 *
 *  - it sees nothing early: a new star, a gold star, a rock's shadow or its own head off the route is acted on one
 *    reaction later, never sooner than 0.25 s (15 ticks; HUMAN_LIMITS on the flawless profile: 250 ms, no spread), and
 *    a new star's route is only planned after that and a short think;
 *  - two swipes are always at least 0.15 s apart (9 ticks, `snakeBotOptions.minGap`), so at speed a U-turn needs three
 *    squares between its turns, as a thumb would;
 *  - it reads the level's own pace (the bots' `fixes`).
 *
 * It never reads the star queue ahead, the rock schedule or anything else not on the screen. A try is one draw of its
 * think times (`variant` keys the Human's stream: 0 is the flawless player's own); the proof is the first try whose
 * log scores exactly 200 through the server's replay (`gradeAnswer` on the dealt puzzle), unflagged.
 *
 *   bun scripts/snake-oracle.ts [--level=hard] [--deals=24] [--tries=8]     (a report: how many deals it proves)
 */
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, HUMAN_LIMITS } from "./arcade-skill-bands/human";
import { bot, snakeBotOptions } from "./arcade-skill-bands/bots/snake";
import { playEvents } from "./ladder-legacy-lib";

/** The human limits' move time as a swipe gap (0.15 s). */
export const SNAKE_ORACLE_GAP = Math.round(HUMAN_LIMITS.moveMs / (1000 / 60));

/** The planner's log on a dealt snake puzzle (one try). */
export function snakeOracleLog(puzzle: PuzzleData, variant = 0): ArcadeInputEvent[] {
  const spec = GAME_BY_TYPE.get("snake")!;
  const p = puzzle as unknown as { seed: number; snakeRev?: number };
  const game = spec.gameForPuzzle!(puzzle);
  const was = snakeBotOptions.minGap;
  snakeBotOptions.minGap = SNAKE_ORACLE_GAP;
  try {
    const human = new Human(variant ? `snake~${variant}` : "snake", p.seed, "perfect", HUMAN_LIMITS);
    return (bot({ game, seed: p.seed, rev: p.snakeRev ?? null, human, fixes: true }).events ?? []) as ArcadeInputEvent[];
  } finally {
    snakeBotOptions.minGap = was;
  }
}

/** A log through the server's replay on the dealt puzzle: its stored score and whether it was flagged. */
export function proveSnake(puzzle: PuzzleData, events: readonly ArcadeInputEvent[]): { score: number; flagged: boolean } {
  const { raw } = playEvents("snake", puzzle, events);
  const g = gradeAnswer(puzzle, raw, 0);
  return { score: g.score, flagged: Boolean((g.extra as { flagged?: unknown } | undefined)?.flagged) };
}

/** The limits a log keeps (for the check): the closest two swipes, in ticks. */
export function closestSwipes(events: readonly ArcadeInputEvent[]): number {
  let best = Infinity;
  for (let i = 1; i < events.length; i++) best = Math.min(best, events[i]!.t - events[i - 1]!.t);
  return best;
}

/** The first try (up to `tries`) that scores 200, or null. */
export function snakeProof(puzzle: PuzzleData, tries = 8): { variant: number; events: ArcadeInputEvent[] } | null {
  for (let v = 0; v < tries; v++) {
    const events = snakeOracleLog(puzzle, v);
    const r = proveSnake(puzzle, events);
    if (r.score === 200 && !r.flagged) return { variant: v, events };
  }
  return null;
}

if (import.meta.main) {
  const { dealAt } = await import("./level-tune");
  const args = process.argv.slice(2);
  const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const levels = (opt("level") ?? "easy,normal,hard,expert").split(",") as ("easy" | "normal" | "hard" | "expert")[];
  const deals = Number(opt("deals") ?? 24);
  const tries = Number(opt("tries") ?? 8);
  for (const level of levels) {
    let proved = 0;
    const firsts: number[] = [];
    for (let n = 0; n < deals; n++) {
      const puzzle = dealAt("snake", level, n);
      const first = proveSnake(puzzle, snakeOracleLog(puzzle, 0)).score;
      firsts.push(first);
      if (first === 200 || snakeProof(puzzle, tries)) proved++;
    }
    console.log(`${level}: ${proved} of ${deals} deals proved at 200 (first tries: ${firsts.join(" ")})`);
  }
}
