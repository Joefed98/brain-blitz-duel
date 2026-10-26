/**
 * Jaywalk: hop up through nine lanes of traffic; a move is a swipe. Standing in
 * a lane, the human works out (from the traffic as they see it) the quickest
 * safe way into the next lane: wait here, or step a column or two along first,
 * then hop when the next lane will stay clear from the landing until they can
 * move again. A hop is never made onto a vehicle's tail. That plan is the
 * right one for what they see (a short search standing in for experience);
 * what they see is wrong in human ways:
 *  - the traffic is read late (tracking lag) and its timing is misjudged in
 *    proportion to how far ahead it is (each lane's vehicles look a little
 *    faster or slower than they are; a fresh read after each move or look);
 *  - cyclists are fast and look slower than they are;
 *  - a vehicle still off the edge of the screen, or only just come on (less
 *    than a reaction time ago), is not taken into account, so players keep
 *    away from the two columns at each edge unless they must use them.
 * If no safe way up shows, they retreat a lane the same way (or wait on the
 * kerb). Each move is committed about a reaction time ahead and made with the
 * level's timing jitter; swipes are limited to a human rate and only land when
 * the disc is standing (as on the phone). Now and then a swipe goes the wrong
 * way (slip).
 *
 * crossRev 9 (the expansion): 14 rows (the island is never blocked); motorbikes are read like
 * cyclists; a coin in the next lane is chased (the hop aimed at its column) at a skill-dependent
 * rate, decided once per lane and crossing. x200 (26 Oct 2026): a player lines up for the next coin
 * they go for in this half of the road (walking along the pavement or the island to its column, or a
 * column at a time through traffic), but only when the detour costs little against their quickest hop
 * (COIN_DETOUR); the elite and perfect levels go for every coin, and on crossRev 9 the elite level takes
 * tighter gaps and lands closer behind vehicles (close calls). With BotCtx.fixes (#175) the plan is the fixed
 * player's (searchFixed), which on crossRev 9 reads the 14 rows and lines up for coins the same way. Older revisions draw nothing extra from the human, so
 * their runs are unchanged.
 */
import {
  CROSS_COLS,
  CROSS_INPUT_MOVE,
  CROSS_KIND_CYCLE,
  CROSS_KIND_MOTO,
  CROSS_X_ISLAND,
  crossRowsOf,
  CROSS_WORLD_W,
  crossBlocked,
  crossClosed,
  crossColumnCentreFp,
  crossCourse,
  crossPlayerHalfFp,
  type CrossCourse,
  type CrossState,
} from "../../../src/lib/arcade/cross";
import type { SkillLevel } from "../human";
import { driveEvents, type SkillBot } from "../bot";

/** crossRev 9: how often a coin in the next lane is gone for (the hop aimed at its column). */
const COIN_CHASE: Record<SkillLevel, number> = { weak: 0.1, average: 0.15, good: 0.35, great: 0.6, near: 0.85, elite: 1, perfect: 1 };
/** x200: the longest delay (ticks) a player accepts over their quickest hop to line up with a coin. */
const COIN_DETOUR: Record<SkillLevel, number> = { weak: 15, average: 20, good: 35, great: 50, near: 70, elite: 100, perfect: 120 };
let chaseScale = 1;
/** Measurement only: scales every level's coin chasing (0 = never). */
export function setCoinChase(scale: number): void {
  chaseScale = scale;
}
/** Fastest repeated swiping, ticks between swipes (a swipe is a down-move-up gesture). */
const SWIPE_GAP: Record<SkillLevel, number> = { weak: 21, average: 18, good: 15, great: 13, near: 11, elite: 10, perfect: 10 };
/** Relative misjudgement of when traffic arrives (sd), per lane read. */
const READ: Record<SkillLevel, number> = { weak: 0.19, average: 0.15, good: 0.11, great: 0.08, near: 0.05, elite: 0.04, perfect: 0 };
/** x200 (crossRev 9 only, old bots): the elite level takes tighter gaps (ticks clear wanted beyond its next swipe). */
const ELITE_MARGIN = 6;
/** Extra clear time (ticks) a player wants in the lane they hop into, beyond their next swipe. */
const MARGIN = 12;
/** Clear time (ticks) wanted just before landing too, so a hop never lands on a tail. */
const CUSHION = 8;
/** x200 (crossRev 9 only): the elite level lands closer behind a passing vehicle (close calls pay). */
const ELITE_X_CUSHION = Number(process.env.CROSS_ELITE_CUSHION ?? 3);
/** How far ahead (ticks) a plan looks. */
const HORIZON = 150;
/** Ticks a player keeps in hand when leaving a cell (in case the move comes late). */
const SLACK = 6;

