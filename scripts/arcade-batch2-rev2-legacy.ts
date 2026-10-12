/**
 * Rev-2 digest for the batch-2 phone-test fixes (Oct 2026): seeded play on
 * Gemstone matchupRev 2 and Meteor snakeRev 2 exactly as they shipped in #15,
 * recorded as score + FNV-1a of the server replay's final state. matchupRev 3 and
 * snakeRev 3 must leave rev-2 rounds untouched; arcade-batch2-check compares
 * today's code with the digest saved before the change
 * (scripts/fixtures/arcade-batch2-rev2-legacy.json).
 *
 *   bun scripts/arcade-batch2-rev2-legacy.ts <root> > scripts/fixtures/arcade-batch2-rev2-legacy.json
 */
import type { LegacyRecord } from "./arcade-batch2-legacy";

function fnv(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export const REV2_SEEDS = [1, 77, 4242, 90210];

export async function rev2Digest(root: string): Promise<LegacyRecord[]> {
  const bots = await import(`${root}/scripts/arcade-batch2-bots.ts`);
  const matchup = await import(`${root}/src/lib/arcade/matchup.ts`);
  const matchupDuel = await import(`${root}/src/lib/duel/matchup.ts`);
  const snake = await import(`${root}/src/lib/arcade/snake.ts`);
  const snakeDuel = await import(`${root}/src/lib/duel/snake.ts`);
  const engine = await import(`${root}/src/lib/arcade/engine.ts`);
  const out: LegacyRecord[] = [];
  for (const seed of REV2_SEEDS) {
    const game = matchup.matchupGameFor(2);
    const run = bots.playMatchup(game, seed, 30);
    const raw = matchupDuel.encodeMatchupRun({ seed, claimedScore: run.score, events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints });
    const replay = matchupDuel.replayMatchupRun(seed, raw, 2);
    out.push({ game: "matchup/v2", seed, score: run.score, replayScore: replay.score, stateHash: fnv(JSON.stringify(replay.state)) });
  }
  for (const seed of REV2_SEEDS) {
    // Meteor: a greedy star-chaser that avoids walls, its body and rocks, so runs reach rocks.
    const game = snake.snakeGameFor(2);
    let state = game.init(seed);
    const events: any[] = [];
    const checkpoints: any[] = [];
    while (!game.isOver(state)) {
      const t = state.tick + 1;
      if (state.sinceMove + 1 >= snake.snakeStepTicks(state.eaten)) {
        const head = state.body[0];
        const hr = snake.snakeRow(head), hc = snake.snakeCol(head);
        const cost = (d: number) => {
          const r = hr + (d === 0 ? -1 : d === 2 ? 1 : 0), c = hc + (d === 1 ? 1 : d === 3 ? -1 : 0);
          if (r < 0 || r >= snake.SNAKE_ROWS || c < 0 || c >= snake.SNAKE_COLS) return 1e9;
          const cell = r * snake.SNAKE_COLS + c;
          if (state.body.slice(0, -1).includes(cell) || (state.rocks ?? []).includes(cell)) return 1e9;
          return Math.abs(r - snake.snakeRow(state.pellet)) + Math.abs(c - snake.snakeCol(state.pellet)) + (cell === state.rockWarn ? 50 : 0);
        };
        let want = state.dir;
        for (let d = 0; d < 4; d++) if (!snake.snakeReversal(state.dir, d) && cost(d) < cost(want)) want = d;
        if (want !== state.dir) engine.recordInput(events, { t, k: 4, a: want, b: 0, c: 0, d: 0 }, game.inputRanges);
      }
      state = game.step(state, engine.inputAt(events, t));
      if (state.tick % 300 === 0) checkpoints.push(snake.snakeCheckpoint(state));
    }
    const score = game.score(state);
    const raw = snakeDuel.encodeSnakeRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints });
    const replay = snakeDuel.replaySnakeRun(seed, raw, 2);
    out.push({ game: "snake/v2", seed, score, replayScore: replay.score, stateHash: fnv(JSON.stringify(replay.state)) });
  }
  return out;
}

if (import.meta.main) {
  const root = process.argv[2] ?? process.cwd();
  console.log(JSON.stringify(await rev2Digest(root), null, 1));
}
