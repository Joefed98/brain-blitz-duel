/**
 * The Retro games' levels (the Retro overhaul, stage 3, 16 Nov 2026; docs/design/retro-overhaul.md "Levels"): each
 * game's settings at Easy, Hard and Expert, as plain data. The level registry (src/lib/levels/gameLevels.ts) lists them
 * as each game's `settings`; the sims read them from the run's state (`lv`), put there at init by `withRetroLevel`.
 *
 * Normal is never in a table: it is the game rooms deal today (the stamp's own constants), so a Normal run's state has
 * no `lv` and plays, replays and scores exactly as before. A level's run carries `lv` from its first tick; the deal
 * stamps the level on the puzzle (`level`), and every place that builds a Retro game from a stored puzzle (the stage, the
 * server's replay, the phone's replay, the bots) passes `puzzleLevel(puzzle)` to the game's `…GameFor(rev, level)`.
 *
 * Pure data and one pure wrapper: no canvas, no clock, no game code.
 */
import type { Level } from "@/lib/levels/levels";

/** Breaker (brkRev 12): the ball's speed (per cent of Normal's start and cap), the paddle's width (px), the wall's rows
 * (7: two middle rows left out; 9: Normal's, every level today), at most two hits a brick (`cap2` 1), and how many rows
 * from the top take one hit more (at most three). */
export interface BreakerLv {
  speedPct: number;
  paddle: number;
  rows: number;
  cap2: number;
  toughRows: number;
}
/** Rally (rallyRev 13): blue-ball lives, the paddle's start and narrowest width (px), the ball's top speed (per cent of
 * Normal's cap), the two bumpers' arrival (seconds) and the gold-ball hits the core is full at (Normal's 23). */
export interface RallyLv {
  lives: number;
  fullAt: number;
  paddleStart: number;
  paddleMin: number;
  capPct: number;
  bumper1S: number;
  bumper2S: number;
}
/**
 * Rally (rallyRev 14, D5's ladder, 23 Nov 2026; docs/arcade-standard/rally.md "Levels (D5, 23 Nov 2026)"): rallyRev 13's
 * settings (the lever is the paddle's width; a bumper time past the 60 s run, 99, means no bumper at all, 0 that it is on
 * court from the first serve), then the level's scoring lines: pink pads full at `padsFull` strikes, gold targets at
 * `targetsFull`, spin shots at `spinFull` (Normal's lines: rally.ts RALLY_V14_LINES).
 */
export interface RallyLv14 extends RallyLv {
  padsFull: number;
  targetsFull: number;
  spinFull: number;
}
/** Wavefront (wavRev 15): lives (Normal 3) and the enemy bolts' speed, at the start and at its top (it rises a step each
 * wave, so it builds through the run), as a per cent of Normal's; the final boss's hit points (per cent of Normal's)
 * and the boss kill time the speed part is full by (seconds; Normal 20). */
export interface WavefrontLv {
  lives: number;
  boltPct: number;
  bossPct: number;
  killS: number;
}
/**
 * Wavefront wavRev 16's levels (D5, 23 Nov 2026; docs/arcade-standard/wavefront.md "Levels (D5, 23 Nov 2026)"): the
 * headline lever is the enemy bolts in the air. On top of wavRev 15's four settings: the bolts each volley carries from
 * wave 1 (`volley`), one more from wave `upFrom` (0: never) on one volley in `upOdds` (1: every volley), the bolts in
 * the air at most (`maxRed`, the boss's included; Normal 10), the wave the divers start (`diveFrom`, 0: none; Normal 3)
 * and the wave two dive at once from (`diveTwoFrom`; Normal 4), and each level's own full lines for the saucers (of the 5
 * a run flies; Normal 4) and the cannons and weak points (of 6; Normal 5). wavRev 15 keeps WAVEFRONT_LEVELS exactly.
 */
