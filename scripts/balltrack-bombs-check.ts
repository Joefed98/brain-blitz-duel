import { btDecode, btDrop, btReplay, type BtBoard, type BtEvent } from '../src/lib/duel/ballTrack';
import { BALL_TRACK_BANK } from '../src/lib/duel/ballTrackBank.server';
function assert(ok: boolean, message: string) { if (!ok) throw new Error(message); }
const board: BtBoard = { cols: 8, rows: 8, tiles: '0'.repeat(64), buckets: [0,1,2,3,4,5,6,7], bombs: [{cell:18,neighbour:19}], pairs: [[2,3]], gates: [] };
const drop = btDrop(board, board.tiles, [2,3]);
assert(drop.destroyed.includes(18) && drop.destroyed.includes(19) && drop.runs.every(r => !r.home), 'Both linked balls must see same-row blast');
const replay = btReplay(board, [{k:'d',ball:2},{k:'r',cell:18},{k:'r',cell:19},{k:'r',cell:8},{k:'r',cell:8},{k:'r',cell:8},{k:'r',cell:0}]);
assert(replay.rotations === 3 && replay.tiles === board.tiles, 'Burnt tiles/top row cannot rotate; cycle is three');
assert(replay.exploded.length === 1 && replay.runs[0]?.explosions.length === 1, 'One explosion per bomb');
const again = btDrop(board, board.tiles, [2], drop.destroyed, drop.exploded);
assert(again.runs[0]?.explosions.length === 0 && !again.runs[0]?.home, 'Burnt hole is persistent without re-exploding');
assert(btReplay(board, [{k:'d',ball:3}]).destroyed.join() === drop.destroyed.join(), 'Either pair member gives same damage');
let seed = 41;
const rand = (n:number) => { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n; };
for (const entry of BALL_TRACK_BANK) {
  const p: BtBoard = { ...entry, cols:8, rows:8 };
  const solution = btReplay(p, btDecode(entry.solutionEvents));
  assert(solution.home === 8 && solution.destroyed.length === 0, 'Safe solution');
  const events: BtEvent[] = Array.from({length:100},()=>rand(4) ? {k:'r',cell:rand(64)} : {k:'d',ball:rand(8)});
  const whole = btReplay(p, events);
  let tiles = p.tiles, destroyed:number[]=[], exploded:number[]=[], home=0, rotations=0;
  const dropped=new Set<number>();
  for (const event of events) {
    if (dropped.size===8) break;
    if(event.k==='r') {
      if(event.cell<8 || destroyed.includes(event.cell) || p.bombs?.some(b=>b.cell===event.cell)) continue;
      const chars=tiles.split('');chars[event.cell]=String((Number(chars[event.cell])+1)%3);tiles=chars.join('');rotations++;
    } else if(!dropped.has(event.ball)) {
      const balls=(p.pairs?.find(pair=>pair.includes(event.ball))??[event.ball]).filter(ball=>!dropped.has(ball));
      const next=btDrop(p,tiles,balls,destroyed,exploded);destroyed=next.destroyed;exploded=next.exploded;
      for(const run of next.runs){dropped.add(run.ball);if(run.home)home++;}
    }
  }
  assert(whole.tiles===tiles && whole.home===home && whole.rotations===rotations && whole.destroyed.join()===destroyed.join() && whole.exploded.join()===exploded.join(), 'Incremental play and replay differ');
}
console.log('Ball Track: 400/400 incremental/replay identities; paired blast, persistent holes, rotation guards and safe solutions passed.');
