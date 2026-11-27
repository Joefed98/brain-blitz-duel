/**
 * The lever-picture slot (the polish plan's section 6.1, P2, 22 Nov 2026): what a level changes, as a small picture and
 * a few words, for a game's page (the large level and the row of four) and the reveal's step-up card.
 *
 * By default the slot draws the lever's words (from the families' own level lines: levelAbout, speedLevelLine,
 * levelNote, the Cards & Board text) in a quiet box; a game whose difficulty session added a picture draws that instead.
 * Pictures live one file a family in `./pictures/` (D1 to D6 add theirs; Breaker's, `./pictures/breaker.tsx`, is the
 * worked example), each file exporting `LEVER_PICTURES`: a map from game id to its picture entry (the component and,
 * if it wants, its own words) or to the component alone (the family's words are read). The files are read through `import.meta.glob` (never a bare side-effect import, CLAUDE.md); under Bun checks,
 * where Vite never runs, no file is found and every game draws its words. A picture is drawn from the level's own
 * settings (`GAME_LEVELS` or the family's table), never hand-made, so it cannot drift from the game.
 */
import type { ComponentType } from "react";

import { CARD_LEVEL_TEXT } from "./cardLevelText.data";
import { levelAbout } from "./levelAbout";
import { levelNote } from "./levelNotes";
import { LEVEL_LABEL, NORMAL, type Level } from "./levels";
import { speedLevelLine } from "./speedLevels";

/** How large a picture draws: `l` the game page's large level (about 320 × 180), `s` a level row's tile (about 72 × 44). */
export type LeverPictureSize = "l" | "s";

export interface LeverPictureProps {
  level: Level;
  size: LeverPictureSize;
}

/** One game's entry in a family's `LEVER_PICTURES`. */
export interface LeverPictureEntry {
  Picture: ComponentType<LeverPictureProps>;
  /** The lever in a few words ("9 rows of bricks"); left out, the family's level lines are read. */
  words?: (level: Level) => string;
}

export type LeverPictures = Partial<Record<string, LeverPictureEntry>>;

/**
 * What a family file may export for a game: an entry, or the picture component alone (the Number family's form, D2,
 * 22 Nov 2026), which draws the family's own words.
 */
export type LeverPictureExport = LeverPictureEntry | ComponentType<LeverPictureProps>;

/** A family file's export as an entry (a bare component becomes `{ Picture }`); anything else is skipped. */
export function leverEntryOf(value: unknown): LeverPictureEntry | null {
  if (typeof value === "function") return { Picture: value as ComponentType<LeverPictureProps> };
  if (value && typeof value === "object" && typeof (value as LeverPictureEntry).Picture === "function") return value as LeverPictureEntry;
  return null;
}

/** Every family file's pictures, keyed by game id (empty under Bun/Node, where Vite never runs). */
const FOUND: LeverPictures = (() => {
  const out: LeverPictures = {};
  try {
    const files = import.meta.glob("./pictures/*.tsx", { eager: true }) as Record<string, { LEVER_PICTURES?: Record<string, unknown> }>;
    for (const file of Object.values(files)) {
      for (const [type, value] of Object.entries(file.LEVER_PICTURES ?? {})) {
        const entry = leverEntryOf(value);
        if (entry) out[type] = entry;
      }
    }
  } catch {
    /* Not running under Vite (scripts/checks): every game draws its words. */
  }
  return out;
})();

/** Checks and the dev page only: pictures to use in place of the found files (a happy-dom render has no Vite). */
let extra: LeverPictures = {};
export function setLeverPicturesForChecks(pictures: Record<string, LeverPictureExport>): void {
  extra = {};
  for (const [type, value] of Object.entries(pictures)) {
    const entry = leverEntryOf(value);
    if (entry) extra[type] = entry;
  }
}

/** The game's picture entry, or null (it draws its words). */
export function leverPictureOf(type: string): LeverPictureEntry | null {
  return extra[type] ?? FOUND[type] ?? null;
}

/** "Easy: 8 targets up to 60, plus…" → "8 targets up to 60, plus…": a family line without its level's prefix. */
function withoutPrefix(text: string): string {
  return text.replace(/^(Easy|Normal|Hard|Expert)\s*[:,.–-]\s*/i, "").trim();
}

/** The first clause of a line: up to its first full stop or semicolon, and to its first comma when still long. */
function firstClause(text: string): string {
  const cut = text.split(/(?<=\S)[.;](?:\s|$)/)[0]!.trim();
  if (cut.length <= 44) return cut;
  const comma = cut.indexOf(", ");
  return comma > 12 ? cut.slice(0, comma) : cut;
}

/** The family's own line for a level, if it wrote one. */
function familyLine(type: string, level: Level): string {
  if (level === NORMAL) return "";
  const cards = level === "easy" || level === "hard" || level === "expert" ? CARD_LEVEL_TEXT[type]?.[level]?.how?.[0] : undefined;
  return levelAbout(type, level) || speedLevelLine(type, level) || levelNote(type, level) || cards || "";
}

/**
 * The lever in a few words: the game's picture file's own words, else the first clause of the family's level line; ""
 * when there is none (Normal without a picture file, or a family that wrote no lines).
 */
export function leverWords(type: string, level: Level): string {
  const own = leverPictureOf(type)?.words?.(level);
  if (own) return own;
  const line = familyLine(type, level);
  if (!line) return "";
  const clause = firstClause(withoutPrefix(line));
  return clause.charAt(0).toUpperCase() + clause.slice(1);
}

/**
 * The slot: the game's picture where its family added one, else the lever's words in a quiet box (the level's name
 * where there are no words). Always the same box for a size, so a row of four lines up.
 */
export function LeverPicture({ type, level, size }: { type: string; level: Level; size: LeverPictureSize }) {
  const entry = leverPictureOf(type);
  if (entry) {
    const { Picture } = entry;
    return (
      <span data-lever-picture={type} data-lever-kind="picture" data-size={size} className="lever-picture">
        <Picture level={level} size={size} />
      </span>
    );
  }
  const words = leverWords(type, level);
  return (
    <span data-lever-picture={type} data-lever-kind="words" data-size={size} aria-hidden="true" className="lever-picture lever-picture-words">
      <span className="lever-picture-text">{size === "s" ? LEVEL_LABEL[level] : words || LEVEL_LABEL[level]}</span>
    </span>
  );
}
