/**
 * Records the stored runs scoring-bands-check replays (19 Oct 2026, docs/scoring-targets.md): runs on every new
 * score-bands stamp, written to scripts/fixtures/scoring-bands-runs.json.gz.
 *
 *   - arcade: the skill-band bots (scripts/arcade-skill-bands/) on the revision rooms deal (LIVE_BANDS), two seeds
 *     at each level, encoded through the server's own encode path (176 runs);
 *   - engine games (Tenfall tenRev 2, Mixed Signals clashRev 6, Bonk whackRev 2, Pull! clayRev 7, Letterfall
 *     wordfallRev 3): the puzzle-fairness kits, two seeds at each level;
 *   - puzzles on puzzleScoreRev 2: the kits' answers (two seeds at each level, plus each spam strategy on one seed).
 *
 * Every run stores the score the server gave it when recorded.
 *
 *   bun scripts/scoring-bands-record.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { GAMES } from "./arcade-skill-bands/games";
import { Human, LEVELS as ARCADE_LEVELS } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { LIVE_BANDS, liveStrictRev, type LiveBandGame } from "../src/lib/arcade/liveBands";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS } from "./puzzle-fairness/kit";
import { roomPuzzle, runPlay, runSpam } from "./puzzle-fairness/run";
import { REV2_FINISH_GAMES, REV2_OPEN_GAMES } from "../src/lib/duel/puzzleScoreRev2";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleType } from "../src/lib/duel/types";

export const ENGINE_GAMES: PuzzleType[] = ["tendrop", "stroop", "whack", "clayshoot", "wordfall"];
export const FIXTURE = "scripts/fixtures/scoring-bands-runs.json.gz";

export interface ArcadeRun { kind: "arcade"; type: string; level: string; n: number; rev: number; raw: string; score: number }
export interface AnswerRun { kind: "engine" | "puzzle"; type: string; seed: number; label: string; answer: string; ms: number; score: number }

if (import.meta.main) {
  const arcade: ArcadeRun[] = [];
  for (const spec of GAMES) {
    if (spec.type === "junction") continue;
    // The score-bands revision (an expanded game's strictRev, docs/scoring-200.md).
    const rev = liveStrictRev(spec.type as LiveBandGame);
    const bot = (await import(new URL(`./arcade-skill-bands/bots/${spec.type}.ts`, import.meta.url).href)).bot as SkillBot;
    for (const level of ARCADE_LEVELS)
      for (let n = 0; n < 2; n++) {
        const seed = spec.seedFor(n);
        const game = spec.gameFor(rev, seed);
        const out = bot({ game, seed, rev, human: new Human(spec.type, seed, level) });
        let state = game.init(seed);
        const checkpoints: unknown[] = [];
        const events = out.events ?? [];
        const taps = out.taps ?? [];
        const byTick = new Map(events.map((e) => [e.t, e]));
        const tapSet = new Set(taps);
        while (!game.isOver(state) && state.tick < game.runTicks) {
          const t = state.tick + 1;
          state = game.step(state, spec.taps ? tapSet.has(t) : (byTick.get(t) ?? null));
          if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
        }
        const claimed = game.score(state);
        const raw = spec.encode({ seed, claimedScore: claimed, events, inputs: taps, taps: [], endTick: state.tick, checkpoints }, rev, seed);
        const replay = spec.replay(seed, raw, rev);
        if (replay.flagged || replay.score !== claimed) throw new Error(`${spec.type} ${level} ${n}: replay ${replay.score} vs claimed ${claimed} (${replay.reason ?? ""})`);
        arcade.push({ kind: "arcade", type: spec.type, level, n, rev, raw, score: replay.score });
      }
    console.error(`${spec.type}: 8 runs`);
  }
  const answers: AnswerRun[] = [];
  const record = (kind: AnswerRun["kind"], type: PuzzleType) => {
    for (let k = 0; k < 2; k++) {
      const seed = 9101 + k;
      const puzzle = roomPuzzle(type, seed);
      for (const level of LEVELS) {
        const r = runPlay(KITS[type]!, puzzle, seed, level);
        answers.push({ kind, type, seed, label: level, answer: r.answer, ms: r.msRemaining, score: r.score });
      }
      if (k === 0) for (const s of runSpam(KITS[type]!, puzzle, seed)) answers.push({ kind, type, seed, label: `spam:${s.label}`, answer: s.answer, ms: 0, score: s.score });
      answers.push({ kind, type, seed, label: "nothing", answer: KITS[type]!.nothing(puzzle), ms: puzzleTimeLimitMs(puzzle), score: 0 });
    }
    console.error(`${type}: recorded`);
  };
  for (const type of ENGINE_GAMES) record("engine", type);
  for (const type of [...REV2_FINISH_GAMES, ...REV2_OPEN_GAMES]) if (KITS[type]) record("puzzle", type);
  // The "nothing" rows store 0 by definition; the check grades them.
  writeFileSync(FIXTURE, gzipSync(JSON.stringify({ recordedOn: new Date().toISOString().slice(0, 10), arcade, answers })));
  console.error(`wrote ${FIXTURE}: ${arcade.length} arcade runs, ${answers.length} answers`);
}
