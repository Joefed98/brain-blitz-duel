/**
 * Ball Tracker's difficulty levels (Strategy overhaul stage 3, 15 Nov 2026; docs/arcade-standard/balltrack.md "Levels").
 *  1. The registry: Easy, Hard and Expert with Joe's settings (28 marbles every 1.8 s and no cup moves, more gold and
 *     boosters; 42 every 1.2 s with the cups moving more often; 42 every 1.1 s, the cups moving most often, fewer
 *     boosters); rated play and the Daily always Normal.
 *  2. Normal is today's game: a Normal deal (no level, "normal", or a level the registry doesn't hold) is the same draw
 *     from btRev 8's deal list as before, with no `level` field; a bank course carries none of the level fields and its
 *     state none of the level counts; its cup moves are its re-lay and shuffle.
 *  3. Older stamps replay unchanged: the skill-band bot's runs on bank courses of every btRev, recorded on the code
 *     before levels (scripts/fixtures/balltrack-levels-legacy.json, scripts/balltrack-levels-legacy-record.ts), give
 *     the same score and final checkpoint.
 *  4. Each level's list: the courses' marbles, release ticks, cup moves (count, order, alternating re-lay and colour
 *     shuffle, inside the run), gold marbles, boosters and crossovers are the level's; the deal draws only from the list
 *     (Math.random swept over every slot), stamps `level` and btRev 8, and deals every entry.
 *  5. The clock: every level runs 60 s (≤ 120 s), the last marble released by 50 s.
 *  6. 200 at every level: every listed course's witness (the boosted oracle's log) scores 200 through the server's
 *     encode + replay, unflagged, with every marble home boosted and every gold; the oracle itself re-run on a sample (2
 *     a level at quick depth, every course at full depth: CHECKS_FULL=1 or --full).
 *  7. Display and scoring: the parts sum to 200 and are shared over the course's own marbles and gold marbles; the
 *     reveal's axis and the intro line follow the level.
 *  8. A clear step: the skill-band bot under Joe's human limits on 8 courses a level: the average and elite players'
 *     averages fall Easy → Normal → Hard → Expert; the average player stars (175+) on some of 30 Easy courses; Expert's elite
 *     player scores well (an average of 120 or more).
 *
 *   bun scripts/balltrack-levels-check.ts [--full]
 */
import { readFileSync } from "node:fs";

import { btCheckpoint, btMovesOf, btStdSpecOf, btTraysAt, makeBallTrackGame, BT_NEVER_TICK, BT_REV_STD, BT_RUN_TICKS, BT_V7_ROWS, type BtCourse } from "../src/lib/arcade/ballTrack";
import { decodeInputEvents } from "../src/lib/arcade/engine";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { BALL_TRACK_BANK_V7 } from "../src/lib/duel/ballTrackBankV7.server";
import { BT_V8_DEAL } from "../src/lib/duel/ballTrackDealV8.server";
import { btLevelDeal } from "../src/lib/duel/ballTrackLevels.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { btLevelIntroLine } from "../src/puzzles/ballTrack";
import { levelsOf } from "../src/lib/levels/gameLevels";
import { puzzleLevel } from "../src/lib/levels/levels";
import { modeLevel } from "../src/lib/levels/modes";
import { stdSpecMax } from "../src/lib/arcade/arcadeStandard";
import type { BallTrackPuzzleData } from "../src/lib/duel/types";
import { boostedOracle, replayedBtStd } from "./arcade-standard/balltrack";
import { BT_LEVEL_COUNT, BT_LEVELS, btLevelSettings, readWitness, type BtLevel } from "./balltrack-level-deal";
import { courseOf, legacyRun } from "./balltrack-levels-legacy-record";
import { levelBands } from "./balltrack-level-bands";

const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const t0 = Date.now();

function dealWith(r: number, level?: string): BallTrackPuzzleData {
  const random = Math.random;
  Math.random = () => r;
  try {
    return generatePuzzle("balltrack", level === undefined ? {} : ({ level } as never)) as BallTrackPuzzleData;
  } finally {
    Math.random = random;
  }
}

