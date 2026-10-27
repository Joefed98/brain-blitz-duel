/**
 * Meteor: the player finds each new star (a reaction plus a short think), picks
 * a route to it (fewest cells, few turns, clear of rocks and seen shadows,
 * with blurred judgement and the odd poor pick), and swipes at each turn square.
 * A swipe is an anticipated moment: it is aimed at the middle of the head's
 * stay on the turn square with timing error, so at speed a swipe can land a
 * square early or late. Two swipes need a human gap between them. A head that
 * leaves the route (a mistimed swipe) and a new rock shadow are noticed one
 * reaction later, when the player re-plans. With no route in hand (finding the
 * next star) the player steers away from what is right ahead of the head.
 */
import { bandPoints } from "../../../src/lib/arcade/scoreBands";
import { snakeGoldWorth, SNAKE_V9_BAND_CURVE, SNAKE_V9_CAPS, snakeReversal, snakeStepTicks, snakeStepTicksFor, snakeColsOf, snakeWarpExit, SNAKE_INPUT_TURN, snakeRowsOf, SNAKE_GOLD_LIFE, snakeRockCells, snakeRockSpan, snakeWarnCells, snakeOnLane, type SnakeState } from "../../../src/lib/arcade/snake";
import type { SkillLevel } from "../human";
import { driveEvents, type SkillBot } from "../bot";
import type { Human } from "../human";

/** Shortest gap between two deliberate swipes, ticks (about 6–8.5 a second). */
const SWIPE_GAP: Record<SkillLevel, number> = { weak: 11, average: 10, good: 9, great: 8, near: 7, elite: 6, perfect: 6 };
/** Base (average-player) time to find a new star and choose a route, ms. */
const FIND_MS = 300;

const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];

/** Rows and columns of the grid being played (Tuning E's taller grid, snakeRev 9's bigger one); set when a run starts. */
let ROWS = 20;
let COLS = 15;
/** snakeRev 9 wormholes this player uses (empty: none, or not noticed). */
let WARPS: number[] = [];
/** snakeRev 9 speed lanes this player rides on purpose. */
let LANES = false;

/**
 * snakeRev 9: whether the bots play the expansion's features (gold stars, lanes, wormholes). The
 * measuring script (scripts/expansions-e2-bands.ts) turns it off to see where today's play lands.
 */
export const snakeBotOptions = { features: true };

function nb(cell: number, dir: number): number {
  const r = Math.trunc(cell / COLS) + DR[dir]!;
  const c = (cell % COLS) + DC[dir]!;
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return -1;
  const out = r * COLS + c;
  return WARPS.length ? snakeWarpExit(WARPS, out) : out;
}

/** Cells the player treats as walls: rocks, plus the shadows they have noticed. */
function blockedSet(s: SnakeState, shadows: Set<number>): Set<number> {
  // snakeRev 10: a 2 × 2 rock blocks all four of its squares (older rounds: the rocks themselves).
  const b = new Set<number>(snakeRockCells(s));
  for (const c of shadows) b.add(c);
  // A player who does not use the wormholes steers round their mouths.
  if (!WARPS.length) for (const c of s.warps ?? []) b.add(c);
  return b;
}

/** Body cell i frees after (length - i) steps; a cell is passable at step d if it frees by then. */
function freeAtMap(s: SnakeState): Map<number, number> {
  const m = new Map<number, number>();
  s.body.forEach((cell, i) => m.set(cell, s.body.length - i));
  return m;
}

/**
 * Cheapest route from the head, forced to leave in `first`, to `goal`: cost = cells + 0.4 per turn
 * (people prefer straight lines and one bend). Two turns need at least `minRun` squares between
 * them (the player knows how fast they can swipe twice). Returns the cell path (head excluded) or null.
 */
