/**
 * Word-group player kits for the puzzle fairness audit (scripts/puzzle-fairness/kit.ts):
 * Nucleus, Forage, Interlock, Slider, Lookout, Roundabout, Strikeout, Cryptogrid, Swapword.
 * Each kit builds the answer string the phone's Stage would hold; gradeAnswer does all scoring.
 */
import { answerWords, commonWords, isWord } from "../../src/lib/duel/dictionary.server";
import { checkWordsmithWord, gradeWordsmith } from "../../src/lib/duel/wordsmith.server";
import { checkWordHuntPath, gradeWordHunt } from "../../src/lib/duel/wordHunt.server";
import { judgeTileGrid } from "../../src/lib/duel/tileGrid.server";
import { decodeTileGrid } from "../../src/lib/duel/tileGrid";
import { encodeTileGrid, TG_CELLS, TG_SIZE } from "../../src/lib/duel/tileGrid";
import { applyShift, markedRowWord, shiftToken, WS_SIZE as SL_SIZE, type SlideShift } from "../../src/lib/duel/wordSlide";
import { wsEncode, wsLine, wsMatch } from "../../src/lib/duel/wordSearch";
import { encodeStrikeout, replayStrikeout, soRowSolved, SO_LEN, type SoAction, type SoState } from "../../src/lib/duel/strikeout";
import { encodeCodeword, replayCodeword, type CwAction } from "../../src/lib/duel/codeword";
import { encodeSwapword, replaySwapword, swapwordMarks, SW_TILES, type SwSwap } from "../../src/lib/duel/swapword";
import { witnessSwaps } from "../../src/lib/duel/swapword.server";
import { WORDHUNT_COLS, WORDSMITH_CENTRE_INDEX, WORDSMITH_SIZES } from "../../src/lib/duel/types";
import type {
  CodewordPuzzleData,
  LetterWheelPuzzleData,
  PuzzleData,
  StrikeoutPuzzleData,
  SwapwordPuzzleData,
  TileGridPuzzleData,
  WordHuntPuzzleData,
  WordSearchPuzzleData,
  WordSlidePuzzleData,
  WordsmithPuzzleData,
} from "../../src/lib/duel/types";
import { thinkMs, type PuzzleKit, type Rng, type SpamPlay, type Step } from "./kit";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const FREQ = "ETAOINSHRDLCUMWFGYPBVKJXQZ";

let commonSet: Set<string> | null = null;
const isCommon = (w: string) => (commonSet ??= new Set(commonWords())).has(w.toLowerCase());

/**
 * Nucleus and Forage always run the full clock (the phone locks the found words in at the buzzer),
 * but gradeAnswer reports isCorrect once points reach par and the runner would submit there. So
 * steps are kept until par is reached, then collapse to one step: everything found by the buzzer.
 */
function fullClock(steps: Step[], reachesPar: (answer: string) => boolean, limitMs: number): Step[] {
  const firstPar = steps.findIndex((s) => reachesPar(s.answer));
  if (firstPar < 0) return steps;
  const inTime = steps.filter((s) => s.atMs <= limitMs);
  const last = inTime[inTime.length - 1] ?? steps[firstPar]!;
  return [...steps.slice(0, firstPar), { answer: last.answer, atMs: Math.max(last.atMs, steps[firstPar]!.atMs) }];
}

// ───────────────────────── Nucleus (wordsmith) ─────────────────────────

