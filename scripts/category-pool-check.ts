/**
 * Category pools (13 Oct 2026 rotation): every category the lobby offers keeps
 * at least MIN_ACTIVE active games, so a retirement or a category move that
 * would thin one out fails here, loudly, before a room can be dealt short.
 * Also proves the rotation's own moves (Chroma Lines, Pipeline and Heave in
 * Pattern), that the 19 games deleted on 14 Oct 2026 (removedGames.ts) and
 * the Memory category are gone from the registry, and that nothing stored reads a game's
 * category: grading, scoring and the server-only generators never do, and rooms
 * store only puzzle types (round_order) and the host's chosen categories
 * (selected_categories), so moving a game changes no stored round or history.
 */
import { readdirSync, readFileSync } from "node:fs";

import { CATEGORY_ORDER } from "../src/lib/duel/categories";
import {
  ACTIVE_PUZZLE_TYPES,
  gameCounts,
  isRetired,
  puzzleDef,
  PUZZLE_TYPES,
  RETIRED_PUZZLE_TYPES,
  typesInCategory,
} from "../src/lib/duel/registry";
import type { PuzzleType } from "../src/lib/duel/types";
import { REMOVED_PUZZLE_TYPES } from "../src/lib/duel/removedGames";
import { ACTIVE_ARCADE_GAMES } from "../src/lib/arcade/arcadeFxGames.renderer";

const MIN_ACTIVE = 6;
const failures: string[] = [];
const fail = (message: string) => {
  failures.push(message);
  console.log(`FAIL ${message}`);
};

// Every category the lobby offers (CATEGORY_ORDER).
const offered = CATEGORY_ORDER;
const counts: string[] = [];
for (const category of offered) {
  const active = typesInCategory(category);
  counts.push(`${category} ${active.length}`);
  if (active.length < MIN_ACTIVE)
    fail(`${category}: ${active.length} active games, the lobby needs at least ${MIN_ACTIVE}`);
  for (const type of active)
    if (isRetired(type)) fail(`${category}: retired ${type} still counted as active`);
}

// The rotation's moves.
const expect = (type: PuzzleType, category: string, retired: boolean) => {
  const def = puzzleDef(type);
  if (def.category !== category) fail(`${type}: category ${def.category}, want ${category}`);
  if (isRetired(type) !== retired)
    fail(`${type}: ${retired ? "should be retired to practice" : "should be active"}`);
};
for (const type of ["flow", "pipes", "push"] as const) expect(type, "pattern", false);
// Scrumper retired to practice (Joe's decision, 27 Oct 2026); its icon and name stay for history.
expect("snip", "arcade", true);

// The active pool per category (27 Oct 2026, after Scrumper's retirement, with Trail in Logic): 72 games.
// Arcade's count reads the arcade worlds' active list (ACTIVE_ARCADE_GAMES), not a number: the arcade groups' sessions
// add games in parallel (Cards & Board and Sports, 30 Oct 2026); each new game is pinned to Arcade, active, above.
const POOL: Record<string, number> = { word: 9, number: 8, speed: 6, attention: 6, pattern: 10, logic: 12, arcade: ACTIVE_ARCADE_GAMES.length };
for (const type of ["minesweeper", "mahjong", "homerun", "freekick", "racing"] as const) expect(type, "arcade", false);
for (const [category, want] of Object.entries(POOL)) {
  const got = typesInCategory(category as never).length;
  if (got !== want) fail(`${category}: ${got} active games, want ${want}`);
}
if (ACTIVE_ARCADE_GAMES.length < 21) fail(`${ACTIVE_ARCADE_GAMES.length} active arcade worlds, at least the 21 dealt before the new groups`);
const WANT_ACTIVE = Object.values(POOL).reduce((a, n) => a + n, 0);
if (ACTIVE_PUZZLE_TYPES.length !== WANT_ACTIVE) fail(`${ACTIVE_PUZZLE_TYPES.length} active games, want ${WANT_ACTIVE}`);

