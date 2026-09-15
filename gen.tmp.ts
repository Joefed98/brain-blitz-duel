import { mirrorMatchPuzzle } from "@/puzzles/mirrorMatch";
import { spinPuzzle } from "@/puzzles/spin";
import { orientations, shapeKey, normalise, toPts } from "@/lib/duel/shapes";
let axes:any={vertical:0,horizontal:0}, tc:any={cw:0,half:0,ccw:0,flip:0}, flipOr:any={};
for (let i=0;i<400;i++){
  const m:any=mirrorMatchPuzzle.generate();
  if(m.items.length!==3) throw new Error("items");
  for(const it of m.items){ axes[it.axis]++; if(new Set(it.candidates.map(shapeKey)).size!==4) throw new Error("dupe cand"); }
  m.answers.forEach((a:number,k:number)=>{ if(m.kinds[k][a]!=="correct") throw new Error("kind"); });
  const s:any=spinPuzzle.generate();
  if(s.items.length!==8) throw new Error("spin items");
  for(const t of ["cw","half","ccw","flip"]) if(!s.answers.includes(t)) throw new Error("missing "+t);
  let st=1; for(let j=1;j<8;j++){ st = s.answers[j]===s.answers[j-1]?st+1:1; if(st>2) throw new Error("streak"); }
  s.answers.forEach((t:string,k:number)=>{ tc[t]++;
    const o=orientations(s.items[k].target).map(shapeKey);
    if(new Set(o).size!==8) throw new Error("not 8 distinct");
    const idx=o.indexOf(shapeKey(s.items[k].shown));
    if(idx<0) throw new Error("shown not an orientation");
    if(t==="cw"&&idx!==1) throw new Error("cw idx"+idx);
    if(t==="half"&&idx!==2) throw new Error("half");
    if(t==="ccw"&&idx!==3) throw new Error("ccw");
    if(t==="flip"){ if(idx<4) throw new Error("flip idx"+idx); flipOr[idx]=(flipOr[idx]||0)+1; }
    const cells=s.items[k].target.cells.length; if(cells<6||cells>7) throw new Error("cells "+cells);
    if(new Set(s.items[k].target.colours).size<2) throw new Error("colours");
  });
}
console.log("OK", axes, tc, "flip orientations:", flipOr);
