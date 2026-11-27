/**
 * Gemstone matchupRev 13: two-hit ice and the four levels (docs/arcade-standard/matchup.md, "matchupRev 13"; the
 * Strategy overhaul stage 3, 15 Nov 2026):
 *  1. Older stamps unchanged: every run in scripts/fixtures/gemstone-levels-legacy.json (bot runs on matchupRev 11 and
 *     12, recorded before the change by scripts/gemstone-levels-legacy.ts) replays through the server to the same score
 *     and final state; older states carry no matchupRev 13 field; the older checks are pinned to matchupRev 12's deal
 *     (pinMatchupPreIce2) while rooms deal matchupRev 13 at every level.
 *  2. Two-hit ice: Normal's deal is matchupRev 12's (board, queues, plan, rng, goals, the ten cells) with every cell
 *     whole (2); in real play each clear of the gem on an iced cell is one hit (2 → 1 cracked, 1 → 0 broken), only a
 *     break counts, and cracked ice still holds (a swap through it needs a line).
 *  3. Levels: the registry (gameLevels.ts) mirrors the sim's MATCHUP_V13_LEVELS; colours 5 / 6 / 6 / 7 (Expert's
 *     seventh is kind 9), goals one a colour and rising Easy < Normal < Hard < Expert, ice 5 / 10 / 14 / 18, the hint
 *     after 3 / 5 / 8 s and never on Expert; every level's clock is 90 s (≤ 120 s); rated play and the Daily are Normal.
 *  4. Scoring: five parts to exactly 200 at every level; Normal's parts are matchupRev 12's formula exactly; any played
 *     run scores at least 1.
 *  5. 200 is reachable at every level: the recorded witnesses (scripts/fixtures/gemstone-levels-runs.json,
 *     scripts/gemstone-levels-record.ts) replay to 200, the flawless bot at every level and the elite bot under Joe's
 *     human limits on Expert; the recorded runs replay unchanged.
 *  6. Measured on room seeds (the skill-band bots, the server's replay): a clear step Easy > Normal > Hard > Expert at
 *     the elite level (human limits) and the average level; Easy gives the average bot stars (175+).
 *  7. Art: Expert's seventh gem (the cyan heart) and cracked ice draw inside their cells, a cracked cell visibly unlike a
 *     whole one; the reveal's copy of the seventh colour matches the sim's.
 *
 *   bun scripts/gemstone-levels-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { fnv } from "./arcade-tuning-a-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { playLevel, mean, GEMSTONE_LEVELS } from "./gemstone-levels-bands";

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

const M = await import("../src/lib/arcade/matchup");
const { replayMatchupRun, decodeMatchupRun } = await import("../src/lib/duel/matchup");
const { generatePuzzle } = await import("../src/lib/duel/generate.server");
const { pinMatchupPreIce2 } = await import("../src/lib/duel/arcade.server");
// Changed with Joe's approval, 27 Nov 2026 (D6): rooms deal matchupRev 14 (Normal's parts, the colours lever); this check was written for matchupRev 13, so it deals it
// (d6-strategy-levels-check proves matchupRev 14).
(await import("../src/lib/duel/d6Normal")).pinPreMatchupD6(true);
const { GAME_LEVELS, levelsOf } = await import("../src/lib/levels/gameLevels");
const { modeLevel } = await import("../src/lib/levels/modes");
const { puzzleLevel, MAX_ROUND_CLOCK_MS } = await import("../src/lib/levels/levels");
const { puzzleTimeLimitMs } = await import("../src/lib/duel/registry");
const { drawMatchupArt } = await import("../src/lib/arcade/matchup.renderer");

const { matchupGameFor, matchupIce2Parts, matchupGoalsMet, matchupShowHint, matchupHintTicksOf, MATCHUP_REV_ICE2, MATCHUP_REV_SIX, MATCHUP_V13_LEVELS, MATCHUP_V14_LEVELS, MATCHUP_KIND7, MATCHUP_INPUT_SWAP } = M;
type MatchupState = import("../src/lib/arcade/matchup").MatchupState;

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  checks++;
  if (!cond && failures.length < 60) failures.push(label);
}
const section = (title: string) => console.log(`— ${title}`);
const started = Date.now();
const spec: any = GAME_BY_TYPE.get("matchup" as never)!;
const unzip = (b64: string) => gunzipSync(Buffer.from(b64, "base64")).toString();
const LEVEL_NAMES = GEMSTONE_LEVELS;

/* 1. Older stamps */
section("Older stamps (matchupRev 11 and 12) replay and score exactly as before");
{
  const legacy = JSON.parse(readFileSync("scripts/fixtures/gemstone-levels-legacy.json", "utf8")) as { runs: { rev: number; level: string; seed: number; score: number; stateHash: number; raw: string }[] };
  for (const r of legacy.runs) {
    const result = replayMatchupRun(r.seed, unzip(r.raw), r.rev);
    ok(!result.flagged && result.score === r.score && fnv(JSON.stringify(result.state)) === r.stateHash, `matchupRev ${r.rev} ${r.level} seed ${r.seed}: ${r.score} as before (got ${result.score}${result.flagged ? ", flagged" : ""})`);
    ok(!("ice2" in result.state) && !("lv" in result.state) && !("iceCracked" in result.state), `matchupRev ${r.rev} ${r.level}: no matchupRev 13 field`);
    // An older stamp ignores any level asked for.
    if (r.level === "elite") ok(replayMatchupRun(r.seed, unzip(r.raw), r.rev, "expert").score === r.score, `matchupRev ${r.rev}: a level never changes an older stamp`);
  }
  ok(legacy.runs.length >= 35 && legacy.runs.filter((r) => r.rev === 12).length >= 28, `${legacy.runs.length} legacy runs, most on matchupRev 12`);
  for (const rev of [undefined, 2, 5, 9, 10, 11, 12]) {
    const s = matchupGameFor(rev, "expert").init(7) as MatchupState;
    ok(!("ice2" in s) && (s.ice ?? []).every((v) => v === 0 || v === 1) && !s.cells.includes(MATCHUP_KIND7), `matchupRev ${rev ?? "none"}: init is the old one (no level, one-hit ice, six colours)`);
  }
  for (let k = 0; k < 4; k++) ok((generatePuzzle("matchup") as any).matchupRev === MATCHUP_REV_ICE2 && MATCHUP_REV_ICE2 === MATCHUP_REV_SIX + 1, "rooms deal matchupRev 13, one above matchupRev 12");
  pinMatchupPreIce2(true);
  ok((generatePuzzle("matchup") as any).matchupRev === MATCHUP_REV_SIX, "pinMatchupPreIce2 deals matchupRev 12 for the checks written for it");
  pinMatchupPreIce2(false);
  ok((generatePuzzle("matchup") as any).matchupRev === MATCHUP_REV_ICE2, "unpinned, rooms deal matchupRev 13 again");
}

