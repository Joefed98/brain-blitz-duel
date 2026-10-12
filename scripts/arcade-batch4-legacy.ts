/**
 * Legacy digest for the batch-4 arcade upgrades (Scrumper, Junction, Tilt,
 * High Rise): seeded play on each game's stored rules before the upgrade
 * (unstamped rounds, plus Scrumper's snipRev 2), recorded as score + FNV-1a of
 * the server replay's final state. arcade-batch4-check compares today's code
 * with the digest saved from the code before the upgrades
 * (scripts/fixtures/arcade-batch4-legacy.json), so stored rounds provably
 * replay and score exactly as before.
 *
 *   bun scripts/arcade-batch4-legacy.ts <root> > scripts/fixtures/arcade-batch4-legacy.json
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
  const snip = await import(`${root}/src/lib/arcade/snip.ts`);
  const snipDuel = await import(`${root}/src/lib/duel/snip.ts`);
  const junction = await import(`${root}/src/lib/arcade/junction.ts`);
  const junctionDuel = await import(`${root}/src/lib/duel/junction.ts`);
  const tilt = await import(`${root}/src/lib/arcade/tilt.ts`);
  const tiltDuel = await import(`${root}/src/lib/duel/tilt.ts`);
  const skyline = await import(`${root}/src/lib/arcade/skyline.ts`);
  const skylineDuel = await import(`${root}/src/lib/duel/skyline.ts`);

  const out: LegacyRecord[] = [];
  const record = (game: string, seed: number, score: number, replay: { score: number; state: unknown }) =>
    out.push({ game, seed, score, replayScore: replay.score, stateHash: fnv(JSON.stringify(replay.state)) });

  for (const seed of LEGACY_SEEDS) {
    // Scrumper on the fixed order (unstamped) and on snipRev 2: aimed cuts near the pin.
    for (const rev of [undefined, 2]) {
      const rand = rng(seed * 31 + 3 + (rev ?? 0));
      const game = snip.snipGameFor(rev);
      const events: any[] = [];
      const checkpoints: any[] = [];
      let state = game.init(seed);
      while (!game.isOver(state)) {
        const t = state.tick + 1;
        const alive = state.ropes.map((r: any, i: number) => (r.alive ? i : -1)).filter((i: number) => i >= 0);
        if (alive.length && rand(1000) < 25) {
          const r = state.ropes[alive[rand(alive.length)]];
          const x = Math.round((r.x[0] + r.x[1]) / 512);
          const y = Math.round((r.y[0] + r.y[1]) / 512);
          engine.recordInput(events, { t, k: snip.SNIP_INPUT_CUT, a: x - 15, b: y - 6, c: x + 15, d: y + 6 }, game.inputRanges);
        }
        state = game.step(state, engine.inputAt(events, t));
        if (state.tick % snip.SNIP_CHECKPOINT_INTERVAL === 0) checkpoints.push(snip.snipCheckpoint(state));
      }
      const score = game.score(state);
      const raw = snipDuel.encodeSnipRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints });
      record(rev ? `snip/v${rev}` : "snip", seed, score, snipDuel.replaySnipRun(seed, raw, rev));
    }
    // Junction: flip between the two straight phases on a seeded rhythm, with some stray taps.
    {
      const rand = rng(seed * 31 + 5);
      const game = junction.junctionGame;
      const events: any[] = [];
      const checkpoints: any[] = [];
      let state = game.init(seed);
      let nextSwap = 90;
      while (!game.isOver(state)) {
        const t = state.tick + 1;
        let ev: any = null;
        if (t >= nextSwap) {
          nextSwap = t + 60 + rand(120);
          ev = { t, k: junction.JUNC_INPUT_TAP, a: rand(4), b: 0, c: 0, d: 0 };
        }
        if (ev) engine.recordInput(events, ev, game.inputRanges);
        state = game.step(state, engine.inputAt(events, t));
        if (state.tick % junction.JUNC_CHECKPOINT_INTERVAL === 0) checkpoints.push(junction.juncCheckpoint(state));
      }
      const score = game.score(state);
      const raw = junctionDuel.encodeJunctionRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints });
      record("junction", seed, score, junctionDuel.replayJunctionRun(seed, raw));
    }
    // Tilt: drags that wander left and right.
    {
      const rand = rng(seed * 31 + 7);
      const game = tilt.tiltGame;
      const events: any[] = [];
      const checkpoints: any[] = [];
      let state = game.init(seed);
      let x = 220;
      let touch = 0;
      while (!game.isOver(state)) {
        const t = state.tick + 1;
        if (rand(1000) < 300) {
          if (rand(40) === 0) touch = (touch + 1) % 256;
          x = Math.max(0, Math.min(440, x + rand(41) - 20));
          engine.recordInput(events, { t, k: tilt.TILT_INPUT_DRAG, a: x, b: 0, c: touch, d: 0 }, game.inputRanges);
        }
        state = game.step(state, engine.inputAt(events, t));
        if (state.tick % tilt.TILT_CHECKPOINT_INTERVAL === 0) checkpoints.push(tilt.tiltCheckpoint(state));
      }
      const score = game.score(state);
      const raw = tiltDuel.encodeTiltRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints });
      record("tilt", seed, score, tiltDuel.replayTiltRun(seed, raw));
    }
    // High Rise: drop when lined up within a seeded tolerance.
    {
      const rand = rng(seed * 31 + 11);
      const game = skyline.skylineGame;
      const inputs: number[] = [];
      const checkpoints: any[] = [];
      let state = game.init(seed);
      let tol = 2000;
      while (!game.isOver(state)) {
        const t = state.tick + 1;
        const below = state.blocks[state.blocks.length - 1];
        if (Math.abs(state.x - below.x) <= tol) {
          engine.recordTap(inputs, t);
          tol = 200 + rand(6000);
        }
        state = game.step(state, engine.tapAt(inputs, t));
        if (state.tick % skyline.SKYLINE_CHECKPOINT_INTERVAL === 0) checkpoints.push(skyline.skylineCheckpoint(state));
      }
      const score = game.score(state);
      const raw = skylineDuel.encodeSkylineRun({ seed, claimedScore: score, inputs, endTick: state.tick, checkpoints });
      record("skyline", seed, score, skylineDuel.replaySkylineRun(seed, raw));
    }
  }
  return out;
}

if (import.meta.main) {
  const root = process.argv[2] ?? process.cwd();
  console.log(JSON.stringify(await legacyDigest(root), null, 1));
}
