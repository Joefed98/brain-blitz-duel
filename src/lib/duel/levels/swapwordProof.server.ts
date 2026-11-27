/**
 * Swapword's level proofs (the Word overhaul, stage 3, 15 Nov 2026): a board dealt at a level beyond Normal is judged
 * against its stored solution, so the deal keeps only boards with exactly one arrangement of six common answer words
 * that keeps the start board's green tiles where they are (`swapwordArrangements`), and Expert keeps only boards a
 * human-like solver can work out from what the phone shows (`swapwordHumanSolves`). Server-only (the answer-word lists
 * are).
 *
 * Why the green tiles: the figure-eight is symmetric across its diagonal (the across words at rows 0, 3 and 5 sit where
 * the down words at columns 0, 3 and 5 do), so every board's letters also make its mirror; the green tiles the phone
 * shows from the start are what tell the player which way round it goes, and with them the answer is the only one.
 */
import { answerWords } from "../dictionary.server";
import { SW_NORMAL_LATTICE, swGeometry, swapwordMarks, type SwLattice } from "../swapword";
import { swapwordSlotCandidates } from "../swapword.server";

/** Slot order for the search: the two long crossing words first, then the four short ones. */
const ORDER = [1, 4, 0, 3, 2, 5] as const;

function letterCounts(letters: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ch of letters) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  return counts;
}

/**
 * How many different boards (letter strings in tile order) these letters make with every slot a common answer word,
 * counting up to `stop`, keeping every tile `known` gives where it is. Swapping two equal letters is the same board,
 * so it counts once.
 */
export function swapwordArrangements(letters: string, stop = 2, known: readonly (string | undefined)[] = [], lattice: SwLattice = SW_NORMAL_LATTICE): number {
  if (lattice !== SW_NORMAL_LATTICE) return latticeArrangements(letters, stop, known, lattice);
  const { tiles: SW_TILES, slotTiles: SW_SLOT_TILES } = swGeometry();
  const SW_SLOTS = SW_NORMAL_LATTICE.slots;
  const counts = letterCounts(letters);
  const board: (string | undefined)[] = Array.from({ length: SW_TILES }, (_, t) => known[t]);
  for (const ch of board) {
    if (ch === undefined) continue;
    const left = counts.get(ch) ?? 0;
    if (left <= 0) return 0;
    counts.set(ch, left - 1);
  }
  const used = new Set<string>();
  let found = 0;
  const pools = SW_SLOTS.map((s) => answerWords(s.len));
  const place = (k: number): void => {
    if (found >= stop) return;
    if (k === ORDER.length) {
      found++;
      return;
    }
    const s = ORDER[k]!;
    const tiles = SW_SLOT_TILES[s]!;
    for (const w of pools[s]!) {
      if (used.has(w)) continue;
      let ok = true;
      const taken: number[] = [];
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i]!;
        const have = board[t];
        if (have !== undefined) {
          if (have !== w[i]) { ok = false; break; }
          continue;
        }
        const left = counts.get(w[i]!) ?? 0;
        if (left <= 0) { ok = false; break; }
        counts.set(w[i]!, left - 1);
        board[t] = w[i];
        taken.push(i);
      }
      if (ok) {
        used.add(w);
        place(k + 1);
        used.delete(w);
      }
      for (const i of taken) {
        const t = tiles[i]!;
        counts.set(board[t]!, (counts.get(board[t]!) ?? 0) + 1);
        board[t] = undefined;
      }
      if (found >= stop) return;
    }
  };
  place(0);
  return found;
}

/**
 * swapwordArrangements on a lattice (swapwordRev 8, D1 21 Nov 2026): the same count, searched slot by slot with the most
 * constrained slot first (its fitting words fetched by position from the answer list), so the 30- and 33-tile boards
 * are proved as quickly as the figure eight. The count does not depend on the order.
 */
