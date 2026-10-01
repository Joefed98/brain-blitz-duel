import { generateGravity, gravityMinimum, lockInteractions } from "../src/lib/duel/gravity.server";
import { decodeGravityTilts, replayGravity, tilt, GRAVITY_DIRS } from "../src/lib/duel/gravity";
import { GRAV_MIN_WALLS, GRAV_MAX_WALLS } from "../src/lib/duel/types";

const n = Number(process.argv[2] ?? 30);
let total = 0;
let bad = 0;
const mins: number[] = [];
for (let i = 0; i < n; i++) {
  const t = performance.now();
  const p = generateGravity();
  total += performance.now() - t;
  const walls = new Set(p.walls);
  const sol = decodeGravityTilts(p.solution!);
  const r = replayGravity(p.walls, p.starts, p.targets, sol);
  const again = gravityMinimum(walls, p.starts, p.targets);
  const firstLock = GRAVITY_DIRS.some((d) => tilt(walls, p.starts, p.targets, d).locked.length);
  const ok =
    r.solved && r.tilts === p.minMoves && again?.minMoves === p.minMoves &&
    p.minMoves! >= 8 && p.minMoves! <= 14 && !firstLock &&
    p.walls.length >= GRAV_MIN_WALLS && p.walls.length <= GRAV_MAX_WALLS &&
    lockInteractions(walls, p.starts, p.targets, sol) >= 2 && new Set([...p.starts, ...p.targets, ...p.walls]).size === 8 + p.walls.length;
  if (!ok) bad++;
  mins.push(p.minMoves!);
}
console.log(`gravity ${n} boards, bad ${bad}, avg ${(total / n).toFixed(0)} ms, min tilts ${Math.min(...mins)}-${Math.max(...mins)}`);
