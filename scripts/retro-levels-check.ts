/**
 * retro-levels-check (22 Nov 2026, the polish plan's D5; docs/polish-plan-final/difficulty-spec.md "Retro and Action"):
 * the Retro games' levels.
 *
 *   1. Older rounds: every run of D5's legacy fixture (scripts/fixtures/d5-levels-legacy.json.gz, recorded on the code
 *      before D5 changed any level or Normal stamp, by scripts/d5-levels-legacy-record.ts) grades exactly as it did
 *      (score, verdict and extra, the replay's own timing aside), Normal and every level, for all sixteen Retro and
 *      Action games.
 *   2. A Normal deal is byte for byte the deal with no level asked, for each Retro game.
 *
 *   bun scripts/retro-levels-check.ts
 */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleType } from "../src/lib/duel/types";
import { RETRO_GAMES } from "./d5-ladder-lib";
import { D5_LEVELS_LEGACY, stableExtra, type D5LegacyCase } from "./d5-levels-legacy-record";

let passes = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
};
const section = (s: string) => console.log(`\n${s}`);

section("1. Older rounds grade exactly as before (D5's legacy fixture, every game and level)");
{
  const cases = JSON.parse(gunzipSync(readFileSync(D5_LEVELS_LEGACY)).toString()) as D5LegacyCase[];
  ok(cases.length >= 16 * 4 * 2, `the legacy fixture holds a run a player at every level of all sixteen games (${cases.length})`);
  const games = new Set(cases.map((c) => c.game));
  ok(games.size === 16, `sixteen games recorded (${games.size})`);
  let same = 0;
  for (const c of cases) {
    const g = gradeAnswer(c.puzzle, c.answer, 0);
    if (g.score === c.score && g.isCorrect === c.isCorrect && stableExtra(g.extra) === c.extra) same++;
    else ok(false, `${c.game} ${c.level} ${c.who}: ${c.score} → ${g.score}${stableExtra(g.extra) === c.extra ? "" : " (extra differs)"}`);
  }
  ok(same === cases.length, `${same} of ${cases.length} legacy runs grade as recorded`);
}

section("2. A Normal deal is the deal with no level asked");
{
  const deal = (type: PuzzleType, level: "normal" | null, seed: number) =>
    withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed, ...(level ? { level } : {}) }));
  for (const type of RETRO_GAMES) {
    for (const seed of [7, 99, 4242]) ok(JSON.stringify(deal(type, null, seed)) === JSON.stringify(deal(type, "normal", seed)), `${type} ${seed}: Normal = no level`);
  }
}

console.log(`\n${failures.length ? "FAIL" : "PASS"}: ${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