/*
 * Oct 2026 competence fix (BotCtx.fixes). The v1 player planned one lane at a time and wanted 22
 * clear ticks in the lane it hopped into whatever its skill, so where two lanes' gaps never lined
 * up that well it hopped up and straight back down for the rest of the run (one tuning seed: the
 * flawless bot made three crossings, then spent 50 s between the kerb and lane 1). The fixed
 * player reads DEPTH lanes ahead (a strong player threads two lanes at once; weaker ones one):
 * they search the traffic as they see it (lane, column, when they can swipe again; a hop takes its
 * six ticks in the air, where nothing can hit) for the earliest way into the lane DEPTH ahead,
 * where they want HOLD ticks clear to think again, and otherwise only the margins their own timing
 * needs (a cell must look clear from CUSH ticks before they arrive until SLACK after they mean to
 * leave, widened by their read error the further ahead it is). A player kept from moving up grows
 * impatient: the hold they want shrinks over a few seconds, so nobody hops up and down for ever.
 */
/** Lanes read ahead. */
const DEPTH: Record<SkillLevel, number> = { weak: 1, average: 1, good: 1, great: 1, near: 2, elite: 2, perfect: 3 };
/** Clear ticks wanted after landing in the lane the plan reaches, beyond the next swipe. */
const HOLD: Record<SkillLevel, number> = { weak: 14, average: 12, good: 12, great: 10, near: 8, elite: 8, perfect: 4 };
/** How far ahead (ticks) the fixed player's plan looks. */
const HORIZON2 = 180;
const CUSH2: Record<SkillLevel, number> = { weak: 8, average: 7, good: 6, great: 5, near: 4, elite: 3, perfect: 1 };
const SLACK2: Record<SkillLevel, number> = { weak: 6, average: 5, good: 4, great: 3, near: 3, elite: 2, perfect: 1 };

const UP = 0;
const DOWN = 1;
const LEFT = 2;
const RIGHT = 3;
const HOP = 5;
const mod = (v: number, m: number) => ((v % m) + m) % m;

