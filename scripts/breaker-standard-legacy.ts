/**
 * Old-round records for Breaker's arcade scoring standard (brkRev 11, 29 Oct 2026,
 * docs/arcade-standard-oct-2026/breaker.md). Skill-band bot runs on every revision rooms ever stamped for Breaker
 * (unstamped included, brkRev 10 the one rooms dealt before the standard), played through the server encode + replay
 * path of the code at <root>, recorded as score + FNV-1a of the replayed final state with the encoded log.
 * breaker-standard-check replays every log on today's code and must reach the same score and the same state.
 *
 *   bun scripts/breaker-standard-legacy.ts <root> > scripts/fixtures/breaker-standard-legacy.json   (root = main before the change)
 *
 * With --after it records brkRev 11 runs with today's code the same way (scripts/fixtures/breaker-standard-runs.json),
 * so a later change that moves a brkRev 11 round shows up.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

/** Every revision before the standard (null = unstamped); brkRev 10 is the one rooms dealt. */
export const STD_BEFORE: readonly (number | null)[] = [null, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const STD_AFTER: readonly (number | null)[] = [11];
const LEVELS = ["weak", "good", "near"] as const;

export interface BrkStdRecord {
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
  const after = process.argv.includes("--after");
  const { GAME_BY_TYPE } = await import(`${root}/scripts/arcade-skill-bands/games.ts`);
  const { Human } = await import(`${root}/scripts/arcade-skill-bands/human.ts`);
  const { bot } = await import(`${root}/scripts/arcade-skill-bands/bots/breaker.ts`);
  const spec = GAME_BY_TYPE.get("breaker");
  const out: BrkStdRecord[] = [];
  (after ? STD_AFTER : STD_BEFORE).forEach((rev, index) => {
    const perLevel = after || rev === 10 ? 2 : 1;
    for (const level of LEVELS)
      for (let n = 0; n < perLevel; n++) {
        const seed = spec.seedFor(n + index * 5);
        const game = spec.gameFor(rev, seed);
        const human = new Human("breaker", seed, level);
        const res = bot({ game, seed, rev, human });
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
        if (result.flagged) throw new Error(`rev ${rev} ${level} ${n}: the run is flagged`);
        if (result.score !== claimed) throw new Error(`rev ${rev} ${level} ${n}: bot ${claimed}, replay ${result.score}`);
        out.push({ rev, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
      }
  });
  console.log(JSON.stringify(out));
}
