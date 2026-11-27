/**
 * D6's Sports levels (23 Nov 2026; the polish plan's difficulty spec and Joe's ladder test), proved on the real sims and
 * the server's own grade:
 *
 *  Home Run (homerunRev 6 on level deals; the lever is pitch speed): the settings under their own keys, the registry
 *  mirroring them, the deal (every seed the flawless batter takes to 200 through the server replay; the deal file
 *  rebuilds byte for byte), Normal and the rev-5 levels unchanged, Easy's five outs, and the realistic elite (the
 *  skill-band bot under HUMAN_LIMITS) reaching 200 on at least a fifth of Expert deals.
 *
 *  Apex (racingRev 5, Normal's scoring stamp; the levels' lever is road width, their settings stamped as racingLevel):
 *  Normal's new figures on rev 4's play, the levels' settings and proved deals, the levels before under d6PreLevels
 *  byte for byte, and the realistic elite reaching 200 on at least a fifth of Expert deals.
 *
 *  Top Bins (freekickRev 7 on level deals; the lever is the players in the wall, 2 / 3–5 / 5 / 7): the registry mirroring
 *  FK_LEVEL_SETTINGS_V7 and FK_V7_FULL, every level deal from its proved list (the oracle at 200 with Normal's figures),
 *  Normal on freekickRev 6 unchanged, the levels before under d6PreLevels, and the realistic elite reaching 200 on at
 *  least a fifth of Expert deals.
 *
 *   bun scripts/d6-sports-levels-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleType } from "../src/lib/duel/types";
import { GAME_LEVELS } from "../src/lib/levels/gameLevels";
import { pinPreD6Levels } from "../src/lib/duel/d6Normal";
import { homerunGameFor, HOMERUN_REV_DEALT } from "../src/lib/arcade/homerun";
import { HOMERUN_REV_5, HOMERUN_REV_6, HR_LEVEL_SETTINGS, hrPlayLevel } from "../src/lib/arcade/homerunInnings";
import { HOMERUN_DEAL_V6 } from "../src/lib/duel/homerunDealV6.server";
import { playDealt } from "./d6-ladder-lib";
import { racingGameFor, racingLevelOf, racingPaceRange, racingStdParts, RACING_REV_4, RACING_REV_5, RACING_REV_DEALT, RACING_V4_PACE, RACING_V5_CLEAN_FULL, RACING_V5_PACE, type RacingLevelSettings } from "../src/lib/arcade/racing";
import { RACING_DEAL_V4 } from "../src/lib/duel/racingDealV4.server";
import { RACING_DEAL_V5_EASY } from "../src/lib/duel/racingDealV5Easy.server";
import { RACING_DEAL_V5_HARD } from "../src/lib/duel/racingDealV5Hard.server";
import { RACING_DEAL_V5_EXPERT } from "../src/lib/duel/racingDealV5Expert.server";
import { RACING_DEAL_V4_EASY } from "../src/lib/duel/racingDealV4Easy.server";
import { pinPreRacingFive } from "../src/lib/duel/d6Normal";
import { freekickGameFor, freekickStdParts, FK_LEVEL_SETTINGS, FK_LEVEL_SETTINGS_V7, FK_V7_FULL, FREEKICK_REV_6, FREEKICK_REV_7 } from "../src/lib/arcade/freekick";
import { FREEKICK_DEAL_V7 } from "../src/lib/duel/freekickDealV7.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/catalogue";
import { MAX_ROUND_CLOCK_MS } from "../src/lib/levels/levels";

console.error = () => {};
let failed = 0;
let passed = 0;
function check(ok: boolean, label: string): void {
  if (ok) passed++;
  else {
    failed++;
    console.log(`  FAIL ${label}`);
  }
}
type L = "easy" | "hard" | "expert";
const LEVELS: L[] = ["easy", "hard", "expert"];
const dealAt = (type: PuzzleType, level: L | "normal", n: number): any => withSeededRandom(n * 7919 + 13, () => generatePuzzle(type, { bankSeed: n, level }));
const reg = GAME_LEVELS as unknown as Record<string, { levels: Record<string, { settings: Record<string, unknown> }> }>;
const pinned = <T,>(pin: (on: boolean) => boolean, fn: () => T): T => {
  const was = pin(true);
  try {
    return fn();
  } finally {
    pin(was);
  }
};

/* ---------------------------------------------------------------- Home Run */
console.log("1. Home Run homerunRev 6: pitch speed");
{
  const fast = (l: L) => HR_LEVEL_SETTINGS[`${l}6`].flight[0]!;
  check(fast("easy")[0] === 52 && fast("hard")[0] === 31 && fast("expert")[0] === 27 && HR_LEVEL_SETTINGS.normal.flight[0]![0] === 36, "homerun: fastballs 52–58 / 36–41 (Normal) / 31–34 / 27–29 ticks");
  check(HR_LEVEL_SETTINGS.easy6.outs === 5 && HR_LEVEL_SETTINGS.hard6.outs === undefined && HR_LEVEL_SETTINGS.expert6.outs === undefined, "homerun: five outs on Easy, three on Hard and Expert");
  check(HR_LEVEL_SETTINGS.hard6.perfect === 1 && HR_LEVEL_SETTINGS.expert6.perfect === 1 && HR_LEVEL_SETTINGS.easy6.perfect === 2, "homerun: PERFECT within a tick on Hard and Expert, two on Easy");
  for (const l of LEVELS) {
    const own = HR_LEVEL_SETTINGS[`${l}6`] as unknown as Record<string, unknown>;
    const mirror = reg.homerun!.levels[l]!.settings;
    check(Object.keys(mirror).length === Object.keys(own).length && Object.keys(mirror).every((k) => JSON.stringify(mirror[k]) === JSON.stringify(own[k])), `homerun ${l}: the registry mirrors HR_LEVEL_SETTINGS.${l}6`);
    check(hrPlayLevel(l, HOMERUN_REV_6) === `${l}6` && hrPlayLevel(l, HOMERUN_REV_5) === l, `homerun ${l}: rev 6 plays ${l}6, rev 5 keeps ${l}`);
    for (let n = 0; n < 6; n++) {
      const p = dealAt("homerun", l, n);
      check(p.homerunRev === HOMERUN_REV_6 && p.level === l && HOMERUN_DEAL_V6[l].includes(p.seed) && homerunGameFor(p.homerunRev, l).init(p.seed).inn?.level === `${l}6`, `homerun ${l} ${n}: homerunRev 6, a proved seed, the ${l}6 innings`);
    }
  }
  for (const n of [0, 1, 2]) {
    const p = dealAt("homerun", "normal", n);
    check(p.homerunRev === HOMERUN_REV_DEALT && !("level" in p) && homerunGameFor(p.homerunRev, null).init(p.seed).inn?.level === "normal", `homerun normal ${n}: homerunRev ${HOMERUN_REV_DEALT}, no level`);
  }
  const was = pinPreD6Levels(true);
  try {
    for (const l of LEVELS) check(dealAt("homerun", l, 0).homerunRev === HOMERUN_REV_5, `d6PreLevels: homerun ${l} deals homerunRev 5's level`);
  } finally {
    pinPreD6Levels(was);
  }
  // Easy's innings: five outs before it ends (a batter who never swings strikes out five times).
  {
    const g = homerunGameFor(HOMERUN_REV_6, "easy");
    let s = g.init(HOMERUN_DEAL_V6.easy[0]!);
    while (!g.isOver(s) && s.tick < g.runTicks) s = g.step(s, null);
    check(s.inn!.outs === 5 || s.tick >= g.runTicks, `homerun easy: the innings lasts five outs (${s.inn!.outs} outs at tick ${s.tick})`);
    const h = homerunGameFor(HOMERUN_REV_6, "hard");
    let t = h.init(HOMERUN_DEAL_V6.hard[0]!);
    while (!h.isOver(t) && t.tick < h.runTicks) t = h.step(t, null);
    check(t.inn!.outs === 3, `homerun hard: three outs (${t.inn!.outs})`);
  }
  // The deal: every seed the flawless batter takes to 200 through the server replay; the file rebuilds byte for byte.
  const r = Bun.spawnSync(["bun", "scripts/homerun-d6-deal.ts", "--check"], { stdout: "pipe", stderr: "pipe" });
  const out = r.stdout.toString().trim().split("\n").pop() ?? "";
  check(r.exitCode === 0 && out.startsWith("PASS"), `homerun: every D6 deal seed re-proved at 200 and the file rebuilds (${out})`);
  // The realistic elite reaches 200 on Expert (at least a fifth of the 96 deals the ladder measures), through the grade.
  let at200 = 0;
  for (let n = 0; n < 96; n++) if ((await playDealt("homerun", dealAt("homerun", "expert", n), "elite")).score >= 200) at200++;
  check(at200 / 96 >= 0.2, `homerun expert: the elite under HUMAN_LIMITS reaches 200 on ${at200} of 96 deals (at least a fifth)`);
}

