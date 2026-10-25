/**
 * ink-expand-check (Expansion E1, 25 Oct 2026): Rainbow Bridge inkRev 9 — the taller world (390 × 674),
 * bounce clouds with trick shots, gold stars on most of levels 1–8, scored to 200.
 *
 *   1. Legacy identity: every older revision's starting state (unstamped … inkRev 8) is byte-identical to
 *      the code before the expansion (sha-256 digests recorded on main), and 40 inkRev 8 skill-bot runs
 *      recorded on main replay through the server to the same score, levels, fails and end tick, unflagged.
 *   2. Rooms deal inkRev 9: 390 × 674, its own gravity, maximum 200 (older rounds keep 620 and 150).
 *   3. Determinism: the same seed builds the same levels and the same inputs give the same checkpoints.
 *   4. Proofs, per level on several seeds: the reference line pots with the clouds present and never touches
 *      one; the coin never pots unaided; each trick line pots after a cloud bounce; each star line takes its
 *      star; all within the level's ink and on their own releases.
 *   5. The cloud: a coin dropped on one springs back up at least INK_CLOUD_KICK; a rolling coin is thrown off.
 *   6. Server replay = phone sim on inkRev 9, through scripted runs: the proved lines only → 150 (stars and
 *      clouds are never needed); every star and trick shot → 200; one feature short → under 200; no input → 0.
 *   7. The feature bonus is 50 only with every star and trick shot, never more; scores never pass 200.
 *   8. Bounds rule: the drawn bounce cloud (and its widest squash) sits within 2 px of its collision capsule
 *      and fills it.
 *
 *   bun scripts/ink-expand-check.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createCanvas } from "@napi-rs/canvas";
import {
  inkBridgeGameFor,
  inkCheckpoint,
  inkExpandProof,
  inkFeatureBonus,
  inkFeatureSlots,
  inkWorldHFor,
  INK_CLOUD_HW,
  INK_CLOUD_KICK,
  INK_CLOUD_R,
  INK_INPUT_RELEASE,
  INK_INPUT_STROKE,
  INK_LEVELS,
  INK_REV_EXPAND,
  INK_REV_STRICT,
  INK_TALL_GRAVITY,
  INK_TALL_H,
  INK_WORLD_W,
  type InkState,
} from "../src/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import { generateInkBridge } from "../src/lib/duel/arcade.server";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { playInk } from "./arcade-batch5-bots";

Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: false }) } });
const { INK_BCLOUD_ART } = await import("../src/lib/arcade/inkBridge.renderer");

const failures: string[] = [];
let checks = 0;
function ok(cond: unknown, message: string): void {
  checks++;
  if (!cond && failures.length < 40) failures.push(message);
}
const section = (name: string) => console.log(`— ${name}`);
const t0 = performance.now();

/* 1. Legacy identity. */
section("Legacy identity (unstamped … inkRev 8)");
const fixture = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/ink-expand-legacy.json.gz")).toString()) as {
  runs: { rev: number; level: string; seed: number; raw: string; score: number; levels: number; fails: number; tick: number }[];
  initDigests: Record<string, string>;
};
for (const [key, digest] of Object.entries(fixture.initDigests)) {
  const [revText, seedText] = key.split(":");
  const rev = revText === "undefined" ? undefined : Number(revText);
  const state = inkBridgeGameFor(rev).init(Number(seedText));
  ok(createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 16) === digest, `inkRev ${revText} seed ${seedText}: the starting state changed`);
}
for (const run of fixture.runs) {
  const r = replayInkBridgeRun(run.seed, run.raw, run.rev);
  ok(!r.flagged && r.score === run.score && r.levels === run.levels && r.fails === run.fails && r.state.tick === run.tick, `inkRev ${run.rev} ${run.level} seed ${run.seed}: replays to ${r.score} (stored ${run.score})`);
}
ok(fixture.runs.length === 40 && Object.keys(fixture.initDigests).length === 40, "40 recorded runs and 40 digests");
console.log(`  ${Object.keys(fixture.initDigests).length} starting states and ${fixture.runs.length} recorded inkRev 8 runs unchanged`);

