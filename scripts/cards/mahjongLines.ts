/**
 * Person-like Mahjong lines (scripts only, never shipped; D6's Expert deal list, scripts/mahjong-expert-deals.ts): a line
 * takes, each turn, the free pair that frees most tiles (twice the tiles it frees plus half the layers of the pair, the
 * skill-band bot's own value), with a little seeded noise between near-equal pairs. A deal is forgiving when at least
 * `need` of `lines` such lines clear it without a shuffle.
 */
import { mahjongFree, mahjongLayoutOf, mahjongMoves } from "../../src/lib/arcade/mahjong";

const zOf = (face: readonly number[], slot: number) => mahjongLayoutOf(face).slots[slot]!.z;

function freed(face: readonly number[], pair: readonly [number, number]): number {
  const after = face.slice();
  after[pair[0]] = -1;
  after[pair[1]] = -1;
  let n = 0;
  for (let i = 0; i < face.length; i++) if (after[i]! >= 0 && !mahjongFree(face, i) && mahjongFree(after, i)) n += 1;
  return n;
}

function lcg(x: number): () => number {
  let s = x >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}

/** True when at least `need` of `lines` noisy freeing-first lines clear the board without a shuffle. */
export function mahjongForgiving(face: readonly number[], seed: number, lines = 8, need = lines): boolean {
  const u = lcg(seed);
  let failed = 0;
  for (let l = 0; l < lines; l++) {
    const f = face.slice();
    let dead = false;
    for (let k = 0; k < 400; k++) {
      if (f.every((v) => v < 0)) break;
      const moves = mahjongMoves(f);
      if (!moves.length) {
        dead = true;
        break;
      }
      let best = moves[0]!;
      let bestV = -Infinity;
      for (const m of moves) {
        const v = freed(f, m) * 2 + (zOf(f, m[0]) + zOf(f, m[1])) / 2 + u() * 1.5;
        if (v > bestV) {
          bestV = v;
          best = m;
        }
      }
      f[best[0]] = -1;
      f[best[1]] = -1;
    }
    if (dead || !f.every((v) => v < 0)) failed++;
    if (failed > lines - need) return false;
  }
  return true;
}
