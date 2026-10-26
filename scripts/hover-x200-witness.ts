/**
 * Records the perfect-play witness runs behind hover-x200-check's ceiling proof (hoverRev 9, the 200 expansion):
 * for every tuning seed (room seed indices 0–59) and every fresh seed (10000–10199) of the skill-band tool, the
 * course solver (scripts/hover-x200-solver.ts) searches a tap log through every barrier, gold star, tight gate (on
 * its centre line, dead centre) and star chain; the log is kept only if the server's replay scores it 200. Not a
 * check (a solve takes a few seconds to a minute); the check replays the stored logs.
 *
 *   bun scripts/hover-x200-witness.ts [--from=0 --to=60] [--out=<file>]   # one slice, written as JSON
 *   bun scripts/hover-x200-witness.ts --merge <slice files…>              # writes scripts/fixtures/hover-x200-witness.json.gz
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { HOVER_CENTRE_TOL, HOVER_CHECKPOINT_INTERVAL, HOVER_REV_EXPAND, hoverCheckpoint, hoverGameFor, type HoverState } from "../src/lib/arcade/hover";
import { encodeHoverRun, replayHoverRun } from "../src/lib/duel/hover";
import { roomSeed } from "./arcade-skill-bands/games";
import { solveHover } from "./hover-x200-solver";

export interface HoverWitness {
  /** The skill-band seed index (roomSeed(n)). */
  n: number;
  seed: number;
  taps: number[];
}

export const WITNESS_FIXTURE = "scripts/fixtures/hover-x200-witness.json.gz";
/** The seed indices the ceiling is proved on: the 60 tuning seeds and the 200 fresh ones. */
export const WITNESS_INDICES = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 200 }, (_, i) => 10_000 + i)];

/** Plays a tap log on hoverRev 9 the way the phone does and returns the server replay of it. */
export function replayWitness(seed: number, taps: number[]) {
  const game = hoverGameFor(HOVER_REV_EXPAND);
  const set = new Set(taps);
  let s = game.init(seed) as HoverState;
  const checkpoints = [];
  while (!game.isOver(s)) {
    s = game.step(s, set.has(s.tick + 1)) as HoverState;
    if (s.tick % HOVER_CHECKPOINT_INTERVAL === 0) checkpoints.push(hoverCheckpoint(s));
  }
  const raw = encodeHoverRun({ seed, claimedScore: game.score(s), inputs: taps, endTick: s.tick, checkpoints });
  return replayHoverRun(seed, raw, HOVER_REV_EXPAND);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (args[0] === "--merge") {
    const all = args.slice(1).flatMap((f) => JSON.parse(readFileSync(f, "utf8")) as HoverWitness[]).sort((a, b) => a.n - b.n);
    const missing = WITNESS_INDICES.filter((n) => !all.some((w) => w.n === n));
    if (missing.length) console.log(`missing ${missing.length}: ${missing.join(" ")}`);
    writeFileSync(WITNESS_FIXTURE, gzipSync(JSON.stringify(all)));
    console.log(`wrote ${all.length} witness runs to ${WITNESS_FIXTURE}`);
  } else {
    const from = Number(opt("from") ?? 0);
    const to = Number(opt("to") ?? 60);
    const out: HoverWitness[] = [];
    for (const n of WITNESS_INDICES.filter((i) => i >= from && i < to)) {
      const seed = roomSeed(n);
      const t0 = performance.now();
      let found: number[] | null = null;
      let beam = 0;
      for (beam of [2000, 5000, 9000, 16000, 30000]) {
        const taps = solveHover(seed, { features: true, stars: true, centre: HOVER_CENTRE_TOL[0], beam });
        if (taps && replayWitness(seed, taps).score === 200) {
          found = taps;
          break;
        }
      }
      console.log(`n ${n} seed ${seed}: ${found ? "200" : "NOT FOUND"} (beam ${beam}, ${((performance.now() - t0) / 1000).toFixed(1)} s)`);
      if (found) out.push({ n, seed, taps: found });
      writeFileSync(opt("out") ?? `.shots/hover-witness-${from}-${to}.json`, JSON.stringify(out));
    }
  }
}