export interface WavefrontLvWide extends WavefrontLv {
  volley: number;
  upFrom: number;
  upOdds: number;
  maxRed: number;
  diveFrom: number;
  diveTwoFrom: number;
  saucersFull: number;
  weakFull: number;
}
/** Fission (burstRev 13 and 14): lives, the atoms' size (per cent), the quick-clear time per wave (per cent of Normal's) and
 * the wasted beams that cost nothing (Normal: 20, or one an atom popped if more). */
export interface BurstLv {
  lives: number;
  sizePct: number;
  quickPct: number;
  freeWhiffs: number;
}
/**
 * Fission burstRev 14's levels (D5, 23 Nov 2026; docs/arcade-standard/burst.md "Levels (D5, 23 Nov 2026)"): the headline
 * lever is the atoms in each wave. On top of burstRev 13's four settings: the five waves' atoms by size (`waves`, each
 * wave its spawns, 0 L, 1 M, 2 S, 3 XS; the sides come from the seed as Normal's do), and each level's own full lines: the
 * atoms popped the core is full at (`coreFull`, of the level's own count), the wave-clear points the wave-clears part is
 * full at (`clearFull`, of the 35 the five waves can pay; Normal 19) and the golden atoms the golden part is full at
 * (`goldFull`, of 5; Normal 2). burstRev 13 keeps BURST_LEVELS exactly.
 */
export interface BurstLvSmall extends BurstLv {
  waves: readonly (readonly number[])[];
  coreFull: number;
  clearFull: number;
  goldFull: number;
}
/** Tempo (beatRev 12): the hit windows (Perfect, Good, OK, ticks either side), the notes' fall time on screen (ticks
 * from the top of the lane to the hit line; Normal's 90) and the chart's busyness: each section's off-beat (eighth) and
 * chord shares as a per cent of Normal's (the chart is built from the seed with the scaled plan).
 *
 * beatRev 13 (D5's ladder, 23 Nov 2026) adds the lanes and the level's own full lines (BeatLv13); a beatRev 12 level's
 * row has none of them, so it plays, replays and scores exactly as before. */
export interface BeatLv {
  perfect: number;
  good: number;
  ok: number;
  fall: number;
  eighthPct: number;
  chordPct: number;
  /** beatRev 13 only: the lanes for the whole song (Normal: four, then five from 40 s). */
  lanes?: number;
  /** beatRev 13 only: the accuracy (per mille of the chart) the Accuracy part is full at (Normal 1,000: every note Perfect). */
  accFull?: number;
  /** beatRev 13 only: the fevers the Fever part is full at (Normal 4). */
  feversFull?: number;
  /** beatRev 13 only: golden notes full at this many in every nine the chart deals (Normal 5). */
  goldNinths?: number;
  /** beatRev 13 only: the Perfect streak full at this share of the song's notes, per cent (Normal 70). */
  streakPct?: number;
}
/** Tempo's beatRev 13 levels: every field set. */
export type BeatLv13 = Required<BeatLv>;
/** Meteor (snakeRev 15 and 16): lives (crashes forgiven = lives − 1; Normal 2), the step speed (ticks a square at the start
 * and the fastest; Normal 9 and 4, one tick faster every few stars, so it speeds up through the run) and whether the
 * edges are walls (1) instead of wrapping (0, Normal), and the core stars the stars part is full at (Normal's 36). */
export interface SnakeLv {
  lives: number;
  stepStart: number;
  stepMin: number;
  walls: number;
  fullAt: number;
}
/**
 * Meteor (snakeRev 16, D5's ladder, 23 Nov 2026; docs/arcade-standard/snake.md "Levels (D5, 23 Nov 2026)"): snakeRev 15's
 * settings, then the lever, rocks on the field: how many lie on the field from the first tick (`rocksAtStart`), the timed
 * rocks after them (one every `rockEvery` s from `rockFrom` s, falling whatever the comet's length; 0: none), the most
 * rocks a run holds (`rockMax`, the shower's apart) and the meteor shower (1 on, 0 off). Then the level's scoring lines:
 * the gold stars' part is full at `goldPct` % of all the gold stars' worth, combos at `comboFull` combo stars, lane rides
 * at `laneFull` rides, warp stars at `warpFull` points (Normal's lines: snake.ts SNAKE_V16_LINES).
 */
