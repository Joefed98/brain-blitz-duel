/**
 * Old-round records for Gemstone matchupRev 12 (six goals and six treasures, docs/arcade-standard/matchup.md).
 * Skill-band bot runs on matchupRev 11 (the revision rooms dealt before it) and matchupRev 10, played through the
 * server encode + replay path of the code at <root>, recorded as score + FNV-1a of the replayed final state with the
 * encoded log. gemstone-rev12-check replays every log on today's code and must reach the same score and the same
 * state, so stored rounds provably replay and score exactly as before (older stamps: gemstone-standard-legacy.json).
 *
 *   bun scripts/gemstone-rev12-legacy.ts <root> > scripts/fixtures/gemstone-rev12-legacy.json   (root = main before the change)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

/** Revisions recorded, and the runs per level on each. */
export const GEMSTONE_REV12_LEGACY_REVS: readonly (readonly [number, number])[] = [
  [10, 1],
  [11, 4],
];
const LEVELS = ["weak", "average", "good", "great", "near", "elite", "perfect"] as const;

if (import.meta.main) {
  const root = process.argv[2] ?? ".";
  const { GAME_BY_TYPE } = await import(`${root}/scripts/arcade-skill-bands/games.ts`);
  const { Human } = await import(`${root}/scripts/arcade-skill-bands/human.ts`);
  const { bot } = await import(`${root}/scripts/arcade-skill-bands/bots/matchup.ts`);
  const spec = GAME_BY_TYPE.get("matchup");
  const out: { rev: number; level: string; seed: number; score: number; stateHash: number; raw: string }[] = [];
  GEMSTONE_REV12_LEGACY_REVS.forEach(([rev, perLevel], index) => {
    for (const level of LEVELS)
      for (let n = 0; n < perLevel; n++) {
        const seed = spec.seedFor(n + 40 + index * 11);
        const game = spec.gameFor(rev, seed);
        const human = new Human("matchup", seed, level);
        const res = bot({ game, seed, rev, human, fixes: true });
        let state = game.init(seed);
        const checkpoints: unknown[] = [];
        const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
        while (!game.isOver(state) && state.tick < game.runTicks) {
          state = game.step(state, byTick.get(state.tick + 1) ?? null);
          if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
        }
        const claimed = game.score(state);
        const raw = spec.encode({ seed, claimedScore: claimed, events: res.events ?? [], inputs: [], taps: [], endTick: state.tick, checkpoints }, rev, seed);
        const result = spec.replay(seed, raw, rev);
        if (result.flagged) throw new Error(`rev ${rev} ${level} ${n}: the run is flagged`);
        if (result.score !== claimed) throw new Error(`rev ${rev} ${level} ${n}: bot ${claimed}, replay ${result.score}`);
        out.push({ rev, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
        console.error(`matchup rev ${rev} ${level} ${n}: ${result.score}`);
      }
  });
  console.log(JSON.stringify({ recorded: "code on main before matchupRev 12 (ae1efbe)", runs: out }));
}
