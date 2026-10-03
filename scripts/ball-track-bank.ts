/** Precompute 400 answer-first 8×8 Ball Track boards. */
import { writeFileSync } from "node:fs";
import { btReplay, type BtBoard, type BtEvent } from "../src/lib/duel/ballTrack";
let seed=0x82b4c7;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const pick=(n:number)=>Math.floor(random()*n);
const shuffle=<T>(xs:T[])=>{for(let i=xs.length-1;i>0;i--){const j=pick(i+1);[xs[i],xs[j]]=[xs[j] as T,xs[i] as T];}return xs;};
const delta=(a:string,b:string)=>(Number(b)-Number(a)+3)%3;
type Need=Map<number,string>;
type Group={balls:number[];need:Need};
interface Entry{tiles:string;buckets:number[];bombs:{cell:number;neighbour:number}[];pairs:[number,number][];gates:{cell:number;colour:number}[];min:number;solution:string;solutionEvents:string}
function adjacentDerangement(){const buckets=Array(8).fill(0);for(let i=0;i<8;i+=2){if(pick(2)){buckets[i]=i+1;buckets[i+1]=i;}else{buckets[i]=i+1;buckets[i+1]=i;}}return buckets;}
function targets(buckets:number[]){const out=Array(8).fill(0);buckets.forEach((ball,col)=>{out[ball]=col;});return out;}
function route(ball:number,target:number,row:number):Need{
 const need:Need=new Map();for(let r=0;r<8;r++)need.set(r*8+(r>row?target:ball),"0");
 const dir=target>ball?1:-1;
 if(shallow){need.set(row*8+ball,dir>0?"2":"4");need.set(row*8+target,"0");}
 else need.set(row*8+ball,dir>0?"1":"2");
 return need;
}
function merge(a:Need,b:Need){const out=new Map(a);for(const [cell,value] of b){const prior=out.get(cell);if(prior!==undefined&&prior!==value)return null;out.set(cell,value);}return out;}
function orderCost(groups:Group[],start:string){let best:{cost:number;order:number[];states:string[]}|null=null;const visit=(order:number[],left:number[],state:string,cost:number,states:string[])=>{if(best&&cost>=best.cost)return;if(!left.length){best={cost,order:[...order],states:[...states]};return;}for(const i of left){const group=groups[i];if(!group)continue;const chars=state.split("");let add=0;for(const [cell,value] of group.need){add+=delta(chars[cell]??"0",value);chars[cell]=value;}visit([...order,i],left.filter(x=>x!==i),chars.join(""),cost+add,[...states,chars.join("")]);}};visit([],groups.map((_,i)=>i),start,0,[]);return best;}
const entries:Entry[]=[];const seen=new Set<string>();
for(let attempt=0;entries.length<400&&attempt<200000;attempt++){
 const buckets=adjacentDerangement(),target=targets(buckets),chosen=shuffle([...Array(8).keys()]).slice(0,4).sort((a,b)=>a-b),nested=pick(2)===1;
 const pairs=(nested?[[chosen[0],chosen[3]],[chosen[1],chosen[2]]]:[[chosen[0],chosen[1]],[chosen[2],chosen[3]]]) as [number,number][];
 if(pairs.some(([a,b])=>a===undefined||b===undefined))continue;
 const paired=new Set(chosen),groupBalls=[...pairs.map(p=>[...p]),...[...Array(8).keys()].filter(b=>!paired.has(b)).map(b=>[b])];
 const routeRows=shuffle([1,2,3,4,5,6,1,2]);const allRoutes=new Map<number,Need>();for(let ball=0;ball<8;ball++)allRoutes.set(ball,route(ball,target[ball] as number,routeRows[ball] as number));
 const groups:Group[]=[];let failed=false;for(const balls of groupBalls){let need=allRoutes.get(balls[0] as number);if(!need){failed=true;break;}if(balls.length===2){const other=allRoutes.get(balls[1] as number);if(!other){failed=true;break;}const joined=merge(need,other);if(!joined){failed=true;break;}need=joined;}groups.push({balls,need});}if(failed)continue;
 const used=new Set<number>();allRoutes.forEach(r=>r.forEach((_,cell)=>used.add(cell)));const free=shuffle([...Array(56).keys()].map(x=>x+8).filter(cell=>!used.has(cell)));const blocks:number[]=[];for(const cell of free){const row=Math.floor(cell/8),col=cell%8;if(row<2||row>5||col<1||col>6||blocks.some(b=>Math.abs(Math.floor(b/8)-row)+Math.abs(b%8-col)<=1))continue;blocks.push(cell);if(blocks.length===4)break;}if(blocks.length!==4)continue;
 const gateBalls=shuffle([...Array(8).keys()]).slice(0,2),gates:{cell:number;colour:number}[]=[];for(const ball of gateBalls){const cells=[...(allRoutes.get(ball)?.keys()??[])].filter(cell=>cell>=16&&cell<48&&!gates.some(g=>g.cell===cell));const cell=cells[pick(cells.length)];if(cell===undefined){failed=true;break;}gates.push({cell,colour:ball});}if(failed)continue;
 const solution=Array(64).fill("0");groups.forEach(g=>g.need.forEach((v,c)=>{solution[c]=v;}));const start=[...solution];let scramble=12+pick(9),guard=0;while(scramble>0&&guard++<200){const cell=8+pick(56);if(blocks.includes(cell)||!used.has(cell))continue;const amount=Math.min(scramble,1+pick(Math.min(2,scramble)));start[cell]=String((Number(start[cell])+3-amount)%3);scramble-=amount;}if(scramble)continue;
 const best=orderCost(groups,start.join(""));if(!best||best.cost<12||best.cost>20)continue;
 const events:BtEvent[]=[];let state=start.join("");for(let k=0;k<best.order.length;k++){const next=best.states[k],group=groups[best.order[k] as number];if(!next||!group){failed=true;break;}for(let cell=8;cell<64;cell++){if(blocks.includes(cell))continue;const turns=delta(state[cell]??"0",next[cell]??"0");for(let j=0;j<turns;j++)events.push({k:"r",cell});}events.push({k:"d",ball:group.balls[0] as number});state=next;}if(failed)continue;
 const bombs=blocks.map(cell=>{const neighbours=[cell-8,cell+8,cell-1,cell+1].filter(n=>!blocks.includes(n)&&!gates.some(g=>g.cell===n));return {cell,neighbour:neighbours[pick(neighbours.length)] as number};});if(bombs.some(b=>b.neighbour===undefined))continue;
  const board:BtBoard={cols:8,rows:8,tiles:start.join(""),buckets,bombs,pairs,gates},replay=btReplay(board,events);if(replay.home!==8||replay.rotations!==best.cost||replay.dropped.length!==8)continue;
 const key=board.tiles+blocks.join(",")+JSON.stringify(pairs)+JSON.stringify(gates);if(seen.has(key))continue;seen.add(key);entries.push({tiles:board.tiles,buckets,bombs,pairs,gates,min:best.cost,solution:state,solutionEvents:events.map(e=>e.k==="r"?`r${e.cell}`:`d${e.ball}`).join(",")});
}
if(entries.length!==400)throw Error(`Only built ${entries.length} boards`);
writeFileSync("src/lib/duel/ballTrackBank.server.ts",`/** Generated by scripts/ball-track-bank.ts; do not hand-edit. */\nexport interface BallTrackBankEntry { tiles:string; buckets:number[]; bombs:{cell:number;neighbour:number}[]; pairs:[number,number][]; gates:{cell:number;colour:number}[]; min:number; solution:string; solutionEvents:string }\nexport const BALL_TRACK_BANK: BallTrackBankEntry[] = ${JSON.stringify(entries)};\n`);
console.log(`Ball Track: ${entries.length} boards; rotations ${Math.min(...entries.map(e=>e.min))}–${Math.max(...entries.map(e=>e.min))}`);
