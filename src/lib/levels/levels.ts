/**
 * Difficulty levels (phase 2 step 4, 15 Nov 2026; docs/design/difficulty/README.md): the one shared level type and
 * the rules every mode reads. Shared and pure (phone and server); no storage, no network, no game code.
 *
 * Four levels, in this order: Easy, Normal, Hard, Expert. Normal is exactly today's game. A game offers Normal plus
 * whatever its family session declares in gameLevels.ts; a level a game doesn't offer is played as Normal.
 *
 * Stored form: a dealt puzzle carries `level` ("easy" | "hard" | "expert") only when it was dealt at a level other
 * than Normal, so every Normal deal is byte for byte the deal from before levels (deal-identity-check) and every
 * stored round without the field is Normal. Practice progress and ratings keep the older stored key "classic" for
 * Normal (practice_plays.level, practice_progress.level, rated game_mode); `storedLevelKey` / `levelFromStored`
 * convert, so no stored row is rewritten.
 */

export const LEVELS = ["easy", "normal", "hard", "expert"] as const;
export type Level = (typeof LEVELS)[number];

/** Today's game. Rated play, the Daily and any game without levels always play it. */
export const NORMAL: Level = "normal";

export const LEVEL_LABEL: Readonly<Record<Level, string>> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
  expert: "Expert",
};

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value);
}

/** Any value read as a level: anything that isn't one (null, "classic", junk) is Normal. */
export function levelOrNormal(value: unknown): Level {
  return isLevel(value) ? value : NORMAL;
}

/** The level a dealt puzzle was dealt at (no `level` field: Normal, every round before levels). */
export function puzzleLevel(puzzle: unknown): Level {
  if (!puzzle || typeof puzzle !== "object") return NORMAL;
  return levelOrNormal((puzzle as { level?: unknown }).level);
}

/** A level deal's level, or null at Normal (the games' sims take null for today's game). */
export function levelOfPuzzle(puzzle: unknown): Exclude<Level, "normal"> | null {
  const level = puzzleLevel(puzzle);
  return level === "normal" ? null : level;
}

/** The stored key practice progress and ratings use: Normal keeps its older name, "classic". */
export type StoredLevelKey = "easy" | "classic" | "hard" | "expert";
export function storedLevelKey(level: Level): StoredLevelKey {
  return level === "normal" ? "classic" : level;
}

/** A stored key read back as a level ("classic", null and anything unknown are Normal). */
export function levelFromStored(raw: unknown): Level {
  if (raw === "easy" || raw === "hard" || raw === "expert") return raw;
  return NORMAL;
}

/**
 * A dealt puzzle stamped with its level: unchanged at Normal (no field), else `level` added. The deal (generate.server.ts)
 * is the only caller; nothing else writes the field.
 */
export function stampLevel<T extends object>(puzzle: T, level: Level): T {
  if (level === NORMAL) return puzzle;
  return { ...puzzle, level };
}

/** The clock rule every game keeps at every level (difficulty-check deals every game at every level). */
export const MAX_ROUND_CLOCK_MS = 120_000;
