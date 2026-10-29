/**
 * Room identity for Jaywalk crossRev 9 and 10 (docs/expansions/x200-cross.md, the 26 Oct 2026 arcade rule):
 * `scheduleOf` replays an input log on the given revision and lists every seeded appearance. Jaywalk's world
 * is one course per crossing, laid out at init from the seed: its lanes (cars, buses, bikes, motorbikes,
 * roadworks, the island), their speeds, gaps and phases, and its coins (four on each of crossings 1–5, twenty
 * a run). Each crossing's traffic runs on that crossing's own clock (from the moment its kerb pause ends), so
 * the entries are on the crossing clock: `t` is the crossing number (0 = the first), and `what` spells out the
 * course and coins the walker meets there, read from the run's state as it starts that crossing. Two very
 * different logs on the same seed must list the same entries over the crossings both runs reached: nothing
 * appears, moves or changes because of how the player plays.
 *
 *   import { roomIdentity } from "./room-identity/cross";
 */
import { CROSS_INPUT_MOVE, crossCourse, crossGameFor, CROSS_REV_STD, type CrossCourse, type CrossState } from "../../src/lib/arcade/cross";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { Human, type SkillLevel } from "../arcade-skill-bands/human";
import { bot } from "../arcade-skill-bands/bots/cross";

const KIND = ["car", "bikes", "roadworks", "island", "bus", "motorbikes"];

/** One course, spelled out: every lane's kind, direction, speed, length, period and phase (riders' offsets), and the coins. */
export function describeCourse(course: CrossCourse): string {
  const lanes = course.lanes.map((l, i) => `${i + 1}:${KIND[l.kind ?? 0]} ${l.dir > 0 ? ">" : "<"}${l.speed}/${l.blockW}/${l.period}@${l.phase}${l.offsets ? `[${l.offsets.join(",")}]` : ""}${l.closed ? ` closed ${l.closed.join(",")}` : ""}`);
  const coins = (course.coins ?? []).map((c) => `lane ${c >> 4} col ${c & 15}`);
  return `${lanes.join("; ")} | coins: ${coins.length ? coins.join(", ") : "none"}`;
}

export function scheduleOf(seed: number, rev: number, events: unknown): { t: number; what: string }[] {
  const game = crossGameFor(rev);
  const log = (events as ArcadeInputEvent[]) ?? [];
  const byTick = new Map(log.map((e) => [e.t, e]));
  const out: { t: number; what: string }[] = [];
  let s = game.init(seed) as CrossState;
  out.push({ t: 0, what: `crossing 1: ${describeCourse(crossCourse(s))}` });
  while (!game.isOver(s)) {
    const prev = s;
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.crossings > prev.crossings) out.push({ t: s.crossings, what: `crossing ${s.crossings + 1}: ${describeCourse(crossCourse(s))}` });
  }
  return out;
}

/** Uniformly random swipes at a human-ish rate (about 4 a second, up more often than not), from a seeded stream. */
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
  for (let t = 1; t <= ticks; t += 8 + Math.floor(rand() * 15)) {
    const r = rand();
    events.push({ t, k: CROSS_INPUT_MOVE, a: r < 0.55 ? 0 : r < 0.7 ? 1 : r < 0.85 ? 2 : 3, b: 0, c: 0, d: 0 });
  }
  return events;
}

/** Uniformly random swipes, every direction equally likely (the plain random-input measurement). */
export function uniformLog(seed: number, ticks = 3600): ArcadeInputEvent[] {
  let a = (seed ^ 0x51ed270b) >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const events: ArcadeInputEvent[] = [];
  for (let t = 1; t <= ticks; t += 8 + Math.floor(rand() * 15)) events.push({ t, k: CROSS_INPUT_MOVE, a: Math.floor(rand() * 4), b: 0, c: 0, d: 0 });
  return events;
}

/** A skill-band bot's log on the revision rooms deal (crossRev 10 since the arcade scoring standard, 29 Oct 2026). */
export function botLog(seed: number, level: SkillLevel, rev: number = CROSS_REV_STD): ArcadeInputEvent[] {
  const game = crossGameFor(rev);
  return bot({ game, seed, rev, human: new Human("cross", seed, level), fixes: true }).events ?? [];
}


export const roomIdentity = {
  type: "cross",
  // crossRev 10 (the arcade scoring standard, 29 Oct 2026): the revision rooms deal; its courses are crossRev 9's,
  // thinned or thickened by a fixed density per crossing, so the same rule holds.
  rev: CROSS_REV_STD,
  scheduleOf,
  logs: (seed: number): ArcadeInputEvent[][] => [[], randomLog(seed), botLog(seed, "weak"), botLog(seed, "elite")],
};