/* 2. Rooms deal inkRev 9. */
section("Rooms deal inkRev 9 (390 × 674, scored to 200)");
ok(generateInkBridge().inkRev === INK_REV_EXPAND && LIVE_BANDS.inkbridge.rev === INK_REV_EXPAND, "rooms deal inkRev 9 and the help reads it");
ok(roundMaxFor("inkbridge") === 200, "Rainbow Bridge's maximum is 200");
ok(inkWorldHFor(INK_REV_EXPAND) === INK_TALL_H && INK_TALL_H === 674 && inkWorldHFor(INK_REV_STRICT) === 620 && inkWorldHFor(undefined) === 620, "the world is 674 tall on inkRev 9, 620 before");
const game = inkBridgeGameFor(INK_REV_EXPAND);
const seeds = [101, 777_777, 31_337, 2_024_10_25];
{
  const s = game.init(seeds[0]!);
  ok(s.worldH === INK_TALL_H && s.rev === INK_REV_EXPAND && s.tricks === 0 && s.stars === 0, "the state carries the taller world and the counters");
  ok(s.list.every((l) => l.worldH === INK_TALL_H && l.gravity !== undefined), "every level carries the taller world and its gravity");
  ok(s.list.slice(0, 8).every((l) => l.gravity === INK_TALL_GRAVITY), "levels 1–8 fall at the scaled gravity");
  ok(inkBridgeGameFor(INK_REV_STRICT).init(seeds[0]!).worldH === undefined, "an inkRev 8 state has no world height of its own");
  ok(game.inputRanges?.[0]?.b?.[1] === INK_TALL_H, "strokes may reach the taller world's bottom");
}

/* 3. Determinism. */
section("Determinism");
{
  const a = JSON.stringify(game.init(seeds[1]!).list);
  const b = JSON.stringify(inkBridgeGameFor(INK_REV_EXPAND).init(seeds[1]!).list);
  ok(a === b, "the same seed builds the same levels");
  const r1 = playInk(game, seeds[1]!, inkCheckpoint, { stars: true, tricks: true });
  const r2 = playInk(game, seeds[1]!, inkCheckpoint, { stars: true, tricks: true });
  ok(JSON.stringify(r1.checkpoints) === JSON.stringify(r2.checkpoints) && JSON.stringify(r1.events) === JSON.stringify(r2.events), "the same inputs give the same checkpoints");
}

/* 4. Proofs. */
section("Every level proved: reference (clouds present, untouched), no unaided pot, trick lines, star lines");
let clouds = 0;
let stars = 0;
const proofSeeds = [...seeds, 5, 99_991];
for (const seed of proofSeeds) {
  const proof = inkExpandProof(seed);
  ok(proof.length === INK_LEVELS, `seed ${seed}: ten levels`);
  for (const l of proof) {
    ok(l.ref, `seed ${seed} level ${l.level + 1}: the reference line pots within its ink`);
    ok(l.refClear, `seed ${seed} level ${l.level + 1}: the reference route never touches a cloud`);
    ok(!l.unaided, `seed ${seed} level ${l.level + 1}: the coin never pots unaided`);
    ok(l.trick !== false, `seed ${seed} level ${l.level + 1}: the trick line pots after a cloud bounce`);
    ok(l.star !== false, `seed ${seed} level ${l.level + 1}: the star line takes the star and pots`);
    ok((l.cloud === null) === (l.trick === null), `seed ${seed} level ${l.level + 1}: a cloud exactly where a trick line is proved`);
    if (l.level >= 8) ok(l.cloud === null && l.star_ === null, `seed ${seed} level ${l.level + 1}: no cloud or star on a live level`);
    if (l.cloud) {
      clouds++;
      ok(l.cloud.x - INK_CLOUD_HW - INK_CLOUD_R >= 0 && l.cloud.x + INK_CLOUD_HW + INK_CLOUD_R <= INK_WORLD_W && l.cloud.y > 100 && l.cloud.y < INK_TALL_H - 60, `seed ${seed} level ${l.level + 1}: the cloud sits inside the world`);
    }
    if (l.star_) {
      stars++;
      ok(l.star_.y >= 44, `seed ${seed} level ${l.level + 1}: the star sits under the HUD`);
    }
  }
}
ok(clouds >= proofSeeds.length * 3, `bounce clouds on most seeds' levels (${clouds} on ${proofSeeds.length} seeds)`);
ok(stars >= proofSeeds.length * 5, `gold stars on most of levels 1–8 (${stars} on ${proofSeeds.length} seeds)`);
console.log(`  ${proofSeeds.length} seeds: ${clouds} clouds and ${stars} stars, every line proved`);