export interface SnakeLv16 extends SnakeLv {
  rocksAtStart: number;
  rockEvery: number;
  rockFrom: number;
  rockMax: number;
  shower: number;
  goldPct: number;
  comboFull: number;
  laneFull: number;
  warpFull: number;
}
/** Spacewalk (crossRev 13): the traffic's density per crossing (twelfths of crossRev 9's, building through the run; the
 * last entry holds on; Normal's CROSS_V13_DENSITY_12), lives (Normal 3), the cost of a hit before the last (Normal 15)
 * and the rows-and-crossings figure the core is full at (Normal 76). */
export interface CrossLv {
  density: readonly number[];
  lives: number;
  hitCost: number;
  fullAt: number;
}
/** Pinball (pinRev 8): balls (Normal 3), the ball save's seconds after each launch (0: none, Normal), gravity (per cent of
 * Normal), the multiball's seconds (Normal 20) and the table points the core is full at (Normal 61,000). */
export interface PinballLv {
  balls: number;
  saveS: number;
  gravityPct: number;
  multiS: number;
  fullAt: number;
}
/** Blockzone (blockfallRev 2): gravity (per cent of Normal's fall time a row: higher is slower), the lock delay (ticks)
 * and the previews shown. */
export interface BlockfallLv {
  gravityPct: number;
  lockDelay: number;
  previews: number;
  /** The lines the core is full at (Normal's 51). */
  fullAt: number;
  /** blockfallRev 3 only: the low stack's rows for all of its points and from which it pays nothing (Normal 4 and 10). */
  lowFull?: number;
  lowZero?: number;
}
/** Hover (hoverRev 11): the starting shield (1: the first crash is forgiven, Normal), the gaps' height (per cent of the
 * course's own, widened only, so every proved course stays passable) and the scroll's pace (per cent of Normal's, which
 * still speeds up barrier by barrier through the run). */
export interface HoverLv {
  shield: number;
  gapPct: number;
  scrollPct: number;
}

type Table<S> = Readonly<Record<Exclude<Level, "normal">, S>>;

