/**
 * Iron Wall's paced oracle (bastionRev 5, D5's ladder, 23 Nov 2026; docs/arcade-standard/bastion.md "bastionRev 5: the
 * ladder"): the proof player every bastionRev 5 deal is built on. It is scripts/bastion-oracle.ts's flawless planner (it
 * reads the field 31 ticks ahead through a copy of the run, finds for each tank the flight that lands on its weak spot
 * while the vent is open, fires at the tank nearest the wall still owed damage, reloads early when the field is quiet,
 * taps the needle in the green and leads each drone), HELD TO JOE'S HUMAN LIMITS (HUMAN_LIMITS: 0.25 s to react, 0.15 s
 * to move), which scripts/bastion-oracle.ts is not:
 *
 *  - a tank is noticed no sooner than 0.25 s after it rolls on, and the crosshair needs 0.15 s more to reach it, so the
 *    first shell at it leaves no sooner than 0.4 s after it appears (the same for each drone after it enters the sky);
 *  - between two shells at different targets the crosshair moves for at least 0.15 s (the gun's own 0.25 s between shots
 *    is longer, so this never binds on its own), and after a reload swipe or a fast-reload tap (both lift the thumb
 *    from the aim) the next shell waits 0.15 s;
 *  - nothing it does is faster than a person: one input a tick at most, as the phone records.
 *
 * Its aim and its read of the field are exact (a best player's, as the bounds rule draws every tank on its rectangles);
 * the limits are the reaction and movement times. `bastionPacedRun` is the log a phone would send.
 *
 *   bun scripts/bastion-ladder-oracle.ts [level] [from] [count]   each seed's paced score on bastionRev 5 (Normal default)
 */
import { inputAt, recordInput, type ArcadeGame, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  bastionDronePos,
  bastionDroneRect,
  bastionDronesOf,
  bastionFlight,
  bastionPlanOf,
  bastionStdParts,
  bastionTankGameFor,
  bastionTankRects,
  bastionWeakOpen,
  bastionWeakPctOf,
  bastionZoneW,
  BASTION_REV_LADDER,
  BASTION_REV_TANK,
  BT2_INPUT_FIRE,
  BT2_INPUT_RANGES,
  BT2_INPUT_RELOAD,
  BT2_INPUT_TAP,
  BT2_MAG,
  BT2_RELOAD_TICKS,
  BT2_WORLD_W,
  type BastionTankState,
  type Bt2Rect,
} from "../src/lib/arcade/bastionTank";
import { HUMAN_LIMITS, type HumanLimits } from "./arcade-skill-bands/human";

const LOOK = 31;
/** A drone waits while a tank is this many ticks from the wall. */
export let DRONE_URGENT = 30;
export function setDroneUrgent(n: number): void {
  DRONE_URGENT = n;
}
const TICK_MS = 1000 / 60;

/** The limits in ticks: reaction (notice) and movement (crosshair onto a new target), rounded up. */
export function pacedTicks(limits: HumanLimits = HUMAN_LIMITS): { notice: number; move: number } {
  return { notice: Math.ceil(limits.reactMs / TICK_MS), move: Math.ceil(limits.moveMs / TICK_MS) };
}

const centre = (r: Bt2Rect): [number, number] => [Math.floor((r[0] + r[2]) / 2), Math.floor((r[1] + r[3]) / 2)];

/** The first tank (nearest the wall) whose rectangles contain the point at this state, or null. */
function firstAt(s: BastionTankState, x: number, y: number): number | null {
  for (const t of s.tanks) {
    const r = bastionTankRects(t.kind, t.lane, t.z, bastionWeakPctOf(s));
    const inR = (q: Bt2Rect, pad = 0) => x >= q[0] - pad && x <= q[2] + pad && y >= q[1] - pad && y <= q[3] + pad;
    if (inR(r.weak, 1) || inR(r.hull) || inR(r.turret)) return t.i;
  }
  return null;
}

/** A tank close enough that a 1 s reload now would cost it. */
function urgent(s: BastionTankState, ticks = 130): boolean {
  return s.tanks.some((t) => t.z < t.v * ticks);
}

interface Shot {
  tank: number;
  x: number;
  y: number;
  dmg: number;
  lands: number;
}