/* 2. Two-hit ice */
section("Two-hit ice: Normal is matchupRev 12's deal with whole ice; each clear is a hit, only a break counts");
{
  const six = matchupGameFor(MATCHUP_REV_SIX);
  const normal = matchupGameFor(MATCHUP_REV_ICE2);
  let same = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const a = six.init(seed) as MatchupState;
    const b = normal.init(seed) as MatchupState;
    const eq = JSON.stringify(a.cells) === JSON.stringify(b.cells) && a.rng === b.rng && JSON.stringify(a.queues) === JSON.stringify(b.queues) && JSON.stringify(a.plan) === JSON.stringify(b.plan) && JSON.stringify(a.goalNeed) === JSON.stringify(b.goalNeed) && JSON.stringify((a.ice ?? []).map((v) => v * 2)) === JSON.stringify(b.ice);
    if (eq) same++;
    if (seed <= 3) ok(b.ice2 === 1 && b.lv === 1 && b.colours === 6 && b.hintTicks === 300 && (b.iceCracked ?? 0) === 0, `seed ${seed}: a Normal matchupRev 13 state`);
  }
  ok(same === 300, `Normal's board, queues, plan, rng, goals and ten ice cells are matchupRev 12's (${same} of 300 seeds)`);

  // Real play: every ice change follows the hit rule exactly.
  let cracks = 0;
  let breaks = 0;
  let double = 0;
  let violations = 0;
  let throughCracked = 0;
  let refusedCracked = 0;
  for (const level of LEVEL_NAMES)
    for (let n = 0; n < 3; n++) {
      const seed = spec.seedFor(200 + n);
      const run = playLevel(level, "elite", seed, true);
      const game = matchupGameFor(MATCHUP_REV_ICE2, level);
      const decoded = decodeMatchupRun(run.raw).events;
      const byTick = new Map(decoded.map((e: any) => [e.t, e]));
      let s = game.init(seed) as MatchupState;
      while (!game.isOver(s)) {
        const ev = byTick.get(s.tick + 1) ?? null;
        const prev = s;
        s = game.step(s, ev) as MatchupState;
        if (s.swaps > prev.swaps) {
          const hits = new Map<number, number>();
          for (const step of s.lastAnimation) for (const i of step.cleared) hits.set(i, (hits.get(i) ?? 0) + 1);
          let wantBroken = 0;
          let wantCracked = 0;
          for (let i = 0; i < (prev.ice ?? []).length; i++) {
            const was = prev.ice![i]!;
            const h = hits.get(i) ?? 0;
            const want = Math.max(0, was - h);
            if (s.ice![i] !== want) violations++;
            if (was && h) {
              // A hit that cracks (2 → 1) counts as a crack even when a second hit in the same cascade breaks the cell.
              if (want === 0) wantBroken++;
              if (was === 2) wantCracked += 1;
              if (was === 2 && want === 1) cracks++;
              if (was === 1 && want === 0) breaks++;
              if (was === 2 && want === 0) double++;
            }
            if (was === 1 && ev && [M.matchupIndex(ev.a, ev.b), M.matchupIndex(ev.c, ev.d)].includes(i)) throughCracked++;
          }
          if ((s.iceBroken ?? 0) - (prev.iceBroken ?? 0) !== wantBroken || (s.iceCracked ?? 0) - (prev.iceCracked ?? 0) !== wantCracked) violations++;
        } else if (ev && ev.k === MATCHUP_INPUT_SWAP && prev.tick + 1 >= (prev.busyUntil ?? 0)) {
          if ([M.matchupIndex(ev.a, ev.b), M.matchupIndex(ev.c, ev.d)].some((i) => prev.ice?.[i] === 1)) refusedCracked++;
        }
      }
    }
  ok(violations === 0, `every ice change in 12 elite runs follows the hit rule (${violations} violations)`);
  ok(cracks > 20 && breaks > 20, `first hits crack (${cracks}) and second hits break (${breaks}) in real play`);
  ok(double >= 1, `a cell cleared twice in one cascade breaks in one swap (${double} times)`);
  ok(throughCracked + refusedCracked >= 1, `cracked ice is still ice: swaps into it are judged as ice swaps (${throughCracked} made a line, ${refusedCracked} refused)`);
  // A swap into cracked ice that makes no line is refused, exactly as whole ice.
  {
    const s0 = matchupGameFor(MATCHUP_REV_ICE2).init(11) as MatchupState;
    const iced = (s0.ice ?? []).findIndex((v) => v === 2);
    const cracked = { ...s0, ice: s0.ice!.map((v, i) => (i === iced ? 1 : v)) } as MatchupState;
    const row = Math.floor(iced / M.MATCHUP_SIZE);
    const col = iced % M.MATCHUP_SIZE;
    const other = col + 1 < M.MATCHUP_SIZE ? [row, col + 1] : [row, col - 1];
    const ev = { t: 1, k: MATCHUP_INPUT_SWAP, a: row, b: col, c: other[0]!, d: other[1]! };
    const g = matchupGameFor(MATCHUP_REV_ICE2);
    const whole = g.step(s0, ev) as MatchupState;
    const crack = g.step(cracked, ev) as MatchupState;
    ok((whole.swaps > s0.swaps) === (crack.swaps > cracked.swaps), "a swap into cracked ice is judged exactly as one into whole ice");
  }
}

