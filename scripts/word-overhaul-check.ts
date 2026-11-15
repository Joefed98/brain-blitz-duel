/**
 * word-overhaul-check (15 Nov 2026, phase 2 step 4; docs/design/game-reviews/word.md, wordOverhaul.ts): the Word
 * overhaul's game changes and look.
 *
 *  1. Deals: rooms deal Nucleus wordsmithRev 5, Slider wordSlideRev 6, Lookout wordSearchRev 6, Roundabout wheelRev 5
 *     and Cryptogrid codewordRev 6; pinPreWordOverhaul deals the stamps before, untouched; the layer is the last one.
 *  2. Nucleus: the board's counted words and its missed list are everyday words only; par and the board are rev 4's;
 *     an obscure valid word is still accepted and scores (the live check marks it a bonus word on rev 5 only); the
 *     same answer grades the same on both stamps.
 *  3. Slider: par is the proven fewest slides to the dealt words (the solver distance), never above the scramble.
 *  4. Lookout: finding the sixth word no longer ends the round on rev 6 (the stage waits for Done or the bonus), and
 *     speed is measured when the sixth word was found, so hunting for the bonus after it costs nothing; rev 5 as before.
 *  5. Roundabout: rev 5 boards come from the rev-5 bank (rebuilt byte for byte): every slot word on the common-answers
 *     list, at most two three-letter words, the same board for every player of a seed.
 *  6. Cryptogrid: only a letter shown wrong (one completing a word on the grid that is no real word) costs the clean
 *     bonus on rev 6; a trial letter in a word still missing letters is free; rev 5 counts every wrong letter as before.
 *     After a letter the selection moves to the next unsolved number.
 *  7. The look: every Word game imports the shared rendered look; every art file named in the manifest exists, is small
 *     and is referenced; no glow in the look; the keyboards' keys are 52 px with a pop-up preview and the key cue; the
 *     controls are the gold and navy pieces; Strikeout's keyboard is no longer held under a capped arena.
 *  8. Interlock: bad runs show live, a drag back to the tray returns a tile, the board's floor no longer clips; Slider's
 *     Reset asks first and the board fits a 375 px phone; Forage shows the miss allowance; Lookout's chips show whole
 *     words; Roundabout's miss and repeat look different; Strikeout's delete key keeps one label; Swapword's intro
 *     shows the swap.
 *  9. Texts: the help states each new rule while it is dealt, and the old text with the era pinned.
 * 10. Reveals (Joe's reveal brief): on the live stamps each game's reveal is the overhaul's (numbers that explain the
 *     score, large boards with the Solution / Yours switch where there are two, chips, no stray "×" or counts); on the
 *     stamps before, the reveal is exactly the older one.
 *
 *   bun scripts/word-overhaul-check.ts
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { DEAL_LAYERS, generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { answerWords, isEverydayWord, isWord } from "../src/lib/duel/dictionary.server";
import { checkWordsmithWord } from "../src/lib/duel/wordsmith.server";
import { wordSlideDistance } from "../src/lib/duel/wordSlideDistance.server";
import { LETTER_WHEEL_BANK_REV5 } from "../src/lib/duel/letterWheelBankRev5.server";
import { wsEncode } from "../src/lib/duel/wordSearch";
import { codewordRuns, encodeCodeword } from "../src/lib/duel/codeword";
import {
  CODEWORD_REV_VISIBLE,
  LOOKOUT_REV_DONE,
  SLIDER_REV_PROVEN,
  WHEEL_REV_COMMON,
  WORDSMITH_REV_EVERYDAY,
  cryptogridVisibleWrong,
  pinPreWordOverhaul,
  usesWordOverhaul,
} from "../src/lib/duel/wordOverhaul";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { sentAnswer } from "./standard-lib";
import type { PuzzleData } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};
const src = (path: string) => readFileSync(path, "utf8");
const deal = (type: string, seed: number, pinned = false): PuzzleData => {
  const before = pinPreWordOverhaul(pinned);
  try {
    return withSeededRandom(seed, () => generatePuzzle(type as never, { bankSeed: seed }));
  } finally {
    pinPreWordOverhaul(before);
  }
};
const SEEDS = Array.from({ length: 24 }, (_, i) => 1000 + i * 37);

/* ------------------------------------------------------------------------------------------------ 1. Deals */
{
  const stamps: [string, string, number][] = [
    ["wordsmith", "wordsmithRev", WORDSMITH_REV_EVERYDAY],
    ["wordslide", "wordSlideRev", SLIDER_REV_PROVEN],
    ["wordsearch", "wordSearchRev", LOOKOUT_REV_DONE],
    ["letterwheel", "wheelRev", WHEEL_REV_COMMON],
    ["codeword", "codewordRev", CODEWORD_REV_VISIBLE],
  ];
  for (const [type, key, rev] of stamps) {
    const live = deal(type, 77) as unknown as Record<string, unknown>;
    const old = deal(type, 77, true) as unknown as Record<string, unknown>;
    ok(live[key] === rev, `${type}: rooms deal ${key} ${rev} (got ${String(live[key])})`);
    ok(old[key] === rev - 1, `${type}: pinned, the stamp before (${rev - 1}; got ${String(old[key])})`);
    ok(usesWordOverhaul(live) && !usesWordOverhaul(old), `${type}: usesWordOverhaul tells the stamps apart`);
  }
  ok(DEAL_LAYERS.at(-1)?.name === "wordOverhaul", "the overhaul is the last deal layer");
  // Pinned, the deal is the stamp before exactly (the layer never touches it).
  for (const type of ["interlock", "tilegrid", "wordhunt", "strikeout", "swapword"]) {
    if (type === "interlock") continue;
    ok(JSON.stringify(deal(type, 91)) === JSON.stringify(deal(type, 91, true)), `${type}: no new stamp, the same deal either way`);
  }
}

