/**
 * D6's lever pictures (23 Nov 2026; the polish plan's section 6.1, read by P2's lever-picture slot,
 * src/lib/levels/leverPicture.tsx, through `import.meta.glob`): for each Strategy, Sports and Cards & Board game whose
 * levels D6 built, a small drawing of the one thing its levels change, made from the level's own settings (the registry,
 * GAME_LEVELS, which each game's D6 check proves mirrors its sim), never a hand-made image. Normal's figures are today's
 * game as rooms deal it, mirrored here (each beside the constant it copies) so the Games page never loads a sim.
 *
 * The props and entry shapes are P2's (LeverPictureProps, LeverPictureEntry), written out here so this file compiles
 * whether or not P2's slot has merged; nothing imports it until the slot exists.
 */
import type { ComponentType } from "react";

import { GAME_LEVELS } from "@/lib/levels/gameLevels";
import type { Level } from "@/lib/levels/levels";

/** P2's LeverPictureProps: `l` the game page's large level (about 320 × 180), `s` a level row's tile (about 72 × 44). */
interface LeverPictureProps {
  level: Level;
  size: "l" | "s";
}
interface LeverPictureEntry {
  Picture: ComponentType<LeverPictureProps>;
  words?: (level: Level) => string;
}

type Settings = Record<string, unknown>;
const levels = GAME_LEVELS as unknown as Record<string, { levels: Record<string, { settings: Settings }> } | undefined>;
/** A level's registry settings, or Normal's (mirrored below) for Normal. */
function at<T extends Settings>(type: string, level: Level, normal: T): T {
  if (level === "normal") return normal;
  return (levels[type]?.levels[level]?.settings as T | undefined) ?? normal;
}

const W = 180;
const heightOf = (size: "l" | "s") => (size === "l" ? 112 : 80);
const svgProps = (H: number, name: string, level: Level) => ({
  viewBox: `0 0 ${W} ${H}`,
  width: "100%",
  height: "100%",
  preserveAspectRatio: "xMidYMid meet",
  "aria-hidden": true as const,
  [`data-${name}-picture`]: level,
});

/** A clock bar: the round's seconds against the longest level's (a fuller bar, more time). */
function ClockBar({ seconds, most, y, H }: { seconds: number; most: number; y: number; H: number }) {
  const w = ((W - 16) * seconds) / most;
  return (
    <g>
      <rect x={8} y={y} width={W - 16} height={H} rx={H / 2} fill="var(--jz-well)" />
      <rect x={8} y={y} width={w} height={H} rx={H / 2} fill="var(--jz-gold)" />
    </g>
  );
}

/* ------------------------------------------------------------------ Thirteen: rows in the pyramid */

/** pyramidRev 4's Normal: seven rows (cards/pyramid.ts PY_ROWS), 28 cards, 24 in the stock. */
const PY_NORMAL = { rows: 7, cards: 28, stock: 24 };
function PyramidPicture({ level, size }: LeverPictureProps) {
  const s = at("pyramid", level, PY_NORMAL);
  const rows = s.rows as number;
  const H = heightOf(size);
  // Nine rows fill the height; fewer rows keep the same card size, so the pyramid's height is the lever.
  const cardH = (H - 16) / 9;
  const cardW = cardH * 0.72;
  const out = [];
  for (let r = 0; r < rows; r++)
    for (let p = 0; p <= r; p++)
      out.push(<rect key={`${r}-${p}`} x={W / 2 - ((r + 1) * (cardW + 1)) / 2 + p * (cardW + 1)} y={H - 8 - (rows - r) * cardH} width={cardW} height={cardH - 1} rx={1} fill="var(--jz-text)" opacity={0.85} />);
  return <svg {...svgProps(H, "pyramid", level)}>{out}</svg>;
}
const pyramidWords = (level: Level) => {
  const s = at("pyramid", level, PY_NORMAL);
  return `${s.rows} rows: ${s.cards} cards, ${s.stock} in the stock`;
};

/* ------------------------------------------------------------------ Free Cell: free cells */

/** freecellRev 6's Normal: four free cells (cards/freecell.ts FC_CELLS) on 40 cards (FC_V4 Ace to 10). */
const FC_NORMAL = { cells: 4, cards: 40 };
function FreecellPicture({ level, size }: LeverPictureProps) {
  const s = at("freecell", level, FC_NORMAL);
  const cells = s.cells as number;
  const H = heightOf(size);
  const cw = 24;
  const ch = 34;
  const gap = 6;
  const total = 5 * cw + 4 * gap;
  const x0 = (W - total) / 2;
  const out = [];
  for (let i = 0; i < 5; i++)
    out.push(<rect key={i} x={x0 + i * (cw + gap)} y={(H - ch) / 2} width={cw} height={ch} rx={3} fill={i < cells ? "none" : "var(--jz-well)"} stroke={i < cells ? "var(--jz-gold)" : "none"} strokeWidth={1.5} strokeDasharray={i < cells ? "3 2" : undefined} />);
  return <svg {...svgProps(H, "freecell", level)}>{out}</svg>;
}
const freecellWords = (level: Level) => {
  const s = at("freecell", level, FC_NORMAL);
  return `${s.cells} free cells, ${s.cards} cards`;
};

/* ------------------------------------------------------------------ Summit: seconds on the clock */

