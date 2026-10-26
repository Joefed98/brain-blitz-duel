/**
 * Ball Tracker (balltrack, btRev 2): the player routes each marble to the tray
 * of its colour by turning gold tubes just before it arrives — the same
 * just-in-time method the bank's proving playbook uses (each tube set for the
 * next marble due through it), standing in for what a skilled player works out.
 *
 * The human side: marbles are taken one at a time in release order. Working out
 * a marble's route takes think time (and its first look waits for the marble to
 * appear, one reaction after release); a weaker player now and then sends a
 * marble to the wrong tray (misreads a colour or column), and may not allow for
 * the bottom-row re-lay or colour shuffle that the countdown warns about.
 * The player keeps only a few marbles' routes in mind at once, reads where the
 * marbles are with a perception lag, taps at most ~6–8 times a second with some
 * pointing error (a tap can land on the neighbouring tile), and when a marble
 * goes off its planned route (a late tap, a tube turned under it) notices one
 * reaction later and re-plans it from where it is. Switch points are not used.
 */
import {
  btNext,
  btLayout,
  btRotatable,
  btTraysAt,
  BT_COLS,
  BT_HOPPER_COL,
  BT_HOPPER_H,
  BT_K_ROTATE,
  BT_STEP_TICKS,
  BT_TILE,
  BT_V7_BOOST_STEPS,
  BT_V7_BOOST_TICKS,
  BT_V7_DROP_TICKS,
  BT_W,
  type BtCourse,
  type BtState,
  type BtGame,
} from "../../../src/lib/arcade/ballTrack";
import { driveEvents, type SkillBot } from "../bot";
import type { SkillLevel } from "../human";

/** World px per phone px (the 700-wide board on a ~390-px phone). */
const WORLD_PER_PX = BT_W / 390;
/** Shortest gap between deliberate taps, ticks (≈ 6–8.5 taps a second). */
const TAP_GAP: Record<SkillLevel, number> = { weak: 11, average: 10, good: 9, great: 8, near: 7, elite: 6, perfect: 6 };
/** Marbles whose routes the player keeps in mind at once (released or next out). */
const HORIZON: Record<SkillLevel, number> = { weak: 1, average: 2, good: 3, great: 4, near: 5, elite: 6, perfect: 6 };
/** Chance of allowing for a warned bottom-row change when planning a marble that lands after it. */
const HEED: Record<SkillLevel, number> = { weak: 0.3, average: 0.5, good: 0.7, great: 0.85, near: 0.95, elite: 1, perfect: 1 };
/**
 * btRev 7: chance a player plans round a crossover rather than dropping a marble through it (the drop can
 * meet a marble rolling along that row and knock both out).
 */
const AVOID_X: Record<SkillLevel, number> = { weak: 0, average: 0.15, good: 0.45, great: 0.75, near: 0.95, elite: 1, perfect: 1 };
/** How many steps ahead of a marble the player sets a tube (just-in-time, not last-instant). */
const LEAD_STEPS = 4;
const WARN_TICKS = 5 * 60;
const SLOT = 100;

type Step = { cell: number; vert: number };

