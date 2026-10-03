import { btExit, btInit, btStep, btCellMap, btBallPoint, BT_K_WHEEL, BT_K_SLIDE, BT_SLIDE_TICKS, BT_HOPPER_COL, N, type BtCourse } from '../src/lib/arcade/ballTrack';

const assert = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
for (const slot of [0, 1]) {
  const course: BtCourse = { trays: [0,1,2,3,4,-1,-1], balls: Array(15).fill(0), pipes: [], flippers: [], sliders: [{row: 2,col: 1,len: 4,slot,pos: 0}], wheels: [{cell: 28,pocket: 0}] };
  const map = btCellMap(course);
  let s = btInit(course);
  for (let sub = 0; sub < 4; sub++) {
    const target = btExit(course,map,s,15+sub,N).target;
    const expected = 22 + (sub < 2 ? slot : sub);
    assert(target === expected, `slot ${slot}, track offset ${sub}: ${target} != ${expected}`);
  }
  s = btStep(course,map,s,{t:1,k:BT_K_SLIDE,a:0,b:2,c:0,d:0});
  for (let t=0;t<BT_SLIDE_TICKS;t++) s=btStep(course,map,s,null);
  assert(btExit(course,map,s,17+(1-slot),N).target === 24+slot, 'Moved bar does not deflect to its hole');
  const acw = btStep(course,map,btInit(course),{t:1,k:BT_K_WHEEL,a:0,b:0,c:0,d:0});
  const cw = btStep(course,map,btInit(course),{t:1,k:BT_K_WHEEL,a:0,b:1,c:0,d:0});
  assert(acw.whPocket[0]===3 && cw.whPocket[0]===1,'Wheel direction failed');
  const point=btBallPoint(course,s,{id:0,colour:0,cell:-1,from:-1,arrived:0,at:0,target:BT_HOPPER_COL,entry:N,inlet:N,held:-1});
  assert(point.x===350,'Hopper must centre on column 4');
}
console.log('Ball Track: solid/open/uncovered slider routing, settled slide, both wheel directions and centred hopper passed');