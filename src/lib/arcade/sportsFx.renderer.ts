/**
 * The Sports group's moments on the shared success layer (arcadeFx.renderer.ts; display only, 30 Oct 2026): each spec
 * reads counters its sim already keeps and never writes to it.
 */
import type { ArcadeFxSpec } from "./arcadeFx.renderer";
import { px } from "./engine";
import { MINIGOLF_H, MINIGOLF_HOLES, MINIGOLF_W, type MinigolfState } from "./minigolf";

const holedCount = (s: MinigolfState) => s.holed.reduce((a, v) => a + v, 0);
const lastHole = (s: MinigolfState) => Math.max(0, Math.min(s.hole, MINIGOLF_HOLES - 1));
const cupAt = (s: MinigolfState) => {
  const h = s.course[lastHole(s)]!;
  return { x: px(h.cup.x), y: px(h.cup.y) };
};

/** Minigolf: every hole holed pops at the cup (named by its score to par), all five holed is the finale; water is a miss. */
export const MINIGOLF_FX: ArcadeFxSpec<MinigolfState> = {
  game: "minigolf",
  world: "realworld",
  width: MINIGOLF_W,
  height: MINIGOLF_H,
  fit: "world",
  shake: false,
  events: [
    {
      kind: "pop",
      count: holedCount,
      at: cupAt,
      label: (s) => {
        const i = lastHole(s);
        const diff = (s.taken[i] ?? 0) - (s.pars[i] ?? 0);
        if (s.taken[i] === 1) return "HOLE IN ONE!";
        return diff <= -2 ? "EAGLE!" : diff === -1 ? "BIRDIE!" : diff === 0 ? "PAR" : `+${diff}`;
      },
      when: (s) => (s.taken[lastHole(s)] ?? 9) >= (s.pars[lastHole(s)] ?? 0),
    },
    {
      kind: "perfect",
      count: holedCount,
      at: cupAt,
      label: (s) => (s.taken[lastHole(s)] === 1 ? "HOLE IN ONE!" : "BIRDIE!"),
      when: (s) => (s.taken[lastHole(s)] ?? 9) < (s.pars[lastHole(s)] ?? 0),
      lights: ["#F2C75C", "#FFFFFF", "#7FD58A"],
    },
    { kind: "final", count: (s) => (holedCount(s) === MINIGOLF_HOLES ? 1 : 0), label: () => "ALL FIVE HOLED!" },
  ],
  misses: [{ count: (s) => s.waters, at: (s) => ({ x: px(s.x), y: px(s.y) }) }],
};
