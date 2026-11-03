/**
 * Grappler on the arcade scoring standard (swingRev 17, the sliding hooks and the clean-swing streak, 3 Nov 2026;
 * swingRev 16, the dark ledge runs over 90 s, and swingRev 15, the swinging course, before it; docs/arcade-standard/swing.md):
 * course 110 (a straight line on the share of the course's length behind the hero, full at 700 per mille), pars 40
 * (over 50 stretches, each full at 30 ticks under par), gates 10 (2 each for the 5), the clean-swing streak 40 (2 for
 * every 8 clean grabs in a row). Total 200.
 *
 * perfect(): a built final state on real swingRev 17 courses (room seeds 0, 5 and 9): every stretch cleared 30 ticks
 * under its par, every gate banked, the streak's twenty blocks, scored by the sim's own score (swingScoreV17) and split
 * into parts by swingSlideParts, the function the reveal and grading read. swing-slide-check proves each course's own
 * planned route clears it with every gate and every sliding hook grabbed at home, and that stored skill-band runs reach
 * exactly 200 through the server's replay.
 */
import { swingGameFor, swingSlideParts, SWING_REV_DARK, SWING_REV_SLIDE, SWING_V15_PAR_FULL, SWING_V17_CORE, SWING_V17_GATES, SWING_V17_GATE_POINTS, SWING_V17_PAR_POINTS, SWING_V17_STREAK_EACH, SWING_V17_STREAK_MAX, type SwingState } from "../../src/lib/arcade/swing";
import { roomSeed } from "../arcade-skill-bands/games";
import type { StdEntry, StdRun } from "./entry";

const game = swingGameFor(SWING_REV_SLIDE);

/** A final state that cleared every stretch 30 ticks under par, banked every gate and paid the whole streak. */
function full(seed: number): SwingState {
  const init = game.init(seed) as SwingState;
  const total = init.sections!.length;
  return {
    ...init,
    acted: 1,
    sec: total,
    secTicks: init.sections!.reduce((ts: number[], sec, k) => [...ts, (ts[k - 1] ?? 0) + Math.max(1, sec.par - SWING_V15_PAR_FULL)], []),
    bankGates: (1 << SWING_V17_GATES) - 1,
    streakPaid: Math.ceil(SWING_V17_STREAK_MAX / SWING_V17_STREAK_EACH),
  };
}

export const entry: StdEntry = {
  type: "swing",
  field: "swingRev",
  rev: SWING_REV_SLIDE,
  before: SWING_REV_DARK,
  parts: [
    { key: "core", label: "Course (share of its length)", max: SWING_V17_CORE },
    { key: "par", label: "Pars", max: SWING_V17_PAR_POINTS },
    { key: "gates", label: "Gates", max: SWING_V17_GATE_POINTS * SWING_V17_GATES },
    { key: "streak", label: "Clean-swing streak", max: SWING_V17_STREAK_MAX },
  ],
  perfect(): StdRun[] {
    return [0, 5, 9].map((n) => {
      const s = full(roomSeed(n));
      const p = swingSlideParts(s);
      return { label: `a full run's state on room seed ${n}, the sim's score`, score: game.score(s), parts: { core: p.core, par: p.par, gates: p.gates, streak: p.streak } };
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
