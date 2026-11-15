/**
 * Notes never count as mistakes (15 Nov 2026, the Logic game reviews, docs/design/game-reviews/logic.md "Notes count
 * as mistakes"). Five games cycle a tap through the scored mark on the way to a note: Mosaic (fill → × → empty), Tents
 * and Trees (tent → grass → empty), Lamplighter (lamp → dot → empty), Loopline (line → ✕ → empty) and Island Link
 * (removing a bridge by drag goes 1 → 2 → none). Their clean bonus counted every wrong scored mark the draft timeline
 * ever held, so writing a note on an empty square cost 2.5.
 *
 * On `notesRev 1` a wrong scored mark the very next move cycles on (into the note, or Island Link's double into none)
 * with nothing else changed is passed through, and costs nothing; a wrong mark the player leaves while doing anything
 * else still counts, as before. Notes themselves were never scored marks. Mosaic, Tents and Lamplighter's drafts carry
 * only the scored marks (their notes are the phone's own), and none of the three has an Undo, so "the next move takes it
 * away with nothing else changed" is exactly the tap that cycles it to its note. The phone shows no mistakes count for
 * any of them, so the server's grade (gradeAnswer: practice, rooms, rated, the Daily, tournaments) is the one place.
 *
 * Dealt over the standard's stamp (DEAL_LAYERS, generate.server.ts); `pinPreNotesFree(true)` deals without it for
 * checks written before. Older puzzles grade exactly as before. Shared by phone and server, pure.
 */
import { dealPinned, setDealPin } from "./dealEra";
import type { PuzzleData, PuzzleType } from "./types";
import { usesStandard } from "./standard/stamps";

export const NOTES_FREE_REV = 1;

/** The games the rule covers when their puzzle carries notesRev 1. */
export const NOTES_FREE_TYPES: readonly PuzzleType[] = ["nonogram", "tents", "lightup", "fences", "bridges"];

/** The games dealt notesRev 1: all five (Mosaic, Tents and Lamplighter switched on with Joe's approval, 15 Nov 2026). */
export const NOTES_FREE_DEALT: readonly PuzzleType[] = NOTES_FREE_TYPES;

/** Checks written for the stamps before this pin new deals to them (returns the previous setting). */
export function pinPreNotesFree(on: boolean): boolean {
  return setDealPin("preNotesFree", on);
}

/** True for a stored puzzle graded with notes free. */
export function usesNotesFree(puzzle: PuzzleData | null | undefined): boolean {
  if (!puzzle || !(NOTES_FREE_TYPES as readonly string[]).includes(puzzle.type)) return false;
  const v = (puzzle as { notesRev?: unknown }).notesRev;
  return typeof v === "number" && v >= NOTES_FREE_REV && usesStandard(puzzle);
}

/** The stamp a new puzzle is dealt: notesRev 1 on the standard's stamp, unchanged otherwise or while pinned. */
export function dealNotesFree<T extends PuzzleData>(puzzle: T): T {
  if (dealPinned("preNotesFree") || !(NOTES_FREE_DEALT as readonly string[]).includes(puzzle.type)) return puzzle;
  if (!usesStandard(puzzle) || (puzzle as { notesRev?: unknown }).notesRev !== undefined) return puzzle;
  return { ...puzzle, notesRev: NOTES_FREE_REV };
}

/**
 * Distinct wrong keys across a timeline's drafts, leaving out a key held only in one draft that the very next draft
 * cycles on (`cycledOn(cur, next, key)`: the item moved to its note, or the next state of its cycle, and nothing else
 * changed). The draft before the first is the empty board ("").
 */
export function leftWrongKeys(
  drafts: readonly { draft: string }[],
  wrongKeys: (draft: string) => readonly string[],
  cycledOn: (cur: string, next: string, key: string) => boolean,
): number {
  const keys = drafts.map((d) => new Set(wrongKeys(d.draft)));
  const before = new Set(wrongKeys(""));
  const seen = new Set<string>();
  keys.forEach((now, i) => {
    const prev = i === 0 ? before : keys[i - 1]!;
    const next = keys[i + 1];
    for (const k of now) {
      if (seen.has(k)) continue;
      const passed = next !== undefined && !prev.has(k) && !next.has(k) && cycledOn(drafts[i]!.draft, drafts[i + 1]!.draft, k);
      if (!passed) seen.add(k);
    }
  });
  return seen.size;
}

/** Comma-list drafts (Mosaic, Tents, Lamplighter): the next draft is this one less exactly `cell`. */
export function listLessOne(decode: (draft: string) => readonly number[]) {
  return (cur: string, next: string, key: string): boolean => {
    const cell = Number(key);
    const a = new Set(decode(cur));
    const b = new Set(decode(next));
    if (!a.has(cell) || b.has(cell) || b.size !== a.size - 1) return false;
    for (const c of b) if (!a.has(c)) return false;
    return true;
  };
}
