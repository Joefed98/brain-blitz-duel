/**
 * arcade-standard-check's entry for `alleyroll` (Ringer, alleyRollRev 2, Sports; docs/arcade-standard/alleyroll.md):
 * on the standard since rev 1 (Alley Roll). Perfect runs are the oracle's three gold cups, two pockets and four 50s
 * through the server's replay (the gold cup's path from each seed); the core is ring points on a straight line, full at
 * AR2_CORE_FULL (the near-perfect median); gold cup 10 a hit up to 3; roll streak 4 a ball up to 5; pocket hits 5 each
 * up to 2. Rev 1's rounds keep their three parts exactly (asserted in `extra`).
 */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import {
  AR2_CORE_FULL, AR_CORE_FULL, alleyRollGameFor, alleyRollStdParts, arInit, arInitV2, type ArBall, type ArState,
} from "../../src/lib/arcade/alleyroll";
import { ringerOracleRun } from "../ringer-oracle";
import type { StdEntry } from "./entry";

const spec = ARCADE_STANDARD.alleyroll!.spec!;
const rec = (s: ArState) => Object.fromEntries((alleyRollStdParts(s) ?? []).map((p) => [p.key, p.points]));
const maxes = (s: ArState) => Object.fromEntries((alleyRollStdParts(s) ?? []).map((p) => [p.key, p.max]));
const ball = (points: number): ArBall => ({ release: 0, points, x: 0, y: 0 });
const ringer = (pts: number[]): ArState => ({ ...arInitV2(1), acted: 1, ended: 1, balls: pts.map(ball) });

/** `v` ring points from 10s and 20s with a 0 between each, so no streak, no pocket and no gold cup. */
function coreOnly(v: number): ArState {
  const balls: ArBall[] = [];
  let left = v;
  while (left > 0) {
    const p = left >= 20 ? 20 : 10;
    balls.push(ball(p), ball(0));
    left -= p;
  }
  return { ...arInitV2(1), balls, acted: 1, ended: 1 };
}

export const entry: StdEntry = {
  type: "alleyroll",
  field: "alleyRollRev",
  rev: 2,
  before: 1,
  parts: spec.parts,
  spec,
  liveSpec: true,
  perfect: () =>
    [1, 2, 77, 10000, 123456789].map((seed) => {
      const r = ringerOracleRun(seed).result;
      return { label: `seed ${seed}'s oracle run through the server replay`, score: r.score, parts: rec(r.state), partMaxes: maxes(r.state) };
    }),
  played: () => [{ label: "nine balls in the gutter", score: alleyRollGameFor(2).score(ringer(Array.from({ length: 9 }, () => 0))), want: 1 }],
  idle: () => [{ label: "an untouched init(12)", score: alleyRollGameFor(2).score(arInitV2(12)) }],
  help: { terms: ["cups", "30 or more"] },
  extra(ok) {
    // The core's straight line on ring points (10s and 20s between 0s: no feature).
    let straight = true;
    for (let v = 0; v <= AR2_CORE_FULL + 40; v += 10) {
      const parts = alleyRollStdParts(coreOnly(v))!;
      if (parts[0]!.points !== Math.floor((140 * Math.min(v, AR2_CORE_FULL)) / AR2_CORE_FULL) || parts.slice(1).some((p) => p.points !== 0)) straight = false;
    }
    ok(straight, `alleyroll: the core is floor(140 × min(ring points, ${AR2_CORE_FULL}) ÷ ${AR2_CORE_FULL}), no feature from 10s and 20s`);
    const pts = (list: number[]) => Object.fromEntries(alleyRollStdParts(ringer(list))!.map((p) => [p.key, p.points]));
    ok(pts([150, 0, 150, 0, 150, 0, 150]).gold === 30 && pts([150]).gold === 10, "alleyroll: gold cup 10 a hit, held to 30");
    ok(pts([100, 0, 100, 0, 100]).pockets === 10 && pts([100]).pockets === 5, "alleyroll: pocket hits 5 each, held to 10");
    ok(pts([30, 30, 0, 40, 50]).streak === 8 && pts([50, 50, 50, 50, 50, 50, 50, 50, 50]).streak === 20 && pts([20, 30, 50]).streak === 4, "alleyroll: roll streak 4 for each 30+ ball after a 30+ ball, held to 20");
    // Earning a feature never costs core: a gold cup and a pocket count their 150 and 100 in the ring points too.
    ok(pts([150, 100]).core === Math.floor((140 * 250) / AR2_CORE_FULL), "alleyroll: a gold cup and a pocket count in the core as well");
    // Rev 1 (stored rounds): its three parts exactly as before.
    const v1 = alleyRollStdParts({ ...arInit(1), acted: 1, ended: 1, balls: [100, 50, 40, 100].map(ball) })!;
    ok(v1.map((p) => p.key).join() === "core,pockets,streak" && v1[0]!.points === Math.floor((150 * 290) / AR_CORE_FULL) && v1[1]!.points === 20 && v1[2]!.points === 12, "alleyroll: rev 1's rounds keep their three parts (core 150, pockets 30, hot streak 20)");
  },
};
