/**
 * Strikeout check (strikeoutRev 3, 15 Oct 2026: rev 2's five 7–8 letter words
 * one at a time with ten shared strikes, three vowel guesses per word, one more
 * starting letter on words 1–3 and 1.5 per strike left; strikeoutRev 2, 14 Oct
 * 2026; rev 1 and rev 2 stored rounds unchanged):
 *   1. the same seed deals the same puzzle (room and practice paths), and a room
 *      seed gives every player the same board; new puzzles are stamped rev 3;
 *   2. nothing sent to the phone (public puzzle, live-check replies) carries a
 *      hidden word or an unearned letter: the public half has only the starting
 *      patterns, replies show the current word as far as it is earned and later
 *      words blank;
 *   3. generator rules over 400 seeds (rev 3): five different common words, two
 *      or three of each length 7 and 8, two starting consonants on a seven-letter
 *      word and one on an eight, plus one on words 1–3, every copy of a starting
 *      letter shown, at least length − 2 letters and 3 consonants left hidden
 *      (one fewer of each on words 1–3), no shared opening or ending; < 1 s each;
 *      the rev-2 deal (generateStrikeout(seed, 2)) reproduces the boards main
 *      dealt, letter for letter;
 *   4. rev-2 replay rules (unchanged), then rev 3's: one word at a time, guesses fill every copy in the
 *      current word only, the keypad resets for each word, at most two vowel
 *      guesses per word (a third is refused: no effect, no strike), misses and
 *      wrong solves strike and strikes are shared over the round, five end it,
 *      non-words and wrong-length solves are refused free, actions for another
 *      word are ignored, the stored answer replays identically without a
 *      dictionary;
 *      under rev 3 a third vowel counts and a fourth is refused, nine strikes play
 *      on and ten end the round;
 *   5. score anchors: rev 3 perfect 150, ten strikes left 15, 1.5 per strike left
 *      (rounded as finishParts rounds), minimum finish 122, four words 110, three
 *      words + found letters 90 + 2 each, starting letters 0, nothing 0, every
 *      finish 122–150 beats every unfinished run (≤ 110); rev 2's anchors (123,
 *      3 per strike left) as before; random keypad mashing on 30 room seeds is
 *      reported (rev 3's chosen rules give it a median of about 6, so the guard
 *      is the finish/unfinished split, not ≤ 5);
 *   6. rev-1 legacy identity: 1,920 stored-round cases recorded on main before
 *      the change (scripts/fixtures/strikeout-legacy.json.gz, recorded by
 *      scripts/strikeout-legacy-record.ts) grade, store, live-check and reveal
 *      exactly as main did; the rev-1 score anchors still hold;
 *   7. rev-2 legacy identity: 3,510 stored-round cases recorded on unmodified
 *      main before strikeoutRev 3 (scripts/fixtures/strikeout-rev2-legacy.json.gz,
 *      recorded by scripts/strikeout-rev2-legacy-record.ts) grade, store,
 *      live-check and reveal exactly as main did.
 *
 *   bun scripts/strikeout-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { answerWords, isWord } from "../src/lib/duel/dictionary.server";
import { buildRoomPuzzles, generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";
import { splitPuzzle } from "../src/lib/duel/secrets";
import {
  SO2_MAX_VOWELS,
  SO3_MAX_STRIKES,
  SO3_MAX_VOWELS,
  SO3_RULES,
  SO_MAX_STRIKES,
  decodeStrikeout2,
  encodeStrikeout2,
  replayStrikeout2,
  scoreStrikeout,
  scoreStrikeout2,
  type So2Action,
} from "../src/lib/duel/strikeout";
import { checkStrikeoutMoves, generateStrikeout, strikeout2RuleBreak, strikeoutAnswerWords } from "../src/lib/duel/strikeout.server";
import { wordGameSeed } from "../src/lib/duel/wordSeed.server";
import { isPluralForm } from "../src/lib/duel/wordsmith.server";
import { STRIKEOUT_TIME_MS, type PuzzleData, type StrikeoutPuzzleData } from "../src/lib/duel/types";
import { strikeoutPuzzle } from "../src/puzzles/strikeout";
import { pinDealtPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";

// Written for the rev-1 puzzle shape: new puzzles here carry puzzleScoreRev 1 (rooms deal rev 2 since 19 Oct 2026, scoring-bands-check).
pinDealtPuzzleScoreRev(1);

const failures: string[] = [];
let checks = 0;
function check(label: string, ok: boolean) {
  checks++;
  if (!ok) failures.push(label);
}

const LIMIT = STRIKEOUT_TIME_MS;
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const VOWELS = "AEIOU";
const gen = (seed: number) => generatePuzzle("strikeout", { bankSeed: seed }) as StrikeoutPuzzleData;
const g = (word: number, letter: string): So2Action => ({ kind: "guess", word, letter });
const s = (word: number, guess: string): So2Action => ({ kind: "solve", word, guess });

// 1. Determinism and stamps.
for (const seed of [1, 77, 4242, 0x7fff_ffff]) {
  check(`seed ${seed}: same puzzle twice`, JSON.stringify(gen(seed)) === JSON.stringify(gen(seed)));
}
check("different seeds differ", JSON.stringify(gen(5)) !== JSON.stringify(gen(6)));
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
    check(`room seed ${seed}: rev 3`, (a.puzzles[at] as StrikeoutPuzzleData).strikeoutRev === 3);
  }
  check("a word room deals Strikeout", dealt === 5);
}
{
  const p = gen(31337);
  check("stamped speedPar 1", (p as { speedPar?: number }).speedPar === 1);
  check("stamped puzzleScoreRev 1", (p as { puzzleScoreRev?: number }).puzzleScoreRev === 1);
  check("stamped strikeoutRev 3", p.strikeoutRev === 3);
  check("time limit 100 s", LIMIT === 100_000 && !("timeLimitMs" in p));
}

// 2. Secrecy.
for (let seed = 1; seed <= 50; seed++) {
  const full = gen(seed * 101);
  const words = full.words!;
  const { pub, priv } = splitPuzzle(full);
  const json = JSON.stringify(pub).toUpperCase();
  check(`seed ${seed}: words private`, !("words" in pub) && Array.isArray(priv["words"]));
  check(`seed ${seed}: givens public`, JSON.stringify((pub as StrikeoutPuzzleData).givens) === JSON.stringify(full.givens));
  for (const w of words) check(`seed ${seed}: ${w} not in public puzzle`, !json.includes(w));
  const empty = checkStrikeoutMoves(full, "");
  check(`seed ${seed}: empty board shows only word 1's starting letters`, empty.rows[0] === full.givens![0] && empty.rows.slice(1).every((r) => /^_+$/.test(r)));
  check(`seed ${seed}: empty reply`, empty.hits === "" && empty.misses === "" && empty.word === 0 && empty.vowelsLeft === SO3_MAX_VOWELS);
  const letter = [...words[0]!].find((ch) => full.givens![0]!.indexOf(ch) < 0)!;
  const one = checkStrikeoutMoves(full, `0${letter}`);
  check(
    `seed ${seed}: guess ${letter} reveals only ${letter} in word 1`,
    [...one.rows[0]!].every((ch, i) => (words[0]![i] === letter || full.givens![0]![i] !== "_" ? ch === words[0]![i] : ch === "_")) &&
      one.rows.slice(1).every((r) => /^_+$/.test(r)),
  );
  check(
    `seed ${seed}: reply keys`,
    JSON.stringify(Object.keys(one).sort()) === JSON.stringify(["count", "done", "hits", "last", "misses", "over", "rows", "strikes", "vowelsLeft", "word"]),
  );
}

// 3. Generator rules.
const common7 = new Set(answerWords(7));
const common8 = new Set(strikeoutAnswerWords(8));
check("seven-letter answers from the shared common list", common7.size > 1000);
check("eight-letter answers built with the same rules", common8.size > 1000 && [...common8].every((w) => w.length === 8 && isWord(w) && !isPluralForm(w.toLowerCase())));
let worstMs = 0;
for (let seed = 1; seed <= 400; seed++) {
  const t0 = performance.now();
  const p = gen(seed * 7919);
  worstMs = Math.max(worstMs, performance.now() - t0);
  const words = p.words!;
  const givens = p.givens!;
  check(`seed ${seed}: rule break ${strikeout2RuleBreak(words, givens, 3)}`, strikeout2RuleBreak(words, givens, 3) === null);
  check(`seed ${seed}: five different`, new Set(words).size === 5 && p.rows === 5 && p.length === 8);
  const sevens = words.filter((w) => w.length === 7).length;
  check(`seed ${seed}: ${sevens} seven-letter words`, sevens === 2 || sevens === 3);
  words.forEach((w, i) => {
    check(`${w}: common answer`, (w.length === 7 ? common7 : common8).has(w) && isWord(w) && !isPluralForm(w.toLowerCase()));
    const shown = new Set([...givens[i]!].filter((ch) => ch !== "_"));
    const extra = i < 3 ? 1 : 0;
    check(`${w} (word ${i + 1}): ${shown.size} starting letters`, shown.size === (w.length === 7 ? 2 : 1) + extra && [...shown].every((ch) => !VOWELS.includes(ch)));
    check(`${w}: every copy of a starting letter shows`, [...w].every((ch, k) => shown.has(ch) === (givens[i]![k] === ch)));
    const hidden = new Set([...w].filter((ch) => !shown.has(ch)));
    check(`${w}: vowels never finish it`, hidden.size >= w.length - 2 - extra && [...hidden].filter((ch) => !VOWELS.includes(ch)).length >= 3 - extra);
  });
  const shownCount = givens.map((gv) => new Set([...gv].filter((ch) => ch !== "_")).size);
  check(`seed ${seed}: words 1–3 show one more starting letter than rev 2 would`, shownCount.every((n, i) => n === (words[i]!.length === 7 ? 2 : 1) + (i < 3 ? 1 : 0)));
}
check(`generation under 1 s (worst ${worstMs.toFixed(0)} ms)`, worstMs < 1000);
// Rev 2 deals exactly as main did: the fixture's puzzles were generated on main.
{
  const fixture = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/strikeout-rev2-legacy.json.gz", import.meta.url))).toString("utf8")) as { cases: { puzzle: StrikeoutPuzzleData }[] };
  const boards = new Map(fixture.cases.map((c) => [JSON.stringify(c.puzzle.words), c.puzzle]));
  let same = 0;
  for (const seed of [11, 202, 3003, 40004, 500005, 6006006, 77, 8128]) {
    const p2 = generateStrikeout(wordGameSeed("strikeout", seed), 2);
    const main = boards.get(JSON.stringify(p2.words));
    if (main && JSON.stringify(main.givens) === JSON.stringify(p2.givens) && main.strikeoutRev === 2 && p2.strikeoutRev === 2 && main.length === p2.length && main.rows === p2.rows) same++;
    check(`rev 2 seed ${seed}: rule break ${strikeout2RuleBreak(p2.words!, p2.givens!, 2)}`, strikeout2RuleBreak(p2.words!, p2.givens!, 2) === null);
  }
  check(`rev-2 deal reproduces main's boards (${same} / 8)`, same === 8);
}

// 4. Rev-2 replay rules.
{
  const words = ["BLANKET", "PLATFORM", "JOURNEY", "SHIPPING", "WIZARDS"];
  const givens = ["_L___E_", "P_______", "J____N_", "__I_____", "W______"]; // replay does not enforce generator rules
  const rp = (actions: So2Action[]) => replayStrikeout2(words, givens, actions, isWord);
  let st = rp([]);
  check("starting letters show, nobody's progress", st.revealed[0]!.filter(Boolean).length === 2 && st.word === 0 && st.strikes === 0);
  st = rp([g(0, "A")]);
  check("A fills word 1 only", st.revealed[0]![2] === true && st.revealed[1]![2] === false && st.vowelsUsed === 1 && st.strikes === 0);
  st = rp([g(0, "A"), g(0, "A")]);
  check("repeat guess ignored", st.outcomes[1] === "ignored" && st.effective.length === 1);
  st = rp([g(0, "L")]);
  check("starting letter cannot be guessed", st.outcomes[0] === "ignored" && st.effective.length === 0);
  st = rp([g(0, "A"), g(0, "O"), g(0, "U")]);
  check("third vowel refused: no effect, no strike", st.outcomes[2] === "vowels" && st.strikes === 1 && st.effective.length === 2 && st.vowelsUsed === 2);
  const v = checkStrikeoutMoves({ type: "strikeout", strikeoutRev: 2, rows: 5, length: 8, givens, words }, "0A,0O,0U");
  check("reply: no vowel guesses left, refused", v.vowelsLeft === 0 && v.last === "vowels" && v.strikes === 1 && v.misses === "O");
  st = rp([g(0, "Q")]);
  check("miss strikes", st.strikes === 1 && st.misses.join("") === "Q");
  st = rp([s(0, "QZXJVWK")]);
  check("non-word solve refused free", st.strikes === 0 && st.outcomes[0] === "notword" && st.effective.length === 0);
  st = rp([s(0, "PLANKS"), s(0, "BLANKETS")]);
  check("wrong-length solves ignored", st.strikes === 0 && st.outcomes.every((o) => o === "ignored"));
  st = rp([s(0, "BRACKET")]);
  check("wrong word solve strikes", st.strikes === 1 && st.outcomes[0] === "wrong");
  st = rp([g(1, "T"), s(2, "JOURNEY")]);
  check("actions for another word ignored", st.outcomes.every((o) => o === "ignored") && st.word === 0);
  st = rp([s(0, "BLANKET")]);
  check("right solve completes the word and moves on", st.word === 1 && st.solvedWords === 1 && st.revealed[0]!.every(Boolean) && st.outcomes[0] === "right");
  st = rp([g(0, "A"), g(0, "B"), g(0, "N"), g(0, "K"), g(0, "T")]);
  check("guessing the last letter completes the word", st.word === 1 && st.solvedWords === 1 && st.strikes === 0);
  st = rp([g(0, "A"), g(0, "B"), g(0, "N"), g(0, "K"), g(0, "T"), g(1, "A"), g(1, "T"), g(1, "O")]);
  check("keypad resets per word (A and T again on word 2)", st.outcomes.slice(5).every((o) => o === "hit") && st.guessed.join("") === "ATO");
  check("vowel guesses reset per word", st.vowelsUsed === 2);
  st = rp([g(0, "Q"), s(0, "BLANKET"), g(1, "Z"), g(1, "E"), s(1, "PLATFORM"), g(2, "X"), g(2, "B"), g(2, "C")]);
  check("strikes are shared: five over three words end it", st.over && st.strikes === SO_MAX_STRIKES && st.word === 2);
  st = rp([g(0, "Q"), g(0, "Z"), g(0, "X"), g(0, "V"), g(0, "W"), s(0, "BLANKET")]);
  check("after the fifth strike nothing counts", st.over && st.outcomes[5] === "ignored" && st.solvedWords === 0);
  st = rp(words.map((w, i) => s(i, w)));
  check("five solves finish", st.done && st.word === 5 && st.solvedWords === 5);
  const view = checkStrikeoutMoves({ type: "strikeout", strikeoutRev: 2, rows: 5, length: 8, givens, words }, "0A,0Q,0BLANKET,1T");
  check("reply: solved word in full, current word as earned, later blank", view.rows[0] === "BLANKET" && view.rows[1] === "P__T____" && view.rows.slice(2).every((r) => /^_+$/.test(r)));
  check("reply: keys are the current word's only", view.hits === "T" && view.misses === "" && view.word === 1 && view.strikes === 1);
  const raw = [g(0, "E") /* a starting letter: ignored */, s(0, "QZXJVWK"), g(0, "A"), g(0, "I"), g(0, "U"), s(0, "BRACKET"), g(3, "S"), s(0, "BLANKET"), g(1, "R")];
  const full = { type: "strikeout", strikeoutRev: 2, rows: 5, length: 8, givens, words, speedPar: 1, puzzleScoreRev: 1 } as StrikeoutPuzzleData;
  const stored = gradeAnswer(full, encodeStrikeout2(raw), 50_000).answer;
  const direct = rp(raw);
  const replayed = replayStrikeout2(words, givens, decodeStrikeout2(stored), () => true);
  check(`stored answer keeps only what changed the board (${stored})`, stored === "0A,0I,0BRACKET,0BLANKET,1R");
  check(
    "stored answer replays identically without a dictionary",
    JSON.stringify(replayed.revealed) === JSON.stringify(direct.revealed) && replayed.strikes === direct.strikes && replayed.word === direct.word,
  );
  // The reveal draws the stored answer with the stored score only.
  const html = renderToStaticMarkup(createElement(strikeoutPuzzle.Reveal, { puzzle: full, myAnswer: stored, myMsRemaining: 0, timeLimitMs: LIMIT } as never));
  check("rev-2 reveal draws the five words and the tally", html.includes('data-strikeout-rev="2"') && html.includes("1 / 5 words · 2 strikes"));
}

