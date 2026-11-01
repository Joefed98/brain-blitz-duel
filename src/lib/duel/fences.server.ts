/** STUB (skeleton): replaced by the real seeded generator and uniqueness solver. */
import { FENCES_SIZE, type FencesPuzzleData } from "./types";

export function generateFences(seed: number): FencesPuzzleData {
  void seed;
  return { type: "fences", fencesRev: 1, size: FENCES_SIZE, clues: new Array(FENCES_SIZE * FENCES_SIZE).fill(-1), solution: [] };
}
