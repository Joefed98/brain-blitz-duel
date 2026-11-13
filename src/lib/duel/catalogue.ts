/**
 * The light game catalogue (speed fix 1, Nov 2026; docs/audit-nov-2026/performance.md finding 1): every
 * game's id, name, category, clock, reveal length, theme and desktop mode, and the timing and category
 * helpers built on them, with none of the games' code. Menus, lists, room settings, the tie-break and the
 * offline packs read this; a game's Stage, Reveal and IntroExample come from `gameLoader.ts`, which
 * downloads only that game's chunk. The data is generated from the full registry
 * (`bun scripts/game-catalogue.ts`; game-catalogue-check proves they agree), and `registry.ts`
 * re-exports every helper here, so the server and the checks read the same values.
 *
 * Never import `registry.ts` from code the phone loads: it pulls in every game.
 */
import { CATALOGUE_DATA } from "./catalogue.data";
import { DESKTOP_MODES, type DesktopModeInfo } from "./desktopModes";
import { REMOVED_GAMES, removedGameName, type RemovedPuzzleType } from "./removedGames";
import { REVEAL_MS, ROUND_MS, type PuzzleCategory, type PuzzleData, type PuzzleType } from "./types";
import { gameTheme, type GameTheme } from "@/lib/fx/theme";

/** One game's line as generated from its definition (catalogue.data.ts). */
export interface CatalogueEntry {
  name: string;
  category: PuzzleCategory;
  timeLimitMs: number;
  revealMs?: number;
  arcadeRun?: boolean;
  showTimer?: boolean;
  revealHeading?: string;
  /** The intro's GOAL line (instructions.ts), read by the play header without the whole help copy. */
  goal?: string;
}

/** What the app knows about a game without loading it. */
export interface GameInfo extends CatalogueEntry {
  key: PuzzleType;
  revealMs: number;
  retired: boolean;
  theme: GameTheme;
  /** How the game is presented on a wide screen (desktopModes.ts; presentation only). */
  desktop: DesktopModeInfo;
}

const LONG_REVEAL_TYPES = new Set<PuzzleType>([
  "target",
  "wordsmith",
  "wordhunt",
  "stroop",
  "spotdiff",
  "tilegrid",
]);

/** Always in the room draw. */
export const CORE_CATEGORIES: PuzzleCategory[] = ["logic", "pattern", "speed", "attention", "word"];

/** Only drawn when the host switches them on in the lobby. */
export const OPT_IN_CATEGORIES: PuzzleCategory[] = ["number"];

/** The arcade pool: one round at most, and only when the host toggle is on. */
export const ARCADE_CATEGORY: PuzzleCategory = "arcade";

/**
 * Retired games (Joe's rule, 13 Nov 2026): out of the app entirely. A retired game is never dealt, shown, played or
 * counted anywhere a player could choose, play or earn from it: Practice (no Retired section), rooms, the Daily and its
 * Plus archive, rated play and recorded runs, tournaments, weekly and Practice challenges, offline packs, the shop,
 * Customise, star totals, gems, badges and every count (`isPlayable`). Nothing is deleted: the code, stars, bests,
 * owned items, challenge completions and stored rounds stay, and history (results, match history, replays) still names
 * it, display only. This set is the one switch: removing a game from it restores everything.
 */
export const RETIRED_TYPES = new Set<PuzzleType>([
  "rooftop",
  "swerve",
  "dual",
  "steady",
  "hotfloor",
  "dig",
  // Bastion came back to rooms on 1 Nov 2026 as the tank-defence shooter (bastionRev 2); its unstamped rounds replay as before.
  // Tuning C (Oct 2026): practice only.
  "junction",
  // Scoring report batch 2 (20 Oct 2026): practice only, on its current stamps (wordfallRev 3).
  "wordfall",
  // Joe's decision (27 Oct 2026): Scrumper is practice only; stored rounds replay and grade as before.
  "snip",
  // Joe's decision (1 Nov 2026): Full House is practice only; stored rounds replay and grade as before.
  "pokersquares",
  // Joe's decision (2 Nov 2026): Muggins is practice only at launch (its medians don't rise with skill); stored rounds
  // replay and grade as before.
  "muggins",
  // Joe's decision (3 Nov 2026, the Cards & Board batch): Golf Solitaire is practice only; its practice bests and
  // stored rounds replay and grade as before.
  "golfsol",
  // Joe's decision (13 Nov 2026): nine more, out of the app with the rest.
  "stroop",
  "tiles",
  "rings",
  "lightsout",
  "stopwatch",
  "slice",
  "alleyroll",
  "bintoss",
  "bullseye",
]);

