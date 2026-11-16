/**
 * Apex's difficulty levels (stage 3, 16 Nov 2026; docs/arcade-standard/racing.md "Levels"):
 *  1. The registry: racing offers Easy, Normal, Hard and Expert with Joe's settings (gravel keep 80 / 65 / 60 / 50, the
 *     wider track on Easy, the closer walls on Hard and Expert, Expert's tighter hairpins, the aids).
 *  2. Normal deals exactly as before levels: no `level` or `racingLevel` field, the same seed as the racingRev 4 draw.
 *  3. Every level stamps its settings (racingLevel, a plain copy) and deals from its own proved deal, all three
 *     circuits; every clock ≤ 120 s; rated play and the Daily stay Normal.
 *  4. The sim reads only the stored settings: the gravel floor, the kerb, the wall, the hairpins and the pace; Normal's
 *     state carries no `lv` and checksums as racingRev 4; a run made at one level is flagged on another.
 *  5. Replays: the oracle at exactly 200 through gradeAnswer on every level and circuit; a sample of each level's deal
 *     (all of it with CHECKS_FULL=1); older stamps replay exactly as before whatever level field a puzzle carries.
 *  6. Display: Easy's braking points, Normal and Hard's boards and line, Expert's signs only; Normal drawn with its own
 *     settings stamped is pixel-identical to Normal (the width path is exact), and Easy's wider road is drawn.
 *  7. Text: each non-Normal level's intro line and help note; Normal shows none.
 *  8. Challenges stay Normal: "Two hundred club" completes on a Normal run only.
 *  9. The step: the elite bot's mean falls Easy > Normal > Hard > Expert, Expert's elite still scores well, and on
 *     Easy an average driver reaches a star on some runs.
 *
 *   bun scripts/racing-levels-check.ts
 */
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;

const R = await import("../src/lib/arcade/racing");
const RR = await import("../src/lib/arcade/racing.renderer");
const { replayRacingRun } = await import("../src/lib/duel/racing");
const { generatePuzzle, gradeAnswer } = await import("../src/lib/duel/generate.server");
const { withSeededRandom } = await import("../src/lib/duel/random");
const { arcadeSeed } = await import("../src/lib/duel/arcade.server");
const { racingDealSeedV4, RACING_DEAL_V4 } = await import("../src/lib/duel/racingDealV4.server");
const { RACING_DEAL_V4_EASY } = await import("../src/lib/duel/racingDealV4Easy.server");
const { RACING_DEAL_V4_HARD } = await import("../src/lib/duel/racingDealV4Hard.server");
const { RACING_DEAL_V4_EXPERT } = await import("../src/lib/duel/racingDealV4Expert.server");
const { gameLevelSettings, levelsOf } = await import("../src/lib/levels/gameLevels");
const { modeLevel } = await import("../src/lib/levels/modes");
const { puzzleLevel } = await import("../src/lib/levels/levels");
const { levelNote } = await import("../src/lib/levels/levelNotes");
const { puzzleTimeLimitMs } = await import("../src/lib/duel/catalogue");
const { challengesFor, evaluateChallenge } = await import("../src/lib/duel/practiceChallenges");
const { racingSubmission, racingSeedProved } = await import("./racing-deal");
const { oracleRun } = await import("./racing-oracle");
const { GAME_BY_TYPE } = await import("./arcade-skill-bands/games");
const { measureLevel } = await import("./racing-levels-bands");
const { MAX_ROUND_CLOCK_MS } = await import("../src/lib/levels/levels");

type Lv = import("../src/lib/arcade/racing").RacingLevelSettings;
type Puzzle = import("../src/lib/duel/types").RacingPuzzleData;
type Level = import("../src/lib/levels/levels").Level;

const FULL = process.env["CHECKS_FULL"] === "1";
let passed = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  if (cond) passed++;
  else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
}

const LEVELS3 = ["easy", "hard", "expert"] as const;
const settings = (l: (typeof LEVELS3)[number]) => gameLevelSettings<Lv>("racing", l)!;
const deal = (level: Level, n: number): Puzzle => withSeededRandom(1000 + n, () => generatePuzzle("racing", level === "normal" ? {} : { level })) as Puzzle;

