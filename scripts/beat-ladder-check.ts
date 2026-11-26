/**
 * beat-ladder-check (~60 s; CHECKS_FULL=1 ~2 min): Tempo beatRev 13 (D5's ladder, 23 Nov 2026; Joe's approval of 23 Nov:
 * the Normal refit and the lane ladder 3 / 5 / 6; docs/arcade-standard/beat.md "beatRev 13" and "Levels (D5, 23 Nov
 * 2026)").
 *
 *  1. Older rounds: the legacy fixture (scripts/fixtures/beat-ladder-legacy.json.gz, recorded before beatRev 13 by
 *     scripts/beat-ladder-legacy-record.ts: beatRev 12 at every level, beatRev 9–11 at Normal) regrades exactly: score,
 *     verdict, stored extra and the replay's final checkpoint. beatRev 12's own level table is unchanged.
 *  2. The stamp and the pin: Normal and every level deal beatRev 13, each a seed from its own proved list, Normal with no
 *     level field (byte for byte the deal with no level asked); the era pin beatPreLanes deals beatRev 12 on any seed as
 *     before (and preRetro beatRev 11); DEAL_PINS lists it; LIVE_BANDS, the standard and practice stamps say 13.
 *  3. Normal is beatRev 12's play: every recorded beatRev 12 Normal log replays on beatRev 13 to the same final
 *     checkpoint, and scores on the new lines (golden notes full at 5 in 9, the streak at 70 % of the notes), never less.
 *  4. The levels as dealt: the registry (GAME_LEVELS) is the sim's table (BEAT_LEVELS_V13); three lanes all song on Easy,
 *     five and six from the first note on Hard and Expert, no break at 40 s, each lane used and none beyond; the windows,
 *     fall and input ranges per level; Hard and Expert add no aid (no wider window, no longer fall than Normal's).
 *  5. The proof: every dealt chart at every level is playable by two thumbs at the human limits (scripts/beat-thumbs.ts);
 *     the deal file is what scripts/beat-lanes-deal.ts builds (CHECKS_FULL=1: rebuilt byte for byte); the flawless player
 *     held to the limits scores exactly 200 through the server replay on a sample of every level's seeds (all of them
 *     with CHECKS_FULL=1); the parts sum to 200 at every level.
 *  6. The ladder: Joe's ladder test on the recorded 288-deal ladder (scripts/fixtures/d5-ladder-beat.json.gz,
 *     `bun scripts/d5-ladder-record.ts beat --deals=288`), and a sample of it re-played live scoring as recorded.
 *  7. Lanes on screen: with the real renderer, a tap on each drawn lane at three, five and six lanes lands in that lane
 *     through the phone's mapping (beatLaneAtOf) and 3 px past its drawn edge does not; the lever picture draws the
 *     level's lanes from its row.
 *
 *   bun scripts/beat-ladder-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => 10_000 } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 1, getComputedStyle: (el: { style?: Record<string, string> }) => el.style ?? {} },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const beat = await import("../src/lib/arcade/beat");
const { beatArtGame } = await import("../src/lib/arcade/beat.renderer");
const { BEAT_LEVELS, BEAT_LEVELS_V13, RETRO_LEVEL_TABLES } = await import("../src/lib/arcade/retroLevels");
const { stdLine } = await import("../src/lib/arcade/arcadeStandard");
const { LIVE_BANDS, liveStdHelp } = await import("../src/lib/arcade/liveBands");
const { ARCADE_STANDARD } = await import("../src/lib/arcade/standard");
const { replayBeatRun } = await import("../src/lib/duel/beat");
const { gradeAnswer } = await import("../src/lib/duel/gradeAnswer.server");
const { generatePuzzle } = await import("../src/lib/duel/generate.server");
const { withSeededRandom } = await import("../src/lib/duel/random");
const { pinBeatPreLanes, pinPreRetro } = await import("../src/lib/duel/arcade.server");
const { BEAT_DEAL_V13 } = await import("../src/lib/duel/beatDealV13.server");
const { DEAL_PINS } = await import("../src/lib/duel/dealEra");
const { PRACTICE_STAMPS } = await import("../src/lib/duel/practiceStamps.data");
const { GAME_LEVELS, levelsOf } = await import("../src/lib/levels/gameLevels");
const { puzzleLevel } = await import("../src/lib/levels/levels");
const { beatLaneAtOf } = await import("../src/components/puzzles/tapMapping");
const { BeatPicture, beatWords } = await import("../src/lib/levels/pictures/retro-action/beat");
const { renderToStaticMarkup } = await import("react-dom/server");
const { createElement } = await import("react");
const { BEAT_LADDER_LEGACY, beatFinalCheckpoint, stableExtra } = await import("./beat-ladder-legacy-record");
const { beatTwoThumbs } = await import("./beat-thumbs");
const { beatPuzzleV13, beatProof, BEAT_DEAL_V13_SIZE } = await import("./beat-lanes-deal");
const { ladderFixtureVerdicts, replaySample } = await import("./d5-ladder-lib");
const { dealAt } = await import("./level-tune");

import type { PuzzleData } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import type { BeatLegacyFixture } from "./beat-ladder-legacy-record";

const FULL = process.env.CHECKS_FULL === "1";
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
const LEVELS: Level[] = ["normal", "easy", "hard", "expert"];
const OFF: Exclude<Level, "normal">[] = ["easy", "hard", "expert"];
const loose = (p: PuzzleData) => p as unknown as { seed: number; beatRev?: number; level?: string };
const json = (x: unknown) => JSON.stringify(x);

section("1. Older rounds grade exactly as recorded (beatRev 12 at every level, 9–11 at Normal)");
const legacy = JSON.parse(gunzipSync(readFileSync(BEAT_LADDER_LEGACY)).toString()) as BeatLegacyFixture;
{
  ok(legacy.runs.length === 147 && LEVELS.every((l) => legacy.runs.filter((r) => r.level === l && r.rev === 12).length === 30), `the legacy fixture holds 30 beatRev 12 runs at each level and 27 older ones (${legacy.runs.length})`);
  let same = 0;
  for (const r of legacy.runs) {
    const p = JSON.parse(r.puzzle) as PuzzleData;
    const g = gradeAnswer(p, r.raw, 0);
    const good = g.score === r.score && g.isCorrect === r.isCorrect && stableExtra(g.extra) === r.extra && json(beatFinalCheckpoint(p, r.raw)) === json(r.checkpoint);
    if (good) same++;
    else ok(false, `legacy ${r.level} beatRev ${r.rev} deal ${r.n} ${r.kind}: ${r.score} → ${g.score}`);
  }
  ok(same === legacy.runs.length, `${same} of ${legacy.runs.length} legacy runs regrade exactly (score, verdict, extra, final checkpoint)`);
  ok(
    json(BEAT_LEVELS) === json({ easy: { perfect: 5, good: 10, ok: 16, fall: 110, eighthPct: 100, chordPct: 100 }, hard: { perfect: 3, good: 6, ok: 11, fall: 75, eighthPct: 170, chordPct: 160 }, expert: { perfect: 2, good: 5, ok: 10, fall: 60, eighthPct: 240, chordPct: 220 } }),
    "beatRev 12's level table (stored level rounds replay on it) is unchanged",
  );
}

section("2. The stamp and the pin");
{
  ok(beat.BEAT_REV_LANES === 13, "BEAT_REV_LANES is 13");
  const deal = (level: Level | null, seed: number) => withSeededRandom(seed, () => generatePuzzle("beat", { bankSeed: seed, ...(level ? { level } : {}) }));
  for (const seed of [7, 99, 4242, 31337]) {
    ok(json(deal(null, seed)) === json(deal("normal", seed)) && !("level" in (deal("normal", seed) as object)), `seed ${seed}: a Normal deal is the deal with no level asked, with no level field`);
    for (const level of LEVELS) {
      const p = loose(deal(level === "normal" ? null : level, seed));
      ok(p.beatRev === 13 && (level === "normal" ? p.level === undefined : p.level === level) && BEAT_DEAL_V13[level].includes(p.seed), `seed ${seed} ${level}: beatRev 13 on a seed of its own proved list`);
    }
  }
  const was = pinBeatPreLanes(true);
  try {
    for (const seed of [7, 99]) {
      for (const level of LEVELS) {
        const p = loose(deal(level === "normal" ? null : level, seed));
        ok(p.beatRev === 12 && (level === "normal" ? p.level === undefined : p.level === level), `pinned beatPreLanes, seed ${seed} ${level}: beatRev 12 as before`);
      }
    }
    // The pin deals as rooms did before beatRev 13: the legacy fixture's own deals (recorded on level-tune's deals).
    const rec = legacy.runs.filter((r) => r.rev === 12 && r.kind === "average");
    ok(rec.every((r) => json(dealAt("beat", r.level, r.n)) === r.puzzle), `pinned, every recorded beatRev 12 deal is dealt again byte for byte (${rec.length})`);
  } finally {
    pinBeatPreLanes(was);
  }
  const retro = pinPreRetro(true);
  try {
    ok(loose(deal(null, 7)).beatRev === 11, "preRetro still deals beatRev 11");
  } finally {
    pinPreRetro(retro);
  }
  ok("beatPreLanes" in DEAL_PINS, "DEAL_PINS lists beatPreLanes");
  ok(LIVE_BANDS.beat.rev === 13 && LIVE_BANDS.beat.std === beat.BEAT_STD_SPEC_V13 && ARCADE_STANDARD.beat.spec === beat.BEAT_STD_SPEC_V13, "LIVE_BANDS and the standard name beatRev 13's spec");
  ok(beat.BEAT_STD_SPEC_V13.parts.reduce((a, p) => a + p.max, 0) === 200, "beatRev 13's parts sum to 200");
  const help = liveStdHelp("beat");
  ok(/5 in every 9/.test(help) && /70 %/.test(help), `the help says the new lines ("5 in every 9", "70 %"): ${help}`);
  ok(PRACTICE_STAMPS.beat.includes("beatRev=13"), `practice stamps read beatRev=13 (${PRACTICE_STAMPS.beat})`);
}

section("3. Normal is beatRev 12's play, on the lower lines");
{
  const rec = legacy.runs.filter((r) => r.rev === 12 && r.level === "normal");
  let same = 0;
  let higher = 0;
  for (const r of rec) {
    const p12 = JSON.parse(r.puzzle) as PuzzleData;
    const p13 = { ...(p12 as object), beatRev: 13 } as PuzzleData;
    const a = replayBeatRun(loose(p12).seed, r.raw, 12, null);
    const b = replayBeatRun(loose(p13).seed, r.raw, 13, null);
    // The client's beatRev 12 checkpoints all match beatRev 13's replay (no desync; only the claimed score differs).
    if (json(beat.beatCheckpoint(a.state)) === json(beat.beatCheckpoint(b.state)) && b.desyncTick === null && json(a.checkpoints) === json(b.checkpoints)) same++;
    const g = gradeAnswer(p13, r.raw, 0);
    if (g.score >= r.score) higher++;
  }
  ok(same === rec.length, `${same} of ${rec.length} recorded beatRev 12 Normal logs replay on beatRev 13 checkpoint for checkpoint, with no desync`);
  ok(higher === rec.length, `${higher} of ${rec.length} score at least as much on beatRev 13`);
  const s = beat.beatGameFor(13).init(99);
  const { golds } = beat.beatFeatureCounts(s);
  const full = beat.beatFullLines(s);
  ok(s.fit === 1 && full.acc === 1000 && full.fevers === 4 && full.golds === Math.ceil((golds * 5) / 9) && full.streak === Math.ceil((beat.beatNoteCount(s) * 70) / 100), `Normal's lines: accuracy 1,000, 4 fevers, ${full.golds} of ${golds} golden notes, a streak of ${full.streak} of ${beat.beatNoteCount(s)} notes`);
  const s12 = beat.beatGameFor(12).init(99);
  ok(json(beat.beatFullLines(s12)) === json({ acc: 1000, fevers: 4, golds, streak: beat.beatNoteCount(s12) }), "beatRev 12 keeps every golden note and note");
  ok(json(beat.beatCheckpoint(s)) === json(beat.beatCheckpoint(s12)), "`fit` stays outside the checksum (the same first checkpoint)");
  // Built states: one golden note short of the line is less than full, at the line full; the streak likewise.
  const built = (gh: number, ms: number) => beat.beatStdParts({ ...s, goldsHit: gh, maxStreak: ms })!;
  const part = (parts: ReturnType<typeof built>, key: string) => parts.find((p) => p.key === key)!.points;
  ok(part(built(full.golds - 1, 0), "gold") < 15 && part(built(full.golds, 0), "gold") === 15 && part(built(golds, 0), "gold") === 15, "golden notes: full at the line, less one short of it");
  ok(part(built(0, full.streak - 1), "streak") < 15 && part(built(0, full.streak), "streak") === 15, "the streak: full at the line, less one short of it");
}

section("4. The levels as dealt");
{
  ok(json(levelsOf("beat")) === json(["easy", "normal", "hard", "expert"]), "Tempo offers all four levels");
  ok(RETRO_LEVEL_TABLES.beat === BEAT_LEVELS_V13, "the Retro table is beatRev 13's");
  for (const level of OFF) ok(json(GAME_LEVELS.beat!.levels[level]!.settings) === json(BEAT_LEVELS_V13[level]), `the registry's ${level} is the sim's row`);
  const want = { easy: 3, hard: 5, expert: 6 } as const;
  for (const level of OFF) {
    const lv = BEAT_LEVELS_V13[level];
    ok(lv.lanes === want[level], `${level}: ${lv.lanes} lanes (Joe's ladder 3 / 5 / 6)`);
    const game = beat.beatGameFor(13, level);
    const lanesOf = (k: number) => json(game.inputRanges?.find((r) => r.k === k)?.a);
    ok([beat.BEAT_INPUT_TAP, beat.BEAT_INPUT_RELEASE, beat.BEAT_INPUT_SWIPE].every((k) => lanesOf(k) === json([0, lv.lanes - 1])), `${level}: taps, releases and swipes range over its ${lv.lanes} lanes`);
    let lanesOk = 0;
    let firstUse = 0;
    let quiet = 0;
    const list = BEAT_DEAL_V13[level];
    const sample = FULL ? list : list.filter((_, i) => i % 10 === 0);
    for (const seed of sample) {
      const st = game.init(seed);
      const lanes = new Set(st.chart.lanes);
      if (st.lv?.lanes === lv.lanes && Math.max(...st.chart.lanes) === lv.lanes - 1 && lanes.size === lv.lanes) lanesOk++;
      // From the first note: every lane used in the first 40 s (Normal adds its fifth only from then).
      const early = new Set(st.chart.lanes.filter((_, i) => st.chart.ticks[i]! < beat.BEAT_V9_FIVE_FROM));
      if (early.size === lv.lanes) firstUse++;
      // No break before a fifth lane: notes inside Normal's quiet second.
      if (st.chart.ticks.some((t) => t > beat.BEAT_V9_FIVE_FROM - beat.BEAT_V9_BREAK && t < beat.BEAT_V9_FIVE_FROM)) quiet++;
      if (st.holding.length < lv.lanes) lanesOk = -1e9;
    }
    ok(lanesOk === sample.length, `${level}: every sampled chart uses exactly its ${lv.lanes} lanes (${lanesOk}/${sample.length})`);
    ok(firstUse === sample.length, `${level}: all ${lv.lanes} lanes from the first 40 s (${firstUse}/${sample.length})`);
    ok(quiet >= sample.length * 0.8, `${level}: no break before 40 s (notes in Normal's quiet second on ${quiet}/${sample.length})`);
    const w = beat.beatWindows(game.init(list[0]!));
    ok(w.perfect === lv.perfect && w.good === lv.good && w.ok === lv.ok && beat.beatFallOf(game.init(list[0]!)) === lv.fall, `${level}: judged on ${lv.perfect} / ${lv.good} / ${lv.ok} ticks, drawn with a ${lv.fall}-tick fall`);
  }
  const n = beat.beatGameFor(13).init(BEAT_DEAL_V13.normal[0]!);
  ok(beat.beatLanesAt(n, 0) === 4 && beat.beatLanesAt(n, beat.BEAT_V9_FIVE_FROM) === 5, "Normal: four lanes, five from 40 s");
  for (const level of ["hard", "expert"] as const) {
    const lv = BEAT_LEVELS_V13[level];
    ok(lv.perfect <= beat.BEAT_V10_WINDOWS.perfect && lv.good <= beat.BEAT_V10_WINDOWS.good && lv.ok <= beat.BEAT_V10_WINDOWS.ok && lv.fall <= beat.BEAT_FALL_TICKS, `${level} adds no aid: no window wider and no fall longer than Normal's`);
  }
  const e = BEAT_LEVELS_V13.easy;
  ok(e.perfect >= beat.BEAT_V10_WINDOWS.perfect && e.fall >= beat.BEAT_FALL_TICKS && e.eighthPct < 100 && e.chordPct < 100, "Easy is welcoming: windows no tighter, a slower fall, half the off-beats and chords");
}

section("5. The proof: two thumbs, the deal file, 200 through the server replay");
{
  for (const level of LEVELS) {
    const list = BEAT_DEAL_V13[level];
    ok(list.length === BEAT_DEAL_V13_SIZE && new Set(list).size === list.length, `${level}: ${list.length} distinct proved seeds`);
    let thumbs = 0;
    for (const seed of list) if (beatTwoThumbs(beat.beatGameFor(13, level).init(seed).chart).ok) thumbs++;
    ok(thumbs === list.length, `${level}: every dealt chart is two-thumb playable at the human limits (${thumbs}/${list.length})`);
    const sample = FULL ? list : list.filter((_, i) => i % 25 === 0);
    let at200 = 0;
    for (const seed of sample) if ((await beatProof(seed, level)).score === 200) at200++;
    ok(at200 === sample.length, `${level}: the flawless player held to the human limits scores 200 through the server replay on ${at200}/${sample.length} dealt seeds`);
    const st = beat.beatGameFor(13, level).init(list[0]!);
    ok(beat.beatStdParts(st)!.reduce((a, p) => a + (p.max ?? 0), 0) === 200, `${level}: the parts' maxima sum to 200`);
  }
  // Today's Normal charts: most are not two-thumb playable (a chord under a held tail), so Normal deals only those that are.
  const v12 = Array.from({ length: 40 }, (_, i) => beatTwoThumbs(beat.beatGameFor(12).init(1000 + i).chart).ok).filter(Boolean).length;
  ok(v12 < 40, `a plain seed's Normal chart is not always two-thumb playable (${v12}/40), so the deal list filters them`);
  if (FULL) {
    const r = spawnSync("bun", ["scripts/beat-lanes-deal.ts", "--check"], { encoding: "utf8" });
    ok(r.status === 0, `the deal file rebuilds byte for byte (${(r.stdout ?? "").trim().split("\n").pop()})`);
  } else {
    // At default depth the first proved seed of each level is re-derived from the candidate list.
    const { hashSeed } = await import("./beat-lanes-deal");
    for (const level of LEVELS) {
      let n = 0;
      let first = 0;
      while (!first) {
        const p = await beatProof(hashSeed(n), level);
        if (p.thumbs && p.score === 200) first = hashSeed(n);
        n++;
      }
      ok(BEAT_DEAL_V13[level][0] === first, `${level}: the list starts where the builder's first proved candidate is (${first})`);
    }
  }
}

section("6. The ladder (288 deals a level, recorded) and a live re-play of it");
{
  for (const [cond, label] of await ladderFixtureVerdicts("beat")) ok(cond, label);
  for (const [cond, label] of await replaySample("beat", 2)) ok(cond, label);
}

section("6b. The phone and the server agree on every level (random play, beatRev 13)");
{
  const { encodeEvents } = await import("./beat-ladder-legacy-record");
  for (const level of LEVELS) {
    const lanes = level === "normal" ? 5 : BEAT_LEVELS_V13[level].lanes;
    let agree = 0;
    for (let k = 0; k < 4; k++) {
      const seed = BEAT_DEAL_V13[level][k * 37]!;
      const puzzle = beatPuzzleV13(seed, level);
      // A seeded tapper over the level's lanes: touches, lifts, swipes and the fever meter.
      let h = (seed ^ 0x2545f491) >>> 0;
      const next = (m: number) => {
        h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
        h = (h ^ (h >>> 12)) >>> 0;
        return h % m;
      };
      const byTick = new Map<number, { t: number; k: number; a: number; b: number; c: number; d: number }>();
      for (let t = 30; t < beat.BEAT_V9_RUN_TICKS - 10; t += 4 + next(20)) {
        const roll = next(10);
        const k = roll < 6 ? beat.BEAT_INPUT_TAP : roll < 8 ? beat.BEAT_INPUT_RELEASE : roll < 9 ? beat.BEAT_INPUT_SWIPE : beat.BEAT_INPUT_FEVER;
        byTick.set(t, { t, k, a: k === beat.BEAT_INPUT_FEVER ? 0 : next(lanes), b: k === beat.BEAT_INPUT_SWIPE ? next(2) : 0, c: 0, d: 0 });
      }
      const raw = encodeEvents(puzzle, [...byTick.values()]);
      const r = replayBeatRun(seed, raw, 13, level === "normal" ? null : level);
      if (r.desyncTick === null && !r.flagged && r.score === gradeAnswer(puzzle, raw, 0).score) agree++;
    }
    ok(agree === 4, `${level}: random play over ${lanes} lanes replays on the server with no desync, unflagged, at the phone's score (${agree}/4)`);
  }
}

section("7. Lanes on screen and the lever picture");
{
  type S = ReturnType<typeof beat.beatGame.init>;
  const render = (w: number, h: number, s: S) => {
    const c = createCanvas(w, h);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    beatArtGame.draw(ctx, s, { width: w, height: h });
    return (ctx as unknown as { getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray } }).getImageData(0, 0, w, h).data;
  };
  for (const level of OFF) {
    const lanes = BEAT_LEVELS_V13[level].lanes;
    const game = beat.beatGameFor(13, level);
    let s = game.init(BEAT_DEAL_V13[level][0]!) as S;
    for (let t = 0; t < 300; t++) s = game.step(s, null) as S;
    for (const [w, h] of [[390, 730], [375, 702]] as const) {
      let good = 0;
      for (let lane = 0; lane < lanes; lane++) {
        const lit = render(w, h, { ...s, lastJudge: 1, judgeAge: 0, lastLane: lane } as S);
        const dark = render(w, h, { ...s, lastJudge: 0, judgeAge: 99, lastLane: -1 } as S);
        // The lane flash a judged hit draws: its extent along a row half way down the lanes.
        const row = Math.round(h * 0.45);
        let left = Infinity;
        let right = -Infinity;
        for (let x = 0; x < w; x++) {
          const k = (row * w + x) * 4;
          if (Math.max(Math.abs(lit[k]! - dark[k]!), Math.abs(lit[k + 1]! - dark[k + 1]!), Math.abs(lit[k + 2]! - dark[k + 2]!)) > 8) {
            left = Math.min(left, x);
            right = Math.max(right, x + 1);
          }
        }
        const box = { left: 0, top: 0, width: w, height: h };
        const centre = (left + right) / 2;
        const hits = (x: number) => x >= 0 && x < w && beatLaneAtOf(box, x, lanes) === lane;
        if (Number.isFinite(left) && hits(centre) && !hits(left - 3) && !hits(right + 3)) good++;
        else ok(false, `${level} lane ${lane} at ${w}x${h}: drawn ${left}–${right}, the centre ${hits(centre) ? "hits" : "misses"}, 3 px past ${hits(left - 3) || hits(right + 3) ? "still hits" : "misses"}`);
      }
      ok(good === lanes, `${level} at ${w}x${h}: a tap on each of the ${lanes} drawn lanes hits it, 3 px past its edges does not`);
    }
  }
  for (const level of LEVELS) {
    for (const size of ["l", "s"] as const) {
      const html = renderToStaticMarkup(createElement(BeatPicture, { level, size }));
      const want = level === "normal" ? 4 : BEAT_LEVELS_V13[level].lanes;
      ok(html.includes(`data-lanes="${want}"`) && (html.match(/<circle/g) ?? []).length === want && !/#[0-9a-fA-F]{3,6}\b/.test(html), `the lever picture at ${level} (${size}) draws ${want} lanes' buttons, colours only through tokens`);
    }
    ok(beatWords(level).length > 0 && beatWords(level).length <= 40, `the lever's words at ${level}: "${beatWords(level)}"`);
  }
  ok(puzzleLevel(beatPuzzleV13(1, "expert")) === "expert" && puzzleLevel(beatPuzzleV13(1, "normal")) === "normal", "the proof's puzzles carry their level as a deal does");
}

console.log(`\n${failures.length ? "FAIL" : "PASS"} beat-ladder-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
