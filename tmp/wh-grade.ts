import { generateWordHunt, gradeWordHunt, checkWordHuntPath } from "../src/lib/duel/wordHunt.server";

const p = generateWordHunt();
const best = p.words!.slice(0, 6);
const answer = best.map((w) => `${w.word}:${w.path.join("-")}`).join(",");
const graded = gradeWordHunt(p, answer, 30_000);
console.log("board", p.grid.join(""), "par", p.par);
console.log("sent", best.map((w) => w.word).join(","), "→ score", graded.score, "correct", graded.isCorrect, graded.extra);
// A forged path (non-adjacent cells) must be rejected.
console.log("forged:", checkWordHuntPath(p.grid, [0, 15, 3, 12], []));
// A duplicate must be rejected.
const dup = gradeWordHunt(p, `${answer},${best[0]!.word}:${best[0]!.path.join("-")}`, 30_000);
console.log("dup score equal:", dup.score === graded.score, dup.correctCount, graded.correctCount);