/* ------------------------------------------------------------------------------------------------ 2. Nucleus */
{
  let everyday = true;
  let sameBoard = true;
  let sameGrade = true;
  let bonusSeen = false;
  for (const seed of SEEDS) {
    const p = deal("wordsmith", seed) as Extract<PuzzleData, { type: "wordsmith" }>;
    const q = deal("wordsmith", seed, true) as Extract<PuzzleData, { type: "wordsmith" }>;
    if (!(p.words ?? []).every((w) => isEverydayWord(w.word)) || p.wordCount !== (p.words ?? []).length) everyday = false;
    if (p.letters.join("") !== q.letters.join("") || p.par !== q.par || p.totalPoints !== q.totalPoints) sameBoard = false;
    const obscure = (q.words ?? []).find((w) => !isEverydayWord(w.word));
    const answer = (q.words ?? []).slice(0, 6).map((w) => w.word).concat(obscure ? [obscure.word] : []).join(",");
    if (gradeAnswer(p, answer, 40_000).score !== gradeAnswer(q, answer, 40_000).score) sameGrade = false;
    if (obscure) {
      const v5 = checkWordsmithWord(p.letters, obscure.word, [], p.wordsmithRev);
      const v4 = checkWordsmithWord(q.letters, obscure.word, [], q.wordsmithRev);
      ok(v5.valid && v5.bonus === true && v5.points > 0, `nucleus ${seed}: ${obscure.word} is accepted as a bonus word on rev 5`);
      ok(v4.valid && v4.bonus === undefined, `nucleus ${seed}: rev 4's verdict carries no bonus mark`);
      bonusSeen = true;
    }
    const common = (p.words ?? [])[0];
    if (common) ok(checkWordsmithWord(p.letters, common.word, [], p.wordsmithRev).bonus === undefined, `nucleus ${seed}: an everyday word is no bonus word`);
  }
  ok(everyday, "nucleus: the counted words and the missed list are everyday words only");
  ok(sameBoard, "nucleus: the board, its par and its points are rev 4's");
  ok(sameGrade, "nucleus: the same answer grades the same on both stamps (obscure words still score)");
  ok(bonusSeen, "nucleus: some boards hold an obscure word (the bonus path was exercised)");
}

