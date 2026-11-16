import { floodLevelMinimum, floodLevelCycleBest } from "../src/lib/duel/floodLevels.server";
import * as M from "../src/lib/duel/floodLevels.server";
import { gameLevelSettings } from "../src/lib/levels/gameLevels";
import { randomBelow, shuffled } from "../src/lib/duel/random";
const l=process.argv[2] as any; const lv:any={...gameLevelSettings("flood",l),...(process.argv[4]?{cols:+process.argv[4],rows:+process.argv[5]}:{})};
function rg(cols:number,rows:number,colours:number){const cells=cols*rows;const g=Array.from({length:cells},()=>randomBelow(colours));for(let p=0;p<Number(process.argv[3]??2);p++)for(const c of shuffled(Array.from({length:cells},(_,i)=>i))){if(randomBelow(100)>=45)continue;const r=Math.floor(c/cols),k=c%cols;const ns=[k>0?c-1:-1,k<cols-1?c+1:-1,r>0?c-cols:-1,r<rows-1?c+cols:-1].filter(i=>i>=0);g[c]=g[ns[randomBelow(ns.length)]!]!;}return g;}
const t=Date.now(); const pars:any[]=[]; const cyc:any[]=[];
for(let i=0;i<20;i++){const g=rg(lv.cols,lv.rows,lv.colours);const s=floodLevelMinimum(g,lv.cols,40);pars.push(s?.par??"x"); cyc.push(s?floodLevelCycleBest(g,lv.cols,lv.colours,s.par+6):"-");}
console.log(l,(Date.now()-t)/20,"ms",pars.join(" "),"| cyc",cyc.join(" "));
