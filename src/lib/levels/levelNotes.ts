/**
 * What a level changes, in plain words, for a game's intro and "?" help (16 Nov 2026). Shown only when the round's
 * dealt level isn't Normal (`levelNote(type, puzzleLevel(puzzle))`); Normal shows exactly the game's own text. Plain
 * data, no game imports, so the intro and the help can read it. A family session adds its game's lines here.
 */
import { NORMAL, type Level } from "./levels";

export const LEVEL_NOTES: Partial<Record<string, Partial<Record<Exclude<Level, "normal">, string>>>> = {
  curling: {
    easy: "Easy: two red stones, further from the button; the stone’s whole path is shown, and the stones score more easily.",
    hard: "Hard: four red stones, closer to the button.",
    expert: "Expert: five red stones close to the button, with no HOUSE zone on the power bar and no aim line.",
  },
  racing: {
    easy: "Easy: a wider track, a lower par pace, the gravel keeps 80 % of your speed, and braking points are painted before each sharp corner.",
    hard: "Hard: every km/h under the par pace costs more, the gravel keeps only 60 % of your speed and the tyre walls are closer.",
    expert: "Expert: tighter hairpins (Ridge Loop keeps its own), every km/h under par costs even more, the gravel keeps half your speed, the walls are closer, and only the corner speed signs help (no braking boards or racing line).",
  },
};

/**
 * Apex's levels on racingRev 5 (D6, 27 Nov 2026; docs/arcade-standard/racing.md "D6 levels"): the road narrows a level
 * up and the gravel keeps less of your speed (80 / 50 / 35 %); a racingRev 4 round keeps LEVEL_NOTES.racing above.
 */
export const RACING_D6_NOTES: Readonly<Record<Exclude<Level, "normal">, string>> = {
  easy: "Easy: a wider road, a lower par pace, the gravel keeps 80 % of your speed, and braking points are painted before each sharp corner.",
  hard: "Hard: a narrower road with the tyre walls closer, every km/h under the par pace costs more, and the gravel keeps half your speed.",
  expert: "Expert: the narrowest road, tighter hairpins (Ridge Loop keeps its own), every km/h under par costs even more, the gravel keeps about a third of your speed, and only the corner speed signs help (no braking boards or racing line).",
};

/** The line for a game at a level, or null (Normal, or a game with no note). */
export function levelNote(type: string, level: Level): string | null {
  if (level === NORMAL) return null;
  return LEVEL_NOTES[type]?.[level as Exclude<Level, "normal">] ?? null;
}
