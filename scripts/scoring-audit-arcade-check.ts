/**
 * scoring-audit-arcade-check (~1 min): the scoring audit's arcade fixes (Nov 2026; docs/audit-nov-2026/scoring.md issues 2,
 * 5, 7 and 8; docs/arcade-standard/cross.md, wavefront.md, burst.md, skyline.md and slice.md, each with a new section).
 *
 *  1. Wiring: rooms and LIVE_BANDS deal Spacewalk crossRev 12, Wavefront wavRev 13, Fission burstRev 11, High Rise
 *     skylineRev 10 and Slice sliceRev 13; each keeps the previous stamp's play (playRevOf); its intro demo still plays.
 *  2. Older stamps: 176 runs recorded on main (scripts/fixtures/scoring-audit-arcade-legacy.json.gz, recorded by
 *     scripts/scoring-audit-arcade-legacy-record.ts) replay to the same score, checksum and tick.
 *  3. The same play: every one of those logs replayed on the new stamp ends on the same tick and checksum; the score
 *     never falls (Fission: unless it wasted more beams than one an atom, the new cost).
 *  4. The rules on built states: the life that ends the run is free and mistakes take at most half the core (Spacewalk,
 *     Wavefront, Fission); Fission's wasted beams; High Rise never scores less for another floor; Slice's straight lines.
 *  5. Fire-spam: Fission players who fire non-stop from one spot score below an average player on the new stamp.
 *  6. Breakdowns add up to the stored score on every new-stamp replay; the help and intro state the new rules.
 * 200 on the new stamps: arcade-standard-check's perfect runs (each entry names the dealt stamp).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { AUDIT_GAMES, auditKit, type AuditRun } from "./scoring-audit-arcade-lib";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { playRevOf } from "./scoring-targets-revs";
import { BAND_SPECS } from "../src/lib/arcade/bandParts";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { stdCappedPenalty, stdLivesCharged } from "../src/lib/arcade/arcadeStandard";
import { crossFlowScore, crossGameFor, CROSS_LIVES, CROSS_REV_FLOW, CROSS_REV_KEEP, CROSS_V11_HIT_COST, type CrossState } from "../src/lib/arcade/cross";
import { wavefrontGameFor, wavStdScore, WAV_LIVES, WAV_REV_KEEP, WAV_REV_STD, WAV_STD_LIFE_COST, type WavState } from "../src/lib/arcade/wavefront";
import {
  burstGameFor,
  burstStdParts,
  burstV11Charged,
  BURST_LIVES,
  BURST_REV_AIM,
  BURST_REV_STD,
  BURST_V10_LIFE_COST,
  BURST_V11_FREE_MISSES,
  BURST_V11_MISS_COST,
  type BurstState,
} from "../src/lib/arcade/burst";
import { skylineGameFor, skylineStdParts, SKYLINE_REV_COUNT, SKYLINE_REV_STD, SKYLINE_V9_FULL_AT, type SkylineState } from "../src/lib/arcade/skyline";
import { sliceGameFor, sliceV11Parts, SLICE_REV_FOOD, SLICE_REV_LINE, SLICE_V11_COMBO_CAP, SLICE_V11_CORE, SLICE_V12_COMBO_FULL, type SliceState } from "../src/lib/arcade/slice";
import { stdSum } from "../src/lib/arcade/arcadeStandard";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const section = (name: string) => console.log(`— ${name}`);
console.error = () => {};
const kit = await auditKit(new URL("..", import.meta.url).pathname.replace(/\/$/, ""));

/* 1. Wiring. */
section("1. rooms deal the new stamps; each keeps the previous stamp's play");
for (const g of AUDIT_GAMES) {
  for (let k = 0; k < 5; k++) {
    const dealt = (generatePuzzle(g.type) as unknown as Record<string, unknown>)[g.field];
    ok(dealt === g.rev, `${g.type}: rooms deal ${g.field} ${g.rev} (got ${String(dealt)})`);
  }
  ok((LIVE_BANDS as any)[g.type].rev === g.rev, `${g.type}: LIVE_BANDS reads ${g.field} ${g.rev}`);
  ok(playRevOf(g.type, g.rev) === playRevOf(g.type, g.old), `${g.type}: ${g.field} ${g.rev} keeps ${g.field} ${g.old}'s play (playRevOf ${String(playRevOf(g.type, g.rev))})`);
  // The intro demo's gate names the stamp the demo was recorded on (the old one): the same play, so it still plays.
  const demos = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(new RegExp(`demo\\.puzzle\\.${g.field} !== \\w+\\) return null`).test(demos), `${g.type}: an intro demo recorded on ${g.field} ${g.old} still plays on ${g.rev} (the same play)`);
}
ok(crossGameFor(CROSS_REV_KEEP).init(5).keep === 1 && crossGameFor(CROSS_REV_FLOW).init(5).keep === undefined, "Spacewalk: only crossRev 12 states carry keep");
ok(wavefrontGameFor(WAV_REV_KEEP).init(5).keep === 1 && wavefrontGameFor(WAV_REV_STD).init(5).keep === undefined, "Wavefront: only wavRev 13 states carry keep");
ok(burstGameFor(BURST_REV_AIM).init(5).aim === 1 && burstGameFor(BURST_REV_STD).init(5).aim === undefined, "Fission: only burstRev 11 states carry aim");
ok(skylineGameFor(SKYLINE_REV_COUNT).init(5).perfectCount === 1 && skylineGameFor(SKYLINE_REV_STD).init(5).perfectCount === undefined, "High Rise: only skylineRev 10 states carry perfectCount");
ok(sliceGameFor(SLICE_REV_LINE).init(5).v13 === 1 && sliceGameFor(SLICE_REV_FOOD).init(5).v13 === undefined, "Slice: only sliceRev 13 states carry v13");

