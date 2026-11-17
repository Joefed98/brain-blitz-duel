/**
 * Curl Champ's Normal deal digest (the levels, 16 Nov 2026): 60 room deals of curling at Normal (the level-tune
 * sampler: `generatePuzzle` under the room seed's Math.random) and each dealt seed's starting state on curlRev 4, plus
 * curlRev 1–4's starting states on the first 20 seeds, hashed. Recorded on the session head before the levels
 * (58396e49) as NORMAL_DIGEST in curling-levels-check, which proves Normal is byte for byte as before.
 *
 *   bun scripts/curling-levels-digest.ts      prints the digest of this tree
 */
import { createHash } from "node:crypto";

import { curlingGameFor } from "../src/lib/arcade/curling";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { roomSeed } from "./arcade-skill-bands/games";

export function normalDigest(): string {
  const h = createHash("sha256");
  for (let n = 0; n < 60; n++) {
    const seed = roomSeed(n);
    const p = withSeededRandom(seed, () => generatePuzzle("curling", { bankSeed: seed }));
    h.update(JSON.stringify(p));
    const s = (p as { seed: number }).seed;
    h.update(JSON.stringify(curlingGameFor(4).init(s)));
  }
  for (let n = 0; n < 20; n++) {
    for (const rev of [1, 2, 3, 4]) h.update(JSON.stringify(curlingGameFor(rev).init(roomSeed(n))));
  }
  return h.digest("hex");
}

if (import.meta.main) console.log(normalDigest());
