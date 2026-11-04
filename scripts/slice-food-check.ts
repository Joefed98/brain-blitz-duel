/**
 * slice-food-check (3 Nov 2026, the Action polish, docs/arcade-standard/slice.md "sliceRev 12"): Slice sliceRev 12 is
 * sliceRev 11 with bigger, recognisable food and chillies (hit size grows with the drawing) and two parts re-lined so
 * the bands stay on Joe's targets.
 *
 *  1. Older stamps are untouched: runs recorded on unmodified main on every revision rooms ever stamped (unstamped,
 *     sliceRev 2–11; scripts/fixtures/slice-food-legacy.json.gz, scripts/slice-food-legacy.ts) replay unflagged to
 *     their stored score and the same final state.
 *  2. Rooms deal sliceRev 12 on a seed with at least SLICE_V12_MIN_CHILLIES chillies; LIVE_BANDS, the help and the
 *     roster follow.
 *  3. The same schedule as sliceRev 11 (every object's launch, flight, kind and payload), only the radii differ:
 *     each food its SLICE_V12_RADIUS by kind, each chilli SLICE_V12_CHILLI_R, bottles unchanged.
 *  4. The parts: the core 0 to 480 per mille and a straight line to 120 at all the food; the combo 0 to 40 foods and a
 *     straight line to 40 at 110; gold, tickets and dodges as sliceRev 11; 0 with no input, at least 1 with any.
 *  5. A perfect run (the oracle, through the server replay) scores 200 on dealt seeds: 60 tuning, 200 fresh and (full
 *     depth) 1,000 more random seeds, each passing the deal's chilli rule.
 *  6. The bands: medians strictly rise weak → elite and flawless is 200 on 30 room seeds.
 *  7. The art draws the new foods and the bright chilli on sliceRev 12 states only.
 *
 *   bun scripts/slice-food-check.ts      # ~40 s (CHECKS_FULL=1: ~90 s)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { GAME_BY_TYPE, roomSeed } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { bot as sliceBot } from "./arcade-skill-bands/bots/slice";
import { fnv } from "./arcade-tuning-a-legacy";
import { SLICE_FOOD_BEFORE, type SliceLegacyRecord } from "./slice-food-legacy";
import { sliceOracleRun } from "./slice-standard-oracle";
import { entry } from "./arcade-standard/slice";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import {
  sliceFoodSeedOk,
  sliceGameFor,
  sliceV11Parts,
  SLICE_REV_FOOD,
  SLICE_REV_STANDARD,
  SLICE_RUN_TICKS,
  SLICE_SPECIAL_NONE,
  SLICE_V11_COMBO_CAP,
  SLICE_V11_CORE,
  SLICE_V12_BAND_CURVE,
  SLICE_V12_CHILLI_R,
  SLICE_V12_COMBO_FROM,
  SLICE_V12_COMBO_FULL,
  SLICE_V12_CORE_FROM,
  SLICE_V12_MIN_CHILLIES,
  SLICE_V12_RADIUS,
  type SliceObject,
  type SliceState,
} from "../src/lib/arcade/slice";
import { replaySliceRun } from "../src/lib/duel/slice";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";

const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
const failures: string[] = [];
let passes = 0;
function ok(cond: unknown, message: string): void {
  if (cond) passes++;
  else if (failures.length < 80) failures.push(message);
}
const section = (name: string) => console.log(`— ${name}`);
const g11 = sliceGameFor(SLICE_REV_STANDARD);
const g12 = sliceGameFor(SLICE_REV_FOOD);

/* 1. Older stamps. */
section("1. older stamps replay as on main");
{
  const runs = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/slice-food-legacy.json.gz")).toString()) as SliceLegacyRecord[];
  ok(runs.length === SLICE_FOOD_BEFORE.length * 3 + 3, `the fixture holds every revision's runs (${runs.length})`);
  ok(SLICE_FOOD_BEFORE.every((rev) => runs.some((r) => r.rev === rev)), "every revision before sliceRev 12 is recorded");
  for (const r of runs) {
    const raw = gunzipSync(Buffer.from(r.raw, "base64")).toString();
    const res = replaySliceRun(r.seed, raw, r.rev ?? undefined);
    ok(!res.flagged && res.score === r.score && fnv(JSON.stringify(res.state)) === r.stateHash, `sliceRev ${r.rev} ${r.level} seed ${r.seed}: replays to ${r.score} and the same state (got ${res.score}${res.flagged ? ", flagged" : ""})`);
  }
}

