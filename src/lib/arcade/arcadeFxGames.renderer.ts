/**
 * Success-event declarations for the 22 active arcade games, read by the shared
 * layer in arcadeFx.renderer.ts. Every `count`/`at`/`when` below is a pure read
 * of a counter or position the sim already keeps for its own rules; nothing here
 * changes a sim, an input or a score. Pops show counter facts ("+1", "×3",
 * "LEVEL 4!"), never points, so nothing on screen can disagree with the stored
 * score. Coordinates are in each game's world (or view) units.
 */
import type { ArcadeFxSpec, ArcadeWorld } from "./arcadeFx.renderer";
import { px } from "./engine";

import { HOVER_DISC_X, HOVER_WORLD_H, HOVER_WORLD_W, type HoverState } from "./hover";
import {
  BRK_BRICK_H,
  BRK_BRICK_W,
  BRK_COLS,
  BRK_ROWS,
  BRK_ROW_PITCH,
  BRK_WALL_X,
  BRK_WALL_Y,
  BRK_WORLD_H,
  BRK_WORLD_W,
  brkDestroyed,
  type BrkState,
} from "./breaker";
import { RALLY_PADDLE_Y, RALLY_WORLD_H, RALLY_WORLD_W, type RallyState } from "./rally";
import { BEAT_HIT_LINE_Y, BEAT_WORLD_H, BEAT_WORLD_W, beatLaneX, type BeatState } from "./beat";
import {
  SNAKE_BOARD_X,
  SNAKE_BOARD_Y,
  SNAKE_CELL,
  SNAKE_WORLD_H,
  SNAKE_WORLD_W,
  snakeCol,
  snakeRow,
  type SnakeState,
} from "./snake";
import { BURST_FLOOR_Y, BURST_LIVES, BURST_WORLD_W, type BurstState } from "./burst";
import { SKYLINE_WORLD_H, SKYLINE_WORLD_W, type SkylineState } from "./skyline";
import { CROSS_HUD_H, CROSS_WORLD_H, CROSS_WORLD_W, type CrossState } from "./cross";
import { JUNC_WORLD_H, JUNC_WORLD_W, type JuncState } from "./junction";
import { INK_LEVELS, INK_WORLD_H, INK_WORLD_W, type InkState } from "./inkBridge";
import { WAV_SHIP_Y, WAV_WORLD_H, WAV_WORLD_W, type WavState } from "./wavefront";
import { ORBIT_WORLD_H, ORBIT_WORLD_W, type OrbitState } from "./orbit";
import { ORBIT_CAM_VIEW_H, ORBIT_CAM_VIEW_W } from "./orbitCamera";
import type { OrbitRev3State } from "./orbitRev3";
import {
  SWING_FINISH_M,
  SWING_WORLD_H,
  SWING_WORLD_W,
  swingMetres,
  type SwingState,
} from "./swing";
import { FLIP_WORLD_H, FLIP_WORLD_W, type FlipState } from "./flip";
import { BINTOSS_THROWS, BINTOSS_WORLD_H, BINTOSS_WORLD_W, type BinTossState } from "./binToss";
import {
  BULLSEYE_ARROWS,
  BULLSEYE_CX,
  BULLSEYE_CY,
  BULLSEYE_WORLD_H,
  BULLSEYE_WORLD_W,
  type BullseyeState,
} from "./bullseye";
import { SLICE_WORLD_H, SLICE_WORLD_W, sliceMultiplier, type SliceState } from "./slice";
import { BUB_WORLD_H, BUB_WORLD_W, type BubState } from "./bubble";
import { SNIP_CONFIG, SNIP_H, snipCamera, type SnipState } from "./snip";
import { TILT_MAX_MAZES, TILT_WORLD_H, TILT_WORLD_W, type TiltState } from "./tilt";
import { BT_BALLS, BT_H, BT_W, type BtState } from "./ballTrack";
import { MATCHUP_PAR_RAW, MATCHUP_WORLD_H, MATCHUP_WORLD_W, type MatchupState } from "./matchup";

/** Which world each active arcade game belongs to (docs/duelz-game-bank.md). */
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
} as const satisfies Record<string, ArcadeWorld>;

export type ArcadeFxGame = keyof typeof ARCADE_GAME_WORLDS;

export function arcadeWorldOf(type: string): ArcadeWorld | null {
  return (ARCADE_GAME_WORLDS as Record<string, ArcadeWorld>)[type] ?? null;
}

/* ================================ Retro ================================ */

