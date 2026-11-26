/**
 * D5's Normal-play legacy fixture for the two unshipped Normal stamps whose scoring and levels were folded in on 23 Nov
 * 2026 (Wavefront wavRev 16, Fission burstRev 14): runs on the Normal deal as the branch built it (the wider formation,
 * the middle atoms) BEFORE the Normal scoring refit and the levels, so each game's ladder check can prove Normal's play
 * is unchanged (the replayed final state and every checkpoint the same) and only its score moved, as the new lines say.
 *
 * For each game: 24 real Normal deals (level-tune's `dealAt`, deal n = 0 … 23), the skill-band bots at Weak, Average and
 * Elite and the flawless player, all held to HUMAN_LIMITS (d5-ladder-lib's `playDealt`), plus a seeded random-input run on
 * four of them. Each entry keeps the dealt puzzle, the encoded log the phone sends, the server's score then and a digest
 * of the replayed final state and checkpoints.
 *
 * Recorded on polish/d5 428cd79a (plus this script; no D5 ladder code yet). Never re-record over it.
 *
 *   bun scripts/d5-normal-play-legacy-record.ts            (writes both fixtures)
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { ARCADE_INPUT_DRAG, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { BURST_INPUT_FIRE, BURST_INPUT_MOVE } from "../src/lib/arcade/burst";
import { WAV_WORLD_W } from "../src/lib/arcade/wavefront";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { replayBurstRun } from "../src/lib/duel/burst";
import { replayWavefrontRun } from "../src/lib/duel/wavefront";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { HUMAN_LIMITS, type SkillLevel } from "./arcade-skill-bands/human";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { playDealt } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";

export const NORMAL_PLAY_LEGACY: Record<"wavefront" | "burst", string> = {
  wavefront: "scripts/fixtures/wavefront-ladder-legacy.json.gz",
  burst: "scripts/fixtures/burst-ladder-legacy.json.gz",
};

export interface NormalPlayRun {
  label: string;
  puzzle: Record<string, unknown>;
  raw: string;
  /** The server's grade when recorded (the old scoring). */
  score: number;
  /** sha256 of the replayed final state and checkpoints (no score in it). */
  play: string;
}

const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 20);

/**
 * The server's replay of a run, reduced to its play: the replayed final state and whether the replay flagged the run for
 * anything but its claimed score (a log recorded before a scoring change carries the score it claimed then, so a replay
 * on the new lines flags only that mismatch: "score did not match the replay"; the play is what is compared).
 */
export function playDigest(type: "wavefront" | "burst", puzzle: PuzzleData, raw: string): string {
  const p = puzzle as unknown as { seed: number; wavRev?: number; burstRev?: number; level?: string };
  const r = type === "wavefront" ? replayWavefrontRun(p.seed, raw, p.wavRev, (p.level as never) ?? null) : replayBurstRun(p.seed, raw, p.burstRev, (p.level as never) ?? null);
  const claimOnly = r.flagged && r.reason === "score did not match the replay" && r.desyncTick === null;
  return sha({ state: r.state, flagged: Boolean(r.flagged) && !claimOnly });
}

/** A seeded random-input stream for a game (drags for Wavefront; walks and taps for Fission). */
export function randomEventsFor(type: "wavefront" | "burst", seed: number, runTicks: number): ArcadeInputEvent[] {
  const ev: ArcadeInputEvent[] = [];
  let x = seed | 1;
  for (let t = 3; t <= runTicks; ) {
    x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0;
    if (type === "wavefront") ev.push({ t, k: ARCADE_INPUT_DRAG, a: 20 + (x % (WAV_WORLD_W - 40)), b: 0, c: 0, d: 0 });
    else if (x % 3 === 0) ev.push({ t, k: BURST_INPUT_MOVE, a: 12 + (x % 366), b: 0, c: (x >>> 9) & 1, d: 0 });
    else ev.push({ t, k: BURST_INPUT_FIRE, a: 0, b: t & 1, c: 0, d: 0 });
    t += 4 + (x % 37);
  }
  return ev;
}

/** A log played on a dealt puzzle's own game, checkpointed and encoded as the phone sends it. */
export function encodeOn(type: PuzzleType, puzzle: PuzzleData, events: readonly ArcadeInputEvent[]): string {
  const spec = GAME_BY_TYPE.get(type)!;
  const loose = puzzle as unknown as { seed: number };
  const game = spec.gameForPuzzle!(puzzle);
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(loose.seed);
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % (spec.checkpointEvery ?? 300) === 0) checkpoints.push(spec.checkpoint(s));
  }
  const rev = (loose as unknown as Record<string, number>)[type === "wavefront" ? "wavRev" : "burstRev"];
  return spec.encode({ seed: loose.seed, claimedScore: game.score(s), events: [...events], inputs: [], taps: [], endTick: s.tick, checkpoints }, rev, loose.seed);
}

if (import.meta.main) {
  const skills: SkillLevel[] = ["weak", "average", "elite", "perfect"];
  for (const type of ["wavefront", "burst"] as const) {
    const runs: NormalPlayRun[] = [];
    for (let n = 0; n < 24; n++) {
      const puzzle = dealAt(type, "normal", n);
      for (const skill of skills) {
        const r = await playDealt(type, puzzle, skill, HUMAN_LIMITS);
        runs.push({ label: `${type} normal deal #${n} ${skill}`, puzzle: puzzle as unknown as Record<string, unknown>, raw: r.raw, score: r.score, play: playDigest(type, puzzle, r.raw) });
      }
      if (n % 6 === 0) {
        const raw = encodeOn(type, puzzle, randomEventsFor(type, 1000 + n, 5400));
        runs.push({ label: `${type} normal deal #${n} random`, puzzle: puzzle as unknown as Record<string, unknown>, raw, score: gradeAnswer(puzzle, raw, 0).score, play: playDigest(type, puzzle, raw) });
      }
    }
    writeFileSync(NORMAL_PLAY_LEGACY[type], gzipSync(JSON.stringify({ recordedOn: "polish/d5 428cd79a", runs })));
    console.log(`${type}: ${runs.length} runs → ${NORMAL_PLAY_LEGACY[type]} (scores ${Math.min(...runs.map((r) => r.score))}–${Math.max(...runs.map((r) => r.score))})`);
  }
}
