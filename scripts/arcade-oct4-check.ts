import { strict as assert } from 'node:assert';
import { beatGame, BEAT_INPUT_TAP, BEAT_INPUT_RELEASE, BEAT_JUDGE_PERFECT, BEAT_JUDGE_GOOD, BEAT_JUDGE_MISS, type BeatState } from '@/lib/arcade/beat';
import { bubbleGame, BUB_COLS, BUB_START_ROWS, bubRowCols } from '@/lib/arcade/bubble';
import { hoverGame, hoverScroll, HOVER_RUN_TICKS, HOVER_WORLD_BOTTOM, HOVER_PILLAR_W, HOVER_DISC_X, HOVER_DISC_R } from '@/lib/arcade/hover';
import { matchupGame, MATCHUP_ROWS, MATCHUP_SIZE, MATCHUP_QUEUE_LEN, matchupHasLine, matchupFindSwap, matchupCellAt, matchupTransform, MATCHUP_BOARD_X, MATCHUP_BOARD_Y, MATCHUP_CELL_PX } from '@/lib/arcade/matchup';
import { crossGame, crossBlocked, crossColumnCentreFp } from '@/lib/arcade/cross';
import { burstGame, BURST_LIVES } from '@/lib/arcade/burst';
import { typesInCategory, allTypesInCategory } from '@/lib/duel/registry';

function hold(headError: number, tailError: number | null): BeatState {
  let s = beatGame.init(1);
  s = { ...s, chart: { ticks: [100], lanes: [0], holds: [30] }, judged: [0] };
  for (let t = 1; t <= 150; t++) {
    const k = t === 100 + headError ? BEAT_INPUT_TAP : tailError !== null && t === 130 + tailError ? BEAT_INPUT_RELEASE : null;
    s = beatGame.step(s, k === null ? null : { t, k, a: 0, b: 0, c: 0, d: 0 });
    if (t === 120) assert.equal(s.perfect + s.good + s.ok, 0, 'No head-only credit');
  }
  return s;
}
for (const [head, tail, expected] of [[0,0,BEAT_JUDGE_PERFECT],[3,-3,BEAT_JUDGE_PERFECT],[4,0,BEAT_JUDGE_GOOD],[-7,7,BEAT_JUDGE_GOOD],[0,-8,BEAT_JUDGE_MISS],[0,8,BEAT_JUDGE_MISS],[8,0,BEAT_JUDGE_MISS],[0,null,BEAT_JUDGE_MISS]] as const) {
  const s = hold(head, tail);
  assert.equal(s.judged[0], expected);
  assert.equal(s.holdsDone, expected === BEAT_JUDGE_MISS ? 0 : 1);
}
for (let seed = 1; seed <= 1000; seed++) {
  const h = hoverGame.init(seed);
  let distance = 0, gates = 0, last = 0;
  for (let t = 1; t <= HOVER_RUN_TICKS; t++) {
    distance += hoverScroll(gates);
    while (gates < h.pillars.length && distance > (h.pillars[gates]?.x0 ?? Infinity) + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R)) { gates++; last = t; }
  }
  assert.equal(gates, h.totalGates);
  assert(last >= HOVER_RUN_TICKS - 60, 'Gates continue through final second');
  for (let i = 1; i < h.totalGates - 12; i++) {
    const a = h.pillars[i-1], b = h.pillars[i];
    if (!a || !b) throw new Error('Missing gate');
    const third = (p: typeof a) => Math.floor((p.gapTop + p.gapH/2) * 3 / HOVER_WORLD_BOTTOM);
    assert(Math.abs(third(a)-third(b)) !== 2);
  }
  assert.equal(hoverGame.score({ ...h, gates: h.totalGates }), 100);
  const b = bubbleGame.init(seed), visited = new Set<number>();
  let occupied = 0;
  for (let r = 0; r < BUB_START_ROWS; r++) for (let c = 0; c < bubRowCols(r); c++) {
    const start = r * BUB_COLS + c;
    occupied++;
    if (visited.has(start)) continue;
    const group = [start]; visited.add(start);
    for (let i = 0; i < group.length; i++) {
      const index = group[i] ?? 0, row = Math.floor(index / BUB_COLS), col = index % BUB_COLS;
      const offsets = row % 2 ? [0,1] : [-1,0];
      for (const [nr,nc] of [[row,col-1],[row,col+1],...offsets.flatMap(d => [[row-1,col+d],[row+1,col+d]])]) {
        if (nr === undefined || nc === undefined || nr < 0 || nr >= BUB_START_ROWS || nc < 0 || nc >= bubRowCols(nr)) continue;
        const n = nr * BUB_COLS + nc;
        if (!visited.has(n) && b.grid[n] === b.grid[start]) { visited.add(n); group.push(n); }
      }
    }
    assert(group.length <= 5);
  }
  assert.equal(occupied, 67);
  if (seed <= 200) {
    const m = matchupGame.init(seed);
    assert.equal(m.cells.length, 56);
    assert.equal(m.queues.length, 7);
    assert(m.queues.every(q => q.length === MATCHUP_QUEUE_LEN));
    assert(!matchupHasLine(m.cells)); assert(matchupFindSwap(m.cells));
  }
}
for (const size of [{width:382,height:489},{width:367,height:456}]) {
  const {scale,offsetX,offsetY} = matchupTransform(size);
  assert.deepEqual(matchupCellAt(size, offsetX + (MATCHUP_BOARD_X + 6.5*MATCHUP_CELL_PX)*scale, offsetY + (MATCHUP_BOARD_Y + 7.5*MATCHUP_CELL_PX)*scale), {row:MATCHUP_ROWS-1,col:MATCHUP_SIZE-1});
}
let c = crossGame.init(1);
const lane = c.courses[0]?.lanes.findIndex(l => crossBlocked(l, crossColumnCentreFp(c.col), 1)) ?? -1;
assert(lane >= 0);
c = crossGame.step({ ...c, lane: lane+1, reached:lane+1, crossings:0 }, null);
assert.equal(c.lane,0); assert.equal(c.lives,2); assert.equal(c.crossings,0); assert.equal(c.reached,lane+1);
assert.equal(BURST_LIVES,2); assert.equal(burstGame.init(1).lives,2);
assert(!typesInCategory('arcade').includes('bastion'));
assert(allTypesInCategory('arcade').includes('bastion'));
console.log('Arcade tuning mechanics passed: 1,000 Hover/Bubble seeds, 200 rectangular Matchup boards, hold endpoints, crash respawn, lives and retirement. No browser tests.');