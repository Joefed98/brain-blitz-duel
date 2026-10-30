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
 * Flawless plays the bank's proven plan (scripts/fixtures/curling-witness.json) where the seed has one, else the
 * oracle's: every stone on the button.
 */
import { existsSync, readFileSync } from "node:fs";
import type { ArcadeInputEvent } from "../../../src/lib/arcade/engine";
import { curlingGameFor, CURL_AIM, CURL_INPUT_SWEEP, CURL_INPUT_THROW, CURL_TRAVEL, CU, type CurlingState } from "../../../src/lib/arcade/curling";
import { perfectPlan, planEvents, searchThrows, sheetOf, throwEvent, type Throw } from "../../curling-oracle";
import { driveEvents, idle, type SkillBot } from "../bot";

const WITNESS = new URL("../../fixtures/curling-witness.json", import.meta.url);
let witnesses: Map<number, Throw[]> | null = null;
function witnessFor(seed: number): Throw[] | null {
  if (!witnesses) {
    witnesses = new Map();
    if (existsSync(WITNESS)) {
      for (const w of JSON.parse(readFileSync(WITNESS, "utf8")) as { seed: number; throws: [number, number, number, number][] }[]) {
        witnesses.set(w.seed, w.throws.map(([bx, by, weight, turn]) => ({ bx, by, weight, turn })));
      }
    }
  }
  return witnesses.get(seed) ?? null;
}

/** Far-house cm a phone px (the broom drag's scale). */
const CM_PER_PX = 3.3;
/** Sweep from these levels up. */
const SWEEPS = new Set(["great", "near", "elite"]);

export const bot: SkillBot = ({ seed, human }) => {
  const game = curlingGameFor();
  if (human.level === "perfect") {
    const plan = witnessFor(seed) ?? perfectPlan(seed, 3, 30);
    if (plan) return { events: planEvents(seed, plan).events };
  }
  let throwAt = -1;
  let planned: { t: Throw; targetY: number } | null = null;
  let nextLook = 0;
  let sweepUntil = -1;
  let lastPhase = -1;
  const out = driveEvents<CurlingState>(
    game,
    (s, t) => {
      if (s.phase !== lastPhase) {
        lastPhase = s.phase;
        if (s.phase === CURL_AIM) {
          // The stones have settled: react, look at the house, think, then throw.
          throwAt = t + human.reactTicks() + human.thinkTicks(2400);
          const ideal = searchThrows(sheetOf(s), { refine: 6, xStep: 6, wStep: 12 })[0]!;
          const turn = human.slip() ? 1 - ideal.t.turn : ideal.t.turn;
          const bx = Math.round(ideal.t.bx + human.aim(CM_PER_PX));
          const weight = Math.max(1, Math.min(1000, Math.round(ideal.t.weight * human.power(1.5))));
          const a = ideal.after;
          planned = { t: { bx, by: 0, weight, turn }, targetY: a.live[a.x.length - 1] ? a.y[a.x.length - 1]! : 0 };
          nextLook = 0;
          sweepUntil = -1;
        }
      }
      if (s.phase === CURL_AIM && planned && t >= throwAt) {
        const ev = throwEvent(planned.t);
        return ev;
      }
      if (s.phase === CURL_TRAVEL && planned && SWEEPS.has(human.level) && s.active >= 0 && s.live[s.active]) {
        if (t >= nextLook && s.travelTicks > 60) {
          nextLook = t + 20 + human.reactTicks();
          // Where would it stop with no more sweeping? Short of the plan by more than a stone's width: sweep.
          const ahead = idle(game, s, 600);
          const i = s.active;
          const stopY = ahead.live[i] ? ahead.y[i]! : -Infinity;
          sweepUntil = stopY > planned.targetY + 12 * CU ? t + 20 : -1;
        }
        if (t <= sweepUntil && t % 4 === 0) return { k: CURL_INPUT_SWEEP, a: 60, b: 0, c: 0, d: 0 };
      }
      return null;
    },
    game.init(seed),
  );
  return { events: out.events };
};

/** Random play: a random broom, turn and weight after a random wait, never sweeping. */
export const randomBot: SkillBot = ({ seed, human }) => {
  const game = curlingGameFor();
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
      return { k: CURL_INPUT_THROW, a: human.int(-150, 150), b: human.int(-100, 100), c: human.int(150, 600) * 2 + human.int(0, 1), d: 0 } satisfies Omit<ArcadeInputEvent, "t">;
    },
    game.init(seed),
  );
  return { events: out.events };
};
