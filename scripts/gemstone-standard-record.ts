/**
 * Gemstone matchupRev 11 (the arcade scoring standard, docs/arcade-standard-oct-2026/matchup.md): records the runs
 * gemstone-standard-check and scripts/arcade-standard/matchup.ts replay.
 *  - perfect: the first flawless skill-band bot run (room seeds from 0 on) that the server's replay scores 200, every
 *    part at its maximum;
 *  - runs: one bot run per level on a few room seeds (score and FNV-1a of the replayed state), so later changes can't
 *    move a matchupRev 11 round without the check noticing.
 *
 *   bun scripts/gemstone-standard-record.ts > scripts/fixtures/gemstone-standard-runs.json
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/matchup";
import { matchupGameFor, matchupStdParts, MATCHUP_REV_STD, type MatchupState } from "../src/lib/arcade/matchup";

const spec = GAME_BY_TYPE.get("matchup")!;
const rev = MATCHUP_REV_STD;
const game = matchupGameFor(rev);

export function playBot(seed: number, level: SkillLevel): { raw: string; score: number; state: MatchupState } {
  const res = bot({ game, seed, rev, human: new Human("matchup", seed, level), fixes: true });
  const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  while (!game.isOver(state)) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const claimed = game.score(state);
  const raw = spec.encode({ seed, claimedScore: claimed, events: res.events ?? [], inputs: [], taps: [], endTick: state.tick, checkpoints }, rev, seed);
  const result = spec.replay(seed, raw, rev);
  if (result.flagged || result.score !== claimed) throw new Error(`seed ${seed} ${level}: bot ${claimed}, replay ${result.score}${result.flagged ? " (flagged)" : ""}`);
  return { raw, score: result.score, state: result.state as MatchupState };
}

if (import.meta.main) {
  let perfect: { seed: number; score: number; raw: string } | null = null;
  for (let n = 0; n < 400 && !perfect; n++) {
    const seed = spec.seedFor(n);
    const run = playBot(seed, "perfect");
    const p = matchupStdParts(run.state);
    console.error(`perfect n=${n} seed ${seed}: ${run.score} (${JSON.stringify(p)})`);
    if (run.score === 200) perfect = { seed, score: run.score, raw: gzipSync(run.raw).toString("base64") };
  }
  if (!perfect) throw new Error("no flawless run reached 200");
  const runs: { level: string; seed: number; score: number; stateHash: number; raw: string }[] = [];
  for (const level of ["weak", "average", "good", "great", "near", "elite", "perfect"] as const)
    for (let n = 0; n < 2; n++) {
      const seed = spec.seedFor(n + 3);
      const run = playBot(seed, level);
      runs.push({ level, seed, score: run.score, stateHash: fnv(JSON.stringify(run.state)), raw: gzipSync(run.raw).toString("base64") });
      console.error(`${level} seed ${seed}: ${run.score}`);
    }
  console.log(JSON.stringify({ recorded: "matchupRev 11 (the arcade scoring standard)", perfect, runs }));
}
