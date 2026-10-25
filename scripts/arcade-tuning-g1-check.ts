/**
 * Taller worlds, batch 1 (16 Oct 2026): Breaker brkRev 6 and Rally rallyRev 6
 * (390 × 730 courts), Wavefront wavRev 6 (390 × 730) and Fission burstRev 4
 * (a 390 × 650 arena over its arrow row).
 *
 *  1. Old rounds: 88 real runs recorded with the code on main before the change
 *     on every revision the four games ever stamped, unstamped included
 *     (scripts/fixtures/arcade-tuning-g1-legacy.json,
 *     scripts/arcade-tuning-g1-legacy.ts), replay through today's server path to
 *     the same score and the same final state, unflagged; old states carry no
 *     `worldH`. 32 runs on the new stamps (scripts/fixtures/arcade-tuning-g1-runs.json)
 *     replay the same way, so a later change that moves a taller round shows up.
 *  2. New rounds: the room generators stamp the taller revisions; each new
 *     state is the previous revision's start with `worldH` added (and only
 *     the heights that follow from it moved); the height is folded into the
 *     checkpoint checksum; stages, reveals, intro demos and effects take the
 *     height from the stored revision; older revisions keep their own.
 *  3. Per game: Breaker's paddle 72 px above the taller bottom, the same 80
 *     bricks, capsules and sliding rows; Rally's paddle 60 px above it, the same
 *     pads and gold balls, the bumpers stretched down the longer court and still
 *     apart; Wavefront's ship 66 px above it, the same formations, saucer and
 *     boss, drags from the bottom quarter, bolts quick enough to reach the
 *     formation in the old time; Fission's floor at 650 with every bounce, the
 *     ceiling's lowest point and its drop scaled to the taller arena.
 *  4. The refitted curves keep the band rules (from 0, never falling, 140 or 150
 *     at the top, one unit short of a finish at most 12 below it, an idle run
 *     scores 0), and each game's best score, 150, is reached by a skill-band
 *     player through the server replay.
 *  5. Each game's intro demo stays stopped until one is recorded on the taller revision.
 *
 *   bun scripts/arcade-tuning-g1-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import type { TuningG1Record } from "./arcade-tuning-g1-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bandPoints, bandTop, BAND_FINISH_BONUS, BAND_PARTIAL_TOP, type BandCurve } from "../src/lib/arcade/scoreBands";
import { ARCADE_FX_SPECS, BREAKER_FX, BURST_FX, RALLY_FX, WAVEFRONT_FX, breakerFxFor, burstFxFor, rallyFxFor, wavefrontFxFor } from "../src/lib/arcade/arcadeFxGames.renderer";
import { ARCADE_REVEAL_RENDERERS, revealWorldH } from "../src/lib/arcade/revealRenderers";
import {
  breakerGameFor,
  brkCheckpoint,
  brkPaddleY,
  breakerWorldHFor,
  BRK_BRICKS,
  BRK_PADDLE_LIFT,
  BRK_PADDLE_H,
  BRK_REV_TALL,
  BRK_REV_TUNEF,
  BRK_TALL_H,
  BRK_V6_BAND_CURVE,
  BRK_WORLD_H,
  type BrkState,
} from "../src/lib/arcade/breaker";
import {
  rallyCheckpoint,
  rallyGameFor,
  rallyPaddleY,
  rallyWorldHFor,
  RALLY_BALL_R,
  RALLY_BUMPER2_GAP,
  RALLY_BUMPER_R,
  RALLY_HUD_H,
  RALLY_PADDLE_LIFT,
  RALLY_REV_TALL,
  RALLY_REV_TUNEF,
  RALLY_TALL_H,
  RALLY_V6_BAND_CURVE,
  RALLY_WALL,
  RALLY_WORLD_H,
  type RallyState,
} from "../src/lib/arcade/rally";
import {
  wavBoltSpeedFp,
  wavCheckpoint,
  wavDragZoneTop,
  wavefrontGameFor,
  wavefrontWorldHFor,
  wavShipY,
  WAV_DRAG_ZONE_TOP,
  WAV_PAR_V5,
  WAV_POINTS_BOSS,
  WAV_REV_TALL,
  WAV_REV_TUNEC,
  WAV_SHIP_LIFT,
  WAV_TALL_H,
  WAV_V6_BAND_CURVE,
  WAV_WORLD_H,
  type WavState,
} from "../src/lib/arcade/wavefront";
import {
  burstCeiling,
  burstCheckpoint,
  burstFloorY,
  burstGameFor,
  burstGeometry,
  burstWorldHFor,
  BURST_FLOOR_Y,
  BURST_REV_BAND,
  BURST_REV_TALL,
  BURST_TALL_H,
  BURST_V4_BAND_CURVE,
  type BurstState,
} from "../src/lib/arcade/burst";
import { generateBreaker, generateBurst, generateRally, generateWavefront } from "../src/lib/duel/arcade.server";
import { playRevOf } from "./scoring-targets-revs";

const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const section = (name: string) => console.log(`— ${name}`);
const read = (path: string) => readFileSync(path, "utf8");

/** A skill-band player's run on a revision, sent through the server's encode + replay. */
async function botRun(type: string, rev: number, level: SkillLevel, n: number) {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const { bot } = await import(`./arcade-skill-bands/bots/${type}.ts`);
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: new Human(spec.type, seed, level) });
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  const byTick = new Map((out.events ?? []).map((e: any) => [e.t, e]));
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, byTick.get(t) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const score = game.score(state);
  const raw = spec.encode({ seed, claimedScore: score, events: out.events ?? [], inputs: [], taps: [], endTick: state.tick, checkpoints }, rev, seed);
  return { score, result: spec.replay(seed, raw, rev) };
}

