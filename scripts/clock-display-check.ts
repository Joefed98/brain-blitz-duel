/**
 * clock-display-check (bug and sound fixes, 15 Nov 2026; review docs/design/game-reviews/): the clock a game is
 * described with before it is dealt (the Games page, `gameSeconds`) is the clock its live deal actually carries.
 * Six games are dealt their own `timeLimitMs` (Counterweight 120 s, Ballpark 90 s, Topsy-Turvy 120 s, Double Take
 * 60 s, Tally 60 s, Bomb Defusal 90 s) while their definitions say less; the definitions' values stay (older stored
 * puzzles without their own clock fall back to them), and `DEALT_CLOCK_MS` in catalogue.ts says what is dealt.
 * This deals every active game on four seeds and fails if the map drifts from the deal either way.
 *
 *   bun scripts/clock-display-check.ts
 */
import { readFileSync } from "node:fs";

import { gameSeconds } from "../src/components/games/gameMeta";
import {
  ACTIVE_PUZZLE_TYPES,
  DEALT_CLOCK_MS,
  puzzleTimeLimitMs,
  shownTimeLimitMs,
  typeTimeLimitMs,
  usesArcadeClock,
} from "../src/lib/duel/catalogue";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};

for (const type of ACTIVE_PUZZLE_TYPES) {
  const dealt = new Set<number>();
  // Changed with Joe's approval, 15 Nov 2026 (seed deals like the app): each deal seeded as rooms and practice deal it
  // (a bank seed and seeded randomness); the old `{ seed }` setting was no GenerateContext field and was ignored.
  for (let s = 0; s < 4; s++) dealt.add(puzzleTimeLimitMs(withSeededRandom(7100 + s, () => generatePuzzle(type, { bankSeed: 7100 + s }))));
  check(dealt.size === 1, `${type}: the live deal carries more than one clock (${[...dealt].join(", ")})`);
  const clock = [...dealt][0]!;
  check(shownTimeLimitMs(type) === clock, `${type}: shown ${shownTimeLimitMs(type)} ms but dealt ${clock} ms`);
  check(
    gameSeconds(type) === Math.round((clock - (usesArcadeClock(type) ? 3000 : 0)) / 1000),
    `${type}: the Games page says ${gameSeconds(type)} s but the deal is ${clock} ms`,
  );
  // The map lists only games whose deal differs from the definition (so a definition change is noticed too).
  const listed = DEALT_CLOCK_MS[type] !== undefined;
  check(listed === (clock !== typeTimeLimitMs(type)), `${type}: DEALT_CLOCK_MS ${listed ? "lists" : "misses"} it (definition ${typeTimeLimitMs(type)} ms, dealt ${clock} ms)`);
}
for (const type of Object.keys(DEALT_CLOCK_MS)) check((ACTIVE_PUZZLE_TYPES as string[]).includes(type), `DEALT_CLOCK_MS lists ${type}, which isn't an active game`);

// The room settings' "about N min" estimate and the badge rule's clocks (Buzzer Beater, Speed Demon) read the dealt
// clock too (15 Nov 2026, Joe).
{
  const { puzzleLimits } = await import("../src/lib/badges/badges.server");
  const limits = puzzleLimits();
  for (const [type, ms] of Object.entries(DEALT_CLOCK_MS)) check(limits[type] === ms, `badge clocks: ${type} reads ${limits[type]} ms, dealt ${ms} ms`);
  const settings = readFileSync("src/lib/duel/roomSettings.ts", "utf8");
  const avg = settings.slice(settings.indexOf("function averageLimitS"), settings.indexOf("export function estimateRoomMinutes"));
  check(/shownTimeLimitMs\(t\)/.test(avg) && !/timeLimitMs \?\?/.test(avg), "the room estimate reads shownTimeLimitMs (the dealt clock)");
}

if (failures.length) {
  console.log(`clock-display-check: FAIL (${failures.length} of ${failures.length + passes})`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`clock-display-check: ${passes} passed`);
