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
const TAP_GAP: Record<SkillLevel, number> = { average: 10, good: 9, great: 8, near: 7 };
/** Marbles whose routes the player keeps in mind at once (released or next out). */
const HORIZON: Record<SkillLevel, number> = { average: 2, good: 3, great: 4, near: 5 };
/** Chance of allowing for a warned bottom-row change when planning a marble that lands after it. */
const HEED: Record<SkillLevel, number> = { average: 0.5, good: 0.7, great: 0.85, near: 0.95 };
/**
 * btRev 7: chance a player plans round a crossover rather than dropping a marble through it (the drop can
 * meet a marble rolling along that row and knock both out).
 */
const AVOID_X: Record<SkillLevel, number> = { average: 0.15, good: 0.45, great: 0.75, near: 0.95 };
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

export const bot: SkillBot = ({ game, human }) => {
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

  const plan = (s: BtState, id: number, t: number): void => {
    const ball = s.balls.find((b) => b.id === id);
    const colour = course.balls[id]!;
    const start = ball ? (ball.cell < 0 ? BT_HOPPER_COL : ball.cell) : BT_HOPPER_COL;
    const above = ball ? ball.cell < 0 || ball.above === 1 : true;
    // When will it land? Roughly a route's length of steps from now; allow for a warned change.
    let at = t;
    const guess = routeFrom(course, rot, start, above, btTraysAt(course, t).indexOf(colour), t);
    const eta = t + (guess ? guess.length : 20) * BT_STEP_TICKS + (ball ? 0 : 103);
    for (const ev of [course.relay, course.shuffle]) {
      if (ev.tick > t && ev.tick <= eta && ev.tick - t <= WARN_TICKS + 60 && human.chance(HEED[level])) at = ev.tick;
    }
    const trays = btTraysAt(course, at);
    let col = trays.indexOf(colour);
    // Misreading which tray is whose (or a plain slip).
    if (human.chance(human.p.judgement * 0.15) || human.slip(0.5)) {
      const others = trays.flatMap((c, i) => (c >= 0 && c !== colour ? [i] : []));
      if (others.length) col = others[human.int(0, others.length - 1)]!;
    }
    const avoid = (course.cross?.length ?? 0) > 0 && human.chance(AVOID_X[level]);
    const route = (avoid ? routeFrom(course, rot, start, above, col, at, true) : null) ?? routeFrom(course, rot, start, above, col, at) ?? routeFrom(course, rot, start, above, col, t);
    routes.set(id, route ?? []);
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