/* ---------------------------------------------------------------- Apex */
console.log("2. Apex racingRev 5 (Normal's scoring stamp) and its levels: road width");
{
  check(RACING_REV_DEALT === RACING_REV_5 && RACING_V5_CLEAN_FULL === 4 && RACING_V5_PACE.map((p) => p.full).join(",") === "2115,2275,1890" && RACING_V5_PACE.every((p, c) => p.full - p.zero === RACING_V4_PACE[c]!.full - RACING_V4_PACE[c]!.zero), "apex: rooms deal racingRev 5, pace full at 2,115 / 2,275 / 1,890 (rev 4's spread), clean sectors full at 4");
  for (let n = 0; n < 4; n++) {
    const p = dealAt("racing", "normal", n);
    check(p.racingRev === RACING_REV_5 && !("racingLevel" in p) && !("level" in p) && RACING_DEAL_V4.includes(p.seed), `apex normal ${n}: racingRev 5 on rev 4's proved deal, no level`);
  }
  const wasR = pinPreRacingFive(true);
  try {
    check(dealAt("racing", "normal", 0).racingRev === RACING_REV_4 && dealAt("racing", "hard", 0).racingRev === RACING_REV_4, "racingPreFive: Apex deals racingRev 4 (Normal and the levels before)");
  } finally {
    pinPreRacingFive(wasR);
  }
  // Rev 5 against rev 4 on the same state: the same play, only the two figures move.
  const g4 = racingGameFor(RACING_REV_4);
  const g5 = racingGameFor(RACING_REV_5);
  const a = g4.init(RACING_DEAL_V4[0]!);
  const b = g5.init(RACING_DEAL_V4[0]!);
  check(JSON.stringify({ ...b, rev: 4 }) === JSON.stringify(a), "apex: a racingRev 5 run starts as racingRev 4's exactly");
  const pts = (st: any, clean: number) => Object.fromEntries(racingStdParts({ ...st, clean, acted: 1 })!.map((x) => [x.key, x.points]));
  check(pts(b, 4).sectors === 40 && pts(b, 3).sectors === 30 && pts(a, 4).sectors === 20 && pts(a, 8).sectors === 40, "apex: rev 5's clean sectors full at 4 (3 → 30), rev 4's at all 8 (4 → 20)");
  check(racingPaceRange(b).full === RACING_V5_PACE[0]!.full || racingPaceRange(b).full === RACING_V5_PACE[1]!.full || racingPaceRange(b).full === RACING_V5_PACE[2]!.full, "apex: rev 5's pace is scored on RACING_V5_PACE");
  // The levels: the registry's D6 settings stamped on racingRev 5 deals from their own proved deals.
  const lists: Record<L, readonly number[]> = { easy: RACING_DEAL_V5_EASY, hard: RACING_DEAL_V5_HARD, expert: RACING_DEAL_V5_EXPERT };
  const roads: Record<L, number> = { easy: 85197, hard: 55700, expert: 47200 };
  for (const l of LEVELS) {
    const set = reg.racing!.levels[l]!.settings as unknown as RacingLevelSettings;
    check(set.road === roads[l] && set.kerb === set.road + 8192 && racingLevelOf(set) !== null, `apex ${l}: road ${set.road} (${Math.round((set.road * 100) / 65536)} % of Normal's), the kerb 8,192 outside it`);
    for (let n = 0; n < 4; n++) {
      const p = dealAt("racing", l, n);
      check(p.racingRev === RACING_REV_5 && p.level === l && lists[l].includes(p.seed) && JSON.stringify(racingLevelOf(p.racingLevel)) === JSON.stringify(racingLevelOf(set)), `apex ${l} ${n}: racingRev 5, a proved seed, the registry's settings stamped`);
    }
  }
  check(JSON.stringify(reg.racing!.levels.hard!.settings) !== "" && [reg.racing!.levels.easy!.settings, reg.racing!.levels.hard!.settings, reg.racing!.levels.expert!.settings].map((x: any) => x.keep).join(",") === "80,50,35", "apex: the gravel keeps 80 / 50 / 35 % of the speed");
  const wasL = pinPreD6Levels(true);
  try {
    const p = dealAt("racing", "easy", 0);
    check(p.racingRev === RACING_REV_4 && RACING_DEAL_V4_EASY.includes(p.seed) && JSON.stringify(p.racingLevel) === JSON.stringify({ keep: 80, road: 75366, kerb: 83558, wall: 140902, tight: 0, aids: 2, pace: [1920, 2055, 1750] }), "d6PreLevels: Apex easy deals racingRev 4 with the levels' settings before D6, byte for byte");
    const x = dealAt("racing", "expert", 0);
    check(JSON.stringify(x.racingLevel) === JSON.stringify({ keep: 50, road: 65536, kerb: 73728, wall: 108134, tight: 2, tightBy: [2, 2, 0], aids: 0, pace: [2175, 2352, 1964], spread: 250 }), "d6PreLevels: Apex expert's settings before D6, byte for byte");
  } finally {
    pinPreD6Levels(wasL);
  }
  // Each level's deal: the oracle takes every seed to 200 through the server replay (the builder's --check).
  for (const l of LEVELS) {
    const r = Bun.spawnSync(["bun", "scripts/racing-deal.ts", "--rev=5", `--level=${l}`, "--check"], { stdout: "pipe", stderr: "pipe" });
    const out = r.stdout.toString().trim().split("\n").pop() ?? "";
    check(r.exitCode === 0 && out.startsWith("ok"), `apex ${l}: every deal seed re-proved at 200 (${out})`);
  }
  let at200 = 0;
  for (let n = 0; n < 96; n++) if ((await playDealt("racing", dealAt("racing", "expert", n), "elite")).score >= 200) at200++;
  check(at200 / 96 >= 0.2, `apex expert: the elite under HUMAN_LIMITS reaches 200 on ${at200} of 96 deals (at least a fifth)`);
}