export const bot: SkillBot = ({ game, seed, human, fixes }) => {
  const level = human.level;
  /** x200 (crossRev 9 only): the elite level's sharper old-bot play (tighter gaps, closer landings for close calls). */
  const eliteX = level === "elite" && !!(game.init(seed) as CrossState).wide;
  const lag = human.lagTicks();
  const gap = SWIPE_GAP[level]!;
  const need = gap + (eliteX ? ELITE_MARGIN : MARGIN);
  /** Clear time wanted just before landing (crossRev 9: the elite level cuts it for close calls). */
  const landCushion = eliteX ? ELITE_X_CUSHION : CUSHION;
  const commitLead = Math.round(human.p.reactionMs[0] / (1000 / 60));
  /** Half-width of the hop window a player wants: two sd of their timing. */
  const half = Math.ceil((2 * human.p.timingSdMs) / (1000 / 60));
  let lastSwipe = -100;
  /** The offset (ticks) of the hop the last successful search found. */
  let hopK = 0;
  let pending: { at: number; m: number } | null = null;
  let plan: { at: number; m: number } | null = null;
  let nextLook = 0;
  let readKey = "";
  let warp = new Map<number, number>();
  let notice = new Map<number, number>();
  const init = game.init(seed) as CrossState;
  /** Rows between the kerbs: 9, or crossRev 9's 13 lanes and the island. */
  const ROWS = crossRowsOf(init);
  /** crossRev 9: per crossing and lane, whether this player goes for its coin. */
  const chase = new Map<number, boolean>();
  const coinColFor = (s: CrossState, lane: number): number | null => {
    if (!s.wide) return null;
    const coins = crossCourse(s).coins ?? [];
    for (let i = 0; i < coins.length; i++) {
      const cell = coins[i]!;
      if (cell >> 4 !== lane || ((s.coins ?? 0) & (1 << i))) continue;
      const id = s.crossings * 32 + lane;
      let go = chase.get(id);
      if (go === undefined) {
        go = human.chance(COIN_CHASE[level]! * chaseScale);
        chase.set(id, go);
      }
      return go ? cell & 15 : null;
    }
    return null;
  };
  /**
   * crossRev 9 (x200): the column the next hop is aimed at for a coin, and the detour (ticks of delay over the
   * quickest hop) worth taking for it. A player lines up for the next coin they go for in this half of the road
   * (below the island, or above it): into the coin's own lane at its column; from the pavement or the island
   * (safe to walk along) straight to its column; from a traffic lane a column at a time towards it, but only
   * where that costs little. A detour too long for the coin is not taken (the quickest hop is).
   */
  const coinWant = (s: CrossState): { col: number; detour: number } | null => {
    if (!s.wide) return null;
    const top = s.lane < CROSS_X_ISLAND ? CROSS_X_ISLAND - 1 : ROWS;
    const budget = COIN_DETOUR[level]!;
    for (let lane = s.lane + 1; lane <= top; lane++) {
      const col = coinColFor(s, lane);
      if (col === null) continue;
      if (lane === s.lane + 1 || s.lane === 0 || s.lane === CROSS_X_ISLAND) return { col, detour: budget };
      return { col: col === s.col ? col : s.col + Math.sign(col - s.col), detour: Math.round(budget / 3) };
    }
    return null;
  };

  /** crossRev 9 (x200, fixed bots): the next coin this player goes for in this half of the road (lane and column). */
  const coinAhead = (s: CrossState): { lane: number; col: number } | null => {
    if (!s.wide) return null;
    const top = s.lane < CROSS_X_ISLAND ? CROSS_X_ISLAND - 1 : ROWS;
    for (let lane = s.lane + 1; lane <= top; lane++) {
      const col = coinColFor(s, lane);
      if (col !== null) return { lane, col };
    }
    return null;
  };

  const noticeFor = (lane: number) => {
    let r = notice.get(lane);
    if (r === undefined) {
      r = human.reactTicks();
      notice.set(lane, r);
    }
    return r;
  };
  const warpFor = (course: CrossCourse, lane: number) => {
    let w = warp.get(lane);
    if (w === undefined) {
      const kind = course.lanes[lane - 1]?.kind;
      const cyc = kind === CROSS_KIND_CYCLE || kind === CROSS_KIND_MOTO;
      const read = READ[level]!;
      const sd = read * (cyc ? 1.3 : 1);
      // Fast riders look slower than they are: their arrival is judged late on average.
      w = Math.max(0.5, 1 + sd * human.normal() + (cyc ? 0.5 * read : 0));
      warp.set(lane, w);
    }
    return w;
  };

  /**
   * The quickest safe way out of the current lane as perceived: earliest hop (up, or down
   * when retreating) reachable by standing and side-steps, never standing on a cell that
   * looks hit. Returns the first action (tick and move) or null when nothing shows.
   */
  const search = (
    s: CrossState,
    t: number,
    dir: number,
    edges: number,
    occ: (lane: number, col: number, k: number) => boolean,
    want: number | null = null,
  ) => {
    const course = crossCourse(s);
    const to = s.lane + (dir > 0 ? 1 : -1);
    if (to < 0) return null;
    const lane = s.lane;
    // Edge columns are blind: avoided (two each side, or only the outermost unless the way up
    // is through it) unless already there.
    const edge = (c: number) =>
      c !== s.col &&
      (edges === 2
        ? c <= 1 || c >= CROSS_COLS - 2
        : edges === 1
          ? (c === 0 || c === CROSS_COLS - 1) &&
            crossClosed(course, to, c) === false &&
            !course.lanes[to - 1]?.closed
          : false);
    // Landing safety for a hop starting at offset k from column c.
    const landOk = (c: number, k: number) => {
      if (crossClosed(course, to, c)) return false;
      if (to === 0 || to > ROWS) return true;
      for (let j = k + HOP - landCushion; j <= k + HOP + need; j++) if (occ(to, c, j)) return false;
      return true;
    };
    // Leaving a cell at offset k: it should stay clear a little beyond, in case the move is late.
    const holds = (c: number, k: number) => {
      if (lane < 1 || lane > ROWS) return true;
      for (let j = k; j <= k + SLACK; j++) if (occ(lane, c, j)) return false;
      return true;
    };
    // A hop is aimed at the middle of a window of good moments at least as wide as the
    // player's own timing spread (they know roughly how reliable their timing is).
    const hopWindow = (c: number, k: number) => {
      for (let j = k; j <= k + 2 * half; j++) if (!landOk(c, j) || !holds(c, j)) return false;
      return true;
    };
    // BFS over (column, ticks until the next swipe is possible) through time.
    const cool0 = Math.max(0, gap - (t - lastSwipe));
    type Node = { c: number; cool: number; first: { at: number; m: number } | null };
    let layer = new Map<number, Node>([
      [s.col * 64 + cool0, { c: s.col, cool: cool0, first: null }],
    ]);
    for (let k = 0; k < HORIZON && layer.size; k++) {
      const next = new Map<number, Node>();
      for (const n of layer.values()) {
        if (n.cool === 0 && (want === null || n.c === want) && hopWindow(n.c, k))
          {
            hopK = k;
            return n.first ?? { at: t + k + half, m: dir > 0 ? UP : DOWN };
          }
        const add = (c: number, cool: number, first: Node["first"]) => {
          if (lane >= 1 && lane <= ROWS && occ(lane, c, k + 1)) return;
          const key = c * 64 + cool;
          if (!next.has(key)) next.set(key, { c, cool, first });
        };
        add(n.c, Math.max(0, n.cool - 1), n.first);
        if (n.cool === 0)
          for (const m of [LEFT, RIGHT]) {
            const c = n.c + (m === LEFT ? -1 : 1);
            if (c < 0 || c >= CROSS_COLS || crossClosed(course, lane, c) || edge(c)) continue;
            // The side-step lands this tick: that cell must be clear now, and not just cleared, and
            // the cell left must not be cut close either.
            if (!holds(n.c, k)) continue;
            if (lane >= 1 && lane <= ROWS) {
              let hit = false;
              for (let j = Math.max(0, k - CUSHION); j <= k && !hit; j++) hit = occ(lane, c, j);
              if (hit) continue;
            }
            add(c, gap - 1, n.first ?? { at: t + k, m });
          }
      }
      layer = next;
    }
    return null;
  };

  /**
   * Fixed bots: the earliest way into the lane DEPTH ahead (or onto the far kerb) within HORIZON2
   * as perceived, else the way towards the furthest lane that can be held to the horizon. Returns
   * the first move (null: stand still for now), when the plan gets there (`k`) and whether it
   * reaches its target (`done`); null when nothing survives the horizon.
   */
  // Ticks since this player last reached a new lane (or started the crossing).
  let progKey = -1;
  let progAt = 0;
  const stuck = (s: CrossState, t: number) => {
    const key = s.crossings * 64 + s.reached;
    if (key > progKey) {
      progKey = key;
      progAt = Math.max(t, s.pauseUntil);
    }
    return Math.max(0, t - progAt);
  };
  const searchFixed = (
    s: CrossState,
    t: number,
    edgesOk: boolean,
    occ: (lane: number, col: number, k: number) => boolean,
    want: { lane: number; col: number } | null = null,
  ): { first: { at: number; m: number } | null; k: number; done: boolean } | null => {
    const course = crossCourse(s);
    // crossRev 9 (x200): a coin plan's target is the coin's lane, reached at its column (col −1: any column).
    const target = want ? want.lane : Math.min(ROWS + 1, s.lane + DEPTH[level]!);
    // Impatience: the hold wanted shrinks to a third over ~5 s without a new lane.
    const hold = gap + Math.round(HOLD[level]! * Math.max(0.33, 1 - stuck(s, t) / 300));
    const cush = CUSH2[level]!;
    const slack = SLACK2[level]!;
    const read = READ[level]!;
    const safe = (lane: number, col: number, from: number, to: number) => {
      if (lane < 1 || lane > ROWS) return true;
      const e = Math.round(read * Math.max(0, from));
      for (let j = Math.max(0, from - e); j <= to + e; j++) if (occ(lane, col, j)) return false;
      return true;
    };
    const edge = (c: number) => !edgesOk && c !== s.col && (c <= 1 || c >= CROSS_COLS - 2);
    type N = { lane: number; col: number; cool: number; first: { at: number; m: number } | null };
    const put = (map: Map<number, N>, n: N) => {
      const key = n.lane * 16 + n.col;
      const o = map.get(key);
      if (!o || n.cool < o.cool) map.set(key, n);
    };
    let layer = new Map<number, N>();
    put(layer, { lane: s.lane, col: s.col, cool: Math.max(0, gap - (t - lastSwipe)), first: null });
    const landing = new Map<number, N[]>();
    for (let k = 0; k < HORIZON2; k++) {
      for (const n of landing.get(k) ?? []) put(layer, n);
      landing.delete(k);
      if (!layer.size && !landing.size) return null;
      const next = new Map<number, N>();
      for (const n of layer.values()) {
        if (safe(n.lane, n.col, k + 1, k + 1)) put(next, { ...n, cool: Math.max(0, n.cool - 1) });
        if (n.cool > 0) continue;
        if (!safe(n.lane, n.col, k, k + slack)) continue;
        for (const m of [LEFT, RIGHT]) {
          const c = n.col + (m === LEFT ? -1 : 1);
          if (c < 0 || c >= CROSS_COLS || crossClosed(course, n.lane, c) || edge(c)) continue;
          if (!safe(n.lane, c, k - cush, k + 1)) continue;
          put(next, { lane: n.lane, col: c, cool: gap - 1, first: n.first ?? { at: t + k, m } });
        }
        for (const m of [UP, DOWN]) {
          const to = n.lane + (m === UP ? 1 : -1);
          if (to < 0 || crossClosed(course, to, n.col)) continue;
          const first = n.first ?? { at: t + k, m };
          if (to > ROWS) return { first, k: k + HOP, done: true };
          const land = k + HOP;
          if (!safe(to, n.col, land - cush, land)) continue;
          if (to >= target && (!want || want.col < 0 || n.col === want.col)) {
            if (safe(to, n.col, land, land + hold)) return { first, k: land, done: true };
            continue;
          }
          if (want && to >= target) continue;
          const arr = landing.get(land) ?? [];
          arr.push({ lane: to, col: n.col, cool: Math.max(0, gap - HOP), first });
          landing.set(land, arr);
        }
      }
      layer = next;
    }
    // No way across in sight: towards the furthest lane that holds to the horizon.
    let best: N | null = null;
    for (const n of [...layer.values(), ...[...landing.values()].flat()]) if (!best || n.lane > best.lane) best = n;
    if (!best) return null;
    return { first: best.first, k: HORIZON2, done: false };
  };

  return driveEvents(
    game,
    (s: CrossState, t) => {
      if (t < s.pauseUntil || s.hop > 0 || s.lane > ROWS) {
        pending = null;
        plan = null;
        nextLook = 0;
        return null;
      }
      if (pending) {
        if (t < pending.at || t - lastSwipe < gap) return null;
        const m = pending.m;
        pending = null;
        plan = null;
        nextLook = 0;
        lastSwipe = t;
        return { k: CROSS_INPUT_MOVE, a: m, b: 0, c: 0, d: 0 };
      }
      const course = crossCourse(s);
      // A fresh read of the traffic after every move, and again every reaction time or so.
      const key = `${s.crossings}:${s.lane}:${s.col}:${s.lives}`;
      if (key !== readKey || t >= nextLook) {
        readKey = key;
        nextLook = t + human.reactTicks();
        warp = new Map();
        notice = new Map();
        const tPer = t - lag;
        // Perceived occupancy, memoised per (lane, col, offset) for this read.
        const memo = new Map<number, boolean>();
        const occ = (lane: number, col: number, k: number) => {
          const id = (lane * 16 + col) * 512 + k;
          let v = memo.get(id);
          if (v === undefined) {
            v = seenBlocked(course, s, lane, col, t + k, tPer);
            memo.set(id, v);
          }
          return v;
        };
        let waits = false;
        if (fixes) {
          // crossRev 9 (x200): line up for the next coin this player goes for in this half, when the detour
          // (ticks over the quickest way into the coin's lane at any column) is worth it.
          const coin = coinAhead(s);
          let aimed: ReturnType<typeof searchFixed> = null;
          if (coin) {
            const plain = searchFixed(s, t, true, occ, { lane: coin.lane, col: -1 });
            const at = searchFixed(s, t, true, occ, coin);
            if (at?.done && at.first && (!plain?.done || at.k - plain.k <= COIN_DETOUR[level]!)) aimed = at;
          }
          const f = aimed ?? searchFixed(s, t, false, occ) ?? searchFixed(s, t, true, occ);
          waits = !!f && !f.first;
          plan = f?.first ?? null;
        } else {
          const want = coinWant(s);
          const quick = search(s, t, 1, 2, occ) ?? search(s, t, 1, 1, occ);
          const quickK = quick ? hopK : Infinity;
          let chased: { at: number; m: number } | null = null;
          if (want) {
            const aimedOld = search(s, t, 1, 1, occ, want.col);
            if (aimedOld && hopK - quickK <= want.detour) chased = aimedOld;
          }
          plan =
            chased ??
            quick ??
            (s.lane >= 1 ? (search(s, t, -1, 2, occ) ?? search(s, t, -1, 1, occ)) : null);
        }
        if (!plan && !waits && s.lane >= 1) {
          // Cornered: whatever looks clear longest, now (blurred pick).
          const run = (lane: number, col: number, from: number) => {
            if (lane < 1 || lane > ROWS) return 90;
            let k = from;
            while (k < from + 90 && !occ(lane, col, k)) k++;
            return k - from;
          };
          const here = run(s.lane, s.col, 0);
          if (here < 2 * gap) {
            const opts: { m: number; v: number }[] = [{ m: -1, v: here - gap }];
            if (!crossClosed(course, s.lane + 1, s.col))
              opts.push({ m: UP, v: HOP + run(s.lane + 1, s.col, HOP) });
            if (!crossClosed(course, s.lane - 1, s.col))
              opts.push({ m: DOWN, v: HOP + run(s.lane - 1, s.col, HOP) });
            for (const m of [LEFT, RIGHT]) {
              const c = s.col + (m === LEFT ? -1 : 1);
              if (c >= 0 && c < CROSS_COLS && !crossClosed(course, s.lane, c))
                opts.push({ m, v: run(s.lane, c, 0) });
            }
            const pick = opts[human.pick(opts.map((o) => o.v))]!;
            if (pick.m >= 0) plan = { at: t + Math.max(0, gap - (t - lastSwipe)), m: pick.m };
          }
        }
      }
      if (!plan || plan.at - t > commitLead) return null;
      // Commit: the move lands with timing jitter (never before it is decided).
      let move = plan.m;
      if (human.slip(0.2)) move = [UP, DOWN, LEFT, RIGHT][human.int(0, 3)]!;
      const at = Math.max(t, Math.round(plan.at + human.timingTicks()));
      plan = null;
      if (at > t || t - lastSwipe < gap) {
        pending = { at, m: move };
        return null;
      }
      lastSwipe = t;
      nextLook = 0;
      return { k: CROSS_INPUT_MOVE, a: move, b: 0, c: 0, d: 0 };
    },
    init,
  );

  /** Perceived: is (lane, col) occupied at tick tau, judged from the look at tPer? */
  function seenBlocked(
    course: CrossCourse,
    s: CrossState,
    lane: number,
    col: number,
    tau: number,
    tPer: number,
  ): boolean {
    if (lane < 1 || lane > ROWS) return false;
    const def = course.lanes[lane - 1]!;
    const seenAt = Math.round(tPer + (tau - tPer) / warpFor(course, lane));
    const centre = crossColumnCentreFp(col);
    const rel = seenAt - s.crossStart;
    const half = crossPlayerHalfFp(s);
    if (!crossBlocked(def, centre, rel, half)) return false;
    // Which vehicle is it, and had it been on screen a reaction time before the look?
    const left = centre - half;
    const span = 2 * half;
    const u = mod(left - def.dir * def.speed * rel - def.phase, def.period);
    const back = seenAt - (tPer - noticeFor(lane));
    for (const start of def.offsets ?? [0]) {
      const d = mod(u - start, def.period);
      const x0 = d < def.blockW ? left - d : d + span > def.period ? left + (def.period - d) : null;
      if (x0 === null) continue;
      const then = x0 - def.dir * def.speed * back;
      if (then + def.blockW > 0 && then < CROSS_WORLD_W * 256) return true;
    }
    return false;
  }
};
