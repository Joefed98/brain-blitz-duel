import { cluesForRect, countNonoSolutions, nonoLogicSolve } from "../src/lib/duel/nonogram";
import { randomBelow } from "../src/lib/duel/random";
const w=+process.argv[2], h=+process.argv[3], share=+process.argv[4];
let uniq=0, line=0, two=0, none=0, tUniq=0, tLogic=0; const N=200;
for(let a=0;a<N;a++){const p=new Array(w*h).fill(false);const half=Math.ceil(w/2);const target=Math.round(w*h*share);let f=0;
const set=(r:number,c:number)=>{for(const cc of [c,w-1-c]){const i=r*w+cc;if(!p[i]){p[i]=true;f++;}}};
for(let g=0;f<target&&g<400;g++){const r=randomBelow(h),c=randomBelow(half),len=2+randomBelow(4);if(randomBelow(3)===0)for(let k=0;k<len&&r+k<h;k++)set(r+k,c);else for(let k=0;k<len&&c+k<half;k++)set(r,c+k);}
const {rows,cols}=cluesForRect(p,w,h); if(!rows.every(c=>c.length)||!cols.every(c=>c.length))continue;
let t=Date.now(); const ls=nonoLogicSolve(rows,cols,false).solved; const ps=ls?true:nonoLogicSolve(rows,cols,true).solved; tLogic+=Date.now()-t;
if(ls){line++;continue;} if(ps){two++;continue;} none++;}
console.log({line,two,none,tLogic});
