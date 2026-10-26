/**
 * Swish: a player dragging out a throw and letting go.
 *
 * The phone draws the full NO-WIND arc of the current drag, so the player
 * places that arc's rim crossing beside the bucket by as much as they think
 * the wind will carry the ball, then lets go. The ideal throw (the arc through
 * the hoop and into the bucket, the moment that clears the spinner or meets
 * the sliding bucket) comes from the sim; that stands in for experience. The
 * human then adds, in the gesture's own terms:
 *   - wind misjudgement: the allowance is off by a relative error,
 *   - visual placement error of the arc against the rim (aim sd, phone px),
 *   - arc-height error (power) on the drag, which matters through hoops,
 *   - finger jitter at lift-off, in drag pixels,
 *   - release timing error on moving buckets and spinners, growing with the
 *     flight time the player has to lead by,
 *   - slips: a botched flick.
 * On sliding buckets the player either waits for the bucket to reach the end
 * of its slide (where it pauses; better players' habit) or leads it through
 * the middle. The bot never looks at the score.
 */
import { DRAG_FULL_PX, DRAG_MAX_SCALE_256, DRAG_MIN_PX, DRAG_MIN_SCALE_256, type ArcadeGame, type ArcadeInputEvent } from "../../../src/lib/arcade/engine";
import {
  binTossBinCentre,
  binTossCentreAt,
  binTossDragFor,
  binTossPath,
  BINTOSS_EXPAND,
  BINTOSS_REV_EXPAND,
  BINTOSS_V7_REF_V,
  binTossSlideOffset,
  binTossWindAcc,
  binTossWindSub,
  BINTOSS_AIM,
  BINTOSS_FLY,
  BINTOSS_INPUT_FLICK,
  BINTOSS_REF_V,
  BINTOSS_THROWS,
  BINTOSS_VX_MAX,
  type BinTossState,
} from "../../../src/lib/arcade/binToss";
import type { SkillLevel } from "../human";
import { driveEvents, type SkillBot } from "../bot";

/** Relative error judging how far a wind point pushes (shared with Flightpath). */
const WIND_READ: Record<SkillLevel, number> = { weak: 0.4, average: 0.3, good: 0.2, great: 0.12, near: 0.06, elite: 0.03, perfect: 0.03 };
/** Chance of waiting for the sliding bucket's turnaround rather than leading it through the middle. */
const WAIT_END: Record<SkillLevel, number> = { weak: 0.1, average: 0.35, good: 0.6, great: 0.85, near: 0.95, elite: 1, perfect: 1 };

/** binRev 7: the chance of going for the far bucket (on a throw that has one), by level. */
const GO_FAR: Record<SkillLevel, number> = { weak: 0, average: 0.12, good: 0.3, great: 0.6, near: 0.9, elite: 1, perfect: 1 };

/** The fastest launch a drag can give (a full 220-px drag), with a little room. */
const maxSpeedOf = (ref: number) => Math.floor((ref * DRAG_MAX_SCALE_256) / 256) - 10;

type Game = ArcadeGame<BinTossState, ArcadeInputEvent | null>;

/** Plays a throw from an AIM state on a fork: waits `delay` ticks, flicks, runs to the result. */
function forkThrow(game: Game, from: BinTossState, delay: number, vx: number, vy: number): BinTossState {
  let s = from;
  for (let k = 0; k < delay; k++) s = game.step(s, null);
  s = game.step(s, { t: s.tick + 1, k: BINTOSS_INPUT_FLICK, a: vx, b: vy, c: 0, d: 0 });
  let guard = 0;
  while (s.phase === BINTOSS_FLY && guard++ < 600) s = game.step(s, null);
  return s;
}

