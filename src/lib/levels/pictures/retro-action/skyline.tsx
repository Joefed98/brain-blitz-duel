/**
 * High Rise's lever picture (D5, 23 Nov 2026; docs/arcade-standard/skyline.md "Levels (D5, 23 Nov 2026)"): the lever is
 * the width of the blocks. Drawn from the level's own settings (GAME_LEVELS.skyline, the display copy of the sim's
 * SKYLINE_V12_LEVEL_RULES): a short tower and the sliding block above it at the level's start width as a share of the
 * 390 px world, the wind flag on the top block where the wind blows from the first block, and the slide's arrow longer
 * the faster the block starts. Normal is skylineRev 12 as rooms deal it: 200 px blocks (SKYLINE_START_W), slide 3 px a
 * tick (SKYLINE_SPEED_START), wind from block 20, mirrored here so the Games page never loads the sim. Colours through
 * the design tokens only.
 */
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { Level } from "@/lib/levels/levels";

/** The props of the lever-picture slot (declared here: P2's slot isn't on main yet). */
export interface SkylinePictureProps {
  level: Level;
  size: "l" | "s";
}

/** skylineRev 12's Normal: today's game (skyline.ts SKYLINE_START_W, SKYLINE_SPEED_START, SKYLINE_WIND_FROM). */
const NORMAL = { startW: 51_200, speedStart: 768, windFrom: 20 as number | null };
const WORLD_W_FP = 99_840;

interface SkylineLook {
  startW: number;
  speedStart: number;
  windFrom: number | null;
}

/** The level's settings that show (Normal's when the table has none). */
function settingsAt(level: Level): SkylineLook {
  const s = gameLevelSettings<SkylineLook>("skyline", level);
  return s ? { startW: s.startW, speedStart: s.speedStart, windFrom: s.windFrom } : NORMAL;
}

export function SkylinePicture({ level, size }: SkylinePictureProps) {
  const lv = settingsAt(level);
  const W = 180;
  const H = size === "l" ? 112 : 80;
  const pad = 8;
  const span = W - pad * 2;
  const blockW = (span * lv.startW) / WORLD_W_FP;
  const blockH = size === "l" ? 12 : 9;
  const ground = H - 6;
  const floors = 3;
  const towerX = pad + (span - blockW) / 2;
  const blocks = [];
  for (let i = 0; i < floors; i++)
    blocks.push(<rect key={i} x={towerX} y={ground - (i + 1) * (blockH + 1)} width={blockW} height={blockH} rx={1} fill={`var(${i % 2 ? "--jz-cyan" : "--jz-navy"})`} stroke="var(--jz-line)" strokeWidth={1} />);
  const topY = ground - floors * (blockH + 1);
  // The sliding block, coming in from the left edge of the world, its arrow as long as its start speed (3 px a tick = 18 px).
  const slideY = topY - blockH - (size === "l" ? 14 : 8);
  const arrow = Math.min(span - blockW, (18 * lv.speedStart) / NORMAL.speedStart);
  const flag = lv.windFrom === 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-skyline-picture={level}>
      <rect x={pad} y={ground} width={span} height={2} fill="var(--jz-text-3)" />
      {blocks}
      <rect x={pad} y={slideY} width={blockW} height={blockH} rx={1} fill="var(--jz-gold)" />
      <line x1={pad + blockW + 3} y1={slideY + blockH / 2} x2={pad + blockW + 3 + arrow} y2={slideY + blockH / 2} stroke="var(--jz-gold)" strokeWidth={2} strokeLinecap="round" />
      {flag ? (
        <g data-skyline-flag="">
          <rect x={towerX + blockW / 2 - 0.75} y={topY - 14} width={1.5} height={14} fill="var(--jz-text-2)" />
          <path d={`M ${towerX + blockW / 2 + 0.75} ${topY - 14} l 10 3 l -10 3 z`} fill="var(--jz-red)" />
        </g>
      ) : null}
    </svg>
  );
}

/** The lever in a few words, from the same settings. */
export function skylineWords(level: Level): string {
  const lv = settingsAt(level);
  const px = Math.round(lv.startW / 256);
  if (level === "normal") return `${px} px blocks`;
  const wind = lv.windFrom === null ? ", no wind" : lv.windFrom === 0 ? ", wind from the first block" : "";
  const pace = lv.speedStart < NORMAL.speedStart ? ", sliding slowly" : "";
  return `${px} px blocks${pace}${wind}`;
}
