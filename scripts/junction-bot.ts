/**
 * A Junction bot for checks: every few ticks it tries each safe light phase
 * (the two opposite main-road pairs, or any single built road), simulates
 * ahead with the real sim, and keeps the phase with the best outcome (no
 * crash, most vehicles through, fewest drivers near giving up). It switches
 * lights the way a phone does, one tap per tick, reds first. Inputs go
 * through recordInput, so the run replays on the server exactly.
 */
import { inputAt, recordInput, type ArcadeGame, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { juncBuiltAt, juncCheckpoint, JUNC_CHECKPOINT_INTERVAL, JUNC_INPUT_TAP, type JuncState } from "../src/lib/arcade/junction";

export interface JuncBotRun {
  state: JuncState;
  events: ArcadeInputEvent[];
  checkpoints: ReturnType<typeof juncCheckpoint>[];
}

function phases(s: JuncState, approaches: number): number[] {
  const out = [0b11, 0b1100];
  for (let ap = 0; ap < approaches; ap++) if (juncBuiltAt(s.builds ?? [], ap) <= s.tick) out.push(1 << ap);
  return out;
}

/** Taps (approach ids) that turn `from` into `to`: reds first, then greens. */
function taps(from: number, to: number, approaches: number): number[] {
  const off: number[] = [];
  const on: number[] = [];
  for (let ap = 0; ap < approaches; ap++) {
    const a = (from >> ap) & 1;
    const b = (to >> ap) & 1;
    if (a && !b) off.push(ap);
    if (!a && b) on.push(ap);
  }
  return [...off, ...on];
}

function pressure(s: JuncState): number {
  let p = 0;
  for (const car of s.cars) if (!car.amb && car.wait > 0) p += (car.wait / car.patience) ** 2;
  return p;
}

export function playJunction(game: ArcadeGame<JuncState, ArcadeInputEvent | null>, seed: number, opts: { horizon?: number; every?: number; points?: (s: JuncState) => number } = {}): JuncBotRun {
  const horizon = opts.horizon ?? 150;
  const every = opts.every ?? 8;
  const value = opts.points ?? ((s: JuncState) => game.score(s));
  const approaches = (game.inputRanges?.[0]?.a[1] ?? 3) + 1;
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: ReturnType<typeof juncCheckpoint>[] = [];
  let queue: number[] = [];
  while (!game.isOver(s)) {
    if (!queue.length && s.tick % every === 0) {
      let best = -Infinity;
      let pick = s.lights;
      for (const target of phases(s, approaches)) {
        let p = s;
        const plan = taps(s.lights, target, approaches);
        for (let h = 0; h < horizon && !game.isOver(p); h++) {
          const ap = plan[h];
          p = game.step(p, ap === undefined ? null : { t: p.tick + 1, k: JUNC_INPUT_TAP, a: ap, b: 0, c: 0, d: 0 });
        }
        const crashed = p.ended === 2;
        const v = (crashed ? -1e9 : 0) + value(p) * 10 + p.cleared * 4 - p.gaveUp * 6 - pressure(p) * 3 - plan.length * 0.2 + (target === s.lights ? 0.5 : 0);
        if (v > best) {
          best = v;
          pick = target;
        }
      }
      queue = taps(s.lights, pick, approaches);
    }
    const t = s.tick + 1;
    const ap = queue.shift();
    if (ap !== undefined) recordInput(events, { t, k: JUNC_INPUT_TAP, a: ap, b: 0, c: 0, d: 0 }, game.inputRanges);
    s = game.step(s, inputAt(events, t));
    if (s.tick % JUNC_CHECKPOINT_INTERVAL === 0) checkpoints.push(juncCheckpoint(s));
  }
  return { state: s, events, checkpoints };
}