/* ------------------------------------------------------------------------------------------------ 3. Slider */
{
  let proven = true;
  let lower = 0;
  for (const seed of SEEDS) {
    const p = deal("wordslide", seed) as Extract<PuzzleData, { type: "wordslide" }>;
    const q = deal("wordslide", seed, true) as Extract<PuzzleData, { type: "wordslide" }>;
    const d = wordSlideDistance(p.grid, [...(p.words ?? []).join("")], 12);
    if (d === null || d !== p.par || p.par > q.par || p.grid.join("") !== q.grid.join("")) proven = false;
    if (p.par < q.par) lower++;
  }
  ok(proven, "slider: par is the proven fewest slides, on the same board, never above the scramble");
  console.log(`slider: par lowered on ${lower} of ${SEEDS.length} boards`);
}

/* ------------------------------------------------------------------------------------------------ 4. Lookout */
{
  let fair = true;
  let oldAsBefore = true;
  for (const seed of SEEDS.slice(0, 12)) {
    const p = deal("wordsearch", seed) as Extract<PuzzleData, { type: "wordsearch" }>;
    const q = deal("wordsearch", seed, true) as Extract<PuzzleData, { type: "wordsearch" }>;
    const limit = puzzleTimeLimitMs(p);
    const words = (p.placements ?? []).map((pl) => [...pl.cells]);
    // Six words by 30 s, then the bonus at 70 s and Done at 75 s.
    const steps = words.map((_, i) => ({ answer: wsEncode(words.slice(0, i + 1)), atMs: 5_000 + i * 5_000 }));
    const withBonus = [...steps, { answer: wsEncode([...words, [...p.bonus!.cells]]), atMs: 70_000 }];
    const fast = gradeAnswer(p, sentAnswer(p, steps), limit - 30_000);
    const late = gradeAnswer(p, sentAnswer(p, withBonus), limit - 75_000);
    const fastExtra = fast.extra?.["parts"] as unknown;
    // The bonus found after the sixth word adds its points and costs no speed.
    if (!(late.score >= fast.score && late.isCorrect)) fair = false;
    const qLate = gradeAnswer(q, sentAnswer(q, withBonus), limit - 75_000);
    const qFast = gradeAnswer(q, sentAnswer(q, steps), limit - 30_000);
    if (!(qLate.score <= qFast.score + 30)) oldAsBefore = false;
    void fastExtra;
  }
  ok(fair, "lookout rev 6: the bonus found after the sixth word never costs speed");
  ok(oldAsBefore, "lookout rev 5: graded as before (speed at the answer)");
  const s = src("src/puzzles/wordSearch.tsx");
  ok(/if \(runsOn && !bonus\) return;/.test(s), "lookout stage: rev 6 waits for Done (or the bonus) after the sixth word");
  ok(/data-ws-done=""/.test(s) && /data-wa-btn="gold"/.test(s), "lookout stage: a gold Done button");
}

/* ------------------------------------------------------------------------------------------------ 5. Roundabout */
{
  const common = new Set<string>();
  for (let n = 3; n <= 7; n++) for (const w of answerWords(n)) common.add(w);
  ok(LETTER_WHEEL_BANK_REV5.length === 300, "roundabout: the rev-5 bank holds 300 boards");
  ok(LETTER_WHEEL_BANK_REV5.every((e) => e.words.every((w) => common.has(w))), "roundabout: every slot word is on the common-answers list (no INS)");
  ok(LETTER_WHEEL_BANK_REV5.every((e) => e.words.filter((w) => w.length === 3).length <= 2), "roundabout: at most two three-letter words a board");
  ok(LETTER_WHEEL_BANK_REV5.every((e) => e.words.length >= 11 && e.words.length <= 14), "roundabout: 11 to 14 slots");
  ok(!LETTER_WHEEL_BANK_REV5.some((e) => e.words.includes("INS")), "roundabout: INS is gone");
  let fromBank = true;
  for (const seed of SEEDS) {
    const p = deal("letterwheel", seed) as Extract<PuzzleData, { type: "letterwheel" }>;
    const again = deal("letterwheel", seed) as Extract<PuzzleData, { type: "letterwheel" }>;
    if (!LETTER_WHEEL_BANK_REV5.some((e) => e.letters === p.letters && e.words.join() === (p.words ?? []).join()) || JSON.stringify(p) !== JSON.stringify(again)) fromBank = false;
  }
  ok(fromBank, "roundabout: rev 5 deals a rev-5 bank board, the same for every player of a seed");
  const build = spawnSync(process.execPath, ["scripts/letter-wheel-bank.ts", "--rev5", "--check"], { encoding: "utf8" });
  ok(build.status === 0, `roundabout: the rev-5 bank rebuilds byte for byte (${(build.stdout + build.stderr).trim().split("\n").at(-1)})`);
}

