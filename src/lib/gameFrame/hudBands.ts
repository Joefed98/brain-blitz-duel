/**
 * The HUD band each arcade game gives back to its board on the arena (P4, desktop size PR 1, 27 Nov 2026;
 * docs/desktop-support.md "The HUD row given back"). With ARENA_HUD_IN_PANEL on, the shared HUD painters draw nothing in
 * the world on a computer, so the strip at the top of the world they used holds only backdrop; ArcadeArenaSlot sizes the
 * world as if that strip were not there and draws it that much higher, out of view, so the board grows (Gemstone also
 * its foot, where its goals panel moves into the side panel). Display only: the world, its drawing and its pointer
 * mapping are unchanged, and nothing here reaches a sim, a deal or a score.
 *
 * Each band is the strip from the world's top (world units) that, on the stamp named, holds no play at any moment of
 * a run: nothing the player controls, hits, collects or must see, nor anything still drawn in the world with the HUD
 * in the panel (lives icons, Tempo's fever meter). Measured from each game's constants (the play area's top wall,
 * board, well or table, and the highest any piece or effect that matters can be drawn), smaller where unsure.
 * hud-bands-check fails when a game is dealt on another stamp than the one its band was measured on, so a new stamp is
 * measured again before it can be cut. A game missing here keeps its whole world: play reaches the top (Hover,
 * Wavefront, Orbit, Rainbow Bridge, Moon Climb, Ball Tracker's marble queue), High Rise's crane cable runs to the top,
 * Iron Wall's crosshair can go anywhere, and Fission's lives ships sit at the very top. Retired games are never played.
 */
import type { PuzzleType } from "@/lib/duel/types";

export interface HudBand {
  /** World units cut from the top. */
  top: number;
  /** World units cut from the foot (Gemstone's goals panel; Tilt's empty table under its disc). */
  bottom?: number;
  /** The stamp the band was measured on: its field in the dealt puzzle and its value. */
  stamp: readonly [field: string, value: number];
}

export const HUD_BANDS: Partial<Record<PuzzleType, HudBand>> = {
  // Meteor: the board from SNAKE_BOARD_Y = SNAKE_HUD_H = 44; play is clipped to it.
  snake: { top: 44, stamp: ["snakeRev", 16] },
  // Breaker: the top wall line at 50 (the ball turns at 52), bricks from 70.
  breaker: { top: 50, stamp: ["brkRev", 13] },
  // Rally: the lives balls at 29..39 stay in the world; the pads' glow from 28.
  rally: { top: 28, stamp: ["rallyRev", 14] },
  // Tempo: the fever meter (a tap target, drawn at 22..42) stays in the world; notes from 44.
  beat: { top: 20, stamp: ["beatRev", 13] },
  // Pinball: the table's arch from about 37.
  pinball: { top: 36, stamp: ["pinRev", 9] },
  // Spacewalk: the helmets at 23..33 stay in the world; the astronaut's head on the goal deck reaches 31.
  cross: { top: 22, stamp: ["crossRev", 13] },
  // Blockzone: the well at 44, its soft glow from 36.
  blockfall: { top: 36, stamp: ["blockfallRev", 2] },
  // Coral Pop: the rock ledge's lip from 67, bubbles from 72.
  bubble: { top: 64, stamp: ["bubbleRev", 12] },
  // Gemstone: the board's tray from about 26.5 (shown, after its 1.055× zoom); its goals panel (shown 624.7..702.8)
  // moves into the side panel, the GOAL! / TREASURE! banners (about 610..625) kept.
  matchup: { top: 26, bottom: 95, stamp: ["matchupRev", 14] },
  // Tilt: the disc (fitted to the width, centred at 410, radius 217) with its rim's ticks spans about 181..639; the words
  // strip (TILT_X_TEXT_Y = 140) is kept above it, and the empty table under the disc is cut too.
  tilt: { top: 118, bottom: 175, stamp: ["tiltRev", 13] },
  // Roofbound: the cave's roof never above 152.5.
  flip: { top: 150, stamp: ["flipRev", 13] },
  // Grappler: the cave's ceiling (a collision line) from 40, its lit lip from 38.
  swing: { top: 36, stamp: ["swingRev", 19] },
  // Minefield: the board's frame from 44.
  minesweeper: { top: 44, stamp: ["minesRev", 3] },
  // Mahjong: the board at 76, a top-layer tile from 58, a matched pair lifting to 48.
  mahjong: { top: 48, stamp: ["mahjongRev", 2] },
  // The card games: their tables' top rows (a card dragged to the very top shows clipped while held).
  freecell: { top: 44, stamp: ["freecellRev", 6] },
  tripeaks: { top: 54, stamp: ["tripeaksRev", 4] },
  fivehands: { top: 44, stamp: ["fiveHandsRev", 4] },
  pyramid: { top: 46, stamp: ["pyramidRev", 4] },
};

/** The band a game gives back (none: undefined). */
export function hudBandFor(type: PuzzleType | undefined): HudBand | undefined {
  return type ? HUD_BANDS[type] : undefined;
}
