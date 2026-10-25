/**
 * Grappler's expansion (swingRev 12, 25 Oct 2026, docs/expansions/e7-swing.md): a wider, deeper cave
 * (450 × 844) with high-route gems, low-route speed gates, swing combos and set-route ledge sections
 * (start ledge, landing ledges, a collapsing one, the finish flag), scored to 200.
 *
 *  1. Old rounds: skill-band runs recorded on main before the change on swingRev 9, 10 and 11
 *     (scripts/fixtures/swing-rev12-legacy.json; older revisions are in arcade-tuning-g3-legacy.json)
 *     replay through today's server path to the same score and the same final state; their states
 *     carry no expansion field.
 *  2. New rounds: rooms deal swingRev 12 from SWING_V12_BANK (bank courses re-proved with every
 *     feature: two or three full sections, twelve gems, eight gates, ten stars, a finishing witness);
 *     the start state keeps rev 9's ceiling, anchors, spikes and stalactites, the lava lower with each
 *     jet's top where it was; stored rev-12 runs (scripts/fixtures/swing-rev12-runs.json) replay exactly.
 *  3. Sections: on sampled bank courses every ledge of every section is reached from the one before
 *     in the real sim (a kick off it and a release window of three or more ticks), the flag's kick
 *     leads on to the open course, and a collapsing ledge gives way SWING_LEDGE_CRUMBLE ticks after
 *     the first landing; ledges are one-way and never end a run.
 *  4. Gates light only at gate speed through the opening; gems are touch pickups; the chain grows
 *     only on fast, quick, forward grabs and every fifth link is a combo point.
 *  5. Scores: the base curve (to 140, + 10 for 500 m) plus the features (capped at 50), the round's
 *     maximum 200; no input scores 0; strong-play witnesses (scripts/swing-rev12-witness.ts,
 *     scripts/fixtures/swing-rev12-witness.json) reach 190 or more through the server replay.
 *  6. Display and text: the effects and reveal sizes by revision, the intro line, the help, the
 *     intro demo held to swingRev 12.
 *
 *   bun scripts/swing-rev12-check.ts          (CHECKS_FULL=1: every bank course's features and sections)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import {
  expand12LedgeGone,
  swingCheckpoint,
  swingFeaturePoints,
  swingGameFor,
  swingRevealHFor,
  swingWorldHFor,
  swingWorldWFor,
  SWING_COMBO_CAP,
  SWING_COMBO_EVERY,
  SWING_COMBO_SPEED,
  SWING_FEATURE_CAP,
  SWING_GATES,
  SWING_GATE_SPEED,
  SWING_GEMS,
  SWING_GEM_TOUCH,
  SWING_INPUT_HOLD,
  SWING_LEDGE_CRUMBLE,
  SWING_REV_EXPAND,
  SWING_REV_STRICT,
  SWING_SECTION_LEDGES,
  SWING_STARS,
  SWING_V12_BAND_CURVE,
  SWING_V12_DROP,
  SWING_V12_H,
  SWING_V12_W,
  type SwingState,
} from "../src/lib/arcade/swing";
import { SWING_FX_V12, swingFxFor } from "../src/lib/arcade/arcadeFxGames.renderer";
import { ARCADE_REVEAL_RENDERERS, revealWorldH } from "../src/lib/arcade/revealRenderers";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { generateSwing } from "../src/lib/duel/arcade.server";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { encodeSwingRun, replaySwingRun } from "../src/lib/duel/swing";
import { SWING_V9_BANK } from "../src/lib/duel/swingBankV9.server";
import { SWING_V12_BANK } from "../src/lib/duel/swingBankV12.server";
import { swingExpandComplete } from "../src/lib/duel/swingProof.server";

const FP = 256;
const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const game = swingGameFor(SWING_REV_EXPAND);
const hold = (s: SwingState, a: number) => ({ t: s.tick + 1, k: SWING_INPUT_HOLD, a, b: 0, c: 0, d: 0 });

/* 1–2. Stored runs replay exactly. */
for (const [file, label] of [["scripts/fixtures/swing-rev12-legacy.json", "pre-change"], ["scripts/fixtures/swing-rev12-runs.json", "swingRev 12"]] as const) {
  const { runs } = JSON.parse(readFileSync(file, "utf8")) as { runs: { rev: number | null; level: string; seed: number; score: number; stateHash: number; raw: string }[] };
  let same = 0;
  for (const run of runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replaySwingRun(run.seed, raw, run.rev ?? undefined);
    const identical = !result.flagged && result.score === run.score && fnv(JSON.stringify(result.state)) === run.stateHash;
    if (identical) same++;
    else failures.push(`${label} run rev ${run.rev} ${run.level} ${run.seed}: replay ${result.score} (stored ${run.score})${result.flagged ? " flagged" : ""}`);
    if (run.rev !== SWING_REV_EXPAND) ok(result.state.expand === undefined && result.state.worldW === undefined && result.state.ledges === undefined, `rev ${run.rev} state carries no expansion field`);
  }
  checks++;
  console.log(`${label}: ${same} / ${runs.length} stored runs replay to the same score and state`);
}

