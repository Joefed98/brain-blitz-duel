/**
 * burst-ladder-check (D5, 23 Nov 2026; no browser, ~1–2 min on a 2-core runner; `CHECKS_FULL=1` re-plays every witness's
 * player): Fission's levels and Normal scoring, folded into the unshipped burstRev 14 (docs/arcade-standard/burst.md
 * "Levels (D5, 23 Nov 2026)"; the spec's "### Fission": the lever is the atoms in each wave).
 *
 *  1. Normal's play is burstRev 14's as the branch built it: every run of the Normal-play legacy fixture
 *     (scripts/fixtures/burst-ladder-legacy.json.gz, recorded before the refit by scripts/d5-normal-play-legacy-record.ts)
 *     replays to the same final state, and only its score moved: never lower, exactly the parts on the new lines.
 *     Older stamps at every level: D5's levels legacy runs for Fission (burstRev 13, every level) grade as recorded, and
 *     burstRev 13's level table is unchanged.
 *  2. The stamp: Normal and every level deal burstRev 14, each from its own proved list; a Normal deal is byte for byte the
 *     deal with no level asked; the `burstPreSmall` pin still deals burstRev 13 (and `preRetro` burstRev 11).
 *  3. The level rules as dealt: BURST_LEVELS_SMALL's settings on the run's state, the registry mirroring them; each level's
 *     five waves of atoms as its table says (S; M; M; M S; L on Easy, 42 atoms; M M; L; L M; L M; L L on Hard, 103; M M M;
 *     L M; L M; L L; L L on Expert, 125; Normal's M; L; M M; L S S; L L, 87), entering from the seed's sides, the first
 *     wave's atoms all bouncing from the first second; their golden atoms and carriers scheduled from the seed; lives,
 *     sizes, quick times and free beams as the table says.
 *  4. Normal's scoring lines (wave clears full at 19 of 35, golden atoms at 2 of 5) and each level's own; the parts still
 *     sum to 200; the core is 140 at every atom of the run's own waves.
 *  5. The deals: every stored witness scores exactly 200 through the server replay at its level, unflagged, and is the
 *     human-limited flawless player's own log (a sample; all with CHECKS_FULL=1); burstLevelDeals.server.ts is exactly what
 *     scripts/burst-level-deal.ts builds from them; a dealt puzzle at each level scores its witness's 200 through gradeAnswer.
 *  6. the recorded 96-deal ladder (scripts/fixtures/d5-ladder-burst.json.gz): a sample of
 *     it re-played live scores exactly as recorded.
 *  7. The lever picture draws from the level's settings, at both sizes, with token colours only.
 *
 *   bun scripts/burst-ladder-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  burstAtomsOf,
  burstGameFor,
  burstLevelWaves,
  burstSmallLines,
  burstSmallLv,
  burstStdParts,
  burstV10Atoms,
  BURST_LIVES,
  BURST_REV_AIM,
  BURST_REV_BIG,
  BURST_REV_SMALL,
  BURST_V10_PARTS,
  BURST_V14_CLEAR_FULL,
  BURST_V14_GOLD_FULL,
  type BurstState,
} from "../src/lib/arcade/burst";
import { BURST_LEVELS, BURST_LEVELS_SMALL } from "../src/lib/arcade/retroLevels";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { withDealOptions } from "../src/lib/duel/dealEra";
import { replayBurstRun } from "../src/lib/duel/burst";
import { BURST_DEAL_V14, burstDealSeedV14 } from "../src/lib/duel/burstLevelDeals.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { GAME_LEVELS } from "../src/lib/levels/gameLevels";
import type { Level } from "../src/lib/levels/levels";
import { BurstPicture, burstWords } from "../src/lib/levels/pictures/retro-action/burst";
import { replaySample } from "./d5-ladder-lib";
import { D5_LEVELS_LEGACY, stableExtra, type D5LegacyCase } from "./d5-levels-legacy-record";
import { NORMAL_PLAY_LEGACY, playDigest, type NormalPlayRun } from "./d5-normal-play-legacy-record";
import { BURST_DEAL_FILE, BURST_DEAL_LEVELS, burstDealSource, burstWitnessLog, checkBurstWitnesses, proveBurstWitness, readBurstWitnesses } from "./burst-level-deal";

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  checks += 1;
  if (!cond) failures.push(`  ✗ ${label}`);
}
const FULL = process.env["CHECKS_FULL"] === "1" || process.argv.includes("--full");
const LEVELS: readonly Level[] = ["easy", "normal", "hard", "expert"];
const t0 = Date.now();
const deal = (level: Level, seed: number) => withSeededRandom(seed, () => generatePuzzle("burst", level === "normal" ? {} : { level })) as unknown as Record<string, unknown>;
const total = (waves: readonly (readonly { size: number }[])[]) => waves.reduce((n, w) => n + w.reduce((m, s) => m + burstAtomsOf(s.size), 0), 0);

/* 1. Normal's play unchanged; older stamps as recorded. */
{
  const data = JSON.parse(gunzipSync(readFileSync(NORMAL_PLAY_LEGACY.burst)).toString()) as { runs: NormalPlayRun[] };
  let same = 0;
  let moved = 0;
  const bad: string[] = [];
  for (const r of data.runs) {
    const puzzle = r.puzzle as unknown as PuzzleData;
    const play = playDigest("burst", puzzle, r.raw);
    const g = gradeAnswer(puzzle, r.raw, 0);
    const p = r.puzzle as { seed: number; burstRev: number };
    const s = replayBurstRun(p.seed, r.raw, p.burstRev, null).state;
    const want = s.acted ? Math.max(1, Math.min(200, burstStdParts(s).total)) : 0;
    if (play === r.play && g.score >= r.score && g.score === want) same += 1;
    else if (bad.length < 4) bad.push(`${r.label}: play ${play === r.play ? "same" : "DIFFERS"}, ${r.score} → ${g.score} (parts ${want})`);
    if (g.score !== r.score) moved += 1;
  }
  ok(data.runs.length >= 100 && bad.length === 0, `all ${data.runs.length} Normal runs recorded before the refit replay to the same final state and score at least as before, exactly their parts (${same} same; ${bad.join("; ")})`);
  ok(moved > 10, `the refit moves some Normal scores (${moved} of ${data.runs.length})`);
  const legacy = (JSON.parse(gunzipSync(readFileSync(D5_LEVELS_LEGACY)).toString()) as D5LegacyCase[]).filter((c) => c.game === "burst");
  let asRecorded = 0;
  for (const c of legacy) {
    const g = gradeAnswer(c.puzzle, c.answer, 0);
    if (g.score === c.score && g.isCorrect === c.isCorrect && stableExtra(g.extra) === c.extra) asRecorded += 1;
  }
  ok(legacy.length >= 8 && asRecorded === legacy.length && legacy.every((c) => (c.puzzle as unknown as { burstRev: number }).burstRev === BURST_REV_BIG), `D5's legacy Fission runs (burstRev 13, every level) grade as recorded (${asRecorded} of ${legacy.length})`);
  ok(
    JSON.stringify(BURST_LEVELS) ===
      JSON.stringify({ easy: { lives: 4, sizePct: 125, quickPct: 150, freeWhiffs: 40 }, hard: { lives: 3, sizePct: 100, quickPct: 75, freeWhiffs: 12 }, expert: { lives: 2, sizePct: 100, quickPct: 60, freeWhiffs: 8 } }),
    "burstRev 13's level table is unchanged (BURST_LEVELS)",
  );
  for (const level of ["easy", "hard", "expert"] as const) {
    const s13 = burstGameFor(BURST_REV_BIG, level).init(7) as BurstState;
    const n13 = burstGameFor(BURST_REV_BIG).init(7) as BurstState;
    ok(JSON.stringify(s13.lv) === JSON.stringify(BURST_LEVELS[level]) && JSON.stringify(s13.waves) === JSON.stringify(n13.waves), `${level}: burstRev 13 still plays BURST_LEVELS on Normal's waves`);
  }
}

