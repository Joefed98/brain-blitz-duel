/**
 * Rainbow Bridge inkRev 14 (3 Nov 2026; docs/arcade-standard/inkbridge.md "inkRev 14", Joe's audit on an iPhone 11):
 * inkRev 13's rules and parts (levels 120 + ink par 30 + trick shots 20 + clovers 10 + speed 20) with the coin, the clovers
 * and the birds bigger so they read on a phone (coin radius 7 → INK_V14_BALL_R, clover 9 → INK_V14_SHAMROCK_R, birds
 * 6.5 → 10 px thick), the art drawn to those bounds, every level built and proved with them, dealt from a proved deal
 * (src/lib/duel/inkBigDeal.server.ts). Proves:
 *
 *  1. rooms deal inkRev 14, one above inkRev 13, on a seed of the proved deal (pinInkPreBig pins inkRev 13 for the checks
 *     written for it; pinInkPreClover still pins inkRev 12); LIVE_BANDS lists it on inkRev 13's curve; its spec is
 *     inkRev 13's parts; the help shows the new readout; room identity follows it;
 *  2. legacy: inkRev 13 runs and inkRev 10–13 level digests recorded on main before the change
 *     (scripts/fixtures/ink-v14-legacy.json.gz, `bun scripts/ink-v14-legacy-record.ts`) replay and build unchanged; an
 *     inkRev 13 level carries no sizes and plays at the old ones;
 *  3. the sizes: every inkRev 14 level carries the coin and clover radii, every bird the new thickness; the sim's
 *     collision test and clover reach use them (and the old ones on inkRev 13); the coin, clover and birds are drawn
 *     within 2 px of those bounds and fill them (the real painters, @napi-rs/canvas);
 *  4. the deal: every proof passes on sample deal seeds and fresh seeds (each level drawable with the bigger coin and
 *     birds, the bonus lines proved, two clovers, two live levels), and every deal entry's stored witness (the oracle's
 *     perfect run) replays to exactly 200 through the server replay, every part at its maximum (12 entries at quick
 *     depth, all with CHECKS_FULL=1 or --full; the deal is exactly the witnessed seeds in order);
 *  5. the rules carried from inkRev 13: a failed drop never ends the run; the parts' arithmetic;
 *  6. recorded inkRev 14 runs replay unchanged (scripts/fixtures/ink-v14-runs.json.gz, `--record` re-records them) and
 *     the stored replay-runs entry on inkRev 14 replays to its score;
 *  7. scoring floors: no input 0, one stroke point 1, random input low;
 *  8. room identity: different logs see the same dealt run.
 *
 *   bun scripts/ink-v14-check.ts            (~1–2 min)
 *   bun scripts/ink-v14-check.ts --record   (re-records ink-v14-runs.json.gz)
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { createCanvas } from "@napi-rs/canvas";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  inkBridgeGameFor,
  inkCheckpoint,
  inkCoinTouchesBird,
  inkLevelSizes,
  inkV13Score,
  INK_BALL_R,
  INK_BIRD_H_FP,
  INK_INPUT_DROP_AGAIN,
  INK_INPUT_RELEASE,
  INK_INPUT_STROKE,
  INK_LEVELS,
  INK_REV_BIG,
  INK_REV_CLOVER,
  INK_REV_STD,
  INK_REV_STRICT,
  INK_SHAMROCK_R,
  INK_V13_BAND_CURVE,
  INK_V13_STD,
  INK_V14_BALL_R,
  INK_V14_BIRD_H_FP,
  INK_V14_SHAMROCK_R,
  INK_V14_STD,
  type InkState,
} from "../src/lib/arcade/inkBridge";
import { INK_SIZED_ART, inkInkText } from "../src/lib/arcade/inkBridge.renderer";
import { stdSpecMax } from "../src/lib/arcade/arcadeStandard";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import { generateInkBridge, pinInkPreBig, pinInkPreClover } from "../src/lib/duel/arcade.server";
import { INK_BIG_DEAL } from "../src/lib/duel/inkBigDeal.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/inkbridge";
import { randomInkLog } from "./ink-x200-bands";
import { roomIdentity } from "./room-identity/inkbridge";
import { inkBigProved, inkBigVerdict, readInkBigDeal, readInkBigWitnesses } from "./ink-big-deal";

const t0 = performance.now();
const failures: string[] = [];
let checks = 0;
const ok = (cond: unknown, msg: string) => {
  checks++;
  if (!cond) failures.push(msg);
};
const section = (name: string) => console.log(`— ${name}`);
const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");

const game = inkBridgeGameFor(INK_REV_BIG);
const RUNS_FIXTURE = "scripts/fixtures/ink-v14-runs.json.gz";
/** Deal seeds for the bot runs and the samples. */
const DEAL_SAMPLE = [0, 1, 37, 99].map((i) => INK_BIG_DEAL[i % INK_BIG_DEAL.length]!);
/** Fresh seeds outside the deal (skill-band seed indices), built and proved all the same. */
const FRESH = [7, 41, 10013].map(roomSeed);

