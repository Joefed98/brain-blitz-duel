/**
 * The phone's half of minigolf-sync-check: a run recorded exactly as the live stage records it
 * (src/components/puzzles/ArcadeCanvasStage.tsx, discrete mode): a putt is queued, recorded on the next sim tick
 * through recordInput, the sim steps on inputAt from the log, a checkpoint every SPORTS_CHECKPOINT_INTERVAL ticks, and
 * the answer encoded from the state the run reached. Imports the sim only (no server or React code), so the same file
 * is bundled into Chromium (V8, the engine of the phone's browser and the server's Worker) and run in Bun.
 *
 * Every shot is chosen with integer maths from the case's own seed (no float trig), so both engines record the same
 * putts and any difference can only come from the sim.
 */
import { inputAt, recordInput, type ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { minigolfCheckpoint, minigolfGameFor, MG_AIM, MG_INPUT_CHIP, MG_INPUT_PUTT, MG_POWER_MAX, MG_ROLL, type MgLevel, type MinigolfState } from "../../src/lib/arcade/minigolf";
import { encodeSportsRun, ilen, idiv, SPORTS_CHECKPOINT_INTERVAL } from "../../src/lib/arcade/sportsKit";

/** How a case picks its putts. */
export type ShotPlan =
  /** Any direction, a power drawn from slow rolls, middling and full-power (bank) shots. */
  | "random"
  /** At the cup with a little error and a power for the distance (holes in one, lips, overshoots). */
  | "aim"
  /** Feather-light putts only (the slowest rolls the stage can send). */
  | "slow"
  /** Full power off the rails (long bank shots). */
  | "bank"
  /** Within 150 px of the cup, a putt searched for that drops (the cup's capture speed, lip-ins), else "aim". */
  | "ace"
  /** A stored witness's putts on their own ticks (the oracle's 200-point routes). */
  | "witness"
  /** golfRev 3: lofted chips only, any direction and carry (over water, sand and low walls; into them too). */
  | "chip"
  /** golfRev 3: at a loop's nearer end with a power from soft to hard (some go round, some stall and roll back). */
  | "loop";

export interface SyncCase {
  name: string;
  seed: number;
  pars: number[];
  rev: number;
  plan: ShotPlan;
  /** The case's own PRNG seed (the shots and waits). */
  rng: number;
  /** A time-out cut: the run stops at this tick, as the room's draft does (0: to the end). */
  cut: number;
  /** The witness's events (plan "witness"). */
  events?: ArcadeInputEvent[];
  /** golfRev 3: the five hole ids and the level. */
  holes?: number[];
  level?: MgLevel;
}

export interface PhoneRun {
  name: string;
  answer: string;
  /** Every checkpoint checksum the phone made, in order. */
  sums: number[];
  score: number;
  tick: number;
  putts: number;
  /** The putts' powers (slow-roll coverage). */
  powers: number[];
}

function prng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return (r ^ (r >>> 14)) >>> 0;
  };
}

/** An integer direction scaled to the stage's ±4000 (as the stage sends a unit aim × 4000). */
function dir4000(dx: number, dy: number): { a: number; b: number } {
  const l = ilen(dx, dy);
  if (l <= 0) return { a: 0, b: -4000 };
  return { a: idiv(dx * 4000, l), b: idiv(dy * 4000, l) };
}

type Game = ReturnType<typeof minigolfGameFor>;

/** A putt that drops, found by trying putts on the sim (the case only chooses its input; the run is recorded as ever). */
function acePutt(game: Game, s: MinigolfState): { a: number; b: number; c: number } | null {
  const h = s.course[s.hole]!;
  for (let spread = 0; spread <= 600; spread += 40) {
    for (const side of spread ? [-1, 1] : [1]) {
      const dx = h.cup.x - s.x;
      const dy = h.cup.y - s.y;
      const d = dir4000(dx - idiv(dy * spread * side, 4000), dy + idiv(dx * spread * side, 4000));
      for (let c = 40; c <= MG_POWER_MAX; c += 15) {
        let t = game.step(s, { t: s.tick + 1, k: MG_INPUT_PUTT, a: d.a, b: d.b, c, d: 0 });
        while (t.phase === MG_ROLL) t = game.step(t, null);
        if (t.holed[s.hole] === 1) return { ...d, c };
      }
    }
  }
  return null;
}

