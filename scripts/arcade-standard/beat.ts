/**
 * arcade-standard-check's case for `beat` (see ./entry.ts): Tempo beatRev 11 (docs/arcade-standard/beat.md).
 * States are built by hand from beatRev 11's init; the sim's rules are read, never copied.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_STANDARD } from "../../src/lib/arcade/standard";
import { caseEntry, type StdCase } from "./entry";
import {
  beatAccuracy,
  beatFeatureCounts,
  beatGameFor,
  beatStdParts,
  BEAT_REV_EASE,
  BEAT_REV_STD,
  BEAT_V11_ACC_FULL,
  type BeatState,
} from "../../src/lib/arcade/beat";

const SEED = 4242;
const game = beatGameFor(BEAT_REV_STD);

/** beatRev 11's init with the run over and input recorded. */
function base(): BeatState {
  const s = game.init(SEED) as BeatState;
  return { ...s, tick: game.runTicks, acted: 1 } as BeatState;
}

/** A state whose chart has 250 plain notes (no golden notes or double taps), so per mille = quarters exactly. */
function plain(quarters: number): BeatState {
  const s = base();
  const n = 250;
  const chart = { ...s.chart, ticks: Array.from({ length: n }, (_, i) => 200 + i * 15), lanes: Array(n).fill(0), holds: Array(n).fill(0), swipes: Array(n).fill(0), golds: Array(n).fill(0), pairs: Array(n).fill(-1) };
  const q = Math.min(quarters, 4 * n);
  return { ...s, chart, judged: Array(n).fill(0), perfect: Math.floor(q / 4), ok: q % 4, good: 0, misses: 0 };
}

function parts(s: BeatState): Record<string, number> {
  return Object.fromEntries((beatStdParts(s) ?? []).map((p) => [p.key, p.points]));
}

export const stdCase: StdCase = {
  game,
  fullAt: BEAT_V11_ACC_FULL,
  perfect() {
    const s = base();
    const n = s.chart.ticks.length;
    const { golds, doubles } = beatFeatureCounts(s);
    return { ...s, perfect: n, good: 0, ok: 0, misses: 0, fevers: 4, goldsHit: golds, doublesDone: doubles, maxStreak: n };
  },
  idle() {
    // Played (a stray tap) and never hit a note: every note missed, no feature.
    const s = base();
    return { ...s, misses: s.chart.ticks.length, strays: 1 };
  },
  core(value) {
    return plain(value);
  },
  older() {
    return beatGameFor(BEAT_REV_EASE).init(SEED);
  },
  extra(ok) {
    const s = base();
    const n = s.chart.ticks.length;
    const { golds, doubles } = beatFeatureCounts(s);
    ok(golds > 0 && doubles > 0, `beat: the seed's song has golden notes (${golds}) and double taps (${doubles})`);
    // Fever: 25 × fevers ÷ 4 (6, 12, 18, 25), nothing more past 4.
    const fever = [0, 1, 2, 3, 4, 5, 9].map((f) => parts({ ...s, fevers: f }).fever);
    ok(JSON.stringify(fever) === JSON.stringify([0, 6, 12, 18, 25, 25, 25]), `beat: fever pays 0/6/12/18/25/25/25 for 0/1/2/3/4/5/9 fevers (got ${fever})`);
    // Golden notes and double taps: a share of 15 of the song's own count.
    for (let k = 0; k <= golds; k++) {
      const got = parts({ ...s, goldsHit: k }).gold;
      if (got !== Math.floor((15 * k) / golds)) ok(false, `beat: ${k} of ${golds} golden notes pay ${got}`);
    }
    ok(parts({ ...s, goldsHit: golds }).gold === 15 && parts({ ...s, goldsHit: golds - 1 }).gold! < 15, "beat: golden notes are full only with every one hit");
    for (let k = 0; k <= doubles; k++) {
      const got = parts({ ...s, doublesDone: k }).double;
      if (got !== Math.floor((15 * k) / doubles)) ok(false, `beat: ${k} of ${doubles} double taps pay ${got}`);
    }
    ok(parts({ ...s, doublesDone: doubles }).double === 15, "beat: every double tap pays 15");
    // Perfect streak: a share of 15 of the song's notes.
    ok(parts({ ...s, maxStreak: n }).streak === 15 && parts({ ...s, maxStreak: n - 1 }).streak === Math.floor((15 * (n - 1)) / n) && parts({ ...s, maxStreak: Math.floor(n / 2) }).streak === Math.floor((15 * Math.floor(n / 2)) / n), "beat: the Perfect streak pays its share of the song's notes");
    // A song without golden notes or double taps pays 0 there (never a division by 0).
    const bare = plain(800);
    ok(parts({ ...bare, goldsHit: 3, doublesDone: 3 }).gold === 0 && parts({ ...bare, goldsHit: 3, doublesDone: 3 }).double === 0, "beat: no golden notes or double taps in the song pay 0");
    // Mistakes: a miss costs 2 quarters of the song (Perfect 4, Good 3, OK 1), never below 0.
    const a = plain(800);
    ok(beatAccuracy({ ...a, misses: 1 }) === 798 && beatAccuracy({ ...a, misses: 1000 }) === 0, "beat: a miss costs 2 thousandths on a 250-note song, accuracy never below 0");
    ok(beatAccuracy({ ...a, perfect: 0, good: 100, ok: 0 }) === 300 && beatAccuracy({ ...a, perfect: 0, good: 0, ok: 100 }) === 100, "beat: Good counts 3, OK 1");
    // Features never touch the core: the same judgements with every feature earned keep the same accuracy points.
    const mid = plain(700);
    ok(parts(mid).core === parts({ ...mid, fevers: 4, maxStreak: 100 }).core, "beat: features never change the accuracy points");
    // A run with no input scores 0; the parts are null for the earlier stamp.
    ok(game.score(game.init(SEED)) === 0, "beat: no input scores 0");
  },
};

export const entry = caseEntry("beat", ARCADE_STANDARD.beat.spec!, ARCADE_STANDARD.beat.parts, stdCase);
