/**
 * word-star-check (D1, 21 Nov 2026; wordStar.ts, plan section 8.2 I4): the open word finds' points lines refitted on new
 * stamps, Nucleus wordsmithRev 6, Forage wordHuntRev 5 and Roundabout wheelRev 6.
 *
 *  1. Legacy: every case of scripts/fixtures/word-star-legacy.json.gz (today's stamps before the refit, at Normal and at
 *     every level, recorded on main by scripts/word-star-record.ts) grades exactly as recorded: score, correctness and
 *     the stored extra's digest.
 *  2. Deals: rooms deal the new stamps; pinned (pinPreWordStar) the stamps before; the board is the same either way
 *     (only the stamp moves), at Normal and at every level.
 *  3. The lines: below an average or good player's haul each new curve is the old one exactly; Nucleus's word points
 *     part is full at 45, Forage's base part at 44 and its extras at 70, Roundabout's speed by 55 s and its jar at four
 *     fifths; the help states Roundabout's new numbers while it is dealt and the old ones while pinned.
 *  4. The bar (Joe, 20 Nov: a near-perfect player earns the star, the best can reach 200), measured with the length-aware
 *     people under the human limits (scripts/word-human.ts) on 40 Normal deals, two runs each (Roundabout 16, one): the near-perfect person's median is at
 *     least 175, the elite reaches 200, and the average person's runs score within 3 of what they scored on the old line.
 *     Roundabout, which the people can't play as well as its own kit (the crossword's crossing letters), is measured with
 *     its kit at near-perfect and the kits' elite, every trace held to the human limits.
 */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { bandOpen } from "../src/lib/arcade/scoreBands";
import { WORDSMITH_V4_CURVE, WORDSMITH_V6_CURVE, wordsmithV3Words } from "../src/lib/duel/scoring";
import { WORDHUNT_V4_BASE_CURVE, WORDHUNT_V4_BONUS_CURVE, WORDHUNT_V5_BASE_CURVE, WORDHUNT_V5_BONUS_CURVE } from "../src/lib/duel/wordHunt";
import { ROUNDABOUT_STAR_FULL_BY_S, WORD_STAR_STAMPS, pinPreWordStar, roundaboutStarJarFull, usesWordStar } from "../src/lib/duel/wordStar";
import { WORD_STANDARD_HELP } from "../src/lib/duel/standard/word";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { asPhoneSends, gradeSteps } from "./standard-lib";
import { KIT_ELITE, limitSteps, personRng, type PersonLevel } from "./word-human";
import { gradeOpenRun, playOpen } from "./word-human-games";
import { wheelTapsAdded } from "./word-human-tune";

let passes = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};
const digest = (extra: unknown) => createHash("sha256").update(JSON.stringify(extra ?? null)).digest("hex").slice(0, 16);
const TYPES: PuzzleType[] = ["wordsmith", "wordhunt", "letterwheel"];
const deal = (type: PuzzleType, seed: number, level: string, pinned = false): PuzzleData => {
  const before = pinPreWordStar(pinned);
  try {
    return withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed, ...(level !== "normal" ? { level: level as never } : {}) }));
  } finally {
    pinPreWordStar(before);
  }
};

/* ------------------------------------------------------------------------------------------------ 1. Legacy */
{
  const fx = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/word-star-legacy.json.gz")).toString()) as {
    puzzles: PuzzleData[];
    cases: { p: number; answer: string; msLeft: number; score: number; correct: boolean; extra: string }[];
  };
  let same = 0;
  const differs: string[] = [];
  for (const c of fx.cases) {
    const p = fx.puzzles[c.p]!;
    const g = gradeAnswer(p, c.answer, c.msLeft);
    if (g.score === c.score && g.isCorrect === c.correct && digest(g.extra) === c.extra) same++;
    else if (differs.length < 6) differs.push(`${p.type} #${c.p} ${c.score}→${g.score}`);
  }
  ok(fx.puzzles.every((p) => !usesWordStar(p)), `legacy: the ${fx.puzzles.length} recorded puzzles are on the stamps before the refit`);
  ok(same === fx.cases.length, `legacy: ${same} of ${fx.cases.length} recorded grades identical${differs.length ? ` (${differs.join(", ")})` : ""}`);
}

/* ------------------------------------------------------------------------------------------------ 2. Deals */
for (const type of TYPES) {
  const st = WORD_STAR_STAMPS[type]!;
  for (const level of ["normal", "easy", "hard", "expert"])
    for (const seed of [5, 77, 913]) {
      const live = deal(type, seed, level) as unknown as Record<string, unknown>;
      const old = deal(type, seed, level, true) as unknown as Record<string, unknown>;
      ok(live[st.key] === st.rev && old[st.key] === st.from, `${type} ${level} ${seed}: rooms deal ${st.key} ${st.rev}, pinned ${st.from} (${String(live[st.key])} / ${String(old[st.key])})`);
      ok(JSON.stringify({ ...live, [st.key]: 0 }) === JSON.stringify({ ...old, [st.key]: 0 }), `${type} ${level} ${seed}: the same board either way`);
    }
}