function route(s: SnakeState, first: number, goal: number, blocked: Set<number>, freeAt: Map<number, number>, minRun: number, run0: number): number[] | null {
  const head = s.body[0]!;
  const start = nb(head, first);
  if (start < 0 || blocked.has(start) || (freeAt.get(start) ?? 0) > 1) return null;
  if (first !== s.nextDir && run0 < minRun) return null;
  const R = minRun + 1;
  const key = (cell: number, dir: number, run: number) => (cell * 4 + dir) * R + run;
  const best = new Map<number, number>();
  const prev = new Map<number, number>();
  const steps = new Map<number, number>();
  const buckets: number[][] = [];
  const push = (k: number, cost: number) => {
    const b = Math.round(cost * 10);
    (buckets[b] ??= []).push(k);
  };
  const k0 = key(start, first, first !== s.nextDir ? 1 : Math.min(minRun, run0 + 1));
  best.set(k0, 1);
  steps.set(k0, 1);
  prev.set(k0, -1);
  push(k0, 1);
  for (let b = 0; b < buckets.length; b++) {
    const list = buckets[b];
    if (!list) continue;
    for (const k of list) {
      const cost = best.get(k)!;
      if (Math.round(cost * 10) !== b) continue;
      const run = k % R;
      const cell = Math.trunc(k / R) >> 2;
      const dir = Math.trunc(k / R) & 3;
      // At the star the player must be able to carry on: straight ahead is open, or a turn is possible.
      const ahead = nb(cell, dir);
      if (cell === goal && (run >= minRun || (ahead >= 0 && !blocked.has(ahead) && !s.body.includes(ahead)))) {
        const path: number[] = [];
        let at = k;
        while (at >= 0) {
          path.push(Math.trunc(at / R) >> 2);
          at = prev.get(at)!;
        }
        return path.reverse();
      }
      const d = steps.get(k)!;
      for (let nd = 0; nd < 4; nd++) {
        if (snakeReversal(dir, nd)) continue;
        const turn = nd !== dir;
        if (turn && run < minRun) continue;
        const next = nb(cell, nd);
        if (next < 0 || blocked.has(next)) continue;
        if ((freeAt.get(next) ?? 0) > d + 1) continue;
        const nk = key(next, nd, turn ? 1 : Math.min(minRun, run + 1));
        // snakeRev 9: a player who uses the speed lanes values a lane square as a quicker one.
        // (snakeOnLane: snakeRev 10's second vertical lane too.)
        const lane = LANES && snakeOnLane(s, cell, nd);
        const nc = cost + (lane ? 0.6 : 1) + (turn ? 0.4 : 0);
        if (nc < (best.get(nk) ?? Infinity)) {
          best.set(nk, nc);
          prev.set(nk, k);
          steps.set(nk, d + 1);
          push(nk, nc);
        }
      }
    }
  }
  return null;
}

/** Open area reachable from a cell (flood fill, body cells freeing over time). */
function space(s: SnakeState, from: number, blocked: Set<number>, freeAt: Map<number, number>): number {
  if (from < 0 || blocked.has(from)) return 0;
  const head = s.body[0]!;
  const dist = new Map<number, number>([[from, 1]]);
  const q = [from];
  while (q.length) {
    const cell = q.shift()!;
    const d = dist.get(cell)!;
    for (let nd = 0; nd < 4; nd++) {
      const next = nb(cell, nd);
      if (next < 0 || next === head || dist.has(next) || blocked.has(next)) continue;
      if ((freeAt.get(next) ?? 0) > d + 1) continue;
      dist.set(next, d + 1);
      q.push(next);
    }
  }
  return dist.size;
}

/** The first cell where a route runs into the body it laid itself (or -1). */
function selfCross(s: SnakeState, path: number[]): number {
  const len = s.body.length;
  const seen = new Map<number, number>();
  for (let i = 0; i < path.length; i++) {
    const at = seen.get(path[i]!);
    if (at !== undefined && i - at < len) return path[i]!;
    seen.set(path[i]!, i);
  }
  return -1;
}

interface Turn {
  /** The square the head must leave in `dir`, and its index on the route (-1: the head now). */
  cell: number;
  dir: number;
  index: number;
}