export const BREAKER_LEVELS: Table<BreakerLv> = {
  easy: { speedPct: 108, paddle: 100, rows: 9, cap2: 1, toughRows: 0 },
  hard: { speedPct: 104, paddle: 76, rows: 9, cap2: 0, toughRows: 4 },
  expert: { speedPct: 108, paddle: 68, rows: 9, cap2: 0, toughRows: 9 },
};
/** Rally's levels on rallyRev 13 (the Retro overhaul, stage 3): the table its stored level rounds replay on. */
export const RALLY_LEVELS: Table<RallyLv> = {
  easy: { lives: 3, fullAt: 20, paddleStart: 140, paddleMin: 60, capPct: 86, bumper1S: 45, bumper2S: 60 },
  hard: { lives: 2, fullAt: 26, paddleStart: 104, paddleMin: 36, capPct: 115, bumper1S: 20, bumper2S: 35 },
  expert: { lives: 1, fullAt: 29, paddleStart: 96, paddleMin: 32, capPct: 125, bumper1S: 10, bumper2S: 25 },
};
/** Rally's levels on rallyRev 14 (D5's ladder): the table rooms and practice deal. */
export const RALLY_LEVELS_V14: Table<RallyLv14> = {
  easy: { lives: 4, fullAt: 20, paddleStart: 168, paddleMin: 84, capPct: 86, bumper1S: 99, bumper2S: 99, padsFull: 6, targetsFull: 3, spinFull: 3 },
  hard: { lives: 2, fullAt: 15, paddleStart: 72, paddleMin: 28, capPct: 115, bumper1S: 0, bumper2S: 0, padsFull: 5, targetsFull: 3, spinFull: 2 },
  expert: { lives: 1, fullAt: 16, paddleStart: 48, paddleMin: 24, capPct: 125, bumper1S: 0, bumper2S: 0, padsFull: 4, targetsFull: 3, spinFull: 3 },
};
export const WAVEFRONT_LEVELS: Table<WavefrontLv> = {
  easy: { lives: 4, boltPct: 80, bossPct: 80, killS: 24 },
  hard: { lives: 3, boltPct: 120, bossPct: 130, killS: 16 },
  expert: { lives: 2, boltPct: 140, bossPct: 160, killS: 16 },
};
/** Wavefront wavRev 16 at Easy, Hard and Expert (the sim reads it from the run's state; the registry mirrors it). */
export const WAVEFRONT_LEVELS_WIDE: Table<WavefrontLvWide> = {
  easy: { lives: 4, boltPct: 80, bossPct: 80, killS: 24, volley: 1, upFrom: 0, upOdds: 1, maxRed: 4, diveFrom: 0, diveTwoFrom: 0, saucersFull: 3, weakFull: 4 },
  hard: { lives: 3, boltPct: 100, bossPct: 100, killS: 20, volley: 2, upFrom: 3, upOdds: 1, maxRed: 14, diveFrom: 2, diveTwoFrom: 3, saucersFull: 4, weakFull: 5 },
  expert: { lives: 2, boltPct: 100, bossPct: 100, killS: 20, volley: 3, upFrom: 3, upOdds: 1, maxRed: 18, diveFrom: 1, diveTwoFrom: 2, saucersFull: 4, weakFull: 4 },
};
export const BURST_LEVELS: Table<BurstLv> = {
  easy: { lives: 4, sizePct: 125, quickPct: 150, freeWhiffs: 40 },
  hard: { lives: 3, sizePct: 100, quickPct: 75, freeWhiffs: 12 },
  expert: { lives: 2, sizePct: 100, quickPct: 60, freeWhiffs: 8 },
};
/** Fission burstRev 14 at Easy, Hard and Expert (the sim reads it from the run's state; the registry mirrors it). */
export const BURST_LEVELS_SMALL: Table<BurstLvSmall> = {
  // S; M; M; M S; L: 42 atoms.
  easy: { lives: 4, sizePct: 125, quickPct: 150, freeWhiffs: 60, waves: [[2], [1], [1], [1, 2], [0]], coreFull: 42, clearFull: 19, goldFull: 2 },
  // M M; L; L M; L M; L L: 103 atoms.
  hard: { lives: 3, sizePct: 100, quickPct: 100, freeWhiffs: 20, waves: [[1, 1], [0], [0, 1], [0, 1], [0, 0]], coreFull: 98, clearFull: 19, goldFull: 2 },
  // M M M; L M; L M; L L; L L: 125 atoms, three bouncing from the first second.
  expert: { lives: 2, sizePct: 100, quickPct: 100, freeWhiffs: 20, waves: [[1, 1, 1], [0, 1], [0, 1], [0, 0], [0, 0]], coreFull: 105, clearFull: 17, goldFull: 2 },
};
/** Tempo's beatRev 12 levels (the Retro overhaul, stage 3): stored beatRev 12 level rounds replay on this table. */
export const BEAT_LEVELS: Table<BeatLv> = {
  easy: { perfect: 5, good: 10, ok: 16, fall: 110, eighthPct: 100, chordPct: 100 },
  hard: { perfect: 3, good: 6, ok: 11, fall: 75, eighthPct: 170, chordPct: 160 },
  expert: { perfect: 2, good: 5, ok: 10, fall: 60, eighthPct: 240, chordPct: 220 },
};
/**
 * Tempo's beatRev 13 levels (D5's ladder, 23 Nov 2026; docs/arcade-standard/beat.md "Levels (D5, 23 Nov 2026)"): the
 * lever is the lanes, three for the whole song on Easy, five from the first note on Hard and six on Expert (Normal: four,
 * a fifth from 40 s); the windows, fall time and chart shares as the spec; each level's own full lines (the ladder rule,
 * Joe 23 Nov 2026: each feature full at about what the realistic elite takes on three runs in four at that level; the
 * accuracy line moved only where that alone left the elite too few runs at 200), against Normal's accuracy 1,000, 4
 * fevers, 5 golden notes in 9 and a streak of 70 % of the notes.
 */
