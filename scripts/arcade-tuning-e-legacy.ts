/**
 * Old-round records for Tuning E (Oct 2026: High Rise, Meteor, Scrumper and
 * Hover get taller worlds): real skill-band runs on each game's revision rooms
 * stamped before Tuning E (skylineRev 3, snakeRev 4, snipRev 4, hoverRev 4),
 * replayed through the server path of the code at <root>, recorded as score +
 * FNV-1a of the replayed final state together with the encoded log.
 * arcade-tuning-e-check replays every log on today's code and must reach the
 * same score and the same state, so stored rounds provably replay and score
 * exactly as before.
 *
 *   bun scripts/arcade-skill-bands.ts snake skyline snip --rev=next --seeds=2 --save=<logs>   (at <root>)
 *   bun scripts/arcade-skill-bands.ts hover --rev=c --seeds=2 --save=<logs>                  (at <root>)
 *   bun scripts/arcade-tuning-e-legacy.ts <root> <logs> > scripts/fixtures/arcade-tuning-e-legacy.json
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

/** Each game, the skill-band slot it was saved under, and the revision that slot held before Tuning E. */
export const TUNING_E_GAMES = [
  ["skyline", "next", "next"],
  ["snake", "next", "next"],
  ["snip", "next", "next"],
  // `--rev=c` saves Hover's Tuning C revision (hoverRev 4) as "next".
  ["hover", "next", "tunec"],
] as const;
const PER_LEVEL = 2;
const LEVELS = ["average", "good", "great", "near"] as const;

export interface TuningERecord {
  type: string;
  rev: number;
  level: string;
  seed: number;
  score: number;
  stateHash: number;
  /** The encoded run, gzip + base64. */
  raw: string;
}

if (import.meta.main) {
  const root = process.argv[2]!;
  const logs = process.argv[3]!;
  const { GAME_BY_TYPE } = await import(`${root}/scripts/arcade-skill-bands/games.ts`);
  const out: TuningERecord[] = [];
  for (const [type, which, field] of TUNING_E_GAMES) {
    const spec = GAME_BY_TYPE.get(type);
    const rev = spec[field];
    for (const level of LEVELS)
      for (let n = 0; n < PER_LEVEL; n++) {
        const raw = readFileSync(`${logs}/${type}/${which}-${level}-${n}.txt`, "utf8");
        const seed = spec.seedFor(n);
        const result = spec.replay(seed, raw, rev);
        if (result.flagged) throw new Error(`${type} ${level} ${n}: the saved run is flagged`);
        out.push({ type, rev, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
      }
  }
  console.log(JSON.stringify({ recorded: "code on main before Tuning E (1551114)", runs: out }));
}
