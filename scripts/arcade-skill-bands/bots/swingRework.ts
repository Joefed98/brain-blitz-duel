/**
 * Grappler's swinging course (swingRev 15, docs/arcade-standard/swing.md): a person swinging hook to hook with
 * short ledge runs between. On a rope they pick the release for the line they want (the next hook caught well, or
 * the landing ledge), a keen player swiping up first for a star on a tighter swing; in the air they pick the moment
 * to grab. Standing on a ledge they look at the section (reaction and thinking time) and press. Every moment is an
 * anticipated one hit with the Human's timing error; after each of their own actions they look again and re-pick.
 *
 * The "right" moments come from looking ahead with the sim's own rope physics and grab rule (swingBotKit: perception
 * only; every input goes through the real step), standing in for a player's feel. A level picks the line worth most
 * to it: the chance its own timing spread makes it (neighbouring ticks weighted by that spread), times what it is
 * worth: getting on (a hook ahead caught with a swing that can carry on, or a landing), sooner (the better levels
 * chase par) and the pickups on it (how keen a level is on gates, gems and stars). Never the score itself.
 */
import { swingBotKit as kit, SWING_INPUT_HOLD, SWING_INPUT_REEL, SWING_REEL_UP, SWING_GEM_TOUCH, SWING_STAR_TOUCH, SWING_V15_GATE_SPEED, type SwingBody, type SwingState } from "../../../src/lib/arcade/swing";
import type { SkillLevel } from "../human";
import { driveEvents, Plan, type BotCtx, type BotResult } from "../bot";

type Ev = { k: number; a: number; b: number; c: number; d: number };
const hold = (a: number): Ev => ({ k: SWING_INPUT_HOLD, a, b: 0, c: 0, d: 0 });
const reel: Ev = { k: SWING_INPUT_REEL, a: SWING_REEL_UP, b: 0, c: 0, d: 0 };
const FP = 256;

/**
 * Each level's appetite: `pickup` is what a gate, gem or star on a line is worth (in lines), `speed` what a tick
 * sooner is worth, `reel` whether it tries reeled-in star lines, `ahead` whether it looks a hook ahead (a grab that
 * sets up the next swing's pickups), `wait` the extra ms it looks at a ledge before pressing.
 */
interface Cfg { pickup: number; speed: number; reel: boolean; ahead: boolean; wait: number }
const CFG: Record<SkillLevel, Cfg> = {
  weak: { pickup: 0, speed: 0, reel: false, ahead: false, wait: 500 },
  average: { pickup: 0.04, speed: 0, reel: false, ahead: false, wait: 380 },
  good: { pickup: 0.12, speed: 0.002, reel: false, ahead: false, wait: 300 },
  great: { pickup: 0.25, speed: 0.004, reel: true, ahead: false, wait: 240 },
  near: { pickup: 0.4, speed: 0.004, reel: true, ahead: true, wait: 200 },
  elite: { pickup: 0.5, speed: 0.004, reel: true, ahead: true, wait: 170 },
  perfect: { pickup: 0.6, speed: 0.004, reel: true, ahead: true, wait: 120 },
};