/* ---------------------------------------------------------------- Top Bins */
console.log("3. Top Bins freekickRev 7's levels: the players in the wall");
{
  const walls: Record<L, readonly number[]> = { easy: [2, 2], hard: [5, 5], expert: [7, 7] };
  for (const l of LEVELS) {
    const own = { ...FK_LEVEL_SETTINGS_V7[l], targetsFull: FK_V7_FULL[l].targets, skillFull: FK_V7_FULL[l].skill } as unknown as Record<string, unknown>;
    const mirror = reg.freekick!.levels[l]!.settings;
    check(Object.keys(mirror).length === Object.keys(own).length && Object.keys(mirror).every((k) => JSON.stringify(mirror[k]) === JSON.stringify(own[k])), `topbins ${l}: the registry mirrors FK_LEVEL_SETTINGS_V7 and FK_V7_FULL`);
    check(JSON.stringify(FK_LEVEL_SETTINGS_V7[l].wall) === JSON.stringify(walls[l]), `topbins ${l}: ${walls[l][0]} in the wall`);
    for (let n = 0; n < 4; n++) {
      const p = dealAt("freekick", l, n);
      check(p.freekickRev === FREEKICK_REV_7 && p.level === l && FREEKICK_DEAL_V7[l].includes(p.seed), `topbins ${l} ${n}: freekickRev 7, a proved seed, level ${l}`);
    }
  }
  const normal = FK_LEVEL_SETTINGS.normal.wall;
  check(normal[0]! > walls.easy[1]! && normal[1]! < walls.hard[0]! + 1 && normal[1]! < walls.expert[0]!, `topbins: the wall steps 2 / ${normal.join("–")} (Normal) / 5 / 7`);
  check(FK_LEVEL_SETTINGS_V7.easy.wind === 0, "topbins easy: no wind");
  check(JSON.stringify(FK_V7_FULL.normal) === JSON.stringify({ targets: 4, skill: 10 }), "topbins normal: rev 7's figures are rev 6's (10 a target to 4, 3 a skill shot to 10)");
  for (const n of [0, 1, 2]) {
    const p = dealAt("freekick", "normal", n);
    check(p.freekickRev === FREEKICK_REV_6 && !("level" in p), `topbins normal ${n}: freekickRev 6, no level (Normal unchanged)`);
  }
  pinned(pinPreD6Levels, () => check(LEVELS.every((l) => dealAt("freekick", l, 0).freekickRev === FREEKICK_REV_6), "d6PreLevels: Top Bins' levels deal freekickRev 6's levels"));
  // The parts on rev 7: Targets and Skill shots full at the level's own figures; the four maximums total 200.
  for (const l of LEVELS) {
    const g = freekickGameFor(FREEKICK_REV_7, l);
    const s = { ...g.init(FREEKICK_DEAL_V7[l][0]!), acted: 1, units: 0, targets: FK_V7_FULL[l].targets, skill: FK_V7_FULL[l].skill, best: 0 } as any;
    const parts = Object.fromEntries((freekickStdParts(s) ?? []).map((x) => [x.key, x]));
    check(parts.targets?.points === parts.targets?.max && parts.skill?.points === parts.skill?.max && (freekickStdParts(s) ?? []).reduce((a, x) => a + x.max, 0) === 200, `topbins ${l}: Targets full at ${FK_V7_FULL[l].targets}, Skill shots at ${FK_V7_FULL[l].skill}; the parts total 200`);
  }
  check(puzzleTimeLimitMs(dealAt("freekick", "expert", 0)) <= MAX_ROUND_CLOCK_MS + 3000, "topbins expert: the dealt clock is within 120 s");
  // The deal: every seed proved at 200 with Normal's figures through the server replay; the file rebuilds byte for byte.
  const r = Bun.spawnSync(["bun", "scripts/freekick-d6-deal.ts", "--check"], { stdout: "pipe", stderr: "pipe" });
  const out = r.stdout.toString().trim().split("\n").pop() ?? "";
  check(r.exitCode === 0 && /^(PASS|ok)/i.test(out), `topbins: every D6 deal seed re-proved at 200 and the file rebuilds (${out})`);
  let at200 = 0;
  for (let n = 0; n < 96; n++) if ((await playDealt("freekick", dealAt("freekick", "expert", n), "elite")).score >= 200) at200++;
  check(at200 / 96 >= 0.2, `topbins expert: the elite under HUMAN_LIMITS reaches 200 on ${at200} of 96 deals (at least a fifth)`);
}

console.log(failed ? `FAIL d6-sports-levels-check: ${failed} failed, ${passed} passed` : `PASS d6-sports-levels-check: ${passed} checks`);
process.exit(failed ? 1 : 0);
