/**
 * The new game sounds (the November game reviews; docs/sound-cues/review-nov-2026.md): the files
 * scripts/sound-review-nov-2026/make.py synthesised for every game moment that had no sound of its own, and how each
 * takes its slot. Nothing here plays anything: with NEW_GAME_SOUNDS off (src/config/soundConfig.ts, the default) the
 * manifest never sees these files and every cue plays what it played before.
 *
 * With the switch on, src/lib/fx/manifest.ts calls applyNewGameSounds at load, so each slot below has its file:
 * - an arcade moment (`sfx` / `ensureSlotLoop` in gameSounds.ts) plays it in place of the library sound, as any slot
 *   with a file does (playSlotOr);
 * - a puzzle's named cue (the duelz-sound bridge in src/lib/sound.ts) plays it and leaves out the shared sound that
 *   moment played (REPLACES, the one-sound-a-moment rule in sound.ts: the `move` tick FeedbackStage plays for the
 *   draft, `correct` for Double Take's find).
 */
import { NEW_GAME_SOUND_RECORDINGS } from "./newGameSounds.data";

export { NEW_GAME_SOUND_RECORDINGS };

export interface NewGameSoundFile {
  url: string;
  ms: number;
  loop: boolean;
}

/** Each slot's new file (several slots may share one recording). */
export const NEW_GAME_SOUND_FILES: Readonly<Record<string, NewGameSoundFile>> = Object.fromEntries(
  NEW_GAME_SOUND_RECORDINGS.flatMap((r) =>
    r.slots.map((slot) => [slot, { url: `/sounds/${r.file}`, ms: r.ms, loop: r.loop }] as const),
  ),
);

/**
 * The shared sounds a puzzle's named cue plays over today (docs/sound-cues/puzzle-move-cues.md): once its new file
 * plays, these are left out for that moment. Arcade slots need none (their file replaces the library sound itself).
 */
const MOVE = ["move"] as const;
export const NEW_GAME_SOUND_REPLACES: Readonly<Record<string, readonly string[]>> = {
  "sudoku.place": MOVE,
  "tower.drop": MOVE,
  "tubes.pour": MOVE,
  "nonogram.fill": MOVE,
  "nonogram.mark": MOVE,
  "flood.spread": MOVE,
  "tents.pitch": MOVE,
  "tents.grass": MOVE,
  "shikaku.place": MOVE,
  "shikaku.remove": MOVE,
  "lightup.lamp": MOVE,
  "lightup.dot": MOVE,
  "trail.step": MOVE,
  "balance.drop": MOVE,
  "balance.lift": MOVE,
  "equation.drop": MOVE,
  "numpyramid.place": MOVE,
  "measure.pour": MOVE,
  "measure.fill": MOVE,
  "measure.empty": MOVE,
  "measure.reset": MOVE,
  // Ballpark's pin plays the tap's tick, place and move today.
  "numline.place": ["tick", "place", "move"],
  "pipes.rotate": MOVE,
  "iceslide.slide": MOVE,
  "push.step": MOVE,
  "push.push": MOVE,
  "laser.place": MOVE,
  "laser.turn": MOVE,
  "laser.fire": MOVE,
  "symscan.mark": MOVE,
  "symscan.unmark": MOVE,
  // Double Take's find played the generic correct.
  "spotdiff.found": ["correct"],
  "bomb.press": MOVE,
  // The Word overhaul's key press: the click takes the place of the draft's move tick (a hit still plays its place).
  "strikeout.key": MOVE,
  "codeword.key": MOVE,
};

/** Sets every new slot's file on the manifest's entries (manifest.ts, only with NEW_GAME_SOUNDS on; and checks). */
export function applyNewGameSounds(entries: Record<string, { url: string | null; ms: number }>): void {
  for (const [slot, file] of Object.entries(NEW_GAME_SOUND_FILES)) {
    const entry = entries[slot];
    if (!entry) continue;
    entry.url = file.url;
    entry.ms = file.ms;
  }
}