export const HOVER_FX: ArcadeFxSpec<HoverState> = {
  game: "hover",
  world: "retro",
  width: HOVER_WORLD_W,
  height: HOVER_WORLD_H,
  fit: "world",
  events: [
    // Every seventh barrier changes colour: a new "zone" reached.
    {
      kind: "streak",
      count: (s) => s.gates,
      every: 7,
      at: (s) => ({ x: px(HOVER_DISC_X), y: px(s.y) }),
      label: (_s, n) => `ZONE ${Math.floor(n / 7) + 1}`,
    },
    {
      kind: "final",
      count: (s) => (s.totalGates > 0 && s.gates >= s.totalGates ? 1 : 0),
      at: (s) => ({ x: px(HOVER_DISC_X), y: px(s.y) }),
    },
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
      at: (s) => ({ x: s.paddleX, y: BRK_WORLD_H - 80 }),
      label: () => "POWER-UP!",
    },
    {
      kind: "streak",
      count: (s) => brkDestroyed(s),
      every: 10,
      at: (s) => ({ x: s.paddleX, y: BRK_WORLD_H - 90 }),
      label: (_s, n) => `${n} BRICKS`,
    },
    { kind: "clear", count: brkRowsCleared, at: lowestClearedRow, label: () => "ROW CLEAR!" },
    { kind: "final", count: (s) => (s.cleared ? 1 : 0), label: () => "WALL CLEARED!" },
  ],
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
      at: (s) => ({ x: px(s.x), y: RALLY_PADDLE_Y - 8 }),
      label: (_s, n) => `RALLY ${n}`,
    },
    {
      kind: "pop",
      count: (s) => s.goldHits,
      at: (s) => ({ x: s.paddleX, y: RALLY_PADDLE_Y - 10 }),
      label: () => "GOLD!",
    },
  ],
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
      at: (s) => ({ x: beatLaneX(Math.max(0, s.lastLane)), y: BEAT_HIT_LINE_Y }),
      label: (_s, n) => `COMBO ${n}`,
    },
    {
      kind: "final",
      count: (s) => (s.chart.ticks.length > 0 && s.maxCombo >= s.chart.ticks.length ? 1 : 0),
      label: () => "FULL COMBO!",
    },
  ],
};

function snakeHead(s: SnakeState): { x: number; y: number } {
  const cell = s.body[0] ?? 0;
  return {
    x: SNAKE_BOARD_X + snakeCol(cell) * SNAKE_CELL + SNAKE_CELL / 2,
    y: SNAKE_BOARD_Y + snakeRow(cell) * SNAKE_CELL + SNAKE_CELL / 2,
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
      label: (_s, n) => `${n} PELLETS`,
    },
    {
      kind: "final",
      count: (s) => (s.queue.length > 0 && s.eaten >= s.queue.length ? 1 : 0),
      at: snakeHead,
      label: () => "ALL EATEN!",
    },
  ],
};

export const BURST_FX: ArcadeFxSpec<BurstState> = {
  game: "burst",
  world: "retro",
  width: BURST_WORLD_W,
  height: BURST_FLOOR_Y,
  fit: "world",
  events: [
    { kind: "clear", count: (s) => s.cleared, label: (_s, n) => `WAVE ${n} CLEARED` },
    // Mirrors the sim's own top-up condition (burstScoreOf): finished, no life lost, 4+ waves.
    {
      kind: "final",
      count: (s) => (s.ended === 1 && s.lives === BURST_LIVES && s.cleared >= 4 ? 1 : 0),
      label: () => "FLAWLESS!",
    },
  ],
};

/* ================================ Space ================================ */

export const WAVEFRONT_FX: ArcadeFxSpec<WavState> = {
  game: "wavefront",
  world: "space",
  width: WAV_WORLD_W,
  height: WAV_WORLD_H,
  events: [
    {
      kind: "perfect",
      count: (s) => s.saucers,
      at: (s) => ({ x: px(s.saucerX), y: 70 }),
      label: () => "SAUCER!",
    },
    {
      kind: "clear",
      count: (s) => s.wavesCleared,
      at: (s) => ({ x: s.shipX, y: WAV_SHIP_Y - 30 }),
      label: (_s, n) => `WAVE ${n} CLEARED`,
    },
    { kind: "final", count: (s) => (s.wavesCleared >= 5 ? 1 : 0), label: () => "ALL WAVES!" },
  ],
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

export const ORBIT_FX: ArcadeFxSpec<OrbitState> = {
  game: "orbit",
  world: "space",
  width: ORBIT_WORLD_W,
  height: ORBIT_WORLD_H,
  events: orbitEvents,
};
export const ORBIT3_FX: ArcadeFxSpec<OrbitRev3State> = {
  game: "orbit3",
  world: "space",
  width: ORBIT_CAM_VIEW_W,
  height: ORBIT_CAM_VIEW_H,
  events: orbitEvents,
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
      at: () => ({ x: SKYLINE_WORLD_W / 2, y: SKYLINE_WORLD_H * 0.42 }),
      label: () => null,
    },
    { kind: "streak", count: (s) => s.placed, every: 10, label: (_s, n) => `${n} FLOORS` },
  ],
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
  ],
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
  ],
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
      kind: "final",
      count: (s) => (s.levels >= INK_LEVELS ? 1 : 0),
      label: () => "ALL 10 LEVELS!",
    },
  ],
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
  ],
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
      kind: "final",
      count: (s) => (s.baskets >= BINTOSS_THROWS ? 1 : 0),
      label: () => "TEN OUT OF TEN!",
    },
  ],
};

