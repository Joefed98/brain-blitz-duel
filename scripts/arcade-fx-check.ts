/**
 * Shared arcade success layer + art pipeline checks (presentation only).
 *
 *  1. All 23 arcade games with a world (22 active with Pinball; Junction practice only): seeded random inputs, every frame drawn through
 *     the game's real renderer (which now runs the shared effects layer). Drawing
 *     must never change state (deep-equal before/after every draw), and the run
 *     with drawing must end in exactly the state of the same run without drawing.
 *     Every declared success event reads finite counters, and the per-canvas
 *     particle/pop caps hold on every frame.
 *  2. The effect director: first frame never fires, counters fire on rise only,
 *     every/min/minDelta/when gates, rewind resets, caps under spam, shake only
 *     where allowed, nothing moves under reduced motion, the world draw runs once.
 *  3. The art pipeline: one CC0 pack per world, missing art draws nothing and
 *     returns false (code art fallback), registered art fills exactly the given
 *     rectangle (bounds rule) and sheet frames select their own rectangle.
 *
 *   bun scripts/arcade-fx-check.ts
 */
import assert from "node:assert/strict";
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

let clock = 10_000;
let reduced = false;
Object.defineProperty(globalThis, "performance", {
  configurable: true,
  value: { now: () => clock },
});
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    matchMedia: () => ({
      get matches() {
        return reduced;
      },
      addEventListener() {},
      removeEventListener() {},
    }),
    devicePixelRatio: 2,
  },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined")
  Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const { inputAt, recordInput } = await import("../src/lib/arcade/engine");
const fx = await import("../src/lib/arcade/arcadeFx.renderer");
const specs = await import("../src/lib/arcade/arcadeFxGames.renderer");
const sprites = await import("../src/lib/arcade/sprites.renderer");

const { hoverArtGame } = await import("../src/lib/arcade/hover.renderer");
const { hoverExpandGame } = await import("../src/lib/arcade/hover");
const { breakerArtGameFor } = await import("../src/lib/arcade/breaker.renderer");
const { pinballArtGame } = await import("../src/lib/arcade/pinball.renderer");
const { rallyArtGame } = await import("../src/lib/arcade/rally.renderer");
const { rallyRev2Game } = await import("../src/lib/arcade/rally");
const { BRK_REV_DEEP } = await import("../src/lib/arcade/breaker");
const { rallyGameFor, RALLY_REV_CURVE } = await import("../src/lib/arcade/rally");
const { BURST_REV_CLEAN } = await import("../src/lib/arcade/burst");
const { beatArtGame } = await import("../src/lib/arcade/beat.renderer");
const { beatRev2Game } = await import("../src/lib/arcade/beat");
const { snakeArtGame } = await import("../src/lib/arcade/snake.renderer");
const { snakeRev3Game } = await import("../src/lib/arcade/snake");
const { burstArtGameFor } = await import("../src/lib/arcade/burst.renderer");
const { wavefrontArtGameFor } = await import("../src/lib/arcade/wavefront.renderer");
const { orbitArtGame } = await import("../src/lib/arcade/orbit.renderer");
const { skylineArtGame } = await import("../src/lib/arcade/skyline.renderer");
const { skylineRev2Game } = await import("../src/lib/arcade/skyline");
const { crossArtGameFor } = await import("../src/lib/arcade/cross.renderer");
const { junctionRev2ArtGame: junctionArtGame } = await import("../src/lib/arcade/junction.renderer");
const { inkBridgeArtGameFor } = await import("../src/lib/arcade/inkBridge.renderer");
const { sliceArtGameFor } = await import("../src/lib/arcade/slice.renderer");
const { binTossArtGame } = await import("../src/lib/arcade/binTossArt.renderer");
const { binTossGameFor } = await import("../src/lib/arcade/binToss");
const { drawBullseye } = await import("../src/lib/arcade/bullseye.renderer");
const { bullseyeGame, bullseyeRev2Game } = await import("../src/lib/arcade/bullseye");
const { bubbleArtGame } = await import("../src/lib/arcade/bubble.renderer");
const { bubbleRev2Game } = await import("../src/lib/arcade/bubble");
const { flipArtGameFor } = await import("../src/lib/arcade/flipArt.renderer");
const { swingArtGameFor } = await import("../src/lib/arcade/swing.renderer");
const { SWING_V13_BANK } = await import("../src/lib/duel/swingBankV13.server");
const { snipArtGame } = await import("../src/lib/arcade/snip.renderer");
const { snipRev3Game } = await import("../src/lib/arcade/snip");
const { tiltRev2ArtGame: tiltArtGame } = await import("../src/lib/arcade/tiltArt.renderer");
const { btArtDraw } = await import("../src/lib/arcade/ballTrackArt.renderer");
const { makeBallTrackGame } = await import("../src/lib/arcade/ballTrack");
const { BALL_TRACK_BANK } = await import("../src/lib/duel/ballTrackBank.server");
const { matchupArtGame } = await import("../src/lib/arcade/matchup.renderer");
const { matchupRev2Game } = await import("../src/lib/arcade/matchup");

type AnyGame = {
  init: (seed: number) => any;
  step: (state: any, input: any) => any;
  isOver: (state: any) => boolean;
  draw: (
    ctx: CanvasRenderingContext2D,
    state: any,
    size: { width: number; height: number },
  ) => void;
  inputRanges?: readonly {
    k: number;
    a: readonly [number, number];
    b: readonly [number, number];
    c: readonly [number, number];
  }[];
};

const course = BALL_TRACK_BANK[0]!.course;
const btGame = makeBallTrackGame(course, 2);
const GAMES: Record<string, AnyGame> = {
  // hoverRev 9 (the 200 expansion): the course rooms deal, so the new moments fire on real states too.
  hover: { ...hoverArtGame, init: hoverExpandGame.init } as AnyGame,
  // Expansion E3: rooms deal brkRev 9 (ARCADE_FX_SPECS lists its 420 × 784 spec).
  breaker: breakerArtGameFor(BRK_REV_DEEP) as AnyGame,
  // Expansion E9: rooms deal rallyRev 10 (ARCADE_FX_SPECS lists its 420 × 784 spec) and burstRev 8; rallyRev 11 since the phone notes (27 Oct 2026).
  rally: { ...rallyGameFor(RALLY_REV_CURVE), draw: rallyArtGame.draw } as AnyGame,
  beat: { ...beatArtGame, init: beatRev2Game.init } as AnyGame,
  snake: { ...snakeArtGame, init: snakeRev3Game.init } as AnyGame,
  burst: burstArtGameFor(BURST_REV_CLEAN) as AnyGame,
  wavefront: wavefrontArtGameFor(2) as AnyGame,
  orbit: orbitArtGame as AnyGame,
  skyline: { ...skylineArtGame, init: skylineRev2Game.init } as AnyGame,
  // The revision rooms deal (crossRev 9, x200: the island, coins and streak events too).
  cross: crossArtGameFor(9) as AnyGame,
  junction: junctionArtGame as AnyGame,
  inkbridge: inkBridgeArtGameFor(10) as AnyGame, // inkRev 10 (x200): the taller world rooms deal, its spec ARCADE_FX_SPECS.inkbridge
  slice: sliceArtGameFor(2) as AnyGame,
  bintoss: { ...binTossArtGame, init: binTossGameFor(3).init } as AnyGame,
  bullseye: { ...bullseyeGame, init: bullseyeRev2Game.init, draw: drawBullseye } as AnyGame,
  bubble: { ...bubbleArtGame, init: bubbleRev2Game.init } as AnyGame,
  // Roofbound's expansion (flipRev 8, docs/expansions/x200-flip.md) is the live spec.
  flip: flipArtGameFor(8) as AnyGame,
  // Grappler's live spec is the assault course's (SWING_FX_V14: swingRev 13's events, then swingRev 14's own). Its first
  // eleven events fire on a rev-13 state (the bank course, every feature on it); the last five on a rev-14 one (BUMPS).
  swing: { ...swingArtGameFor(13), init: () => swingArtGameFor(13).init(SWING_V13_BANK[0]!.seed) } as AnyGame,
  snip: { ...snipArtGame, init: snipRev3Game.init } as AnyGame,
  tilt: tiltArtGame as AnyGame,
  balltrack: {
    ...btGame,
    draw: (ctx: CanvasRenderingContext2D, s: any) => btArtDraw(ctx, course, s, btGame.rotatable),
  } as AnyGame,
  matchup: { ...matchupArtGame, init: matchupRev2Game.init } as AnyGame,
  pinball: pinballArtGame as AnyGame,
};

