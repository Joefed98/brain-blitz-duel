/**
 * Room identity, Rainbow Bridge inkRev 12 (what rooms deal since the arcade scoring standard, 29 Oct 2026: inkRev 11's
 * play, the phone notes of 27 Oct 2026; inkRev 11 and inkRev 10, x200, by
 * passing its rev): what the seed deals, as a given input log sees it.
 *
 * Every level of a Rainbow Bridge run, with its birds, pot, clouds, wind zone, ink star, silver coins and the
 * shamrock, is built at init from the seed (buildLevelsRev10), so it is all dealt on tick 0 and the input can only
 * decide which of the levels a player reaches. `scheduleOf` replays the log through the real sim and lists, from the
 * state it ends in, every level's seeded features with their places (t = 0: dealt before the first input); it also
 * throws if the state's levels ever change during the replay (nothing may be dealt from how the player plays).
 * Two different logs on the same seed must therefore give the same list.
 */
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { inkBridgeGameFor, INK_REV_STD, type InkLevel, type InkState } from "../../src/lib/arcade/inkBridge";
import { inkOracleRun } from "../ink-x200-oracle";
import { bot } from "../arcade-skill-bands/bots/inkbridge";
import { Human } from "../arcade-skill-bands/human";
import { randomInkLog } from "../ink-x200-bands";

/** One level's seeded features, in words with their places. */
function featuresOf(lvl: InkLevel, i: number): { t: number; what: string }[] {
  const L = `L${i + 1}`;
  const out: { t: number; what: string }[] = [];
  out.push({ t: 0, what: `${L} pot ${lvl.bucketX},${lvl.bucketY} slide ${lvl.slideAmp}/${lvl.slidePeriod}/${lvl.slidePhase}` });
  for (const b of lvl.blocks) out.push({ t: 0, what: `${L} birds ${b.x0}-${b.x1},${b.y}` });
  for (const c of lvl.clouds ?? []) out.push({ t: 0, what: `${L} cloud ${c.x},${c.y}` });
  if (lvl.wind) out.push({ t: 0, what: `${L} wind ${lvl.wind.x0},${lvl.wind.y0}-${lvl.wind.x1},${lvl.wind.y1} push ${lvl.wind.ax}` });
  if (lvl.star) out.push({ t: 0, what: `${L} ink star ${lvl.star.x},${lvl.star.y}` });
  for (const s of lvl.silver ?? []) out.push({ t: 0, what: `${L} silver ${s.x},${s.y}` });
  if (lvl.shamrock) out.push({ t: 0, what: `${L} shamrock ${lvl.shamrock.x},${lvl.shamrock.y}` });
  return out;
}

export function scheduleOf(seed: number, rev: number, events: unknown): { t: number; what: string }[] {
  const game = inkBridgeGameFor(rev);
  let s = game.init(seed) as InkState;
  const dealt = JSON.stringify(s.list);
  const byTick = new Map((events as ArcadeInputEvent[]).map((e) => [e.t, e]));
  let level = s.level;
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.level !== level) {
      level = s.level;
      if (JSON.stringify(s.list) !== dealt) throw new Error(`seed ${seed}: the levels changed during play (tick ${s.tick})`);
    }
  }
  if (JSON.stringify(s.list) !== dealt) throw new Error(`seed ${seed}: the levels changed during play`);
  return s.list.flatMap(featuresOf);
}

/** A few very different logs for a seed: idle, random inputs, a weak bot, an elite bot and the perfect run. */
function logs(seed: number, rev: number = INK_REV_STD): ArcadeInputEvent[][] {
  const game = inkBridgeGameFor(rev);
  const play = (level: "weak" | "elite") => bot({ game, seed, rev, human: new Human("inkbridge", seed, level) }).events ?? [];
  return [[], randomInkLog(rev, seed), play("weak"), play("elite"), inkOracleRun(seed, rev).events];
}

export const roomIdentity = { type: "inkbridge", rev: INK_REV_STD, scheduleOf, logs };
