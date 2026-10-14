/**
 * Records Roundabout's stored-round fixture (scripts/fixtures/letterwheel-legacy.json.gz) from an
 * unmodified checkout of main from before wheelRev 1 (14 Oct 2026), using that tree's own modules:
 *
 *   bun scripts/letterwheel-legacy-record.ts <main checkout> scripts/fixtures/letterwheel-legacy.json.gz
 *
 * 24 room seeds × 3 stamp variants (puzzleScoreRev 1, unstamped score shape, no speedPar either) ×
 * 12 answers × 4 times left: the grade, the definition's check and (at 50 s left) the reveal markup.
 * scripts/letterwheel-check.ts grades every case on today's tree and compares. Not a check itself.
 */
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
const root = process.argv[2]!;
const { generatePuzzle, gradeAnswer } = await import(`${root}/src/lib/duel/generate.server.ts`);
const { withSeededRandom } = await import(`${root}/src/lib/duel/random.ts`);
const { createElement } = await import(`${root}/node_modules/react/index.js`);
const { renderToStaticMarkup } = await import(`${root}/node_modules/react-dom/server.node.js`);
const { letterWheelPuzzle } = await import(`${root}/src/puzzles/letterWheel.tsx`);
const cases: unknown[] = [];
for (let seed = 7001; seed <= 7024; seed++) {
  const stamped = withSeededRandom(seed, () => generatePuzzle("letterwheel", { bankSeed: seed }));
  const variants = [
    stamped,
    (() => {
      const { puzzleScoreRev: _a, ...rest } = stamped;
      return rest;
    })(),
    (() => {
      const { puzzleScoreRev: _a, speedPar: _b, ...rest } = stamped;
      return rest;
    })(),
  ];
  const w: string[] = stamped.words;
  const answers = [
    "",
    w.join(","),
    w.slice(0, -1).join(","),
    w.slice(0, 3).join(","),
    [...w, "QQQ", "ZZZZ"].join(","),
    w.map((x) => x.toLowerCase()).join(","),
    [w[0], w[0], w[1]].join(","),
    ["XYZ", "ABC", w[2]].join(","),
    [...w].reverse().join(" , "),
    w.slice(1).join(","),
    "NOTAWORD,AB,A1B2,",
    w.slice(0, 5).join(",") + ",junk,more",
  ];
  for (const puzzle of variants)
    for (const answer of answers)
      for (const ms of [0, 50_000, 73_000, 100_000]) {
        const g = gradeAnswer(puzzle, answer, ms);
        const reveal =
          ms === 50_000
            ? renderToStaticMarkup(
                createElement(letterWheelPuzzle.Reveal, {
                  puzzle,
                  myAnswer: answer,
                  myCorrect: g.isCorrect,
                  myReactionAvgMs: null,
                  myMsRemaining: ms,
                  timeLimitMs: 100_000,
                }),
              )
            : undefined;
        cases.push({
          puzzle,
          answer,
          ms,
          reveal,
          check: letterWheelPuzzle.check(answer, puzzle),
          g: {
            score: g.score,
            isCorrect: g.isCorrect,
            correctCount: g.correctCount,
            errors: g.errors,
            extra: g.extra,
            storedMs: g.storedMs,
            answer: g.answer,
          },
        });
      }
}
writeFileSync(process.argv[3]!, gzipSync(JSON.stringify(cases)));
console.log("recorded", cases.length);
