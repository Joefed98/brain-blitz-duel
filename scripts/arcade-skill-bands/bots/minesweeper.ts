/**
 * Minesweeper (Cards & Board, 30 Oct 2026): a human reads the board they can see (revealed numbers, their own flags,
 * mines already hit; never the hidden mines), works out a safe square or a mine and taps.
 *
 * Reading: a single number whose mines are all found (or whose hidden squares are all mines) is spotted after a short
 * scan; a pair of overlapping numbers takes a longer look and weaker players often miss it (PAIR_FIND), looking again
 * after a while and, if still stuck, guessing a hidden square (weaker players guess sooner). The mine count at the end
 * only better players use. Flags the player places are trusted, so a wrong flag leads the reading astray as it would.
 *
 * Moving: each tap takes TAP_MS (finding the square and touching it). Players who chord (CHORD) flag the mines round a
 * number with a long press and then tap the number to open the rest in one go; others tap every safe square. A slip
 * puts the tap on a neighbouring square (it may be a mine). The perfect level reads every rule instantly and taps at
 * its fastest: the ceiling, not a player.
 */
import { msToTicks, type SkillLevel } from "../human";
import { driveEvents, type BotResult, type SkillBot } from "../bot";
import {
  minesNeighbours,
  MINES_BOOM,
  MINES_CELLS,
  MINES_COLS,
  MINES_COUNT,
  MINES_FLAG,
  MINES_HIDDEN,
  MINES_INPUT_TAP,
  MINES_MODE_FLAG,
  MINES_MODE_REVEAL,
  MINES_OPEN,
  type MinesState,
} from "../../../src/lib/arcade/minesweeper";

/** One tap, from finding the square to the touch (ms). */
const TAP_MS: Record<SkillLevel, number> = { weak: 820, average: 600, good: 470, great: 390, near: 330, elite: 300, perfect: 140 };
/** The long press that flags (ms, the stage's 380 ms hold plus the reach). */
const FLAG_MS = 380;
/** A scan for a single-number deduction, and a pair-of-numbers one (average player, ms). */
const SINGLE_SCAN_MS = 900;
const PAIR_SCAN_MS = 2800;
/** Chance a look for a pair deduction finds one that is there. */
const PAIR_FIND: Record<SkillLevel, number> = { weak: 0.3, average: 0.55, good: 0.75, great: 0.88, near: 0.96, elite: 0.98, perfect: 1 };
/** Chance of using the mine count when it decides the end. */
const COUNT_USE: Record<SkillLevel, number> = { weak: 0, average: 0.2, good: 0.5, great: 0.8, near: 1, elite: 1, perfect: 1 };
/** Chance of flagging round a number and chording it, where that saves taps. */
const CHORD: Record<SkillLevel, number> = { weak: 0, average: 0.15, good: 0.45, great: 0.75, near: 0.95, elite: 1, perfect: 1 };
/** Fruitless looks before a guess. */
const PATIENCE: Record<SkillLevel, number> = { weak: 1, average: 2, good: 3, great: 4, near: 6, elite: 8, perfect: 99 };

interface Reading {
  safe: number[];
  mines: number[];
  kind: "single" | "pair" | "count" | "none";
  /** For a chord: a number whose mines, once flagged, open its safe neighbours. */
  chord: number;
}

/** What the visible board proves, by the cheapest rule that proves anything. */
export function readBoard(s: MinesState, opts: { pairs: boolean; count: boolean }): Reading {
  const view = s.open;
  const known = (c: number) => (view[c] === MINES_OPEN ? 1 : view[c] === MINES_FLAG || view[c] === MINES_BOOM ? 2 : 0);
  const hidden = (c: number) => minesNeighbours(c).filter((n) => known(n) === 0);
  const left = (c: number) => s.nums[c]! - minesNeighbours(c).filter((n) => known(n) === 2).length;
  const front: { cell: number; hidden: number[]; left: number }[] = [];
  for (let c = 0; c < MINES_CELLS; c++) {
    if (view[c] !== MINES_OPEN || s.nums[c] === 0) continue;
    const h = hidden(c);
    if (h.length) front.push({ cell: c, hidden: h, left: left(c) });
  }
  const safe = new Set<number>();
  const mines = new Set<number>();
  let chord = -1;
  for (const f of front) {
    if (f.left === 0) {
      for (const h of f.hidden) safe.add(h);
      if (f.hidden.length > 1 && chord < 0) chord = f.cell;
    } else if (f.left === f.hidden.length) for (const h of f.hidden) mines.add(h);
  }
  if (safe.size || mines.size) return { safe: [...safe], mines: [...mines], kind: "single", chord };
  if (opts.pairs) {
    for (const a of front) {
      for (const b of front) {
        if (a === b) continue;
        const ar = Math.floor(a.cell / MINES_COLS), ac = a.cell % MINES_COLS;
        const br = Math.floor(b.cell / MINES_COLS), bc = b.cell % MINES_COLS;
        if (Math.abs(ar - br) > 2 || Math.abs(ac - bc) > 2) continue;
        const onlyA = a.hidden.filter((h) => !b.hidden.includes(h));
        const onlyB = b.hidden.filter((h) => !a.hidden.includes(h));
        if (onlyA.length === a.hidden.length) continue;
        if (onlyB.length > 0 && b.left - a.left === onlyB.length) {
          onlyB.forEach((h) => mines.add(h));
          onlyA.forEach((h) => safe.add(h));
        } else if (onlyA.length === 0 && onlyB.length > 0 && b.left === a.left) onlyB.forEach((h) => safe.add(h));
      }
      if (safe.size || mines.size) return { safe: [...safe], mines: [...mines], kind: "pair", chord: -1 };
    }
  }
  if (opts.count) {
    const all: number[] = [];
    let marked = 0;
    for (let c = 0; c < MINES_CELLS; c++) {
      if (known(c) === 0) all.push(c);
      else if (known(c) === 2) marked += 1;
    }
    if (marked === MINES_COUNT && all.length) return { safe: all, mines: [], kind: "count", chord: -1 };
    if (MINES_COUNT - marked === all.length && all.length) return { safe: [], mines: all, kind: "count", chord: -1 };
  }
  return { safe: [], mines: [], kind: "none", chord: -1 };
}