/* 2. Older stamps replay exactly as on main. */
section("2. older stamps replay as on main");
const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/scoring-audit-arcade-legacy.json.gz")).toString()) as { commit: string; runs: AuditRun[] };
ok(legacy.runs.length === 176, `the fixture holds 176 runs (${legacy.runs.length})`);
for (const run of legacy.runs) {
  const r = kit.replay(run.type, run.rev, run.seed, run.raw);
  ok(r.score === run.score && r.checksum === run.checksum && r.tick === run.tick && !r.flagged, `${run.type} rev ${run.rev} seed ${run.seed} ${run.label}: replays to ${run.score} / ${run.checksum} / tick ${run.tick} (got ${r.score} / ${r.checksum} / ${r.tick})`);
}

/* 3. The same log on the new stamp: the same play, never a lower score (Fission: unless beams were wasted). */
section("3. the same logs on the new stamps");
const newRuns: { type: string; seed: number; label: string; old: number; now: number; state: any }[] = [];
for (const run of legacy.runs) {
  const g = AUDIT_GAMES.find((x) => x.type === run.type)!;
  if (run.rev !== g.old) continue;
  const r = kit.replay(run.type, g.rev, run.seed, run.raw);
  // The phone's checkpoints were taken on the old stamp: the new stamp's server replay meets every one (no desync).
  ok(r.checksum === run.checksum && r.tick === run.tick && r.desyncTick === null, `${run.type} seed ${run.seed} ${run.label}: ${g.field} ${g.rev} plays the same (checksum, tick, every checkpoint)`);
  const wasted = run.type === "burst" ? burstV11Charged(r.state.whiffs ?? 0, r.state.hits) : 0;
  ok(r.score >= run.score || wasted > 0, `${run.type} seed ${run.seed} ${run.label}: ${run.score} → ${r.score} never falls (wasted beams charged: ${wasted})`);
  newRuns.push({ type: run.type, seed: run.seed, label: run.label, old: run.score, now: r.score, state: r.state });
}
const raised = (type: string) => newRuns.filter((r) => r.type === type && r.now > r.old).length;
ok(raised("cross") > 0 && raised("wavefront") > 0 && raised("burst") > 0 && raised("slice") > 0, `runs that lost lives or cut little now keep more (raised: cross ${raised("cross")}, wavefront ${raised("wavefront")}, burst ${raised("burst")}, slice ${raised("slice")})`);

