/** Precompute 400 answer-first 8×8 Ball Track boards. */
import { writeFileSync } from "node:fs";
import { BT_COLS, BT_ROWS, btReplay, type BtBoard, type BtEvent } from "../src/lib/duel/ballTrack";

let seed = 0x82b4c7;
const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const pick = (n: number) => Math.floor(random() * n);
const shuffle = <T>(xs: T[]) => { for (let i = xs.length - 1; i > 0; i--) { const j = pick(i + 1); [xs[i], xs[j]] = [xs[j] as T, xs[i] as T]; } return xs; };
const delta = (a: string, b: string) => (Number(b) - Number(a) + 5) % 5;

type Constraint = Map<number, string>;
type Group = { balls: number[]; need: Constraint };
interface Entry { tiles: string; buckets: number[]; blocks: number[]; pairs: [number, number][]; gates: {cell:number; colour:number}[]; min:number; solution:string; solutionEvents:string }
interface RouteState { row:number; col:number; cost:number; need:Constraint; usedShallow:boolean }

function derangement() { let p:number[]; do p = shuffle([...Array(8).keys()]); while (p.some((x, i) => x === i)); return p; }
function targetByBall(buckets:number[]) { const t = Array(8).fill(0); buckets.forEach((b, c) => { t[b] = c; }); return t; }
function pathOne(ball:number, target:number, blocks:Set<number>, base:string, requireShallow:boolean, locked:Constraint):Constraint|null {
  let states:RouteState[] = [{ row:0, col:ball, cost:0, need:new Map(), usedShallow:false }];
  for (let row=0; row<BT_ROWS; row++) {
    const next:RouteState[]=[];
    for (const state of states) {
      const cell=row*BT_COLS+state.col;
      if(blocks.has(cell))continue;
      const moves=row===0?[{shift:0, cells:[[cell,"0"]] as [number,string][]}] : [
        {shift:0,cells:[[cell,"0"]] as [number,string][]},
        {shift:1,cells:[[cell,"1"]] as [number,string][]},
        {shift:-1,cells:[[cell,"3"]] as [number,string][]},
        {shift:1,cells:[[cell,"2"],[cell+1,"0"]] as [number,string][]},
        {shift:-1,cells:[[cell,"4"],[cell-1,"0"]] as [number,string][]},
      ];
      for(const move of moves){
        if(move.cells.some(([at,value])=>locked.has(at)&&locked.get(at)!==value))continue;
        const col=state.col+move.shift;
        if(col<0||col>=BT_COLS||blocks.has(row*BT_COLS+col)||Math.abs(target-col)>BT_ROWS-row-1)continue;
        const need=new Map(state.need);let valid=true,add=0;
        for(const [at,value] of move.cells){const prior=need.get(at);if(prior!==undefined&&prior!==value){valid=false;break;}need.set(at,value);add+=prior===undefined?delta(base[at]??"0",value):0;}
        if(valid)next.push({row:row+1,col,cost:state.cost+add,need,usedShallow:state.usedShallow||move.cells.length>1});
      }
    }
    next.sort((a,b)=>a.cost-b.cost+(a.usedShallow===b.usedShallow?0:a.usedShallow?-2:2));states=next.slice(0,120);
  }
  const done=states.filter(s=>s.col===target&&(!requireShallow||s.usedShallow)).sort((a,b)=>a.cost-b.cost);
  return done[0]?.need??null;
}
function pathPair(a:number, b:number, ta:number, tb:number, blocks:Set<number>, base:string, locked:Constraint):Constraint|null {
  type S = { r:number; a:number; b:number; cost:number; need:Constraint };
  let states:S[] = [{ r:0, a, b, cost:0, need:new Map() }];
  for (let r = 0; r < BT_ROWS; r++) {
    const next:S[] = [];
    for (const s of states) for (const da of [-1,0,1]) for (const db of [-1,0,1]) {
      const na=s.a+da, nb=s.b+db, ca=r*8+s.a, cb=r*8+s.b;
      if (r === 0 && (da !== 0 || db !== 0)) continue;
      if (na<0||na>=8||nb<0||nb>=8||blocks.has(ca)||blocks.has(cb)||Math.abs(ta-na)>BT_ROWS-r-1||Math.abs(tb-nb)>BT_ROWS-r-1) continue;
      if (ca===cb&&da!==db) continue;
      const va=String(da===1?1:da===-1?3:0), vb=String(db===1?1:db===-1?3:0);
      if((locked.has(ca)&&locked.get(ca)!==va)||(locked.has(cb)&&locked.get(cb)!==vb))continue;
      const need=new Map(s.need);
      need.set(ca,va); need.set(cb,vb);
      next.push({r:r+1,a:na,b:nb,cost:s.cost+(ca===cb?delta(base[ca]??"0",va):delta(base[ca]??"0",va)+delta(base[cb]??"0",vb)),need});
    }
    next.sort((x,y)=>x.cost-y.cost); states=next.slice(0,500);
  }
  return states.find((s)=>s.a===ta&&s.b===tb)?.need??null;
}
function orderCost(groups:Group[], start:string) {
  let best:{cost:number;order:number[];states:string[]}|null=null;
  const visit=(order:number[],left:number[],state:string,cost:number,states:string[])=>{
    if (best && cost >= best.cost) return;
    if (!left.length) { best={cost,order:[...order],states:[...states]}; return; }
    for (const i of left) { const chars=state.split(""); let add=0; const group=groups[i]; if (!group) continue; for(const [cell,v] of group.need){add+=delta(chars[cell]??"0",v);chars[cell]=v;} visit([...order,i],left.filter(x=>x!==i),chars.join(""),cost+add,[...states,chars.join("")]); }
  };
  visit([],groups.map((_,i)=>i),start,0,[]); return best;
}

