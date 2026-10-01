import { generateIceSlide, routeUsesFeatures } from "../src/lib/duel/slide.server";
import { decodeSlideMoves, replaySlide, slideBoard, slideSearch } from "../src/lib/duel/slide";

const n = Number(process.argv[2] ?? 30);
let total = 0;
let bad = 0;
const mins: number[] = [];
for (let i = 0; i < n; i++) {
  const t = performance.now();
  const p = generateIceSlide();
  total += performance.now() - t;
  const board = slideBoard(p);
  const route = decodeSlideMoves(p.solution!);
  const r = replaySlide(board, route);
  const again = slideSearch(board);
  const uses = routeUsesFeatures(p, route);
  const ok =
    r.solved && r.moves === p.minMoves && again?.min === p.minMoves &&
    p.minMoves! >= 18 && p.minMoves! <= 26 && uses.portal && uses.cracked &&
    (p.thin?.length ?? 0) >= 3 && (p.thin?.length ?? 0) <= 5 &&
    (p.portals?.length ?? 0) >= 1 && (p.portals?.length ?? 0) <= 2;
  if (!ok) bad++;
  mins.push(p.minMoves!);
}
console.log(`iceslide ${n} boards, bad ${bad}, avg ${(total / n).toFixed(0)} ms, min ${Math.min(...mins)}-${Math.max(...mins)}`);
