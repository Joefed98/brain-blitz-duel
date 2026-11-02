/**
 * arcade-standard-check's entry for `alleyroll` (Alley Roll alleyRollRev 1, Sports; docs/arcade-standard/alleyroll.md):
 * born on the standard. Perfect runs are the oracle's nine pockets through the server's replay (the lane is the same
 * for every seed); the core is ring points on a straight line, full at AR_CORE_FULL (the elite median); 100
 * pockets 10 each up to 3; hot streak 4 a ball up to 5.
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { AR_CORE_FULL, alleyRollGame, alleyRollStdParts, arInit, type ArBall, type ArState } from "../../src/lib/arcade/alleyroll";
import { alleyRollOracleRun } from "../alleyroll-oracle";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.alleyroll!.spec!;
const rec = (s: ArState) => Object.fromEntries((alleyRollStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: ArState) => Object.fromEntries((alleyRollStdParts(s) ?? []).map((p) => [p.key, p.max]));
const ball = (points: number): ArBall => ({ release: 0, points, x: 0, y: 0 });

/** `v` ring points from 10s and 30s alternating with a 0 between, so no streak and no pocket. */
function coreOnly(v: number): ArState {
  const balls: ArBall[] = [];
  let left = v;
  while (left > 0) {
    const p = left >= 30 ? 30 : left >= 20 ? 20 : 10;
    balls.push(ball(p));
    left -= p;
    if (left < 0) balls[balls.length - 1] = ball(p + left);
  }
  const s = arInit(1);
  return { ...s, balls, acted: 1, ended: 1 };
}

export const entry: StdEntry = {
  type: "alleyroll",
  field: "alleyRollRev",
  rev: 1,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [1, 2, 77, 10000, 123456789].map((seed) => {
      const r = alleyRollOracleRun(seed).result;
      return { label: `seed ${seed}'s oracle run through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "nine balls in the gutter", score: alleyRollGame.score({ ...arInit(4), acted: 1, ended: 1, balls: Array.from({ length: 9 }, () => ball(0)) }), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: alleyRollGame.score(arInit(12)) }],
  help: { terms: ["ring points", "40 or more"] },
  extra(ok) {
    // The core's straight line on ring points (10s, 20s and 30s, never two 40s running, no pockets).
    let straight = true;
    for (let v = 0; v <= AR_CORE_FULL + 30; v += 10) {
      const parts = alleyRollStdParts(coreOnly(v))!;
      if (parts[0]!.points !== Math.floor((150 * Math.min(v, AR_CORE_FULL)) / AR_CORE_FULL) || parts[1]!.points !== 0 || parts[2]!.points !== 0) straight = false;
    }
    ok(straight, `alleyroll: the core is floor(150 × min(ring points, ${AR_CORE_FULL}) ÷ ${AR_CORE_FULL}), no feature from 10s, 20s and 30s`);
    const parts = (pts: number[]) => alleyRollStdParts({ ...arInit(1), acted: 1, ended: 1, balls: pts.map(ball) })!;
    ok(parts([100, 0, 100, 0, 100, 0, 100]).map((p) => p.points)[1] === 30, "alleyroll: pockets 10 each, held to 30");
    ok(parts([40, 50, 0, 40, 40]).map((p) => p.points)[2] === 8 && parts([50, 50, 50, 50, 50, 50, 50, 50, 50])[2]!.points === 20, "alleyroll: hot streak 4 for each 40+ ball after a 40+ ball, held to 20");
    ok(parts([30, 40, 50])[2]!.points === 4, "alleyroll: a 30 before a 40 starts no streak");
  },
};