function latticeArrangements(letters: string, stop: number, known: readonly (string | undefined)[], lattice: SwLattice): number {
  const g = swGeometry(lattice);
  const counts = letterCounts(letters);
  const board: (string | undefined)[] = Array.from({ length: g.tiles }, (_, t) => known[t]);
  for (const ch of board) {
    if (ch === undefined) continue;
    const left = counts.get(ch) ?? 0;
    if (left <= 0) return 0;
    counts.set(ch, left - 1);
  }
  const used = new Set<string>();
  const placed = new Set<number>();
  let found = 0;
  const fitsCounts = (s: number, w: string): boolean => {
    const need = new Map<string, number>();
    g.slotTiles[s]!.forEach((t, i) => {
      if (board[t] === undefined) need.set(w[i]!, (need.get(w[i]!) ?? 0) + 1);
    });
    for (const [ch, n] of need) if ((counts.get(ch) ?? 0) < n) return false;
    return true;
  };
  const place = (): void => {
    if (found >= stop) return;
    if (placed.size === g.slotTiles.length) {
      found++;
      return;
    }
    let pick = -1;
    let cands: string[] = [];
    for (let s = 0; s < g.slotTiles.length; s++) {
      if (placed.has(s)) continue;
      const c = swapwordSlotCandidates(g.slotTiles[s]!.map((t) => board[t])).filter((w) => !used.has(w) && fitsCounts(s, w));
      if (c.length === 0) return;
      if (pick < 0 || c.length < cands.length) {
        pick = s;
        cands = c;
      }
    }
    const tiles = g.slotTiles[pick]!;
    for (const w of cands) {
      const taken: number[] = [];
      tiles.forEach((t, i) => {
        if (board[t] !== undefined) return;
        board[t] = w[i];
        counts.set(w[i]!, (counts.get(w[i]!) ?? 0) - 1);
        taken.push(t);
      });
      used.add(w);
      placed.add(pick);
      place();
      placed.delete(pick);
      used.delete(w);
      for (const t of taken) {
        counts.set(board[t]!, (counts.get(board[t]!) ?? 0) + 1);
        board[t] = undefined;
      }
      if (found >= stop) return;
    }
  };
  place();
  return found;
}

/** The start board's green tiles (in place at the start), the rest unknown. */
export function swapwordGreens(start: string, solution: string): (string | undefined)[] {
  return [...start].map((ch, t) => (ch === solution[t] ? ch : undefined));
}

/** True when the board has one arrangement of six answer words keeping its green tiles, and only one. */
export function swapwordOneArrangement(start: string, solution: string, lattice: SwLattice = SW_NORMAL_LATTICE): boolean {
  return swapwordArrangements(solution, 2, swapwordGreens(start, solution), lattice) === 1;
}

/**
 * A human-like solver: it sees what the phone shows (the start board and its green and amber marks) and fixes a word
 * only when exactly one common answer word fits that slot: the letters already fixed in it, no letter where the board
 * shows a non-green tile (that letter isn't right there), the slot's amber letters (needed elsewhere in the word) and
 * the letters left on the board, and that word also leaves a fitting word in every slot crossing it. Each word it
 * fixes becomes known letters; it never guesses and never sees the solution. True when it fixes all six words.
 */
export function swapwordHumanSolves(start: string, solution: string, lattice: SwLattice = SW_NORMAL_LATTICE): boolean {
  const trace = swapwordDeduction(start, solution, lattice);
  return trace.steps.every((step) => !step.guessed) && trace.known === solution;
}

/**
 * One word the human-like reader fixes: its slot, how many words fitted the slot's own letters and marks then (before
 * the crossings ruled the rest out; for a guess, the words left to try), and whether it had to guess.
 */
export interface SwapwordDeductionStep {
  slot: number;
  candidates: number;
  guessed: boolean;
}

/**
 * The human-like reader's whole line through a board (swapwordHumanSolves's rules): each step fixes the one slot only
 * one word fits; where none is down to one it has to try the slot with the fewest fitting words (a guess, settled by the
 * marks once the letters are swapped in, so the step then holds the right word). The level kits time a player from it.
 */
