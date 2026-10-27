/**
 * Success-event declarations for the 22 active arcade games, read by the shared
 * layer in arcadeFx.renderer.ts. Every `count`/`at`/`when` below is a pure read
 * of a counter or position the sim already keeps for its own rules; nothing here
 * changes a sim, an input or a score. Pops show counter facts ("+1", "×3",
 * "LEVEL 4!"), never points, so nothing on screen can disagree with the stored
 * score. Coordinates are in each game's world (or view) units.
 *
 * `misses` (Polish 1) are each game's existing miss, life-lost or crash moment, read
 * from the same counters its sound observer uses (src/lib/fx/gameSounds.ts), for the
 * shared red edge pulse and, where a point is given, the puff at the miss.
 */
import type { ArcadeFxMiss, ArcadeFxSpec, ArcadeWorld } from "./arcadeFx.renderer";
import { px } from "./engine";

import { HOVER_DISC_X, HOVER_EXPAND_H, HOVER_TALL_H, HOVER_WORLD_H, HOVER_WORLD_W, hoverWorldH, type HoverState } from "./hover";

/** hoverRev 2: passed barriers of one kind (original courses have none, so these stay 0). */
function hoverPassed(s: HoverState, kind: "twoGap" | "moving"): number {
  let n = 0;
  for (let i = 0; i < s.gates; i++) {
    const p = s.pillars[i];
    if (p && (kind === "twoGap" ? p.gap2Top !== undefined : p.movePhase !== undefined)) n += 1;
  }
  return n;
}
import {
  BRK_BRICK_H,
  BRK_BRICK_W,
  BRK_COLS,
  BRK_ROWS,
  BRK_ROW_PITCH,
  BRK_WALL_X,
  BRK_WALL_Y,
  BRK_TALL_H,
  BRK_WORLD_H,
  BRK_WORLD_W,
  brkDestroyed,
  brkWorldH,
  brkRowOffset,
  brkCols,
  brkComboMultiplier,
  brkIsGold,
  brkRowsOf,
  brkWorldW,
  BRK_V9_H,
  BRK_V9_W,
  type BrkState,
} from "./breaker";

/** brkRev 2: bricks destroyed in the sliding rows (original boards have none, so 0). */
function brkSlideDestroyed(s: BrkState): number {
  let n = 0;
  for (const row of s.slide ?? []) for (let c = 0; c < BRK_COLS; c++) if ((s.bricks[row * BRK_COLS + c] ?? 0) <= 0) n += 1;
  return n;
}
import { PINBALL_IN_ROOMS, PIN_BUMPERS, PIN_LANE_POSTS, PIN_LANE_SENSOR_Y, PIN_LEFT_WALL, PIN_ORBIT_INNER, PIN_SPINNER_Y, PIN_TARGET_XS, PIN_TARGET_Y, PIN_WORLD_H, PIN_WORLD_W, type PinState } from "./pinball";
import { rallyBonusCount, rallyPaddleY, rallyWorldH, RALLY_V10_BONUS_LIFE, RALLY_V10_BONUS_PTS, RALLY_V10_H, RALLY_V10_W, RALLY_SPEED_CAP, RALLY_SPEED_START, RALLY_TALL_H, RALLY_WORLD_H, RALLY_WORLD_W, type RallyState } from "./rally";
import { BEAT_TALL_H, BEAT_WORLD_H, BEAT_WORLD_W, beatHitLineY, beatLaneXOf, beatLanesAt, beatWorldH, type BeatState } from "./beat";
/** Tempo's last judged lane centre (beatRev 9: in the five-lane section, five lanes). */
const beatLastX = (s: BeatState) => beatLaneXOf(Math.max(0, s.lastLane), beatLanesAt(s, s.tick));
import {
  SNAKE_BOARD_X,
  SNAKE_BOARD_Y,
  SNAKE_CELL,
  SNAKE_WORLD_H,
  SNAKE_TALL_H,
  snakeRowsOf,
  snakeWorldHFor,
  SNAKE_WORLD_W,
  snakeCol,
  snakeRow,
  snakeBoardXOf,
  snakeColsOf,
  SNAKE_V9_WORLD_W,
  SNAKE_V9_H,
  type SnakeState,
} from "./snake";
import { burstFloorY, burstGoldenCount, BURST_FLOOR_Y, BURST_LIVES, BURST_TALL_H, BURST_WORLD_W, type BurstState } from "./burst";
import { SKYLINE_STREAK_FROM, SKYLINE_TALL_H, SKYLINE_WIND_FROM, SKYLINE_WORLD_H, SKYLINE_WORLD_W, skylineWorldH, type SkylineState } from "./skyline";
import {
  crossColumnCentreFp,
  crossKindCrossed,
  crossLaneCentre,
  CROSS_HUD_H,
  CROSS_KIND_CYCLE,
  CROSS_KIND_ROADWORKS,
  CROSS_WORLD_H,
  CROSS_WORLD_W,
  type CrossState,
} from "./cross";
import { JUNC_BUILD_EVERY, JUNC_BUILDS, JUNC_LIGHT_AT_V2, JUNC_WORLD_H, JUNC_WORLD_W, type JuncState } from "./junction";
import { INK_LEVELS, INK_WORLD_H, INK_WORLD_W, type InkState } from "./inkBridge";
import { wavShipY, wavWorldH, WAV_TALL_H, WAV_WORLD_H, WAV_WORLD_W, type WavState } from "./wavefront";
import { ORBIT_WORLD_H, ORBIT_WORLD_W, type OrbitState } from "./orbit";
import { orbitViewH, ORBIT_CAM_VIEW_H, ORBIT_CAM_VIEW_W, ORBIT_TALL_VIEW_H } from "./orbitCamera";
import type { OrbitRev3State } from "./orbitRev3";
import {
  SWING_FINISH_M,
  SWING_WORLD_H,
  SWING_TALL_H,
  swingWorldH,
  SWING_WORLD_W,
  swingMetres,
  SWING_V13_H,
  SWING_V13_W,
  swingFeatureCounts,
  swingParLabel,
  type SwingState,
} from "./swing";
import {
  flipCrackTick,
  flipStarsTaken,
  flipRunnerPoint,
  flipRunnerX,
  flipSweetsTaken,
  flipTrailStars,
  FLIP_V8_WORLD_H,
  FLIP_CRUMBLE_TICKS,
  FLIP_STARS,
  FLIP_WORLD_H,
  FLIP_WORLD_W,
  type FlipState,
} from "./flip";

/** flipRev 8: speed zones the run has entered (0 on every earlier round). */
function flipZonesEntered(s: FlipState): number {
  const z = s.v8?.zones;
  if (!z || s.ended === 2) return 0;
  let n = 0;
  for (let i = 0; i < z.length; i += 2) if (s.tick > z[i]!) n += 1;
  return n;
}
/** Rev 2: crumble tiles the runner touched that broke with it safely elsewhere. */
function flipEscapes(s: FlipState): number {
  if (s.ended === 2) return 0;
  const cracks = s.cracks ?? [];
  let n = 0;
  for (let k = 0; k < cracks.length; k += 2) if (s.tick - (flipCrackTick(s, cracks[k]!) ?? s.tick) >= FLIP_CRUMBLE_TICKS) n += 1;
  return n;
}
import { BINTOSS_THROWS, BINTOSS_WORLD_H, BINTOSS_WORLD_W, type BinTossState } from "./binToss";
import {
  BULLSEYE_ARROWS,
  BULLSEYE_CX,
  BULLSEYE_CY,
  BULLSEYE_WORLD_H,
  BULLSEYE_WORLD_W,
  type BullseyeState,
} from "./bullseye";
import { SLICE_TALL_H, SLICE_V9_H, SLICE_V9_W, SLICE_WORLD_H, SLICE_WORLD_W, sliceMayoCount, sliceMultiplier, sliceWorldH, type SliceState } from "./slice";
import { bubCellX, bubCellY, BUB_COLS, BUB_TALL_H, BUB_WORLD_H, BUB_WORLD_W, bubWorldH, type BubState } from "./bubble";

/** Where the last special landed (bubbleRev 2), in world units. */
function bubSpecialPoint(s: BubState): { x: number; y: number } {
  const cell = s.lastSpecialCell ?? -1;
  if (cell < 0) return { x: BUB_WORLD_W / 2, y: bubWorldH(s) / 2 };
  const row = Math.floor(cell / BUB_COLS);
  return { x: bubCellX(row, cell % BUB_COLS), y: bubCellY(row, s.descents) };
}
import { SNIP_CONFIG, SNIP_COURSES, SNIP_EATEN, SNIP_H, SNIP_TALL_H, SNIP_X_LEVELS, SNIP_X_VIEW_H, snipCamera, snipWorldH, type SnipState } from "./snip";
import { TILT_MAX_MAZES, TILT_WORLD_H, TILT_WORLD_W, type TiltState } from "./tilt";
import { btWorldH, BT_BALLS, BT_H, BT_TALL_H, BT_V7_H, BT_W, type BtState } from "./ballTrack";
import { wfWord, wfWorldH, WF_H, WF_H_V2, WF_PAR, WF_W, WF_WELL_Y, type WordfallState } from "./wordfall";
import {
  matchupIsJackpot,
  matchupParRaw,
  MATCHUP_BOARD_X,
  MATCHUP_BOARD_Y,
  MATCHUP_CELL_PX,
  MATCHUP_SIZE,
  MATCHUP_WORLD_H,
  MATCHUP_V9_WORLD_H,
  MATCHUP_WORLD_W,
  type MatchupState,
} from "./matchup";

/**
 * Where Gemstone's last clear happened: the middle of the cells it cleared. Without
 * an `at`, effects fall back to the world centre, which is the gem at column 4,
 * row 4, so every cascade used to sparkle on that one gem.
 */
