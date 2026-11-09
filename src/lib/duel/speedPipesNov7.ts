/**
 * Flash, Bang On and Pipeline partial credit (7 Nov 2026, docs/speed-pipes-scoring-nov-2026.md; audit issues 9 and 18).
 *
 *   - Flash and Bang On deal `tapRev 7` (TAP_REV_PER_ITEM, tapLog.ts): each flash and each watch scores on its own on
 *     tapRev 6's curve (a miss 0) and the run's curve part is their average, so k of n good items is about k/n of the
 *     full run's; everything else (the steady hand, false starts, dead centre, the zone streak, the floor) is tapRev 6's.
 *     Ascend keeps its own tapRev (5, the standard's 6).
 *   - Pipeline deals `pipesRev 4` (PIPES_REV_PLACED): unfinished credit counts the tiles turned into their solved
 *     orientation, less those turned out of it (the tiles already right at the deal count for nothing either way), in
 *     place of the tiles joined to the source.
 *
 * Every older stamp deals, grades and reads exactly as before. Checks written for the stamps before pin new deals to
 * them with `pinPreNov7(true)`. Shared by phone and server, pure.
 */
import { dealPinned, setDealPin } from "./dealEra";

/** Flash and Bang On: each flash / watch scored on its own, the points averaged. */
export const TAP_REV_PER_ITEM = 7;
/** Pipeline on the scoring standard (pipesRev 3, standard/stamps.ts): what pipesRev 4 is dealt over. */
export const PIPES_REV_STANDARD = 3;
/** Pipeline: unfinished credit by tiles turned into their solved orientation. */
export const PIPES_REV_PLACED = 4;

/** Checks written for the stamps before 7 Nov 2026 deal them (tapRev 6, pipesRev 3); returns the previous setting. */
export function pinPreNov7(on: boolean): boolean {
  // The help and intro texts (liveRecord) follow it: setDealPin rebuilds them (dealEra.ts).
  return setDealPin("preNov7", on);
}

export function preNov7Pinned(): boolean {
  return dealPinned("preNov7");
}

/** Pipeline: pipesRev 4 over the standard's pipesRev 3 (any other stamp, or with the pin, unchanged). */
export function dealPipesPlaced<T extends { type: string }>(puzzle: T): T {
  if (dealPinned("preNov7") || puzzle.type !== "pipes") return puzzle;
  if ((puzzle as { pipesRev?: number }).pipesRev !== PIPES_REV_STANDARD) return puzzle;
  return { ...puzzle, pipesRev: PIPES_REV_PLACED };
}

/** True for a Pipeline puzzle graded on the placed tiles. */
export function usesPipesPlaced(puzzle: unknown): boolean {
  const p = puzzle as { type?: string; pipesRev?: number } | null;
  return p?.type === "pipes" && (p.pipesRev ?? 0) >= PIPES_REV_PLACED;
}
