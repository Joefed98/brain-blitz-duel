/**
 * Shared arcade success layer + art pipeline checks (presentation only).
 *
 *  1. All 22 active arcade games: seeded random inputs, every frame drawn through
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
const { hoverRev2Game } = await import("../src/lib/arcade/hover");
const { breakerArtGameFor } = await import("../src/lib/arcade/breaker.renderer");
const { rallyArtGame } = await import("../src/lib/arcade/rally.renderer");
const { beatArtGame } = await import("../src/lib/arcade/beat.renderer");
const { snakeArtGame } = await import("../src/lib/arcade/snake.renderer");
const { snakeRev3Game } = await import("../src/lib/arcade/snake");
const { burstArtGameFor } = await import("../src/lib/arcade/burst.renderer");
const { wavefrontArtGameFor } = await import("../src/lib/arcade/wavefront.renderer");
const { orbitArtGame } = await import("../src/lib/arcade/orbit.renderer");
const { skylineArtGame } = await import("../src/lib/arcade/skyline.renderer");
const { crossArtGameFor } = await import("../src/lib/arcade/cross.renderer");
const { junctionArtGame } = await import("../src/lib/arcade/junction.renderer");
const { inkBridgeArtGameFor } = await import("../src/lib/arcade/inkBridge.renderer");
const { sliceArtGameFor } = await import("../src/lib/arcade/slice.renderer");
const { binTossArtGame } = await import("../src/lib/arcade/binTossArt.renderer");
const { drawBullseye } = await import("../src/lib/arcade/bullseye.renderer");
const { bullseyeGame } = await import("../src/lib/arcade/bullseye");
const { bubbleArtGame } = await import("../src/lib/arcade/bubble.renderer");
const { bubbleRev2Game } = await import("../src/lib/arcade/bubble");
const { flipArtGameFor } = await import("../src/lib/arcade/flipArt.renderer");
const { swingArtGameFor } = await import("../src/lib/arcade/swing.renderer");
const { snipArtGame } = await import("../src/lib/arcade/snip.renderer");
const { tiltArtGame } = await import("../src/lib/arcade/tiltArt.renderer");
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
  hover: { ...hoverArtGame, init: hoverRev2Game.init } as AnyGame,
  breaker: breakerArtGameFor(2) as AnyGame,
  rally: rallyArtGame as AnyGame,
  beat: beatArtGame as AnyGame,
  snake: { ...snakeArtGame, init: snakeRev3Game.init } as AnyGame,
  burst: burstArtGameFor(2) as AnyGame,
  wavefront: wavefrontArtGameFor(2) as AnyGame,
  orbit: orbitArtGame as AnyGame,
  skyline: skylineArtGame as AnyGame,
  cross: crossArtGameFor(3) as AnyGame,
  junction: junctionArtGame as AnyGame,
  inkbridge: inkBridgeArtGameFor(3) as AnyGame,
  slice: sliceArtGameFor(2) as AnyGame,
  bintoss: binTossArtGame as AnyGame,
  bullseye: { ...bullseyeGame, draw: drawBullseye } as AnyGame,
  bubble: { ...bubbleArtGame, init: bubbleRev2Game.init } as AnyGame,
  flip: flipArtGameFor(2) as AnyGame,
  swing: swingArtGameFor(4) as AnyGame,
  snip: snipArtGame as AnyGame,
  tilt: tiltArtGame as AnyGame,
  balltrack: {
    ...btGame,
    draw: (ctx: CanvasRenderingContext2D, s: any) => btArtDraw(ctx, course, s, btGame.rotatable),
  } as AnyGame,
  matchup: { ...matchupArtGame, init: matchupRev2Game.init } as AnyGame,
};

assert.equal(Object.keys(GAMES).length, 22, "22 active arcade games");
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
  let last: number[] | null = null;
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
    checks++;
  }
  summary.push(
    `${name} [${spec.world}] rises ${spec.events.map((e: any, i: number) => `${e.kind}:${fired[i]}`).join(" ")}`,
  );
}

/* ------------- Every declared event fires through its real renderer ------------- */
// For each event: take a real mid-run state, bump the counter the event reads
// (a copy; the sim never sees it) and draw. The effect must fire and the draw
// must complete. Index order matches each spec's `events`.
const zeros = (n: number) => Array.from({ length: n }, () => 0);
const BUMPS: Record<string, ((s: any) => any)[]> = {
  hover: [
    (s) => ({ ...s, gates: s.gates + 7 }),
    (s) => ({ ...s, stars: (s.stars ?? 0) + 1 }),
    (s) => ({ ...s, gates: 17 }),
    (s) => ({ ...s, gates: 24 }),
    (s) => ({ ...s, gates: s.totalGates }),
  ],
  breaker: [
    (s) => ({ ...s, powerUps: s.powerUps + 1 }),
    (s) => ({ ...s, bricks: s.bricks.map((b: number, i: number) => (i < 10 ? 0 : b)) }),
    (s) => ({ ...s, fireballs: (s.fireballs ?? 0) + 1, fire: 300 }),
    (s) => ({ ...s, bricks: s.bricks.map((b: number, i: number) => (Math.trunc(i / 8) === (s.slide ?? [3])[0] && i % 8 === 0 ? 0 : b)) }),
    (s) => ({
      ...s,
      bricks: s.bricks.map((b: number, i: number) => (i >= s.bricks.length - 8 ? 0 : b)),
    }),
    (s) => ({ ...s, cleared: true }),
  ],
  rally: [(s) => ({ ...s, hits: s.hits + 10 }), (s) => ({ ...s, goldHits: s.goldHits + 1 })],
  beat: [(s) => ({ ...s, combo: s.combo + 10 }), (s) => ({ ...s, maxCombo: s.chart.ticks.length })],
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
  ],
  wavefront: [
    (s) => ({ ...s, saucers: s.saucers + 1 }),
    (s) => ({ ...s, wavesCleared: s.wavesCleared + 1 }),
    (s) => ({ ...s, diversDown: (s.diversDown ?? 0) + 1 }),
    (s) => ({ ...s, boss: s.boss ?? { x: 131, dir: 1, hp: 30, fireIn: 60 }, bossHits: (s.bossHits ?? 0) + 6 }),
    (s) => ({ ...s, bossKilled: 1 }),
  ],
  orbit: [(s) => ({ ...s, best: s.best + 10 }), (s) => ({ ...s, finished: 1 })],
  skyline: [(s) => ({ ...s, perfects: s.perfects + 1 }), (s) => ({ ...s, placed: s.placed + 10 })],
  cross: [
    (s) => ({ ...s, crossings: s.crossings + 1 }),
    (s) => ({ ...s, crossings: 3, reached: 0 }),
    (s) => ({ ...s, crossings: 4, reached: 0 }),
  ],
  junction: [
    (s) => ({ ...s, ambThrough: s.ambThrough + 1 }),
    (s) => ({ ...s, cleared: s.cleared + 10 }),
  ],
  inkbridge: [(s) => ({ ...s, levels: s.levels + 1 }), (s) => ({ ...s, levels: 10 })],
  slice: [
    (s) => ({ ...s, comboLive: 1, streak: 2 }),
    (s) => ({ ...s, frenzyFrom: [...s.frenzyFrom, s.tick] }),
    (s) => ({ ...s, slowFrom: [...s.slowFrom, s.tick] }),
    (s) => ({ ...s, slices: s.slices + 25 }),
    (s) => ({ ...s, mayo: [...(s.mayo ?? []), s.tick, 195, 300] }),
    (s) => ({ ...s, slices: s.slices + 5 }),
  ],
  bintoss: [(s) => ({ ...s, results: [...s.results, 1, 1, 1] }), (s) => ({ ...s, baskets: 10 })],
  bullseye: [
    (s) => ({
      ...s,
      flightTick: 0,
      hits: [...s.hits, { x: 195, y: 224, ring: 0, value: 10, arrow: 0 }],
    }),
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
  ],
  swing: [
    (s) => ({ ...s, maxX: s.maxX + 100 * 256 * 40 }),
    (s) => ({ ...s, stars: (s.stars ?? 0) + 1 }),
    (s) => ({ ...s, rocks: (s.rocks ?? []).map((r: any, i: number) => (i === 0 ? { ...r, phase: 3 } : r)) }),
    (s) => ({ ...s, x: (s.jets?.[0]?.x ?? 0) + 40 * 256 }),
    (s) => ({ ...s, ended: 1, maxX: s.maxX + 600 * 256 * 40 }),
  ],
  snip: [
    (s) => ({ ...s, stars: s.stars + 1 }),
    (s) => ({ ...s, eaten: s.eaten + 1 }),
    (s) => ({ ...s, eaten: 10 }),
  ],
  tilt: [(s) => ({ ...s, mazes: s.mazes + 1 }), (s) => ({ ...s, mazes: 4 })],
  balltrack: [
    (s) => ({ ...s, home: s.home + 5 }),
    (s) => ({ ...s, home: 30 }),
    (s) => ({ ...s, rideHomes: (s.rideHomes ?? 0) + 1 }),
    (s) => ({ ...s, switchHomes: (s.switchHomes ?? 0) + 1 }),
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
      stats.particles + stats.pops + stats.rings > 0,
      `${name} event ${i} (${event.kind}): effect fired`,
    );
    assert.equal(JSON.stringify(base), frozen, `${name}: drawing changed state`);
    checks += 3;
  });
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
    { particles: 0, pops: 0, rings: 0, shaking: false },
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
  `Arcade fx checks passed: ${checks} assertions; 22 games draw read-only with identical sims, director gates and caps, art fallback and bounds.`,
);
