import { buildLevelScale, personSolveScale } from "../src/lib/duel/balanceLevels.server";
import { withSeededRandom } from "../src/lib/duel/random";
const specs:any[] = [{loose:3,fixed:1,pegs:10,unique:true},{loose:4,fixed:2,pegs:10,unique:true},{loose:5,fixed:2,pegs:10,unique:true},{loose:5,fixed:3,pegs:10,unique:true},{loose:6,fixed:2,pegs:10,unique:false},{loose:6,fixed:1,pegs:10,unique:false}];
for (const sp of specs) for (const person of [false,true]) {
  const t0=performance.now(); let ok=0; const trials:number[]=[];
  for (let s=0;s<5;s++) { const b = withSeededRandom(100+s, ()=>buildLevelScale(sp, person)); if (b) { ok++; trials.push(personSolveScale(b.scale, 100000) ?? -1);} }
  console.log(JSON.stringify(sp), person, ok, Math.round((performance.now()-t0)/5)+"ms each", trials.join(","));
}