/* 5. The cloud's spring. */
section("A cloud throws the coin back up");
{
  const base = game.init(seeds[2]!);
  const lvlIndex = base.list.findIndex((l) => l.clouds?.length);
  ok(lvlIndex >= 0, "the seed has a cloud level");
  if (lvlIndex >= 0) {
    const lvl = base.list[lvlIndex]!;
    const cl = lvl.clouds![0]!;
    // Spout the coin right above the cloud, with no lines: it lands on the cloud and springs back up.
    const list = [...base.list];
    list[lvlIndex] = { ...lvl, spoutX: cl.x, blocks: [] };
    let s: InkState = { ...base, list, level: lvlIndex, ball: { x: cl.x * 256, y: 50 * 256, vx: 0, vy: 0, on: -1, u: 0, sp: 0, stall: 0 } };
    s = game.step(s, { t: s.tick + 1, k: INK_INPUT_RELEASE, a: 1, b: 0, c: 0, d: 0 });
    let bounced = -1;
    let upward = 0;
    for (let i = 0; i < 200 && bounced < 0; i++) {
      s = game.step(s, null);
      if (s.cloudTick === s.tick) {
        bounced = s.tick;
        upward = -s.ball.vy;
      }
    }
    ok(bounced > 0 && s.cloudHit === 1 && s.cloudIdx === 0, "a coin falling on the cloud bounces off it");
    ok(upward >= INK_CLOUD_KICK, `it leaves upward at the kick speed or more (${upward})`);
    ok(s.ball.y < (cl.y - INK_CLOUD_R) * 256, "it leaves from the cloud's top");
    // A coin rolling along a line into a cloud is thrown off the line.
    // (A fixed cloud at (200, 300) and a gentle line from (100, 260) to (240, 300) that runs the coin into it.)
    const rollList = [...base.list];
    rollList[lvlIndex] = { ...lvl, spoutX: 120, blocks: [], clouds: [{ x: 200, y: 300 }] };
    let r: InkState = { ...base, list: rollList, level: lvlIndex, ball: { x: 120 * 256, y: 50 * 256, vx: 0, vy: 0, on: -1, u: 0, sp: 0, stall: 0 } };
    for (const [x, y, c] of [[100, 260, 1], [240, 300, 0]] as const) r = game.step(r, { t: r.tick + 1, k: INK_INPUT_STROKE, a: x, b: y, c, d: 0 });
    r = game.step(r, { t: r.tick + 1, k: INK_INPUT_RELEASE, a: 2, b: 0, c: 0, d: 0 });
    let thrown = false;
    for (let i = 0; i < 400 && !thrown; i++) {
      const prevOn = r.ball.on;
      r = game.step(r, null);
      if (r.cloudTick === r.tick && prevOn >= 0 && r.ball.on < 0) thrown = true;
    }
    ok(thrown, "a coin rolling into a cloud is thrown off its line");
  }
}

