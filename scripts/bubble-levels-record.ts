/**
 * Records bubble-levels-check's witness runs (Coral Pop's levels, the Strategy overhaul, stage 3): the skill-band bot
 * (scripts/arcade-skill-bands/bots/bubble.ts, human limits) at Average, Elite and Flawless on each level's first seeds, each
 * run's input log encoded as the phone sends it, with the server replay's score. bubble-levels-check replays every
 * one through replayBubbleRun on the level and needs the same score, unflagged.
 *
 *   bun scripts/bubble-levels-record.ts [--seeds=12]   writes scripts/fixtures/bubble-levels-witness.json.gz
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { bubCheckpoint, bubbleGameFor, BUB_REV_FAST, type BubState } from "../src/lib/arcade/bubble";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeBubbleRun, replayBubbleRun } from "../src/lib/duel/bubble";
import { bot } from "./arcade-skill-bands/bots/bubble";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";

export interface LevelWitness {
  level: string;
  skill: SkillLevel;
  seed: number;
  raw: string;
  score: number;
  cleared: boolean;
}

export const WITNESS_PATH = "scripts/fixtures/bubble-levels-witness.json.gz";
export const WITNESS_LEVELS = ["easy", "normal", "hard", "expert"] as const;
export const WITNESS_SKILLS: SkillLevel[] = ["average", "elite", "perfect"];

/** One bot run at a level (Normal: no level), encoded as the phone sends it. */
export function botRun(level: string, skill: SkillLevel, seed: number): LevelWitness {
  const lvl = level === "normal" ? undefined : level;
  const game = bubbleGameFor(BUB_REV_FAST, lvl);
  const out = bot({ game, seed, rev: BUB_REV_FAST, human: new Human("bubble", seed, skill), fixes: true });
  const events = (out.events ?? []) as ArcadeInputEvent[];
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as BubState;
  const checkpoints: ReturnType<typeof bubCheckpoint>[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null) as BubState;
    if (s.tick % 300 === 0) checkpoints.push(bubCheckpoint(s));
  }
  const raw = encodeBubbleRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  const r = replayBubbleRun(seed, raw, BUB_REV_FAST, lvl);
  return { level, skill, seed, raw, score: r.score, cleared: r.cleared };
}

if (import.meta.main) {
  const opt = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  // --merge=a.json,b.json…: join parts recorded one level at a time (--level=easy --out=a.json) into the fixture.
  const merge = opt("merge");
  if (merge) {
    const runs = merge.split(",").flatMap((p) => JSON.parse(readFileSync(p, "utf8")) as LevelWitness[]);
    runs.sort((a, b) => WITNESS_LEVELS.indexOf(a.level as never) - WITNESS_LEVELS.indexOf(b.level as never) || WITNESS_SKILLS.indexOf(a.skill) - WITNESS_SKILLS.indexOf(b.skill));
    writeFileSync(WITNESS_PATH, gzipSync(JSON.stringify(runs)));
    console.log(`wrote ${runs.length} runs to ${WITNESS_PATH}`);
    process.exit(0);
  }
  const seeds = Number(opt("seeds") ?? 12);
  const only = opt("level");
  const runs: LevelWitness[] = [];
  for (const level of WITNESS_LEVELS.filter((l) => !only || l === only))
    for (const skill of WITNESS_SKILLS)
      for (let n = 0; n < seeds; n++) {
        const w = botRun(level, skill, roomSeed(n));
        runs.push(w);
        console.log(level, skill, w.seed, w.score, w.cleared ? "cleared" : "");
      }
  const out = opt("out");
  if (out) writeFileSync(out, JSON.stringify(runs));
  else writeFileSync(WITNESS_PATH, gzipSync(JSON.stringify(runs)));
  console.log(`wrote ${runs.length} runs to ${out ?? WITNESS_PATH}`);
}