/* 1. The registry. */
ok(JSON.stringify(levelsOf("balltrack")) === JSON.stringify(["easy", "normal", "hard", "expert"]), `Ball Tracker offers all four levels (${levelsOf("balltrack").join(", ")})`);
const easy = btLevelSettings("easy"), hard = btLevelSettings("hard"), expert = btLevelSettings("expert");
ok(easy.balls === 28 && easy.dropTicks === 108 && easy.moves === 0, "Easy: 28 marbles every 1.8 s, the cups never move");
ok(easy.golds > 6 && easy.boosts > 3, "Easy: more gold marbles and boosters than Normal (6 and 3)");
ok(hard.balls === 42 && hard.dropTicks === 72 && hard.moves > 2, "Hard: 42 marbles every 1.2 s, the cups move more often than Normal's 2");
ok(expert.balls === 42 && expert.dropTicks === 66 && expert.moves > hard.moves && expert.boosts < 3, "Expert: 42 every 1.1 s, the cups move most often, fewer boosters");
for (const lv of ["easy", "hard", "expert"] as const) {
  ok(modeLevel("rated", lv) === "normal", `rated play is Normal whatever is asked (${lv})`);
  ok(modeLevel("daily", lv) === "normal", `the Daily is Normal whatever is asked (${lv})`);
}

/* 2. Normal is today's game. */
const n = BT_V8_DEAL.length;
for (const r of [0, 0.31, 0.5, 0.77, 1 - 2 ** -53]) {
  const want = BT_V8_DEAL[Math.floor(r * n)]!;
  for (const asked of [undefined, "normal"]) {
    const p = dealWith(r, asked);
    ok(!("level" in p) && puzzleLevel(p) === "normal", `a Normal deal (${asked ?? "no level"}) carries no level field`);
    ok(p.seed === want + 1 && JSON.stringify(p.course) === JSON.stringify(BALL_TRACK_BANK_V7[want]!.course) && p.btRev === BT_REV_STD, `a Normal deal at ${r} is bank course ${want} on btRev 8, as before levels`);
    ok(p.playbook === BALL_TRACK_BANK_V7[want]!.playbook && p.par === BALL_TRACK_BANK_V7[want]!.par, "a Normal deal keeps the bank's par and playbook");
  }
}
for (const e of BALL_TRACK_BANK_V7) {
  const c = e.course;
  if (c.drop !== undefined || c.moves !== undefined) ok(false, "no bank course carries a level field");
  if (btMovesOf(c).length !== 2 || btMovesOf(c)[0] !== c.relay || btMovesOf(c)[1] !== c.shuffle) ok(false, "a bank course's cup moves are its re-lay and shuffle");
}
{
  const s = makeBallTrackGame(BALL_TRACK_BANK_V7[0]!.course, BT_REV_STD).init(1);
  ok(!("nb" in s) && !("ng" in s), "a Normal state carries no level counts");
  ok(btStdSpecOf(s).parts[0]!.of === 36 && btStdSpecOf(s).parts[1]!.of === 6, "a Normal state is scored on BT_STD (36 marbles, 6 gold)");
}

/* 3. Older stamps replay unchanged. */
const legacy = JSON.parse(readFileSync("scripts/fixtures/balltrack-levels-legacy.json", "utf8")) as { rev: number | null; bank: "v1" | "tall" | "v7"; index: number; skill: never; score: number; end: unknown }[];
ok(legacy.length >= 60, `the legacy fixture holds the recorded runs (${legacy.length})`);
for (const row of legacy) {
  const r = legacyRun(row.rev, courseOf(row.bank, row.index), row.index + 1, row.skill);
  ok(r.score === row.score && JSON.stringify(r.end) === JSON.stringify(row.end), `btRev ${row.rev ?? "none"} ${row.bank} course ${row.index}, ${row.skill}: replays as recorded before levels (${r.score} vs ${row.score})`);
}

