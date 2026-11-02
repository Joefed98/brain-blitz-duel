/**
 * Grappler on the arcade scoring standard (swingRev 16, the swinging course's dark ledge runs over 90 s, 1 Nov 2026;
 * swingRev 15, the swinging course, 29 Oct 2026, before it; docs/arcade-standard/swing.md): course 140 (a straight line
 * on the share of the course's length behind the hero), pars 30 (shared evenly by the stretches, full at 30 ticks under
 * par), gates, gems and stars 30 (2 each for the 5 of each kind). Total 200.
 *
 * perfect(): a built final state on real swingRev 16 courses (room seeds 0, 5 and 9): every stretch cleared 30 ticks
 * under its par, every gate, gem and star banked, scored by the sim's own score (swingScoreV15) and split into parts
 * by swingReworkParts, the function the reveal and grading read. swing-dark-check proves every course's own planned
 * route clears it inside the 90 s with every stretch 30+ ticks under par, and each pickup reachable on its line.
 */
import { swingGameFor, swingReworkParts, SWING_REV_DARK, SWING_REV_REWORK, SWING_V16_CORE, SWING_V15_GATES, SWING_V15_GEMS, SWING_V15_PAR_FULL, SWING_V15_PAR_POINTS, SWING_V15_PICKUP_POINTS, SWING_V15_STARS, type SwingState } from "../../src/lib/arcade/swing";
import { roomSeed } from "../arcade-skill-bands/games";
import type { StdEntry, StdRun } from "./entry";

const game = swingGameFor(SWING_REV_DARK);

/** A final state that cleared every stretch 30 ticks under par and banked every pickup. */
function full(seed: number): SwingState {
  const init = game.init(seed) as SwingState;
  const total = init.sections!.length;
  return {
    ...init,
    acted: 1,
    sec: total,
    secTicks: init.sections!.reduce((ts: number[], sec, k) => [...ts, (ts[k - 1] ?? 0) + Math.max(1, sec.par - SWING_V15_PAR_FULL)], []),
    bankGates: (1 << SWING_V15_GATES) - 1,
    bankGems: (1 << SWING_V15_GEMS) - 1,
    bankStars: Array.from({ length: SWING_V15_STARS }, (_, i) => i),
  };
}

export const entry: StdEntry = {
  type: "swing",
  field: "swingRev",
  rev: SWING_REV_DARK,
  before: SWING_REV_REWORK,
  parts: [
    { key: "core", label: "Course (share of its length)", max: SWING_V16_CORE },
    { key: "par", label: "Pars", max: SWING_V15_PAR_POINTS },
    { key: "pickups", label: "Gates, gems and stars", max: SWING_V15_PICKUP_POINTS * (SWING_V15_GATES + SWING_V15_GEMS + SWING_V15_STARS) },
  ],
  perfect(): StdRun[] {
    return [0, 5, 9].map((n) => {
      const s = full(roomSeed(n));
      const p = swingReworkParts(s);
      return { label: `a full run's state on room seed ${n}, the sim's score`, score: game.score(s), parts: { core: p.core, par: p.par, pickups: p.pickups } };
    });
  },
  played(): StdRun[] {
    const init = game.init(roomSeed(2)) as SwingState;
    return [{ label: "an acted state with nothing earned", score: game.score({ ...init, acted: 1 }) }];
  },
  idle(): StdRun[] {
    let s = game.init(roomSeed(2)) as SwingState;
    while (!game.isOver(s)) s = game.step(s, null) as SwingState;
    return [{ label: "no input for the whole 90 s (room seed 2)", score: game.score(s) }];
  },
};
