/**
 * Arcade score bands (band 3, 19 Oct 2026; docs/scoring-targets.md): fits each arcade game's strict curve from the
 * simulated players' runs and writes src/lib/arcade/strictBands.data.ts.
 *
 *   bun scripts/arcade-skill-bands.ts --rev=now --seeds=30 --jobs=4 --json=runs.json   # the runs (units per run)
 *   bun scripts/arcade-bands-fit.ts runs.json [--write]
 *
 * A game's new curve keeps its achievement units and its top (140 + the finish bonus, or 150 on open games) and
 * puts each level's median units at that level's target (average 70, good 100, great 120, near-perfect 140), less
 * the median finish bonus or penalty at that level, so the total lands on the target. Between those anchors the
 * old curve's shape is kept (its knots are mapped through the same anchors in its own points). A level whose median
 * sits at the top, or on the level below, sets no anchor (reported). Rainbow Bridge and Gemstone, which the bots
 * under-rate (Joe's own runs set their curves, Tuning C), keep their October curves mapped through
 * STRICT_GENERIC (125 → 120) instead. Script-only.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { bandCurve, bandPoints, type BandCurve } from "../src/lib/arcade/scoreBands";
import { bandFingerprint } from "../src/lib/arcade/scoreBands";
import { BT_V4_BAND_CURVE } from "../src/lib/arcade/ballTrack";
import { BEAT_V6_BAND_CURVE } from "../src/lib/arcade/beat";
import { BINTOSS_BAND_CURVE } from "../src/lib/arcade/binToss";
import { BRK_V6_BAND_CURVE } from "../src/lib/arcade/breaker";
import { BUB_V5_BAND_CURVE } from "../src/lib/arcade/bubble";
import { BULLSEYE_V4_BAND_CURVE } from "../src/lib/arcade/bullseye";
import { BURST_V4_BAND_CURVE } from "../src/lib/arcade/burst";
import { CROSS_BAND_CURVE } from "../src/lib/arcade/cross";
import { FLIP_V4_BAND_CURVE } from "../src/lib/arcade/flip";
import { HOVER_V5_BAND_CURVE } from "../src/lib/arcade/hover";
import { INK_V6_BAND_CURVE } from "../src/lib/arcade/inkBridge";
import { MATCHUP_V6_BAND_CURVE } from "../src/lib/arcade/matchup";
import { ORBIT_BAND_CURVE } from "../src/lib/arcade/orbitRev3";
import { PIN_BAND_CURVE } from "../src/lib/arcade/pinball";
import { RALLY_V6_BAND_CURVE } from "../src/lib/arcade/rally";
import { SKYLINE_BAND_CURVE } from "../src/lib/arcade/skyline";
import { SLICE_V6_BAND_CURVE } from "../src/lib/arcade/slice";
import { SNAKE_V6_BAND_CURVE } from "../src/lib/arcade/snake";
import { SNIP_V5_BAND_CURVE } from "../src/lib/arcade/snip";
import { SWING_V9_BAND_CURVE } from "../src/lib/arcade/swing";
import { TILT_V4_BAND_CURVE } from "../src/lib/arcade/tilt";
import { WAV_V7_BAND_CURVE } from "../src/lib/arcade/wavefront";
import { bandRetarget } from "../src/lib/arcade/scoreBands";

/** The curve each game's current sim passes to bandCurveOf (its base), and the curve its band-2 runs scored on. */
export const BASES: Record<string, { base: BandCurve; scored: BandCurve; finish: boolean }> = {
  balltrack: { base: BT_V4_BAND_CURVE, scored: bandRetarget(BT_V4_BAND_CURVE), finish: true },
  wavefront: { base: WAV_V7_BAND_CURVE, scored: WAV_V7_BAND_CURVE, finish: true },
  flip: { base: FLIP_V4_BAND_CURVE, scored: bandRetarget(FLIP_V4_BAND_CURVE), finish: true },
  inkbridge: { base: INK_V6_BAND_CURVE, scored: bandRetarget(INK_V6_BAND_CURVE), finish: true },
  matchup: { base: MATCHUP_V6_BAND_CURVE, scored: bandRetarget(MATCHUP_V6_BAND_CURVE), finish: false },
  bubble: { base: BUB_V5_BAND_CURVE, scored: bandRetarget(BUB_V5_BAND_CURVE), finish: true },
  cross: { base: CROSS_BAND_CURVE, scored: bandRetarget(CROSS_BAND_CURVE), finish: false },
  rally: { base: RALLY_V6_BAND_CURVE, scored: bandRetarget(RALLY_V6_BAND_CURVE), finish: false },
  snake: { base: SNAKE_V6_BAND_CURVE, scored: bandRetarget(SNAKE_V6_BAND_CURVE), finish: false },
  bintoss: { base: BINTOSS_BAND_CURVE, scored: bandRetarget(BINTOSS_BAND_CURVE), finish: true },
  snip: { base: SNIP_V5_BAND_CURVE, scored: bandRetarget(SNIP_V5_BAND_CURVE), finish: true },
  hover: { base: HOVER_V5_BAND_CURVE, scored: bandRetarget(HOVER_V5_BAND_CURVE), finish: true },
  skyline: { base: SKYLINE_BAND_CURVE, scored: bandRetarget(SKYLINE_BAND_CURVE), finish: false },
  breaker: { base: BRK_V6_BAND_CURVE, scored: bandRetarget(BRK_V6_BAND_CURVE), finish: true },
  tilt: { base: TILT_V4_BAND_CURVE, scored: bandRetarget(TILT_V4_BAND_CURVE), finish: true },
  orbit: { base: ORBIT_BAND_CURVE, scored: bandRetarget(ORBIT_BAND_CURVE), finish: true },
  beat: { base: BEAT_V6_BAND_CURVE, scored: bandRetarget(BEAT_V6_BAND_CURVE), finish: false },
  slice: { base: SLICE_V6_BAND_CURVE, scored: bandRetarget(SLICE_V6_BAND_CURVE), finish: false },
  burst: { base: BURST_V4_BAND_CURVE, scored: bandRetarget(BURST_V4_BAND_CURVE), finish: true },
  swing: { base: SWING_V9_BAND_CURVE, scored: bandRetarget(SWING_V9_BAND_CURVE), finish: true },
  bullseye: { base: BULLSEYE_V4_BAND_CURVE, scored: bandRetarget(BULLSEYE_V4_BAND_CURVE), finish: false },
  pinball: { base: PIN_BAND_CURVE, scored: bandRetarget(PIN_BAND_CURVE), finish: false },
};

