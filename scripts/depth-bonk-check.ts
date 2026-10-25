/**
 * Bonk depth to 200 (whackRev 3, 25 Oct 2026; docs/depth/d3-speed-attention.md).
 *
 *   1. Legacy: every Bonk run recorded on main before the change (scripts/fixtures/depth-engine-legacy.json.gz,
 *      `bun scripts/depth-engine-legacy-record.ts` on main) on whackRev none / 1 / 2 grades to its stored score and
 *      breakdown and replays to the same final state.
 *   2. Rooms deal whackRev 3; its pop schedule is whackRev 2's exactly, and the same taps score whackRev 2's
 *      score as the base; the diamonds: two a run, each in its window, in a burrow no target uses meanwhile.
 *   3. The features: the combo's multiplier steps, a wrong / hedgehog / empty tap ends it, a gopher left to sink does
 *      not; a diamond tap is never a mistake; replays match the phone (no desync, the claimed score).
 *   4. 200: a scripted perfect run (every right target, both diamonds) scores 200 on every seed; without the
 *      features no run passes 150 (base ≤ 150 on every run; a perfect run without diamonds or without the combo
 *      falls short of 200).
 *   5. Old vs new distributions from the simulated players (median, top 10 %, best), with the targets: average
 *      and good within 10 % of whackRev 2, elite at the top of the scale.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  whackCheckpoint, whackComboMultiplier, whackDepthScore, whackGameFor, whackRule,
  WHACK_COMBO_POINTS, WHACK_DIAMOND_LIFE_TICKS, WHACK_DIAMOND_POINTS, WHACK_DIAMOND_WINDOWS, WHACK_DIAMONDS,
  WHACK_INPUT_TAP, WHACK_REV_BANDS, WHACK_REV_DEPTH, WHACK_STATUS_HIT, WHACK_STATUS_UP, type WhackState,
} from "../src/lib/arcade/whack";
import { encodeWhackRun, replayWhackRun } from "../src/lib/duel/whack";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import type { PuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { bandsTable, engineBands } from "./depth-engine-bands";

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => { checks++; if (!cond) failures.push(label); };
const digest = (s: unknown) => createHash("sha256").update(JSON.stringify(s)).digest("hex").slice(0, 16);
const puzzleOf = (seed: number, rev?: number) => ({ type: "whack", seed, ...(rev !== undefined ? { whackRev: rev } : {}) }) as unknown as PuzzleData;

/* 1. Legacy */
const legacy = (JSON.parse(gunzipSync(readFileSync("scripts/fixtures/depth-engine-legacy.json.gz")).toString()) as {
  type: string; rev: number | null; seed: number; label: string; answer: string; score: number; extra: string; state: string;
}[]).filter((r) => r.type === "whack");
ok(legacy.length >= 30, `legacy: recorded Bonk runs (${legacy.length})`);
for (const r of legacy) {
  const g = gradeAnswer(puzzleOf(r.seed, r.rev ?? undefined), r.answer, 0);
  const tag = `legacy whackRev ${r.rev ?? "none"} ${r.label} ${r.seed}`;
  ok(g.score === r.score, `${tag}: grades to its stored ${r.score} (got ${g.score})`);
  ok(digest({ ...(g.extra ?? {}), diag: undefined }) === r.extra, `${tag}: the same stored breakdown`);
  ok(digest(replayWhackRun(r.seed, r.answer, r.rev ?? undefined).state) === r.state, `${tag}: the same final state`);
}

/* 2. Stamp, schedule, diamonds */
ok((generatePuzzle("whack") as unknown as { whackRev: number }).whackRev === WHACK_REV_DEPTH, "rooms deal whackRev 3");
ok(roundMaxFor("whack") === 200, "Bonk's round maximum is 200");
const old = whackGameFor(WHACK_REV_BANDS);
const now = whackGameFor(WHACK_REV_DEPTH);
for (let n = 0; n < 400; n++) {
  const seed = (n * 2654435761 + 31) | 0;
  const a = old.init(seed), b = now.init(seed);
  ok(JSON.stringify(a.schedule) === JSON.stringify(b.schedule), `seed ${seed}: whackRev 3's pop schedule is whackRev 2's`);
  const dp = b.dp!;
  ok(dp.at.length === WHACK_DIAMONDS, `seed ${seed}: ${WHACK_DIAMONDS} diamonds (${dp.at.length})`);
  dp.at.forEach((t, d) => {
    const [lo, hi] = WHACK_DIAMOND_WINDOWS[d]!;
    ok(t >= lo && t < hi, `seed ${seed}: diamond ${d} rises in its window (${t})`);
    const clash = b.schedule.at.some((at, i) => b.schedule.hole[i] === dp.hole[d] && at <= t + WHACK_DIAMOND_LIFE_TICKS && at + b.schedule.life[i]! >= t);
    ok(!clash, `seed ${seed}: diamond ${d}'s burrow has no target while it is up`);
  });
}

