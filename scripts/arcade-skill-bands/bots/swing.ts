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
 * Competence fixes (Oct 2026, ctx.fixes; docs/arcade-bands-elite.md): a player who finds no release
 * in sight swipes the rope shorter or longer (the help's "Stuck? Keep swinging… swipe up to shorten"),
 * never grabs a rope they cannot leave again (a dead hang with the dragon behind), keeps an eye on the
 * clock from halfway (pace rises to what the 500 m line still needs), and counts a wanted star touched
 * on the swing after a grab like one touched in the air. A precise player (release timing good to a tick
 * or two: near-perfect, elite, flawless) looks at releases every tick and values each by what their own
 * timing spread makes of it (a release with no grab after it a fall, as is a missed grab), and one a tick
 * or two either side must not swing or drop them into anything either. Without these even the flawless bot hung on a rope until the dragon
 * caught it on a third of the seeds.
 *
 * swingRev 13 (the 200 expansion, docs/expansions/x200-swing.md; on that stamp only, so every older revision plays
 * as above): each level's appetite for the features (TIER_CFG): stars, high-route gems (a release whose flight
 * touches one), low-route speed gates (a grab whose swing lights one), set-route sections (landing on the start
 * ledge, reeling in if need be, then each ledge's release watched on the swing, pressed soon after each landing),
 * and the pace that feeds swing combos; detours held back by the dragon's lead.
 */
import { SWING_INPUT_HOLD, SWING_INPUT_REEL, SWING_REEL_UP, SWING_REEL_DOWN, type SwingState } from "../../../src/lib/arcade/swing";
import type { SkillLevel } from "../human";
import { driveEvents, Plan, type SkillBot } from "../bot";
import { assaultBot } from "./swingAssault";
import { reworkBot } from "./swingRework";

const FP = 256;
/** Mirrors of sim geometry the player sees (perception only). */
const REACH = 220 * FP;
const RADIUS = 10 * FP;
const COL = 40 * FP;
/** Chance a level goes out of its way for a star anchor it sees coming. */
const STAR_CHASE: Record<SkillLevel, number> = { weak: 0, average: 0.1, good: 0.35, great: 0.65, near: 0.9, elite: 1, perfect: 1 };
/**
 * swingRev 13 (the 200 expansion): each tier's appetite for the features, keyed by the Human's level (the flawless
 * `perfect` level as elite: every feature at full pace). Chances are per feature seen (a star,
 * gem, gate or section), pulls are what a wanted one is worth in px of progress; `section` is the chance a player
 * follows a set route they land on through to its flag (each ledge's release found by watching the swing), `press`
 * the extra ticks they take to press after landing on a ledge (on top of a tick), `pumpLook` how many ticks of
 * swinging they will wait through for the release that lands on the next ledge.
 */
interface TierCfg { starLook: number; gemLook: number; gateLook: number; minRun: number; star: number; gem: number; gate: number; ledge: number; section: number; starPull: number; gemPull: number; gatePull: number; ledgePull: number; pace: number; press: [number, number]; pumpLook: number }
const TIER_CFG: Record<SkillLevel, TierCfg> = {
  weak: { starLook: 0, gemLook: 0, gateLook: 0, minRun: 3, star: 0.05, gem: 0.02, gate: 0.02, ledge: 0, section: 0, starPull: 250, gemPull: 180, gatePull: 150, ledgePull: 900, pace: 4, press: [14, 30], pumpLook: 120 },
  average: { starLook: 0, gemLook: 0, gateLook: 0, minRun: 3, star: 0.1, gem: 0.05, gate: 0.05, ledge: 0, section: 0, starPull: 250, gemPull: 180, gatePull: 150, ledgePull: 900, pace: 4, press: [10, 24], pumpLook: 150 },
  good: { starLook: 0, gemLook: 0.1, gateLook: 0.1, minRun: 3, star: 0.35, gem: 0.25, gate: 0.25, ledge: 0.2, section: 0.3, starPull: 250, gemPull: 180, gatePull: 150, ledgePull: 900, pace: 4.5, press: [6, 16], pumpLook: 220 },
  great: { starLook: 0, gemLook: 0.3, gateLook: 0.3, minRun: 3, star: 0.65, gem: 0.6, gate: 0.6, ledge: 0.55, section: 0.7, starPull: 250, gemPull: 180, gatePull: 150, ledgePull: 900, pace: 5.5, press: [3, 10], pumpLook: 300 },
  near: { starLook: 0, gemLook: 0.5, gateLook: 0.5, minRun: 2, star: 0.9, gem: 0.9, gate: 0.9, ledge: 0.9, section: 0.9, starPull: 250, gemPull: 180, gatePull: 150, ledgePull: 900, pace: 6.5, press: [2, 7], pumpLook: 420 },
  elite: { starLook: 0.5, gemLook: 1, gateLook: 1, minRun: 2, star: 1, gem: 1, gate: 1, ledge: 1, section: 1, starPull: 320, gemPull: 260, gatePull: 220, ledgePull: 1100, pace: 6.5, press: [0, 3], pumpLook: 420 },
  perfect: { starLook: 1, gemLook: 1, gateLook: 1, minRun: 1, star: 1, gem: 1, gate: 1, ledge: 1, section: 1, starPull: 500, gemPull: 400, gatePull: 350, ledgePull: 1500, pace: 6.5, press: [0, 0], pumpLook: 420 },
};
/** Window key offset for presses made standing on a ledge. */
const STANDING = 1_000_000;
/** swingRev 13: the most a player swings waiting for the release on to a section's start ledge (ticks). */
const START_WAIT = 90;
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

/** Fixes: the 500 m line (sim START_X + 500 m, perception only), the clock, and how much faster than the
 *  rate still needed a player keeps when the clock gets short. */
const FINISH_X = 23000 * FP;
/** swingRev 13: detours (gems, stars, start ledges, routes) are weighed against the clock from 20 s, keeping 2 s spare. */
const DETOUR_CLOCK_FROM = 1200;
const DETOUR_SPARE = 120;
/** The pace (px a tick) a player knows they can swing at once the detours stop (the clock rule assumes no slower), by level. */
const DETOUR_CRUISE: Record<SkillLevel, number> = { weak: 5, average: 5, good: 5, great: 5.5, near: 6, elite: 6.5, perfect: 7 };
/** swingRev 13: the start line (sim START_X, perception only). */
const START_X = 3000 * FP;
const RUN_TICKS = 3600;
const PACE_MARGIN = 1.2;
/** From halfway (30 s) the clock is part of the plan. */
const PACE_FROM = 1800;

/** Fixes: release timing is looked at up to this many ticks either side, and a release with no grab after it weighs this (a fall). */
const ODDS_MAX = 6;
const FALL_COST = 1200;
/** Fixes: a mistimed release this likely or more must be survivable too. */
const NEIGHBOUR_ODDS = 0.005;

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
const reel = (a: number) => ({ k: SWING_INPUT_REEL, a, b: 0, c: 0, d: 0 });
/** Ticks a reel takes in the sim (REEL_TICKS). */
const REEL_LEN = 8;
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

export const bot: SkillBot = (ctx) => {
  // swingRev 14 (the assault course) and 15 (the swinging course) have their own players (bots/swingAssault.ts,
  // bots/swingRework.ts); every earlier revision plays below.
  const first = ctx.game.init(ctx.seed) as SwingState;
  if (first.rework) return reworkBot(ctx);
  if (first.assault) return assaultBot(ctx);
  return legacyBot(ctx);
};

const legacyBot: SkillBot = ({ game, seed, human, fixes }) => {
  const level = human.level;
  const cfg = TIER_CFG[level] ?? TIER_CFG.near;
  /** swingRev 13: how long a player swings waiting to land on a start ledge (the elite and flawless wait longer). */
  const cruise = DETOUR_CRUISE[level] ?? 6;
  const startWait = level === "perfect" ? 2 * START_WAIT : level === "elite" ? Math.trunc(1.5 * START_WAIT) : START_WAIT;
  const step = (s: SwingState, ev: { k: number; a: number; b: number; c: number; d: number } | null) => game.step(s, ev ? { ...ev, t: s.tick + 1 } : null) as SwingState;
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
  const pickups = (b: SwingState) => {
    if (!b.starSpots) return 0;
    let n = 0;
    for (const i of (b.starsTaken ?? []).slice(originTaken)) {
      let c = starChoice.get(10_000 + i);
      if (c === undefined) {
        c = human.chance(b.expand ? cfg.star : STAR_CHASE[level]!);
        starChoice.set(10_000 + i, c);
      }
      if (c) n++;
    }
    return n;
  };
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
    if (b.expand)
      // swingRev 13: a press while standing on a ledge is its own window; gems, gates and ledges count too.
      return { j: (b.ledgeOn ?? -1) >= 0 ? j + STANDING : j, v: (a.x - from) / FP + (wantStar(b, j) ? starPull(b) : 0) + pickups(b) * starPull(b) + extras(b) };
    return { j, v: (a.x - from) / FP + (wantStar(b, j) ? STAR_PULL : 0) + pickups(b) * STAR_PULL };
  };

  /** The pace this plan trades time at: PACE, or (fixes) faster when the clock says the 500 m line needs it. */
  let paceNow = PACE;
  const paceFor = (s: SwingState) => {
    // swingRev 13: each level's own pace (it feeds swing combos), raised as the clock needs (fixes) like PACE.
    const base = s.expand ? cfg.pace : PACE;
    if (!fixes || s.tick < PACE_FROM) return base;
    const left = Math.max(60, RUN_TICKS - s.tick);
    return Math.max(base, (PACE_MARGIN * Math.max(0, FINISH_X - s.x)) / FP / left);
  };

  /** Fixes: how many ticks either side a release is looked at (two and a half of the player's own timing spreads). */
  const oddsR = Math.min(ODDS_MAX, Math.ceil((2.5 * human.p.timingSdMs) / (1000 / 60)));
  /**
   * Fixes: a player whose release timing is good to a tick or two (near-perfect, elite, flawless: oddsR ≤ 2)
   * plans releases tick by tick and weighs each by its odds; the others keep the two-tick grid, each choice
   * robust to a sample either side, and the old weight on a missed grab.
   */
  const precise = Boolean(fixes) && oddsR <= 2;
  /** Fixes: the chance a planned release lands k ticks off (k = -oddsR…oddsR), from the player's own timing spread. */
  const releaseOdds = (() => {
    const sd = human.p.timingSdMs / (1000 / 60);
    const w = Array.from({ length: 2 * oddsR + 1 }, (_, j) => {
      const k = j - oddsR;
      return sd <= 0 ? (k === 0 ? 1 : 0) : phi((k + 0.5) / sd) - phi((k - 0.5) / sd);
    });
    const sum = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / sum);
  })();

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
        // and weighs the progress against the fall that a miss means (a precise player, see `precise`,
        // weighs it as the fall it is: FALL_COST).
        const hit = hitChance(i, len);
        out.push({ start: i, len, value: vals[mid]!.v * hit - (precise ? FALL_COST : MISS_COST) * (1 - hit) - paceNow * mid });
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

  /**
   * Fixes: a strong player does not grab a rope they cannot leave (a dead hang with no swing left, the
   * dragon behind). From state g, just after a grab, some forward-upswing release over the coming
   * swings must offer a grab window.
   */
  const CONT_HORIZON = 150;
  const canGoOn = (g: SwingState): boolean => {
    if (g.ended || g.rope < 0) return !g.ended;
    const ropeAnchor = g.rope;
    const ax = g.anchors[ropeAnchor]!.x;
    let rope = g;
    let prev = g;
    for (let d = 0; d <= CONT_HORIZON && !rope.ended; d++) {
      if (d % 3 === 0 && d >= MIN_HOLD && rope.x > prev.x && rope.y < prev.y && rope.x >= ax) {
        const { vals, states } = flightGrabs(step(rope, hold(0)), ax, ropeAnchor);
        if (windowsOf(vals, REGRAB_MIN).length > 0) return true;
        // The 500 m line crossed in the air.
        const last = states[states.length - 1];
        if (last && step(last, null).ended === 1) return true;
      }
      prev = rope;
      rope = step(rope, null);
    }
    // The 500 m line crossed on the rope.
    return rope.ended === 1;
  };

  /** On a rope: the release tick (delay from now) whose flight offers the best grab, robust to a tick or two either side. */
  const planRelease = (s: SwingState): { d: number; grab: { start: number; len: number } | null; onto?: number; reels?: number } | null => {
    // swingRev 13: a wanted section's start ledge ahead: let go to land on it if this swing can; else a gem flight.
    if (s.expand) {
      const target = startAhead(s);
      if (target >= 0) {
        const onto = detourTicks(s, startWait) >= 0 ? ontoPlan(s, target, detourTicks(s, startWait)) : null;
        if (onto) return { d: onto.d, grab: null, onto: target, reels: onto.reels };
      }
      const gem = gemPlan(s);
      if (gem) return gem;
    }
    markOrigin(s);
    paceNow = paceFor(s);
    const ropeAnchor = s.rope;
    const from = s.anchors[ropeAnchor]?.x ?? s.x;
    let rope = s;
    const value: number[] = [];
    const grabs: ({ start: number; len: number } | null)[] = [];
    const anchorX = s.anchors[ropeAnchor]!.x;
    let prev = rope;
    // Every other tick, robust to one sample (two ticks) either side. A precise player: every tick, each
    // release valued by what their own timing spread makes of it (releaseOdds: the flights a tick or two
    // either side, a flight with no grab counted as a fall).
    const every = precise ? 1 : 2;
    const raw: number[] = [];
    for (let d = 0; d <= RELEASE_HORIZON && !rope.ended; d++) {
      // A player lets go on the forward upswing (ahead of the anchor, moving forward and up), never straight after grabbing.
      const upswing = rope.x > prev.x && rope.y < prev.y && rope.x >= anchorX;
      if (precise) {
        // Every tick near the aim is flown, upswing or not: a mistimed release still flies.
        if (d < MIN_HOLD - oddsR) raw.push(-Infinity);
        else {
          const { vals } = flightGrabs(step(rope, hold(0)), from, ropeAnchor);
          const w = windowsOf(vals, REGRAB_MIN);
          let top = null as { start: number; len: number; value: number } | null;
          for (const x of w) if (!top || x.value > top.value) top = x;
          raw.push(top ? top.value - paceNow * d : -Infinity);
          grabs.push(top);
          value.push(d >= MIN_HOLD && upswing && top ? 0 : -Infinity);
          prev = rope;
          rope = step(rope, null);
          continue;
        }
        grabs.push(null);
        value.push(-Infinity);
      } else if (d % every === 0) {
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
      .map((_, i) => {
        if (!precise) return { i, v: Math.min(value[i]!, value[i - 1] ?? value[i]!, value[i + 1] ?? value[i]!) };
        if (value[i] === -Infinity) return { i, v: -Infinity };
        let v = 0;
        for (let k = -oddsR; k <= oddsR; k++) {
          const r = raw[i + k] ?? -Infinity;
          v += releaseOdds[k + oddsR]! * (r === -Infinity ? -FALL_COST : r);
        }
        return { i, v };
      })
      .filter((x) => x.v > -Infinity)
      .sort((a, b) => b.v - a.v);
    if (fixes) {
      // Fixes: the best few, each flown through its grab and the swing after; a wanted star touched on
      // that swing counts like one in the air. The best that keeps them alive and moving.
      const ok: { i: number; v: number; grabbed: SwingState }[] = [];
      for (const { i, v } of order.slice(0, 24 / every)) {
        const g = grabs[i]!;
        let f = s;
        for (let k = 0; k < i * every; k++) f = step(f, null);
        f = step(f, hold(0));
        const aim = aimIn(g.start, g.len);
        for (let k = 0; k < aim && !f.ended; k++) f = step(f, null);
        f = step(f, hold(1));
        const grabbed = f;
        for (let k = 0; k < SAFE_SWING && !f.ended; k++) f = step(f, null);
        if (f.ended === 2) continue;
        // A release a tick or two either side (when the player's timing makes that at all likely), with the
        // grab pressed as planned, must not swing or drop them into something either.
        let neighbourDies = false;
        for (const k of [-1, 1, -2, 2]) {
          if (neighbourDies || !precise || Math.abs(k) > oddsR || releaseOdds[k + oddsR]! < NEIGHBOUR_ODDS) continue;
          let n = s;
          for (let q = 0; q < i * every + k && !n.ended; q++) n = step(n, null);
          if (n.ended) continue;
          n = step(n, hold(0));
          for (let q = 0; q < aim && !n.ended; q++) n = step(n, null);
          n = step(n, hold(1));
          for (let q = 0; q < SAFE_SWING && !n.ended; q++) n = step(n, null);
          if (n.ended === 2) neighbourDies = true;
        }
        if (neighbourDies) continue;
        ok.push({ i, v: v + STAR_PULL * (pickups(f) - pickups(grabbed)), grabbed });
      }
      ok.sort((a, b) => b.v - a.v);
      for (const c of ok) if (canGoOn(c.grabbed)) return { d: c.i * every, grab: grabs[c.i]! };
      return null;
    }
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

  /**
   * Fixes: stuck on a rope with no release in sight (a long rope low over the lava, the next anchor
   * high), a player swipes to shorten (or let out) the rope, as the help says. The first reel
   * moment over the coming swing after which a release opens up; null if none does.
   */
  const planReel = (s: SwingState): { wait: number; dir: number } | null => {
    for (let wait = 0; wait <= 48; wait += 4) {
      let f = s;
      for (let k = 0; k < wait && !f.ended; k++) f = step(f, null);
      if (f.ended || f.rope < 0) return null;
      for (const dir of [SWING_REEL_UP, SWING_REEL_DOWN]) {
        let g = step(f, reel(dir));
        if (g.reelLeft <= 0 || g.reelTo === f.len) continue;
        for (let k = 0; k < REEL_LEN && !g.ended; k++) g = step(g, null);
        if (g.ended) continue;
        if (planRelease(g) !== null) return { wait, dir };
      }
    }
    return null;
  };

  /** Flying: the grab tick (delay from now) in the best window whose swing keeps the ninja alive. */
  const planGrab = (s: SwingState, ropeAnchor: number): { start: number; len: number } | null => {
    markOrigin(s);
    paceNow = paceFor(s);
    const from = s.anchors[Math.max(0, ropeAnchor)]?.x ?? s.x;
    const { vals, states } = flightGrabs(s, from, ropeAnchor);
    // swingRev 13: standing on a ledge (the flag, or a route not followed): kick off at the first moment whose
    // swing keeps them alive (a stalactite over the ledge is waited out).
    if (s.expand && (s.ledgeOn ?? -1) >= 0) {
      for (let d = lag + 2; d < 150; d++) {
        let f = s;
        for (let k = 0; k < d && !f.ended; k++) f = step(f, null);
        if (f.ended) break;
        let g = step(f, hold(1));
        for (let k = 0; k < 30 && g.rope < 0 && !g.ended; k++) g = step(g, null);
        const grabbed = g;
        for (let k = 0; k < SAFE_SWING && !g.ended; k++) g = step(g, null);
        if (g.ended !== 2 && grabbed.rope >= 0 && (!fixes || canGoOn(grabbed))) return { start: d, len: 1 };
      }
    }
    // swingRev 13: a wanted section's start ledge ahead: a grab whose swing can let go on to it (the first run of such grab ticks).
    if (s.expand && (s.ledgeOn ?? -1) < 0) {
      const target = startAhead(s);
      if (target >= 0) {
        let run: [number, number] | null = null;
        let at = -1;
        for (let d = lag + 2; d < states.length; d++) {
          const ok = vals[d]!.j >= 0 && detourTicks(s, startWait) >= 0 && ontoPlan(step(states[d]!, hold(1)), target, detourTicks(s, startWait)) !== null;
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
      const grabbed = g;
      for (let k = 0; k < SAFE_SWING && !g.ended; k++) g = step(g, null);
      return g.ended !== 2 && (!fixes || canGoOn(grabbed));
    };
    for (const w of wins) {
      const mid = w.start + Math.trunc((w.len - 1) / 2);
      // swingRev 13: and where they will actually press (aimIn), not only the window's middle.
      if (safe(mid) && (!s.expand || safe(Math.min(states.length - 1, aimIn(w.start, w.len))))) return { start: w.start, len: w.len };
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
    // A player with no timing error (flawless) takes the earliest landing release: the fastest route.
    if (pickRun && cfg.minRun === 1) return pickRun[0];
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
    if (gi >= 0) {
      const plan = pickupPlan(s, (b) => ((b.gemsTaken ?? 0) & (1 << gi)) !== 0);
      if (plan) return plan;
    }
    // A touch star the same way (the players who look for them: `starLook`).
    const got = s.starsTaken ?? [];
    const si = (s.starSpots ?? []).findIndex(([sx], i) => !got.includes(i) && sx > s.x && sx - s.x < 460 * FP && wants(80_000 + i, cfg.starLook));
    if (si >= 0) return pickupPlan(s, (b) => (b.starsTaken ?? []).includes(si));
    return null;
  };
  /** swingRev 13: a release (after 0, 1 or 2 reels) whose flight takes a pickup (`taken` turns true) with a safe grab after it. */
  const pickupPlan = (s: SwingState, taken: (b: SwingState) => boolean): { d: number; grab: { start: number; len: number }; reels: number } | null => {
    // A detour costs more than its wait (the swing after it is slower too): half the slack, and no reeling when it is short.
    const slack = detourTicks(s, 2 * RELEASE_HORIZON);
    const maxD = Math.trunc(slack / 2);
    if (maxD < 0) return null;
    const ropeAnchor = s.rope;
    const from = s.anchors[ropeAnchor]?.x ?? s.x;
    const anchorX = s.anchors[ropeAnchor]!.x;
    for (let reels = 0; reels <= (slack < 200 ? 0 : 2); reels++) {
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
          for (; k < 90 && !fly.ended && !taken(fly); k++) fly = step(fly, null);
          if (!fly.ended && taken(fly)) {
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
  /** swingRev 13: the longest detour (ticks) worth taking: with the dragon out, what its lead allows (it flies 4 px a tick; keep 260 px and 1.5 s spare). */
  const detourTicks = (s: SwingState, most: number) => {
    let d = s.chaseX ? Math.min(most, Math.trunc(((s.x - s.chaseX) / FP - 260) / 4) - 90) : most;
    // And what the clock allows (fixes, from 20 s): the ticks left beyond what the 500 m line needs at their own
    // average pace so far (or their cruising pace, DETOUR_CRUISE, if faster), less 2 s.
    if (fixes && s.tick >= DETOUR_CLOCK_FROM) {
      const pace = Math.max(cruise, (s.x - START_X) / FP / s.tick);
      d = Math.min(d, Math.trunc(RUN_TICKS - s.tick - Math.max(0, FINISH_X - s.x) / FP / pace - DETOUR_SPARE));
    }
    return d;
  };
  /** swingRev 13: the start ledge of a wanted section a little ahead (not yet landed on), or -1. */
  const startAhead = (s: SwingState): number =>
    (s.ledges ?? []).findIndex((l, i) => l.kind === 0 && !(s.ledgeTicks?.[i] ?? 0) && l.x > s.x - 40 * FP && l.x - s.x < 420 * FP && wants(50_000 + l.section, cfg.section));
  const ledgeRoute = (s: SwingState, on: number, t: number): { press: number; release: number; next: number } | null => {
    const l = s.ledges?.[on];
    if (!l) return null;
    const next = s.ledges!.findIndex((q) => q.section === l.section && q.order === l.order + 1);
    if (next < 0 || !wants(50_000 + l.section, cfg.section)) return null;
    // A route the dragon's lead or the clock no longer allows is left (they swing on as usual).
    if (detourTicks(s, cfg.pumpLook) < 60) return null;
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
  /** swingRev 13: the earliest release (and the grab after it) that swings on safely: a last resort on a rope. */
  const rescueRelease = (s: SwingState): { d: number; grab: { start: number; len: number } } | null => {
    let f = s;
    for (let d = 0; d < RELEASE_HORIZON && !f.ended; d++) {
      let fl = step(f, hold(0));
      for (let k = 0; k < FLIGHT_LOOK && !fl.ended; k++) {
        const g0 = step(fl, hold(1));
        if (g0.rope > s.rope) {
          let g = g0;
          for (let q = 0; q < SAFE_SWING && !g.ended; q++) g = step(g, null);
          if (g.ended !== 2) return { d, grab: { start: k, len: 1 } };
        }
        fl = step(fl, null);
      }
      f = step(f, null);
    }
    return null;
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
    else if (ev && ev.k === SWING_INPUT_REEL) return ev;
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
        let r = planRelease(s);
        // swingRev 13: still nothing (no plan the usual look finds, no reel that opens one) with the dragon out: the
        // first let-go whose flight has any grab forward that swings on safely, rather than hanging until it catches them.
        if (r === null && s.expand && fixes && s.chaseX && planReel(s) === null) r = rescueRelease(s);
        if (r === null && fixes) {
          const rl = planReel(s);
          if (rl !== null) {
            // A swipe: decided now, done a beat later (the moment on the swing is anticipated).
            pendingAt = plan.at(t + Math.max(1, rl.wait + human.timingTicks(1)), reel(rl.dir));
            plan.at(pendingAt + REEL_LEN + 1, { k: -1, a: 0, b: 0, c: 0, d: 0 });
            return null;
          }
        }
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
        // swingRev 13: let go for a ledge and coming down on it: nothing to press yet.
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

/**
 * Random play (the arcade rule's floor, 26 Oct 2026): a finger that presses and lets go at random moments with no
 * aim at all (holds and gaps of 4–60 ticks, now and then a reel swipe), seeded from the Human's own stream.
 */
export const randomBot: SkillBot = ({ game, seed, human }) => {
  let next = 1 + human.int(0, 40);
  let down = false;
  return driveEvents(game, (_s: SwingState, t) => {
    if (t < next) return null;
    next = t + human.int(4, 60);
    if (human.chance(0.1)) return { k: SWING_INPUT_REEL, a: human.int(0, 1), b: 0, c: 0, d: 0 };
    down = !down;
    return hold(down ? 1 : 0);
  }, game.init(seed) as SwingState);
};