assert.equal(Object.keys(GAMES).length, 23, "23 arcade games with a world (21 active with Pinball; Junction and Scrumper practice only)");
assert.deepEqual(
  Object.keys(GAMES).sort(),
  Object.keys(specs.ARCADE_FX_SPECS).sort(),
  "one fx spec per game",
);

let checks = 0;
function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded candidate inputs, sanitised exactly as the phone records them. */
function inputsFor(game: AnyGame, seed: number, ticks: number) {
  const r = rng(seed);
  const events: any[] = [];
  const ranges = game.inputRanges ?? [];
  for (let t = 1; t <= ticks; t++) {
    if (r() > 0.12) continue;
    if (ranges.length) {
      const range = ranges[Math.floor(r() * ranges.length)]!;
      const pick = (span: readonly [number, number]) =>
        Math.round(span[0] + r() * (span[1] - span[0]));
      recordInput(
        events,
        { t, k: range.k, a: pick(range.a), b: pick(range.b), c: pick(range.c), d: 0 },
        game.inputRanges as never,
      );
    } else events.push({ t, k: 1, a: 0, b: 0, c: 0, d: 0 });
  }
  return events;
}

function inputOf(game: AnyGame, events: any[], tick: number) {
  if (game.inputRanges?.length) return inputAt(events, tick);
  return events.some((e) => e.t === tick);
}

const TICKS = 900;
const summary: string[] = [];
for (const [name, game] of Object.entries(GAMES)) {
  const spec = (specs.ARCADE_FX_SPECS as Record<string, any>)[name];
  const canvas = createCanvas(390, 620);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  const fired = spec.events.map(() => 0);
  let missed = 0;
  let last: number[] | null = null;
  let lastMiss: number[] | null = null;
  for (const seed of [11, 4242]) {
    const events = inputsFor(game, seed * 7 + name.length, TICKS);
    let drawn = game.init(seed);
    let plain = game.init(seed);
    for (let tick = 1; tick <= TICKS && !game.isOver(drawn); tick++) {
      const input = inputOf(game, events, tick);
      drawn = game.step(drawn, input);
      plain = game.step(plain, input);
      const before = JSON.stringify(drawn);
      clock += 1000 / 60;
      game.draw(ctx, drawn, { width: 390, height: 620 });
      assert.equal(JSON.stringify(drawn), before, `${name}: drawing changed state at tick ${tick}`);
      const counts = spec.events.map((e: any) => e.count(drawn));
      for (const c of counts) assert.ok(Number.isFinite(c), `${name}: non-finite counter`);
      if (last)
        counts.forEach((c: number, i: number) => {
          if (c > last![i]!) fired[i] += 1;
        });
      last = counts;
      const misses = (spec.misses ?? []).map((m: any) => m.count(drawn));
      for (const c of misses) assert.ok(Number.isFinite(c), `${name}: non-finite miss counter`);
      if (lastMiss && misses.some((c: number, i: number) => c > lastMiss![i]!)) {
        missed += 1;
        assert.ok(fx.arcadeFxMissStats(ctx, spec.game).pulse, `${name}: a miss starts the red edge pulse`);
      }
      lastMiss = misses;
      const stats = fx.arcadeFxStats(ctx, spec.game);
      assert.ok(stats.particles <= fx.ARCADE_FX_MAX_PARTICLES, `${name}: particle cap`);
      assert.ok(stats.pops <= fx.ARCADE_FX_MAX_POPS, `${name}: pop cap`);
      checks += 3;
    }
    assert.equal(
      JSON.stringify(plain),
      JSON.stringify(drawn),
      `${name}: run with drawing diverged from run without`,
    );
    last = null;
    lastMiss = null;
    checks++;
  }
  summary.push(
    `${name} [${spec.world}] rises ${spec.events.map((e: any, i: number) => `${e.kind}:${fired[i]}`).join(" ")} miss:${missed}`,
  );
}