/** Plays a log on inkRev 14 and encodes it as the phone does (checkpoints every 300 ticks). */
function encode(seed: number, events: ArcadeInputEvent[]): string {
  let s = game.init(seed) as InkState;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(inkCheckpoint(s));
  }
  return encodeInkBridgeRun({ seed, claimedScore: game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
}

type Rec = { who: string; seed: number; raw: string; score: number; levels: number; fails: number; tick: number; checksum: number };

if (process.argv.includes("--record")) {
  const runs: Rec[] = [];
  for (const seed of DEAL_SAMPLE.slice(0, 2))
    for (const level of ["weak", "average", "good", "near", "elite"] as const) {
      const raw = encode(seed, bot({ game, seed, rev: INK_REV_BIG, human: new Human("inkbridge", seed, level), fixes: true }).events ?? []);
      const r = replayInkBridgeRun(seed, raw, INK_REV_BIG);
      runs.push({ who: level, seed, raw, score: r.score, levels: r.levels, fails: r.fails, tick: r.state.tick, checksum: inkCheckpoint(r.state).checksum });
    }
  const w = readInkBigWitnesses()[0]!;
  const raw = encode(w.seed, w.events);
  const pr = replayInkBridgeRun(w.seed, raw, INK_REV_BIG);
  runs.push({ who: "perfect", seed: w.seed, raw, score: pr.score, levels: pr.levels, fails: pr.fails, tick: pr.state.tick, checksum: inkCheckpoint(pr.state).checksum });
  writeFileSync(RUNS_FIXTURE, gzipSync(JSON.stringify({ note: "Rainbow Bridge inkRev 14 runs recorded by scripts/ink-v14-check.ts --record", rev: INK_REV_BIG, runs })));
  // scripts/fixtures/replay-runs.json holds one of these (the good bot on the deal's first seed), appended on 3 Nov 2026; never rewritten here.
  console.log(`recorded ${runs.length} runs: ${runs.map((r) => `${r.who} ${r.score}`).join(", ")}`);
  process.exit(0);
}

/* 1. The dealt stamp, the deal, LIVE_BANDS, spec, help, room identity. */
section("Rooms deal inkRev 14 from the proved deal; LIVE_BANDS, spec and help follow it");
{
  const live = LIVE_BANDS.inkbridge as { rev: number; strictRev?: number; curve: unknown };
  const dealt = Array.from({ length: 40 }, () => generateInkBridge());
  ok(INK_REV_BIG === INK_REV_CLOVER + 1 && dealt.every((p) => p.inkRev === INK_REV_BIG), "rooms deal inkRev 14, one above inkRev 13");
  const deal = new Set(INK_BIG_DEAL);
  ok(dealt.every((p) => deal.has(p.seed)) && new Set(dealt.map((p) => p.seed)).size > 20, "every dealt seed is one of the proved deal's, and they vary");
  const was = pinInkPreBig(true);
  ok(generateInkBridge().inkRev === INK_REV_CLOVER, "pinInkPreBig deals inkRev 13 for the checks written for it");
  const was12 = pinInkPreClover(true);
  ok(generateInkBridge().inkRev === INK_REV_STD, "pinInkPreClover still deals inkRev 12");
  pinInkPreClover(was12);
  pinInkPreBig(was);
  ok(generateInkBridge().inkRev === INK_REV_BIG, "unpinned, rooms deal inkRev 14 again");
  ok(live.rev === INK_REV_BIG && live.strictRev === INK_REV_STRICT && JSON.stringify(live.curve) === JSON.stringify(INK_V13_BAND_CURVE), "LIVE_BANDS lists inkRev 14 on inkRev 13's straight line (12 a level), still against inkRev 8");
  ok(INK_V14_STD.field === "inkRev" && INK_V14_STD.rev === INK_REV_BIG && JSON.stringify(INK_V14_STD.parts) === JSON.stringify(INK_V13_STD.parts), "inkRev 14's spec is inkRev 13's parts (levels 120, ink par 30, trick shots 20, clovers 10, speed 20)");
  ok(roundMaxFor("inkbridge") === 200 && stdSpecMax(INK_V14_STD) === 200, "the parts total 200, the round maximum");
  const help = PUZZLE_INSTRUCTIONS.inkbridge;
  const how = help.how.map((h) => `${h.action} ${h.detail}`).join(" ");
  ok(how.includes("Ink 18 · par 54") && !how.includes("Ink 84 / par 90"), "the help quotes the new readout (\"Ink 18 · par 54\")");
  ok(inkInkText(18, 54) === "18 · par 54", "the HUD's ink pill reads \"Ink\" then \"18 · par 54\" (one ·)");
  ok(roomIdentity.rev === INK_REV_BIG, "room identity is measured on the dealt stamp (inkRev 14)");
}

/* 2. Legacy. */
section("Legacy: inkRev 13 runs and inkRev 10–13 level digests unchanged");
{
  const fx = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/ink-v14-legacy.json.gz")).toString()) as { runs: (Rec & { rev: number })[]; levelDigests: { rev: number; seed: number; sha: string }[] };
  let same = 0;
  for (const run of fx.runs) {
    const r = replayInkBridgeRun(run.seed, run.raw, run.rev);
    if (r.score === run.score && r.levels === run.levels && r.fails === run.fails && r.state.tick === run.tick && inkCheckpoint(r.state).checksum === run.checksum && !r.flagged) same++;
    else failures.push(`legacy ${run.who} seed ${run.seed} inkRev ${run.rev}: ${r.score} (${r.levels} levels, tick ${r.state.tick}), recorded ${run.score} (${run.levels}, tick ${run.tick})`);
  }
  ok(fx.runs.length >= 9 && fx.runs.every((r) => r.rev === INK_REV_CLOVER) && same === fx.runs.length, `${same} / ${fx.runs.length} inkRev 13 runs replay to the same score, levels, fails, end tick and checkpoint`);
  let digests = 0;
  for (const d of fx.levelDigests) {
    const sha = createHash("sha256").update(JSON.stringify((inkBridgeGameFor(d.rev).init(d.seed) as InkState).list)).digest("hex");
    if (sha === d.sha) digests++;
    else failures.push(`inkRev ${d.rev} seed ${d.seed}: the levels built differ from main's`);
  }
  ok(fx.levelDigests.length === 12 && digests === 12, `inkRev 10, 11, 12 and 13 build the same levels as on main (${digests} / ${fx.levelDigests.length} digests)`);
  const old = inkBridgeGameFor(INK_REV_CLOVER).init(DEAL_SAMPLE[0]!) as InkState;
  ok(old.list.every((l) => l.ballR === undefined && l.cloverR === undefined && l.blocks.every((b) => b.h === INK_BIRD_H_FP)), "an inkRev 13 level carries no sizes and its birds stay 6.5 px");
  ok(old.list.every((l) => inkLevelSizes(l).ball === INK_BALL_R && inkLevelSizes(l).cloverReach === INK_SHAMROCK_R + INK_BALL_R), "an inkRev 13 level plays the 7 px coin and the 9 px clover");
}

/* 3. The sizes: in the sim and in the art. */
section("Sizes: the bigger coin, clovers and birds, in the sim and drawn to its bounds");
{
  ok(INK_V14_BALL_R > INK_BALL_R && INK_V14_SHAMROCK_R > INK_SHAMROCK_R && INK_V14_BIRD_H_FP > INK_BIRD_H_FP, `inkRev 14 is bigger: coin ${INK_BALL_R} → ${INK_V14_BALL_R} px, clover ${INK_SHAMROCK_R} → ${INK_V14_SHAMROCK_R} px, birds ${INK_BIRD_H_FP / 256} → ${INK_V14_BIRD_H_FP / 256} px`);
  for (const seed of [DEAL_SAMPLE[0]!, FRESH[0]!]) {
    const s = game.init(seed) as InkState;
    ok(s.list.every((l) => l.ballR === INK_V14_BALL_R && l.cloverR === INK_V14_SHAMROCK_R && l.blocks.length > 0 && l.blocks.every((b) => b.h === INK_V14_BIRD_H_FP)), `seed ${seed}: every level carries the coin's ${INK_V14_BALL_R} px and the clover's ${INK_V14_SHAMROCK_R} px, every bird ${INK_V14_BIRD_H_FP / 256} px thick`);
    ok(s.list.every((l) => inkLevelSizes(l).ball === INK_V14_BALL_R && inkLevelSizes(l).cloverReach === INK_V14_BALL_R + INK_V14_SHAMROCK_R), `seed ${seed}: the sim plays the level at those sizes (coin ${INK_V14_BALL_R}, clover reach ${INK_V14_BALL_R + INK_V14_SHAMROCK_R})`);
  }
  // The collision test itself: a coin centred r ± 0.5 px above a bird's top, at its middle.
  for (const rev of [INK_REV_CLOVER, INK_REV_BIG]) {
    const lvl = (inkBridgeGameFor(rev).init(DEAL_SAMPLE[1]!) as InkState).list[3]!;
    const b = lvl.blocks[0]!;
    const r = inkLevelSizes(lvl).ball;
    const mx = (b.x0 + b.x1) / 2;
    const h = (b.h ?? 1024) / 256;
    ok(inkCoinTouchesBird(lvl, b, mx, b.y - r + 0.5) && !inkCoinTouchesBird(lvl, b, mx, b.y - r - 0.5), `inkRev ${rev}: a coin touches a bird with its centre within ${r} px of the bird's top, not beyond`);
    ok(inkCoinTouchesBird(lvl, b, mx, b.y + h + r - 0.5) && !inkCoinTouchesBird(lvl, b, mx, b.y + h + r + 0.5), `inkRev ${rev}: and within ${r} px of its underside (${h} px thick)`);
    ok(inkCoinTouchesBird(lvl, b, b.x1 + r - 0.5, b.y + h / 2) && !inkCoinTouchesBird(lvl, b, b.x1 + r + 0.5, b.y + h / 2), `inkRev ${rev}: and within ${r} px of its end`);
  }
  // The art: each painter alone on a clear canvas at 4×; every lit pixel within 2 px of the bounds, and the bounds filled.
  const K = 4;
  const circle = (name: string, r: number, paint: (c: CanvasRenderingContext2D) => void) => {
    const side = (2 * r + 8) * K;
    const c = createCanvas(side, side);
    const ctx = c.getContext("2d");
    ctx.scale(K, K);
    paint(ctx as unknown as CanvasRenderingContext2D);
    const data = ctx.getImageData(0, 0, side, side).data;
    let outside = 0, reach = 0, lit = 0;
    for (let y = 0; y < side; y++)
      for (let x = 0; x < side; x++) {
        if (data[(y * side + x) * 4 + 3]! <= 8) continue;
        lit++;
        const d = Math.hypot((x + 0.5) / K - (r + 4), (y + 0.5) / K - (r + 4));
        if (d > r + 2) outside++;
        reach = Math.max(reach, d);
      }
    ok(lit > 0 && outside === 0 && reach >= r - 2, `the ${name} is drawn within 2 px of its ${r} px circle and reaches its edge (${outside} pixels outside, reach ${reach.toFixed(1)} px)`);
  };
  circle("inkRev 14 coin", INK_V14_BALL_R, (c) => INK_SIZED_ART.coin(c, INK_V14_BALL_R + 4, INK_V14_BALL_R + 4, INK_V14_BALL_R));
  circle("inkRev 13 coin", INK_BALL_R, (c) => INK_SIZED_ART.coin(c, INK_BALL_R + 4, INK_BALL_R + 4, INK_BALL_R));
  circle("inkRev 14 clover", INK_V14_SHAMROCK_R, (c) => INK_SIZED_ART.clover(c, INK_V14_SHAMROCK_R + 4, INK_V14_SHAMROCK_R + 4, INK_V14_SHAMROCK_R));
  {
    const box = { x0: 4, x1: 4 + 96, y: 4 };
    const h = INK_V14_BIRD_H_FP / 256;
    const W = (box.x1 + 4) * K, H = (box.y + h + 4) * K;
    const c = createCanvas(W, H);
    const ctx = c.getContext("2d");
    ctx.scale(K, K);
    let outside = 0;
    const cols = new Set<number>(), rows = new Set<number>();
    for (const tick of [0, 7, 14, 21]) {
      ctx.clearRect(0, 0, W, H);
      INK_SIZED_ART.birds(ctx as unknown as CanvasRenderingContext2D, box, h, tick);
      const data = ctx.getImageData(0, 0, W, H).data;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (data[(y * W + x) * 4 + 3]! <= 8) continue;
          const px = (x + 0.5) / K, py = (y + 0.5) / K;
          const dx = Math.max(0, box.x0 - px, px - box.x1), dy = Math.max(0, box.y - py, py - (box.y + h));
          if (Math.hypot(dx, dy) > 2) outside++;
          cols.add(Math.floor(px));
          rows.add(Math.floor(py));
        }
    }
    const spanX = Math.max(...cols) - Math.min(...cols) + 1, spanY = Math.max(...rows) - Math.min(...rows) + 1;
    ok(outside === 0 && spanX >= 96 - 4 && spanY >= h - 3, `a flock of inkRev 14 birds is drawn within 2 px of its ${96} × ${h} px box and fills it (${outside} pixels outside; drawn ${spanX} × ${spanY} px)`);
  }
}