/* 4. The rules. */
section("4. the rules on built states");
{
  ok(stdLivesCharged(3, true) === 2 && stdLivesCharged(2, false) === 2 && stdLivesCharged(0, true) === 0 && stdLivesCharged(1, true) === 0, "stdLivesCharged: the life that ends the run is not charged");
  ok(stdCappedPenalty(45, 40) === 20 && stdCappedPenalty(10, 40) === 10 && stdCappedPenalty(10, 1) === 0 && stdCappedPenalty(-3, 40) === 0, "stdCappedPenalty: at most half the core, never negative");

  // Spacewalk: the audit's blind hops (a core of 35–43, three hits) scored 1; now the core keeps at least half.
  const c0 = crossGameFor(CROSS_REV_KEEP).init(kit.roomSeed(0)) as CrossState;
  for (let units = 0; units <= 80; units += 7)
    for (let lives = 0; lives <= CROSS_LIVES; lives++) {
      const s = { ...c0, acted: 1, crossings: 0, reached: units, lives } as CrossState;
      const b = crossFlowScore(s);
      const lost = CROSS_LIVES - lives;
      const want = Math.min(Math.floor(b.core / 2), CROSS_V11_HIT_COST * Math.max(0, lost - (lives <= 0 ? 1 : 0)));
      ok(b.penalty === want, `Spacewalk: ${units} rows, ${lost} lives lost → penalty ${want} (got ${b.penalty})`);
    }
  ok(crossFlowScore({ ...c0, lives: 0, reached: 40, crossings: 0 } as CrossState).penalty === Math.min(30, Math.floor(crossFlowScore({ ...c0, lives: 3, reached: 40, crossings: 0 } as CrossState).core / 2)), "Spacewalk: three hits cost two (at most half the core)");
  ok(crossFlowScore({ ...c0, lives: 0, reached: 40, crossings: 0, keep: undefined } as CrossState).penalty === 45, "Spacewalk crossRev 11 still charges all three hits");

  const w0 = wavefrontGameFor(WAV_REV_KEEP).init(kit.roomSeed(0)) as WavState;
  for (const ships of [0, 10, 30, 80, 200])
    for (let lives = 0; lives <= WAV_LIVES; lives++) {
      const s = { ...w0, acted: 1, shapesDown: ships, lives } as WavState;
      const b = wavStdScore(s);
      const lost = WAV_LIVES - lives;
      const want = Math.min(Math.floor(b.core / 2), WAV_STD_LIFE_COST * Math.max(0, lost - (lives <= 0 ? 1 : 0)));
      ok(b.penalty === want, `Wavefront: ${ships} ships, ${lost} lives lost → penalty ${want} (got ${b.penalty})`);
    }
  ok(wavStdScore({ ...w0, shapesDown: 30, lives: 0, keep: undefined } as WavState).penalty === 15, "Wavefront wavRev 12 still charges all three lives");

  const f0 = burstGameFor(BURST_REV_AIM).init(kit.roomSeed(0)) as BurstState;
  for (const hits of [0, 10, 40, 87])
    for (const whiffs of [0, 20, 40, 100])
      for (let lives = 0; lives <= BURST_LIVES; lives++) {
        const p = burstStdParts({ ...f0, acted: 1, hits, whiffs, lives } as BurstState);
        const lost = BURST_LIVES - lives;
        const lifeCost = BURST_V10_LIFE_COST * Math.max(0, lost - (lives <= 0 ? 1 : 0));
        const missCost = BURST_V11_MISS_COST * Math.max(0, whiffs - Math.max(BURST_V11_FREE_MISSES, hits));
        const cap = Math.floor(p.core / 2);
        ok(p.lives + p.misses === Math.min(cap, lifeCost + missCost) && p.lives === Math.min(cap, lifeCost), `Fission: ${hits} atoms, ${whiffs} wasted, ${lost} lives lost → lives −${p.lives}, beams −${p.misses} (cap ${cap})`);
      }
  ok(burstStdParts({ ...f0, hits: 30, whiffs: 30 } as BurstState).misses === 0, "Fission: one wasted beam an atom popped is free");
  ok(burstStdParts({ ...f0, hits: 87, whiffs: 87 + 5 } as BurstState).misses === 10, "Fission: each wasted beam beyond those costs 2");
  ok(burstStdParts({ ...f0, hits: 30, whiffs: 100, aim: undefined } as BurstState).misses === 0, "Fission burstRev 10 never charges wasted beams");
  // Score never falls as more atoms are popped, with the same wasted beams and lives.
  let mono = true;
  for (const whiffs of [0, 50, 120])
    for (let lives = 0; lives <= BURST_LIVES; lives++)
      for (let hits = 1; hits <= 87; hits++) {
        const a = burstGameFor(BURST_REV_AIM).score({ ...f0, acted: 1, hits: hits - 1, whiffs, lives } as BurstState);
        const b = burstGameFor(BURST_REV_AIM).score({ ...f0, acted: 1, hits, whiffs, lives } as BurstState);
        if (b < a) mono = false;
      }
  ok(mono, "Fission: another atom popped never lowers the score");

  // High Rise: another floor never lowers the score (rev 9: the audit's 117 floors scored below 60).
  const k0 = skylineGameFor(SKYLINE_REV_COUNT).init(kit.roomSeed(0)) as SkylineState;
  const sky = (placed: number, perfects: number) => skylineGameFor(SKYLINE_REV_COUNT).score({ ...k0, acted: 1, placed, perfects } as SkylineState);
  let skyMono = true;
  for (let placed = 0; placed < 160; placed++)
    for (let perfects = 0; perfects <= placed; perfects++) if (sky(placed + 1, perfects) < sky(placed, perfects) || sky(placed + 1, perfects + 1) < sky(placed, perfects)) skyMono = false;
  ok(skyMono, "High Rise: another floor, perfect or not, never lowers the score (0–160 floors)");
  ok(sky(117, 61) >= sky(60, 50) && sky(123, 61) >= sky(117, 61), "High Rise: the audit's 117 and 123 floors now score at least a 60-floor run's");
  const perf = (placed: number, perfects: number) => skylineStdParts({ ...k0, placed, perfects } as SkylineState)!.find((p) => p.key === "perfects")!.points;
  ok(perf(61, 61) === 30 && perf(200, 61) === 30 && perf(100, 30) === Math.floor((30 * 30) / SKYLINE_V9_FULL_AT) && perf(30, 30) === Math.floor((30 * 30) / SKYLINE_V9_FULL_AT), "High Rise: perfect drops count up to 61, 30 at 61");
  const k9 = skylineGameFor(SKYLINE_REV_STD).init(kit.roomSeed(0)) as SkylineState;
  ok(skylineStdParts({ ...k9, placed: 100, perfects: 50 } as SkylineState)!.find((p) => p.key === "perfects")!.points === 15, "High Rise skylineRev 9 still scores the share (50 of 100 → 15)");

  // Slice: the food and combo lines start at 0.
  const s0 = sliceGameFor(SLICE_REV_LINE).init(kit.roomSeed(0)) as SliceState;
  const at = (cut: number, missed: number, comboFoods: number) => sliceV11Parts({ ...s0, foodCut: cut, foodMissed: missed, comboFoods } as SliceState);
  ok(at(48, 52, 0).core === Math.floor((SLICE_V11_CORE * 480) / 1000) && at(1, 99, 0).core === 1 && at(100, 0, 0).core === SLICE_V11_CORE, "Slice: food is 120 × the share cut, from 0");
  ok(at(50, 78, 0).core > 40, `Slice: the audit's weak run (50 of 128 cut) now keeps ${at(50, 78, 0).core} for its food (was 0)`);
  let comboOk = true;
  for (let c = 0; c <= 140; c++) if (at(1, 0, c).combo !== Math.floor((SLICE_V11_COMBO_CAP * Math.min(c, SLICE_V12_COMBO_FULL)) / SLICE_V12_COMBO_FULL)) comboOk = false;
  ok(comboOk, "Slice: the combo is 40 × foods ÷ 110 from 0, 40 from 110");
  const s12 = sliceGameFor(SLICE_REV_FOOD).init(kit.roomSeed(0)) as SliceState;
  ok(sliceV11Parts({ ...s12, foodCut: 48, foodMissed: 52, comboFoods: 40 } as SliceState).core === 0 && sliceV11Parts({ ...s12, foodCut: 48, foodMissed: 52, comboFoods: 40 } as SliceState).combo === 0, "Slice sliceRev 12 still scores 0 below its thresholds");
}

