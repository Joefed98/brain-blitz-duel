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
/** Wavefront (wavRev 15): lives (Normal 3) and the enemy bolts' speed, at the start and at its top (it rises a step each
 * wave, so it builds through the run), as a per cent of Normal's; the final boss's hit points (per cent of Normal's)
 * and the boss kill time the speed part is full by (seconds; Normal 20). */
export interface WavefrontLv {
  lives: number;
  boltPct: number;
  bossPct: number;
  killS: number;
}
/** Fission (burstRev 13): lives, the atoms' size (per cent), the quick-clear time per wave (per cent of Normal's) and
 * the wasted beams that cost nothing (Normal: 20, or one an atom popped if more). */
export interface BurstLv {
  lives: number;
  sizePct: number;
  quickPct: number;
  freeWhiffs: number;
}
/** Tempo (beatRev 12): the hit windows (Perfect, Good, OK, ticks either side), the notes' fall time on screen (ticks
 * from the top of the lane to the hit line; Normal's 90) and the chart's busyness: each section's off-beat (eighth) and
 * chord shares as a per cent of Normal's (the chart is built from the seed with the scaled plan). */
export interface BeatLv {
  perfect: number;
  good: number;
  ok: number;
  fall: number;
  eighthPct: number;
  chordPct: number;
}
/** Meteor (snakeRev 15): lives (crashes forgiven = lives − 1; Normal 2), the step speed (ticks a square at the start
 * and the fastest; Normal 9 and 4, one tick faster every few stars, so it speeds up through the run) and whether the
 * edges are walls (1) instead of wrapping (0, Normal), and the core stars the stars part is full at (Normal's 36). */
export interface SnakeLv {
  lives: number;
  stepStart: number;
  stepMin: number;
  walls: number;
  fullAt: number;
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
export const RALLY_LEVELS: Table<RallyLv> = {
  easy: { lives: 3, fullAt: 20, paddleStart: 140, paddleMin: 60, capPct: 86, bumper1S: 45, bumper2S: 60 },
  hard: { lives: 2, fullAt: 26, paddleStart: 104, paddleMin: 36, capPct: 115, bumper1S: 20, bumper2S: 35 },
  expert: { lives: 1, fullAt: 29, paddleStart: 96, paddleMin: 32, capPct: 125, bumper1S: 10, bumper2S: 25 },
};
export const WAVEFRONT_LEVELS: Table<WavefrontLv> = {
  easy: { lives: 4, boltPct: 80, bossPct: 80, killS: 24 },
  hard: { lives: 3, boltPct: 120, bossPct: 130, killS: 16 },
  expert: { lives: 2, boltPct: 140, bossPct: 160, killS: 16 },
};
export const BURST_LEVELS: Table<BurstLv> = {
  easy: { lives: 4, sizePct: 125, quickPct: 150, freeWhiffs: 40 },
  hard: { lives: 3, sizePct: 100, quickPct: 75, freeWhiffs: 12 },
  expert: { lives: 2, sizePct: 100, quickPct: 60, freeWhiffs: 8 },
};
export const BEAT_LEVELS: Table<BeatLv> = {
  easy: { perfect: 5, good: 10, ok: 16, fall: 110, eighthPct: 100, chordPct: 100 },
  hard: { perfect: 3, good: 6, ok: 11, fall: 75, eighthPct: 170, chordPct: 160 },
  expert: { perfect: 2, good: 5, ok: 10, fall: 60, eighthPct: 240, chordPct: 220 },
};
export const SNAKE_LEVELS: Table<SnakeLv> = {
  easy: { lives: 3, stepStart: 9, stepMin: 5, walls: 0, fullAt: 27 },
  hard: { lives: 2, stepStart: 8, stepMin: 4, walls: 1, fullAt: 50 },
  expert: { lives: 1, stepStart: 8, stepMin: 3, walls: 1, fullAt: 48 },
};
export const CROSS_LEVELS: Table<CrossLv> = {
  easy: { density: [5, 6, 6, 7, 7, 8, 8, 9, 9, 10], lives: 4, hitCost: 10, fullAt: 70 },
  hard: { density: [8, 10, 12, 13, 14, 15, 15, 15, 15, 15], lives: 3, hitCost: 15, fullAt: 76 },
  expert: { density: [10, 12, 14, 15, 16, 17, 18, 18, 18, 18], lives: 2, hitCost: 20, fullAt: 80 },
};
export const PINBALL_LEVELS: Table<PinballLv> = {
  easy: { balls: 4, saveS: 10, gravityPct: 85, multiS: 25, fullAt: 50_000 },
  hard: { balls: 3, saveS: 0, gravityPct: 110, multiS: 18, fullAt: 61_000 },
  expert: { balls: 2, saveS: 0, gravityPct: 120, multiS: 15, fullAt: 66_000 },
};
export const BLOCKFALL_LEVELS: Table<BlockfallLv> = {
  easy: { gravityPct: 125, lockDelay: 40, previews: 3, fullAt: 40 },
  hard: { gravityPct: 80, lockDelay: 24, previews: 2, fullAt: 57 },
  expert: { gravityPct: 60, lockDelay: 18, previews: 1, fullAt: 62 },
};
export const HOVER_LEVELS: Table<HoverLv> = {
  easy: { shield: 1, gapPct: 115, scrollPct: 100 },
  hard: { shield: 0, gapPct: 100, scrollPct: 106 },
  expert: { shield: 0, gapPct: 100, scrollPct: 112 },
};

/** Every Retro game's table, by game id. */
export const RETRO_LEVEL_TABLES = {
  breaker: BREAKER_LEVELS,
  rally: RALLY_LEVELS,
  wavefront: WAVEFRONT_LEVELS,
  burst: BURST_LEVELS,
  beat: BEAT_LEVELS,
  snake: SNAKE_LEVELS,
  cross: CROSS_LEVELS,
  pinball: PINBALL_LEVELS,
  blockfall: BLOCKFALL_LEVELS,
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