/** The shot at the tank nearest the wall still owed damage that the player has had time to see and reach, or null. */
function pickShot(s: BastionTankState, game: ArcadeGame<BastionTankState, ArcadeInputEvent | null>, pending: Shot[], ready: Map<number, number>, t: number): Omit<Shot, "lands"> | null {
  if (s.tanks.length === 0) return null;
  const frames: BastionTankState[] = [];
  let c = game.step(s, null);
  frames.push(c);
  for (let i = 1; i < LOOK && !game.isOver(c); i++) {
    c = game.step(c, null);
    frames.push(c);
  }
  const plan = bastionPlanOf(s);
  const weakPct = bastionWeakPctOf(s);
  const order = [...s.tanks].sort((a, b) => Math.floor(a.z / a.v) - Math.floor(b.z / b.v));
  for (const tank of order) {
    if ((ready.get(tank.i) ?? Infinity) > t) continue;
    const owed = tank.hp - pending.filter((p) => p.tank === tank.i).reduce((a, p) => a + p.dmg, 0);
    if (owed <= 0) continue;
    const aimAt = (weakAim: boolean): Omit<Shot, "lands"> | null => {
      for (let f = 18; f <= 30 && f < frames.length; f++) {
        const fr = frames[f]!;
        const tt = fr.tanks.find((x) => x.i === tank.i);
        if (!tt || tt.hp <= 0) break;
        const r = bastionTankRects(tt.kind, tt.lane, tt.z, weakPct);
        const [hx, hy] = centre([r.hull[0], r.turret[1], r.hull[2], r.hull[3]]);
        const [wx, wy] = centre(r.weak);
        const [x, y] = weakAim ? [wx, wy] : [hx, hy];
        if (bastionFlight(y) !== f) continue;
        if (weakAim && !bastionWeakOpen(plan[tank.i]!, fr.tick)) break;
        if (weakAim && r.weak[3] - r.weak[1] < 2) break;
        if (firstAt(fr, x, y) !== tank.i) break;
        return { tank: tank.i, x, y, dmg: weakAim ? 2 : 1 };
      }
      return null;
    };
    const shot = aimAt(true);
    if (shot) return shot;
    // A pressing tank whose weak spot can't be hit in time takes a hull shot rather than reach the wall.
    if (tank.z < tank.v * 120) {
      const hull = aimAt(false);
      if (hull) return hull;
    }
  }
  return null;
}

/**
 * Plays a run on `game` (bastionRev 5's level game, or any tank revision's) as the paced oracle: exact aim and read of the
 * field, every reaction and every move of the crosshair at least `limits` (Joe's HUMAN_LIMITS by default).
 */