/* 2. Generator, bank and start state. */
{
  for (let k = 0; k < 20; k++) {
    const p = generateSwing();
    ok(p.swingRev === SWING_REV_EXPAND && SWING_V12_BANK.some((e) => e.seed === p.seed), "rooms deal swingRev 12 on a bank course");
  }
  const v9 = new Set(SWING_V9_BANK.map((e) => e.seed));
  ok(SWING_V12_BANK.length >= 100 && SWING_V12_BANK.every((e) => v9.has(e.seed) && e.stars === SWING_STARS), `the rev-12 bank holds ${SWING_V12_BANK.length} re-proved rev-9 courses, each with a ten-star witness`);
  const sample = FULL ? SWING_V12_BANK : SWING_V12_BANK.filter((_, i) => i % 16 === 0);
  for (const e of sample) ok(swingExpandComplete(e.seed), `bank course ${e.seed} carries every feature`);
  const e = SWING_V12_BANK[0]!;
  const old = swingGameFor(SWING_REV_STRICT).init(e.seed);
  const s = game.init(e.seed);
  ok(s.worldW === SWING_V12_W && s.worldH === SWING_V12_H && swingWorldWFor(SWING_REV_EXPAND) === 450 && swingWorldHFor(SWING_REV_EXPAND) === 844 && swingWorldWFor(SWING_REV_STRICT) === 390, "the view is 450 × 844 (390 wide on older revisions)");
  ok(JSON.stringify(s.ceil) === JSON.stringify(old.ceil) && JSON.stringify(s.anchors) === JSON.stringify(old.anchors) && JSON.stringify(s.spikes) === JSON.stringify(old.spikes), "ceiling, anchors and spikes are rev 9's");
  ok(s.floor.every((y, i) => y === old.floor[i]! - 110 * FP + SWING_V12_DROP), "the lava sits 224 px below rev 8's (114 below rev 9's)");
  ok((s.jets ?? []).every((j, i) => s.floor.length > 0 && j.h - SWING_V12_DROP === old.jets![i]!.h - 110 * FP && j.x === old.jets![i]!.x), "every jet's top is where it was");
  ok((s.rocks ?? []).every((r, i) => r.x === old.rocks![i]!.x && r.trigger === old.rocks![i]!.trigger), "stalactites are rev 9's");
  ok(s.rng === old.rng && (s.starSpots ?? []).length === SWING_STARS, "the stored rng is unchanged and ten stars are re-proved");
  ok((s.gems ?? []).length === SWING_GEMS && (s.gates ?? []).length === SWING_GATES && (s.ledges ?? []).length >= 2 * SWING_SECTION_LEDGES, "twelve gems, eight gates and two or three sections");
  ok((s.gates ?? []).every((g) => g.y0 < g.y1), "each gate's opening runs top to bottom");
}

