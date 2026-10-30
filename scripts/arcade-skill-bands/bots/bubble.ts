/**
 * Coral Pop: a human aims each shot with a drag while the aim trail shows the
 * path (wall bounces included, but not where the bubble will stick).
 *
 * Per shot: the player notices the last bubble land (one reaction), looks over
 * the field and thinks (think time, longer with a special in the shooter), then
 * drags. Where each aim would end up is the player's perception of the trail
 * (a fork of the sim shows the landing for a fan of aims); aims that end the
 * same way are one target window and the player aims at its middle. Targets are
 * valued in game terms (bubbles removed, a matching neighbour when nothing pops,
 * a field that gets dangerously low) and picked with blurred judgement; weaker
 * players overlook more bank shots. Whatever is in the shooter, colour or
 * special, is handled the same way: its outcome is read off the fork, so any
 * special schedule works. The release then carries angle error from finger
 * jitter over the drag length, larger for bank shots.
 */
import { dragLaunch, type ArcadeInputEvent } from "../../../src/lib/arcade/engine";
import { bubDangerLine, bubIsSpecial, bubRemaining, bubRowsOf, bubCellY, bubV8FeaturePoints, bubStdFeaturePoints, BUB_COLS, BUB_INPUT_SHOT, BUB_R, BUB_SPEED, bubSpeed, type BubState } from "../../../src/lib/arcade/bubble";
import type { SkillLevel } from "../human";
import { driveEvents, Plan, type SkillBot } from "../bot";

/** Typical drag length when aiming, phone px (the world is 390 px wide, so 1 world px = 1 phone px). */
const DRAG_PX = 150;
/** Bank shots are harder to read off the trail: extra pointing error per bounce (fraction). */
const BANK_ERR = 0.6;
/** Chance a bank-shot target is noticed at all, per level. */
const BANK_SEE: Record<SkillLevel, number> = { weak: 0.25, average: 0.45, good: 0.65, great: 0.82, near: 0.93, elite: 0.985, perfect: 1 };
/** Base (average-player) think time per shot, ms; a special in the shooter adds more. */
const THINK_MS = 1100;
const SPECIAL_THINK_MS = 500;

/** Fan of aim angles (radians from +x, upwards), 12°…168°. */
const ANGLES: number[] = Array.from({ length: 79 }, (_, i) => ((12 + i * 2) * Math.PI) / 180);

function neighbours(row: number, col: number): [number, number][] {
  const shifted = row % 2 === 1;
  const d = shifted ? 0 : -1;
  return [
    [row, col - 1],
    [row, col + 1],
    [row - 1, col + d],
    [row - 1, col + d + 1],
    [row + 1, col + d],
    [row + 1, col + d + 1],
  ];
}
const rowCols = (row: number) => (row % 2 === 0 ? BUB_COLS : BUB_COLS - 1);
let ROWS = 18;
const inGrid = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < rowCols(r);

/**
 * bubbleRev 8: how much a player weighs the skill features (chests, bank shots, combos) against plain
 * clearing; weaker players mostly just clear.
 */
/** The feature points that earn the whole feature bonus (BUB_V8_FEATURE_CURVE's top knot). */
const BUB_V8_FEATURE_TOP = 72;
const FEATURE_EYE: Record<SkillLevel, number> = { weak: 0, average: 0.25, good: 0.5, great: 0.8, near: 1, elite: 1, perfect: 1 };

