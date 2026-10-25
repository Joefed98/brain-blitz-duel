/**
 * Attention rework check (14 Oct 2026): Eagle Eye `scanRev 1`, Double Take `spotRev 1`,
 * Tally `countRev 2` (src/lib/duel/attentionRev.ts).
 *
 *   1. Legacy identity: 770 answers on 24 room puzzles exactly as main stamped them before
 *      the change (scripts/fixtures/attention-rework-legacy.json.gz, recorded on main by
 *      attention-rework-record.ts --legacy) grade exactly as main stored them.
 *   2. New-stamp identity: the stored-round fixture for the new stamps
 *      (attention-rework-rev1.json.gz) grades identically, so these rounds never regrade.
 *   3. Stamps and generation on 40 room seeds: grid 3 has two target directions at least
 *      90° apart (4–6 eagles each) and grids 1–2 one; Double Take has two pictures with six
 *      separated differences each, matching the panels; Tally's fourth tray asks a
 *      comparison whose stored answer equals the scene's count, with no look-alike colours;
 *      60 s stored on Double Take and Tally; the secrets never reach the phone.
 *   4. Anchors: finish 150 at half time and 120 at the buzzer; best unfinished 110 or less;
 *      Double Take's 5-wrong-taps-per-picture allowance; nothing scores 0; the stored shape
 *      on an unstamped copy is unchanged.
 *   5. Random play on 24 seeds: every spam strategy's median ≤ 60 (Tally's blind guesses ≤ 6), no spam finish.
 *   6. Intro demos recorded before the rework are rejected.
 *
 *   bun scripts/attention-rework-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  puzzleInputDemoCompatible,
  ATTENTION_REWORK_PRESENTATION,
  SPEED_POLISH_PRESENTATION,
} from "../src/components/puzzles/wordInput";
import {
  ATTENTION_REWORK_TIME_MS,
  SPOT_TWO_WRONG_LIMIT,
  countUpCounts,
  countUpStageTruth,
  scanStageMatches,
} from "../src/lib/duel/attentionRev";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { joinStages } from "../src/lib/duel/stagedRounds";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { COUNTUP_STAGE_COUNTS_REV2, countUpSceneValid } from "../src/puzzles/countUp";
import { differenceGroups } from "../src/puzzles/spotTheDifference";
import type {
  CountUpPuzzleData,
  PuzzleData,
  SpotPuzzleData,
  SymbolScanPuzzleData,
} from "../src/lib/duel/types";
import { stableExtra, type LegacyCase } from "./puzzle-score-legacy-record";
import { KITS } from "./puzzle-fairness/kits";
import { hashText, makeRng } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";
import { pinDealtPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";

// Written for the rev-1 puzzle shape: new puzzles here carry puzzleScoreRev 1 (rooms deal rev 2 since 19 Oct 2026, scoring-bands-check).
pinDealtPuzzleScoreRev(1);

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, msg: string) => {
  checks++;
  if (!cond) {
    failures.push(msg);
    if (failures.length <= 40) console.log(`FAIL ${msg}`);
  }
};

/* ------------------------------ 1–2. Identity ------------------------------ */
for (const file of ["attention-rework-legacy", "attention-rework-rev1"]) {
  const fixture = JSON.parse(
    gunzipSync(readFileSync(`scripts/fixtures/${file}.json.gz`)).toString("utf8"),
  ) as {
    recordedOn: string;
    cases: LegacyCase[];
  };
  let answers = 0;
  for (const c of fixture.cases) {
    for (const e of c.entries) {
      answers++;
      const g = gradeAnswer(c.puzzle, e.answer, e.ms);
      const got = {
        score: g.score,
        isCorrect: g.isCorrect,
        correctCount: g.correctCount,
        errors: g.errors,
        storedMs: g.storedMs,
        extra: stableExtra(g.extra),
      };
      const bad = (Object.keys(got) as (keyof typeof got)[]).find((key) => got[key] !== e[key]);
      ok(
        !bad,
        `${file} ${c.type} ${c.label} ms ${e.ms}: ${bad} ${JSON.stringify(bad ? got[bad] : "")} ≠ stored ${JSON.stringify(bad ? e[bad] : "")}`,
      );
    }
  }
  console.log(
    `${file}: ${answers} answers over ${fixture.cases.length} puzzles (recorded on ${fixture.recordedOn}) grade identically`,
  );
}
// The legacy fixture really is the old shape.
{
  const fixture = JSON.parse(
    gunzipSync(readFileSync("scripts/fixtures/attention-rework-legacy.json.gz")).toString("utf8"),
  ) as { cases: LegacyCase[] };
  for (const c of fixture.cases) {
    const p = c.puzzle as unknown as Record<string, unknown>;
    ok(
      !("scanRev" in p) && !("spotRev" in p) && !("reef" in p) && !("timeLimitMs" in p),
      `legacy ${c.label}: carries a new field`,
    );
    if (c.type === "countup")
      ok(
        p["countRev"] === 1 && (c.puzzle as CountUpPuzzleData).stages.length === 3,
        `legacy ${c.label}: not a countRev 1 three-tray puzzle`,
      );
  }
}

