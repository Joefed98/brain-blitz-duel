/**
 * wavefront-ladder-check (D5, 23 Nov 2026; no browser, ~1–2 min on a 2-core runner; `CHECKS_FULL=1` re-plays every
 * witness's player): Wavefront's levels and Normal scoring, folded into the unshipped wavRev 16 (docs/arcade-standard/
 * wavefront.md "Levels (D5, 23 Nov 2026)"; the spec's "### Wavefront": the lever is the enemy bolts in the air).
 *
 *  1. Normal's play is wavRev 16's as the branch built it: every run of the Normal-play legacy fixture
 *     (scripts/fixtures/wavefront-ladder-legacy.json.gz, recorded before the refit by scripts/d5-normal-play-legacy-record.ts)
 *     replays to the same final state, and only its score moved: never lower, exactly the parts on the new lines.
 *     Older stamps at every level: D5's levels legacy runs for Wavefront (wavRev 15, every level) grade as recorded, and
 *     wavRev 15's level table is unchanged.
 *  2. The stamp: Normal and every level deal wavRev 16, each level from its own proved list; a Normal deal is byte for
 *     byte the deal with no level asked; the `wavPreWide` pin still deals wavRev 15.
 *  3. The level rules as dealt: WAVEFRONT_LEVELS_WIDE's settings on the run's state, the registry mirroring them; on every
 *     tick of runs at each level the bolts in the air never pass the level's most, each formation volley carries the
 *     level's bolts (the one more from its wave), no ship dives before the level's wave (none on Easy) and two at once only
 *     from its own; lives, the bolts' speed and the boss as the table says.
 *  4. Normal's scoring lines (saucers full at 4 of 5, cannons and weak points at 5 of 6) and each level's own; the parts
 *     still sum to 200.
 *  5. The deals: every stored witness scores exactly 200 through the server replay at its level, unflagged, and is the
 *     human-limited flawless player's own log (a sample; all with CHECKS_FULL=1); wavefrontDealV16.server.ts is exactly
 *     what scripts/wavefront-wide-deal.ts builds from them; a dealt puzzle at each level scores its witness's 200 through
 *     gradeAnswer.
 *  6. Joe's ladder test on the recorded 96-deal ladder (scripts/fixtures/d5-ladder-wavefront.json.gz) all true, and a
 *     sample of it re-played live scores exactly as recorded.
 *  7. The lever picture draws from the level's settings, at both sizes, with token colours only.
 *
 *   bun scripts/wavefront-ladder-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { wavefrontGameFor, wavStdScore, wavWideLv, WAVEFRONT_STD_WIDE, WAV_REV_BIG, WAV_REV_WIDE, WAV_V16_SAUCERS_FULL, WAV_V16_WEAK_FULL, WAV_X_SAUCERS, type WavState } from "../src/lib/arcade/wavefront";
import { WAVEFRONT_LEVELS, WAVEFRONT_LEVELS_WIDE } from "../src/lib/arcade/retroLevels";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { pinWavPreWide } from "../src/lib/duel/arcade.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { replayWavefrontRun } from "../src/lib/duel/wavefront";
import { WAV_DEAL_V16, WAV_DEAL_V16_LEVELS, wavDealSeedV16 } from "../src/lib/duel/wavefrontDealV16.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { GAME_LEVELS } from "../src/lib/levels/gameLevels";
import type { Level } from "../src/lib/levels/levels";
import { WavefrontPicture, wavefrontWords } from "../src/lib/levels/pictures/retro-action/wavefront";
import { ladderFixtureVerdicts, replaySample } from "./d5-ladder-lib";
import { D5_LEVELS_LEGACY, stableExtra, type D5LegacyCase } from "./d5-levels-legacy-record";
import { NORMAL_PLAY_LEGACY, playDigest, type NormalPlayRun } from "./d5-normal-play-legacy-record";
import { checkWideWitnesses, humanWitnessLog, proveWideWitness, readWideWitnesses, WAV_WIDE_DEAL_FILE, WAV_WIDE_JITTERS, WAV_WIDE_LEVELS, wavWideDealSource } from "./wavefront-wide-deal";
import { randomLog } from "./room-identity/wavefront";

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  checks += 1;
  if (!cond) failures.push(`  ✗ ${label}`);
}
const FULL = process.env["CHECKS_FULL"] === "1" || process.argv.includes("--full");
const LEVELS: readonly Level[] = ["easy", "normal", "hard", "expert"];
const t0 = Date.now();
const deal = (level: Level, seed: number) => withSeededRandom(seed, () => generatePuzzle("wavefront", level === "normal" ? {} : { level })) as unknown as Record<string, unknown>;

/* 1. Normal's play unchanged; older stamps as recorded. */
{
  const data = JSON.parse(gunzipSync(readFileSync(NORMAL_PLAY_LEGACY.wavefront)).toString()) as { runs: NormalPlayRun[] };
  let same = 0;
  let moved = 0;
  const bad: string[] = [];
  for (const r of data.runs) {
    const puzzle = r.puzzle as unknown as PuzzleData;
    const play = playDigest("wavefront", puzzle, r.raw);
    const g = gradeAnswer(puzzle, r.raw, 0);
    const p = r.puzzle as { seed: number; wavRev: number };
    const s = replayWavefrontRun(p.seed, r.raw, p.wavRev, null).state as WavState;
    const parts = wavStdScore(s);
    const sum = parts.core + Object.values(parts.features).reduce((a, b) => a + b, 0) - parts.penalty;
    const want = s.acted ? Math.max(1, Math.min(200, sum)) : 0;
    if (play === r.play && g.score >= r.score && g.score === want) same += 1;
    else if (bad.length < 4) bad.push(`${r.label}: play ${play === r.play ? "same" : "DIFFERS"}, ${r.score} → ${g.score} (parts ${want})`);
    if (g.score !== r.score) moved += 1;
  }
  ok(data.runs.length >= 100 && bad.length === 0, `all ${data.runs.length} Normal runs recorded before the refit replay to the same final state and score at least as before, exactly their parts (${same} same; ${bad.join("; ")})`);
  ok(moved > 10, `the refit moves some Normal scores (${moved} of ${data.runs.length})`);
  const legacy = (JSON.parse(gunzipSync(readFileSync(D5_LEVELS_LEGACY)).toString()) as D5LegacyCase[]).filter((c) => c.game === "wavefront");
  let asRecorded = 0;
  for (const c of legacy) {
    const g = gradeAnswer(c.puzzle, c.answer, 0);
    if (g.score === c.score && g.isCorrect === c.isCorrect && stableExtra(g.extra) === c.extra) asRecorded += 1;
  }
  ok(legacy.length >= 8 && asRecorded === legacy.length && legacy.every((c) => (c.puzzle as unknown as { wavRev: number }).wavRev === WAV_REV_BIG), `D5's legacy Wavefront runs (wavRev 15, every level) grade as recorded (${asRecorded} of ${legacy.length})`);
  ok(
    JSON.stringify(WAVEFRONT_LEVELS) ===
      JSON.stringify({ easy: { lives: 4, boltPct: 80, bossPct: 80, killS: 24 }, hard: { lives: 3, boltPct: 120, bossPct: 130, killS: 16 }, expert: { lives: 2, boltPct: 140, bossPct: 160, killS: 16 } }),
    "wavRev 15's level table is unchanged (WAVEFRONT_LEVELS)",
  );
  for (const level of ["easy", "hard", "expert"] as const) {
    const s15 = wavefrontGameFor(WAV_REV_BIG, level).init(7) as WavState;
    ok(JSON.stringify(s15.lv) === JSON.stringify(WAVEFRONT_LEVELS[level]) && wavWideLv(s15) === null, `${level}: wavRev 15 still plays WAVEFRONT_LEVELS (no fire table)`);
  }
}