function groupSize(grid: readonly number[], start: number): number {
  const colour = grid[start]!;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    for (const [r, c] of neighbours(Math.floor(i / BUB_COLS), i % BUB_COLS)) {
      if (!inGrid(r, c)) continue;
      const j = r * BUB_COLS + c;
      if (!seen.has(j) && grid[j] === colour) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen.size;
}

/** Lowest bubble's distance (px) above the shooter line. */
function clearance(s: BubState): number {
  for (let row = bubRowsOf(s.grid) - 1; row >= 0; row--)
    for (let col = 0; col < rowCols(row); col++) if (s.grid[row * BUB_COLS + col]) return bubDangerLine(s) - (bubCellY(row, s.descents) + BUB_R);
  return 999;
}

interface Outcome {
  key: string;
  after: BubState;
  bank: boolean;
  bounces: number;
  /** Path length to where it sticks, px. */
  path: number;
}

/** Where an aim ends: the sim's flight on a copy (what the trail and experience show). */
function outcome(game: Parameters<SkillBot>[0]["game"], s: BubState, angle: number): Outcome {
  const shot = dragLaunch(Math.cos(angle) * DRAG_PX, -Math.sin(angle) * DRAG_PX, BUB_SPEED)!;
  let f: BubState = game.step(s, { t: s.tick + 1, k: BUB_INPUT_SHOT, a: shot.vx, b: shot.vy, c: 0, d: 0 });
  let vx = f.vx;
  let bounces = 0;
  let ticks = 1;
  while (f.flightColour !== 0 && !game.isOver(f)) {
    f = game.step(f, null);
    ticks++;
    if (f.flightColour !== 0 && Math.sign(f.vx) !== Math.sign(vx)) bounces++;
    vx = f.vx;
  }
  // bubbleRev 5 shots fly faster in the deeper tank.
  return { key: f.grid.join(""), after: f, bank: bounces > 0, bounces, path: (ticks * bubSpeed(s)) / 256 };
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const plan = new Plan();
  let planned = false;
  const init = game.init(seed) as BubState;
  ROWS = bubRowsOf(init.grid);
  const eye = init.reef ? FEATURE_EYE[level]! : 0;
  const { events } = driveEvents(game, (s: BubState, t) => {
    if (s.flightColour !== 0) {
      planned = false;
      return null;
    }
    if (!planned) {
      planned = true;
      plan.clear();
      // Decide on the field as it is now (it does not move between shots).
      const holding = s.queue[s.queueAt] ?? 0;
      if (!holding) return null;
      const before = bubRemaining(s);
      const outs = ANGLES.map((a) => outcome(game, s, a));
      // Windows of neighbouring aims that end the same way.
      const windows: { lo: number; hi: number; o: Outcome }[] = [];
      outs.forEach((o, i) => {
        const w = windows[windows.length - 1];
        if (w && w.o.key === o.key && w.hi === i - 1) w.hi = i;
        else windows.push({ lo: i, hi: i, o });
      });
      const opts: { angle: number; value: number; o: Outcome; sensible: boolean }[] = [];
      // Elite and flawless (Oct 2026): base first. Once the feature points reach the top of the feature
      // curve (72 pay the whole 50) a bank shot or combo pays nothing, so only bubbles count. (Weighing
      // features at their curve's marginal pay against a bubble's was tried and scored lower than the flat
      // 0.9 bubbles a point: the curve is steepest at its top, so points taken early pay later.)
      let featureWeight = eye * 0.9;
      if (init.reef && (level === "elite" || level === "perfect") && bubV8FeaturePoints(s) >= BUB_V8_FEATURE_TOP) featureWeight = 0;
      // bubbleRev 11 (the arcade scoring standard): features pay fixed score points, each capped (a capped one adds
      // nothing), weighed against a bubble's 120 / 95 core points.
      const featurePts = init.std ? bubStdFeaturePoints : bubV8FeaturePoints;
      if (init.std) featureWeight = (eye * 95) / 120;
      for (const w of windows) {
        if (w.o.bank && !human.chance(BANK_SEE[level]!)) continue;
        const a = w.o.after;
        const removed = before - bubRemaining(a);
        let value = removed;
        let sensible = removed > 0;
        if (a.cleared) value += 40;
        // bubbleRev 8: the feature points this shot earns (a dropped chest, a bank shot, a combo), as the player weighs them.
        if (eye) value += featureWeight * (featurePts(a) - featurePts(s));
        if (a.dead) value -= 60;
        if (removed <= 0) {
          // Nothing popped: a bubble placed by its own colour sets up the next pop.
          const landed = a.grid.findIndex((v, i) => v !== 0 && s.grid[i] === 0);
          const touching = landed >= 0 && !bubIsSpecial(holding) ? groupSize(a.grid, landed) - 1 : 0;
          value += 0.8 * touching;
          if (touching > 0) sensible = true;
          if (bubIsSpecial(holding)) value -= 2; // a wasted special
        }
        // A field creeping down to the shooter line worries everyone.
        const gap = clearance(a);
        if (gap < 90) value -= (90 - gap) / 15;
        // Each bounce makes a shot harder to judge, so players lean towards simpler ones.
        value -= 0.5 * w.o.bounces;
        opts.push({ angle: (ANGLES[w.lo]! + ANGLES[w.hi]!) / 2, value, o: w.o, sensible });
      }
      // Colours are plain to see: everyone only weighs shots that pop something or join their own
      // colour (anything else only by a slip), unless there is no such shot.
      const sensibleOpts = opts.filter((o) => o.sensible);
      if (sensibleOpts.length && !human.slip(0.5)) opts.splice(0, opts.length, ...sensibleOpts);
      if (opts.length === 0) return null;
      const special = bubIsSpecial(holding);
      const choice = opts[human.pick(opts.map((o) => o.value), special ? 1.4 : 1)]!;
      // Lining the trail up on the target: pointing error measured where the bubble arrives
      // (wider per bounce), plus release jitter over the drag itself.
      const sdRad = Math.hypot((human.p.aimSdPx * (1 + BANK_ERR * choice.o.bounces)) / Math.max(120, choice.o.path), (0.3 * human.p.aimSdPx) / DRAG_PX);
      let angle = choice.angle + sdRad * human.normal();
      if (human.slip(0.3)) angle += 4 * sdRad * human.normal(); // fumbled release
      angle = Math.max((8 * Math.PI) / 180, Math.min((172 * Math.PI) / 180, angle));
      const len = Math.max(40, Math.min(220, DRAG_PX * human.power(4)));
      const shot = dragLaunch(Math.cos(angle) * len, -Math.sin(angle) * len, BUB_SPEED);
      if (!shot || shot.vy >= 0) return null;
      const think = human.thinkTicks(THINK_MS + (special ? SPECIAL_THINK_MS : 0) + (choice.o.bank ? 250 : 0));
      plan.at(t + human.reactTicks() + think, { k: BUB_INPUT_SHOT, a: shot.vx, b: shot.vy, c: 0, d: 0 });
    }
    return plan.take(t) as Omit<ArcadeInputEvent, "t"> | null;
  }, init);
  return { events };
};