const nucleus: PuzzleKit = {
  type: "wordsmith",
  nothing: () => "",
  spam(p, rng, limitMs) {
    const d = p as WordsmithPuzzleData;
    const letters = d.letters;
    const centreAt = WORDSMITH_SIZES.some((s) => s === letters.length) ? WORDSMITH_CENTRE_INDEX : -1;
    // The phone keeps only words the live check accepts, newest first.
    const run = (label: string, perTryMs: number, len: () => number, useCentre: boolean): SpamPlay => {
      const found: string[] = [];
      for (let t = 0, at = 0; at + perTryMs <= limitMs; t++, at += perTryMs) {
        const n = Math.min(letters.length, len());
        let idx = rng.shuffle(letters.map((_, i) => i)).slice(0, n);
        if (useCentre && centreAt >= 0 && !idx.includes(centreAt)) idx[rng.below(n)] = centreAt;
        idx = [...new Set(idx)];
        const word = idx.map((i) => letters[i]).join("");
        if (checkWordsmithWord(letters, word, found).valid) found.unshift(word.toUpperCase());
      }
      return { label, answer: found.join(",") };
    };
    return [
      run("random-4", 1100, () => 4, false),
      run("random-4-centre", 1100, () => 4, true),
      run("random-4to6-centre", 1400, () => rng.int(4, 6), true),
    ];
  },
  play(p, rng, skill, limitMs) {
    const d = p as WordsmithPuzzleData;
    // BASE 5 s per everyday word found (tap 4–6 letters + Enter, ~10–12 words/min for a good player);
    // dictionary-only words take 2.5× as long and late finds slow down as the easy words run out.
    const BASE = 5;
    const pool = (d.words ?? []).map((w) => ({ word: w.word, key: (isCommon(w.word) ? 0 : 6) + w.word.length * 0.6 + rng.next() * 3 }));
    pool.sort((a, b) => a.key - b.key);
    const steps: Step[] = [];
    const found: string[] = [];
    let at = 0;
    for (const [i, { word }] of pool.entries()) {
      const slow = (isCommon(word) ? 1 : 2.5) * (1 + i / Math.max(1, pool.length));
      while (rng.chance(skill.err)) {
        // A rejected try (a plural, a non-word, a word without the centre): time only.
        at += thinkMs(rng, BASE * 0.7, skill);
        steps.push({ answer: found.join(","), atMs: at });
      }
      at += thinkMs(rng, BASE * slow, skill);
      found.unshift(word);
      steps.push({ answer: found.join(","), atMs: at });
    }
    return { steps: fullClock(steps, (a) => gradeWordsmith(d, a, 0).isCorrect, limitMs) };
  },
};

// ───────────────────────── Forage (wordhunt) ─────────────────────────

function huntNeighbours(cell: number): number[] {
  const N = WORDHUNT_COLS;
  const r = Math.floor(cell / N), c = cell % N;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
    }
  return out;
}

const forage: PuzzleKit = {
  type: "wordhunt",
  nothing: () => "",
  spam(p, rng, limitMs) {
    const d = p as WordHuntPuzzleData;
    const cells = d.grid.length;
    const run = (label: string, perTryMs: number, len: () => number): SpamPlay => {
      const found: { word: string; path: number[] }[] = [];
      for (let at = perTryMs; at <= limitMs; at += perTryMs) {
        const n = len();
        const path = [rng.below(cells)];
        while (path.length < n) {
          const next = huntNeighbours(path[path.length - 1]!).filter((x) => !path.includes(x));
          if (!next.length) break;
          path.push(rng.pick(next));
        }
        const v = checkWordHuntPath(d.grid, path, found.map((f) => f.word));
        if (v.valid) found.unshift({ word: v.word, path });
      }
      return { label, answer: found.map((f) => `${f.word}:${f.path.join("-")}`).join(",") };
    };
    return [run("random-paths-4", 900, () => 4), run("random-paths-4to6", 1100, () => rng.int(4, 6))];
  },
  play(p, rng, skill, limitMs) {
    const d = p as WordHuntPuzzleData;
    // BASE 5 s per word traced (spot + swipe), slowing as the obvious words run out; longer words take longer to spot.
    const BASE = 5;
    const pool = (d.words ?? []).map((w) => ({ ...w, key: w.word.length * 0.8 + rng.next() * 3 }));
    pool.sort((a, b) => a.key - b.key);
    const steps: Step[] = [];
    const found: string[] = [];
    let at = 0;
    for (const [i, w] of pool.entries()) {
      while (rng.chance(skill.err)) {
        at += thinkMs(rng, BASE * 0.6, skill);
        steps.push({ answer: found.join(","), atMs: at });
      }
      at += thinkMs(rng, BASE * (0.6 + w.word.length * 0.12) * (1 + i / Math.max(1, pool.length)), skill);
      found.unshift(`${w.word}:${w.path.join("-")}`);
      steps.push({ answer: found.join(","), atMs: at });
    }
    return { steps: fullClock(steps, (a) => gradeWordHunt(d, a, 0).isCorrect, limitMs) };
  },
};

