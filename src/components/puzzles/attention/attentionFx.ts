/**
 * The Attention overhaul's moments (stage 2, 15 Nov 2026; docs/design/attention-overhaul.md "Effects"): presentation
 * only. Restraint: every moment confirms a tap on the piece that was tapped, with a small, quiet sound; one proper moment
 * at the end. Movement goes through the shared effects kit (`gameFx`, src/lib/fx/kit.ts), which handles reduced motion,
 * the calm and lite variants and haptics; sounds go through each moment's own slot (src/lib/fx/manifest.ts), which
 * plays the library sound named here until Joe's recording is set (docs/sound-cues/attention-elevenlabs.md).
 * Nothing here reads or writes an answer, a clock or a score.
 */
import { demoHushed, playSlotOr } from "@/lib/sound";
import type { SoundId } from "@/lib/fx/manifest";

/** Each new slot and the library sound it plays until its own file lands. */
export const ATTENTION_SOUND_FALLBACKS = {
  "countup.mark": "tick",
  "countup.unmark": "tick",
  "countup.key": "tick",
  "countup.trayOut": "move",
  "countup.revealTick": "tick",
  "countup.soClose": "lock",
  "symscan.gridClear": "symscan.takeoff",
  "symscan.cleanGrid": "stage_complete",
  "symscan.missed": "tick",
  "spotdiff.found": "correct",
  "spotdiff.miss": "wrong",
  "spotdiff.hidden": "stage_complete",
  "spotdiff.pictureOut": "spotdiff.nextPicture",
  "maze.step": "move",
  "maze.bump": "wrong",
  "maze.back": "tick",
  "maze.deadEnd": "lock",
  "bomb.step": "tick",
  "bomb.press": "lock",
  "pairmatch.flip": "move",
  "pairmatch.match": "correct",
  "pairmatch.miss": "wrong",
  "pairmatch.gold": "pairmatch.cardWave",
} as const satisfies Record<string, SoundId>;

export type AttentionSound = keyof typeof ATTENTION_SOUND_FALLBACKS;

/**
 * Plays a moment's own sound (or its library stand-in) quietly. `rate` pitches it (a junction step a little higher, a
 * count tick rising); `volume` keeps the routine taps soft. Silent in a hushed intro demo.
 */
export function attnSound(slot: AttentionSound, { rate = 1, volume = 0.7 }: { rate?: number; volume?: number } = {}): void {
  if (demoHushed()) return;
  playSlotOr(slot as SoundId, ATTENTION_SOUND_FALLBACKS[slot] as SoundId, volume, rate, true);
}
