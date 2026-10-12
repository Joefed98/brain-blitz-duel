/**
 * Grappler: a person swinging. The finger is down while on a rope and up
 * while flying (as on the phone: down grabs the nearest anchor, up lets go).
 * On a rope they pick a release point on the coming swings (a pendulum is
 * predictable, so the release is an anticipated moment hit with timing
 * error); once flying they look at where they are heading (tracking lag),
 * pick the moment to grab the next anchor and press then, again with timing
 * error that grows with how far ahead the grab is. A stalactite's warning
 * shadow makes them re-plan one reaction later. Only the better levels go out
 * of their way for star anchors. Slips: a release or grab plainly mistimed.
 *
 * The "right" release and grab come from forking the real sim (fly the
 * release, test grabs geometrically or with a short swing), standing in for a
 * player's feel for the cave; the human then executes with their own noise and
 * the sim decides what happens. Decisions value forward progress and staying
 * alive (and stars for star-chasers), never the score.
 */
import { SWING_INPUT_HOLD, type SwingState } from "../../../src/lib/arcade/swing";
import { driveEvents, Plan, type SkillBot } from "../bot";

const FP = 256;
/** Mirrors of sim geometry the player sees (perception only). */
const REACH = 220 * FP;
const RADIUS = 10 * FP;
const COL = 40 * FP;
/** Chance a level goes out of its way for a star anchor it sees coming. */
const STAR_CHASE: Record<string, number> = { average: 0.1, good: 0.35, great: 0.65, near: 0.9 };
/** Pace a player wants (px a tick): trades a further anchor against time spent. */
const PACE = 4;
/** How far ahead (ticks) a player looks for a release point on the rope. */
const RELEASE_HORIZON = 150;
const FLIGHT_LOOK = 70;
/** Ticks a fresh grab must keep the ninja alive for it to count as a good grab. */
const SAFE_SWING = 40;
/** Shortest hold before letting go again (ticks). */
const MIN_HOLD = 8;

const hold = (a: number) => ({ k: SWING_INPUT_HOLD, a, b: 0, c: 0, d: 0 });

function floorAt(s: SwingState, x: number): number {
  const arr = s.floor;
  const i = Math.max(0, Math.min(arr.length - 2, Math.trunc(x / COL)));
  const f = x - i * COL;
  return arr[i]! + Math.trunc(((arr[i + 1]! - arr[i]!) * f) / COL);
}