/* 3. Levels */
section("Levels: settings, colours, goals, ice, hints, clocks, rated and the Daily");
{
  const entry = GAME_LEVELS.matchup!;
  ok(levelsOf("matchup").join(",") === "easy,normal,hard,expert", `Gemstone offers all four levels (${levelsOf("matchup").join(",")})`);
  for (const level of ["easy", "hard", "expert"] as const) {
    const reg = entry.levels[level]!.settings as { colours: number; goals: number[]; ice: number; hintS: number };
    // Changed with Joe's approval, 27 Nov 2026 (D6): gameLevels.ts mirrors matchupRev 14's level table.
    const sim = MATCHUP_V14_LEVELS[level];
    ok(reg.colours === sim.colours && JSON.stringify(reg.goals) === JSON.stringify(sim.ladder) && reg.ice === sim.ice && reg.hintS === sim.hintS, `${level}: gameLevels.ts mirrors the sim's settings`);
  }
  const want = { easy: [5, 5, 5, 3], normal: [6, 6, 10, 5], hard: [6, 6, 14, 8], expert: [7, 7, 18, 0] } as const;
  for (const level of LEVEL_NAMES) {
    const r = MATCHUP_V13_LEVELS[level];
    ok([r.colours, r.ladder.length, r.ice, r.hintS].join() === want[level].join(), `${level}: ${r.colours} colours, ${r.ladder.length} goals, ${r.ice} ice, hint ${r.hintS} s (Joe's settings)`);
    const game = matchupGameFor(MATCHUP_REV_ICE2, level);
    ok(game.runTicks === 5400 && 90_000 <= MAX_ROUND_CLOCK_MS, `${level}: a 90 s run (≤ 120 s)`);
    const kinds = new Set<number>();
    let iceOk = 0;
    let goalsOk = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = game.init(seed) as MatchupState;
      for (const k of s.cells) kinds.add(k);
      for (const q of s.queues) for (const k of q) kinds.add(k);
      if ((s.ice ?? []).filter((v) => v === 2).length === r.ice && (s.ice ?? []).every((v) => v === 0 || v === 2)) iceOk++;
      if ([...(s.goalNeed ?? [])].sort((a, b) => a - b).join() === [...r.ladder].join() && (s.goalLeft ?? []).length === r.colours) goalsOk++;
      if (seed <= 3) ok(JSON.stringify(game.init(seed)) === JSON.stringify(s), `${level} seed ${seed}: the same init every time`);
      if (seed <= 3) ok(!M.matchupHasLine(s.cells), `${level} seed ${seed}: no line at the start`);
    }
    const plain = [...kinds].filter((k) => k !== M.MATCHUP_TREASURE).sort((a, b) => a - b);
    const expect = Array.from({ length: r.colours }, (_, c) => M.matchupKindOfColour(c)).sort((a, b) => a - b);
    ok(plain.join() === expect.join(), `${level}: the board and queues hold exactly ${r.colours} colours (${plain.join()})`);
    ok(iceOk === 60, `${level}: ${r.ice} whole ice cells on every seed (${iceOk} of 60)`);
    ok(goalsOk === 60, `${level}: one goal a colour, the ladder in a seeded order (${goalsOk} of 60)`);
    ok(matchupHintTicksOf(game.init(5) as MatchupState) === r.hintS * 60, `${level}: the hint waits ${r.hintS} s`);
    // The deal at the level.
    const dealt = generatePuzzle("matchup", level === "normal" ? {} : { level }) as any;
    ok(dealt.matchupRev === MATCHUP_REV_ICE2 && puzzleLevel(dealt) === level && (level === "normal") === !("level" in dealt), `${level}: the deal stamps matchupRev 13${level === "normal" ? " and no level" : ` and level ${level}`}`);
    ok(puzzleTimeLimitMs(dealt) <= MAX_ROUND_CLOCK_MS + 3000, `${level}: the dealt clock is within 120 s`);
  }
  // Goals rise level by level: every position of the sorted ladder (and the largest) Easy < Normal < Hard ≤ Expert's.
  const L = LEVEL_NAMES.map((l) => [...MATCHUP_V13_LEVELS[l].ladder].sort((a, b) => a - b));
  for (let i = 0; i < 5; i++) ok(L[0]![i]! < L[1]![i]! && L[1]![i]! < L[2]![i]! && L[2]![i]! <= L[3]![i]!, `goal ${i + 1}: Easy ${L[0]![i]} < Normal ${L[1]![i]} < Hard ${L[2]![i]} ≤ Expert ${L[3]![i]}`);
  ok(Math.max(...L[3]!) >= Math.max(...L[2]!) - 2 && L[3]!.reduce((a, b) => a + b, 0) > L[2]!.reduce((a, b) => a + b, 0), "Expert's goals are the most gems in all");
  ok(JSON.stringify(MATCHUP_V13_LEVELS.normal.ladder) === JSON.stringify(M.MATCHUP_V12_GOAL_LADDER), "Normal's goals are matchupRev 12's ladder");
  // Expert: no hint ever.
  {
    const g = matchupGameFor(MATCHUP_REV_ICE2, "expert");
    let s = g.init(9) as MatchupState;
    let shown = false;
    while (!g.isOver(s)) {
      s = g.step(s, null) as MatchupState;
      if (matchupShowHint(s)) shown = true;
    }
    ok(!shown, "Expert never shows the hint, even after 90 s idle");
    const n = matchupGameFor(MATCHUP_REV_ICE2, "easy");
    let e = n.init(9) as MatchupState;
    for (let t = 0; t < 179; t++) e = n.step(e, null) as MatchupState;
    const before = matchupShowHint(e);
    e = n.step(e, null) as MatchupState;
    ok(!before && matchupShowHint(e), "Easy shows the hint after exactly 3 s idle");
  }
  ok(modeLevel("rated", "expert") === "normal" && modeLevel("daily", "easy") === "normal" && modeLevel("practice", "expert") === "expert", "rated play and the Daily are always Normal; practice keeps the level");
}

