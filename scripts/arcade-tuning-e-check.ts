/**
 * Tuning E (Oct 2026): taller worlds for High Rise (skylineRev 4), Meteor
 * (snakeRev 5), Scrumper (snipRev 5) and Hover (hoverRev 5), deeper Scrumper
 * levels with picker's crooks, and Hover's star field (display only).
 *
 *  1. Old rounds: 32 real runs recorded with the code before Tuning E on each
 *     game's then-live revision (scripts/fixtures/arcade-tuning-e-legacy.json,
 *     scripts/arcade-tuning-e-legacy.ts) replay through today's server path to
 *     the same score and the same final state, unflagged; old states carry
 *     none of the new fields.
 *  2. New rounds carry the new stamps, score on the bands, and every phone
 *     gets the same world: the arena, reveal and effects take the height from
 *     the stored revision, uniform scale only.
 *  3. Per game: High Rise plays and scores exactly as skylineRev 3; Meteor's
 *     28-row grid (stars, rocks and shower squares inside it); Hover's course
 *     spread over the taller world with the same barriers, kinds and stars;
 *     Scrumper's 2 easy / 3 medium / 5 hard mix of tall templates, the crook's
 *     catch rules, a stored human-paced winning plan for every template at
 *     every pin wobble, several parts on every hard level, ten levels inside
 *     the minute; and the best reachable score through the server replay.
 *  4. Intro and "?" help say what changed.
 *
 *   bun scripts/arcade-tuning-e-check.ts          (TUNING_E_ONLY=hover,snip,…)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SNAKE_V9_H, SNAKE_V9_WORLD_W } from "../src/lib/arcade/snake";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import { TUNING_E_GAMES, type TuningERecord } from "./arcade-tuning-e-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel, type SkillProfile } from "./arcade-skill-bands/human";
import { puzzleUsesBands } from "../src/lib/arcade/bandParts";
import { bandPoints, bandTop } from "../src/lib/arcade/scoreBands";
import { ARCADE_FX_SPECS, HOVER_FX, SKYLINE_FX, SNAKE_FX, SNIP_FX, hoverFxFor, skylineFxFor, snakeFxFor, snipFxFor } from "../src/lib/arcade/arcadeFxGames.renderer";
import { ARCADE_REVEAL_RENDERERS, revealWorldH } from "../src/lib/arcade/revealRenderers";
import {
  hoverGameFor,
  hoverDrift,
  HOVER_DRIFT_STEP,
  HOVER_DISC_R,
  HOVER_GAP_MARGIN,
  HOVER_MOVE_AMP,
  HOVER_REACHABLE_GATES,
  HOVER_REV_TALL,
  HOVER_REV_TUNEC,
  HOVER_TALL_H,
  HOVER_V5_BAND_CURVE,
  HOVER_WORLD_H,
  hoverWorldHFor,
  type HoverState,
} from "../src/lib/arcade/hover";
import { skylineGameFor, SKYLINE_REV_BAND, SKYLINE_REV_EXPAND, SKYLINE_REV_LIFT, SKYLINE_REV_STD, SKYLINE_REV_TALL, SKYLINE_TALL_H, SKYLINE_WORLD_H, skylineWorldHFor } from "../src/lib/arcade/skyline";
import {
  snakeCol,
  snakeGameFor,
  snakeRow,
  SNAKE_COLS,
  SNAKE_REV_BAND,
  SNAKE_REV_TALL,
  SNAKE_REV_ROCKS,
  SNAKE_TALL_H,
  SNAKE_TALL_ROWS,
  SNAKE_V5_BAND_CURVE,
  SNAKE_WORLD_H,
  snakeWorldHForRev,
  type SnakeState,
} from "../src/lib/arcade/snake";
import {
  snipGameFor,
  snipLevelOrderTall,
  snipTestLevel,
  SNIP_BANDS_TALL,
  SNIP_CONFIG,
  SNIP_H,
  SNIP_HOOK_REACH,
  SNIP_LEVEL_TICKS,
  SNIP_REV_BAND,
  SNIP_REV_PROVEN,
  SNIP_REV_TALL,
  SNIP_REV_EXPAND,
  SNIP_RUN_TICKS,
  SNIP_TALL_FIRST,
  SNIP_TALL_H,
  SNIP_V5_BAND_CURVE,
  snipWorldHFor,
  type SnipState,
} from "../src/lib/arcade/snip";
import { encodeSnipRun, replaySnipRun } from "../src/lib/duel/snip";
import { generateSkyline, generateSnake, generateSnip } from "../src/lib/duel/arcade.server";
import { generateHover } from "../src/lib/duel/hover.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { playSnipLevel } from "./snip-solver";
import { playSnipRun, SNIP_PROOFS } from "./snip-run-bot";
import { playRevOf } from "./scoring-targets-revs";

/** A flawless player for best-score proofs: quick, never lapses, no timing, aim or judgement error. */
const PERFECT: SkillProfile = { reactionMs: [120, 0], lapse: 0, timingSdMs: 0, aimSdPx: 0, powerSd: 0, mistake: 0, thinkScale: 0.3, judgement: 0, trackLagMs: 30 };