/* 2. The stamp, the deals and Normal. */
{
  const n = deal("normal", 0x5eed);
  ok(n["burstRev"] === BURST_REV_SMALL && BURST_DEAL_V14.normal.includes(n["seed"] as number) && n["level"] === undefined, `Normal deals burstRev 14 from Normal's list, no level field (${String(n["burstRev"])})`);
  for (const level of ["easy", "hard", "expert"] as const) {
    let on = 0;
    for (let i = 0; i < 200; i++) {
      const p = deal(level, 0x5eed + i * 7919);
      if (p["burstRev"] === BURST_REV_SMALL && p["level"] === level && BURST_DEAL_V14[level].includes(p["seed"] as number)) on += 1;
    }
    ok(on === 200, `${level}: 200 deals are burstRev 14 at the level, each on a seed from the level's own list (${on})`);
    const list = BURST_DEAL_V14[level];
    const reach = new Set(Array.from({ length: list.length * 3 }, (_, k) => burstDealSeedV14(k * 104729 + 17, level)));
    ok(reach.size === list.length && list.length >= 60, `${level}: every seed of its ${list.length} reachable from a room seed`);
  }
  for (const seed of [7, 99, 4242, 31337]) ok(JSON.stringify(deal("normal", seed)) === JSON.stringify(withSeededRandom(seed, () => generatePuzzle("burst", { level: "normal" }))), `seed ${seed}: a Normal deal is the deal with no level asked`);
  ok(withDealOptions({ pins: ["burstPreSmall"] }, () => deal("hard", 0x5eed)["burstRev"]) === BURST_REV_BIG, "the burstPreSmall pin still deals burstRev 13");
  ok(withDealOptions({ pins: ["preRetro"] }, () => deal("normal", 0x5eed)["burstRev"]) === BURST_REV_AIM, "preRetro still deals burstRev 11");
}

