/**
 * Wavefront wavRev 16's legacy fixture (D5, 22 Nov 2026; recorded on today's code before the wider formation was built):
 * runs on the stamps rooms dealt before it, each graded by the server's own replay, so wavefront-wide-check can prove
 * they replay and score exactly as recorded once wavRev 16 is in.
 *
 *  - wavRev 15 (WAV_REV_BIG, dealt from WAV_DEAL) at every level (Easy, Normal, Hard, Expert): the skill-band bots at
 *    Weak, Average and Elite and the flawless player, all held to HUMAN_LIMITS, on five real deals a level (level-tune's
 *    `dealAt`), plus two scripted runs a level that hold and lift the charged shot;
 *  - wavRev 14 and wavRev 13 (Normal): the Average and Elite bots on three room seeds each.
 *
 * Each entry keeps the encoded log the phone sends, the server's score and a digest of the replayed final state
 * (its checkpoint checksum and the counters the reveal shows).
 *
 *   bun scripts/wavefront-wide-legacy-record.ts     (writes scripts/fixtures/wavefront-wide-legacy.json.gz)
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { ARCADE_INPUT_DRAG, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { wavCheckpoint, wavefrontGameFor, WAV_REV_BIG, WAV_REV_CHARGE, WAV_REV_KEEP, WAV_V14_HOLD, WAV_V14_LIFT, WAV_WORLD_W, type WavState } from "../src/lib/arcade/wavefront";
import { encodeWavefrontRun } from "../src/lib/duel/wavefront";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { roomSeed } from "./arcade-skill-bands/games";
import { HUMAN_LIMITS, type SkillLevel } from "./arcade-skill-bands/human";
import { playDealt } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";
import { wavLegacyDigest, type WavLegacyRun } from "./wavefront-wide-lib";

export const WAV_WIDE_LEGACY = "scripts/fixtures/wavefront-wide-legacy.json.gz";

/** A scripted run that drags across and holds then lifts the charged shot every few seconds (wavRev 14+ input). */
export function chargeLog(seed: number): ArcadeInputEvent[] {
  const events: ArcadeInputEvent[] = [];
  let x = 60 + (seed % 270);
  let dir = seed % 2 ? 1 : -1;
  for (let t = 1; t < 5400; t += 37) {
    x += dir * 41;
    if (x < 30 || x > WAV_WORLD_W - 30) {
      dir = -dir;
      x = Math.max(30, Math.min(WAV_WORLD_W - 30, x));
    }
    const phase = Math.trunc(t / 37) % 4;
    const c = phase === 1 ? WAV_V14_HOLD : phase === 3 ? WAV_V14_LIFT : 0;
    events.push({ t, k: ARCADE_INPUT_DRAG, a: x, b: 0, c, d: 0 });
  }
  return events;
}

/** A log played on a puzzle's own game, checkpointed as the phone does, encoded as the phone sends it. */
export function encodeLog(puzzle: PuzzleData, events: readonly ArcadeInputEvent[]): string {
  const p = puzzle as unknown as { seed: number; wavRev?: number };
  const game = wavefrontGameFor(p.wavRev, puzzleLevel(puzzle));
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(p.seed) as WavState;
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null) as WavState;
    if (s.tick % 300 === 0) checkpoints.push(wavCheckpoint(s));
  }
  return encodeWavefrontRun({ seed: p.seed, claimedScore: game.score(s), events: [...events], inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
}

if (import.meta.main) {
  const runs: WavLegacyRun[] = [];
  const add = (label: string, puzzle: PuzzleData, raw: string) => {
    const graded = gradeAnswer(puzzle, raw, 0);
    runs.push({ label, puzzle: puzzle as unknown as Record<string, unknown>, raw, score: graded.score, digest: wavLegacyDigest(puzzle, raw) });
  };
  const levels: Level[] = ["easy", "normal", "hard", "expert"];
  const skills: SkillLevel[] = ["weak", "average", "elite", "perfect"];
  for (const level of levels) {
    for (let n = 0; n < 5; n++) {
      const puzzle = dealAt("wavefront", level, n);
      const rev = (puzzle as unknown as { wavRev?: number }).wavRev;
      if (rev !== WAV_REV_BIG) throw new Error(`deal ${level} #${n} is wavRev ${rev}, not ${WAV_REV_BIG}: record this before wavRev 16 is dealt`);
      for (const skill of skills) {
        const r = await playDealt("wavefront", puzzle, skill, HUMAN_LIMITS);
        add(`wavRev 15 ${level} deal #${n} ${skill}`, puzzle, r.raw);
      }
    }
    for (let n = 0; n < 2; n++) {
      const puzzle = dealAt("wavefront", level, 10 + n);
      add(`wavRev 15 ${level} deal #${10 + n} charged shots`, puzzle, encodeLog(puzzle, chargeLog((puzzle as unknown as { seed: number }).seed)));
    }
  }
  for (const rev of [WAV_REV_CHARGE, WAV_REV_KEEP]) {
    for (let n = 0; n < 3; n++) {
      const puzzle = { type: "wavefront", seed: roomSeed(n), wavRev: rev } as unknown as PuzzleData;
      for (const skill of ["average", "elite"] as SkillLevel[]) {
        const r = await playDealt("wavefront", puzzle, skill, HUMAN_LIMITS);
        add(`wavRev ${rev} normal room seed #${n} ${skill}`, puzzle, r.raw);
      }
    }
  }
  writeFileSync(WAV_WIDE_LEGACY, gzipSync(JSON.stringify({ recorded: "wavefront-wide-legacy-record (before wavRev 16, 22 Nov 2026)", runs })));
  console.log(`wrote ${WAV_WIDE_LEGACY}: ${runs.length} runs (scores ${Math.min(...runs.map((r) => r.score))}–${Math.max(...runs.map((r) => r.score))})`);
}