export const bot: SkillBot = ({ game, seed, human }): BotResult => {
  const lvl = human.level;
  const tap = () => msToTicks(TAP_MS[lvl] * (0.8 + 0.4 * human.u()));
  /** Planned taps (cell, mode) in order, and the tick the next one lands. */
  let queue: { cell: number; mode: number; chord?: boolean }[] = [];
  let nextAt = msToTicks(600) + human.reactTicks();
  let fruitless = 0;
  const { events } = driveEvents<MinesState>(
    game,
    (s, t) => {
      if (t < nextAt) return null;
      // Drop planned taps the board has made pointless (a cascade opened them).
      while (queue.length && !queue[0]!.chord && s.open[queue[0]!.cell] === (queue[0]!.mode === MINES_MODE_FLAG ? MINES_FLAG : MINES_OPEN)) queue.shift();
      if (queue.length === 0) {
        const pairs = human.chance(PAIR_FIND[lvl]);
        const reading = readBoard(s, { pairs, count: human.chance(COUNT_USE[lvl]) });
        if (reading.kind === "none") {
          fruitless += 1;
          if (fruitless > PATIENCE[lvl]) {
            // A guess: a hidden square next to the opened area (or anywhere hidden).
            const hiddenAll: number[] = [];
            for (let c = 0; c < MINES_CELLS; c++) if (s.open[c] === MINES_HIDDEN) hiddenAll.push(c);
            if (!hiddenAll.length) return null;
            queue = [{ cell: hiddenAll[human.int(0, hiddenAll.length - 1)]!, mode: MINES_MODE_REVEAL }];
            fruitless = 0;
          } else {
            nextAt = t + human.thinkTicks(PAIR_SCAN_MS);
            return null;
          }
        } else {
          fruitless = 0;
          const think = reading.kind === "single" ? SINGLE_SCAN_MS : PAIR_SCAN_MS;
          nextAt = t + human.thinkTicks(think);
          const chording = reading.kind === "single" && reading.chord >= 0 && human.chance(CHORD[lvl]);
          if (chording) {
            const n = reading.chord;
            const flags = minesNeighbours(n).filter((c) => s.open[c] === MINES_HIDDEN && reading.mines.includes(c));
            queue = [...flags.map((cell) => ({ cell, mode: MINES_MODE_FLAG })), { cell: n, mode: MINES_MODE_REVEAL, chord: true }];
          } else if (reading.safe.length) {
            // Tap the safe squares (a few at a time: the board changes as they open).
            queue = reading.safe.slice(0, 6).map((cell) => ({ cell, mode: MINES_MODE_REVEAL }));
          } else {
            // Only mines proved: flag one (the reading goes on from the flags), then read again.
            queue = [{ cell: reading.mines[0]!, mode: MINES_MODE_FLAG }];
          }
          return null;
        }
      }
      const next = queue.shift()!;
      let cell = next.cell;
      // A slip lands on a neighbouring square.
      if (human.slip(0.5)) {
        const ns = minesNeighbours(cell);
        cell = ns[human.int(0, ns.length - 1)]!;
      }
      nextAt = t + (next.mode === MINES_MODE_FLAG ? msToTicks(FLAG_MS) + tap() : tap());
      return { k: MINES_INPUT_TAP, a: cell, b: next.mode, c: 0, d: 0 };
    },
    game.init(seed),
  );
  return { events };
};
