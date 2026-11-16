/**
 * homerun-innings-check (15 Nov 2026, the Home Run and Top Bins overhaul; docs/arcade-standard/homerun.md
 * "homerunRev 5"): Home Run's innings.
 *
 *  1. the deal: homerunDealV5.server.ts rebuilds byte for byte, every Normal seed (at quick depth 24, full every level's)
 *     the flawless batter's 200 through the server replay;
 *  2. the count: four balls a walk, three strikes an out (swinging or looking), a foul never the third strike, the third
 *     out ends the innings, no pitch in the clock's last 2 s;
 *  3. the runners: hr5Advance on every base state and hit (the runner on second scoring on a single), and the display's
 *     moves agreeing with the sim's bases and runs;
 *  4. contact: the windows by level and swing, a chased ball weaker than the same swing in the zone, early pulls and
 *     late pushes, a power swing carrying further than contact at the same timing;
 *  5. the plan: a fixed count of balls a level, each pitch's zone flag true to where it crosses, the same plan for the
 *     same seed, Easy straighter and slower than Expert;
 *  6. the replay: the server's score is the sim's for bot runs at every skill, no input scores 0, a played run at
 *     least 1, and the score never needs the client's claim;
 *  7. the bands: on Normal, weak < average < good < great < near-perfect ≤ elite ≤ 200 (medians), Expert harder than
 *     Easy at every skill from good up.
 */
import { gameLevelSettings, levelsOf } from "../src/lib/levels/gameLevels";
import { puzzleLevel } from "../src/lib/levels/levels";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { readFileSync } from "node:fs";
import { homerunGameFor, homerunScore, HOMERUN_INPUT_RANGES_V5, HOMERUN_REV_5 } from "../src/lib/arcade/homerun";
import {
  homerunInningsPlan,
  hr5Advance,
  hr5BasesBefore,
  hr5Contact,
  hr5EyeCount,
  hr5Moves,
  HR_LEVELS,
  HR_LEVEL_SETTINGS,
  HR5_BALL,
  HR5_INPUT_MODE,
  HR5_INPUT_SWING,
  HR5_MODE_CONTACT,
  HR5_MODE_POWER,
  HR5_PLAN_PITCHES,
  HR5_BALL_WINDOW,
  HR5_RUN_TICKS,
  HR5_STRIKE_CALLED,
  HR5_FOUL,
  HR5_WHIFF,
  type HrLevel,
} from "../src/lib/arcade/homerunInnings";
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { HOMERUN_DEAL_V5 } from "../src/lib/duel/homerunDealV5.server";
import { oracleRunV5, playLogV5 } from "./homerun-oracle";
import { storedScoreV5 } from "./homerun-innings-deal";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { botV5, randomBotV5 } from "./arcade-skill-bands/bots/homerun";

const FULL = process.env["CHECKS_FULL"] === "1";
let failures = 0;
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) {
    failures++;
    console.log(`  ✗ ${label}`);
  }
};

/* 1. The deal. */
{
  const spawn = Bun.spawnSync(["bun", "scripts/homerun-innings-deal.ts", "--check"], { stdout: "pipe", stderr: "pipe" });
  ok(spawn.exitCode === 0, `homerunDealV5.server.ts rebuilds byte for byte (${spawn.stdout.toString().trim()})`);
  for (const level of HR_LEVELS) {
    const list = HOMERUN_DEAL_V5[level];
    ok(list.length === 120 && new Set(list).size === 120, `${level}: 120 distinct proved seeds`);
    const pick = FULL ? list : level === "normal" ? list.filter((_, i) => i % 5 === 0) : list.slice(0, 3);
    for (const seed of pick) ok(storedScoreV5(seed, oracleRunV5(seed, level), level) === 200, `${level} seed ${seed}: the flawless batter's 200 through the server replay`);
  }
  ok(readFileSync("src/lib/duel/sports.server.ts", "utf8").includes("homerunDealSeedV5(arcadeSeed(), l)"), "rooms deal from the level's proved deal");
}

/** Plays a scripted run: `act(tick, inn)` returns the event for that tick (or null). */
function script(seed: number, level: HrLevel, act: (t: number, inn: NonNullable<ReturnType<ReturnType<typeof homerunGameFor>["init"]>["inn"]>) => ArcadeInputEvent | null) {
  const game = homerunGameFor(HOMERUN_REV_5, level);
  const events: ArcadeInputEvent[] = [];
  let s = game.init(seed);
  while (!game.isOver(s)) {
    const e = act(s.tick + 1, s.inn!);
    if (e) recordInput(events, e, HOMERUN_INPUT_RANGES_V5);
    s = game.step(s, e);
  }
  return { s, events };
}

