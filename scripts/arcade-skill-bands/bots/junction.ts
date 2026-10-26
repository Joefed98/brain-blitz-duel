/**
 * Junction: a person running the lights. They watch the queues (late, with
 * tracking lag), every so often decide which roads should have green (think
 * time, blurred judgement of queue length and the patience bars), then switch:
 * reds first, then they watch the box empty and tap the new greens when they
 * judge it clear (an anticipated moment: timing error plus a read error on
 * where the last tail is, which grows with how far ahead they judge). A
 * turning car's indicator and an ambulance are surprises: noticed one
 * reaction after they show. Slips: a finger lands on the neighbouring light
 * (noticed and undone a reaction later), or an impatient green without
 * checking the box. Decisions never look at the score, only at what the
 * screen shows (queues, patience bars, indicators, ambulances).
 */
import {
  juncBuiltAt,
  juncLenOf,
  juncSpeed,
  juncStopOf,
  JUNC_APPROACHES_V2,
  JUNC_INDICATE_TICKS,
  JUNC_INPUT_TAP,
  JUNC_LIGHT_AT_V2,
  type JuncCar,
  type JuncState,
} from "../../../src/lib/arcade/junction";
import type { SkillLevel } from "../human";
import { driveEvents, type SkillBot } from "../bot";

const FP = 256;
/** Box geometry as the player sees it (mirrors the sim's drawn box; perception only). */
const HALF = 31;
const BOX = 2 * HALF * FP;
const TURN_EXTRA = 36 * FP;
const ORTH_TAIL_V2 = 24 * FP;
const DIAG_EXIT = 93_249;
const SPAWN_OUT = 20 * FP;

/** Ticks between deliberate taps (about 6–8 taps a second). */
const TAP_GAP: Record<SkillLevel, number> = { weak: 11, average: 10, good: 9, great: 8, near: 7, elite: 6, perfect: 6 };
/** The cushion a person leaves after the last tail clears before releasing crossing traffic, ms. */
const CUSHION_MS = 150;

const exitOf = (car: JuncCar) => (car.ap < 4 ? juncStopOf(car.ap) + BOX + (car.turn ? TURN_EXTRA : 0) + ORTH_TAIL_V2 : DIAG_EXIT);
const vertical = (ap: number) => ap === 0 || ap === 1;
const opposite = (ap: number) => (ap < 4 ? ap ^ 1 : -1);