/* 5. Fire-spam on Fission. */
section("5. Fission: firing non-stop no longer scores like aiming");
{
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
  const spam10: number[] = [];
  const spam11: number[] = [];
  const avg11: number[] = [];
  for (let n = 0; n < 12; n++) {
    const seed = kit.roomSeed(n);
    for (const every of [1, 5]) {
      const log = kit.burstSpam(seed, every);
      spam10.push(kit.replay("burst", BURST_REV_STD, seed, kit.serverRun("burst", BURST_REV_STD, seed, log).raw).score);
      spam11.push(kit.serverRun("burst", BURST_REV_AIM, seed, log).result.score);
    }
    avg11.push(kit.serverRun("burst", BURST_REV_AIM, seed, kit.botLog("burst", BURST_REV_AIM, seed, "average")).result.score);
  }
  ok(med(spam11) < med(avg11), `fire-spam's median (${med(spam11)}) is below the average player's (${med(avg11)}) on burstRev 11 (12 seeds)`);
  ok(med(spam10) - med(spam11) >= 25, `fire-spam's median falls by at least 25 (${med(spam10)} → ${med(spam11)})`);
  ok(spam11.every((s) => s >= 1), "fire-spam still scores at least 1 (it played)");
  console.log(`  fire-spam median ${med(spam10)} → ${med(spam11)}; average player ${med(avg11)}`);
}

