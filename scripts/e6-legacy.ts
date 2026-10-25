/**
 * Old-round records for expansion E6 (25 Oct 2026: Coral Pop bubbleRev 8, Gemstone matchupRev 9, Ball Tracker
 * btRev 7). Skill-band bot runs on the revisions rooms dealt before the expansion (and the two before each),
 * played through the server encode + replay path of the code at <root>, recorded as score + FNV-1a of the
 * replayed final state with the encoded log. e6-check replays every log on today's code and must reach the
 * same score and the same state, so stored rounds provably replay and score exactly as before.
 *
 *   bun scripts/e6-legacy.ts <root> > scripts/fixtures/e6-legacy.json   (root = main before the change)
 *   bun scripts/e6-legacy.ts "$PWD" --after > scripts/fixtures/e6-runs.json   (the new stamps, today's code)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

export const E6_BEFORE: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["bubble", [5, 6, 7]],
  ["matchup", [6, 7, 8]],
  ["balltrack", [4, 5, 6]],
];
export const E6_AFTER: readonly (readonly [string, readonly (number | null)[]])[] = [
  ["bubble", [8]],
  ["matchup", [9]],
  ["balltrack", [7]],
];
const LEVELS = ["average", "good", "great", "near"] as const;

export interface E6Record {
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
  const out: E6Record[] = [];
  for (const [type, revs] of after ? E6_AFTER : E6_BEFORE) {
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
          const raw = spec.encode({ seed, claimedScore: claimed, events: res.events ?? [], inputs: [], taps: [], endTick: state.tick, checkpoints }, rev, seed);
          const result = spec.replay(seed, raw, rev);
          if (result.flagged) throw new Error(`${type} rev ${rev} ${level} ${n}: the run is flagged`);
          if (result.score !== claimed) throw new Error(`${type} rev ${rev} ${level} ${n}: bot ${claimed}, replay ${result.score}`);
          out.push({ type, rev, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
          console.error(`${type} rev ${rev} ${level} ${n}: ${result.score}`);
        }
    });
  }
  console.log(JSON.stringify({ recorded: after ? "the E6 expansion code" : "code on main before the E6 expansion (5ea3e48)", runs: out }));
}