function turnsOf(s: SnakeState, path: number[]): Turn[] {
  const turns: Turn[] = [];
  let cell = s.body[0]!;
  let dir = s.nextDir;
  path.forEach((next, i) => {
    let d = 0;
    for (; d < 4; d++) if (nb(cell, d) === next) break;
    if (d !== dir) turns.push({ cell, dir: d, index: i - 1 });
    dir = d;
    cell = next;
  });
  return turns;
}

/** Ticks until the head arrives on path[i] (path[-1] = the head now: already there). */
function arrival(s: SnakeState, index: number, path?: number[]): number {
  if (!s.exp || !path) {
    const step = snakeStepTicks(s.eaten);
    return s.tick + (step - s.sinceMove) + index * step;
  }
  // snakeRev 9: each step's length depends on whether it runs along a speed lane (the player sees the lanes).
  const dirTo = (from: number, to: number) => {
    for (let d = 0; d < 4; d++) if (nb(from, d) === to) return d;
    return s.nextDir;
  };
  let at = s.tick - s.sinceMove;
  let from = s.body[0]!;
  for (let i = 0; i <= index; i++) {
    const d = dirTo(from, path[i]!);
    at += snakeStepTicksFor({ ...s, body: [from] } as SnakeState, d);
    from = path[i]!;
  }
  return at;
}

