/**
 * Records tilt-rev11-check's fixtures (docs/arcade-standard/tilt.md "tiltRev 11").
 *
 *   bun scripts/tilt-rev11-record.ts --legacy   # on unmodified main before tiltRev 11: scripts/fixtures/tilt-rev11-legacy.json.gz
 *   bun scripts/tilt-rev11-record.ts --new      # on this tree: scripts/fixtures/tilt-rev11-runs.json.gz
 *
 * --legacy: runs on every older Tilt stamp (unstamped, 2–6, 8, 9 and 10, the one rooms dealt before the change):
 * random drags and skill-band bot runs, each with its server score, flag, final-state digest and checkpoints digest,
 * so the check proves each still replays exactly as before. tiltRev 10 gets more runs (every level).
 *
 * --new: tiltRev 11's runs: the oracle (scripts/tilt-oracle.ts) on four bank seeds, each a 200 through the server
 * replay, then weak, average, good and elite bot runs and random drags.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { tiltCheckpoint, tiltGameFor, TILT_CHECKPOINT_INTERVAL, TILT_INPUT_DRAG, type TiltState } from "../src/lib/arcade/tilt";
import { encodeTiltRun, replayTiltRun } from "../src/lib/duel/tilt";
import { TILT_BANK } from "../src/lib/duel/tiltBank.server";
import { bot } from "./arcade-skill-bands/bots/tilt";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { tiltStateDigest } from "./tilt-expand-record";

type Ev = ArcadeInputEvent;
/** Every Tilt stamp before tiltRev 11 (null = unstamped; there was never a tiltRev 7). */
export const REV11_BEFORE: readonly (number | null)[] = [null, 2, 3, 4, 5, 6, 8, 9, 10];

export type Row = { rev: number | null; seed: number; kind: string; raw: string; score: number; flagged: boolean; digest: string; checkpoints: string };

/** A short FNV digest of any JSON value (checkpoints). */
export function jsonDigest(value: unknown): string {
  const text = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `${text.length}:${h.toString(16)}`;
}

/** Seeded random drags (as room-identity/tilt.ts's randomLog) on a given stamp's game. */
export function randomLog(rev: number | null, seed: number, salt: number): Ev[] {
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
export function encode(rev: number | null, seed: number, events: Ev[]): string {
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

export function row(rev: number | null, seed: number, kind: string, raw: string): Row {
  const r = replayTiltRun(seed, raw, rev);
  console.log(`tiltRev ${rev ?? "(none)"} seed ${seed} ${kind}: ${r.score}${r.flagged ? ` FLAGGED (${r.reason})` : ""} (${r.state.mazes} mazes, falls ${r.state.falls ?? 0}, ended ${r.state.endedTick})`);
  return { rev, seed, kind, raw, score: r.score, flagged: Boolean(r.flagged), digest: tiltStateDigest(r.state), checkpoints: jsonDigest(r.checkpoints) };
}

export function botLog(rev: number | null, seed: number, level: SkillLevel): Ev[] {
  return bot({ game: tiltGameFor(rev), seed, rev, human: new Human("tilt", seed, level), fixes: true }).events ?? [];
}

function recordLegacy(): void {
  const runs: Row[] = [];
  REV11_BEFORE.forEach((rev, index) => {
    const last = rev === 10;
    for (let k = 0; k < (last ? 3 : 2); k++) {
      // The expansion's stamps deal bank seeds (ones tilt-standard's fixture did not use); the older ones any seed.
      const seed = rev !== null && rev >= 8 ? TILT_BANK[100 + index * 11 + k * 3]! : 2000 + index * 101 + k * 7919;
      runs.push(row(rev, seed, `random ${k}`, encode(rev, seed, randomLog(rev, seed, k + 5))));
      const levels: SkillLevel[] = last ? ["weak", "average", "good", "great", "near", "elite"] : k === 0 ? ["weak"] : ["elite"];
      for (const level of levels) runs.push(row(rev, seed, level, encode(rev, seed, botLog(rev, seed, level))));
    }
  });
  const commit = process.env.LEGACY_COMMIT ?? "";
  writeFileSync("scripts/fixtures/tilt-rev11-legacy.json.gz", gzipSync(JSON.stringify({ recordedOn: `unmodified main ${commit} before tiltRev 11`.replace("  ", " "), runs })));
  console.log(`wrote ${runs.length} runs`);
}

async function recordNew(): Promise<void> {
  const { oracleRun } = await import("./tilt-oracle");
  const rev = 11;
  const runs: Row[] = [];
  for (let k = 0; k < 4; k++) {
    const seed = TILT_BANK[k * 5]!;
    runs.push(row(rev, seed, "oracle", oracleRun(seed, rev).raw));
  }
  for (let k = 0; k < 3; k++) {
    const seed = TILT_BANK[30 + k]!;
    runs.push(row(rev, seed, `random ${k}`, encode(rev, seed, randomLog(rev, seed, k))));
    for (const level of ["weak", "average", "good", "elite"] as const) runs.push(row(rev, seed, level, encode(rev, seed, botLog(rev, seed, level))));
  }
  writeFileSync("scripts/fixtures/tilt-rev11-runs.json.gz", gzipSync(JSON.stringify({ runs })));
  console.log(`wrote ${runs.length} runs`);
}

if (import.meta.main) {
  if (process.argv.includes("--new")) await recordNew();
  else if (process.argv.includes("--legacy")) recordLegacy();
  else console.log("usage: bun scripts/tilt-rev11-record.ts --legacy | --new");
}
