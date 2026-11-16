/**
 * Curl Champ's levels measured (the Sports overhaul, 16 Nov 2026; a tool, not a check): the skill-band bot at each
 * skill on every sheet of each level's bank (Normal: the first N of curlRev 4's bank), graded by the server's replay
 * at the sheet's level, as scripts/level-tune.ts does on room deals. Prints mean, median and the share at 175+ (a star)
 * per level and skill, and with --seeds the Elite bot's score on each Expert sheet.
 *
 *   bun scripts/curling-levels-bands.ts [--skills=average,near,elite] [--normal=40] [--levels=easy,…] [--reps=1] [--expert-seeds]
 */
import { CURLING_REV, curlingCheckpoint, curlingGameFor, type CurlLevel } from "../src/lib/arcade/curling";
import { encodeCurlingRun, replayCurlingRun } from "../src/lib/duel/curling";
import { CURLING_BANK_V4 } from "../src/lib/duel/curlingBankV4.server";
import { CURLING_LEVEL_BANKS } from "../src/lib/duel/curlingLevelBanks.server";
import { SPORTS_CHECKPOINT_INTERVAL } from "../src/lib/arcade/sportsKit";
import { bot } from "./arcade-skill-bands/bots/curling";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const skills = (arg("skills") ?? "average,near,elite").split(",") as SkillLevel[];
const normalN = Number(arg("normal") ?? 40);
const showSeeds = process.argv.includes("--expert-seeds");
const only = arg("levels")?.split(",");
/** Plays each sheet this many times, each with its own player (the skill's draws seeded apart). */
const reps = Number(arg("reps") ?? 1);

function play(seed: number, level: CurlLevel | undefined, skill: SkillLevel, rep = 0): number {
  const game = curlingGameFor(CURLING_REV, level);
  const out = bot({ game, seed, rev: CURLING_REV, human: new Human("curling", rep ? seed + rep * 7919 : seed, skill), fixes: true });
  const events = out.events ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % SPORTS_CHECKPOINT_INTERVAL === 0) checkpoints.push(curlingCheckpoint(s));
  }
  const raw = encodeCurlingRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  const r = replayCurlingRun(seed, raw, CURLING_REV, level);
  return r.flagged ? -1 : r.score;
}

const sets: [string, CurlLevel | undefined, readonly number[]][] = [
  ["easy", "easy", CURLING_LEVEL_BANKS.easy],
  ["normal", undefined, CURLING_BANK_V4.slice(0, normalN)],
  ["hard", "hard", CURLING_LEVEL_BANKS.hard],
  ["expert", "expert", CURLING_LEVEL_BANKS.expert],
];
for (const [name, level, seeds] of sets) {
  if (only && !only.includes(name)) continue;
  for (const skill of skills) {
    const xs = seeds.flatMap((seed) => Array.from({ length: reps }, (_, k) => play(seed, level, skill, k)));
    const sorted = [...xs].sort((a, b) => a - b);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const star = xs.filter((x) => x >= 175).length / xs.length;
    console.log(`${name.padEnd(7)} ${skill.padEnd(8)} mean ${mean.toFixed(1).padStart(6)}  median ${String(median).padStart(3)}  175+ ${(star * 100).toFixed(0).padStart(3)}%  flagged ${xs.filter((x) => x < 0).length}  (${seeds.length} sheets × ${reps})`);
    if (showSeeds && name === "expert" && skill === "elite") console.log(`  expert elite by seed: ${seeds.map((s, i) => `${s}:${xs.slice(i * reps, i * reps + reps).join("/")}`).join(" ")}`);
  }
}
