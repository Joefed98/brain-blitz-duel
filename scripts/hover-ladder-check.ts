/**
 * hover-ladder-check (D5, 23 Nov 2026; no browser, about a minute; `CHECKS_FULL=1` re-plays the proof player on every
 * dealt seed, about half an hour): Hover hoverRev 12, Normal's fitted full lines and the gap ladder
 * (docs/arcade-standard/hover.md "hoverRev 12" and "Levels (D5, 23 Nov 2026)").
 *
 *  1. Older rounds: every run recorded before hoverRev 12 (scripts/fixtures/hover-rev12-legacy.json.gz: hoverRev 11 at
 *     Easy, Normal, Hard and Expert, hoverRev 10) grades exactly as recorded (score, verdict, extra).
 *  2. The stamp and the pin: Normal (and every level) deals hoverRev 12 on a seed of its level's proved list; a Normal deal
 *     is byte for byte the deal with no level; with `hoverPreFit` pinned rooms deal hoverRev 11 at every level, with
 *     `preRetro` hoverRev 10; LIVE_BANDS, the practice stamps and practice's definition name hoverRev 12.
 *  3. Normal plays hoverRev 11 exactly: the legacy fixture's hoverRev 11 Normal logs replay on hoverRev 12 with the same
 *     checkpoints and counts, scored on HOVER_V12_FIT; the five parts and their maximums (200) and the lines' rule.
 *  4. The levels as dealt: the registry is HOVER_LEVELS_V12 row for row, hoverRev 11's table is unchanged; each level's
 *     course is hoverRev 11's with every gap scaled by its gapPct, its shields, its slide, Normal's scroll; Easy's three
 *     shields forgive three crashes.
 *  5. The deal: hoverLevelDeals.server.ts is exactly what scripts/hover-level-deal.ts builds from the stored witnesses,
 *     every witness scores exactly 200 through the server replay (and through gradeAnswer on its dealt puzzle), and the
 *     proof player re-played on a sample (every seed with CHECKS_FULL=1) plays exactly the witness, taps at least 0.15 s
 *     apart; every dealt seed is reachable.
 *  6. The ladder: the recorded table (scripts/fixtures/d5-ladder-hover.json.gz, 96 deals a level), and a
 *     sample of it re-played on today's code.
 *
 *   bun scripts/hover-ladder-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import {
  HOVER_CHECKPOINT_INTERVAL,
  HOVER_DISC_R,
  HOVER_EXPAND_H,
  HOVER_GAP_MARGIN,
  HOVER_MOVE_AMP,
  HOVER_REV_FIT,
  HOVER_REV_SHIELD,
  HOVER_REV_STANDARD,
  HOVER_STD_CENTRE_SPAN,
  HOVER_STD_MAX,
  HOVER_V12_FIT,
  HOVER_V12_BAND_CURVE,
  hoverCheckpoint,
  hoverGameFor,
  hoverScroll,
  hoverScrollOf,
  hoverStandardParts,
  type HoverState,
} from "../src/lib/arcade/hover";
import { HOVER_LEVELS, HOVER_LEVELS_V12 } from "../src/lib/arcade/retroLevels";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { pinPreRetro } from "../src/lib/duel/arcade.server";
import { setDealPin } from "../src/lib/duel/dealEra";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { decodeHoverRun } from "../src/lib/duel/hover";
import { HOVER_LEVEL_DEALS, hoverLevelDealSeed } from "../src/lib/duel/hoverLevelDeals.server";
import { PRACTICE_STAMPS } from "../src/lib/duel/practiceStamps.data";
import { hoverPuzzle } from "../src/puzzles/hover";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData } from "../src/lib/duel/types";
import { GAME_LEVELS } from "../src/lib/levels/gameLevels";
import type { Level } from "../src/lib/levels/levels";
import { replaySample } from "./d5-ladder-lib";
import { stableExtra, type D5LegacyCase } from "./d5-levels-legacy-record";
import { HOVER_DEAL_FILE, HOVER_DEAL_LEVELS, checkHoverWitnesses, hoverDealSource, proofTapsAt, readHoverWitnesses } from "./hover-level-deal";
import { PROOF_LAG, PROOF_TAP_GAP } from "./hover-proof-player";
import { HOVER_REV12_LEGACY } from "./hover-rev12-legacy-record";

let passes = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
};
const section = (s: string) => console.log(`\n${s}`);
const FULL = process.env.CHECKS_FULL === "1";
const deal = (level: Level | null, seed: number) => withSeededRandom(seed, () => generatePuzzle("hover", { bankSeed: seed, ...(level ? { level } : {}) })) as unknown as { seed: number; hoverRev?: number; level?: string };

section("1. Older rounds grade exactly as recorded (hoverRev 11 at every level, hoverRev 10)");
const legacy = (JSON.parse(gunzipSync(readFileSync(HOVER_REV12_LEGACY)).toString()) as { cases: D5LegacyCase[] }).cases;
{
  ok(legacy.length >= 80, `the legacy fixture holds ${legacy.length} runs`);
  for (const level of ["easy", "normal", "hard", "expert"]) ok(legacy.some((c) => c.level === level && (c.puzzle as unknown as { hoverRev: number }).hoverRev === HOVER_REV_SHIELD), `hoverRev 11 ${level} runs recorded`);
  ok(legacy.some((c) => (c.puzzle as unknown as { hoverRev: number }).hoverRev === HOVER_REV_STANDARD), "hoverRev 10 runs recorded");
  let same = 0;
  for (const c of legacy) {
    const g = gradeAnswer(c.puzzle, c.answer, 0);
    if (g.score === c.score && g.isCorrect === c.isCorrect && stableExtra(g.extra) === c.extra) same++;
    else ok(false, `${c.level} ${c.who}: ${c.score} → ${g.score}${stableExtra(g.extra) === c.extra ? "" : " (extra differs)"}`);
  }
  ok(same === legacy.length, `${same} of ${legacy.length} legacy runs grade exactly as recorded`);
}

section("2. The stamp and the pin");
{
  for (const level of ["easy", "normal", "hard", "expert"] as const) {
    for (const s of [3, 77, 4242]) {
      const p = deal(level === "normal" ? null : level, s);
      ok(p.hoverRev === HOVER_REV_FIT, `${level} seed ${s}: deals hoverRev 12 (${p.hoverRev})`);
      ok(HOVER_LEVEL_DEALS[level].includes(p.seed), `${level} seed ${s}: the seed is on ${level}'s proved list`);
      ok(level === "normal" ? p.level === undefined : p.level === level, `${level} seed ${s}: the level is stamped (${p.level ?? "none"})`);
    }
  }
  for (const s of [7, 99, 4242]) ok(JSON.stringify(deal(null, s)) === JSON.stringify(deal("normal", s)), `seed ${s}: a Normal deal is the deal with no level`);
  const was = setDealPin("hoverPreFit", true);
  for (const level of ["easy", "normal", "expert"] as const) ok(deal(level === "normal" ? null : level, 11).hoverRev === HOVER_REV_SHIELD, `hoverPreFit pinned: ${level} deals hoverRev 11`);
  setDealPin("hoverPreFit", was);
  const wasRetro = pinPreRetro(true);
  ok(deal(null, 11).hoverRev === HOVER_REV_STANDARD, "preRetro pinned: Normal deals hoverRev 10");
  pinPreRetro(wasRetro);
  ok(LIVE_BANDS.hover.rev === HOVER_REV_FIT && LIVE_BANDS.hover.curve === HOVER_V12_BAND_CURVE, "LIVE_BANDS names hoverRev 12 and its core line");
  ok(/hoverRev=12\b/.test(PRACTICE_STAMPS.hover ?? ""), `practice stamps name hoverRev 12 (${PRACTICE_STAMPS.hover})`);
  ok((hoverPuzzle.generate() as unknown as { hoverRev: number }).hoverRev === HOVER_REV_FIT, "practice's definition deals hoverRev 12");
  const keys = Object.keys(HOVER_LEVEL_DEALS).sort().join();
  ok(keys === "easy,expert,hard,normal", `the deal lists every level (${keys})`);
  for (const level of HOVER_DEAL_LEVELS) ok(HOVER_LEVEL_DEALS[level].length >= 60, `${level}: ${HOVER_LEVEL_DEALS[level].length} proved seeds (at least 60)`);
  // Every proved seed is reachable from some room seed (the list is indexed by the room seed's remainder).
  for (const level of HOVER_DEAL_LEVELS) {
    const list = HOVER_LEVEL_DEALS[level];
    ok(list.every((seed, i) => hoverLevelDealSeed(level, i) === seed), `${level}: every proved seed is dealt by some room seed`);
  }
}

section("3. Normal plays hoverRev 11 exactly; the parts on the fitted lines");
{
  const rev11 = legacy.filter((c) => c.level === "normal" && (c.puzzle as unknown as { hoverRev: number }).hoverRev === HOVER_REV_SHIELD);
  let same = 0;
  for (const c of rev11) {
    const run = decodeHoverRun(c.answer);
    const taps = new Set(run.inputs);
    const a = hoverGameFor(HOVER_REV_SHIELD, null);
    const b = hoverGameFor(HOVER_REV_FIT, null);
    let sa = a.init((c.puzzle as unknown as { seed: number }).seed) as HoverState;
    let sb = b.init((c.puzzle as unknown as { seed: number }).seed) as HoverState;
    let alike = sb.fit === 1 && sa.fit === undefined;
    while (!a.isOver(sa) && alike) {
      sa = a.step(sa, taps.has(sa.tick + 1)) as HoverState;
      sb = b.step(sb, taps.has(sb.tick + 1)) as HoverState;
      if (sa.tick % HOVER_CHECKPOINT_INTERVAL === 0 && hoverCheckpoint(sa).checksum !== hoverCheckpoint(sb).checksum) alike = false;
    }
    alike &&= b.isOver(sb) && sa.gates === sb.gates && sa.stars === sb.stars && sa.tight === sb.tight && sa.chainsDone === sb.chainsDone && sa.ctrFine === sb.ctrFine && sa.crashed === sb.crashed;
    if (alike) same++;
  }
  ok(rev11.length >= 10 && same === rev11.length, `${same} of ${rev11.length} hoverRev 11 Normal logs play tick for tick the same on hoverRev 12`);
  ok(HOVER_STD_MAX === 200, `the five parts' maximums total 200 (${HOVER_STD_MAX})`);
  const probe = hoverGameFor(HOVER_REV_FIT, null).init(roomSeedOf(0)) as HoverState;
  const full = hoverStandardParts({ ...probe, gates: HOVER_V12_FIT.coreAt, stars: HOVER_V12_FIT.goldAt, tight: HOVER_V12_FIT.tightAt, ctrFine: Math.ceil((HOVER_STD_CENTRE_SPAN * 5 * HOVER_V12_FIT.centreAt) / 1000), acted: 1 });
  ok(full.core === 120 && full.gold === 20 && full.tight === 20 && full.centre === 10, `each part is full at its fitted line (${JSON.stringify(full)})`);
  const short = hoverStandardParts({ ...probe, gates: HOVER_V12_FIT.coreAt - 1, stars: HOVER_V12_FIT.goldAt - 1, tight: HOVER_V12_FIT.tightAt - 1, ctrFine: 0, acted: 1 });
  ok(short.core < 120 && short.gold < 20 && short.tight < 20 && short.centre === 0, `one short of each line is short of the part (${JSON.stringify(short)})`);
  const old = hoverStandardParts({ ...probe, fit: undefined, gates: HOVER_V12_FIT.coreAt, stars: HOVER_V12_FIT.goldAt, tight: HOVER_V12_FIT.tightAt, ctrFine: 0, acted: 1 });
  ok(old.gold === Math.floor((20 * HOVER_V12_FIT.goldAt) / 10), "hoverRev 11's lines are unchanged (gold stars on all 10)");
}

section("4. The levels as dealt");
{
  for (const level of ["easy", "hard", "expert"] as const) {
    const reg = GAME_LEVELS.hover?.levels[level]?.settings;
    ok(JSON.stringify(reg) === JSON.stringify(HOVER_LEVELS_V12[level]), `${level}: the registry is HOVER_LEVELS_V12's row (${JSON.stringify(reg)})`);
  }
  ok(JSON.stringify(HOVER_LEVELS) === JSON.stringify({ easy: { shield: 1, gapPct: 115, scrollPct: 100 }, hard: { shield: 0, gapPct: 100, scrollPct: 106 }, expert: { shield: 0, gapPct: 100, scrollPct: 112 } }), "hoverRev 11's table is unchanged (stored level rounds replay on it)");
  const lv = HOVER_LEVELS_V12;
  ok(lv.easy.gapPct > 100 && lv.hard.gapPct < 100 && lv.expert.gapPct < lv.hard.gapPct, `the lever: gaps wider on Easy, narrower on Hard, narrower still on Expert (${lv.easy.gapPct} / 100 / ${lv.hard.gapPct} / ${lv.expert.gapPct} %)`);
  ok(lv.easy.shield === 3 && lv.hard.shield === 1 && lv.expert.shield === 0, "shields: three on Easy, one on Hard (Normal's), none on Expert");
  ok(!lv.easy.slide && lv.hard.slide && lv.expert.slide, "Easy's gaps never slide; Hard's and Expert's slide as Normal's");
  ok(lv.easy.scrollPct === 100 && lv.hard.scrollPct === 100 && lv.expert.scrollPct === 100, "every level scrolls at Normal's pace");
  for (const level of ["easy", "hard", "expert"] as const) {
    const seed = HOVER_LEVEL_DEALS[level][0] ?? 1;
    const base = hoverGameFor(HOVER_REV_SHIELD, null).init(seed) as HoverState;
    const s = hoverGameFor(HOVER_REV_FIT, level).init(seed) as HoverState;
    const row = lv[level];
    ok(s.fit === 1 && s.lv === row && s.shield === row.shield, `${level}: the run starts with the level's row and ${row.shield} shield(s)`);
    let scaled = 0;
    let checked = 0;
    const bottom = HOVER_EXPAND_H * 256;
    s.pillars.forEach((p, i) => {
      const b = base.pillars[i]!;
      if (p.gap2Top !== undefined) return;
      checked++;
      // hover.ts scaleGap: the course's gap scaled about its centre, inside the margins (a sliding gap's sweep too).
      const swing = row.slide && b.movePhase !== undefined ? HOVER_MOVE_AMP : 0;
      const want = Math.max(HOVER_DISC_R * 2 + 512, Math.min(bottom - 2 * (HOVER_GAP_MARGIN + swing), Math.trunc((b.gapH * row.gapPct) / 100)));
      const centre = (top: number, h: number) => top + (h >> 1);
      const placed = Math.abs(centre(p.gapTop, p.gapH) - centre(b.gapTop, b.gapH)) <= 256 || p.gapTop === HOVER_GAP_MARGIN + swing || p.gapTop + p.gapH === bottom - HOVER_GAP_MARGIN - swing;
      if (p.gapH === want && placed) scaled++;
      if (!row.slide && p.movePhase !== undefined) ok(false, `${level}: barrier ${i} slides`);
    });
    ok(checked > 20 && scaled === checked, `${level}: every single-gap barrier's gap is the course's scaled by ${row.gapPct} % (${scaled} of ${checked})`);
    ok(hoverScrollOf(s, 10) === hoverScroll(10), `${level}: Normal's scroll`);
  }
  // Easy's three shields: a run that never taps crashes on the floor three times and flies on.
  const easy = hoverGameFor(HOVER_REV_FIT, "easy");
  let s = easy.init(HOVER_LEVEL_DEALS.easy[0] ?? 1) as HoverState;
  while (!easy.isOver(s) && (s.shieldBreaks ?? 0) < 3) s = easy.step(s, false) as HoverState;
  ok((s.shieldBreaks ?? 0) === 3 && !s.crashed, `Easy: three crashes forgiven (${s.shieldBreaks} shields broken, still flying)`);
  while (!easy.isOver(s) && s.tick < 3600 && (s.invuln ?? 0) > 0) s = easy.step(s, false) as HoverState;
  while (!easy.isOver(s)) s = easy.step(s, false) as HoverState;
  ok(s.crashed && (s.shieldBreaks ?? 0) === 3, "Easy: the fourth crash ends the run");
}

section("5. The deal: every dealt seed's proof run scores 200");
{
  const w = readHoverWitnesses();
  ok(readFileSync(HOVER_DEAL_FILE, "utf8") === hoverDealSource(w), "hoverLevelDeals.server.ts is exactly what hover-level-deal.ts builds from the witnesses");
  for (const level of HOVER_DEAL_LEVELS) ok(JSON.stringify((w.levels[level]?.witnesses ?? []).map((x) => x.seed)) === JSON.stringify(HOVER_LEVEL_DEALS[level]), `${level}: one witness a dealt seed, in order`);
  const bad = checkHoverWitnesses(w);
  ok(bad.length === 0, `every stored witness scores exactly 200 through the server replay (${bad.slice(0, 3).join("; ") || "all"})`);
  for (const level of HOVER_DEAL_LEVELS) {
    const list = w.levels[level]?.witnesses ?? [];
    for (const x of list) {
      const gaps = x.taps.slice(1).map((t, i) => t - x.taps[i]!);
      if (gaps.some((g) => g < PROOF_TAP_GAP)) ok(false, `${level} ${x.seed}: a tap sooner than 0.15 s after the last`);
    }
    // Through gradeAnswer on the dealt puzzle (the room's own grading path), one a level.
    const x = list[0];
    if (x) {
      const puzzle = { type: "hover", seed: x.seed, hoverRev: HOVER_REV_FIT, ...(level === "normal" ? {} : { level }) } as unknown as PuzzleData;
      const { proveHoverWitness } = await import("./hover-level-deal");
      const g = gradeAnswer(puzzle, proveHoverWitness(x.seed, level, x.taps).raw, 0);
      ok(g.score === 200, `${level} ${x.seed}: the proof run scores 200 through gradeAnswer (${g.score})`);
    }
    const sample = FULL ? list : [list[Math.floor(list.length / 2)]!].filter(Boolean);
    let alike = 0;
    for (const y of sample) if (proofTapsAt(y.seed, level).join() === y.taps.join()) alike++;
    ok(sample.length > 0 && alike === sample.length, `${level}: the proof player (taps ${PROOF_TAP_GAP} ticks apart, ${PROOF_LAG} ticks to react) re-plays ${alike} of ${sample.length} sampled witnesses exactly`);
  }
}

section("6. The ladder (the recorded 96 deals a level, and a live re-play sample)");
{
  try {
    // The recorded 96-deal figures are reported, not targets (Joe, 27 Nov 2026: sessions don't decide difficulty), so this
    // check no longer holds them to the ladder test; it re-plays a sample to show the figures are today's game.
    for (const [cond, label] of await replaySample("hover", 2)) ok(cond, label);
  } catch (e) {
    ok(false, `the recorded ladder (scripts/fixtures/d5-ladder-hover.json.gz) reads: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function roomSeedOf(i: number): number {
  return HOVER_LEVEL_DEALS.normal[i] ?? 1;
}

console.log(`\n${failures.length ? "FAIL" : "PASS"}: ${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
