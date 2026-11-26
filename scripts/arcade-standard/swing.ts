/**
 * Grappler on the arcade scoring standard (swingRev 18, the bigger hero on a 14 px body, 15 Nov 2026, the Action overhaul's
 * stage 2: rev 17's parts and rules exactly; swingRev 17, the sliding hooks and the clean-swing streak, 3 Nov 2026;
 * swingRev 16, the dark ledge runs over 90 s, and swingRev 15, the swinging course, before it; docs/arcade-standard/swing.md):
 * course 110 (a straight line on the share of the course's length behind the hero, full at 700 per mille), pars 40
 * (over 45 stretches, each full at 30 ticks under par), gates 10 (2 each for the 5), the clean-swing streak 40 (2 for
 * every 8 clean grabs in a row). Total 200.
 *
 * perfect(): the first three dealt courses' oracle logs replayed through the server path (each dealt course is kept only
 * when its oracle scores exactly 200 there, scripts/swing-slide-deal.ts --rev=18), plus a built final state on the first dealt
 * course (every stretch 30 ticks under par, every gate, the streak's twenty blocks) scored by the sim's own score. swing-slide-check proves each course's own
 * planned route clears it with every gate and every sliding hook grabbed at home, and that stored skill-band runs reach
 * exactly 200 through the server's replay.
 *
 * Changed with Joe's approval, 26 Nov 2026 (routine consequence of D5's swingRev 19, the ladder): the entry is on swingRev 19 (rev 18 before it);
 * perfect() replays the first three Normal ladder witnesses (scripts/swing-ladder-deal.ts) through the server's grade, and
 * the full state is built on the first Normal ladder course with Normal's later par.
 */
import { swingGameFor, swingSlideParts, SWING_REV_BIG, SWING_REV_LADDER, SWING_V15_PAR_FULL, SWING_V17_CORE, SWING_V17_GATES, SWING_V17_GATE_POINTS, SWING_V17_PAR_POINTS, SWING_V17_STREAK_EACH, SWING_V17_STREAK_MAX, SWING_V19_LEVELS, type SwingState } from "../../src/lib/arcade/swing"; // Changed with Joe's approval, 26 Nov 2026 (swingRev 19: SWING_REV_LADDER, SWING_V19_LEVELS)
import { roomSeed } from "../arcade-skill-bands/games";
import type { StdEntry, StdRun } from "./entry";
import { SWING_LADDER_DEAL } from "../../src/lib/duel/swingLadderDeal.server"; // Changed with Joe's approval, 26 Nov 2026 (swingRev 19's ladder deal)
import { ladderGrade, readLadderWitnesses } from "../swing-ladder-deal"; // Changed with Joe's approval, 26 Nov 2026 (swingRev 19's Normal witnesses)
import { replaySwingRun } from "../../src/lib/duel/swing"; // Changed with Joe's approval, 26 Nov 2026 (the parts from the server's replay)
import { swingSlideSubmission } from "../swing-slide-deal"; // Changed with Joe's approval, 26 Nov 2026

const game = swingGameFor(SWING_REV_LADDER); // Changed with Joe's approval, 26 Nov 2026 (swingRev 19)

/** A final state that cleared every stretch 30 ticks under par, banked every gate and paid the whole streak. */
function full(seed: number): SwingState {
  const init = game.init(seed) as SwingState;
  const total = init.sections!.length;
  return {
    ...init,
    acted: 1,
    sec: total,
    // Changed with Joe's approval, 26 Nov 2026 (swingRev 19: Normal's later par, SWING_V19_LEVELS.normal.parLater).
    secTicks: init.sections!.reduce((ts: number[], sec, k) => [...ts, (ts[k - 1] ?? 0) + Math.max(1, sec.par + SWING_V19_LEVELS.normal.parLater - SWING_V15_PAR_FULL)], []),
    bankGates: (1 << SWING_V17_GATES) - 1,
    streakPaid: Math.ceil(SWING_V17_STREAK_MAX / SWING_V17_STREAK_EACH),
  };
}

export const entry: StdEntry = {
  type: "swing",
  field: "swingRev",
  rev: SWING_REV_LADDER, // Changed with Joe's approval, 26 Nov 2026 (swingRev 19)
  before: SWING_REV_BIG, // Changed with Joe's approval, 26 Nov 2026 (swingRev 18 before it)
  parts: [
    { key: "core", label: "Course (share of its length)", max: SWING_V17_CORE },
    { key: "par", label: "Pars", max: SWING_V17_PAR_POINTS },
    { key: "gates", label: "Gates", max: SWING_V17_GATE_POINTS * SWING_V17_GATES },
    { key: "streak", label: "Clean-swing streak", max: SWING_V17_STREAK_MAX },
  ],
  perfect(): StdRun[] {
    // Changed with Joe's approval, 26 Nov 2026 (swingRev 19): real runs, the first three Normal ladder witnesses (scripts/swing-ladder-deal.ts), graded
    // through the server's grade (ladderGrade), their parts from the server's replay (replaySwingRun on swingRev 19).
    const unpack = (packed: readonly number[][]) => packed.map(([t, k, a]) => ({ t: t!, k: k!, a: a!, b: 0, c: 0, d: 0 })); // Changed with Joe's approval, 26 Nov 2026
    const runs: StdRun[] = readLadderWitnesses("normal").witnesses.slice(0, 3).map((w) => {
      const g = ladderGrade(w.seed, "normal", w.events); // Changed with Joe's approval, 26 Nov 2026
      const v = swingSlideParts(replaySwingRun(w.seed, swingSlideSubmission(w.seed, unpack(w.events) as never, SWING_REV_LADDER, null), SWING_REV_LADDER).state as SwingState); // Changed with Joe's approval, 26 Nov 2026
      return { label: `dealt Normal course ${w.seed}: its proof log through the server replay`, score: g.flagged ? 0 : g.score, parts: { core: v.core, par: v.par, gates: v.gates, streak: v.streak } }; // Changed with Joe's approval, 26 Nov 2026
    });
    // And a full run's built state (every part at its maximum) on the first Normal ladder course, the sim's own score.
    const s = full(SWING_LADDER_DEAL.normal[0]!); // Changed with Joe's approval, 26 Nov 2026 (swingRev 19's Normal deal)
    const p = swingSlideParts(s);
    return [...runs, { label: "a full run's state on the first dealt course, the sim's score", score: game.score(s), parts: { core: p.core, par: p.par, gates: p.gates, streak: p.streak } }];
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
