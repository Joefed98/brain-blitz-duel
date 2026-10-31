/**
 * Minigolf: a player pulling back from the ball and letting go.
 *
 * Each putt is planned the way a player reads a hole: with a clear line to the cup, the putt that drops on the
 * straight line (the sim's own roll stands in for the read of pace and break); without one, the lay-up that leaves
 * the ball nearest the cup by walking distance (round the rails, logs, rocks, planters and ponds, and on golfRev 2
 * through the tunnels and round the bunkers). Stronger players know the course: from the tee they play the best
 * route's first putt (the bank's witness, the route the par is proved on), the way a regular plays the bank or the ace
 * line. Then, in the gesture's own terms:
 *   - aim error: the finger's pointing error over the length of the pull (aimSdPx over ~pull px, in radians),
 *   - power error: a relative error on the pull's length,
 *   - think time before each putt (longer on a new hole's tee),
 *   - slips: a mis-hit (the pull let go far too short or long),
 *   - golfRev 2's windmills: the putt is read for the moment it will be played (the sails' angle on the sim's clock);
 *     where a sail is in the way the player waits for the gap, and lets go with the level's timing error.
 * The bot never looks at the score.
 */
import { readFileSync } from "node:fs";
import { MG_AIM, MG_MILL_PERIOD, MG_POWER_MAX, MINIGOLF_HOLES, type MinigolfState } from "../../../src/lib/arcade/minigolf";
import { decodeSportsRun } from "../../../src/lib/arcade/sportsKit";
import type { SkillLevel } from "../human";
import { driveEvents, type SkillBot } from "../bot";
import { angleTo, dirOf, holingPutts, leaves, type Putt } from "../../minigolf-oracle";

/** Levels that play the best route's first putt from each tee (they know the course). */
const KNOWS_ROUTE: Record<SkillLevel, number> = { weak: 0, average: 0, good: 0.25, great: 0.6, near: 0.9, elite: 1, perfect: 1 };
/** Think time before a putt (average player, ms), and the extra on a new tee. */
const THINK_MS = 1500;
const TEE_MS = 1400;

const witnesses: Record<number, Record<string, string>> = {};
/** A tee putt from the witness: the putt and the sim tick it was played on (the sails' moment). */
type TeePutt = Putt & { t: number };
/** The bank witness's putts for each hole of a seed (the proved best routes), or null off the bank. */
function routesOf(seed: number, init: MinigolfState, step: (s: MinigolfState, e: unknown) => MinigolfState): TeePutt[][] | null {
  const rev = init.rev >= 2 ? 2 : 1;
  witnesses[rev] ??= JSON.parse(readFileSync(new URL(rev >= 2 ? "../../fixtures/minigolf-witness-v2.json" : "../../fixtures/minigolf-witness.json", import.meta.url), "utf8")) as Record<string, string>;
  const raw = witnesses[rev]![String(seed)];
  if (!raw) return null;
  const events = decodeSportsRun(raw, 7200).events;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const routes: TeePutt[][] = Array.from({ length: MINIGOLF_HOLES }, () => []);
  let s = init;
  while (!s.over) {
    const e = byTick.get(s.tick + 1) ?? null;
    if (e && s.phase === MG_AIM) routes[s.hole]!.push({ a: e.a, b: e.b, c: e.c, t: e.t });
    s = step(s, e);
  }
  return routes;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const init = game.init(seed) as MinigolfState;
  const routes = routesOf(seed, init, (s, e) => game.step(s, e));
  const v2 = init.rev >= 2;
  let readyAt = -1;
  let plannedFor = "";
  let lastHole = -1;
  let shotOnHole = 0;
  let planned: Putt | null = null;

  /** The putt from where the ball rests, read for a putt played from tick `at` (golfRev 2: plus its wait). */
  const plan = (s: MinigolfState, at: number): { putt: Putt; at: number } => {
    const h = s.course[s.hole]!;
    const first = routes?.[s.hole]?.[0];
    if (shotOnHole === 0 && first && human.chance(KNOWS_ROUTE[human.level])) {
      // The witness's tee putt, played when the sails stand as they did for it (they repeat every MG_MILL_PERIOD).
      if (!v2 || !(h.windmills?.length)) return { putt: first, at };
      const lag = (((first.t - at) % MG_MILL_PERIOD) + MG_MILL_PERIOD) % MG_MILL_PERIOD;
      return { putt: { a: first.a, b: first.b, c: first.c }, at: at + lag };
    }
    const hole = holingPutts(h, s.x, s.y, { tick: at });
    if (hole[0]) return { putt: hole[0], at };
    const opts = leaves(h, s.x, s.y, 5, 40, at);
    const ace = opts.find((l) => l.dist < 0);
    if (ace && human.level === "perfect") return { putt: ace.putt, at };
    const lay = opts.filter((l) => l.dist >= 0).slice(0, 6);
    if (!lay.length) {
      const { a, b } = dirOf(angleTo(s.x, s.y, h.cup.x, h.cup.y));
      return { putt: { a, b, c: 300 }, at };
    }
    // The player weighs the few best lay-ups by eye.
    const i = human.pick(lay.map((l) => -l.dist));
    return { putt: lay[Math.max(0, i)]!.putt, at };
  };

  /** The putt as the finger plays it: aim and pull-length error, and the odd mis-hit. */
  const execute = (p: Putt): Putt => {
    const pull = Math.max(60, (p.c / MG_POWER_MAX) * 150);
    const angle = Math.atan2(p.b, p.a) + human.aim(1, 1) / pull;
    let c = p.c * human.power();
    if (human.slip(0.5)) c *= human.chance(0.5) ? 0.55 : 1.5;
    return { a: Math.round(Math.cos(angle) * 4000), b: Math.round(Math.sin(angle) * 4000), c: Math.max(1, Math.min(MG_POWER_MAX, Math.round(c))) };
  };

  return driveEvents(
    game as never,
    (s: MinigolfState, t) => {
      if (s.phase !== MG_AIM) return null;
      const key = `${s.hole}:${s.strokes}:${s.x}:${s.y}`;
      if (key !== plannedFor) {
        plannedFor = key;
        if (s.hole !== lastHole) {
          lastHole = s.hole;
          shotOnHole = 0;
        }
        const think = human.thinkTicks(THINK_MS + (shotOnHole === 0 ? TEE_MS : 0));
        readyAt = t + human.reactTicks() + think;
        const p = plan(s, readyAt);
        planned = p.putt;
        // A timed putt (a wait for the sails): let go when the gap comes, give or take the level's timing.
        const waits = p.at - readyAt + (p.putt.w ?? 0);
        if (waits > 0) readyAt = Math.max(t, readyAt + waits + (human.level === "perfect" ? 0 : human.timingTicks(1.5)));
      }
      if (t < readyAt || !planned) return null;
      const p = human.level === "perfect" ? planned : execute(planned);
      planned = null;
      shotOnHole++;
      return { k: 1, a: p.a, b: p.b, c: p.c, d: 0 };
    },
    init,
  );
};

/** Random play: a putt in any direction at any power, every second or so. */
export const randomBot: SkillBot = ({ game, seed, human }) => {
  let next = 30;
  return driveEvents(
    game as never,
    (s: MinigolfState, t) => {
      if (s.phase !== MG_AIM || t < next) return null;
      next = t + 40 + human.int(0, 60);
      const { a, b } = dirOf(human.u() * 360);
      return { k: 1, a, b, c: human.int(50, MG_POWER_MAX), d: 0 };
    },
    game.init(seed),
  );
};
