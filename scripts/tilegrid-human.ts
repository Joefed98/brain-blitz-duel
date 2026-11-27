/**
 * Interlock's person-like builder (D1, 21 Nov 2026; difficulty-spec.md "Interlock", the proof tool): it never sees the
 * dealt solution. From the tray alone it builds a crossword the way a person does: everyday words only (the common-words
 * list), the longest word it can make first, laid across the middle; then, again and again, the longest everyday word it
 * can make from the tiles left plus one letter already on the board, laid through that letter the other way (never
 * touching another word side by side), until every tile is down and every run on the grid is a real word. When it is
 * stuck it takes back only its last word and tries its next choice there (one-step take-backs); stuck again, it gives up.
 *
 * Its moves are timed at the human limits by scripts/word-human-solvers.ts (`tilegridLine`). The level bank
 * (scripts/tilegrid-level-bank.ts) keeps only racks it finishes. Script-only.
 */
import { commonWords } from "../src/lib/duel/dictionary.server";
import { tileGridValid } from "../src/lib/duel/tileGrid.server";

export interface BuilderMove {
  /** "place": a tile from the tray onto `cell`; "back": a tile from `cell` back to the tray. */
  kind: "place" | "back";
  cell: number;
  letter: string;
}

export interface BuilderResult {
  solved: boolean;
  cells: string[];
  /** Every tile move in order, take-backs included. */
  moves: BuilderMove[];
  words: string[];
  takeBacks: number;
}

type Counts = Map<string, number>;
const countOf = (letters: Iterable<string>): Counts => {
  const m: Counts = new Map();
  for (const l of letters) m.set(l, (m.get(l) ?? 0) + 1);
  return m;
};

/** Everyday words (upper case, 3+ letters, no longer than the board) whose letters fit the tray plus at most one more. */
function candidatesFor(tray: readonly string[], size: number): string[] {
  const have = countOf(tray);
  const out: string[] = [];
  for (const raw of commonWords()) {
    if (raw.length < 3 || raw.length > size || !/^[a-z]+$/.test(raw)) continue;
    const w = raw.toUpperCase();
    let over = 0;
    const need = countOf(w);
    for (const [l, n] of need) over += Math.max(0, n - (have.get(l) ?? 0));
    if (over <= 1) out.push(w);
  }
  // Longest first; the common-words list's own order (most familiar first) breaks ties.
  return [...new Set(out)].sort((a, b) => b.length - a.length);
}

/** True when `word` can be laid at (r, c) going across (or down) on `cells`: in bounds, letters agree, no side touching. */
function fits(cells: readonly string[], size: number, word: string, r: number, c: number, across: boolean): { ok: boolean; crossings: number; fresh: number[] } {
  const dr = across ? 0 : 1;
  const dc = across ? 1 : 0;
  const endR = r + dr * (word.length - 1);
  const endC = c + dc * (word.length - 1);
  if (r < 0 || c < 0 || endR >= size || endC >= size) return { ok: false, crossings: 0, fresh: [] };
  const at = (rr: number, cc: number) => (rr < 0 || cc < 0 || rr >= size || cc >= size ? "" : cells[rr * size + cc]!);
  if (at(r - dr, c - dc) || at(endR + dr, endC + dc)) return { ok: false, crossings: 0, fresh: [] };
  let crossings = 0;
  const fresh: number[] = [];
  for (let i = 0; i < word.length; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    const here = at(rr, cc);
    if (here) {
      if (here !== word[i]) return { ok: false, crossings: 0, fresh: [] };
      crossings++;
      continue;
    }
    // A new tile must not touch a letter beside it (across: above or below; down: left or right).
    if (at(rr + dc, cc + dr) || at(rr - dc, cc - dr)) return { ok: false, crossings: 0, fresh: [] };
    fresh.push(rr * size + cc);
  }
  return { ok: true, crossings, fresh };
}

interface Option {
  word: string;
  fresh: number[];
  letters: string[];
}