/* ------------- Every declared event fires through its real renderer ------------- */
// For each event: take a real mid-run state, bump the counter the event reads
// (a copy; the sim never sees it) and draw. The effect must fire and the draw
// must complete. Index order matches each spec's `events`.
const zeros = (n: number) => Array.from({ length: n }, () => 0);
/** A swingRev 14 state 120 ticks in (the base every other game's bumps start from is that far in too). */
let assaultBase: any = null;
function assaultAt(): any {
  if (!assaultBase) {
    const g = swingArtGameFor(14);
    let st: any = g.init(5);
    for (let t = 0; t < 120; t++) st = g.step(st, null);
    assaultBase = st;
  }
  return assaultBase;
}
const BUMPS: Record<string, ((s: any) => any)[]> = {
  hover: [
    (s) => ({ ...s, gates: s.gates + 1 }),
    (s) => ({ ...s, gates: s.gates + 7 }),
    (s) => ({ ...s, stars: (s.stars ?? 0) + 1 }),
    (s) => ({ ...s, gates: 17 }),
    (s) => ({ ...s, gates: 24 }),
    (s) => ({ ...s, gates: s.totalGates }),
    // hoverRev 9: a tight gate, a whole star chain, a shield picked up, a centre line graded.
    (s) => ({ ...s, tight: (s.tight ?? 0) + 1 }),
    (s) => ({ ...s, chainsDone: (s.chainsDone ?? 0) + 1 }),
    (s) => ({ ...s, pickupsTaken: [...(s.pickupsTaken ?? []), 0] }),
    (s) => ({ ...s, ctrLog: [...(s.ctrLog ?? []), 4 * 4 + 3], ctrPts: (s.ctrPts ?? 0) + 3 }),
  ],
  // brkRev 9: a 9-column wall (gold bricks apart), then the gold-brick and combo moments.
  breaker: [
    (s) => ({ ...s, powerUps: s.powerUps + 1 }),
    (s) => ({ ...s, bricks: s.bricks.map((b: number, i: number) => (i < 20 ? 0 : b)) }),
    (s) => ({ ...s, fireballs: (s.fireballs ?? 0) + 1, fire: 300 }),
    (s) => ({ ...s, bricks: s.bricks.map((b: number, i: number) => (Math.trunc(i / 9) === (s.slide ?? [4])[0] && i % 9 === 0 ? 0 : b)) }),
    (s) => ({
      ...s,
      bricks: s.bricks.map((b: number, i: number) => (i >= s.bricks.length - 9 ? 0 : b)),
    }),
    (s) => ({ ...s, cleared: true }),
    (s) => ({ ...s, goldBroken: (s.goldBroken ?? 0) + 1 }),
    (s) => ({ ...s, comboUps: (s.comboUps ?? 0) + 1, chain: 8 }),
  ],
  rally: [
    (s) => ({ ...s, hits: s.hits + 10 }),
    (s) => ({ ...s, goldHits: s.goldHits + 1 }),
    (s) => ({ ...s, targetHits: (s.targetHits ?? 0) + 1, struckLeft: 60, struckTick: s.tick + 1 }),
    (s) => ({ ...s, bounces: (s.bounces ?? 0) + 1 }),
    (s) => ({ ...s, hits: s.hits + 1 }),
    // rallyRev 10: a gold bonus target struck.
    (s) => ({ ...s, bonusHit: (s.bonusHit ?? 0) | 1, bonusAt: s.tick + 1 }),
  ],
  beat: [(s) => ({ ...s, combo: s.combo + 10 }), (s) => ({ ...s, swipesHit: (s.swipesHit ?? 0) + 1, lastLane: 2 }), (s) => ({ ...s, maxCombo: s.chart.ticks.length })],
  snake: [
    (s) => ({ ...s, eaten: s.eaten + 10 }),
    (s) => ({ ...s, dead: false, rocks: [...(s.rocks ?? []), 2 * 15 + 2] }),
    (s) => ({ ...s, dead: false, showerDone: 1, showerWarn: [...(s.showerCells ?? [])], showerLandTick: s.tick + 120 }),
    (s) => ({ ...s, dead: false, showerDone: 1, rocks: [...(s.rocks ?? []), ...(s.showerCells ?? [])] }),
    (s) => ({ ...s, eaten: s.queue.length }),
  ],
  burst: [
    (s) => ({ ...s, cleared: s.cleared + 1 }),
    (s) => ({ ...s, freezes: (s.freezes ?? 0) + 1, freeze: 180 }),
    (s) => ({ ...s, ended: 1, lives: 3, cleared: 4 }),
    // burstRev 8: a golden atom taken, a clean wave.
    (s) => ({ ...s, goldHit: (s.goldHit ?? 0) | 1, goldAt: s.tick + 1 }),
    (s) => ({ ...s, cleanWaves: (s.cleanWaves ?? 0) + 1 }),
  ],
  wavefront: [
    (s) => ({ ...s, saucers: s.saucers + 1 }),
    (s) => ({ ...s, wavesCleared: s.wavesCleared + 1 }),
    (s) => ({ ...s, diversDown: (s.diversDown ?? 0) + 1 }),
    (s) => ({ ...s, boss: s.boss ?? { x: 131, dir: 1, hp: 30, fireIn: 60 }, bossHits: (s.bossHits ?? 0) + 6 }),
    (s) => ({ ...s, bossKilled: 1 }),
  ],
  orbit: [(s) => ({ ...s, best: s.best + 10 }), (s) => ({ ...s, finished: 1 })],
  skyline: [
    (s) => ({ ...s, perfects: s.perfects + 1 }),
    (s) => ({ ...s, placed: s.placed + 10 }),
    (s) => ({ ...s, streak: 3, streakPoints: (s.streakPoints ?? 0) + 1 }),
    (s) => ({ ...s, placed: Math.max(s.placed, 20) }),
    (s) => ({ ...s, gustPerfects: (s.gustPerfects ?? 0) + 1 }),
  ],
  cross: [
    (s) => ({ ...s, crossings: s.crossings + 1 }),
    (s) => ({ ...s, crossings: 3, reached: 0 }),
    (s) => ({ ...s, crossings: 4, reached: 0 }),
    (s) => ({ ...s, coinTotal: (s.coinTotal ?? 0) + 1 }),
    (s) => ({ ...s, reached: 7, lane: 7, banked: 1 }),
    (s) => ({ ...s, streak: 2, streakPts: (s.streakPts ?? 0) + 2 }),
    (s) => ({ ...s, closeCalls: (s.closeCalls ?? 0) + 1 }),
  ],
  junction: [
    (s) => ({ ...s, ambThrough: s.ambThrough + 1 }),
    (s) => ({ ...s, cleared: s.cleared + 10 }),
    (s) => ({ ...s, tick: Math.max(s.tick, 721) }),
    (s) => ({ ...s, busCleared: (s.busCleared ?? 0) + 1 }),
    (s) => ({ ...s, diagCleared: (s.diagCleared ?? 0) + 5 }),
  ],
  inkbridge: [(s) => ({ ...s, levels: s.levels + 1 }), (s) => ({ ...s, stars: (s.stars ?? 0) + 1 }), (s) => ({ ...s, levels: 10 }), (s) => ({ ...s, tricks: (s.tricks ?? 0) + 1 }), (s) => ({ ...s, shamrocks: (s.shamrocks ?? 0) + 1 })],
  slice: [
    (s) => ({ ...s, comboLive: 1, streak: 2 }),
    (s) => ({ ...s, frenzyFrom: [...s.frenzyFrom, s.tick] }),
    (s) => ({ ...s, slowFrom: [...s.slowFrom, s.tick] }),
    (s) => ({ ...s, slices: s.slices + 25 }),
    (s) => ({ ...s, mayo: [...(s.mayo ?? []), s.tick, 195, 300] }),
    (s) => ({ ...s, slices: s.slices + 5 }),
  ],
  bintoss: [
    (s) => ({ ...s, results: [...s.results, 1, 1, 1] }),
    (s) => ({ ...s, swishes: (s.swishes ?? 0) + 1 }),
    (s) => ({ ...s, spinBaskets: (s.spinBaskets ?? 0) + 1 }),
    (s) => ({ ...s, baskets: 10 }),
  ],
  bullseye: [
    (s) => ({
      ...s,
      flightTick: 0,
      hits: [...s.hits, { x: 195, y: 224, ring: 0, value: 10, arrow: 0 }],
    }),
    (s) => ({ ...s, flightTick: 0, hits: [...s.hits, { x: 195, y: 224, ring: 0, value: 12, arrow: 0, bull: 1, pop: 0 }] }),
    (s) => ({ ...s, flightTick: 0, hits: [...s.hits, { x: 120, y: 160, ring: -1, value: 12, arrow: 2, bull: 0, pop: 1 }] }),
    (s) => ({
      ...s,
      flightTick: 0,
      hits: [
        ...s.hits,
        { x: 195, y: 224, ring: 0, value: 10, arrow: 0 },
        { x: 195, y: 224, ring: 0, value: 10, arrow: 1 },
      ],
    }),
    (s) => ({
      ...s,
      flightTick: 0,
      hits: zeros(10).map((_, i) => ({ x: 195, y: 224, ring: 2, value: 8, arrow: i })),
    }),
  ],
  bubble: [
    (s) => ({ ...s, popped: s.popped + 6 }),
    (s) => ({ ...s, dropped: s.dropped + 4 }),
    (s) => ({ ...s, jokers: (s.jokers ?? 0) + 1, lastSpecialCell: 13 }),
    (s) => ({ ...s, bombs: (s.bombs ?? 0) + 1, lastSpecialCell: 13, lastSpecialCleared: 5 }),
    (s) => ({ ...s, lines: (s.lines ?? 0) + 1, lastSpecialCell: 13, lastSpecialCleared: 8 }),
    (s) => ({ ...s, cleared: true }),
  ],
  flip: [
    (s) => ({ ...s, tick: s.tick + 600 }),
    (s) => ({ ...s, ended: 1 }),
    (s) => ({ ...s, got: (s.got ?? 0) | 1 }),
    (s) => ({ ...s, got: 1023 }),
    (s) => ({ ...s, cracks: [0, s.tick - 30] }),
    // flipRev 8 (the rooms' revision since 26 Oct 2026): trail star, full trail, double flip, checkpoint, save, speed zone, sweet landing.
    (s) => ({ ...s, trailGot: [1, 0, 0, 0] }),
    (s) => ({ ...s, trailGot: [31, 0, 0, 0] }),
    (s) => ({ ...s, combos: (s.combos ?? 0) + 1, chain: 1 }),
    (s) => ({ ...s, cpPassed: (s.cpPassed ?? 0) + 1 }),
    (s) => ({ ...s, saves: (s.saves ?? 0) + 1 }),
    (s) => ({ ...s, tick: s.v8.zones[0] + 1 }),
    (s) => ({ ...s, sweetGot: (s.sweetGot ?? 0) | 1, sweetT: s.tick }),
  ],
  swing: [
    (s) => ({ ...s, maxX: s.maxX + 100 * 256 * 40 }),
    (s) => ({ ...s, stars: (s.stars ?? 0) + 1 }),
    (s) => ({ ...s, rocks: (s.rocks ?? []).map((r: any, i: number) => (i === 0 ? { ...r, phase: 3 } : r)) }),
    (s) => ({ ...s, x: (s.jets?.[0]?.x ?? 0) + 40 * 256 }),
    (s) => ({ ...s, ended: 1, maxX: s.maxX + 600 * 256 * 40 }),
    // swingRev 13: a gem, a lit gate, a ledge landed, a combo point, a section cleared, a section under par.
    (s) => ({ ...s, gemsTaken: (s.gemsTaken ?? 0) | 1 }),
    (s) => ({ ...s, gatesLit: (s.gatesLit ?? 0) | 1 }),
    (s) => ({ ...s, ledgeTicks: (s.ledgeTicks ?? []).map((t: number, i: number) => (i === 0 ? s.tick : t)) }),
    (s) => ({ ...s, comboPts: (s.comboPts ?? 0) + 2, comboTiers: (s.comboTiers ?? 0) + 1, chain: 5 }),
    (s) => ({ ...s, ledgeTicks: (s.ledges ?? []).map((l: any, i: number) => (l.section === 0 ? s.tick : (s.ledgeTicks ?? [])[i] ?? 0)) }),
    (s) => ({ ...s, ledgeTicks: (s.ledges ?? []).map((l: any, i: number) => (l.section === 1 ? (l.kind === 0 ? Math.max(1, s.tick - 60) : s.tick) : (s.ledgeTicks ?? [])[i] ?? 0)) }),
    // swingRev 14 (the assault course), on a rev-14 state at the same tick: a gate lit, a gem, a star, a section cleared
    // (its landing a few ticks before its par runs out), the course cleared.
    () => ({ ...assaultAt(), gatesLit: 1 }),
    () => ({ ...assaultAt(), gemsTaken: 1 }),
    () => ({ ...assaultAt(), starsTaken: [0], stars: 1 }),
    () => ({ ...assaultAt(), sec: 1, secTicks: assaultAt().secTicks.map((t: number, i: number) => (i === 0 ? 100 : t)) }),
    () => ({ ...assaultAt(), sec: assaultAt().sections.length }),
  ],
  snip: [
    (s) => ({ ...s, stars: s.stars + 1 }),
    (s) => ({ ...s, eaten: s.eaten + 1 }),
    (s) => ({ ...s, eaten: 10 }),
    (s) => ({ ...s, springHits: (s.springHits ?? 0) + 1 }),
    // snipRev 11: a golden apple fed, a ring's catch, a level quick and clean.
    (s) => ({ ...s, golden: (s.golden ?? 0) + 1 }),
    (s) => ({ ...s, ringed: 1, ringTick: s.tick }),
    (s) => ({ ...s, quickLevels: (s.quickLevels ?? 0) + 1 }),
  ],
  tilt: [
    (s) => ({ ...s, mazes: s.mazes + 1 }),
    (s) => ({ ...s, mazes: 4 }),
    (s) => ({ ...s, stars: (s.stars ?? 0) + 1 }),
    (s) => ({ ...s, b: { x: s.x, y: s.y, vx: 0, vy: 0 }, aHome: 1, bHome: 0 }),
  ],
  balltrack: [
    (s) => ({ ...s, home: s.home + 5 }),
    (s) => ({ ...s, home: 30 }),
    (s) => ({ ...s, rideHomes: (s.rideHomes ?? 0) + 1 }),
    (s) => ({ ...s, switchHomes: (s.switchHomes ?? 0) + 1 }),
  ],
  pinball: [
    (s) => ({ ...s, bumps: s.bumps + 1, bumperAt: [s.tick + 1, -999, -999] }),
    (s) => ({ ...s, drops: s.drops + 1, targets: s.targets | 2 }),
    (s) => ({ ...s, banks: s.banks + 1, targets: 15 }),
    (s) => ({ ...s, laneLights: s.laneLights + 1, lanes: 1 }),
    (s) => ({ ...s, laneSets: s.laneSets + 1, mult: 2 }),
    (s) => ({ ...s, spins: s.spins + 9 }),
  ],
  matchup: [
    (s) => ({ ...s, cascades: s.cascades + 1, lastSteps: 3 }),
    (s) => ({ ...s, bestLine: 5 }),
    (s) => ({ ...s, jackpots: (s.jackpots ?? 0) + 1 }),
    (s) => ({ ...s, jackpotsFired: (s.jackpotsFired ?? 0) + 1 }),
    (s) => ({ ...s, raw: 1e6 }),
  ],
};
for (const [name, game] of Object.entries(GAMES)) {
  const spec = (specs.ARCADE_FX_SPECS as Record<string, any>)[name];
  const bumps = BUMPS[name]!;
  assert.equal(bumps.length, spec.events.length, `${name}: one bump per declared event`);
  let base = game.init(5);
  for (let t = 0; t < 120 && !game.isOver(base); t++)
    base = game.step(base, game.inputRanges?.length ? null : false);
  spec.events.forEach((event: any, i: number) => {
    const canvas = createCanvas(390, 620);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    const frozen = JSON.stringify(base);
    game.draw(ctx, base, { width: 390, height: 620 });
    const bumped = { ...bumps[i]!(base), tick: Math.max(base.tick + 1, bumps[i]!(base).tick) };
    assert.ok(
      event.count(bumped) > event.count(base),
      `${name} event ${i} (${event.kind}): bump raises its counter`,
    );
    clock += 1000 / 60;
    game.draw(ctx, bumped, { width: 390, height: 620 });
    const stats = fx.arcadeFxStats(ctx, spec.game);
    assert.ok(
      stats.particles + stats.pops + stats.rings > 0 || !!stats.bulbs,
      `${name} event ${i} (${event.kind}): effect fired`,
    );
    if (event.bulbs) {
      assert.equal(stats.bulbs, event.bulbs.pattern, `${name} event ${i} (${event.kind}): border lights fired`);
      checks += 1;
    }
    if (event.lights?.length) {
      assert.ok(stats.lights > 0, `${name} event ${i} (${event.kind}): light burst fired`);
      assert.ok(stats.lights <= fx.ARCADE_FX_MAX_LIGHTS, `${name}: light cap`);
      checks += 2;
    }
    assert.equal(JSON.stringify(base), frozen, `${name}: drawing changed state`);
    checks += 3;
  });
}

