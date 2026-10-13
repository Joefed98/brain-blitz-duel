/**
 * Swapword check:
 *   1. the same seed deals the same board; a room seed gives every player the same board;
 *   2. nothing sent to the phone (public puzzle, live-check replies) carries the solution;
 *   3. minimum-swap proof: minSwaps (exhaustive cycle-decomposition search) equals a
 *      breadth-first search over swap sequences on 400 small random boards with
 *      repeated letters; every generated board has a replayed witness of exactly
 *      minSwaps swaps, a 9–12 minimum, 3–5 tiles in place, budget minimum + 5;
 *   4. needed-elsewhere rule: gold exactly when in place; teal only when a word
 *      through the tile still needs that letter elsewhere; per word, no letter is
 *      shown teal more often than it is still needed (duplicates), and every such
 *      need is shown while copies remain; hand cases with repeated letters;
 *   5. generator rules over 300 seeds (six different common words) and < 1 s each;
 *   6. score anchors: perfect 150, minimum finish ≥ 111, best unfinished ≤ 100 and
 *      below every finish, nothing 0; cap 150.
 *
 *   bun scripts/swapword-check.ts
 */
import { answerWords, isWord } from "../src/lib/duel/dictionary.server";
import { buildRoomPuzzles, generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import {
  SW_SLOT_TILES,
  SW_SLOTS,
  SW_TILES,
  SW_TILE_SLOTS,
  encodeSwapword,
  replaySwapword,
  scoreSwapword,
  swapwordMarks,
  type SwSwap,
} from "../src/lib/duel/swapword";
import {
  checkSwapwordMoves,
  minSwaps,
  swapwordRuleBreak,
  swapwordWords,
  witnessSwaps,
} from "../src/lib/duel/swapword.server";
import { SWAPWORD_TIME_MS, type SwapwordPuzzleData } from "../src/lib/duel/types";
import { isPluralForm } from "../src/lib/duel/wordsmith.server";

const failures: string[] = [];
let checks = 0;
function check(label: string, ok: boolean) {
  checks++;
  if (!ok) failures.push(label);
}
const LIMIT = SWAPWORD_TIME_MS;
const gen = (seed: number) => generatePuzzle("swapword", { bankSeed: seed }) as SwapwordPuzzleData;

// 1. Determinism.
for (const seed of [1, 77, 4242, 0x7fff_ffff]) check(`seed ${seed}: same board twice`, JSON.stringify(gen(seed)) === JSON.stringify(gen(seed)));
check("different seeds differ", JSON.stringify(gen(5)) !== JSON.stringify(gen(6)));
{
  let dealt = 0;
  for (let seed = 1; seed <= 400 && dealt < 5; seed++) {
    const a = buildRoomPuzzles({ categories: ["word"], seed });
    const at = a.roundOrder.indexOf("swapword");
    if (at < 0) continue;
    dealt++;
    const b = buildRoomPuzzles({ categories: ["word"], seed });
    check(`room seed ${seed}: same Swapword board`, JSON.stringify(a.puzzles[at]) === JSON.stringify(b.puzzles[at]));
  }
  check("a word room deals Swapword", dealt === 5);
  const p = gen(31337);
  check("stamped speedPar 1 and swapwordRev 1", (p as { speedPar?: number }).speedPar === 1 && p.swapwordRev === 1);
}

// 2. Secrecy.
for (let seed = 1; seed <= 60; seed++) {
  const full = gen(seed * 131);
  const { pub, priv } = splitPuzzle(full);
  const json = JSON.stringify(pub);
  check(`seed ${seed}: solution private`, !("solution" in pub) && typeof priv["solution"] === "string");
  check(`seed ${seed}: solution string not public`, !json.includes(full.solution!));
  const view = checkSwapwordMoves(full, "");
  check(`seed ${seed}: reply keys`, JSON.stringify(Object.keys(view).sort()) === JSON.stringify(["count", "marks", "over", "solved", "swaps"]));
  check(`seed ${seed}: reply carries marks only`, view.marks.length === SW_TILES && view.marks.every((m) => m === 0 || m === 1 || m === 2));
}

// 3a. minSwaps = breadth-first search on small boards with repeated letters.
function bfsMin(start: string, goal: string): number {
  if (start === goal) return 0;
  const seen = new Set([start]);
  let frontier = [start];
  for (let depth = 1; depth <= start.length; depth++) {
    const next: string[] = [];
    for (const s of frontier) {
      for (let i = 0; i < s.length; i++)
        for (let j = i + 1; j < s.length; j++) {
          if (s[i] === s[j]) continue;
          const a = [...s];
          [a[i], a[j]] = [a[j]!, a[i]!];
          const t = a.join("");
          if (t === goal) return depth;
          if (!seen.has(t)) {
            seen.add(t);
            next.push(t);
          }
        }
    }
    frontier = next;
  }
  return -1;
}
let rng = 12345;
const rand = (n: number) => ((rng = (Math.imul(rng, 1103515245) + 12345) >>> 0) % n);
let dupCases = 0;
for (let k = 0; k < 400; k++) {
  const len = 6 + rand(4);
  const alpha = "ABCD".slice(0, 2 + rand(3));
  const goal = Array.from({ length: len }, () => alpha[rand(alpha.length)]).join("");
  const arr = [...goal];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  const start = arr.join("");
  if (new Set(goal).size < goal.length) dupCases++;
  const a = minSwaps(start, goal), b = bfsMin(start, goal);
  check(`small board ${start}→${goal}: search ${a} vs BFS ${b}`, a === b);
}
check("small boards include repeated letters", dupCases > 300);

// 3b + 5. Generated boards.
const commonByLen = new Map([4, 6].map((n) => [n, new Set(answerWords(n))]));
let worstMs = 0;
let minFinish = 999, maxUnfinished = 0;
for (let seed = 1; seed <= 300; seed++) {
  const t0 = performance.now();
  const p = gen(seed * 7919);
  worstMs = Math.max(worstMs, performance.now() - t0);
  const solution = p.solution!;
  check(`seed ${seed}: rule break ${swapwordRuleBreak(p)}`, swapwordRuleBreak(p) === null);
  const words = swapwordWords(solution);
  check(`seed ${seed}: six different words`, new Set(words).size === 6);
  words.forEach((w, s) => check(`${w}: common answer word`, commonByLen.get(SW_SLOTS[s]!.len)!.has(w) && isWord(w) && !isPluralForm(w)));
  check(`seed ${seed}: minimum ${p.minSwaps} in 9–12`, p.minSwaps >= 9 && p.minSwaps <= 12);
  check(`seed ${seed}: budget = minimum + 5`, p.maxSwaps === p.minSwaps + 5);
  const inPlace = [...p.start].filter((ch, t) => ch === solution[t]).length;
  check(`seed ${seed}: ${inPlace} start in place`, inPlace >= 3 && inPlace <= 5);
  const witness = witnessSwaps(p.start, solution);
  const run = replaySwapword(p.start, witness, p.maxSwaps, solution);
  check(`seed ${seed}: witness of ${witness.length} swaps solves`, run.solved && witness.length === p.minSwaps);
  // Fewer swaps than the minimum never solve: one swap changes the cycle count by at most one.
  check(`seed ${seed}: minimum after one useful swap drops by at most 1`, (() => {
    const b = [...p.start];
    const [i, j] = witness[0]!;
    [b[i], b[j]] = [b[j]!, b[i]!];
    return minSwaps(b.join(""), solution) === p.minSwaps - 1;
  })());
  // Score anchors per board.
  const perfect = gradeAnswer(p, encodeSwapword(witness), LIMIT).score;
  check(`seed ${seed}: perfect run 150 (got ${perfect})`, perfect === 150);
  // A slow finish: four wasted swaps (two tiles back and forth) then the witness, at the buzzer.
  const free = [...Array(SW_TILES).keys()].find((t) => p.start[t] !== solution[t])!;
  const other = [...Array(SW_TILES).keys()].find((t) => t !== free && p.start[t] !== solution[t] && p.start[t] !== p.start[free])!;
  const waste: SwSwap[] = [[free, other], [free, other], [free, other], [free, other]];
  const slow = gradeAnswer(p, encodeSwapword([...waste, ...witness]), 0);
  check(`seed ${seed}: finish with min + 4 swaps at the buzzer is solved`, slow.isCorrect);
  // The lowest a finish can score: the whole budget used, at the buzzer.
  const minimumFinish = scoreSwapword(true, p.maxSwaps, p.minSwaps, 0, 0, LIMIT);
  minFinish = Math.min(minFinish, minimumFinish, slow.score);
  // Best unfinished: everything placed but the last witness swap.
  const almost = gradeAnswer(p, encodeSwapword(witness.slice(0, -1)), LIMIT);
  check(`seed ${seed}: one swap short is unfinished`, !almost.isCorrect);
  const startMisplaced = [...p.start].filter((ch, t) => ch !== solution[t]).length;
  maxUnfinished = Math.max(maxUnfinished, almost.score, Math.min(100, 5 * (startMisplaced - 2)));
  check(`seed ${seed}: nothing scores 0`, gradeAnswer(p, "", LIMIT).score === 0);
  // New rounds (puzzleScoreRev 1): 120 + MOVES(15) + PAR(15); the last swap short is the 110 top.
  const fresh = { ...p, puzzleScoreRev: 1 } as typeof p;
  check(`seed ${seed}: new shape perfect 150`, gradeAnswer(fresh, encodeSwapword(witness), LIMIT).score === 150);
  const freshSlow = gradeAnswer(fresh, encodeSwapword([...waste, ...witness]), 0).score;
  check(`seed ${seed}: new shape slow finish 120-135 (${freshSlow})`, freshSlow >= 120 && freshSlow <= 135);
  const freshAlmost = gradeAnswer(fresh, encodeSwapword(witness.slice(0, -1)), LIMIT).score;
  check(`seed ${seed}: new shape one swap short ≤ 110 (${freshAlmost})`, freshAlmost <= 110);
  check(`seed ${seed}: new shape nothing 0`, gradeAnswer(fresh, "", LIMIT).score === 0);
}
check(`generation under 1 s (worst ${worstMs.toFixed(0)} ms)`, worstMs < 1000);
check(`finishing beats any unfinished (${minFinish} > ${maxUnfinished})`, minFinish > maxUnfinished && minFinish >= 111);
check("unfinished cap 100", scoreSwapword(false, 99, 9, 30, LIMIT, LIMIT) === 100);
check("cap 150", scoreSwapword(true, 9, 9, 0, LIMIT, LIMIT) === 150 && scoreSwapword(true, 5, 9, 0, LIMIT, LIMIT) === 150);

// 4. Needed-elsewhere rule.
function marksOk(board: string, solution: string): string | null {
  const marks = swapwordMarks(board, solution);
  for (let t = 0; t < SW_TILES; t++) {
    if ((marks[t] === 2) !== (board[t] === solution[t])) return `tile ${t}: gold iff in place`;
    if (marks[t] === 1) {
      const needed = SW_TILE_SLOTS[t]!.some((s) => SW_SLOT_TILES[s]!.some((q) => q !== t && board[q] !== solution[q] && solution[q] === board[t]));
      if (!needed) return `tile ${t}: teal but no word through it needs ${board[t]}`;
    }
  }
  // Per word and letter: teal tiles that the word can account for ≤ copies still needed,
  // and the word marks min(needed, misplaced holders) of them.
  for (const tiles of SW_SLOT_TILES) {
    for (const letter of new Set(tiles.map((t) => board[t]!))) {
      const need = tiles.filter((q) => board[q] !== solution[q] && solution[q] === letter).length;
      const holders = tiles.filter((q) => board[q] === letter && board[q] !== solution[q]);
      const markedHere = holders.slice(0, need);
      if (markedHere.some((q) => marks[q] !== 1)) return `word ${tiles.join(",")}: a needed ${letter} not teal`;
      const unaccounted = holders.slice(need).filter((q) => marks[q] === 1 && SW_TILE_SLOTS[q]!.length === 1);
      if (unaccounted.length) return `word ${tiles.join(",")}: ${letter} teal more often than needed`;
    }
  }
  return null;
}
for (let seed = 1; seed <= 80; seed++) {
  const p = gen(seed * 977);
  let board = p.start;
  const swaps: SwSwap[] = [];
  for (let k = 0; k < 14; k++) {
    const broken = marksOk(board, p.solution!);
    check(`seed ${seed} step ${k}: ${broken}`, broken === null);
    const a = rand(SW_TILES), b = rand(SW_TILES);
    if (a === b) continue;
    swaps.push([a, b]);
    board = replaySwapword(p.start, swaps, 99).board;
  }
}
{
  // Hand cases on the top word (tiles 0–3) and the long across word (tiles 9–14).
  const base = gen(4242).solution!;
  const set = (s: string, edits: Record<number, string>) => [...s].map((ch, t) => edits[t] ?? ch).join("");
  // Solution top word made "ALLY"-like: needs two Ls; board holds three Ls in the word, one in place.
  const sol = set(base, { 0: "A", 1: "L", 2: "L", 3: "Y" });
  const board = set(sol, { 0: "L", 1: "L", 2: "A", 3: "L" });
  const m = swapwordMarks(board, sol);
  // Tile 1 in place; tiles 0 and 3 hold L but the word needs only one more L (tile 2).
  check("duplicates: in-place L gold", m[1] === 2);
  check("duplicates: first spare L teal", m[0] === 1);
  const tile3Crossing = SW_TILE_SLOTS[3]!.length > 1;
  check("duplicates: second spare L not teal from the top word", tile3Crossing ? marksOk(board, sol) === null : m[3] === 0);
  check("duplicates: misplaced A teal", m[2] === 1);
}

if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} Swapword checks`);
  process.exit(1);
}
console.log(`anchors: perfect 150, minimum finish ${minFinish}, best unfinished ${maxUnfinished}, nothing 0`);
console.log(`PASS: ${checks} Swapword checks (determinism, secrecy, minimum-swap search = BFS on 400 boards with repeats, 300 generated boards with witnesses, marks rule, worst ${worstMs.toFixed(0)} ms)`);
