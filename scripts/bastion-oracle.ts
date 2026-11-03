/**
 * Bastion (bastionRev 2) oracle and the shared planner its skill-band bots use (scripts/arcade-skill-bands/bots/
 * bastion.ts): plays the real sim (src/lib/arcade/bastionTank.ts) with the input log a phone would record.
 *
 * The planner looks ahead the way a player reads the field: every tick it can fire it steps a copy of the run 31 ticks
 * with no input (the tanks' moves and the shells already flying are fixed, so this is the field as it will be), finds
 * for each tank the flight time whose landing point matches (a shell aimed higher flies longer), and fires at the tank
 * nearest the wall that is still owed damage, on its weak spot. With nothing worth a shell it reloads early (a swipe
 * down) and taps the needle in the green zone. The oracle is the planner with no human error; `bastionPlay` with a
 * Human adds reaction, aim, lead and tap-timing error.
 *
 * bastionRev 3 (Iron Wall) adds the drones: when one will be in the sky as a shell lands (30 ticks in the sky) the oracle
 * fires at its centre then, unless a tank is close to the wall; a human notices it a reaction time after it appears,
 * leads it from its motion with their judgement and aim, and tries a set number of times (bots/bastion.ts `droneTries`).
 *
 *   bun scripts/bastion-oracle.ts [from] [count] [rev]   prints each seed's oracle score and parts (rev 2 by default)
 */
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  bastionFlight,
  bastionPlan,
  bastionWeakOpen,
  bastionNeedle,
  bastionStdParts,
  bastionDronePos,
  bastionDroneRect,
  bastionDrones,
  bastionTankGameFor,
  bastionTankRects,
  bastionZoneW,
  BASTION_REV_TANK,
  BT2_WORLD_W,
  BT2_FAST_TICKS,
  BT2_INPUT_FIRE,
  BT2_INPUT_RANGES,
  BT2_INPUT_RELOAD,
  BT2_INPUT_TAP,
  BT2_MAG,
  BT2_RELOAD_TICKS,
  type BastionTankState,
  type Bt2Rect,
} from "../src/lib/arcade/bastionTank";
import type { Human } from "./arcade-skill-bands/human";

const LOOK = 31;

export interface BastionStyle {
  /** Aim at the weak spot (else the hull's middle) with this chance per shot. */
  weakAim: number;
  /** Reload early when idle (a swipe down). */
  earlyReload: boolean;
  /** Chance to try the fast-reload tap at all. */
  tapChance: number;
  /** Fire only once the target's weak spot is at least this tall (px). */
  minWeakH: number;
  /** bastionRev 3: shots tried at each drone (0: never). */
  droneTries?: number;
}

export const FLAWLESS: BastionStyle = { weakAim: 1, earlyReload: true, tapChance: 1, minWeakH: 2, droneTries: 1 };

function centre(r: Bt2Rect): [number, number] {
  return [Math.floor((r[0] + r[2]) / 2), Math.floor((r[1] + r[3]) / 2)];
}

/** The first tank (nearest the wall) whose rectangles contain the point at this state, or null. */
function firstAt(s: BastionTankState, x: number, y: number): number | null {
  for (const t of s.tanks) {
    const r = bastionTankRects(t.kind, t.lane, t.z);
    const inR = (q: Bt2Rect, pad = 0) => x >= q[0] - pad && x <= q[2] + pad && y >= q[1] - pad && y <= q[3] + pad;
    if (inR(r.weak, 1) || inR(r.hull) || inR(r.turret)) return t.i;
  }
  return null;
}

interface Shot {
  tank: number;
  x: number;
  y: number;
  dmg: number;
  lands: number;
}

/**
 * Plays a run. With no Human it is the oracle (exact sight, aim and timing); with one, each shot and tap carries
 * that level's errors and `style` sets what the player tries.
 */
