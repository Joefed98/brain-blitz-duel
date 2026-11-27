/**
 * D6's calibration library (a tool, not a check): the two ladder players' final states on real deals of a game at a level,
 * kept once, so a stamp's "full at" figures can be re-scored offline (a bot plays the same whatever a part's full
 * figure is: the figures only read the final state). scripts/d6-ladder.ts then proves the chosen figures on the real
 * stamp through the server.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PuzzleType } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { dealAt } from "./level-tune";
import { playDealt, type LadderBot } from "./d6-ladder-lib";

export interface Played {
  n: number;
  puzzle: any;
  state: any;
  score: number;
}

/** Both players' final states (and server scores) on `count` deals of a game at a level, from sample `from`. */
export async function playStates(type: string, level: Level, count: number, from = 0, bots: readonly LadderBot[] = ["average", "elite"]): Promise<Record<LadderBot, Played[]>> {
  const out: Record<LadderBot, Played[]> = { average: [], elite: [] };
  for (let n = from; n < from + count; n++) {
    const puzzle = dealAt(type as PuzzleType, level, n);
    for (const b of bots) {
      const r = await playDealt(type, puzzle, b);
      out[b].push({ n, puzzle, state: r.state, score: r.score });
    }
  }
  return out;
}

export interface Summary {
  average: number;
  at200: number;
  min: number;
}

export function summarise(scores: readonly number[]): Summary {
  const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  return { average: Math.round(average * 10) / 10, at200: scores.length ? scores.filter((s) => s >= 200).length / scores.length : 0, min: scores.length ? Math.min(...scores) : 0 };
}

export const pct = (x: number) => `${Math.round(x * 100)} %`;

import { Human, HUMAN_LIMITS } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import type { ArcadeGame } from "../src/lib/arcade/engine";

const bots = new Map<string, SkillBot>();
async function botOf(type: string): Promise<SkillBot> {
  let b = bots.get(type);
  if (!b) bots.set(type, (b = ((await import(new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url).href)) as { bot: SkillBot }).bot));
  return b;
}

/**
 * Both players on a game object built for a trial (a level's settings before they are coded into the sim), on the
 * given seeds: the skill-band bot under HUMAN_LIMITS plays `game` itself; the final state and the sim's score
 * (the same as the server's for that game).
 */
export async function playCustom(type: string, game: ArcadeGame<any, any>, seeds: readonly number[], rev: number | null, which: readonly LadderBot[] = ["average", "elite"]): Promise<Record<LadderBot, Played[]>> {
  const bot = await botOf(type);
  const out: Record<LadderBot, Played[]> = { average: [], elite: [] };
  seeds.forEach((seed, n) => {
    for (const b of which) {
      const res = bot({ game, seed, rev, human: new Human(type, seed, b, HUMAN_LIMITS), fixes: true });
      const byTick = new Map((res.events ?? []).map((e) => [e.t, e]));
      const taps = new Set(res.taps ?? []);
      let s = game.init(seed);
      while (!game.isOver(s) && s.tick < game.runTicks) s = game.step(s, res.taps ? taps.has(s.tick + 1) : (byTick.get(s.tick + 1) ?? null));
      out[b].push({ n, puzzle: null, state: s, score: game.score(s) });
    }
  });
  return out;
}
