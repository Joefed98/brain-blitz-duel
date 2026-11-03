/**
 * Ringer's oracle (alleyRollRev 2; docs/arcade-standard/alleyroll.md, "Ringer"): flawless rolls that score 200 on any
 * seed. The lane is the same in every room; only the gold cup's path comes from the seed, so the aims are one table
 * and the gold cup's release is timed on the seed's own path. `ringerAim` finds the input that lands nearest a
 * target's centre on the sim's own physics (a coarse search, then a fine one round the best); `ringerGoldAim` the one
 * that comes down through the gold cup's rim at a point on its track, with the ticks it takes. The oracle rolls three
 * gold cups, two pockets and four 50s, each as soon as the ball waits (plus a short pause; a gold cup when the cup
 * will be there).
 *
 *   bun scripts/ringer-oracle.ts
 */
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  AR2_CUPS, AR2_GOLD_Y, AR2_POCKETS, AR2_VMAX, AR2_VMIN, AR_BALLS, AR_CHECKPOINT_INTERVAL, AR_INPUT_ROLL, AR_MAX_ANGLE_DEN, AR_MAX_ANGLE_NUM, AR_WAIT,
  ALLEYROLL_REV_RINGER, arCheckpoint, arGoldCrossing, arGoldX256, arSimulateBallV2, ringerGame, type ArState,
} from "../src/lib/arcade/alleyroll";
import { encodeAlleyRollRun, replayAlleyRollRun } from "../src/lib/duel/alleyroll";

export interface RingerAim {
  a: number;
  b: number;
  c: number;
}
export type RingerTarget = "fifty" | "forty" | "left" | "right";

const most = (c: number) => Math.floor((c * AR_MAX_ANGLE_NUM) / AR_MAX_ANGLE_DEN);

function search(dist: (b: number, c: number) => number): { b: number; c: number; d: number } {
  let best = { b: 0, c: AR2_VMIN, d: Infinity };
  for (let c = AR2_VMIN; c <= AR2_VMAX; c += 24) {
    for (let b = -most(c); b <= most(c); b += 24) {
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
        if (c < AR2_VMIN || c > AR2_VMAX || Math.abs(b) > most(c)) continue;
        const d = dist(b, c);
        if (d < best.d) {
          best = { b, c, d };
          moved = true;
        }
      }
    }
  }
  return best;
}

const AIMS = new Map<string, RingerAim>();

function targetPoint(t: RingerTarget): { x: number; y: number; points: number } {
  if (t === "fifty") return { x: AR2_CUPS[0]!.cx, y: AR2_CUPS[0]!.cy, points: 50 };
  // The 40: its front, the middle of the tower's face (a safe roll: short is a 30, long a 50).
  if (t === "forty") return { x: AR2_CUPS[1]!.cx, y: AR2_CUPS[1]!.cy - 12, points: 40 };
  const p = AR2_POCKETS[t === "left" ? 0 : 1]!;
  return { ...p, points: 100 };
}

/**
 * The input from release `a` whose ball comes down nearest the target's centre (and in it), cached; `short` aims that
 * many board px nearer the player (a careful player's margin on the 50, whose long side drops behind the tower).
 */
export function ringerAim(target: RingerTarget, a: number, short = 0): RingerAim {
  const key = `${target}:${a}:${short}`;
  const hit = AIMS.get(key);
  if (hit) return hit;
  const t = targetPoint(target);
  const p = { ...t, y: t.y - short };
  const best = search((b, c) => {
    const r = arSimulateBallV2(a, b, c);
    return (r.x - p.x) ** 2 + (r.y - p.y) ** 2 + (r.points === p.points ? 0 : 1e6) + (b / 400) ** 2;
  });
  const aim = { a, b: best.b, c: best.c };
  AIMS.set(key, aim);
  return aim;
}

export interface RingerGoldAim extends RingerAim {
  /** The point on the track it comes down through (board px) and the ticks from release. */
  x: number;
  dt: number;
}

const GOLD_AIMS = new Map<number, RingerGoldAim>();