/* 4. The deal and its proofs. */
section("The deal: every level proved with the bigger sizes; every entry's perfect run 200 through the server replay");
{
  for (const seed of [...DEAL_SAMPLE, ...FRESH]) ok(inkBigProved(seed), `seed ${seed}: every level drawable and proved with the bigger coin and birds, two clovers on proved lines, two live levels, every ink par at least its line's ink`);
  const deal = readInkBigDeal();
  const witnesses = readInkBigWitnesses();
  ok(deal.length === INK_BIG_DEAL.length && deal.every((s, i) => s === INK_BIG_DEAL[i]) && INK_BIG_DEAL.length >= 100, `the deal lists ${INK_BIG_DEAL.length} seeds`);
  ok(witnesses.length === deal.length && witnesses.every((w, i) => w.seed === deal[i]), "the deal is exactly the witnessed seeds, in order");
  const picked = FULL ? witnesses : witnesses.filter((_, i) => i % Math.ceil(witnesses.length / 12) === 0);
  let full = 0;
  for (const w of picked) {
    const v = inkBigVerdict(w.seed, w.events);
    const r = replayInkBridgeRun(w.seed, encode(w.seed, w.events), INK_REV_BIG);
    const b = inkV13Score(r.state);
    if (v.score === 200 && !v.flagged && b.core === 120 && b.features["par"] === 30 && b.features["tricks"] === 20 && b.features["clovers"] === 10 && b.features["speed"] === 20) full++;
    else failures.push(`deal seed ${w.seed}: the witness scores ${v.score}${v.flagged ? " (flagged)" : ""} (${JSON.stringify(b)})`);
  }
  ok(full === picked.length, `${full} / ${picked.length} deal entries${FULL ? " (all)" : " (sampled; CHECKS_FULL=1 for all)"}: the perfect run scores 200 through the server replay, every part at its maximum`);
}