/* ============================== 1. Stored rounds ============================== */
section("Stored rounds replay and score exactly as before");
for (const [file, label] of [["scripts/fixtures/arcade-tuning-g1-legacy.json", "before"], ["scripts/fixtures/arcade-tuning-g1-runs.json", "taller"]] as const) {
  const fixture = JSON.parse(read(file)) as { runs: TuningG1Record[] };
  const per = new Map<string, number>();
  for (const run of fixture.runs) {
    const spec = GAME_BY_TYPE.get(run.type as never)!;
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = spec.replay(run.seed, raw, run.rev);
    ok(result.score === run.score && !result.flagged, `${label} ${run.type} rev ${run.rev} ${run.level}: stored ${run.score}, replays ${result.score}${result.flagged ? " (flagged)" : ""}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `${label} ${run.type} rev ${run.rev} ${run.level}: the replayed final state differs`);
    if (label === "before") ok(result.state.worldH === undefined, `${run.type} rev ${run.rev}: an old state carries worldH`);
    else ok(typeof result.state.worldH === "number", `${run.type} rev ${run.rev}: a taller state has no worldH`);
    per.set(`${run.type} ${run.rev ?? "-"}`, (per.get(`${run.type} ${run.rev ?? "-"}`) ?? 0) + 1);
  }
  ok(fixture.runs.length === (label === "before" ? 88 : 32), `${label}: ${fixture.runs.length} stored runs`);
  console.log(`  ${label}: ${fixture.runs.length} runs (${[...per].map(([k, v]) => `${k}: ${v}`).join(", ")})`);
}

/* ============================== 2. New rounds ============================== */
section("New rounds: stamps, start states, checksums, worlds by revision");
{
  ok(playRevOf("breaker", generateBreaker().brkRev) === BRK_REV_TALL, "rooms deal brkRev 6");
  ok(playRevOf("rally", generateRally().rallyRev) === RALLY_REV_TALL, "rooms deal rallyRev 6");
  // Expansion E8 (25 Oct 2026) moved rooms on to wavRev 9 (wavefront-expand-check); wavRev 6 stays as it was.
  ok(playRevOf("wavefront", generateWavefront().wavRev) === WAV_REV_TALL + 3, "rooms deal wavRev 9 (the expansion, after wavRev 6)");
  ok(playRevOf("burst", generateBurst().burstRev) === BURST_REV_TALL, "rooms deal burstRev 4");

  ok(breakerWorldHFor(BRK_REV_TALL) === 730 && breakerWorldHFor(BRK_REV_TUNEF) === BRK_WORLD_H && breakerWorldHFor(undefined) === 620, "Breaker world heights by revision");
  ok(rallyWorldHFor(RALLY_REV_TALL) === 730 && rallyWorldHFor(RALLY_REV_TUNEF) === RALLY_WORLD_H && rallyWorldHFor(undefined) === 620, "Rally world heights by revision");
  ok(wavefrontWorldHFor(WAV_REV_TALL) === 730 && wavefrontWorldHFor(WAV_REV_TUNEC) === WAV_WORLD_H && wavefrontWorldHFor(undefined) === 620, "Wavefront world heights by revision");
  ok(burstWorldHFor(BURST_REV_TALL) === 650 && burstWorldHFor(BURST_REV_BAND) === BURST_FLOOR_Y && burstWorldHFor(undefined) === 560, "Fission world heights by revision");

  const seeds = [1, 77, 4242, 912345, 2_000_000_011];
  const sameBut = (a: any, b: any, keys: string[]) => {
    const strip = (s: any) => Object.fromEntries(Object.entries(s).filter(([k]) => !keys.includes(k)));
    return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
  };
  for (const seed of seeds) {
    const b6 = breakerGameFor(BRK_REV_TALL).init(seed);
    const b5 = breakerGameFor(BRK_REV_TUNEF).init(seed);
    ok(b6.worldH === BRK_TALL_H && sameBut(b6, b5, ["worldH", "balls"]), `Breaker seed ${seed}: brkRev 6 starts as brkRev 5 with worldH`);
    ok(b6.balls.length === 1 && b6.balls[0]!.x === b5.balls[0]!.x && b6.balls[0]!.vx === b5.balls[0]!.vx && b6.balls[0]!.vy === b5.balls[0]!.vy && b6.balls[0]!.y === b5.balls[0]!.y + 110 * 256, `Breaker seed ${seed}: the ball rests on the lower paddle`);
    const r6 = rallyGameFor(RALLY_REV_TALL).init(seed);
    const r5 = rallyGameFor(RALLY_REV_TUNEF).init(seed);
    ok(r6.worldH === RALLY_TALL_H && sameBut(r6, r5, ["worldH", "bumper", "bumper2"]), `Rally seed ${seed}: rallyRev 6 starts as rallyRev 5 (pads, gold balls, opening) with worldH`);
    const w6 = wavefrontGameFor(WAV_REV_TALL).init(seed);
    const w5 = wavefrontGameFor(WAV_REV_TUNEC).init(seed);
    ok(w6.worldH === WAV_TALL_H && sameBut(w6, w5, ["worldH"]), `Wavefront seed ${seed}: wavRev 6 starts as wavRev 5 with worldH`);
    const f4 = burstGameFor(BURST_REV_TALL).init(seed);
    const f3 = burstGameFor(BURST_REV_BAND).init(seed);
    ok(f4.worldH === BURST_TALL_H && sameBut(f4, f3, ["worldH"]), `Fission seed ${seed}: burstRev 4 starts as burstRev 3 (the same waves) with worldH`);
    // The height is in the checksum: the same state at the old height checks differently.
    ok(brkCheckpoint(b6).checksum !== brkCheckpoint({ ...b6, worldH: undefined }).checksum, "Breaker: worldH folds into the checksum");
    ok(rallyCheckpoint(r6).checksum !== rallyCheckpoint({ ...r6, worldH: undefined }).checksum, "Rally: worldH folds into the checksum");
    ok(wavCheckpoint(w6).checksum !== wavCheckpoint({ ...w6, worldH: undefined }).checksum, "Wavefront: worldH folds into the checksum");
    ok(burstCheckpoint(f4).checksum !== burstCheckpoint({ ...f4, worldH: undefined }).checksum, "Fission: worldH folds into the checksum");
  }

  // Effects: the tall specs in ARCADE_FX_SPECS, older rounds at their own height, through fxSpecAt.
  const fx = ARCADE_FX_SPECS as Record<string, { height: number }>;
  ok(fx.breaker!.height === 730 && fx.rally!.height === 730 && fx.wavefront!.height === 730 && fx.burst!.height === 650, "ARCADE_FX_SPECS hold the taller heights rooms deal");
  ok(breakerFxFor({ worldH: 730 } as BrkState).height === 730 && breakerFxFor({} as BrkState) === BREAKER_FX, "Breaker effects by state height");
  ok(rallyFxFor({ worldH: 730 } as RallyState).height === 730 && rallyFxFor({} as RallyState) === RALLY_FX, "Rally effects by state height");
  ok(wavefrontFxFor({ worldH: 730 } as WavState).height === 730 && wavefrontFxFor({} as WavState) === WAVEFRONT_FX, "Wavefront effects by state height");
  ok(burstFxFor({ worldH: 650 } as BurstState).height === 650 && burstFxFor({} as BurstState) === BURST_FX, "Fission effects by state height");

  // Reveals and intro demos: the stored revision's height; older rounds keep theirs.
  const rh = (type: string, puzzle: any) => revealWorldH(ARCADE_REVEAL_RENDERERS[type]!, { type, seed: 1, ...puzzle });
  ok(rh("breaker", { brkRev: BRK_REV_TALL }) === 730 && rh("breaker", { brkRev: BRK_REV_TUNEF }) === 620 && rh("breaker", {}) === 620, "Breaker reveal height by revision");
  ok(rh("rally", { rallyRev: RALLY_REV_TALL }) === 730 && rh("rally", { rallyRev: RALLY_REV_TUNEF }) === 620, "Rally reveal height by revision");
  ok(rh("wavefront", { wavRev: WAV_REV_TALL }) === 730 && rh("wavefront", { wavRev: WAV_REV_TUNEC }) === 620, "Wavefront reveal height by revision");
  ok(rh("burst", { burstRev: BURST_REV_TALL }) === 650 && rh("burst", { burstRev: BURST_REV_BAND }) === 560, "Fission reveal height by revision");

  // Stages size their arena slot from the stored revision (uniform scale only).
  ok(/const BRK_WORLD_H = breakerWorldHFor\(data\?\.brkRev\)/.test(read("src/puzzles/breaker.tsx")) && /<ArcadeArenaSlot width=\{BRK_WORLD_W\} height=\{BRK_WORLD_H\}[\s>]/.test(read("src/puzzles/breaker.tsx")), "Breaker stage sizes from breakerWorldHFor");
  ok(/height=\{rallyWorldHFor\(data\.rallyRev\)\}/.test(read("src/puzzles/rally.tsx")), "Rally stage sizes from rallyWorldHFor");
  ok(/wavefrontWorldHFor\(data\?\.wavRev\)/.test(read("src/puzzles/wavefront.tsx")) && /worldH=\{worldH\}/.test(read("src/puzzles/wavefront.tsx")), "Wavefront stage sizes from wavefrontWorldHFor");
  ok(/worldH=\{burstWorldHFor\(data\?\.burstRev\)\}/.test(read("src/puzzles/burst.tsx")), "Fission stage sizes from burstWorldHFor");
}

/* ============================== 3. Per game ============================== */
section("Breaker: more room between the bricks and the paddle");
{
  const s = breakerGameFor(BRK_REV_TALL).init(5);
  ok(brkPaddleY(s) === BRK_TALL_H - BRK_PADDLE_LIFT - BRK_PADDLE_H && brkPaddleY(s) === 658 && brkPaddleY({}) === 548, "paddle 72 px above the bottom: 658 (548 on the 620 court)");
  ok(s.bricks.length === BRK_BRICKS && s.slide?.length === 2 && s.tune === 2, "80 bricks, two sliding rows, the 2.5 s Fireball");
  // A ball falling past the paddle line is lost only past the taller bottom.
  const game = breakerGameFor(BRK_REV_TALL);
  let t: BrkState = { ...s, balls: [{ x: 30 * 256, y: 680 * 256, vx: 0, vy: 1024, spam: 0 }], paddleX: 300, aimX: 300 };
  t = game.step(t, null);
  ok(t.balls.length === 1 && t.losses === 0, "a ball at y 680 is still in play on the taller court");
  for (let i = 0; i < 20; i++) t = game.step(t, null);
  ok(t.losses === 1, "a ball past 730 is lost");
  // A capsule is caught on the lower paddle.
  let c: BrkState = { ...s, capsules: [{ x: s.paddleX * 256, y: (658 - 4) * 256, kind: 1 }] };
  c = game.step(c, null);
  ok(c.powerUps === 1 && c.held === 2, "a capsule is caught on the lower paddle");
}

section("Rally: a taller court, the same pads, bumpers and gold balls");
{
  const top = RALLY_HUD_H + RALLY_WALL;
  let minGap = Infinity;
  for (let seed = 1; seed <= 400; seed++) {
    const s6 = rallyGameFor(RALLY_REV_TALL).init(seed * 7919);
    const s5 = rallyGameFor(RALLY_REV_TUNEF).init(seed * 7919);
    ok(s6.bumper!.x === s5.bumper!.x && s6.bumper2!.x === s5.bumper2!.x, `seed ${seed}: bumpers keep their spot across`);
    ok(s6.bumper!.y > s5.bumper!.y && s6.bumper2!.y > s5.bumper2!.y, `seed ${seed}: bumpers move down the longer court`);
    for (const b of [s6.bumper!, s6.bumper2!])
      ok(b.y - RALLY_BUMPER_R > top + 4 * RALLY_BALL_R && b.y + RALLY_BUMPER_R + 2 * RALLY_BALL_R + 120 < rallyPaddleY(s6), `seed ${seed}: bumper clear of the top and well above the paddle`);
    minGap = Math.min(minGap, Math.hypot(s6.bumper!.x - s6.bumper2!.x, s6.bumper!.y - s6.bumper2!.y));
  }
  ok(minGap >= RALLY_BUMPER2_GAP, `the two bumpers stay at least ${RALLY_BUMPER2_GAP} px apart (closest ${minGap.toFixed(1)})`);
  ok(rallyPaddleY({ worldH: RALLY_TALL_H }) === RALLY_TALL_H - RALLY_PADDLE_LIFT && rallyPaddleY({}) === 560, "paddle 60 px above the bottom: 670 (560 on the 620 court)");
}

section("Wavefront: more room between the formation and the ship");
{
  const s = wavefrontGameFor(WAV_REV_TALL).init(9);
  ok(wavShipY(s) === WAV_TALL_H - WAV_SHIP_LIFT && wavShipY(s) === 664 && wavShipY({}) === 554, "ship line 66 px above the bottom: 664 (554 in the 620 world)");
  ok(wavDragZoneTop(WAV_TALL_H) === 548 && wavDragZoneTop(WAV_WORLD_H) === WAV_DRAG_ZONE_TOP, "drags start in the bottom quarter of each world");
  ok(wavBoltSpeedFp(s) === 10 * 256 && wavBoltSpeedFp({}) === 8 * 256, "bolts fly 10 px a tick in the taller world (8 before)");
  // From the lower ship line, a bolt reaches the formation's first row and the boss in about the old time.
  const old = (554 - 26 - 84) / 8;
  const now = (664 - 26 - 84) / 10;
  ok(Math.abs(now - old) <= old * 0.05, `a bolt reaches the top row in ${now.toFixed(1)} ticks (${old.toFixed(1)} before)`);
  // The formation reaching the ship's line ends the run only at the lower line.
  const game = wavefrontGameFor(WAV_REV_TALL);
  let t: WavState = { ...s, enter: 0, fy: 554 - 28 - 12 - 2 * 36 - 4 * 36 };
  t = game.step(t, null);
  ok(t.ended === 0, "a formation at the old ship line has not reached the taller one");
}

section("Fission: a taller arena, every height scaled with it");
{
  const g0 = burstGeometry(BURST_FLOOR_Y);
  const g1 = burstGeometry(BURST_TALL_H);
  ok(g0.floor === 560 && g0.arenaH === 520 && g0.ceilMax === 248 && g0.ceilStep === 40, "the 560 floor keeps the original geometry");
  ok(g1.floor === 650 && g1.arenaH === 610 && g1.ceilMax === 650 - Math.trunc(610 * 0.6) && g1.ceilStep === 46, "the 650 floor: arena 610, ceiling down to 60 %, 46 px a wave");
  for (let size = 0; size < 4; size++) {
    const apex = (g: typeof g0) => (g.bounceV[size]! ** 2) / (2 * 32) / 256;
    const share0 = apex(g0) / g0.arenaH;
    const share1 = apex(g1) / g1.arenaH;
    ok(Math.abs(share0 - share1) < 0.005, `size ${size}: bounces to ${(share1 * 100).toFixed(1)} % of the taller arena (${(share0 * 100).toFixed(1)} % before)`);
  }
  for (const wave of [1, 6, 9, 12, 20, 41]) {
    const old = (burstCeiling(wave, 560) - 40) / g0.arenaH;
    const now = (burstCeiling(wave, 650) - 40) / g1.arenaH;
    ok(Math.abs(old - now) < 0.02, `wave ${wave}: the ceiling is ${(now * 100).toFixed(1)} % down the taller arena (${(old * 100).toFixed(1)} % before)`);
  }
  // A run on the taller arena: atoms reach high and land on the 650 floor.
  const game = burstGameFor(BURST_REV_TALL);
  let s = game.init(31);
  let low = 0;
  let high = 1e9;
  for (let i = 0; i < 1200; i++) {
    s = game.step(s, null);
    for (const b of s.balls) {
      low = Math.max(low, b.y / 256);
      high = Math.min(high, b.y / 256);
    }
  }
  ok(burstFloorY(s) === 650 && low > 600 && low <= 650, `atoms land on the 650 floor (lowest centre ${low.toFixed(0)})`);
  ok(high < 200, `atoms still use the whole height (highest centre ${high.toFixed(0)})`);
}

/* ============================== 4. Bands ============================== */
section("Refitted curves keep the band rules; 150 is reachable");
{
  const curves: [string, BandCurve, "finish" | "open", number | null][] = [
    ["breaker", BRK_V6_BAND_CURVE, "finish", 1],
    ["rally", RALLY_V6_BAND_CURVE, "open", null],
    ["wavefront", WAV_V6_BAND_CURVE, "finish", 1],
    ["burst", BURST_V4_BAND_CURVE, "finish", null],
  ];
  for (const [type, curve, kind, unit] of curves) {
    const { units, points } = curve;
    ok(units[0] === 0 && points[0] === 0, `${type}: curve starts at (0, 0)`);
    for (let i = 1; i < units.length; i++) ok(units[i]! > units[i - 1]! && points[i]! >= points[i - 1]!, `${type}: knot ${i} ascends and never falls`);
    ok(Math.max(...points) === (kind === "open" ? 150 : BAND_PARTIAL_TOP) && bandPoints(curve, bandTop(curve)) === Math.max(...points), `${type}: tops out at ${Math.max(...points)}`);
    if (unit) {
      const full = units.at(-1)!;
      ok(bandPoints(curve, full) + BAND_FINISH_BONUS - bandPoints(curve, full - unit) <= 12, `${type}: one unit short of a finish is at most 12 below it`);
    }
  }
  ok(WAV_V6_BAND_CURVE.units.at(-1) === WAV_PAR_V5 - WAV_POINTS_BOSS, "Wavefront: 140 at every ship, armour hit, wave and boss hit");
  // An idle run scores 0.
  for (const [type, game] of [["breaker", breakerGameFor(BRK_REV_TALL)], ["rally", rallyGameFor(RALLY_REV_TALL)], ["wavefront", wavefrontGameFor(WAV_REV_TALL)], ["burst", burstGameFor(BURST_REV_TALL)]] as const) {
    let s: any = (game as any).init(3);
    while (!(game as any).isOver(s) && s.tick < (game as any).runTicks) s = (game as any).step(s, null);
    ok((game as any).score(s) === 0, `${type}: doing nothing scores 0`);
  }
  // Best scores through the server replay (skill-band near-perfect players on fixed room seeds).
  const proofs: [string, number, number][] = [
    ["breaker", BRK_REV_TALL, 7],
    ["rally", RALLY_REV_TALL, 14],
    ["wavefront", WAV_REV_TALL, 4],
    ["burst", BURST_REV_TALL, 4],
  ];
  for (const [type, rev, n] of proofs) {
    const { score, result } = await botRun(type, rev, "near", n);
    ok(result.score === 150 && score === 150 && !result.flagged, `${type} rev ${rev}: a near-perfect run reaches ${result.score} through the server replay`);
    console.log(`  ${type} rev ${rev}: 150 via the server replay (room seed ${n})`);
  }
}

/* ============================== 5. Intro demos ============================== */
section("Intro demos stay stopped until re-recorded on the taller revision");
{
  const src = read("src/lib/duel/introDemo.functions.ts");
  ok(/data\.type === "breaker" && demo\?\.puzzle\.type === "breaker" && demo\.puzzle\.brkRev !== BRK_REV_TALL\) return null/.test(src), "Breaker's demo plays only on brkRev 6");
  ok(/data\.type === "rally" && demo\?\.puzzle\.type === "rally" && demo\.puzzle\.rallyRev !== RALLY_REV_TALL\) return null/.test(src), "Rally's demo plays only on rallyRev 6");
  // Expansion E8: Wavefront's demo now plays only on wavRev 9 (none is recorded yet, so the intro shows its still).
  ok(/data\.type === "wavefront" && demo\?\.puzzle\.type === "wavefront" && demo\.puzzle\.wavRev !== WAV_REV_EXPAND\) return null/.test(src), "Wavefront's demo plays only on wavRev 9");
  ok(/data\.type === "burst" && demo\?\.puzzle\.type === "burst" && demo\.puzzle\.burstRev !== BURST_REV_TALL\) return null/.test(src), "Fission's demo plays only on burstRev 4");
}

if (failures.length) {
  console.log(`FAIL arcade-tuning-g1: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`arcade-tuning-g1: ${checks} checks passed — 88 stored runs on every older revision and 32 on the taller ones replay unchanged; rooms deal brkRev 6, rallyRev 6, wavRev 6 and burstRev 4; worlds, reveals and effects by revision; per-game geometry; refitted curves and 150 via the server replay; demos stopped`);
