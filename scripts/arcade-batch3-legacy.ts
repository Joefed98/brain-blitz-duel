/**
 * Legacy digest for the batch-3 arcade upgrades (Wavefront, Grappler, Breaker,
 * Fission): seeded play on each game's revisions as they were before the
 * upgrades (Wavefront, Breaker and Fission unstamped; Grappler unstamped,
 * swingRev 2 and swingRev 3), recorded as score + FNV-1a of the server
 * replay's final state. arcade-batch3-check compares today's code with the
 * digest saved from the code before the upgrades
 * (scripts/fixtures/arcade-batch3-legacy.json), so stored rounds provably
 * replay and score exactly as before.
 *
 *   bun scripts/arcade-batch3-legacy.ts <root> > scripts/fixtures/arcade-batch3-legacy.json
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

/** The Grappler seeds: the first few banked swingRev-3 courses plus two fixed ones. */
const SWING_SEEDS = [296564899, 1499332260, 720939650, 1, 4242];

export async function legacyDigest(root: string): Promise<LegacyRecord[]> {
  const engine = await import(`${root}/src/lib/arcade/engine.ts`);
  const wav = await import(`${root}/src/lib/arcade/wavefront.ts`);
  const wavDuel = await import(`${root}/src/lib/duel/wavefront.ts`);
  const swing = await import(`${root}/src/lib/arcade/swing.ts`);
  const swingDuel = await import(`${root}/src/lib/duel/swing.ts`);
  const brk = await import(`${root}/src/lib/arcade/breaker.ts`);
  const brkDuel = await import(`${root}/src/lib/duel/breaker.ts`);
  const burst = await import(`${root}/src/lib/arcade/burst.ts`);
  const burstDuel = await import(`${root}/src/lib/duel/burst.ts`);

  const out: LegacyRecord[] = [];
  const record = (game: string, seed: number, score: number, replay: { score: number; state: unknown }) =>
    out.push({ game, seed, score, replayScore: replay.score, stateHash: fnv(JSON.stringify(replay.state)) });

  /** Plays `game` from `seed` with `pick` choosing each tick's input; returns score, events, checkpoints. */
  const play = (game: any, seed: number, checkpoint: (s: any) => any, pick: (s: any, t: number) => any) => {
    const events: any[] = [];
    const checkpoints: any[] = [];
    let state = game.init(seed);
    while (!game.isOver(state)) {
      const t = state.tick + 1;
      const ev = pick(state, t);
      if (ev) engine.recordInput(events, { t, b: 0, c: 0, d: 0, ...ev }, game.inputRanges);
      state = game.step(state, engine.inputAt(events, t));
      if (state.tick % 300 === 0) checkpoints.push(checkpoint(state));
    }
    return { state, score: game.score(state), events, checkpoints, endTick: state.tick };
  };

  for (const seed of LEGACY_SEEDS) {
    // Wavefront: chase the lowest live shape's column, dodge nothing, some jitter.
    {
      const rand = rng(seed * 31 + 3);
      const game = wav.wavefrontGame;
      const r = play(game, seed, wav.wavCheckpoint, (s, t) => {
        if (t % 6 !== 0) return null;
        let target = s.shipX;
        for (let i = s.shapes.length - 1; i >= 0; i--)
          if (s.shapes[i]) {
            target = wav.wavShapeBox(s, i).x + 14;
            break;
          }
        if (s.drop && s.drop.wait === 0) target = Math.trunc(s.drop.x / 256);
        return { k: 7, a: Math.max(0, Math.min(390, target + rand(41) - 20)) };
      });
      const raw = wavDuel.encodeWavefrontRun({ seed, claimedScore: r.score, events: r.events, endTick: r.endTick, checkpoints: r.checkpoints });
      record("wavefront", seed, r.score, wavDuel.replayWavefrontRun(seed, raw));
    }
    // Breaker: follow the lead ball, tap now and then.
    {
      const rand = rng(seed * 31 + 5);
      const game = brk.breakerGame;
      const r = play(game, seed, brk.brkCheckpoint, (s, t) => {
        if (s.held && rand(60) === 0) return { k: 10, a: 1 };
        if (t % 4 !== 0) return null;
        const ball = s.balls.reduce((a: any, b: any) => (b.y > a.y ? b : a), s.balls[0]);
        const cap = s.capsules[0];
        const x = cap && rand(2) ? cap.x : ball ? ball.x : s.paddleX * 256;
        return { k: 7, a: Math.max(0, Math.min(390, Math.trunc(x / 256) + rand(31) - 15)) };
      });
      const raw = brkDuel.encodeBreakerRun({ seed, claimedScore: r.score, events: r.events, endTick: r.endTick, checkpoints: r.checkpoints });
      record("breaker", seed, r.score, brkDuel.replayBreakerRun(seed, raw));
    }
    // Fission: walk under the nearest atom and fire, catch icons.
    {
      const rand = rng(seed * 31 + 7);
      const game = burst.burstGame;
      let flip = 0;
      const r = play(game, seed, burst.burstCheckpoint, (s, t) => {
        if (t % 9 === 0) return { k: 0, a: 0, b: (flip ^= 1) };
        if (t % 9 !== 4) return null;
        const icon = s.icons[0];
        const ball = s.balls[0];
        const x = icon ? icon.x : ball ? ball.x + (rand(2) ? 60 : -60) * 256 : s.x;
        return { k: 7, a: Math.max(0, Math.min(390, Math.trunc(x / 256) + rand(21) - 10)) };
      });
      const raw = burstDuel.encodeBurstRun({ seed, claimedScore: r.score, events: r.events, endTick: r.endTick, checkpoints: r.checkpoints });
      record("burst", seed, r.score, burstDuel.replayBurstRun(seed, raw));
    }
  }
  // Grappler: rhythmic hold/release with seeded timing, on every stored revision.
  for (const rev of [undefined, 2, 3]) {
    for (const seed of SWING_SEEDS) {
      const rand = rng(seed * 31 + 9 + (rev ?? 0));
      const game = swing.swingGameFor(rev);
      let next = 30;
      let holding = 1;
      const r = play(game, seed, swing.swingCheckpoint, (s, t) => {
        if (t === 1) return { k: 12, a: 0 };
        if (t < next) return null;
        holding ^= 1;
        next = t + (holding ? 20 + rand(50) : 8 + rand(25));
        if (rand(8) === 0) return { k: 4, a: rand(2) };
        return { k: 12, a: holding };
      });
      const raw = swingDuel.encodeSwingRun({ seed, claimedScore: r.score, events: r.events, endTick: r.endTick, checkpoints: r.checkpoints });
      record(`swing/${rev ?? 0}`, seed, r.score, swingDuel.replaySwingRun(seed, raw, rev));
    }
  }
  // Grappler: the proof bot's witness (a full 500 m run through the dragons) on swingRev 2 and 3.
  const proof = await import(`${root}/src/lib/duel/swingProof.server.ts`);
  for (const rev of [2, 3]) {
    for (const seed of SWING_SEEDS.slice(0, 2)) {
      const witness: any[] = proof.proveSwingSeed(seed, rev) ?? [];
      const byTick = new Map(witness.map((e: any) => [e.t, e]));
      const game = swing.swingGameFor(rev);
      const r = play(game, seed, swing.swingCheckpoint, (_s, t) => {
        const e: any = byTick.get(t);
        return e ? { k: e.k, a: e.a } : null;
      });
      const raw = swingDuel.encodeSwingRun({ seed, claimedScore: r.score, events: r.events, endTick: r.endTick, checkpoints: r.checkpoints });
      record(`swing/${rev}/proof`, seed, r.score, swingDuel.replaySwingRun(seed, raw, rev));
    }
  }
  return out;
}

if (import.meta.main) {
  const root = process.argv[2] ?? process.cwd();
  console.log(JSON.stringify(await legacyDigest(root), null, 1));
}