/* 3. The level rules as dealt. */
{
  const want = { easy: "S;M;M;MS;L", normal: "M;L;MM;LSS;LL", hard: "MM;L;LM;LM;LL", expert: "MMM;LM;LM;LL;LL" } as const;
  const atoms = { easy: 42, normal: 87, hard: 103, expert: 125 } as const;
  const name = (waves: readonly (readonly { size: number }[])[]) => waves.map((w) => w.map((s) => "LMSX"[s.size]).join("")).join(";");
  for (const level of LEVELS) {
    for (const seed of [3, 7, 4242, 10007]) {
      const s = burstGameFor(BURST_REV_SMALL, level).init(seed) as BurstState;
      ok(name(s.waves) === want[level] && burstV10Atoms(s.waves) === atoms[level], `${level} seed ${seed}: the waves are ${want[level]} (${name(s.waves)}), ${atoms[level]} atoms`);
      if (level === "normal") continue;
      const lv = BURST_LEVELS_SMALL[level];
      const normal = burstGameFor(BURST_REV_SMALL).init(seed) as BurstState;
      ok(s.lv === lv && burstSmallLv(s) === lv && s.lives === lv.lives && s.small === 1, `${level} seed ${seed}: the run starts with the level's settings and ${lv.lives} lives`);
      ok(JSON.stringify(s.waves) === JSON.stringify(burstLevelWaves(lv.waves, normal.waves)) && s.waves[0]![0]!.side === normal.waves[0]![0]!.side, `${level} seed ${seed}: the first atom enters from the side the seed gives Normal's`);
      ok(s.goldens!.length === 5 && s.gDue!.length === 5 && (s.carriers ?? []).length > 0, `${level} seed ${seed}: five golden atoms and their carriers scheduled from the seed`);
    }
    if (level !== "normal") ok(JSON.stringify(GAME_LEVELS.burst?.levels[level]?.settings) === JSON.stringify(BURST_LEVELS_SMALL[level]), `${level}: the registry mirrors the sim's table`);
  }
  // The opening wave: every atom of it in play together within the first second of its arrival.
  for (const level of ["hard", "expert"] as const) {
    const game = burstGameFor(BURST_REV_SMALL, level);
    let s = game.init(42) as BurstState;
    while (s.wave === 0 && s.tick < 600) s = game.step(s, null) as BurstState;
    for (let k = 0; k < 60; k++) s = game.step(s, null) as BurstState;
    ok(s.balls.length === BURST_LEVELS_SMALL[level].waves[0]!.length, `${level}: the opening wave's ${BURST_LEVELS_SMALL[level].waves[0]!.length} atoms bounce together a second in (${s.balls.length})`);
  }
  ok(BURST_LEVELS_SMALL.easy.lives === 4 && BURST_LEVELS_SMALL.hard.lives === 3 && BURST_LEVELS_SMALL.expert.lives === 2 && BURST_LIVES === 3, "lives: Easy 4, Normal and Hard 3, Expert 2");
  ok(BURST_LEVELS_SMALL.easy.sizePct === 125 && BURST_LEVELS_SMALL.hard.sizePct === 100 && BURST_LEVELS_SMALL.expert.sizePct === 100, "atoms a quarter bigger on Easy only");
}

