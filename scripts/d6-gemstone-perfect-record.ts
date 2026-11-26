/**
 * Records Gemstone's flawless Normal run on matchupRev 14 (D6, 26 Nov 2026) for its arcade-standard entry
 * (scripts/arcade-standard/matchup.ts): the skill-band bot's flawless level on room seeds from 0 until one run's
 * log, replayed by the server (replayMatchupRun on matchupRev 14 at Normal), scores exactly 200 unflagged with every
 * part at its maximum. matchupRev 13's recorded witness (scripts/fixtures/gemstone-levels-runs.json) can't stand in:
 * matchupRev 14's state carries its own marker in the checkpoint checksum, so its checkpoints differ.
 *
 *   bun scripts/d6-gemstone-perfect-record.ts            (writes scripts/fixtures/d6-gemstone-perfect.json)
 *   bun scripts/d6-gemstone-perfect-record.ts --check    (re-records and fails on any difference)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { matchupD6GameFor, matchupStdParts, MATCHUP_REV_D6, type MatchupState } from "../src/lib/arcade/matchup";
import { replayMatchupRun } from "../src/lib/duel/matchup";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/matchup";

export const D6_GEMSTONE_PERFECT = new URL("./fixtures/d6-gemstone-perfect.json", import.meta.url);

/** The flawless bot's encoded run on a seed at Normal on matchupRev 14, and the server's verdict on it. */
export function d6GemstoneFlawless(seed: number): { raw: string; score: number; flagged: boolean; full: boolean } {
  const spec: any = GAME_BY_TYPE.get("matchup" as never)!;
  const game = matchupD6GameFor("normal");
  const res = bot({ game, seed, rev: MATCHUP_REV_D6, human: new Human("matchup", seed, "perfect"), fixes: true });
  let state = game.init(seed) as MatchupState;
  const checkpoints: unknown[] = [];
  const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null) as MatchupState;
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const claimed = game.score(state);
  const raw = spec.encode({ seed, claimedScore: claimed, events: res.events ?? [], inputs: [], taps: [], endTick: state.tick, checkpoints }, MATCHUP_REV_D6, seed);
  const run = replayMatchupRun(seed, raw, MATCHUP_REV_D6);
  // The parts' maximums total 200, so they sum to 200 only with every part at its maximum.
  const parts = Object.values(matchupStdParts(run.state as MatchupState)) as number[];
  return { raw, score: run.score, flagged: Boolean(run.flagged) || run.score !== claimed, full: parts.reduce((a, b) => a + b, 0) === 200 };
}

if (import.meta.main) {
  console.error = () => {};
  let found: { seed: number; raw: string } | null = null;
  for (let seed = 0; seed < 200 && !found; seed++) {
    const r = d6GemstoneFlawless(seed);
    if (r.score === 200 && !r.flagged && r.full) found = { seed, raw: gzipSync(r.raw).toString("base64") };
  }
  if (!found) {
    console.log("FAIL: no flawless matchupRev 14 Normal run at 200 on seeds 0–199");
    process.exit(1);
  }
  const text = `${JSON.stringify({ recorded: "matchupRev 14 (D6), Normal, the flawless skill-band bot", seed: found.seed, raw: found.raw })}\n`;
  if (process.argv.includes("--check")) {
    const same = existsSync(D6_GEMSTONE_PERFECT) && readFileSync(D6_GEMSTONE_PERFECT, "utf8") === text;
    console.log(`${same ? "PASS" : "FAIL"}: the flawless matchupRev 14 run (seed ${found.seed}) ${same ? "re-records byte for byte" : "differs from the fixture"}`);
    process.exit(same ? 0 : 1);
  }
  writeFileSync(D6_GEMSTONE_PERFECT, text);
  console.log(`wrote ${D6_GEMSTONE_PERFECT.pathname} (seed ${found.seed})`);
}