export function bastionPacedPlay(seed: number, game: ArcadeGame<BastionTankState, ArcadeInputEvent | null>, limits: HumanLimits = HUMAN_LIMITS): { events: ArcadeInputEvent[]; state: BastionTankState } {
  const { notice, move } = pacedTicks(limits);
  const events: ArcadeInputEvent[] = [];
  let s = game.init(seed);
  const drones = s.rev > BASTION_REV_TANK ? bastionDronesOf(s) : [];
  const droneTried = drones.map(() => false);
  let droneFlying = -1;
  const pending: Shot[] = [];
  /** The tick each tank (plan index) can first take a shell: seen, then reached. */
  const ready = new Map<number, number>();
  let tapAt = -1;
  let tapFor = -1;
  /** The crosshair is free again (a shell's target reached, or the thumb back on the aim after a tap or swipe). */
  let aimFree = 0;
  let lastTarget = Number.NaN;
  let lastShot = -Infinity;
  while (!game.isOver(s)) {
    const t = s.tick + 1;
    let ev: Omit<ArcadeInputEvent, "t"> | null = null;
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i]!.lands < t) pending.splice(i, 1);
    for (const tank of s.tanks) if (!ready.has(tank.i)) ready.set(tank.i, s.tick + notice + move);

    // The fast-reload tap, planned when the reload starts, on the zone's middle.
    if (s.reloadAt >= 0 && s.reloadTap === 0) {
      if (tapFor !== s.reloadAt) {
        tapFor = s.reloadAt;
        const mid = s.zone + Math.floor(bastionZoneW(s.rev, s.lvl) / 2);
        tapAt = s.reloadAt + Math.max(1, Math.ceil((mid * BT2_RELOAD_TICKS) / 1000));
      }
      if (tapAt === t) {
        ev = { k: BT2_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 };
        aimFree = Math.max(aimFree, t + move);
      }
    }

    const canFire = s.mag > 0 && s.cool === 0 && s.reloadAt < 0 && t >= aimFree;
    if (droneFlying >= 0 && pending.every((p) => p.tank !== -1 - droneFlying)) droneFlying = -1;
    const fire = (target: number, x: number, y: number, dmg: number) => {
      ev = { k: BT2_INPUT_FIRE, a: x, b: y, c: 0, d: 0 };
      pending.push({ tank: target, x, y, dmg, lands: t + bastionFlight(y) });
      lastTarget = target;
      lastShot = t;
    };
    // A move to a new target takes the movement time from the last shell.
    const reached = (target: number) => target === lastTarget || t >= lastShot + move;
    if (!ev && canFire && droneFlying < 0 && drones.length && !urgent(s, DRONE_URGENT)) {
      for (let n = 0; n < drones.length && !ev; n++) {
        if (s.droneMask & (1 << n) || droneTried[n] || t < drones[n]!.at + notice + move || !reached(-1 - n)) continue;
        const at = bastionDronePos(drones[n]!, t + bastionFlight(150));
        if (!at || at.x < 6 || at.x > BT2_WORLD_W - 6) continue;
        const r = bastionDroneRect(at.x, at.y, drones[n]!.size);
        const [x, y] = centre(r);
        if (bastionFlight(y) !== bastionFlight(150)) continue;
        droneTried[n] = true;
        droneFlying = n;
        fire(-1 - n, x, y, 0);
      }
    }
    if (!ev && canFire) {
      const shot = pickShot(s, game, pending, ready, t);
      if (shot && reached(shot.tank)) fire(shot.tank, shot.x, shot.y, shot.dmg);
      // A quiet field: reload early, unless a drone is in the sky (or about to be) still to be tried.
      else if (!shot && s.mag <= BT2_MAG - 1 && !urgent(s) && !drones.some((d, n) => !droneTried[n] && !(s.droneMask & (1 << n)) && (t < d.at ? d.at - t <= 90 : bastionDronePos(d, t) !== null))) {
        ev = { k: BT2_INPUT_RELOAD, a: 0, b: 0, c: 0, d: 0 };
        aimFree = Math.max(aimFree, t + move);
      }
    }
    if (ev) recordInput(events, { ...(ev as Omit<ArcadeInputEvent, "t">), t }, BT2_INPUT_RANGES);
    s = game.step(s, inputAt(events, t));
  }
  return { events, state: s };
}

/** The paced oracle's log for a seed at a bastionRev 5 level (or any tank revision and level). */
export function bastionPacedRun(seed: number, level?: string, rev: number = BASTION_REV_LADDER, limits: HumanLimits = HUMAN_LIMITS): ArcadeInputEvent[] {
  return bastionPacedPlay(seed, bastionTankGameFor(rev, level), limits).events;
}

if (import.meta.main) {
  const level = process.argv[2] ?? "normal";
  const from = Number(process.argv[3] ?? 0);
  const count = Number(process.argv[4] ?? 20);
  const game = bastionTankGameFor(BASTION_REV_LADDER, level);
  let at200 = 0;
  const t0 = performance.now();
  for (let seed = from; seed < from + count; seed++) {
    const { state } = bastionPacedPlay(seed, game);
    const score = game.score(state);
    if (score === 200) at200++;
    const parts = bastionStdParts(state)!.map((p) => `${p.key} ${p.points}/${p.max}`).join(" ");
    if (score !== 200 || count <= 20) console.log(`seed ${seed}: ${score} · ${parts} · shots ${state.shots} hits ${state.hits} weak ${state.weak} drones ${state.drones} reloads ${state.reloads} base ${state.base} end ${state.ended}@${state.endedTick}`);
  }
  console.log(`${level}: ${at200} of ${count} at 200 · ${Math.round((performance.now() - t0) / count)} ms a seed`);
}
