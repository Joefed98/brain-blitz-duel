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
 *
 * swingRev 13 (the expansion): the better levels also go out of their way for
 * the high-route gems, the low-route speed gates and the set-route ledges
 * (each a level's chance per feature they see, like stars), and keep a quicker
 * tempo for swing combos; the forked flights already land on ledges, take gems
 * and light gates, so a wanted one simply adds to that plan's value.
 */
import { SWING_INPUT_HOLD, SWING_INPUT_REEL, SWING_REEL_UP, type SwingState } from "../../../src/lib/arcade/swing";
import { driveEvents, Plan, type SkillBot } from "../bot";

const FP = 256;
/** Mirrors of sim geometry the player sees (perception only). */
const REACH = 220 * FP;
const RADIUS = 10 * FP;
const COL = 40 * FP;
/** Chance a level goes out of its way for a star anchor it sees coming. */
const STAR_CHASE: Record<string, number> = { average: 0.1, good: 0.35, great: 0.65, near: 0.9 };
/**
 * swingRev 13 (the 200 expansion): each tier's appetite for the features, keyed by the Human's tier so the weak and
 * elite players differ from the average and near-perfect ones they play as. Chances are per feature seen (a star,
 * gem, gate or section), pulls are what a wanted one is worth in px of progress; `section` is the chance a player
 * follows a set route they land on through to its flag (each ledge's release found by watching the swing), `press`
 * the extra ticks they take to press after landing on a ledge (on top of a tick), `pumpLook` how many ticks of
 * swinging they will wait through for the release that lands on the next ledge.
 */
interface TierCfg { gemLook: number; gateLook: number; minRun: number; star: number; gem: number; gate: number; ledge: number; section: number; starPull: number; gemPull: number; gatePull: number; ledgePull: number; pace: number; press: [number, number]; pumpLook: number }
const TIER_CFG: Record<string, TierCfg> = {
  weak: { gemLook: 0, gateLook: 0, minRun: 3, star: 0.05, gem: 0.02, gate: 0.02, ledge: 0, section: 0, starPull: 250, gemPull: 180, gatePull: 150, ledgePull: 900, pace: 4, press: [14, 30], pumpLook: 120 },
  average: { gemLook: 0, gateLook: 0, minRun: 3, star: 0.1, gem: 0.05, gate: 0.05, ledge: 0, section: 0, starPull: 250, gemPull: 180, gatePull: 150, ledgePull: 900, pace: 4, press: [10, 24], pumpLook: 150 },
  good: { gemLook: 0.1, gateLook: 0.1, minRun: 3, star: 0.35, gem: 0.25, gate: 0.25, ledge: 0.2, section: 0.3, starPull: 250, gemPull: 180, gatePull: 150, ledgePull: 900, pace: 4.5, press: [6, 16], pumpLook: 220 },
  great: { gemLook: 0.3, gateLook: 0.3, minRun: 3, star: 0.65, gem: 0.6, gate: 0.6, ledge: 0.55, section: 0.7, starPull: 250, gemPull: 180, gatePull: 150, ledgePull: 900, pace: 5.5, press: [3, 10], pumpLook: 300 },
  near: { gemLook: 0.5, gateLook: 0.5, minRun: 2, star: 0.9, gem: 0.9, gate: 0.9, ledge: 0.9, section: 0.9, starPull: 250, gemPull: 180, gatePull: 150, ledgePull: 900, pace: 6.5, press: [2, 7], pumpLook: 420 },
  elite: { gemLook: 1, gateLook: 1, minRun: 2, star: 1, gem: 1, gate: 1, ledge: 1, section: 1, starPull: 320, gemPull: 260, gatePull: 220, ledgePull: 1100, pace: 6.5, press: [0, 3], pumpLook: 420 },
};
/** Window key offset for presses made standing on a ledge. */
const STANDING = 1_000_000;
/** Pace a player wants (px a tick): trades a further anchor against time spent. */
const PACE = 4;
/** How much a star-chaser values a star anchor, in px of progress. */
const STAR_PULL = 250;
/** How far ahead (ticks) a player looks for a release point on the rope. */
const RELEASE_HORIZON = 150;
const FLIGHT_LOOK = 70;
/** Ticks a fresh grab must keep the ninja alive for it to count as a good grab. */
const SAFE_SWING = 70;
/** Shortest hold before letting go again (ticks). */
const MIN_HOLD = 8;
/** Quickest let-go-then-press a finger makes (ticks, ~80 ms). */
const REGRAB_MIN = 5;

/** What a missed grab (a fall) weighs against progress in px when choosing. */
const MISS_COST = 400;

/** Standard normal CDF. */
function phi(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

const hold = (a: number) => ({ k: SWING_INPUT_HOLD, a, b: 0, c: 0, d: 0 });
/** swingRev 13: a swipe that reels the rope in (one step), and the ticks a player leaves between two. */
const reelUp = { k: SWING_INPUT_REEL, a: SWING_REEL_UP, b: 0, c: 0, d: 0 };
const REEL_GAP = 10;

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
  const cfg = TIER_CFG[human.tier] ?? TIER_CFG[level]!;
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
  /** The grab window planned together with the coming release (ticks after it). */
  let seqGrab: { start: number; len: number } | null = null;

  const wantStar = (s: SwingState, j: number) => {
    if (!(s.starAnchors ?? []).includes(j) || (s.starsTaken ?? []).includes(j)) return false;
    let c = starChoice.get(j);
    if (c === undefined) {
      c = human.chance(s.expand ? cfg.star : STAR_CHASE[level]!);
      starChoice.set(j, c);
    }
    return c;
  };

  /** swingRev 6: the stars taken when this plan started; touch stars taken since that the player wants. */
  let originTaken = 0;
  /** swingRev 13: the gems, gates and ledges taken when this plan started. */
  let originGems = 0;
  let originGates = 0;
  let originLedges: number[] = [];
  const wants = (key: number, chance: number) => {
    let c = starChoice.get(key);
    if (c === undefined) {
      c = human.chance(chance);
      starChoice.set(key, c);
    }
    return c;
  };
  const pickups = (b: SwingState) => {
    if (!b.starSpots) return 0;
    let n = 0;
    for (const i of (b.starsTaken ?? []).slice(originTaken)) if (wants(10_000 + i, b.expand ? cfg.star : STAR_CHASE[level]!)) n++;
    return n;
  };
  /** swingRev 13: the value (px) of the wanted gems, gates and ledges taken since the plan started. */
  const extras = (b: SwingState) => {
    if (!b.expand) return 0;
    let v = 0;
    const gems = (b.gemsTaken ?? 0) & ~originGems;
    const gates = (b.gatesLit ?? 0) & ~originGates;
    for (let i = 0; i < 16; i++) {
      if (gems & (1 << i) && wants(20_000 + i, cfg.gem)) v += cfg.gemPull;
      if (gates & (1 << i) && wants(30_000 + i, cfg.gate)) v += cfg.gatePull;
    }
    (b.ledgeTicks ?? []).forEach((t, i) => {
      if (t > 0 && !(originLedges[i]! > 0) && wants(40_000 + i, cfg.ledge)) v += cfg.ledgePull;
    });
    return v;
  };
  const markOrigin = (s: SwingState) => {
    originTaken = (s.starsTaken ?? []).length;
    originGems = s.gemsTaken ?? 0;
    originGates = s.gatesLit ?? 0;
    originLedges = s.ledgeTicks ?? [];
  };
  const starPull = (b: SwingState) => (b.expand ? cfg.starPull : STAR_PULL);
  const pace = (s: SwingState) => (s.expand ? cfg.pace : PACE);

  /** What a press from body state b would take, and how good it looks: forward progress, a swing clear of the floor, a wanted star. */
  const grabAt = (b: SwingState, from: number, ropeAnchor: number): { j: number; v: number } => {
    const j = nearest(b);
    if (j < 0 || j <= ropeAnchor) return { j: -1, v: -Infinity };
    const a = b.anchors[j]!;
    if (a.x < b.x - 80 * FP) return { j: -1, v: -Infinity };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (a.y + len + RADIUS > floorAt(b, a.x) - 12 * FP) return { j: -1, v: -Infinity };
    // swingRev 13: a press while standing on a ledge is its own window (they wait for the landing).
    return { j: (b.ledgeOn ?? -1) >= 0 ? j + STANDING : j, v: (a.x - from) / FP + (wantStar(b, j) ? starPull(b) : 0) + pickups(b) * starPull(b) + extras(b) };
  };

  let paceNow = PACE;
  /** Own timing spread (ticks) for a press `start` ticks into a flight, and where in a window they aim. */
  const spread = (start: number) => (human.p.timingSdMs * (1 + start / 40)) / (1000 / 60);
  const aimIn = (start: number, len: number) => start + Math.min(Math.trunc((len - 1) / 2), Math.round(1.5 * spread(start)) + 1);
  const hitChance = (start: number, len: number) => {
    const sd = Math.max(0.3, spread(start));
    const a = aimIn(start, len);
    return Math.max(0, phi((start + len - 0.5 - a) / sd) - phi((start - 0.5 - a) / sd));
  };

  /** Runs of flight ticks where a press takes the same good anchor: a comfortable grab is a wide one. */
  const windowsOf = (vals: { j: number; v: number }[], from = 0): { start: number; len: number; value: number }[] => {
    const out: { start: number; len: number; value: number }[] = [];
    let i = from;
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
        // A player knows roughly how reliably they can hit a window this wide this far ahead,
        // and weighs the progress against the fall that a miss means.
        const hit = hitChance(i, len);
        out.push({ start: i, len, value: vals[mid]!.v * hit - MISS_COST * (1 - hit) - paceNow * mid });
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
  const planRelease = (s: SwingState): { d: number; grab: { start: number; len: number } | null; onto?: number; reels?: number } | null => {
    // swingRev 13: a wanted section's start ledge ahead: let go to land on it if this swing can.
    if (s.expand) {
      const target = startAhead(s);
      if (target >= 0) {
        const onto = ontoPlan(s, target, RELEASE_HORIZON);
        if (onto) return { d: onto.d, grab: null, onto: target, reels: onto.reels };
      }
      const gem = gemPlan(s);
      if (gem) return gem;
    }
    markOrigin(s);
    paceNow = pace(s);
    const ropeAnchor = s.rope;
    const from = s.anchors[ropeAnchor]?.x ?? s.x;
    let rope = s;
    const value: number[] = [];
    const grabs: ({ start: number; len: number } | null)[] = [];
    const anchorX = s.anchors[ropeAnchor]!.x;
    let prev = rope;
    for (let d = 0; d <= RELEASE_HORIZON && !rope.ended; d++) {
      // A player lets go on the forward upswing (ahead of the anchor, moving forward and up), never straight after grabbing.
      const upswing = rope.x > prev.x && rope.y < prev.y && rope.x >= anchorX;
      if (d % 2 === 0) {
        if (d < MIN_HOLD || !upswing) {
          value.push(-Infinity);
          grabs.push(null);
        } else {
          // A let-go-and-regrab is one planned movement, so the grab may come soon after the release.
          const { vals } = flightGrabs(step(rope, hold(0)), from, ropeAnchor);
          const w = windowsOf(vals, REGRAB_MIN);
          let top = null as { start: number; len: number; value: number } | null;
          for (const x of w) if (!top || x.value > top.value) top = x;
          value.push(top ? top.value - paceNow * d : -Infinity);
          grabs.push(top);
        }
      }
      prev = rope;
      rope = step(rope, null);
    }
    const order = value
      .map((_, i) => ({ i, v: Math.min(value[i]!, value[i - 1] ?? value[i]!, value[i + 1] ?? value[i]!) }))
      .filter((x) => x.v > -Infinity)
      .sort((a, b) => b.v - a.v);
    // The player's feel for the cave: the best few, checked for a grab that does not swing them into something.
    for (const { i } of order.slice(0, 12)) {
      const g = grabs[i]!;
      let f = s;
      for (let k = 0; k < i * 2; k++) f = step(f, null);
      f = step(f, hold(0));
      const aim = aimIn(g.start, g.len);
      for (let k = 0; k < aim && !f.ended; k++) f = step(f, null);
      f = step(f, hold(1));
      for (let k = 0; k < SAFE_SWING && !f.ended; k++) f = step(f, null);
      if (f.ended !== 2) return { d: i * 2, grab: g };
    }
    // Nothing safe in sight: keep swinging and look again.
    return null;
  };

  /** Flying: the grab tick (delay from now) in the best window whose swing keeps the ninja alive. */
  const planGrab = (s: SwingState, ropeAnchor: number): { start: number; len: number } | null => {
    markOrigin(s);
    paceNow = pace(s);
    const from = s.anchors[Math.max(0, ropeAnchor)]?.x ?? s.x;
    const { vals, states } = flightGrabs(s, from, ropeAnchor);
    // swingRev 13: a wanted section's start ledge ahead: a grab whose swing can let go on to it (the first run of such grab ticks).
    if (s.expand && (s.ledgeOn ?? -1) < 0) {
      const target = startAhead(s);
      if (target >= 0) {
        let run: [number, number] | null = null;
        let at = -1;
        for (let d = lag + 2; d < states.length; d++) {
          const ok = vals[d]!.j >= 0 && ontoPlan(step(states[d]!, hold(1)), target, RELEASE_HORIZON) !== null;
          if (ok && at < 0) at = d;
          if (at >= 0 && (!ok || d === states.length - 1)) {
            const len = d - at + (ok ? 1 : 0);
            if (!run || len > run[1]) run = [at, len];
            at = -1;
            if (run[1] >= 3) break;
          }
        }
        if (run) return { start: run[0], len: run[1] };
      }
      const gate = gateGrab(s, vals, states);
      if (gate) return gate;
    }
    const wins = windowsOf(vals, lag + 2).sort((a, b) => b.value - a.value);
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

  /**
   * swingRev 13: standing on set-route ledge `on` at tick t − 1. A player following the route presses soon after the
   * landing (their own delay) and, watching the swing, lets go at the moment whose flight lands on the next ledge
   * (forking the real sim stands in for their feel for it; the earliest such moment with a tick to spare either side,
   * within how long they will wait), executed with their own timing error. Null when there is no next ledge (the
   * flag), they are not following this section, or no release they would wait for lands.
   */
  let lastLedge = -1;
  let ledgeFlight = -1;
  /**
   * swingRev 13: on a rope at state f, the release moments (one a tick, up to `horizon` ticks ahead) whose flight
   * lands on ledge i: the player aims at the middle of the first run of them at least cfg.minRun ticks long (else 2,
   * else any): the near-perfect and elite players trust themselves with a 2-tick window, the rest wait for 3.
   * Returns the ticks to wait before letting go (the let-go on tick f.tick + d + 1), or -1.
   */
  const landingRelease = (f: SwingState, i: number, horizon: number): number => {
    const lands: boolean[] = [];
    let rope = f;
    const runs: [number, number][] = [];
    let runStart = -1;
    for (let r = 0; r <= horizon && !rope.ended && rope.rope >= 0; r++) {
      let fly = step(rope, hold(0));
      for (let k = 0; k < 110 && !fly.ended && (fly.ledgeOn ?? -1) < 0; k++) fly = step(fly, null);
      const ok = !fly.ended && fly.ledgeOn === i;
      lands.push(ok);
      if (ok && runStart < 0) runStart = r;
      if (!ok && runStart >= 0) {
        runs.push([runStart, r - runStart]);
        runStart = -1;
        if (runs.at(-1)![1] >= cfg.minRun) break;
      }
      rope = step(rope, null);
    }
    if (runStart >= 0) runs.push([runStart, lands.length - runStart]);
    const pickRun = runs.find((x) => x[1] >= cfg.minRun) ?? runs.find((x) => x[1] >= 2) ?? runs[0];
    return pickRun ? pickRun[0] + Math.trunc((pickRun[1] - 1) / 2) : -1;
  };
  /**
   * swingRev 13: on a rope at state f, a way down on to ledge i: reel in 0, 1 or 2 times first (a swipe on the next
   * tick and REEL_GAP ticks later; a shorter rope swings higher and lands nearer), then the release landingRelease finds.
   * `d` counts ticks from f to the let-go, as landingRelease does.
   */
  const ontoPlan = (f: SwingState, i: number, horizon: number): { reels: number; d: number } | null => {
    for (let reels = 0; reels <= 2; reels++) {
      let g = f;
      const steps = reels * REEL_GAP;
      // Swipes on the ticks f.tick + 2, + 2 + REEL_GAP (the planning tick's own input is already spent).
      for (let k = 0; k < steps && !g.ended; k++) g = step(g, k % REEL_GAP === 1 ? reelUp : null);
      if (g.ended || g.rope < 0) return null;
      const d = landingRelease(g, i, horizon);
      if (d >= 0) return { reels, d: d + steps };
    }
    return null;
  };
  /**
   * swingRev 13: on a rope, a release (after 0, 1 or 2 reels) whose flight touches a wanted gem ahead and still has a
   * safe grab after it: a player who goes for gems watches for the swing that carries them through one. Tiers search
   * this often (`gemLook`: the chance per gem they see); the earliest such release in a run of `minRun` ticks.
   */
  const gemPlan = (s: SwingState): { d: number; grab: { start: number; len: number }; reels: number } | null => {
    const taken = s.gemsTaken ?? 0;
    const gi = (s.gems ?? []).findIndex(([gx], i) => !(taken & (1 << i)) && gx > s.x && gx - s.x < 460 * FP && wants(60_000 + i, cfg.gemLook));
    if (gi < 0) return null;
    // With the dragon out they take only a detour its lead allows (it flies 4 px a tick; keep 160 px and a second spare).
    const maxD = s.chaseX ? Math.trunc(((s.x - s.chaseX) / FP - 160) / 4) - 60 : RELEASE_HORIZON;
    if (maxD < 0) return null;
    const ropeAnchor = s.rope;
    const from = s.anchors[ropeAnchor]?.x ?? s.x;
    const anchorX = s.anchors[ropeAnchor]!.x;
    for (let reels = 0; reels <= 2; reels++) {
      let g = s;
      const steps = reels * REEL_GAP;
      for (let k = 0; k < steps && !g.ended; k++) g = step(g, k % REEL_GAP === 1 ? reelUp : null);
      if (g.ended || g.rope < 0) return null;
      let rope = g;
      let prev = g;
      let run = 0;
      for (let d = 0; d + steps <= Math.min(RELEASE_HORIZON, maxD) && !rope.ended; d++) {
        const upswing = rope.x > prev.x && rope.y < prev.y && rope.x >= anchorX;
        let hit = false;
        let grab: { start: number; len: number } | null = null;
        if (d + steps >= MIN_HOLD && upswing) {
          let fly = step(rope, hold(0));
          let k = 0;
          for (; k < 90 && !fly.ended && !((fly.gemsTaken ?? 0) & (1 << gi)); k++) fly = step(fly, null);
          if (!fly.ended && (fly.gemsTaken ?? 0) & (1 << gi)) {
            const { vals, states } = flightGrabs(fly, from, ropeAnchor);
            for (const w of windowsOf(vals, 0).sort((a, b) => b.value - a.value)) {
              const mid = w.start + Math.trunc((w.len - 1) / 2);
              let q = step(states[mid]!, hold(1));
              for (let n = 0; n < SAFE_SWING && !q.ended; n++) q = step(q, null);
              if (q.ended !== 2) {
                grab = { start: w.start + k, len: w.len };
                break;
              }
            }
            hit = grab !== null;
          }
        }
        run = hit ? run + 1 : 0;
        if (hit && run >= cfg.minRun) return { d: d + steps - Math.trunc((run - 1) / 2), grab: grab!, reels };
        prev = rope;
        rope = step(rope, null);
      }
    }
    return null;
  };
  /**
   * swingRev 13: flying, the grab ticks of the anchor a wanted speed gate hangs under whose swing lights it (the first
   * run of them), for the tiers that look for gates (`gateLook`, a chance per gate they see).
   */
  const gateGrab = (s: SwingState, vals: { j: number }[], states: SwingState[]): { start: number; len: number } | null => {
    const lit = s.gatesLit ?? 0;
    const gi = (s.gates ?? []).findIndex((g, i) => !(lit & (1 << i)) && g.x > s.x && g.x - s.x < 380 * FP && wants(70_000 + i, cfg.gateLook));
    if (gi < 0) return null;
    const anchor = s.anchors.findIndex((a) => a.x === s.gates![gi]!.x);
    let at = -1;
    for (let d = lag + 2; d < states.length; d++) {
      let ok = false;
      if (vals[d]!.j === anchor) {
        let q = step(states[d]!, hold(1));
        let k = 0;
        for (; k < 90 && !q.ended && !((q.gatesLit ?? 0) & (1 << gi)); k++) q = step(q, null);
        if (!q.ended && (q.gatesLit ?? 0) & (1 << gi)) {
          for (let n = 0; n < SAFE_SWING && !q.ended; n++) q = step(q, null);
          ok = q.ended !== 2;
        }
      }
      if (ok && at < 0) at = d;
      if (at >= 0 && (!ok || d === states.length - 1)) {
        const len = d - at + (ok ? 1 : 0);
        if (len >= cfg.minRun) return { start: at, len };
        at = -1;
      }
    }
    return null;
  };
  /** swingRev 13: the start ledge of a wanted section a little ahead (not yet landed on), or -1. */
  const startAhead = (s: SwingState): number =>
    (s.ledges ?? []).findIndex((l, i) => l.kind === 0 && !(s.ledgeTicks?.[i] ?? 0) && l.x > s.x - 40 * FP && l.x - s.x < 420 * FP && wants(50_000 + l.section, cfg.section));
  const ledgeRoute = (s: SwingState, on: number, t: number): { press: number; release: number; next: number } | null => {
    const l = s.ledges?.[on];
    if (!l) return null;
    const next = s.ledges!.findIndex((q) => q.section === l.section && q.order === l.order + 1);
    if (next < 0 || !wants(50_000 + l.section, cfg.section)) return null;
    const press = t + Math.max(0, Math.round(cfg.press[0] + (cfg.press[1] - cfg.press[0]) * human.u()));
    let f = s;
    while (f.tick + 1 < press && !f.ended) f = step(f, null);
    f = step(f, hold(1));
    for (let g = 0; g < 30 && f.rope < 0 && !f.ended; g++) f = step(f, null);
    if (f.rope < 0 || f.ended) return null;
    const found = landingRelease(f, next, cfg.pumpLook);
    if (found < 0) return null;
    // The let-go on tick f.tick + found + 1 (as forked), with their timing error on a watched swing.
    let release = f.tick + found + 1 + human.timingTicks(1);
    if (human.slip(0.25)) release += (human.chance(0.5) ? 1 : -1) * human.int(3, 8);
    return { press, release: Math.max(f.tick + 1, release), next };
  };
  /** swingRev 13: does the flight from s (off the rope) come down on ledge i? */
  const fliesOnto = (s: SwingState, i: number) => {
    let f = s;
    for (let k = 0; k < 110 && !f.ended && (f.ledgeOn ?? -1) < 0; k++) f = step(f, null);
    return !f.ended && f.ledgeOn === i;
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

    // swingRev 13: a landing on a set-route ledge: follow the route, or plan as usual from the standing state.
    const on = s.expand ? (s.ledgeOn ?? -1) : -1;
    if (on !== lastLedge) {
      lastLedge = on;
      if (on >= 0) {
        plan.clear();
        seqGrab = null;
        ledgeFlight = -1;
        mode = "fly";
        planned = false;
        const route = ledgeRoute(s, on, t);
        if (route) {
          planned = true;
          pendingAt = plan.at(route.press, hold(1));
          plan.at(route.release, hold(0));
          ledgeFlight = route.next;
        }
      }
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

    // swingRev 13: a kick off a ledge takes the rope a few ticks after the press (the walk to the centre), so plan
    // from where the hero really is.
    if (s.expand && !planned && plan.size === 0) mode = s.rope >= 0 ? "rope" : "fly";
    if (!planned && plan.size === 0) {
      planned = true;
      if (mode === "rope") {
        if (s.rope < 0) {
          // Pressed but nothing was in reach: still flying.
          mode = "fly";
          planned = false;
          return null;
        }
        const r = planRelease(s);
        if (r === null) {
          // No good release in sight: keep swinging and look again shortly.
          planned = false;
          plan.at(t + 20, { k: -1, a: 0, b: 0, c: 0, d: 0 });
          return null;
        }
        let at = r.d + human.timingTicks(1);
        if (human.slip(0.25)) at += (human.chance(0.5) ? 1 : -1) * human.int(6, 14);
        seqGrab = r.grab;
        ledgeFlight = r.onto ?? -1;
        for (let k = 0; k < (r.reels ?? 0); k++) plan.at(t + 1 + k * REEL_GAP, reelUp);
        pendingAt = plan.at(t + Math.max(1, at), hold(0));
      } else if (ledgeFlight >= 0 && s.rope < 0 && fliesOnto(s, ledgeFlight)) {
        // swingRev 13: let go for the next ledge of a route and coming down on it: nothing to press yet.
        planned = false;
        return null;
      } else {
        ledgeFlight = -1;
        // The flight is seen a tracking lag late, so nothing earlier than that.
        const look = lag + 2;
        // A quick regrab planned with the release is executed blind; otherwise they watch the flight.
        const g = seqGrab && seqGrab.start < look && !(s.expand && startAhead(s) >= 0) ? seqGrab : planGrab(s, lastRope);
        seqGrab = null;
        if (g === null) {
          // Nothing forward in reach: a desperate press a reaction later.
          pendingAt = plan.at(t + human.reactTicks(), hold(1));
          return null;
        }
        // Pressing late (out of reach) is fatal, early just misses or takes the old anchor, so a
        // player aims early in the window by about one and a half of their own timing spread.
        const scale = 1 + g.start / 40;
        const aim = aimIn(g.start, g.len);
        let at = (g.start < look ? aim : Math.max(aim, look)) + human.timingTicks(scale);
        if (human.slip(0.25)) at += (human.chance(0.5) ? 1 : -1) * human.int(5, 12);
        pendingAt = plan.at(t + Math.max(1, at), hold(1));
      }
    }
    return null;
  }, init);
};
