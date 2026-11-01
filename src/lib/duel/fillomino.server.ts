/** STUB (skeleton): replaced by the real seeded generator and uniqueness solver. */
import { FILLOMINO_SIZE, type FillominoPuzzleData } from "./types";

export function generateFillomino(seed: number): FillominoPuzzleData {
  void seed;
  return { type: "fillomino", fillominoRev: 1, size: FILLOMINO_SIZE, givens: new Array(FILLOMINO_SIZE * FILLOMINO_SIZE).fill(0), solution: [] };
}
