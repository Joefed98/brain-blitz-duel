/**
 * Legacy digest for the batch-1 arcade upgrades (Jaywalk, Roofbound, Ball Tracker,
 * Slice): seeded random play on each game's ORIGINAL (unstamped) rules and on its
 * stored revision 2 (keys "<game>/v2", live from 12 Oct 2026), recorded
 * as score + FNV-1a of the final state and of the server replay result. Run against
 * a source root; arcade-batch1-check compares today's code with the digest saved
 * from the code before the upgrades (scripts/fixtures/arcade-batch1-legacy.json),
 * so unstamped rounds provably replay and score exactly as before.
 *
 *   bun scripts/arcade-batch1-legacy.ts <root> > scripts/fixtures/arcade-batch1-legacy.json
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

export const LEGACY_SEEDS = [1, 77, 4242, 90210, 123457];

export async function legacyDigest(root: string): Promise<LegacyRecord[]> {
  const engine = await import(`${root}/src/lib/arcade/engine.ts`);
  const cross = await import(`${root}/src/lib/arcade/cross.ts`);
  const crossDuel = await import(`${root}/src/lib/duel/cross.ts`);
  const flip = await import(`${root}/src/lib/arcade/flip.ts`);
  const flipDuel = await import(`${root}/src/lib/duel/flip.ts`);
  const slice = await import(`${root}/src/lib/arcade/slice.ts`);
  const sliceDuel = await import(`${root}/src/lib/duel/slice.ts`);
  const bt = await import(`${root}/src/lib/arcade/ballTrack.ts`);
  const btDuel = await import(`${root}/src/lib/duel/ballTrack.ts`);
  const bank = (await import(`${root}/src/lib/duel/ballTrackBank.server.ts`)).BALL_TRACK_BANK;

  type Spec = { key: string; game: any; rate: number; encode: (run: any) => string; replay: (seed: number, raw: string) => any };
  const specs: Spec[] = [
    { key: "cross", game: cross.crossGame, rate: 60, encode: crossDuel.encodeCrossRun, replay: (s, r) => crossDuel.replayCrossRun(s, r) },
    { key: "flip", game: flip.flipGame, rate: 40, encode: flipDuel.encodeFlipRun, replay: (s, r) => flipDuel.replayFlipRun(s, r) },
    { key: "slice", game: slice.sliceGame, rate: 300, encode: sliceDuel.encodeSliceRun, replay: (s, r) => sliceDuel.replaySliceRun(s, r) },
    // Revision 2 as stored by rooms from 12 Oct 2026; later revisions must not change these.
    { key: "cross/v2", game: cross.crossGameFor(2), rate: 60, encode: crossDuel.encodeCrossRun, replay: (s, r) => crossDuel.replayCrossRun(s, r, 2) },
    { key: "flip/v2", game: flip.flipGameFor(2), rate: 40, encode: flipDuel.encodeFlipRun, replay: (s, r) => flipDuel.replayFlipRun(s, r, 2) },
    { key: "slice/v2", game: slice.sliceGameFor(2), rate: 300, encode: sliceDuel.encodeSliceRun, replay: (s, r) => sliceDuel.replaySliceRun(s, r, 2) },
  ];
  const out: LegacyRecord[] = [];
  const play = (key: string, game: any, seed: number, rate: number, checkpoint: (s: any) => any, interval: number) => {
    const rand = rng(seed * 31 + key.length);
    const ranges = game.inputRanges ?? [];
    const events: any[] = [];
    const checkpoints: any[] = [];
    let state = game.init(seed);
    while (!game.isOver(state) && state.tick < game.runTicks) {
      const t = state.tick + 1;
      if (rand(1000) < rate && ranges.length) {
        const range = ranges[rand(ranges.length)];
        const pick = (b: readonly [number, number]) => b[0] + rand(b[1] - b[0] + 1);
        engine.recordInput(events, { t, k: range.k, a: pick(range.a), b: pick(range.b), c: pick(range.c), d: pick(range.d) }, ranges);
      }
      state = game.step(state, engine.inputAt(events, t));
      if (state.tick % interval === 0) checkpoints.push(checkpoint(state));
    }
    return { state, events, checkpoints, score: game.score(state) };
  };
  for (const spec of specs) {
    const base = spec.key.split("/")[0];
    const checkpoint = base === "cross" ? cross.crossCheckpoint : base === "flip" ? flip.flipCheckpoint : slice.sliceCheckpoint;
    for (const seed of LEGACY_SEEDS) {
      const run = play(spec.key, spec.game, seed, spec.rate, checkpoint, 300);
      const raw = spec.encode({ seed, claimedScore: run.score, events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints });
      const replay = spec.replay(seed, raw);
      out.push({ game: spec.key, seed, score: run.score, replayScore: replay.score, stateHash: fnv(JSON.stringify(replay.state)) });
    }
  }
  for (const rev of [undefined, 2]) {
    const key = rev ? "balltrack/v2" : "balltrack";
    for (const [index, entry] of bank.slice(0, LEGACY_SEEDS.length).entries()) {
      const game = bt.makeBallTrackGame(entry.course, rev);
      const seed = index + 1;
      // The original rules ignore bottom-row taps; rev 2 turns them into switch points.
      const run = play(key, game, seed, rev ? 60 : 30, bt.btCheckpoint, bt.BT_CHECKPOINT_INTERVAL);
      const raw = btDuel.encodeBallTrackRun(entry.course, { seed, claimedScore: run.score, events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints }, rev);
      const replay = btDuel.replayBallTrackRun(entry.course, seed, raw, rev);
      out.push({ game: key, seed, score: run.score, replayScore: replay.score, stateHash: fnv(JSON.stringify(replay.state)) });
    }
  }
  return out;
}

if (import.meta.main) {
  const root = process.argv[2] ?? process.cwd();
  console.log(JSON.stringify(await legacyDigest(root), null, 1));
}
