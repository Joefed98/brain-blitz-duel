/**
 * The HUD band each arcade game gives back to its board on the arena (P4, desktop size PR 1, 27 Nov 2026;
 * docs/desktop-support.md "The HUD row given back"). With ARENA_HUD_IN_PANEL on, the shared HUD painters draw nothing in
 * the world on a computer, so the strip at the top of the world they used holds only backdrop; ArcadeArenaSlot sizes the
 * world as if that strip were not there and draws it that much higher, out of view, so the board grows (Gemstone also
 * its foot, where its goals panel moves into the side panel). Display only: the world, its drawing and its pointer
 * mapping are unchanged, and nothing here reaches a sim, a deal or a score.
 *
 * Each band is the strip from the world's top (world units) that, on the stamps named, holds nothing the game draws
 * with the HUD in the panel, at any moment of a run at any level: only the backdrop. hud-bands-check proves it (28 Nov
 * 2026): it replays every recorded run of the game on those stamps, and bot runs at every level, draws each second of
 * them with the game's own renderer at the tablet's and the computer's arena sizes, and fails if any draw but the
 * full-width backdrop reaches into the band (a pixel counts from 8 of 255 visible). It also fails when a level is
 * dealt on a stamp not listed, so a new stamp is measured again before it can be cut.
 *
 * Measured and left whole (28 Nov 2026): Rally (the ball's glow and the pads), Tempo (hold-note tails come in from the
 * top), Coral Pop (its rock ledge), Roofbound (the runner and its crash shards), Grappler (the canopy, the darkness and
 * the streak meter), Spacewalk and Minefield (their success effects) reach the world's top; Blockzone's well glow (18)
 * and Thirteen's cards (15.6) leave too little to cut; and Free Cell, Summit and Five Hands drag a card wherever the
 * pointer goes. Never measured, as play reaches the top: Hover,
 * Wavefront, Orbit, Rainbow Bridge, Moon Climb and Ball Tracker's marble queue; High Rise's crane cable runs to the top,
 * Iron Wall's crosshair can go anywhere, and Fission's lives ships sit at the very top. Retired games are never played.
 */
import type { PuzzleType } from "@/lib/duel/types";

export interface HudBand {
  /** World units cut from the top (0: none, a foot band only). */
  top: number;
  /** World units cut from the foot (Gemstone's goals panel; Tilt's empty table under its disc). */
  bottom?: number;
  /** The stamps the band was measured on: its field in the dealt puzzle and the values every level deals. */
  stamp: readonly [field: string, ...values: number[]];
}

export const HUD_BANDS: Partial<Record<PuzzleType, HudBand>> = {
  // Each band: hud-bands-check's highest draw (lowest, for a foot band) on 28 Nov 2026, effects playing as on screen,
  // less 3 units because it draws a frame every half second, and never more than first measured from the constants.
  // Meteor: a star's pop flies up to 23.9 (the board itself from SNAKE_BOARD_Y = 44).
  snake: { top: 20, stamp: ["snakeRev", 16] },
  // Breaker: the ball's glow and a brick's burst reach 31.1.
  breaker: { top: 28, stamp: ["brkRev", 13] },
  // Pinball: a bumper's glow reaches 23.1.
  pinball: { top: 20, stamp: ["pinRev", 9] },
  // Gemstone: the foot only, where its goals panel moves to the side panel; the PAR SMASHED! banner comes down to 91.7
  // from the foot. Its top is reached by the success flash and particles.
  matchup: { top: 0, bottom: 88, stamp: ["matchupRev", 14] },
  // Tilt: a marble's success burst flies up to 78.6; the empty table under the disc, 190.2 from the foot.
  tilt: { top: 75, bottom: 175, stamp: ["tiltRev", 13] },
  // Mahjong: a matched pair lifting to 42.3.
  mahjong: { top: 39, stamp: ["mahjongRev", 2, 3] },
};

/**
 * How much of the world is cut, in world units from its top and foot: the band, only when the screen draws the HUD
 * in the side panel (`on`: the arena, ARENA_HUD_IN_PANEL, the panels showing). The one rule ArcadeArenaSlot (the
 * cut), ArcadeCanvasStage and the arena's own-loop HUD wrapper (the effects' visible frame) all read.
 */
export function hudCut(on: boolean, band: HudBand | undefined, worldH = Infinity): { top: number; bottom: number } {
  if (!on || !band) return { top: 0, bottom: 0 };
  return { top: Math.min(band.top, worldH / 3), bottom: Math.min(band.bottom ?? 0, worldH / 3) };
}

/** The band a game gives back (none: undefined). */
export function hudBandFor(type: PuzzleType | undefined): HudBand | undefined {
  return type ? HUD_BANDS[type] : undefined;
}
