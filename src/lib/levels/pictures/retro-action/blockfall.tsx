/**
 * Blockzone's lever picture (D5's ladder, 23 Nov 2026; docs/arcade-standard/blockfall.md "Levels (D5, 23 Nov 2026)"): how
 * fast the pieces fall, the level's headline lever. Drawn from the level's own row of BLOCKFALL_LEVELS_V3
 * (src/lib/arcade/retroLevels.ts, the table the sim reads): the well, a piece at its top and the drop it makes in its
 * first second at the level's starting gravity (a row every 72, 48, 12 or 7 ticks), and the previews the level shows
 * beside it. Normal is blockfallRev 2 as rooms deal it: a row every 48 ticks at the start (blockfall.ts BF_ZONE_GRAVITY)
 * and three previews (BF_PREVIEW), mirrored here so the Games page never loads the sim. Colours only through the design
 * tokens.
 */
import { BLOCKFALL_LEVELS_V3 } from "@/lib/arcade/retroLevels";
import type { Level } from "@/lib/levels/levels";

/** The lever picture's props (P2's slot, src/lib/levels/leverPicture.tsx, declares the same shape). */
export interface BlockfallPictureProps {
  level: Level;
  size: "l" | "s";
}

/** blockfallRev 2's Normal: a row every 48 ticks at the start, three previews; the well 10 × 20. */
const NORMAL_TICKS_A_ROW = 48;
const NORMAL_PREVIEWS = 3;
const ROWS = 20;
const COLS = 10;

/** The level's starting ticks a row and previews (Normal's when the table has none). */
function settingsAt(level: Level): { ticks: number; previews: number } {
  if (level === "normal") return { ticks: NORMAL_TICKS_A_ROW, previews: NORMAL_PREVIEWS };
  const lv = BLOCKFALL_LEVELS_V3[level];
  return { ticks: Math.max(1, Math.round((NORMAL_TICKS_A_ROW * lv.gravityPct) / 100)), previews: lv.previews };
}

export function BlockfallPicture({ level, size }: BlockfallPictureProps) {
  const s = settingsAt(level);
  const W = 180;
  const H = size === "l" ? 112 : 80;
  const pad = 6;
  const cell = (H - pad * 2) / ROWS;
  const wellW = cell * COLS;
  const wellX = (W - wellW) / 2 - 18;
  // The rows the piece falls in its first second (60 ticks), up to the well's floor.
  const rows = Math.min(ROWS - 3, 60 / s.ticks);
  const pieceCol = 4;
  const top = pad + cell;
  const parts = [];
  parts.push(<rect key="well" x={wellX} y={pad} width={wellW} height={ROWS * cell} fill="var(--jz-well)" stroke="var(--jz-cyan)" strokeWidth={1} rx={1} />);
  // The piece (a tee) at the top, and where it is a second later, faint, with the drop between.
  const tee = (y: number, key: string, opacity: number) =>
    [[0, 1], [1, 1], [2, 1], [1, 0]].map(([dx, dy]) => (
      <rect key={`${key}-${dx}-${dy}`} x={wellX + (pieceCol + dx!) * cell} y={y + dy! * cell} width={cell - 0.5} height={cell - 0.5} fill="var(--jz-player-4)" opacity={opacity} />
    ));
  parts.push(...tee(top, "now", 1));
  parts.push(...tee(top + rows * cell, "later", 0.35));
  parts.push(<line key="drop" x1={wellX + (pieceCol + 1.5) * cell} y1={top + 2 * cell} x2={wellX + (pieceCol + 1.5) * cell} y2={top + rows * cell} stroke="var(--jz-gold)" strokeWidth={1.5} strokeDasharray="2 2" />);
  // The previews, a column of small boxes right of the well.
  for (let i = 0; i < s.previews; i++) {
    parts.push(<rect key={`next-${i}`} x={wellX + wellW + 8} y={pad + i * 15} width={22} height={12} rx={2} fill="var(--jz-surface)" stroke="var(--jz-cyan)" strokeWidth={1} />);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-blockfall-picture={level} data-ticks-a-row={s.ticks} data-previews={s.previews}>
      {parts}
    </svg>
  );
}

/** The lever in a few words, from the same settings: how long the first piece takes to fall the well. */
export function blockfallWords(level: Level): string {
  const s = settingsAt(level);
  const secs = (ROWS * s.ticks) / 60;
  const shown = Number.isInteger(secs) ? `${secs}` : secs.toFixed(1);
  return `Falls the well in ${shown} s, ${s.previews} next`;
}
