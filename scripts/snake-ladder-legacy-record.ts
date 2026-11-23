/**
 * Records snake-ladder-check's legacy fixture (scripts/fixtures/snake-ladder-legacy.json.gz): Meteor runs on
 * snakeRev 15, the stamp rooms dealt before D5's ladder (snakeRev 16), at every level (Easy, Normal, Hard, Expert as
 * dealt then), plus Normal runs on snakeRev 14, 13 and 12, each graded by the server's own code, so the check proves
 * snakeRev 16 left them exactly as they were (score, verdict, stored extra and final checkpoint).
 *
 * Players: the skill-band bot at weak, average, elite and the flawless level under Joe's human limits
 * (scripts/d5-ladder-lib.ts `playDealt`), and a seeded random swiper. Recorded once on polish/d5 428cd79a, before any
 * snakeRev 16 code; never re-record over it.
 *
 *   bun scripts/snake-ladder-legacy-record.ts
 */
import { SNAKE_INPUT_TURN } from "../src/lib/arcade/snake";
import { recordLegacy, seededEvents } from "./ladder-legacy-lib";

export const SNAKE_LADDER_LEGACY = "scripts/fixtures/snake-ladder-legacy.json.gz";

if (import.meta.main) {
  const f = await recordLegacy(
    {
      type: "snake",
      dealtRev: 15,
      levels: ["easy", "normal", "hard", "expert"],
      deals: 6,
      older: [[14, 3], [13, 3], [12, 3]],
      // A swipe every 12–60 ticks in a random direction.
      random: (seed) => {
        let next = 12;
        return seededEvents(seed, 3600, (rand, t) => {
          if (t < next) return null;
          next = t + 12 + Math.floor(rand() * 49);
          return { k: SNAKE_INPUT_TURN, a: Math.floor(rand() * 4), b: 0, c: 0, d: 0 };
        });
      },
    },
    SNAKE_LADDER_LEGACY,
    "polish/d5 428cd79a (snakeRev 15 at every level, 14, 13, 12; before snakeRev 16)",
  );
  console.log(`wrote ${f.runs.length} runs → ${SNAKE_LADDER_LEGACY}; scores ${f.runs.map((r) => r.score).join(" ")}`);
}
