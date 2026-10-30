/**
 * Records the legacy fixture behind hover-standard-check (the arcade scoring standard, hoverRev 10): runs on hoverRev 9
 * (the revision rooms dealt before it) and on every older stamp, played by the skill-band bot and replayed by the server,
 * with each run's score, final checkpoint checksum, every 300-tick checksum and a digest of the whole final state.
 * Run it on a checkout of main from before the change; the check replays every entry and fails on any difference.
 *
 *   bun scripts/hover-standard-record.ts [--out=scripts/fixtures/hover-standard-legacy.json.gz]
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { replayHoverRun } from "../src/lib/duel/hover";
import { roomSeed } from "./arcade-skill-bands/games";
import { botRun } from "./hover-x200-record";

export const HOVER_STANDARD_LEGACY = "scripts/fixtures/hover-standard-legacy.json.gz";

export interface HoverStandardLegacyRun {
  rev: number | null;
  level: string;
  seed: number;
  raw: string;
  score: number;
  gates: number;
  stars: number;
  survived: boolean;
  flagged: boolean;
  checksum: number;
  checksums: number[];
  /** sha-256 of the final state's JSON, its first 16 hex digits. */
  state: string;
}

export function stateDigest(state: unknown): string {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 16);
}

/** What the server's replay makes of an encoded run today. */
export function legacyOf(rev: number | null, level: string, seed: number, raw: string): HoverStandardLegacyRun {
  const r = replayHoverRun(seed, raw, rev);
  return {
    rev,
    level,
    seed,
    raw,
    score: r.score,
    gates: r.gates,
    stars: r.stars,
    survived: r.survived,
    flagged: r.flagged,
    checksum: r.checkpoints.at(-1)?.checksum ?? 0,
    checksums: r.checkpoints.map((c) => c.checksum),
    state: stateDigest(r.state),
  };
}

/** The recorded plan: hoverRev 9 on 8 room seeds at five levels, and two runs on every older stamp. */
export const LEGACY_PLAN: { rev: number | null; level: "weak" | "average" | "good" | "near" | "elite"; n: number }[] = [
  ...[0, 1, 2, 3, 4, 5, 10_000, 10_001].flatMap((n) => (["weak", "average", "good", "near", "elite"] as const).map((level) => ({ rev: 9, level, n }))),
  ...([null, 2, 3, 4, 5, 6, 7] as const).flatMap((rev) => [
    { rev, level: "good" as const, n: 6 },
    { rev, level: "near" as const, n: 7 },
  ]),
];

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? HOVER_STANDARD_LEGACY;
  const runs = LEGACY_PLAN.map(({ rev, level, n }) => {
    const seed = roomSeed(n);
    return legacyOf(rev, level, seed, botRun(rev, level, seed));
  });
  writeFileSync(out, gzipSync(JSON.stringify(runs)));
  console.log(`wrote ${runs.length} runs to ${out} (scores ${runs.map((r) => r.score).join(" ")})`);
}
