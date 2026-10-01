import { generateRings, innerRingsAligned } from "../src/lib/duel/rings.server";
import { replayRings, ringsMinMoves, RING_UNDO, RING_RESET } from "../src/lib/duel/rings";

const n = Number(process.argv[2] ?? 50);
let bad = 0;
let total = 0;
const mins: number[] = [];
for (let i = 0; i < n; i++) {
  const t = performance.now();
  const p = generateRings();
  total += performance.now() - t;
  const r = replayRings(p.segments, p.pattern, p.solution!);
  const again = ringsMinMoves(p.segments, p.pattern);
  const counts = [0, 0, 0, 0];
  p.segments.flat().forEach((c) => counts[c]!++);
  const undo = replayRings(p.segments, p.pattern, [0, RING_UNDO, 1, RING_RESET, ...p.solution!]);
  const ok =
    p.segments.length === 5 && counts.every((c) => c === 10) && r.solved && r.moves === p.minMoves &&
    again?.min === p.minMoves && p.minMoves! >= 7 && p.minMoves! <= 12 && !innerRingsAligned(p.segments) &&
    undo.solved && undo.moves === p.minMoves! + 2;
  if (!ok) bad++;
  mins.push(p.minMoves!);
}
console.log(`rings ${n} boards, bad ${bad}, avg ${(total / n).toFixed(0)} ms, min ${Math.min(...mins)}-${Math.max(...mins)}`);
