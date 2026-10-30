/**
 * Old-round records for Slice sliceRev 11 (29 Oct 2026, the arcade scoring standard, docs/arcade-standard-oct-2026/slice.md).
 * Skill-band runs on every revision rooms ever stamped for Slice (unstamped included), played by the skill-band bot
 * through the server encode + replay path of the code at <root>, recorded as score + FNV-1a of the replayed final
 * state together with the encoded log: two runs per level on sliceRev 10 (what rooms dealt before), one per level on
 * every older revision. slice-standard-check replays every log on today's code and must reach the same score and the
 * same state, so stored rounds provably replay and score exactly as before.
 *
 *   bun scripts/slice-standard-legacy.ts <root> | gzip > scripts/fixtures/slice-standard-legacy.json.gz   (root = a checkout of main before the change)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

/** Slice's revisions before sliceRev 11 (null = unstamped), the last being the one rooms dealt. */
export const SLICE_BEFORE: readonly (number | null)[] = [null, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const SLICE_LEGACY_LEVELS = ["average", "near"] as const;

export interface SliceLegacyRecord {
  rev: number | null;
  level: string;
  seed: number;
  score: number;
  stateHash: number;
  /** The encoded run, gzip + base64. */
  raw: string;
}

if (import.meta.main) {
  const root = process.argv[2] ?? ".";
  const { GAME_BY_TYPE } = await import(`${root}/scripts/arcade-skill-bands/games.ts`);
  const { Human } = await import(`${root}/scripts/arcade-skill-bands/human.ts`);
  const { bot } = await import(`${root}/scripts/arcade-skill-bands/bots/slice.ts`);
  const spec = GAME_BY_TYPE.get("slice");
  const runs: SliceLegacyRecord[] = [];
  SLICE_BEFORE.forEach((rev, index) => {
    const perLevel = index === SLICE_BEFORE.length - 1 ? 2 : 1;
    for (const level of SLICE_LEGACY_LEVELS)
      for (let n = 0; n < perLevel; n++) {
        const seed = spec.seedFor(n + index * 7);
        const game = spec.gameFor(rev, seed);
        const res = bot({ game, seed, rev, human: new Human("slice", seed, level), fixes: false });
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