/* ------------------------- 3. Stamps and generation ------------------------- */
const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const apart = (a: string, b: string) => {
  const d = Math.abs(DIRS.indexOf(a) - DIRS.indexOf(b));
  return Math.min(d, 8 - d);
};
for (let i = 0; i < 40; i++) {
  const seed = 9601 + i;
  const scan = roomPuzzle("symscan", seed) as SymbolScanPuzzleData;
  // Depth to 200 (25 Oct 2026): rooms deal scanRev 2, spotRev 2 and countRev 3 on the same rework rules (depth-*-check).
  ok(scan.scanRev === 2, `symscan ${seed}: scanRev ${scan.scanRev}`);
  scan.stages.forEach((st, k) => {
    const matches = scanStageMatches(st);
    ok(
      JSON.stringify(matches) === JSON.stringify(scan.targets?.[k]),
      `symscan ${seed}: grid ${k + 1} stored targets differ from the cells`,
    );
    if (k < 2) ok(st.alsoTarget === undefined, `symscan ${seed}: grid ${k + 1} has two targets`);
    else {
      ok(
        st.alsoTarget !== undefined && apart(st.target, st.alsoTarget) >= 2,
        `symscan ${seed}: grid 3 targets ${st.target}/${st.alsoTarget}`,
      );
      const a = st.cells.filter((d) => d === st.target).length;
      const b = st.cells.filter((d) => d === st.alsoTarget).length;
      ok(a >= 4 && a <= 6 && b >= 4 && b <= 6, `symscan ${seed}: grid 3 counts ${a} + ${b}`);
    }
  });
  const spot = roomPuzzle("spotdiff", seed) as SpotPuzzleData;
  ok(
    spot.spotRev === 2 && spot.timeLimitMs === ATTENTION_REWORK_TIME_MS && !!spot.reef,
    `spotdiff ${seed}: stamp ${spot.spotRev} limit ${spot.timeLimitMs}`,
  );
  for (const [scene, pic] of [
    [0, spot],
    [1, spot.reef!],
  ] as const) {
    const own = (spot.differences ?? []).filter((d) => (d.scene ?? 0) === scene);
    const groups = differenceGroups(pic.top, pic.bottom);
    ok(
      own.length === 6 && groups.length === 6,
      `spotdiff ${seed}: picture ${scene + 1} has ${own.length} stored / ${groups.length} drawn differences`,
    );
    ok(
      own.every((d) => groups.some((g) => g.every((c) => d.cells.includes(c)))),
      `spotdiff ${seed}: picture ${scene + 1} stored cells differ from the panels`,
    );
  }
  const tally = roomPuzzle("countup", seed) as CountUpPuzzleData;
  ok(
    tally.countRev === 3 &&
      tally.timeLimitMs === ATTENTION_REWORK_TIME_MS &&
      tally.stages.length === 4,
    `countup ${seed}: countRev ${tally.countRev}, ${tally.stages.length} trays`,
  );
  tally.stages.forEach((st, k) => {
    ok(
      countUpStageTruth(st) === tally.counts?.[k],
      `countup ${seed}: tray ${k + 1} stored count ${tally.counts?.[k]} ≠ scene ${countUpStageTruth(st)}`,
    );
    ok(countUpSceneValid(st), `countup ${seed}: tray ${k + 1} has a counted shape mostly hidden`);
    ok((k === 3) === !!st.compare, `countup ${seed}: tray ${k + 1} compare ${!!st.compare}`);
    if (k < 3) {
      const [lo, hi] = COUNTUP_STAGE_COUNTS_REV2[k]!;
      const n = countUpStageTruth(st);
      ok(n >= lo && n <= hi, `countup ${seed}: tray ${k + 1} count ${n} outside ${lo}–${hi}`);
    }
  });
  const cmp = tally.stages[3]!;
  if (cmp.compare) {
    const truth = countUpStageTruth(cmp);
    ok(truth >= 1 && truth <= 13, `countup ${seed}: comparison answer ${truth}`);
    const close: [string, string][] = [
      ["RED", "ORANGE"],
      ["ORANGE", "BROWN"],
      ["BLUE", "PURPLE"],
    ];
    const lookalike = (a: string, b: string) =>
      close.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    ok(
      !lookalike(cmp.compare.more, cmp.compare.less),
      `countup ${seed}: compares look-alike colours`,
    );
    ok(
      cmp.shapes
        .filter((s) => !countUpCounts(cmp, s))
        .every(
          (s) => !lookalike(s.colour, cmp.compare!.more) && !lookalike(s.colour, cmp.compare!.less),
        ),
      `countup ${seed}: a filler looks like a counted colour`,
    );
  }
  for (const p of [scan, spot, tally] as PuzzleData[]) {
    const pub = JSON.stringify(splitPuzzle(p).pub);
    ok(
      !/"targets"|"differences"|"counts"/.test(pub),
      `${p.type} ${seed}: a secret reaches the phone`,
    );
  }
}