/** The input from the centre that comes down through the gold cup's rim at track point `x` (board px), cached. */
export function ringerGoldAim(x: number): RingerGoldAim {
  const hit = GOLD_AIMS.get(x);
  if (hit) return hit;
  const a = 0;
  const best = search((b, c) => {
    const g = arGoldCrossing(a, b, c);
    return g ? (g.x - x) ** 2 + (g.y - AR2_GOLD_Y) ** 2 + (b / 400) ** 2 : 1e9;
  });
  const g = arGoldCrossing(a, best.b, best.c)!;
  const aim = { a, b: best.b, c: best.c, x, dt: g.dt };
  GOLD_AIMS.set(x, aim);
  return aim;
}

/** The track point the oracle aims the gold cup at: left of the tower's top, where the line is clear. */
export const RINGER_GOLD_X = -24;
/** Where the oracle releases for each pocket: across the lane from it. */
export const RINGER_RELEASE: Record<RingerTarget, number> = { fifty: 0, forty: 0, left: 40, right: -40 };

/** The first tick from `from` at which a gold roll released then meets the cup at its track point. */
export function ringerGoldTick(s: Pick<ArState, "gp" | "gph" | "ga">, aim: RingerGoldAim, from: number): number {
  let bestT = from;
  let bestD = Infinity;
  const period = s.gp ?? 230;
  for (let t = from; t < from + period; t++) {
    const d = Math.abs(arGoldX256(s, t + aim.dt) - aim.x * 256);
    if (d < bestD) {
      bestD = d;
      bestT = t;
    }
    if (d <= 128) return t;
  }
  return bestT;
}

/** The oracle's plan: three gold cups, two pockets, four 50s. */
export const RINGER_PLAN: readonly ("gold" | RingerTarget)[] = ["gold", "gold", "gold", "left", "right", "fifty", "fifty", "fifty", "fifty"];

export function ringerOracleEvents(seed: number, pause = 20): { events: ArcadeInputEvent[]; state: ArState } {
  const game = ringerGame;
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  let waitFrom = 0;
  let rollAt = -1;
  while (!game.isOver(s)) {
    const t = s.tick + 1;
    if (s.phase === AR_WAIT && s.balls.length < AR_BALLS) {
      const kind = RINGER_PLAN[s.balls.length]!;
      if (rollAt < 0) rollAt = kind === "gold" ? ringerGoldTick(s, ringerGoldAim(RINGER_GOLD_X), waitFrom + pause) : waitFrom + pause;
      if (t >= rollAt) {
        const aim = kind === "gold" ? ringerGoldAim(RINGER_GOLD_X) : ringerAim(kind, RINGER_RELEASE[kind]);
        recordInput(events, { t, k: AR_INPUT_ROLL, a: aim.a, b: aim.b, c: aim.c, d: 0 }, game.inputRanges);
        rollAt = -1;
      }
    }
    const ev = events[events.length - 1];
    const before = s.phase;
    s = game.step(s, ev && ev.t === t ? ev : null);
    if (s.phase === AR_WAIT && before !== AR_WAIT) waitFrom = s.tick;
  }
  return { events, state: s };
}

export function ringerOracleRun(seed: number) {
  const { events } = ringerOracleEvents(seed);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = ringerGame.init(seed);
  const checkpoints = [];
  while (!ringerGame.isOver(s)) {
    s = ringerGame.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % AR_CHECKPOINT_INTERVAL === 0) checkpoints.push(arCheckpoint(s));
  }
  const raw = encodeAlleyRollRun({ seed, claimedScore: ringerGame.score(s), events, endTick: s.tick, checkpoints }, ALLEYROLL_REV_RINGER);
  return { raw, events, result: replayAlleyRollRun(seed, raw, ALLEYROLL_REV_RINGER) };
}

if (import.meta.main) {
  for (const t of ["fifty", "left", "right"] as const) {
    const aim = ringerAim(t, RINGER_RELEASE[t]);
    console.log(t, aim, arSimulateBallV2(aim.a, aim.b, aim.c));
  }
  const g = ringerGoldAim(RINGER_GOLD_X);
  console.log("gold", g, arGoldCrossing(g.a, g.b, g.c));
  for (const seed of [1, 2, 3, 10000]) {
    const r = ringerOracleRun(seed).result;
    console.log(`seed ${seed}: ${r.score} · ${r.rings} ring points, ${r.gold} gold, ${r.pockets} pockets, streak ${r.streak}, ${r.endedSeconds.toFixed(1)} s, ${r.points.join(" ")}`);
  }
}