/* 6. Breakdowns add up; the words. */
section("6. breakdowns add up; the help and intro state the new rules");
for (const r of newRuns) {
  if (r.type === "skyline") {
    const parts = skylineStdParts(r.state)!;
    ok(Math.max(1, stdSum(parts)) === r.now, `skyline seed ${r.seed} ${r.label}: the parts add up to ${r.now} (${stdSum(parts)})`);
    continue;
  }
  const p = BAND_SPECS[r.type]!.parts(r.state);
  const sum = p.points + p.bonus - p.penalty;
  ok(Math.max(1, Math.min(200, sum)) === r.now, `${r.type} seed ${r.seed} ${r.label}: ${p.points} + ${p.bonus} − ${p.penalty} adds up to ${r.now}`);
  if (r.type !== "slice") ok(p.penalty <= Math.floor(p.points / 2), `${r.type} seed ${r.seed} ${r.label}: mistakes (${p.penalty}) take at most half the core (${p.points})`);
}
{
  const help = (t: string) => PUZZLE_INSTRUCTIONS[t as keyof typeof PUZZLE_INSTRUCTIONS]!;
  const all = (t: string) => help(t).score + " " + help(t).how.map((h) => `${h.action} ${h.detail}`).join(" ");
  ok(/last one just ends the run/.test(help("cross").score) && /half your rows and crossings points/.test(help("cross").score), "Spacewalk's help: the last hit is free; hits take at most half");
  ok(/losing the last just ends the run/.test(help("wavefront").score) && /half your ships, hits and waves points/.test(help("wavefront").score), "Wavefront's help: the last life is free; lives take at most half");
  ok(/before your last costs/.test(help("burst").score) && /Wasted shots beyond one for each atom popped/.test(help("burst").score) && /half your atom points/.test(help("burst").score) && /wasted/.test(all("burst")), "Fission's help: the last life is free, wasted shots, the half cap");
  ok(/wasted shots/.test(INTRO_SCORE.burst) && INTRO_SCORE.burst.length <= 90, `Fission's intro names wasted shots: ${INTRO_SCORE.burst}`);
  ok(/every perfect drop counts the same, all of it at 61 perfect drops/.test(help("skyline").score) && !/share of your drops/.test(help("skyline").score), "High Rise's help: perfect drops counted, not a share");
  ok(!/first half of it scores nothing/.test(all("slice")) && !/Past the first/.test(all("slice")) && /every piece counts the same/.test(help("slice").score), "Slice's help: every piece and every combo food counts from the first");
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} scoring-audit arcade checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} scoring-audit arcade checks — five arcade games score progress made, older stamps replay as on main ${legacy.commit}`);
