/**
 * Top Bins' (Free Kick's) skill bands: every level (weak → flawless) on room seeds n = 0…N−1 (the deal's seed for each,
 * through the revision's deal on roomSeed(n)), each run replayed through the server path (replayFreekickRun). Prints
 * the median (p10–p90) score and each part's median, and the placement distances of the goals (to set
 * FREEKICK_PLACE_FULL_CM from the near-perfect level).
 *
 *   bun scripts/freekick-bands.ts [--seeds=60] [--from=0] [--rev=3] [--raw]
 *   (--rev: 1, 2 or 3, the dealt revision by default; --from=10000 for fresh seeds; --raw: plain room seeds, no deal)
 */
import { inputAt } from "../src/lib/arcade/engine";
import { FK_OUT_GOAL, fkJudge, fkKickOf, freekickCheckpoint, freekickGameFor, FREEKICK_PLACE_FULL_CM, FREEKICK_REV_DEALT, type FreekickCheckpoint } from "../src/lib/arcade/freekick";
import { encodeFreekickRun, replayFreekickRun } from "../src/lib/duel/freekick";
import { freekickDealSeed } from "../src/lib/duel/freekickDeal.server";
import { freekickDealSeedV2 } from "../src/lib/duel/freekickDealV2.server";
import { freekickDealSeedV3 } from "../src/lib/duel/freekickDealV3.server";
import { ALL_LEVELS, Human, LEVEL_LABEL } from "./arcade-skill-bands/human";
import { bot, randomBot } from "./arcade-skill-bands/bots/freekick";
import { hashSeed } from "./freekick-deal";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

const arg = (name: string, dflt: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? dflt;
const N = Number(arg("seeds", "60"));
const RAW = process.argv.includes("--raw");
const REV = Number(arg("rev", String(FREEKICK_REV_DEALT)));
const FROM = Number(arg("from", "0"));

/** Replays a log through the server's encode + replay; also collects each goal's placement distance (cm). */
export function serverReplay(seed: number, events: ArcadeInputEvent[], rev: number = REV) {
  const freekickGame = freekickGameFor(rev);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = freekickGame.init(seed);
  const checkpoints: FreekickCheckpoint[] = [];
  const dists: number[] = [];
  while (!freekickGame.isOver(s)) {
    const before = s.goals;
    const kick = fkKickOf(s);
    s = freekickGame.step(s, at.get(s.tick + 1) ?? inputAt([], 0));
    if (s.goals > before && s.fl && s.fl.out === FK_OUT_GOAL) dists.push(fkJudge(kick, s.fl).distCm);
    if (s.tick % 60 === 0) checkpoints.push(freekickCheckpoint(s));
  }
  const raw = encodeFreekickRun({ seed, claimedScore: freekickGame.score(s), events, endTick: s.tick, checkpoints });
  return { result: replayFreekickRun(seed, raw, rev), dists };
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : 0;
};

if (import.meta.main) {
  const rows: string[] = ["| Level | Score median (p10–p90) | Goals | Core | Targets | Round the wall | Five in a row | Goal distance cm (p25 / median) | Zeros |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
  const levels = [...ALL_LEVELS, "random"] as const;
  for (const level of levels) {
    const scores: number[] = [];
    const goals: number[] = [];
    const parts: Record<string, number[]> = { core: [], targets: [], curl: [], streak: [] };
    const dists: number[] = [];
    let zeros = 0;
    for (let n = FROM; n < FROM + N; n++) {
      const seed = RAW ? hashSeed(n) : REV >= 3 ? freekickDealSeedV3(hashSeed(n)) : REV >= 2 ? freekickDealSeedV2(hashSeed(n)) : freekickDealSeed(hashSeed(n));
      const human = new Human("freekick", seed, level === "random" ? "average" : level);
      const out = (level === "random" ? randomBot : bot)({ game: freekickGameFor(REV), seed, rev: REV, human });
      const { result, dists: d } = serverReplay(seed, out.events ?? []);
      if (result.flagged) console.error(`flagged: ${level} seed ${seed} ${result.reason}`);
      scores.push(result.score);
      goals.push(result.goals);
      for (const p of result.parts) parts[p.key]!.push(p.points);
      dists.push(...d);
      if (result.score === 0) zeros++;
    }
    const label = level === "random" ? "Random strokes" : LEVEL_LABEL[level];
    rows.push(`| ${label} | ${pct(scores, 0.5)} (${pct(scores, 0.1)}–${pct(scores, 0.9)}) | ${pct(goals, 0.5)} | ${pct(parts.core!, 0.5)} | ${pct(parts.targets!, 0.5)} | ${pct(parts.curl!, 0.5)} | ${pct(parts.streak!, 0.5)} | ${pct(dists, 0.25)} / ${pct(dists, 0.5)} | ${zeros} |`);
    console.error(`${label} done`);
  }
  console.log(`Top Bins bands (freekickRev ${REV}), ${N} ${RAW ? "plain room" : "dealt"} seeds from n = ${FROM}, placement full at ${FREEKICK_PLACE_FULL_CM} cm`);
  console.log(rows.join("\n"));
}
