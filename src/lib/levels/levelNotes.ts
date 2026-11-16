/**
 * What a level changes, in plain words, for a game's intro and "?" help (16 Nov 2026). Shown only when the round's
 * dealt level isn't Normal (`levelNote(type, puzzleLevel(puzzle))`); Normal shows exactly the game's own text. Plain
 * data, no game imports, so the intro and the help can read it. A family session adds its game's lines here.
 */
import { NORMAL, type Level } from "./levels";

export const LEVEL_NOTES: Partial<Record<string, Partial<Record<Exclude<Level, "normal">, string>>>> = {
  racing: {
    easy: "Easy: a wider track, a lower par pace, the gravel keeps 80 % of your speed, and braking points are painted before each sharp corner.",
    hard: "Hard: every km/h under the par pace costs more, the gravel keeps only 60 % of your speed and the tyre walls are closer.",
    expert: "Expert: tighter hairpins, every km/h under par costs even more, the gravel keeps half your speed, the walls are closer, and only the corner speed signs help (no braking boards or racing line).",
  },
};

/** The line for a game at a level, or null (Normal, or a game with no note). */
export function levelNote(type: string, level: Level): string | null {
  if (level === NORMAL) return null;
  return LEVEL_NOTES[type]?.[level as Exclude<Level, "normal">] ?? null;
}
