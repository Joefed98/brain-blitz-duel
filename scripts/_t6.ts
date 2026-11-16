import { generateFloodLevel } from "../src/lib/duel/floodLevels.server";
import { gameLevelSettings } from "../src/lib/levels/gameLevels";
const l=process.argv[2] as any; for(let i=0;i<3;i++){const t=Date.now(); const p=generateFloodLevel(gameLevelSettings("flood",l) as any); console.log(l,Date.now()-t,"ms par",p.par);}
