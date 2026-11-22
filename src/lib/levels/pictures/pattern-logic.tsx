/**
 * The Pattern and Logic games' lever pictures (D4, 22 Nov 2026; plan section 6.1): a small drawing of what each level
 * changes, made from the level's own settings (GAME_LEVELS through gameLevelSettings; Normal from the game's own
 * constants), never a hand-made image, so a picture cannot drift from the game. Read by P2's slot
 * (src/lib/levels/leverPicture.tsx) through its glob of ./pictures/*.tsx and this file's named export LEVER_PICTURES;
 * nothing else imports it. Display only.
 *
 * Each picture is the board's own shape (columns × rows of squares, or posts, flasks, dials) with the level's counted
 * pieces marked on it: the cars, pegs, bombs, holes, crates, balls, numbers, mines, trees, walls or islands.
 */
import type { JSX, ReactNode } from "react";
import { gameLevelSettings } from "../gameLevels";
import type { Level } from "../levels";
import { LIGHTUP_SIZE } from "@/lib/duel/lightUp";
import { SHIKAKU_SIZE } from "@/lib/duel/shikaku";
import { TENTS_SIZE } from "@/lib/duel/tents";
import { BRIDGES_SIZE, FENCES_SIZE, FILLOMINO_SIZE, FLOOD_SIZE, SLIDE_COLS, UNBLOCK_COLS } from "@/lib/duel/types";

export interface LeverPictureProps {
  level: Level;
  /** The drawing's width and height in CSS pixels (square). */
  size?: number | undefined;
}

type Picture = (props: LeverPictureProps) => JSX.Element;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const INK = "var(--jz-text-2)";
const DIM = "var(--jz-text-3)";
const GOLD = "var(--jz-gold)";
const RED = "var(--jz-red)";

/** A square SVG with a 100-unit view box. */
function Frame({ size = 64, label, children }: { size?: number | undefined; label: string; children: ReactNode }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label} data-lever-picture="">
      {children}
    </svg>
  );
}

/** The level's settings, or null at Normal. */
const settingsOf = (type: string, level: Level): Any => (level === "normal" ? null : gameLevelSettings<Any>(type, level));
/** The low end of a [min, max] range, or a plain number. */
const low = (v: unknown, fallback: number): number => (Array.isArray(v) ? Number(v[0]) : typeof v === "number" ? v : fallback);

/**
 * A board of `cols` × `rows` squares fitted to the frame, `marks` of them filled (spread evenly, the same every draw)
 * in `tone`.
 */
function Board({ cols, rows, marks = 0, tone = GOLD, label, size }: { cols: number; rows: number; marks?: number; tone?: string; label: string; size?: number | undefined }): JSX.Element {
  const cell = Math.min(90 / cols, 90 / rows);
  const x0 = (100 - cell * cols) / 2;
  const y0 = (100 - cell * rows) / 2;
  const cells = cols * rows;
  const marked = new Set<number>();
  for (let i = 0; i < Math.min(marks, cells); i++) {
    let c = Math.floor(((i + 0.5) * cells) / Math.max(1, marks)) % cells;
    while (marked.has(c)) c = (c + 1) % cells;
    marked.add(c);
  }
  return (
    <Frame size={size} label={label}>
      {Array.from({ length: cells }, (_, c) => (
        <rect
          key={c}
          x={x0 + (c % cols) * cell + 0.6}
          y={y0 + Math.floor(c / cols) * cell + 0.6}
          width={Math.max(0.5, cell - 1.2)}
          height={Math.max(0.5, cell - 1.2)}
          rx={Math.min(2, cell / 6)}
          fill={marked.has(c) ? tone : DIM}
        />
      ))}
    </Frame>
  );
}

/** Upright containers in a row: `count` of them, each holding `fill` marks (posts with rings, flasks, dials). */
function Row({ count, fill, tone = GOLD, label, size, hidden = false }: { count: number; fill: number; tone?: string; label: string; size?: number | undefined; hidden?: boolean }): JSX.Element {
  const w = 90 / count;
  const h = 70 / Math.max(1, fill);
  return (
    <Frame size={size} label={label}>
      {Array.from({ length: count }, (_, i) => (
        <g key={i}>
          <rect x={5 + i * w + w * 0.15} y={15} width={w * 0.7} height={72} rx={3} fill="none" stroke={DIM} strokeWidth={2} />
          {Array.from({ length: fill }, (_, k) => (
            <rect key={k} x={5 + i * w + w * 0.22} y={84 - (k + 1) * h + 1} width={w * 0.56} height={Math.max(1, h - 2)} rx={1.5} fill={hidden && k < fill - 1 ? DIM : k % 2 ? INK : tone} />
          ))}
        </g>
      ))}
    </Frame>
  );
}

/* ---------------------------------------------------------------- Pattern */

