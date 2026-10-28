/**
 * Room identity for Wavefront wavRev 11 (Joe's phone notes, docs/phone-notes-oct-2026/wavefront.md; before it wavRev 10,
 * docs/expansions/x200-wavefront.md, the 26 Oct 2026 arcade rule). On wavRev 11 nothing falls from the top: the
 * power-ups are carried by seeded ships (wavCarriers) and dropped when they are shot, and a saucer shot down drops the
 * laser. The schedule lists wave 1's carriers at the start and every saucer; every later wave's carriers are proved the
 * same for every log that reaches the wave by wavefront-phone-check (a wave arrives when the one before is cleared).
 * On wavRev 10:
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
import { wavefrontGameFor, WAV_REV_PHONE, WAV_SAUCER_EVERY, WAV_WORLD_W, type WavState } from "../../src/lib/arcade/wavefront";
import { Human, type SkillLevel } from "../arcade-skill-bands/human";
import { bot } from "../arcade-skill-bands/bots/wavefront";

const KIND = ["laser", "spread", "shield"];

export function scheduleOf(seed: number, rev: number, events: unknown): { t: number; what: string }[] {
  const game = wavefrontGameFor(rev);
  const log = (events as ArcadeInputEvent[]) ?? [];
  const byTick = new Map(log.map((e) => [e.t, e]));
  const out: { t: number; what: string }[] = [];
  let s = game.init(seed) as WavState;
  if (s.r11) out.push({ t: 0, what: `wave 1 carriers ${(s.carry ?? []).map((k, i) => (k >= 0 ? `${i}:${KIND[k]}` : "")).filter(Boolean).join(" ")}` });
  while (!game.isOver(s) && s.tick < game.runTicks) {
    const prev = s;
    s = game.step(s, byTick.get(s.tick + 1) ?? null) as WavState;
    if ((s.dropsSeen ?? 0) > (prev.dropsSeen ?? 0) && s.drop) out.push({ t: s.tick, what: `power-up ${KIND[s.drop.k ?? 0]} at x ${Math.trunc(s.drop.x / 256)}` });
    // A saucer can be shot down on the tick it appears (a spread bolt already off the edge), so it counts as seen when
    // it is flying or was just shot without having flown.
    const shotAtOnce = prev.saucerDir === 0 && (s.saucers ?? 0) > (prev.saucers ?? 0);
    if (prev.saucerDir === 0 && (s.saucerDir !== 0 || shotAtOnce)) {
      const dir = s.saucerDir !== 0 ? s.saucerDir : (s.plan?.saucers[s.tick / WAV_SAUCER_EVERY - 1] ?? 1);
      out.push({ t: s.tick, what: `saucer from the ${dir > 0 ? "left" : "right"}` });
    }
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

/** A skill-band bot's log on a revision (the revision rooms deal by default). */
export function botLog(seed: number, level: SkillLevel, rev: number = WAV_REV_PHONE): ArcadeInputEvent[] {
  const game = wavefrontGameFor(rev);
  return bot({ game, seed, rev, human: new Human("wavefront", seed, level) }).events ?? [];
}

export const roomIdentity = {
  type: "wavefront",
  rev: WAV_REV_PHONE,
  scheduleOf,
  logs: (seed: number): ArcadeInputEvent[][] => [[], randomLog(seed), botLog(seed, "weak"), botLog(seed, "elite")],
};