/* 4. The scoring lines. */
{
  ok(BURST_V10_PARTS.core + BURST_V10_PARTS.clear + BURST_V10_PARTS.gold === 200, "the parts' maxima add up to 200 (140 + 35 + 25)");
  ok(BURST_V14_CLEAR_FULL === 19 && BURST_V14_GOLD_FULL === 2, "Normal: the wave clears full at 19 of the 35, the golden atoms at 2 of 5");
  const base = burstGameFor(BURST_REV_SMALL).init(5) as BurstState;
  const parts = (over: Partial<BurstState>, level?: Level) => burstStdParts({ ...(level && level !== "normal" ? (burstGameFor(BURST_REV_SMALL, level).init(5) as BurstState) : base), acted: 1, ...over } as BurstState);
  const golden = (n: number) => ({ goldHit: (1 << n) - 1 });
  ok(parts({ clearPts: 19 }).clear === 35 && parts({ clearPts: 10 }).clear === 18 && parts({ clearPts: 35 }).clear === 35, "Normal: 19 wave-clear points fill the part, 10 give 18");
  ok(parts(golden(2)).gold === 25 && parts(golden(1)).gold === 12 && parts(golden(5)).gold === 25, "Normal: two golden atoms fill the part, one gives 12");
  ok(parts({ hits: 87 }).core === 140 && parts({ hits: 86 }).core < 140, "Normal: the core full at all 87 atoms");
  for (const level of ["easy", "hard", "expert"] as const) {
    const lv = BURST_LEVELS_SMALL[level];
    const lines = burstSmallLines(burstGameFor(BURST_REV_SMALL, level).init(5) as BurstState);
    ok(lines.core === lv.coreFull && lines.clear === lv.clearFull && lines.gold === lv.goldFull, `${level}: its own lines (core ${lv.coreFull}, clears ${lv.clearFull}, golden ${lv.goldFull})`);
    ok(parts({ hits: lv.coreFull }, level).core === 140 && parts({ hits: lv.coreFull - 1 }, level).core < 140, `${level}: the core full at ${lv.coreFull} atoms`);
    ok(parts({ clearPts: lv.clearFull }, level).clear === 35 && parts({ clearPts: lv.clearFull - 1 }, level).clear < 35, `${level}: the wave clears full at ${lv.clearFull}`);
    ok(parts(golden(lv.goldFull), level).gold === 25 && parts(golden(lv.goldFull - 1), level).gold < 25, `${level}: the golden atoms full at ${lv.goldFull}`);
  }
  const old = burstGameFor(BURST_REV_BIG).init(5) as BurstState;
  ok(burstStdParts({ ...old, acted: 1, clearPts: 19, goldHit: 3 } as BurstState).clear === 19 && burstStdParts({ ...old, acted: 1, goldHit: 3 } as BurstState).gold === 10, "burstRev 13 keeps 1 a wave-clear point and 5 a golden atom");
}

