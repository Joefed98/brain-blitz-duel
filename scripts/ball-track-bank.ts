/** Precompute 400 answer-first 8×8 Ball Track boards.
 * Every entry stores a deterministic minimum-cost intended drop plan. Balls may
 * be rerouted between drops; linked pairs share one pipe state. */
import { writeFileSync } from 'node:fs';
import { BT_COLS, BT_ROWS, btReplay, type BtBoard, type BtEvent } from '../src/lib/duel/ballTrack';

let seed = 0x82b4c7;
const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const pick = (n: number) => Math.floor(random() * n);
const shuffle = <T>(xs: T[]) => { for (let i=xs.length-1;i>0;i--){const j=pick(i+1);[xs[i],xs[j]]=[xs[j]!,xs[i]!]} return xs; };
const digit = (d:number) => d === 1 ? '1' : d === -1 ? '2' : '0';
const delta = (a:string,b:string) => (Number(b)-Number(a)+3)%3;

type Constraint = Map<number,string>;
type Group = { balls:number[]; need:Constraint };
interface Entry { tiles:string; buckets:number[]; blocks:number[]; pairs:[number,number][]; gates:{cell:number;colour:number}[]; min:number; solution:string; solutionEvents:string }

function derangement(){ let p:number[]; do p=shuffle([...Array(8).keys()]); while(p.some((x,i)=>x===i)); return p; }
function targetByBall(buckets:number[]){const t=Array(8).fill(0);buckets.forEach((b,c)=>t[b]=c);return t;}
function pathOne(ball:number,target:number,blocks:Set<number>,base:string):Constraint|null{
  type S={r:number;c:number;cost:number;need:Constraint}; let states:S[]=[{r:0,c:ball,cost:0,need:new Map()}];
  for(let r=0;r<BT_ROWS;r++){
    const next:S[]=[];
    for(const s of states) for(const d of shuffle([-1,0,1])){
      const nc=s.c+d, cell=r*8+s.c; if(nc<0||nc>=8||blocks.has(cell)||Math.abs(target-nc)>BT_ROWS-r-1) continue;
      const n=new Map(s.need); const v=digit(d); n.set(cell,v); next.push({r:r+1,c:nc,cost:s.cost+delta(base[cell]!,v),need:n});
    }
    next.sort((a,b)=>a.cost-b.cost); states=next.slice(0,80);
  }
  return states.find(s=>s.c===target)?.need??null;
}
function pathPair(a:number,b:number,ta:number,tb:number,blocks:Set<number>,base:string):Constraint|null{
  type S={r:number;a:number;b:number;cost:number;need:Constraint}; let states:S[]=[{r:0,a,b,cost:0,need:new Map()}];
  for(let r=0;r<BT_ROWS;r++){
    const next:S[]=[];
    for(const s of states) for(const da of [-1,0,1]) for(const db of [-1,0,1]){
      const na=s.a+da, nb=s.b+db, ca=r*8+s.a, cb=r*8+s.b;
      if(na<0||na>=8||nb<0||nb>=8||blocks.has(ca)||blocks.has(cb)||Math.abs(ta-na)>BT_ROWS-r-1||Math.abs(tb-nb)>BT_ROWS-r-1)continue;
      if(ca===cb&&da!==db)continue;
      const n=new Map(s.need); const va=digit(da),vb=digit(db); n.set(ca,va);n.set(cb,vb);
      next.push({r:r+1,a:na,b:nb,cost:s.cost+(ca===cb?delta(base[ca]!,va):delta(base[ca]!,va)+delta(base[cb]!,vb)),need:n});
    }
    next.sort((x,y)=>x.cost-y.cost); states=next.slice(0,500);
  }
  return states.find(s=>s.a===ta&&s.b===tb)?.need??null;
}
function orderCost(groups:Group[],start:string){
  let best:{cost:number;order:number[];states:string[]}|null=null;
  const visit=(order:number[],left:number[],state:string,cost:number,states:string[])=>{
    if(best&&cost>=best.cost)return;
    if(!left.length){best={cost,order:[...order],states:[...states]};return;}
    for(const i of left){const chars=state.split('');let add=0;for(const [cell,v] of groups[i]!.need){add+=delta(chars[cell]!,v);chars[cell]=v}visit([...order,i],left.filter(x=>x!==i),chars.join(''),cost+add,[...states,chars.join('')]);}
  }; visit([],groups.map((_,i)=>i),start,0,[]); return best;
}
const entries:Entry[]=[]; const seen=new Set<string>();
for(let attempt=0;entries.length<400&&attempt<2_000_000;attempt++){
  const buckets=derangement(), targets=targetByBall(buckets);
  const pairBalls=shuffle([...Array(8).keys()]).slice(0,4); const pairs:[[number,number],[number,number]]=[[pairBalls[0]!,pairBalls[1]!],[pairBalls[2]!,pairBalls[3]!]];
  const paired=new Set(pairBalls); const groupsBalls=[...pairs.map(p=>[...p]),...[...Array(8).keys()].filter(b=>!paired.has(b)).map(b=>[b])];
  const blockCount=4+pick(3), blocks=new Set<number>(); while(blocks.size<blockCount)blocks.add(pick(64));
  const base=Array.from({length:64},()=>String(pick(3))).join(''); const groups:Group[]=[]; let failed=false;
  for(const balls of groupsBalls){
    const need=balls.length===2?pathPair(balls[0]!,balls[1]!,targets[balls[0]!]!,targets[balls[1]!]!,blocks,base):pathOne(balls[0]!,targets[balls[0]!]!,blocks,base);
    if(!need){failed=true;break} groups.push({balls,need});
  }
  if(failed)continue;
  const occupiedBy=new Map<number,number[]>(); groups.forEach(g=>g.balls.forEach(ball=>g.need.forEach((_,cell)=>occupiedBy.set(cell,[...(occupiedBy.get(cell)??[]),ball]))));
  const gateBalls=shuffle([...Array(8).keys()]).slice(0,2); const gates:{cell:number;colour:number}[]=[];
  for(const ball of gateBalls){const own=groups.find(g=>g.balls.includes(ball))!;const choices=[...own.need.keys()].filter(cell=>(occupiedBy.get(cell)??[]).every(x=>x===ball)&&!gates.some(g=>g.cell===cell));if(!choices.length){failed=true;break}gates.push({cell:choices[pick(choices.length)]!,colour:ball});}
  if(failed)continue;
  const validGroups=groups.every(g=>g.balls.every(ball=>[...g.need.keys()].every(cell=>{const gate=gates.find(x=>x.cell===cell);return !gate||gate.colour===ball})));
  if(!validGroups)continue;
  let start=base.split(''); for(const cell of blocks)start[cell]='0';
  // Scramble a small deterministic set of live cells so the stored plan lands in 12–20 rotations.
  for(let i=0;i<8;i++){const cell=pick(64);if(!blocks.has(cell))start[cell]=String((Number(start[cell])+1+pick(2))%3)}
  const best=orderCost(groups,start.join('')); if(!best||best.cost<12||best.cost>20)continue;
  const events:BtEvent[]=[];let state=start.join('');for(let k=0;k<best.order.length;k++){const next=best.states[k]!;for(let cell=0;cell<64;cell++)if(!blocks.has(cell)){const n=delta(state[cell]!,next[cell]!);for(let j=0;j<n;j++)events.push({k:'r',cell})}events.push({k:'d',ball:groups[best.order[k]!]!.balls[0]!});state=next}
  const board:BtBoard={cols:8,rows:8,tiles:start.join(''),buckets,blocks:[...blocks].sort((a,b)=>a-b),pairs,gates}; const replay=btReplay(board,events);
  if(replay.home!==8||replay.rotations!==best.cost||replay.dropped.length!==8)continue;
  const key=board.tiles+buckets.join('')+board.blocks.join(',')+JSON.stringify(pairs)+JSON.stringify(gates);if(seen.has(key))continue;seen.add(key);
  entries.push({tiles:board.tiles,buckets:board.buckets,blocks:board.blocks??[],pairs,gates,min:best.cost,solution:state,solutionEvents:events.map(e=>e.k==='r'?`r${e.cell}`:`d${e.ball}`).join(',')});
}
if(entries.length!==400)throw Error(`Only built ${entries.length} boards`);
const output=`/** Generated by scripts/ball-track-bank.ts; do not hand-edit. */\nexport interface BallTrackBankEntry { tiles:string; buckets:number[]; blocks:number[]; pairs:[number,number][]; gates:{cell:number;colour:number}[]; min:number; solution:string; solutionEvents:string }\nexport const BALL_TRACK_BANK: BallTrackBankEntry[] = ${JSON.stringify(entries)};\n`;
writeFileSync('src/lib/duel/ballTrackBank.server.ts',output);
console.log(`Ball Track: ${entries.length} boards; rotations ${Math.min(...entries.map(e=>e.min))}–${Math.max(...entries.map(e=>e.min))}`);
