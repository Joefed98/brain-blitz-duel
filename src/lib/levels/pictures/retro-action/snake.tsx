/**
 * Meteor's lever pictures (D5's ladder, 23 Nov 2026; the lever is the rocks on the field): drawn from the level's own
 * settings (SNAKE_LEVELS_V16 in src/lib/arcade/retroLevels.ts, the table the sim reads), never hand-placed: the field's
 * shape (19 × 34 squares on snakeRev 16), the rocks already down at the start (spread over the field by a fixed
 * golden-angle walk, one dot a rock), the timed rocks' most as faint rings, walls (a solid border) or wrapping edges (a
 * dashed one), the comet and a star. Normal is snakeRev 16 as rooms deal it: no rock at the start, rocks earned as the
 * comet grows (snake.ts SNAKE_ROCK_MAX_V6, 11), edges wrapping; its numbers are mirrored here so the Games page never
 * loads the sim.
 */
import { SNAKE_LEVELS_V16, type SnakeLv16 } from "@/lib/arcade/retroLevels";
import type { Level } from "@/lib/levels/levels";

/** The picture slot's props (P2's LeverPictureProps, declared here until that slot is on main). */
interface LeverPictureProps {
  level: Level;
  size: "l" | "s";
}

/** snakeRev 16's Normal (snake.ts): the field (SNAKE_V9_COLS × SNAKE_V9_ROWS), rocks earned up to SNAKE_ROCK_MAX_V6, wrapping edges. */
const COLS = 19;
const ROWS = 34;
const NORMAL_EARNED = 11;

/** The level's settings: Normal's when the table has none. */
function settingsAt(level: Level): SnakeLv16 {
  if (level === "normal") return { lives: 2, stepStart: 9, stepMin: 4, walls: 0, fullAt: 36, rocksAtStart: 0, rockEvery: 0, rockFrom: 0, rockMax: NORMAL_EARNED, shower: 1, goldPct: 0, comboFull: 0, laneFull: 0, warpFull: 0 };
  return SNAKE_LEVELS_V16[level];
}

/** The k-th of n points spread over the field (a golden-angle walk from the centre; the same for every render). */
function spread(k: number, n: number, w: number, h: number): { x: number; y: number } {
  const a = k * 2.399963229728653;
  const r = Math.sqrt((k + 0.5) / Math.max(1, n));
  return { x: w / 2 + Math.cos(a) * r * (w / 2 - 4), y: h / 2 + Math.sin(a) * r * (h / 2 - 4) };
}

export function SnakePicture({ level, size }: LeverPictureProps) {
  const lv = settingsAt(level);
  const H = size === "l" ? 112 : 80;
  const cell = (H - 8) / ROWS;
  const W = COLS * cell;
  const x0 = 4;
  const y0 = 4;
  const R = Math.max(1.4, cell * 0.55);
  const rocks = [];
  for (let k = 0; k < lv.rocksAtStart; k++) {
    const p = spread(k, Math.max(lv.rocksAtStart, 8), W, H - 8);
    rocks.push(<circle key={`r${k}`} cx={x0 + p.x} cy={y0 + p.y} r={R} fill="var(--jz-text-2)" />);
  }
  // The timed (or earned) rocks still to come: faint rings after the ones already down.
  const later = Math.max(0, lv.rockMax - lv.rocksAtStart);
  for (let k = 0; k < later; k++) {
    const p = spread(lv.rocksAtStart + k, Math.max(lv.rockMax, 8), W, H - 8);
    rocks.push(<circle key={`t${k}`} cx={x0 + p.x} cy={y0 + p.y} r={R} fill="none" stroke="var(--jz-text-3)" strokeWidth={0.8} />);
  }
  const headX = x0 + W / 2;
  const headY = y0 + (H - 8) / 2;
  return (
    <svg viewBox={`0 0 ${W + 8} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-snake-picture={level}>
      <rect x={x0} y={y0} width={W} height={H - 8} rx={2} fill="var(--jz-well)" stroke={lv.walls ? "var(--jz-red)" : "var(--jz-line)"} strokeWidth={lv.walls ? 2 : 1} strokeDasharray={lv.walls ? undefined : "3 2"} />
      {rocks}
      <line x1={headX} y1={headY} x2={headX} y2={headY + cell * 5} stroke="var(--jz-gold)" strokeWidth={cell * 0.9} strokeLinecap="round" />
      <circle cx={headX} cy={headY} r={cell * 0.7} fill="var(--jz-white)" />
      <circle cx={headX + cell * 4} cy={headY - cell * 6} r={cell * 0.55} fill="var(--jz-cyan)" />
    </svg>
  );
}

/** The lever in a few words, from the same settings. */
export function snakeWords(level: Level): string {
  const lv = settingsAt(level);
  if (level === "normal") return "Rocks fall as you grow";
  if (lv.rockMax === 0) return "No rocks, edges wrap";
  return `${lv.rocksAtStart} rocks down, walls`;
}