/* 3. Features */
ok([1, 5, 6, 10, 11, 15, 16, 40].map(whackComboMultiplier).join() === "1,1,2,2,3,3,4,4", "the combo's multiplier: ×2 from the 6th, ×3 from the 11th, ×4 from the 16th");

/** Plays a scripted run: `pick` names a hole for the tick (or null). Returns the final state and the encoded run. */
function play(game: typeof now, seed: number, pick: (s: WhackState, t: number) => number | null): { state: WhackState; raw: string } {
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const cps: ReturnType<typeof whackCheckpoint>[] = [];
  while (!game.isOver(state)) {
    const t = state.tick + 1;
    const hole = pick(state, t);
    if (hole !== null) recordInput(events, { t, k: WHACK_INPUT_TAP, a: hole, b: 0, c: 0, d: 0 }, game.inputRanges);
    state = game.step(state, inputAt(events, t));
    if (state.tick % 300 === 0) cps.push(whackCheckpoint(state));
  }
  return { state, raw: encodeWhackRun({ seed, claimedScore: game.score(state), events, endTick: state.tick, checkpoints: cps }) };
}
/** The perfect player: every right target 3 ticks after it rises, and (optionally) every diamond. */
const perfect = (diamonds: boolean, breakEvery = 0) => {
  const done = new Set<number>();
  let hits = 0;
  return (s: WhackState, t: number): number | null => {
    const sch = s.schedule;
    if (diamonds && s.dp) for (let d = 0; d < s.dp.at.length; d++) if (s.dp.status[d] === WHACK_STATUS_UP && t >= s.dp.at[d]! + 3 && !done.has(1000 + d)) { done.add(1000 + d); return s.dp.hole[d]!; }
    for (let i = 0; i < s.next; i++) {
      if (s.status[i] !== WHACK_STATUS_UP || done.has(i) || t < sch.at[i]! + 3 || sch.kind[i] !== whackRule(sch.flips, sch.at[i]!)) continue;
      done.add(i);
      hits++;
      return sch.hole[i]!;
    }
    return breakEvery > 0 && hits > 0 && hits % breakEvery === 0 && !done.has(-hits) ? (done.add(-hits), emptyHole(s)) : null;
  };
};
const emptyHole = (s: WhackState): number => {
  for (let h = 0; h < 16; h++) if (!s.schedule.hole.some((x, i) => x === h && s.status[i] === WHACK_STATUS_UP) && !(s.dp && s.dp.hole.some((x, d) => x === h && s.dp!.status[d] === WHACK_STATUS_UP))) return h;
  return 0;
};
for (let n = 0; n < 12; n++) {
  const seed = 0x3e11 + n * 7907;
  const best = play(now, seed, perfect(true));
  const g = gradeAnswer(puzzleOf(seed, WHACK_REV_DEPTH), best.raw, 0);
  ok(g.score === 200, `seed ${seed}: a perfect run with both diamonds scores 200 (got ${g.score})`);
  ok(best.state.dp!.best === best.state.schedule.total, `seed ${seed}: the perfect combo runs through all ${best.state.schedule.total} targets`);
  const noGems = play(now, seed, perfect(false));
  const p1 = whackDepthScore(noGems.state);
  ok(p1.base === 150 && p1.combo === WHACK_COMBO_POINTS && p1.diamonds === 0 && p1.score === 150 + WHACK_COMBO_POINTS, `seed ${seed}: perfect without diamonds is 150 + the combo (${p1.score})`);
  // An empty tap after every 5th hit: never past ×1, so no combo (and the empty taps cost the base).
  const broken = play(now, seed, perfect(true, 5));
  const p2 = whackDepthScore(broken.state);
  ok(p2.combo === 0 && p2.score <= 150 + WHACK_DIAMONDS * WHACK_DIAMOND_POINTS && p2.score < 200, `seed ${seed}: a combo broken every 5 hits earns no combo (${p2.combo}, ${p2.score})`);
  ok(broken.state.empty > 0 && broken.state.dp!.best <= 5, `seed ${seed}: an empty tap ends the combo`);
  // The same taps on whackRev 2 (diamond taps there are empty holes): the base is whackRev 2's score on a run without them.
  const plain = play(old, seed, perfect(false));
  ok(old.score(plain.state) === whackDepthScore(play(now, seed, perfect(false)).state).base, `seed ${seed}: the base is whackRev 2's score for the same taps`);
  const r = replayWhackRun(seed, best.raw, WHACK_REV_DEPTH);
  ok(!r.flagged && r.desyncTick === null && r.score === 200, `seed ${seed}: the phone's run replays on the server (${r.reason ?? "ok"})`);
}
// A gopher left to sink keeps the combo; a wrong-colour tap ends it.
{
  const seed = 0x51ab;
  let skipped = -1;
  const sink = play(now, seed, (s, t) => {
    const sch = s.schedule;
    for (let i = 0; i < s.next; i++) {
      if (s.status[i] !== WHACK_STATUS_UP || t !== sch.at[i]! + 3 || sch.kind[i] !== whackRule(sch.flips, sch.at[i]!)) continue;
      if (skipped < 0 && i > 8) { skipped = i; return null; }
      return sch.hole[i]!;
    }
    return null;
  });
  ok(skipped > 0 && sink.state.status[skipped] !== WHACK_STATUS_HIT && sink.state.dp!.best === sink.state.hits, `a target left to sink does not end the combo (best ${sink.state.dp!.best} of ${sink.state.hits})`);
  let wrongAt = -1;
  const wrong = play(now, seed, (s, t) => {
    const sch = s.schedule;
    for (let i = 0; i < s.next; i++) {
      if (s.status[i] !== WHACK_STATUS_UP || t !== sch.at[i]! + 3) continue;
      const right = sch.kind[i] === whackRule(sch.flips, sch.at[i]!);
      if (!right && wrongAt < 0 && s.hits >= 8) { wrongAt = i; return sch.hole[i]!; }
      if (right) return sch.hole[i]!;
    }
    return null;
  });
  ok(wrongAt >= 0 && wrong.state.wrong + wrong.state.bombs >= 1 && wrong.state.dp!.best < wrong.state.hits, `a wrong-colour or hedgehog tap ends the combo (best ${wrong.state.dp!.best} of ${wrong.state.hits})`);
}
// Simulated players on whackRev 3: the server replays the phone's run, never past 150 without the features.
for (let n = 0; n < 6; n++) for (const level of ["average", "good", "great", "near"] as const) {
  const seed = 0x9a0 + n * 131;
  const p = puzzleOf(seed, WHACK_REV_DEPTH);
  const raw = KITS.whack!.play(p, makeRng(hashText(`whack:check:${seed}:${level}`)), SKILLS[level], 60_000).steps.at(-1)!.answer;
  const r = replayWhackRun(seed, raw, WHACK_REV_DEPTH);
  const parts = whackDepthScore(r.state);
  ok(!r.flagged && r.desyncTick === null, `${level} ${seed}: no desync (${r.reason ?? "ok"})`);
  ok(parts.base <= 150 && parts.score === Math.min(200, parts.base + parts.combo + parts.diamonds), `${level} ${seed}: base ≤ 150 and the parts add up`);
  ok(r.state.dp!.hits * WHACK_DIAMOND_POINTS === parts.diamonds && r.state.empty + r.state.wrong + r.state.bombs >= 0, `${level} ${seed}: diamonds score their points`);
  const g = gradeAnswer(p, raw, 0);
  ok(g.score === parts.score && (g.extra as { depth?: { base: number } }).depth?.base === parts.base, `${level} ${seed}: the stored breakdown matches the score`);
}

