/**
 * The wheelRev 2 half of depth-letterwheel-check (scripts/depth-letterwheel-check.ts): new deals, the jar's rules,
 * the bands and the texts. Imported by the check after its legacy identity pass.
 */
import { isWord } from "../src/lib/duel/dictionary.server";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import {
  LW_JAR_DROPS,
  LW_JAR_POINTS,
  LW_JAR_UNFINISHED_TOP,
  LW_REV,
  LW_REV_JAR,
  lwEncodeLog,
  lwJarBonus,
  lwJarDrops,
  lwJarTally,
} from "../src/lib/duel/letterWheel";
import { lwBonusDropsAvailable } from "../src/lib/duel/letterWheel.server";
import { LETTER_WHEEL_BANK_REV1 } from "../src/lib/duel/letterWheelBankRev1.server";
import { storedScoreParts } from "../src/lib/duel/puzzleScoreRev";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { pinPreDepth } from "../src/lib/duel/wordDepth";
import { wordsFrom } from "../src/lib/duel/dictionary.server";
import type { LetterWheelPuzzleData } from "../src/lib/duel/types";
import { measureGame } from "./depth-word-bands";
import { roomPuzzle } from "./puzzle-fairness/run";
import { KITS } from "./puzzle-fairness/kits";
import { hashText, makeRng } from "./puzzle-fairness/kit";

type Ok = (cond: boolean, message: string) => void;