/* 3. Sections play in the real sim. */
{
  const sample = FULL ? SWING_V12_BANK : SWING_V12_BANK.filter((_, i) => i % 40 === 0);
  let pairs = 0;
  for (const e of sample) {
    const s0 = game.init(e.seed);
    const ledges = s0.ledges ?? [];
    for (let i = 0; i < ledges.length; i++) {
      const l = ledges[i]!;
      // Standing at the ledge's centre after a landing there (the walk ends at the centre).
      const stand: SwingState = { ...s0, x: l.x, y: l.top - 10 * FP, rope: -1, vx: 0, vy: 0, ledgeOn: i, maxX: l.x, acted: 1, ledgeTicks: ledges.map((_, k) => (k === i ? 1 : 0)), tick: 1 };
      const next = ledges.findIndex((q) => q.section === l.section && q.order === l.order + 1);
      const window: number[] = [];
      for (let r = 1; r < 240; r++) {
        let t = game.step(stand, hold(stand, 1));
        for (let k = 0; k < r && !t.ended; k++) t = game.step(t, null);
        t = game.step(t, hold(t, 0));
        if (next < 0) {
          // The flag: a release must lead on (a grab ahead within reach without dying in 110 ticks).
          let alive = true;
          for (let k = 0; k < 110 && alive; k++) {
            t = game.step(t, null);
            if (t.ended === 2) alive = false;
            else if (t.anchors.some((a) => a.x > l.x + 60 * FP && (a.x - t.x) ** 2 + (a.y - t.y) ** 2 < (180 * FP) ** 2)) break;
          }
          if (alive) window.push(r);
        } else {
          for (let k = 0; k < 110 && !t.ended && (t.ledgeOn ?? -1) < 0; k++) t = game.step(t, null);
          if (t.ledgeOn === next) window.push(r);
        }
      }
      let run = 0;
      let longest = 0;
      for (let k = 0; k < window.length; k++) {
        run = k > 0 && window[k] === window[k - 1]! + 1 ? run + 1 : 1;
        longest = Math.max(longest, run);
      }
      ok(longest >= (next < 0 ? 1 : 3), `course ${e.seed} ledge ${i} (section ${l.section}, order ${l.order}): ${next < 0 ? "the flag leads on" : `next ledge reached with a ${longest}-tick window`}`);
      pairs++;
      if (l.crumble) {
        let t: SwingState = stand;
        for (let k = 0; k < SWING_LEDGE_CRUMBLE + 2; k++) t = game.step(t, null);
        ok(expand12LedgeGone(t, i, t.tick) && (t.ledgeOn ?? -1) < 0 && t.rope < 0, `course ${e.seed} ledge ${i}: a collapsing ledge gives way ${SWING_LEDGE_CRUMBLE} ticks after the landing`);
      }
    }
  }
  console.log(`sections: ${pairs} ledges checked in the real sim`);
  // One-way: flying up through a ledge never lands; a ledge never ends a run.
  const e = SWING_V12_BANK[0]!;
  const s0 = game.init(e.seed);
  const l = s0.ledges![0]!;
  let up: SwingState = { ...s0, x: l.x, y: l.top + 40 * FP, rope: -1, vx: 0, vy: -8 * FP, acted: 1 };
  for (let k = 0; k < 8; k++) up = game.step(up, null);
  ok((up.ledgeOn ?? -1) < 0 && up.ended === 0, "rising through a ledge passes it");
  let down: SwingState = { ...s0, x: l.x, y: l.top - 40 * FP, rope: -1, vx: 0, vy: 2 * FP, acted: 1 };
  for (let k = 0; k < 12; k++) down = game.step(down, null);
  ok(down.ledgeOn === 0 && down.ended === 0 && down.y === l.top - 10 * FP, "falling on to a ledge lands on its top line");
}

/* 4. Gates, gems and combos (synthetic bodies on a bank course). */
{
  const e = SWING_V12_BANK[0]!;
  const s0 = game.init(e.seed);
  const g = s0.gates![0]!;
  const mid = Math.trunc((g.y0 + g.y1) / 2);
  const pass = (speed: number, y: number) => {
    let t: SwingState = { ...s0, x: g.x - 3 * speed * FP, y, rope: -1, vx: speed * FP, vy: -77, acted: 1 };
    for (let k = 0; k < 6; k++) t = game.step(t, null);
    return ((t.gatesLit ?? 0) & 1) === 1;
  };
  ok(pass(SWING_GATE_SPEED + 1, mid), "a fast pass through the opening lights the gate");
  ok(!pass(SWING_GATE_SPEED - 2, mid), "a slow pass does not");
  ok(!pass(SWING_GATE_SPEED + 1, g.y0 - 30 * FP), "a fast pass above the opening does not");
  const [gx, gy] = s0.gems![0]!;
  let t: SwingState = { ...s0, x: gx - 4 * FP, y: gy, rope: -1, vx: 2 * FP, vy: -77, acted: 1 };
  t = game.step(t, null);
  ok(((t.gemsTaken ?? 0) & 1) === 1 && SWING_GEM_TOUCH === 22 * FP, "touching a gem takes it");
  // Combos: fast, quick, forward grabs grow the chain; every fifth link is a point.
  let c: SwingState = { ...s0, chain: 0, comboPts: 0, acted: 1 };
  let links = 0;
  for (let k = 0; k < 10; k++) {
    const target = c.anchors.findIndex((a) => a.x > (c.lastGrabX ?? 0) + 40 * FP);
    const a = c.anchors[target]!;
    c = { ...c, x: a.x - 50 * FP, y: a.y + 40 * FP, rope: -1, vx: SWING_COMBO_SPEED * FP + 64, vy: 0, grabTick: c.tick - 30 };
    c = game.step(c, hold(c, 1));
    if (c.rope === target) links++;
  }
  ok(links === 10 && c.chain === 10 && c.comboPts === 10 / SWING_COMBO_EVERY, `ten fast quick grabs make a ten-link chain and two combo points (${c.chain}, ${c.comboPts})`);
  const slow: SwingState = { ...c, x: c.x + 100 * FP, rope: -1, vx: 3 * FP, vy: 0, grabTick: c.tick - 30 };
  const afterSlow = game.step(slow, hold(slow, 1));
  ok(afterSlow.chain === 0 && afterSlow.comboPts === c.comboPts, "a slow grab ends the chain");
}

