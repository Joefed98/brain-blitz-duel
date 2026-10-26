/**
 * Flightpath: a player dragging the chalk reticle onto the board and letting go.
 *
 * The phone shows where a release right now would land (sway included, wind
 * not). So the human: looks at the new dart (a reaction), reads the wind, the
 * ring layout and any balloon, drags the reticle to a spot (think time), and
 * lets go at a chosen moment. The ideal drag comes from the sim's own landing
 * maths (that stands in for experience); the human then adds
 *   - wind misjudgement: the compensation is off by a relative error,
 *   - visual placement error of the reticle (aim sd, phone px = world px),
 *   - release timing error against the circling sway, the drifting target or
 *     the floating balloon (the release moment is anticipated, not reacted to),
 *   - finger jitter at lift-off, in drag pixels (amplified by the drag-to-landing gain),
 *   - slips: a botched release, or misreading the shuffled rings and aiming at the middle.
 * On drifting-target darts the player either waits for the target to reach the
 * end of its swing (where it pauses; the stronger habit of better players) or
 * leads it through the middle.
 */
import {
  bullseyeBoard,
  bullseyeDxOf,
  bullseyeWindShiftFor,
  BULLSEYE_EXPAND,
  BULLSEYE_V8_FLIGHT_NUM,
  BULLSEYE_FLIGHT_NUM,
  bullseyeBalloonPos,
  bullseyeDrag,
  bullseyeRingValues,
  bullseyeScalePct,
  bullseyeSway,
  bullseyeTargetDx,
  BULLSEYE_ARROWS,
  BULLSEYE_BOW_X,
  BULLSEYE_BOW_Y,
  BULLSEYE_CX,
  BULLSEYE_CY,
  BULLSEYE_DRIFT_FROM,
  BULLSEYE_DRIFT_PERIOD,
  BULLSEYE_FLIGHT_TICKS,
  BULLSEYE_INPUT_SHOT,
  BULLSEYE_REF_V,
  BULLSEYE_RING_STEP,
  BULLSEYE_TUNE,
  type BullseyeState,
} from "../../../src/lib/arcade/bullseye";
import { DRAG_FULL_PX, DRAG_MAX_SCALE_256, DRAG_MIN_PX, DRAG_MIN_SCALE_256 } from "../../../src/lib/arcade/engine";
import { driveEvents, type SkillBot } from "../bot";

/** Relative error judging how far a wind point pushes (shared with Swish). */
const WIND_READ: Record<string, number> = { weak: 0.4, average: 0.3, good: 0.2, great: 0.12, near: 0.06, elite: 0.035 };
/** Chance of waiting for the drifting target's turnaround rather than leading it through the middle. */
const WAIT_END: Record<string, number> = { weak: 0.2, average: 0.35, good: 0.6, great: 0.85, near: 0.95, elite: 1 };

/** Landing distance per launch unit (the sim's flight constant). */
const REACH = (BULLSEYE_BOW_Y - BULLSEYE_CY) / BULLSEYE_REF_V;