// ───────────────────────── Interlock (tilegrid) ─────────────────────────

/** The solution's words as cell lists: the across word first, then each down word's new cells. */
function tileGridWords(solution: string[]): number[][] {
  const runs: number[][] = [];
  for (const horizontal of [true, false])
    for (let a = 0; a < TG_SIZE; a++) {
      let cur: number[] = [];
      for (let b = 0; b <= TG_SIZE; b++) {
        const i = horizontal ? a * TG_SIZE + b : b * TG_SIZE + a;
        if (b < TG_SIZE && solution[i]) { cur.push(i); continue; }
        if (cur.length >= 2) runs.push(cur);
        cur = [];
      }
    }
  return runs.sort((x, y) => y.length - x.length);
}

const interlock: PuzzleKit = {
  type: "tilegrid",
  nothing: () => encodeTileGrid([]),
  spam(p, rng) {
    const d = p as TileGridPuzzleData;
    const tray = d.tray;
    const rows = Array.from({ length: TG_CELLS }, () => "");
    tray.forEach((l, i) => (rows[i] = l));
    const random = Array.from({ length: TG_CELLS }, () => "");
    rng.shuffle(Array.from({ length: TG_CELLS }, (_, i) => i)).slice(0, tray.length).forEach((cell, i) => (random[cell] = tray[i]!));
    // Every tile in a plus/cross shape: one row of 7 and a column of 8 through it (a lazy "use them all").
    const shuffled = rng.shuffle(tray);
    const cross = Array.from({ length: TG_CELLS }, () => "");
    let k = 0;
    for (let c = 0; c < TG_SIZE; c++) cross[3 * TG_SIZE + c] = shuffled[k++]!;
    for (let r = 0; r < TG_SIZE && k < shuffled.length; r++) if (r !== 3) cross[r * TG_SIZE + 3] = shuffled[k++]!;
    for (let r = 0; r < TG_SIZE && k < shuffled.length; r++) if (r !== 3) cross[r * TG_SIZE + 1] = shuffled[k++]!;
    return [
      { label: "tray-in-rows", answer: encodeTileGrid(rows) },
      { label: "random-cells", answer: encodeTileGrid(random) },
      { label: "random-cross", answer: encodeTileGrid(cross) },
    ];
  },
  play(p, rng, skill) {
    const d = p as TileGridPuzzleData;
    const sol = d.solution ?? [];
    // BASE: 14 s to work out each word from the tray (anagramming), then 1.2 s per tile dragged into place.
    const THINK = 14, TILE = 1.2;
    // Natural order: word by word, longest first; a think pause before each word's first new tile.
    const natural: { cell: number; think: boolean }[] = [];
    const seen = new Set<number>();
    for (const word of tileGridWords(sol)) {
      const fresh = word.filter((c) => !seen.has(c));
      fresh.forEach((c, i) => { seen.add(c); natural.push({ cell: c, think: i === 0 }); });
    }
    // gradeAnswer calls any all-real-words grid "correct" (one finished word is enough) and the runner
    // would submit there, though the phone submits only on Done or at the buzzer. So the tile order
    // bends where needed (a tile of the next word goes down before the current word's last tile) to keep
    // the grid invalid until the fifteenth tile; the timing still follows the natural word-by-word order.
    const cells = Array.from({ length: TG_CELLS }, () => "");
    const validWith = (cell: number) => {
      const t = [...cells];
      t[cell] = sol[cell]!;
      return judgeTileGrid(decodeTileGrid(encodeTileGrid(t)), d.tray).valid;
    };
    const steps: Step[] = [];
    let at = 0;
    const push = () => steps.push({ answer: encodeTileGrid(cells), atMs: at });
    const left = natural.map((n) => n.cell);
    for (let k = 0; k < natural.length; k++) {
      if (natural[k]!.think) at += thinkMs(rng, THINK, skill);
      at += thinkMs(rng, TILE, skill);
      let pick = 0;
      if (left.length > 1 && validWith(left[0]!)) pick = Math.max(0, left.findIndex((c) => !validWith(c)));
      const cell = left.splice(pick, 1)[0]!;
      if (rng.chance(skill.err)) {
        // A mis-drop: the tile lands on a wrong empty cell next to the grid, is noticed and dragged across.
        const empties = Array.from({ length: TG_CELLS }, (_, i) => i).filter((i) => !cells[i] && !sol[i]);
        const wrong = empties.length ? rng.pick(empties) : -1;
        if (wrong >= 0) {
          cells[wrong] = sol[cell]!;
          push();
          at += thinkMs(rng, 4, skill);
          cells[wrong] = "";
        }
      }
      cells[cell] = sol[cell]!;
      push();
    }
    return { steps };
  },
};