export const BEAT_LEVELS_V13: Table<BeatLv13> = {
  easy: { lanes: 3, perfect: 5, good: 10, ok: 16, fall: 110, eighthPct: 50, chordPct: 50, accFull: 990, feversFull: 3, goldNinths: 4, streakPct: 75 },
  hard: { lanes: 5, perfect: 3, good: 6, ok: 11, fall: 75, eighthPct: 170, chordPct: 160, accFull: 995, feversFull: 4, goldNinths: 5, streakPct: 60 },
  expert: { lanes: 6, perfect: 3, good: 6, ok: 11, fall: 60, eighthPct: 240, chordPct: 220, accFull: 992, feversFull: 4, goldNinths: 5, streakPct: 45 },
};
/** Meteor's levels on snakeRev 15 (the Retro overhaul, stage 3): the table its stored level rounds replay on. */
export const SNAKE_LEVELS: Table<SnakeLv> = {
  easy: { lives: 3, stepStart: 9, stepMin: 5, walls: 0, fullAt: 27 },
  hard: { lives: 2, stepStart: 8, stepMin: 4, walls: 1, fullAt: 50 },
  expert: { lives: 1, stepStart: 8, stepMin: 3, walls: 1, fullAt: 48 },
};
/** Meteor's levels on snakeRev 16 (D5's ladder): the table rooms and practice deal. */
export const SNAKE_LEVELS_V16: Table<SnakeLv16> = {
  easy: { lives: 3, stepStart: 9, stepMin: 5, walls: 0, fullAt: 20, rocksAtStart: 0, rockEvery: 0, rockFrom: 0, rockMax: 0, shower: 0, goldPct: 40, comboFull: 8, laneFull: 4, warpFull: 8 },
  hard: { lives: 2, stepStart: 9, stepMin: 4, walls: 1, fullAt: 36, rocksAtStart: 8, rockEvery: 3, rockFrom: 10, rockMax: 20, shower: 1, goldPct: 61, comboFull: 12, laneFull: 5, warpFull: 10 },
  expert: { lives: 1, stepStart: 7, stepMin: 3, walls: 1, fullAt: 36, rocksAtStart: 16, rockEvery: 2, rockFrom: 5, rockMax: 32, shower: 1, goldPct: 67, comboFull: 15, laneFull: 7, warpFull: 10 },
};
export const CROSS_LEVELS: Table<CrossLv> = {
  easy: { density: [5, 6, 6, 7, 7, 8, 8, 9, 9, 10], lives: 4, hitCost: 10, fullAt: 70 },
  hard: { density: [8, 10, 12, 13, 14, 15, 15, 15, 15, 15], lives: 3, hitCost: 15, fullAt: 76 },
  expert: { density: [10, 12, 14, 15, 16, 17, 18, 18, 18, 18], lives: 2, hitCost: 20, fullAt: 80 },
};
/**
 * Spacewalk (crossRev 14, D5, 23 Nov 2026; docs/arcade-standard/cross.md "Levels (D5, 23 Nov 2026)"): the lever is the
 * traffic from the first crossing. `density` is each crossing's traffic in twelfths of crossRev 9's (the last entry holds
 * on), dealt at exactly that density: rooms deal a level only on seeds where every crossing is proved passable at it and
 * a proof run scores 200 (crossLevelDeals.server.ts), so nothing is thinned. Lives, the cost of a hit before the last and
 * the rows-and-crossings figure the core is full at as on crossRev 13's table, and the level's own full lines for the two
 * features: the no-stop crossings in a row after the first that fill the streak's 40 (`streakAt`; Normal 4) and the
 * close calls that fill their 10 (`closeAt`; Normal 10). crossRev 13's table above stays as it is, so the levels rounds
 * stored on it replay exactly. Normal stays crossRev 13.
 */