/* 4–7. Each level. */
let proved = 0, oracled = 0;
for (const level of BT_LEVELS) {
  const s = btLevelSettings(level);
  const list = btLevelDeal(level);
  const witness = readWitness(level) ?? [];
  ok(list.length === BT_LEVEL_COUNT, `${level}: the list holds ${BT_LEVEL_COUNT} courses (${list.length})`);
  ok(witness.length === list.length, `${level}: one witness per course (${witness.length})`);
  list.forEach((c: BtCourse, i) => {
    const moves = c.moves ?? [];
    const shape =
      c.rows === BT_V7_ROWS && c.balls.length === s.balls && c.drop === s.dropTicks && moves.length === s.moves &&
      (c.gold?.length ?? 0) === s.golds && (c.boost?.length ?? 0) === s.boosts && (c.cross?.length ?? 0) === 2 &&
      c.balls.every((b) => b >= 0 && b < 4) && [0, 1, 2, 3].every((k) => Math.abs(c.balls.filter((b) => b === k).length - s.balls / 4) <= 1);
    ok(shape, `${level} course ${i}: ${s.balls} marbles every ${s.dropTicks} ticks, ${s.moves} cup moves, ${s.golds} gold, ${s.boosts} boosters, 2 crossovers`);
    ok(moves.every((m, k) => m.tick > (moves[k - 1]?.tick ?? 0) && m.tick < 2900), `${level} course ${i}: the cup moves in order, all before 48 s`);
    ok(moves.every((m, k) => {
      const before = k === 0 ? c.trays : moves[k - 1]!.trays;
      const cols = (t: number[]) => t.flatMap((x, col) => (x >= 0 ? [col] : [])).join();
      const ord = (t: number[]) => t.filter((x) => x >= 0).join();
      return k % 2 === 0 ? cols(m.trays) !== cols(before) && ord(m.trays) === ord(before) : cols(m.trays) === cols(before) && m.trays.every((x, col) => x < 0 || x !== before[col]);
    }), `${level} course ${i}: the moves alternate a re-lay and a colour shuffle`);
    if (!moves.length) ok(c.relay.tick === BT_NEVER_TICK && c.shuffle.tick === BT_NEVER_TICK && btTraysAt(c, BT_RUN_TICKS) === c.trays, `${level} course ${i}: the cups never move`);
    else ok(c.relay === moves[0] || JSON.stringify(c.relay) === JSON.stringify(moves[0]), `${level} course ${i}: relay is the first move`);
    ok(1 + (s.balls - 1) * s.dropTicks <= 3000, `${level}: the last marble is released by 50 s (${1 + (s.balls - 1) * s.dropTicks})`);
    // The witness through the server replay.
    const events = decodeInputEvents(witness[i] ?? "");
    const r = replayedBtStd(c, i + 1, events);
    ok(r.score === 200 && !r.flagged && r.state.home === s.balls && r.state.boosts === s.balls && r.state.golds === s.golds, `${level} course ${i}: its witness scores 200 through the server replay (${r.score}: ${r.state.home} home, ${r.state.boosts} boosted, ${r.state.golds} gold${r.flagged ? ", flagged" : ""})`);
    if (r.score === 200) proved++;
  });
  // The oracle itself, on a sample (every course at full depth).
  const sample = FULL ? list.map((_, i) => i) : [0, Math.floor(list.length / 2)];
  for (const i of sample) {
    const c = list[i]!;
    const r = replayedBtStd(c, i + 1, boostedOracle(c));
    ok(r.score === 200 && !r.flagged, `${level} course ${i}: the boosted oracle reaches 200 through the server replay (${r.score})`);
    oracled++;
  }
  // The deal: every slot of the list, the level stamped.
  const dealt = new Set<number>();
  for (let k = 0; k < list.length; k++)
    for (const f of [0, 0.5, 0.999999]) {
      const p = dealWith((k + f) / list.length, level);
      ok(p.level === level && p.btRev === BT_REV_STD && JSON.stringify(p.course) === JSON.stringify(list[p.seed - 1]), `a ${level} deal is btRev 8, stamped ${level}, its course list entry ${p.seed - 1}`);
      ok(!p.playbook && p.par === undefined, `a ${level} deal carries no bank playbook`);
      dealt.add(p.seed - 1);
    }
  ok(dealt.size === list.length, `${level}: every course is dealt by some draw (${dealt.size})`);
  const p = dealWith(0.4, level);
  ok(puzzleTimeLimitMs(p) <= 120_000 && BT_RUN_TICKS <= 120 * 60, `${level}: the clock is at most 120 s (${puzzleTimeLimitMs(p)} ms, run ${BT_RUN_TICKS / 60} s)`);
  // Scoring and display.
  const game = makeBallTrackGame(list[0]!, BT_REV_STD);
  const s0 = game.init(1);
  const spec = btStdSpecOf(s0);
  ok(stdSpecMax(spec) === 200 && spec.parts[0]!.of === s.balls && spec.parts[1]!.of === s.golds && spec.parts.find((q) => q.key === "boost")!.of === s.balls, `${level}: the parts total 200, shared over ${s.balls} marbles and ${s.golds} gold`);
  ok(game.score({ ...s0, acted: 1, home: s.balls, golds: s.golds, combos: 20, boosts: s.balls }) === 200, `${level}: a full state scores 200`);
  ok(game.score({ ...s0, acted: 1, home: s.balls - 1, golds: s.golds, combos: 20, boosts: s.balls - 1 }) < 200, `${level}: one marble short is under 200`);
  const reveal = buildArcadeReveal("balltrack", { home: 10, wrong: 0, lost: 0, state: { ...s0, home: 10 } }, 100);
  ok(reveal?.axis.max === s.balls, `${level}: the reveal's axis counts ${s.balls} marbles (${reveal?.axis.max})`);
  const line = btLevelIntroLine(list[0]!) ?? "";
  ok(line.startsWith(`${s.balls} marbles`) && line.includes(s.moves ? `move ${s.moves} times` : "never move"), `${level}: the intro line says the level (${line})`);
}
ok(btLevelIntroLine(BALL_TRACK_BANK_V7[0]!.course) === null, "Normal shows no level line");
ok(proved === BT_LEVELS.reduce((a, l) => a + btLevelDeal(l).length, 0), `every level course is proved at 200 (${proved})`);

