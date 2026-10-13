/**
 * Pinball: the player watches the ball fall towards the flippers and plans one
 * flip at a time. Experience stands in as the sim: from what the player has
 * seen (the state a tracking lag ago, plus the flips they have made since),
 * a fork with no flip says when and on which side the ball will reach the
 * flippers; a few flip moments around that arrival are each played forward
 * once (press, hold, release) and valued by the table points they lead to and
 * whether the ball survives. The player picks among them with their blurred
 * judgement and then executes: the press lands off the chosen tick by their
 * timing error (and the odd lapse), and is held for a human length of time.
 * If the ball's path changes before the press (a bumper or slingshot), the
 * player notices a reaction time later and plans again. The bot never looks at
 * the score; no noisy action is picked because a fork showed it succeeding.
 *
 * Game-specific constants: the planning window (0.75 s), the flip candidates
 * (every 2 ticks from 10 ticks before the arrival to 12 after), how long a flip
 * is held (10–16 ticks), the value of a lost ball (−2,500 points), and a first
 * plan needing half a reaction time (the falling ball was already in view).
 */
import { type ArcadeGame, type ArcadeInputEvent } from "../../../src/lib/arcade/engine";
import { PIN_INPUT_FLIPPERS, PIN_MID_X, type PinState } from "../../../src/lib/arcade/pinball";
import { driveEvents, type SkillBot } from "../bot";

const WINDOW = 45;
const HORIZON = 150;
const LOST = 2500;
/** The ball counts as reaching the flippers below this line (world px). */
const ARRIVE_Y = 566 * 256;

type Game = ArcadeGame<PinState, ArcadeInputEvent | null>;

const flipEvent = (mask: number): Omit<ArcadeInputEvent, "t"> => ({ k: PIN_INPUT_FLIPPERS, a: mask, b: 0, c: 0, d: 0 });

/** Steps a forked state to `tick` with a mask schedule (tick → held mask from that tick on). */
function forward(game: Game, start: PinState, until: number, maskAt: (tick: number) => number): PinState {
  let s = start;
  let held = s.held;
  while (s.tick < until && !game.isOver(s)) {
    const t = s.tick + 1;
    const want = maskAt(t);
    const ev = want !== held ? { t, ...flipEvent(want) } : null;
    held = want;
    s = game.step(s, ev);
  }
  return s;
}

/** First tick (and side) the ball reaches the flippers in a no-new-flip future, or null. */
function arrival(game: Game, start: PinState, until: number, maskAt: (tick: number) => number): { tick: number; side: number } | null {
  let s = start;
  let held = s.held;
  while (s.tick < until && !game.isOver(s)) {
    const t = s.tick + 1;
    const want = maskAt(t);
    const ev = want !== held ? { t, ...flipEvent(want) } : null;
    held = want;
    const before = s.lost;
    s = game.step(s, ev);
    if (s.lost > before) return { tick: s.tick, side: 0 };
    if (s.live && s.y >= ARRIVE_Y && s.vy >= 0) return { tick: s.tick, side: s.x < PIN_MID_X * 256 ? 0 : 1 };
  }
  return null;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const g = game as Game;
  const init = g.init(seed) as PinState;
  const history: PinState[] = [];
  const lag = human.lagTicks();
  /** The masks this player has sent, by tick (what they know they did). */
  const sentAt = new Map<number, number>();
  let mask = 0;
  const maskBefore = (tick: number): number => {
    let best = -1;
    let m = 0;
    for (const [t, v] of sentAt) if (t <= tick && t > best) {
      best = t;
      m = v;
    }
    return m;
  };

  /** The current plan: press and release ticks, side, and the ball position the plan expects at a check tick. */
  let plan: { press: number; release: number; side: number; checkTick: number; checkX: number; checkY: number } | null = null;
  let surpriseUntil = 0;
  /** No arrival in view: look again in a few ticks (a glance, not a continuous solve). */
  let lookAt = 0;

  const choose = (seen: PinState, t: number, minLead: number): void => {
    // What the player knows: the seen state plus their own flips since.
    const known = (tick: number) => (tick <= t ? maskBefore(tick) : mask);
    const base = forward(g, seen, t, known);
    const arrive = arrival(g, base, t + WINDOW, () => mask);
    if (!arrive) return;
    const earliest = t + minLead;
    const values: number[] = [];
    const options: number[] = [];
    // Option -1: no flip at all.
    for (const press of [-1, ...Array.from({ length: 12 }, (_, i) => arrive.tick - 10 + 2 * i)]) {
      if (press !== -1 && press < earliest) continue;
      const hold = 12;
      const bit = 1 << arrive.side;
      const end = forward(g, base, t + HORIZON, (tick) => (press >= 0 && tick >= press && tick < press + hold ? mask | bit : mask & ~bit));
      const lost = end.lost - base.lost;
      values.push(end.points - base.points - LOST * lost);
      options.push(press);
    }
    if (!options.length) return;
    const pick = options[human.pick(values)]!;
    if (pick < 0) {
      // Let it go (a sling or post will send it back): look again once it is past the arrival.
      plan = { press: -1, release: arrive.tick, side: arrive.side, checkTick: 0, checkX: 0, checkY: 0 };
      return;
    }
    let press = pick + human.timingTicks();
    if (human.chance(human.p.lapse)) press += Math.round((150 + 300 * human.u()) / (1000 / 60));
    press = Math.max(t + 1, press);
    const hold = 10 + human.int(0, 6);
    // Where the player expects the ball halfway to the press; a different place means its path changed.
    const checkTick = Math.max(t + 1, Math.min(press - 1, t + Math.round((press - t) / 2)));
    const at = forward(g, base, checkTick, () => mask);
    plan = { press, release: press + hold, side: arrive.side, checkTick, checkX: at.x, checkY: at.y };
  };

  return driveEvents(
    g,
    (s: PinState, t) => {
      history.push(s);
      const seen = history[Math.max(0, history.length - 1 - lag)]!;
      let want = mask;
      if (plan) {
        if (plan.press < 0) {
          if (t >= plan.release) plan = null;
        } else if (t >= plan.release) {
          want = mask & ~(1 << plan.side);
          plan = null;
        } else if (t >= plan.press) {
          want = mask | (1 << plan.side);
        } else if (plan.checkTick > 0 && seen.tick >= plan.checkTick && seen.tick === plan.checkTick) {
          // The player sees whether the ball is where they expected; if not, they react and plan again.
          const off = Math.abs(seen.x - plan.checkX) + Math.abs(seen.y - plan.checkY);
          if (off > 6 * 256) {
            plan = null;
            surpriseUntil = t + human.reactTicks();
          }
        }
      }
      const coming = seen.live && (seen.y > 520 * 256 || (seen.vy > 0 && seen.y > 330 * 256));
      if (!plan && s.live && coming && t >= surpriseUntil && t >= lookAt) {
        const lead = surpriseUntil > 0 && t - surpriseUntil < 2 ? 1 : Math.max(2, Math.round(human.reactTicks() / 2));
        choose(seen, t, lead);
        if (!plan) lookAt = t + 4;
        if (plan && plan.press >= 0 && plan.press <= t) want = mask | (1 << plan.side);
      }
      if (!s.live) want = 0;
      if (want === mask) return null;
      mask = want;
      sentAt.set(t, want);
      return flipEvent(want);
    },
    init,
  );
};