// ───────────────────────── Slider (wordslide) ─────────────────────────

const ALL_SHIFTS: SlideShift[] = (["r", "c"] as const).flatMap((axis) =>
  Array.from({ length: SL_SIZE }, (_, index) => [1, -1].map((dir) => ({ axis, index, dir: dir as 1 | -1 }))).flat(),
);
const inverse = (s: SlideShift): SlideShift => ({ ...s, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 });
const slideCache = new Map<string, SlideShift[]>();

/** Bidirectional BFS from the scramble to the stored word grid (scrambles are 5–8 shifts deep). */
function solveSlide(start: string[], goal: string[]): SlideShift[] {
  const key = start.join("") + goal.join("");
  const hit = slideCache.get(key);
  if (hit) return hit;
  type Node = { parent: string | null; move: SlideShift | null };
  const fw = new Map<string, Node>([[start.join(""), { parent: null, move: null }]]);
  const bw = new Map<string, Node>([[goal.join(""), { parent: null, move: null }]]);
  let fFront = [start.join("")], bFront = [goal.join("")];
  const path = (meet: string): SlideShift[] => {
    const a: SlideShift[] = [];
    for (let k = meet; fw.get(k)!.parent !== null; k = fw.get(k)!.parent!) a.unshift(fw.get(k)!.move!);
    for (let k = meet; bw.get(k)!.parent !== null; k = bw.get(k)!.parent!) a.push(inverse(bw.get(k)!.move!));
    return a;
  };
  if (fw.has(goal.join(""))) return [];
  for (let depth = 0; depth < 12; depth++) {
    const forward = fFront.length <= bFront.length;
    const [mine, other, front] = forward ? [fw, bw, fFront] : [bw, fw, bFront];
    const next: string[] = [];
    for (const s of front) {
      const grid = [...s];
      for (const m of ALL_SHIFTS) {
        const t = applyShift(grid, m).join("");
        if (mine.has(t)) continue;
        mine.set(t, { parent: s, move: m });
        if (other.has(t)) {
          const out = path(t);
          slideCache.set(key, out);
          return out;
        }
        next.push(t);
      }
    }
    if (forward) fFront = next;
    else bFront = next;
  }
  throw new Error("Slider: no solution found");
}