/* ------------------------------------------------------------------------------------------------ 3. The lines */
{
  const upTo = (n: number, f: (x: number) => boolean) => Array.from({ length: n + 1 }, (_, x) => x).every(f);
  ok(upTo(18, (x) => bandOpen(WORDSMITH_V6_CURVE, x) === bandOpen(WORDSMITH_V4_CURVE, x)), "nucleus: rev 6's curve is rev 4's to 18 word points");
  ok(wordsmithV3Words(45, 6) === 180 && wordsmithV3Words(44, 6) < 180 && wordsmithV3Words(45, 5) < 180, "nucleus: the word points part is full at 45 on rev 6 (not before, not on rev 5)");
  ok(upTo(27, (x) => bandOpen(WORDHUNT_V5_BASE_CURVE, x) === bandOpen(WORDHUNT_V4_BASE_CURVE, x) && bandOpen(WORDHUNT_V5_BONUS_CURVE, x, 50) === bandOpen(WORDHUNT_V4_BONUS_CURVE, x, 50)), "forage: rev 5's curves are rev 4's to 27 points");
  ok(bandOpen(WORDHUNT_V5_BASE_CURVE, 44) === 150 && bandOpen(WORDHUNT_V5_BASE_CURVE, 43) < 150 && bandOpen(WORDHUNT_V5_BONUS_CURVE, 70, 50) === 50 && bandOpen(WORDHUNT_V5_BONUS_CURVE, 69, 50) < 50, "forage: base full at 44, extras full at 70");
  ok(ROUNDABOUT_STAR_FULL_BY_S === 55 && roundaboutStarJarFull(30) === 24 && roundaboutStarJarFull(20) === 16 && roundaboutStarJarFull(1) === 1, "roundabout: speed full by 55 s, the jar full at four fifths");
  const was = pinPreWordStar(false);
  const liveHelp = JSON.stringify(WORD_STANDARD_HELP.letterwheel);
  pinPreWordStar(true);
  const oldHelp = JSON.stringify(WORD_STANDARD_HELP.letterwheel);
  pinPreWordStar(was);
  ok(/55/.test(liveHelp) && /four fifths/.test(liveHelp) && !/four fifths/.test(oldHelp) && /40/.test(oldHelp), "roundabout: the help states the new speed line and jar while dealt, the old ones while pinned");
  // A finished Roundabout round with a jar four fifths full scores its whole jar on rev 6 and four fifths of it on rev 5.
  const p6 = deal("letterwheel", 77, "normal") as Extract<PuzzleData, { type: "letterwheel" }>;
  const p5 = deal("letterwheel", 77, "normal", true) as Extract<PuzzleData, { type: "letterwheel" }>;
  const answer = (p6.words ?? []).join(",");
  const at50 = puzzleTimeLimitMs(p6) - 50_000;
  ok(gradeAnswer(p6, answer, at50).score === 170 && gradeAnswer(p5, answer, at50).score < 170, `roundabout: a clean finish in 50 s with an empty jar scores 150 + 20 on rev 6 (${gradeAnswer(p6, answer, at50).score}), less on rev 5 (${gradeAnswer(p5, answer, at50).score})`);
}

/* ------------------------------------------------------------------------------------------------ 4. The bar */
{
  const NS = Array.from({ length: 16 }, (_, i) => i);
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)]!;
  for (const type of ["wordsmith", "wordhunt"] as const) {
    const scores: Record<PersonLevel, number[]> = { average: [], good: [], near: [], elite: [] };
    let averageShift = 0;
    for (const n of Array.from({ length: 80 }, (_, i) => i)) {
      const p = withSeededRandom(1000 + (n >> 1), () => generatePuzzle(type, { bankSeed: 1000 + (n >> 1) }));
      const old = { ...p, ...{ [WORD_STAR_STAMPS[type]!.key]: WORD_STAR_STAMPS[type]!.from } } as PuzzleData;
      for (const person of ["average", "near", "elite"] as PersonLevel[]) {
        const steps = playOpen(p, person, personRng(`word-star:${type}`, "normal", n >> 1, person, n & 1));
        const now = gradeOpenRun(p, steps).score;
        scores[person].push(now);
        if (person === "average") averageShift = Math.max(averageShift, Math.abs(now - gradeOpenRun(old, steps).score));
      }
    }
    ok(med(scores.near) >= 175, `${type}: the near-perfect person's median earns the star (${med(scores.near)})`);
    ok(scores.elite.some((s) => s >= 200), `${type}: the elite reaches 200 (${scores.elite.filter((s) => s >= 200).length} of ${scores.elite.length})`);
    ok(averageShift <= 3, `${type}: an average run scores within 3 of the old line (most ${averageShift})`);
  }
  {
    const near: number[] = [];
    const elite: number[] = [];
    for (const n of NS) {
      const p = withSeededRandom(1000 + n, () => generatePuzzle("letterwheel", { bankSeed: 1000 + n }));
      const limit = puzzleTimeLimitMs(p);
      for (const [k, skill, into] of [["near", SKILLS.near, near], ["elite", KIT_ELITE, elite]] as const) {
        const play = KITS.letterwheel!.play(p, makeRng(hashText(`word-star:letterwheel:${n}:${k}`)), skill, limit);
        into.push(gradeSteps(p, asPhoneSends(p, limitSteps(play.steps, wheelTapsAdded))).score);
      }
    }
    ok(med(near) >= 175, `letterwheel: the near-perfect kit's median earns the star (${med(near)})`);
    ok(elite.some((s) => s >= 200), `letterwheel: the elite reaches 200 (${elite.filter((s) => s >= 200).length} of ${NS.length})`);
  }
}

if (failures.length) {
  console.log(`FAIL word-star-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS word-star-check: ${passes} checks`);