const entries:Entry[]=[]; const seen=new Set<string>();
for(let attempt=0;entries.length<400&&attempt<2_000_000;attempt++){
  const buckets=derangement(), targets=targetByBall(buckets);
  const chosen=shuffle([...Array(8).keys()]).slice(0,4).sort((a,b)=>a-b);
  const nested=pick(2)===1;
  const rawPairs=nested?[[chosen[0],chosen[3]],[chosen[1],chosen[2]]]:[[chosen[0],chosen[1]],[chosen[2],chosen[3]]];
  if(rawPairs.some((pair)=>pair.some((value)=>value===undefined)))continue;
  const pairs=rawPairs.map((pair)=>[pair[0] as number,pair[1] as number] as [number,number]);
  const paired=new Set(chosen), groupsBalls=[...pairs.map(p=>[...p]),...[...Array(8).keys()].filter(b=>!paired.has(b)).map(b=>[b])];
  const blockCount=4+pick(3), blocks=new Set<number>(); while(blocks.size<blockCount)blocks.add(BT_COLS+pick(BT_COLS*(BT_ROWS-1)));
  const base="0".repeat(64); const groups:Group[]=[]; const locked:Constraint=new Map(); let failed=false;
  let singleIndex=0;
  for(const balls of groupsBalls){
    const a=balls[0]; if(a===undefined){failed=true;break;}
    const need=balls.length===2?pathPair(a,balls[1] as number,targets[a] as number,targets[balls[1] as number] as number,blocks,base,locked):pathOne(a,targets[a] as number,blocks,base,singleIndex++===0,locked);
    if(!need){failed=true;break;} need.forEach((value,cell)=>locked.set(cell,value)); groups.push({balls,need});
  }
  if(failed)continue;
  const occupiedBy=new Map<number,number[]>(); groups.forEach(g=>g.balls.forEach(ball=>g.need.forEach((_,cell)=>occupiedBy.set(cell,[...(occupiedBy.get(cell)??[]),ball]))));
  const gateBalls=shuffle([...Array(8).keys()]).slice(0,2), gates:{cell:number;colour:number}[]=[];
  for(const ball of gateBalls){const own=groups.find(g=>g.balls.includes(ball));if(!own){failed=true;break;}const choices=[...own.need.keys()].filter(cell=>cell>=BT_COLS&&(occupiedBy.get(cell)??[]).every(x=>x===ball)&&!gates.some(g=>g.cell===cell));if(!choices.length){failed=true;break;}gates.push({cell:choices[pick(choices.length)] as number,colour:ball});}
  if(failed)continue;
  if(!groups.every(g=>g.balls.every(ball=>[...g.need.keys()].every(cell=>{const gate=gates.find(x=>x.cell===cell);return !gate||gate.colour===ball;}))))continue;
  const solved=base.split("");locked.forEach((value,cell)=>{solved[cell]=value;});const start=[...solved];for(const cell of blocks)start[cell]="0";
  for(let i=0;i<8;i++){const cell=BT_COLS+pick(BT_COLS*(BT_ROWS-1));if(!blocks.has(cell))start[cell]=String(1+pick(4));}
  const best=orderCost(groups,start.join("")); if(!best||best.cost<12||best.cost>20)continue;
  const events:BtEvent[]=[];let state=start.join("");for(let k=0;k<best.order.length;k++){const next=best.states[k];const group=groups[best.order[k] as number];if(!next||!group){failed=true;break;}for(let cell=BT_COLS;cell<64;cell++)if(!blocks.has(cell)){const n=delta(state[cell]??"0",next[cell]??"0");for(let j=0;j<n;j++)events.push({k:"r",cell});}events.push({k:"d",ball:group.balls[0] as number});state=next;}
  if(failed)continue;
  const board:BtBoard={cols:8,rows:8,tiles:start.join(""),buckets,blocks:[...blocks].sort((a,b)=>a-b),pairs,gates}, replay=btReplay(board,events);
  if(replay.home!==8||replay.rotations!==best.cost||replay.dropped.length!==8||!state.slice(BT_COLS).split("").some(v=>v==="2"||v==="4"))continue;
  const key=board.tiles+buckets.join("")+board.blocks?.join(",")+JSON.stringify(pairs)+JSON.stringify(gates);if(seen.has(key))continue;seen.add(key);
  entries.push({tiles:board.tiles,buckets:board.buckets,blocks:board.blocks??[],pairs,gates,min:best.cost,solution:state,solutionEvents:events.map(e=>e.k==="r"?`r${e.cell}`:`d${e.ball}`).join(",")});
}
if(entries.length!==400)throw Error(`Only built ${entries.length} boards`);
const output=`/** Generated by scripts/ball-track-bank.ts; do not hand-edit. */\nexport interface BallTrackBankEntry { tiles:string; buckets:number[]; blocks:number[]; pairs:[number,number][]; gates:{cell:number;colour:number}[]; min:number; solution:string; solutionEvents:string }\nexport const BALL_TRACK_BANK: BallTrackBankEntry[] = ${JSON.stringify(entries)};\n`;
writeFileSync("src/lib/duel/ballTrackBank.server.ts",output);
console.log(`Ball Track: ${entries.length} boards; rotations ${Math.min(...entries.map(e=>e.min))}–${Math.max(...entries.map(e=>e.min))}`);
