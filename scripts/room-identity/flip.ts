/**
 * Room identity for Roofbound flipRev 11 (3 Nov 2026, docs/arcade-standard/flip.md "flipRev 11"; the arcade rule):
 * `scheduleOf` replays an input log on the given revision and lists every seeded thing the run meets, read from the
 * run's own state as it plays: each hazard (its place, side, kind, slide), sweet spot (the perfect-landing strips),
 * star trail (drawn only on flipRev 11) and speed zone as it comes into view ahead of the runner, each checkpoint as it
 * is reached, and the cave's height there. The whole course is laid at init from the seed and the runner's x on each
 * tick is the course's own (`v8.xs`), so two very different logs on the same seed must list the same entries over the
 * ticks both runs lived: nothing appears, moves or changes because of how the player plays (the flow streak and the
 * perfect landings are counted from the player's moves, never placed by them).
 *
 *   import { roomIdentity } from "./room-identity/flip";
 */
import { flipGameFor, flipV8HeightAt, FLIP_INPUT_TAP, FLIP_REV_FLOW, FLIP_V8_CHECKPOINTS, FLIP_V8_READ_AHEAD, type FlipState } from "../../src/lib/arcade/flip";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { Human, type SkillLevel } from "../arcade-skill-bands/human";
import { bot } from "../arcade-skill-bands/bots/flip";

const FP = 256;

export function scheduleOf(seed: number, rev: number, events: unknown): { entries: { t: number; what: string }[]; endTick: number } {
  const game = flipGameFor(rev);
  const byTick = new Map(((events as ArcadeInputEvent[]) ?? []).map((e) => [e.t, e]));
  const out: { t: number; what: string }[] = [];
  let s = game.init(seed) as FlipState;
  const c = s.v8!;
  let seg = 0;
  let sweet = 0;
  let trail = 0;
  let zone = 0;
  const see = (t: number, st: FlipState) => {
    const edge = st.x + FLIP_V8_READ_AHEAD * FP;
    for (; seg < st.segs.length && st.segs[seg]!.x0 <= edge; seg++) {
      const g = st.segs[seg]!;
      out.push({ t, what: `hazard ${seg}: ${g.x0}-${g.x1} side ${g.side} kind ${g.kind} group ${g.group} slide ${g.amp ?? 0}/${g.per ?? 0}/${g.ph ?? 0}` });
    }
    for (; sweet < c.sweets.length && c.sweets[sweet]!.x0 <= edge; sweet++) out.push({ t, what: `sweet spot ${sweet}: ${c.sweets[sweet]!.x0}-${c.sweets[sweet]!.x1} side ${c.sweets[sweet]!.side}` });
    for (; trail < c.trails.length && c.trails[trail]!.launch <= edge; trail++) out.push({ t, what: `trail ${trail}: ${JSON.stringify(c.trails[trail])}` });
    for (; zone < c.zones.length && c.zones[zone]! <= t; zone += 2) out.push({ t, what: `speed zone ${zone / 2}: ${c.zones[zone]}-${c.zones[zone + 1]}` });
    if (FLIP_V8_CHECKPOINTS.includes(t)) out.push({ t, what: `checkpoint at x ${st.x} height ${flipV8HeightAt(c, st.x)}` });
  };
  see(0, s);
  while (!game.isOver(s)) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    see(s.tick, s);
  }
  // The course in the final state is the one dealt at init (nothing in it is ever rewritten).
  if (s.v8 !== c && JSON.stringify(s.v8) !== JSON.stringify(c)) out.push({ t: 0, what: "the course changed during the run" });
  return { entries: out, endTick: s.tick };
}

/** Taps at random ticks, about one and a half a second, from a seeded stream (no look at the course). */
export function randomLog(seed: number, ticks = 3600): ArcadeInputEvent[] {
  let a = (seed ^ 0x2545f491) >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const events: ArcadeInputEvent[] = [];
  for (let t = 1; t <= ticks; t += 20 + Math.floor(rand() * 40)) events.push({ t, k: FLIP_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
  return events;
}

/** A skill-band bot's log on the revision rooms deal (flipRev 11 since 3 Nov 2026). */
export function botLog(seed: number, level: SkillLevel, rev: number = FLIP_REV_FLOW): ArcadeInputEvent[] {
  return bot({ game: flipGameFor(rev), seed, rev, human: new Human("flip", seed, level), fixes: true }).events ?? [];
}

export const roomIdentity = {
  type: "flip",
  rev: FLIP_REV_FLOW,
  scheduleOf,
  logs: (seed: number) => [
    { name: "idle", log: [] },
    { name: "random", log: randomLog(seed) },
    { name: "weak", log: botLog(seed, "weak") },
    { name: "elite", log: botLog(seed, "elite") },
  ],
};
