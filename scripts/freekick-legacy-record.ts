/**
 * Records freekickRev 1 runs (run on main before freekickRev 2, 31 Oct 2026) for freekick-check's legacy identity:
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
import { oracleRun } from "./freekick-oracle";

export interface FkLegacyRun {
  seed: number;
  label: string;
  events: ArcadeInputEvent[];
  score: number;
  digest: string;
  checksums: number[];
}

export function playRev1(seed: number, events: ArcadeInputEvent[]): { score: number; digest: string; checksums: number[] } {
  const game = freekickGameFor(1);
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

if (import.meta.main) {
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