/* 5. Distributions */
const rows = engineBands("whack", 40, WHACK_REV_BANDS, WHACK_REV_DEPTH);
console.log("Bonk, 40 room seeds per level\n" + bandsTable(rows, "whackRev 2", "whackRev 3"));
const by = Object.fromEntries(rows.map((r) => [r.level, r]));
for (const level of ["average", "good"]) {
  const r = by[level]!;
  ok(Math.abs(r.now.median - r.old.median) <= 0.1 * r.old.median, `${level}: median within 10 % of whackRev 2 (${r.old.median} → ${r.now.median})`);
}
ok(by["elite"]!.now.median >= 190, `elite: median at the top of the scale (${by["elite"]!.now.median})`);
// Tuning (26 Oct 2026): near-perfect about 165–175, great within about 8 % of whackRev 2.
ok(by["near"]!.now.median >= 165 && by["near"]!.now.median <= 175, `near-perfect: median in 165–175 (${by["near"]!.now.median})`);
ok(by["great"]!.now.median <= Math.round(by["great"]!.old.median * 1.08), `great: within 8 % of before (${by["great"]!.old.median} → ${by["great"]!.now.median})`);
ok(rows.every((r) => r.now.best <= 200 && r.old.best <= 150), "no score past its maximum");

if (failures.length) {
  console.log(failures.slice(0, 40).map((f) => `  ✗ ${f}`).join("\n"));
  console.log(`FAIL depth-bonk-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS depth-bonk-check: ${checks} checks — legacy runs identical, whackRev 3 dealt on whackRev 2's schedule, combo and diamonds, 200 only through them`);