/* 2. The stamp, the deals and Normal. */
{
  const n = deal("normal", 0x5eed);
  ok(n["wavRev"] === WAV_REV_WIDE && WAV_DEAL_V16.includes(n["seed"] as number) && n["level"] === undefined, `Normal deals wavRev 16 from Normal's list, no level field (${String(n["wavRev"])})`);
  for (const level of ["easy", "hard", "expert"] as const) {
    let on = 0;
    for (let i = 0; i < 200; i++) {
      const p = deal(level, 0x5eed + i * 7919);
      if (p["wavRev"] === WAV_REV_WIDE && p["level"] === level && WAV_DEAL_V16_LEVELS[level].includes(p["seed"] as number)) on += 1;
    }
    ok(on === 200, `${level}: 200 deals are wavRev 16 at the level, each on a seed from the level's own list (${on})`);
  }
  for (const seed of [7, 99, 4242, 31337]) ok(JSON.stringify(deal("normal", seed)) === JSON.stringify(withSeededRandom(seed, () => generatePuzzle("wavefront", { level: "normal" }))), `seed ${seed}: a Normal deal is the deal with no level asked`);
  pinWavPreWide(true);
  const p15 = deal("normal", 0x5eed);
  const p15h = deal("hard", 0x5eed);
  pinWavPreWide(false);
  ok(p15["wavRev"] === WAV_REV_BIG && p15h["wavRev"] === WAV_REV_BIG, "the wavPreWide pin still deals wavRev 15 at Normal and at a level");
  for (const level of ["easy", "hard", "expert"] as const) {
    const list = WAV_DEAL_V16_LEVELS[level];
    const reach = new Set(Array.from({ length: list.length * 3 }, (_, k) => wavDealSeedV16(k * 104729 + 17, level)));
    ok(reach.size === list.length && list.length >= 60, `${level}: every seed of its ${list.length} reachable from a room seed`);
  }
}

