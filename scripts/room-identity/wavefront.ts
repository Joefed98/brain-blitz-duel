/**
 * Room identity for Wavefront wavRev 10 (docs/expansions/x200-wavefront.md, the 26 Oct 2026 arcade rule):
 * `scheduleOf` replays an input log on the given revision and lists every seeded appearance on the run's
 * clock: each planned power-up (its tick, kind and x) and each saucer (its tick and side). Two very different logs on the same
 * seed must list the same entries over the ticks both runs lived: nothing appears because of how the player
 * plays. (Formation waves and the two bosses arrive when the stage before is cleared, which is the game itself:
 * each wave's ships come from that wave's own seeded stream and the bosses' cores open on the run clock, which
 * wavefront-expand-check proves separately.)
 *
 *   import { roomIdentity } from "./room-identity/wavefront";
 */
import { ARCADE_INPUT_DRAG, type ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { wavefrontGameFor, WAV_REV_EXPAND, WAV_WORLD_W, type WavState } from "../../src/lib/arcade/wavefront";
import { Human, type BandLevel } from "../arcade-skill-bands/human";
import { bot } from "../arcade-skill-bands/bots/wavefront";

const KIND = ["laser", "spread", "shield"];

export function scheduleOf(seed: number, rev: number, events: unknown): { t: number; what: string }[] {
  const game = wavefrontGameFor(rev);
  const log = (events as ArcadeInputEvent[]) ?? [];
  const byTick = new Map(log.map((e) => [e.t, e]));
  const out: { t: number; what: string }[] = [];
  let s = game.init(seed) as WavState;
  while (!game.isOver(s) && s.tick < game.runTicks) {
    const prev = s;
    s = game.step(s, byTick.get(s.tick + 1) ?? null) as WavState;
    if ((s.dropsSeen ?? 0) > (prev.dropsSeen ?? 0) && s.drop) out.push({ t: s.tick, what: `power-up ${KIND[s.drop.k ?? 0]} at x ${Math.trunc(s.drop.x / 256)}` });
    if (prev.saucerDir === 0 && s.saucerDir !== 0) out.push({ t: s.tick, what: `saucer from the ${s.saucerDir > 0 ? "left" : "right"}` });
  }
  return out;
}

/** Uniformly random drags at a human-ish rate (about 4 a second), from a seeded stream. */
export function randomLog(seed: number, ticks = 5400): ArcadeInputEvent[] {
  let a = (seed ^ 0x2545f491) >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const events: ArcadeInputEvent[] = [];
  for (let t = 1; t <= ticks; t += 8 + Math.floor(rand() * 15)) events.push({ t, k: ARCADE_INPUT_DRAG, a: Math.floor(rand() * (WAV_WORLD_W + 1)), b: 0, c: 0, d: 0 });
  return events;
}

/** A skill-band bot's log on wavRev 10. */
export function botLog(seed: number, level: BandLevel): ArcadeInputEvent[] {
  const game = wavefrontGameFor(WAV_REV_EXPAND);
  return bot({ game, seed, rev: WAV_REV_EXPAND, human: new Human("wavefront", seed, level) }).events ?? [];
}

export const roomIdentity = {
  type: "wavefront",
  rev: WAV_REV_EXPAND,
  scheduleOf,
  logs: (seed: number): ArcadeInputEvent[][] => [[], randomLog(seed), botLog(seed, "weak"), botLog(seed, "elite")],
};