export function bastionPlay(seed: number, human?: Human, style: BastionStyle = FLAWLESS, rev: number = BASTION_REV_TANK): { events: ArcadeInputEvent[]; state: BastionTankState } {
  const game = bastionTankGameFor(rev);
  const events: ArcadeInputEvent[] = [];
  let s = game.init(seed);
  const drones = s.rev > BASTION_REV_TANK ? bastionDrones(seed) : [];
  const droneTried = drones.map(() => 0);
  const droneSeen = drones.map((d) => d.at + (human ? human.reactTicks() : 0));
  let droneFlying = -1;
  const pending: Shot[] = [];
  let tapAt = -1;
  let tapFor = -1;
  let nextThink = 0;
  const seen = new Map<number, number>();
  while (!game.isOver(s)) {
    const t = s.tick + 1;
    let ev: Omit<ArcadeInputEvent, "t"> | null = null;
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i]!.lands < t) pending.splice(i, 1);
    for (const tank of s.tanks) if (!seen.has(tank.i)) seen.set(tank.i, s.tick + (human ? human.reactTicks() : 0));

    // The fast-reload tap, planned when the reload starts.
    if (s.reloadAt >= 0 && s.reloadTap === 0) {
      if (tapFor !== s.reloadAt) {
        tapFor = s.reloadAt;
        const want = style.tapChance >= 1 || (human?.chance(style.tapChance) ?? true);
        if (!want) tapAt = -1;
        else {
          // The needle crosses the zone's middle at this offset; the human times it with their error.
          const mid = s.zone + Math.floor(bastionZoneW(s.rev) / 2);
          const off = Math.ceil((mid * BT2_RELOAD_TICKS) / 1000) + (human ? human.timingTicks(1) : 0);
          tapAt = s.reloadAt + Math.max(1, off);
        }
      }
      if (tapAt === t) ev = { k: BT2_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 };
    }

    const canFire = s.mag > 0 && s.cool === 0 && s.reloadAt < 0;
    if (droneFlying >= 0 && pending.every((p) => p.tank !== -1 - droneFlying)) droneFlying = -1;
    if (!ev && canFire && t >= nextThink && droneFlying < 0 && drones.length && (!human || !urgent(s))) {
      // A drone: a shell aimed into the sky lands 30 ticks later; fire at where it will be then.
      for (let n = 0; n < drones.length && !ev; n++) {
        if (s.droneMask & (1 << n) || droneTried[n]! >= (style.droneTries ?? 0) || t < droneSeen[n]!) continue;
        const flight = bastionFlight(150);
        const at = bastionDronePos(drones[n]!, t + flight);
        if (!at || at.x < 6 || at.x > BT2_WORLD_W - 6) continue;
        if (!human && urgent(s, 60)) continue;
        let x = at.x;
        let y = at.y;
        if (human) {
          // Led from the drone's motion now, misjudged by the level's judgement, pointed with their aim.
          const now = bastionDronePos(drones[n]!, t);
          if (!now) continue;
          const lead = 1 + human.p.judgement * human.normal();
          x = Math.round(now.x + (at.x - now.x) * lead + human.aim(1, 1.2));
          y = Math.round(now.y + (at.y - now.y) * lead + human.aim(1, 1.2));
          x = Math.max(0, Math.min(BT2_WORLD_W, x));
        } else {
          const r = bastionDroneRect(at.x, at.y);
          x = Math.floor((r[0] + r[2]) / 2);
          y = Math.floor((r[1] + r[3]) / 2);
        }
        droneTried[n] = droneTried[n]! + 1;
        droneFlying = n;
        ev = { k: BT2_INPUT_FIRE, a: x, b: y, c: 0, d: 0 };
        pending.push({ tank: -1 - n, x, y, dmg: 0, lands: t + bastionFlight(y) });
        if (human) nextThink = t + Math.max(1, human.thinkTicks(260, 0.3));
      }
    }
    if (!ev && canFire && t >= nextThink) {
      const shot = pickShot(s, pending, seen, human, style);
      if (shot) {
        ev = { k: BT2_INPUT_FIRE, a: shot.x, b: shot.y, c: 0, d: 0 };
        pending.push({ ...shot, lands: t + bastionFlight(shot.y) });
        if (human) nextThink = t + Math.max(1, human.thinkTicks(260, 0.3));
      } else if (style.earlyReload && s.mag <= (human ? 2 : BT2_MAG - 1) && !urgent(s)) {
        // (A human tops up only once the magazine is low; the oracle whenever the field is quiet.)
        ev = { k: BT2_INPUT_RELOAD, a: 0, b: 0, c: 0, d: 0 };
      }
    }
    if (ev) recordInput(events, { ...ev, t }, BT2_INPUT_RANGES);
    s = game.step(s, inputAt(events, t));
  }
  return { events, state: s };
}

/** A tank close enough that a 1 s reload now would cost it (under 130 ticks from the wall). */
function urgent(s: BastionTankState, ticks = 130): boolean {
  return s.tanks.some((t) => t.z < t.v * ticks);
}