/* 3. The level rules as dealt. */
{
  for (const level of ["easy", "hard", "expert"] as const) {
    const lv = WAVEFRONT_LEVELS_WIDE[level];
    ok(JSON.stringify(GAME_LEVELS.wavefront?.levels[level]?.settings) === JSON.stringify(lv), `${level}: the registry mirrors the sim's table`);
    const s = wavefrontGameFor(WAV_REV_WIDE, level).init(11) as WavState;
    const n = wavefrontGameFor(WAV_REV_WIDE).init(11) as WavState;
    ok(s.lv === lv && s.lives === lv.lives && s.redSpeed === Math.trunc((n.redSpeed * lv.boltPct) / 100) && wavWideLv(s) === lv, `${level}: the run starts with the level's settings, ${lv.lives} lives and its bolts' speed`);
  }
  ok(WAVEFRONT_LEVELS_WIDE.easy.volley === 1 && WAVEFRONT_LEVELS_WIDE.easy.diveFrom === 0 && WAVEFRONT_LEVELS_WIDE.hard.volley === 2 && WAVEFRONT_LEVELS_WIDE.expert.volley === 3, "the lever: one bolt a volley on Easy, pairs on Hard, threes on Expert (Normal one)");
  ok(WAVEFRONT_LEVELS_WIDE.easy.maxRed < 10 && WAVEFRONT_LEVELS_WIDE.hard.maxRed > 10 && WAVEFRONT_LEVELS_WIDE.expert.maxRed > WAVEFRONT_LEVELS_WIDE.hard.maxRed, "the most bolts in the air rises level by level (Normal 10)");
  ok(WAVEFRONT_LEVELS_WIDE.hard.diveFrom < 3 && WAVEFRONT_LEVELS_WIDE.expert.diveFrom < WAVEFRONT_LEVELS_WIDE.hard.diveFrom, "the divers come sooner level by level (Normal from wave 3; none on Easy)");
  ok(WAVEFRONT_LEVELS_WIDE.easy.lives > 3 && WAVEFRONT_LEVELS_WIDE.hard.lives === 3 && WAVEFRONT_LEVELS_WIDE.expert.lives < 3, "lives: Easy 4, Hard 3, Expert 2");
  // Every tick of idle, random and proof-player runs at each level.
  const witnesses = readWideWitnesses();
  for (const level of LEVELS) {
    const lv = level === "normal" ? null : WAVEFRONT_LEVELS_WIDE[level];
    const maxRed = lv ? lv.maxRed : 10;
    let peak = 0;
    let volleys = 0;
    let wrongVolley = 0;
    let earlyDive = 0;
    let tooMany = 0;
    const sizes = new Map<string, number>();
    const play = (seed: number, events: readonly ArcadeInputEvent[]) => {
      const game = wavefrontGameFor(WAV_REV_WIDE, level);
      const byTick = new Map(events.map((e) => [e.t, e]));
      let s = game.init(seed) as WavState;
      while (!game.isOver(s) && s.tick < game.runTicks) {
        const before = s;
        s = game.step(s, byTick.get(s.tick + 1) ?? null) as WavState;
        peak = Math.max(peak, s.reds.length);
        // A formation volley: the redIn timer restarted on a tick with no boss and the same wave (bolts born this tick:
        // those that are not last tick's moved down by its speed).
        if (!s.boss && !before.boss && s.redIn > before.redIn && s.wave === before.wave) {
          const born = s.reds.filter((r) => !before.reds.some((q) => q.x === r.x && q.y + before.redSpeed === r.y)).length;
          // Normal: one, or two on one volley in three from wave 3 (the sim's own rule); a level: its volley, one more from
          // its wave (on one volley in `upOdds`). Never more; fewer only where the cap or the columns run out.
          const most = lv ? lv.volley + (lv.upFrom > 0 && s.wave >= lv.upFrom ? 1 : 0) : s.wave >= 3 ? 2 : 1;
          if (born > most) wrongVolley += 1;
          const key = `w${s.wave}:${born}`;
          sizes.set(key, (sizes.get(key) ?? 0) + 1);
          volleys += 1;
        }
        const divers = (s.divers ?? []).length;
        const from = lv ? lv.diveFrom : 3;
        const two = lv ? lv.diveTwoFrom : 4;
        if (divers > 0 && (from === 0 || s.wave < from)) earlyDive += 1;
        if (divers > (s.wave >= two && from > 0 ? 2 : 1)) tooMany += 1;
      }
    };
    const list = level === "normal" ? WAV_DEAL_V16 : WAV_DEAL_V16_LEVELS[level];
    for (let k = 0; k < 4; k++) {
      const seed = list[k * 11]!;
      play(seed, []);
      play(seed, randomLog(seed));
    }
    for (const w of witnesses[level]!.witnesses.slice(0, 4)) play(w.seed, w.events);
    ok(peak <= maxRed, `${level}: never more than ${maxRed} bolts in the air (peak ${peak})`);
    ok(volleys > 50 && wrongVolley === 0, `${level}: no formation volley carries more than the level's bolts (${volleys} volleys)`);
    if (lv) {
      const first = [...sizes].filter(([k]) => k.startsWith("w1:")).sort((a, b) => b[1] - a[1])[0]?.[0];
      ok(first === `w1:${lv.volley}`, `${level}: wave 1's volleys are mostly ${lv.volley} bolts (${[...sizes].map(([k, v]) => `${k}×${v}`).join(" ")})`);
      if (lv.upFrom > 0 && lv.upOdds <= 1) {
        const later = [...sizes].filter(([k]) => k.startsWith(`w${lv.upFrom}:`)).sort((a, b) => b[1] - a[1])[0]?.[0];
        ok(later === `w${lv.upFrom}:${lv.volley + 1}`, `${level}: on wave ${lv.upFrom} its volleys are mostly ${lv.volley + 1} bolts (fewer later only as the formation thins out)`);
      }
    }
    ok(earlyDive === 0 && tooMany === 0, `${level}: no ship dives before the level's wave${lv?.diveFrom === 0 ? " (none on Easy)" : ""}, two at once only from its own (${earlyDive}, ${tooMany})`);
  }
}