function matchupClearPoint(s: MatchupState): { x: number; y: number } {
  const cells = s.lastCleared;
  const centre = (index: number) => ({
    x: MATCHUP_BOARD_X + ((index % MATCHUP_SIZE) + 0.5) * MATCHUP_CELL_PX,
    y: MATCHUP_BOARD_Y + (Math.floor(index / MATCHUP_SIZE) + 0.5) * MATCHUP_CELL_PX,
  });
  if (cells.length === 0) return centre(0);
  let x = 0, y = 0;
  for (const index of cells) {
    const p = centre(index);
    x += p.x;
    y += p.y;
  }
  x /= cells.length;
  y /= cells.length;
  // Always a gem that was actually cleared: the one nearest the middle of the
  // clear (the bare centroid of an L, a T or two separate lines can fall on a
  // gem that stayed put).
  let best = centre(cells[0]!);
  let bestD = Infinity;
  for (const index of cells) {
    const p = centre(index);
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Between the two gems of Gemstone's last refused swap. */
function matchupInvalidPoint(s: MatchupState): { x: number; y: number } {
  const centre = (index: number) => ({
    x: MATCHUP_BOARD_X + ((index % MATCHUP_SIZE) + 0.5) * MATCHUP_CELL_PX,
    y: MATCHUP_BOARD_Y + (Math.floor(index / MATCHUP_SIZE) + 0.5) * MATCHUP_CELL_PX,
  });
  const a = centre(s.lastInvalidA);
  const b = centre(s.lastInvalidB);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** A Jackpot gem's cell on the board (matchupRev 2+), else the last clear. */
function matchupJackpotPoint(s: MatchupState): { x: number; y: number } {
  const index = s.cells.findIndex((kind) => matchupIsJackpot(kind));
  if (index < 0) return matchupClearPoint(s);
  return {
    x: MATCHUP_BOARD_X + ((index % MATCHUP_SIZE) + 0.5) * MATCHUP_CELL_PX,
    y: MATCHUP_BOARD_Y + (Math.floor(index / MATCHUP_SIZE) + 0.5) * MATCHUP_CELL_PX,
  };
}

/**
 * Which world each arcade game with a world belongs to (docs/duelz-game-bank.md):
 * the 21 active ones and Junction, retired to practice in Tuning C (Oct 2026),
 * which keeps its world, fill and effects for practice and stored-round reveals.
 */
export const ARCADE_GAME_WORLDS = {
  hover: "retro",
  breaker: "retro",
  rally: "retro",
  beat: "retro",
  snake: "retro",
  burst: "retro",
  wavefront: "space",
  orbit: "space",
  skyline: "realworld",
  cross: "realworld",
  junction: "realworld",
  inkbridge: "realworld",
  slice: "kitchen",
  bintoss: "fairground",
  bullseye: "fairground",
  bubble: "underwater",
  flip: "cavelava",
  swing: "cavelava",
  snip: "orchard",
  tilt: "toybox",
  balltrack: "toybox",
  matchup: "gem",
  pinball: "retro",
} as const satisfies Record<string, ArcadeWorld>;

export type ArcadeFxGame = keyof typeof ARCADE_GAME_WORLDS;

/**
 * Arcade games with a world that rooms do not deal (practice only; registry RETIRED_TYPES):
 * Junction (retired in Tuning C) and Pinball until PINBALL_IN_ROOMS (pinball.ts) is switched on.
 */
export const RETIRED_ARCADE_GAMES: readonly ArcadeFxGame[] = PINBALL_IN_ROOMS ? ["junction"] : ["junction", "pinball"];
/** The 22 active arcade games (rooms deal these; Pinball joined on 14 Oct 2026 with PINBALL_IN_ROOMS on). */
export const ACTIVE_ARCADE_GAMES = (Object.keys(ARCADE_GAME_WORLDS) as ArcadeFxGame[]).filter((g) => !RETIRED_ARCADE_GAMES.includes(g));

/**
 * Engine games outside the Arcade category that draw in an arcade world and
 * through the shared success layer. Kept apart from the arcade games so their counts and
 * checks stay as they are; arcade-play-check plays these too.
 */
export const ENGINE_GAME_WORLDS = {
  wordfall: "toybox",
} as const satisfies Record<string, ArcadeWorld>;

export type EngineFxGame = keyof typeof ENGINE_GAME_WORLDS;

export function arcadeWorldOf(type: string): ArcadeWorld | null {
  return (ARCADE_GAME_WORLDS as Record<string, ArcadeWorld>)[type] ??
    (ENGINE_GAME_WORLDS as Record<string, ArcadeWorld>)[type] ??
    null;
}

/* ================================ Retro ================================ */

/** Tuning D: the cool light burst (purple, green, blue) for wave and zone moments. */
export const COOL_LIGHTS = ["#B48CFF", "#5CFFB4", "#5CB8FF"] as const;
/** Tuning D: while a Breaker success text is up, the arena glows cool white and blue. */
export const BREAKER_ARENA_GLOW = ["#EAF4FF", "#6FB8FF"] as const;
/** Breaker's success text runs this much smaller than the shared default. */
export const BREAKER_TEXT_SCALE = 0.8;
/**
 * Polish G border lights (edge only), one pattern per game so no two Retro
 * games look alike; the star-dust burst (COOL_LIGHTS) stays Fission's alone.
 * Rally: white and blue bulbs flash round the court on every hit, building up
 * (more bulbs, brighter, faster) as the rally grows and the ball speeds up.
 */
export const RALLY_BULBS = ["#FFFFFF", "#4DA6FF"] as const;
export const RALLY_GOLD_BULBS = ["#FFD84A", "#FFFFFF"] as const;
/** Breaker: white heads with blue tails chase round the border on rows and power-ups. */
export const BREAKER_BULBS = ["#FFFFFF", "#5CB8FF", "#2A6BFF"] as const;
/** Hover: the border flashes the next colour of this cycle at every barrier passed. */
export const HOVER_STEP_COLOURS = ["#3DFFE0", "#FF4DFF", "#FFD84A", "#4BFF7A", "#5CB8FF", "#FF6A5C"] as const;
/**
 * Tuning F (display only): Hover's arena border lights (the edge bulbs and edge
 * stroke round the arena) were too strong. Passing a barrier now gives a very
 * faint border flash and every 7th barrier a stronger one, still well below the
 * full strength they had before (1). The barriers' own art is untouched.
 */
export const HOVER_BARRIER_LIGHT = 0.18;
export const HOVER_ZONE_LIGHT = 0.35;

/** Rally's tension, 0…1: the longer of the rally (40 returns) and the ball's speed-up. */
export function rallyHeat(s: RallyState): number {
  const length = s.hits / 40;
  const pace = (s.speed - RALLY_SPEED_START) / (RALLY_SPEED_CAP - RALLY_SPEED_START);
  return Math.max(0, Math.min(1, Math.max(length, pace)));
}

export const HOVER_FX: ArcadeFxSpec<HoverState> = {
  game: "hover",
  world: "retro",
  width: HOVER_WORLD_W,
  height: HOVER_WORLD_H,
  fit: "world",
  events: [
    // Polish G: every barrier passed flashes the border in the next colour of the cycle (very faintly since Tuning F).
    {
      kind: "pop",
      count: (s) => s.gates,
      label: () => null,
      textOnly: true,
      bulbs: { pattern: "step", colours: HOVER_STEP_COLOURS, level: HOVER_BARRIER_LIGHT },
    },
    // Every seventh barrier changes colour: a new "zone" reached (the border blinks its colour three times, at under half strength since Tuning F).
    {
      kind: "streak",
      count: (s) => s.gates,
      every: 7,
      at: (s) => ({ x: px(HOVER_DISC_X), y: px(s.y) }),
      label: (_s, n) => `ZONE ${Math.floor(n / 7) + 1}`,
      textOnly: true,
      bulbs: { pattern: "step", colours: HOVER_STEP_COLOURS, strong: true, level: HOVER_ZONE_LIGHT },
    },
    // hoverRev 2 success moments: a gold star, a two-gap barrier, a moving barrier.
    {
      kind: "perfect",
      count: (s) => s.stars ?? 0,
      at: (s) => ({ x: px(HOVER_DISC_X), y: px(s.y) - 16 }),
      label: () => "GOLD STAR!",
      colour: () => "#FFD84A",
      textOnly: true,
      bulbs: { pattern: "step", colours: ["#FFD84A"], strong: true },
    },
    {
      kind: "pop",
      count: (s) => hoverPassed(s, "twoGap"),
      at: (s) => ({ x: px(HOVER_DISC_X) + 30, y: px(s.y) - 14 }),
      label: (s) => {
        const p = s.pillars[s.gates - 1];
        return p?.gap2Top !== undefined && s.y >= p.gap2Top ? "LOWER GAP!" : "UPPER GAP!";
      },
      textOnly: true,
    },
    {
      kind: "pop",
      count: (s) => hoverPassed(s, "moving"),
      at: (s) => ({ x: px(HOVER_DISC_X) + 30, y: px(s.y) - 14 }),
      label: () => "SLIPPED THROUGH!",
      textOnly: true,
    },
    {
      kind: "final",
      count: (s) => (s.totalGates > 0 && s.gates >= s.totalGates ? 1 : 0),
      at: (s) => ({ x: px(HOVER_DISC_X), y: px(s.y) }),
      textOnly: true,
      bulbs: { pattern: "step", colours: HOVER_STEP_COLOURS, strong: true },
    },
    // hoverRev 9 (the 200 expansion; counts stay 0 on every earlier round, so their moments are unchanged): a tight
    // gate threaded, a whole star chain, a shield picked up, a centre line graded.
    {
      kind: "perfect",
      count: (s) => s.tight ?? 0,
      at: (s) => ({ x: px(HOVER_DISC_X) + 24, y: px(s.y) - 16 }),
      label: () => "TIGHT GATE!",
      colour: () => "#FFD84A",
      textOnly: true,
      bulbs: { pattern: "step", colours: ["#FFD84A"], strong: true },
    },
    {
      kind: "clear",
      count: (s) => s.chainsDone ?? 0,
      at: (s) => ({ x: px(HOVER_DISC_X) + 24, y: px(s.y) - 16 }),
      label: () => "STAR CHAIN!",
      colour: () => "#FFD84A",
      textOnly: true,
      bulbs: { pattern: "step", colours: ["#FFD84A"], strong: true },
    },
    {
      kind: "pop",
      count: (s) => s.pickupsTaken?.length ?? 0,
      at: (s) => ({ x: px(HOVER_DISC_X) + 24, y: px(s.y) - 14 }),
      label: () => "SHIELD!",
      colour: () => "#5CD0FF",
      textOnly: true,
    },
    {
      kind: "combo",
      count: (s) => s.ctrLog?.length ?? 0,
      at: (s) => ({ x: px(HOVER_DISC_X) + 24, y: px(s.y) + 14 }),
      label: (s) => {
        const grade = (s.ctrLog?.at(-1) ?? 0) & 3;
        return grade === 3 ? "DEAD CENTRE!" : `CENTRE +${grade}`;
      },
      colour: () => "#FFD84A",
      textOnly: true,
    },
  ],
  misses: [
    { count: (s) => (s.crashed ? 1 : 0), at: (s) => ({ x: px(HOVER_DISC_X), y: px(s.y) }) },
    // hoverRev 9: a shield breaking in place of a crash.
    { count: (s) => s.shieldBreaks ?? 0, at: (s) => ({ x: px(HOVER_DISC_X), y: px(s.y) }) },
  ],
};

function brickCentre(index: number): { x: number; y: number } {
  const row = Math.floor(index / BRK_COLS);
  const col = index % BRK_COLS;
  return {
    x: BRK_WALL_X + col * BRK_BRICK_W + BRK_BRICK_W / 2,
    y: BRK_WALL_Y + row * BRK_ROW_PITCH + BRK_BRICK_H / 2,
  };
}

/** Rows whose every brick is down; rows only ever empty, so the count only rises. */
function brkRowsCleared(s: BrkState): number {
  let rows = 0;
  for (let r = 0; r < BRK_ROWS; r++) {
    let clear = true;
    for (let c = 0; c < BRK_COLS && clear; c++)
      if ((s.bricks[r * BRK_COLS + c] ?? 0) > 0) clear = false;
    if (clear) rows += 1;
  }
  return rows;
}

function lowestClearedRow(s: BrkState): { x: number; y: number } {
  for (let r = BRK_ROWS - 1; r >= 0; r--) {
    let clear = true;
    for (let c = 0; c < BRK_COLS && clear; c++)
      if ((s.bricks[r * BRK_COLS + c] ?? 0) > 0) clear = false;
    if (clear) return { x: BRK_WORLD_W / 2, y: brickCentre(r * BRK_COLS).y };
  }
  return { x: BRK_WORLD_W / 2, y: BRK_WALL_Y };
}

/** Where Breaker's last ball left the court: its x on the frame before, at the court's foot. */
function breakerLostAt(s: BrkState, before: BrkState | null): { x: number; y: number } {
  const balls = before?.balls ?? [];
  let low = balls[0];
  for (const b of balls) if (low && b.y > low.y) low = b;
  const x = low ? low.x / 256 : s.paddleX;
  return { x: Math.max(8, Math.min(BRK_WORLD_W - 8, x)), y: brkWorldH(s) - 10 };
}

/**
 * Every Breaker success text: slightly smaller, and the arena glows while it is up
 * (Tuning D). Polish G: text only at the event (no star dust); rows and power-ups
 * send lights chasing round the border instead.
 */
const BREAKER_TEXT = { textScale: BREAKER_TEXT_SCALE, arenaGlow: BREAKER_ARENA_GLOW, textOnly: true } as const;
const BREAKER_CHASE = { pattern: "chase", colours: BREAKER_BULBS } as const;

export const BREAKER_FX: ArcadeFxSpec<BrkState> = {
  game: "breaker",
  world: "retro",
  width: BRK_WORLD_W,
  height: BRK_WORLD_H,
  fit: "world",
  events: [
    {
      kind: "perfect",
      count: (s) => s.powerUps,
      at: (s) => ({ x: s.paddleX, y: brkWorldH(s) - 80 }),
      label: () => "POWER-UP!",
      ...BREAKER_TEXT,
      bulbs: BREAKER_CHASE,
    },
    {
      kind: "streak",
      count: (s) => brkDestroyed(s),
      every: 10,
      at: (s) => ({ x: s.paddleX, y: brkWorldH(s) - 90 }),
      label: (_s, n) => `${n} BRICKS`,
      ...BREAKER_TEXT,
    },
    // brkRev 2: a Fireball caught, and a brick knocked out of a sliding row.
    {
      kind: "perfect",
      count: (s) => s.fireballs ?? 0,
      at: (s) => ({ x: s.paddleX, y: brkWorldH(s) - 96 }),
      label: () => "FIREBALL!",
      ...BREAKER_TEXT,
      colour: () => "#FF6A2B",
      bulbs: BREAKER_CHASE,
    },
    {
      kind: "pop",
      count: brkSlideDestroyed,
      at: (s) => {
        const row = (s.slide ?? [])[0] ?? 0;
        return { x: BRK_WORLD_W / 2 + brkRowOffset(s, row, s.tick), y: BRK_WALL_Y + row * BRK_ROW_PITCH + BRK_BRICK_H / 2 };
      },
      label: () => "MOVING TARGET!",
      ...BREAKER_TEXT,
    },
    { kind: "clear", count: brkRowsCleared, at: lowestClearedRow, label: () => "ROW CLEAR!", ...BREAKER_TEXT, bulbs: BREAKER_CHASE },
    { kind: "final", count: (s) => (s.cleared ? 1 : 0), label: () => "WALL CLEARED!", ...BREAKER_TEXT, bulbs: { ...BREAKER_CHASE, strong: true } },
  ],
  // The last ball out: where it left the bottom of the court.
  misses: [{ count: (s) => s.losses, at: (s, before) => breakerLostAt(s, before) }],
};

export const RALLY_FX: ArcadeFxSpec<RallyState> = {
  game: "rally",
  world: "retro",
  width: RALLY_WORLD_W,
  height: RALLY_WORLD_H,
  fit: "world",
  events: [
    {
      kind: "streak",
      count: (s) => s.hits,
      every: 10,
      at: (s) => ({ x: px(s.x), y: rallyPaddleY(s) - 8 }),
      label: (_s, n) => `RALLY ${n}`,
      textOnly: true,
      bulbs: { pattern: "flash", colours: RALLY_BULBS, heat: rallyHeat, strong: true },
    },
    {
      kind: "pop",
      count: (s) => s.goldHits,
      at: (s) => ({ x: s.paddleX, y: rallyPaddleY(s) - 10 }),
      label: () => "GOLD!",
      textOnly: true,
      bulbs: { pattern: "flash", colours: RALLY_GOLD_BULBS, heat: rallyHeat },
    },
    {
      // Rev 2: the gold ball struck a far-wall target.
      kind: "perfect",
      count: (s) => s.targetHits ?? 0,
      at: (s) => ({ x: (s.struckLeft ?? RALLY_WORLD_W / 2) + 22, y: 70 }),
      label: () => "TARGET!",
      textOnly: true,
      bulbs: { pattern: "flash", colours: RALLY_GOLD_BULBS, heat: rallyHeat, strong: true },
    },
    {
      // Rev 2: a ball came off the bumper.
      kind: "pop",
      count: (s) => s.bounces ?? 0,
      // rallyRev 5: from the bumper the bounce came off (`bumped`; the first on older rounds).
      at: (s) => {
        const b = s.bumped === 1 && s.bumper2 ? s.bumper2 : s.bumper;
        return b ? { x: b.x, y: b.y - 20 } : null;
      },
      label: () => "BOING",
      textOnly: true,
    },
    {
      // Every paddle hit flashes the court lights (no text), building with the rally.
      kind: "pop",
      count: (s) => s.hits,
      at: (s) => ({ x: px(s.x), y: rallyPaddleY(s) - 4 }),
      label: () => null,
      textOnly: true,
      bulbs: { pattern: "flash", colours: RALLY_BULBS, heat: rallyHeat },
    },
  ],
  misses: [{ count: (s) => (s.dead ? 1 : 0), at: (s) => ({ x: px(s.x), y: Math.min(px(s.y), rallyWorldH(s) - 8) }) }],
};

export const BEAT_FX: ArcadeFxSpec<BeatState> = {
  game: "beat",
  world: "retro",
  width: BEAT_WORLD_W,
  height: BEAT_WORLD_H,
  fit: "world",
  events: [
    {
      kind: "combo",
      count: (s) => s.combo,
      every: 10,
      at: (s) => ({ x: beatLastX(s), y: beatHitLineY(s) }),
      label: (_s, n) => `COMBO ${n}`,
      neon: true,
    },
    {
      // Rev 2: a swipe note swiped the right way in time.
      kind: "pop",
      count: (s) => s.swipesHit ?? 0,
      at: (s) => ({ x: beatLastX(s), y: beatHitLineY(s) - 20 }),
      label: () => "SWIPE!",
    },
    {
      kind: "final",
      count: (s) => (s.chart.ticks.length > 0 && s.maxCombo >= s.chart.ticks.length ? 1 : 0),
      label: () => "FULL COMBO!",
      sweep: true,
    },
  ],
  misses: [{ count: (s) => s.misses }],
};

function snakeHead(s: SnakeState): { x: number; y: number } {
  const cell = s.body[0] ?? 0;
  // snakeRev 9's wider board (snakeBoardXOf / snakeColsOf give the original's on older rounds).
  return {
    x: snakeBoardXOf(s) + snakeCol(cell, snakeColsOf(s)) * SNAKE_CELL + SNAKE_CELL / 2,
    y: SNAKE_BOARD_Y + snakeRow(cell, snakeColsOf(s)) * SNAKE_CELL + SNAKE_CELL / 2,
  };
}

export const SNAKE_FX: ArcadeFxSpec<SnakeState> = {
  game: "snake",
  world: "retro",
  width: SNAKE_WORLD_W,
  height: SNAKE_WORLD_H,
  fit: "world",
  events: [
    {
      kind: "streak",
      count: (s) => s.eaten,
      every: 10,
      at: snakeHead,
      label: (_s, n) => `${n} STARS`,
      sweep: true,
    },
    // snakeRev 2: a rock landed and the meteor's head was clear of it (original rounds have no rocks).
    {
      kind: "pop",
      count: (s) => s.rocks?.length ?? 0,
      when: (s) => !s.dead,
      at: (s) => {
        const rock = s.rocks?.[s.rocks.length - 1] ?? 0;
        return { x: snakeBoardXOf(s) + snakeCol(rock, snakeColsOf(s)) * SNAKE_CELL + SNAKE_CELL / 2, y: SNAKE_BOARD_Y + snakeRow(rock, snakeColsOf(s)) * SNAKE_CELL - 6 };
      },
      label: () => "DODGED!",
    },
    // snakeRev 3 meteor shower: a banner as its shadows appear, a pop when all three land clear of the head.
    {
      kind: "streak",
      count: (s) => s.showerDone ?? 0,
      at: snakeHead,
      label: () => "METEOR SHOWER!",
    },
    {
      kind: "perfect",
      count: (s) => ((s.showerCells ?? []).length > 0 && (s.rocks ?? []).includes(s.showerCells![0]!) ? 1 : 0),
      when: (s) => !s.dead,
      at: snakeHead,
      label: () => "SHOWER DODGED!",
      neon: true,
    },
    {
      kind: "final",
      count: (s) => (s.queue.length > 0 && s.eaten >= s.queue.length ? 1 : 0),
      at: snakeHead,
      label: () => "ALL EATEN!",
    },
  ],
  misses: [{ count: (s) => (s.dead ? 1 : 0), at: snakeHead }],
};

export const BURST_FX: ArcadeFxSpec<BurstState> = {
  game: "burst",
  world: "retro",
  width: BURST_WORLD_W,
  height: BURST_FLOOR_Y,
  fit: "world",
  events: [
    { kind: "clear", count: (s) => s.cleared, label: (_s, n) => `WAVE ${n} CLEARED`, sweep: true, lights: COOL_LIGHTS },
    // burstRev 2: a FREEZE icon caught (original rounds keep 0).
    {
      kind: "perfect",
      count: (s) => s.freezes ?? 0,
      at: (s) => ({ x: s.x / 256, y: burstFloorY(s) - 60 }),
      label: () => "FREEZE!",
      colour: () => "#9FE8FF",
      neon: true,
    },
    // Mirrors the sim's own top-up condition (burstScoreOf): finished, no life lost, 4+ waves.
    {
      kind: "final",
      count: (s) => (s.ended === 1 && s.lives === BURST_LIVES && s.cleared >= 4 ? 1 : 0),
      label: () => "FLAWLESS!",
    },
  ],
  misses: [{ count: (s) => -s.lives, at: (s) => ({ x: s.x / 256, y: burstFloorY(s) - 16 }) }],
};

/* ================================ Space ================================ */

export const WAVEFRONT_FX: ArcadeFxSpec<WavState> = {
  game: "wavefront",
  world: "space",
  width: WAV_WORLD_W,
  height: WAV_WORLD_H,
  // SAUCER! (a saucer hit at the world's edge) stays whole, clear of the hull frame.
  textInset: 12,
  events: [
    {
      kind: "perfect",
      count: (s) => s.saucers,
      // The sim clears saucerX on the hit, so the saucer's burst marks where it was hit.
      at: (s) => {
        let x = px(s.saucerX);
        for (const b of s.bursts) if (b.c === 3) x = b.x;
        return { x, y: 70 };
      },
      label: () => "SAUCER!",
      neon: true,
    },
    {
      kind: "clear",
      count: (s) => s.wavesCleared,
      at: (s) => ({ x: s.shipX, y: wavShipY(s) - 30 }),
      label: (_s, n) => `WAVE ${n} CLEARED`,
      sweep: true,
    },
    // wavRev 2: a diver shot down mid-dive, boss hits every 6, the boss destroyed (the final moment).
    {
      kind: "pop",
      count: (s) => s.diversDown ?? 0,
      at: (s) => {
        const b = s.bursts.at(-1);
        return b ? { x: b.x, y: b.y - 18 } : { x: s.shipX, y: wavShipY(s) - 60 };
      },
      label: () => "DIVER DOWN!",
    },
    {
      kind: "streak",
      count: (s) => s.bossHits ?? 0,
      every: 6,
      at: (s) => ({ x: (s.boss?.x ?? 131) + 64, y: 150 }),
      label: (_s, n) => `BOSS HIT ×${n}`,
    },
    {
      kind: "final",
      count: (s) => (s.rev !== undefined ? (s.bossKilled ?? 0) : s.wavesCleared >= 5 ? 1 : 0),
      at: (s) => ({ x: (s.boss?.x ?? 131) + 64, y: 108 }),
      label: (s) => (s.rev !== undefined ? "BOSS DOWN!" : "ALL WAVES!"),
    },
  ],
  misses: [{ count: (s) => -s.lives, at: (s) => ({ x: s.shipX, y: wavShipY(s) }) }],
};

const orbitEvents = [
  {
    kind: "streak" as const,
    count: (s: OrbitState | OrbitRev3State) => s.best,
    every: 10,
    at: () => ({ x: ORBIT_WORLD_W / 2, y: 90 }),
    label: (_s: unknown, n: number) => `${n} PLANETS`,
  },
  {
    kind: "final" as const,
    count: (s: OrbitState | OrbitRev3State) => s.finished,
    label: () => "ALL 40 PLANETS!",
  },
];

/** A crash: the rocket respawns (respawnTick moves on), or the run ends on one. */
const orbitMisses: ArcadeFxMiss<OrbitState | OrbitRev3State>[] = [
  { count: (s) => s.respawnTick + (s.ended === 2 ? 1 : 0) },
];

export const ORBIT_FX: ArcadeFxSpec<OrbitState> = {
  game: "orbit",
  world: "space",
  width: ORBIT_WORLD_W,
  height: ORBIT_WORLD_H,
  events: orbitEvents,
  misses: orbitMisses,
};
export const ORBIT3_FX: ArcadeFxSpec<OrbitRev3State> = {
  game: "orbit3",
  world: "space",
  width: ORBIT_CAM_VIEW_W,
  height: ORBIT_CAM_VIEW_H,
  events: [
    ...orbitEvents,
    {
      // Rev 4: through a black hole, several planets on (shown as the planets it skipped).
      kind: "clear" as const,
      count: (s: OrbitRev3State) => s.jumps ?? 0,
      at: () => ({ x: ORBIT_CAM_VIEW_W / 2, y: 120 }),
      label: (s: OrbitRev3State) => {
        const hole = s.holes?.find((h) => h.to === s.cur);
        return hole ? `BLACK HOLE! +${hole.to - hole.from} PLANETS` : "BLACK HOLE!";
      },
    },
  ],
  misses: orbitMisses,
};

/* ============================== Real World ============================== */

export const SKYLINE_FX: ArcadeFxSpec<SkylineState> = {
  game: "skyline",
  world: "realworld",
  width: SKYLINE_WORLD_W,
  height: SKYLINE_WORLD_H,
  events: [
    // The block itself already flashes "PERFECT"; this adds the ring and edge glow only.
    {
      kind: "perfect",
      count: (s) => s.perfects,
      at: (s) => ({ x: SKYLINE_WORLD_W / 2, y: skylineWorldH(s) * 0.42 }),
      label: () => null,
    },
    { kind: "streak", count: (s) => s.placed, every: 10, label: (_s, n) => `${n} FLOORS` },
    // skylineRev 2 (original rounds keep these counters at 0 / undefined).
    { kind: "combo", count: (s) => (s.streakPoints ? s.streak ?? 0 : 0), min: SKYLINE_STREAK_FROM, label: (_s, n) => `STREAK ×${n}` },
    {
      kind: "pop",
      count: (s) => (s.rev && s.placed >= SKYLINE_WIND_FROM ? 1 : 0),
      at: (s) => ({ x: SKYLINE_WORLD_W / 2, y: skylineWorldH(s) * 0.3 }),
      label: () => "FLAG UP: WATCH THE WIND!",
    },
    {
      kind: "perfect",
      count: (s) => s.gustPerfects ?? 0,
      at: (s) => ({ x: SKYLINE_WORLD_W / 2, y: skylineWorldH(s) * 0.36 }),
      label: () => "PERFECT IN THE WIND!",
    },
  ],
  misses: [{ count: (s) => (s.missed ? 1 : 0) }],
};

export const CROSS_FX: ArcadeFxSpec<CrossState> = {
  game: "cross",
  world: "realworld",
  width: CROSS_WORLD_W,
  height: CROSS_WORLD_H,
  events: [
    {
      kind: "clear",
      count: (s) => s.crossings,
      at: () => ({ x: CROSS_WORLD_W / 2, y: CROSS_HUD_H + 30 }),
      label: (s) => (s.hitThisCrossing ? "ACROSS!" : "CLEAN CROSSING!"),
    },
    // crossRev 2: past a cyclist lane or through the roadworks (original courses have neither).
    {
      kind: "pop",
      count: (s) => crossKindCrossed(s, CROSS_KIND_CYCLE),
      at: (s) => ({ x: px(crossColumnCentreFp(s.col)), y: crossLaneCentre(s.lane) - 20 }),
      label: () => "PAST THE BIKES!",
    },
    {
      kind: "pop",
      count: (s) => crossKindCrossed(s, CROSS_KIND_ROADWORKS),
      at: (s) => ({ x: px(crossColumnCentreFp(s.col)), y: crossLaneCentre(s.lane) - 20 }),
      label: () => "THROUGH THE CONES!",
    },
  ],
  // Where the walker was hit (the frame before it went back to the kerb).
  misses: [{ count: (s) => -s.lives, at: (s, before) => { const w = before ?? s; return { x: px(crossColumnCentreFp(w.col)), y: crossLaneCentre(w.lane) }; } }],
};

export const JUNCTION_FX: ArcadeFxSpec<JuncState> = {
  game: "junction",
  world: "realworld",
  width: JUNC_WORLD_W,
  height: JUNC_WORLD_H,
  events: [
    {
      kind: "perfect",
      count: (s) => s.ambThrough,
      at: () => ({ x: JUNC_WORLD_W / 2, y: JUNC_WORLD_H / 2 }),
      label: () => "AMBULANCE THROUGH!",
    },
    { kind: "streak", count: (s) => s.cleared, every: 10, label: (_s, n) => `${n} CLEARED` },
    // junctionRev 2 (original rounds keep these at 0): a new diagonal road, a bus through, the new roads' traffic.
    {
      kind: "pop",
      count: (s) => (s.rev ? Math.min(JUNC_BUILDS, Math.trunc(s.tick / JUNC_BUILD_EVERY)) : 0),
      at: (s) => {
        const ap = (s.builds ?? [])[Math.max(0, Math.min(JUNC_BUILDS, Math.trunc(s.tick / JUNC_BUILD_EVERY)) - 1)] ?? 4;
        const [x, y] = JUNC_LIGHT_AT_V2[ap]!;
        return { x, y: y - 26 };
      },
      label: (_s, n) => (n >= JUNC_BUILDS ? "EIGHT-WAY JUNCTION!" : "NEW ROAD!"),
    },
    { kind: "pop", count: (s) => s.busCleared ?? 0, at: () => ({ x: JUNC_WORLD_W / 2, y: JUNC_WORLD_H / 2 - 50 }), label: () => "BUS THROUGH!" },
    { kind: "streak", count: (s) => s.diagCleared ?? 0, every: 5, label: (_s, n) => `${n} FROM THE NEW ROADS` },
  ],
  misses: [{ count: (s) => (s.ended === 2 ? 1 : 0) }],
};

export const INKBRIDGE_FX: ArcadeFxSpec<InkState> = {
  game: "inkbridge",
  world: "realworld",
  width: INK_WORLD_W,
  height: INK_WORLD_H,
  shake: false,
  events: [
    {
      kind: "clear",
      count: (s) => s.levels,
      when: (s) => s.levels < INK_LEVELS,
      label: (_s, n) => `LEVEL ${n}!`,
    },
    {
      // Rev 4: the coin potted through the level's gold star.
      kind: "perfect",
      count: (s) => s.stars ?? 0,
      at: (s) => {
        const lvl = s.list[Math.max(0, s.level - 1)];
        return lvl?.star ? { x: lvl.star.x, y: lvl.star.y } : null;
      },
      label: () => "GOLD STAR!",
    },
    {
      kind: "final",
      count: (s) => (s.levels >= INK_LEVELS ? 1 : 0),
      label: () => "ALL 10 LEVELS!",
    },
  ],
  // A failed drop (off the bridge or onto a block): the red flash the renderer draws, kind 2.
  misses: [{ count: (s) => (s.flashKind === 2 ? s.flashTick + 1 : 0) }],
};

/* ================================ Kitchen ================================ */

export const SLICE_FX: ArcadeFxSpec<SliceState> = {
  game: "slice",
  world: "kitchen",
  width: SLICE_WORLD_W,
  height: SLICE_WORLD_H,
  shake: false,
  events: [
    {
      kind: "combo",
      count: (s) => (s.comboLive ? sliceMultiplier(s.streak) : 1),
      min: 2,
      at: (s) => (s.strokeX >= 0 ? { x: s.strokeX, y: s.strokeY } : null),
      label: (_s, n) => `COMBO ×${n}`,
    },
    { kind: "perfect", count: (s) => s.frenzyFrom.length, label: () => "SAUCY!" },
    { kind: "perfect", count: (s) => s.slowFrom.length, label: () => "SIMMER!" },
    { kind: "streak", count: (s) => s.slices, every: 25, label: (_s, n) => `${n} SLICED` },
    // sliceRev 2: the mayonnaise bottle, and a big gathered cut (4+ foods in one frame).
    { kind: "perfect", count: sliceMayoCount, label: () => "SQUEEZE!" },
    {
      kind: "combo",
      count: (s) => s.slices,
      minDelta: 4,
      at: (s) => (s.strokeX >= 0 ? { x: s.strokeX, y: s.strokeY } : null),
      label: (_s, _n, d) => `${d} IN ONE!`,
    },
  ],
  misses: [{ count: (s) => s.bombsHit, at: (s) => (s.strokeX >= 0 ? { x: s.strokeX, y: s.strokeY } : null) }],
};

/* =============================== Fairground =============================== */

/** Baskets in a row, counted back from the latest resolved throw. */
function basketRun(s: BinTossState): number {
  let run = 0;
  for (let i = s.results.length - 1; i >= 0 && s.results[i] === 1; i--) run += 1;
  return run;
}

export const BINTOSS_FX: ArcadeFxSpec<BinTossState> = {
  game: "bintoss",
  world: "fairground",
  width: BINTOSS_WORLD_W,
  height: BINTOSS_WORLD_H,
  fit: "world",
  shake: false,
  events: [
    {
      kind: "combo",
      count: basketRun,
      min: 3,
      at: () => ({ x: BINTOSS_WORLD_W / 2, y: 150 }),
      label: (_s, n) => `${n} IN A ROW`,
    },
    {
      // Rev 3: through the bonus hoop and into the bucket.
      kind: "perfect",
      count: (s) => s.swishes ?? 0,
      at: (s) => {
        const hoop = s.hoops?.[Math.max(0, s.throwIndex - 1)];
        return hoop ? { x: px(hoop.x), y: px(hoop.y) } : null;
      },
      label: () => "HOOP BONUS!",
    },
    {
      // Rev 3: a bucket made past the spinner.
      kind: "pop",
      count: (s) => s.spinBaskets ?? 0,
      at: () => ({ x: BINTOSS_WORLD_W / 2, y: 190 }),
      label: () => "PAST THE SPINNER",
    },
    {
      kind: "final",
      count: (s) => (s.baskets >= BINTOSS_THROWS ? 1 : 0),
      label: () => "TEN OUT OF TEN!",
    },
  ],
  misses: [{ count: (s) => s.resolved - s.baskets }],
};

/**
 * Darts that have landed: the in-flight dart (already in `hits` from its
 * release) is left out until it lands. Counting only landed darts keeps every
 * counter steady through a flight, so an event fires once, on the landing of
 * the dart that earned it, never again on later darts.
 */
function bullLanded(s: BullseyeState): BullseyeState["hits"] {
  return s.flightTick === 0 ? s.hits : s.hits.slice(0, -1);
}

/** A dart in the bullseye: the centre disc, while it is the gold 10. */
function isBull(h: BullseyeState["hits"][number]): boolean {
  return h.ring === 0 && h.value - (h.bal ?? 0) >= 10;
}

function bullRun(s: BullseyeState): number {
  const landed = bullLanded(s);
  let run = 0;
  for (let i = landed.length - 1; i >= 0 && isBull(landed[i]!); i--) run += 1;
  return run;
}

const lastLanded = (s: BullseyeState) => {
  const h = bullLanded(s).at(-1);
  return { x: h?.x ?? BULLSEYE_CX, y: h?.y ?? BULLSEYE_CY };
};

export const BULLSEYE_FX: ArcadeFxSpec<BullseyeState> = {
  game: "bullseye",
  world: "fairground",
  width: BULLSEYE_WORLD_W,
  height: BULLSEYE_WORLD_H,
  fit: "world",
  shake: false,
  events: [
    {
      kind: "perfect",
      count: (s) => bullLanded(s).filter(isBull).length,
      at: lastLanded,
      label: () => "BULLSEYE!",
    },
    {
      // Rev 2: the tiny inner bull.
      kind: "perfect",
      count: (s) => bullLanded(s).filter((h) => h.bull === 1).length,
      at: lastLanded,
      label: () => "INNER BULL!",
    },
    {
      // Rev 2: a balloon popped.
      kind: "pop",
      count: (s) => bullLanded(s).filter((h) => h.pop === 1).length,
      at: lastLanded,
      label: () => "POP!",
    },
    { kind: "combo", count: bullRun, min: 2, label: (_s, n) => `${n} BULLS IN A ROW` },
    {
      kind: "final",
      count: (s) =>
        s.flightTick === 0 && s.hits.length >= BULLSEYE_ARROWS && s.hits.every((h) => h.ring >= 0 || h.pop === 1)
          ? 1
          : 0,
      label: () => "ALL TEN ON TARGET!",
    },
  ],
  // A dart off the scoring rings (a popped balloon scores, so it is no miss): a dust puff where it landed.
  misses: [{ count: (s) => bullLanded(s).filter((h) => h.ring < 0 && h.pop !== 1).length, at: lastLanded }],
};

/* =============================== Underwater =============================== */

export const BUBBLE_FX: ArcadeFxSpec<BubState> = {
  game: "bubble",
  world: "underwater",
  width: BUB_WORLD_W,
  height: BUB_WORLD_H,
  fit: "stretch",
  shake: false,
  events: [
    {
      kind: "combo",
      count: (s) => s.popped,
      minDelta: 5,
      at: (s) => ({ x: px(s.x), y: px(s.y) }),
      label: (_s, _n, d) => `BIG POP ×${d}`,
    },
    {
      kind: "perfect",
      count: (s) => s.dropped,
      minDelta: 3,
      at: (s) => ({ x: px(s.x), y: px(s.y) }),
      label: (_s, _n, d) => `${d} DROPPED!`,
    },
    // bubbleRev 2 specials (original rounds never have any).
    { kind: "perfect", count: (s) => s.jokers ?? 0, at: (s) => bubSpecialPoint(s), label: () => "JOKER!" },
    { kind: "perfect", count: (s) => s.bombs ?? 0, at: (s) => bubSpecialPoint(s), label: (s) => `BOOM! ×${s.lastSpecialCleared ?? 0}` },
    { kind: "perfect", count: (s) => s.lines ?? 0, at: (s) => bubSpecialPoint(s), label: (s) => `TORPEDO! ×${s.lastSpecialCleared ?? 0}` },
    { kind: "final", count: (s) => (s.cleared ? 1 : 0), label: () => "REEF CLEARED!" },
  ],
  misses: [{ count: (s) => (s.dead ? 1 : 0) }],
};

/* ============================== Cave & Lava ============================== */

export const FLIP_FX: ArcadeFxSpec<FlipState> = {
  game: "flip",
  world: "cavelava",
  width: FLIP_WORLD_W,
  height: FLIP_WORLD_H,
  events: [
    {
      kind: "streak",
      count: (s) => (s.ended === 0 ? Math.floor(s.tick / 600) : 0),
      label: (_s, n) => `${n * 10} SECONDS`,
    },
    { kind: "final", count: (s) => (s.ended === 1 ? 1 : 0), label: () => "SURVIVED!" },
    // flipRev 2 only (original rounds have no stars or crumbling tiles).
    { kind: "pop", count: flipStarsTaken, at: (s) => ({ x: flipRunnerX(s), y: FLIP_WORLD_H / 2 }), label: () => "+STAR" },
    {
      kind: "perfect",
      count: (s) => (flipStarsTaken(s) >= FLIP_STARS ? 1 : 0),
      label: () => "ALL 10 STARS!",
    },
    { kind: "pop", count: flipEscapes, at: (s) => ({ x: flipRunnerX(s), y: FLIP_WORLD_H / 2 + 30 }), label: () => "JUST IN TIME!" },
    // flipRev 8 only (every earlier round keeps these counters at 0).
    { kind: "pop", count: (s) => flipTrailStars(s).stars, at: (s) => flipRunnerPoint(s), label: () => null },
    { kind: "perfect", count: (s) => flipTrailStars(s).full, at: (s) => flipRunnerPoint(s), label: () => "STAR TRAIL!" },
    {
      kind: "combo",
      count: (s) => s.combos ?? 0,
      at: (s) => flipRunnerPoint(s),
      label: (s) => ((s.chain ?? 0) <= 1 ? "DOUBLE FLIP!" : (s.chain ?? 0) === 2 ? "TRIPLE FLIP!" : `FLIP ×${(s.chain ?? 0) + 1}`),
    },
    { kind: "streak", count: (s) => s.cpPassed ?? 0, label: () => "CHECKPOINT" },
    { kind: "pop", count: (s) => s.saves ?? 0, at: (s) => flipRunnerPoint(s), label: () => "SAVED!" },
    { kind: "streak", count: flipZonesEntered, label: () => "SPEED ZONE!" },
    // flipRev 8's sweet spots: a small pop at the runner's feet on a sweet landing.
    { kind: "pop", count: flipSweetsTaken, at: (s) => flipRunnerPoint(s), label: () => "SWEET!" },
  ],
  misses: [{ count: (s) => (s.ended === 2 ? 1 : 0) }],
};
/** flipRev 8's taller cave draws its effects on the 730 px world. */
export const flipFxFor = (s: FlipState): ArcadeFxSpec<FlipState> => (s.exp ? fxSpecAt(FLIP_FX, FLIP_V8_WORLD_H) : FLIP_FX);

export const SWING_FX: ArcadeFxSpec<SwingState> = {
  game: "swing",
  world: "cavelava",
  width: SWING_WORLD_W,
  height: SWING_WORLD_H,
  events: [
    {
      kind: "streak",
      count: (s) => (s.ended === 0 ? Math.floor(swingMetres(s) / 100) : 0),
      label: (_s, n) => `${n * 100} M`,
    },
    // swingRev 4 success moments (older rounds keep these at 0): a star, a dodged stalactite, a jet passed, the dragon outrun.
    {
      kind: "perfect",
      count: (s) => s.stars ?? 0,
      at: (s) => ({ x: s.x / 256 - s.camX / 256, y: s.y / 256 - 22 }),
      label: (s) => `STAR ${s.stars ?? 0}!`,
      colour: () => "#FFD84A",
    },
    {
      kind: "pop",
      count: (s) => (s.ended === 0 ? (s.rocks ?? []).filter((r) => r.phase === 3).length : 0),
      at: (s) => ({ x: s.x / 256 - s.camX / 256, y: s.y / 256 - 22 }),
      label: () => "DODGED!",
    },
    {
      kind: "pop",
      count: (s) => (s.ended === 0 ? (s.jets ?? []).filter((j) => j.x < s.x - 20 * 256).length : 0),
      at: (s) => ({ x: s.x / 256 - s.camX / 256, y: s.y / 256 + 26 }),
      label: () => "OVER THE LAVA!",
    },
    {
      kind: "final",
      count: (s) => (s.ended === 1 && swingMetres(s) >= SWING_FINISH_M ? 1 : 0),
      label: (s) => ((s.chaseX ?? 0) !== 0 ? "500 M! DRAGON OUTRUN!" : "500 M!"),
    },
  ],
  misses: [{ count: (s) => (s.ended === 2 ? 1 : 0), at: (s) => ({ x: s.x / 256 - s.camX / 256, y: s.y / 256 }) }],
};

/* ================================ Orchard ================================ */

function snipCam(s: SnipState): number {
  // snipRev 11 has no horizontal camera.
  if (s.course) return 0;
  return snipCamera(s, s.sx / 256 - SNIP_CONFIG.viewW / 2, 1);
}
/** snipRev 11's vertical camera (0 on older rounds). */
function snipCamY(s: SnipState): number {
  return s.course ? (s.camY ?? 0) : 0;
}

export const SNIP_FX: ArcadeFxSpec<SnipState> = {
  game: "snip",
  world: "orchard",
  width: SNIP_CONFIG.viewW,
  height: SNIP_H,
  fit: "stretch",
  // Cuts are mapped through the camera; a shake would put the drawn rope 2 px off the cut line.
  shake: false,
  events: [
    {
      kind: "pop",
      count: (s) => s.stars + (s.stars2 ?? 0),
      at: (s) => ({ x: s.sx / 256 - snipCam(s), y: s.sy / 256 - snipCamY(s) }),
      label: () => "+LEAF",
    },
    {
      kind: "clear",
      // snipRev 11: a level with every fruit fed.
      count: (s) => (s.course ? (s.cleared ?? 0) : s.eaten),
      when: (s) => (s.course ? (s.cleared ?? 0) < SNIP_X_LEVELS : s.eaten < SNIP_CONFIG.levels),
      label: (s, n) => snipClearLabel(s) ?? `LEVEL ${n}!`,
    },
    {
      kind: "final",
      count: (s) => (s.course ? ((s.cleared ?? 0) >= SNIP_X_LEVELS ? 1 : 0) : s.eaten >= SNIP_CONFIG.levels ? 1 : 0),
      label: (s) => (s.course ? "EVERY FRUIT FED!" : "ALL 10 APPLES!"),
    },
    // snipRev 3 (springy branches exist only there): each bounce off one.
    { kind: "pop", count: (s) => s.springHits ?? 0, at: (s) => ({ x: s.sx / 256 - snipCam(s), y: s.sy / 256 - 16 - snipCamY(s) }), label: () => "BOING!" },
    // snipRev 11: a golden apple in the basket, and a ring's catch.
    { kind: "pop", count: (s) => s.golden ?? 0, at: (s) => { const c = s.course ? SNIP_COURSES[s.template] : undefined; return { x: c ? c.mouth[0] : s.sx / 256, y: (c ? c.mouth[1] - 40 : s.sy / 256) - snipCamY(s) }; }, label: () => "GOLDEN!" },
    { kind: "pop", count: (s) => (s.ringTick !== undefined && s.ringed ? s.ringTick : 0), at: (s) => ({ x: s.sx / 256, y: s.sy / 256 - 18 - snipCamY(s) }), label: () => "RINGED!" },
    // snipRev 11: a level fed every fruit at par cuts and under its par time.
    { kind: "pop", count: (s) => s.quickLevels ?? 0, at: (s) => { const c = SNIP_COURSES[s.order[Math.max(0, s.level - 1)] ?? s.template]; return { x: c ? c.mouth[0] : s.sx / 256, y: (c ? c.mouth[1] - 64 : s.sy / 256) - snipCamY(s) }; }, label: () => "QUICK!" },
  ],
  // A level that ended without the apple in the basket.
  misses: [{ count: (s) => (s.lastOutcome !== SNIP_EATEN && s.level > 0 ? s.endTick + 1 : 0), when: (s) => s.endTick >= 0 }],
};

/** snipRev 3: the level just fed names the orchard element it beat (older templates have none). */
function snipClearLabel(s: SnipState): string | null {
  const tpl = SNIP_CONFIG.templates[s.order[Math.max(0, s.level - 1)] ?? -1];
  if (!tpl) return null;
  // snipRev 5 crook levels: cut, caught, cut.
  if (tpl.hooks) return "HOOKED AND DROPPED!";
  if (tpl.slide) return "CAUGHT IN THE BASKET!";
  if (tpl.nests) return "PAST THE WASPS!";
  if (tpl.springs) return "BOUNCED IN!";
  if (tpl.gutters) return "DOWN THE GUTTER!";
  if (tpl.planks) return "ROLLED IN!";
  return null;
}

/* ================================ Toybox ================================ */

export const TILT_FX: ArcadeFxSpec<TiltState> = {
  game: "tilt",
  world: "toybox",
  width: TILT_WORLD_W,
  height: TILT_WORLD_H,
  events: [
    {
      kind: "clear",
      count: (s) => s.mazes,
      when: (s) => s.mazes < TILT_MAX_MAZES,
      label: (_s, n) => `MAZE ${n} DONE!`,
    },
    {
      kind: "final",
      count: (s) => (s.mazes >= TILT_MAX_MAZES ? 1 : 0),
      label: () => "ALL 4 MAZES!",
    },
    // tiltRev 2 (original rounds keep these at 0 / undefined): a bonus star, the first marble in its cup.
    { kind: "pop", count: (s) => s.stars ?? 0, at: (s) => tiltMarbleAt(s), label: () => "BONUS STAR!" },
    {
      kind: "pop",
      count: (s) => (s.b ? (s.aHome ?? 0) + (s.bHome ?? 0) : 0),
      when: (s) => !(s.aHome && s.bHome),
      at: () => ({ x: TILT_WORLD_W / 2, y: 60 }),
      label: (s) => (s.aHome ? "BLUE IN! NOW THE AMBER" : "AMBER IN! NOW THE BLUE"),
    },
  ],
  misses: [{ count: (s) => s.caught + (s.ended === 2 ? 1 : 0), at: (s) => tiltMarbleAt(s) }],
};

/** World point of the marble nearest the last star taken (rotated maze frame → screen), tiltRev 2. */
function tiltMarbleAt(s: TiltState): { x: number; y: number } {
  const m = s.list[Math.min(s.level, s.list.length - 1)]!;
  const o = (m.n * m.cs) / 2;
  const a = (s.angle / 65536) * Math.PI * 2;
  const ball = !s.aHome || !s.b ? { x: s.x, y: s.y } : s.b;
  const lx = (ball.x - o) / 256;
  const ly = (ball.y - o) / 256;
  return { x: 220 + Math.cos(a) * lx - Math.sin(a) * ly, y: 254 + Math.sin(a) * lx + Math.cos(a) * ly };
}

export const BALLTRACK_FX: ArcadeFxSpec<BtState> = {
  game: "balltrack",
  world: "toybox",
  width: BT_W,
  height: BT_H,
  fit: "world",
  events: [
    { kind: "streak", count: (s) => s.home, every: 5, label: (_s, n) => `${n} HOME` },
    { kind: "final", count: (s) => (s.home >= BT_BALLS ? 1 : 0), label: () => "ALL 30 HOME!" },
    // btRev 2 only: a marble home after riding a turned tube, or after passing a switch point.
    { kind: "pop", count: (s) => s.rideHomes ?? 0, label: () => "TURNED HOME!" },
    { kind: "pop", count: (s) => s.switchHomes ?? 0, label: () => "SWITCHED HOME!" },
  ],
  misses: [{ count: (s) => s.wrong + s.lost }],
};

/* ================================ Gemstone ================================ */

export const MATCHUP_FX: ArcadeFxSpec<MatchupState> = {
  game: "matchup",
  world: "gem",
  width: MATCHUP_WORLD_W,
  height: MATCHUP_WORLD_H,
  events: [
    // The board already labels "×n" where the chain lands; this adds the banner for long chains.
    {
      kind: "combo",
      count: (s) => s.cascades,
      when: (s) => s.lastSteps >= 3,
      at: matchupClearPoint,
      label: (s) => `CASCADE ×${s.lastSteps}`,
      textOnly: true,
    },
    // Tuning C: text pop-ups only over the gems; no particle bursts or rings there.
    { kind: "perfect", count: (s) => s.bestLine, min: 5, at: matchupClearPoint, label: (_s, n) => `${n} IN A LINE!`, textOnly: true },
    // matchupRev 2+: a Jackpot gem made (5 and an L/T in one swap) and one set off.
    { kind: "perfect", count: (s) => s.jackpots ?? 0, at: matchupJackpotPoint, label: () => "JACKPOT GEM!", colour: () => "#FFFFFF", textOnly: true },
    { kind: "combo", count: (s) => s.jackpotsFired ?? 0, at: matchupClearPoint, label: () => "JACKPOT!", textOnly: true },
    {
      kind: "final",
      count: (s) => (s.raw >= matchupParRaw(s) ? 1 : 0),
      label: () => "PAR SMASHED!",
    },
  ],
  // An invalid swap (no match): a puff between the two gems as they slide back.
  misses: [{ count: (s) => s.lastInvalidTick, when: (s) => s.lastInvalidA >= 0 && s.lastInvalidB >= 0, at: matchupInvalidPoint }],
};

/** All 22 arcade game specs: the 21 active games and practice-only Junction (Orbit counts once; rev 3 has its own view-sized spec). */
/**
 * Tuning E (Oct 2026): a game whose world height depends on the stored round
 * (High Rise, Meteor, Scrumper, Hover; taller worlds batch 1: Breaker, Rally,
 * Wavefront, Fission; batch 2: Tempo, Slice, Coral Pop; batch 3: Grappler, Orbit's view, Ball
 * Tracker) draws through its spec at that height;
 * events, colours and memory key are the spec's own. Cached per height.
 */
const specAtCache = new Map<string, ArcadeFxSpec<never>>();
export function fxSpecAt<S>(spec: ArcadeFxSpec<S>, height: number): ArcadeFxSpec<S> {
  if (height === spec.height) return spec;
  const key = `${spec.game}:${height}`;
  let hit = specAtCache.get(key) as ArcadeFxSpec<S> | undefined;
  if (!hit) {
    hit = { ...spec, height, ...(spec.clip ? { clip: { ...spec.clip, h: spec.clip.h + height - spec.height } } : {}) };
    specAtCache.set(key, hit as unknown as ArcadeFxSpec<never>);
  }
  return hit;
}
export const hoverFxFor = (s: HoverState): ArcadeFxSpec<HoverState> => fxSpecAt(HOVER_FX, hoverWorldH(s));
/** The specs live rooms deal today (Tuning E's taller worlds); stored rounds draw through fxSpecAt. */
export const HOVER_FX_TALL = fxSpecAt(HOVER_FX, HOVER_TALL_H);
/** hoverRev 9 (the 200 expansion): the 390 × 727 world rooms deal now. */
export const HOVER_FX_EXPAND = fxSpecAt(HOVER_FX, HOVER_EXPAND_H);
export const skylineFxFor = (s: SkylineState): ArcadeFxSpec<SkylineState> => fxSpecAt(SKYLINE_FX, skylineWorldH(s));
/** snakeRev 9 (expansion E2): the wider, taller world rooms deal. */
export const SNAKE_FX_V9: ArcadeFxSpec<SnakeState> = { ...SNAKE_FX, width: SNAKE_V9_WORLD_W, height: SNAKE_V9_H };
export const snakeFxFor = (s: SnakeState): ArcadeFxSpec<SnakeState> => (s.cols ? SNAKE_FX_V9 : fxSpecAt(SNAKE_FX, snakeWorldHFor(snakeRowsOf(s))));
export const SNAKE_FX_TALL = fxSpecAt(SNAKE_FX, SNAKE_TALL_H);
/** Roofbound flipRev 8's 730 px cave (the spec rooms deal today; earlier rounds draw through flipFxFor). */
export const FLIP_FX_TALL = fxSpecAt(FLIP_FX, FLIP_V8_WORLD_H);
export const snipFxFor = (s: SnipState): ArcadeFxSpec<SnipState> => fxSpecAt(SNIP_FX, snipWorldH(s));
export const SNIP_FX_TALL = fxSpecAt(SNIP_FX, SNIP_TALL_H);
export const SKYLINE_FX_TALL = fxSpecAt(SKYLINE_FX, SKYLINE_TALL_H);
/**
 * Expansion E4 (25 Oct 2026): High Rise skylineRev 7 (Tuning E's 390 × 735) and Pinball pinRev 4's taller table
 * (390 × 820), the worlds rooms deal. The same events as before (the replays' moment table); the games draw
 * their expansions' own specs (skyline.renderer.ts SKYLINE_FX_EXPAND, pinball4.renderer.ts PINBALL4_FX).
 */
export const SKYLINE_FX_SKY = fxSpecAt(SKYLINE_FX, SKYLINE_TALL_H);
/** Taller worlds batch 1 (Oct 2026): Breaker brkRev 6, Rally rallyRev 6, Wavefront wavRev 6, Fission burstRev 4. */
export const BREAKER_FX_TALL = fxSpecAt(BREAKER_FX, BRK_TALL_H);
export const RALLY_FX_TALL = fxSpecAt(RALLY_FX, RALLY_TALL_H);

/* Expansion E3 (25 Oct 2026, docs/expansions/e3.md): brkRev 9's 420 × 784 court. */
const E3_GOLD = "#FFD84A";
function deepRows(s: BrkState): number[][] {
  const cols = brkCols(s);
  return Array.from({ length: brkRowsOf(s) }, (_, r) => Array.from({ length: cols }, (_, c) => r * cols + c));
}
const deepRowClear = (s: BrkState, row: number[]) => row.every((i) => (s.bricks[i] ?? 0) <= 0 || brkIsGold(s, i));
/**
 * brkRev 9: the wider court. The live spec (ARCADE_FX_SPECS) serves every revision's replay moments and moment cues
 * (src/lib/replay/moments.ts), so the original events keep their order and read older states exactly as before;
 * the row and sliding-row counts read the 9-column wall only on brkRev 9 states, and the gold-brick and combo
 * moments come after them.
 */
export const BREAKER_FX_DEEP: ArcadeFxSpec<BrkState> = {
  ...BREAKER_FX,
  width: BRK_V9_W,
  height: BRK_V9_H,
  events: [
    ...BREAKER_FX.events.map((e) => {
      if (e.kind === "clear")
        return {
          ...e,
          count: (s: BrkState) => (s.deep ? deepRows(s).filter((row) => deepRowClear(s, row)).length : e.count(s)),
          at: (s: BrkState) => {
            if (!s.deep) return e.at?.(s) ?? null;
            const rows = deepRows(s);
            for (let r = rows.length - 1; r >= 0; r--) if (deepRowClear(s, rows[r]!)) return { x: brkWorldW(s) / 2, y: BRK_WALL_Y + r * BRK_ROW_PITCH + BRK_BRICK_H / 2 };
            return { x: brkWorldW(s) / 2, y: BRK_WALL_Y };
          },
        };
      if (e.count === brkSlideDestroyed)
        return {
          ...e,
          count: (s: BrkState) => (s.deep ? (s.slide ?? []).reduce((n, row) => n + (deepRows(s)[row] ?? []).filter((i) => (s.bricks[i] ?? 0) <= 0).length, 0) : brkSlideDestroyed(s)),
          at: (s: BrkState) => (s.deep ? { x: brkWorldW(s) / 2 + brkRowOffset(s, (s.slide ?? [])[0] ?? 0, s.tick), y: BRK_WALL_Y + ((s.slide ?? [])[0] ?? 0) * BRK_ROW_PITCH + BRK_BRICK_H / 2 } : (e.at?.(s) ?? null)),
        };
      return e;
    }),
    {
      kind: "perfect",
      count: (s) => s.goldBroken ?? 0,
      at: (s) => ({ x: s.paddleX, y: brkWorldH(s) - 110 }),
      label: () => "GOLD BRICK!",
      ...BREAKER_TEXT,
      colour: () => E3_GOLD,
      bulbs: { pattern: "chase", colours: [E3_GOLD, "#FFF3B0", "#B8860B"] },
    },
    {
      kind: "pop",
      count: (s) => s.comboUps ?? 0,
      at: (s) => ({ x: s.paddleX, y: brkWorldH(s) - 130 }),
      label: (s) => `COMBO ×${brkComboMultiplier(s.chain ?? 0)}`,
      ...BREAKER_TEXT,
      colour: () => E3_GOLD,
    },
  ],
};
/** The spec a stored round draws with: the expansion's own, else the stored height's. */
export const breakerFxFor = (s: BrkState): ArcadeFxSpec<BrkState> => (s.deep ? BREAKER_FX_DEEP : fxSpecAt(BREAKER_FX, brkWorldH(s)));
/**
 * Expansion E9 (26 Oct 2026, docs/expansions/e9.md): rallyRev 10's 420 × 784 court. The original events keep their
 * order and read older states as before; the gold bonus target's moment comes after them.
 */
export const RALLY_FX_BONUS: ArcadeFxSpec<RallyState> = {
  ...RALLY_FX,
  width: RALLY_V10_W,
  height: RALLY_V10_H,
  events: [
    ...RALLY_FX.events,
    {
      kind: "perfect",
      count: (s) => rallyBonusCount(s),
      at: (s) => {
        const at = s.bonusAt ?? 0;
        const t = (s.bonus ?? []).find((b) => at >= b.tick && at < b.tick + RALLY_V10_BONUS_LIFE);
        return t ? { x: t.x, y: t.y } : { x: RALLY_V10_W / 2, y: 120 };
      },
      label: () => `GOLD TARGET +${RALLY_V10_BONUS_PTS}`,
      textOnly: true,
      colour: () => "#FFD84A",
      bulbs: { pattern: "flash", colours: RALLY_GOLD_BULBS, heat: rallyHeat, strong: true },
    },
  ],
};
export const rallyFxFor = (s: RallyState): ArcadeFxSpec<RallyState> => (s.exp ? RALLY_FX_BONUS : fxSpecAt(RALLY_FX, rallyWorldH(s)));
export const wavefrontFxFor = (s: WavState): ArcadeFxSpec<WavState> => fxSpecAt(WAVEFRONT_FX, wavWorldH(s));
export const WAVEFRONT_FX_TALL = fxSpecAt(WAVEFRONT_FX, WAV_TALL_H);
export const burstFxFor = (s: BurstState): ArcadeFxSpec<BurstState> => (s.exp ? BURST_FX_CLEAN : fxSpecAt(BURST_FX, burstFloorY(s)));
export const BURST_FX_TALL = fxSpecAt(BURST_FX, BURST_TALL_H);
/**
 * Expansion E9 (26 Oct 2026, docs/expansions/e9.md): burstRev 8 keeps the 390 × 650 world; its golden atoms and
 * clean waves come after the original events (their text is the renderer's own pops, so these light the bulbs only).
 */
export const BURST_FX_CLEAN: ArcadeFxSpec<BurstState> = {
  ...BURST_FX_TALL,
  events: [
    ...BURST_FX_TALL.events,
    { kind: "perfect", count: (s) => burstGoldenCount(s), at: (s) => ({ x: s.popX / 256, y: s.popY / 256 }), label: () => null, textOnly: true, bulbs: { pattern: "flash", colours: COOL_LIGHTS } },
    { kind: "clear", count: (s) => s.cleanWaves ?? 0, at: (s) => ({ x: BURST_WORLD_W / 2, y: burstFloorY(s) / 2 }), label: () => null, textOnly: true, bulbs: { pattern: "flash", colours: COOL_LIGHTS, strong: true } },
  ],
};
/** Taller worlds batch 2 (Oct 2026): Tempo beatRev 6, Slice sliceRev 6, Coral Pop bubbleRev 5. */
export const beatFxFor = (s: BeatState): ArcadeFxSpec<BeatState> => fxSpecAt(BEAT_FX, beatWorldH(s));
export const BEAT_FX_TALL = fxSpecAt(BEAT_FX, BEAT_TALL_H);
/** World expansion E5 (25 Oct 2026, docs/expansions/e5.md): Swish binRev 7's world. Expansion E9: Flightpath bullRev 8's (its effects in the original sim coordinates, drawn lift px down). */
export const BULLSEYE_FX_V8: ArcadeFxSpec<BullseyeState> = { ...BULLSEYE_FX, height: 728 };
export const BINTOSS_FX_V7: ArcadeFxSpec<BinTossState> = { ...BINTOSS_FX, width: 430, height: 728 };
export const sliceFxFor = (s: SliceState): ArcadeFxSpec<SliceState> => fxSpecAt(SLICE_FX, sliceWorldH(s));
export const SLICE_FX_TALL = fxSpecAt(SLICE_FX, SLICE_TALL_H);
/** World expansion E5 (25 Oct 2026, docs/expansions/e5.md): Slice sliceRev 9's world (as the renderer's own v9 spec). */
export const SLICE_FX_V9: ArcadeFxSpec<SliceState> = { ...SLICE_FX, width: SLICE_V9_W, height: SLICE_V9_H };
export const bubbleFxFor = (s: BubState): ArcadeFxSpec<BubState> => fxSpecAt(BUBBLE_FX, bubWorldH(s));
export const BUBBLE_FX_TALL = fxSpecAt(BUBBLE_FX, BUB_TALL_H);
/** Taller worlds batch 3 (Oct 2026): Grappler swingRev 9, Orbit orbitRev 8 (its view), Ball Tracker btRev 4. */
export const SWING_FX_TALL = fxSpecAt(SWING_FX, SWING_TALL_H);
/**
 * Grappler swingRev 13 (the 200 expansion, docs/expansions/x200-swing.md): the wider, taller view, plus a pop for
 * each gem, lit gate and ledge landed, a streak on every combo point, a banner for each cleared set-route section,
 * and a pop for each section finished under its par time (counters the sim keeps).
 */
const swingAt = (s: SwingState, dy = -22) => ({ x: s.x / 256 - s.camX / 256, y: s.y / 256 + dy });
export const SWING_FX_V13: ArcadeFxSpec<SwingState> = {
  ...SWING_FX,
  width: SWING_V13_W,
  height: SWING_V13_H,
  events: [
    ...SWING_FX.events,
    { kind: "pop", count: (s) => swingFeatureCounts(s).gems, at: (s) => swingAt(s), label: () => "+GEM", colour: () => "#8FF4FF" },
    { kind: "pop", count: (s) => swingFeatureCounts(s).gates, at: (s) => swingAt(s, 26), label: () => "SPEED GATE!" },
    { kind: "pop", count: (s) => swingFeatureCounts(s).ledges, at: (s) => swingAt(s, -26), label: () => "LANDED!" },
    { kind: "streak", count: (s) => s.comboTiers ?? 0, at: (s) => swingAt(s, -40), label: (s) => `SWING COMBO ×${s.chain ?? 0}` },
    { kind: "perfect", count: (s) => swingFeatureCounts(s).sections, at: (s) => swingAt(s, -30), label: () => "SECTION CLEAR!", colour: () => "#FFD84A" },
    { kind: "pop", count: (s) => swingFeatureCounts(s).parsBeaten, at: (s) => swingAt(s, -54), label: (s) => swingParLabel(s), colour: () => "#FFE9A8" },
  ],
};
export const swingFxFor = (s: SwingState): ArcadeFxSpec<SwingState> => (s.expand ? SWING_FX_V13 : fxSpecAt(SWING_FX, swingWorldH(s)));
export const orbit3FxFor = (s: OrbitRev3State): ArcadeFxSpec<OrbitRev3State> => fxSpecAt(ORBIT3_FX, orbitViewH(s));
export const ORBIT3_FX_TALL = fxSpecAt(ORBIT3_FX, ORBIT_TALL_VIEW_H);
export const balltrackFxFor = (s: BtState): ArcadeFxSpec<BtState> => fxSpecAt(BALLTRACK_FX, btWorldH(s));
export const BALLTRACK_FX_TALL = fxSpecAt(BALLTRACK_FX, BT_TALL_H);

/* ================================ Pinball ================================ */

/** Pinball's border lights ripple out both ways from the edge nearest the hit: magenta, gold and cyan bands. */
export const PINBALL_BULBS = ["#FF4DFF", "#FFD84A", "#3DFFE0"] as const;
const PIN_RIPPLE = { pattern: "ripple", colours: PINBALL_BULBS } as const;

/** The bumper struck most recently (its centre), for where a bumper ripple starts. */
function pinLastBumper(s: PinState): { x: number; y: number } {
  let best = 0;
  for (let i = 1; i < PIN_BUMPERS.length; i++) if ((s.bumperAt[i] ?? -999) > (s.bumperAt[best] ?? -999)) best = i;
  const [x, y] = PIN_BUMPERS[best]!;
  return { x, y };
}

/** Where a target drop shows: the rightmost dropped target (the sim keeps no drop order). */
function pinTargetPoint(s: PinState): { x: number; y: number } {
  let x = PIN_TARGET_XS[0]!;
  for (let i = 0; i < PIN_TARGET_XS.length; i++) if ((s.targets >> i) & 1) x = PIN_TARGET_XS[i]!;
  return { x, y: PIN_TARGET_Y };
}

export const PINBALL_FX: ArcadeFxSpec<PinState> = {
  game: "pinball",
  world: "retro",
  width: PIN_WORLD_W,
  height: PIN_WORLD_H,
  fit: "world",
  events: [
    // Every bumper strike: the bumper flares neon (art) and the border ripples out from it.
    { kind: "pop", count: (s) => s.bumps, at: pinLastBumper, label: () => null, textOnly: true, bulbs: PIN_RIPPLE },
    { kind: "perfect", count: (s) => s.drops, at: pinTargetPoint, label: () => "TARGET!", textOnly: true, bulbs: PIN_RIPPLE },
    { kind: "clear", count: (s) => s.banks, at: () => ({ x: (PIN_TARGET_XS[0]! + PIN_TARGET_XS[3]!) / 2, y: PIN_TARGET_Y }), label: () => "BANK DOWN!", textOnly: true, neon: true, bulbs: { ...PIN_RIPPLE, strong: true } },
    { kind: "pop", count: (s) => s.laneLights, at: () => ({ x: (PIN_LANE_POSTS[0]! + PIN_LANE_POSTS[3]!) / 2, y: PIN_LANE_SENSOR_Y }), label: () => "LANE LIT", textOnly: true, bulbs: PIN_RIPPLE },
    { kind: "streak", count: (s) => s.laneSets, at: () => ({ x: (PIN_LANE_POSTS[0]! + PIN_LANE_POSTS[3]!) / 2, y: PIN_LANE_SENSOR_Y + 30 }), label: (s) => `MULTIPLIER x${s.mult}`, textOnly: true, neon: true, bulbs: { ...PIN_RIPPLE, strong: true } },
    { kind: "combo", count: (s) => s.spins, minDelta: 8, at: () => ({ x: (PIN_LEFT_WALL + PIN_ORBIT_INNER) / 2 + 30, y: PIN_SPINNER_Y }), label: () => "SPINNER!", textOnly: true, bulbs: PIN_RIPPLE },
  ],
  misses: [{ count: (s) => s.lost, at: () => ({ x: PIN_WORLD_W / 2, y: PIN_WORLD_H - 24 }) }],
};

export const ARCADE_FX_SPECS = {
  hover: HOVER_FX_EXPAND,
  breaker: BREAKER_FX_DEEP,
  rally: RALLY_FX_BONUS,
  beat: BEAT_FX_TALL,
  snake: SNAKE_FX_V9,
  burst: BURST_FX_CLEAN,
  wavefront: WAVEFRONT_FX_TALL,
  // The live round's view (orbitRev 8); rev 1/2 rounds draw through ORBIT_FX and rev 3–7 through ORBIT3_FX.
  orbit: fxSpecAt(ORBIT_FX, ORBIT_TALL_VIEW_H),
  skyline: SKYLINE_FX_SKY,
  cross: CROSS_FX,
  junction: JUNCTION_FX,
  inkbridge: INKBRIDGE_FX,
  slice: SLICE_FX_V9,
  bintoss: BINTOSS_FX_V7,
  bullseye: BULLSEYE_FX_V8,
  bubble: BUBBLE_FX_TALL,
  flip: FLIP_FX_TALL,
  // The live round's view (swingRev 13, the 200 expansion); older rounds draw through swingFxFor.
  swing: SWING_FX_V13,
  // The live round's view (snipRev 11); older rounds draw through their state's spec (snipFxFor).
  snip: fxSpecAt(SNIP_FX, SNIP_X_VIEW_H),
  tilt: TILT_FX,
  // Expansion E6: the worlds rooms deal now (Ball Tracker's 13-row board, Gemstone's 720 px world).
  balltrack: fxSpecAt(BALLTRACK_FX, BT_V7_H),
  matchup: fxSpecAt(MATCHUP_FX, MATCHUP_V9_WORLD_H),

  pinball: fxSpecAt(PINBALL_FX, 820),
} satisfies Record<ArcadeFxGame, ArcadeFxSpec<never>>;

/* ============================ Engine word games ============================ */

/** Letterfall: a pop names each word, longer words get the bigger burst, par gets the finale. */
export const WORDFALL_FX: ArcadeFxSpec<WordfallState> = {
  game: "wordfall",
  world: "toybox",
  width: WF_W,
  height: WF_H,
  events: [
    {
      kind: "pop",
      count: (s) => s.words,
      when: (s) => wfWord(s.lastWord).length < 6,
      at: () => ({ x: WF_W / 2, y: WF_WELL_Y + 120 }),
      label: (s) => `${wfWord(s.lastWord).toUpperCase()}!`,
    },
    {
      kind: "perfect",
      count: (s) => s.words,
      when: (s) => wfWord(s.lastWord).length >= 6,
      at: () => ({ x: WF_W / 2, y: WF_WELL_Y + 120 }),
      label: (s) => `${wfWord(s.lastWord).length} LETTERS!`,
    },
    { kind: "final", count: (s) => (s.points >= WF_PAR ? 1 : 0), label: () => "PAR REACHED!" },
  ],
};

/** wordfallRev 2's taller world (the Enter box under the well); stored rev-1 rounds keep WORDFALL_FX. */
export const WORDFALL_FX_TALL = fxSpecAt(WORDFALL_FX, WF_H_V2);
export const wordfallFxFor = (s: WordfallState): ArcadeFxSpec<WordfallState> => fxSpecAt(WORDFALL_FX, wfWorldH(s));

/** Specs for ENGINE_GAME_WORLDS, keyed the same way (the worlds rooms deal today). */
export const ENGINE_FX_SPECS = {
  wordfall: WORDFALL_FX_TALL,
} satisfies Record<EngineFxGame, ArcadeFxSpec<never>>;