export function run(ok: Ok): void {
  /* 2. New deals. */
  ok(roundMaxFor("letterwheel") === 200, "Roundabout's maximum is 200");
  for (let s = 1; s <= 12; s++) {
    const seed = 8800 + s;
    const p = roomPuzzle("letterwheel", seed) as LetterWheelPuzzleData;
    ok(p.wheelRev === LW_REV_JAR, `seed ${seed}: rooms deal wheelRev ${LW_REV_JAR} (${p.wheelRev})`);
    ok(roomPuzzle("letterwheel", seed).letters === p.letters, `seed ${seed}: the room seed deals the same board`);
    const size = p.jarSize ?? 0;
    ok(size >= 1 && size <= LW_JAR_DROPS && size === Math.min(LW_JAR_DROPS, Math.ceil(lwBonusDropsAvailable(p.letters, p.words ?? []) * 0.6)), `seed ${seed}: the jar size follows the board (${size})`);
    const { pub } = splitPuzzle(p);
    ok(!("words" in (pub as object)) && (pub as LetterWheelPuzzleData).jarSize === size, `seed ${seed}: words stay server-only, the jar size is public`);
    pinPreDepth(true);
    try {
      const old = roomPuzzle("letterwheel", seed) as LetterWheelPuzzleData;
      ok(old.wheelRev === LW_REV && old.jarSize === undefined && old.letters === p.letters, `seed ${seed}: pinPreDepth deals wheelRev 1 on the same board`);
    } finally {
      pinPreDepth(false);
    }
  }
  const sizes = LETTER_WHEEL_BANK_REV1.map((e) => Math.min(LW_JAR_DROPS, Math.ceil(lwBonusDropsAvailable(e.letters, e.words) * 0.6)));
  ok(sizes.filter((s) => s === LW_JAR_DROPS).length >= 200, `most boards get the full ${LW_JAR_DROPS}-drop jar (${sizes.filter((s) => s === LW_JAR_DROPS).length} of ${sizes.length})`);

  /* 3. The jar. */
  ok(lwJarDrops("SUN") === 1 && lwJarDrops("RUNE") === 2 && lwJarDrops("RISEN") === 3 && lwJarDrops("INSURE") === 4 && lwJarDrops("URSINES") === 4, "drops by length: 1 / 2 / 3 / 4");
  ok(lwJarBonus(0, 30) === 0 && lwJarBonus(15, 30) === 25 && lwJarBonus(30, 30) === LW_JAR_POINTS && lwJarBonus(99, 30) === LW_JAR_POINTS, "the bonus is 50 × drops ÷ size, at most 50");
  for (let s = 1; s <= 8; s++) {
    const p = roomPuzzle("letterwheel", 8900 + s) as LetterWheelPuzzleData;
    const words = p.words ?? [];
    const slots = new Set(words);
    const bonus = wordsFrom(p.letters, 3, true).map((w) => w.toUpperCase()).filter((w) => !slots.has(w) && isWord(w));
    const limit = puzzleTimeLimitMs(p);
    const finish = (traces: string[], ms: number) => gradeAnswer(p, lwEncodeLog([...traces, ...words]), ms);
    const plain = finish([], limit);
    ok(plain.isCorrect && plain.score === 150, `board ${s}: a fast clean finish with an empty jar is 150 (${plain.score})`);
    const tally = lwJarTally(words, p.letters, bonus, isWord);
    const full = finish(bonus, limit);
    ok(full.score === 200 && tally.drops >= (p.jarSize ?? 0), `board ${s}: every bonus word fills the jar: 200 (${full.score})`);
    const one = bonus[0]!;
    const g1 = finish([one], limit);
    const expect = Math.min(200, 150 + lwJarBonus(lwJarDrops(one), p.jarSize ?? LW_JAR_DROPS));
    ok(g1.score === expect && g1.extra?.["bonusWords"] === 1, `board ${s}: one bonus word adds its drops (${g1.score} vs ${expect})`);
    ok(finish([one, one, one], limit).score === g1.score, `board ${s}: a repeat adds nothing`);
    ok(finish([words[0]!, words[0]!], limit).score === 150, `board ${s}: crossword words fill no jar`);
    const junk = finish(["QZX", "XQZ"], limit);
    ok(junk.score === 150 && junk.extra?.["bonusWords"] === 0 && junk.extra?.["misses"] === 2, `board ${s}: non-words add nothing and stay misses`);
    const spilled = finish([one, "QZX", "QZY", "QZW", "XQZ", "XQY", "XQW", "WQZ"], limit);
    ok(spilled.extra?.["jarDrops"] === Math.max(0, lwJarDrops(one) - 2) && spilled.extra?.["jarSpilled"] === Math.min(2, lwJarDrops(one)), `board ${s}: misses after the free 5 spill a drop each`);
    const parts = storedScoreParts(g1.extra);
    ok(parts?.kind === "finish" && parts.base + (parts.efficiency ?? 0) + (parts.speed ?? 0) === g1.score && parts.measure === "bonus jar", `board ${s}: the finish breakdown adds up and names the jar`);
    // Unfinished: today's credit plus the jar, never a finish's 120.
    const unfinished = gradeAnswer(p, lwEncodeLog([...bonus, ...words.slice(0, -1)]), 0);
    ok(!unfinished.isCorrect && unfinished.score <= LW_JAR_UNFINISHED_TOP && unfinished.score > 0, `board ${s}: unfinished with a full jar stays at ${LW_JAR_UNFINISHED_TOP} at most (${unfinished.score})`);
    // Without bonus words no round passes 150; more drops never score less; time still counts.
    let last = -1;
    for (let k = 0; k <= Math.min(bonus.length, 12); k++) {
      const g = finish(bonus.slice(0, k), limit);
      ok(g.score >= last, `board ${s}: more bonus words never score less`);
      last = g.score;
    }
    ok(finish([], 0).score === 120 && finish(bonus, 0).score === 170, `board ${s}: a buzzer finish is 120, plus a full jar 170`);
  }

  /* 4. Random play stays near 0 (misses spill the jar). */
  const kit = KITS.letterwheel!;
  const spam: Record<string, number[]> = {};
  for (let s = 1; s <= 30; s++) {
    const p = roomPuzzle("letterwheel", 9500 + s);
    for (const sp of kit.spam(p, makeRng(hashText(`depth-lw-new:spam:${s}`)), puzzleTimeLimitMs(p))) (spam[sp.label] ??= []).push(gradeAnswer(p, sp.answer, 0).score);
  }
  for (const [label, scores] of Object.entries(spam)) {
    const sorted = [...scores].sort((a, b) => a - b);
    ok(sorted[Math.floor(sorted.length / 2)]! <= 5, `random: ${label} median ${sorted[Math.floor(sorted.length / 2)]} ≤ 5 on wheelRev 2`);
  }

  /* 4b. Bands. */
  const b = measureGame("letterwheel", 24);
  const lvl = (id: string) => b.levels.find((l) => l.id === id)!;
  const good = lvl("good");
  ok(Math.abs(good.now.median - good.old.median) <= Math.max(3, good.old.median * 0.1), `a good player scores as before ±10 % (${good.old.median} → ${good.now.median})`);
  ok(lvl("near").now.median >= 150 && lvl("near").now.median <= 168, `a near-perfect player lands about 150–165 (${lvl("near").now.median})`);
  ok(lvl("elite").now.best >= 190 && lvl("elite").now.best <= 200, `the elite player reaches 190–200 (${lvl("elite").now.best})`);
  ok(lvl("average").now.best < 150 && lvl("good").now.best < 150, "average and good players never pass 150");

  /* 5. Texts. */
  const help = PUZZLE_INSTRUCTIONS.letterwheel;
  ok(/bonus jar/i.test(help.score) && /\b200\b/.test(help.score) && /\b50\b/.test(help.score), `the help states the jar and the 200 maximum: ${help.score}`);
  ok(help.how.some((l) => !l.helpOnly && /bonus jar/.test(`${l.action} ${l.detail}`)), "the intro's how lines state the jar in one line");
  ok(/jar/.test(INTRO_SCORE.letterwheel) && /\b200\b/.test(INTRO_SCORE.letterwheel) && INTRO_SCORE.letterwheel.length <= 90, `the intro line states the jar and its maximum: ${INTRO_SCORE.letterwheel}`);
}