export interface CrossLvV14 extends CrossLv {
  streakAt: number;
  closeAt: number;
}
export const CROSS_LEVELS_V14: Table<CrossLvV14> = {
  easy: { density: [3, 4, 5, 6, 7, 8, 8, 8, 8, 8], lives: 4, hitCost: 10, fullAt: 70, streakAt: 4, closeAt: 10 },
  hard: { density: [10, 11, 12, 13, 14, 14, 14, 14, 14, 14], lives: 3, hitCost: 15, fullAt: 76, streakAt: 3, closeAt: 16 },
  expert: { density: [12, 12, 13, 14, 15, 15, 15, 15, 15, 15], lives: 2, hitCost: 20, fullAt: 72, streakAt: 2, closeAt: 8 },
};
export const PINBALL_LEVELS: Table<PinballLv> = {
  easy: { balls: 4, saveS: 10, gravityPct: 85, multiS: 25, fullAt: 50_000 },
  hard: { balls: 3, saveS: 0, gravityPct: 110, multiS: 18, fullAt: 61_000 },
  expert: { balls: 2, saveS: 0, gravityPct: 120, multiS: 15, fullAt: 66_000 },
};
/** Blockzone's blockfallRev 2 levels (the Retro overhaul, stage 3): stored blockfallRev 2 level rounds replay on this table. */
export const BLOCKFALL_LEVELS: Table<BlockfallLv> = {
  easy: { gravityPct: 125, lockDelay: 40, previews: 3, fullAt: 40 },
  hard: { gravityPct: 80, lockDelay: 24, previews: 2, fullAt: 57 },
  expert: { gravityPct: 60, lockDelay: 18, previews: 1, fullAt: 62 },
};
/**
 * Blockzone's blockfallRev 3 levels (D5's ladder, 23 Nov 2026; docs/arcade-standard/blockfall.md "Levels (D5, 23 Nov
 * 2026)"), dealt at Easy, Hard and Expert only (Normal stays blockfallRev 2). The lever is how fast the pieces fall:
 * Easy a row every 72 ticks quickening to 36 (150 % of Normal's fall time), Hard every 12 quickening to 6 (25 %),
 * Expert every 7 quickening to 4 (15 %); the lock delay, the previews and the lines the core is full at with it. Easy's
 * low stack is full in the bottom 10 rows (nothing from row 16; Normal's 4 and 10), about what the realistic elite
 * keeps on three runs in four there, so Easy welcomes and its 200 comes more often than Normal's; Expert's in the
 * bottom 5 (nothing from row 11), so its 200, the rarest, still comes on a fifth of the realistic elite's runs.
 */
