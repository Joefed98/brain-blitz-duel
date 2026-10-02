import { inkSingleLineDrop } from "../src/lib/arcade/inkBridge";
let s=12345; const r=(n:number)=>{s=(s*1103515245+12345)&0x7fffffff;return s%n;};
const stats:Record<string,[number,number]>={vertical:[0,0],horizontal:[0,0],angled:[0,0]};
let worst=Infinity;
for(let i=0;i<500;i++){
  const kind=i<200?"vertical":i<400?"horizontal":"angled";
  const cx=100+r(190), cy=200+r(250), L=40+r(160);
  let line:[number,number,number,number];
  if(kind==="vertical") line=[cx,cy-L/2|0,cx,cy+L/2|0];
  else if(kind==="horizontal") line=r(2)?[cx-L/2|0,cy,cx+L/2|0,cy]:[cx+L/2|0,cy,cx-L/2|0,cy];
  else {const a=r(360)*Math.PI/180; line=[cx-Math.cos(a)*L/2|0,cy-Math.sin(a)*L/2|0,cx+Math.cos(a)*L/2|0,cy+Math.sin(a)*L/2|0];}
  // Drop from above, aimed so the fall meets the line; vertical lines get sideways speed toward them.
  const vx = kind==="vertical" ? (r(2)?1:-1)*(1+r(12)) : r(9)-4;
  const sx = kind==="vertical" ? cx - Math.sign(vx)*(10+r(60)) : cx + r(L)-L/2;
  const res=inkSingleLineDrop(sx|0, 30+r(100), vx, line);
  stats[kind]![0]++; if(res.crossed) stats[kind]![1]++;
  worst=Math.min(worst,res.minDist);
}
console.log(JSON.stringify(stats),"closest centre-to-line distance px",worst.toFixed(2));