/** The drag (finger travel, phone px) that puts the swayless landing at (x, y); bullRev 8 reaches 1.5 times as far. */
function dragFor(x: number, y: number, expand = false): { dx: number; dy: number } {
  const ox = x - BULLSEYE_BOW_X;
  const oy = y - BULLSEYE_BOW_Y;
  const dist = Math.hypot(ox, oy);
  const reach = expand ? (REACH * BULLSEYE_V8_FLIGHT_NUM) / BULLSEYE_FLIGHT_NUM : REACH;
  const scale = (dist / reach / BULLSEYE_REF_V) * 256;
  let len = DRAG_MIN_PX + ((scale - DRAG_MIN_SCALE_256) * (DRAG_FULL_PX - DRAG_MIN_PX)) / (DRAG_MAX_SCALE_256 - DRAG_MIN_SCALE_256);
  len = Math.max(DRAG_MIN_PX, Math.min(DRAG_FULL_PX, len));
  return { dx: (ox / dist) * len, dy: (oy / dist) * len };
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const init = game.init(seed) as BullseyeState;
  let planned = -1;
  let release: { at: number; a: number; b: number } | null = null;
  return driveEvents(game, (s: BullseyeState, t) => {
    if (s.arrowIndex >= BULLSEYE_ARROWS) return null;
    // A dart is on the string once the last flight has finished (a release during flight is ignored).
    if (s.flightTick > 1) return null;
    const arrow = s.arrowIndex;
    if (planned !== arrow) {
      planned = arrow;
      // Notice the new dart, read the wind and board, drag the reticle into place.
      const ready = t + human.reactTicks() + human.thinkTicks(1300);
      // bullRev 8: each dart's board has its own height and size (and its drift stays on the range).
      const expand = s.expand === BULLSEYE_EXPAND;
      const board = bullseyeBoard(s, arrow);
      const boardDx = (u: number) => (expand ? bullseyeDxOf(s, arrow, u) : bullseyeTargetDx(arrow, u, s.driftPhase, s.driftDir));
      const scale = board.scalePct / 100;
      const ring = BULLSEYE_RING_STEP * scale;
      const balloon = s.balloons?.[arrow] ?? null;
      let goBalloon = Boolean(balloon) && !human.slip();
      const drift = arrow >= BULLSEYE_DRIFT_FROM;
      // The gold 10: the middle, or the top of its band when the rings are shuffled.
      const values = bullseyeRingValues(s, arrow);
      let tenAt = Math.max(0, values.indexOf(10));
      if (tenAt > 0 && human.slip()) tenAt = 0; // misread the shuffled board
      const ringOff = tenAt === 0 ? 0 : ring * (tenAt + 0.5);
      // When to let go, and where the spot is at landing.
      let at = ready;
      let spot: { x: number; y: number } = { x: BULLSEYE_CX, y: board.cy - ringOff };
      let useSway = true;
      let timeScale = 1;
      if (goBalloon && s.tune === BULLSEYE_TUNE) {
        // bullRev 4: the balloon adds to the ring under it, so a patient player
        // waits (up to 4 s) for it to cross the 10 and throws through it there;
        // otherwise they throw at it where it is, or leave it if it is far off.
        const tenSpot = (u: number) => ({ x: BULLSEYE_CX + boardDx(u), y: board.cy - ringOff });
        const wait = human.chance(WAIT_END[level]!);
        let best = ready;
        let bestD = Infinity;
        for (let u = ready; u < ready + (wait ? 240 : 1); u++) {
          const p = bullseyeBalloonPos(s, arrow, u + BULLSEYE_FLIGHT_TICKS)!;
          const t10 = tenSpot(u + BULLSEYE_FLIGHT_TICKS);
          const d = Math.hypot(p.x - t10.x, p.y - t10.y);
          if (d < bestD) {
            bestD = d;
            best = u;
          }
        }
        // bullRev 8: a streak running makes a balloon off the 10 not worth the risk.
        const leave = expand && (s.streak ?? 0) > 0 ? 1 : 2.5;
        if (wait && bestD > ring * leave) goBalloon = false; // not worth leaving the 10 for
        else {
          at = best;
          timeScale = 1.3;
          spot = bullseyeBalloonPos(s, arrow, at + BULLSEYE_FLIGHT_TICKS)!;
        }
      } else if (goBalloon) {
        // Leading a slow floating balloon: the reticle is put on where it will be.
        timeScale = 1.3;
        spot = bullseyeBalloonPos(s, arrow, at + BULLSEYE_FLIGHT_TICKS)!;
      }
      if (goBalloon) {
        // spot and timing set above
      } else if (drift) {
        // Watch the drift and let go ~a flight-time before the target reaches the chosen point.
        const waitEnd = human.chance(WAIT_END[level]!);
        const dxAt = (u: number) => boardDx(u + BULLSEYE_FLIGHT_TICKS);
        for (let u = ready; u < ready + BULLSEYE_DRIFT_PERIOD + 4; u++) {
          const a = dxAt(u - 1);
          const b = dxAt(u);
          const c = dxAt(u + 1);
          const hit = waitEnd ? Math.abs(b) >= Math.abs(a) && Math.abs(b) >= Math.abs(c) && Math.abs(b) > 20 : (a < 0) !== (b < 0) || b === 0;
          if (hit) {
            at = u;
            break;
          }
        }
        useSway = false;
        timeScale = waitEnd ? 1.3 : 1.5;
        spot = { x: BULLSEYE_CX + dxAt(at), y: board.cy - ringOff };
      }
      // Wind: the player shifts the reticle against it, misjudging the amount.
      const shift = bullseyeWindShiftFor(s, arrow, s.winds[arrow] ?? 0);
      const comp = shift * (1 + WIND_READ[level]! * human.normal());
      // Where the reticle is put (visual placement error), then the sway it is timed against.
      const sway = useSway ? bullseyeSway(arrow, at, board.scalePct) : { dx: 0, dy: 0 };
      const aimX = spot.x - comp + human.aim(1) - sway.dx;
      const aimY = spot.y + human.aim(1) - sway.dy;
      const drag = dragFor(aimX, aimY, expand);
      // Finger jitter on lift-off; a slip is a botched release.
      const jitter = human.slip() ? 6 : 0.25;
      const fx = drag.dx + human.aim(1, jitter);
      const fy = drag.dy + human.aim(1, jitter);
      const launch = bullseyeDrag(fx, fy);
      const fire = Math.max(t, at + human.timingTicks(timeScale));
      release = launch ? { at: fire, a: launch.vx, b: Math.min(0, launch.vy) } : null;
      // A drag too short to throw: the player drags again (plans this dart afresh next tick).
      if (!launch && expand) planned = -1;
    }
    if (release && t >= release.at && s.flightTick <= 1) {
      const ev = { k: BULLSEYE_INPUT_SHOT, a: release.a, b: release.b, c: 0, d: 0 };
      release = null;
      return ev;
    }
    return null;
  }, init);
};