/* 5. Rules carried from inkRev 13. */
section("Rules: a miss never ends the run; the parts' arithmetic is inkRev 13's");
{
  const seed = DEAL_SAMPLE[1]!;
  const events: ArcadeInputEvent[] = [];
  let s = game.init(seed) as InkState;
  let presses = 0;
  while (!game.isOver(s) && s.tick < 60 * 60) {
    const t = s.tick + 1;
    const ev = !s.dropping && t % 30 === 0 ? { t, k: INK_INPUT_RELEASE, a: ++presses % 256, b: 0, c: 0, d: 0 } : s.dropping && s.dropTicks > 5 ? { t, k: INK_INPUT_DROP_AGAIN, a: ++presses % 256, b: 0, c: 0, d: 0 } : null;
    if (ev) events.push(ev);
    s = game.step(s, ev);
  }
  ok(!game.isOver(s) && s.levels === 0 && presses > 20, `failed drops never end the run (${presses} presses in 60 s, still playing)`);
  const b = inkV13Score({ ...s, rev: INK_REV_BIG, acted: 1, levels: 3, inkPar: 2500, tricks: 1, shamrocks: 1 });
  ok(b.core === 36 && b.features["par"] === 7 && b.features["tricks"] === 5 && b.features["clovers"] === 5 && b.features["speed"] === 0, `parts: 3 levels 36, credit 2500 → 7, a trick shot 5, a clover 5, no speed short of ten levels (${JSON.stringify(b)})`);
}