/* --------------------------------- 4. Anchors --------------------------------- */
const half = (p: PuzzleData) => (p as { timeLimitMs?: number }).timeLimitMs ?? 30_000;
{
  const p = roomPuzzle("symscan", 9701) as SymbolScanPuzzleData;
  const perfect = joinStages(p.stages.map((st) => scanStageMatches(st).join(",")));
  ok(
    gradeAnswer(p, perfect, 15_000).score === 150 && gradeAnswer(p, perfect, 0).score === 120,
    "symscan: perfect 150 / 120",
  );
  const g3 = scanStageMatches(p.stages[2]!);
  const oneShort = joinStages([
    scanStageMatches(p.stages[0]!).join(","),
    scanStageMatches(p.stages[1]!).join(","),
    g3.slice(1).join(","),
  ]);
  const r = gradeAnswer(p, oneShort, 15_000);
  ok(!r.isCorrect && r.score <= 110 && r.score >= 100, `symscan: one eagle short ${r.score}`);
  // Grid 3 counts only the two targets: the first target alone is not perfect.
  const firstOnly = joinStages([
    scanStageMatches(p.stages[0]!).join(","),
    scanStageMatches(p.stages[1]!).join(","),
    p.stages[2]!.cells.flatMap((d, i) => (d === p.stages[2]!.target ? [i] : [])).join(","),
  ]);
  ok(
    !gradeAnswer(p, firstOnly, 15_000).isCorrect,
    "symscan: one target direction on grid 3 finishes",
  );
  ok(gradeAnswer(p, joinStages(["", "", ""]), 0).score === 0, "symscan: nothing scores");
  const legacy = { ...(p as object), scanRev: undefined } as unknown as PuzzleData;
  const stored = gradeAnswer(
    {
      ...(legacy as object),
      stages: p.stages.map((s) => ({ ...s, alsoTarget: undefined })),
      targets: p.stages.map((s) => s.cells.flatMap((d, i) => (d === s.target ? [i] : []))),
    } as unknown as PuzzleData,
    firstOnly,
    15_000,
  );
  ok(
    stored.isCorrect && stored.score === 150,
    `symscan: unstamped copy scores ${stored.score} on the stored rules`,
  );
}
{
  const p = roomPuzzle("spotdiff", 9702) as SpotPuzzleData;
  const cells = (scene: number) =>
    (p.differences ?? []).filter((d) => (d.scene ?? 0) === scene).map((d) => d.cells[0]!);
  const others = (scene: number, n: number) => {
    const pic = scene === 0 ? p : p.reef!;
    const used = new Set(cells(scene));
    return pic.top
      .map((s) => s.cell)
      .filter((c) => !used.has(c))
      .slice(0, n);
  };
  const all = `${cells(0).join(",")}|${cells(1).join(",")}`;
  ok(
    gradeAnswer(p, all, half(p) / 2).score === 150 && gradeAnswer(p, all, 0).score === 120,
    "spotdiff: all twelve 150 / 120",
  );
  const fiveEach = `${[...cells(0), ...others(0, SPOT_TWO_WRONG_LIMIT)].join(",")}|${[...cells(1), ...others(1, SPOT_TWO_WRONG_LIMIT)].join(",")}`;
  ok(
    gradeAnswer(p, fiveEach, 0).isCorrect && gradeAnswer(p, fiveEach, 0).score === 120,
    "spotdiff: 5 wrong taps in each picture still finishes",
  );
  const sixInOne = `${[...cells(0), ...others(0, SPOT_TWO_WRONG_LIMIT + 1)].join(",")}|${cells(1).join(",")}`;
  const six = gradeAnswer(p, sixInOne, 30_000);
  ok(
    !six.isCorrect && six.score === 120 - 4 * 6,
    `spotdiff: 6 wrong taps in one picture ${six.score} (not a finish)`,
  );
  const eleven = gradeAnswer(p, `${cells(0).join(",")}|${cells(1).slice(1).join(",")}`, 30_000);
  ok(!eleven.isCorrect && eleven.score === 110, `spotdiff: eleven found ${eleven.score}`);
  // Taps count only in their own picture.
  const swapped = gradeAnswer(p, `${cells(1).join(",")}|${cells(0).join(",")}`, 30_000);
  ok(!swapped.isCorrect, "spotdiff: picture 2's cells count in picture 1");
  ok(
    gradeAnswer(p, "", 0).score === 0 && gradeAnswer(p, "|", half(p)).score === 0,
    "spotdiff: nothing scores",
  );
  const legacy = {
    type: "spotdiff",
    top: p.top,
    bottom: p.bottom,
    differences: (p.differences ?? []).filter((d) => !d.scene).map(({ scene: _s, ...d }) => d),
    speedPar: 1,
    puzzleScoreRev: 1,
  } as unknown as PuzzleData;
  const stored = gradeAnswer(legacy, cells(0).join(","), 15_000);
  ok(
    stored.isCorrect && stored.score === 150,
    `spotdiff: unstamped one-picture copy scores ${stored.score} on 30 s`,
  );
}
{
  const p = roomPuzzle("countup", 9703) as CountUpPuzzleData;
  const truths = p.stages.map(countUpStageTruth);
  const exact = joinStages(truths.map(String), 4);
  ok(
    gradeAnswer(p, exact, 30_000).score === 150 && gradeAnswer(p, exact, 0).score === 120,
    "countup: all four exact 150 / 120",
  );
  const off = joinStages(
    truths.map((t, i) => String(i === 3 ? t + 1 : t)),
    4,
  );
  const r = gradeAnswer(p, off, 30_000);
  ok(!r.isCorrect && r.score === 95 + 2, `countup: tray 4 one off ${r.score}`);
  // countRev 2: one off = 15 % of the tray, two off = 0.
  const twoOff = gradeAnswer(p, joinStages(truths.map((t, i) => String(i === 0 ? t + 2 : t)), 4), 30_000);
  ok(!twoOff.isCorrect && twoOff.score === 30 + 25 + 15, `countup: tray 1 two off ${twoOff.score}`);
  const oneOff = gradeAnswer(p, joinStages(truths.map((t, i) => String(i === 0 ? t - 1 : t)), 4), 30_000);
  ok(!oneOff.isCorrect && oneOff.score === 6 + 30 + 25 + 15, `countup: tray 1 one off ${oneOff.score}`);
  const three = gradeAnswer(p, joinStages(truths.slice(0, 3).map(String), 4), 30_000);
  ok(!three.isCorrect && three.score === 95, `countup: three exact ${three.score}`);
  ok(gradeAnswer(p, joinStages(["", "", "", ""], 4), 0).score === 0, "countup: nothing scores");
}