// 4b. Rev-3 replay rules: three vowel guesses per word, ten strikes shared.
{
  const words = ["BLANKET", "PLATFORM", "JOURNEY", "SHIPPING", "WIZARDS"];
  const givens = ["_L___E_", "P_______", "J____N_", "__I_____", "W______"];
  const rev3 = { type: "strikeout", strikeoutRev: 3, rows: 5, length: 8, givens, words } as StrikeoutPuzzleData;
  const rp = (actions: So2Action[]) => replayStrikeout2(words, givens, actions, isWord, SO3_RULES);
  let st = rp([g(0, "A"), g(0, "O"), g(0, "U")]);
  check("rev 3: third vowel counts", st.outcomes[2] === "miss" && st.vowelsUsed === 3 && st.strikes === 2 && st.effective.length === 3);
  st = rp([g(0, "A"), g(0, "O"), g(0, "U"), g(0, "I")]);
  check("rev 3: fourth vowel refused: no effect, no strike", st.outcomes[3] === "vowels" && st.strikes === 2 && st.effective.length === 3 && st.vowelsUsed === 3);
  let v = checkStrikeoutMoves(rev3, "");
  check("rev 3 reply: three vowel guesses at the start", v.vowelsLeft === 3);
  v = checkStrikeoutMoves(rev3, "0A,0O");
  check("rev 3 reply: one vowel guess left after two", v.vowelsLeft === 1 && v.strikes === 1);
  v = checkStrikeoutMoves(rev3, "0A,0O,0U,0I");
  check("rev 3 reply: none left, the fourth refused", v.vowelsLeft === 0 && v.last === "vowels" && v.strikes === 2);
  const nine = [g(0, "Q"), g(0, "Z"), g(0, "X"), g(0, "V"), g(0, "W"), g(0, "C"), g(0, "D"), g(0, "F"), g(0, "G")];
  st = rp(nine);
  check("rev 3: nine strikes play on", !st.over && st.strikes === 9);
  st = rp([...nine, s(0, "BLANKET"), g(1, "Z")]);
  check("rev 3: the tenth strike (on word 2) ends it", st.over && st.strikes === SO3_MAX_STRIKES && st.word === 1 && st.solvedWords === 1);
  st = rp([...nine, g(0, "H"), s(0, "BLANKET")]);
  check("rev 3: after the tenth strike nothing counts", st.over && st.outcomes[10] === "ignored" && st.solvedWords === 0);
  st = rp(words.map((w, i) => s(i, w)));
  check("rev 3: five solves finish", st.done && st.word === 5 && st.solvedWords === 5);
  check("rev 2 still ends at five strikes on the same list", replayStrikeout2(words, givens, nine, isWord).over && replayStrikeout2(words, givens, nine, isWord).strikes === SO_MAX_STRIKES);
  const full = { ...rev3, speedPar: 1, puzzleScoreRev: 1 } as StrikeoutPuzzleData;
  const stored = gradeAnswer(full, "0A,0O,0U,0I,0QZXJVWK,0BLANKET,1R", 50_000).answer;
  check(`rev 3: stored answer keeps only what changed the board (${stored})`, stored === "0A,0O,0U,0BLANKET,1R");
  const html = renderToStaticMarkup(createElement(strikeoutPuzzle.Reveal, { puzzle: full, myAnswer: stored, myMsRemaining: 0, timeLimitMs: LIMIT } as never));
  check("rev-3 reveal draws ten strike markers and the tally", html.includes('data-strikeout-rev="3"') && html.includes('aria-label="2 of 10 strikes"') && html.includes("1 / 5 words · 2 strikes"));
  check("rev-2 reveal keeps five strike markers", renderToStaticMarkup(createElement(strikeoutPuzzle.Reveal, { puzzle: { ...full, strikeoutRev: 2 }, myAnswer: "0A,0O", myMsRemaining: 0, timeLimitMs: LIMIT } as never)).includes(' of 5 strikes"'));
}