/** Shortest route from a marble's tile into column `col`, with the tube state each tile needs (-1 = fixed/corner). */
function routeFrom(course: BtCourse, rot: Set<number>, start: number, above: boolean, col: number, tick: number, avoidCross = false): Step[] | null {
  type Q = { cell: number; above: boolean; path: Step[] };
  const queue: Q[] = [{ cell: start, above, path: [] }];
  const seen = new Set<string>();
  while (queue.length) {
    const q = queue.shift()!;
    const key = `${q.cell}|${q.above}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const options = btLayout(course).kind[q.cell] === 2 ? [-1] : rot.has(q.cell) ? [0, 1] : [0];
    for (const v of options) {
      const next = btNext(q.cell, q.above, v === 1, course, tick);
      const path = [...q.path, { cell: q.cell, vert: rot.has(q.cell) ? v : -1 }];
      if (next.cell >= SLOT) {
        if (next.cell - SLOT === col) return path;
        continue;
      }
      if (next.cell < 0) continue;
      if (avoidCross && next.fromAbove && course.cross?.includes(next.cell)) continue;
      queue.push({ cell: next.cell, above: next.fromAbove, path });
    }
  }
  return null;
}

/**
 * Oct 2026: the shortest route into column `col` that passes a speed booster (a boosted
 * marble home is a feature point), or null.
 */
function boostedRoute(course: BtCourse, rot: Set<number>, start: number, above: boolean, col: number, tick: number, avoidCross: boolean): Step[] | null {
  const boost = new Set(course.boost ?? []);
  if (!boost.size) return null;
  type Q = { cell: number; above: boolean; on: boolean; path: Step[] };
  const queue: Q[] = [{ cell: start, above, on: boost.has(start), path: [] }];
  const seen = new Set<string>();
  while (queue.length) {
    const q = queue.shift()!;
    const key = `${q.cell}|${q.above}|${q.on}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const options = btLayout(course).kind[q.cell] === 2 ? [-1] : rot.has(q.cell) ? [0, 1] : [0];
    for (const v of options) {
      const next = btNext(q.cell, q.above, v === 1, course, tick);
      const path = [...q.path, { cell: q.cell, vert: rot.has(q.cell) ? v : -1 }];
      if (next.cell >= SLOT) {
        if (next.cell - SLOT === col && q.on) return path;
        continue;
      }
      if (next.cell < 0) continue;
      if (avoidCross && next.fromAbove && course.cross?.includes(next.cell)) continue;
      queue.push({ cell: next.cell, above: next.fromAbove, on: q.on || boost.has(next.cell), path });
    }
  }
  return null;
}
/** Extra steps a booster route may take over the shortest one. */
const BOOST_SLACK = 2;
/**
 * Oct 2026 fix: chance per marble of routing it through a speed booster when that is cheap (players who
 * know boosted marbles pay look for the chevrons; before, no level did, so boosts came only by accident).
 */
const BOOST_SEEK: Record<SkillLevel, number> = { weak: 0, average: 0.1, good: 0.3, great: 0.6, near: 0.85, elite: 1, perfect: 1 };

/**
 * Oct 2026 fix: when a marble following `route` lands, counted step by step as the sim moves it (a
 * booster's quick steps included; queueing behind another marble ignored). Used to tell which side of a
 * warned tray change a landing falls.
 */
function landTick(course: BtCourse, route: Step[], ball: { cell: number; at: number; bst?: number } | undefined, id: number): number {
  const boost = new Set(course.boost ?? []);
  let at = ball ? ball.at : 1 + id * BT_V7_DROP_TICKS + BT_STEP_TICKS;
  let bst = ball?.bst ?? 0;
  const move = (into: number | undefined) => {
    if (into !== undefined && boost.has(into)) bst = BT_V7_BOOST_STEPS;
    if (bst > 0) {
      at += BT_V7_BOOST_TICKS;
      bst--;
    } else at += BT_STEP_TICKS;
  };
  if (!ball || ball.cell < 0) move(BT_HOPPER_COL);
  for (let i = 0; i < route.length; i++) move(route[i + 1]?.cell);
  return at;
}