/** The route the player chooses now: per first direction, the route cost and whether it leaves room. */
function choose(s: SnakeState, human: Human, shadows: Set<number>, committed: boolean, minRun: number, run0: number, goal: number = s.pellet): number[] | null {
  const blocked = blockedSet(s, shadows);
  const freeAt = freeAtMap(s);
  const head = s.body[0]!;
  const opts: { path: number[] | null; cost: number; room: number; dir: number }[] = [];
  for (let dir = 0; dir < 4; dir++) {
    if (snakeReversal(s.dir, dir)) continue;
    // Too late to swipe again before the next square: the queued direction is what happens.
    if (committed && dir !== s.nextDir) continue;
    const next = nb(head, dir);
    if (next < 0 || blocked.has(next) || (freeAt.get(next) ?? 0) > 1) continue;
    // A route may not cross itself while its own body still lies there; ban the crossing and look again.
    let path: number[] | null = null;
    const banned = new Set(blocked);
    for (let tries = 0; tries < 6; tries++) {
      path = route(s, dir, goal, banned, freeAt, minRun, run0);
      const cross = path ? selfCross(s, path) : -1;
      if (cross < 0) break;
      banned.add(cross);
      path = null;
    }
    let cost = Infinity;
    if (path) {
      const turns = turnsOf(s, path).length;
      cost = path.length + 0.4 * turns;
    }
    let room = space(s, next, blocked, freeAt);
    if (path) {
      // Room once the star is eaten: the body as it will lie, flood-filled from the star.
      const body = [...path].reverse().concat(s.body).slice(0, s.body.length + 1);
      const after = { ...s, body } as SnakeState;
      const free2 = freeAtMap(after);
      room = 0;
      for (let d = 0; d < 4; d++) {
        const c = nb(body[0]!, d);
        if (c >= 0 && !blocked.has(c) && (free2.get(c) ?? 0) <= 1) room = Math.max(room, space(after, c, blocked, free2));
      }
    }
    opts.push({ path, cost, room, dir });
  }
  if (opts.length === 0) return null;
  // Whether this player bothers to check the route leaves room (weaker players skip it more).
  const careful = !human.chance(human.p.judgement * 0.6);
  const need = s.body.length + 2;
  const pool = opts.filter((o) => o.path && (!careful || o.room > need));
  if (pool.length === 0) {
    // No safe star route: head for the most open side for now.
    const values = opts.map((o) => o.room);
    const o = opts[human.pick(values)]!;
    return [nb(head, o.dir)];
  }
  const values = pool.map((o) => -o.cost);
  const o = pool[human.pick(values, 0.5)]!;
  const path = o.path!;
  // The player sees what lies past the star: if the meteor would run into a wall or rock
  // right after eating, the way out is part of the plan.
  const end = path[path.length - 1]!;
  const before = path.length > 1 ? path[path.length - 2]! : head;
  let dir = 0;
  for (; dir < 4; dir++) if (nb(before, dir) === end) break;
  const a1 = nb(end, dir);
  const a2 = a1 >= 0 ? nb(a1, dir) : -1;
  const bad = (c: number) => c < 0 || blocked.has(c) || s.body.includes(c);
  if (bad(a1) || bad(a2)) {
    const from = bad(a1) ? end : a1;
    const sides = [(dir + 1) % 4, (dir + 3) % 4];
    const clear = (d: number) => {
      let n = 0;
      for (let c = nb(from, d); c >= 0 && !bad(c) && n < 20; c = nb(c, d)) n++;
      return n;
    };
    // A way out that needs another swipe sooner than the player can make one is no way out.
    const rooms = sides.map((d) => (bad(nb(from, d)) ? -1 : clear(d) < minRun ? 0 : space(s, nb(from, d), blocked, freeAt) + 2 * clear(d)));
    const side = sides[human.pick(rooms)]!;
    if (from !== end) path.push(a1);
    if (!bad(nb(from, side))) path.push(nb(from, side));
  }
  return path;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const gap = SWIPE_GAP[level]!;
  const init = game.init(seed) as SnakeState;
  ROWS = snakeRowsOf(init);
  COLS = snakeColsOf(init);
  const features = Boolean(init.exp) && snakeBotOptions.features;
  WARPS = features ? (init.warps ?? []) : [];
  LANES = features;
  /** The gold star this player is going for, and the golds already decided on. */
  let goldGoal = -1;
  const goldSeen = new Set<number>();
  const GOLD_WILL: Record<SkillLevel, number> = { weak: 0.25, average: 0.45, good: 0.65, great: 0.8, near: 0.92, elite: 0.98, perfect: 1 };
  /** Swipes planned: tick → direction. */
  const swipes = new Map<number, number>();
  let lastSwipe = -100;
  let path: number[] | null = null;
  /** Index into path of the next cell the head should enter. */
  let pathAt = 0;
  let replanAt = human.reactTicks() + human.thinkTicks(FIND_MS);
  let lastPellet = init.pellet;
  let lastHead = init.body[0]!;
  const shadows = new Set<number>();
  const seenWarn = new Set<string>();
  /** Shadows that will be noticed at a tick. */
  const notice: { at: number; cells: number[] }[] = [];
  let autoAt = -1;

  const schedule = (s: SnakeState, turns: Turn[], p: number[]) => {
    for (const k of [...swipes.keys()]) if (k > s.tick) swipes.delete(k);
    const baseStep = snakeStepTicks(s.eaten);
    let earliest = Math.max(s.tick + 1, lastSwipe + gap);
    for (const turn of turns) {
      const index = turn.index;
      const prevDir0 = turns.indexOf(turn) > 0 ? turns[turns.indexOf(turn) - 1]!.dir : s.nextDir;
      // snakeRev 9: the head's stay on the turn square is shorter along a speed lane (either way out).
      const step = s.exp ? Math.min(snakeStepTicksFor({ ...s, body: [turn.cell] } as SnakeState, prevDir0), snakeStepTicksFor({ ...s, body: [turn.cell] } as SnakeState, turn.dir)) : baseStep;
      const enter = index < 0 ? s.tick - s.sinceMove : arrival(s, index, p);
      // Players shift the swipe inside the square's window away from whichever miss would crash:
      // early in the window if carrying on one square too far crashes, late if turning a square
      // early does. The shift leaves about one timing sd of margin.
      const prevDir = turns.indexOf(turn) > 0 ? turns[turns.indexOf(turn) - 1]!.dir : s.nextDir;
      const rockCells = snakeRockCells(s);
      const hard1 = (c: number) => c < 0 || rockCells.includes(c) || shadows.has(c) || s.body.slice(0, -2).includes(c);
      // A miss runs on for a square or two before the player can correct it.
      const hard = (from: number, d: number) => {
        const c1 = nb(from, d);
        return hard1(c1) || hard1(nb(c1, d));
      };
      const lateBad = hard(turn.cell, prevDir);
      const prevCell = index > 0 ? p[index - 1]! : index === 0 ? s.body[0]! : -1;
      const earlyBad = prevCell >= 0 && hard(prevCell, turn.dir);
      const sd = human.p.timingSdMs / (1000 / 60);
      const shift = Math.max(0, Math.min(step / 2 - 0.5, sd));
      const aim = step / 2 + (lateBad && !earlyBad ? -shift : earlyBad && !lateBad ? shift : 0);
      let at = Math.ceil(enter + aim + human.timingMs() / (1000 / 60));
      if (human.slip(0.3)) at += human.chance(0.5) ? step : -step;
      at = Math.max(at, earliest);
      while (swipes.has(at)) at++;
      swipes.set(at, turn.dir);
      earliest = at + gap;
    }
  };

  return driveEvents(game, (s: SnakeState, t) => {
    const head = s.body[0]!;
    // New rock shadows: noticed one reaction after they appear.
    // (snakeRev 10: a 2 × 2 rock's shadow covers its four squares; older rounds: the one square.)
    const warnCells = snakeWarnCells(s);
    const rockSpan = (s.rockWarn ?? -1) >= 0 ? snakeRockSpan(s, s.rockWarn!) : [];
    for (const c of warnCells) {
      const k = `${c}:${rockSpan.includes(c) ? s.rockLandTick : s.showerLandTick}`;
      if (!seenWarn.has(k)) {
        seenWarn.add(k);
        notice.push({ at: t + human.reactTicks(), cells: [c] });
      }
    }
    for (let i = notice.length - 1; i >= 0; i--) {
      if (notice[i]!.at <= t) {
        for (const c of notice[i]!.cells) shadows.add(c);
        notice.splice(i, 1);
        // Re-plan only if the shadow matters to the route or is right by the head.
        if (path) {
          const rest = path.slice(pathAt);
          const near = [...shadows].some((c) => rest.includes(c));
          if (near && replanAt < 0) replanAt = t + human.thinkTicks(150);
        }
      }
    }
    // Landed shadows become rocks (the shadow set keeps them; harmless).
    const landedCells = snakeRockCells(s);
    for (const c of shadows) if (!warnCells.includes(c) && !landedCells.includes(c)) shadows.delete(c);

    // snakeRev 9: a gold star appears; the player sees it a reaction later and decides whether it is worth the detour.
    if (features && (s.gold ?? -1) >= 0 && !goldSeen.has(s.goldAt ?? 0)) {
      goldSeen.add(s.goldAt ?? 0);
      if (human.chance(GOLD_WILL[level]!)) {
        const g = s.gold!;
        const dist = Math.abs(Math.trunc(g / COLS) - Math.trunc(head / COLS)) + Math.abs((g % COLS) - (head % COLS));
        // Worth it when it can be reached well before it fades.
        // (snakeRev 10's gold stars stay longer: goldLife.)
        const life = s.goldLife ?? SNAKE_GOLD_LIFE;
        let worth = dist * snakeStepTicks(s.eaten) + 40 < life;
        if (worth && (level === "elite" || level === "perfect")) {
          // Elite and flawless (Oct 2026): stars first. The gold is taken only when what it still pays (its
          // worth on arrival, nothing past the gold cap) beats the star points the detour's extra squares cost
          // at the run's own star rate, valued on the band curve where the run is heading.
          const step = snakeStepTicks(s.eaten);
          const md = (a: number, b: number) => Math.abs(Math.trunc(a / COLS) - Math.trunc(b / COLS)) + Math.abs((a % COLS) - (b % COLS));
          const extra = Math.max(0, dist + md(g, s.pellet) - md(head, s.pellet));
          const pays = Math.min(snakeGoldWorth(t + dist * step + 20, s.goldEnd ?? 0, life), SNAKE_V9_CAPS.gold - (s.goldPts ?? 0));
          // A star's worth is the curve's slope where the run is heading (its final count at this pace).
          const ticksPerStar = s.eaten > 2 ? t / s.eaten : 120;
          const final = Math.round(s.eaten + Math.max(0, game.runTicks - t) / ticksPerStar);
          const perStar = bandPoints(SNAKE_V9_BAND_CURVE, final) - bandPoints(SNAKE_V9_BAND_CURVE, final - 1);
          worth = pays > (extra * step * perStar) / ticksPerStar;
        }
        if (worth) {
          goldGoal = g;
          replanAt = t + human.reactTicks() + human.thinkTicks(200);
        }
      }
    }
    if (goldGoal >= 0 && s.gold !== goldGoal) {
      goldGoal = -1;
      replanAt = t + human.reactTicks();
    }
    // A star eaten: the next one has to be found.
    if (s.pellet !== lastPellet) {
      lastPellet = s.pellet;
      replanAt = t + human.reactTicks() + human.thinkTicks(FIND_MS);
    }
    // The head moved: check it is on the route.
    if (head !== lastHead) {
      lastHead = head;
      if (path) {
        if (path[pathAt] === head) pathAt++;
        else {
          path = null;
          for (const k of [...swipes.keys()]) if (k >= t) swipes.delete(k);
          if (replanAt < 0) replanAt = t + human.reactTicks();
        }
      }
      if (path && pathAt >= path.length) {
        path = null;
        // Route done without a star (a holding move, or the way out after one): look again.
        if (replanAt < 0) replanAt = t + human.thinkTicks(120);
      }
    }

    if (replanAt >= 0 && t >= replanAt) {
      replanAt = -1;
      const nextMove = t + snakeStepTicks(s.eaten) - s.sinceMove - 1;
      const step = snakeStepTicks(s.eaten);
      const minRun = Math.ceil(gap / step);
      const run0 = Math.max(0, Math.floor((nextMove - lastSwipe) / step));
      path = choose(s, human, shadows, nextMove - t < 2 || lastSwipe + gap > nextMove, minRun, run0, goldGoal >= 0 ? goldGoal : s.pellet);
      pathAt = 0;
      if (path) schedule(s, turnsOf(s, path), path);
    }

    // No route in hand: steer off whatever is two squares ahead (seen coming, so timed, not reacted).
    if (!path && autoAt < t && swipes.size === 0) {
      const blocked = blockedSet(s, shadows);
      const freeAt = freeAtMap(s);
      const heading = s.nextDir;
      const a1 = nb(head, heading);
      const a2 = a1 >= 0 ? nb(a1, heading) : -1;
      const bad = (c: number, d: number) => c < 0 || blocked.has(c) || (freeAt.get(c) ?? 0) > d;
      if (bad(a1, 1) || bad(a2, 2)) {
        const turnCell = bad(a1, 1) ? head : a1;
        const sides = [(heading + 1) % 4, (heading + 3) % 4];
        // Open area first, then the side with more clear squares straight ahead (away from a wall).
        const clear = (from: number, d: number) => {
          let n = 0;
          for (let c = nb(from, d); c >= 0 && !blocked.has(c) && !s.body.includes(c) && n < 20; c = nb(c, d)) n++;
          return n;
        };
        const rooms = sides.map((d) => (bad(nb(turnCell, d), turnCell === head ? 1 : 2) ? -1 : space(s, nb(turnCell, d), blocked, freeAt) + 2 * clear(turnCell, d)));
        const dir = sides[human.pick(rooms)]!;
        const p = turnCell === head ? [] : [a1];
        schedule(s, [{ cell: turnCell, dir, index: turnCell === head ? -1 : 0 }], p);
        autoAt = t + snakeStepTicks(s.eaten) * 2;
      }
    }

    const dir = swipes.get(t);
    if (dir !== undefined) {
      swipes.delete(t);
      lastSwipe = t;
      return { k: SNAKE_INPUT_TURN, a: dir, b: 0, c: 0, d: 0 };
    }
    return null;
  }, init);
};
