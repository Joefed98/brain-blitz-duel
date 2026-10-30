/**
 * Records tilt-standard-check's legacy fixture (scripts/fixtures/tilt-standard-legacy.json.gz): on a checkout of main
 * before tiltRev 10, a few runs on every older Tilt stamp (unstamped, 2–6, 8, 9) with their server score and final
 * state digest, so the check proves each still replays exactly as before. Random drags on every stamp, plus a weak
 * and an elite skill-band bot run on each (on tiltRev 8 and 9 through the keys, gates, ice, quick stars and falls).
 *
 *   bun scripts/tilt-standard-record.ts            # run on main's tree; writes the fixture
 *
 * With --new it records the new stamp's runs instead (scripts/fixtures/tilt-standard-runs.json.gz, on this tree):
 * the oracle (scripts/tilt-oracle.ts) on the first four bank seeds, each a 200 through the server's replay, and
 * weak, average and elite skill-band bot runs and random drags on tiltRev 10.
 *
 *   bun scripts/tilt-standard-record.ts --new
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { tiltCheckpoint, tiltGameFor, TILT_CHECKPOINT_INTERVAL, TILT_INPUT_DRAG, type TiltState } from "../src/lib/arcade/tilt";
import { encodeTiltRun, replayTiltRun } from "../src/lib/duel/tilt";
import { TILT_BANK } from "../src/lib/duel/tiltBank.server";
import { bot } from "./arcade-skill-bands/bots/tilt";
import { Human } from "./arcade-skill-bands/human";
import { tiltStateDigest } from "./tilt-expand-record";
import { oracleRun } from "./tilt-oracle";

type Ev = ArcadeInputEvent;
const REVS: (number | null)[] = [null, 2, 3, 4, 5, 6, 8, 9];

/** Seeded random drags (as room-identity/tilt.ts's randomLog) on a given stamp's game. */
function randomLog(rev: number | null, seed: number, salt: number): Ev[] {
  const game = tiltGameFor(rev);
  let s = game.init(seed) as TiltState;
  let v = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) | 0;
  let x = 220;
  let touch = 0;
  const events: Ev[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    v = (Math.imul(v, 1103515245) + 12345) | 0;
    let input: Ev | null = null;
    if ((v >>> 8) % 3 === 0) {
      x += ((v >>> 12) % 25) - 12;
      if (x < 10 || x > 430 || (v >>> 20) % 90 === 0) {
        x = 60 + ((v >>> 4) % 320);
        touch = (touch + 1) % 256;
      }
      input = { t: s.tick + 1, k: TILT_INPUT_DRAG, a: x, b: 0, c: touch, d: 0 };
      events.push(input);
    }
    s = game.step(s, input) as TiltState;
  }
  return events;
}

/** Encodes a log as the phone does (checkpoints from the stamp's own game). */
function encode(rev: number | null, seed: number, events: Ev[]): string {
  const game = tiltGameFor(rev);
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as TiltState;
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null) as TiltState;
    if (s.tick % TILT_CHECKPOINT_INTERVAL === 0) checkpoints.push(tiltCheckpoint(s));
  }
  return encodeTiltRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints: checkpoints as never });
}

type Row = { rev: number | null; seed: number; kind: string; raw: string; score: number; digest: string };

function row(rev: number | null, seed: number, kind: string, raw: string): Row {
  const r = replayTiltRun(seed, raw, rev);
  if (r.flagged) throw new Error(`tiltRev ${rev} ${seed} ${kind}: flagged (${r.reason})`);
  console.log(`tiltRev ${rev ?? "(none)"} seed ${seed} ${kind}: ${r.score} (${r.state.mazes} mazes, ended ${r.state.endedTick})`);
  return { rev, seed, kind, raw, score: r.score, digest: tiltStateDigest(r.state) };
}

function botLog(rev: number | null, seed: number, level: "weak" | "average" | "elite"): Ev[] {
  return bot({ game: tiltGameFor(rev), seed, rev, human: new Human("tilt", seed, level), fixes: true }).events ?? [];
}

/** Every older stamp: random drags, and a weak and an elite bot (run on main before tiltRev 10). */
function recordLegacy(): void {
  const runs: Row[] = [];
  for (const rev of REVS) {
    for (let k = 0; k < 4; k++) {
      // The expansion's stamps deal bank seeds; the older ones any seed.
      const seed = rev !== null && rev >= 8 ? TILT_BANK[k * 7]! : 1000 + k * 7919;
      runs.push(row(rev, seed, `random ${k}`, encode(rev, seed, randomLog(rev, seed, k))));
      if (k < 2) {
        const level = k === 0 ? "weak" : "elite";
        runs.push(row(rev, seed, level, encode(rev, seed, botLog(rev, seed, level))));
      }
    }
  }
  writeFileSync("scripts/fixtures/tilt-standard-legacy.json.gz", gzipSync(JSON.stringify({ recordedOn: "main 73f6bb7 (before tiltRev 10)", runs })));
  console.log(`wrote ${runs.length} runs`);
}

/** The new stamp's runs: oracle 200s on the first bank seeds, bots at three levels and random drags (tiltRev 10). */
function recordNew(): void {
  const rev = 10;
  const runs: Row[] = [];
  for (let k = 0; k < 4; k++) {
    const seed = TILT_BANK[k]!;
    runs.push(row(rev, seed, "oracle", oracleRun(seed, rev).raw));
  }
  for (let k = 0; k < 3; k++) {
    const seed = TILT_BANK[10 + k]!;
    runs.push(row(rev, seed, `random ${k}`, encode(rev, seed, randomLog(rev, seed, k))));
    for (const level of ["weak", "average", "elite"] as const) runs.push(row(rev, seed, level, encode(rev, seed, botLog(rev, seed, level))));
  }
  writeFileSync("scripts/fixtures/tilt-standard-runs.json.gz", gzipSync(JSON.stringify({ runs })));
  console.log(`wrote ${runs.length} runs`);
}

if (process.argv.includes("--new")) recordNew();
else recordLegacy();