/** Slack added to every arcade phase beyond its run; never shown to players. */
export const ARCADE_PHASE_SLACK_MS = 3000;

/** A game's reveal length, as the registry resolves it. */
export function resolvedRevealMs(type: PuzzleType, own: number | undefined): number {
  return own ?? (LONG_REVEAL_TYPES.has(type) ? 8_000 : REVEAL_MS);
}

export const PUZZLE_CATALOGUE = Object.fromEntries<GameInfo>(
  Object.entries(CATALOGUE_DATA).map(([type, entry]) => [
    type,
    {
      ...entry,
      key: type as PuzzleType,
      revealMs: resolvedRevealMs(type as PuzzleType, entry.revealMs),
      retired: RETIRED_TYPES.has(type as PuzzleType),
      theme: gameTheme(type as PuzzleType, entry.category),
      desktop: DESKTOP_MODES[type as PuzzleType],
    },
  ]),
) as Record<PuzzleType, GameInfo>;

export const PUZZLE_TYPES = Object.keys(PUZZLE_CATALOGUE) as PuzzleType[];

const REMOVED_INFO = new Map<string, GameInfo>();

/** The catalogue line a deleted game's id (removedGames.ts) reads as: its name, its clock, nothing to play. */
function removedInfo(type: string): GameInfo {
  let info = REMOVED_INFO.get(type);
  if (!info) {
    const known = (REMOVED_GAMES as Record<string, { name: string; accent: PuzzleCategory; timeLimitMs: number } | undefined>)[type];
    const category = known?.accent ?? "pattern";
    info = {
      key: type as PuzzleType,
      name: known?.name ?? type,
      category,
      timeLimitMs: known?.timeLimitMs ?? ROUND_MS,
      showTimer: false,
      retired: true,
      revealMs: REVEAL_MS,
      theme: gameTheme(undefined, category),
      desktop: { mode: "wide", why: "deleted game: name and stored score only" },
    };
    REMOVED_INFO.set(type, info);
  }
  return info;
}

/**
 * A type's catalogue line. A deleted game's id, still held by stored rounds, gets a
 * read-only stand-in with its name and clock.
 */
export function puzzleInfo(type: PuzzleType | RemovedPuzzleType): GameInfo {
  return PUZZLE_CATALOGUE[type as PuzzleType] ?? removedInfo(type);
}

/**
 * The registry's names for the catalogue, so app code reads as it did before the split (and the checks that read
 * it as text still find it): `puzzleDef(type)` / `PUZZLE_REGISTRY[type]` here give the catalogue line, never a game's
 * code; the full registry (server only) has the same names with the whole definition.
 */
export const puzzleDef = puzzleInfo;
export const PUZZLE_REGISTRY = PUZZLE_CATALOGUE;

/** A game's GOAL line as the intro shows it ("" for a deleted game). */
export function puzzleGoal(type: PuzzleType | RemovedPuzzleType): string {
  return PUZZLE_CATALOGUE[type as PuzzleType]?.goal ?? "";
}

/** A live type's name, or the name a deleted game had (stored history rows still carry its id). */
export function puzzleName(type: PuzzleType | RemovedPuzzleType): string {
  return PUZZLE_CATALOGUE[type as PuzzleType]?.name ?? removedGameName(type) ?? type;
}

/** True for a type the app can still play, reveal and replay; false for deleted ids in stored rounds. */
export function isLiveType(type: unknown): type is PuzzleType {
  return typeof type === "string" && Object.prototype.hasOwnProperty.call(PUZZLE_CATALOGUE, type);
}

/** True for types kept only for practice. */
export function isRetired(type: PuzzleType): boolean {
  // Read from the set itself (the one switch), so nothing can disagree with it.
  return RETIRED_TYPES.has(type);
}

/**
 * True for a game a player can choose, play or earn from: a live id that isn't retired. Every surface that offers,
 * deals, grades for progress or counts a game asks this (RETIRED_TYPES is its one switch).
 */
export function isPlayable(type: unknown): type is PuzzleType {
  return isLiveType(type) && !isRetired(type);
}