/** golfRev 3: a shot is a putt or a chip; the case's own stream decides (chips only on the "chip" plan, a third elsewhere). */
function pickShot(plan: ShotPlan, s: MinigolfState, next: () => number, game: Game): { k: number; a: number; b: number; c: number } {
  const loops = s.course[s.hole]!.loops ?? [];
  if (plan === "loop" && loops.length) {
    // Towards the nearer end of the hole's first loop, a little short of its mouth, at a power from 120 to 720.
    const l = loops[0]!;
    const da = ilen(l.ax - s.x, l.ay - s.y);
    const db = ilen(l.bx - s.x, l.by - s.y);
    const [ex, ey] = da <= db ? [l.ax, l.ay] : [l.bx, l.by];
    return { k: MG_INPUT_PUTT, ...dir4000(ex - s.x, ey - s.y), c: 120 + (next() % 600) };
  }
  const p = pickPutt(plan === "chip" || plan === "loop" ? "random" : plan, s, next, game);
  if (s.rev < 3) return { k: MG_INPUT_PUTT, ...p };
  const chip = plan === "chip" || (plan !== "ace" && next() % 3 === 0);
  return { k: chip ? MG_INPUT_CHIP : MG_INPUT_PUTT, ...p };
}

function pickPutt(plan: ShotPlan, s: MinigolfState, next: () => number, game: Game): { a: number; b: number; c: number } {
  const h = s.course[s.hole]!;
  if (plan === "ace" && ilen(h.cup.x - s.x, h.cup.y - s.y) < 150 * 256) {
    const ace = acePutt(game, s);
    if (ace) return ace;
  }
  if (plan === "aim" || plan === "ace") {
    const err = 600;
    const d = dir4000(h.cup.x - s.x + ((next() % (2 * err)) - err) * 4, h.cup.y - s.y + ((next() % (2 * err)) - err) * 4);
    const dist = ilen(h.cup.x - s.x, h.cup.y - s.y) >> 8;
    const c = Math.max(1, Math.min(MG_POWER_MAX, dist * 3 + (next() % 260) - 60));
    return { ...d, c };
  }
  const ang = next() % 3600;
  // One of 3,600 integer directions (900 a quarter turn), scaled to ±4000 like the stage's unit aim.
  const k = ang % 900;
  const along = 900 - k;
  const across = k;
  const quad = Math.floor(ang / 900);
  const raw = [
    [across, -along],
    [along, across],
    [-across, along],
    [-along, -across],
  ][quad]!;
  const d = dir4000(raw[0]!, raw[1]!);
  if (plan === "slow") return { ...d, c: 1 + (next() % 90) };
  if (plan === "bank") return { ...d, c: 880 + (next() % 121) };
  const band = next() % 10;
  const c = band < 3 ? 1 + (next() % 150) : band < 7 ? 150 + (next() % 600) : 750 + (next() % 251);
  return { ...d, c };
}

/** Plays one case as the phone does and returns its answer. */
export function phoneRun(c: SyncCase): PhoneRun {
  const game = minigolfGameFor(c.pars, c.rev, { holes: c.holes, level: c.level });
  const next = prng(c.rng);
  let s = game.init(c.seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: { tick: number; checksum: number }[] = [];
  const queue: { k: number; a: number; b: number; c: number }[] = [];
  const witness = new Map((c.events ?? []).map((e) => [e.t, e]));
  const powers: number[] = [];
  let waitUntil = 0;
  let aimedFor = -1;
  const end = c.cut > 0 ? c.cut : game.runTicks;
  while (!game.isOver(s) && s.tick < end) {
    if (c.plan === "witness") {
      const w = witness.get(s.tick + 1);
      if (w) queue.push({ k: w.k, a: w.a, b: w.b, c: w.c });
    } else if (s.phase === MG_AIM && queue.length === 0) {
      // A new resting ball: the player looks for a while (the sails turn meanwhile), then lets go.
      const at = s.hole * 64 + s.strokes;
      if (aimedFor !== at) {
        aimedFor = at;
        waitUntil = s.tick + (next() % 140);
      }
      if (s.tick >= waitUntil) {
        queue.push(pickShot(c.plan, s, next, game));
        aimedFor = -1;
      }
    }
    const shot = queue.shift();
    if (shot) {
      const rec = recordInput(events, { t: s.tick + 1, k: shot.k, a: shot.a, b: shot.b, c: shot.c, d: 0 }, game.inputRanges);
      if (rec) powers.push(rec.c);
    }
    s = game.step(s, inputAt(events, s.tick + 1));
    if (s.tick % SPORTS_CHECKPOINT_INTERVAL === 0) checkpoints.push(minigolfCheckpoint(s));
  }
  const score = game.score(s);
  const answer = encodeSportsRun({ seed: c.seed, claimedScore: score, events, endTick: s.tick, checkpoints });
  return { name: c.name, answer, sums: checkpoints.map((p) => p.checksum >>> 0), score, tick: s.tick, putts: events.length, powers };
}

export function phoneRuns(cases: SyncCase[]): PhoneRun[] {
  return cases.map(phoneRun);
}