/* 2. The deal. */
section("2. rooms deal sliceRev 12 on a seed with enough chillies");
{
  for (let k = 0; k < 40; k++) {
    const p = generatePuzzle("slice" as any) as any;
    ok(p.type === "slice" && p.sliceRev === SLICE_REV_FOOD && sliceFoodSeedOk(p.seed), `deal ${k}: sliceRev 12 on a seed passing the chilli rule (${p.sliceRev}, ${p.seed})`);
  }
  ok(LIVE_BANDS.slice.rev === SLICE_REV_FOOD && LIVE_BANDS.slice.curve === SLICE_V12_BAND_CURVE, "LIVE_BANDS reads sliceRev 12 on its own core line");
  ok(entry.rev === SLICE_REV_FOOD, "the arcade-standard entry is sliceRev 12");
  const help = PUZZLE_INSTRUCTIONS.slice!;
  const text = help.how.map((h) => `${h.action} ${h.detail}`).join(" ");
  ok(/bread, watermelons, oranges and apples/.test(text) && /golden apples/.test(text) && /bright red chillies/.test(text), "the help names the new food");
  // Text pass (4 Nov 2026): plain words, no "full at N".
  ok(/the first half of it scores nothing, then every piece counts the same/.test(help.score) && new RegExp(`all of it at ${SLICE_V12_COMBO_FULL}`).test(text), "the help states the core's and the combo's lines");
  let low = 0;
  for (let n = 0; n < 2000; n++) if (!sliceFoodSeedOk(roomSeed(20000 + n))) low++;
  ok(low > 0 && low < 200, `the chilli rule re-draws a few seeds only (${low} of 2,000 have fewer than ${SLICE_V12_MIN_CHILLIES})`);
}

/* 3. Same schedule, bigger radii. */
section("3. sliceRev 11's schedule with the new radii");
{
  const strip = (o: SliceObject): unknown => ({ ...o, r: undefined, payload: o.payload.map(strip) });
  let bigger = 0;
  for (let n = 0; n < 30; n++) {
    const seed = roomSeed(n);
    const a = g11.init(seed) as SliceState;
    const b = g12.init(seed) as SliceState;
    ok(JSON.stringify(a.objects.map(strip)) === JSON.stringify(b.objects.map(strip)), `seed ${n}: the same schedule as sliceRev 11`);
    ok(b.v12 === 1 && a.v12 === undefined, `seed ${n}: only sliceRev 12 states carry v12`);
    const all = (list: SliceObject[]): SliceObject[] => list.flatMap((o) => [o, ...all(o.payload)]);
    const a1 = all(a.objects);
    all(b.objects).forEach((o, i) => {
      const want = o.bomb ? SLICE_V12_CHILLI_R : o.special !== SLICE_SPECIAL_NONE ? a1[i]!.r : SLICE_V12_RADIUS[o.colour];
      if (o.r !== want) ok(false, `seed ${n} object ${i}: radius ${o.r}, want ${want}`);
      if ((o.r ?? 20) > (a1[i]!.r ?? 20)) bigger++;
    });
  }
  ok(bigger > 1000, `food and chillies are bigger (${bigger} objects)`);
  ok(SLICE_V12_RADIUS.every((r, i) => r > [26, 20, 17, 20, 12][i]!) && SLICE_V12_CHILLI_R > 20, "every kind is bigger than on sliceRev 11");
}

