/**
 * Stored-run records for Tuning F (Oct 2026: Breaker brkRev 5, Rally rallyRev 5,
 * Tempo beatRev 5, Meteor snakeRev 6, Orbit orbitRev 7). Real skill-band runs,
 * replayed through the server path of the code at <root> and recorded as score
 * + FNV-1a of the replayed final state together with the encoded log:
 *
 *  - "before": runs on the revisions rooms stamped before Tuning F (brkRev 4,
 *    rallyRev 4, beatRev 4, snakeRev 5, orbitRev 6), recorded with the code on
 *    main before Tuning F. arcade-tuning-f-check replays them on today's code
 *    to the same score and state: stored rounds replay exactly as before.
 *  - "after": runs on each new stamp, recorded with the Tuning F code, so any
 *    later change that moves a Tuning F round shows up the same way.
 *
 *   (at <main>)  bun scripts/arcade-skill-bands.ts breaker rally --rev=current --seeds=2 --save=<logs>
 *                bun scripts/arcade-skill-bands.ts beat --rev=c --seeds=2 --save=<logs>
 *                bun scripts/arcade-skill-bands.ts snake --rev=e --seeds=2 --save=<logs>
 *                bun scripts/arcade-skill-bands.ts orbit --rev=tuned --seeds=2 --save=<logs>
 *   (here)       bun scripts/arcade-skill-bands.ts breaker rally beat snake orbit --rev=f --levels=… --seeds=2 --save=<new>
 *   bun scripts/arcade-tuning-f-legacy.ts <main> <logs> . <new> > scripts/fixtures/arcade-tuning-f-legacy.json
 */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

/** Each game, the file prefix its pre-Tuning F runs were saved under, and the GameSpec field holding that revision. */
export const TUNING_F_GAMES = [
  ["breaker", "next", "current"],
  ["rally", "next", "current"],
  ["beat", "next", "tunec"],
  ["snake", "next", "tunee"],
  ["orbit", "tuned", "tuned"],
] as const;
const PER_LEVEL = 2;
const LEVELS = ["average", "good", "great", "near"] as const;

export interface TuningFRecord {
  type: string;
  when: "before" | "after";
  rev: number;
  level: string;
  seed: number;
  score: number;
  stateHash: number;
  /** The encoded run, gzip + base64. */
  raw: string;
}

async function collect(root: string, logs: string, when: "before" | "after"): Promise<TuningFRecord[]> {
  const { GAME_BY_TYPE } = await import(`${root}/scripts/arcade-skill-bands/games.ts`);
  const out: TuningFRecord[] = [];
  for (const [type, prefix, field] of TUNING_F_GAMES) {
    const spec = GAME_BY_TYPE.get(type);
    const rev = when === "before" ? spec[field] : spec.tunef;
    for (const level of LEVELS)
      for (let n = 0; n < PER_LEVEL; n++) {
        const raw = readFileSync(`${logs}/${type}/${when === "before" ? prefix : "next"}-${level}-${n}.txt`, "utf8");
        const seed = spec.seedFor(n);
        const result = spec.replay(seed, raw, rev);
        if (result.flagged) throw new Error(`${type} ${level} ${n}: the saved run is flagged`);
        out.push({ type, when, rev, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
      }
  }
  return out;
}

if (import.meta.main) {
  const [oldRoot, oldLogs, newRoot, newLogs] = process.argv.slice(2) as [string, string, string, string];
  const runs = [...(await collect(oldRoot, oldLogs, "before")), ...(await collect(newRoot, newLogs, "after"))];
  console.log(JSON.stringify({ recorded: "before: code on main before Tuning F (1c0deac); after: the Tuning F code", runs }));
}
