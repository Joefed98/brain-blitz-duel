/**
 * The shared sounds a puzzle's own cue stands in for, for the slots wired straight to Joe's recordings on 18 Nov 2026
 * (scripts/sound-wiring-nov18/wire.ts; the slots the sound batches marked "to add"): as NEW_GAME_SOUND_REPLACES does for
 * the switch's files (src/lib/fx/newGameSounds.ts), so each moment is one sound. src/lib/sound.ts's ownMomentReplaces
 * reads both. Presentation only.
 */
const MOVE = ["move"] as const;
export const WIRED_SOUND_REPLACES: Readonly<Record<string, readonly string[]>> = {
  // Box Six: several lines at once plays in sudoku.line's place (MOVE); a digit cleared.
  "sudoku.combo": MOVE,
  "sudoku.clear": MOVE,
  // Polypotions: a refused pour (the quiet wrong), Reset.
  "tubes.wrong": ["wrong"],
  "tubes.reset": MOVE,
  // Hanoi: an illegal drop refused, Undo, Reset.
  "tower.illegal": [],
  "tower.undo": MOVE,
  "tower.reset": MOVE,
  // Colour Flood: 20+ squares in flood.spread's place (MOVE); the current colour tapped.
  "flood.combo": MOVE,
  "flood.reject": [],
  // Mosaic: two lines at once in nonogram.line's place (MOVE).
  "nonogram.combo": MOVE,
};
