/**
 * Old-round records for Slice sliceRev 12 (3 Nov 2026, the Action polish, docs/arcade-standard/slice.md "sliceRev 12").
 * Skill-band runs on every revision rooms ever stamped for Slice (unstamped included), played by the skill-band bot
 * through the server encode + replay path of the code at <root>, recorded as score + FNV-1a of the replayed final
 * state together with the encoded log: two runs per level on sliceRev 11 (what rooms dealt before), one per level on
 * every older revision. slice-food-check replays every log on today's code and must reach the same score and state.
 *
 *   bun scripts/slice-food-legacy.ts <root> | gzip > scripts/fixtures/slice-food-legacy.json.gz   (root = a checkout of main before the change)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import type { SliceLegacyRecord } from "./slice-standard-legacy";

/** Slice's revisions before sliceRev 12 (null = unstamped), the last being the one rooms dealt. */
export const SLICE_FOOD_BEFORE: readonly (number | null)[] = [null, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
export const SLICE_FOOD_LEGACY_LEVELS = ["weak", "average", "near"] as const;
export type { SliceLegacyRecord };

if (import.meta.main) {
  const root = process.argv[2] ?? ".";
  const { GAME_BY_TYPE } = await import(`${root}/scripts/arcade-skill-bands/games.ts`);
  const { Human } = await import(`${root}/scripts/arcade-skill-bands/human.ts`);
  const { bot } = await import(`${root}/scripts/arcade-skill-bands/bots/slice.ts`);
  const spec = GAME_BY_TYPE.get("slice");
  const runs: SliceLegacyRecord[] = [];
  SLICE_FOOD_BEFORE.forEach((rev, index) => {
    const perLevel = index === SLICE_FOOD_BEFORE.length - 1 ? 2 : 1;
    for (const level of SLICE_FOOD_LEGACY_LEVELS)
      for (let n = 0; n < perLevel; n++) {
        const seed = spec.seedFor(n + index * 11 + 3);
        const game = spec.gameFor(rev, seed);
        const res = bot({ game, seed, rev, human: new Human("slice", seed, level), fixes: true });
        let state = game.init(seed);
        const checkpoints: unknown[] = [];
        const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
        while (!game.isOver(state) && state.tick < game.runTicks) {
          state = game.step(state, byTick.get(state.tick + 1) ?? null);
          if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
        }
        const claimed = game.score(state);
        const raw = spec.encode({ seed, claimedScore: claimed, events: res.events ?? [], endTick: state.tick, checkpoints }, rev, seed);
        const result = spec.replay(seed, raw, rev);
        if (result.flagged || result.score !== claimed) throw new Error(`slice rev ${rev} ${level} ${seed}: replay ${result.score} vs ${claimed}`);
        runs.push({ rev, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
      }
  });
  process.stdout.write(JSON.stringify(runs));
}
