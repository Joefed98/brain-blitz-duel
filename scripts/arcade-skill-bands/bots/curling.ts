/**
 * Curling: a player setting the broom, picking the turn and swiping up the lane, then sweeping.
 *
 * The ideal throw from where the stones sit (the oracle's throw search, scripts/curling-oracle.ts, on a lighter grid)
 * stands in for experience: where to hold the broom for the curl and how hard to throw. The human then adds, in the
 * gesture's own terms:
 *   - broom placement error (aim sd in phone px, at the far house's 3.3 cm a px),
 *   - weight error from the swipe's speed (power sd, half again: a swipe is less steady than a drag),
 *   - a slip: the wrong turn,
 *   - think time before each throw, a reaction to the stones settling,
 *   - sweeping (great and better): looking ahead as the stone slides and rubbing while it looks short of where it was
 *     meant to stop (perception, not the score).
 * curlRev 2 (31 Oct 2026): the start along the hog line is part of the throw (the ideal throw's start, slid with the
 * finger's error at the hog line's 1.2 cm a px; the search starts on the centre line), and the brushers (great and
 * better) look ahead and give one stroke, as hard as the miss is wide, on the side the stone must bend towards when it
 * looks more than 10 cm wide of the plan
 * (and not already long: a bend carries it too), or alternate sides to carry it when it looks short.
 * curlRev 3 (1 Nov 2026, "prepare the shot"): the error model is re-based on the gesture (curlRev 1 and 2 keep theirs,
 * so their measurements stand). The weight is a swipe: the error is relative to the swipe's speed, not the weight
 * (SWIPE_SD_SCALE × the level's power sd: weak 25 %, average 17.5 %, good 11 %, great 7.5 %, near-perfect 3.75 %,
 * elite 2.75 %), aimed at the meter's mark (the ideal weight; for a draw the draw zone's tee mark is the same); the
 * phone's own swipe → weight line (curlWeightFromSwipeV3) turns it into a weight. Reading the line (where to put the
 * broom for the curl) costs the level's judgement × LINE_CM cm on top of the drag's pixel error; the aim line makes the
 * wrong turn rarer (half the slips). Brushing as on curlRev 2 from great up; good players carry a stone that looks
 * short (both sides in turn, CARRIES_V3) but never bend one.
 * curlRev 4 (3 Nov 2026, the power bar): the weight is set by a tap or drag on the power bar and thrown with a
 * button, so the weight's error is the tap's on the bar (the level's pointing error × BAR_W_PER_PX weights a px, the
 * bar's 300 world px for 1000 weights at the phone's scale) plus reading the right weight (the level's judgement ×
 * WEIGHT_READ weights; a draw's mark is shown, so a draw reads at a third of it). The ideal throw knows the reds: the
 * search counts a stone that ends behind a red in the house as a miss. Line reading, slips and brushing as curlRev 3.
 * Flawless plays the bank's proven plan (scripts/fixtures/curling-witness.json, curlRev 2's curling-witness-v2.json)
 * where the seed has one, else the oracle's: every stone on the button.
 */
import { existsSync, readFileSync } from "node:fs";
import type { ArcadeInputEvent } from "../../../src/lib/arcade/engine";
import { curlingGameFor, CURL_AIM, CURL_INPUT_SWEEP, CURL_INPUT_THROW, CURL_START_MAX, CURL_TRAVEL, CU, type CurlingState } from "../../../src/lib/arcade/curling";
import { perfectPlan, planEvents, searchThrows, sheetOf, theirsIn, throwEvent, type Throw } from "../../curling-oracle";
import { driveEvents, idle, type SkillBot } from "../bot";
import { curlWeightFromSwipeV3, swipeForWeightV3 } from "../../../src/lib/arcade/curling";

