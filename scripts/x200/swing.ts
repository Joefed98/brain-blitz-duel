/**
 * Grappler's room proof (the arcade rule, 26 Oct 2026; swingRev 13, docs/expansions/x200-swing.md). A room deal is
 * the server's own generator (generateSwing: a SWING_V13_BANK course by the room seed) under a fixed seed; every
 * seeded item a state shows is listed by `schedule`: the anchors, ceiling spikes, the ten touch stars, the twelve gems,
 * the eight speed gates and their openings, every set-route ledge (place, width, kind, section, whether it collapses),
 * each section's par time, the lava jets' cycles and the stalactites' places and trigger distances. None of it depends
 * on play (a stalactite's warning and fall do, so only where it hangs and when it triggers are listed; the dragon is
 * not scheduled: it appears behind the hero at 200 m, the same rule for everyone).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateSwing } from "../../src/lib/duel/arcade.server";
import { withSeededRandom } from "../../src/lib/duel/random";
import { swingGameFor, SWING_GUARANTEED_RAW, SWING_REV_EXPAND, SWING_STARS, type SwingState } from "../../src/lib/arcade/swing";
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
  rev: SWING_REV_EXPAND,
  deals: 6,
  deal(n: number): RoomDeal {
    const puzzle = withSeededRandom(0x5917 + n * 7919, () => generateSwing());
    if (puzzle.swingRev !== SWING_REV_EXPAND) throw new Error(`room deal ${n}: swingRev ${puzzle.swingRev}, not ${SWING_REV_EXPAND}`);
    return { seed: puzzle.seed, game: swingGameFor(puzzle.swingRev) };
  },
  play(deal: RoomDeal, style: RoomStyle) {
    if (style === "idle") return { events: [] };
    const human = new Human("swing", deal.seed, style === "random" ? "weak" : style);
    const ctx = { game: deal.game, seed: deal.seed, rev: SWING_REV_EXPAND, human };
    return style === "random" ? randomBot(ctx) : bot(ctx);
  },
  schedule(state: SwingState) {
    return {
      // The features, item by item.
      ...group(state.starSpots, "star", (p) => p),
      ...group(state.gems, "gem", (p) => p),
      ...group(state.gates, "gate", (g) => [g.x, g.y0, g.y1]),
      ...group(state.ledges, "ledge", (l) => [l.x, l.top, l.half, l.kind, l.section, l.order, l.crumble]),
      ...group(state.pars, "par", (p) => p),
      // The course and its hazards, one fingerprint each (anchor places, spikes, jet cycles, where stalactites hang and trigger, walls).
      ...whole(state.anchors, "anchors", (a) => [a.x, a.y]),
      ...whole(state.spikes, "spikes", (sp) => [sp.x, sp.top]),
      ...whole(state.jets, "jets", (j) => [j.x, j.period, j.phase, j.h]),
      ...whole(state.rocks, "rocks", (r) => [r.x, r.top, r.trigger]),
      ...whole(state.ceil, "ceiling", (v) => [v]),
      ...whole(state.floor, "lava", (v) => [v]),
    };
  },
  opportunities(state: SwingState) {
    const sections = new Set((state.ledges ?? []).map((l) => l.section)).size;
    return {
      stars: (state.starSpots ?? []).length,
      starTotal: SWING_STARS,
      gems: (state.gems ?? []).length,
      gates: (state.gates ?? []).length,
      ledges: (state.ledges ?? []).length,
      sections,
      pars: (state.pars ?? []).filter((p) => p > 0).length,
      guaranteedRaw: SWING_GUARANTEED_RAW,
    };
  },
};