function pickShot(s: BastionTankState, pending: Shot[], seen: Map<number, number>, human: Human | undefined, style: BastionStyle): Omit<Shot, "lands"> | null {
  if (s.tanks.length === 0) return null;
  const game = bastionTankGameFor(s.rev);
  // The field as it will be: frames[f] is the state f ticks after the shot's tick (no further input).
  const frames: BastionTankState[] = [];
  let c = game.step(s, null);
  frames.push(c);
  for (let i = 1; i < LOOK && !game.isOver(c); i++) {
    c = game.step(c, null);
    frames.push(c);
  }
  const plan = bastionPlan(s.seed);
  const order = [...s.tanks].sort((a, b) => Math.floor(a.z / a.v) - Math.floor(b.z / b.v));
  for (const tank of order) {
    if ((seen.get(tank.i) ?? 0) > s.tick) continue;
    const owed = tank.hp - pending.filter((p) => p.tank === tank.i).reduce((a, p) => a + p.dmg, 0);
    if (owed <= 0) continue;
    const weakAim = style.weakAim >= 1 || (human?.chance(style.weakAim) ?? true);
    // Find the flight that lands on the tank: flight(y at landing) == f.
    for (let f = 18; f <= 30 && f < frames.length; f++) {
      const fr = frames[f]!;
      const tt = fr.tanks.find((x) => x.i === tank.i);
      if (!tt || tt.hp <= 0) break;
      const r = bastionTankRects(tt.kind, tt.lane, tt.z);
      const [hx, hy] = centre([r.hull[0], r.turret[1], r.hull[2], r.hull[3]]);
      const [wx, wy] = centre(r.weak);
      const [x, y] = weakAim ? [wx, wy] : [hx, hy];
      if (bastionFlight(y) !== f) continue;
      // The weak spot must be exposed when the shell lands: the oracle knows the cycle; a human judges it from the glow
      // with their timing error, and waits for the next opening.
      if (weakAim && !bastionWeakOpen(plan[tank.i]!, fr.tick + (human ? human.timingTicks(1.5) : 0))) break;
      // A human waits until the target is big enough for their aim, unless the tank is close to the wall.
      if (human) {
        const sigma = human.p.aimSdPx;
        const size = weakAim ? Math.min(r.weak[2] - r.weak[0], r.weak[3] - r.weak[1]) : Math.min(r.hull[2] - r.hull[0], r.hull[3] - r.turret[1]);
        const close = tt.z < tt.v * 100;
        if (!close && size < sigma * (weakAim ? 1.6 : 2.2)) break;
      }
      if (weakAim && r.weak[3] - r.weak[1] < style.minWeakH) break;
      if (firstAt(fr, x, y) !== tank.i) break;
      if (!human) return { tank: tank.i, x, y, dmg: weakAim ? 2 : 1 };
      // A human leads from the tank's screen motion now (no knowledge of a speed change to come), misjudges the lead a
      // little and points with their error.
      const now = bastionTankRects(tank.kind, tank.lane, tank.z);
      const [nx, ny] = weakAim ? centre(now.weak) : centre([now.hull[0], now.turret[1], now.hull[2], now.hull[3]]);
      const prev = s.tanks.find((q) => q.i === tank.i)!;
      const back = bastionTankRects(prev.kind, prev.lane, prev.z + prev.v * 4);
      const [bx, by] = weakAim ? centre(back.weak) : centre([back.hull[0], back.turret[1], back.hull[2], back.hull[3]]);
      const lead = 1 + human.p.judgement * human.normal();
      const px = nx + ((nx - bx) / 4) * f * lead + human.aim(1, 1);
      const py = ny + ((ny - by) / 4) * f * lead + human.aim(1, 1);
      const ax = Math.round(px);
      const ay = Math.round(py);
      return { tank: tank.i, x: ax, y: ay, dmg: weakAim ? 2 : 1 };
    }
  }
  return null;
}

/** The oracle's log for a seed (rev 2 by default). */
export function bastionOracleRun(seed: number, rev: number = BASTION_REV_TANK): ArcadeInputEvent[] {
  return bastionPlay(seed, undefined, FLAWLESS, rev).events;
}

/** Replays a log through the sim (the server's replay is src/lib/duel/bastion.ts). */
export function bastionPlayLog(seed: number, events: readonly ArcadeInputEvent[], rev: number = BASTION_REV_TANK): BastionTankState {
  const game = bastionTankGameFor(rev);
  let s = game.init(seed);
  const at = new Map(events.map((e) => [e.t, e]));
  while (!game.isOver(s)) s = game.step(s, at.get(s.tick + 1) ?? null);
  return s;
}

void bastionNeedle;

if (import.meta.main) {
  const from = Number(process.argv[2] ?? 0);
  const count = Number(process.argv[3] ?? 20);
  const rev = Number(process.argv[4] ?? BASTION_REV_TANK);
  const game = bastionTankGameFor(rev);
  let at200 = 0;
  const t0 = performance.now();
  for (let seed = from; seed < from + count; seed++) {
    const { state } = bastionPlay(seed, undefined, FLAWLESS, rev);
    const score = game.score(state);
    if (score === 200) at200++;
    const parts = bastionStdParts(state)!.map((p) => `${p.key} ${p.points}/${p.max}`).join(" ");
    if (score !== 200 || count <= 20) console.log(`seed ${seed}: ${score} · ${parts} · shots ${state.shots} hits ${state.hits} drones ${state.drones} reloads ${state.reloads} end ${state.ended}@${state.endedTick}`);
  }
  console.log(`${at200} of ${count} at 200 · ${Math.round((performance.now() - t0) / count)} ms a seed`);
}