/* ------------------------ Tuning D success effects ------------------------ */
// Breaker: every success text is slightly smaller and, while it is up, the arena glows cool white and blue.
// Fission (wave clear): cool purple, green and blue lights (Polish G: Fission's alone).
{
  for (const event of specs.BREAKER_FX.events) {
    assert.ok(event.textScale !== undefined && event.textScale < 1 && event.textScale >= 0.75, `breaker ${event.kind}: slightly smaller text`);
    assert.deepEqual(event.arenaGlow, specs.BREAKER_ARENA_GLOW, `breaker ${event.kind}: cool arena glow`);
    checks += 2;
  }
  const burstClear = specs.BURST_FX.events.find((e) => e.kind === "clear");
  assert.deepEqual(burstClear?.lights, specs.COOL_LIGHTS, "fission: cool lights on a wave clear");
  checks += 1;
  // Light bursts: capped, short, and they glow in place without moving under reduced motion.
  const c = createCanvas(390, 620).getContext("2d") as unknown as CanvasRenderingContext2D;
  const lit: Parameters<typeof fx.arcadeFx<{ tick: number; n: number }>>[1] = {
    game: "lights", world: "retro", width: 390, height: 620, fit: "world",
    events: [{ kind: "clear", count: (s) => s.n, lights: specs.COOL_LIGHTS, textScale: 0.8, arenaGlow: specs.BREAKER_ARENA_GLOW }],
  };
  fx.arcadeFx(c, lit, { tick: 1, n: 0 }, () => {});
  for (let i = 0; i < 12; i++) fx.arcadeFx(c, lit, { tick: 2 + i, n: 1 + i }, () => {});
  const stats = fx.arcadeFxStats(c, "lights");
  assert.ok(stats.lights > 0 && stats.lights <= fx.ARCADE_FX_MAX_LIGHTS, "light cap under spam");
  clock += fx.ARCADE_FX_LIGHTS_MS + 200;
  fx.arcadeFx(c, lit, { tick: 40, n: 13 - 1 }, () => {});
  assert.equal(fx.arcadeFxStats(c, "lights").lights, 0, "lights are gone within ARCADE_FX_LIGHTS_MS");
  assert.ok(fx.ARCADE_FX_LIGHTS_MS <= 900, "light bursts stay short");
  checks += 3;
  // The arena glow is edge strokes only (no fill over the play area) and ends with its text.
  const g = createCanvas(390, 620).getContext("2d") as unknown as CanvasRenderingContext2D;
  let strokes = 0;
  let fills = 0;
  const stroke = g.strokeRect.bind(g);
  const fillRect = g.fillRect.bind(g);
  g.strokeRect = (...a: Parameters<typeof g.strokeRect>) => { strokes++; stroke(...a); };
  g.fillRect = (...a: Parameters<typeof g.fillRect>) => { fills++; fillRect(...a); };
  const glow: typeof lit = { ...lit, game: "arena", world: "space", events: [{ kind: "pop", count: (s) => s.n, arenaGlow: specs.BREAKER_ARENA_GLOW }] };
  fx.arcadeFx(g, glow, { tick: 1, n: 0 }, () => {});
  fx.arcadeFx(g, glow, { tick: 2, n: 1 }, () => {});
  clock += 200;
  strokes = 0;
  fills = 0;
  fx.arcadeFx(g, glow, { tick: 3, n: 1 }, () => {});
  assert.ok(strokes >= 3, "arena glow strokes the edges while the text is up");
  assert.equal(fills, 0, "arena glow never fills the play area");
  clock += 2000;
  strokes = 0;
  fx.arcadeFx(g, glow, { tick: 4, n: 1 }, () => {});
  assert.equal(strokes, 0, "arena glow ends with its text");
  checks += 3;
}

