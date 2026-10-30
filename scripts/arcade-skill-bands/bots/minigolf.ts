/**
 * Minigolf: a player pulling back from the ball and letting go.
 *
 * Each putt is planned the way a player reads a hole: with a clear line to the cup, the putt that drops on the
 * straight line (the sim's own roll stands in for the read of pace and break); without one, the lay-up that leaves
 * the ball nearest the cup by walking distance (round the rails, logs, rocks, planters and ponds). Stronger players
 * know the course: from the tee they play the best route's first putt (the bank's witness, the route the par is
 * proved on), the way a regular plays the bank or the ace line. Then, in the gesture's own terms:
 *   - aim error: the finger's pointing error over the length of the pull (aimSdPx over ~pull px, in radians),
 *   - power error: a relative error on the pull's length,
 *   - think time before each putt (longer on a new hole's tee),
 *   - slips: a mis-hit (the pull let go far too short or long).
 * The bot never looks at the score.
 */
import { readFileSync } from "node:fs";
import { MG_AIM, MG_POWER_MAX, MINIGOLF_HOLES, type MinigolfState } from "../../../src/lib/arcade/minigolf";
import { decodeSportsRun } from "../../../src/lib/arcade/sportsKit";
import type { SkillLevel } from "../human";
import { driveEvents, type SkillBot } from "../bot";
import { angleTo, dirOf, holingPutts, leaves, type Putt } from "../../minigolf-oracle";

/** Levels that play the best route's first putt from each tee (they know the course). */
const KNOWS_ROUTE: Record<SkillLevel, number> = { weak: 0, average: 0, good: 0.25, great: 0.6, near: 0.9, elite: 1, perfect: 1 };
/** Think time before a putt (average player, ms), and the extra on a new tee. */
const THINK_MS = 1500;
const TEE_MS = 1400;

let witness: Record<string, string> | null = null;
/** The bank witness's putts for each hole of a seed (the proved best routes), or null off the bank. */
function routesOf(seed: number, init: MinigolfState, step: (s: MinigolfState, e: unknown) => MinigolfState): Putt[][] | null {
  witness ??= JSON.parse(readFileSync(new URL("../../fixtures/minigolf-witness.json", import.meta.url), "utf8")) as Record<string, string>;
  const raw = witness[String(seed)];
  if (!raw) return null;
  const events = decodeSportsRun(raw, 7200).events;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const routes: Putt[][] = Array.from({ length: MINIGOLF_HOLES }, () => []);
  let s = init;
  while (!s.over) {
    const e = byTick.get(s.tick + 1) ?? null;
    if (e && s.phase === MG_AIM) routes[s.hole]!.push({ a: e.a, b: e.b, c: e.c });
    s = step(s, e);
  }
  return routes;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const init = game.init(seed) as MinigolfState;
  const routes = routesOf(seed, init, (s, e) => game.step(s, e));
  let readyAt = -1;
  let plannedFor = "";
  let lastHole = -1;
  let shotOnHole = 0;
  let planned: Putt | null = null;

  const plan = (s: MinigolfState): Putt => {
    const h = s.course[s.hole]!;
    if (shotOnHole === 0 && routes?.[s.hole]?.[0] && human.chance(KNOWS_ROUTE[human.level])) return routes[s.hole]![0]!;
    const hole = holingPutts(h, s.x, s.y);
    if (hole[0]) return hole[0];
    const opts = leaves(h, s.x, s.y, 5, 40);
    const ace = opts.find((l) => l.dist < 0);
    if (ace && human.level === "perfect") return ace.putt;
    const lay = opts.filter((l) => l.dist >= 0).slice(0, 6);
    if (!lay.length) {
      const { a, b } = dirOf(angleTo(s.x, s.y, h.cup.x, h.cup.y));
      return { a, b, c: 300 };
    }
    // The player weighs the few best lay-ups by eye.
    const i = human.pick(lay.map((l) => -l.dist));
    return lay[Math.max(0, i)]!.putt;
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
        planned = plan(s);
        const think = human.thinkTicks(THINK_MS + (shotOnHole === 0 ? TEE_MS : 0));
        readyAt = t + human.reactTicks() + think;
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