// 5. Score anchors (rev 3 on a room puzzle; rev 2 on the same seed's rev-2 deal).
const stamp = (p: StrikeoutPuzzleData) => ({ ...p, speedPar: 1, puzzleScoreRev: 1 }) as StrikeoutPuzzleData;
{
  const p = gen(2024);
  const words = p.words!;
  const givens = p.givens!;
  const grade = (actions: So2Action[], ms: number) => gradeAnswer(p, encodeStrikeout2(actions), ms).score;
  const solveAll = words.map((w, i) => s(i, w));
  const strikesOn = (word: number, n: number) => [...ALPHA].filter((l) => !words[word]!.includes(l) && !givens[word]!.includes(l)).slice(0, n).map((l) => g(word, l));
  check("rev 3: nothing scores 0", grade([], LIMIT) === 0);
  check("rev 3: perfect run 150", grade(solveAll, LIMIT) === 150);
  check("rev 3: perfect at half time still 150", grade(solveAll, LIMIT / 2) === 150);
  check("rev 3: ten strikes left at the buzzer 135", grade(solveAll, 0) === 135);
  for (let k = 0; k < SO3_MAX_STRIKES; k++) {
    const want = 120 + Math.round(1.5 * (SO3_MAX_STRIKES - k));
    const got = grade([...strikesOn(0, k), ...solveAll], 0);
    check(`rev 3: ${k} strikes at the buzzer ${want} (${got})`, got === want);
  }
  check("rev 3: minimum finish (9 strikes, buzzer) 122", grade([...strikesOn(0, 9), ...solveAll], 0) === 122);
  check("rev 3: four words solved, then ten strikes: 110", grade([...solveAll.slice(0, 4), ...strikesOn(4, 10)], LIMIT) === 110);
  const fourth = words[3]!;
  const found = [...new Set([...fourth])].filter((ch) => givens[3]!.indexOf(ch) < 0 && !VOWELS.includes(ch)).slice(0, 2);
  const tiles = [...fourth].filter((ch) => found.includes(ch)).length;
  check(`rev 3: three words + ${tiles} found tiles = ${90 + 2 * tiles}`, grade([...solveAll.slice(0, 3), ...found.map((l) => g(3, l)), ...strikesOn(3, 10)], LIMIT) === 90 + 2 * tiles);
  check("rev 3: starting letters alone score 0", grade(strikesOn(0, 10), LIMIT) === 0);
  let maxU = 0, minF = 999, maxF = 0;
  for (let solved = 0; solved <= 4; solved++)
    for (let t = 0; t <= 8; t++) maxU = Math.max(maxU, scoreStrikeout2({ solvedWords: solved, foundTiles: t, strikes: 10, done: false }, LIMIT, LIMIT, SO3_RULES));
  for (let k = 0; k < SO3_MAX_STRIKES; k++)
    for (const ms of [0, 1, LIMIT / 4, LIMIT / 2, LIMIT]) {
      const v = scoreStrikeout2({ solvedWords: 5, foundTiles: 0, strikes: k, done: true }, ms, LIMIT, SO3_RULES);
      minF = Math.min(minF, v);
      maxF = Math.max(maxF, v);
    }
  check(`rev 3: unfinished tops at 110 (max ${maxU})`, maxU === 110);
  check(`rev 3: every finish 122-150 (${minF}-${maxF})`, minF === 122 && maxF === 150);
  // Random keypad mashing on room seeds (rev 3): reported; every mashing run must still sit below every finish.
  const rng = (() => { let a = 12345; return () => ((a = (Math.imul(a, 1103515245) + 12345) >>> 0) / 0x1_0000_0000); })();
  const randomScores: number[] = [];
  const alphaScores: number[] = [];
  let dealt = 0, mashFinished = 0;
  for (let seed = 5001; dealt < 30; seed++) {
    const room = buildRoomPuzzles({ categories: ["word"], seed });
    const at = room.roundOrder.indexOf("strikeout");
    if (at < 0) continue;
    dealt++;
    const rp = room.puzzles[at] as StrikeoutPuzzleData;
    for (const [mode, out] of [["random", randomScores], ["alphabet", alphaScores]] as const) {
      const acts: So2Action[] = [];
      for (let t = 0; t < 100; t++) {
        const st = replayStrikeout2(rp.words!, rp.givens!, acts, isWord, SO3_RULES);
        if (st.done || st.over) break;
        const shown = new Set([...rp.givens![st.word]!].filter((ch) => ch !== "_"));
        const open = [...ALPHA].filter((l) => !st.guessed.includes(l) && !shown.has(l) && !(VOWELS.includes(l) && st.vowelsUsed >= SO3_MAX_VOWELS));
        acts.push(g(st.word, mode === "random" ? open[Math.floor(rng() * open.length)]! : open[0]!));
      }
      const graded = gradeAnswer(rp, encodeStrikeout2(acts), 0);
      if (graded.isCorrect) mashFinished++;
      out.push(graded.score);
    }
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;
  check(`rev 3: mashing never finishes (${mashFinished} of 60) and stays at or below 110`, mashFinished === 0 && Math.max(...randomScores, ...alphaScores) <= 110);
  console.log(
    `anchors (rev 3): perfect ${grade(solveAll, LIMIT)}, ten left at the buzzer ${grade(solveAll, 0)}, min finish ${grade([...strikesOn(0, 9), ...solveAll], 0)}, four words 110, nothing 0; random mashing median ${median(randomScores)} (max ${Math.max(...randomScores)}), alphabet ${median(alphaScores)} (max ${Math.max(...alphaScores)})`,
  );
}

// 5b. Rev-2 score anchors (stored rev-2 rounds), on the rev-2 deal.
{
  const p = stamp(generateStrikeout(wordGameSeed("strikeout", 2024), 2));
  const words = p.words!;
  const givens = p.givens!;
  const grade = (actions: So2Action[], ms: number) => gradeAnswer(p, encodeStrikeout2(actions), ms).score;
  const solveAll = words.map((w, i) => s(i, w));
  const strikesOn = (word: number, n: number) => [...ALPHA].filter((l) => !words[word]!.includes(l) && !VOWELS.includes(l)).slice(0, n).map((l) => g(word, l));
  check("nothing scores 0", grade([], LIMIT) === 0);
  check("perfect run 150", grade(solveAll, LIMIT) === 150);
  check("perfect at half time still 150", grade(solveAll, LIMIT / 2) === 150);
  check("minimum finish (4 strikes, buzzer) 123", grade([...strikesOn(0, 4), ...solveAll], 0) === 123);
  check("four words solved, then five strikes: 110", grade([...solveAll.slice(0, 4), ...strikesOn(4, 5)], LIMIT) === 110);
  // Three words, then two letters found in the fourth (not starting letters), then five strikes.
  const fourth = words[3]!;
  const found = [...new Set([...fourth])].filter((ch) => givens[3]!.indexOf(ch) < 0 && !VOWELS.includes(ch)).slice(0, 2);
  const tiles = [...fourth].filter((ch) => found.includes(ch)).length;
  check(`three words + ${tiles} found tiles = ${90 + 2 * tiles}`, grade([...solveAll.slice(0, 3), ...found.map((l) => g(3, l)), ...strikesOn(3, 5)], LIMIT) === 90 + 2 * tiles);
  check("found letters in word 1 only: 2 each", grade([g(0, found[0] ?? "Z"), ...strikesOn(0, 5)], LIMIT) <= 2 * 3);
  check("starting letters alone score 0", grade(strikesOn(0, 5), LIMIT) === 0);
  let maxU = 0, minF = 999, maxF = 0;
  for (let solved = 0; solved <= 4; solved++)
    for (let t = 0; t <= 8; t++) maxU = Math.max(maxU, scoreStrikeout2({ solvedWords: solved, foundTiles: t, strikes: 5, done: false }, LIMIT, LIMIT));
  for (let k = 0; k < 5; k++)
    for (const ms of [0, 1, LIMIT / 4, LIMIT / 2, LIMIT]) {
      const v = scoreStrikeout2({ solvedWords: 5, foundTiles: 0, strikes: k, done: true }, ms, LIMIT);
      minF = Math.min(minF, v);
      maxF = Math.max(maxF, v);
    }
  check(`rev 2: unfinished tops at 110 (max ${maxU})`, maxU === 110);
  check(`rev 2: every finish 123-150 (${minF}-${maxF})`, minF === 123 && maxF === 150);
  // Random keypad mashing on room seeds: about one key a second on the word the board shows, until the round ends.
  const rng = (() => { let a = 12345; return () => ((a = (Math.imul(a, 1103515245) + 12345) >>> 0) / 0x1_0000_0000); })();
  const randomScores: number[] = [];
  const alphaScores: number[] = [];
  let dealt = 0;
  for (let seed = 5001; dealt < 30; seed++) {
    const room = buildRoomPuzzles({ categories: ["word"], seed });
    const at = room.roundOrder.indexOf("strikeout");
    if (at < 0) continue;
    dealt++;
    // A rev-2 board for the same seed (rooms now deal rev 3), so rev 2's mashing guard keeps measuring rev-2 boards.
    void at;
    const rp = stamp(generateStrikeout(wordGameSeed("strikeout", seed), 2));
    for (const [mode, out] of [["random", randomScores], ["alphabet", alphaScores]] as const) {
      const acts: So2Action[] = [];
      for (let t = 0; t < 100; t++) {
        const st = replayStrikeout2(rp.words!, rp.givens!, acts, isWord);
        if (st.done || st.over) break;
        const shown = new Set([...rp.givens![st.word]!].filter((ch) => ch !== "_"));
        const open = [...ALPHA].filter((l) => !st.guessed.includes(l) && !shown.has(l) && !(VOWELS.includes(l) && st.vowelsUsed >= SO2_MAX_VOWELS));
        acts.push(g(st.word, mode === "random" ? open[Math.floor(rng() * open.length)]! : open[0]!));
      }
      out.push(gradeAnswer(rp, encodeStrikeout2(acts), 0).score);
    }
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;
  check(`rev 2: random mashing median ≤ 5 (${median(randomScores)}, max ${Math.max(...randomScores)})`, median(randomScores) <= 5);
  check(`rev 2: alphabet order median ≤ 5 (${median(alphaScores)}, max ${Math.max(...alphaScores)})`, median(alphaScores) <= 5);
  console.log(
    `anchors (rev 2, stored rounds): perfect ${grade(solveAll, LIMIT)}, min finish ${grade([...strikesOn(0, 4), ...solveAll], 0)}, four words 110, nothing 0; random mashing median ${median(randomScores)} (max ${Math.max(...randomScores)}), alphabet ${median(alphaScores)} (max ${Math.max(...alphaScores)})`,
  );
}

// 6. Rev-1 legacy identity: stored rounds grade, store, live-check and reveal exactly as main did.
{
  interface LegacyCase {
    puzzle: StrikeoutPuzzleData;
    answer: string;
    ms: number;
    graded: unknown;
    view: unknown;
    reveal: string | null;
  }
  const fixture = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/strikeout-legacy.json.gz", import.meta.url))).toString("utf8")) as {
    recordedFrom: string;
    cases: LegacyCase[];
  };
  let same = 0, reveals = 0;
  const diffs: string[] = [];
  for (const c of fixture.cases) {
    const graded = gradeAnswer(c.puzzle as PuzzleData, c.answer, c.ms);
    const view = checkStrikeoutMoves(c.puzzle, c.answer);
    let ok = JSON.stringify(graded) === JSON.stringify(c.graded) && JSON.stringify(view) === JSON.stringify(c.view);
    if (c.reveal !== null) {
      reveals++;
      const html = renderToStaticMarkup(createElement(strikeoutPuzzle.Reveal, { puzzle: c.puzzle, myAnswer: (c.graded as { answer: string }).answer, myMsRemaining: (c.graded as { storedMs: number }).storedMs, timeLimitMs: LIMIT } as never));
      ok &&= html === c.reveal;
    }
    if (ok) same++;
    else if (diffs.length < 5) diffs.push(`"${c.answer}" @ ${c.ms}: ${JSON.stringify(graded)} vs ${JSON.stringify(c.graded)}`);
  }
  check(`rev-1 legacy identity: ${same} / ${fixture.cases.length} cases (${reveals} reveals) as ${fixture.recordedFrom}${diffs.length ? `\n  ${diffs.join("\n  ")}` : ""}`, same === fixture.cases.length && fixture.cases.length >= 1900);
  check("legacy fixture is rev 1", fixture.cases.every((c) => (c.puzzle.strikeoutRev ?? 1) === 1 && c.puzzle.words!.every((w) => w.length === 5)));
  // Rev-1 formula anchors, as before the change.
  let maxUnfinished = 0, minFinished = 999;
  for (let solved = 0; solved <= 4; solved++)
    for (let tiles = 0; tiles <= (5 - solved) * 4; tiles++)
      maxUnfinished = Math.max(maxUnfinished, scoreStrikeout({ solvedRows: solved, partialTiles: tiles, strikes: 5, done: false }, LIMIT, LIMIT));
  for (let k = 0; k < 5; k++) minFinished = Math.min(minFinished, scoreStrikeout({ solvedRows: 5, partialTiles: 0, strikes: k, done: true }, 0, LIMIT));
  check(`rev 1 stored shape: best unfinished 88, minimum finish 124 (${maxUnfinished}, ${minFinished})`, maxUnfinished === 88 && minFinished === 124);
  withPuzzleScoreRev(1, () => {
    let maxU = 0;
    for (let solved = 0; solved <= 4; solved++)
      for (let tiles = 0; tiles <= (5 - solved) * 4; tiles++)
        maxU = Math.max(maxU, scoreStrikeout({ solvedRows: solved, partialTiles: tiles, strikes: 5, done: false }, LIMIT, LIMIT));
    check(`rev 1 new shape: unfinished tops at 110 (${maxU})`, maxU === 110);
    check("rev 1 new shape: minimum finish 123", scoreStrikeout({ solvedRows: 5, partialTiles: 0, strikes: 4, done: true }, 0, LIMIT) === 123);
  });
}

// 7. Rev-2 legacy identity: stored rev-2 rounds grade, store, live-check and reveal exactly as main did.
{
  interface LegacyCase {
    puzzle: StrikeoutPuzzleData;
    answer: string;
    ms: number;
    graded: unknown;
    view: unknown;
    reveal: string | null;
  }
  const fixture = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/strikeout-rev2-legacy.json.gz", import.meta.url))).toString("utf8")) as {
    recordedFrom: string;
    cases: LegacyCase[];
  };
  let same = 0, reveals = 0;
  const diffs: string[] = [];
  for (const c of fixture.cases) {
    const graded = gradeAnswer(c.puzzle as PuzzleData, c.answer, c.ms);
    const view = checkStrikeoutMoves(c.puzzle, c.answer);
    let ok = JSON.stringify(graded) === JSON.stringify(c.graded) && JSON.stringify(view) === JSON.stringify(c.view);
    if (c.reveal !== null) {
      reveals++;
      const html = renderToStaticMarkup(createElement(strikeoutPuzzle.Reveal, { puzzle: c.puzzle, myAnswer: (c.graded as { answer: string }).answer, myMsRemaining: (c.graded as { storedMs: number }).storedMs, timeLimitMs: LIMIT } as never));
      ok &&= html === c.reveal;
    }
    if (ok) same++;
    else if (diffs.length < 5) diffs.push(`"${c.answer}" @ ${c.ms}: ${JSON.stringify(graded)} vs ${JSON.stringify(c.graded)}`);
  }
  check(`rev-2 legacy identity: ${same} / ${fixture.cases.length} cases (${reveals} reveals) as ${fixture.recordedFrom}${diffs.length ? `\n  ${diffs.join("\n  ")}` : ""}`, same === fixture.cases.length && fixture.cases.length >= 3500);
  check("rev-2 fixture is rev 2", fixture.cases.every((c) => c.puzzle.strikeoutRev === 2));
  const finishes = fixture.cases.filter((c) => (c.graded as { isCorrect: boolean }).isCorrect).length;
  const overs = fixture.cases.filter((c) => (c.view as { over: boolean }).over).length;
  // Third vowel guesses (refused under rev 2, played under rev 3): the fixture's vowel-run answer.
  const refused = fixture.cases.filter((c) => c.answer.startsWith("0A,0E,0I,")).length;
  check(`rev-2 fixture covers finishes (${finishes}), five-strike ends (${overs}) and refused third vowels (${refused})`, finishes > 0 && overs > 0 && refused > 0);
  console.log(`rev-2 legacy identity: ${same} / ${fixture.cases.length} cases (${reveals} reveals) as ${fixture.recordedFrom}`);
}

if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} Strikeout checks`);
  process.exit(1);
}
assert.ok(checks > 0);
console.log(`PASS: ${checks} Strikeout checks (determinism, secrecy, rev-3 generator rules over 400 seeds, worst ${worstMs.toFixed(0)} ms, rev-2 deal identity, rev-2 and rev-3 replay rules, score anchors, random play, rev-1 and rev-2 legacy identity)`);