/* ------------------- Polish G: Retro border lights ------------------- */
// The star-dust burst (lights) stays Fission's alone. Rally, Breaker and Hover show text only at
// the event and each light the border in its own pattern: Rally flashes (building with the rally),
// Breaker chases, Hover steps through a colour cycle. Edge only, short, and still under reduced motion.
{
  for (const [name, spec] of [["rally", specs.RALLY_FX], ["breaker", specs.BREAKER_FX], ["hover", specs.HOVER_FX]] as const) {
    for (const event of spec.events as readonly any[]) {
      assert.ok(!event.lights?.length, `${name} ${event.kind}: no star-dust lights`);
      assert.ok(event.textOnly, `${name} ${event.kind}: no burst at the event's place`);
      assert.ok(!event.neon && !event.sweep, `${name} ${event.kind}: border lights replace the shared neon and sweep`);
      checks += 3;
    }
  }
  const patterns = (spec: { events: readonly any[] }) => new Set(spec.events.map((e) => e.bulbs?.pattern).filter(Boolean));
  assert.deepEqual([...patterns(specs.RALLY_FX)], ["flash"], "rally: flashing court lights");
  assert.deepEqual([...patterns(specs.BREAKER_FX)], ["chase"], "breaker: chasing border lights");
  assert.deepEqual([...patterns(specs.HOVER_FX)], ["step"], "hover: border steps through colours");
  // Pinball: its own pattern, rippling both ways from the hit (every event, bumpers included).
  assert.deepEqual([...patterns(specs.PINBALL_FX)], ["ripple"], "pinball: border ripples from the hit");
  assert.ok(specs.PINBALL_FX.events.every((e) => e.bulbs?.pattern === "ripple" && e.textOnly && !e.lights?.length), "pinball: ripple on every event, no star dust");
  assert.ok(specs.PINBALL_FX.events.some((e) => e.kind === "pop" && e.count({ bumps: 4 } as never) === 4), "pinball: a ripple on every bumper hit");
  checks += 3;
  assert.ok(specs.RALLY_FX.events.some((e) => e.label?.({} as never, 1, 1) === null && e.bulbs), "rally: lights on every paddle hit");
  assert.ok(specs.HOVER_FX.events.some((e) => e.kind === "pop" && !e.every && e.bulbs?.pattern === "step" && e.count({ gates: 3 } as never) === 3), "hover: a step on every barrier passed");
  assert.ok(specs.HOVER_FX.events.some((e) => e.every === 7 && e.bulbs?.strong), "hover: stronger step every 7 barriers");
  for (const event of specs.BREAKER_FX.events) assert.deepEqual(event.arenaGlow, specs.BREAKER_ARENA_GLOW, `breaker ${event.kind}: Tuning D arena pulse kept`);
  for (const name of ["rally", "breaker", "hover", "beat", "snake"]) {
    const spec = (specs.ARCADE_FX_SPECS as Record<string, any>)[name];
    assert.ok(spec.events.every((e: any) => !e.lights?.length), `${name}: no star dust`);
  }
  assert.ok(specs.BURST_FX.events.some((e) => e.lights === specs.COOL_LIGHTS), "fission keeps the star dust");
  checks += 9;
  // Heat: a long, fast rally reads hotter than a fresh one.
  assert.ok(specs.rallyHeat({ hits: 0, speed: 1024 } as never) === 0, "rally heat starts cold");
  assert.ok(specs.rallyHeat({ hits: 40, speed: 1024 } as never) === 1 && specs.rallyHeat({ hits: 0, speed: 99999 } as never) === 1, "rally heat full at 40 returns or top speed");
  checks += 2;

  // Painting: edge only, gone when done, brighter and longer with heat, and no movement under reduced motion.
  type S = { tick: number; n: number; heat: number };
  const W = 390, H = 620;
  const lit = (pattern: "flash" | "chase" | "step" | "ripple", strong = false): Parameters<typeof fx.arcadeFx<S>>[1] => ({
    game: `bulbs-${pattern}`, world: "retro", width: W, height: H, fit: "world",
    events: [{ kind: "pop", count: (s) => s.n, label: () => null, textOnly: true, bulbs: { pattern, colours: specs.RALLY_BULBS, heat: (s) => s.heat, strong } }],
  });
  const paintAt = (spec: ReturnType<typeof lit>, heat: number, ms: number) => {
    const c = createCanvas(W, H);
    const g = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    const start = clock;
    fx.arcadeFx(g, spec, { tick: 1, n: 0, heat }, () => {});
    clock += 1000 / 60;
    fx.arcadeFx(g, spec, { tick: 2, n: 1, heat }, () => {});
    clock = start + ms;
    g.clearRect(0, 0, W, H);
    fx.arcadeFx(g, spec, { tick: 3, n: 1, heat }, () => {});
    const stats = fx.arcadeFxStats(g, spec.game);
    clock = start;
    const data = c.getContext("2d").getImageData(0, 0, W, H).data;
    let edge = 0, inner = 0, light = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * 4 + 3]!;
      if (a === 0) continue;
      const d = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (d > 20) inner++;
      else edge++;
      light += a;
    }
    return { edge, inner, light, stats };
  };
  for (const pattern of ["flash", "chase", "step", "ripple"] as const) {
    const mid = paintAt(lit(pattern), 0.5, 200);
    assert.ok(mid.edge > 0, `${pattern}: border lights paint`);
    assert.equal(mid.inner, 0, `${pattern}: nothing more than 20 px in from the border`);
    assert.equal(mid.stats.bulbs, pattern, `${pattern}: reported while lit`);
    const done = paintAt(lit(pattern, true), 0.5, 1300);
    assert.equal(done.edge + done.inner, 0, `${pattern}: gone within 1.3 s`);
    checks += 4;
  }
  // Ripple (Pinball): early on, the light sits by the edge nearest the event, not across the arena.
  {
    const near: ReturnType<typeof lit> = { ...lit("ripple"), game: "bulbs-ripple-left", events: [{ ...lit("ripple").events[0]!, at: () => ({ x: 30, y: H / 2 }) }] };
    const c = createCanvas(W, H);
    const g = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    const start = clock;
    fx.arcadeFx(g, near, { tick: 1, n: 0, heat: 0 }, () => {});
    clock += 1000 / 60;
    fx.arcadeFx(g, near, { tick: 2, n: 1, heat: 0 }, () => {});
    clock = start + 120;
    g.clearRect(0, 0, W, H);
    fx.arcadeFx(g, near, { tick: 3, n: 1, heat: 0 }, () => {});
    clock = start;
    const data = c.getContext("2d").getImageData(0, 0, W, H).data;
    let left = 0, right = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * 4 + 3]!;
      if (x < W / 3) left += a;
      else if (x > (2 * W) / 3) right += a;
    }
    assert.ok(left > 0 && right === 0, `ripple: starts at the edge nearest the event (left ${left}, right ${right})`);
    checks += 1;
  }
  const cold = paintAt(lit("flash"), 0, 160);
  const hot = paintAt(lit("flash"), 1, 160);
  assert.ok(hot.light > cold.light * 1.5, `flash: a hot rally lights more and brighter bulbs (${hot.light} vs ${cold.light})`);
  assert.ok(paintAt(lit("flash"), 1, 700).edge > 0 && paintAt(lit("flash"), 0, 700).edge === 0, "flash: a hot rally's lights last longer");
  checks += 2;
  reduced = true;
  const a = paintAt(lit("chase"), 0, 50);
  const b = paintAt(lit("chase"), 0, 250);
  assert.ok(a.edge > 0 && a.light === b.light, "chase: reduced motion holds the lights still");
  assert.equal(paintAt(lit("flash"), 1, 400).edge, 0, "reduced motion: lights end within 300 ms");
  reduced = false;
  checks += 2;
}

