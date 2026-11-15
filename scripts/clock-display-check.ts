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

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};

for (const type of ACTIVE_PUZZLE_TYPES) {
  const dealt = new Set<number>();
  for (let s = 0; s < 4; s++) dealt.add(puzzleTimeLimitMs(generatePuzzle(type, { seed: `clock-display-${s}` })));
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

if (failures.length) {
  console.log(`clock-display-check: FAIL (${failures.length} of ${failures.length + passes})`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`clock-display-check: ${passes} passed`);