const WITNESS = {
  1: new URL("../../fixtures/curling-witness.json", import.meta.url),
  2: new URL("../../fixtures/curling-witness-v2.json", import.meta.url),
  3: new URL("../../fixtures/curling-witness-v3.json", import.meta.url),
  4: new URL("../../fixtures/curling-witness-v4.json", import.meta.url),
} as const;
const witnesses: Record<number, Map<number, Throw[]>> = {};
function witnessFor(seed: number, rev: 1 | 2 | 3 | 4): Throw[] | null {
  if (!witnesses[rev]) {
    const map = new Map<number, Throw[]>();
    if (existsSync(WITNESS[rev])) {
      for (const w of JSON.parse(readFileSync(WITNESS[rev], "utf8")) as { seed: number; throws: number[][] }[]) {
        map.set(
          w.seed,
          w.throws.map((t) => (t.length === 5 ? { sx: t[0]!, bx: t[1]!, by: t[2]!, weight: t[3]!, turn: t[4]! } : { bx: t[0]!, by: t[1]!, weight: t[2]!, turn: t[3]! })),
        );
      }
    }
    witnesses[rev] = map;
  }
  return witnesses[rev]!.get(seed) ?? null;
}

/** Far-house cm a phone px (the broom drag's scale). */
const CM_PER_PX = 3.3;
/** Near hog line cm a phone px (curlRev 2's start slide). */
const START_CM_PER_PX = 1.2;
/** Sweep from these levels up. */
const SWEEPS = new Set(["great", "near", "elite"]);
/** curlRev 3: good players carry a stone that looks short too (both sides in turn), but never bend it. */
const CARRIES_V3 = new Set(["good"]);
/** curlRev 3: the swipe's relative speed error is this × the level's power sd. */
export const SWIPE_SD_SCALE = 2.5;
/** curlRev 3: reading the line, cm of broom error per unit of the level's judgement. */
export const LINE_CM = 25;

/** curlRev 4: power-bar weights a phone px (1000 weights over the bar's 300 world px, a world px ≈ 1.06 phone px). */
export const BAR_W_PER_PX = 3.1;
/** curlRev 4: reading the weight a shot needs, weights per unit of the level's judgement (a draw a third of it). */
export const WEIGHT_READ = 280;

/** curlRev 4's weight through the power bar: the ideal weight, off by the tap and the read. */
function barWeight(ideal: number, draw: boolean, human: { aim: (k?: number, s?: number) => number; normal: () => number; p: { judgement: number } }): number {
  const read = human.p.judgement * WEIGHT_READ * (draw ? 1 / 3 : 1) * human.normal();
  return Math.max(1, Math.min(1000, Math.round(ideal + human.aim(BAR_W_PER_PX) + read)));
}

/** curlRev 3's weight through the swipe: the ideal weight's swipe speed, off by the human's relative error, back to a weight. */
function swipedWeight(ideal: number, human: { power: (scale?: number) => number }): number {
  const v = swipeForWeightV3(ideal);
  return curlWeightFromSwipeV3(v * human.power(SWIPE_SD_SCALE));
}

