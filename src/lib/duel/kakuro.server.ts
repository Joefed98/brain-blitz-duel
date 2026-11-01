/** STUB (skeleton): replaced by the real seeded generator and uniqueness solver. */
import { KAKURO_SIZE, type KakuroPuzzleData } from "./types";

export function generateKakuro(seed: number): KakuroPuzzleData {
  void seed;
  return { type: "kakuro", kakuroRev: 1, size: KAKURO_SIZE, white: [], clues: [], solution: [] };
}