/** The drag (finger travel, phone px) that gives a launch, inverting the phone's drag mapping. */
function dragFor(vx: number, vy: number, ref = BINTOSS_REF_V): { dx: number; dy: number } {
  const speed = Math.hypot(vx, vy);
  const scale = (speed * 256) / ref;
  let len = DRAG_MIN_PX + ((scale - DRAG_MIN_SCALE_256) * (DRAG_FULL_PX - DRAG_MIN_PX)) / (DRAG_MAX_SCALE_256 - DRAG_MIN_SCALE_256);
  len = Math.max(DRAG_MIN_PX, Math.min(DRAG_FULL_PX, len + 0.5));
  return { dx: (vx / speed) * len, dy: (vy / speed) * len };
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const init = game.init(seed) as BinTossState;
  // binRev 7: the stronger throw, and a far bucket on throws 1–6.
  const expand = init.expand === BINTOSS_EXPAND;
  const ref = expand ? BINTOSS_V7_REF_V : BINTOSS_REF_V;
  const MAX_SPEED = maxSpeedOf(ref);
  // The player's habitual arc (launch upward speed), with some throw-to-throw variety.
  const habit = 1_050 + 250 * human.u();
  let planned = -1;
  let flick: { at: number; a: number; b: number } | null = null;

  const plan = (s: BinTossState, t: number) => {
    const index = s.throwIndex;
    const wind = s.winds[index] ?? 0;
    const acc = binTossWindAcc(index, s.rev);
    const sub = binTossWindSub(s.rev);
    /** Rim crossing (px) and ticks to it for a launch, under a wind. */
    const cross = (vx: number, vy: number, w: number) => {
      const path = binTossPath(vx, vy, w, true, acc, sub);
      return { x: path[path.length - 1]!.x, n: path.length - 1 };
    };
    /** vx whose rim crossing under wind w is at targetPx. */
    const solve = (vy: number, w: number, targetPx: number) => {
      let lo = -BINTOSS_VX_MAX;
      let hi = BINTOSS_VX_MAX;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cross(mid, vy, w).x < targetPx) lo = mid;
        else hi = mid;
      }
      return hi;
    };
    // binRev 7: go for the far bucket (its hoop hangs over it), or play the main bucket and leave the hoop.
    const farAt = expand ? (s.fars?.[index] ?? 0) : 0;
    const goFar = farAt > 0 && human.chance(GO_FAR[level]!);
    const wantHoop = Boolean(s.hoops?.[index]) && (!expand || goFar || !farAt);
    const spinner = Boolean(s.spinners?.[index]);
    const slide = s.slides[index]!;
    const sliding = slide.amp > 0;
    const pref = -Math.round(habit + 120 * human.normal());
    const vys = [0, 100, -100, 200, -200, 300, -300, 450, -450, 600, 800].map((o) => Math.max(-3_000, Math.min(-850, pref - o)));
    const scored = (out: BinTossState) => out.baskets > s.baskets && (!wantHoop || (out.swishes ?? 0) > (s.swishes ?? 0)) && (!goFar || (out.farIn ?? 0) > (s.farIn ?? 0));

    // Notice the new ball, read the wind, drag out the arc.
    const ready = human.reactTicks() + human.thinkTicks(1500);
    let best: { d: number; vx: number; vy: number; n: number } | null = null;
    let leadScale = 0;
    if (sliding) {
      // Aim at a fixed spot (an end of the slide, or its middle) and let go when the bucket will be there.
      const waitEnd = human.chance(WAIT_END[level]!);
      const rest = binTossBinCentre(index);
      // The next chance on either side (or through the middle), whichever comes first.
      // (If that never opens up past a spinner, the other way of timing it.)
      for (const sides of waitEnd ? [[1, -1], [0]] : [[0], [1, -1]]) {
        for (const vy of vys.slice(0, spinner ? 6 : 3)) {
          for (const side of sides) {
            const spot = (rest + side * slide.amp) / 256;
            const vx = solve(vy, wind, spot);
            if (Math.hypot(vx, vy) > MAX_SPEED) continue;
            const n = cross(vx, vy, wind).n;
            for (let d = ready; d < ready + 3 * slide.period && (!best || d < best.d); d++) {
              const land = t + d + n;
              const off = binTossSlideOffset(slide, land);
              const at = side === 0 ? Math.abs(off) < 3 * 256 && binTossSlideOffset(slide, land - 1) * binTossSlideOffset(slide, land + 1) <= 0
                : off * side >= Math.abs(binTossSlideOffset(slide, land - 1)) && off * side >= Math.abs(binTossSlideOffset(slide, land + 1));
              if (!at) continue;
              if (!scored(forkThrow(game, s, d, vx, vy))) continue;
              // With a spinner riding along, wait for a moment that is clearly open.
              if (spinner && !(scored(forkThrow(game, s, d - 2, vx, vy)) && scored(forkThrow(game, s, d + 2, vx, vy)))) continue;
              best = { d, vx, vy, n };
              leadScale = 1 + n / 60;
              break;
            }
          }
          if (best) break;
        }
        if (best) break;
      }
    } else {
      const centre = (goFar ? farAt : binTossCentreAt(s, index, t)) / 256;
      const hoop = wantHoop ? (s.hoops?.[index] ?? null) : null;
      let lines = vys.slice(0, 5).map((vy) => ({ vy, vx: solve(vy, wind, centre), miss: 0 })).filter((l) => Math.hypot(l.vx, l.vy) <= MAX_SPEED);
      if (hoop) {
        // Through the hoop: the arc (into the bucket) that falls closest to the hoop's middle.
        lines = [];
        for (let vy = -850; vy >= -3_000; vy -= 25) {
          const vx = solve(vy, wind, centre);
          const path = binTossPath(vx, vy, wind, true, acc, sub);
          let miss = Infinity;
          for (let i = 1; i < path.length; i++) {
            if (path[i]!.y > path[i - 1]!.y && path[i - 1]!.y < hoop.y / 256 && path[i]!.y >= hoop.y / 256) miss = Math.abs(path[i]!.x - hoop.x / 256);
          }
          if (Math.hypot(vx, vy) > MAX_SPEED) continue;
          lines.push({ vy, vx, miss: miss + Math.abs(vy - pref) / 200 });
        }
        lines.sort((a, b) => a.miss - b.miss);
        lines = lines.slice(0, 8);
      }
      if (spinner) {
        // Watch the bar turn and let go in the middle of the first clear gap.
        let pick: { d: number; vx: number; vy: number; len: number } | null = null;
        for (const line of lines) {
          let waited = s;
          for (let k = 0; k < ready; k++) waited = game.step(waited, null);
          let run = 0;
          for (let d = ready; d < ready + 170; d++) {
            const ok = scored(forkThrow(game, waited, 0, line.vx, line.vy));
            waited = game.step(waited, null);
            if (ok) run++;
            if ((!ok || d === ready + 169) && run > 0) {
              const len = run;
              const mid = (ok ? d : d - 1) - ((len - 1) >> 1);
              if (!pick || (len >= 8 && pick.len < 8) || (len > pick.len && pick.len < 8)) pick = { d: mid, vx: line.vx, vy: line.vy, len };
              run = 0;
              if (pick.len >= 8) break;
            }
          }
          if (pick && pick.len >= 8) break;
        }
        if (pick) best = { d: pick.d, vx: pick.vx, vy: pick.vy, n: cross(pick.vx, pick.vy, wind).n };
        leadScale = 1 + (best?.n ?? 80) / 60;
      } else {
        search: for (const line of lines) {
          for (const o of [0, -6, 6, -14, 14]) {
            if (scored(forkThrow(game, s, ready, line.vx + o, line.vy))) {
              best = { d: ready, vx: line.vx + o, vy: line.vy, n: cross(line.vx + o, line.vy, wind).n };
              break search;
            }
          }
        }
      }
    }
    if (!best) {
      // No clean line found: the plain throw at the bucket with the habitual arc.
      const vy = vys[0]!;
      const vx = solve(vy, wind, binTossCentreAt(s, index, t + ready + 80) / 256);
      best = { d: ready, vx, vy, n: cross(vx, vy, wind).n };
    }

    // Execution. The player sets the no-wind arc; its crossing is off by the wind
    // misjudgement and by the visual placement, and the arc height by a power error.
    const ideal = cross(best.vx, best.vy, wind).x;
    const still = cross(best.vx, best.vy, 0).x;
    const drift = ideal - still;
    const slip = human.slip();
    const vy = Math.round(best.vy * human.power(slip ? 4 : 0.6));
    const want = still - drift * WIND_READ[level]! * human.normal() + human.aim(1, 1.3);
    const vx = solve(vy, 0, want);
    const drag = dragFor(vx, vy, ref);
    // Lift-off jitter in finger pixels.
    const launch = binTossDragFor(expand ? BINTOSS_REV_EXPAND : null, drag.dx + human.aim(1, 0.3), drag.dy + human.aim(1, 0.3));
    const at = t + best.d + (leadScale > 0 ? human.timingTicks(leadScale) : 0);
    flick = launch ? { at: Math.max(t, at), a: launch.vx, b: launch.vy } : { at: Math.max(t, at), a: best.vx, b: best.vy };
  };

  return driveEvents(game, (s: BinTossState, t) => {
    if (s.phase !== BINTOSS_AIM || s.throwIndex >= BINTOSS_THROWS) return null;
    if (planned !== s.throwIndex) {
      planned = s.throwIndex;
      plan(s, t);
    }
    if (flick && t >= flick.at) {
      const ev = { k: BINTOSS_INPUT_FLICK, a: flick.a, b: flick.b, c: 0, d: 0 };
      flick = null;
      return ev;
    }
    return null;
  }, init);
};