export const bot: SkillBot = ({ seed, human, rev }) => {
  const r: 1 | 2 | 3 | 4 = rev === 4 ? 4 : rev === 3 ? 3 : rev === 2 ? 2 : 1;
  const game = curlingGameFor(r);
  if (human.level === "perfect") {
    const plan = witnessFor(seed, r) ?? perfectPlan(seed, 3, 30, r);
    if (plan) return { events: planEvents(seed, plan, 0, r).events };
  }
  let throwAt = -1;
  let planned: { t: Throw; targetX: number; targetY: number } | null = null;
  let nextLook = 0;
  let sweepUntil = -1;
  let side = 0;
  let alternate = 1;
  let nudge = 0;
  let lastPhase = -1;
  const out = driveEvents<CurlingState>(
    game,
    (s, t) => {
      if (s.phase !== lastPhase) {
        lastPhase = s.phase;
        if (s.phase === CURL_AIM) {
          // The stones have settled: react, look at the house, think, then throw.
          throwAt = t + human.reactTicks() + human.thinkTicks(2400);
          const ideal = searchThrows(sheetOf(s), { refine: 6, xStep: 6, wStep: r >= 3 ? 20 : 12, rev: r })[0]!;
          const turn = human.slip(r >= 3 ? 0.5 : 1) ? 1 - ideal.t.turn : ideal.t.turn;
          const bx = Math.round(ideal.t.bx + human.aim(CM_PER_PX) + (r >= 3 ? human.p.judgement * LINE_CM * human.normal() : 0));
          const weight =
            r >= 4
              ? barWeight(ideal.t.weight, ideal.theirs === theirsIn(sheetOf(s)) && ideal.t.weight < 420, human)
              : r >= 3
                ? swipedWeight(ideal.t.weight, human)
                : Math.max(1, Math.min(1000, Math.round(ideal.t.weight * human.power(1.5))));
          const a = ideal.after;
          const i = a.x.length - 1;
          const sx = r >= 2 ? Math.max(-CURL_START_MAX, Math.min(CURL_START_MAX, Math.round((ideal.t.sx ?? 0) + human.aim(START_CM_PER_PX)))) : 0;
          planned = { t: { bx, by: 0, weight, turn, ...(r >= 2 ? { sx } : {}) }, targetX: a.live[i] ? a.x[i]! : 0, targetY: a.live[i] ? a.y[i]! : 0 };
          nextLook = 0;
          sweepUntil = -1;
        }
      }
      if (s.phase === CURL_AIM && planned && t >= throwAt) {
        const ev = throwEvent(planned.t);
        return ev;
      }
      const carryOnly = r >= 3 && CARRIES_V3.has(human.level);
      if (s.phase === CURL_TRAVEL && planned && (SWEEPS.has(human.level) || carryOnly) && s.active >= 0 && s.live[s.active]) {
        if (t >= nextLook && s.travelTicks > 60) {
          nextLook = t + 20 + human.reactTicks();
          // Where would it stop with no more sweeping? Short of the plan by more than a stone's width: sweep. On curlRev 2
          // wide of it by more than a few cm: brush the side it must bend towards.
          const ahead = idle(game, s, 600);
          const i = s.active;
          const stopY = ahead.live[i] ? ahead.y[i]! : -Infinity;
          const stopX = ahead.live[i] ? ahead.x[i]! : planned.targetX;
          const wide = planned.targetX - stopX;
          // A bend also carries it: only bend a stone that is not already running long.
          // One short stroke, as hard as the miss is wide (a bend runs on for most of a second after it).
          if (r >= 2 && !carryOnly && Math.abs(wide) > 10 * CU && stopY >= planned.targetY - 8 * CU) {
            side = wide < 0 ? -1 : 1;
            nudge = Math.max(5, Math.min(60, Math.round(Math.abs(wide) / CU / 2)));
            sweepUntil = -1;
          } else if (stopY > planned.targetY + 12 * CU) {
            side = 0;
            sweepUntil = t + 20;
          } else sweepUntil = -1;
        }
        if (nudge > 0) {
          const a = nudge;
          nudge = 0;
          return { k: CURL_INPUT_SWEEP, a, b: side, c: 0, d: 0 };
        }
        if (t <= sweepUntil && t % 4 === 0) {
          if (r < 2) return { k: CURL_INPUT_SWEEP, a: 60, b: 0, c: 0, d: 0 };
          // Carrying only: alternate the sides so the bends cancel.
          const b = side !== 0 ? side : (alternate = -alternate);
          return { k: CURL_INPUT_SWEEP, a: 60, b, c: 0, d: 0 };
        }
      }
      return null;
    },
    game.init(seed),
  );
  return { events: out.events };
};

/** Random play: a random broom, turn, weight (and curlRev 2's start) after a random wait, never sweeping. */
export const randomBot: SkillBot = ({ seed, human, rev }) => {
  const r: 1 | 2 | 3 | 4 = rev === 4 ? 4 : rev === 3 ? 3 : rev === 2 ? 2 : 1;
  const game = curlingGameFor(r);
  let at = -1;
  const out = driveEvents<CurlingState>(
    game,
    (s, t) => {
      if (s.phase !== CURL_AIM) {
        at = -1;
        return null;
      }
      if (at < 0) at = t + human.int(30, 240);
      if (t < at) return null;
      at = -1;
      const ev = { k: CURL_INPUT_THROW, a: human.int(-150, 150), b: human.int(-100, 100), c: human.int(150, 600) * 2 + human.int(0, 1), d: 0 } satisfies Omit<ArcadeInputEvent, "t">;
      return r >= 2 ? { ...ev, d: human.int(-CURL_START_MAX, CURL_START_MAX) } : ev;
    },
    game.init(seed),
  );
  return { events: out.events };
};
