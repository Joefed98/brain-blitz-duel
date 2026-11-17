/**
 * Records Roofbound runs on the stamps before flipRev 13 for flip-overhaul-check (15 Nov 2026, the Action overhaul): run it
 * in a checkout of main from before the overhaul (a3f40ff7), so the fixture is main's own replay. The skill-band bots play
 * flipRev 2, 8, 10, 11 and 12 (and unstamped rounds) at three levels on two seeds each; every run's log, the server
 * replay's score and a digest of its end state and checkpoints are stored.
 *
 *   bun scripts/flip-overhaul-legacy-record.ts <fixture path>
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { Human } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/flip";
import { encodeFlipLog } from "./flip-x200-record";
import { replayFlipRun } from "../src/lib/duel/flip";
import { flipGameFor } from "../src/lib/arcade/flip";

export interface FlipOverhaulLegacyRun {
  rev: number | null;
  level: string;
  seed: number;
  raw: string;
  score: number;
  digest: string;
}

export const flipOverhaulDigest = (r: { state: unknown; checkpoints?: unknown; score: number; flagged?: boolean }) =>
  createHash("sha256").update(JSON.stringify([r.score, r.flagged ?? false, r.state, r.checkpoints ?? null])).digest("hex");

if (import.meta.main) {
  const out = process.argv[2];
  if (!out) throw new Error("usage: bun scripts/flip-overhaul-legacy-record.ts <fixture path>");
  const runs: FlipOverhaulLegacyRun[] = [];
  for (const rev of [null, 2, 8, 10, 11, 12])
    for (const level of ["weak", "good", "elite"])
      for (const seed of [301794028, 992653281]) {
        const game = flipGameFor(rev);
        const o = bot({ game, seed, rev, human: new Human("flip", seed, level as never), fixes: true } as any);
        const { raw } = encodeFlipLog(rev, seed, o.events ?? []);
        const r = replayFlipRun(seed, raw, rev);
        runs.push({ rev, level, seed, raw, score: r.score, digest: flipOverhaulDigest(r as any) });
      }
  writeFileSync(out, gzipSync(JSON.stringify({ recordedOn: "main a3f40ff7", runs })));
  console.log(`wrote ${runs.length} runs to ${out}`);
}
