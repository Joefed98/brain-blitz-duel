/**
 * Generates 200 Pipes boards and proves each one is solvable from the tiles a
 * phone is given: every scrambled tile can be turned into its solved side-set,
 * and the shared flood-fill check then passes on the server.
 */
import { encodeSides, pipesState, tileRotations, tileOpenings } from "../src/lib/duel/logic";
import { generatePipes, gradePipesBoard } from "../src/lib/duel/logic.server";
import { PIPES_CELLS } from "../src/lib/duel/types";

let minWrong = 1;
for (let board = 0; board < 200; board++) {
  const puzzle = generatePipes();
  const solution = puzzle.solution!;

  if (puzzle.tiles.length !== PIPES_CELLS) throw new Error("wrong tile count");

  // The solved side-sets really do solve the board.
  const solved = solution.map((sides) => ({ sides }));
  if (!pipesState(solved, puzzle.source).solved) throw new Error(`board ${board}: solution fails`);

  // Every scrambled tile can be rotated into its solved side-set.
  puzzle.tiles.forEach((tile, cell) => {
    if (!tileRotations(tile).includes(solution[cell]!)) {
      throw new Error(`board ${board}: tile ${cell} cannot reach its solved sides`);
    }
  });

  // The scrambled board is not already solved, and mostly starts wrong.
  if (pipesState(puzzle.tiles, puzzle.source).solved)
    throw new Error(`board ${board}: starts solved`);
  const wrong = puzzle.tiles.filter((tile, cell) => tileOpenings(tile) !== solution[cell]).length;
  minWrong = Math.min(minWrong, wrong / PIPES_CELLS);
  if (wrong / PIPES_CELLS < 0.8) throw new Error(`board ${board}: only ${wrong} tiles wrong`);

  // Grading the solved answer, exactly as a submission would arrive.
  const verdict = gradePipesBoard(puzzle.source, solved);
  if (!verdict.solved || verdict.connected !== PIPES_CELLS) {
    throw new Error(`board ${board}: grading rejected the solution`);
  }
  const decoded = encodeSides(solved);
  if (decoded.length !== PIPES_CELLS) throw new Error("bad encoding length");
}

console.log(`200 boards OK · lowest wrong-tile share ${(minWrong * 100).toFixed(0)}%`);
