import { generateTubesLevel } from "../src/lib/duel/tubes.server";
import { gameLevelSettings } from "../src/lib/levels/gameLevels";
const l=process.argv[2] as any; const t=Date.now(); const m:number[]=[]; for(let i=0;i<3;i++) m.push(generateTubesLevel(gameLevelSettings("tubes",l) as any).minMoves); console.log(l,(Date.now()-t)/3,"ms",m);
