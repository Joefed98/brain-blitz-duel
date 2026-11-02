/**
 * Alley Roll's oracle (alleyRollRev 1; docs/arcade-standard/alleyroll.md): flawless rolls that score 200 on any seed
 * (the lane is the same in every room, so one line serves every seed). `arAim` finds the release and swipe that land
 * a ball nearest a target's centre on the sim's own physics (a coarse search, then a fine one round the best); the
 * oracle rolls all nine balls into the 100 pockets, alternating sides, as soon as each ball waits, plus a short pause.
 * The skill-band bots aim with the same table and add each level's errors.
 *
 *   bun scripts/alleyroll-oracle.ts
 */
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  AR_BALLS, AR_INPUT_ROLL, AR_MAX_ANGLE_DEN, AR_MAX_ANGLE_NUM, AR_POCKETS, AR_RING_CX, AR_RING_CY, AR_VMAX, AR_VMIN, AR_WAIT, alleyRollGame, arCheckpoint,
  arSimulateBall, AR_CHECKPOINT_INTERVAL, type ArState,
} from "../src/lib/arcade/alleyroll";
import { encodeAlleyRollRun, replayAlleyRollRun } from "../src/lib/duel/alleyroll";

export interface ArAim {
  a: number;
  b: number;
  c: number;
}

/** The targets: the centre ring (50) and the two pockets. */
export type ArTarget = "centre" | "left" | "right";

function targetPoint(t: ArTarget): { x: number; y: number } {
  if (t === "centre") return { x: AR_RING_CX, y: AR_RING_CY };
  return AR_POCKETS[t === "left" ? 0 : 1]!;
}

const AIMS = new Map<string, ArAim>();

/** The release `a` and the swipe (b, c) whose ball lands nearest the target's centre (cached). */
export function arAim(target: ArTarget, a: number): ArAim {
  const key = `${target}:${a}`;
  const hit = AIMS.get(key);
  if (hit) return hit;
  const p = targetPoint(target);
  const dist = (b: number, c: number) => {
    const r = arSimulateBall(a, b, c);
    return (r.x - p.x) ** 2 + (r.y - p.y) ** 2;
  };
  let best = { b: 0, c: AR_VMIN, d: Infinity };
  for (let c = AR_VMIN; c <= AR_VMAX; c += 24) {
    const most = Math.floor((c * AR_MAX_ANGLE_NUM) / AR_MAX_ANGLE_DEN);
    for (let b = -most; b <= most; b += 24) {
      const d = dist(b, c);
      if (d < best.d) best = { b, c, d };
    }
  }
  for (let step = 12; step >= 1; step = Math.floor(step / 2)) {
    let moved = true;
    while (moved) {
      moved = false;
      for (const [db, dc] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
        const b = best.b + db;
        const c = best.c + dc;
        if (c < AR_VMIN || c > AR_VMAX || Math.abs(b) > Math.floor((c * AR_MAX_ANGLE_NUM) / AR_MAX_ANGLE_DEN)) continue;
        const d = dist(b, c);
        if (d < best.d) {
          best = { b, c, d };
          moved = true;
        }
      }
    }
  }
  const aim = { a, b: best.b, c: best.c };
  AIMS.set(key, aim);
  return aim;
}

/** Where the oracle releases for each target: across the lane from a pocket (a long diagonal), the centre straight. */
export const ORACLE_RELEASE: Record<ArTarget, number> = { centre: 0, left: 40, right: -40 };

/** The oracle's log: nine pockets, alternating, each rolled `pause` ticks after the ball waits. */
export function alleyRollOracleEvents(seed: number, pause = 20): { events: ArcadeInputEvent[]; state: ArState } {
  const game = alleyRollGame;
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  let waitFrom = 0;
  while (!game.isOver(s)) {
    const t = s.tick + 1;
    if (s.phase === AR_WAIT && s.balls.length < AR_BALLS && t - waitFrom >= pause) {
      const target: ArTarget = s.balls.length % 2 === 0 ? "left" : "right";
      const aim = arAim(target, ORACLE_RELEASE[target]);
      recordInput(events, { t, k: AR_INPUT_ROLL, a: aim.a, b: aim.b, c: aim.c, d: 0 }, game.inputRanges);
    }
    const ev = events[events.length - 1];
    const before = s.phase;
    s = game.step(s, ev && ev.t === t ? ev : null);
    if (s.phase === AR_WAIT && before !== AR_WAIT) waitFrom = s.tick;
  }
  return { events, state: s };
}

export function alleyRollOracleRun(seed: number) {
  const { events } = alleyRollOracleEvents(seed);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = alleyRollGame.init(seed);
  const checkpoints = [];
  while (!alleyRollGame.isOver(s)) {
    s = alleyRollGame.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % AR_CHECKPOINT_INTERVAL === 0) checkpoints.push(arCheckpoint(s));
  }
  const raw = encodeAlleyRollRun({ seed, claimedScore: alleyRollGame.score(s), events, endTick: s.tick, checkpoints });
  return { raw, events, result: replayAlleyRollRun(seed, raw) };
}

if (import.meta.main) {
  for (const t of ["centre", "left", "right"] as const) {
    const aim = arAim(t, ORACLE_RELEASE[t]);
    console.log(t, aim, arSimulateBall(aim.a, aim.b, aim.c));
  }
  const r = alleyRollOracleRun(1).result;
  console.log(`oracle: ${r.score} · ${r.rings} ring points, ${r.pockets} pockets, streak ${r.streak}, ${r.endedSeconds.toFixed(1)} s`);
}
