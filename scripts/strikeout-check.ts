/**
 * Strikeout check:
 *   1. the same seed deals the same five words (room and practice paths), and a
 *      room seed gives every player the same board;
 *   2. nothing sent to the phone (public puzzle, live-check replies) carries a
 *      hidden word or an unearned letter;
 *   3. generator rules over 400 seeds: five different common five-letter words
 *      (no plurals), 14–18 distinct letters, a less common letter somewhere, the
 *      five vowels never solve a row or show more than 10 tiles; < 1 s each;
 *   4. replay rules: guesses fill every matching tile, misses and wrong solves
 *      strike, non-words are refused free, five strikes end it, the stored
 *      answer replays identically without a dictionary;
 *   5. score anchors: perfect 150, minimum finish 124, best unfinished 88,
 *      nothing 0; finishing always beats not finishing; cap 150.
 *
 *   bun scripts/strikeout-check.ts
 */
import assert from "node:assert/strict";

import { answerWords, isWord } from "../src/lib/duel/dictionary.server";
import { buildRoomPuzzles, generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import {
  SO_MAX_STRIKES,
  decodeStrikeout,
  encodeStrikeout,
  replayStrikeout,
  scoreStrikeout,
  type SoAction,
} from "../src/lib/duel/strikeout";
import { checkStrikeoutMoves, strikeoutRuleBreak } from "../src/lib/duel/strikeout.server";
import { isPluralForm } from "../src/lib/duel/wordsmith.server";
import { STRIKEOUT_TIME_MS, type StrikeoutPuzzleData } from "../src/lib/duel/types";

const failures: string[] = [];
let checks = 0;
function check(label: string, ok: boolean) {
  checks++;
  if (!ok) failures.push(label);
}

const LIMIT = STRIKEOUT_TIME_MS;
const gen = (seed: number) => generatePuzzle("strikeout", { bankSeed: seed }) as StrikeoutPuzzleData;

// 1. Determinism.
for (const seed of [1, 77, 4242, 0x7fff_ffff]) {
  check(`seed ${seed}: same words twice`, JSON.stringify(gen(seed)) === JSON.stringify(gen(seed)));
}
check("different seeds differ", JSON.stringify(gen(5)) !== JSON.stringify(gen(6)));
// A room seed that deals Strikeout gives the same board every time it is dealt.
{
  let dealt = 0;
  for (let seed = 1; seed <= 400 && dealt < 5; seed++) {
    const a = buildRoomPuzzles({ categories: ["word"], seed });
    const at = a.roundOrder.indexOf("strikeout");
    if (at < 0) continue;
    dealt++;
    const b = buildRoomPuzzles({ categories: ["word"], seed });
    check(`room seed ${seed}: same order`, JSON.stringify(a.roundOrder) === JSON.stringify(b.roundOrder));
    check(`room seed ${seed}: same Strikeout board`, JSON.stringify(a.puzzles[at]) === JSON.stringify(b.puzzles[at]));
  }
  check("a word room deals Strikeout", dealt === 5);
}
{
  const p = gen(31337);
  check("stamped speedPar 1", (p as { speedPar?: number }).speedPar === 1);
  check("stamped strikeoutRev 1", p.strikeoutRev === 1);
}

// 2. Secrecy.
for (let seed = 1; seed <= 50; seed++) {
  const full = gen(seed * 101);
  const { pub, priv } = splitPuzzle(full);
  const json = JSON.stringify(pub);
  check(`seed ${seed}: words private`, !("words" in pub) && Array.isArray(priv["words"]));
  for (const w of full.words!) check(`seed ${seed}: ${w} not in public puzzle`, !json.toUpperCase().includes(w));
  const empty = checkStrikeoutMoves(full.words!, "");
  check(`seed ${seed}: empty board shows nothing`, empty.rows.every((r) => r === "_____") && empty.hits === "" && empty.misses === "");
  // A guess shows exactly the matching tiles.
  const letter = full.words![0]![0]!;
  const one = checkStrikeoutMoves(full.words!, letter);
  check(
    `seed ${seed}: guess ${letter} reveals only ${letter}`,
    one.rows.every((r, ri) => [...r].every((ch, i) => (full.words![ri]![i] === letter ? ch === letter : ch === "_"))),
  );
  check(`seed ${seed}: reply keys`, JSON.stringify(Object.keys(one).sort()) === JSON.stringify(["count", "done", "hits", "last", "misses", "over", "rows", "strikes"]));
}

// 3. Generator rules.
const common5 = new Set(answerWords(5));
let worstMs = 0;
for (let seed = 1; seed <= 400; seed++) {
  const t0 = performance.now();
  const p = gen(seed * 7919);
  worstMs = Math.max(worstMs, performance.now() - t0);
  const words = p.words!;
  check(`seed ${seed}: rule break ${strikeoutRuleBreak(words)}`, strikeoutRuleBreak(words) === null);
  check(`seed ${seed}: five different`, new Set(words).size === 5);
  for (const w of words) {
    check(`${w}: common five-letter answer`, w.length === 5 && common5.has(w) && isWord(w) && !isPluralForm(w));
  }
  const distinct = new Set(words.join("")).size;
  check(`seed ${seed}: ${distinct} distinct letters`, distinct >= 14 && distinct <= 18);
  check(`seed ${seed}: less common letter`, words.some((w) => /[JKQVWXYZ]/.test(w)));
  const vowels = replayStrikeout(words, [..."AEIOU"].map((letter) => ({ kind: "guess", letter }) as SoAction), () => true);
  check(`seed ${seed}: vowels solve no row`, vowels.revealed.every((r) => !r.every(Boolean)));
  check(`seed ${seed}: vowels show ≤ 10 tiles`, vowels.revealed.flat().filter(Boolean).length <= 10);
}
check(`generation under 1 s (worst ${worstMs.toFixed(0)} ms)`, worstMs < 1000);

// 4. Replay rules.
{
  const words = ["CRANE", "JOLLY", "SWIFT", "BOXED", "PLUMB"];
  const g = (letter: string): SoAction => ({ kind: "guess", letter });
  const s = (row: number, word: string): SoAction => ({ kind: "solve", row, word });
  let st = replayStrikeout(words, [g("L")], isWord);
  check("L fills JOLLY twice and PLUMB once", st.revealed[1]!.filter(Boolean).length === 2 && st.revealed[4]![1] === true && st.strikes === 0);
  st = replayStrikeout(words, [g("L"), g("L")], isWord);
  check("repeat guess ignored", st.outcomes[1] === "ignored" && st.effective.length === 1);
  st = replayStrikeout(words, [g("Q")], isWord);
  check("miss strikes", st.strikes === 1 && st.misses.join("") === "Q");
  st = replayStrikeout(words, [s(0, "QZXJV")], isWord);
  check("non-word solve refused free", st.strikes === 0 && st.outcomes[0] === "notword" && st.effective.length === 0);
  st = replayStrikeout(words, [s(0, "CRATE")], isWord);
  check("wrong word solve strikes", st.strikes === 1 && st.outcomes[0] === "wrong");
  st = replayStrikeout(words, [s(0, "CRANE")], isWord);
  check("right solve reveals row", st.revealed[0]!.every(Boolean) && st.outcomes[0] === "right");
  st = replayStrikeout(words, [s(0, "CRANE"), s(0, "CRATE")], isWord);
  check("solved row cannot be solved again", st.strikes === 0 && st.outcomes[1] === "ignored");
  st = replayStrikeout(words, ["Q", "Z", "V", "G", "H", "K"].map(g), isWord);
  check("fifth strike ends the round", st.over && st.strikes === SO_MAX_STRIKES && st.outcomes[5] === "ignored");
  const raw = [g("E"), s(1, "QZXJV"), s(2, "SHIFT"), g("O"), s(3, "BOXED")];
  const stored = gradeAnswer({ type: "strikeout", strikeoutRev: 1, rows: 5, length: 5, words, speedPar: 1 } as never, encodeStrikeout(raw), 50_000).answer;
  const direct = replayStrikeout(words, raw, isWord);
  const replayed = replayStrikeout(words, decodeStrikeout(stored), () => true);
  check("stored answer drops refused solves", !stored.includes("QZXJV") && decodeStrikeout(stored).length === 4);
  check("stored answer replays identically without a dictionary", JSON.stringify(replayed.revealed) === JSON.stringify(direct.revealed) && replayed.strikes === direct.strikes);
}

// 5. Score anchors.
{
  const p = gen(2024);
  const words = p.words!;
  const grade = (actions: SoAction[], ms: number) => gradeAnswer(p, encodeStrikeout(actions), ms).score;
  const lettersIn = [...new Set(words.join(""))];
  const absent = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].filter((l) => !lettersIn.includes(l));
  const all = lettersIn.map((letter) => ({ kind: "guess", letter }) as SoAction);
  const strikes = (n: number) => absent.slice(0, n).map((letter) => ({ kind: "guess", letter }) as SoAction);
  check("nothing scores 0", grade([], LIMIT) === 0);
  check("perfect run 150", grade(all, LIMIT) === 150);
  check("perfect at half time still 150", grade(all, LIMIT / 2) === 150);
  check("minimum finish (4 strikes, buzzer) 124", grade([...strikes(4), ...all], 0) === 124);
  // Best unfinished: four words solved, four tiles of the fifth showing, then five strikes.
  const last = words[4]!;
  const others = new Set(words.slice(0, 4).join(""));
  const missing = [...last].find((ch) => !others.has(ch) && [...last].filter((x) => x === ch).length === 1);
  let bestUnfinished = 0;
  if (missing) {
    const lead = words.slice(0, 4).map((w, row) => ({ kind: "solve", row, word: w }) as SoAction);
    const fill = [...new Set([...last].filter((ch) => ch !== missing))].map((letter) => ({ kind: "guess", letter }) as SoAction);
    bestUnfinished = grade([...lead, ...fill, ...strikes(5)], LIMIT);
    check(`best unfinished replay scores 88 (got ${bestUnfinished})`, bestUnfinished === 88);
  }
  // Every unfinished tally, and every finished one, by the formula.
  let maxUnfinished = 0;
  for (let solved = 0; solved <= 4; solved++)
    for (let tiles = 0; tiles <= (5 - solved) * 4; tiles++)
      maxUnfinished = Math.max(maxUnfinished, scoreStrikeout({ solvedRows: solved, partialTiles: tiles, strikes: 5, done: false }, LIMIT, LIMIT));
  let minFinished = 999, maxFinished = 0;
  for (let s = 0; s < 5; s++)
    for (const ms of [0, 1, LIMIT / 4, LIMIT / 2, LIMIT]) {
      const v = scoreStrikeout({ solvedRows: 5, partialTiles: 0, strikes: s, done: true }, ms, LIMIT);
      minFinished = Math.min(minFinished, v);
      maxFinished = Math.max(maxFinished, v);
    }
  check(`unfinished never above 110 (max ${maxUnfinished})`, maxUnfinished <= 110 && maxUnfinished === 88);
  check(`finishing beats any unfinished (${minFinished} > ${maxUnfinished})`, minFinished > maxUnfinished && minFinished === 124);
  check(`cap 150 (max ${maxFinished})`, maxFinished === 150);
  console.log(`anchors: perfect ${grade(all, LIMIT)}, min finish ${grade([...strikes(4), ...all], 0)}, best unfinished ${bestUnfinished || maxUnfinished}, nothing ${grade([], LIMIT)}`);
}

if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} Strikeout checks`);
  process.exit(1);
}
assert.ok(checks > 0);
console.log(`PASS: ${checks} Strikeout checks (determinism, secrecy, generator rules over 400 seeds, worst ${worstMs.toFixed(0)} ms, replay rules, score anchors)`);