const ONLY = (process.env.TUNING_E_ONLY ?? "").split(",").filter(Boolean);
const want = (type: string) => ONLY.length === 0 || ONLY.includes(type);
const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const section = (name: string) => console.log(`— ${name}`);

/** A skill-band player's run on a revision, sent through the server's encode + replay. */
async function botRun(type: string, rev: number, level: SkillLevel, n: number, profile?: SkillProfile) {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const { bot } = await import(`./arcade-skill-bands/bots/${type}.ts`);
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const human = new Human(spec.type, seed, level);
  if (profile) (human as unknown as { p: SkillProfile }).p = profile;
  const out = bot({ game, seed, rev, human });
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  const byTick = new Map((out.events ?? []).map((e: any) => [e.t, e]));
  const taps = new Set(out.taps ?? []);
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, spec.taps ? taps.has(t) : (byTick.get(t) ?? null));
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const score = game.score(state);
  const raw = spec.encode({ seed, claimedScore: score, events: out.events ?? [], inputs: out.taps ?? [], taps: [], endTick: state.tick, checkpoints }, rev, seed);
  return { state, score, raw, seed, result: spec.replay(seed, raw, rev) };
}

/* ============================== 1. Old rounds ============================== */
section("Old rounds replay and score exactly as before");
{
  const fixture = JSON.parse(readFileSync("scripts/fixtures/arcade-tuning-e-legacy.json", "utf8")) as { runs: TuningERecord[] };
  const per = new Map<string, number>();
  for (const run of fixture.runs) {
    if (!want(run.type)) continue;
    const spec = GAME_BY_TYPE.get(run.type as never)!;
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = spec.replay(run.seed, raw, run.rev);
    ok(result.score === run.score && !result.flagged, `${run.type} ${run.level}: stored ${run.score}, replays ${result.score}${result.flagged ? " (flagged)" : ""}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `${run.type} ${run.level}: the replayed final state is byte-identical`);
    const s = result.state as Record<string, unknown>;
    ok(s.worldH === undefined && s.rows === undefined && s.hooked === undefined, `${run.type} ${run.level}: an old state has no Tuning E field`);
    per.set(run.type, (per.get(run.type) ?? 0) + 1);
  }
  for (const [type] of TUNING_E_GAMES) if (want(type)) ok((per.get(type) ?? 0) >= 8, `${type}: ${per.get(type) ?? 0} recorded runs`);
}

/* ======================== 2. Stamps, worlds and arenas ======================== */
section("New rounds carry the Tuning E stamps; one world per stored revision");
{
  const stamps: [string, string, number | undefined, number][] = [
    // Tuning F moved Meteor rooms on to snakeRev 6: the same tall grid with more rocks (arcade-tuning-f-check).
    // Expansion E2 (25 Oct 2026) then moved Meteor on to its wider, taller field (snakeRev 9); expansion-e2-check covers it.
    // Joe's phone notes (27 Oct 2026) then moved it on to snakeRev 10 (the same field); snake-rev10-check covers it.
    ["snake", "snakeRev", playRevOf("snake", generateSnake().snakeRev), SNAKE_REV_ROCKS + 4],
    // Scrumper rooms moved on to snipRev 6 (the same tall game on a bigger bank; scripts/snip-bank6-check.ts),
    // then snipRev 7 (the same game with every per-pin deal proven; scripts/snip-rev7-check.ts).
    // The 200-point expansion (26 Oct 2026) then moved Scrumper on to its tall courses (snipRev 11); snip-x200-check covers it.
    ["snip", "snipRev", playRevOf("snip", generateSnip().snipRev), SNIP_REV_EXPAND],
    // The 200 expansion (26 Oct 2026) then moved Hover on to hoverRev 9 (390 × 727, tight gates, centre lines, star
    // chains, shields); hover-x200-check covers it.
    ["hover", "hoverRev", playRevOf("hover", generateHover().hoverRev), HOVER_REV_TALL + 4],
  ];
  // Expansion E4 (25 Oct 2026) moved High Rise on to skylineRev 7 (e4-expansion-check covers it); its tall world
  // started with skylineRev 4, which stored rounds still play and score on the bands.
  // The arcade scoring standard (29 Oct 2026) moved it on to skylineRev 9 (rev 8's play; skyline-standard-check covers it).
  ok(generateSkyline().skylineRev === SKYLINE_REV_STD, `skyline: rooms deal skylineRev ${SKYLINE_REV_STD} (the arcade scoring standard, after skylineRev ${SKYLINE_REV_LIFT} and ${SKYLINE_REV_TALL})`);
  ok(puzzleUsesBands({ type: "skyline", skylineRev: SKYLINE_REV_TALL } as never), `skyline ${SKYLINE_REV_TALL} scores on the bands`);
  for (const [type, field, got, rev] of stamps) {
    ok(got === rev, `${type}: new rounds stamped ${rev} (got ${got})`);
    ok(puzzleUsesBands({ type, [field]: rev } as never), `${type} ${rev} scores on the bands`);
  }
  // World heights by stored revision: old revisions keep the old world, new ones the taller one.
  ok(hoverWorldHFor(HOVER_REV_TALL) === HOVER_TALL_H && hoverWorldHFor(HOVER_REV_TUNEC) === HOVER_WORLD_H && hoverWorldHFor(undefined) === HOVER_WORLD_H, "Hover: 390 × 735 on hoverRev 5, 390 × 560 before");
  ok(skylineWorldHFor(SKYLINE_REV_TALL) === SKYLINE_TALL_H && skylineWorldHFor(SKYLINE_REV_BAND) === SKYLINE_WORLD_H, "High Rise: 390 × 735 on skylineRev 4, 390 × 560 before");
  ok(snakeWorldHForRev(SNAKE_REV_TALL) === SNAKE_TALL_H && SNAKE_TALL_H === 724 && snakeWorldHForRev(SNAKE_REV_BAND) === SNAKE_WORLD_H, "Meteor: 390 × 724 on snakeRev 5, 390 × 532 before");
  ok(snipWorldHFor(SNIP_REV_TALL) === SNIP_TALL_H && SNIP_TALL_H === 640 && snipWorldHFor(SNIP_REV_BAND) === SNIP_H, "Scrumper: 360 × 640 on snipRev 5, 360 × 560 before");
  // The arena table (presentation-geometry) uses the worlds rooms deal today.
  // Hover: hoverRev 9's 727-high world since the 200 expansion (hover-x200-check).
  ok(ARCADE_FX_SPECS.hover.height === hoverWorldHFor(generateHover().hoverRev) && hoverWorldHFor(generateHover().hoverRev) >= 727 && ARCADE_FX_SPECS.skyline.height === skylineWorldHFor(generateSkyline().skylineRev) && skylineWorldHFor(generateSkyline().skylineRev) >= SKYLINE_TALL_H && ARCADE_FX_SPECS.snake.height === SNAKE_V9_H && ARCADE_FX_SPECS.snake.width === SNAKE_V9_WORLD_W && SNAKE_V9_H > SNAKE_TALL_H && ARCADE_FX_SPECS.snip.height === snipWorldHFor(generateSnip().snipRev) && snipWorldHFor(generateSnip().snipRev) > SNIP_TALL_H, "the live arena sizes are the taller worlds (Meteor: snakeRev 9's bigger field since expansion E2; Hover: hoverRev 9's since the 200 expansion; Scrumper: snipRev 11's course view)");
  // Effects follow the state's own world; old states keep the old spec object.
  const states = {
    hover: [hoverGameFor(HOVER_REV_TUNEC).init(5), hoverGameFor(HOVER_REV_TALL).init(5)],
    skyline: [skylineGameFor(SKYLINE_REV_BAND).init(5), skylineGameFor(SKYLINE_REV_TALL).init(5)],
    snake: [snakeGameFor(SNAKE_REV_BAND).init(5), snakeGameFor(SNAKE_REV_TALL).init(5)],
    snip: [snipGameFor(SNIP_REV_BAND).init(5), snipGameFor(SNIP_REV_TALL).init(5)],
  };
  ok(hoverFxFor(states.hover[0] as HoverState) === HOVER_FX && hoverFxFor(states.hover[1] as HoverState).height === HOVER_TALL_H, "Hover effects: old spec for old rounds, the tall one for new");
  ok(skylineFxFor(states.skyline[0] as never) === SKYLINE_FX && skylineFxFor(states.skyline[1] as never).height === SKYLINE_TALL_H, "High Rise effects follow the round");
  ok(snakeFxFor(states.snake[0] as never) === SNAKE_FX && snakeFxFor(states.snake[1] as never).height === SNAKE_TALL_H, "Meteor effects follow the round");
  ok(snipFxFor(states.snip[0] as never) === SNIP_FX && snipFxFor(states.snip[1] as never).height === SNIP_TALL_H, "Scrumper effects follow the round");
  // Reveals and intro demos draw at the stored round's height.
  const puzzles = [
    [{ type: "hover", seed: 5, hoverRev: HOVER_REV_TALL }, HOVER_TALL_H, { type: "hover", seed: 5, hoverRev: HOVER_REV_TUNEC }, HOVER_WORLD_H],
    [{ type: "skyline", seed: 5, skylineRev: SKYLINE_REV_TALL }, SKYLINE_TALL_H, { type: "skyline", seed: 5, skylineRev: SKYLINE_REV_BAND }, SKYLINE_WORLD_H],
    [{ type: "snake", seed: 5, snakeRev: SNAKE_REV_TALL }, SNAKE_TALL_H, { type: "snake", seed: 5, snakeRev: SNAKE_REV_BAND }, SNAKE_WORLD_H],
    [{ type: "snip", seed: 5, snipRev: SNIP_REV_TALL }, SNIP_TALL_H, { type: "snip", seed: 5, snipRev: SNIP_REV_BAND }, SNIP_H],
  ] as const;
  for (const [tall, th, old, oh] of puzzles) {
    const r = ARCADE_REVEAL_RENDERERS[tall.type]!;
    ok(revealWorldH(r, tall as never) === th && revealWorldH(r, old as never) === oh, `${tall.type}: the reveal draws at the stored round's height`);
  }
  // Every phone: the arena slot gets the stored revision's world (uniform fit; ArcadeArenaSlot never stretches).
  const stage = (file: string, fn: string) => readFileSync(`src/puzzles/${file}.tsx`, "utf8").includes(fn);
  ok(stage("hover", "height={hoverWorldHFor(data.hoverRev)}") && stage("skyline", "height={skylineWorldHFor(data.skylineRev)}") && stage("snake", "height={snakeWorldHForRev(data.snakeRev)}") && stage("snip", "height={snipWorldHFor(data.snipRev)}"), "each stage sizes its arena from the stored revision");
  ok(stage("snip", "snipView({ width: box.width, height: box.height }, snipWorldHFor(data.snipRev))"), "Scrumper maps swipes through the round's own world height");
}

/* The new curves keep the band rules (as arcade-score-bands-check applies them to BAND_SPECS). */
section("New curves keep the band rules");
{
  const rules = (name: string, curve: { units: readonly number[]; points: readonly number[] }, kind: "open" | "finish", last?: { unit: number; extra: number; extras: number }) => {
    ok(curve.units[0] === 0 && curve.points[0] === 0, `${name}: starts at (0, 0)`);
    for (let i = 1; i < curve.units.length; i++) ok(curve.units[i]! > curve.units[i - 1]! && curve.points[i]! >= curve.points[i - 1]!, `${name}: rises between knots ${i - 1} and ${i}`);
    ok(curve.points.at(-1) === (kind === "open" ? 150 : 140), `${name}: tops out at ${kind === "open" ? 150 : 140}`);
    if (last) {
      const top = bandTop(curve as never);
      for (let k = 0; k <= last.extras; k++) {
        const full = top - last.extra * (last.extras - k);
        ok(bandPoints(curve as never, full) + 10 - bandPoints(curve as never, full - last.unit) <= 12, `${name}: one unit short is within 12 of a finish with ${k} extras`);
      }
    }
  };
  rules("Meteor snakeRev 5", SNAKE_V5_BAND_CURVE, "open");
  rules("Scrumper snipRev 5", SNIP_V5_BAND_CURVE, "finish", { unit: 10, extra: 2, extras: 10 });
  rules("Hover hoverRev 5", HOVER_V5_BAND_CURVE, "finish", { unit: 3, extra: 2, extras: 10 });
}

/* ============================== 3a. High Rise ============================== */
if (want("skyline")) {
  section("High Rise skylineRev 4: a taller view, the same play and score");
  const band = skylineGameFor(SKYLINE_REV_BAND);
  const tall = skylineGameFor(SKYLINE_REV_TALL);
  let same = true;
  for (let seed = 1; seed <= 40; seed++) {
    let a = band.init(seed);
    let b = tall.init(seed);
    let x = seed * 7919;
    while (!band.isOver(a)) {
      x = (Math.imul(x, 1103515245) + 12345) | 0;
      const tap = ((x >>> 8) & 31) === 0;
      a = band.step(a, tap);
      b = tall.step(b, tap);
    }
    const { worldH, ...rest } = b as typeof b & { worldH?: number };
    same &&= worldH === SKYLINE_TALL_H && JSON.stringify(rest) === JSON.stringify(a) && band.score(a) === tall.score(b);
  }
  ok(same, "40 seeded runs: identical states (but the view height) and identical scores");
}

/* ============================== 3b. Meteor ============================== */
if (want("snake")) {
  section("Meteor snakeRev 5: a 15 × 28 grid");
  const game = snakeGameFor(SNAKE_REV_TALL);
  let inside = true;
  let tallUsed = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const s = game.init(seed) as SnakeState;
    inside &&= s.rows === SNAKE_TALL_ROWS && s.queue.every((c) => c >= 0 && c < SNAKE_COLS * SNAKE_TALL_ROWS);
    inside &&= snakeRow(s.body[0]!) === SNAKE_TALL_ROWS >> 1 && snakeCol(s.body[0]!) === SNAKE_COLS >> 1;
    const rockCells = [...(s.rockSlots ?? []).map((r) => r.cell), ...(s.showerCells ?? [])];
    inside &&= rockCells.every((c) => snakeRow(c) >= 1 && snakeRow(c) <= SNAKE_TALL_ROWS - 2 && snakeCol(c) >= 1 && snakeCol(c) <= SNAKE_COLS - 2 && !s.queue.includes(c));
    if (s.queue.some((c) => snakeRow(c) >= 20)) tallUsed++;
  }
  ok(inside, "200 seeds: stars, rocks and shower squares inside the 28 rows; rocks off the border and never on a star; the meteor starts in the middle");
  ok(tallUsed === 200, "every seed puts stars in the new rows");
  // The wall is the 28th row: running straight down ends the run there.
  let s = game.init(3) as SnakeState;
  s = game.step(s, { t: 1, k: 4, a: 1, b: 0, c: 0, d: 0 }) as SnakeState;
  for (let k = 0; k < 20; k++) s = game.step(s, null) as SnakeState;
  s = game.step(s, { t: s.tick + 1, k: 4, a: 2, b: 0, c: 0, d: 0 }) as SnakeState;
  let lastRow = 0;
  while (!game.isOver(s)) {
    lastRow = snakeRow(s.body[0]!);
    s = game.step(s, null) as SnakeState;
  }
  ok(s.dead && lastRow === SNAKE_TALL_ROWS - 1, `heading down, the head reaches row ${SNAKE_TALL_ROWS} before the wall (last row ${lastRow + 1})`);
  ok(bandTop(SNAKE_V5_BAND_CURVE) === 34 && bandPoints(SNAKE_V5_BAND_CURVE, 34) === 150, "150 at 34 stars on the taller grid");
  let best = 0;
  for (let n = 0; n < 4 && best < 150; n++) {
    const run = await botRun("snake", SNAKE_REV_TALL, "near", n, PERFECT);
    ok(run.result.score === run.score && !run.result.flagged, `seed ${run.seed}: server replay agrees (${run.score})`);
    best = Math.max(best, run.result.score);
  }
  ok(best === 150, `150 is reachable on snakeRev 5 through the server replay (best ${best})`);
}