const slider: PuzzleKit = {
  type: "wordslide",
  nothing: () => "",
  spam(p, rng, limitMs) {
    const d = p as WordSlidePuzzleData;
    const randomShifts = Array.from({ length: Math.min(500, Math.floor(limitMs / 500)) }, () => shiftToken(rng.pick(ALL_SHIFTS)));
    // Spin each row until the phone shows it green (a real word), lock it, move on; then mash columns.
    const tokens: string[] = [];
    let grid = [...d.grid];
    const locked = new Set<number>();
    let budget = Math.floor(limitMs / 450);
    for (let pass = 0; pass < 6 && budget > 0; pass++) {
      for (let r = 0; r < SL_SIZE && budget > 0; r++) {
        if (locked.has(r)) continue;
        for (let k = 0; k < SL_SIZE && budget > 0; k++) {
          if (isWord(markedRowWord(grid, r))) { tokens.push(`L${r}`); locked.add(r); break; }
          const s: SlideShift = { axis: "r", index: r, dir: 1 };
          grid = applyShift(grid, s, locked); tokens.push(shiftToken(s)); budget--;
        }
      }
      for (let k = 0; k < 3 && budget > 0; k++) {
        const s: SlideShift = { axis: "c", index: rng.below(SL_SIZE), dir: rng.chance(0.5) ? 1 : -1 };
        grid = applyShift(grid, s, locked); tokens.push(shiftToken(s)); budget--;
      }
    }
    return [
      { label: "random-shifts", answer: randomShifts.join(",") },
      { label: "spin-rows-lock-green", answer: tokens.join(",") },
    ];
  },
  play(p, rng, skill) {
    const d = p as WordSlidePuzzleData;
    // BASE 3 s per shift: read the five rows, decide which line to slide, swipe.
    const BASE = 3;
    const plan = solveSlide(d.grid, [...d.words.join("")]);
    const tokens: string[] = [];
    const steps: Step[] = [];
    let at = 0;
    for (const m of plan) {
      if (rng.chance(skill.err)) {
        // A wrong slide, noticed and undone (both count as moves).
        let w = rng.pick(ALL_SHIFTS);
        if (w.axis === m.axis && w.index === m.index && w.dir === m.dir) w = inverse(w);
        at += thinkMs(rng, BASE, skill);
        tokens.push(shiftToken(w));
        steps.push({ answer: tokens.join(","), atMs: at });
        at += thinkMs(rng, BASE * 0.6, skill);
        tokens.push("U");
        steps.push({ answer: tokens.join(","), atMs: at });
      }
      at += thinkMs(rng, BASE, skill);
      tokens.push(shiftToken(m));
      steps.push({ answer: tokens.join(","), atMs: at });
    }
    return { steps };
  },
};

// ───────────────────────── Lookout (wordsearch) ─────────────────────────

const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]] as const;

function randomLine(rng: Rng, size: number, len: number): number[] | null {
  const start = rng.below(size * size);
  const [dr, dc] = rng.pick(DIRS);
  const r = Math.floor(start / size) + dr * (len - 1), c = (start % size) + dc * (len - 1);
  if (r < 0 || r >= size || c < 0 || c >= size) return null;
  return wsLine(start, r * size + c, size);
}

const lookout: PuzzleKit = {
  type: "wordsearch",
  nothing: () => "",
  spam(p, rng, limitMs) {
    const d = p as WordSearchPuzzleData;
    const cap = Math.min(300, Math.floor(limitMs / 900));
    const randomDrags: number[][] = [];
    while (randomDrags.length < cap) {
      const line = randomLine(rng, d.size, rng.int(4, 8));
      if (line) randomDrags.push(line);
    }
    // Drags starting on letters the hidden words don't start with are pointless; a masher drags from every cell.
    const sweep: number[][] = [];
    for (let cell = 0; cell < d.size * d.size && sweep.length < cap; cell += 1) {
      const len = rng.int(4, 7);
      const [dr, dc] = rng.pick(DIRS);
      const r = Math.floor(cell / d.size) + dr * (len - 1), c = (cell % d.size) + dc * (len - 1);
      if (r < 0 || r >= d.size || c < 0 || c >= d.size) continue;
      sweep.push(wsLine(cell, r * d.size + c, d.size)!);
    }
    return [
      { label: "random-drags", answer: wsEncode(randomDrags) },
      { label: "sweep-every-cell", answer: wsEncode(sweep) },
    ];
  },
  play(p, rng, skill) {
    const d = p as WordSearchPuzzleData;
    // BASE 9 s per word: scan the grid for one of the category's words, then drag it.
    const BASE = 9;
    const sels: number[][] = [];
    const steps: Step[] = [];
    let at = 0;
    for (const pl of rng.shuffle(d.placements ?? [])) {
      while (rng.chance(skill.err * 1.5)) {
        // A mis-drag: the right start but one cell short or long (counts as a wrong selection).
        at += thinkMs(rng, BASE * 0.5, skill);
        const a = pl.cells[0]!, b = pl.cells[pl.cells.length - 2]!;
        const line = wsLine(a, b, d.size);
        if (line && line.length >= 2 && wsMatch(d.placements ?? [], line) < 0) sels.push(line);
        steps.push({ answer: wsEncode(sels), atMs: at });
      }
      at += thinkMs(rng, BASE, skill);
      sels.push(rng.chance(0.5) ? [...pl.cells] : [...pl.cells].reverse());
      steps.push({ answer: wsEncode(sels), atMs: at });
    }
    return { steps };
  },
};