export const bot: SkillBot = ({ game, human, fixes }) => {
  const level = human.level;
  const g = game as BtGame;
  const course = g.course;
  // btRev 4: the taller board's rows (its course carries them).
  const BT_ROWS = btLayout(course).rows;
  const rot = new Set(btRotatable(course));
  const init = g.init(0) as BtState;
  const history: BtState[] = [];
  const lag = human.lagTicks();

  /** Planned route per marble id (null = not yet planned). */
  const routes = new Map<number, Step[]>();
  /** When the player can next act (thinking or just tapped). */
  let busyUntil = 0;
  /** Off-route marbles noticed: re-plan after a reaction. */
  const offNoticed = new Map<number, number>();

  /** Oct 2026 fix: the tray column each planned route ends in, and the warned events already re-checked. */
  const routeCol = new Map<number, number>();
  const rechecked = new Set<number>();

  const plan = (s: BtState, id: number, t: number): void => {
    const ball = s.balls.find((b) => b.id === id);
    const colour = course.balls[id]!;
    const start = ball ? (ball.cell < 0 ? BT_HOPPER_COL : ball.cell) : BT_HOPPER_COL;
    const above = ball ? ball.cell < 0 || ball.above === 1 : true;
    // When will it land? Roughly a route's length of steps from now; allow for a warned change.
    let at = t;
    const guess = routeFrom(course, rot, start, above, btTraysAt(course, t).indexOf(colour), t);
    const eta = t + (guess ? guess.length : 20) * BT_STEP_TICKS + (ball ? 0 : 103);
    let trayAt: ((tick: number) => number) | null = null;
    if (fixes) {
      // Oct 2026 fix: a warned change (countdown on screen) is allowed for by when this marble will really
      // land on its route, re-read once for the route to the tray it will then need.
      const heeds = [course.relay, course.shuffle].map((ev) => ev.tick > t && ev.tick - t <= WARN_TICKS + 60 && human.chance(HEED[level]));
      const landAt = (r: Step[] | null) => (r ? landTick(course, r, ball, id) : eta);
      trayAt = (tick: number) => {
        let k = t;
        [course.relay, course.shuffle].forEach((ev, i) => {
          if (heeds[i] && tick >= ev.tick) k = Math.max(k, ev.tick);
        });
        return k;
      };
      at = trayAt(landAt(guess));
      const again = routeFrom(course, rot, start, above, btTraysAt(course, at).indexOf(colour), at);
      at = trayAt(landAt(again));
    } else
      for (const ev of [course.relay, course.shuffle]) {
        if (ev.tick > t && ev.tick <= eta && ev.tick - t <= WARN_TICKS + 60 && human.chance(HEED[level])) at = ev.tick;
      }
    const trays = btTraysAt(course, at);
    let col = trays.indexOf(colour);
    // Misreading which tray is whose (or a plain slip).
    let misread = false;
    if (human.chance(human.p.judgement * 0.15) || human.slip(0.5)) {
      const others = trays.flatMap((c, i) => (c >= 0 && c !== colour ? [i] : []));
      if (others.length) col = others[human.int(0, others.length - 1)]!;
      misread = others.length > 0;
    }
    const avoid = (course.cross?.length ?? 0) > 0 && human.chance(AVOID_X[level]);
    const routeTo = (c: number, tick: number) => (avoid ? routeFrom(course, rot, start, above, c, tick, true) : null) ?? routeFrom(course, rot, start, above, c, tick) ?? routeFrom(course, rot, start, above, c, t);
    let route = routeTo(col, at);
    if (trayAt && route && !misread) {
      // The route actually taken (round a crossover, say) may land on the other side of the change.
      const real = trayAt(landTick(course, route, ball, id));
      if (real !== at) {
        at = real;
        col = btTraysAt(course, at).indexOf(colour);
        route = routeTo(col, at);
      }
    }
    if (route && !misread && trayAt && BOOST_SEEK[level] > 0 && !((ball?.via ?? 0) & 4) && human.chance(BOOST_SEEK[level])) {
      // Base first: a booster route only when it costs at most a couple of steps and lands on the same side
      // of any warned change (so the marble still goes home).
      const via = boostedRoute(course, rot, start, above, col, at, avoid);
      if (via && via.length <= route.length + BOOST_SLACK && trayAt(landTick(course, via, ball, id)) === at) route = via;
    }
    routes.set(id, route ?? []);
    routeCol.set(id, col);
  };

  return driveEvents(
    g,
    (s: BtState, t) => {
      history.push(s);
      const seen = history[Math.max(0, history.length - 1 - lag)]!;
      if (t < busyUntil) return null;

      // Which marbles are in mind: released ones first, then the next out, up to the horizon.
      const inPlay = seen.balls.filter((b) => b.cell < SLOT).map((b) => b.id).sort((a, b) => a - b);
      const mind = [...inPlay, seen.next].filter((id) => id < course.balls.length).slice(0, HORIZON[level]);

      // Oct 2026 fix: when a re-lay or shuffle countdown appears, the player re-checks the marbles already
      // planned (each with the chance they heed it) and re-plans those whose tray will have moved by the
      // time they land; only a changed route costs think time. Before, a route planned before the warning
      // kept its old tray, so even the flawless player sent two marbles a run to the wrong cup.
      if (fixes) {
        for (const ev of [course.relay, course.shuffle]) {
          if (rechecked.has(ev.tick) || seen.tick < ev.tick - WARN_TICKS || seen.tick >= ev.tick) continue;
          rechecked.add(ev.tick);
          let think = 0;
          for (const id of [...routes.keys()].sort((a, b) => a - b)) {
            if (id >= course.balls.length || !human.chance(HEED[level])) continue;
            const b = seen.balls.find((x) => x.id === id);
            if (b && b.cell >= SLOT) continue;
            const before = routeCol.get(id);
            plan(seen, id, t);
            if (routeCol.get(id) !== before) think += human.thinkTicks(300);
          }
          if (think > 0) {
            busyUntil = t + think;
            return null;
          }
        }
      }

      // A marble off its planned route is noticed one reaction later, then re-planned.
      for (const id of mind) {
        const r = routes.get(id);
        const b = seen.balls.find((x) => x.id === id);
        if (!r || !b || b.cell < 0) continue;
        if (!r.some((st) => st.cell === b.cell)) {
          if (!offNoticed.has(id)) offNoticed.set(id, t + human.reactTicks());
          else if (t >= offNoticed.get(id)!) {
            offNoticed.delete(id);
            plan(seen, id, t);
            busyUntil = t + human.thinkTicks(500);
            return null;
          }
        }
      }

      // Plan the earliest marble in mind that has no route yet (a new one shows up in the hopper).
      for (const id of mind) {
        if (routes.has(id)) continue;
        plan(seen, id, t);
        busyUntil = t + human.thinkTicks(id < 3 ? 1000 : 650);
        return null;
      }

      // Just in time: the most urgent tube a planned marble needs turned, not needed otherwise by an earlier one.
      const claimed = new Map<number, number>();
      let best: { cell: number; urgency: number } | null = null;
      for (const id of mind) {
        const r = routes.get(id);
        if (!r) continue;
        const b = seen.balls.find((x) => x.id === id);
        const idx = b ? (b.cell < 0 ? -1 : r.findIndex((st) => st.cell === b.cell)) : -1 - 7;
        for (let i = Math.max(0, idx + 1); i < r.length; i++) {
          const st = r[i]!;
          if (st.vert < 0) continue;
          const prior = claimed.get(st.cell);
          if (prior !== undefined) continue;
          claimed.set(st.cell, st.vert);
          if (seen.vert[st.cell] === st.vert) continue;
          if (seen.balls.some((x) => x.cell === st.cell)) continue;
          const urgency = (i - idx) + (b ? 0 : 6);
          if (urgency > LEAD_STEPS + 2 && best) continue;
          if (!best || urgency < best.urgency) best = { cell: st.cell, urgency };
        }
        // Tiles this marble is sitting in stay as they are.
        if (b && b.cell >= 0 && b.cell < SLOT) claimed.set(b.cell, seen.vert[b.cell]!);
      }
      if (!best) return null;
      busyUntil = t + TAP_GAP[level] + human.int(0, 3);
      // Pointing: aim at the tile centre; a big enough miss lands on the neighbour.
      const cx = (best.cell % BT_COLS) * BT_TILE + BT_TILE / 2 + human.aim(WORLD_PER_PX);
      const cy = BT_HOPPER_H + Math.floor(best.cell / BT_COLS) * BT_TILE + BT_TILE / 2 + human.aim(WORLD_PER_PX);
      let cell = best.cell;
      const col = Math.floor(cx / BT_TILE);
      const row = Math.floor((cy - BT_HOPPER_H) / BT_TILE);
      if (col >= 0 && col < BT_COLS && row >= 0 && row < BT_ROWS) cell = row * BT_COLS + col;
      if (human.slip(0.3)) cell = best.cell + (human.chance(0.5) ? 1 : -1) * (human.chance(0.5) ? 1 : BT_COLS);
      if (cell < 0 || cell >= BT_COLS * BT_ROWS) cell = best.cell;
      return { k: BT_K_ROTATE, a: cell, b: 0, c: 0, d: 0 };
    },
    init,
  );
};
