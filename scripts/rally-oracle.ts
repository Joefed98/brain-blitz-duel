/**
 * Rally's return-and-spin planner held to the human limits (D5's ladder, 23 Nov 2026; docs/arcade-standard/rally.md
 * "Levels (D5, 23 Nov 2026)"): the proof that a dealt rallyRev 14 seed's 200 is in reach of the best humans.
 *
 * The planner is the skill-band bot's flawless player (scripts/arcade-skill-bands/bots/rally.ts, with the Oct 2026
 * fixes and rallyRev 14's spin shots), a person exactly at Joe's limits:
 *
 *  - it sees the court 0.15 s late (its tracking lag: HUMAN_LIMITS' move time on the flawless profile) and turns to a
 *    new ball one reaction later, never sooner than 0.25 s;
 *  - it reads each ball's landing from what it has seen, takes gold balls back towards a pink pad, works out where on
 *    the paddle a return crosses a gold target, and plans a spin shot from the lagged view and its own finger's moves
 *    since: each sweep and contact point played forward through the sim, kept only when the curling ball strikes a pad
 *    or a target for the bounces' nudges as dealt and as two other draws (a shot aimed at a curve, not at one bounce);
 *  - its finger moves at a person's top speed.
 *
 * A try is one draw of its reactions and lags (`variant` keys the Human's stream: 0 is the flawless player's own); the
 * proof is the first try whose log scores exactly 200 through the server's replay (`gradeAnswer` on the dealt puzzle),
 * unflagged.
 *
 *   bun scripts/rally-oracle.ts [--level=hard] [--deals=24] [--tries=6]     (a report: how many deals it proves)
 */
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import type { PuzzleData } from "../src/lib/duel/types";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, HUMAN_LIMITS } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/rally";
import { proveLog } from "./ladder-deal-lib";

/** The planner's log on a dealt rally puzzle (one try). */
export function rallyOracleLog(puzzle: PuzzleData, variant = 0): ArcadeInputEvent[] {
  const spec = GAME_BY_TYPE.get("rally")!;
  const p = puzzle as unknown as { seed: number; rallyRev?: number };
  const game = spec.gameForPuzzle!(puzzle);
  const human = new Human(variant ? `rally~${variant}` : "rally", p.seed, "perfect", HUMAN_LIMITS);
  return (bot({ game, seed: p.seed, rev: p.rallyRev ?? null, human, fixes: true }).events ?? []) as ArcadeInputEvent[];
}

/** The first try (up to `tries`) that scores 200 through the server's replay, or null. */
export function rallyProof(puzzle: PuzzleData, tries = 6): { variant: number; events: ArcadeInputEvent[] } | null {
  for (let v = 0; v < tries; v++) {
    const events = rallyOracleLog(puzzle, v);
    const r = proveLog("rally", puzzle, events);
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
  const tries = Number(opt("tries") ?? 6);
  for (const level of levels) {
    let proved = 0;
    const firsts: number[] = [];
    for (let n = 0; n < deals; n++) {
      const puzzle = dealAt("rally", level, n);
      const first = proveLog("rally", puzzle, rallyOracleLog(puzzle, 0)).score;
      firsts.push(first);
      if (first === 200 || rallyProof(puzzle, tries)) proved++;
    }
    console.log(`${level}: ${proved} of ${deals} deals proved at 200 (first tries: ${firsts.join(" ")})`);
  }
}