// ───────────────────────── Roundabout (letterwheel) ─────────────────────────

const roundabout: PuzzleKit = {
  type: "letterwheel",
  nothing: () => "",
  spam(p, rng, limitMs) {
    const d = p as LetterWheelPuzzleData;
    const words = d.words ?? [];
    const wheel = [...d.letters];
    const run = (label: string, perTryMs: number, len: () => number): SpamPlay => {
      const filled: (string | undefined)[] = [];
      for (let at = perTryMs; at <= limitMs; at += perTryMs) {
        const w = rng.shuffle(wheel).slice(0, Math.min(wheel.length, len())).join("");
        const i = words.indexOf(w);
        if (i >= 0 && !filled.includes(w)) filled[i] = w;
      }
      return { label, answer: filled.filter(Boolean).join(",") };
    };
    return [run("random-3", 1000, () => 3), run("random-3to5", 1300, () => rng.int(3, 5))];
  },
  play(p, rng, skill) {
    const d = p as LetterWheelPuzzleData;
    const words = d.words ?? [];
    // BASE 7 s per crossword word: spot it in the wheel (helped by the crossing letters) and trace it.
    const BASE = 7;
    const order = words.map((w, i) => ({ i, key: w.length + rng.next() * 3 })).sort((a, b) => a.key - b.key);
    const filled: (string | undefined)[] = [];
    const steps: Step[] = [];
    let at = 0;
    for (const { i } of order) {
      while (rng.chance(skill.err * 1.5)) {
        // A real word that is not in this crossword, or a mis-trace: time only.
        at += thinkMs(rng, BASE * 0.5, skill);
        steps.push({ answer: filled.filter(Boolean).join(","), atMs: at });
      }
      at += thinkMs(rng, BASE * (0.7 + words[i]!.length * 0.08), skill);
      filled[i] = words[i];
      steps.push({ answer: filled.filter(Boolean).join(","), atMs: at });
    }
    return { steps };
  },
};

// ───────────────────────── Strikeout ─────────────────────────

const soReplay = (p: StrikeoutPuzzleData, actions: SoAction[]) => replayStrikeout(p.words ?? [], actions, isWord);

/** Words still possible for one row given what the board shows. */
function soCandidates(p: StrikeoutPuzzleData, state: SoState, row: number): string[] {
  const target = (p.words ?? [])[row] ?? "";
  const shown = [...target].map((ch, i) => (state.revealed[row]![i] ? ch : ""));
  const guessed = new Set(state.guessed);
  const wrongSolves = new Set(state.effective.filter((a) => a.kind === "solve" && a.row === row).map((a) => (a as { word: string }).word));
  return answerWords(SO_LEN).filter((w) => {
    if (wrongSolves.has(w)) return false;
    for (let i = 0; i < SO_LEN; i++) {
      if (shown[i]) { if (w[i] !== shown[i]) return false; }
      else if (guessed.has(w[i]!)) return false;
    }
    return true;
  });
}