/** tripeaksRev 4's Normal: 60 s (cards/tripeaks.ts TP_RUN_TICKS), a stock of 24. */
const TP_NORMAL = { seconds: 60, stockTurns: 24 };
function TripeaksPicture({ level, size }: LeverPictureProps) {
  const s = at("tripeaks", level, TP_NORMAL);
  const H = heightOf(size);
  return (
    <svg {...svgProps(H, "tripeaks", level)}>
      <ClockBar seconds={s.seconds as number} most={90} y={H / 2 - 6} H={12} />
    </svg>
  );
}
const tripeaksWords = (level: Level) => {
  const s = at("tripeaks", level, TP_NORMAL);
  return `${s.seconds} s, a stock of ${s.stockTurns}`;
};

/* ------------------------------------------------------------------ Five Hands: seconds per card */

/** fiveHandsRev 4's Normal: 60 s (cards/fiveHands.ts FH_RUN_TICKS) for 20 cards. */
const FH_NORMAL = { seconds: 60 };
function FiveHandsPicture({ level, size }: LeverPictureProps) {
  const s = at("fivehands", level, FH_NORMAL);
  const H = heightOf(size);
  return (
    <svg {...svgProps(H, "fivehands", level)}>
      <ClockBar seconds={s.seconds as number} most={90} y={H / 2 - 6} H={12} />
    </svg>
  );
}
const fiveHandsWords = (level: Level) => {
  const s = at("fivehands", level, FH_NORMAL);
  return `${s.seconds} s for 20 cards`;
};

/* ------------------------------------------------------------------ Mahjong: tiles in the stack */

/** mahjongRev 2's Normal: 72 tiles in four layers (mahjong.ts MAHJONG_LAYOUT). */
const MJ_NORMAL = { tiles: 72, layers: 4 };
function MahjongPicture({ level, size }: LeverPictureProps) {
  const s = at("mahjong", level, MJ_NORMAL);
  const H = heightOf(size);
  const layers = s.layers as number;
  const tiles = s.tiles as number;
  // Each layer a band, its width the stack's share of the full 136 tiles.
  const w = ((W - 24) * tiles) / 136;
  const band = (H - 16) / 4;
  const out = [];
  for (let l = 0; l < layers; l++) {
    const lw = w * (1 - l * 0.18);
    out.push(<rect key={l} x={(W - lw) / 2} y={H - 8 - (l + 1) * band} width={lw} height={band - 2} rx={2} fill="var(--jz-text)" opacity={0.55 + 0.1 * l} />);
  }
  return <svg {...svgProps(H, "mahjong", level)}>{out}</svg>;
}
const mahjongWords = (level: Level) => {
  const s = at("mahjong", level, MJ_NORMAL);
  return `${s.tiles} tiles in ${s.layers} layers`;
};

/* ------------------------------------------------------------------ Home Run: pitch speed */

/** homerunRev 6's Normal: a fastball 36–41 ticks to the plate (homerunInnings.ts HR_LEVEL_SETTINGS.normal). */
const HR_NORMAL = { flight: { 0: [36, 41] } };
function fastballS(level: Level): number {
  const s = at("homerun", level, HR_NORMAL) as unknown as { flight: Record<number, readonly [number, number]> };
  return s.flight[0]![0] / 60;
}
function HomerunPicture({ level, size }: LeverPictureProps) {
  const H = heightOf(size);
  // The ball's trail: a quicker pitch, a longer streak.
  const t = fastballS(level);
  const streak = Math.min(W - 40, (W - 40) * (0.45 / t));
  return (
    <svg {...svgProps(H, "homerun", level)}>
      <line x1={W - 24 - streak} y1={H / 2} x2={W - 24} y2={H / 2} stroke="var(--jz-gold)" strokeWidth={4} strokeLinecap="round" opacity={0.6} />
      <circle cx={W - 24} cy={H / 2} r={7} fill="var(--jz-text)" />
    </svg>
  );
}
const homerunWords = (level: Level) => `A fastball reaches the plate in ${fastballS(level).toFixed(2)} s`;

/* ------------------------------------------------------------------ Apex: road width */

/** racingRev 5's Normal: the road 65 536 wide (racing.ts RACING_ROAD_X), in its own units. */
const RC_NORMAL = { road: 65536 };
function roadShare(level: Level): number {
  return (at("racing", level, RC_NORMAL).road as number) / 65536;
}
function RacingPicture({ level, size }: LeverPictureProps) {
  const H = heightOf(size);
  const w = 48 * roadShare(level);
  return (
    <svg {...svgProps(H, "racing", level)}>
      <rect x={0} y={0} width={W} height={H} fill="var(--jz-well)" />
      <rect x={(W - w) / 2} y={0} width={w} height={H} fill="var(--jz-text-3)" />
      <line x1={W / 2} y1={4} x2={W / 2} y2={H - 4} stroke="var(--jz-gold)" strokeWidth={2} strokeDasharray="6 6" />
    </svg>
  );
}
const racingWords = (level: Level) => (level === "normal" ? "Today's road" : `The road ${Math.round(roadShare(level) * 100)} % of Normal's width`);

export const LEVER_PICTURES: Partial<Record<string, LeverPictureEntry>> = {
  pyramid: { Picture: PyramidPicture, words: pyramidWords },
  freecell: { Picture: FreecellPicture, words: freecellWords },
  tripeaks: { Picture: TripeaksPicture, words: tripeaksWords },
  fivehands: { Picture: FiveHandsPicture, words: fiveHandsWords },
  mahjong: { Picture: MahjongPicture, words: mahjongWords },
  homerun: { Picture: HomerunPicture, words: homerunWords },
  racing: { Picture: RacingPicture, words: racingWords },
};