const LEVELS = ["average", "good", "great", "near"] as const;
export const TARGET = { average: 70, good: 100, great: 120, near: 140 } as const;
/** Games whose curves follow Joe's own runs (Tuning C): the October curve mapped 70 → 70, 100 → 100, 125 → 120, 140/145 → 140. */
export const JOE_ANCHORED = new Set(["inkbridge", "matchup"]);
const GENERIC_FINISH = bandCurve([0, 70, 100, 125, 140], [0, 70, 100, 120, 140]);
const GENERIC_OPEN = bandCurve([0, 70, 100, 125, 145, 150], [0, 70, 100, 120, 140, 150]);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : NaN;
};

interface Rec { type: string; level: string; units: number; score: number }

/** Linear in `xs → ys` (both ascending), flat past the ends; floats. */
function lerp(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]!) return ys[0]!;
  for (let i = 1; i < xs.length; i++) {
    if (x > xs[i]!) continue;
    return ys[i - 1]! + ((ys[i]! - ys[i - 1]!) * (x - xs[i - 1]!)) / (xs[i]! - xs[i - 1]!);
  }
  return ys[ys.length - 1]!;
}

/** The strict curve: the base curve's units, its points remapped (straight lines between the anchors, in its own points). */
export function fitStrict(type: string, recs: Rec[]): { curve: BandCurve; notes: string[] } {
  const { base, scored, finish } = BASES[type]!;
  const top = base.points[base.points.length - 1]!;
  const uTop = base.units[base.units.length - 1]!;
  const notes: string[] = [];
  if (JOE_ANCHORED.has(type)) {
    const g = finish ? GENERIC_FINISH : GENERIC_OPEN;
    const pts = base.points.map((p) => Math.round(lerp([...g.units], [...g.points], p)));
    notes.push("Joe-anchored: October curve, 125 → 120");
    return { curve: bandCurve([...base.units], pts), notes };
  }
  // One anchor per level at its median units; a level whose median does not rise above the level below is merged
  // with it (one anchor on both levels' runs, aiming between their targets).
  const groups: { levels: string[]; runs: Rec[]; target: number }[] = [];
  for (const level of LEVELS) {
    const rs = recs.filter((r) => r.level === level);
    if (!rs.length) continue;
    const prev = groups[groups.length - 1];
    if (prev && median(rs.map((r) => r.units)) <= median(prev.runs.map((r) => r.units))) {
      prev.levels.push(level);
      prev.runs = [...prev.runs, ...rs];
      prev.target = prev.levels.reduce((a, l) => a + TARGET[l as keyof typeof TARGET], 0) / prev.levels.length;
      notes.push(`${level} merged with ${prev.levels[0]} (median units not above it)`);
      continue;
    }
    groups.push({ levels: [level], runs: rs, target: TARGET[level] });
  }
  const anchors = groups
    .map((g) => ({ ...g, u: median(g.runs.map((r) => r.units)) }))
    .filter((g) => {
      if (g.u >= uTop || bandPoints(scored, g.u) >= top) { notes.push(`${g.levels.join("+")} median at the top (${g.u} units): no anchor`); return false; }
      return true;
    });
  const build = (ys: number[]): BandCurve => {
    const from = [0], to = [0];
    anchors.forEach((a, i) => {
      const p = bandPoints(scored, a.u);
      const y = Math.min(top - 1, Math.max(to[to.length - 1]! + 1, Math.round(ys[i]!)));
      if (p <= from[from.length - 1]!) return;
      from.push(p);
      to.push(y);
    });
    from.push(top);
    to.push(top);
    const units = [...new Set([...base.units, ...anchors.map((a) => a.u)])].sort((a, b) => a - b);
    const outU: number[] = [];
    const outP: number[] = [];
    for (const u of units) {
      const p = Math.round(lerp(from, to, bandPoints(scored, u)));
      if (outU.length && p <= outP[outP.length - 1]!) {
        if (u !== units[units.length - 1]) continue;
        outU.pop(); outP.pop();
      }
      outU.push(u);
      outP.push(p);
    }
    return bandCurve(outU, outP);
  };
  const scoreOn = (curve: BandCurve, r: Rec) => Math.max(0, Math.min(150, bandPoints(curve, r.units) + (r.score - bandPoints(scored, r.units))));
  // Start each anchor at its target, then move it by the error of its runs' median total (bonus and penalty included).
  let ys = anchors.map((a) => a.target);
  let curve = build(ys);
  for (let k = 0; k < 12; k++) {
    ys = anchors.map((a, i) => ys[i]! + (a.target - median(a.runs.map((r) => scoreOn(curve, r)))) * 0.8);
    curve = build(ys);
  }
  return { curve, notes };
}

