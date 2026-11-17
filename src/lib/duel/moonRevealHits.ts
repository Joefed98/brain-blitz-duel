/**
 * Moon Climb's hits on the reveal (the Action overhaul, 15 Nov 2026; display only, no stamp, the score unchanged):
 * the review found hits cost almost nothing a player could see (a Near-perfect run took 11 and scored 191), and the
 * reveal showed them only as a fifth stat that the card's four-stat limit dropped. Now they read as one plain line in
 * the breakdown, under the parts: "Hits: 11 · knocked down 3 m each" ("Hits: none" for a clean climb). Read from the
 * run's stored "Hits" stat (every ricoRev 3 reveal stores it), so rounds graded before this show it too.
 *
 * Kept free of the sim (the reveal's chunk stays small): ricochet-overhaul-check proves the two constants match
 * MOON_REV and NINJA_KNOCK / NINJA_PX_PER_M.
 */
import type { ArcadeRevealData } from "@/lib/arcade/reveal";

/** Moon Climb's stamp (MOON_REV in ricochetNinja.ts). */
export const MOON_HITS_REV = 3;
/** Metres a hit knocks the ninja down (NINJA_KNOCK px ÷ NINJA_PX_PER_M). */
export const MOON_HIT_KNOCK_M = 3;

/** The reveal's hits line for a Moon Climb run, or null for any other game, stamp or a reveal with no hits stat. */
export function moonHitsLine(puzzle: { type: string; ricoRev?: unknown }, tiles: ArcadeRevealData["tiles"]): string | null {
  if (puzzle.type !== "ricochet" || typeof puzzle.ricoRev !== "number" || puzzle.ricoRev < MOON_HITS_REV) return null;
  const tile = tiles.find((t) => t.label === "Hits");
  if (!tile) return null;
  const hits = Number(tile.value);
  if (!Number.isFinite(hits) || hits < 0) return null;
  return hits === 0 ? "Hits: none" : `Hits: ${hits} · knocked down ${MOON_HIT_KNOCK_M} m each`;
}