/* 4. The scoring lines. */
{
  const sum = WAVEFRONT_STD_WIDE.parts.reduce((a, p) => a + p.max, 0);
  ok(sum === 200, `wavRev 16's parts sum to ${sum}`);
  ok(WAV_V16_SAUCERS_FULL === 4 && WAV_V16_WEAK_FULL === 5 && WAVEFRONT_STD_WIDE.parts.find((p) => p.key === "saucers")?.of === 4 && WAVEFRONT_STD_WIDE.parts.find((p) => p.key === "weak")?.of === 5, "Normal: the saucers full at 4 of 5, the cannons and weak points at 5 of 6 (the spec says so)");
  const base = wavefrontGameFor(WAV_REV_WIDE).init(5) as WavState;
  const at = (over: Partial<WavState>, level?: Level) => wavStdScore({ ...(level ? (wavefrontGameFor(WAV_REV_WIDE, level).init(5) as WavState) : base), acted: 1, tick: 4000, ...over } as WavState).features;
  ok(at({ saucers: 4 }).saucers === 20 && at({ saucers: 3 }).saucers === 15 && at({ saucers: 5 }).saucers === 20, "Normal: 4 saucers fill the part, 3 give 15");
  ok(at({ cannonsDown: 4, coresHit: 1 }).weak === 10 && at({ cannonsDown: 4 }).weak === 8 && at({ cannonsDown: 4, coresHit: 3 }).weak === 10, "Normal: 5 weak points fill the part, 4 give 8");
  for (const level of ["easy", "hard", "expert"] as const) {
    const lv = WAVEFRONT_LEVELS_WIDE[level];
    ok(at({ saucers: lv.saucersFull }, level).saucers === 20 && at({ saucers: lv.saucersFull - 1 }, level).saucers < 20, `${level}: the saucers full at its ${lv.saucersFull}`);
    const weak = (k: number) => ({ cannonsDown: Math.min(4, k), coresHit: k > 5 ? 3 : k > 4 ? 1 : 0 });
    ok(at(weak(lv.weakFull), level).weak === 10 && at(weak(lv.weakFull - 1), level).weak < 10, `${level}: the cannons and weak points full at its ${lv.weakFull}`);
  }
  const old = wavefrontGameFor(WAV_REV_BIG).init(5) as WavState;
  ok(wavStdScore({ ...old, acted: 1, saucers: 4 } as WavState).features.saucers === 16, "wavRev 15 keeps 4 a saucer of 5 (16 for 4)");
  ok(WAV_X_SAUCERS === 5, "a run flies 5 saucers");
}