/* 2. The count. */
{
  const seed = HOMERUN_DEAL_V5.normal[3]!;
  const plan = homerunInningsPlan(seed, "normal");
  // Never swing: every ball is a ball, every strike a called strike; outs come three strikes at a time.
  const { s } = script(seed, "normal", () => null);
  const inn = s.inn!;
  ok(inn.outs === 3 && inn.endAt > 0, "never swinging: three outs end the innings");
  let balls = 0;
  let strikes = 0;
  let outs = 0;
  let walks = 0;
  for (const h of inn.hits) {
    ok(h.out === (plan.pitches[h.i]!.zone ? HR5_STRIKE_CALLED : HR5_BALL), `pitch ${h.i}: taken is a strike in the zone, a ball outside`);
    if (h.out === HR5_BALL) balls++;
    else strikes++;
    if (balls === 4) {
      walks++;
      balls = 0;
      strikes = 0;
    }
    if (strikes === 3) {
      outs++;
      balls = 0;
      strikes = 0;
    }
  }
  ok(outs === 3, "three strikes are an out each time");
  ok(inn.runs === Math.max(0, walks - 3), `walks force runs home only with the bases full (${walks} walks, ${inn.runs} runs)`);
  // Swing at nothing but foul balls (aim far foul): strikes stop at two, the innings runs to the clock's last 2 s.
  const fouls = script(seed, "normal", (t, i) => {
    const p = plan.pitches[i.i];
    return p && i.st < 0 && t === i.release + p.flight - 6 ? { t, k: HR5_INPUT_SWING, a: 900, b: 0, c: 0, d: 0 } : null;
  }).s.inn!;
  ok(fouls.hits.every((h) => h.out === HR5_FOUL || h.out === HR5_BALL || h.out === HR5_STRIKE_CALLED), "aimed far foul, every swing is a foul");
  ok(fouls.outs === 0 && fouls.strikes <= 2, "a foul is never the third strike");
  ok(fouls.endAt >= HR5_RUN_TICKS - 120 && fouls.endAt < HR5_RUN_TICKS, "the innings ends at the clock's last 2 s with no pitch thrown in them");
  // Swinging and missing (far too early).
  const whiffs = script(seed, "normal", (t, i) => {
    const p = plan.pitches[i.i];
    return p && i.st < 0 && t === i.release - 10 ? { t, k: HR5_INPUT_SWING, a: 0, b: 0, c: 0, d: 0 } : null;
  }).s.inn!;
  ok(whiffs.hits.slice(0, 9).every((h) => h.out === HR5_WHIFF) && whiffs.outs === 3 && whiffs.hits.length === 9, "nine swings and misses: three strikeouts end the innings");
}

/* 3. The runners. */
{
  const name = (b: number) => ["1st", "2nd", "3rd"].filter((_, i) => b & (1 << i)).join("+") || "empty";
  const want: Record<string, [number, number][]> = {
    // bases → for a single, double, triple, home run: [runs, bases after]
    "0": [[0, 1], [0, 2], [0, 4], [1, 0]],
    "1": [[0, 3], [0, 6], [1, 4], [2, 0]],
    "2": [[1, 1], [1, 2], [1, 4], [2, 0]],
    "4": [[1, 1], [1, 2], [1, 4], [2, 0]],
    "3": [[1, 3], [1, 6], [2, 4], [3, 0]],
    "7": [[2, 3], [2, 6], [3, 4], [4, 0]],
  };
  for (const [b, rows] of Object.entries(want))
    rows.forEach(([runs, after], n) => {
      const r = hr5Advance(Number(b), n + 1);
      ok(r.runs === runs && r.bases === after, `bases ${name(Number(b))}, a ${["single", "double", "triple", "home run"][n]}: ${runs} run(s), then ${name(after)} (got ${r.runs}, ${name(r.bases)})`);
    });
  // The display's moves agree with the sim's bases on every hit of a few bot runs.
  for (const skill of ["good", "elite"] as const) {
    const seed = HOMERUN_DEAL_V5.normal[7]!;
    const game = homerunGameFor(HOMERUN_REV_5, "normal");
    const s = playLogV5(seed, botV5({ game, seed, rev: 5, human: new Human("homerun", seed, skill) }).events, "normal");
    const inn = s.inn!;
    inn.hits.forEach((h, n) => {
      if (h.out < 6 || h.bases === 0) return;
      const moves = hr5Moves(hr5BasesBefore(inn, n), h);
      let bases = 0;
      for (const m of moves) if (!m.out && m.to < 4 && m.to > 0) bases |= 1 << (m.to - 1);
      ok(bases === h.bases, `${skill}: pitch ${n}'s runners end where the sim put them (${name(bases)} vs ${name(h.bases)})`);
      ok(moves.filter((m) => m.to >= 4 && !m.out).length === h.runs, `${skill}: pitch ${n}'s runners home = its runs`);
    });
  }
}