/* 1. The registry. */
ok(levelsOf("racing").join() === "easy,normal,hard,expert", "racing offers Easy, Normal, Hard and Expert");
{
  const e = settings("easy");
  const h = settings("hard");
  const x = settings("expert");
  ok(e.keep === 80 && h.keep === 60 && x.keep === 50 && R.RACING_V3_OFF_KEEP === 65, "the gravel keeps 80 / 65 / 60 / 50 % (Easy / Normal / Hard / Expert)");
  ok(e.road > R.RACING_ROAD_X && e.kerb > R.RACING_KERB_X && e.wall > R.RACING_WALL_X, "Easy's track is wider (tarmac, kerb and wall)");
  ok(h.road === R.RACING_ROAD_X && h.kerb === R.RACING_KERB_X && h.wall < R.RACING_WALL_X && x.wall === h.wall && x.kerb === h.kerb, "Hard and Expert keep the track's width with the tyre walls closer (narrower run-off)");
  ok(e.tight === 0 && h.tight === 0 && x.tight > 0, "only Expert tightens the hairpins");
  ok(e.aids === 2 && h.aids === 1 && x.aids === 0, "aids: Easy signs and braking points, Hard signs and boards, Expert signs only");
  for (const l of LEVELS3) ok(R.racingLevelOf(settings(l)) !== null, `${l}: the settings parse as RacingLevelSettings`);
}

/* 2. Normal deals exactly as before. */
for (let n = 0; n < 12; n++) {
  const p = deal("normal", n);
  const before = withSeededRandom(1000 + n, () => racingDealSeedV4(arcadeSeed()));
  const asNormal = withSeededRandom(1000 + n, () => generatePuzzle("racing", { level: "normal" }));
  ok(p.seed === before && p.racingRev === R.RACING_REV_DEALT && !("level" in p) && !("racingLevel" in p) && JSON.stringify(asNormal) === JSON.stringify(p), `Normal deal ${n}: racingRev 4's draw exactly (no level fields)`);
}

/* 3. Levels deal and stamp; clocks; modes. */
const DEALS: Record<(typeof LEVELS3)[number], readonly number[]> = { easy: RACING_DEAL_V4_EASY, hard: RACING_DEAL_V4_HARD, expert: RACING_DEAL_V4_EXPERT };
for (const l of LEVELS3) {
  const circuits = new Set<number>();
  let stamped = true;
  let own = true;
  for (let n = 0; n < 24; n++) {
    const p = deal(l, n);
    circuits.add(R.racingCircuitOf(p.seed));
    if (puzzleLevel(p) !== l || JSON.stringify(R.racingLevelOf(p.racingLevel)) !== JSON.stringify(R.racingLevelOf(settings(l))) || p.racingRev !== R.RACING_REV_4) stamped = false;
    if (!DEALS[l].includes(p.seed)) own = false;
    ok(puzzleTimeLimitMs(p as never) <= MAX_ROUND_CLOCK_MS, `${l} deal ${n}: its clock is at most 120 s`);
  }
  ok(stamped, `${l}: every deal stamps level and its settings (racingLevel) on racingRev 4`);
  ok(own, `${l}: every deal comes from its own proved deal`);
  ok(circuits.size === 3, `${l}: all three circuits are dealt`);
  ok(DEALS[l].length === 300 && [0, 1, 2].every((c) => DEALS[l].filter((s) => R.racingCircuitOf(s) === c).length === 100), `${l}: its deal holds 100 seeds on each circuit`);
}
ok(modeLevel("rated", "expert") === "normal" && modeLevel("daily", "easy") === "normal" && modeLevel("practice", "hard") === "hard", "rated play and the Daily stay Normal; practice plays the level");

