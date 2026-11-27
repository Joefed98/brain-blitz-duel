/**
 * Breaker's lever pictures (P2, 22 Nov 2026: the worked example for the lever-picture slot, src/lib/levels/leverPicture.tsx).
 * Drawn from the level's own settings: the wall's rows and the tough rows (BREAKER_LEVELS in src/lib/arcade/retroLevels.ts,
 * the table the sim reads), softer bricks on Easy, and the paddle's width as a share of the world's. Normal is brkRev 12
 * as rooms deal it: nine rows (BRK_V12_ROWS), nine columns (BRK_V9_COLS) and an 84 px paddle (BRK_PADDLE_W) in a 390 px
 * world (BRK_WORLD_W), mirrored here so the Games page never loads the sim. D5 leaves Breaker out of its own file.
 */
import { BREAKER_LEVELS, type BreakerLv } from "@/lib/arcade/retroLevels";
import type { Level } from "@/lib/levels/levels";

import type { LeverPictureProps, LeverPictures } from "../leverPicture";

/** brkRev 12's Normal: today's game (breaker.ts BRK_V12_ROWS, BRK_V9_COLS, BRK_PADDLE_W, BRK_WORLD_W). */
const NORMAL_ROWS = 9;
const COLS = 9;
const NORMAL_PADDLE = 84;
const WORLD_W = 390;

/** A row's colour: the arcade's rainbow wall, from the player palette's tokens. */
const ROW_COLOURS = ["--jz-player-2", "--jz-player-1", "--jz-player-0", "--jz-player-8", "--jz-player-7", "--jz-player-6", "--jz-player-4", "--jz-player-3", "--jz-player-2"];

/** The level's settings, Normal's when the table has none. */
function settingsAt(level: Level): BreakerLv {
  if (level === "normal") return { speedPct: 100, paddle: NORMAL_PADDLE, rows: NORMAL_ROWS, cap2: 0, toughRows: 0 };
  return BREAKER_LEVELS[level];
}

function BreakerPicture({ level, size }: LeverPictureProps) {
  const lv = settingsAt(level);
  const W = 180;
  const H = size === "l" ? 112 : 80;
  const pad = 8;
  const gap = 2;
  const brickW = (W - pad * 2 - gap * (COLS - 1)) / COLS;
  const brickH = size === "l" ? 6 : 5;
  const paddleW = ((W - pad * 2) * lv.paddle) / WORLD_W;
  const bricks = [];
  for (let row = 0; row < lv.rows; row++) {
    const tough = row < lv.toughRows;
    for (let col = 0; col < COLS; col++) {
      bricks.push(
        <rect
          key={`${row}-${col}`}
          x={pad + col * (brickW + gap)}
          y={pad + row * (brickH + gap)}
          width={brickW}
          height={brickH}
          rx={1}
          fill={`var(${ROW_COLOURS[row % ROW_COLOURS.length]})`}
          opacity={lv.cap2 ? 0.7 : 1}
          stroke={tough ? "var(--jz-text)" : undefined}
          strokeWidth={tough ? 1 : undefined}
        />,
      );
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-breaker-picture={level}>
      {bricks}
      <rect x={(W - paddleW) / 2} y={H - 10} width={paddleW} height={4} rx={2} fill="var(--jz-gold)" />
    </svg>
  );
}

/** The lever in a few words, from the same settings. */
function breakerWords(level: Level): string {
  const lv = settingsAt(level);
  if (level === "normal") return `${lv.rows} rows of bricks`;
  const paddle = lv.paddle > NORMAL_PADDLE ? "A wider paddle" : lv.paddle < NORMAL_PADDLE ? "A narrower paddle" : "Normal's paddle";
  if (lv.cap2) return `${paddle}, softer bricks`;
  if (lv.toughRows >= lv.rows) return `${paddle}, every row tougher`;
  if (lv.toughRows > 0) return `${paddle}, ${lv.toughRows} tougher rows`;
  return paddle;
}

export const LEVER_PICTURES: LeverPictures = {
  breaker: { Picture: BreakerPicture, words: breakerWords },
};
