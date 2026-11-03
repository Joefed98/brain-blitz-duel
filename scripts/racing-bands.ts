/**
 * Apex's skill bands (the dealt revision by default, racingRev 3 since 3 Nov 2026; --rev=1 or 2 for the earlier ones): every level weak → flawless on room seeds
 * n = 0…59 (the dealt seed racingDealSeedV3(roomSeed(n)); racingDealSeedV2 on rev 2, racingDealSeed on rev 1), each run replayed through the
 * server path (replayRacingRun); prints the median table (score, each part, race time) and the near-perfect median race
 * time (RACING_V2_PAR_TICKS / RACING_PAR_TICKS are set from it; on racingRev 2 it is measured from lights out).
 *
 *   bun scripts/racing-bands.ts [--rev=2] [--seeds=60] [--from=0] [--raw]   (--raw: room seeds themselves, not the deal)
 */
import { racingGameFor, racingPace10, RACING_REV_DEALT } from "../src/lib/arcade/racing";
import { replayRacingRun } from "../src/lib/duel/racing";
import { racingSubmission } from "./racing-deal";
import { racingDealSeed } from "../src/lib/duel/racingDeal.server";
import { racingDealSeedV2 } from "../src/lib/duel/racingDealV2.server";
import { racingDealSeedV3 } from "../src/lib/duel/racingDealV3.server";
import { roomSeed } from "./arcade-skill-bands/games";
import { ALL_LEVELS, Human, LEVEL_LABEL } from "./arcade-skill-bands/human";
import { bot, randomBot } from "./arcade-skill-bands/bots/racing";

const arg = (name: string, fallback: number) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : fallback;
};
const n = arg("seeds", 60);
const from = arg("from", 0);
const raw = process.argv.includes("--raw");
const rev = arg("rev", RACING_REV_DEALT);
const game = racingGameFor(rev);
const dealt = rev >= 3 ? racingDealSeedV3 : rev >= 2 ? racingDealSeedV2 : racingDealSeed;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
};

console.log(`Apex bands, racingRev ${rev}: ${n} room seeds from ${from}${raw ? " (raw room seeds)" : " (dealt seeds)"}`);
const v3 = rev >= 3;
console.log(v3 ? "| Level | Score (p10–p90) | Pace | Clean sectors | Average km/h | Finished | Race time (median of finishers) | Zeros |" : "| Level | Score (p10–p90) | Distance | Clean sectors | Finish | Speed | Finished | Race time (median of finishers) | Zeros |");
console.log(v3 ? "| --- | --- | --- | --- | --- | --- | --- | --- |" : "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
const levels = [...ALL_LEVELS, "random"] as const;
let nearFinish = 0;
for (const level of levels) {
  const scores: number[] = [];
  const parts: number[][] = [[], [], [], []];
  const finishes: number[] = [];
  let zeros = 0;
  let finished = 0;
  for (let i = from; i < from + n; i++) {
    const seed = raw ? roomSeed(i) : dealt(roomSeed(i));
    const human = new Human("racing", seed, level === "random" ? "average" : level);
    const res = (level === "random" ? randomBot : bot)({ game, seed, rev, human });
    const events = res.events ?? [];
    // Through the server path, as a phone would send it.
    const r = replayRacingRun(seed, racingSubmission(seed, events, rev), rev);
    if (r.flagged) console.error(`flagged ${level} ${i}: ${r.reason}`);
    scores.push(r.score);
    r.parts.forEach((p, k) => parts[k]!.push(p.points));
    if (v3) parts[3]!.push(racingPace10(r.state));
    if (r.score === 0) zeros++;
    if (r.finished) {
      finished++;
      finishes.push(r.raceTicks);
    }
  }
  const label = level === "random" ? "Random" : LEVEL_LABEL[level];
  const ft = finishes.length ? `${(median(finishes) / 60).toFixed(1)} s (tick ${median(finishes)})` : "–";
  if (v3) console.log(`| ${label} | ${median(scores)} (${pct(scores, 0.1)}–${pct(scores, 0.9)}) | ${median(parts[0]!)} | ${median(parts[1]!)} | ${(median(parts[3]!) / 10).toFixed(1)} | ${finished}/${n} | ${ft} | ${zeros} |`);
  else console.log(`| ${label} | ${median(scores)} (${pct(scores, 0.1)}–${pct(scores, 0.9)}) | ${median(parts[0]!)} | ${median(parts[1]!)} | ${median(parts[2]!)} | ${median(parts[3]!)} | ${finished}/${n} | ${ft} | ${zeros} |`);
  if (level === "near") nearFinish = median(finishes);
}
if (!v3) console.log(`\nNear-perfect median race time: ${nearFinish} ticks (${rev >= 2 ? "RACING_V2_PAR_TICKS" : "RACING_PAR_TICKS"})`);