/* ============================== 3c. Hover ============================== */
if (want("hover")) {
  section("Hover hoverRev 5: the course drifting over a 735 px world");
  const old = hoverGameFor(HOVER_REV_TUNEC);
  const game = hoverGameFor(HOVER_REV_TALL);
  const bottom = HOVER_TALL_H * 256;
  let sameCourse = true;
  let fits = true;
  let climbs = true;
  let lowGaps = 0;
  let highGaps = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const a = old.init(seed) as HoverState;
    const b = game.init(seed) as HoverState;
    sameCourse &&= b.worldH === HOVER_TALL_H && b.y === a.y + hoverDrift(seed, 0, bottom) && b.totalGates === a.totalGates && b.totalStars === a.totalStars && b.pillars.length === a.pillars.length;
    b.pillars.forEach((p, i) => {
      const q = a.pillars[i]!;
      const drift = hoverDrift(seed, i, bottom);
      // The same barrier moved down by its drift: gap sizes, slides, second gap and star all kept.
      sameCourse &&= drift >= 0 && drift <= bottom - (HOVER_WORLD_H * 256) && JSON.stringify({ ...p, gapTop: p.gapTop - drift, ...(p.gap2Top !== undefined ? { gap2Top: p.gap2Top - drift } : {}) }) === JSON.stringify(q);
      const swing = p.movePhase !== undefined ? HOVER_MOVE_AMP : 0;
      fits &&= p.gapTop - swing >= HOVER_GAP_MARGIN && Math.max(p.gapTop + p.gapH, p.gap2Top !== undefined ? p.gap2Top + (p.gap2H ?? 0) : 0) + swing <= bottom - HOVER_GAP_MARGIN;
      if (i > 0) climbs &&= Math.abs(drift - hoverDrift(seed, i - 1, bottom)) <= HOVER_DRIFT_STEP * 256;
      if (i < HOVER_REACHABLE_GATES) {
        if (p.gapTop + p.gapH > HOVER_WORLD_H * 256) lowGaps++;
        if (p.gapTop < 100 * 256) highGaps++;
      }
    });
  }
  ok(sameCourse, "300 seeds: the same barriers, gap sizes, spacing, kinds, slides and stars, each moved down by its drift; the disc starts with the first barrier's drift");
  ok(fits, "every gap (and every sliding gap's whole sweep) sits inside the margins of the taller world");
  ok(climbs, `each climb from one barrier to the next changes by at most ${HOVER_DRIFT_STEP} px`);
  ok(lowGaps > 1000 && highGaps > 300, `gaps use the whole height: ${lowGaps} reach below the old 560 px floor, ${highGaps} sit in the top 100 px`);
  ok(HOVER_DISC_R > 0 && bandPoints(HOVER_V5_BAND_CURVE, 3 * HOVER_REACHABLE_GATES + 20) === 140, "every barrier and star still reaches 140 (plus 10 for lasting the minute)");
  let best = 0;
  // Room seeds 43, 10, 33 (skill-band numbering): a flawless player threads every barrier and star on the first.
  for (const n of [43, 10, 33]) {
    const run = await botRun("hover", HOVER_REV_TALL, "near", n, PERFECT);
    ok(run.result.score === run.score && !run.result.flagged, `seed ${run.seed}: server replay agrees (${run.score})`);
    best = Math.max(best, run.result.score);
  }
  ok(best === 150, `150 is reachable on hoverRev 5 through the server replay (best ${best})`);
  const art = readFileSync("src/lib/arcade/hover.renderer.ts", "utf8");
  ok(art.includes("drawStarField(ctx, state, HOVER_WORLD_H)") && /a: 0\.16 \+ next\(\) \* 0\.16/.test(art) && art.includes("* 0.05"), "Hover's star field: dim (alpha 0.16–0.32), drifting at a twentieth of the scroll, drawn before the barriers");
}