/** Which anchor a press would take from here (nearest within reach, as the game does). */
function nearest(s: SwingState): number {
  let best = -1;
  let bestD = REACH * REACH;
  for (let i = 0; i < s.anchors.length; i++) {
    const a = s.anchors[i]!;
    if (a.x - s.x > REACH) break;
    const dx = a.x - s.x;
    const dy = a.y - s.y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const step = (s: SwingState, ev: ReturnType<typeof hold> | null) => game.step(s, ev ? { ...ev, t: s.tick + 1 } : null) as SwingState;
  const plan = new Plan();
  const history: SwingState[] = [];
  const lag = human.lagTicks();
  /** Star anchors this player decided to chase (true) or ignore (false). */
  const starChoice = new Map<number, boolean>();
  let mode: "start" | "rope" | "fly" = "start";
  let planned = false;
  let lastRope = -2;
  let lastPhase = "";
  let pressed = false;
  /** Tick of the next planned press or release, and a pending re-plan after a surprise. */
  let pendingAt = 0;
  let replanAt: number | null = null;

  const wantStar = (s: SwingState, j: number) => {
    if (!(s.starAnchors ?? []).includes(j) || (s.starsTaken ?? []).includes(j)) return false;
    let c = starChoice.get(j);
    if (c === undefined) {
      c = human.chance(STAR_CHASE[level]!);
      starChoice.set(j, c);
    }
    return c;
  };

  /** What a press from body state b would take, and how good it looks: forward progress, a swing clear of the floor, a wanted star. */
  const grabAt = (b: SwingState, from: number, ropeAnchor: number): { j: number; v: number } => {
    const j = nearest(b);
    if (j < 0 || j <= ropeAnchor) return { j: -1, v: -Infinity };
    const a = b.anchors[j]!;
    if (a.x < b.x - 20 * FP) return { j: -1, v: -Infinity };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (a.y + len + RADIUS > floorAt(b, a.x) - 12 * FP) return { j: -1, v: -Infinity };
    return { j, v: (a.x - from) / FP + (wantStar(b, j) ? 160 : 0) };
  };

  /** Runs of flight ticks where a press takes the same good anchor: a comfortable grab is a wide one. */
  const windowsOf = (vals: { j: number; v: number }[]): { start: number; len: number; value: number }[] => {
    const out: { start: number; len: number; value: number }[] = [];
    let i = 0;
    while (i < vals.length) {
      const j = vals[i]!.j;
      if (j < 0) {
        i++;
        continue;
      }
      let k = i;
      while (k < vals.length && vals[k]!.j === j) k++;
      const len = k - i;
      if (len >= 3) {
        const mid = i + Math.trunc((len - 1) / 2);
        out.push({ start: i, len, value: vals[mid]!.v + Math.min(len, 12) - PACE * mid });
      }
      i = k;
    }
    return out;
  };

  /** Fly from state f (already released) and read each tick's grab. */
  const flightGrabs = (f: SwingState, from: number, ropeAnchor: number) => {
    const vals: { j: number; v: number }[] = [];
    const states: SwingState[] = [];
    for (let k = 0; k <= FLIGHT_LOOK && !f.ended; k++) {
      states.push(f);
      vals.push(grabAt(f, from, ropeAnchor));
      f = step(f, null);
    }
    return { vals, states };
  };

  /** On a rope: the release tick (delay from now) whose flight offers the best grab, robust to a tick or two either side. */
  const planRelease = (s: SwingState): number | null => {
    const ropeAnchor = s.rope;
    const from = s.anchors[ropeAnchor]?.x ?? s.x;
    let rope = s;
    const value: number[] = [];
    const anchorX = s.anchors[ropeAnchor]!.x;
    let prev = rope;
    for (let d = 0; d <= RELEASE_HORIZON && !rope.ended; d++) {
      // A player lets go on the forward upswing (ahead of the anchor, moving forward and up), never straight after grabbing.
      const upswing = rope.x > prev.x && rope.y < prev.y && rope.x >= anchorX;
      if (d % 2 === 0) {
        if (d < MIN_HOLD || !upswing) value.push(-Infinity);
        else {
          const { vals } = flightGrabs(step(rope, hold(0)), from, ropeAnchor);
          const w = windowsOf(vals);
          value.push(w.length ? Math.max(...w.map((x) => x.value)) - PACE * d : -Infinity);
        }
      }
      prev = rope;
      rope = step(rope, null);
    }
    let best = -Infinity;
    let bestD: number | null = null;
    for (let i = 0; i < value.length; i++) {
      const v = Math.min(value[i]!, value[i - 1] ?? value[i]!, value[i + 1] ?? value[i]!);
      if (v > best) {
        best = v;
        bestD = i * 2;
      }
    }
    return bestD;
  };

  /** Flying: the grab tick (delay from now) in the best window whose swing keeps the ninja alive. */
  const planGrab = (s: SwingState, ropeAnchor: number): { start: number; len: number } | null => {
    const from = s.anchors[Math.max(0, ropeAnchor)]?.x ?? s.x;
    const { vals, states } = flightGrabs(s, from, ropeAnchor);
    const wins = windowsOf(vals).sort((a, b) => b.value - a.value);
    const safe = (d: number) => {
      let g = step(states[d]!, hold(1));
      for (let k = 0; k < SAFE_SWING && !g.ended; k++) g = step(g, null);
      return g.ended !== 2;
    };
    for (const w of wins) {
      const mid = w.start + Math.trunc((w.len - 1) / 2);
      if (safe(mid)) return { start: w.start, len: w.len };
    }
    // Nothing comfortable: the first tick anything forward is in reach.
    const any = vals.findIndex((v) => v.j >= 0);
    return any >= 0 ? { start: any, len: 1 } : null;
  };

  const init = game.init(seed) as SwingState;
  return driveEvents(game, (s: SwingState, t) => {
    history.push(s);
    const seen = history[Math.max(0, history.length - 1 - lag)]!;
    // A stalactite starting to warn is a surprise: a reaction later the player re-plans,
    // unless their next action is already under way (a few ticks off).
    const phase = (seen.rocks ?? []).map((r) => r.phase).join("");
    if (phase !== lastPhase) {
      if (lastPhase !== "" && [...phase].some((p, i) => p === "1" && lastPhase[i] === "0")) replanAt = t + human.reactTicks();
      lastPhase = phase;
    }
    if (replanAt !== null && t >= replanAt) {
      replanAt = null;
      if (mode !== "start" && pendingAt - t > 3) {
        plan.clear();
        planned = false;
      }
    }

    if (mode === "start") {
      // The ninja hangs on the first rope: put a finger down after a look, then plan the first release.
      if (!pressed) {
        pressed = true;
        plan.at(t + human.thinkTicks(700), hold(1));
      }
      const ev = plan.take(t);
      if (ev) {
        mode = "rope";
        planned = false;
        lastRope = -2;
        return ev;
      }
      return null;
    }

    const ev = plan.take(t);
    if (ev && ev.k === -1) planned = false;
    else if (ev) {
      if (ev.a === 0) {
        mode = "fly";
        lastRope = s.rope;
      } else mode = "rope";
      planned = false;
      return ev;
    }

    if (!planned && plan.size === 0) {
      planned = true;
      if (mode === "rope") {
        if (s.rope < 0) {
          // Pressed but nothing was in reach: still flying.
          mode = "fly";
          planned = false;
          return null;
        }
        const d = planRelease(s);
        if (d === null) {
          // No good release in sight: keep swinging and look again shortly.
          planned = false;
          plan.at(t + 30, { k: -1, a: 0, b: 0, c: 0, d: 0 });
          return null;
        }
        let at = d + human.timingTicks(1);
        if (human.slip(0.5)) at += (human.chance(0.5) ? 1 : -1) * human.int(6, 14);
        pendingAt = plan.at(t + Math.max(1, at), hold(0));
      } else {
        // The flight is seen a tracking lag late, so nothing earlier than that.
        const look = lag + 2;
        const g = planGrab(s, lastRope);
        if (g === null) {
          // Nothing forward in reach: a desperate press a reaction later.
          pendingAt = plan.at(t + human.reactTicks(), hold(1));
          return null;
        }
        // Pressing late (out of reach) is fatal, early just misses or takes the old anchor, so a
        // player aims early in the window by about one and a half of their own timing spread.
        const scale = 1 + g.start / 40;
        const margin = Math.round((1.5 * human.p.timingSdMs * scale) / (1000 / 60)) + 1;
        const aim = g.start + Math.min(Math.trunc((g.len - 1) / 2), margin);
        let at = Math.max(aim, look) + human.timingTicks(scale);
        if (human.slip(0.5)) at += (human.chance(0.5) ? 1 : -1) * human.int(5, 12);
        pendingAt = plan.at(t + Math.max(1, at), hold(1));
      }
    }
    return null;
  }, init);
};