/** Gridlock: the lot (squares a side) and its cars. */
const unblock: Picture = ({ level, size }) => {
  const s = settingsOf("unblock", level);
  const n = s?.cols ?? UNBLOCK_COLS;
  const cars = low(s?.cars, 10);
  return <Board cols={n} rows={n} marks={cars * 2} tone={INK} label={`a ${n} by ${n} lot, ${cars} or more cars`} size={size} />;
};

/** Tessellate: the board and its pegs. */
const blockparty: Picture = ({ level, size }) => {
  const s = settingsOf("blockparty", level);
  const n = s?.cols ?? 7;
  const pieces = s?.pieces?.length ?? 9;
  return <Board cols={n} rows={n} marks={s?.pegs ?? 16} tone={INK} label={`a ${n} by ${n} board, ${pieces} pieces`} size={size} />;
};

/** Pipeline: the tiles on the board. */
const pipes: Picture = ({ level, size }) => {
  const s = settingsOf("pipes", level);
  const cols = s?.cols ?? 7;
  const rows = s?.rows ?? 7;
  return <Board cols={cols} rows={rows} marks={Math.round(cols * rows * (s?.scrambled ?? 0.8))} tone={INK} label={`${cols * rows} tiles`} size={size} />;
};

/** Chroma Lines: the board and its pairs of dots. */
const flow: Picture = ({ level, size }) => {
  const s = settingsOf("flow", level);
  const cols = s?.cols ?? 9;
  const rows = s?.rows ?? 9;
  const pairs = s?.minPairs ?? 10;
  return <Board cols={cols} rows={rows} marks={pairs * 2} label={`a ${cols} by ${rows} board, ${pairs} or more pairs`} size={size} />;
};

/** Skid: the rink and its holes. */
const iceslide: Picture = ({ level, size }) => {
  const s = settingsOf("iceslide", level);
  const cols = s?.cols ?? SLIDE_COLS;
  const rows = s?.rows ?? SLIDE_COLS;
  const holes = low(s?.holes, 2);
  return <Board cols={cols} rows={rows} marks={holes} tone={RED} label={`a ${cols} by ${rows} rink, ${holes === 0 ? "no holes" : `${holes} or more holes`}`} size={size} />;
};

/** Heave: the warehouse and its crates. */
const push: Picture = ({ level, size }) => {
  const s = settingsOf("push", level);
  const crates = s?.crates ?? 5;
  return <Board cols={9} rows={9} marks={crates} tone={INK} label={`${crates} crates to push home`} size={size} />;
};

/** Lightbender: the board and its bombs. */
const laser: Picture = ({ level, size }) => {
  const s = settingsOf("laser", level);
  const bombs = s?.minBombs ?? 3;
  return <Board cols={10} rows={10} marks={bombs} tone={RED} label={`${bombs === (s?.maxBombs ?? 4) ? bombs : `${bombs} or more`} bomb${bombs === 1 ? "" : "s"}, ${s?.shots ?? 3} shots`} size={size} />;
};

/** Topsy-Turvy: the balls on each board. */
const gravity: Picture = ({ level, size }) => {
  const s = settingsOf("gravity", level);
  const balls = s?.balls ?? 6;
  const boards = s?.boards ?? 3;
  return <Row count={boards} fill={balls} label={`${boards} boards of ${balls} balls`} size={size} />;
};

/* ---------------------------------------------------------------- Logic */

/** Box Six: the numbers given at the start. */
const sudoku: Picture = ({ level, size }) => {
  const s = settingsOf("sudoku", level);
  const givens = low(s?.givens, 13);
  return <Board cols={6} rows={6} marks={givens} tone={INK} label={`${givens} or more numbers given${s?.clashes === "check" ? ", clashes on Check" : ""}`} size={size} />;
};

/** Hanoi: the posts and their rings. */
const tower: Picture = ({ level, size }) => {
  const s = settingsOf("tower", level);
  const pegs = s?.pegs ?? 3;
  const discs = s?.discs ?? 9;
  return <Row count={pegs} fill={Math.ceil(discs / pegs)} label={`${pegs} posts, ${discs} rings`} size={size} />;
};

/** Polypotions: the flasks and their layers (hidden layers grey). */
const tubes: Picture = ({ level, size }) => {
  const s = settingsOf("tubes", level);
  const flasks = s?.flasks ?? 10;
  return <Row count={flasks} fill={s?.capacity ?? 5} hidden={s?.hidden === true} label={`${flasks} flasks, ${s?.colours ?? 8} colours${s?.hidden ? ", layers hidden" : ""}`} size={size} />;
};

