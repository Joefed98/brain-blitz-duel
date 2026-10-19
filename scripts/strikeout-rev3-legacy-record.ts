/**
 * Records scripts/fixtures/strikeout-rev3-legacy.json.gz: Strikeout rev-3
 * rounds (`strikeoutRev: 3`, ten strikes, three vowel guesses) graded by a
 * tree that predates strikeoutRev 4 (twelve strikes, 19 Oct 2026), so
 * strikeout-check can prove stored rev-3 rounds grade, store, live-check and
 * show exactly as before. Run it against an unmodified checkout of the commit
 * before the change (recorded on main 8d1651b):
 *
 *   bun scripts/strikeout-rev3-legacy-record.ts <path to that tree> [label, e.g. "main 8d1651b"]
 *
 * Each case: the rev-2 puzzle as that tree generated it (and without its
 * puzzleScoreRev / speedPar stamps), an answer (empty, the kit's spam, the four
 * fairness solver levels and their intermediate states, a third and fourth
 * vowel, nine to thirteen strikes, refused, wrong-length, wrong-word and
 * malformed solves) and a time left; recorded: the whole Graded result, the
 * live-check reply and (at half time) the reveal's markup drawn from the
 * stored answer.
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
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
for (const seed of [11, 202, 3003, 40004, 500005, 6006006, 77, 8128]) {
  const stamped = gen.generatePuzzle("strikeout", { bankSeed: seed });
  if (stamped.strikeoutRev !== 3) throw new Error(`seed ${seed}: not a rev-3 puzzle (run this on the tree before strikeoutRev 4)`);
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
  const gv = stamped.givens as string[];
  const misses = (k: number, n: number) => [...ALPHA].filter((l) => !w[k]!.includes(l) && !"AEIOU".includes(l)).slice(0, n).map((l) => `${k}${l}`);
  const solveAll = w.map((x, i) => `${i}${x}`);
  // Vowels: a fourth and fifth vowel on word 1 (refused under rev 3), then the rest.
  answers.add(["0A", "0E", "0I", "0O", "0U", ...solveAll].join(","));
  // Strikes: nine, then a finish (rev 3's minimum finish); ten ends it; eleven and twelve with solves after
  // (past rev 3's limit, inside rev 4's), and thirteen.
  answers.add([...misses(0, 9), ...solveAll].join(","));
  answers.add([...misses(0, 10), ...solveAll].join(","));
  answers.add([...misses(0, 5), solveAll[0], ...misses(1, 6), ...solveAll.slice(1)].join(","));
  answers.add([...misses(0, 6), solveAll[0], ...misses(1, 6), ...solveAll.slice(1)].join(","));
  answers.add([...misses(0, 4), solveAll[0], ...misses(1, 4), solveAll[1], ...misses(2, 5), ...solveAll.slice(2)].join(","));
  answers.add([...misses(0, 2), solveAll[0], ...misses(1, 3), solveAll[1], ...misses(2, 2), ...solveAll.slice(2)].join(","));
  answers.add([...solveAll.slice(0, 3), ...misses(3, 13), solveAll[3]].join(","));
  // Every starting letter guessed (ignored), wrong-length, non-word, wrong word, other-word and malformed actions.
  answers.add([...[...new Set([...gv[0]!].filter((c) => c !== "_"))].map((c) => `0${c}`), `0${w[0]!.slice(1)}`, "0QZXJVWKQ", "0QZXJVWK".slice(0, w[0]!.length + 1), `1${w[1]}`, `0${w[1]!.length === w[0]!.length ? w[1] : w[0]!.split("").reverse().join("")}`, "9ABCDEFG", " 0e ", ",,", ...solveAll, "4Q"].join(","));
  answers.add(solveAll.map((x) => x.toLowerCase()).join(" , "));
  for (const puzzle of [stamped, noScoreRev, legacy]) {
    for (const answer of answers) {
      for (const ms of [0, 30_000, LIMIT / 2, 80_000, LIMIT]) {
        const graded = gen.gradeAnswer(puzzle, answer, ms);
        const reveal =
          ms === LIMIT / 2
            ? renderToStaticMarkup(createElement(strikeoutPuzzle.Reveal, { puzzle, myAnswer: graded.answer, myMsRemaining: graded.storedMs, timeLimitMs: LIMIT } as never))
            : null;
        cases.push({ puzzle, answer, ms, graded, view: so.checkStrikeoutMoves(puzzle, answer), reveal });
      }
    }
  }
}
const out = new URL("./fixtures/strikeout-rev3-legacy.json.gz", import.meta.url);
writeFileSync(out, gzipSync(JSON.stringify({ recordedFrom: process.argv[3] ?? root, cases })));
console.log(`wrote ${cases.length} Strikeout rev-3 cases`);