// The deleted games and Memory are gone: no registry entry, no category, no draw.
for (const type of REMOVED_PUZZLE_TYPES)
  if ((PUZZLE_TYPES as string[]).includes(type)) fail(`${type}: deleted on 14 Oct 2026 but still registered`);
for (const type of PUZZLE_TYPES)
  if (!(CATEGORY_ORDER as string[]).includes(puzzleDef(type).category))
    fail(`${type}: category ${puzzleDef(type).category} is not one the lobby offers`);

// Totals agree with the registry everywhere they are read.
const { puzzle, arcade } = gameCounts();
if (
  puzzle + arcade !==
  ACTIVE_PUZZLE_TYPES.length
)
  fail(`gameCounts ${puzzle} + ${arcade} does not match the active registry`);

// Nothing that grades, scores or generates a round reads a game's category.
const sources = [
  "src/lib/duel/grade.ts",
  "src/lib/duel/scoring.ts",
  "src/lib/duel/stagedRounds.ts",
  "src/lib/duel/speedPar.ts",
  "src/lib/duel/roundSummaries.ts",
  ...readdirSync("src/lib/duel")
    .filter((f) => f.endsWith(".server.ts"))
    .map((f) => `src/lib/duel/${f}`),
];
// Allowed: files that deal a set of rounds, which is choosing games by category, as a room's deal does
// (selection.ts). daily.server.ts deals the day's Daily Puzzle (one game per puzzle category) and Daily
// Arcade (arcade games) once, then stores only the dealt games' types and puzzles (async_rooms.round_order,
// puzzles_public); nothing after the deal reads a category, so a later category move never changes a stored
// daily, the same rule as stored rounds (daily-check proves it). Its category reads must stay inside the deal.
const DEALS = new Set(["src/lib/duel/daily.server.ts"]);
for (const file of sources) {
  const text = readFileSync(file, "utf8");
  if (DEALS.has(file)) {
    const deal = /export function dailyRoundOrder\([\s\S]*?\n\}\n/.exec(text)?.[0] ?? "";
    // Outside the deal, with comments and imports left out ("arcade" is also a daily's kind, so not matched).
    const rest = text
      .replace(deal, "")
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
      .replace(/^import[\s\S]*?;$/gm, "");
    if (!deal) fail(`${file}: its deal (dailyRoundOrder) is missing`);
    if (/DAILY_PUZZLE_CATEGORIES|\.category\b|typesInCategory|allTypesInCategory|from "\.\/categories"/.test(rest))
      fail(`${file} reads a game's category outside its deal (dailyRoundOrder)`);
    continue;
  }
  if (
    /(puzzleDef\([^)]*\)|PUZZLE_REGISTRY\[[^\]]*\]|\bdef(inition)?)\.category\b|typesInCategory|allTypesInCategory|from "\.\/categories"/.test(
      text,
    )
  )
    fail(`${file} reads a game's category`);
}
// The only category data a room stores is the host's selection; rounds store types.
const migrations = readdirSync("supabase/migrations")
  .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
  .join("\n");
const categoryColumns = [...migrations.matchAll(/ADD COLUMN IF NOT EXISTS (\w*categor\w*)/gi)].map(
  (m) => m[1],
);
for (const column of categoryColumns)
  if (column !== "selected_categories")
    fail(`a migration stores ${column}: check it does not record a game's category`);

if (failures.length) {
  console.log(`FAIL: ${failures.length} category-pool problem(s)`);
  process.exit(1);
}
console.log(
  `PASS: every lobby category has at least ${MIN_ACTIVE} active games (${counts.join(", ")}; ${ACTIVE_PUZZLE_TYPES.length} active, ${RETIRED_PUZZLE_TYPES.length} retired); Chroma Lines, Pipeline and Heave in Pattern; the 19 deleted games and Memory gone; grading, scoring and generators never read a category, and rooms store only types and the host's selection`,
);