export function swapwordDeduction(start: string, solution: string, lattice: SwLattice = SW_NORMAL_LATTICE): { steps: SwapwordDeductionStep[]; known: string } {
  // swapwordRev 8 (D1, 21 Nov 2026): the lattice's own tiles and words (today's figure eight by default, unchanged).
  const { tiles: SW_TILES, slotTiles: SW_SLOT_TILES, tileSlots: SW_TILE_SLOTS } = swGeometry(lattice);
  const SW_SLOTS = lattice.slots;
  const steps: SwapwordDeductionStep[] = [];
  const marks = swapwordMarks(start, solution, lattice);
  const known: (string | undefined)[] = [...start].map((ch, t) => (marks[t] === 2 ? ch : undefined));
  const pools = SW_SLOTS.map((s) => answerWords(s.len));
  const all = letterCounts(start);
  const solved = new Set<number>();
  /**
   * What the start board's marks say about each slot's non-green tiles. The phone marks a tile amber when its letter is
   * still needed in a word it sits in (crossing tiles in either word), so only tiles in one word speak for that word:
   * each amber one needs its letter there once more; a grey one says the word needs no more of its letter than the
   * non-green tiles before it in reading order could have taken.
   */
  const slotNeeds = SW_SLOT_TILES.map((tiles) => {
    const need = new Map<string, number>();
    const cap = new Map<string, number>();
    tiles.forEach((t, k) => {
      if (SW_TILE_SLOTS[t]!.length !== 1 || marks[t] === 2) return;
      const ch = start[t]!;
      if (marks[t] === 1) need.set(ch, (need.get(ch) ?? 0) + 1);
      else {
        const before = tiles.slice(0, k).filter((u) => marks[u] !== 2 && start[u] === ch).length;
        cap.set(ch, Math.min(cap.get(ch) ?? Infinity, before));
      }
    });
    return { need, cap };
  });
  const fits = (s: number, w: string): boolean => {
    const tiles = SW_SLOT_TILES[s]!;
    const free = new Map<string, number>();
    /** The word's letters on the slot's tiles that were not green at the start (where the marks speak). */
    const open = new Map<string, number>();
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i]!;
      if (marks[t] !== 2) open.set(w[i]!, (open.get(w[i]!) ?? 0) + 1);
      if (known[t] !== undefined) {
        if (known[t] !== w[i]) return false;
        continue;
      }
      if (start[t] === w[i] && marks[t] !== 2) return false;
      free.set(w[i]!, (free.get(w[i]!) ?? 0) + 1);
    }
    const { need, cap } = slotNeeds[s]!;
    // The start board's marks: the slot's non-green tiles need its amber letters, and no more of a grey tile's letter.
    for (const [ch, n] of need) if ((open.get(ch) ?? 0) < n) return false;
    for (const [ch, n] of cap) if ((open.get(ch) ?? 0) > n) return false;
    // The letters left on the board must cover the word's free letters.
    const left = new Map(all);
    for (let t = 0; t < SW_TILES; t++) if (known[t] !== undefined) left.set(known[t]!, (left.get(known[t]!) ?? 0) - 1);
    for (const [ch, n] of free) if ((left.get(ch) ?? 0) < n) return false;
    return true;
  };
  for (let round = 0; round < 12 && solved.size < SW_SLOTS.length; round++) {
    const cands = SW_SLOTS.map((_, s) => (solved.has(s) ? [] : pools[s]!.filter((w) => fits(s, w))));
    // Crossings: a word must leave some fitting word in each unsolved slot it crosses.
    const crossOk = (s: number, w: string): boolean => {
      const tiles = SW_SLOT_TILES[s]!;
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i]!;
        for (const o of SW_TILE_SLOTS[t]!) {
          if (o === s || solved.has(o)) continue;
          const j = SW_SLOT_TILES[o]!.indexOf(t);
          if (!cands[o]!.some((v) => v[j] === w[i])) return false;
        }
      }
      return true;
    };
    let progressed = false;
    let fewest: { slot: number; n: number } | null = null;
    for (let s = 0; s < SW_SLOTS.length; s++) {
      if (solved.has(s)) continue;
      const left = cands[s]!.filter((w) => crossOk(s, w));
      if (left.length !== 1) {
        if (!fewest || Math.max(1, left.length) < fewest.n) fewest = { slot: s, n: Math.max(1, left.length) };
        continue;
      }
      const w = left[0]!;
      SW_SLOT_TILES[s]!.forEach((t, i) => (known[t] = w[i]));
      solved.add(s);
      steps.push({ slot: s, candidates: cands[s]!.length, guessed: false });
      progressed = true;
      break;
    }
    if (!progressed && fewest) {
      // A guess: the player tries the slot's words until the marks show the right one.
      SW_SLOT_TILES[fewest.slot]!.forEach((t) => (known[t] = solution[t]));
      solved.add(fewest.slot);
      steps.push({ slot: fewest.slot, candidates: fewest.n, guessed: true });
    }
  }
  return { steps, known: known.map((ch) => ch ?? "?").join("") };
}