/* 4. The sim reads the stored settings. */
{
  const seed = RACING_DEAL_V4[0]!;
  const n4 = R.racingGameFor(4).init(seed);
  ok(!("lv" in n4) && R.racingGameFor(4, null).init(seed).lv === undefined, "Normal's state carries no level settings");
  const sameChecksum = (() => {
    const g = R.racingGameFor(4);
    const ev = oracleRun(seed, 4);
    const m = new Map(ev.map((e) => [e.t, e]));
    let st = g.init(seed);
    const sums: number[] = [];
    while (!g.isOver(st)) {
      st = g.step(st, m.get(st.tick + 1) ?? null);
      if (st.tick % 600 === 0) sums.push(R.racingChecksum(st));
    }
    return sums;
  })();
  ok(sameChecksum.length > 5, "Normal checksums its run");
  for (const l of LEVELS3) {
    const lv = settings(l);
    const g = R.racingGameFor(4, lv);
    const st = g.init(seed);
    ok(JSON.stringify(st.lv) === JSON.stringify(R.racingLevelOf(lv)), `${l}: the state carries the stored settings`);
    ok(R.racingChecksum(st) !== R.racingChecksum(n4), `${l}: the settings are in the checksum`);
    ok(R.racingV3OffFloor(2800, lv.keep) === Math.floor((2800 * lv.keep) / 100), `${l}: the gravel floor keeps ${lv.keep} % of the speed`);
    // The gravel: a car just past the clean edge, flat out, settles at the level's floor of the speed it left at.
    const base = { ...st, tick: 600, s: R.RACING_SEG * 40, v: 2800, pedal: 100, acted: 1 };
    let on = R.racingStep({ ...base, x: R.racingCleanX(st) + 500 }, null);
    for (let t = 0; t < 40; t++) on = R.racingStep({ ...on, x: R.racingCleanX(st) + 500 }, null);
    const floorNormal = R.racingV3OffFloor(on.offFrom ?? 0);
    ok(on.off === 1 && on.v === R.racingV3OffFloor(on.offFrom ?? 0, lv.keep) && (lv.keep > 65 ? on.v > floorNormal : on.v < floorNormal), `${l}: on the gravel the car holds ${lv.keep} % of the speed it left the tarmac at (${on.v} of ${on.offFrom}; Normal ${floorNormal})`);
    const inside = R.racingStep({ ...base, x: R.racingCleanX(st) - 500 }, null);
    ok(inside.off === 0, `${l}: inside its kerb the car is clean`);
    const wall = R.racingStep({ ...base, x: R.racingWallLimit(st) - 10, steer: 100, wheel: 100 }, null);
    ok(wall.wall === 1 && wall.x === lv.wall - R.RACING_CAR_HALF, `${l}: the tyre wall stops the car at its own face`);
  }
  // Easy's wider track: a car where Normal's wheel is on the grass is still clean on Easy.
  const easyState = R.racingGameFor(4, settings("easy")).init(seed);
  const wide = R.racingStep({ ...easyState, tick: 600, s: R.RACING_SEG * 40, v: 2000, x: R.RACING_CLEAN_X + 3000, acted: 1 }, null);
  const narrow = R.racingStep({ ...n4, tick: 600, s: R.RACING_SEG * 40, v: 2000, x: R.RACING_CLEAN_X + 3000, acted: 1 }, null);
  ok(wide.off === 0 && narrow.off === 1, "Easy's wider kerb keeps a car clean where Normal's is on the grass");
  // Expert's hairpins: every hairpin's peak raised by its circuit's tightBy (Ridge Loop keeps its own, Joe 16 Nov 2026),
  // every other segment and the hills unchanged.
  ok(JSON.stringify(settings("expert").tightBy) === JSON.stringify([2, 2, 0]) && R.racingCircuitOf(2) === 2 && R.RACING_CIRCUITS[2]!.id === "ridge", "Expert tightens Sunset Park's and Harbour Run's hairpins by 2 and keeps Ridge Loop's own");
  for (let c = 0; c < 3; c++) {
    const t0 = R.racingCircuit(c);
    const tx = R.racingTrackFor(c, 4, settings("expert"));
    const add = R.racingTightFor(settings("expert"), c);
    if (add === 0) {
      ok(tx === t0, `circuit ${c + 1}: Expert races the circuit's own hairpins`);
      continue;
    }
    const hairpins = t0.sections.filter((s) => s.kind === R.RACING_SEC_HAIRPIN);
    const peaks = hairpins.every((h, i) => tx.sections.filter((s) => s.kind === R.RACING_SEC_HAIRPIN)[i]!.peak === h.peak + add);
    let others = true;
    for (let i = 0; i < R.RACING_LAP_SEGS; i++) {
      const inHairpin = hairpins.some((h) => i >= h.start && i < h.start + h.len);
      if (!inHairpin && t0.curve[i] !== tx.curve[i]) others = false;
      if (inHairpin && Math.abs(tx.curve[i]!) < Math.abs(t0.curve[i]!)) others = false;
    }
    ok(hairpins.length > 0 && peaks && others && t0.hill.join() === tx.hill.join(), `circuit ${c + 1}: Expert tightens its ${hairpins.length} hairpins only (hills and every other bend unchanged)`);
    ok(R.racingTrackFor(c, 4, settings("easy")) === t0 && R.racingTrackFor(c, 4, settings("hard")) === t0, `circuit ${c + 1}: Easy and Hard race the circuit itself`);
    const signs0 = R.racingCornerAdvice(t0).map((a) => a.kmh);
    const signsX = R.racingCornerAdviceOf({ seed: c, rev: 4, lv: R.racingLevelOf(settings("expert"))! }).map((a) => a.kmh);
    ok(signsX.length === signs0.length && signsX.some((k, i) => k < signs0[i]!), `circuit ${c + 1}: Expert's corner signs show the tighter hairpins' slower speeds`);
  }
  // Pace: each level's range.
  for (let c = 0; c < 3; c++) {
    const normal = R.racingPaceRange({ rev: 4, seed: c });
    const ranges = LEVELS3.map((l) => R.racingPaceRange({ rev: 4, seed: c, lv: R.racingLevelOf(settings(l))! }));
    ok(ranges[0]!.full < normal.full && ranges[1]!.full === normal.full && ranges[1]!.full - ranges[1]!.zero < normal.full - normal.zero && ranges[2]!.full - ranges[2]!.zero < ranges[1]!.full - ranges[1]!.zero, `circuit ${c + 1}: Easy's par pace is lower, Hard's and Expert's spreads narrower in turn`);
  }
}

