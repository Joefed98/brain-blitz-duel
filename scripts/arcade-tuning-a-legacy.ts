/**
 * Old-round records for Tuning A (Oct 2026: High Rise, Wavefront, Orbit,
 * Grappler, Tilt): real skill-band runs on each game's then-live revision
 * (the Oct 2026 score-band stamps: skylineRev 3, wavRev 3, orbitRev 5,
 * swingRev 5, tiltRev 3), replayed through the server path of the code at
 * <root>, recorded as score + FNV-1a of the replayed final state together with
 * the encoded log. arcade-tuning-a-check replays every log on today's code and
 * must reach the same score and the same state, so stored rounds provably
 * replay and score exactly as before.
 *
 *   bun scripts/arcade-skill-bands.ts skyline wavefront orbit swing tilt --rev=next --save=<logs>   (at <root>)
 *   bun scripts/arcade-tuning-a-legacy.ts <root> <logs> > scripts/fixtures/arcade-tuning-a-legacy.json
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

export const TUNING_A_GAMES = ["skyline", "wavefront", "orbit", "swing", "tilt"] as const;
/** Runs kept per game and level (sample numbers 0..PER_LEVEL-1 of the saved logs). */
const PER_LEVEL = 2;
const LEVELS = ["average", "good", "great", "near"] as const;

export interface TuningARecord {
  type: string;
  rev: number;
  level: string;
  seed: number;
  score: number;
  stateHash: number;
  /** The encoded run, gzip + base64. */
  raw: string;
}

export function fnv(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

if (import.meta.main) {
  const root = process.argv[2]!;
  const logs = process.argv[3]!;
  const { GAME_BY_TYPE } = await import(`${root}/scripts/arcade-skill-bands/games.ts`);
  const out: TuningARecord[] = [];
  for (const type of TUNING_A_GAMES) {
    const spec = GAME_BY_TYPE.get(type);
    for (const level of LEVELS)
      for (let n = 0; n < PER_LEVEL; n++) {
        const raw = readFileSync(`${logs}/${type}/next-${level}-${n}.txt`, "utf8");
        const seed = spec.seedFor(n);
        const result = spec.replay(seed, raw, spec.next);
        if (result.flagged) throw new Error(`${type} ${level} ${n}: the saved run is flagged`);
        out.push({ type, rev: spec.next, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
      }
  }
  console.log(JSON.stringify({ recorded: "code on main before Tuning A (ad5ebab)", runs: out }));
}