/** Every placement of the longest words first: through one board letter, using only tiles left for the new cells. */
function optionsFor(cells: readonly string[], size: number, left: Counts, pool: readonly string[], used: ReadonlySet<string>, limit: number): Option[] {
  const out: Option[] = [];
  const filled = cells.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
  const onBoard = new Set(cells.filter(Boolean));
  const fitsLeft = (letters: string[]) => {
    const need = countOf(letters);
    for (const [l, n] of need) if ((left.get(l) ?? 0) < n) return false;
    return true;
  };
  for (const w of pool) {
    if (used.has(w)) continue;
    // Quick look first: the tiles left must cover the word but for letters it can borrow from the board (at most two).
    let short = 0;
    for (const [l, n] of countOf(w)) {
      const over = n - (left.get(l) ?? 0);
      if (over > 0) {
        if (!onBoard.has(l)) short = 99;
        short += over;
      }
    }
    if (short > 2) continue;
    for (const cell of filled) {
      const r0 = Math.floor(cell / size);
      const c0 = cell % size;
      for (let j = 0; j < w.length; j++) {
        if (w[j] !== cells[cell]) continue;
        for (const across of [true, false]) {
          const r = across ? r0 : r0 - j;
          const c = across ? c0 - j : c0;
          const f = fits(cells, size, w, r, c, across);
          if (!f.ok || f.crossings < 1 || f.fresh.length === 0) continue;
          const letters = f.fresh.map((i) => w[(across ? (i % size) - c : Math.floor(i / size) - r)]!);
          if (!fitsLeft(letters)) continue;
          const next = [...cells];
          f.fresh.forEach((i, k) => (next[i] = letters[k]!));
          if (!tileGridValid(next)) continue;
          if (out.some((o) => o.word === w && o.fresh.join() === f.fresh.join())) continue;
          out.push({ word: w, fresh: f.fresh, letters });
          if (out.length >= limit) return out;
        }
      }
    }
  }
  // Longest word first (the pool is in that order already); stable.
  return out;
}

/** Plays the tray on a board of `size` the way a person does (see the header). */
export function buildTileGridLikeAPerson(tray: readonly string[], size: number, maxOptions = 24): BuilderResult {
  const pool = candidatesFor(tray, size);
  const moves: BuilderMove[] = [];
  const words: string[] = [];
  let takeBacks = 0;
  const total = tray.length;
  // The first word: the longest everyday word the tray alone spells, across the middle row.
  const firsts = pool.filter((w) => {
    const need = countOf(w);
    const have = countOf(tray);
    for (const [l, n] of need) if ((have.get(l) ?? 0) < n) return false;
    return w.length >= 4;
  });
  for (const first of firsts.slice(0, maxOptions)) {
    let cells = Array.from({ length: size * size }, () => "");
    const row = Math.floor((size - 1) / 2);
    const col = Math.floor((size - first.length) / 2);
    const left = countOf(tray);
    for (let i = 0; i < first.length; i++) {
      cells[row * size + col + i] = first[i]!;
      left.set(first[i]!, left.get(first[i]!)! - 1);
      moves.push({ kind: "place", cell: row * size + col + i, letter: first[i]! });
    }
    const used = new Set<string>([first]);
    words.push(first);
    const stack: { option: Option; rest: Option[] }[] = [];
    let placed = first.length;
    let gaveUp = false;
    while (placed < total && !gaveUp) {
      let options = optionsFor(cells, size, left, pool, used, maxOptions);
      while (options.length === 0) {
        // Stuck: take back the last word only, and try its next choice.
        const top = stack.pop();
        if (!top) {
          gaveUp = true;
          break;
        }
        takeBacks++;
        top.option.fresh.forEach((i, k) => {
          cells[i] = "";
          left.set(top.option.letters[k]!, (left.get(top.option.letters[k]!) ?? 0) + 1);
          moves.push({ kind: "back", cell: i, letter: top.option.letters[k]! });
        });
        placed -= top.option.fresh.length;
        used.delete(top.option.word);
        words.pop();
        options = top.rest;
        if (options.length === 0) {
          gaveUp = true;
          break;
        }
        // One step only: the choice before it stands.
        stack.length = 0;
      }
      if (gaveUp) break;
      const [option, ...rest] = options;
      const next = [...cells];
      option!.fresh.forEach((i, k) => {
        next[i] = option!.letters[k]!;
        left.set(option!.letters[k]!, left.get(option!.letters[k]!)! - 1);
        moves.push({ kind: "place", cell: i, letter: option!.letters[k]! });
      });
      cells = next;
      placed += option!.fresh.length;
      used.add(option!.word);
      words.push(option!.word);
      stack.push({ option: option!, rest });
    }
    if (!gaveUp && placed === total && tileGridValid(cells)) return { solved: true, cells, moves, words, takeBacks };
    // This first word led nowhere: clear the board (each tile back) and start over with the next longest.
    for (let i = 0; i < cells.length; i++) if (cells[i]) moves.push({ kind: "back", cell: i, letter: cells[i]! });
    takeBacks++;
    words.length = 0;
  }
  return { solved: false, cells: Array.from({ length: size * size }, () => ""), moves, words: [], takeBacks };
}
