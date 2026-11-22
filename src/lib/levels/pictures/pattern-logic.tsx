/**
 * The Pattern and Logic games' lever pictures (D4, 22 Nov 2026; plan section 6.1): a small drawing of what each level
 * changes, made from the level's own settings (GAME_LEVELS through gameLevelSettings; Normal from the game's own
 * numbers, NORMAL_NUMBERS, proved against real Normal deals by pattern-logic-pictures-check), never a hand-made image,
 * so a picture cannot drift from the game. Read by P2's slot
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
import { TR_SIZE } from "@/lib/duel/trail";
import { BRIDGES_SIZE, FENCES_SIZE, FILLOMINO_SIZE, FLOOD_SIZE, LASER_COLS, PUSH_COLS, SAFE_DIALS, SAFE_TRIES, SLIDE_COLS, UNBLOCK_COLS } from "@/lib/duel/types";

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

/* ---------------------------------------------------------------- The numbers */

/** What a picture draws: a board of squares with some marked, or a row of containers with some filled. */
export type LeverNumbers =
  | { kind: "board"; cols: number; rows: number; marks: number; tone: "ink" | "gold" | "red"; label: string }
  | { kind: "row"; count: number; fill: number; hidden: boolean; label: string };

/**
 * Normal's numbers, the ones the level registry has no row for: the board's size from each game's own constants where
 * the game exports one, the rest written here. pattern-logic-pictures-check deals real Normal puzzles and fails if any
 * of these is no longer what Normal deals (the size exactly, a count inside the range Normal deals), so they can't
 * drift from the game.
 */
export const NORMAL_NUMBERS = {
  unblock: { cols: UNBLOCK_COLS, cars: 10 },
  blockparty: { cols: 7, pieces: 9, pegs: 16 },
  pipes: { cols: 7, rows: 7, scrambled: 0.8 },
  flow: { cols: 9, rows: 9, pairs: 10 },
  iceslide: { cols: SLIDE_COLS, rows: SLIDE_COLS, holes: 2 },
  push: { crates: 5 },
  laser: { bombs: 3, maxBombs: 4, shots: 3 },
  gravity: { balls: 6, boards: 3 },
  sudoku: { givens: 13 },
  tower: { pegs: 3, maxPegs: 4, discs: 9 },
  tubes: { flasks: 10, capacity: 5, colours: 8 },
  safe: { dials: SAFE_DIALS, tries: SAFE_TRIES },
  nonogram: { cols: 8, rows: 8 },
  flood: { cols: FLOOD_SIZE, rows: FLOOD_SIZE, colours: 5 },
  minesweeper: { cols: 10, rows: 16, mines: 16 },
  tents: { rows: 9, trees: 12 },
  shikaku: { rows: 11, rects: 17 },
  lightup: { rows: 10, walls: 20 },
  trail: { size: TR_SIZE, givens: 10 },
  fences: { size: FENCES_SIZE, clues: 15 },
  fillomino: { size: FILLOMINO_SIZE, givens: 16 },
  bridges: { size: BRIDGES_SIZE, islands: 10 },
} as const;

const N = NORMAL_NUMBERS;
const board = (cols: number, rows: number, marks: number, tone: "ink" | "gold" | "red", label: string): LeverNumbers => ({ kind: "board", cols, rows, marks, tone, label });
const row = (count: number, fill: number, label: string, hidden = false): LeverNumbers => ({ kind: "row", count, fill, hidden, label });