export const BLOCKFALL_LEVELS_V3: Table<BlockfallLv> = {
  easy: { gravityPct: 150, lockDelay: 45, previews: 5, fullAt: 15, lowFull: 10, lowZero: 16 },
  hard: { gravityPct: 25, lockDelay: 15, previews: 2, fullAt: 51 },
  expert: { gravityPct: 15, lockDelay: 12, previews: 1, fullAt: 51, lowFull: 5, lowZero: 11 },
};
export const HOVER_LEVELS: Table<HoverLv> = {
  easy: { shield: 1, gapPct: 115, scrollPct: 100 },
  hard: { shield: 0, gapPct: 100, scrollPct: 106 },
  expert: { shield: 0, gapPct: 100, scrollPct: 112 },
};
/**
 * Hover (hoverRev 12, D5, 23 Nov 2026; docs/arcade-standard/hover.md "Levels (D5, 23 Nov 2026)"): the gap ladder. The
 * lever is the height of the barrier gaps: `gapPct` scales every gap about its centre (up on Easy, down on Hard and
 * Expert; the tight gates keep their 80 px), `shield` is how many shields the run starts with (each forgives one crash;
 * Normal 1), `slide` 1 lets the sliding gaps slide as on Normal (0: every gap is still), and the scroll is Normal's
 * (`scrollPct` 100) at every level. The parts' full lines are the level's own: the core is full at `coreAt` barriers,
 * the star chains at `chainsAt` of their 30 points, the gold stars at `goldAt`, the tight gates at `tightAt` and the
 * centre line at `centreAt` per mille of its credit (every gate flown dead centre is 1,000). hoverRev 11's table above
 * stays as it is, so the levels rounds stored on it replay exactly.
 */
export interface HoverLvV12 extends HoverLv {
  slide: number;
  coreAt: number;
  chainsAt: number;
  goldAt: number;
  tightAt: number;
  centreAt: number;
}
export const HOVER_LEVELS_V12: Table<HoverLvV12> = {
  easy: { shield: 3, gapPct: 127, scrollPct: 100, slide: 0, coreAt: 42, chainsAt: 18, goldAt: 2, tightAt: 4, centreAt: 300 },
  hard: { shield: 1, gapPct: 75, scrollPct: 100, slide: 1, coreAt: 28, chainsAt: 18, goldAt: 3, tightAt: 3, centreAt: 300 },
  expert: { shield: 0, gapPct: 70, scrollPct: 100, slide: 1, coreAt: 20, chainsAt: 12, goldAt: 3, tightAt: 3, centreAt: 400 },
};

/** Every Retro game's table, by game id. */
export const RETRO_LEVEL_TABLES = {
  breaker: BREAKER_LEVELS,
  // rallyRev 14 (D5's ladder): the table dealt today; rallyRev 13's rounds replay on RALLY_LEVELS (rally.ts reads it).
  rally: RALLY_LEVELS_V14,
  wavefront: WAVEFRONT_LEVELS,
  burst: BURST_LEVELS,
  beat: BEAT_LEVELS_V13,
  // snakeRev 16 (D5's ladder): the table dealt today; snakeRev 15's rounds replay on SNAKE_LEVELS (snake.ts reads it).
  snake: SNAKE_LEVELS_V16,
  cross: CROSS_LEVELS,
  pinball: PINBALL_LEVELS,
  blockfall: BLOCKFALL_LEVELS_V3,
  hover: HOVER_LEVELS,
} as const;
export type RetroLevelGame = keyof typeof RETRO_LEVEL_TABLES;

/** A Retro game's settings at a level, or null at Normal (and for anything unknown). */
export function retroLevelSettings<G extends RetroLevelGame>(game: G, level: Level | null | undefined): (typeof RETRO_LEVEL_TABLES)[G]["easy"] | null {
  if (!level || level === "normal") return null;
  return (RETRO_LEVEL_TABLES[game] as Table<unknown>)[level] as (typeof RETRO_LEVEL_TABLES)[G]["easy"];
}

/**
 * A game played at a level: its init puts the level's settings on the state as `lv` (and lets `apply` set anything the
 * first tick needs, such as the lives); at Normal the game itself, untouched.
 */
export function withRetroLevel<S extends object, L, G extends { init: (seed: number) => S }>(
  game: G,
  lv: L | null,
  apply?: (state: S, lv: L) => S,
): G {
  if (!lv) return game;
  return {
    ...game,
    init: (seed: number) => {
      const base = { ...game.init(seed), lv } as S;
      return apply ? apply(base, lv) : base;
    },
  };
}