/* ============================== 3d. Scrumper ============================== */
if (want("snip")) {
  section("Scrumper snipRev 5: taller, deeper levels with picker's crooks");
  const game = snipGameFor(SNIP_REV_TALL);
  const bands = SNIP_BANDS_TALL;
  const pool = [...bands.easy, ...bands.medium, ...bands.hard];
  ok(new Set(pool).size === pool.length && pool.every((t) => t >= SNIP_TALL_FIRST && SNIP_CONFIG.templates[t]?.h === SNIP_TALL_H), "the snipRev 5 bands draw only tall templates, each once");
  ok(SNIP_CONFIG.templates.slice(0, SNIP_TALL_FIRST).every((t) => !t.h && !t.hooks), "older templates have no height or crooks (their physics is untouched)");
  ok(pool.every((t) => SNIP_CONFIG.templates[t]!.pins.length + (SNIP_CONFIG.templates[t]!.hooks?.length ?? 0) <= 4), "at most four ropes and vines a level (the cut log packs the rope in 2 bits)");
  let mix = true;
  for (let seed = 1; seed <= 600; seed++) {
    const o = snipLevelOrderTall(seed);
    mix &&= new Set(o).size === 10 && o.slice(0, 2).every((t) => bands.easy.includes(t)) && o.slice(2, 5).every((t) => bands.medium.includes(t)) && o.slice(5).every((t) => bands.hard.includes(t));
  }
  ok(mix, "600 seeds: ten distinct levels, 2 easy, then 3 medium, then 5 hard");
  const s0 = game.init(42) as SnipState;
  ok(s0.worldH === SNIP_TALL_H && s0.rev === SNIP_REV_TALL && Boolean(s0.band), "the state carries the stamp, the taller world and the bands");
  // Obstacles: hard levels are busier than before.
  const obstacles = (t: number) => {
    const tpl = SNIP_CONFIG.templates[t]!;
    return tpl.platforms.length + (tpl.planks?.length ?? 0) + (tpl.gutters?.length ?? 0) + (tpl.springs?.length ?? 0) + (tpl.nests?.length ?? 0) + (tpl.slide ? 1 : 0) + (tpl.hooks?.length ?? 0);
  };
  const crooks = pool.filter((t) => SNIP_CONFIG.templates[t]!.hooks);
  ok(crooks.length >= 8 && crooks.every((t) => obstacles(t) >= (bands.hard.includes(t) ? 3 : 2)), `${crooks.length} crook levels, each with at least two obstacles (three on hard ones: crooks, nests, springs, planks…)`);
  // A hard crook level needs its catch: no plan cutting only the pins' ropes feeds the apple (seeded search, wobble 0).
  for (const t of crooks.filter((c) => bands.hard.includes(c))) {
    const n = SNIP_CONFIG.templates[t]!.pins.length;
    let x = t * 2654435761 >>> 0 || 1;
    const r = (k: number) => {
      x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
      return x % k;
    };
    let wins = 0;
    for (let k = 0; k < 120; k++) {
      const order = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = r(i + 1);
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      let at = 24 + r(260);
      const plan = order.map((rope) => {
        const step: [number, number] = [rope, at];
        at += 12 + r(160);
        return step;
      });
      if (playSnipLevel(t, 0, plan).eaten) wins++;
    }
    ok(wins <= 2, `template ${t} (${SNIP_CONFIG.templates[t]!.name}): cutting only the ropes almost never feeds the apple (${wins} of 120): it needs a cut, a catch and another cut`);
  }
  const avg = (ts: readonly number[]) => ts.reduce((n, t) => n + obstacles(t), 0) / ts.length;
  console.log(`  obstacles per hard level: ${avg(bands.hard).toFixed(1)} (snipRev 3 hard: ${avg([49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59]).toFixed(1)})`);
  ok(avg(bands.hard) > avg([49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59]), "hard levels carry more obstacles than snipRev 3's");

  // The crook's rules, on a crook level with the ropes gone.
  const ct = crooks[0]!;
  const [hx, hy] = SNIP_CONFIG.templates[ct]!.hooks![0]!;
  const free = (dy: number, vy: number, dx = 0): SnipState => {
    const s = { ...snipTestLevel(ct, 0), ropes: [] } as SnipState;
    return { ...s, sx: (hx + dx) * 256, sy: (hy + dy) * 256, sox: (hx + dx) * 256, soy: (hy + dy) * 256 - vy };
  };
  const run = (s: SnipState, ticks: number) => {
    for (let k = 0; k < ticks && s.level === 0; k++) s = game.step(s, null) as SnipState;
    return s;
  };
  const fromAbove = run(free(-30, 600), 20);
  ok(fromAbove.ropes.length === 1 && fromAbove.ropes[0]!.alive === 1 && (fromAbove.hooked ?? 0) === 1, "an apple falling past the hook from above is caught on a new vine");
  const vineLen = SNIP_CONFIG.templates[ct]!.hooks![0]![2];
  const hanging = run(fromAbove, 240);
  const d = Math.hypot(hanging.sx / 256 - hx, hanging.sy / 256 - hy);
  ok(hanging.level === 0 && d <= vineLen + 4 && d >= vineLen * 0.6, `then it hangs on the vine (${d.toFixed(0)} px from the hook, vine ${vineLen} px)`);
  const rising = run(free(30, -1800), 12);
  ok(rising.ropes.length === 0, "an apple rising past the hook is not caught (it catches only from above)");
  const wide = run(free(-30, 600, SNIP_HOOK_REACH + 6), 20);
  ok(wide.ropes.length === 0, `an apple falling more than ${SNIP_HOOK_REACH} px to the side is not caught`);
  const held = { ...snipTestLevel(ct, 0) } as SnipState;
  ok(held.ropes.length > 0 && run({ ...held, sx: hx * 256, sy: (hy - 30) * 256, sox: hx * 256, soy: (hy - 30) * 256 - 600 }, 6).ropes.length === held.ropes.length, "while a rope still holds the apple, no crook catches");
  const cut = { ...hanging, ropes: hanging.ropes.map((r) => ({ ...r, alive: 0 })) } as SnipState;
  const again = run({ ...cut, sx: hx * 256, sy: (hy - 30) * 256, sox: hx * 256, soy: (hy - 30) * 256 - 600 }, 20);
  ok(again.ropes.filter((r) => r.alive).length === 0, "each crook catches once a level");

  // Every pool template is proven at pin wobble −10, 0 and +10 by a stored human-paced plan.
  const worst = new Map<number, number>();
  for (const t of pool) {
    const tpl = SNIP_CONFIG.templates[t]!;
    let w = 0;
    for (const jit of [-10, 0, 10]) {
      const proof = SNIP_PROOFS[String(t)]?.[String(jit)];
      ok(!!proof?.fast, `template ${t} (${tpl.name}) wobble ${jit}: a stored winning plan`);
      if (!proof?.fast) continue;
      const plan = proof.fast.plan;
      let pace = plan[0]![1] >= 24;
      for (let i = 1; i < plan.length; i++) pace &&= plan[i]![1] - plan[i - 1]![1] >= 12;
      ok(pace, `template ${t} wobble ${jit}: human pace (first cut ≥ 24 ticks in, cuts ≥ 12 apart)`);
      const res = playSnipLevel(t, jit, plan);
      ok(res.eaten && res.tick === proof.fast.tick && res.applied === plan.length, `template ${t} wobble ${jit}: the plan feeds the apple at tick ${proof.fast.tick}, every cut used`);
      if (tpl.hooks) ok(plan.some(([rope]) => rope >= tpl.pins.length), `template ${t} wobble ${jit}: the plan cuts a crook's vine (cut, catch, cut)`);
      if (bands.hard.includes(t)) ok(plan.length >= 3, `template ${t} wobble ${jit}: a hard level takes several parts (${plan.length} cuts)`);
      if (proof.leaf) {
        const lr = playSnipLevel(t, jit, proof.leaf.plan);
        ok(lr.eaten && lr.star, `template ${t} wobble ${jit}: the leaf plan takes the leaf and feeds the apple`);
      }
      w = Math.max(w, res.tick);
    }
    worst.set(t, w);
    ok(w <= SNIP_LEVEL_TICKS, `template ${t}: fed within the 12 s level`);
  }
  // Every mix fits: the 2 slowest easy + 3 slowest medium + 5 slowest hard, on their slowest wobble.
  const slowest = (band: readonly number[], k: number) => band.map((t) => worst.get(t) ?? Infinity).sort((a, b) => b - a).slice(0, k).reduce((a, b) => a + b, 0);
  const bound = slowest(bands.easy, 2) + slowest(bands.medium, 3) + slowest(bands.hard, 5);
  ok(bound <= SNIP_RUN_TICKS, `every ten-level mix fits the minute (worst mix ${(bound / 60).toFixed(1)} s with stored plans)`);
  console.log(`  worst mix, fastest plans: ${(bound / 60).toFixed(1)} s; slowest single level ${(Math.max(...worst.values()) / 60).toFixed(1)} s`);

  // Real seeded runs through the server replay.
  let best = 0;
  for (const seed of [1, 77, 4242]) {
    const r = playSnipRun(game, seed, {});
    const raw = encodeSnipRun({ seed, claimedScore: r.score, events: r.events, endTick: r.state.tick, checkpoints: r.checkpoints });
    const replay = replaySnipRun(seed, raw, SNIP_REV_TALL);
    ok(replay.score === r.score && !replay.flagged && JSON.stringify(replay.state) === JSON.stringify(r.state), `seed ${seed}: server replay agrees (${r.score}: ${r.state.eaten} apples, ${r.state.stars} leaves, done at ${(r.state.finishTick / 60).toFixed(1)} s)`);
    ok(r.state.eaten === SNIP_CONFIG.levels, `seed ${seed}: the bot feeds all ten apples inside the minute`);
    best = Math.max(best, replay.score);
  }
  console.log(`  best snipRev 5 run through the server replay: ${best}`);
  ok(best >= 140, `a strong run scores at least 140 on snipRev 5 (best ${best})`);
}

