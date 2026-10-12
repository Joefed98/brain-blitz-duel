/**
 * Legacy digest for the batch-2 arcade upgrades (Gemstone, Coral Pop, Meteor,
 * Hover): seeded play on each game's ORIGINAL (unstamped) rules, recorded as
 * score + FNV-1a of the server replay's final state. Run against a source root;
 * arcade-batch2-check compares today's code with the digest saved from the code
 * before the upgrades (scripts/fixtures/arcade-batch2-legacy.json), so unstamped
 * rounds provably replay and score exactly as before.
 *
 *   bun scripts/arcade-batch2-legacy.ts <root> > scripts/fixtures/arcade-batch2-legacy.json
 */

export interface LegacyRecord {
  game: string;
  seed: number;
  score: number;
  replayScore: number;
  stateHash: number;
}

function fnv(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function rng(seed: number) {
  let s = seed | 0;
  return (n: number) => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
}

export const LEGACY_SEEDS = [1, 77, 4242, 90210, 123457, 31337];

export async function legacyDigest(root: string): Promise<LegacyRecord[]> {
  const engine = await import(`${root}/src/lib/arcade/engine.ts`);
  const matchup = await import(`${root}/src/lib/arcade/matchup.ts`);
  const matchupDuel = await import(`${root}/src/lib/duel/matchup.ts`);
  const bubble = await import(`${root}/src/lib/arcade/bubble.ts`);
  const bubbleDuel = await import(`${root}/src/lib/duel/bubble.ts`);
  const snake = await import(`${root}/src/lib/arcade/snake.ts`);
  const snakeDuel = await import(`${root}/src/lib/duel/snake.ts`);
  const hover = await import(`${root}/src/lib/arcade/hover.ts`);
  const hoverDuel = await import(`${root}/src/lib/duel/hover.ts`);

  const out: LegacyRecord[] = [];
  const record = (game: string, seed: number, score: number, replay: { score: number; state: unknown }) =>
    out.push({ game, seed, score, replayScore: replay.score, stateHash: fnv(JSON.stringify(replay.state)) });

  for (const seed of LEGACY_SEEDS) {
    // Gemstone: mostly the hint swap (real scoring play with cascades and specials), some random swaps.
    {
      const rand = rng(seed * 31 + 7);
      const game = matchup.matchupGame;
      const events: any[] = [];
      const checkpoints: any[] = [];
      let state = game.init(seed);
      while (!game.isOver(state)) {
        const t = state.tick + 1;
        if (rand(1000) < 30) {
          const hint = rand(4) > 0 ? matchup.matchupFindSwap(state.cells) : null;
          const ev = hint
            ? { t, k: 3, a: hint.row1, b: hint.col1, c: hint.row2, d: hint.col2 }
            : { t, k: 3, a: rand(8), b: rand(7), c: rand(8), d: rand(7) };
          engine.recordInput(events, ev, game.inputRanges);
        }
        state = game.step(state, engine.inputAt(events, t));
        if (state.tick % 300 === 0) checkpoints.push(matchup.matchupCheckpoint(state));
      }
      const score = game.score(state);
      const raw = matchupDuel.encodeMatchupRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints });
      record("matchup", seed, score, matchupDuel.replayMatchupRun(seed, raw));
    }
    // Coral Pop: random upward shots.
    {
      const rand = rng(seed * 31 + 11);
      const game = bubble.bubbleGame;
      const events: any[] = [];
      const checkpoints: any[] = [];
      let state = game.init(seed);
      while (!game.isOver(state)) {
        const t = state.tick + 1;
        if (state.flightColour === 0 && rand(1000) < 40) {
          // Aim at the lowest bubble of the loaded colour when there is one.
          const colour = state.queue[state.queueAt];
          let aim = { a: rand(6000) - 3000, b: -200 - rand(3000) };
          for (let i = state.grid.length - 1; i >= 0 && rand(4) > 0; i--) {
            if (state.grid[i] !== colour) continue;
            const row = Math.floor(i / bubble.BUB_COLS);
            const dx = bubble.bubCellX(row, i % bubble.BUB_COLS) - bubble.BUB_SHOOTER_X;
            const dy = bubble.bubCellY(row, state.descents) - bubble.BUB_SHOOTER_Y;
            aim = { a: dx * 8, b: Math.min(-1, dy * 8) };
            break;
          }
          engine.recordInput(events, { t, k: 2, a: aim.a, b: aim.b, c: 0, d: 0 }, game.inputRanges);
        }
        state = game.step(state, engine.inputAt(events, t));
        if (state.tick % 300 === 0) checkpoints.push(bubble.bubCheckpoint(state));
      }
      const score = game.score(state);
      const raw = bubbleDuel.encodeBubbleRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints });
      const replayed = bubbleDuel.replayBubbleRun(seed, raw);
      record("bubble", seed, score, replayed);
    }
    // Meteor: steer toward the star, with some random turns.
    {
      const rand = rng(seed * 31 + 13);
      const game = snake.snakeGame;
      const events: any[] = [];
      const checkpoints: any[] = [];
      let state = game.init(seed);
      while (!game.isOver(state)) {
        const t = state.tick + 1;
        if (rand(1000) < 120) {
          // Greedy toward the star among directions that are not instantly fatal.
          const head = state.body[0];
          const hr = snake.snakeRow(head);
          const hc = snake.snakeCol(head);
          const dist = (d: number) => {
            const r = hr + (d === 0 ? -1 : d === 2 ? 1 : 0);
            const c = hc + (d === 1 ? 1 : d === 3 ? -1 : 0);
            if (r < 0 || r >= snake.SNAKE_ROWS || c < 0 || c >= snake.SNAKE_COLS) return 1e9;
            if (state.body.slice(0, -1).includes(r * snake.SNAKE_COLS + c)) return 1e9;
            return Math.abs(r - snake.snakeRow(state.pellet)) + Math.abs(c - snake.snakeCol(state.pellet)) + rand(3);
          };
          let want = state.dir;
          for (let d = 0; d < 4; d++) if (!snake.snakeReversal(state.dir, d) && dist(d) < dist(want)) want = d;
          if (rand(12) === 0) want = rand(4);
          engine.recordInput(events, { t, k: 4, a: want, b: 0, c: 0, d: 0 }, game.inputRanges);
        }
        state = game.step(state, engine.inputAt(events, t));
        if (state.tick % 300 === 0) checkpoints.push(snake.snakeCheckpoint(state));
      }
      const score = game.score(state);
      const raw = snakeDuel.encodeSnakeRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints });
      record("snake", seed, score, snakeDuel.replaySnakeRun(seed, raw));
    }
    // Hover: a simple controller toward the next gap centre, plus jitter.
    {
      const rand = rng(seed * 31 + 17);
      const game = hover.hoverGame;
      const inputs: number[] = [];
      const checkpoints: any[] = [];
      let state = game.init(seed);
      while (!game.isOver(state)) {
        const t = state.tick + 1;
        const next = state.pillars[state.gates];
        const target = next ? next.gapTop + (next.gapH >> 1) : 71_680;
        if ((state.y > target + 2_000 && state.vy > -200) || rand(1000) < 8) engine.recordTap(inputs, t);
        state = game.step(state, engine.tapAt(inputs, t));
        if (state.tick % 300 === 0) checkpoints.push(hover.hoverCheckpoint(state));
      }
      const score = game.score(state);
      const raw = hoverDuel.encodeHoverRun({ seed, claimedScore: score, inputs, endTick: state.tick, checkpoints });
      record("hover", seed, score, hoverDuel.replayHoverRun(seed, raw));
    }
  }
  return out;
}

if (import.meta.main) {
  const root = process.argv[2] ?? process.cwd();
  console.log(JSON.stringify(await legacyDigest(root), null, 1));
}
