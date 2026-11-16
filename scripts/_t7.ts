import { generateNonogramLevel } from "../src/lib/duel/nonogram.server";
import { gameLevelSettings } from "../src/lib/levels/gameLevels";
const l=process.argv[2] as any; const t=Date.now(); let p:any; for(let i=0;i<5;i++) p=generateNonogramLevel(gameLevelSettings("nonogram",l) as any); console.log(l,(Date.now()-t)/5,"ms");
const w=p.cols.length; for(let r=0;r<p.rows.length;r++) console.log(p.pattern.slice(r*w,r*w+w).map((b:boolean)=>b?"#":".").join(""));
