/**
 * A level's one plain line (what changes from Normal), for the round intro, the "?" help and a game's page (the Word
 * overhaul, stage 3, 15 Nov 2026). Plain data only; a game whose family session gave no lines has none.
 */
import { WORD_LEVEL_ABOUT } from "./word";
import { NUMBER_LEVEL_ABOUT } from "./number";
import { levelsOf } from "./gameLevels";
import { LEVEL_LABEL, NORMAL, type Level } from "./levels";

const ABOUT: Readonly<Record<string, Partial<Record<Exclude<Level, "normal">, string>>>> = { ...WORD_LEVEL_ABOUT, ...NUMBER_LEVEL_ABOUT };

/** The line for one level ("" for Normal or none). */
export function levelAbout(type: string, level: Level): string {
  if (level === NORMAL) return "";
  return ABOUT[type]?.[level as Exclude<Level, "normal">] ?? "";
}

/** Every level the game offers beyond Normal, with its label and line (the help lists them). */
export function levelAbouts(type: string): { level: Exclude<Level, "normal">; label: string; about: string }[] {
  return levelsOf(type)
    .filter((l): l is Exclude<Level, "normal"> => l !== NORMAL)
    .map((level) => ({ level, label: LEVEL_LABEL[level], about: levelAbout(type, level) }))
    .filter((row) => row.about !== "");
}
