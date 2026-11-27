/**
 * Records Moon Climb's ricoRev 4 (every level) and ricoRev 3 deals and runs before ricoRev 5 (the 30 × 60 ninja, D5,
 * 22 Nov 2026), for scripts/ricochet-mid-check.ts: for each sampled seed the tower, witness and first state (digests)
 * and the witness's metres, and runs at several skill levels (random taps and the skill-band bots, with the bots'
 * competence fixes) as the phone sends them (the encoded log), each with the server's own score (`gradeAnswer` on the
 * dealt puzzle), the replay's final state digest and its checkpoint checksums; the deals rooms and practice made at
 * each level (the whole puzzle) and the parts' specs. Run on the commit before ricoRev 5 (6988eaa3); never re-record
 * over it (it refuses unless given --overwrite).
 *
 *   bun scripts/ricochet-mid-legacy-record.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  MOON_BIG_REV, MOON_REV, NINJA_CHECKPOINT_INTERVAL, NINJA_INPUT_TAP, moonCheckpoint, moonDeal, moonGameFor, moonStdSpecFor, ninjaBodyFor, type MoonLevel,
} from "../src/lib/arcade/ricochetNinja";
import { encodeMoonRun, replayMoonRun } from "../src/lib/duel/ricochet";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { bot as ricoBot } from "./arcade-skill-bands/bots/ricochet";

const OUT = "scripts/fixtures/ricochet-mid-legacy.json.gz";
if (existsSync(OUT) && !process.argv.includes("--overwrite")) {
  console.log(`${OUT} exists: recorded before ricoRev 5 and never re-recorded (pass --overwrite only on the commit before it)`);
  process.exit(1);
}
console.error = () => {};
const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);
/** The graded extra without the replay's own wall time (`diag.replayMs`, the only field that is not the run's). */
function stableExtra(extra: unknown): unknown {
  const e = (extra ?? {}) as Record<string, unknown>;
  const diag = e["diag"] as Record<string, unknown> | undefined;
  if (!diag || typeof diag !== "object") return e;
  const { replayMs: _ms, ...rest } = diag;
  return { ...e, diag: rest };
}
const tap =(t: number, a = 0): ArcadeInputEvent => ({ t, k: NINJA_INPUT_TAP, a, b: 0, c: 0, d: 0 });

/** A run as the phone sends it (with checkpoints), and its checkpoint checksums. */
function encode(rev: number, level: MoonLevel | null, seed: number, events: readonly ArcadeInputEvent[]): { raw: string; sums: number[] } {
  const game = moonGameFor(rev, level);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const cps = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % NINJA_CHECKPOINT_INTERVAL === 0) cps.push(moonCheckpoint(s));
  }
  return { raw: encodeMoonRun({ seed, claimedScore: game.score(s), events: [...events], endTick: s.tick, checkpoints: cps }), sums: cps.map((c) => c.checksum) };
}
function randomTaps(seed: number): ArcadeInputEvent[] {
  const ev: ArcadeInputEvent[] = [];
  let x = seed | 1;
  for (let t = 5; t <= 3600; ) {
    x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0;
    ev.push(tap(t, (x % 3) - 1));
    t += 10 + (x % 51);
  }
  return ev;
}

type Stamp = { rev: number; level: MoonLevel | null };
const STAMPS: Stamp[] = [
  { rev: MOON_BIG_REV, level: null },
  { rev: MOON_BIG_REV, level: "easy" },
  { rev: MOON_BIG_REV, level: "hard" },
  { rev: MOON_BIG_REV, level: "expert" },
  { rev: MOON_REV, level: null },
];
const TOWER_SEEDS = [...Array.from({ length: 10 }, (_, n) => roomSeed(n)), 10000, 10001];
const RUN_SEEDS = TOWER_SEEDS.slice(0, 5);
const SKILLS = ["random", "weak", "average", "great", "elite", "perfect"] as const;

const towers: unknown[] = [];
const runs: unknown[] = [];
for (const { rev, level } of STAMPS) {
  const game = moonGameFor(rev, level);
  for (const seed of TOWER_SEEDS) {
    const d = moonDeal(seed, rev, level);
    towers.push({ rev, level, seed, tower: digest(d.tower), witness: digest(d.witness), metres: d.witnessMetres, init: digest(game.init(seed)) });
  }
  for (const seed of RUN_SEEDS) {
    const puzzle = { type: "ricochet", seed, ricoRev: rev, ...(level ? { level } : {}) };
    for (const skill of SKILLS) {
      const events = skill === "random" ? randomTaps(seed) : ((ricoBot({ game: game as any, seed, rev, human: new Human("ricochet", seed, skill as any), fixes: true }).events ?? []) as ArcadeInputEvent[]);
      const { raw, sums } = encode(rev, level, seed, events);
      const replay = replayMoonRun(seed, raw, rev, level);
      const graded = gradeAnswer(puzzle as any, raw, 0);
      runs.push({ rev, level, seed, skill, raw, score: graded.score, replayScore: replay.score, flagged: Boolean(replay.flagged), state: digest(replay.state), sums, extra: digest(stableExtra(graded.extra)) });
    }
    console.log(`ricoRev ${rev} ${level ?? "normal"} ${seed}: done`);
  }
}
/** The deals rooms and practice make today at each level (seeded Math.random, the room path), whole puzzles. */
const deals: unknown[] = [];
for (const level of ["normal", "easy", "hard", "expert"] as const)
  for (let n = 0; n < 6; n++) {
    const seed = roomSeed(n);
    deals.push({ level, n, puzzle: withSeededRandom(seed, () => generatePuzzle("ricochet", { bankSeed: seed, ...(level !== "normal" ? { level } : {}) })) });
  }
const specs = { normal4: moonStdSpecFor(MOON_BIG_REV, null), easy4: moonStdSpecFor(MOON_BIG_REV, "easy"), hard4: moonStdSpecFor(MOON_BIG_REV, "hard"), expert4: moonStdSpecFor(MOON_BIG_REV, "expert"), normal3: moonStdSpecFor(MOON_REV, null) };
const bodies = { 2: ninjaBodyFor(2), 3: ninjaBodyFor(3), 4: ninjaBodyFor(4) };
writeFileSync(OUT, gzipSync(JSON.stringify({ recorded: "ricoRev 4 (every level) and ricoRev 3 on 6988eaa3, before ricoRev 5 (22 Nov 2026)", towers, runs, deals, specs, bodies }) + "\n", { level: 9 }));
console.log(`recorded ${towers.length} towers, ${runs.length} runs and ${deals.length} deals to ${OUT}`);
