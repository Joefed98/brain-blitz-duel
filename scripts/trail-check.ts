import { TRAIL_BANK } from "../src/lib/duel/trailBank.server";
import { scoreTrail, trComplete, trCountSolutions, trCorrectPrefix, trCorrectTiles, trDecode, trEncode, trSlots, trTapPath, trUndoPlayer, trCanStep, trDragPath } from "../src/lib/duel/trail";
import { TRAIL_TIME_MS } from "../src/lib/duel/types";
import { gradeSubmission } from "../src/lib/duel/grade";
let bad = 0;
const seen = new Set<string>();
for (const e of TRAIL_BANK) {
  const n = e.givens.filter((g) => g != null).length;
  if (n !== 10 || e.givens[e.solution[0] ?? -1] !== 1 || e.givens[e.solution[35] ?? -1] !== 36) bad++;
  if (!trComplete(e.givens, e.solution) || trCountSolutions(e.givens, 2) !== 1) bad++;
  if (trCorrectPrefix(e.solution.slice(0, 20), e.solution) !== 20) bad++;
  if (trCorrectTiles(e.givens, e.solution, e.solution) !== 26) bad++;
  const playerSteps = e.solution.map((c, i) => e.givens[c] == null ? i : -1).filter((i) => i >= 0);
  const early = playerSteps[0];
  const late = playerSteps[playerSteps.length - 1];
  if (early === undefined || late === undefined) throw new Error("Missing player tiles");
  const wrong = [...e.solution];
  const earlyCell = wrong[early];
  const lateCell = wrong[late];
  if (earlyCell === undefined || lateCell === undefined) throw new Error("Missing cells");
  wrong[early] = lateCell;
  wrong[late] = earlyCell;
  if (trCorrectTiles(e.givens, wrong, e.solution) !== 24 || trComplete(e.givens, wrong)) bad++;
  if (scoreTrail(false, 0, TRAIL_TIME_MS, trCorrectTiles(e.givens, wrong, e.solution)) !== 120) bad++;
  const puzzle = { type: "trail" as const, givens: e.givens, solution: e.solution };
  const graded = gradeSubmission(puzzle, trEncode(wrong), TRAIL_TIME_MS);
  if (graded.score !== 120 || graded.correctCount !== 24 || graded.isCorrect) bad++;
  const empty = trSlots(e.givens, []);
  if (trCorrectTiles(e.givens, empty, e.solution) !== 0 || trComplete(e.givens, empty)) bad++;
  if (trEncode(trDecode(trEncode(empty))) !== trEncode(empty)) bad++;
   let tapped = e.solution.slice(0, 1);
   for (const step of playerSteps) {
     const cell = e.solution[step];
     if (cell === undefined) throw new Error("Missing tap cell");
     const next = trTapPath(e.givens, tapped, cell);
     if (!next || trEncode(next) !== trEncode(e.solution.slice(0, next.length))) { bad++; break; }
     const undone = trTapPath(e.givens, next, cell);
     if (!undone || trEncode(undone) !== trEncode(trUndoPlayer(e.givens, next))) bad++;
     if (undone && trEncode(trTapPath(e.givens, undone, cell) ?? []) !== trEncode(next)) bad++;
     for (const fixed of e.solution.filter((c) => e.givens[c] != null)) {
       if (trTapPath(e.givens, next, fixed) !== null) bad++;
     }
     for (const earlier of next.slice(0, step)) {
       if (trTapPath(e.givens, next, earlier) !== null) bad++;
     }
     tapped = next;
   }
   if (!trComplete(e.givens, tapped)) bad++;
   // Alternate real drag steps and taps, including fixed-number boundaries.
   let mixed = e.solution.slice(0, 1);
   while (mixed.length < 36) {
     const cell = e.solution[mixed.length];
     if (cell === undefined) throw new Error("Missing mixed cell");
     if (mixed.length % 2 === 0 || e.givens[cell] != null) {
       if (!trCanStep(e.givens, mixed, cell)) { bad++; break; }
       mixed = [...mixed, cell];
     } else {
       const next = trTapPath(e.givens, mixed, cell);
       if (!next) { bad++; break; }
       mixed = next;
     }
   }
   if (!trComplete(e.givens, mixed)) bad++;
   for (let c = 0; c < 36; c++) {
     if (!trCanStep(e.givens, e.solution.slice(0, early), c) && e.givens[c] == null) {
       if (trTapPath(e.givens, e.solution.slice(0, early), c) !== null) bad++;
     }
   }
  if (trEncode(trDragPath(e.givens, e.solution)) !== trEncode(e.solution)) bad++;
  for (let length = 1; length <= 36; length++) {
    const partial = e.solution.slice(0, length);
    const expected = partial.filter((c) => e.givens[c] == null).length;
    if (trCorrectTiles(e.givens, partial, e.solution) !== expected) bad++;
  }
  for (const ms of [0, TRAIL_TIME_MS / 2, TRAIL_TIME_MS]) {
    if (scoreTrail(true, ms, TRAIL_TIME_MS, 26) !== 130 + Math.round(20 * ms / TRAIL_TIME_MS)) bad++;
    const full = gradeSubmission(puzzle, trEncode(e.solution), ms);
    if (full.score !== 130 + Math.round(20 * ms / TRAIL_TIME_MS) || !full.isCorrect || full.correctCount !== 26) bad++;
  }
  seen.add(e.solution.join("."));
}
if (TRAIL_BANK.length !== 300) bad++;
console.log(`checked ${TRAIL_BANK.length} trails, distinct ${seen.size}, problems ${bad}; half time = ${scoreTrail(true, TRAIL_TIME_MS / 2, TRAIL_TIME_MS, 26)}, 18 right = ${scoreTrail(false, 0, TRAIL_TIME_MS, 18)}`);
if (bad) throw new Error(`${bad} Trail regression failures`);