/* ============================== 4. Intro and help ============================== */
section("Intro and \"?\" help");
for (const type of ["skyline", "snake", "snip", "hover"] as const) {
  if (!want(type)) continue;
  const help = PUZZLE_INSTRUCTIONS[type];
  const intro = help.how.filter((line) => !line.helpOnly);
  ok(intro.length <= 3, `${type}: intro HOW has at most three lines (${intro.length})`);
  for (const line of intro) ok(`${line.action} ${line.detail}`.length <= 46, `${type}: intro HOW line fits one line: ${line.action} ${line.detail}`);
  ok(help.how.some((line) => line.helpOnly && /^Taller/.test(line.action)), `${type}: the "?" help explains the taller world`);
}
if (want("snip")) {
  ok(PUZZLE_INSTRUCTIONS.snip.how.some((l) => !l.helpOnly && /crook/i.test(`${l.action} ${l.detail}`)), "Scrumper's intro mentions the crooks");
  ok(PUZZLE_INSTRUCTIONS.snip.how.some((l) => l.helpOnly && /from above/.test(l.detail)), "Scrumper's help says a crook catches only from above");
}
// Screen audit Oct 2026: a plain line and a good run from the curve rooms deal (arcade-help-bands-check).
// Hover: the curve rooms deal since the arcade scoring standard (hoverRev 10, barriers on one line to 120; hover-standard-check).
if (want("hover")) ok(PUZZLE_INSTRUCTIONS.hover.score.includes("A good run (100 points) passes 35 barriers"), "Hover's help states a good run on the curve rooms deal (hoverRev 10 since the arcade scoring standard)");
// The arcade scoring standard (29 Oct 2026) moved Meteor on to snakeRev 11: stars on a straight line to 120 at 27, then the
// feature parts to 200 (snake-standard-check). snakeRev 12 (1 Nov 2026): the core full at 20 stars, a gold star counting 2
// (snake-rev12-check), so a good run counts 17 (snakeRev 11: eats 23).
if (want("snake")) ok(PUZZLE_INSTRUCTIONS.snake.score.includes("up to 120") && PUZZLE_INSTRUCTIONS.snake.score.includes("A good run (100 points) counts 17 stars") && PUZZLE_INSTRUCTIONS.snake.score.endsWith("Up to 200."), "Meteor's help states the top and a good run rooms deal (snakeRev 12 since 1 Nov 2026, snake-rev12-check)");

if (failures.length) {
  console.log(failures.slice(0, 60).join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} Tuning E checks`);
  process.exit(1);
}
console.log(`Tuning E: ${checks} checks passed`);
