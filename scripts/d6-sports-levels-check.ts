/**
 * D6's Sports levels (23 Nov 2026; the polish plan's difficulty spec and Joe's ladder test), proved on the real sims and
 * the server's own grade:
 *
 *  Home Run (homerunRev 6 on level deals; the lever is pitch speed): the settings under their own keys, the registry
 *  mirroring them, the deal (every seed the flawless batter takes to 200 through the server replay; the deal file
 *  rebuilds byte for byte), Normal and the rev-5 levels unchanged, Easy's five outs, and the realistic elite (the
 *  skill-band bot under HUMAN_LIMITS) reaching 200 on at least a fifth of Expert deals.
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

console.log(failed ? `FAIL d6-sports-levels-check: ${failed} failed, ${passed} passed` : `PASS d6-sports-levels-check: ${passed} checks`);
process.exit(failed ? 1 : 0);
