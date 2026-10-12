/**
 * Legacy digest for the batch-5 arcade upgrades (Swish, Flightpath, Rally,
 * Tempo, Rainbow Bridge, Orbit): seeded play on every revision those games had
 * BEFORE batch 5 (unstamped rounds and each older stamp), recorded as score +
 * FNV-1a of the server replay's final state. arcade-batch5-check compares
 * today's code with the digest saved from the code before the upgrades
 * (scripts/fixtures/arcade-batch5-legacy.json), so stored rounds provably
 * replay and score exactly as before.
 *
 *   bun scripts/arcade-batch5-legacy.ts <root> > scripts/fixtures/arcade-batch5-legacy.json
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

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function legacyDigest(root: string): Promise<LegacyRecord[]> {
  const engine = await import(`${root}/src/lib/arcade/engine.ts`);
  const bin = await import(`${root}/src/lib/arcade/binToss.ts`);
  const binDuel = await import(`${root}/src/lib/duel/binToss.ts`);
  const bull = await import(`${root}/src/lib/arcade/bullseye.ts`);
  const bullDuel = await import(`${root}/src/lib/duel/bullseye.ts`);
  const rally = await import(`${root}/src/lib/arcade/rally.ts`);
  const rallyDuel = await import(`${root}/src/lib/duel/rally.ts`);
  const beat = await import(`${root}/src/lib/arcade/beat.ts`);
  const beatDuel = await import(`${root}/src/lib/duel/beat.ts`);
  const ink = await import(`${root}/src/lib/arcade/inkBridge.ts`);
  const inkDuel = await import(`${root}/src/lib/duel/inkBridge.ts`);
  const orbit = await import(`${root}/src/lib/arcade/orbit.ts`);
  const orbit3 = await import(`${root}/src/lib/arcade/orbitRev3.ts`);
  const orbitDuel = await import(`${root}/src/lib/duel/orbit.ts`);
  const orbitBank = await import(`${root}/src/lib/duel/orbitRev3Bank.server.ts`);

  const out: LegacyRecord[] = [];

  /** Plays a run with a per-tick bot, then records the server replay of its log. */
  const play = (
    name: string,
    seed: number,
    game: any,
    checkpoint: (s: any) => any,
    bot: (state: any, t: number) => any,
    encode: (run: any) => string,
    replay: (raw: string) => any,
  ) => {
    const events: any[] = [];
    const checkpoints: any[] = [];
    let state = game.init(seed);
    while (!game.isOver(state) && state.tick < game.runTicks) {
      const t = state.tick + 1;
      const ev = bot(state, t);
      if (ev) engine.recordInput(events, { ...ev, t }, game.inputRanges);
      state = game.step(state, engine.inputAt(events, t));
      if (state.tick % 300 === 0) checkpoints.push(checkpoint(state));
    }
    const score = game.score(state);
    const raw = encode({ seed, claimedScore: score, events, endTick: state.tick, checkpoints });
    const result = replay(raw);
    out.push({ game: name, seed, score, replayScore: result.score, stateHash: fnv(JSON.stringify(result.state)) });
  };

  for (const seed of LEGACY_SEEDS) {
    // Swish: aim at the bucket with a wind allowance and some error, both bucket revisions.
    for (const rev of [undefined, 2]) {
      const rand = rng(seed * 31 + 3);
      const game = bin.binTossGameFor(rev);
      play(`bintoss/${rev ?? 1}`, seed, game, bin.binTossCheckpoint, (s) => {
        if (s.phase !== bin.BINTOSS_AIM || rand(1000) > 30) return null;
        // Best sideways speed for this bucket and wind (slide ignored), then some error.
        const wind = s.winds[s.throwIndex] ?? 0;
        const centre = bin.binTossCentreAt(s, s.throwIndex, s.tick + 40) / 256;
        let best = 0, err = 1e9;
        for (let vx = 0; vx <= 2_000; vx += 10) {
          const at = bin.binTossPredict(vx, -1_100, wind, bin.binTossWindAcc(s.throwIndex));
          if (Math.abs(at.x - centre) < err) { err = Math.abs(at.x - centre); best = vx; }
        }
        return { k: 1, a: best + rand(60) - 30, b: -1_100, c: 0, d: 0 };
      }, binDuel.encodeBinTossRun, (raw) => binDuel.replayBinTossRun(seed, raw, rev));
    }
    // Flightpath: shots near the centre with wind correction and noise.
    {
      const rand = rng(seed * 31 + 5);
      const winds = bull.bullseyeWinds(seed);
      const game = { ...bull.bullseyeGame, init: (s: number) => bull.bullseyeInit(s, winds) };
      play("bullseye", seed, game, bull.bullseyeCheckpoint, (s) => {
        if (s.flightTick > 0 || rand(1000) > 25) return null;
        const w = bull.bullseyeWindShiftPx(s.arrowIndex, s.winds[s.arrowIndex] ?? 0);
        return { k: 2, a: Math.round((-w + rand(30) - 15) * 1920 / 282), b: -1_920 + rand(160) - 80, c: 0, d: 0 };
      }, bullDuel.encodeBullseyeRun, (raw) => bullDuel.replayBullseyeRun(seed, raw, winds));
    }
    // Rally: chase the lowest ball with lag and jitter.
    {
      const rand = rng(seed * 31 + 7);
      play("rally", seed, rally.rallyGame, rally.rallyCheckpoint, (s) => {
        if (rand(1000) > 300) return null;
        let target = s.x;
        for (const g of s.golds) if (g.vy > 0 && g.y > s.y) target = g.x;
        return { k: engine.ARCADE_INPUT_DRAG, a: Math.round(target / 256) + rand(40) - 20, b: 0, c: 0, d: 0 };
      }, rallyDuel.encodeRallyRun, (raw) => rallyDuel.replayRallyRun(seed, raw));
    }
    // Tempo: taps near each note, holds released near the tail, some strays.
    {
      const rand = rng(seed * 31 + 11);
      play("beat", seed, beat.beatGame, beat.beatCheckpoint, (s, t) => {
        for (let lane = 0; lane < 4; lane++) {
          const h = s.holding[lane];
          if (h >= 0 && t >= s.chart.ticks[h] + s.chart.holds[h] - 2 + rand(5)) return { k: 10, a: lane, b: 0, c: 0, d: 0 };
        }
        for (let i = s.cursor; i < s.chart.ticks.length && s.chart.ticks[i] <= t + 12; i++) {
          if (s.judged[i] !== 0) continue;
          if (t >= s.chart.ticks[i] - 6 + rand(9) && rand(10) > 0) return { k: 9, a: s.chart.lanes[i], b: 0, c: 0, d: 0 };
        }
        return rand(1000) < 5 ? { k: 9, a: rand(4), b: 0, c: 0, d: 0 } : null;
      }, beatDuel.encodeBeatRun, (raw) => beatDuel.replayBeatRun(seed, raw));
    }
    // Rainbow Bridge: draw each level's reference line (sometimes nudged) and release on its tick.
    for (const rev of [undefined, 2, 3]) {
      const rand = rng(seed * 31 + 13);
      const game = ink.inkBridgeGameFor(rev);
      let queue: any[] = [];
      let planned = -1;
      play(`inkbridge/${rev ?? 1}`, seed, game, ink.inkCheckpoint, (s) => {
        if (s.dropping) {
          if (!queue.length) return null;
          const next = queue[0];
          if (s.dropTicks < next.after) return null;
          queue.shift();
          return next.ev;
        }
        const key = s.level * 10 + s.fails;
        if (planned !== key) {
          planned = key;
          const lvl = s.list[s.level];
          const nudge = rand(3) === 0 ? rand(40) - 20 : 0;
          queue = [];
          for (const pts of lvl.ref) {
            queue.push({ ev: { k: 8, a: pts[0] + nudge, b: pts[1], c: 1, d: 0 } });
            for (let i = 2; i < pts.length; i += 2) queue.push({ ev: { k: 8, a: pts[i] + nudge, b: pts[i + 1], c: 0, d: 0 } });
          }
          queue.push({ release: lvl, ev: { k: 13, a: 1, b: 0, c: 0, d: 0 } });
          for (const live of lvl.liveRef ?? []) {
            queue.push({ after: live.tick, ev: { k: 8, a: live.pts[0], b: live.pts[1], c: 1, d: 0 } });
            for (let i = 2; i < live.pts.length; i += 2) queue.push({ after: live.tick, ev: { k: 8, a: live.pts[i], b: live.pts[i + 1], c: 0, d: 0 } });
            queue.push({ after: live.tick, ev: { k: 17, a: 1, b: 0, c: 0, d: 0 } });
          }
        }
        const next = queue[0];
        if (!next) return null;
        if (next.release) {
          const lvl = next.release;
          if (lvl.slideAmp && (s.tick + 1 - (lvl.refT0 + 1)) % lvl.slidePeriod !== 0) return null;
        }
        queue.shift();
        return next.ev;
      }, inkDuel.encodeInkBridgeRun, (raw) => inkDuel.replayInkBridgeRun(seed, raw, rev));
    }
    // Orbit legacy course: random taps and one checkpoint.
    {
      const rand = rng(seed * 31 + 17);
      play("orbit/1", seed, orbit.orbitGame, orbit.orbitCheckpoint, (s) => {
        if (s.flying === 0 && s.checkpoint < 0 && s.cur >= 2) return { k: 1, a: 0, b: 0, c: 0, d: 0 };
        return rand(1000) < 25 ? { k: 0, a: 0, b: 0, c: 0, d: 0 } : null;
      }, orbitDuel.encodeOrbitRun, (raw) => orbitDuel.replayOrbitRun(seed, raw));
    }
    // Orbit rev 3: a bank course played with its proof taps (a finish), then shifted taps.
    for (const shift of [0, 3]) {
      const bank = orbitBank.ORBIT_REV3_BANK;
      const entry = bank[seed % bank.length];
      const planets = orbit3.decodeRev3Planets(entry.planets);
      const game = { ...orbit3.orbitRev3Game, init: () => orbit3.initRev3From(planets, orbit3.ORBIT_REV3_WORLD_W) };
      const taps = new Set(entry.taps.map((t: number) => t + shift));
      play(`orbit/3+${shift}`, entry.seed, game, orbit.orbitCheckpoint, (s, t) => {
        if (s.flying === 0 && s.checkpoint < 0 && s.cur === 5) return { k: 1, a: 0, b: 0, c: 0, d: 0 };
        return taps.has(t) ? { k: 0, a: 0, b: 0, c: 0, d: 0 } : null;
      }, orbitDuel.encodeOrbitRun, (raw) => orbitDuel.replayOrbitRun(entry.seed, raw, 3, entry.planets));
    }
  }
  return out;
}

if (import.meta.main) {
  const root = process.argv[2] ?? process.cwd();
  console.log(JSON.stringify(await legacyDigest(root), null, 1));
}