/* 4. Scoring */
section("Scoring: five parts to 200 at every level; Normal's are matchupRev 12's");
{
  const maxes = { core: 108, treasure: 36, goals: 36, ice: 10, big: 10 };
  ok(Object.values(maxes).reduce((a, b) => a + b, 0) === 200, "the parts' maxima total 200");
  let rnd = 12345;
  const r = (n: number) => ((rnd = (Math.imul(rnd, 1103515245) + 12345) >>> 0) % n);
  for (const level of LEVEL_NAMES) {
    const base = matchupGameFor(MATCHUP_REV_ICE2, level).init(3) as MatchupState;
    const full = MATCHUP_V13_LEVELS[level].full;
    let capped = 0;
    let normalSame = 0;
    for (let k = 0; k < 400; k++) {
      const s = { ...base, gemsCleared: r(700), treasures: r(7), iceBroken: r(19), bigLines: r(9), goalLeft: (base.goalLeft ?? []).map(() => (r(2) ? 0 : 5)), acted: 1 } as MatchupState;
      const p = matchupIce2Parts(s);
      if (p.core <= 108 && p.treasure <= 36 && p.goals <= 36 && p.ice <= 10 && p.big <= 10) capped++;
      if (level === "normal") {
        const v12 = { ...s, ice2: undefined, lv: undefined } as MatchupState;
        const q = M.matchupSixParts(v12);
        if (JSON.stringify(p) === JSON.stringify(q)) normalSame++;
      }
    }
    ok(capped === 400, `${level}: every part within its maximum`);
    if (level === "normal") ok(normalSame === 400, `Normal's parts equal matchupRev 12's formula on 400 states (${normalSame})`);
    const top = { ...base, gemsCleared: full.gems, treasures: full.treasure, iceBroken: full.ice, bigLines: full.big, goalLeft: (base.goalLeft ?? []).map((_, i) => (i < full.goals ? 0 : 3)), acted: 1 } as MatchupState;
    ok(matchupGoalsMet(top) === full.goals && M.matchupStdScore(top) === 200, `${level}: every part full at its figures scores exactly 200`);
    ok(M.matchupStdScore({ ...base, acted: 1 } as MatchupState) === 1 && M.matchupStdScore(base) === 0, `${level}: a played run scores at least 1, none 0`);
  }
  // Each level's figures sit where its own players can reach them (none above the ladder, the cells or the treasures).
  for (const level of LEVEL_NAMES) {
    const r2 = MATCHUP_V13_LEVELS[level];
    ok(r2.full.goals <= r2.colours && r2.full.ice <= r2.ice && r2.full.treasure <= M.MATCHUP_V12_TREASURES, `${level}: full at ${r2.full.goals} goals, ${r2.full.ice} ice, ${r2.full.treasure} treasure (all within the deal)`);
  }
}

