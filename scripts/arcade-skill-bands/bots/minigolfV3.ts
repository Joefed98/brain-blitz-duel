/**
 * Crazy Golf golfRev 3 (the Crazy Golf overhaul, 15 Nov 2026): a player choosing putt or chip and pulling back.
 *
 * As the golfRev 2 bot (./minigolf.ts) reads a hole: with a line to the cup, the shot that drops (a putt or a chip,
 * scripts/minigolf-oracle.ts holingShotsV3, the sim's own roll standing in for the read of pace, break and the
 * swells); without one, the lay-up (putts and chips) that leaves the ball nearest the cup by walking distance. Players
 * who know the course play the bank witness's first shot from each tee (its route is the par proof), lined up with the
 * sails' repeat. Then the gesture's errors: aim over the pull's length, a relative power error, think time, the odd
 * mis-hit, and the windmill's timing.
 *
 * The level's aim preview (display only in the game) is what a player reads the power from, so it is modelled as a
 * scale on the power error: Easy's line to the first bounce 0.6, Normal's full line 1, Hard's shorter one 1.35,
 * Expert's shortest 1.7 (docs/arcade-standard/minigolf.md "golfRev 3", with the measurements).
 *
 * The bot never looks at the score.
 */
import { readFileSync } from "node:fs";
import { MG_AIM, MG_INPUT_CHIP, MG_LEVELS, MG_POWER_MAX, type MinigolfState } from "../../../src/lib/arcade/minigolf";
import type { SkillLevel } from "../human";
import { driveEvents, type SkillBot } from "../bot";
import { angleTo, dirOf, holingShotsV3, leavesV3, millPeriodOf, type Shot } from "../../minigolf-oracle";

const KNOWS_ROUTE: Record<SkillLevel, number> = { weak: 0, average: 0, good: 0.25, great: 0.6, near: 0.9, elite: 1, perfect: 1 };
const THINK_MS = 1500;
const TEE_MS = 1400;
/** The aim preview's effect on reading the power (see the header). */
export const PREVIEW_POWER_SCALE = { easy: 0.6, normal: 1, hard: 1.35, expert: 1.7 } as const;

type Witness = Record<string, { shots: [number, number, number, number, number][]; holed: number }>;
let witness: Witness | null = null;
function witnessOf(): Witness {
  witness ??= JSON.parse(readFileSync(new URL("../../fixtures/minigolf-holes-witness.json", import.meta.url), "utf8")) as Witness;
  return witness;
}

export const botV3: SkillBot = ({ game, seed, human }) => {
  const init = game.init(seed) as MinigolfState;
  const level = init.level;
  const powerScale = PREVIEW_POWER_SCALE[level];
  let readyAt = -1;
  let plannedFor = "";
  let lastHole = -1;
  let shotOnHole = 0;
  let planned: Shot | null = null;

  const firstShot = (s: MinigolfState, at: number): { shot: Shot; at: number } | null => {
    const h = s.course[s.hole]!;
    const id = h.holeId ?? -1;
    const key = (h.windmills?.length ?? 0) > 0 ? `${id}:${MG_LEVELS[level].mill}` : `${id}:any`;
    const w = witnessOf()[key];
    if (!w) return null;
    const [k, a, b, c, wait] = w.shots[0]!;
    const P = millPeriodOf(h);
    // Proved from tick 1: the first shot struck on a tick ≡ 1 + wait (mod the sails' repeat).
    const strike = P ? at + ((((1 + wait - at) % P) + P) % P) : at;
    return { shot: { k, a, b, c }, at: strike };
  };

  const plan = (s: MinigolfState, at: number): { shot: Shot; at: number } => {
    const h = s.course[s.hole]!;
    if (shotOnHole === 0 && human.chance(KNOWS_ROUTE[human.level])) {
      const f = firstShot(s, at);
      if (f) return f;
    }
    const hole = holingShotsV3(h, s.x, s.y, at);
    if (hole[0]) return { shot: hole[0], at };
    const opts = leavesV3(h, s.x, s.y, 5, 40, at);
    const ace = opts.find((l) => l.dist < 0);
    if (ace && human.level === "perfect") return { shot: ace.putt as Shot, at };
    const lay = opts.filter((l) => l.dist >= 0).slice(0, 6);
    if (!lay.length) {
      const { a, b } = dirOf(angleTo(s.x, s.y, h.cup.x, h.cup.y));
      return { shot: { a, b, c: 300 }, at };
    }
    const i = human.pick(lay.map((l) => -l.dist));
    return { shot: lay[Math.max(0, i)]!.putt as Shot, at };
  };

  const execute = (p: Shot): Shot => {
    const pull = Math.max(60, (p.c / MG_POWER_MAX) * 150);
    const angle = Math.atan2(p.b, p.a) + human.aim(1, 1) / pull;
    let c = p.c * (1 + (human.power() - 1) * powerScale);
    if (human.slip(0.5)) c *= human.chance(0.5) ? 0.55 : 1.5;
    return { k: p.k, a: Math.round(Math.cos(angle) * 4000), b: Math.round(Math.sin(angle) * 4000), c: Math.max(1, Math.min(MG_POWER_MAX, Math.round(c))) };
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
        planned = p.shot;
        const waits = p.at - readyAt + (p.shot.w ?? 0);
        if (waits > 0) readyAt = Math.max(t, readyAt + waits + (human.level === "perfect" ? 0 : human.timingTicks(1.5)));
      }
      if (t < readyAt || !planned) return null;
      const p = human.level === "perfect" ? planned : execute(planned);
      planned = null;
      shotOnHole++;
      return { k: p.k === MG_INPUT_CHIP ? MG_INPUT_CHIP : 1, a: p.a, b: p.b, c: p.c, d: 0 };
    },
    init,
  );
};
