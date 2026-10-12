/**
 * Old-round records for Tuning C (Oct 2026: Gemstone, Grappler, Hover, Rainbow
 * Bridge, Roofbound, Tempo, Wavefront, Tilt, Slice): real skill-band runs on
 * each game's revision rooms stamped before Tuning C (matchupRev 4, swingRev 6,
 * hoverRev 3, inkRev 5, flipRev 3, beatRev 3, wavRev 4, tiltRev 3, sliceRev 3),
 * replayed through the server path of the code at <root>, recorded as score +
 * FNV-1a of the replayed final state together with the encoded log.
 * arcade-tuning-c-check replays every log on today's code and must reach the
 * same score and the same state, so stored rounds provably replay and score
 * exactly as before.
 *
 *   bun scripts/arcade-skill-bands.ts matchup hover inkbridge flip beat tilt slice --rev=next --seeds=2 --save=<logs>   (at <root>)
 *   bun scripts/arcade-skill-bands.ts wavefront swing --rev=tuned --seeds=2 --save=<logs>                              (at <root>)
 *   bun scripts/arcade-tuning-c-legacy.ts <root> <logs> > scripts/fixtures/arcade-tuning-c-legacy.json
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

/** Each game and the skill-band revision slot (`next` or `tuned`) rooms stamped before Tuning C. */
export const TUNING_C_GAMES = [
  ["matchup", "next"],
  ["swing", "tuned"],
  ["hover", "next"],
  ["inkbridge", "next"],
  ["flip", "next"],
  ["beat", "next"],
  ["wavefront", "tuned"],
  ["tilt", "next"],
  ["slice", "next"],
] as const;
const PER_LEVEL = 2;
const LEVELS = ["average", "good", "great", "near"] as const;

export interface TuningCRecord {
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
  const out: TuningCRecord[] = [];
  for (const [type, which] of TUNING_C_GAMES) {
    const spec = GAME_BY_TYPE.get(type);
    const rev = spec[which];
    for (const level of LEVELS)
      for (let n = 0; n < PER_LEVEL; n++) {
        const raw = readFileSync(`${logs}/${type}/${which}-${level}-${n}.txt`, "utf8");
        const seed = spec.seedFor(n);
        const result = spec.replay(seed, raw, rev);
        if (result.flagged) throw new Error(`${type} ${level} ${n}: the saved run is flagged`);
        out.push({ type, rev, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
      }
  }
  console.log(JSON.stringify({ recorded: "code on main before Tuning C (8200e6e)", runs: out }));
}
