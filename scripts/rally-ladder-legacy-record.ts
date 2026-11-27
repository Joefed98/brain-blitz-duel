/**
 * Records rally-ladder-check's legacy fixture (scripts/fixtures/rally-ladder-legacy.json.gz): Rally runs on
 * rallyRev 13, the stamp rooms dealt before D5's ladder (rallyRev 14), at every level (Easy, Normal, Hard, Expert as
 * dealt then), plus Normal runs on rallyRev 12 and 11, each graded by the server's own code, so the check proves
 * rallyRev 14 (and the bot's spin shots) left them exactly as they were (score, verdict, stored extra and final
 * checkpoint).
 *
 * Players: the skill-band bot at weak, average, elite and the flawless level under Joe's human limits
 * (scripts/d5-ladder-lib.ts `playDealt`, the bot as it was before it learnt spin shots), and a seeded random finger.
 * Recorded once on polish/d5 428cd79a, before any rallyRev 14 code; never re-record over it.
 *
 *   bun scripts/rally-ladder-legacy-record.ts
 */
import { ARCADE_INPUT_DRAG } from "../src/lib/arcade/engine";
import { recordLegacy, seededEvents } from "./ladder-legacy-lib";

export const RALLY_LADDER_LEGACY = "scripts/fixtures/rally-ladder-legacy.json.gz";

if (import.meta.main) {
  const f = await recordLegacy(
    {
      type: "rally",
      dealtRev: 13,
      levels: ["easy", "normal", "hard", "expert"],
      deals: 6,
      older: [[12, 3], [11, 3]],
      // The finger jumps to a random spot every 4–40 ticks.
      random: (seed) => {
        let next = 4;
        return seededEvents(seed, 3600, (rand, t) => {
          if (t < next) return null;
          next = t + 4 + Math.floor(rand() * 37);
          return { k: ARCADE_INPUT_DRAG, a: Math.floor(rand() * 420), b: 0, c: 0, d: 0 };
        });
      },
    },
    RALLY_LADDER_LEGACY,
    "polish/d5 428cd79a (rallyRev 13 at every level, 12, 11; before rallyRev 14)",
  );
  console.log(`wrote ${f.runs.length} runs → ${RALLY_LADDER_LEGACY}; scores ${f.runs.map((r) => r.score).join(" ")}`);
}
