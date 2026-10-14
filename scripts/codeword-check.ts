/**
 * Cryptogrid (codeword) check:
 *   1. the same seed draws the same board; a room seed gives every player the same board;
 *   2. nothing sent to the phone (public puzzle, live-check replies) carries the
 *      letter code: only the givens' letters are public, and a reply says
 *      solved / not solved only once every number has a letter;
 *   3. the uniqueness solver agrees with brute force on small grids;
 *   4. every one of the 1,000 bank boards: 7 × 7, symmetric, every white cell in
 *      a 3+ letter word, no two-letter runs, connected, common answer words only,
 *      no repeats, 14–18 letters, 4 givens, and exactly one solution against the
 *      full dictionary, re-proven with rev 2's fifth given (a different hidden number
 *      filling 2+ squares); two sampled entries rebuild byte-for-byte from their seeds;
 *   5. replay rules (moving a letter, clearing, givens fixed);
 *   6. score anchors: perfect 150, minimum finish 130, best unfinished < 130, nothing 0
 *      (stored rounds); new rounds (puzzleScoreRev 1) 150 / 120 / 110 / 0;
 *   7. codewordRev 2 (five givens): new boards are the rev-1 board of the same seed plus
 *      one given; 40 rev-1 boards recorded on main before the change
 *      (scripts/fixtures/codeword-rev1-legacy.json.gz) rebuild from the bank exactly as
 *      stored and every recorded answer grades identically (score, credit, extra).
 *
 *   bun scripts/codeword-check.ts            (all 1,000 boards)
 *   bun scripts/codeword-check.ts --part=k/n (bank part k of n; the rest runs in every part)
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { CODEWORD_BANK } from "../src/lib/duel/codewordBank.server";
import {
  CW_SIZE,
  codewordTally,
  compactCodeword,
  decodeCodeword,
  encodeCodeword,
  replayCodeword,
  scoreCodeword,
  type CwAction,
} from "../src/lib/duel/codeword";
import {
  checkCodewordMoves,
  codewordBankIndex,
  codewordEntryRuleBreak,
  codewordFifthGiven,
  codewordFromEntry,
  countCodewordSolutions,
} from "../src/lib/duel/codeword.server";
import { dictionaryWords } from "../src/lib/duel/dictionary.server";
import { buildRoomPuzzles, generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { CODEWORD_TIME_MS, type CodewordPuzzleData, type PuzzleData } from "../src/lib/duel/types";
import { wordGameSeed } from "../src/lib/duel/wordSeed.server";
import { buildEntry } from "./codeword-bank";

const failures: string[] = [];
let checks = 0;
function check(label: string, ok: boolean) {
  checks++;
  if (!ok) failures.push(label);
}
const LIMIT = CODEWORD_TIME_MS;
const gen = (seed: number) => generatePuzzle("codeword", { bankSeed: seed }) as CodewordPuzzleData;
const partArg = process.argv.find((a) => a.startsWith("--part="))?.slice(7);
const [part, parts] = partArg ? partArg.split("/").map(Number) as [number, number] : [1, 1];

// 1. Determinism.
for (const seed of [1, 77, 4242, 0x7fff_ffff]) check(`seed ${seed}: same board twice`, JSON.stringify(gen(seed)) === JSON.stringify(gen(seed)));
check("different seeds differ", JSON.stringify(gen(5)) !== JSON.stringify(gen(6)));
{
  let dealt = 0;
  for (let seed = 1; seed <= 400 && dealt < 5; seed++) {
    const a = buildRoomPuzzles({ categories: ["word"], seed });
    const at = a.roundOrder.indexOf("codeword");
    if (at < 0) continue;
    dealt++;
    const b = buildRoomPuzzles({ categories: ["word"], seed });
    check(`room seed ${seed}: same Cryptogrid board`, JSON.stringify(a.puzzles[at]) === JSON.stringify(b.puzzles[at]));
  }
  check("a word room deals Cryptogrid", dealt === 5);
  const p = gen(31337);
  check("stamped speedPar 1 and codewordRev 2", (p as { speedPar?: number }).speedPar === 1 && p.codewordRev === 2);
  check(`new boards start with five givens (${p.givens.length})`, p.givens.length === 5);
  check(`bank holds 1,000 boards (${CODEWORD_BANK.length})`, CODEWORD_BANK.length === 1000);
}

// 2. Secrecy.
for (let seed = 1; seed <= 60; seed++) {
  const full = gen(seed * 211);
  const { pub, priv } = splitPuzzle(full);
  check(`seed ${seed}: code private`, !("solution" in pub) && typeof priv["solution"] === "string");
  const letters = (JSON.stringify(pub).match(/"[A-Z]"/g) ?? []).map((m) => m[1]!);
  const givenLetters = new Set(full.givens.map((g) => g.letter));
  check(`seed ${seed}: only given letters public`, letters.every((l) => givenLetters.has(l)));
  const partial = checkCodewordMoves(full, "");
  check(`seed ${seed}: incomplete reply says nothing`, !partial.complete && !partial.solved);
  check(`seed ${seed}: reply keys`, JSON.stringify(Object.keys(partial).sort()) === JSON.stringify(["complete", "count", "solved"]));
  // A full wrong assignment is "complete, not solved", nothing more.
  const hidden = Array.from({ length: full.numbers }, (_, i) => i + 1).filter((n) => !full.givens.some((g) => g.n === n));
  const pool = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].filter((l) => !givenLetters.has(l));
  const wrong: CwAction[] = hidden.map((n, i) => ({ n, letter: pool[(i + 1) % pool.length]! }));
  const wrongView = checkCodewordMoves(full, encodeCodeword(wrong));
  check(`seed ${seed}: full wrong code → complete, not solved`, wrongView.complete && !wrongView.solved);
}

// 3. Solver against brute force on small grids.
{
  const w3 = dictionaryWords(3).filter((w) => new Set(w).size === 3);
  const one = Array(49).fill(0);
  one[0] = 1; one[1] = 2; one[2] = 3;
  check("solver: one 3-letter run = every 3-letter word with 3 different letters", countCodewordSolutions(one, 3, [], 1e6) === w3.length);
  const cross = Array(49).fill(0);
  cross[0] = 1; cross[1] = 2; cross[2] = 3; cross[7] = 4; cross[14] = 5;
  let n = 0;
  for (const a of w3) for (const d of w3) if (a[0] === d[0] && new Set(a + d.slice(1)).size === 5) n++;
  check("solver: crossing pair matches brute force", countCodewordSolutions(cross, 5, [], 1e7) === n);
  let m = 0;
  for (const a of w3) for (const d of w3) if (a[0] === "T" && d[0] === "T" && a[2] === "E" && new Set(a + d.slice(1)).size === 5) m++;
  check("solver: givens filter like brute force", countCodewordSolutions(cross, 5, [{ n: 1, letter: "T" }, { n: 3, letter: "E" }], 1e7) === m);
}

// 4. Every bank board (this part).
const started = performance.now();
let proven = 0;
for (let i = part - 1; i < CODEWORD_BANK.length; i += parts) {
  const broken = codewordEntryRuleBreak(CODEWORD_BANK[i]!);
  check(`bank ${i}: ${broken}`, broken === null);
  proven++;
}
for (const i of [part - 1, 500 + part - 1]) {
  check(`bank ${i}: rebuilds byte-for-byte from its seed`, buildEntry(i) === CODEWORD_BANK[i]);
}
const bankSeconds = (performance.now() - started) / 1000;
// The verifier rejects broken boards: a changed letter, a lost given, a two-letter run.
{
  const [grid = "", order = "", given = ""] = CODEWORD_BANK[0]!.split("|");
  const at = [...grid].findIndex((ch) => ch !== "#");
  const swapLetter = grid[at] === "Q" ? "Z" : "Q";
  const mutated = `${grid.slice(0, at)}${swapLetter}${grid.slice(at + 1)}|${order}|${given}`;
  check("verifier rejects a changed letter", codewordEntryRuleBreak(mutated) !== null);
  check("verifier rejects three givens", codewordEntryRuleBreak(`${grid}|${order}|${given.split(".").slice(0, 3).join(".")}`) !== null);
  check("verifier rejects five stored givens", codewordEntryRuleBreak(`${grid}|${order}|${given}.${codewordFifthGiven(CODEWORD_BANK[0]!)}`) !== null);
  const blackAt = [...grid].findIndex((ch) => ch === "#");
  check("verifier rejects a broken pattern", codewordEntryRuleBreak(`${grid.slice(0, blackAt)}A${grid.slice(blackAt + 1)}|${order}|${given}`) !== null);
}

// 5. Replay rules.
{
  const p = codewordFromEntry(CODEWORD_BANK[0]!);
  const g = p.givens[0]!;
  const free = Array.from({ length: p.numbers }, (_, i) => i + 1).filter((n) => !p.givens.some((x) => x.n === n));
  const [a, b] = [free[0]!, free[1]!];
  const letter = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].find((l) => !p.givens.some((x) => x.letter === l))!;
  let l = replayCodeword(p.numbers, p.givens, [{ n: a, letter }, { n: b, letter }]);
  check("using a letter again moves it", l[a - 1] === "" && l[b - 1] === letter);
  l = replayCodeword(p.numbers, p.givens, [{ n: a, letter }, { n: a, letter: null }]);
  check("clear empties the number", l[a - 1] === "");
  l = replayCodeword(p.numbers, p.givens, [{ n: g.n, letter }, { n: a, letter: g.letter }]);
  check("givens never change and their letters stay put", l[g.n - 1] === g.letter && l[a - 1] === "");
  const long: CwAction[] = Array.from({ length: 700 }, (_, k) => ({ n: free[k % free.length]!, letter: "ABCDEFGH"[k % 8]! }));
  const compact = compactCodeword(replayCodeword(p.numbers, p.givens, long), p.givens);
  check("compacted list rebuilds the same code", JSON.stringify(replayCodeword(p.numbers, p.givens, compact)) === JSON.stringify(replayCodeword(p.numbers, p.givens, long)));
  check("decode ignores junk", decodeCodeword("1A,xx,99B,3-", p.numbers).length === 2);
}

// 6. Score anchors.
{
  let minFinish = 999, maxUnfinished = 0, maxScore = 0;
  for (let k = 0; k < 40; k++) {
    const p = codewordFromEntry(CODEWORD_BANK[k * 25]!);
    const solution = p.solution!;
    const hidden = Array.from({ length: p.numbers }, (_, i) => i + 1).filter((n) => !p.givens.some((g) => g.n === n));
    const right = hidden.map((n) => ({ n, letter: solution[n - 1]! }));
    const puzzle = { ...p, speedPar: 1 } as CodewordPuzzleData;
    const perfect = gradeAnswer(puzzle, encodeCodeword(right), LIMIT).score;
    const slow = gradeAnswer(puzzle, encodeCodeword(right), 0).score;
    const almost = gradeAnswer(puzzle, encodeCodeword(right.slice(1)), LIMIT).score;
    const swapped = [...right];
    [swapped[0], swapped[1]] = [{ n: right[0]!.n, letter: right[1]!.letter }, { n: right[1]!.n, letter: right[0]!.letter }];
    const twoWrong = gradeAnswer(puzzle, encodeCodeword(swapped), LIMIT).score;
    check(`board ${k}: perfect 150 (${perfect})`, perfect === 150);
    check(`board ${k}: finish at the buzzer 130 (${slow})`, slow === 130);
    check(`board ${k}: nothing 0`, gradeAnswer(puzzle, "", LIMIT).score === 0);
    check(`board ${k}: one short is unfinished`, almost < 130 && twoWrong < 130);
    // New rounds (puzzleScoreRev 1): 120 + PAR(30); one number short at most 110; a wrong letter costs 5.
    const fresh = { ...puzzle, puzzleScoreRev: 1 } as CodewordPuzzleData;
    check(`board ${k}: new shape perfect 150`, gradeAnswer(fresh, encodeCodeword(right), LIMIT).score === 150);
    check(`board ${k}: new shape finish at the buzzer 120`, gradeAnswer(fresh, encodeCodeword(right), 0).score === 120);
    check(`board ${k}: new shape one short = 110`, gradeAnswer(fresh, encodeCodeword(right.slice(1)), LIMIT).score === 110);
    check(`board ${k}: new shape two swapped < 110`, gradeAnswer(fresh, encodeCodeword(swapped), LIMIT).score < 110);
    check(`board ${k}: new shape nothing 0`, gradeAnswer(fresh, "", LIMIT).score === 0);
    minFinish = Math.min(minFinish, slow);
    maxUnfinished = Math.max(maxUnfinished, almost, twoWrong, scoreCodeword({ correct: hidden.length - 1, hidden: hidden.length, complete: true, solved: false }, LIMIT, LIMIT));
    maxScore = Math.max(maxScore, perfect);
  }
  // Every unfinished tally by the formula (hidden 9–14 = 14–18 letters less 5 or 4 givens).
  for (let hidden = 9; hidden <= 14; hidden++)
    for (let correct = 0; correct < hidden; correct++)
      maxUnfinished = Math.max(maxUnfinished, scoreCodeword({ correct, hidden, complete: false, solved: false }, LIMIT, LIMIT));
  check(`finishing beats any unfinished (${minFinish} > ${maxUnfinished})`, minFinish > maxUnfinished);
  check(`cap 150 (${maxScore})`, maxScore === 150);
  check("tally: solved needs every number", !codewordTally(["A", ""], "AB", []).solved);
  console.log(`anchors: perfect ${maxScore}, minimum finish ${minFinish}, best unfinished ${maxUnfinished}, nothing 0`);
}

// 7. codewordRev 2 against rev-1 boards recorded on main.
{
  type Entry = { scoreRev: number; answer: string; ms: number; score: number; isCorrect: boolean; correctCount: number | null; errors: number | null; extra: string };
  const fixture = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/codeword-rev1-legacy.json.gz")).toString("utf8")) as {
    cases: { seed: number; puzzle: CodewordPuzzleData; entries: Entry[] }[];
  };
  let graded = 0;
  for (const c of fixture.cases) {
    const entry = CODEWORD_BANK[codewordBankIndex(wordGameSeed("codeword", c.seed))]!;
    const stamps = { speedPar: (c.puzzle as { speedPar?: number }).speedPar, puzzleScoreRev: (c.puzzle as { puzzleScoreRev?: number }).puzzleScoreRev };
    check(`legacy seed ${c.seed}: stored board is rev 1 with four givens`, c.puzzle.codewordRev === 1 && c.puzzle.givens.length === 4);
    check(`legacy seed ${c.seed}: rev 1 rebuilds as stored`, JSON.stringify({ ...codewordFromEntry(entry, 1), ...stamps }) === JSON.stringify(c.puzzle));
    const now = gen(c.seed);
    check(`legacy seed ${c.seed}: new board = rev 2 of the same entry`, JSON.stringify(now) === JSON.stringify({ ...codewordFromEntry(entry, 2), ...stamps }));
    const fifth = codewordFifthGiven(entry);
    check(
      `legacy seed ${c.seed}: new givens = stored givens + number ${fifth}`,
      JSON.stringify(now.givens.filter((g) => g.n !== fifth)) === JSON.stringify(c.puzzle.givens) && !c.puzzle.givens.some((g) => g.n === fifth),
    );
    check(`legacy seed ${c.seed}: same grid and code`, JSON.stringify(now.cells) === JSON.stringify(c.puzzle.cells) && now.solution === c.puzzle.solution);
    const unstamped = (() => {
      const { puzzleScoreRev: _drop, ...rest } = c.puzzle as CodewordPuzzleData & { puzzleScoreRev?: number };
      return rest as PuzzleData;
    })();
    for (const e of c.entries) {
      const g = gradeAnswer(e.scoreRev ? c.puzzle : unstamped, e.answer, e.ms);
      const same = g.score === e.score && g.isCorrect === e.isCorrect && g.correctCount === e.correctCount && g.errors === e.errors && JSON.stringify(g.extra) === e.extra;
      check(`legacy seed ${c.seed} "${e.answer.slice(0, 30)}" ms ${e.ms} rev ${e.scoreRev}: ${g.score} vs main ${e.score}`, same);
      graded++;
    }
  }
  console.log(`legacy rev 1: ${fixture.cases.length} stored boards rebuild exactly, ${graded} answers grade identically`);
}

if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} Cryptogrid checks`);
  process.exit(1);
}
console.log(
  `PASS: ${checks} Cryptogrid checks (${proven} bank boards proven unique against the full dictionary in ${bankSeconds.toFixed(0)} s${parts > 1 ? `, part ${part}/${parts}` : ""}; grid ${CW_SIZE} × ${CW_SIZE})`,
);