/* 8. A clear step. */
const levels = ["easy", "normal", "hard", "expert"] as const;
const bands = Object.fromEntries(levels.map((l) => [l, levelBands(l, 8, ["average", "elite"], { limits: true })])) as Record<(typeof levels)[number], ReturnType<typeof levelBands>>;
const avgOf = (l: (typeof levels)[number], skill: string) => bands[l].find((r) => r.skill === skill)!.average;
for (const skill of ["average", "elite"]) {
  const a = levels.map((l) => avgOf(l, skill));
  ok(a[0]! >= a[1]! && a[1]! > a[2]! && a[2]! > a[3]!, `the ${skill} player's average falls Easy → Normal → Hard → Expert (${a.join(" / ")})`);
}
const easyStar = levelBands("easy", 30, ["average"], { limits: true })[0]!.star;
ok(easyStar > 0, `the average player stars (175+) on some of 30 Easy courses (${easyStar})`);
ok(avgOf("expert", "elite") >= 120, `Expert's elite player (human limits) scores well (${avgOf("expert", "elite")})`);

const secs = ((Date.now() - t0) / 1000).toFixed(1);
if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} Ball Tracker level checks (${secs} s)`);
  process.exit(1);
}
console.log(
  `PASS: ${checks} Ball Tracker level checks — Normal unchanged (deal, state, ${legacy.length} legacy runs); ${proved} level courses proved at 200 by their witnesses, the oracle re-run on ${oracled}${FULL ? " (full depth)" : " (quick; --full for all)"}; elite averages ${levels.map((l) => avgOf(l, "elite")).join(" / ")}, average ${levels.map((l) => avgOf(l, "average")).join(" / ")} (Easy → Expert, human limits) (${secs} s)`,
);
