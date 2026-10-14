/**
 * Old-round records for Tuning F (Oct 2026: Jaywalk's smaller walker, Slice's
 * longer blade, Coral Pop's directional torpedo, Grappler's spread stars,
 * Gemstone's 2,800 par, Scrumper's per-pin proofs): real skill-band runs on
 * each game's revision rooms stamped before Tuning F (crossRev 4, sliceRev 4,
 * bubbleRev 3, swingRev 7, matchupRev 5, snipRev 6), replayed through the
 * server path of the code at <root>, recorded as score + FNV-1a of the
 * replayed final state together with the encoded log. arcade-tuning-f-check
 * replays every log on today's code and must reach the same score and the same
 * state, so stored rounds provably replay and score exactly as before.
 *
 *   bun scripts/arcade-skill-bands.ts cross slice bubble swing matchup snip --rev=f --seeds=2 --save=<logs>   (at <root>)
 *   bun scripts/arcade-tuning-f-legacy.ts <root> <logs> > scripts/fixtures/arcade-tuning-f-legacy.json
 *
 * With --new (and the game ids to record) it records runs on the Tuning F
 * revisions instead (each GameSpec's `tunef`, the logs saved as "next" by
 * `--rev=f`), so later changes can prove those replay unchanged too:
 *
 *   bun scripts/arcade-tuning-f-legacy.ts . <logs> --new cross slice matchup > scripts/fixtures/arcade-tuning-f-runs.json
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

/** Each game and the revision rooms stamped before Tuning F. */
export const TUNING_F_GAMES = [
  ["cross", 4],
  ["slice", 4],
  ["bubble", 3],
  ["swing", 7],
  ["matchup", 5],
  ["snip", 6],
] as const;
const PER_LEVEL = 2;
const LEVELS = ["average", "good", "great", "near"] as const;

export interface TuningFRecord {
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
  const fresh = process.argv.includes("--new");
  const { GAME_BY_TYPE } = await import(`${root}/scripts/arcade-skill-bands/games.ts`);
  const out: TuningFRecord[] = [];
  const games: (readonly [string, number])[] = fresh
    ? process.argv.slice(4).filter((a) => !a.startsWith("--")).map((type) => [type, GAME_BY_TYPE.get(type).tunef] as const)
    : TUNING_F_GAMES;
  for (const [type, rev] of games) {
    const spec = GAME_BY_TYPE.get(type);
    for (const level of LEVELS)
      for (let n = 0; n < PER_LEVEL; n++) {
        const raw = readFileSync(`${logs}/${type}/${fresh ? "next" : "live"}-${level}-${n}.txt`, "utf8");
        const seed = spec.seedFor(n);
        const result = spec.replay(seed, raw, rev);
        if (result.flagged) throw new Error(`${type} ${level} ${n}: the saved run is flagged`);
        out.push({ type, rev, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
      }
  }
  console.log(JSON.stringify({ recorded: fresh ? "Tuning F code (the new revisions)" : "code on main before Tuning F (1c0deac)", runs: out }));
}