/* 5. The deals. */
{
  const { lists, bad } = checkBurstWitnesses();
  ok(bad.length === 0, `every witness scores 200 through the server replay at its level (${bad.slice(0, 5).join("; ")})`);
  ok(readFileSync(BURST_DEAL_FILE, "utf8") === burstDealSource(lists), "burstLevelDeals.server.ts is exactly the witnessed seeds, a list a level");
  for (const level of BURST_DEAL_LEVELS) {
    ok(BURST_DEAL_V14[level as "normal"].join() === lists[level]!.seeds.join(), `${level}: the deal file's list is the witnessed seeds in order`);
    ok(lists[level]!.seeds.length >= 60 && new Set(lists[level]!.seeds).size === lists[level]!.seeds.length, `${level}: at least 60 proved seeds, none twice (${lists[level]!.seeds.length} of ${lists[level]!.tried} candidates)`);
  }
  const data = readBurstWitnesses();
  let runs = 0;
  let same = 0;
  const diff: string[] = [];
  for (const level of BURST_DEAL_LEVELS) {
    const sample = FULL ? data[level]!.witnesses : data[level]!.witnesses.filter((_, k) => k % 10 === 0);
    for (const w of sample) {
      runs += 1;
      const again = await burstWitnessLog(w.seed, level, w.limits);
      if (JSON.stringify(again) === JSON.stringify(w.events)) same += 1;
      else if (diff.length < 3) diff.push(`${w.seed} ${level} limits ${w.limits}`);
    }
  }
  ok(runs > 0 && same === runs, `${same} of ${runs} witnesses (${FULL ? "all" : "every tenth a level"}) are the human-limited flawless player's own logs (${diff.join("; ")})`);
  const byLevel = new Map(BURST_DEAL_LEVELS.map((l) => [l, new Map(data[l]!.witnesses.map((w) => [w.seed, w]))]));
  for (const level of LEVELS) {
    const puzzle = withSeededRandom(0xc0ffee, () => generatePuzzle("burst", level === "normal" ? {} : { level }));
    const seed = (puzzle as unknown as { seed: number }).seed;
    const w = byLevel.get(level)!.get(seed)!;
    const graded = gradeAnswer(puzzle, proveBurstWitness(seed, level, w.events).raw, 0);
    ok(graded.score === 200 && !(graded.extra as { flagged?: boolean } | undefined)?.flagged, `${level}: the dealt seed's witness scores 200 through gradeAnswer on the dealt puzzle (${graded.score})`);
  }
}

/* 6. the recorded ladder, and a live sample of it. */
{
  // The recorded 96-deal figures are reported, not targets (Joe, 27 Nov 2026: sessions don't decide difficulty), so this
  // check no longer holds them to the ladder test; it re-plays a sample to show the figures are today's game.
  for (const [cond, label] of await replaySample("burst", 2)) ok(cond, label);
}

/* 7. The lever picture. */
{
  for (const level of LEVELS) {
    const opening = level === "normal" ? 1 : BURST_LEVELS_SMALL[level].waves[0]!.length;
    for (const size of ["l", "s"] as const) {
      const html = renderToStaticMarkup(createElement(BurstPicture, { level, size }));
      const circles = (html.match(/<circle/g) ?? []).length;
      const lives = level === "normal" ? 3 : BURST_LEVELS_SMALL[level].lives;
      ok(html.includes(`data-burst-picture="${level}"`) && !/#[0-9a-fA-F]{3,6}\b/.test(html) && circles === opening + lives, `${level} ${size}: the picture draws the opening wave's ${opening} atoms and ${lives} lives, token colours only (${circles} circles)`);
    }
    ok(burstWords(level).includes(String(total(burstGameFor(BURST_REV_SMALL, level).init(3).waves as never))), `${level}: the words "${burstWords(level)}" state the run's atoms`);
  }
}

const secs = ((Date.now() - t0) / 1000).toFixed(0);
if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL burst-ladder-check: ${failures.length} of ${checks} checks failed (${secs} s)`);
  process.exit(1);
}
console.log(`PASS burst-ladder-check: ${checks} checks (${secs} s) — Normal's play unchanged on its new lines; each level's waves, lives and lines as their table says; every level dealt only on seeds the human-limited flawless player takes to 200; the recorded 96-deal ladder re-plays`);