/* 6. Recorded inkRev 14 runs. */
section("Recorded inkRev 14 runs replay unchanged");
{
  const fx = JSON.parse(gunzipSync(readFileSync(RUNS_FIXTURE)).toString()) as { rev: number; runs: Rec[] };
  ok(fx.rev === INK_REV_BIG && fx.runs.length >= 11 && fx.runs.some((r) => r.who === "perfect" && r.score === 200), "bot runs at five levels and a perfect run recorded on inkRev 14");
  let same = 0;
  for (const run of fx.runs) {
    const r = replayInkBridgeRun(run.seed, run.raw, INK_REV_BIG);
    if (r.score === run.score && r.levels === run.levels && r.fails === run.fails && r.state.tick === run.tick && inkCheckpoint(r.state).checksum === run.checksum && !r.flagged) same++;
    else failures.push(`recorded ${run.who} seed ${run.seed}: ${r.score}, recorded ${run.score}`);
  }
  ok(same === fx.runs.length, `${same} / ${fx.runs.length} recorded inkRev 14 runs replay unchanged`);
  const stored = (JSON.parse(readFileSync("scripts/fixtures/replay-runs.json", "utf8")) as { runs: { type: string; puzzle: { inkRev?: number; seed: number }; answer: string; score: number }[] }).runs.filter((r) => r.type === "inkbridge" && r.puzzle.inkRev === INK_REV_BIG);
  ok(stored.length >= 1 && stored.every((r) => replayInkBridgeRun(r.puzzle.seed, r.answer, INK_REV_BIG).score === r.score), `the stored replay-runs entries on inkRev 14 (${stored.length}) replay to their stored scores`);
}

