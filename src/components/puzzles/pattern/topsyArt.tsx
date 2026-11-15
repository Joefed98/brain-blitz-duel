/**
 * Topsy-Turvy's rendered art (the Pattern overhaul, 15 Nov 2026, look A; presentation only): grey stone blocks, a dark
 * slate floor, a glossy glass marble per ball colour, a cup rimmed in each ball's colour and the tray frame, rendered in
 * Blender (docs/design/game-art/pattern/source/gravity.py, public/pattern-art/gravity/). Each image sits inside the box
 * the board already gave its piece (a cell, a hole, a ball), so nothing it draws changes a square, a roll or a tilt.
 * The balls' and holes' marks stay vector, drawn over the sprites, so a colour is never the only cue.
 */
export const TOPSY_ART_BASE = "/pattern-art/gravity";

/** The sprite colour names, in ball order (topsyBoard.tsx TOPSY_COLOURS: gold, teal, purple, pink, blue, orange). */
export const TOPSY_ART_COLOURS = ["yellow", "teal", "purple", "pink", "blue", "orange"] as const;

export function topsyMarbleUrl(index: number): string {
  return `${TOPSY_ART_BASE}/marble-${TOPSY_ART_COLOURS[index % TOPSY_ART_COLOURS.length]}.webp`;
}
export function topsyHoleUrl(index: number): string {
  return `${TOPSY_ART_BASE}/hole-${TOPSY_ART_COLOURS[index % TOPSY_ART_COLOURS.length]}.webp`;
}
export const TOPSY_BLOCK_URL = `${TOPSY_ART_BASE}/block.webp`;
export const TOPSY_FLOOR_URL = `${TOPSY_ART_BASE}/floor.webp`;
export const TOPSY_FRAME_URL = `${TOPSY_ART_BASE}/frame.webp`;

/** Every sprite the board draws (checks: each exists as a WebP with alpha). */
export const TOPSY_SPRITES: readonly string[] = [
  ...TOPSY_ART_COLOURS.map((_, i) => topsyMarbleUrl(i)),
  ...TOPSY_ART_COLOURS.map((_, i) => topsyHoleUrl(i)),
  TOPSY_BLOCK_URL,
  TOPSY_FLOOR_URL,
  TOPSY_FRAME_URL,
];

/** The marble image (the sphere is 88 of the image's 108 points across; topsy.css sizes it to the ball's box). */
export function TopsyMarble({ index, className = "topsy-marble" }: { index: number; className?: string }) {
  return <img className={className} src={topsyMarbleUrl(index)} alt="" aria-hidden="true" draggable={false} />;
}

/** The rimmed cup in the ball's colour (fills the hole's box). */
export function TopsyCup({ index }: { index: number }) {
  return <img className="topsy-cup" src={topsyHoleUrl(index)} alt="" aria-hidden="true" draggable={false} />;
}
