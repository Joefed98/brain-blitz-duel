import { generateMaze } from "../src/lib/duel/maze.server";
import { mazeTurns } from "../src/lib/duel/maze";
const t:number[]=[];const t0=Date.now();
for(let i=0;i<60;i++){const m=generateMaze();t.push(mazeTurns(m.solution!));}
t.sort((a,b)=>a-b);console.log("median",t[30],"min",t[0],"max",t.at(-1),"ms/maze",(Date.now()-t0)/60);