/* 5. 200 at every level */
section("200 is reachable at every level (recorded witnesses through the server replay)");
{
  const fx = JSON.parse(readFileSync("scripts/fixtures/gemstone-levels-runs.json", "utf8")) as { witness: any[]; runs: any[] };
  for (const level of LEVEL_NAMES) {
    const ws = fx.witness.filter((w) => w.level === level);
    ok(ws.some((w) => w.skill === "perfect"), `${level}: a flawless witness recorded`);
    if (level === "expert") ok(ws.filter((w) => w.skill === "elite-limits").length >= 1, "Expert: the elite bot under human limits reaches 200");
    for (const w of ws) {
      const res = replayMatchupRun(w.seed, unzip(w.raw), MATCHUP_REV_ICE2, level);
      ok(!res.flagged && res.score === 200 && fnv(JSON.stringify(res.state)) === w.stateHash, `${level} ${w.skill} seed ${w.seed}: 200 through the server replay (got ${res.score})`);
      const other = level === "normal" ? "expert" : "normal";
      // The other level's replay desyncs (as it should) and says so on the console: kept quiet here.
      const error = console.error;
      console.error = () => {};
      const elsewhere = replayMatchupRun(w.seed, unzip(w.raw), MATCHUP_REV_ICE2, other);
      console.error = error;
      ok(elsewhere.flagged && fnv(JSON.stringify(elsewhere.state)) !== w.stateHash, `${level} ${w.skill}: the replay reads the level (the same log at ${other} plays another world)`);
    }
  }
  for (const r of fx.runs) {
    const res = replayMatchupRun(r.seed, unzip(r.raw), MATCHUP_REV_ICE2, r.level);
    ok(!res.flagged && res.score === r.score && fnv(JSON.stringify(res.state)) === r.stateHash, `${r.level} ${r.skill} seed ${r.seed}: replays to ${r.score} (got ${res.score})`);
  }
  ok(fx.runs.length >= 24, `${fx.runs.length} recorded matchupRev 13 runs`);
}