/* 5. Replays. */
for (const l of ["normal", ...LEVELS3] as const) {
  for (let c = 0; c < 3; c++) {
    let p: Puzzle | null = null;
    for (let n = 0; n < 40 && !p; n++) {
      const d = deal(l, n);
      if (R.racingCircuitOf(d.seed) === c) p = d;
    }
    if (!p) {
      ok(false, `${l}: a deal on circuit ${c + 1}`);
      continue;
    }
    const lv = R.racingLevelOf(p.racingLevel);
    const raw = racingSubmission(p.seed, oracleRun(p.seed, 4, lv), 4, lv);
    const graded = gradeAnswer(p as never, raw, 0);
    ok(graded.score === 200, `${l}, circuit ${c + 1}: the oracle scores exactly 200 through gradeAnswer (${graded.score})`);
    if (l !== "normal") {
      // These two are meant to desync: the replay's own console report is held back.
      const quiet = console.error;
      console.error = () => {};
      try {
        const asNormal = replayRacingRun(p.seed, raw, 4);
        ok(asNormal.flagged, `${l}, circuit ${c + 1}: the run replayed without its level is flagged (the settings are in the checksum)`);
        const normalRaw = racingSubmission(p.seed, oracleRun(p.seed, 4), 4);
        ok(replayRacingRun(p.seed, normalRaw, 4, p.racingLevel).flagged, `${l}, circuit ${c + 1}: a Normal run submitted to the level is flagged`);
      } finally {
        console.error = quiet;
      }
    }
  }
}
for (const l of LEVELS3) {
  const list = FULL ? DEALS[l] : DEALS[l].filter((_, i) => i % 50 === 0);
  const bad = list.filter((s) => !racingSeedProved(s, 4, settings(l)));
  ok(bad.length === 0, `${l}: ${list.length} deal seeds proved at 200 through the server replay${FULL ? "" : " (sample; CHECKS_FULL=1 for all)"}`);
}
// Older stamps: a level field is ignored below racingRev 4.
for (const rev of [1, 2, 3]) {
  const seed = 1655421732;
  const raw = racingSubmission(seed, oracleRun(seed, rev), rev);
  const plain = replayRacingRun(seed, raw, rev);
  const withLevel = replayRacingRun(seed, raw, rev, settings("expert"));
  ok(JSON.stringify(plain.state) === JSON.stringify(withLevel.state) && plain.score === withLevel.score && !plain.flagged, `racingRev ${rev}: a stored level field changes nothing (${plain.score})`);
}
{
  const spec = GAME_BY_TYPE.get("racing")!;
  ok(typeof spec.gameForPuzzle === "function" && spec.gameForPuzzle!(deal("expert", 0)).init(1).lv?.tight === settings("expert").tight && spec.gameForPuzzle!(deal("normal", 0)).init(1).lv === undefined, "the skill-band spec builds the level's game from the dealt puzzle (gameForPuzzle)");
}