export function reworkBot({ game, seed, human }: BotCtx): BotResult {
  const cfg = CFG[human.level];
  // swingRev 17: the flawless player plans as if a tick either way could happen (lines that still work a tick early or
  // late, as the other levels' spread makes them), and then plays each moment exactly. Without it the flawless bot picked
  // knife-edge lines past the sliding hooks and the gates, and fell or missed gates the elite bot took.
  const planFloor = human.level === "perfect" && (game.init(seed) as SwingState).slide ? 1 : 0;
  const sd = Math.max(human.p.timingSdMs / (1000 / 60), planFloor);
  /** Weights of a timing error of d ticks (d = −6…6) for this player. */
  const spread: [number, number][] = [];
  if (sd <= 0.05) spread.push([0, 1]);
  else {
    let total = 0;
    for (let d = -6; d <= 6; d++) {
      const w = Math.exp(-(d * d) / (2 * sd * sd));
      if (w > 0.01) {
        spread.push([d, w]);
        total += w;
      }
    }
    for (const e of spread) e[1] /= total;
  }
  const smooth = (at: (t: number) => number, t: number) => spread.reduce((sum, [d, w]) => sum + w * at(t + d), 0);
  /** The best target tick by its smoothed value (a blurred pick), or null when nothing in [lo, hi] is worth anything. */
  const choose = (values: readonly number[], lo: number): number | null => {
    const at = (t: number) => values[t] ?? 0;
    const ticks: number[] = [];
    const seen: number[] = [];
    for (let t = lo; t < values.length; t++) {
      if (at(t) <= 0) continue;
      ticks.push(t);
      seen.push(smooth(at, t));
    }
    if (ticks.length === 0) return null;
    return ticks[human.pick(seen)]!;
  };
  const err = () => human.timingTicks() + (human.slip() ? human.int(-4, 4) : 0);

  /* ---- Look-ahead on the body (perception) ---- */

  /** The section a grab of hook i puts the hero in, from section k. */
  const sectionAfter = (s: SwingState, k: number, i: number) => {
    const sec = s.sections![k]!;
    return i >= sec.hook0 + sec.hooks ? k + 1 : k;
  };
  const missed = (s: SwingState, k: number, b: SwingBody) => {
    if (kit.move(b, s)) return true;
    const sq = s.squeezes?.[s.sections![k]!.sq];
    return Boolean(sq && b.x + kit.radius > sq.x0 && b.x - kit.radius < sq.x1 && (b.y - kit.radius < sq.top || b.y + kit.radius > sq.bottom));
  };
  /** 1 if a flight from (py) to b came down on section k's landing ledge, -1 on its start ledge, 0 neither. */
  const landed = (s: SwingState, k: number, py: number, b: SwingBody) => {
    if (b.rope >= 0 || b.vy <= 0) return 0;
    const sec = s.sections![k]!;
    for (const [i, v] of [[sec.to ?? -1, 1], [sec.from ?? -1, -1]] as const) {
      if (i < 0) continue;
      const l = s.ledges![i]!;
      if (Math.abs(b.x - l.x) <= l.half && py + kit.radius <= l.top && b.y + kit.radius >= l.top) return v;
    }
    return 0;
  };
  /** Pickups not yet taken that a body at b touches or (moving from p) lights. */
  const pickupsAt = (s: SwingState, p: SwingBody, b: SwingBody, got: Set<string>) => {
    (s.gems ?? []).forEach(([x, y], i) => {
      if (!((s.gemsTaken ?? 0) & (1 << i)) && (b.x - x) ** 2 + (b.y - y) ** 2 <= SWING_GEM_TOUCH ** 2) got.add(`g${i}`);
    });
    (s.starSpots ?? []).forEach(([x, y], i) => {
      if (!(s.starsTaken ?? []).includes(i) && (b.x - x) ** 2 + (b.y - y) ** 2 <= SWING_STAR_TOUCH ** 2) got.add(`s${i}`);
    });
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    if (dx * dx + dy * dy < SWING_V15_GATE_SPEED * SWING_V15_GATE_SPEED * FP * FP) return;
    (s.gates ?? []).forEach((g, i) => {
      if ((s.gatesLit ?? 0) & (1 << i) || !(p.x < g.x && b.x >= g.x)) return;
      const y = p.y + Math.trunc((dy * (g.x - p.x)) / dx);
      if (y >= g.y0 && y <= g.y1) got.add(`t${i}`);
    });
  };
  /**
   * How well a fresh grab (in section k) carries on: the share of sampled releases whose flight can grab a hook
   * further on or lands, and (for a level that looks a hook ahead, `ahead`) the most pickups one of those lines
   * takes on the way, a reeled-in swing's included for a level that reels.
   */
  // (t0: the state tick of the grab; swingRev 17's sliding hooks are seen where they will be. Earlier revisions ignore it.)
  const carries = (s: SwingState, k: number, grab: SwingBody, ahead: boolean, t0 = s.tick): [number, number] => {
    let good = 0;
    let most = 0;
    const scan = (start: SwingBody, from: number, reeledAt: number) => {
      const rope = { ...start };
      const got = new Set<string>();
      for (let r = from; r <= 72; r++) {
        const p = { ...rope };
        if (missed(s, k, rope)) break;
        if (ahead) pickupsAt(s, p, rope, got);
        if (r % 4 || rope.om <= 0 || r < reeledAt + 2) continue;
        const f = { ...rope };
        kit.detach(f, s);
        if (f.vx <= 0) continue;
        const line = new Set(got);
        for (let t = 1; t <= 50; t++) {
          const q = { ...f };
          if (missed(s, k, f)) break;
          if (ahead) pickupsAt(s, q, f, line);
          const l = landed(s, k, q.y, f);
          if (l === -1) break;
          if (l === 1 || (t % 2 === 0 && kit.target(s, k, f.x, f.y, t0 + r + t) > grab.rope)) {
            good += reeledAt ? 0 : 1;
            most = Math.max(most, line.size);
            break;
          }
        }
        if (!ahead && good >= 3) return;
      }
    };
    scan(grab, 1, 0);
    if (ahead && cfg.reel && (s.starSpots ?? []).some(([x], i) => !(s.starsTaken ?? []).includes(i) && Math.abs(x - grab.x) < 300 * FP)) {
      // The tighter swing: swipe up early on the new rope.
      const rope = { ...grab };
      for (let u = 1; u <= 18; u++) {
        if (missed(s, k, rope)) break;
        if (u >= 6 && u % 4 === 2) {
          const b = { ...rope };
          kit.reel(b);
          scan(b, u, u);
        }
      }
    }
    return [Math.min(1, good / 3), most];
  };
  /**
   * The value of pressing at each flight tick g (1…n) of a flight starting from body f in section k (the hook let go
   * of is `from`): a hook ahead caught that carries on, pickups up to then and the ticks it takes; or a landing.
   * Also returns the landing value if the flight (no grab) lands on the section's ledge.
   */
  const flight = (s: SwingState, k: number, f0: SwingBody, from: number, before: Set<string>, ticks0: number, n = 50, t0 = s.tick) => {
    const values: number[] = [0];
    const f = { ...f0 };
    const got = new Set(before);
    let land = 0;
    let lastTo = -1;
    let lastAt = -9;
    let lastCarry: [number, number] = [0, 0];
    for (let g = 1; g <= n; g++) {
      const p = { ...f };
      if (missed(s, k, f)) break;
      pickupsAt(s, p, f, got);
      const l = landed(s, k, p.y, f);
      if (l !== 0) {
        if (l === 1) land = 1 + cfg.pickup * got.size + cfg.speed * Math.max(0, 160 - ticks0 - g);
        break;
      }
      const to = kit.target(s, k, f.x, f.y, t0 + g);
      let v = 0;
      if (to > from) {
        // Neighbouring ticks grab much the same swing: the look-ahead is made every other tick and shared.
        if (to !== lastTo || g - lastAt >= 2) {
          const grab = { ...f };
          // swingRev 17: a sliding hook is grabbed where it is then, and stops there (kit.grabView); earlier revisions as before.
          kit.attachAt(grab, to, s, t0 + g);
          lastCarry = carries(kit.grabView(s, to, t0 + g), sectionAfter(s, k, to), grab, cfg.ahead, t0 + g);
          lastTo = to;
          lastAt = g;
        }
        const [c, next] = lastCarry;
        if (c > 0) v = c * (1 + cfg.pickup * (got.size + 0.8 * next) + cfg.speed * Math.max(0, 160 - ticks0 - g));
      }
      values.push(v);
    }
    return { values, land };
  };
  /** The rope's bodies from now (index 0: the body now), up to n ticks or a miss, with the pickups touched on the way. */
  const ropeAhead = (s: SwingState, k: number, b0: SwingBody, n: number) => {
    const out: SwingBody[] = [{ ...b0 }];
    const b = { ...b0 };
    for (let i = 1; i <= n; i++) {
      if (missed(s, k, b)) break;
      out.push({ ...b });
    }
    return out;
  };
  /** Each release tick's value (index j: let go of rope[j], the event j + 1 ticks from now). */
  const releases = (s: SwingState, k: number, rope: readonly SwingBody[], offset = 0): number[] => {
    const out: number[] = [];
    const got = new Set<string>();
    for (let j = 0; j < rope.length; j++) {
      if (j > 0) pickupsAt(s, rope[j - 1]!, rope[j]!, got);
      const b = rope[j]!;
      if (b.om <= 0) { out.push(0); continue; }
      const f = { ...b };
      kit.detach(f, s);
      if (f.vx <= 0) { out.push(0); continue; }
      const { values, land } = flight(s, k, f, b.rope, got, offset + j, 50, s.tick + j);
      // The grab is timed too: its value is what the player's spread makes of the table.
      let best = land;
      for (let g = 1; g < values.length; g++) if (values[g]! > 0) best = Math.max(best, smooth((t) => values[t] ?? 0, g));
      out.push(best);
    }
    return out;
  };

  const plan = new Plan();
  let planned = "";
  let pressAt = 0;
  let waitKey = "";

  /** The hook held last (a flying hero's grab must be one further on). */
  let lastRope = -1;
  return driveEvents(game, (s: SwingState, t) => {
    if (s.rope >= 0) lastRope = s.rope;
    if ((s.respawn ?? 0) > 0) return plan.take(t);
    const total = s.sections!.length;
    const k = Math.min(s.sec ?? 0, total - 1);
    const standing = (s.ledgeOn ?? -1) >= 0;
    const stage = standing ? "ledge" : s.rope >= 0 ? `rope${s.rope}@${s.grabTick}${s.len < s.grabLen ? "r" : ""}` : `fly${s.grabTick}`;
    const key = `${k}:${s.restarts ?? 0}:${stage}`;
    if (planned === key) return plan.take(t);
    if (standing) {
      if (s.x !== s.ledges![s.ledgeOn!]!.x) return plan.take(t);
      // Looking at the section, then the press.
      if (waitKey !== key) {
        waitKey = key;
        pressAt = t + human.reactTicks() + human.thinkTicks(cfg.wait);
        plan.clear();
      }
      if (t >= pressAt) {
        planned = key;
        plan.at(t, hold(1));
      }
      return plan.take(t);
    }
    planned = key;
    const body = kit.body(s);
    if (s.rope >= 0) {
      // On a rope: the release for the best line (re-picked after a reel takes hold: the tighter swing).
      plan.dropAfter(s.tick);
      const rope = ropeAhead(s, k, body, 110);
      const values = releases(s, k, rope);
      let j = choose(values, 0);
      // A keen player looks at a reeled-in line when a star is near: swipe up, then the release on the tighter swing.
      if (cfg.reel && !stage.endsWith("r") && (s.starSpots ?? []).some(([x], i) => !(s.starsTaken ?? []).includes(i) && Math.abs(x - s.x) < 300 * FP)) {
        const plain = j === null ? 0 : smooth((q) => values[q] ?? 0, j);
        let best: [number, number] | null = null;
        for (const u of [6, 8, 10, 12, 14, 16, 18]) {
          if (u >= rope.length) break;
          const b = { ...rope[u]! };
          kit.reel(b);
          const reeled = [...rope.slice(0, u), ...ropeAhead(s, k, b, 100)];
          const rv = releases(s, k, reeled).map((v, q) => (q <= u ? 0 : v));
          const rj = choose(rv, u + 1);
          if (rj === null) continue;
          const v = smooth((q) => rv[q] ?? 0, rj);
          if (v > plain + 0.05 && (!best || v > best[1])) best = [u, v];
        }
        if (best) {
          plan.at(t + Math.max(0, best[0] + err()), reel);
          return plan.take(t);
        }
      }
      // Nothing they can see works: they let go on the upswing anyway (a guess), as anyone would.
      plan.at(t + Math.max(0, (j ?? human.int(14, 30)) + err()), hold(0));
    } else if (s.grabTick > 0 || s.tick > 0) {
      // In the air: the moment to grab.
      const { values } = flight(s, k, body, lastRope, new Set(), 0, 50, s.tick);
      const g = choose(values, 1);
      // values[g] is the target after g ticks of flight: a press on the tick after that.
      if (g !== null) plan.at(t + Math.max(0, g + Math.round(err() * 1.3)), hold(1));
    }
    return plan.take(t);
  }, game.init(seed) as SwingState);

}