if (import.meta.main) {
  const file = process.argv[2]!;
  const write = process.argv.includes("--write");
  const j = JSON.parse(readFileSync(file, "utf8")) as { records: (Rec & { which: string })[] };
  const out: Record<string, { base: string; units: number[]; points: number[] }> = {};
  for (const type of Object.keys(BASES)) {
    const recs = j.records.filter((r) => r.type === type);
    if (!recs.length) { console.error(`${type}: no runs`); continue; }
    const { curve, notes } = fitStrict(type, recs);
    const { scored } = BASES[type]!;
    out[type] = { base: bandFingerprint(BASES[type]!.base), units: [...curve.units], points: [...curve.points] };
    const pred = LEVELS.map((l) => {
      const rs = recs.filter((r) => r.level === l);
      const before = median(rs.map((r) => r.score));
      const after = median(rs.map((r) => Math.max(0, Math.min(150, bandPoints(curve, r.units) + (r.score - bandPoints(scored, r.units))))));
      return `${before}→${after}`;
    });
    console.log(`${type.padEnd(10)} ${pred.join("  ").padEnd(40)} ${notes.join("; ")}`);
  }
  if (write) {
    const body = Object.entries(out).map(([t, v]) => `  ${t}: { base: ${JSON.stringify(v.base)}, units: ${JSON.stringify(v.units)}, points: ${JSON.stringify(v.points)} },`).join("\n");
    writeFileSync(new URL("../src/lib/arcade/strictBands.data.ts", import.meta.url),
      `/**\n * Band 3 (score bands, 19 Oct 2026): each arcade game's strict curve, keyed by the base curve its sim passes to\n * bandCurveOf (scoreBands.ts bandFingerprint). Generated by \`bun scripts/arcade-bands-fit.ts <runs.json> --write\`.\n */\nexport const STRICT_BANDS: Record<string, { base: string; units: readonly number[]; points: readonly number[] }> = {\n${body}\n};\n`);
    console.error("wrote src/lib/arcade/strictBands.data.ts");
  }
}