/* --------------- Success-text colours: one per game, readable --------------- */
{
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  };
  const allSpecs = [
    ...Object.values(specs.ARCADE_FX_SPECS),
    ...Object.values(specs.ENGINE_FX_SPECS),
    specs.ORBIT3_FX,
  ] as { game: string }[];
  const types = [...Object.keys(specs.ARCADE_GAME_WORLDS), ...Object.keys(specs.ENGINE_GAME_WORLDS)];
  for (const type of types) {
    const colours = fx.ARCADE_FX_TEXT_COLOURS[type];
    assert.ok(colours, `${type}: has a success-text colour in ARCADE_FX_TEXT_COLOURS`);
    assert.match(colours!.fill, /^#[0-9A-F]{6}$/i, `${type}: fill is #RRGGBB`);
    assert.match(colours!.outline, /^#[0-9A-F]{6}$/i, `${type}: outline is #RRGGBB`);
    assert.ok(contrast(colours!.fill, colours!.outline) >= 7, `${type}: text fill/outline contrast ≥ 7:1`);
    checks += 4;
  }
  for (const spec of allSpecs) {
    assert.ok(fx.arcadeFxTextColours(spec.game), `${spec.game}: spec resolves a success-text colour`);
    checks++;
  }
  assert.equal(
    Object.keys(fx.ARCADE_FX_TEXT_COLOURS).filter((k) => !types.includes(k)).length,
    0,
    "no stray success-text colours",
  );
  // Worlds differ: lava games are not the sea game's colour, and not the old one shared colour.
  assert.notEqual(fx.ARCADE_FX_TEXT_COLOURS.swing!.fill, fx.ARCADE_FX_TEXT_COLOURS.bubble!.fill);
  assert.ok(new Set(Object.values(fx.ARCADE_FX_TEXT_COLOURS).map((c) => c.fill)).size >= 10, "per-game colours, not one shared colour");
  // The text is painted in its game's colour (an event's own colour still wins).
  const c = createCanvas(390, 620).getContext("2d") as unknown as CanvasRenderingContext2D;
  const painted: { text: string; fill: string; outline: string }[] = [];
  const fillText = c.fillText.bind(c);
  c.fillText = (text: string, x: number, y: number) => {
    painted.push({ text, fill: String(c.fillStyle).toUpperCase(), outline: String(c.strokeStyle).toUpperCase() });
    fillText(text, x, y);
  };
  const spec: Parameters<typeof fx.arcadeFx<{ tick: number; n: number; m: number }>>[1] = {
    game: "swing", world: "cavelava", width: 390, height: 620, fit: "world",
    events: [
      { kind: "pop", count: (s) => s.n, label: () => "A" },
      { kind: "pop", count: (s) => s.m, label: () => "B", colour: () => "#123456" },
    ],
  };
  fx.arcadeFx(c, spec, { tick: 1, n: 0, m: 0 }, () => {});
  fx.arcadeFx(c, spec, { tick: 2, n: 1, m: 1 }, () => {});
  const a = painted.find((p) => p.text === "A");
  const b = painted.find((p) => p.text === "B");
  assert.equal(a?.fill, fx.ARCADE_FX_TEXT_COLOURS.swing!.fill.toUpperCase(), "text uses the game's colour");
  assert.equal(a?.outline, fx.ARCADE_FX_TEXT_COLOURS.swing!.outline.toUpperCase(), "text uses the game's outline");
  assert.equal(b?.fill, "#123456", "an event's own colour wins for its text");
  checks += 6;
}

/* ---------------------------- Director unit tests ---------------------------- */
type T = { tick: number; n: number; m: number };
const unit = (
  extra: Partial<Parameters<typeof fx.arcadeFx<T>>[1]> = {},
): Parameters<typeof fx.arcadeFx<T>>[1] => ({
  game: "unit",
  world: "retro",
  width: 390,
  height: 620,
  fit: "world",
  events: [
    { kind: "pop", count: (s) => s.n },
    { kind: "streak", count: (s) => s.n, every: 5 },
    { kind: "combo", count: (s) => s.m, min: 3 },
    { kind: "clear", count: (s) => s.m, minDelta: 2, when: (s) => s.n > 0 },
  ],
  ...extra,
});
{
  const c = createCanvas(390, 620).getContext("2d") as unknown as CanvasRenderingContext2D;
  let worldDraws = 0;
  const frame = (s: T, spec = unit()) =>
    fx.arcadeFx(c, spec, s, () => {
      worldDraws++;
    });
  frame({ tick: 5, n: 9, m: 9 });
  assert.deepEqual(
    fx.arcadeFxStats(c, "unit"),
    { particles: 0, pops: 0, rings: 0, lights: 0, shaking: false },
    "first frame never fires",
  );
  frame({ tick: 6, n: 10, m: 9 });
  assert.deepEqual(
    fx.arcadeFxPopTexts(c, "unit").sort(),
    ["+1", "STREAK 10"].sort(),
    "pop + streak at multiple of 5",
  );
  frame({ tick: 7, n: 11, m: 10 });
  assert.ok(fx.arcadeFxPopTexts(c, "unit").includes("COMBO ×10"), "combo above min");
  assert.ok(!fx.arcadeFxStats(c, "unit").shaking, "minDelta gates the clear");
  frame({ tick: 8, n: 11, m: 12 });
  assert.ok(fx.arcadeFxPopTexts(c, "unit").includes("CLEAR!"), "clear with delta 2");
  assert.ok(fx.arcadeFxStats(c, "unit").shaking, "clear shakes");
  assert.equal(
    fx.arcadeFxPopTexts(c, "unit").filter((t) => t === "COMBO ×10" || t === "CLEAR!").length,
    1,
    "one banner at a time",
  );
  frame({ tick: 8, n: 30, m: 30 });
  assert.ok(!fx.arcadeFxPopTexts(c, "unit").includes("+19"), "same tick never fires");
  frame({ tick: 2, n: 50, m: 50 });
  assert.equal(fx.arcadeFxStats(c, "unit").particles, 0, "rewind resets without firing");
  for (let i = 0; i < 200; i++) frame({ tick: 3 + i, n: 51 + i * 5, m: 51 + i * 3 });
  assert.ok(
    fx.arcadeFxStats(c, "unit").particles <= fx.ARCADE_FX_MAX_PARTICLES,
    "particle cap under spam",
  );
  assert.ok(fx.arcadeFxStats(c, "unit").pops <= fx.ARCADE_FX_MAX_POPS, "pop cap under spam");
  assert.equal(worldDraws, 206, "the world draws exactly once per frame");
  clock += 5000;
  frame({ tick: 400, n: 51 + 199 * 5, m: 51 + 199 * 3 });
  assert.equal(
    fx.arcadeFxStats(c, "unit").particles,
    0,
    "effects expire on the presentation clock",
  );
  checks += 14;

  const still = createCanvas(390, 620).getContext("2d") as unknown as CanvasRenderingContext2D;
  const noShake = unit({ game: "noshake", shake: false });
  fx.arcadeFx(still, noShake, { tick: 1, n: 0, m: 0 }, () => {});
  fx.arcadeFx(still, noShake, { tick: 2, n: 1, m: 5 }, () => {});
  assert.ok(!fx.arcadeFxStats(still, "noshake").shaking, "shake: false never shakes");
  reduced = true;
  const calm = unit({ game: "calm" });
  fx.arcadeFx(still, calm, { tick: 1, n: 0, m: 0 }, () => {});
  let translated = 0;
  const translate = still.translate.bind(still);
  still.translate = (x: number, y: number) => {
    if (x !== 0 || y !== 0) translated++;
    translate(x, y);
  };
  fx.arcadeFx(still, calm, { tick: 2, n: 1, m: 5 }, () => {});
  fx.arcadeFx(still, calm, { tick: 3, n: 1, m: 5 }, () => {});
  assert.equal(translated, 0, "reduced motion: no shake");
  assert.ok(
    fx.arcadeFxStats(still, "calm").particles <= 12,
    "reduced motion: few, still particles",
  );
  reduced = false;
  let thrown = 0;
  fx.arcadeFx(
    still,
    {
      ...unit({ game: "bad" }),
      events: [
        {
          kind: "pop",
          count: () => {
            throw new Error("x");
          },
        },
      ],
    },
    { tick: 1, n: 0, m: 0 },
    () => {
      thrown++;
    },
  );
  assert.equal(thrown, 1, "a broken event still draws the game");
  checks += 4;
}

/* ------------------- Miss moments (Polish 1, 24 Oct 2026) ------------------- */
{
  // Every active arcade game wires its existing miss, life-lost or crash moment to the shared miss effect.
  for (const [game, spec] of Object.entries(specs.ARCADE_FX_SPECS)) {
    assert.ok((spec.misses?.length ?? 0) > 0, `${game}: a miss moment is declared`);
    checks += 1;
  }
  assert.ok(specs.ORBIT3_FX.misses?.length, "orbit rev 3–7 view: a miss moment is declared");
  type M = { tick: number; lives: number; px: number };
  const W = 390, H = 620;
  const spec: Parameters<typeof fx.arcadeFx<M>>[1] = {
    game: "misses",
    world: "fairground",
    width: W,
    height: H,
    events: [],
    misses: [{ count: (s) => -s.lives, at: (s, before) => ({ x: (before ?? s).px, y: 300 }) }],
  };
  const c = createCanvas(W, H).getContext("2d") as unknown as CanvasRenderingContext2D;
  const frame = (s: M) => fx.arcadeFx(c, spec, s, () => c.clearRect(0, 0, W, H));
  const alphaAt = (x: number, y: number) => c.getImageData(x, y, 1, 1).data;
  frame({ tick: 1, lives: 2, px: 100 });
  assert.deepEqual(fx.arcadeFxMissStats(c, "misses"), { pulse: false, puffs: [] }, "miss: the first frame never fires");
  frame({ tick: 2, lives: 2, px: 120 });
  frame({ tick: 3, lives: 1, px: 40 });
  const lit = fx.arcadeFxMissStats(c, "misses");
  assert.ok(lit.pulse, "miss: a life lost starts the red edge pulse");
  assert.deepEqual(lit.puffs, [{ x: 120, y: 300 }], "miss: the puff sits where it happened (the frame before)");
  clock += fx.ARCADE_FX_MISS_MS / 2;
  frame({ tick: 4, lives: 1, px: 40 });
  const edge = alphaAt(4, H / 2);
  assert.ok(edge[0]! > edge[1]! + 20 && edge[3]! > 0, "miss: the edge pulse is red");
  assert.ok(edge[3]! <= Math.ceil(255 * fx.ARCADE_FX_MISS_ALPHA) + 2, `miss: the edge pulse stays faint (alpha ${edge[3]})`);
  assert.equal(alphaAt(W / 2, 60)[3], 0, "miss: no full-screen flash (the middle of the world is untouched)");
  assert.ok(alphaAt(120, 300)[3]! > 0, "miss: the puff is painted at the miss");
  clock += fx.ARCADE_FX_MISS_MS;
  frame({ tick: 5, lives: 1, px: 40 });
  assert.equal(fx.arcadeFxMissStats(c, "misses").pulse, false, `miss: the pulse is over within ${fx.ARCADE_FX_MISS_MS} ms`);
  clock += fx.ARCADE_FX_PUFF_MS;
  frame({ tick: 6, lives: 1, px: 40 });
  assert.deepEqual(fx.arcadeFxMissStats(c, "misses").puffs, [], "miss: the puff fades on the presentation clock");
  assert.equal(alphaAt(4, H / 2)[3], 0, "miss: nothing left on screen afterwards");
  frame({ tick: 7, lives: 1, px: 40 });
  assert.equal(fx.arcadeFxMissStats(c, "misses").pulse, false, "miss: no rise, no pulse");
  frame({ tick: 1, lives: 0, px: 40 });
  assert.equal(fx.arcadeFxMissStats(c, "misses").pulse, false, "miss: a rewind resets without firing");
  for (let i = 0; i < 20; i++) frame({ tick: 2 + i, lives: -1 - i, px: i });
  assert.ok(fx.arcadeFxMissStats(c, "misses").puffs.length <= fx.ARCADE_FX_MAX_PUFFS, "miss: puff cap under spam");

  // Reduced motion: the pulse holds still and fades (no rise), the puff never spreads.
  reduced = true;
  const calm = createCanvas(W, H).getContext("2d") as unknown as CanvasRenderingContext2D;
  const calmSpec = { ...spec, game: "misses-calm" };
  fx.arcadeFx(calm, calmSpec, { tick: 1, lives: 2, px: 100 }, () => calm.clearRect(0, 0, W, H));
  fx.arcadeFx(calm, calmSpec, { tick: 2, lives: 1, px: 100 }, () => calm.clearRect(0, 0, W, H));
  const first = calm.getImageData(4, H / 2, 1, 1).data[3]!;
  clock += fx.ARCADE_FX_MISS_MS / 2;
  fx.arcadeFx(calm, calmSpec, { tick: 3, lives: 1, px: 100 }, () => calm.clearRect(0, 0, W, H));
  const later = calm.getImageData(4, H / 2, 1, 1).data[3]!;
  assert.ok(first > 0 && later < first, "reduced motion: the miss edge only fades");
  reduced = false;

  // Misses read state only: the sim's state object is never written.
  const frozen = Object.freeze({ tick: 9, lives: 0, px: 5 });
  fx.arcadeFx(c, spec, frozen, () => {});
  checks += 17;
}

/* ------------------------------ Art pipeline ------------------------------ */
{
  const worlds = Object.keys(sprites.ART_WORLDS).sort();
  assert.deepEqual(
    worlds,
    [
      "cavelava",
      "fairground",
      "kitchen",
      "orchard",
      "realworld",
      "retro",
      "space",
      "toybox",
      "underwater",
    ],
    "nine art worlds",
  );
  for (const w of worlds) {
    const m = sprites.ART_WORLDS[w as keyof typeof sprites.ART_WORLDS];
    assert.match(m.page, /^https:\/\/kenney\.nl\/assets\//, `${w}: Kenney pack page`);
    assert.match(m.licence, /^CC0/, `${w}: CC0`);
    assert.ok(Object.keys(m.sprites).length > 0, `${w}: at least one pilot sprite`);
    checks += 3;
  }
  const c = createCanvas(100, 100).getContext("2d") as unknown as CanvasRenderingContext2D;
  let calls = 0;
  for (const key of ["drawImage", "save", "restore", "fillRect", "translate"] as const) {
    const original = (c as any)[key].bind(c);
    (c as any)[key] = (...a: unknown[]) => {
      calls++;
      return original(...a);
    };
  }
  sprites.resetArtImages();
  assert.equal(
    sprites.drawArtSprite(c, "toybox", "marble", 10, 10, 20, 20),
    false,
    "missing art falls back",
  );
  assert.equal(
    sprites.drawArtSprite(c, "toybox", "nope", 10, 10, 20, 20),
    false,
    "unknown sprite falls back",
  );
  assert.equal(calls, 0, "fallback leaves the context untouched");
  checks += 3;

  const src = createCanvas(32, 16);
  const g = src.getContext("2d");
  g.fillStyle = "#ff0000";
  g.fillRect(0, 0, 16, 16);
  g.fillStyle = "#0000ff";
  g.fillRect(16, 0, 16, 16);
  sprites.registerArtImage("toybox", "marble", src as unknown as CanvasImageSource, 32, 16);
  const out = createCanvas(100, 100);
  const o = out.getContext("2d") as unknown as CanvasRenderingContext2D;
  assert.equal(
    sprites.drawArtSprite(o, "toybox", "marble", 20, 30, 40, 20),
    true,
    "registered art draws",
  );
  const data = out.getContext("2d").getImageData(0, 0, 100, 100).data;
  const alphaAt = (x: number, y: number) => data[(y * 100 + x) * 4 + 3]!;
  assert.ok(alphaAt(40, 40) > 200, "fills inside the rectangle");
  for (const [x, y] of [
    [17, 40],
    [62, 40],
    [40, 27],
    [40, 52],
  ] as const)
    assert.equal(alphaAt(x, y), 0, `nothing beyond 2 px of the bounds (${x},${y})`);
  checks += 6;

  // Sheet frames pick their own rectangle.
  (sprites.ART_WORLDS.toybox.sprites as Record<string, unknown>)["sheet-test"] = {
    file: "marble.png",
    frames: [
      [0, 0, 16, 16],
      [16, 0, 16, 16],
    ],
  };
  const sheet = createCanvas(10, 10);
  sprites.drawArtSprite(
    sheet.getContext("2d") as unknown as CanvasRenderingContext2D,
    "toybox",
    "sheet-test",
    0,
    0,
    10,
    10,
    { frame: 1 },
  );
  const px = sheet.getContext("2d").getImageData(5, 5, 1, 1).data;
  assert.ok(px[2]! > 200 && px[0]! < 50, "frame 1 is the blue half of the sheet");
  delete (sprites.ART_WORLDS.toybox.sprites as Record<string, unknown>)["sheet-test"];
  sprites.resetArtImages();
  assert.ok(
    sprites.artStatus().every((r) => !r.bundled),
    "no bundling outside Vite: every sprite reports unbundled",
  );
  checks += 2;

  // Bundled art files: each belongs to a manifest sprite and is trimmed to its
  // visible content (opaque pixels reach all four edges), so filling the
  // collision rectangle keeps the drawn art within the bounds rule.
  const { readdirSync, existsSync } = await import("node:fs");
  const { loadImage } = await import("@napi-rs/canvas");
  const root = new URL("../src/assets/arcade/", import.meta.url);
  for (const w of worlds) {
    const dir = new URL(`${w}/`, root);
    if (!existsSync(dir)) continue;
    const m = sprites.ART_WORLDS[w as keyof typeof sprites.ART_WORLDS];
    const named = new Set(Object.values(m.sprites).map((d) => d.file));
    for (const file of readdirSync(dir).filter((f) => /\.(png|webp)$/.test(f))) {
      assert.ok(named.has(file), `${w}/${file}: named by a manifest sprite`);
      const img = await loadImage(new URL(file, dir).pathname);
      const cv = createCanvas(img.width, img.height);
      const g2 = cv.getContext("2d");
      g2.drawImage(img, 0, 0);
      const px = g2.getImageData(0, 0, img.width, img.height).data;
      let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
      for (let y = 0; y < img.height; y++)
        for (let x = 0; x < img.width; x++)
          if (px[(y * img.width + x) * 4 + 3]! > 8) {
            x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
          }
      assert.ok(x0 === 0 && y0 === 0 && x1 === img.width - 1 && y1 === img.height - 1, `${w}/${file}: trimmed (no transparent margin)`);
      summary.push(`art ${w}/${file} ${img.width}x${img.height} trimmed`);
      checks += 2;
    }
  }
  // Preload: resolves only once every sprite in the world has settled, so the
  // intro demo (which waits on it) never draws before the art has loaded.
  {
    sprites.resetArtImages();
    let empty = false;
    void sprites.preloadArtWorld("kitchen").then(() => (empty = true));
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(empty, true, "a world with no bundled files settles at once");
    assert.equal(sprites.isArtWorld("gem"), false, "gem has no art world");
    assert.equal(sprites.isArtWorld("toybox"), true, "toybox is an art world");
    const fake = createCanvas(8, 8);
    let fire: (() => void) | null = null;
    class SlowImage {
      naturalWidth = 8;
      naturalHeight = 8;
      decoding = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        fire = () => {
          Object.assign(this, fake);
          this.onload?.();
        };
      }
    }
    Object.defineProperty(globalThis, "Image", { configurable: true, value: SlowImage });
    const saved = sprites.ART_WORLDS.toybox.sprites;
    (sprites.ART_WORLDS.toybox as { sprites: unknown }).sprites = { marble: { url: "test://marble.png" } };
    let done = false;
    const pending = sprites.preloadArtWorld("toybox").then(() => (done = true));
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(done, false, "preload waits while a sprite is still loading");
    assert.equal(sprites.artReady("toybox", "marble"), false, "not ready before load");
    assert.ok(fire, "loading started");
    fire!();
    await pending;
    assert.equal(sprites.artReady("toybox", "marble"), true, "ready once preload resolves");
    (sprites.ART_WORLDS.toybox as { sprites: unknown }).sprites = saved;
    Reflect.deleteProperty(globalThis, "Image");
    sprites.resetArtImages();
    checks += 7;
  }

  // Coral Pop is all five creatures or none.
  const uw = sprites.ART_WORLDS.underwater.sprites;
  assert.deepEqual(Object.keys(uw).sort(), ["crab", "fish", "jellyfish", "shell", "starfish"], "underwater: all five bubble creatures");
  const uwFiles = existsSync(new URL("underwater/", root)) ? readdirSync(new URL("underwater/", root)).filter((f) => /\.(png|webp)$/.test(f)) : [];
  assert.ok(uwFiles.length === 0 || uwFiles.length === 5, "underwater: all five creature files or none");
  checks += 2;
}

for (const line of summary) console.log(`  ${line}`);
console.log(
  `Arcade fx checks passed: ${checks} assertions; 23 games draw read-only with identical sims, director gates and caps, art fallback and bounds.`,
);