/* 5. The deals. */
{
  const { lists, bad } = checkWideWitnesses();
  ok(bad.length === 0, `every witness scores 200 through the server replay at its level (${bad.slice(0, 5).join("; ")})`);
  ok(readFileSync(WAV_WIDE_DEAL_FILE, "utf8") === wavWideDealSource(lists), "wavefrontDealV16.server.ts is exactly the witnessed seeds, a list a level");
  ok(WAV_DEAL_V16.join() === lists["normal"]!.seeds.join() && (["easy", "hard", "expert"] as const).every((l) => WAV_DEAL_V16_LEVELS[l].join() === lists[l]!.seeds.join()), "the deal file's lists are the witnessed seeds in order");
  for (const level of WAV_WIDE_LEVELS) ok(lists[level]!.seeds.length >= 60 && new Set(lists[level]!.seeds).size === lists[level]!.seeds.length, `${level}: at least 60 proved seeds, none twice (${lists[level]!.seeds.length} of ${lists[level]!.tried} candidates)`);
  const data = readWideWitnesses();
  let runs = 0;
  let same = 0;
  const diff: string[] = [];
  for (const level of WAV_WIDE_LEVELS) {
    const sample = FULL ? data[level]!.witnesses : data[level]!.witnesses.filter((_, k) => k % 10 === 0);
    for (const w of sample) {
      runs += 1;
      const again = await humanWitnessLog(w.seed, level, w.jitter);
      if (WAV_WIDE_JITTERS.includes(w.jitter) && JSON.stringify(again) === JSON.stringify(w.events)) same += 1;
      else if (diff.length < 3) diff.push(`${w.seed} ${level} j${w.jitter}`);
    }
  }
  ok(runs > 0 && same === runs, `${same} of ${runs} witnesses (${FULL ? "all" : "every tenth a level"}) are the human-limited flawless player's own logs (${diff.join("; ")})`);
  const byLevel = new Map(WAV_WIDE_LEVELS.map((l) => [l, new Map(data[l]!.witnesses.map((w) => [w.seed, w]))]));
  for (const level of LEVELS) {
    const puzzle = withSeededRandom(0xc0ffee, () => generatePuzzle("wavefront", level === "normal" ? {} : { level }));
    const seed = (puzzle as unknown as { seed: number }).seed;
    const w = byLevel.get(level)!.get(seed)!;
    const graded = gradeAnswer(puzzle, proveWideWitness(seed, level, w.events).raw, 0);
    ok(graded.score === 200 && !(graded.extra as { flagged?: boolean } | undefined)?.flagged, `${level}: the dealt seed's witness scores 200 through gradeAnswer on the dealt puzzle (${graded.score})`);
  }
}

/* 6. Joe's ladder test on the recorded ladder, and a live sample of it. */
{
  for (const [cond, label] of await ladderFixtureVerdicts("wavefront")) ok(cond, label);
  for (const [cond, label] of await replaySample("wavefront", 2)) ok(cond, label);
}

/* 7. The lever picture. */
{
  for (const level of LEVELS) {
    for (const size of ["l", "s"] as const) {
      const html = renderToStaticMarkup(createElement(WavefrontPicture, { level, size }));
      ok(html.includes(`data-wavefront-picture="${level}"`) && !/#[0-9a-fA-F]{3,6}\b/.test(html) && /var\(--jz-red\)/.test(html), `${level} ${size}: the picture draws, its colours tokens only`);
      const reds = (html.match(/var\(--jz-red\)/g) ?? []).length;
      const want = level === "normal" ? 1 : WAVEFRONT_LEVELS_WIDE[level].volley;
      ok(reds === want, `${level} ${size}: the picture's bolts are the level's volley (${reds}, ${want})`);
    }
    ok(wavefrontWords(level).length > 5 && wavefrontWords(level).length <= 40, `${level}: the words "${wavefrontWords(level)}"`);
  }
  ok(new Set(LEVELS.map(wavefrontWords)).size === 4, "each level has its own words");
}

const secs = ((Date.now() - t0) / 1000).toFixed(0);
if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL wavefront-ladder-check: ${failures.length} of ${checks} checks failed (${secs} s)`);
  process.exit(1);
}
console.log(`PASS wavefront-ladder-check: ${checks} checks (${secs} s) — Normal's play unchanged on its new lines; the levels' bolts, divers and lives as their table says; every level dealt only on seeds the human-limited flawless player takes to 200; Joe's ladder test passes on 96 deals a level`);