/* 6. Server replay = phone sim; the features are optional and make the extra 50. */
section("Scripted runs through the server replay");
for (const seed of seeds) {
  const slots = inkFeatureSlots(game.init(seed).list);
  const replayOf = (run: ReturnType<typeof playInk>) => {
    const r = replayInkBridgeRun(seed, encodeInkBridgeRun({ seed, claimedScore: game.score(run.state), events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints as never }), INK_REV_EXPAND);
    ok(!r.flagged && r.score === game.score(run.state), `seed ${seed}: the server replay agrees with the phone (${r.score} vs ${game.score(run.state)})`);
    return r;
  };
  const plain = replayOf(playInk(game, seed, inkCheckpoint, { stars: false }));
  ok(plain.levels === INK_LEVELS && plain.stars === 0 && plain.tricks === 0 && plain.score === 150, `seed ${seed}: the reference lines alone pot all ten (stars and clouds never needed) for 150 (${plain.score})`);
  const full = replayOf(playInk(game, seed, inkCheckpoint, { stars: true, tricks: true }));
  ok(full.levels === INK_LEVELS && full.stars === slots.stars && full.tricks === slots.tricks && full.score === 200, `seed ${seed}: every star (${full.stars}/${slots.stars}) and trick shot (${full.tricks}/${slots.tricks}) scores 200 (${full.score})`);
  ok(full.cloudLevels === slots.tricks && full.starLevels === slots.stars, `seed ${seed}: the result counts the clouds and stars`);
  const short = replayOf(playInk(game, seed, inkCheckpoint, { stars: true, tricks: true, failFrom: 9 }));
  ok(short.levels === 9 && short.score < 200 && short.score > plain.score - 60, `seed ${seed}: one level short scores under 200 (${short.score})`);
  const none = playInk(game, seed, inkCheckpoint, { stars: false, failFrom: 0 });
  ok(game.score({ ...none.state, acted: 0 }) === 0, `seed ${seed}: no input scores 0`);
}

/* 7. The bonus. */
section("The feature bonus: 50 only with every star and trick shot");
for (const slots of [{ stars: 7, tricks: 5 }, { stars: 6, tricks: 3 }, { stars: 8, tricks: 5 }, { stars: 0, tricks: 0 }]) {
  const total = slots.stars + slots.tricks;
  for (let s = 0; s <= slots.stars; s++)
    for (let t = 0; t <= slots.tricks; t++) {
      const b = inkFeatureBonus(s, t, slots);
      ok(b >= 0 && b <= 50, "the bonus stays within 0–50");
      ok(total === 0 ? b === 0 : (b === 50) === (s + t === total), `${s} stars, ${t} tricks of ${JSON.stringify(slots)}: 50 only for all (${b})`);
    }
  ok(inkFeatureBonus(99, 99, slots) === (total ? 50 : 0), "counts past the slots never add more");
}
{
  // Scores never pass 200, whatever the counters say.
  const s = game.init(seeds[0]!);
  const top = game.score({ ...s, acted: 1, levels: INK_LEVELS, ended: 1, endedTick: 1, tick: 1, stars: 99, tricks: 99 });
  ok(top === 200, `a perfect run scores exactly 200 (${top})`);
}

/* 8. Bounds rule for the cloud art. */
section("The bounce cloud's art sits on its collision capsule (within 2 px)");
{
  const K = 4;
  const { w, h, paint, widen } = INK_BCLOUD_ART;
  for (const sx of [1, 1 + widen]) {
    const c = createCanvas(Math.ceil(w * K * sx) + 8 * K, h * K);
    const ctx = c.getContext("2d");
    ctx.translate(c.width / 2, c.height / 2);
    ctx.scale(K * sx, K);
    ctx.translate(-w / 2, -h / 2);
    paint(ctx as unknown as CanvasRenderingContext2D);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let outside = 0;
    let holes = 0;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const px = (x + 0.5 - c.width / 2) / K;
        const py = (y + 0.5 - c.height / 2) / K;
        const dx = Math.max(0, Math.abs(px) - INK_CLOUD_HW);
        const d = Math.hypot(dx, py);
        const a = data[(y * c.width + x) * 4 + 3]!;
        if (a > 8 && d > INK_CLOUD_R + 2) outside++;
        if (sx === 1 && a < 200 && d < INK_CLOUD_R - 1.5) holes++;
      }
    ok(outside === 0, `squash ×${sx.toFixed(2)}: no drawn pixel more than 2 px outside the capsule (${outside})`);
    if (sx === 1) ok(holes === 0, `the capsule is filled (${holes} see-through pixels inside)`);
  }
}

if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL ink-expand-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS ink-expand-check: ${checks} checks in ${((performance.now() - t0) / 1000).toFixed(1)} s — legacy identity, inkRev 9's taller world, proved clouds, trick lines and stars, the spring, 150 without the features and 200 only with all of them through the server replay, the cloud's bounds`);