/* 7. Scoring floors. */
section("Scoring: no input 0, any input at least 1, random input low");
{
  const seed = DEAL_SAMPLE[0]!;
  ok(replayInkBridgeRun(seed, encode(seed, []), INK_REV_BIG).score === 0, "no input scores 0");
  ok(replayInkBridgeRun(seed, encode(seed, [{ t: 30, k: INK_INPUT_STROKE, a: 100, b: 100, c: 1, d: 0 }]), INK_REV_BIG).score === 1, "one stroke point scores 1");
  const randoms = DEAL_SAMPLE.slice(0, 3).map((sd) => replayInkBridgeRun(sd, encode(sd, randomInkLog(INK_REV_BIG, sd)), INK_REV_BIG).score);
  ok(Math.max(...randoms) <= 60 && Math.min(...randoms) >= 1, `random input stays low (${randoms.join(", ")})`);
}

/* 8. Room identity. */
section("Room identity: different logs see the same dealt run");
{
  const seed = DEAL_SAMPLE[0]!;
  const logs = roomIdentity.logs(seed, INK_REV_BIG);
  const lists = logs.map((log) => JSON.stringify(roomIdentity.scheduleOf(seed, INK_REV_BIG, log)));
  ok(lists.every((l) => l === lists[0]) && lists[0]!.includes("ink par") && lists[0]!.includes("shamrock"), `seed ${seed}: ${logs.length} logs (idle, random, weak, elite, perfect) see the same levels, clovers and ink pars`);
  const ends = logs.map((log) => {
    let r = game.init(seed) as InkState;
    const byTick = new Map(log.map((e) => [e.t, e]));
    while (!game.isOver(r) && r.tick < game.runTicks) r = game.step(r, byTick.get(r.tick + 1) ?? null);
    return r.levels;
  });
  ok(new Set(ends).size >= 3, `seed ${seed}: the logs really differ (levels reached ${ends.join(", ")})`);
}

const secs = ((performance.now() - t0) / 1000).toFixed(1);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL ink-v14-check: ${failures.length} of ${checks} checks failed (${secs} s)`);
  process.exit(1);
}
console.log(`PASS ink-v14-check: ${checks} checks (${secs} s)`);