const strikeout: PuzzleKit = {
  type: "strikeout",
  nothing: () => "",
  spam(_p, rng) {
    const g = (letters: string): string => encodeStrikeout([...letters].map((letter) => ({ kind: "guess", letter })));
    return [
      { label: "alphabet", answer: g(ALPHA) },
      { label: "frequency-order", answer: g(FREQ) },
      { label: "random-letters", answer: g(rng.shuffle([...ALPHA]).join("")) },
    ];
  },
  play(p, rng, skill) {
    const d = p as StrikeoutPuzzleData;
    // BASE 4 s per letter guess (read five rows, pick a letter); a solve takes 1.6× (choose the row, type five letters).
    const BASE = 4;
    const actions: SoAction[] = [];
    const steps: Step[] = [];
    let at = 0;
    for (let guard = 0; guard < 60; guard++) {
      const state = soReplay(d, actions);
      if (state.done || state.over) break;
      const open = (d.words ?? []).map((_, r) => r).filter((r) => !soRowSolved(state, r));
      const cands = open.map((r) => ({ r, c: soCandidates(d, state, r) }));
      const sure = cands.filter((x) => x.c.length === 1);
      // A person solves once a row is certain; a strong player will also gamble on two options late on.
      const gamble = cands.find((x) => x.c.length === 2 && state.strikes <= 1 && rng.chance(0.3));
      if (sure.length || gamble) {
        const { r, c } = sure[0] ?? gamble!;
        at += thinkMs(rng, BASE * 1.6, skill);
        actions.push({ kind: "solve", row: r, word: rng.pick(c) });
        steps.push({ answer: encodeStrikeout(actions), atMs: at });
        continue;
      }
      const unguessed = [...ALPHA].filter((l) => !state.guessed.includes(l));
      let letter: string;
      if (rng.chance(skill.err)) {
        // A hunch letter: a common letter not yet tried, regardless of the candidates.
        letter = FREQ.split("").filter((l) => unguessed.includes(l)).slice(0, 8)[rng.below(4)] ?? unguessed[0]!;
      } else {
        // The letter appearing in most remaining candidates (summed over open rows, each row weighted equally).
        let best = unguessed[0]!, bestScore = -1;
        for (const l of unguessed) {
          let s = 0;
          for (const { c } of cands) if (c.length) s += c.filter((w) => w.includes(l)).length / c.length;
          if (s > bestScore) { bestScore = s; best = l; }
        }
        letter = best;
      }
      at += thinkMs(rng, BASE, skill);
      actions.push({ kind: "guess", letter });
      steps.push({ answer: encodeStrikeout(actions), atMs: at });
    }
    return { steps };
  },
};

// ───────────────────────── Cryptogrid (codeword) ─────────────────────────

const cryptogrid: PuzzleKit = {
  type: "codeword",
  nothing: () => "",
  spam(p, rng) {
    const d = p as CodewordPuzzleData;
    const given = new Set(d.givens.map((g) => g.n));
    const givenLetters = new Set(d.givens.map((g) => g.letter));
    const hidden = Array.from({ length: d.numbers }, (_, i) => i + 1).filter((n) => !given.has(n));
    const free = [...FREQ].filter((l) => !givenLetters.has(l));
    // Most frequent number on the grid gets E, then T, A, O… (a classic codebreaker's first guess).
    const count = new Map<number, number>();
    for (const n of d.cells) if (n > 0) count.set(n, (count.get(n) ?? 0) + 1);
    const byFreq = [...hidden].sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0));
    const freqFill: CwAction[] = byFreq.map((n, i) => ({ n, letter: free[i] ?? null }));
    const rand = rng.shuffle(free);
    const randomFill: CwAction[] = hidden.map((n, i) => ({ n, letter: rand[i] ?? null }));
    // Keep re-rolling random letters onto random numbers at ~1.5 per second.
    const reroll: CwAction[] = Array.from({ length: 150 }, () => ({ n: rng.pick(hidden), letter: rng.pick(free) }));
    return [
      { label: "frequency-fill", answer: encodeCodeword(freqFill) },
      { label: "random-fill", answer: encodeCodeword(randomFill) },
      { label: "random-reassign", answer: encodeCodeword(reroll) },
    ];
  },
  play(p, rng, skill) {
    const d = p as CodewordPuzzleData;
    const sol = d.solution ?? "";
    const given = new Set(d.givens.map((g) => g.n));
    const givenLetters = new Set(d.givens.map((g) => g.letter));
    // BASE 6 s per number cracked (read a part-filled word, deduce one letter, tap number + letter).
    const BASE = 6;
    const count = new Map<number, number>();
    for (const n of d.cells) if (n > 0) count.set(n, (count.get(n) ?? 0) + 1);
    // Rough solving order: frequent numbers first, with noise.
    const rank = new Map(Array.from({ length: d.numbers }, (_, i) => [i + 1, -(count.get(i + 1) ?? 0) + rng.next() * 3]));
    const actions: CwAction[] = [];
    const steps: Step[] = [];
    let at = 0;
    for (let guard = 0; guard < 300; guard++) {
      const letters = replayCodeword(d.numbers, d.givens, actions);
      const todo = Array.from({ length: d.numbers }, (_, i) => i + 1)
        .filter((n) => !given.has(n) && letters[n - 1] !== sol[n - 1])
        .sort((a, b) => rank.get(a)! - rank.get(b)!);
      if (!todo.length) break;
      // Fix a wrong letter you can see first (a filled, wrong number), else crack the next number.
      const wrongShown = todo.filter((n) => letters[n - 1]);
      const n = wrongShown.length && rng.chance(0.5) ? wrongShown[0]! : todo[0]!;
      at += thinkMs(rng, BASE, skill);
      let letter = sol[n - 1]!;
      if (rng.chance(skill.err)) {
        const wrong = [...ALPHA].filter((l) => l !== letter && !givenLetters.has(l));
        letter = rng.pick(wrong);
      }
      actions.push({ n, letter });
      steps.push({ answer: encodeCodeword(actions), atMs: at });
    }
    return { steps };
  },
};

