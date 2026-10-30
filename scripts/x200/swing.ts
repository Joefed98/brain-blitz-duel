/**
 * Grappler's room proof (the arcade rule; swingRev 15 since 29 Oct 2026, the swinging course,
 * docs/arcade-standard/swing.md; swingRev 14's (the assault course) and 13's modules before it). A room deal is the
 * server's own generator (generateSwing: any seed, the course built from it) under a fixed seed; every seeded item a
 * state shows is listed by `schedule`: the stretches (kind, hooks, squeeze, par, ledges, span), the hooks, the ledges,
 * the squeezes, the gates, gems and stars, the dragon's stretch, the cave's roof and lava. None of it depends on play
 * (the dragon itself is not scheduled: it appears behind the hero at the stretch `chaseFrom`, the same rule for everyone).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateSwing } from "../../src/lib/duel/arcade.server";
import { withSeededRandom } from "../../src/lib/duel/random";
import { swingGameFor, SWING_REV_REWORK, SWING_V15_BLOCKS, SWING_V15_GATES, SWING_V15_GEMS, SWING_V15_RUNS, SWING_V15_SQUEEZES, SWING_V15_STARS, type SwingState } from "../../src/lib/arcade/swing";

/** Stretches a swingRev 15 course holds: a swinging stretch a block, the ledge runs' sections. */
const STRETCHES = SWING_V15_BLOCKS - SWING_V15_RUNS.length + SWING_V15_RUNS.reduce((a, b) => a + b, 0);
import { bot, randomBot } from "../arcade-skill-bands/bots/swing";
import { Human } from "../arcade-skill-bands/human";
import type { RoomDeal, RoomStyle, X200Room } from "./room";

/**
 * A group of items read from one of the state's arrays, cached by that array (the sim copies an array whenever it
 * changes one, so a changed item is read afresh and compared; an unchanged array is the same items).
 */
const CACHE = new WeakMap<object, Record<string, unknown>>();
function group<T>(arr: readonly T[] | undefined, name: string, read: (x: T) => unknown): Record<string, unknown> {
  if (!arr) return {};
  let out = CACHE.get(arr);
  if (!out) {
    const made: Record<string, unknown> = {};
    arr.forEach((x, i) => (made[name + i] = read(x)));
    CACHE.set(arr, (out = made));
  }
  return out;
}
/** One item for a whole array: its length and an FNV-style hash of every number each element is read as. */
function whole<T>(arr: readonly T[] | undefined, name: string, read: (x: T) => number[]): Record<string, unknown> {
  if (!arr) return {};
  let out = CACHE.get(arr);
  if (!out) {
    let h = 0x811c9dc5;
    for (const x of arr) for (const v of read(x)) h = Math.imul(h ^ (v | 0), 16777619);
    CACHE.set(arr, (out = { [name]: `${arr.length}:${(h >>> 0).toString(16)}` }));
  }
  return out;
}

export const x200Room: X200Room = {
  type: "swing",
  rev: SWING_REV_REWORK,
  deals: 6,
  deal(n: number): RoomDeal {
    const puzzle = withSeededRandom(0x5917 + n * 7919, () => generateSwing());
    if (puzzle.swingRev !== SWING_REV_REWORK) throw new Error(`room deal ${n}: swingRev ${puzzle.swingRev}, not ${SWING_REV_REWORK}`);
    return { seed: puzzle.seed, game: swingGameFor(puzzle.swingRev) };
  },
  play(deal: RoomDeal, style: RoomStyle) {
    if (style === "idle") return { events: [] };
    const human = new Human("swing", deal.seed, style === "random" ? "weak" : style);
    const ctx = { game: deal.game, seed: deal.seed, rev: SWING_REV_REWORK, human };
    return style === "random" ? randomBot(ctx) : bot(ctx);
  },
  schedule(state: SwingState) {
    return {
      // The features, item by item.
      ...group(state.sections, "section", (k) => [k.kind, k.hook0, k.hooks, k.sq, k.par, k.from, k.to, k.x0, k.x1]),
      chaseFrom: state.chaseFrom,
      ...group(state.ledges, "ledge", (l) => [l.x, l.top, l.half, l.kind, l.section]),
      ...group(state.squeezes, "squeeze", (q) => [q.x0, q.x1, q.top, q.bottom]),
      ...group(state.starSpots, "star", (p) => p),
      ...group(state.gems, "gem", (p) => p),
      ...group(state.gates, "gate", (g) => [g.x, g.y0, g.y1]),
      // The hooks and the cave, one fingerprint each.
      ...whole(state.anchors, "hooks", (a) => [a.x, a.y]),
      ...whole(state.ceil, "ceiling", (v) => [v]),
      ...whole(state.floor, "lava", (v) => [v]),
    };
  },
  opportunities(state: SwingState) {
    return {
      sections: (state.sections ?? []).length,
      sectionTotal: STRETCHES,
      squeezes: (state.squeezes ?? []).length,
      squeezeTotal: SWING_V15_SQUEEZES,
      stars: (state.starSpots ?? []).length,
      starTotal: SWING_V15_STARS,
      gems: (state.gems ?? []).length,
      gemTotal: SWING_V15_GEMS,
      gates: (state.gates ?? []).length,
      gateTotal: SWING_V15_GATES,
      pars: (state.sections ?? []).filter((k) => k.par > 0).length,
    };
  },
};
