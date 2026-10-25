/**
 * Old-round records for expansion E3 (25 Oct 2026, docs/expansions/e3.md: Rally rallyRev 9 and Breaker
 * brkRev 9, the 200-point expansions). Real skill-band runs on every revision rooms ever stamped for the two
 * games (unstamped included), played by the skill-band bots through the server encode + replay path of the code
 * at <root>, recorded as score + FNV-1a of the replayed final state together with the encoded log: two runs per
 * level on the revision rooms dealt before the expansion (rallyRev 8, brkRev 8), one per level on every older one.
 * expansion-e3-check replays every log on today's code and must reach the same score and the same state, so
 * stored rounds provably replay and score exactly as before.
 *
 *   bun scripts/expansion-e3-legacy.ts <root> > scripts/fixtures/expansion-e3-legacy.json   (root = a checkout of main before the change)
 *
 * With --after it records the same way on the expansion revisions with today's code, two runs per level, so any
 * later change that moves an expansion round shows up the same way:
 *
 *   bun scripts/expansion-e3-legacy.ts "$PWD" --after > scripts/fixtures/expansion-e3-runs.json
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

/** Each game and its revisions before the expansion (null = unstamped), the last being the one rooms dealt. */
export const E3_GAMES: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["rally", [null, 2, 3, 4, 5, 6, 7, 8]],
  ["breaker", [null, 2, 3, 4, 5, 6, 7, 8]],
];
/** The expansion revisions (--after). */
export const E3_AFTER: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["rally", [9]],
  ["breaker", [9]],
];
const LEVELS = ["average", "good", "great", "near"] as const;

export interface E3Record {
  type: string;
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
  const out: E3Record[] = [];
  for (const [type, revs] of after ? E3_AFTER : E3_GAMES) {
    const spec = GAME_BY_TYPE.get(type);
    const { bot } = await import(`${root}/scripts/arcade-skill-bands/bots/${type}.ts`);
    revs.forEach((rev, index) => {
      const perLevel = index === revs.length - 1 ? 2 : 1;
      for (const level of LEVELS)
        for (let n = 0; n < perLevel; n++) {
          const seed = spec.seedFor(n + index * 7);
          const game = spec.gameFor(rev, seed);
          const human = new Human(spec.type, seed, level);
          const res = bot({ game, seed, rev, human });
          let state = game.init(seed);
          const checkpoints: unknown[] = [];
          const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
          while (!game.isOver(state) && state.tick < game.runTicks) {
            const t = state.tick + 1;
            state = game.step(state, byTick.get(t) ?? null);
            if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
          }
          const claimed = game.score(state);
          const raw = spec.encode({ seed, claimedScore: claimed, events: res.events ?? [], endTick: state.tick, checkpoints }, rev, seed);
          const result = spec.replay(seed, raw, rev);
          if (result.flagged) throw new Error(`${type} rev ${rev} ${level} ${n}: the run is flagged`);
          if (result.score !== claimed) throw new Error(`${type} rev ${rev} ${level} ${n}: bot ${claimed}, replay ${result.score}`);
          out.push({ type, rev, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
        }
    });
  }
  // --after: each game's best near-perfect run over its first 20 seeds (Rally reaches 200, Breaker 199), the top's proof.
  const top: E3Record[] = [];
  if (after)
    for (const [type, revs] of E3_AFTER) {
      const spec = GAME_BY_TYPE.get(type);
      const { bot } = await import(`${root}/scripts/arcade-skill-bands/bots/${type}.ts`);
      const rev = revs[0]!;
      let best: E3Record | null = null;
      for (let n = 0; n < 20; n++) {
        const seed = spec.seedFor(n);
        const game = spec.gameFor(rev, seed);
        const res = bot({ game, seed, rev, human: new Human(spec.type, seed, "near") });
        let state = game.init(seed);
        const checkpoints: unknown[] = [];
        const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
        while (!game.isOver(state) && state.tick < game.runTicks) {
          state = game.step(state, byTick.get(state.tick + 1) ?? null);
          if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
        }
        const claimed = game.score(state);
        if (best && claimed <= best.score) continue;
        const raw = spec.encode({ seed, claimedScore: claimed, events: res.events ?? [], endTick: state.tick, checkpoints }, rev, seed);
        const result = spec.replay(seed, raw, rev);
        if (result.flagged || result.score !== claimed) throw new Error(`${type} top run ${n}: replay ${result.score} vs ${claimed}`);
        best = { type, rev, level: "near", seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") };
      }
      if (best) top.push(best);
    }
  console.log(JSON.stringify({ recorded: after ? "the expansion E3 code (rallyRev 9, brkRev 9)" : "code on main before expansion E3 (5ea3e48)", runs: out, ...(after ? { top } : {}) }));
}