/* 4. Contact. */
{
  const seed = HOMERUN_DEAL_V5.normal[0]!;
  for (const level of HR_LEVELS) {
    const plan = homerunInningsPlan(seed, level);
    const L = HR_LEVEL_SETTINGS[level];
    const i = plan.pitches.findIndex((p) => p.zone);
    const arrive = 100 + plan.pitches[i]!.flight;
    const at = (dt: number, mode: number, aim = 0) => hr5Contact(plan, level, i, 100, arrive - 6 + dt, aim, mode);
    ok(at(L.winContact, HR5_MODE_CONTACT).out !== HR5_WHIFF && at(L.winContact + 1, HR5_MODE_CONTACT).out === HR5_WHIFF, `${level}: Contact's window is ±${L.winContact} ticks`);
    ok(at(-L.winPower, HR5_MODE_POWER).out !== HR5_WHIFF && at(-L.winPower - 1, HR5_MODE_POWER).out === HR5_WHIFF, `${level}: Power's window is ±${L.winPower} ticks`);
    ok(at(0, HR5_MODE_POWER).feet > at(0, HR5_MODE_CONTACT).feet, `${level}: Power carries further than Contact at the same timing`);
    ok(at(L.perfect, HR5_MODE_POWER).perfect && !at(L.perfect + 1, HR5_MODE_POWER).perfect, `${level}: PERFECT within ±${L.perfect} ticks`);
    const early = at(-(L.perfect + 2), HR5_MODE_CONTACT);
    const late = at(L.perfect + 2, HR5_MODE_CONTACT);
    ok(early.spray > 0 && late.spray < 0, `${level}: early pulls (+), late pushes (−)`);
    const j = plan.pitches.findIndex((p) => !p.zone);
    const chase = hr5Contact(plan, level, j, 100, 100 + plan.pitches[j]!.flight - 6, 0, HR5_MODE_POWER);
    ok(chase.q < 1000 && !chase.perfect, `${level}: a ball outside the zone hit perfectly is still weak contact, never PERFECT`);
  }
}

/* 5. The plan. */
{
  for (const level of HR_LEVELS) {
    const L = HR_LEVEL_SETTINGS[level];
    for (const seed of HOMERUN_DEAL_V5[level].slice(0, 10)) {
      const plan = homerunInningsPlan(seed, level);
      ok(plan.pitches.length === HR5_PLAN_PITCHES && plan.fielders.length === HR5_PLAN_PITCHES && plan.fielders.every((f) => f.length === 7), `${level} ${seed}: 40 pitches, seven fielders each`);
      ok(plan.pitches.slice(0, HR5_BALL_WINDOW).filter((p) => !p.zone).length === L.balls, `${level} ${seed}: exactly ${L.balls} balls in the first ${HR5_BALL_WINDOW}`);
      ok(plan.pitches.every((p) => p.zone === (p.plateX >= 212 && p.plateX <= 304 && p.plateY >= 446 && p.plateY <= 566)), `${level} ${seed}: every zone flag is where the pitch crosses`);
      ok(JSON.stringify(homerunInningsPlan(seed, level)) === JSON.stringify(plan), `${level} ${seed}: the same plan again`);
    }
  }
  const avg = (l: HrLevel, f: (p: ReturnType<typeof homerunInningsPlan>["pitches"][number]) => number) => {
    let t = 0;
    let n = 0;
    for (const seed of HOMERUN_DEAL_V5[l].slice(0, 20)) for (const p of homerunInningsPlan(seed, l).pitches) (t += f(p), n++);
    return t / n;
  };
  ok(avg("easy", (p) => p.flight) > avg("normal", (p) => p.flight) && avg("normal", (p) => p.flight) > avg("hard", (p) => p.flight) && avg("hard", (p) => p.flight) > avg("expert", (p) => p.flight), "pitches are quicker level by level");
  ok(avg("easy", (p) => Math.abs(p.breakX)) < avg("expert", (p) => Math.abs(p.breakX)), "Expert's curveballs bend more than Easy's");
}

