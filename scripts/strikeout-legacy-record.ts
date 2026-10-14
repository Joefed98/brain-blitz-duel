/**
 * Records scripts/fixtures/strikeout-legacy.json.gz: Strikeout rev-1 rounds
 * (five five-letter words) graded by a tree that predates strikeoutRev 2, so
 * strikeout-check can prove stored rounds grade, store and show exactly as
 * before. Run it against an unmodified checkout of the commit before the
 * change (recorded on main before the 14 Oct 2026 word batch):
 *
 *   bun scripts/strikeout-legacy-record.ts <path to that tree> [label, e.g. "main 1c0deac"]
 *
 * Each case: the rev-1 puzzle as that tree generated it (with and without the
 * puzzleScoreRev / speedPar stamps), an answer (empty, spam, the four fairness
 * solver levels and their intermediate states, refused and malformed solves)
 * and a time left; recorded: the whole Graded result, the live-check reply and
 * (at half time) the reveal's markup drawn from the stored answer.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const gen = await import(`${root}/src/lib/duel/generate.server.ts`);
const so = await import(`${root}/src/lib/duel/strikeout.server.ts`);
const kits = await import(`${root}/scripts/puzzle-fairness/kits.ts`);
const kitLib = await import(`${root}/scripts/puzzle-fairness/kit.ts`);
const { renderToStaticMarkup } = await import("react-dom/server");
const { createElement } = await import("react");
const { strikeoutPuzzle } = await import(`${root}/src/puzzles/strikeout.tsx`);

const kit = kits.KITS.strikeout;
const cases: unknown[] = [];
const LIMIT = 100_000;
for (const seed of [11, 202, 3003, 40004, 500005, 6006006]) {
  const stamped = gen.generatePuzzle("strikeout", { bankSeed: seed });
  const { puzzleScoreRev: _a, ...noScoreRev } = stamped;
  const { speedPar: _b, ...legacy } = noScoreRev;
  const rng = kitLib.makeRng(seed);
  const answers = new Set<string>([""]);
  for (const s of kit.spam(stamped, rng, LIMIT)) answers.add(s.answer);
  for (const level of kitLib.LEVELS) {
    const play = kit.play(stamped, rng, kitLib.SKILLS[level], LIMIT);
    play.steps.forEach((step: { answer: string }, i: number) => {
      if (i % 3 === 0 || i === play.steps.length - 1) answers.add(step.answer);
    });
  }
  const w = stamped.words as string[];
  answers.add(`E,0QZXJV,1${w[1]},A,9ABCDE,2CRATE,${w[0]![0]}`);
  answers.add(`${w.map((x, i) => `${i}${x}`).join(",")},Q`);
  answers.add(`e , t ,0${w[0]!.toLowerCase()},,3XXXXX,4${w[4]}`);
  for (const puzzle of [stamped, noScoreRev, legacy]) {
    for (const answer of answers) {
      for (const ms of [0, 30_000, LIMIT / 2, LIMIT]) {
        const graded = gen.gradeAnswer(puzzle, answer, ms);
        // The reveal as that tree drew it from the stored answer (one time per answer keeps the fixture small).
        const reveal =
          ms === LIMIT / 2
            ? renderToStaticMarkup(createElement(strikeoutPuzzle.Reveal, { puzzle, myAnswer: graded.answer, myMsRemaining: graded.storedMs, timeLimitMs: LIMIT } as never))
            : null;
        cases.push({ puzzle, answer, ms, graded, view: so.checkStrikeoutMoves(puzzle.words, answer), reveal });
      }
    }
  }
}
const out = new URL("./fixtures/strikeout-legacy.json.gz", import.meta.url);
writeFileSync(out, gzipSync(JSON.stringify({ recordedFrom: process.argv[3] ?? root, cases })));
console.log(`wrote ${cases.length} Strikeout rev-1 cases`);
