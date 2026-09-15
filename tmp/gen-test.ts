import { generateWordHunt } from "../src/lib/duel/wordHunt.server";
import { generateUnblock } from "../src/lib/duel/unblock.server";
import { generateBlockParty } from "../src/lib/duel/blockParty.server";
import { decodeMoves, replayUnblock } from "../src/lib/duel/unblock";
import { verifyPlacements } from "../src/lib/duel/blockParty";

let t = Date.now();
for (let i = 0; i < 6; i++) {
  const p = generateWordHunt();
  if (p.grid.length !== 16) throw new Error("grid size");
  if ((p.words?.length ?? 0) < 40) throw new Error("few words " + p.words?.length);
  if (i === 0) console.log(p.grid.join(""), p.words!.length, "words, par", p.par);
}
console.log("wordhunt ok", (Date.now() - t) / 6, "ms each");

t = Date.now();
for (let i = 0; i < 20; i++) {
  const p = generateUnblock();
  const sol = decodeMoves(p.solution ?? "");
  const r = replayUnblock(p.vehicles, sol);
  if (!r.solved) throw new Error("solution does not solve");
  if (sol.length !== p.minMoves) throw new Error(`min mismatch ${sol.length} vs ${p.minMoves}`);
}
console.log("unblock ok", (Date.now() - t) / 20, "ms each");

t = Date.now();
for (let i = 0; i < 6; i++) {
  const p = generateBlockParty();
  const v = verifyPlacements(p.blockers, p.solution ?? []);
  if (!v.solved) throw new Error("solution invalid");
  if (p.blockers.length !== 7) throw new Error("blockers");
  if (i === 0) console.log("solutions", p.solutions, "blockers", p.blockers.join(","));
}
console.log("blockparty ok", (Date.now() - t) / 6, "ms each");