// ───────────────────────── Swapword ─────────────────────────

const swapword: PuzzleKit = {
  type: "swapword",
  nothing: () => "",
  spam(p, rng) {
    const d = p as SwapwordPuzzleData;
    const sol = d.solution ?? "";
    const random: SwSwap[] = [];
    while (random.length < d.maxSwaps) {
      const a = rng.below(SW_TILES), b = rng.below(SW_TILES);
      if (a !== b) random.push([a, b]);
    }
    // Swap only tiles not yet green (the phone shows in-place marks after every swap).
    const notGreen: SwSwap[] = [];
    let board = d.start;
    while (notGreen.length < d.maxSwaps) {
      const marks = swapwordMarks(board, sol);
      const open = marks.map((m, t) => (m === 2 ? -1 : t)).filter((t) => t >= 0);
      if (open.length < 2) break;
      const [a, b] = rng.shuffle(open);
      notGreen.push([a!, b!]);
      board = replaySwapword(d.start, notGreen, d.maxSwaps).board;
    }
    // Same, but preferring tiles marked "needed elsewhere" (amber).
    const amber: SwSwap[] = [];
    board = d.start;
    while (amber.length < d.maxSwaps) {
      const marks = swapwordMarks(board, sol);
      const ambers = marks.map((m, t) => (m === 1 ? t : -1)).filter((t) => t >= 0);
      const open = marks.map((m, t) => (m === 2 ? -1 : t)).filter((t) => t >= 0);
      if (open.length < 2) break;
      const a = ambers.length ? rng.pick(ambers) : rng.pick(open);
      const b = rng.pick(open.filter((t) => t !== a));
      amber.push([a, b]);
      board = replaySwapword(d.start, amber, d.maxSwaps).board;
    }
    return [
      { label: "random-swaps", answer: encodeSwapword(random) },
      { label: "swap-non-green", answer: encodeSwapword(notGreen) },
      { label: "swap-amber", answer: encodeSwapword(amber) },
    ];
  },
  play(p, rng, skill) {
    const d = p as SwapwordPuzzleData;
    const sol = d.solution ?? "";
    // BASE 5 s per swap: read the crossing words and marks, work out which two tiles to trade, drag.
    const BASE = 5;
    const swaps: SwSwap[] = [];
    const steps: Step[] = [];
    let at = 0;
    for (let guard = 0; guard < 80; guard++) {
      const run = replaySwapword(d.start, swaps, d.maxSwaps, sol);
      if (run.solved || run.over) break;
      at += thinkMs(rng, BASE, skill);
      if (rng.chance(skill.err)) {
        const open = [...run.board].map((ch, t) => (ch === sol[t] ? -1 : t)).filter((t) => t >= 0);
        const [a, b] = rng.shuffle(open);
        if (a !== undefined && b !== undefined) swaps.push([a, b]);
      } else {
        swaps.push(witnessSwaps(run.board, sol)[0]!);
      }
      steps.push({ answer: encodeSwapword(swaps), atMs: at });
    }
    return { steps };
  },
};

export const KITS_WORD: PuzzleKit[] = [nucleus, forage, interlock, slider, lookout, roundabout, strikeout, cryptogrid, swapword];

