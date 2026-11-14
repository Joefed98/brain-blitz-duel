import { CATEGORY_NAMES } from "@/components/duel/GameFrame";
import { PUZZLE_INSTRUCTIONS } from "@/lib/duel/instructions";
import {
  ACTIVE_PUZZLE_TYPES,
  PREVIEW_PUZZLE_TYPES,
  isPlayable,
  puzzleCategories,
  puzzleDef,
  typeTimeLimitMs,
  typesInCategory,
  usesArcadeClock,
} from "@/lib/duel/catalogue";
import {
  ARCADE_GROUPS,
  arcadeGroupInfo,
  arcadeGroupOf,
  arcadeGroupTypes,
} from "@/lib/duel/arcadeGroups";
import { alsoInOf, typesAlsoIn } from "@/lib/duel/alsoIn";
import type { PuzzleType } from "@/lib/duel/types";

/**
 * What the Games catalogue and a game's page say about a game (phase 2 step 3, 14 Nov 2026): its shelf (a puzzle's
 * category, an arcade game's group, with today's names and colours), its time limit as the round intro states it,
 * and its goal and how to play from the intro's own text (instructions.ts).
 */

/** A catalogue shelf: a live puzzle category or a live arcade group (its id is also its colour's data-cat). */
export interface Shelf {
  id: string;
  label: string;
  games: PuzzleType[];
}

const live = (type: PuzzleType) => isPlayable(type);

/**
 * The chips after All: each live puzzle category, then each live arcade group, each with its games (a game listed
 * also in another pick, alsoIn.ts, is on that shelf too). A shelf with no playable game is left out.
 */
export function catalogueShelves(): Shelf[] {
  const categories = puzzleCategories()
    .filter((category) => category !== "arcade")
    .map((category) => ({
      id: category,
      label: CATEGORY_NAMES[category],
      games: [...typesInCategory(category), ...typesAlsoIn(category)].filter(live),
    }));
  const groups = ARCADE_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    games: [...arcadeGroupTypes(group.id), ...typesAlsoIn(group.id)].filter(live),
  }));
  return [...categories, ...groups].filter((shelf) => shelf.games.length > 0);
}

/** Every playable game, in the catalogue's order (puzzles by category, then arcade by group; each once). */
export function catalogueGames(): PuzzleType[] {
  const order: PuzzleType[] = [];
  const seen = new Set<PuzzleType>();
  for (const shelf of catalogueShelves())
    for (const type of shelf.games)
      if (
        !seen.has(type) &&
        (puzzleDef(type).category === "arcade"
          ? arcadeGroupOf(type) === shelf.id
          : puzzleDef(type).category === shelf.id)
      ) {
        seen.add(type);
        order.push(type);
      }
  // A playable game on no shelf (none today) still shows, last; so do the practice-only previews.
  for (const type of [...ACTIVE_PUZZLE_TYPES, ...PREVIEW_PUZZLE_TYPES])
    if (live(type) && !seen.has(type)) {
      seen.add(type);
      order.push(type);
    }
  return order;
}

/** Whether a game is on a shelf (its home, or a pick it is also in). */
export function onShelf(type: PuzzleType, shelf: string): boolean {
  const def = puzzleDef(type);
  return (
    (def.category === "arcade" ? arcadeGroupOf(type) === shelf : def.category === shelf) ||
    alsoInOf(type) === shelf
  );
}

/** A game's tag: its arcade group, else its category (the id is its colour's data-cat). */
export function gameTag(type: PuzzleType): { id: string; label: string } {
  const group = arcadeGroupOf(type);
  if (group) return { id: group, label: arcadeGroupInfo(group).label };
  const category = puzzleDef(type).category;
  return { id: category, label: CATEGORY_NAMES[category] };
}

/** The round's length in seconds, as the round intro says it (an arcade clock's 3 s of slack left out). */
export function gameSeconds(type: PuzzleType): number {
  return Math.round((typeTimeLimitMs(type) - (usesArcadeClock(type) ? 3000 : 0)) / 1000);
}

/** The goal and the intro's how-to lines (never the help-only ones), at most three. */
export function gameGuide(type: PuzzleType): { goal: string; how: string[] } {
  const instructions = PUZZLE_INSTRUCTIONS[type];
  if (!instructions) return { goal: "", how: [] };
  return {
    goal: instructions.goal,
    how: instructions.how
      .filter((line) => !line.helpOnly)
      .slice(0, 3)
      .map((line) => `${line.action} ${line.detail}`.trim()),
  };
}