function bullRun(s: BullseyeState): number {
  if (s.flightTick !== 0) return 0;
  let run = 0;
  for (let i = s.hits.length - 1; i >= 0 && s.hits[i]!.ring === 0; i--) run += 1;
  return run;
}

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
      count: (s) => (s.flightTick === 0 ? s.hits.filter((h) => h.ring === 0).length : 0),
      at: (s) => ({ x: s.hits.at(-1)?.x ?? BULLSEYE_CX, y: s.hits.at(-1)?.y ?? BULLSEYE_CY }),
      label: () => "BULLSEYE!",
    },
    { kind: "combo", count: bullRun, min: 2, label: (_s, n) => `${n} BULLS IN A ROW` },
    {
      kind: "final",
      count: (s) =>
        s.flightTick === 0 && s.hits.length >= BULLSEYE_ARROWS && s.hits.every((h) => h.ring >= 0)
          ? 1
          : 0,
      label: () => "ALL TEN ON TARGET!",
    },
  ],
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
    { kind: "final", count: (s) => (s.cleared ? 1 : 0), label: () => "REEF CLEARED!" },
  ],
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
  ],
};

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
    {
      kind: "final",
      count: (s) => (s.ended === 1 && swingMetres(s) >= SWING_FINISH_M ? 1 : 0),
      label: () => "500 M!",
    },
  ],
};

/* ================================ Orchard ================================ */

function snipCam(s: SnipState): number {
  return snipCamera(s, s.sx / 256 - SNIP_CONFIG.viewW / 2, 1);
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
      count: (s) => s.stars,
      at: (s) => ({ x: s.sx / 256 - snipCam(s), y: s.sy / 256 }),
      label: () => "+LEAF",
    },
    {
      kind: "clear",
      count: (s) => s.eaten,
      when: (s) => s.eaten < SNIP_CONFIG.levels,
      label: (_s, n) => `LEVEL ${n}!`,
    },
    {
      kind: "final",
      count: (s) => (s.eaten >= SNIP_CONFIG.levels ? 1 : 0),
      label: () => "ALL 10 APPLES!",
    },
  ],
};

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
  ],
};

export const BALLTRACK_FX: ArcadeFxSpec<BtState> = {
  game: "balltrack",
  world: "toybox",
  width: BT_W,
  height: BT_H,
  fit: "world",
  events: [
    { kind: "streak", count: (s) => s.home, every: 5, label: (_s, n) => `${n} HOME` },
    { kind: "final", count: (s) => (s.home >= BT_BALLS ? 1 : 0), label: () => "ALL 30 HOME!" },
  ],
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
      label: (s) => `CASCADE ×${s.lastSteps}`,
    },
    { kind: "perfect", count: (s) => s.bestLine, min: 5, label: (_s, n) => `${n} IN A LINE!` },
    {
      kind: "final",
      count: (s) => (s.raw >= MATCHUP_PAR_RAW ? 1 : 0),
      label: () => "PAR SMASHED!",
    },
  ],
};

/** All 22 game specs (Orbit counts once; rev 3 has its own view-sized spec). */
export const ARCADE_FX_SPECS = {
  hover: HOVER_FX,
  breaker: BREAKER_FX,
  rally: RALLY_FX,
  beat: BEAT_FX,
  snake: SNAKE_FX,
  burst: BURST_FX,
  wavefront: WAVEFRONT_FX,
  orbit: ORBIT_FX,
  skyline: SKYLINE_FX,
  cross: CROSS_FX,
  junction: JUNCTION_FX,
  inkbridge: INKBRIDGE_FX,
  slice: SLICE_FX,
  bintoss: BINTOSS_FX,
  bullseye: BULLSEYE_FX,
  bubble: BUBBLE_FX,
  flip: FLIP_FX,
  swing: SWING_FX,
  snip: SNIP_FX,
  tilt: TILT_FX,
  balltrack: BALLTRACK_FX,
  matchup: MATCHUP_FX,
} satisfies Record<ArcadeFxGame, ArcadeFxSpec<never>>;
