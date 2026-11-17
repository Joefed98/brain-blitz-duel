/**
 * The Retro text floor on screen (Joe, 15 Nov 2026): no Retro text is smaller than RETRO_SCREEN_MIN_PX on a 390 × 844
 * phone. Each world is drawn at the largest uniform scale that fits its arena box (ArcadeArenaSlot): 390 × 768 on that
 * phone (the 60 px header above, the 16 px strip below; docs/arena-sizes-oct-2026.md). A world wider than 390 or taller
 * than 768 draws smaller, so its text needs more world pixels to reach 11 on screen: Breaker and Rally (420 wide, 0.929)
 * 12, Wavefront (800 tall, 0.96) 12, Meteor (468 × 868, 0.833) 14. Smaller phones may go slightly under (Joe's rule).
 *
 * Pure: no canvas, no clock. Used by retro.renderer.ts (retroScreen sets the floor while a world draws), the success
 * layer's Retro pops and Blockzone's own text, and by retro-overhaul-check, which measures the result on screen.
 */
export const RETRO_SCREEN_MIN_PX = 11;
/** The arena box a world fits on a 390 × 844 phone. */
export const RETRO_PHONE_BOX = { width: 390, height: 768 } as const;

/** The uniform scale a world of this size draws at on a 390 × 844 phone. */
export function retroPhoneScale(worldW: number, worldH: number): number {
  if (!(worldW > 0) || !(worldH > 0)) return 1;
  return Math.min(RETRO_PHONE_BOX.width / worldW, RETRO_PHONE_BOX.height / worldH);
}

/** The smallest text size (world px) a world may draw so it is at least RETRO_SCREEN_MIN_PX on a 390 × 844 phone. */
export function retroTextFloorFor(worldW: number, worldH: number): number {
  return Math.max(RETRO_SCREEN_MIN_PX, Math.ceil(RETRO_SCREEN_MIN_PX / retroPhoneScale(worldW, worldH) - 1e-9));
}