/** Safe Cracker: the dials and the tries. */
const safe: Picture = ({ level, size }) => {
  const s = settingsOf("safe", level);
  const dials = s?.dials ?? 4;
  return <Row count={dials} fill={s?.tries ?? 3} label={`${dials} dials, ${s?.tries ?? 3} ${s?.tries === 1 ? "try" : "tries"}`} size={size} />;
};

/** Mosaic: the picture's size. */
const nonogram: Picture = ({ level, size }) => {
  const s = settingsOf("nonogram", level);
  const cols = s?.cols ?? 8;
  const rows = s?.rows ?? 8;
  return <Board cols={cols} rows={rows} marks={Math.round(cols * rows * 0.55)} tone={INK} label={`a ${cols} by ${rows} picture`} size={size} />;
};

/** Colour Flood: the board and its blocked squares. */
const flood: Picture = ({ level, size }) => {
  const s = settingsOf("flood", level);
  const cols = s?.cols ?? FLOOD_SIZE;
  const rows = s?.rows ?? FLOOD_SIZE;
  return <Board cols={cols} rows={rows} marks={s?.blocked ?? 0} tone={INK} label={`a ${cols} by ${rows} board in ${s?.colours ?? 5} colours`} size={size} />;
};

/** Minefield: the board and its mines. */
const minesweeper: Picture = ({ level, size }) => {
  const s = settingsOf("minesweeper", level);
  const cols = s?.cols ?? 10;
  const rows = s?.rows ?? 16;
  const mines = s?.mines ?? 16;
  return <Board cols={cols} rows={rows} marks={mines} tone={RED} label={`${mines} mines on a ${cols} by ${rows} board`} size={size} />;
};

/** Tents and Trees: the board and its trees. */
const tents: Picture = ({ level, size }) => {
  const s = settingsOf("tents", level);
  const rows = s?.height ?? 9;
  const trees = low(s?.pairs, 12);
  return <Board cols={TENTS_SIZE} rows={rows} marks={trees} tone={INK} label={`an ${TENTS_SIZE} by ${rows} board, ${trees} or more trees`} size={size} />;
};

/** Shikaku: the board and its numbers (one a rectangle). */
const shikaku: Picture = ({ level, size }) => {
  const s = settingsOf("shikaku", level);
  const rows = s?.height ?? 11;
  const rects = low(s?.rects, 17);
  return <Board cols={SHIKAKU_SIZE} rows={rows} marks={rects} tone={INK} label={`a ${SHIKAKU_SIZE} by ${rows} board, ${rects} or more rectangles`} size={size} />;
};

/** Lamplighter: the board and its walls. */
const lightup: Picture = ({ level, size }) => {
  const s = settingsOf("lightup", level);
  const rows = s?.height ?? 10;
  const walls = low(s?.walls, 20);
  return <Board cols={LIGHTUP_SIZE} rows={rows} marks={walls} tone={INK} label={`a ${LIGHTUP_SIZE} by ${rows} board, ${walls} or more walls`} size={size} />;
};

/** Trail: the board and the numbers shown. */
const trail: Picture = ({ level, size }) => {
  const s = settingsOf("trail", level);
  const n = s?.size ?? 6;
  return <Board cols={n} rows={n} marks={s?.givens ?? 10} label={`1 to ${n * n}, ${s?.givens ?? 10} numbers shown`} size={size} />;
};

/** Loopline: the grid and its numbered squares. */
const fences: Picture = ({ level, size }) => {
  const s = settingsOf("fences", level);
  const n = s?.size ?? FENCES_SIZE;
  return <Board cols={n} rows={n} marks={s?.minClues ?? 15} tone={INK} label={`a ${n} by ${n} grid, ${s?.minClues ?? 15} or more numbers`} size={size} />;
};

/** Regions: the grid and the numbers shown. */
const fillomino: Picture = ({ level, size }) => {
  const s = settingsOf("fillomino", level);
  const n = s?.size ?? FILLOMINO_SIZE;
  const givens = low(s?.givens, 14);
  return <Board cols={n} rows={n} marks={givens} tone={INK} label={`a ${n} by ${n} grid, ${givens} or more numbers shown`} size={size} />;
};

/** Island Link: the sea and its islands. */
const bridges: Picture = ({ level, size }) => {
  const s = settingsOf("bridges", level);
  const n = s?.size ?? BRIDGES_SIZE;
  const islands = low(s?.islands, 10);
  return <Board cols={n} rows={n} marks={islands} label={`${islands} or more islands on a ${n} by ${n} sea`} size={size} />;
};

export const LEVER_PICTURES: Readonly<Record<string, Picture>> = {
  unblock,
  blockparty,
  pipes,
  flow,
  iceslide,
  push,
  laser,
  gravity,
  sudoku,
  tower,
  tubes,
  safe,
  nonogram,
  flood,
  minesweeper,
  tents,
  shikaku,
  lightup,
  trail,
  fences,
  fillomino,
  bridges,
};
