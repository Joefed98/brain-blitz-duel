/**
 * The Speed and Attention games' lever pictures (D3, 22 Nov 2026; the polish plan's section 6.1): a small drawing of
 * what each level changes, made from the level's own settings (speedLevels.ts, attentionLevels.data.ts) and Normal's
 * own constants, so it can never drift from the game. Read by P2's slot (src/lib/levels/leverPicture.tsx) through its
 * named export LEVER_PICTURES; nothing else imports this file.
 *
 * Each picture is a 96 × 64 SVG in the design tokens' colours, with the lever in words as its label.
 */
import type { ReactElement, ReactNode } from "react";
import type { Level } from "@/lib/levels/levels";
import { ASCEND_LEVELS, BONK_LEVELS, CHAIN_LEVELS, FLASH_LEVELS, PULL_LEVELS, TENFALL_LEVELS } from "@/lib/levels/speedLevels";
import { BOMB_LEVELS, MAZE_LEVELS, PAIR_LEVELS, SCAN_LEVELS, SPOT_LEVELS, TALLY_LEVELS } from "@/lib/levels/attentionLevels.data";

export interface LeverPictureProps {
  level: Level;
}
export type LeverPicture = (props: LeverPictureProps) => ReactElement;

const W = 96;
const H = 64;
const GOLD = "var(--jz-gold)";
const DIM = "var(--jz-text-3)";
const LINE = "var(--jz-line)";

function Frame({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

/** `n` dots in a near-square grid filling the frame (Ascend's discs, Eagle Eye's eagles, Matchmaker's cards…). */
function DotGrid({ n, cols, r, fill = DIM, gold = 0 }: { n: number; cols: number; r: number; fill?: string; gold?: number }): ReactElement {
  const rows = Math.ceil(n / cols);
  const sx = W / cols;
  const sy = H / rows;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={sx * ((i % cols) + 0.5)} cy={sy * (Math.floor(i / cols) + 0.5)} r={Math.min(r, sx * 0.42, sy * 0.42)} fill={i < gold ? GOLD : fill} />
      ))}
    </g>
  );
}

type Off = Exclude<Level, "normal">;
const off = (level: Level): Off | null => (level === "normal" ? null : level);

/* ------------------------------------------------------------------ Speed */

/** Flash: the most traps before a gold (grey bars), then the gold. Normal: 1–3 traps. */
const flash: LeverPicture = ({ level }) => {
  const lv = off(level);
  const traps = lv ? FLASH_LEVELS[lv].decoys[1] : 3;
  const n = traps + 1;
  const w = W / n;
  return (
    <Frame label={`Up to ${traps} traps before each gold`}>
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={i * w + w * 0.12} y={H * 0.2} width={w * 0.76} height={H * 0.6} rx={3} fill={i === n - 1 ? GOLD : DIM} />
      ))}
    </Frame>
  );
};

/** Ascend: the numbers on the board. Normal: 24. */
const ascend: LeverPicture = ({ level }) => {
  const lv = off(level);
  const count = lv ? ASCEND_LEVELS[lv].count : 24;
  return (
    <Frame label={`${count} numbers`}>
      <DotGrid n={count} cols={Math.ceil(Math.sqrt(count * 1.5))} r={6} gold={1} />
    </Frame>
  );
};

/** Don't Break the Chain: the charms in the cycle. Normal: 5. */
const chain: LeverPicture = ({ level }) => {
  const lv = off(level);
  const cycle = lv ? CHAIN_LEVELS[lv].cycle : 5;
  const w = W / cycle;
  return (
    <Frame label={`${cycle} charms to a cycle`}>
      {Array.from({ length: cycle }, (_, i) => {
        const cx = w * (i + 0.5);
        const r = Math.min(w * 0.36, 12);
        const fill = i === 0 ? GOLD : DIM;
        // The three charm shapes in turn: circle, square, triangle.
        if (i % 3 === 0) return <circle key={i} cx={cx} cy={H / 2} r={r} fill={fill} />;
        if (i % 3 === 1) return <rect key={i} x={cx - r} y={H / 2 - r} width={2 * r} height={2 * r} fill={fill} />;
        return <polygon key={i} points={`${cx},${H / 2 - r} ${cx + r},${H / 2 + r} ${cx - r},${H / 2 + r}`} fill={fill} />;
      })}
    </Frame>
  );
};

/** Bonk: the lawn's burrows. Normal: 4 × 4. */
const bonk: LeverPicture = ({ level }) => {
  const lv = off(level);
  const cols = lv ? (BONK_LEVELS[lv] as { cols?: number }).cols ?? 4 : 4;
  const side = H;
  const x0 = (W - side) / 2;
  const s = side / cols;
  return (
    <Frame label={`A ${cols} by ${cols} lawn`}>
      {Array.from({ length: cols * cols }, (_, i) => (
        <ellipse key={i} cx={x0 + s * ((i % cols) + 0.5)} cy={s * (Math.floor(i / cols) + 0.5)} rx={s * 0.4} ry={s * 0.32} fill={i === Math.floor((cols * cols) / 2) ? GOLD : DIM} />
      ))}
    </Frame>
  );
};

/** Tenfall: the first target's size (Normal's first is 19–25). */
const tenfall: LeverPicture = ({ level }) => {
  const lv = off(level);
  const row = lv ? (TENFALL_LEVELS[lv] as { minTarget?: number; maxTarget: number; targets: number }) : null;
  const first = row ? row.minTarget ?? Math.max(12, Math.round(row.maxTarget / row.targets)) : 22;
  return (
    <Frame label={`First target ${first}`}>
      <rect x={W * 0.2} y={H * 0.12} width={W * 0.6} height={H * 0.76} rx={6} fill="none" stroke={GOLD} strokeWidth={3} />
      <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="central" fontSize={first >= 100 ? 22 : 26} fontWeight={800} fill={GOLD} fontFamily="var(--jz-font)">
        {first}
      </text>
    </Frame>
  );
};

