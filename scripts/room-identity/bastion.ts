/**
 * Room identity for Iron Wall bastionRev 4 (15 Nov 2026, the difficulty levels; docs/arcade-standard/bastion.md
 * "bastionRev 4: levels"; the arcade rule): `scheduleOf` replays an input log on the given revision at each of its levels
 * (Normal, the level rooms deal, then Easy and Hard) and lists every seeded thing the run meets, read from the run's own
 * state as it plays: each tank as it rolls on (its plan index, wave, kind, lane, speed, weak-spot opening and phase) and
 * each drone as it enters the sky (its direction, heights, speed and size). The plan and the drones are laid from the
 * seed and the level alone, so two very different logs on the same seed must list the same entries over the ticks both
 * runs lived: nothing appears, moves or changes because of how the player plays (a tank's later position depends on
 * nothing but its plan and the one ahead of it in its lane).
 *
 *   import { roomIdentity } from "./room-identity/bastion";
 */
import { bastionDronePos, bastionDronesOf, bastionPlanOf, bastionTankGameFor, BASTION_LEVELS, BASTION_REV_LEVELS, BT2_INPUT_FIRE, BT2_INPUT_RELOAD, BT2_INPUT_TAP, type BastionTankState } from "../../src/lib/arcade/bastionTank";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { Human, type SkillLevel } from "../arcade-skill-bands/human";
import { bot } from "../arcade-skill-bands/bots/bastion";

export function scheduleOf(seed: number, rev: number, events: unknown): { entries: { t: number; what: string }[]; endTick: number } {
  const out: { t: number; what: string }[] = [];
  let endTick = Infinity;
  for (const level of BASTION_LEVELS) {
    const game = bastionTankGameFor(rev, level);
    const byTick = new Map(((events as ArcadeInputEvent[]) ?? []).map((e) => [e.t, e]));
    let s = game.init(seed) as BastionTankState;
    const plan = bastionPlanOf(s);
    const drones = bastionDronesOf(s);
    const seen = new Set<number>();
    const flown = new Set<number>();
    const see = (st: BastionTankState) => {
      for (const t of st.tanks) {
        if (seen.has(t.i)) continue;
        seen.add(t.i);
        const p = plan[t.i]!;
        out.push({ t: st.tick, what: `${level} tank ${t.i}: wave ${p.wave} kind ${t.kind} lane ${t.lane} v ${t.v} open ${p.open ?? "-"} phase ${p.wphase} change ${p.chg}@${p.chgZ}` });
      }
      drones.forEach((d, n) => {
        if (flown.has(n) || !bastionDronePos(d, st.tick)) return;
        flown.add(n);
        out.push({ t: st.tick, what: `${level} drone ${n}: dir ${d.dir} ${d.y0}→${d.y1} speed ${d.speed ?? "-"} size ${d.size ?? "-"}` });
      });
    };
    see(s);
    while (!game.isOver(s)) {
      s = game.step(s, byTick.get(s.tick + 1) ?? null);
      see(s);
    }
    // Every level's list is compared up to the shortest run of the three.
    endTick = Math.min(endTick, s.tick);
  }
  return { entries: out, endTick };
}

/** Shots, reloads and taps at random ticks and places from a seeded stream (no look at the field). */
export function randomLog(seed: number, ticks = 3600): ArcadeInputEvent[] {
  let a = (seed ^ 0x5b1d_7a33) >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const events: ArcadeInputEvent[] = [];
  for (let t = 10; t <= ticks; t += 8 + Math.floor(rand() * 30)) {
    const r = rand();
    const k = r < 0.7 ? BT2_INPUT_FIRE : r < 0.85 ? BT2_INPUT_TAP : BT2_INPUT_RELOAD;
    events.push({ t, k, a: Math.floor(rand() * 390), b: 250 + Math.floor(rand() * 370), c: 0, d: 0 });
  }
  return events;
}

/** A skill-band bot's log on Normal, the level rooms deal. */
export function botLog(seed: number, level: SkillLevel): ArcadeInputEvent[] {
  return bot({ game: bastionTankGameFor(BASTION_REV_LEVELS, "normal"), seed, rev: BASTION_REV_LEVELS, human: new Human("bastion", seed, level), fixes: true }).events ?? [];
}

export const roomIdentity = {
  type: "bastion",
  rev: BASTION_REV_LEVELS,
  scheduleOf,
  logs: (seed: number) => [
    { name: "idle", log: [] },
    { name: "random", log: randomLog(seed) },
    { name: "weak", log: botLog(seed, "weak") },
    { name: "elite", log: botLog(seed, "elite") },
  ],
};
