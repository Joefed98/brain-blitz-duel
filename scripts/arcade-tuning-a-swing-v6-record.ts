/**
 * Records Grappler swingRev 6's touch stars on every SWING_V4_BANK course (10 Nov 2026, for arcade-tuning-a-check's
 * full depth): each course's star count and the spread of its stars' heights (max − min, 1/256 px), from the code it
 * runs on. Written to scripts/fixtures/arcade-tuning-a-swing-v6-stars.json; the 66 courses that never met Tuning A's
 * "10 stars, at least 80 px apart" (since the check was written, 7822b181 on 12 Oct 2026) are pinned there exactly.
 *
 *   bun scripts/arcade-tuning-a-swing-v6-record.ts            (writes the fixture from today's code)
 *   bun scripts/arcade-tuning-a-swing-v6-record.ts --print    (prints every course's figures as JSON, writes nothing;
 *     run it in a checkout of 7822b181 to compare: it only uses what that commit had)
 */
import { writeFileSync } from "node:fs";
import { swingGameFor, SWING_REV_TUNED, SWING_STARS, type SwingState } from "../src/lib/arcade/swing";
import { SWING_V4_BANK } from "../src/lib/duel/swingBankV4.server";

const FP = 256;
const courses = SWING_V4_BANK.map(({ seed }) => {
  const s = swingGameFor(SWING_REV_TUNED).init(seed) as SwingState;
  const spots = s.starSpots ?? [];
  const ys = spots.map(([, y]) => y);
  return { seed, stars: spots.length, spread: ys.length ? Math.max(...ys) - Math.min(...ys) : 0 };
});
if (process.argv.includes("--print")) {
  console.log(JSON.stringify(courses));
  process.exit(0);
}
const pinned = courses.filter((c) => c.stars !== SWING_STARS || c.spread < 80 * FP);
writeFileSync(
  "scripts/fixtures/arcade-tuning-a-swing-v6-stars.json",
  `${JSON.stringify({ note: "swingRev 6 courses whose touch stars never met '10 stars, at least 80 px apart' (the same on 7822b181, 12 Oct 2026); arcade-tuning-a-check holds each to exactly these figures (Joe's approval, 10 Nov 2026). spread is in 1/256 px.", recordedOn: "7822b181 and 10 Nov 2026 main, identical", courses: pinned }, null, 1)}\n`,
);
console.log(`pinned ${pinned.length} of ${courses.length} courses`);