/* 6. Display. */
for (let c = 0; c < 3; c++) {
  const track0 = R.racingCircuit(c);
  const dn = RR.racingTrackDetail(track0);
  const de = RR.racingTrackDetail(track0, settings("easy"));
  const dh = RR.racingTrackDetail(track0, settings("hard"));
  const dx = RR.racingTrackDetail(R.racingTrackFor(c, 4, settings("expert")), settings("expert"));
  const signed = R.racingCornerAdvice(track0).map((a) => a.corner.start);
  ok(dn.corners.every((k) => k.boards === 3 && !k.brake && k.line) && dh.corners.every((k) => k.boards === 3 && !k.brake), `circuit ${c + 1}: Normal and Hard draw the braking boards and the racing line, no braking points`);
  ok(de.corners.filter((k) => signed.includes(k.start)).every((k) => k.brake && k.sign && k.boards === 3), `circuit ${c + 1}: Easy paints a braking point before every signed corner`);
  ok(dx.corners.every((k) => k.boards === 0 && !k.brake && !k.line) && dx.corners.some((k) => k.sign), `circuit ${c + 1}: Expert draws the signs only (no boards, braking points or racing line)`);
}
{
  const W = R.RACING_WORLD_W;
  const H = R.RACING_WORLD_H;
  const canvas = createCanvas(W, H);
  const draw = (st: import("../src/lib/arcade/racing").RacingState) => {
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    RR.drawRacingPlay(ctx, st, { width: W, height: H });
    return Buffer.from(canvas.getContext("2d").getImageData(0, 0, W, H).data);
  };
  const same: Lv = { keep: 65, road: R.RACING_ROAD_X, kerb: R.RACING_KERB_X, wall: R.RACING_WALL_X, tight: 0, aids: 1 };
  let identical = true;
  let easyDiffers = true;
  for (const [c, s] of [[0, 40], [1, 300], [2, 700]] as const) {
    const base = { ...R.racingGameFor(4).init(c), tick: 900, s: R.RACING_SEG * s, v: 2300, x: 4000 };
    const a = draw(base);
    const b = draw({ ...base, lv: same });
    if (!a.equals(b)) identical = false;
    if (draw({ ...base, lv: R.racingLevelOf(settings("easy"))! }).equals(a)) easyDiffers = false;
  }
  ok(identical, "Normal drawn through a level's width path with Normal's own numbers is pixel-identical to Normal");
  ok(easyDiffers, "Easy's wider track is drawn");
}

/* 7. Text. */
{
  const { racingPuzzle } = await import("../src/puzzles/racing");
  ok(levelNote("racing", "normal") === null && racingPuzzle.introLine?.(deal("normal", 0) as never) === null, "Normal's intro and help show no level line");
  for (const l of LEVELS3) {
    const note = levelNote("racing", l);
    ok(!!note && note.startsWith(l[0]!.toUpperCase() + l.slice(1)) && racingPuzzle.introLine?.(deal(l, 0) as never) === note, `${l}: the intro and the help say what the level changes`);
  }
  ok(/80 %/.test(levelNote("racing", "easy")!) && /60 %/.test(levelNote("racing", "hard")!) && /half/.test(levelNote("racing", "expert")!), "the level lines name each level's gravel");
}

/* 8. Challenges stay Normal. */
{
  const club = challengesFor("racing").find((c) => c.name === "Two hundred club");
  ok(!!club, "racing has its Two hundred club challenge");
  if (club) {
    const run = (level: "classic" | "hard" | "expert" | null) => ({ score: 200, isCorrect: true, reactionAvgMs: null, extra: { racingRev: 4, pace10: 2300, lines: [] }, level });
    ok(evaluateChallenge(club, run("classic")).met && evaluateChallenge(club, run(null)).met, "Two hundred club completes on a Normal run");
    ok(!evaluateChallenge(club, run("hard")).met && !evaluateChallenge(club, run("expert")).met, "Two hundred club completes on no other level");
  }
}

/* 9. The step (deterministic bots, graded through the server replay). */
{
  const ns = Array.from({ length: FULL ? 40 : 12 }, (_, i) => i);
  const elite = (["easy", "normal", "hard", "expert"] as const).map((l) => measureLevel(l, "elite", ns));
  console.log(`  elite means: ${elite.map((r) => `${r.level} ${r.mean}`).join(", ")}`);
  ok(elite[0]!.mean > elite[1]!.mean && elite[1]!.mean > elite[2]!.mean && elite[2]!.mean > elite[3]!.mean, "the elite bot's mean falls Easy > Normal > Hard > Expert");
  ok(elite[3]!.median >= 140, `Expert is humanly possible to score well on: the elite median ${elite[3]!.median} ≥ 140`);
  const avgEasy = measureLevel("easy", "average", ns);
  const avgNormal = measureLevel("normal", "average", ns);
  console.log(`  average: easy mean ${avgEasy.mean} (175+ ${Math.round(avgEasy.star * 100)}%), normal mean ${avgNormal.mean}`);
  ok(avgEasy.star > 0 && avgEasy.mean > avgNormal.mean, "on Easy an average driver reaches a star on some runs");
}

if (failures.length) {
  console.log(`FAIL racing-levels-check: ${failures.length} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`PASS racing-levels-check: ${passed} checks (the registry, Normal's deal unchanged, each level stamped and dealt from its own proved deal, the sim's settings, replays at 200, older stamps unchanged, the display aids, the text, Normal-only challenges and the step)`);