/** Every type still in rotation. */
export const ACTIVE_PUZZLE_TYPES = PUZZLE_TYPES.filter((t) => !isRetired(t));

export const RETIRED_PUZZLE_TYPES = PUZZLE_TYPES.filter((t) => isRetired(t));

/**
 * New games that rooms do not deal yet, listed on their own in practice (not
 * under Retired; none today: Pinball was the last, dealt since 14 Oct 2026). They
 * must also be in RETIRED_PUZZLE_TYPES, which is what keeps them out of room draws.
 */
export const PREVIEW_PUZZLE_TYPES: PuzzleType[] = [];

export function puzzleCategories(): PuzzleCategory[] {
  return Array.from(new Set(ACTIVE_PUZZLE_TYPES.map((t) => PUZZLE_CATALOGUE[t].category)));
}

/** Non-retired types in a category — what every draw and list reads. */
export function typesInCategory(category: PuzzleCategory): PuzzleType[] {
  return ACTIVE_PUZZLE_TYPES.filter((t) => PUZZLE_CATALOGUE[t].category === category);
}

/** Includes retired types; for practice listings only. */
export function allTypesInCategory(category: PuzzleCategory): PuzzleType[] {
  return PUZZLE_TYPES.filter((t) => PUZZLE_CATALOGUE[t].category === category);
}

/** Pool sizes per category, retired types excluded. */
export function categoryPoolSizes(): Record<PuzzleCategory, number> {
  const out = {} as Record<PuzzleCategory, number>;
  for (const category of [...CORE_CATEGORIES, ...OPT_IN_CATEGORIES]) {
    out[category] = typesInCategory(category).length;
  }
  return out;
}

/** The clock length for a puzzle type (30s unless the type says otherwise). */
export function typeTimeLimitMs(type: PuzzleType): number {
  return puzzleInfo(type).timeLimitMs ?? ROUND_MS;
}

/**
 * The clock length for a specific puzzle. A puzzle may carry its own limit —
 * Tower's five-disc variant does — which always wins over the type's default.
 */
export function puzzleTimeLimitMs(puzzle: PuzzleData | undefined): number {
  if (!puzzle) return ROUND_MS;
  const own = (puzzle as { timeLimitMs?: number }).timeLimitMs;
  if (typeof own === "number" && own > 0) return own;
  return typeTimeLimitMs(puzzle.type);
}

export function puzzleRevealMs(puzzle: PuzzleData | undefined): number {
  if (!puzzle) return REVEAL_MS;
  return puzzleInfo(puzzle.type).revealMs ?? REVEAL_MS;
}

/** Preparation time before a puzzle's clock starts (0 for every type today; no definition sets prepMs). */
export function puzzlePrepMs(puzzle: PuzzleData | undefined): number {
  if (!puzzle) return 0;
  return 0;
}

/** How long the puzzle phase lasts for this puzzle (no definition sets durationMs). */
export function puzzleDurationMs(puzzle: PuzzleData | undefined): number {
  if (!puzzle) return ROUND_MS;
  return puzzlePrepMs(puzzle) + puzzleTimeLimitMs(puzzle);
}

/** Arcade-category games plus any other type built on the arcade engine. */
export function usesArcadeClock(type: PuzzleType): boolean {
  const info = puzzleInfo(type);
  return info.category === "arcade" || info.arcadeRun === true;
}

/** For arcade rounds, the run length the clock shows; null for everything else. */
export function puzzleRunMs(puzzle: PuzzleData | undefined): number | null {
  if (!puzzle) return null;
  const info = puzzleInfo(puzzle.type);
  if (!usesArcadeClock(puzzle.type)) return null;
  return info.timeLimitMs - ARCADE_PHASE_SLACK_MS;
}

export function puzzleShowsTimer(puzzle: PuzzleData | undefined): boolean {
  if (!puzzle) return true;
  return puzzleInfo(puzzle.type).showTimer !== false;
}

/** Live game counts for marketing lines: non-retired core/opt-in types vs arcade types. */
export function gameCounts(): { puzzle: number; arcade: number } {
  const puzzle = [...CORE_CATEGORIES, ...OPT_IN_CATEGORIES].reduce((n, c) => n + typesInCategory(c).length, 0);
  return { puzzle, arcade: typesInCategory(ARCADE_CATEGORY).length };
}