/* 5. Scores. */
{
  ok(roundMaxFor("swing") === 200, "Grappler's round maximum is 200");
  const pts = SWING_V12_BAND_CURVE.points;
  ok(SWING_V12_BAND_CURVE.units.every((u, i) => i === 0 || u > SWING_V12_BAND_CURVE.units[i - 1]!) && pts.every((p, i) => i === 0 || p >= pts[i - 1]!) && pts.at(-1) === 140, "the base curve rises to 140 at 550 units");
  ok(bandPoints(SWING_V12_BAND_CURVE, 550) + 10 === 150, "500 m with every star is 150 before the features");
  ok(SWING_COMBO_CAP + SWING_GEMS + SWING_GATES + 15 > SWING_FEATURE_CAP && SWING_FEATURE_CAP === 50, "the features can add 50 at most, with slack");
  const e = SWING_V12_BANK[0]!;
  let idle = game.init(e.seed);
  while (!idle.ended) idle = game.step(idle, null);
  ok(game.score(idle) === 0, "a run with no input scores 0");
  const maxed: SwingState = { ...idle, acted: 1, ended: 1, maxX: idle.maxX + 600 * 40 * FP, stars: SWING_STARS, comboPts: 40, gemsTaken: 0xfff, gatesLit: 0xff, ledgeTicks: (idle.ledges ?? []).map(() => 5) };
  ok(game.score(maxed) === 200 && swingFeaturePoints(maxed).total === 50, "everything scores exactly 200, never more");
  const { runs } = JSON.parse(readFileSync("scripts/fixtures/swing-rev12-witness.json", "utf8")) as { runs: { seed: number; score: number; raw: string }[] };
  let best = 0;
  for (const run of runs) {
    const result = replaySwingRun(run.seed, gunzipSync(Buffer.from(run.raw, "base64")).toString(), SWING_REV_EXPAND);
    ok(!result.flagged && result.score === run.score && result.score <= 200, `witness ${run.seed} replays to ${result.score}`);
    best = Math.max(best, result.score);
  }
  ok(runs.length > 0 && best >= 190, `strong feature play reaches ${best} through the server replay`);
  console.log(`witnesses: best ${best} through the server replay`);
  void encodeSwingRun;
  void swingCheckpoint;
}

/* 6. Display and text. */
{
  ok(swingFxFor({ expand: 1 } as SwingState) === SWING_FX_V12 && SWING_FX_V12.width === 450 && SWING_FX_V12.height === 844, "rev-12 effects use the 450 × 844 view");
  ok(swingFxFor({ worldH: 730 } as SwingState).width === 390, "older effects keep 390 wide");
  const reveal = ARCADE_REVEAL_RENDERERS.swing!;
  ok(revealWorldH(reveal, { type: "swing", seed: 1, swingRev: SWING_REV_EXPAND } as any) === swingRevealHFor(SWING_REV_EXPAND) && swingRevealHFor(SWING_REV_EXPAND) === 731, "the reveal keeps the 450 × 844 view's shape in its 390-wide box");
  ok(revealWorldH(reveal, { type: "swing", seed: 1, swingRev: SWING_REV_STRICT } as any) === 730, "older reveals keep 390 × 730");
  ok(/200/.test(INTRO_SCORE.swing) && /combos/.test(INTRO_SCORE.swing), `the intro score line states the new top: "${INTRO_SCORE.swing}"`);
  const help = PUZZLE_INSTRUCTIONS.swing!;
  const text = help.how.map((h) => `${h.action} ${h.detail}`).join(" ");
  ok(/gems/.test(text) && /speed gates/.test(text) && /ledges/.test(text) && /combo/.test(text) && /collapses/.test(text), "the help explains gems, gates, ledges, combos and the collapsing ledge");
  ok(/up to 50 more/.test(help.score) && /Up to 200/.test(help.score), "the help's score line states the features and the 200");
  const demo = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/data\.type === "swing" && demo\?\.puzzle\.type === "swing" && demo\.puzzle\.swingRev !== SWING_REV_EXPAND\) return null/.test(demo), "Grappler's intro demo stays stopped until one is recorded on swingRev 12");
}

if (failures.length) {
  console.log(`\nFAIL: ${failures.length} of ${checks} checks failed:`);
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`\nPASS: ${checks} swingRev 12 checks`);