/* ------------------------------- 5. Random play ------------------------------- */
{
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  for (const type of ["symscan", "spotdiff", "countup"] as const) {
    const kit = KITS[type]!;
    const by: Record<string, number[]> = {};
    let finished = 0;
    for (let i = 0; i < 24; i++) {
      const seed = 9801 + i;
      const p = roomPuzzle(type, seed);
      for (const sp of kit.spam(p, makeRng(hashText(`attention-check:${type}:${seed}`)), half(p))) {
        const g = gradeAnswer(p, sp.answer, 0);
        (by[sp.label] ??= []).push(g.score);
        if (g.isCorrect) finished++;
      }
    }
    const line = Object.entries(by)
      .map(([k, xs]) => `${k} ${median(xs)}`)
      .join(", ");
    console.log(`${type} random play medians: ${line}`);
    // Tally (countRev 2): blind guessing must score about nothing; the others' spam already scores 0.
    const cap = type === "countup" ? 6 : 60;
    for (const [k, xs] of Object.entries(by))
      ok(median(xs) <= cap, `${type}: spam ${k} median ${median(xs)} > ${cap}`);
    ok(finished === 0, `${type}: spam finished ${finished} times`);
  }
}

/* ------------------------------ 6. Intro demos ------------------------------ */
for (const type of ["symscan", "spotdiff", "countup"]) {
  ok(
    !puzzleInputDemoCompatible(type, { presentation: SPEED_POLISH_PRESENTATION }),
    `${type}: a pre-rework demo still plays`,
  );
  // Depth to 200 (25 Oct 2026): Double Take's rework demos are stopped too (its hidden difference), until re-recorded.
  ok(
    puzzleInputDemoCompatible(type, { presentation: ATTENTION_REWORK_PRESENTATION }) === (type !== "spotdiff"),
    `${type}: a rework demo is rejected`,
  );
}

if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${checks} attention rework checks`);
  process.exit(1);
}
console.log(
  `PASS: ${checks} attention rework checks (legacy and new-stamp identity, generation, anchors, random play, demos)`,
);
