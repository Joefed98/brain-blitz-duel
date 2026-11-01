/** STUB (skeleton): replaced by the real seeded generator and uniqueness solver. */
import { BRIDGES_SIZE, type BridgesPuzzleData } from "./types";

export function generateBridges(seed: number): BridgesPuzzleData {
  void seed;
  return { type: "bridges", bridgesRev: 1, size: BRIDGES_SIZE, islands: [], solution: [] };
}
