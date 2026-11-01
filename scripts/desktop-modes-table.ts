/**
 * Prints every game's desktop mode (src/lib/duel/desktopModes.ts) as a Markdown table, active games first
 * by category, then the games retired to practice (docs/desktop-layout.md carries its output).
 *
 *   bun scripts/desktop-modes-table.ts
 */
import { ACTIVE_PUZZLE_TYPES, RETIRED_PUZZLE_TYPES, puzzleDef } from "../src/lib/duel/registry";
import { DESKTOP_MODES } from "../src/lib/duel/desktopModes";
import { arcadeGroupInfo, arcadeGroupOf } from "../src/lib/duel/arcadeGroups";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import type { PuzzleType } from "../src/lib/duel/types";

const ORDER = ["word", "number", "speed", "attention", "pattern", "logic", "arcade"];
const rows = (types: readonly PuzzleType[]) =>
  [...types]
    .sort((a, b) => ORDER.indexOf(puzzleDef(a).category) - ORDER.indexOf(puzzleDef(b).category) || gameDisplayName(a).localeCompare(gameDisplayName(b)))
    .map((t) => {
      const info = DESKTOP_MODES[t];
      const group = arcadeGroupOf(t);
      const cat = puzzleDef(t).category;
      const where = cat === "arcade" ? `Arcade${group ? ` · ${arcadeGroupInfo(group).label}` : ""}` : cat[0]!.toUpperCase() + cat.slice(1);
      const keys = info.keys === "all" ? "arrows and WASD turn" : info.keys === "arrows" ? "arrows turn" : "";
      return `| ${gameDisplayName(t)} | \`${t}\` | ${where} | **${info.mode}** | ${keys} | ${info.why} |`;
    });
const head = "| Game | Id | Category | Desktop mode | Keys | Why |\n| --- | --- | --- | --- | --- | --- |";
const count = (m: string) => ACTIVE_PUZZLE_TYPES.filter((t) => DESKTOP_MODES[t].mode === m).length;
console.log(`Active games (${ACTIVE_PUZZLE_TYPES.length}): wide ${count("wide")}, rotate ${count("rotate")}, tall ${count("tall")}.\n`);
console.log([head, ...rows(ACTIVE_PUZZLE_TYPES)].join("\n"));
console.log(`\nRetired to practice (${RETIRED_PUZZLE_TYPES.length}):\n`);
console.log([head, ...rows(RETIRED_PUZZLE_TYPES)].join("\n"));