function built(s: JuncState, ap: number, t: number): boolean {
  return juncBuiltAt(s.builds ?? [], ap) <= t;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const gap = TAP_GAP[level]!;
  const history: JuncState[] = [];
  const lag = human.lagTicks();

  /** The lights the player is working towards. */
  let target = 0b11;
  /** Next tick a deliberate decision is taken (think time). */
  let nextDecide = human.thinkTicks(900);
  let nextTap = 1;
  let lastRedTick = -100;
  /** Planned tick for the green taps of the current switch (null until the box is judged). */
  let greenAt: number | null = null;
  /** A noticed ambulance on a red road forces a fresh decision at this tick. */
  let urgentAt: number | null = null;
  /** Impatient: this switch skips the box check. */
  let rush = false;
  /** Taps to undo after a mis-tap: [tick to act, approach]. */
  const fixes: [number, number][] = [];
  /** Turners and ambulances the player has noticed: car id → tick it registers. */
  const noticed = new Map<number, number>();
  const seenAt = new Map<number, number>();

  const tapEvent = (ap: number) => ({ k: JUNC_INPUT_TAP, a: ap, b: 0, c: 0, d: 0 });

  /** Nearest other built light: where a slipping finger lands. */
  const neighbour = (s: JuncState, ap: number, t: number) => {
    const [x, y] = JUNC_LIGHT_AT_V2[ap]!;
    let best = -1;
    let bd = Infinity;
    for (let o = 0; o < JUNC_APPROACHES_V2; o++) {
      if (o === ap || !built(s, o, t)) continue;
      const [ox, oy] = JUNC_LIGHT_AT_V2[o]!;
      const d = (ox - x) ** 2 + (oy - y) ** 2;
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  };

  const tap = (s: JuncState, t: number, ap: number) => {
    nextTap = t + gap + (human.chance(0.3) ? 1 : 0);
    if (human.slip(0.15)) {
      const wrong = neighbour(s, ap, t);
      if (wrong >= 0) {
        fixes.push([t + human.reactTicks(), wrong]);
        return tapEvent(wrong);
      }
    }
    return tapEvent(ap);
  };

  /** Whether car c in the box blocks releasing approach x (x counts as turning if the player has noticed a turner in its queue). */
  const conflicts = (c: JuncCar, x: number, xTurns: boolean) => {
    if (c.ap === x) return false;
    if (c.ap < 4 && x < 4 && vertical(c.ap) === vertical(x) && !c.turn && !xTurns) return false;
    return true;
  };

  /** Phases a person considers: the two main-road pairs, single roads when a noticed turner rules a pair out, built diagonals. */
  const phases = (seen: JuncState, t: number) => {
    const out: number[] = [];
    const turner = [false, false, false, false];
    for (const c of seen.cars) {
      if (c.ap < 4 && c.turn && !c.cleared && c.s <= exitOf(c) && (noticed.get(c.id) ?? Infinity) <= t) turner[c.ap] = true;
    }
    if (!turner[0] && !turner[1]) out.push(0b11);
    else out.push(0b1, 0b10);
    if (!turner[2] && !turner[3]) out.push(0b1100);
    else out.push(0b100, 0b1000);
    for (let ap = 4; ap < JUNC_APPROACHES_V2; ap++) if (built(seen, ap, t)) out.push(1 << ap);
    return out;
  };

  /** How much a road wants green, as the screen shows it: waiting/approaching cars, red patience bars, a noticed ambulance. */
  const demand = (seen: JuncState, ap: number, t: number) => {
    let v = 0;
    const stop = juncStopOf(ap);
    for (const c of seen.cars) {
      if (c.ap !== ap || c.s > stop || c.s < SPAWN_OUT) continue;
      if (c.amb) {
        if ((noticed.get(c.id) ?? Infinity) <= t) v += 8;
        continue;
      }
      const left = c.patience > 0 ? c.wait / c.patience : 0;
      v += (c.kind === 1 ? 1.3 : 1) + 4 * left * left;
    }
    return v;
  };

  const decide = (seen: JuncState, t: number) => {
    const opts = phases(seen, t);
    const values = opts.map((ph) => {
      let v = 0;
      for (let ap = 0; ap < JUNC_APPROACHES_V2; ap++) if ((ph >> ap) & 1) v += demand(seen, ap, t);
      // Switching costs a box-clearing pause, so a person sticks with what is flowing unless clearly worse.
      if (ph === target) v += 1.5;
      return v;
    });
    const k = human.pick(values);
    const next = opts[k]!;
    if (next !== target) {
      target = next;
      greenAt = null;
      rush = human.slip(0.25);
    }
  };

  const init = game.init(seed) as JuncState;
  return driveEvents(game, (s: JuncState, t) => {
    history.push(s);
    const seen = history[Math.max(0, history.length - 1 - lag)]!;

    // Surprises: an indicator or an ambulance coming on screen, noticed one reaction later.
    for (const c of seen.cars) {
      if (seenAt.has(c.id)) continue;
      const toLine = (juncStopOf(c.ap) - c.s) / juncSpeed(seen.tick);
      const visible = c.amb ? c.s > SPAWN_OUT : c.ap < 4 && c.turn && toLine < JUNC_INDICATE_TICKS;
      if (!visible) continue;
      seenAt.set(c.id, t);
      noticed.set(c.id, t + human.reactTicks());
    }
    // React to a noticed turner heading into a green pair: stop whichever side is easier, then re-plan.
    for (const c of seen.cars) {
      if (!(c.ap < 4 && c.turn && !c.cleared) || noticed.get(c.id) !== t) continue;
      const opp = opposite(c.ap);
      if (((target >> c.ap) & 1) && ((target >> opp) & 1)) {
        const oppBusy = seen.cars.some((o) => o.ap === opp && !o.amb && o.s > juncStopOf(opp) - 60 * FP && o.s - juncLenOf(o) < exitOf(o));
        target &= ~(1 << (oppBusy ? c.ap : opp));
        greenAt = null;
        rush = false;
        nextDecide = t + human.thinkTicks(700);
      }
    }
    // A noticed ambulance makes the player look again straight away.
    for (const c of seen.cars) if (c.amb && noticed.get(c.id) === t && !((target >> c.ap) & 1)) urgentAt = t + human.thinkTicks(250);
    if (urgentAt !== null && t >= urgentAt) {
      // Even mid-switch: re-plan around the ambulance.
      urgentAt = null;
      decide(seen, t);
      nextDecide = t + human.thinkTicks(800);
    }

    if (s.lights === target) greenAt = null;
    if (t >= nextDecide && s.lights === target) {
      decide(seen, t);
      nextDecide = t + human.thinkTicks(800);
    } else if (t >= nextDecide) {
      nextDecide = t + human.thinkTicks(400);
    }

    if (t < nextTap) return null;
    // Undo a mis-tap first.
    const fix = fixes.findIndex(([at]) => at <= t);
    if (fix >= 0) {
      const [, ap] = fixes.splice(fix, 1)[0]!;
      // Only undo if the light is still wrong for the plan.
      if (((s.lights >> ap) & 1) !== ((target >> ap) & 1)) {
        nextTap = t + gap;
        return tapEvent(ap);
      }
    }
    // Reds first.
    const reds = s.lights & ~target;
    if (reds) {
      for (let ap = 0; ap < JUNC_APPROACHES_V2; ap++)
        if ((reds >> ap) & 1) {
          lastRedTick = t;
          greenAt = null;
          return tap(s, t, ap);
        }
    }
    const greens = target & ~s.lights;
    if (!greens) return null;
    let first = -1;
    for (let ap = 0; ap < JUNC_APPROACHES_V2; ap++) if ((greens >> ap) & 1 && built(s, ap, t)) { first = ap; break; }
    if (first < 0) return null;
    if (greenAt === null) {
      if (rush) greenAt = t + human.int(0, 3);
      else {
        // Wait until the screen shows the reds have taken effect, then judge when the box empties.
        if (seen.tick < lastRedTick + 2) return null;
        const speed = juncSpeed(seen.tick) / FP;
        let clear = seen.tick;
        const turns = new Set<number>();
        for (const c of seen.cars) if (c.turn && c.s <= juncStopOf(c.ap) && (noticed.get(c.id) ?? Infinity) <= t) turns.add(c.ap);
        for (const c of seen.cars) {
          if (c.amb || c.s <= juncStopOf(c.ap) || c.s - juncLenOf(c) >= exitOf(c)) continue;
          let blocks = false;
          for (let ap = 0; ap < JUNC_APPROACHES_V2; ap++) if ((target >> ap) & 1 && conflicts(c, ap, turns.has(ap))) blocks = true;
          if (!blocks) continue;
          const px = (exitOf(c) + juncLenOf(c) - c.s) / FP;
          clear = Math.max(clear, seen.tick + px / speed);
        }
        const ahead = Math.max(0, clear - t);
        // Commit once the last tail is about to go; the read is noisier the further ahead it is judged.
        if (ahead > 24) return null;
        // Where the last tail is (a read in phone px; world px are phone px here) and when to tap (an anticipated moment).
        const readScale = 0.5 + ahead / 40;
        const timeScale = 1 + ahead / 30;
        const readPx = human.aim(1, readScale);
        // A player learns their own spread and leaves a cushion of about 1.5 of it on top of a fixed one.
        const sd = Math.hypot((human.p.aimSdPx * readScale) / speed, (human.p.timingSdMs * timeScale) / (1000 / 60));
        greenAt = Math.round(clear + CUSHION_MS / (1000 / 60) + 1.5 * sd - readPx / speed + human.timingTicks(timeScale));
        greenAt = Math.max(greenAt, t);
      }
    }
    if (t < greenAt) return null;
    return tap(s, t, first);
  }, init);
};
