/** Colour Flood-only generation, minimum-par and actual server replay/scoring check. */
import { generateFlood, floodMinMoves, FLOOD_BANK, FLOOD_BANK_SIZE } from "../src/lib/duel/flood.server";
import { encodeFloodMoves, replayFlood } from "../src/lib/duel/flood";
import { gradeSubmission } from "../src/lib/duel/grade";
import { scoreFlood } from "../src/lib/duel/scoring";
import { FLOOD_CELLS, FLOOD_SIZE, FLOOD_TIME_MS, FLOOD_MIN_PAR, FLOOD_MAX_PAR } from "../src/lib/duel/types";

let failures = 0;
const pars: number[] = [];
const check = (label: string, ok: boolean) => { if (!ok) { failures++; console.error(label); } };
check("full bank", FLOOD_BANK.length === FLOOD_BANK_SIZE);
check("distinct boards", new Set(FLOOD_BANK.map(p => p.grid.join(","))).size === FLOOD_BANK_SIZE);
const selected = generateFlood();
check("selection uses bank", FLOOD_BANK.some(p => p.grid.join(",") === selected.grid.join(",")));
for (const puzzle of FLOOD_BANK) {
  const solution = puzzle.solution ?? [];
  pars.push(puzzle.par);
  check("14×14 board", FLOOD_SIZE === 14 && puzzle.grid.length === FLOOD_CELLS);
  check("proved par", puzzle.par >= FLOOD_MIN_PAR && puzzle.par <= FLOOD_MAX_PAR && floodMinMoves(puzzle.grid, puzzle.par)?.par === puzzle.par);
  check("no shorter solution", floodMinMoves(puzzle.grid, puzzle.par - 1) === null);
  const replay = replayFlood(puzzle.grid, solution);
  check("par route solves", replay.solved && replay.moves === puzzle.par && replay.region === 196);
  for (const ms of [0, FLOOD_TIME_MS / 2, FLOOD_TIME_MS]) {
    const grade = gradeSubmission(puzzle, encodeFloodMoves(solution), ms);
    check("server grading matches replay", grade.isCorrect && grade.correctCount === replay.region && grade.score === scoreFlood(true, replay.moves, puzzle.par, replay.region, ms));
  }
  const partial = replayFlood(puzzle.grid, solution.slice(0, 2));
  const grade = gradeSubmission(puzzle, encodeFloodMoves(solution.slice(0, 2)), 0);
  check("partial server replay", !grade.isCorrect && grade.score === scoreFlood(false, partial.moves, puzzle.par, partial.region, 0));
}
console.log(`Colour Flood: ${FLOOD_BANK.length} bank boards · exactly proven par ${Math.min(...pars)}–${Math.max(...pars)} · 60 s · ${failures} failures`);
if (failures) process.exit(1);