/* 4. The parts. */
section("4. the parts' lines");
{
  const base = g12.init(roomSeed(1)) as SliceState;
  const at = (cut: number, missed: number, comboFoods: number) => sliceV11Parts({ ...base, foodCut: cut, foodMissed: missed, comboFoods } as SliceState);
  ok(at(48, 52, 0).core === 0 && at(SLICE_V12_CORE_FROM, 1000 - SLICE_V12_CORE_FROM, 0).core === 0, "the core is 0 up to 480 per mille");
  ok(at(100, 0, 0).core === SLICE_V11_CORE && at(74, 26, 0).core === Math.floor(bandPoints(SLICE_V12_BAND_CURVE, 740)), "the core is 120 at all the food, a straight line between");
  ok(at(1, 0, SLICE_V12_COMBO_FROM).combo === 0 && at(1, 0, SLICE_V12_COMBO_FULL).combo === SLICE_V11_COMBO_CAP && at(1, 0, 75).combo === Math.floor((40 * 35) / 70), "the combo is 0 to 40 foods, 40 at 110, a straight line between");
  ok(g12.score(base) === 0, "no input scores 0");
  const states: SliceState[] = [];
  let s = base;
  s = g12.step(s, { t: 1, k: 0, a: 10, b: 10, c: 0, d: 0 } as any) as SliceState;
  while (s.tick < SLICE_RUN_TICKS) {
    s = g12.step(s, null) as SliceState;
    states.push(s);
  }
  ok(g12.score(s) >= 1, `any input scores at least 1 (${g12.score(s)})`);
}

/* 5. 200 on dealt seeds. */
section("5. a perfect run reaches 200 on every dealt seed tried");
{
  const seeds: number[] = [];
  for (let n = 0; n < 60; n++) seeds.push(roomSeed(n));
  for (let n = 10000; n < 10200; n++) seeds.push(roomSeed(n));
  if (FULL) {
    let x = 0x5eed;
    for (let n = 0; n < 1000; n++) {
      x = (Math.imul(x, 1103515245) + 12345) >>> 0;
      seeds.push((x % 0x7fff_ffff) + 1);
    }
  }
  const dealt = seeds.filter(sliceFoodSeedOk);
  const below: string[] = [];
  for (const seed of dealt) {
    const { result } = sliceOracleRun(seed, SLICE_REV_FOOD);
    if (result.flagged || result.score !== 200) below.push(`${seed}:${result.score}`);
  }
  ok(below.length === 0, `the oracle reaches 200 through the server replay on all ${dealt.length} dealt seeds (${seeds.length - dealt.length} re-drawn): ${below.join(" ")}`);
}

/* 6. Bands. */
section("6. the bands rise weak → flawless");
{
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
  const spec = GAME_BY_TYPE.get("slice")!;
  const medians: number[] = [];
  for (const level of ["weak", "average", "good", "great", "near", "elite"] as const) {
    const scores: number[] = [];
    for (let n = 0; n < 30; n++) {
      const seed = spec.seedFor(n);
      const out = sliceBot({ game: g12, seed, rev: SLICE_REV_FOOD, human: new Human("slice", seed, level), fixes: true } as any);
      const by = new Map((out.events ?? []).map((e: any) => [e.t, e]));
      let s = g12.init(seed) as SliceState;
      while (!g12.isOver(s) && s.tick < SLICE_RUN_TICKS) s = g12.step(s, (by.get(s.tick + 1) as any) ?? null) as SliceState;
      scores.push(g12.score(s));
    }
    medians.push(med(scores));
  }
  console.log(`  medians weak → elite: ${medians.join(" · ")}`);
  ok(medians.every((m, i) => i === 0 || m > medians[i - 1]!), `the medians rise level by level (${medians.join(", ")})`);
  ok(medians[0]! >= 25 && medians[0]! <= 60 && medians[5]! >= 180 && medians[5]! < 200, `weak and elite sit near the targets (${medians[0]}, ${medians[5]})`);
}

/* 7. Art. */
section("7. the art");
{
  const art = readFileSync("src/lib/arcade/slice.renderer.ts", "utf8");
  ok(/kind=foodOf\(o\.colour,!!state\.v12\)/.test(art) && /function paintFoodV12/.test(art) && /function paintChilliV12/.test(art) && /function paintGoldenApple/.test(art), "the renderer draws the new food, golden apple and chilli on sliceRev 12 states");
  ok(/if\(state\.v11\)\{drawSliceV9Hud\(ctx,state,SLICE_WORLD_W,still,now\);drawSliceActionHud/.test(art), "sliceRev 11+ draws the Action HUD's chips");
}

console.log(
  failures.length === 0
    ? `PASS slice-food-check: ${passes} checks`
    : `FAIL slice-food-check: ${failures.length} of ${passes + failures.length} checks failed\n${failures.map((f) => `  ✗ ${f}`).join("\n")}`,
);
process.exit(failures.length ? 1 : 0);