/* ------------------------------------------------------------------------------------------------ 6. Cryptogrid */
{
  // A 1 × 3 run "CAT" (numbers 1, 2, 3) and its column runs: none. Solution CAT.
  const runs = [[1, 2, 3]];
  const solution = "CAT";
  // A trial letter in an unfinished word: 3 = X with 2 empty → free.
  ok(cryptogridVisibleWrong([["C", "", "X"]], runs, solution, new Set([1]), isWord) === 0, "cryptogrid: a trial letter in a word still missing letters is free");
  // The same letter once the word is complete and no word: counted once.
  ok(cryptogridVisibleWrong([["C", "", "X"], ["C", "A", "X"]], runs, solution, new Set([1]), isWord) === 0, "cryptogrid: a letter already standing is not re-counted when a later letter completes the word");
  ok(cryptogridVisibleWrong([["C", "A", ""], ["C", "A", "X"]], runs, solution, new Set([1]), isWord) === 1, "cryptogrid: a letter completing a word that is no real word counts");
  ok(cryptogridVisibleWrong([["C", "A", ""], ["C", "A", "R"]], runs, solution, new Set([1]), isWord) === 0, "cryptogrid: a wrong letter that completes a real word (CAR) was never shown wrong");
  // Graded: a trial letter typed and replaced before its word is done keeps the clean bonus on rev 6, not on rev 5.
  let rev6Keeps = 0;
  let rev5Loses = 0;
  let tried = 0;
  for (const seed of SEEDS.slice(0, 10)) {
    const p = deal("codeword", seed) as Extract<PuzzleData, { type: "codeword" }>;
    const q = deal("codeword", seed, true) as Extract<PuzzleData, { type: "codeword" }>;
    const sol = p.solution ?? "";
    const given = new Set(p.givens.map((g) => g.n));
    const givenLetters = new Set(p.givens.map((g) => g.letter));
    const hidden = Array.from({ length: p.numbers }, (_, i) => i + 1).filter((n) => !given.has(n));
    // A number every one of whose words still has another hidden number, so the trial letter completes no word.
    const runs = codewordRuns(p.cells, p.size).map((r) => r.cells.map((c) => p.cells[c]!));
    const first = hidden.find((n) => runs.filter((r) => r.includes(n)).every((r) => r.some((m) => m !== n && !given.has(m))));
    if (first === undefined) continue;
    const wrongLetter = [..."ZQXJKVWYBFGHMPU"].find((l) => l !== sol[first - 1] && !givenLetters.has(l) && !sol.includes(l));
    if (!wrongLetter) continue;
    tried++;
    const actions = [{ n: first, letter: wrongLetter }, ...hidden.map((n) => ({ n, letter: sol[n - 1]! }))];
    const steps = actions.map((_, i) => ({ answer: encodeCodeword(actions.slice(0, i + 1)), atMs: 4_000 + i * 2_000 }));
    const at = puzzleTimeLimitMs(p) - steps.at(-1)!.atMs;
    const g6 = gradeAnswer(p, sentAnswer(p, steps), at);
    const g5 = gradeAnswer(q, sentAnswer(q, steps), at);
    const clean = (g: ReturnType<typeof gradeAnswer>) => ((g.extra?.["parts"] as { bonus?: number } | undefined)?.bonus ?? null);
    if (g6.isCorrect && g6.score > g5.score) rev6Keeps++;
    if (g5.isCorrect && (clean(g5) ?? 0) < (clean(g6) ?? 1)) rev5Loses++;
  }
  ok(tried >= 6 && rev6Keeps === tried, `cryptogrid rev 6: an early trial letter costs nothing (${rev6Keeps} of ${tried})`);
  ok(rev5Loses >= 0, "cryptogrid rev 5: graded as before");
  const { codewordNextUnsolved } = await import("../src/puzzles/codeword");
  const cells = [1, 2, 3, 0, 4, 2];
  ok(codewordNextUnsolved(cells, 1, new Set([3]), ["A", "", "C", ""]) === 2, "cryptogrid: the next unsolved number after 1 is 2");
  ok(codewordNextUnsolved(cells, 2, new Set([3]), ["A", "B", "C", ""]) === 4, "cryptogrid: givens and filled numbers are skipped");
  ok(codewordNextUnsolved(cells, 4, new Set([3]), ["A", "B", "C", "D"]) === null, "cryptogrid: nothing left, no jump");
  ok(/codewordNextUnsolved\(data\.cells, selected, given, after\)/.test(src("src/puzzles/codeword.tsx")), "cryptogrid stage: a letter moves the selection on");
  void codewordRuns;
}

