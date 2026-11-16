import { generatePuzzle } from "../src/lib/duel/generate.server";
import { kakuroPersonSolve } from "../src/lib/duel/kakuro.server";
import { withSeededRandom } from "../src/lib/duel/random";
for (const level of ["easy","normal","expert"] as const) {
  const rs: number[] = []; let maxR = 0, sumMax = 0, ok = 0;
  for (let i = 0; i < 15; i++) { const p: any = withSeededRandom(i+1, () => generatePuzzle("kakuro", { bankSeed: i+1, ...(level!=="normal"?{level}:{}) }));
    const r = kakuroPersonSolve(p); if (r.solved) ok++; const m = Math.max(...p.white.map((c:number)=>r.round[c])); sumMax += m; maxR = Math.max(maxR,m); for (const c of p.white) rs.push(r.round[c]); }
  rs.sort((a,b)=>a-b); console.log(level, "solved", ok, "avg round", (rs.reduce((a,b)=>a+b,0)/rs.length).toFixed(2), "avg max", (sumMax/15).toFixed(1), "max", maxR);
}