/* 6. The replay. */
{
  const seed = HOMERUN_DEAL_V5.normal[11]!;
  const game = homerunGameFor(HOMERUN_REV_5, "normal");
  ok(storedScoreV5(seed, [], "normal") === 0, "no input at all scores 0");
  const moded: ArcadeInputEvent[] = [];
  recordInput(moded, { t: 3, k: HR5_INPUT_MODE, a: 1, b: 0, c: 0, d: 0 }, HOMERUN_INPUT_RANGES_V5);
  ok(storedScoreV5(seed, moded, "normal") >= 1, "a played run scores at least 1");
  for (const skill of ["weak", "average", "great", "elite"] as SkillLevel[]) {
    const { events } = botV5({ game, seed, rev: 5, human: new Human("homerun", seed, skill) });
    ok(storedScoreV5(seed, events, "normal") === homerunScore(playLogV5(seed, events, "normal")), `${skill}: the server's replay scores what the sim scored`);
  }
  const random = randomBotV5({ game, seed, rev: 5, human: new Human("homerun", seed, "average") }).events;
  ok(storedScoreV5(seed, random, "normal") < 60, "random swiping scores little");
  ok(hr5EyeCount({ eye: 3, chased: 5 }) === 0 && hr5EyeCount({ eye: 6, chased: 2 }) === 4, "good eye: balls left alone less balls chased, never below 0");
}

/* 7. The bands. */
{
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const band = (level: HrLevel, skill: SkillLevel, n = FULL ? 30 : 12) => {
    const game = homerunGameFor(HOMERUN_REV_5, level);
    return med(
      HOMERUN_DEAL_V5[level].slice(0, n).map((seed) => storedScoreV5(seed, botV5({ game, seed, rev: 5, human: new Human("homerun", seed, skill) }).events, level)),
    );
  };
  const order: SkillLevel[] = ["weak", "average", "good", "great", "near"];
  const normal = order.map((k) => band("normal", k));
  ok(normal.every((v, i) => i === 0 || v > normal[i - 1]!), `Normal rises with skill: ${normal.join(" < ")}`);
  ok(normal[4]! >= 185 && normal[3]! >= 150 && normal[3]! <= 185 && normal[2]! >= 110 && normal[2]! <= 150, `Normal sits near its targets (near-perfect ${normal[4]}, great ${normal[3]}, good ${normal[2]})`);
  for (const skill of ["good", "great", "near"] as SkillLevel[]) ok(band("expert", skill) < band("easy", skill), `${skill}: Expert is harder than Easy`);
}

/* The difficulty framework's registry (stage 3, 15 Nov 2026): Home Run offers all four levels, and the registry's
   settings are exactly the sim's own (HR_LEVEL_SETTINGS), so the level selector and the sim never disagree. */
{
  ok(JSON.stringify(levelsOf("homerun")) === JSON.stringify(["easy", "normal", "hard", "expert"]), `homerun offers every level (${levelsOf("homerun").join(", ")})`);
  for (const level of ["easy", "hard", "expert"] as const) {
    const mirror = gameLevelSettings<Record<string, unknown>>("homerun", level)!;
    const own = HR_LEVEL_SETTINGS[level] as unknown as Record<string, unknown>;
    for (const key of Object.keys(mirror)) ok(JSON.stringify(mirror[key]) === JSON.stringify(own[key]), `homerun ${level}: the registry's ${key} matches the sim's`);
  }
  ok(gameLevelSettings("homerun", "normal") === null, "homerun Normal has no registry settings (today's game)");
  const dealt = generatePuzzle("homerun", { bankSeed: 7, level: "hard" });
  ok(puzzleLevel(dealt) === "hard" && (dealt as { homerunRev?: number }).homerunRev === HOMERUN_REV_5, "the deal at Hard is stamped hard on rev 5");
  ok(!("level" in (generatePuzzle("homerun", { bankSeed: 7 }) as object)), "the deal at Normal carries no level");
}

if (failures) {
  console.log(`FAIL homerun-innings-check: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS homerun-innings-check: ${checks} checks`);
