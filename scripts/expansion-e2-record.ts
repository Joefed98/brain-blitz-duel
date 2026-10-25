/**
 * Records expansion E2's legacy fixture (run on unmodified main, 25 Oct 2026): skill-band bot runs on the
 * revisions Meteor, Fission and Tempo dealt before the expansion (and two older ones each), as the server
 * stores them: the encoded run, its replayed score and a digest of its final state.
 * expansion-e2-check replays every run on today's code and fails on any difference.
 *
 *   bun scripts/expansion-e2-record.ts [--out=scripts/fixtures/expansion-e2-legacy.json.gz]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, LEVELS } from "./arcade-skill-bands/human";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/expansion-e2-legacy.json.gz";
/** type → revisions to record (the score-bands revision rooms dealt before the expansion first). */
const REVS: Record<string, number[]> = { snake: [8, 6, 3], burst: [6, 4, 2], beat: [8, 6, 2] };
const SEEDS = 3;

export function stateDigest(state: unknown): string {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 24);
}

const runs: any[] = [];
for (const [type, revs] of Object.entries(REVS)) {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const bot = (await import(`./arcade-skill-bands/bots/${type}.ts`)).bot;
  for (const rev of revs)
    for (const level of LEVELS)
      for (let n = 0; n < SEEDS; n++) {
        const seed = spec.seedFor(n * 7 + 1);
        const game = spec.gameFor(rev, seed);
        const out = bot({ game, seed, rev, human: new Human(type, seed, level) });
        let state = game.init(seed);
        const by = new Map((out.events ?? []).map((e: any) => [e.t, e]));
        const checkpoints: unknown[] = [];
        while (!game.isOver(state) && state.tick < game.runTicks) {
          state = game.step(state, by.get(state.tick + 1) ?? null);
          if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
        }
        const score = game.score(state);
        const raw = spec.encode({ seed, claimedScore: score, events: out.events ?? [], endTick: state.tick, checkpoints }, rev, seed);
        const result = spec.replay(seed, raw, rev);
        runs.push({ type, rev, level, seed, raw, score: result.score, flagged: Boolean(result.flagged), digest: stateDigest(result.state) });
      }
  console.log(`${type}: ${revs.length * LEVELS.length * SEEDS} runs`);
}
writeFileSync(OUT, gzipSync(JSON.stringify({ recorded: "main 5ea3e48, 25 Oct 2026", runs })));
console.log(`wrote ${OUT} (${runs.length} runs)`);