/** Pull!: the clays in the air together (1, 2 or 3). */
const pull: LeverPicture = ({ level }) => {
  const lv = off(level);
  const row = lv ? PULL_LEVELS[lv] : null;
  const together = row ? (row.triples > 0 ? 3 : row.pairs * 2 >= row.clays ? 2 : row.pairs > 0 ? 1 : 1) : 1;
  return (
    <Frame label={together === 1 ? "One clay at a time" : `${together} clays at once`}>
      {Array.from({ length: together }, (_, i) => (
        <ellipse key={i} cx={W * (0.5 + (i - (together - 1) / 2) * 0.28)} cy={H * (0.45 - 0.12 * (i % 2))} rx={11} ry={6} fill={GOLD} />
      ))}
      <line x1={4} y1={H - 6} x2={W - 4} y2={H - 6} stroke={LINE} strokeWidth={2} />
    </Frame>
  );
};

/* ------------------------------------------------------------------ Attention */

/** Eagle Eye: the eagles in the first grid. */
const eagleEye: LeverPicture = ({ level }) => {
  const cols = SCAN_LEVELS[level].grids[0]!;
  const rows = (SCAN_LEVELS[level] as { rows?: readonly number[] }).rows?.[0] ?? cols;
  return (
    <Frame label={`${cols * rows} eagles in the first grid`}>
      <DotGrid n={cols * rows} cols={cols} r={4} gold={1} />
    </Frame>
  );
};

/** Double Take: the shapes in each picture, two panels stacked. */
const doubleTake: LeverPicture = ({ level }) => {
  const row = SPOT_LEVELS[level];
  const n = row.cols * row.rows;
  return (
    <Frame label={`${n} shapes a picture`}>
      <g transform="scale(1 0.48)">
        <DotGrid n={n} cols={row.cols} r={4} />
      </g>
      <g transform={`translate(0 ${H * 0.52}) scale(1 0.48)`}>
        <DotGrid n={n} cols={row.cols} r={4} gold={1} />
      </g>
    </Frame>
  );
};

/** Tally: the shapes on the first tray. */
const tally: LeverPicture = ({ level }) => {
  const n = TALLY_LEVELS[level].trays[0]!;
  return (
    <Frame label={`${n} shapes on the first tray`}>
      <DotGrid n={n} cols={Math.ceil(Math.sqrt(n * 1.5))} r={4} gold={Math.max(1, Math.round(n / 8))} />
    </Frame>
  );
};

/** Labyrinth: the maze's size, as its grid of cells. */
const labyrinth: LeverPicture = ({ level }) => {
  const row = MAZE_LEVELS[level];
  const cell = Math.min(W / row.cols, H / row.rows);
  const w = cell * row.cols;
  const h = cell * row.rows;
  return (
    <Frame label={`A ${row.cols} by ${row.rows} maze`}>
      <rect x={(W - w) / 2} y={(H - h) / 2} width={w} height={h} fill="none" stroke={DIM} strokeWidth={1.5} />
      {Array.from({ length: row.rows - 1 }, (_, r) => (
        <line key={r} x1={(W - w) / 2} y1={(H - h) / 2 + cell * (r + 1)} x2={(W - w) / 2 + w * (r % 2 ? 0.7 : 0.4)} y2={(H - h) / 2 + cell * (r + 1)} stroke={LINE} strokeWidth={1} />
      ))}
      <circle cx={(W + w) / 2 - cell / 2} cy={(H + h) / 2 - cell / 2} r={Math.max(2, cell / 2)} fill={GOLD} />
    </Frame>
  );
};

/** Bomb Defusal: the clues on the card (lines) over the clock (the gold bar, out of two minutes). */
const bomb: LeverPicture = ({ level }) => {
  const row = BOMB_LEVELS[level];
  const clues = row.clues[0];
  const seconds = Math.round(row.timeLimitMs / 1000);
  const gap = (H - 14) / (clues + 1);
  return (
    <Frame label={`${clues} clues in ${seconds} seconds`}>
      {Array.from({ length: clues }, (_, i) => (
        <line key={i} x1={8} y1={gap * (i + 1)} x2={W - 8 - (i % 3) * 14} y2={gap * (i + 1)} stroke={DIM} strokeWidth={2} strokeLinecap="round" />
      ))}
      <rect x={8} y={H - 10} width={((W - 16) * row.timeLimitMs) / 120_000} height={6} rx={3} fill={GOLD} />
    </Frame>
  );
};

/** Matchmaker: the cards on the board. */
const matchmaker: LeverPicture = ({ level }) => {
  const row = PAIR_LEVELS[level];
  const n = row.pairs * 2;
  const cols = row.cols;
  const rows = Math.ceil(n / cols);
  const cw = W / cols;
  const ch = H / rows;
  return (
    <Frame label={`${n} cards`}>
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={cw * (i % cols) + cw * 0.1} y={ch * Math.floor(i / cols) + ch * 0.1} width={cw * 0.8} height={ch * 0.8} rx={2} fill={i < 2 ? GOLD : DIM} />
      ))}
    </Frame>
  );
};

export const LEVER_PICTURES: Readonly<Record<string, LeverPicture>> = {
  reaction: flash,
  numhunt: ascend,
  chain,
  whack: bonk,
  tendrop: tenfall,
  clayshoot: pull,
  symscan: eagleEye,
  spotdiff: doubleTake,
  countup: tally,
  maze: labyrinth,
  bomb,
  pairmatch: matchmaker,
};