/* 6. Measured bands */
section("Measured: a clear step Easy > Normal > Hard > Expert; Easy gives an average player stars");
{
  const seeds = Array.from({ length: 16 }, (_, i) => spec.seedFor(300 + i));
  const avgOf = (level: (typeof LEVEL_NAMES)[number], skill: "elite" | "average") => seeds.map((s) => playLevel(level, skill, s, true).score);
  const elite = LEVEL_NAMES.map((l) => avgOf(l, "elite"));
  const average = LEVEL_NAMES.map((l) => avgOf(l, "average"));
  const e = elite.map(mean);
  const a = average.map(mean);
  console.log(`  elite (human limits): ${LEVEL_NAMES.map((l, i) => `${l} ${e[i]!.toFixed(1)}`).join(", ")}`);
  console.log(`  average: ${LEVEL_NAMES.map((l, i) => `${l} ${a[i]!.toFixed(1)}`).join(", ")}`);
  for (let i = 0; i + 1 < 4; i++) {
    ok(e[i]! > e[i + 1]! + 4, `elite: ${LEVEL_NAMES[i]} ${e[i]!.toFixed(1)} clearly above ${LEVEL_NAMES[i + 1]} ${e[i + 1]!.toFixed(1)}`);
    ok(a[i]! > a[i + 1]! + 4, `average: ${LEVEL_NAMES[i]} ${a[i]!.toFixed(1)} clearly above ${LEVEL_NAMES[i + 1]} ${a[i + 1]!.toFixed(1)}`);
  }
  ok(e[1]! >= 145, `Normal is comfortable for a strong player (elite ${e[1]!.toFixed(1)})`);
  ok(e[3]! >= 120 && Math.max(...elite[3]!) >= 170, `Expert: a strong player scores well (elite average ${e[3]!.toFixed(1)}, best ${Math.max(...elite[3]!)})`);
  const stars = average[0]!.filter((s) => s >= 175).length;
  ok(stars >= 2, `Easy: the average bot earns a star on ${stars} of ${seeds.length} seeds`);
}