/** Each game's numbers at a level: the level's own settings, or Normal's. */
export const LEVER_NUMBERS: Readonly<Record<string, (level: Level) => LeverNumbers>> = {
  /** Gridlock: the lot (squares a side) and its cars. */
  unblock: (level) => {
    const s = settingsOf("unblock", level);
    const n = s?.cols ?? N.unblock.cols;
    const cars = low(s?.cars, N.unblock.cars);
    return board(n, n, cars * 2, "ink", `a ${n} by ${n} lot, ${cars} or more cars`);
  },
  /** Tessellate: the board and its pegs. */
  blockparty: (level) => {
    const s = settingsOf("blockparty", level);
    const n = s?.cols ?? N.blockparty.cols;
    const pieces = s?.pieces?.length ?? N.blockparty.pieces;
    return board(n, n, s?.pegs ?? N.blockparty.pegs, "ink", `a ${n} by ${n} board, ${pieces} pieces`);
  },
  /** Pipeline: the tiles on the board. */
  pipes: (level) => {
    const s = settingsOf("pipes", level);
    const cols = s?.cols ?? N.pipes.cols;
    const rows = s?.rows ?? N.pipes.rows;
    return board(cols, rows, Math.round(cols * rows * (s?.scrambled ?? N.pipes.scrambled)), "ink", `${cols * rows} tiles`);
  },
  /** Chroma Lines: the board and its pairs of dots. */
  flow: (level) => {
    const s = settingsOf("flow", level);
    const cols = s?.cols ?? N.flow.cols;
    const rows = s?.rows ?? N.flow.rows;
    const pairs = s?.minPairs ?? N.flow.pairs;
    return board(cols, rows, pairs * 2, "gold", `a ${cols} by ${rows} board, ${pairs} or more pairs`);
  },
  /** Skid: the rink and its holes. */
  iceslide: (level) => {
    const s = settingsOf("iceslide", level);
    const cols = s?.cols ?? N.iceslide.cols;
    const rows = s?.rows ?? N.iceslide.rows;
    const holes = low(s?.holes, N.iceslide.holes);
    return board(cols, rows, holes, "red", `a ${cols} by ${rows} rink, ${holes === 0 ? "no holes" : `${holes} or more holes`}`);
  },
  /** Heave: the warehouse and its crates. */
  push: (level) => {
    const crates = settingsOf("push", level)?.crates ?? N.push.crates;
    return board(PUSH_COLS, PUSH_COLS, crates, "ink", `${crates} crates to push home`);
  },
  /** Lightbender: the board and its bombs. */
  laser: (level) => {
    const s = settingsOf("laser", level);
    const bombs = s?.minBombs ?? N.laser.bombs;
    const most = s?.maxBombs ?? N.laser.maxBombs;
    return board(LASER_COLS, LASER_COLS, bombs, "red", `${bombs === most ? bombs : `${bombs} or more`} bomb${bombs === 1 && bombs === most ? "" : "s"}, ${s?.shots ?? N.laser.shots} shots`);
  },
  /** Topsy-Turvy: the balls on each board. */
  gravity: (level) => {
    const s = settingsOf("gravity", level);
    const balls = s?.balls ?? N.gravity.balls;
    const boards = s?.boards ?? N.gravity.boards;
    return row(boards, balls, `${boards} boards of ${balls} balls`);
  },
  /** Box Six: the numbers given at the start. */
  sudoku: (level) => {
    const s = settingsOf("sudoku", level);
    const givens = low(s?.givens, N.sudoku.givens);
    return board(6, 6, givens, "ink", `${givens} or more numbers given${s?.clashes === "check" ? ", clashes on Check" : ""}`);
  },
  /** Hanoi: the posts and their rings. */
  tower: (level) => {
    const s = settingsOf("tower", level);
    const pegs = s?.pegs ?? N.tower.pegs;
    const most = s?.pegs ?? N.tower.maxPegs;
    const discs = s?.discs ?? N.tower.discs;
    return row(pegs, Math.ceil(discs / pegs), `${pegs === most ? pegs : `${pegs} or ${most}`} posts, ${discs} rings`);
  },
  /** Polypotions: the flasks and their layers (hidden layers grey). */
  tubes: (level) => {
    const s = settingsOf("tubes", level);
    const flasks = s?.flasks ?? N.tubes.flasks;
    return row(flasks, s?.capacity ?? N.tubes.capacity, `${flasks} flasks, ${s?.colours ?? N.tubes.colours} colours${s?.hidden ? ", layers hidden" : ""}`, s?.hidden === true);
  },
  /** Safe Cracker: the dials and the tries. */
  safe: (level) => {
    const s = settingsOf("safe", level);
    const dials = s?.dials ?? N.safe.dials;
    const tries = s?.tries ?? N.safe.tries;
    return row(dials, tries, `${dials} dials, ${tries} ${tries === 1 ? "try" : "tries"}`);
  },
  /** Mosaic: the picture's size. */
  nonogram: (level) => {
    const s = settingsOf("nonogram", level);
    const cols = s?.cols ?? N.nonogram.cols;
    const rows = s?.rows ?? N.nonogram.rows;
    return board(cols, rows, Math.round(cols * rows * 0.55), "ink", `a ${cols} by ${rows} picture`);
  },
  /** Colour Flood: the board and its blocked squares. */
  flood: (level) => {
    const s = settingsOf("flood", level);
    const cols = s?.cols ?? N.flood.cols;
    const rows = s?.rows ?? N.flood.rows;
    return board(cols, rows, s?.blocked ?? 0, "ink", `a ${cols} by ${rows} board in ${s?.colours ?? N.flood.colours} colours`);
  },
  /** Minefield: the board and its mines. */
  minesweeper: (level) => {
    const s = settingsOf("minesweeper", level);
    const cols = s?.cols ?? N.minesweeper.cols;
    const rows = s?.rows ?? N.minesweeper.rows;
    const mines = s?.mines ?? N.minesweeper.mines;
    return board(cols, rows, mines, "red", `${mines} mines on a ${cols} by ${rows} board`);
  },
  /** Tents and Trees: the board and its trees. */
  tents: (level) => {
    const s = settingsOf("tents", level);
    const rows = s?.height ?? N.tents.rows;
    const trees = low(s?.pairs, N.tents.trees);
    return board(TENTS_SIZE, rows, trees, "ink", `an ${TENTS_SIZE} by ${rows} board, ${trees} or more trees`);
  },
  /** Shikaku: the board and its numbers (one a rectangle). */
  shikaku: (level) => {
    const s = settingsOf("shikaku", level);
    const rows = s?.height ?? N.shikaku.rows;
    const rects = low(s?.rects, N.shikaku.rects);
    return board(SHIKAKU_SIZE, rows, rects, "ink", `a ${SHIKAKU_SIZE} by ${rows} board, ${rects} or more rectangles`);
  },
  /** Lamplighter: the board and its walls. */
  lightup: (level) => {
    const s = settingsOf("lightup", level);
    const rows = s?.height ?? N.lightup.rows;
    const walls = low(s?.walls, N.lightup.walls);
    return board(LIGHTUP_SIZE, rows, walls, "ink", `a ${LIGHTUP_SIZE} by ${rows} board, ${walls} or more walls`);
  },
  /** Trail: the board and the numbers shown. */
  trail: (level) => {
    const s = settingsOf("trail", level);
    const n = s?.size ?? N.trail.size;
    const givens = s?.givens ?? N.trail.givens;
    return board(n, n, givens, "gold", `1 to ${n * n}, ${givens} numbers shown`);
  },
  /** Loopline: the grid and its numbered squares. */
  fences: (level) => {
    const s = settingsOf("fences", level);
    const n = s?.size ?? N.fences.size;
    const clues = s?.minClues ?? N.fences.clues;
    return board(n, n, clues, "ink", `a ${n} by ${n} grid, ${clues} or more numbers`);
  },
  /** Regions: the grid and the numbers shown. */
  fillomino: (level) => {
    const s = settingsOf("fillomino", level);
    const n = s?.size ?? N.fillomino.size;
    const givens = low(s?.givens, N.fillomino.givens);
    return board(n, n, givens, "ink", `a ${n} by ${n} grid, ${givens} or more numbers shown`);
  },
  /** Island Link: the sea and its islands. */
  bridges: (level) => {
    const s = settingsOf("bridges", level);
    const n = s?.size ?? N.bridges.size;
    const islands = low(s?.islands, N.bridges.islands);
    return board(n, n, islands, "gold", `${islands} or more islands on a ${n} by ${n} sea`);
  },
};

const TONES = { ink: INK, gold: GOLD, red: RED } as const;

/** A game's picture at a level, drawn from its numbers. */
function pictureOf(type: string): Picture {
  return ({ level, size }) => {
    const n = LEVER_NUMBERS[type]!(level);
    return n.kind === "board"
      ? <Board cols={n.cols} rows={n.rows} marks={n.marks} tone={TONES[n.tone]} label={n.label} size={size} />
      : <Row count={n.count} fill={n.fill} hidden={n.hidden} label={n.label} size={size} />;
  };
}

export const LEVER_PICTURES: Readonly<Record<string, Picture>> = Object.fromEntries(Object.keys(LEVER_NUMBERS).map((type) => [type, pictureOf(type)]));