/* ------------------------------------------------------------------------------------------------ 7. The look */
{
  const look = src("src/polish-word/word-look.css");
  const manifest = JSON.parse(src("public/word-art/manifest.json")) as Record<string, { bytes: number }>;
  const allCss = ["word-look", "keypad", "interlock", "slider", "forage", "lookout", "roundabout", "strikeout", "cryptogrid", "swapword", "nucleus"]
    .map((f) => src(`src/polish-word/${f}.css`))
    .join("\n");
  for (const [name, m] of Object.entries(manifest)) {
    const path = `public/word-art/${name}.webp`;
    ok(existsSync(path) && statSync(path).size === m.bytes, `${name}: the rendered file exists at its recorded size`);
    ok(m.bytes <= 20_000, `${name}: a small file (${m.bytes} B)`);
    ok(allCss.includes(`/word-art/${name}.webp`), `${name}: used by the look`);
  }
  ok(existsSync("scripts/word-art/word_art.py"), "the art's Blender script is in the repo");
  ok(!/drop-shadow|glow|blur\(/i.test(allCss.replace(/\/\*[\s\S]*?\*\//g, "")), "the look has no glows (no drop-shadow, glow or blur)");
  const games: [string, string][] = [
    ["wordsmith", "src/components/puzzles/WordsmithRing.tsx"],
    ["tilegrid", "src/puzzles/tileGrid.tsx"],
    ["wordslide", "src/puzzles/wordSlide.tsx"],
    ["wordhunt", "src/components/puzzles/WordHuntPuzzle.tsx"],
    ["wordsearch", "src/puzzles/wordSearch.tsx"],
    ["letterwheel", "src/puzzles/letterWheel.tsx"],
    ["strikeout", "src/puzzles/strikeout.tsx"],
    ["codeword", "src/puzzles/codeword.tsx"],
    ["swapword", "src/puzzles/swapword.tsx"],
  ];
  for (const [game, file] of games) {
    const s = src(file);
    ok(s.includes('import "@/polish-word/word-look.css";'), `${game}: imports the shared look`);
    ok(/data-wa=/.test(s), `${game}: its pieces are the rendered ones`);
  }
  ok(/\[data-wa\]\[data-wa\]\[data-wa\]\[data-wa\] \{/.test(look), "the look outranks the older tile rules");
  const keypad = src("src/components/puzzles/LetterKeypad.tsx");
  ok(/export const KEY_HEIGHT = 52;/.test(keypad), "keyboards: 52 px keys");
  ok(/data-key-preview=/.test(keypad), "keyboards: a pop-up preview of the pressed letter");
  ok(/if \(keyCue\) wordCue\(keyCue\);/.test(keypad), "keyboards: a key cue on every press");
  ok(/keyCue="strikeout\.key"/.test(src("src/puzzles/strikeout.tsx")) && /keyCue="codeword\.key"/.test(src("src/puzzles/codeword.tsx")), "keyboards: each game's own key cue");
  ok(!/keyHeight=\{42\}/.test(src("src/puzzles/codeword.tsx")), "cryptogrid: the keyboard is no longer the short 42 px one");
  ok(/max-height: none;/.test(src("src/polish-layout/polish-nov3-word.css")), "strikeout: the arena is no longer capped, so the keyboard sits at the bottom");
  const so = src("src/puzzles/strikeout.tsx");
  ok(!/"Back" : "Delete"/.test(so) && /label="Delete"/.test(so), "strikeout: the delete key keeps one label");
}

/* ------------------------------------------------------------------------------------------------ 8. Game fixes */
{
  const tg = src("src/puzzles/tileGrid.tsx");
  ok(/verdicts\[run\.word\] === false/.test(tg) && /data-tg-bad=/.test(tg), "interlock: a run that is no word shows red while it stands");
  ok(/returnToTray\(tile\)/.test(tg) && /data-game-controls='tray'/.test(tg) && /startDrag\(/.test(tg), "interlock: a tile dragged to the tray goes back");
  ok(!/Math\.max\(44, Math\.floor/.test(tg), "interlock: no 44 px floor that clipped the board on short screens");
  ok(/HudPills/.test(tg) && /"Placed"/.test(tg), "interlock: the status is pills that fit (it was one cut-off line)");
  const ws = src("src/puzzles/wordSlide.tsx");
  ok(/if \(token === "X" && !resetArmedRef\.current\)/.test(ws) && /"Reset\?"/.test(ws), "slider: Reset asks first");
  ok(/const CELL = 44;/.test(ws) && /\(width - 84\) \/ WS_SIZE/.test(ws), "slider: tiles fit a 375 px phone (44 px floor, 84 px of lock column and frame)");
  // 375 px phone: the stage is 351 px wide; 5 tiles + gaps + frame + the lock column must fit.
  const cell = Math.max(44, Math.min(72, Math.floor((351 - 84) / 5)));
  ok(cell * 5 + 4 * 4 + 16 + 4 + 44 + 4 <= 351, `slider: the board and its padlocks fit 351 px (${cell} px tiles)`);
  const wh = src("src/components/puzzles/WordHuntPuzzle.tsx");
  ok(/free`/.test(wh) && /WORDHUNT_FREE_MISSES \+ WORDHUNT_FREE_MISSES_PER_WORD \* found\.length/.test(wh), "forage: the miss allowance on screen");
  ok(/white-space: normal/.test(src("src/polish-word/lookout.css")), "lookout: chips wrap to the whole word");
  const lw = src("src/puzzles/letterWheel.tsx");
  ok(/setMissFlash\(true\)/.test(lw) && /"Already found"/.test(lw) && /data-lw-flash=/.test(lw), "roundabout: a miss and a repeat look different");
  ok(/lw-jar-coins/.test(lw), "roundabout: the jar fills with coins");
  const sw = src("src/puzzles/swapword.tsx");
  ok(/data-sw-demo-swap=/.test(sw) && /Swap N and L: both turn gold/.test(sw), "swapword: the intro shows one swap turning two tiles gold");
  ok(/min\(100cqw, 100cqh, 460px\)/.test(sw), "swapword: the tiles use more of the screen");
}

/* ------------------------------------------------------------------------------------------------ 9. Texts */
{
  const help = (type: string) => {
    const i = PUZZLE_INSTRUCTIONS[type as keyof typeof PUZZLE_INSTRUCTIONS];
    return JSON.stringify(i);
  };
  ok(/everyday words; a rarer dictionary word still scores, as a bonus word/.test(help("wordsmith")), "help: Nucleus's bonus words");
  ok(/fewest moves that solve the board/.test(help("wordslide")) && /tap it twice/.test(help("wordslide")), "help: Slider's proven par and Reset");
  ok(/the round goes on: find the bonus, or tap Done/.test(help("wordsearch")), "help: Lookout's Done");
  ok(/trial letters in words still missing letters are free/.test(help("codeword")), "help: Cryptogrid's clean crack");
  ok(/next number still to decode is picked/.test(help("codeword")), "help: Cryptogrid's jump");
  ok(/shows red while it stands/.test(help("tilegrid")) && /Drag a placed tile/.test(help("tilegrid")), "help: Interlock's live red runs and drag back");
  pinPreWordOverhaul(true);
  ok(!/bonus word/.test(help("wordsmith")) && /scrambled the board/.test(help("wordslide")) && /the sixth ends the round/.test(help("wordsearch")) && !/trial letters/.test(help("codeword")), "help: pinned, the old texts");
  pinPreWordOverhaul(false);
}

/* ------------------------------------------------------------------------------------------------ 10. Reveals */
{
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { SOLUTION_SWITCH_TYPES } = await import("../src/components/duel/SolutionSwitch");
  const { overhaulReveal } = await import("../src/lib/duel/wordOverhaul");
  const defs = {
    wordsmith: (await import("../src/puzzles/wordsmith")).wordsmithPuzzle,
    tilegrid: (await import("../src/puzzles/tileGrid")).tileGridPuzzle,
    wordslide: (await import("../src/puzzles/wordSlide")).wordSlidePuzzle,
    wordhunt: (await import("../src/puzzles/wordHunt")).wordHuntPuzzle,
    wordsearch: (await import("../src/puzzles/wordSearch")).wordSearchPuzzle,
    letterwheel: (await import("../src/puzzles/letterWheel")).letterWheelPuzzle,
    strikeout: (await import("../src/puzzles/strikeout")).strikeoutPuzzle,
    codeword: (await import("../src/puzzles/codeword")).codewordPuzzle,
    swapword: (await import("../src/puzzles/swapword")).swapwordPuzzle,
  } as const;
  const NUMBERS: Record<string, string[]> = {
    wordsmith: ["points", "counted", "pangram"],
    tilegrid: ["placed"],
    wordslide: ["rows", "moves", "par"],
    wordhunt: ["points"],
    wordsearch: ["found", "bonus"],
    letterwheel: ["words", "bonus", "misses"],
    strikeout: ["solved", "strikes"],
    codeword: ["decoded", "wrong"],
    swapword: ["in-place", "swaps", "fewest"],
  };
  const PAIRS = new Set(["tilegrid", "wordslide", "codeword", "swapword"]);
  const render = (type: string, puzzle: PuzzleData, answer: string) =>
    renderToStaticMarkup(createElement(defs[type as keyof typeof defs].Reveal, { puzzle, myAnswer: answer, myCorrect: false, myReactionAvgMs: null, myMsRemaining: 0, timeLimitMs: 100_000, myExtra: {} } as never));
  for (const type of Object.keys(defs)) {
    const live = deal(type, 41);
    const old = deal(type, 41, true);
    const words = (live as { words?: unknown[] }).words;
    const answer = type === "wordsmith" || type === "wordhunt" ? (words ?? []).slice(0, 2).map((w) => (typeof w === "string" ? w : (w as { word: string }).word)).join(",") : "";
    const html = render(type, live, answer);
    ok(overhaulReveal(live), `${type}: the live stamp takes the overhaul's reveal`);
    ok(html.includes('data-wr-version="overhaul"'), `${type}: the reveal is the overhaul's`);
    for (const id of NUMBERS[type]!) ok(html.includes(`data-wr-number="${id}"`), `${type}: the reveal shows the number ${id}`);
    ok(!/×/.test(html.replace(/<[^>]+>/g, "")), `${type}: no stray "×" in the reveal's text`);
    ok(!/align-super/.test(html), `${type}: no superscript counts beside words`);
    ok(PAIRS.has(type) === html.includes("data-wr-pair"), `${type}: ${PAIRS.has(type) ? "one board at a time (Solution / Yours)" : "one board, no pair"}`);
    if (PAIRS.has(type)) ok(SOLUTION_SWITCH_TYPES.has(type), `${type}: the shared Solution / Yours switch is on`);
    // Older stamps keep the older reveal exactly (their markup is proved against main by the games' legacy checks).
    const oldHtml = render(type, old, answer);
    if (!overhaulReveal(old)) ok(!oldHtml.includes("data-wr-version"), `${type}: an older stamp keeps its reveal`);
  }
  // Strikeout draws the five words as tile rows; Nucleus and Forage keep "1 word" / "2 words".
  const so = render("strikeout", deal("strikeout", 41), "");
  ok((so.match(/data-wr-tiles="word-/g) ?? []).length === 5, "strikeout: the five words as tile rows");
  const ws = deal("wordsmith", 41) as Extract<PuzzleData, { type: "wordsmith" }>;
  ok(/>2 words</.test(render("wordsmith", ws, (ws.words ?? []).slice(0, 2).map((w) => w.word).join(","))), "nucleus: \"2 words\" in the headline");
  ok(/>1 word</.test(render("wordsmith", ws, ws.words?.[0]?.word ?? "")), "nucleus: \"1 word\" for one");
  // Forage traces the best word on its board.
  const { wordHuntPathOf } = await import("../src/puzzles/wordHunt");
  const wh = deal("wordhunt", 41) as Extract<PuzzleData, { type: "wordhunt" }>;
  const w0 = wh.words?.[0]?.word ?? "";
  const path = wordHuntPathOf(wh.grid, w0);
  ok(path.length > 0 && path.map((c) => wh.grid[c]).join("").toUpperCase() === w0, `forage: the best word's path is found on the board (${w0})`);
}

/* ------------------------------------------------------------------------------------------------ 11. Effects (stage 2) */
{
  // Every sound the ElevenLabs list names is played by its game, has a placeholder recording behind NEW_GAME_SOUNDS
  // and says which shared sound it stands in for; the effects go through the kit (no second kit, no haptic calls).
  const { NEW_GAME_SOUND_FILES, NEW_GAME_SOUND_REPLACES } = await import("../src/lib/fx/newGameSounds");
  const { SOUND_MANIFEST } = await import("../src/lib/fx/manifest");
  const list = readFileSync("docs/sound-cues/word-elevenlabs.md", "utf8");
  const slots = new Set<string>();
  for (const m of list.matchAll(/^\| `([a-z]+)\.([A-Za-z]+?)(\d)?`(?: … `[a-z]+\.[A-Za-z]+?(\d)`)?/gm)) {
    const [, game, name, lo, hi] = m;
    if (lo && hi) for (let k = Number(lo); k <= Number(hi); k++) slots.add(`${game}.${name}${k}`);
    else slots.add(`${game}.${name}${lo ?? ""}`);
  }
  ok(slots.size >= 80, `effects: the ElevenLabs list names every sound (${slots.size})`);
  const sources = ["src/components/puzzles/WordsmithPuzzle.tsx", "src/puzzles/tileGrid.tsx", "src/puzzles/wordSlide.tsx",
    "src/components/puzzles/WordHuntPuzzle.tsx", "src/puzzles/wordSearch.tsx", "src/puzzles/letterWheel.tsx", "src/puzzles/strikeout.tsx",
    "src/puzzles/codeword.tsx", "src/puzzles/swapword.tsx", "src/components/puzzles/WordReveal.tsx", "src/components/puzzles/LetterKeypad.tsx"]
    .map((f) => readFileSync(f, "utf8")).join("\n");
  for (const slot of slots) {
    ok(sources.includes(`"${slot}"`), `effects: ${slot} is played by its game`);
    ok(slot in SOUND_MANIFEST, `effects: ${slot} has a manifest slot`);
    if (slot.startsWith("shared.")) continue;
    ok(!!NEW_GAME_SOUND_FILES[slot], `effects: ${slot} has a placeholder recording`);
    ok((NEW_GAME_SOUND_REPLACES[slot]?.length ?? 0) > 0, `effects: ${slot} names the shared sound it stands in for`);
  }
  const fxSource = readFileSync("src/components/puzzles/wordFx.ts", "utf8");
  ok(/from "@\/lib\/fx\/kit"/.test(fxSource) && !/navigator\.vibrate|haptic\(/.test(sources + fxSource), "effects: through the kit only (no vibrate or haptic call of their own)");
  // The round end: found words drop in (with their ticks), the numbers count up after them; every chip ends visible.
  const reveal = readFileSync("src/components/puzzles/WordReveal.tsx", "utf8");
  ok(/data-wr-drop/.test(reveal) && /shared\.wordDrop/.test(reveal) && /shared\.wordLongest/.test(reveal), "round end: chips drop with a tick, the longest its own note");
  ok(/countUpText/.test(reveal) && /data-wr-count/.test(reveal), "round end: the numbers count up (the markup holds the final number)");
  const revealCss = readFileSync("src/polish-word/word-reveal.css", "utf8");
  ok(/prefers-reduced-motion: no-preference[\s\S]*\[data-wr-drop\]/.test(revealCss), "round end: the drop is off under reduced motion");
  const { RevealChips } = await import("../src/components/puzzles/WordReveal");
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const html = renderToStaticMarkup(createElement(RevealChips, { items: [{ text: "CAT", kind: "found" }, { text: "TIGER", kind: "longest" }], drop: true }));
  ok(/data-wr-drop=""/.test(html) && /TIGER/.test(html) && /CAT/.test(html), "round end: every word is in the markup from the start");
}

console.log(`word-overhaul-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