/* 7. Art */
section("Art: the seventh gem and cracked ice draw inside their cells");
{
  const W = 390;
  const H = 720;
  const size = { width: W, height: H, dpr: 1 } as any;
  const base = matchupGameFor(MATCHUP_REV_ICE2, "expert").init(21) as MatchupState;
  const frame = (s: MatchupState) => {
    const c = createCanvas(W, H);
    const ctx = c.getContext("2d") as any;
    drawMatchupArt(ctx, s, size);
    return ctx.getImageData(0, 0, W, H).data as Uint8ClampedArray;
  };
  const iced = (base.ice ?? []).findIndex((v) => v === 2);
  const a = frame(base);
  const b = frame({ ...base, ice: base.ice!.map((v, i) => (i === iced ? 1 : v)) } as MatchupState);
  let diff = 0;
  for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!) > 40) diff++;
  ok(diff > 30, `a cracked cell draws visibly unlike a whole one (${diff} pixels differ)`);
  ok(base.cells.includes(MATCHUP_KIND7) && M.matchupGemShape(MATCHUP_KIND7) === "heart" && M.matchupGemColour(MATCHUP_KIND7) === M.MATCHUP_COLOUR7 && !(M.MATCHUP_SHAPES as readonly string[]).includes("heart"), "Expert's seventh gem is the cyan heart, a shape no other gem has");
  const summary = readFileSync("src/components/duel/StrategyRunSummary.tsx", "utf8");
  ok(summary.includes(`SUMMARY_COLOUR7 = "${M.MATCHUP_COLOUR7}"`), "the reveal's seventh colour matches the sim's");
}

if (failures.length) {
  console.log(`FAIL gemstone-levels-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`PASS gemstone-levels-check: ${checks} checks in ${((Date.now() - started) / 1000).toFixed(1)} s — older stamps unchanged, two-hit ice, four levels, 200 at every level, a clear step per level`);
