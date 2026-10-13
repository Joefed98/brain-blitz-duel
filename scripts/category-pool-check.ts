/**
 * Category pools (13 Oct 2026 rotation): every category the lobby offers keeps
 * at least MIN_ACTIVE active games, so a retirement or a category move that
 * would thin one out fails here, loudly, before a room can be dealt short.
 * Also proves the rotation's own moves (Interloper retired; Chroma Lines,
 * Pipeline and Heave in Pattern) and that nothing stored reads a game's
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
  RETIRED_PUZZLE_TYPES,
  typesInCategory,
} from "../src/lib/duel/registry";
import type { PuzzleType } from "../src/lib/duel/types";

const MIN_ACTIVE = 6;
const failures: string[] = [];
const fail = (message: string) => {
  failures.push(message);
  console.log(`FAIL ${message}`);
};

// Every category the lobby offers (CATEGORY_ORDER; Memory is never offered).
const offered = CATEGORY_ORDER.filter((c) => c !== "memory");
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
expect("intruder", "attention", true);
for (const type of ["flow", "pipes", "push"] as const) expect(type, "pattern", false);

// Totals agree with the registry everywhere they are read.
const { puzzle, arcade } = gameCounts();
if (
  puzzle + arcade !==
  ACTIVE_PUZZLE_TYPES.filter((t) => puzzleDef(t).category !== "memory").length
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
for (const file of sources) {
  const text = readFileSync(file, "utf8");
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
  `PASS: every lobby category has at least ${MIN_ACTIVE} active games (${counts.join(", ")}; ${ACTIVE_PUZZLE_TYPES.length} active, ${RETIRED_PUZZLE_TYPES.length} retired); Interloper retired; Chroma Lines, Pipeline and Heave in Pattern; grading, scoring and generators never read a category, and rooms store only types and the host's selection`,
);
