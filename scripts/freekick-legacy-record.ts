/**
 * Records freekickRev 1 runs (and, with --rev=2, freekickRev 2 runs: run on main before freekickRev 3, 1 Nov 2026, into
 * scripts/fixtures/freekick-rev2-legacy.json, the oracle, two random-stroke runs and the skill-band bot at good and great on 16 rev-2 deal seeds) (run on main before freekickRev 2, 31 Oct 2026) for freekick-check's legacy identity:
 * the oracle's run and two random-stroke runs on 16 deal seeds, each with its input log, final score, final-state
 * digest and checkpoint checksums. freekick-check replays every log on today's code and fails on any difference.
 *
 *   bun scripts/freekick-legacy-record.ts   # writes scripts/fixtures/freekick-rev1-legacy.json
 */
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { freekickCheckpoint, freekickGameFor, FREEKICK_INPUT_KICK, FREEKICK_INPUT_RANGES } from "../src/lib/arcade/freekick";
import { FREEKICK_DEAL } from "../src/lib/duel/freekickDeal.server";
import { FREEKICK_DEAL_V2 } from "../src/lib/duel/freekickDealV2.server";
import { FREEKICK_DEAL_V3 } from "../src/lib/duel/freekickDealV3.server";
import { bot, randomBot } from "./arcade-skill-bands/bots/freekick";
import { oracleRun } from "./freekick-oracle";
import { Human } from "./arcade-skill-bands/human";

export interface FkLegacyRun {
  seed: number;
  label: string;
  events: ArcadeInputEvent[];
  score: number;
  digest: string;
  checksums: number[];
}

export function playRev1(seed: number, events: ArcadeInputEvent[], rev = 1): { score: number; digest: string; checksums: number[] } {
  const game = freekickGameFor(rev);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const checksums: number[] = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) checksums.push(freekickCheckpoint(s).checksum);
  }
  return { score: game.score(s), digest: createHash("sha256").update(JSON.stringify(s)).digest("hex").slice(0, 24), checksums };
}

function randomRun(seed: number, salt: number): ArcadeInputEvent[] {
  let r = (seed ^ salt) >>> 0;
  const next = (n: number) => {
    r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
    return r % n;
  };
  const events: ArcadeInputEvent[] = [];
  for (let k = 0; k < 10; k++) recordInput(events, { t: 450 * k + 31 + next(200), k: FREEKICK_INPUT_KICK, a: next(601) - 300, b: next(201) - 100, c: next(1001), d: 0 }, FREEKICK_INPUT_RANGES);
  return events;
}

if (import.meta.main && process.argv.includes("--rev=3")) {
  // freekickRev 3 runs, recorded on main 6326101 before freekickRev 4 (3 Nov 2026): the oracle, two random prepared
  // shots and the skill-band bot at weak, good, great and elite on 16 rev-3 deal seeds.
  const runs: FkLegacyRun[] = [];
  const seeds = Array.from({ length: 16 }, (_, i) => FREEKICK_DEAL_V3[i * 18 + 2]!);
  for (const seed of seeds) {
    const botRun = (level: "weak" | "good" | "great" | "elite") => bot({ game: freekickGameFor(3), seed, rev: 3, human: new Human("freekick", seed, level) }).events ?? [];
    const rnd = (salt: number) => randomBot({ game: freekickGameFor(3), seed, rev: 3, human: new Human("freekick", seed ^ salt, "average") }).events ?? [];
    for (const [label, events] of [["oracle", oracleRun(seed, 3)], ["random a", rnd(0x3234)], ["random b", rnd(0xbeed)], ["weak bot", botRun("weak")], ["good bot", botRun("good")], ["great bot", botRun("great")], ["elite bot", botRun("elite")]] as const) {
      runs.push({ seed, label, events: [...events], ...playRev1(seed, [...events], 3) });
    }
  }
  writeFileSync("scripts/fixtures/freekick-rev3-legacy.json", JSON.stringify(runs));
  console.log(`freekick legacy (rev 3): ${runs.length} runs recorded`);
} else if (import.meta.main && process.argv.includes("--rev=2")) {
  const runs: FkLegacyRun[] = [];
  const seeds = Array.from({ length: 16 }, (_, i) => FREEKICK_DEAL_V2[i * 18 + 1]!);
  for (const seed of seeds) {
    const botRun = (level: "good" | "great") => bot({ game: freekickGameFor(2), seed, rev: 2, human: new Human("freekick", seed, level) }).events ?? [];
    for (const [label, events] of [["oracle", oracleRun(seed, 2)], ["random a", randomRun(seed, 0x2234)], ["random b", randomRun(seed, 0xbeee)], ["good bot", botRun("good")], ["great bot", botRun("great")]] as const) {
      runs.push({ seed, label, events: [...events], ...playRev1(seed, [...events], 2) });
    }
  }
  writeFileSync("scripts/fixtures/freekick-rev2-legacy.json", JSON.stringify(runs));
  console.log(`freekick legacy (rev 2): ${runs.length} runs recorded`);
} else if (import.meta.main) {
  const runs: FkLegacyRun[] = [];
  const seeds = Array.from({ length: 16 }, (_, i) => FREEKICK_DEAL[i * 18]!);
  for (const seed of seeds) {
    for (const [label, events] of [["oracle", oracleRun(seed)], ["random a", randomRun(seed, 0x1234)], ["random b", randomRun(seed, 0xbeef)]] as const) {
      runs.push({ seed, label, events: [...events], ...playRev1(seed, [...events]) });
    }
  }
  writeFileSync("scripts/fixtures/freekick-rev1-legacy.json", JSON.stringify(runs));
  console.log(`freekick legacy: ${runs.length} runs recorded`);
}
