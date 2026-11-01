/**
 * Gemstone matchupRev 11, the arcade scoring standard (docs/arcade-standard/matchup.md):
 *  1. Older stamps unchanged: every run in scripts/fixtures/gemstone-standard-legacy.json (bot runs on matchupRev 2–10
 *     and unstamped, recorded on main before the change by scripts/gemstone-standard-legacy.ts) replays through the
 *     server to the same score and the same final state; older states carry no matchupRev 11 field.
 *  2. Rooms deal matchupRev 11's successor, matchupRev 12 (six goals and six treasures, gemstone-rev12-check); the help,
 *     intro, demo gate and reveal follow the dealt stamp; matchupRev 11 plays 90 s on the 7 × 10 board.
 *  3. The deal: matchupRev 10's board, queues and plan for the same seed, exactly 10 frozen cells in rows 4–9, the
 *     same for every player (same seed → same init; the k-th goal and treasure the same whatever is played).
 *  4. Rules: four treasures (the plan's first four columns); a treasure swaps with a plain gem exactly when that gem
 *     then makes a line of three (never with a special or another treasure); four goal levels and no more; the hint
 *     is always a swap the sim accepts.
 *  5. Scoring: core = gems cleared on one straight line to 110 at MATCHUP_V11_CORE_GEMS (equal steps); treasure 10
 *     each (40); goals 3 a colour goal (30); ice 1 a cell (10); big lines 2 each (10); parts total 200; any played run
 *     scores at least 1, none 0; the cascade multiplier pays nothing.
 *  6. Real play through the server's encode + replay (recorded rev-11 runs, fresh bot runs): no desync, the score is
 *     its parts, medians rise weak < good < near < flawless; the recorded flawless run is 200 with every part at max.
 *
 *   bun scripts/gemstone-standard-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/matchup";
import { roomIdentity } from "./room-identity/matchup";
import { entry } from "./arcade-standard/matchup";
import type { StdRun } from "./arcade-standard/entry";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { encodeMatchupRun, replayMatchupRun } from "../src/lib/duel/matchup";
import {
  matchupCheckpoint,
  matchupGameFor,
  matchupGoalsMet,
  matchupHintSwap,
  matchupIndex,
  matchupRowsFor,
  matchupRuns,
  matchupStdParts,
  matchupStdScore,
  matchupWorldHFor,
  MATCHUP_REV_ICE,
  MATCHUP_REV_SIX,
  MATCHUP_REV_STD,
  MATCHUP_SIZE,
  MATCHUP_TREASURE,
  MATCHUP_V10_ICE,
  MATCHUP_V11_BAND_CURVE,
  MATCHUP_V11_BIG_MAX,
  MATCHUP_V11_BIG_PTS,
  MATCHUP_V11_CORE_GEMS,
  MATCHUP_V11_CORE_MAX,
  MATCHUP_V11_GOAL_LEVELS,
  MATCHUP_V11_GOAL_PTS,
  MATCHUP_V11_GOALS,
  MATCHUP_V11_GOALS_MAX,
  MATCHUP_V11_ICE_MAX,
  MATCHUP_V11_TREASURE_MAX,
  MATCHUP_V11_TREASURE_PTS,
  MATCHUP_V11_TREASURES,
  MATCHUP_V9_ROWS,
  MATCHUP_V9_WORLD_H,
  MATCHUP_V12_BAND_CURVE,
  MATCHUP_V12_BIG_MAX,
  MATCHUP_V12_BIG_PTS,
  MATCHUP_V12_CORE_MAX,
  MATCHUP_V12_GOAL_PTS,
  MATCHUP_V12_GOALS,
  MATCHUP_V12_GOALS_MAX,
  MATCHUP_V12_ICE_MAX,
  MATCHUP_V12_TREASURE_MAX,
  MATCHUP_V12_TREASURE_PTS,
  type MatchupState,
} from "../src/lib/arcade/matchup";

/** The game's arcade-standard-check entry, read as this check always has (the first perfect run, split into parts). */
const STANDARD = {
  id: entry.type,
  stampKey: entry.field,
  stamp: entry.rev,
  parts: entry.parts,
  perfect: () => {
    const r = (entry.perfect() as StdRun[])[0]!;
    return { score: r.score, parts: r.parts! };
  },
};

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  checks++;
  if (!cond && failures.length < 60) failures.push(label);
}
const section = (title: string) => console.log(`— ${title}`);
const started = Date.now();
const spec: any = GAME_BY_TYPE.get("matchup" as never)!;
const game = matchupGameFor(MATCHUP_REV_STD);
const ten = matchupGameFor(MATCHUP_REV_ICE);
const unzip = (b64: string) => gunzipSync(Buffer.from(b64, "base64")).toString();
const iceCount = (s: MatchupState) => (s.ice ?? []).reduce((n, v) => n + (v ? 1 : 0), 0);
const isNormal = (k: number) => k >= 0 && k < 6;

/* 1. Older stamps */
section("Older stamps replay and score exactly as before");
{
  const legacy = JSON.parse(readFileSync("scripts/fixtures/gemstone-standard-legacy.json", "utf8")) as { runs: { rev: number | null; level: string; seed: number; score: number; stateHash: number; raw: string }[] };
  const revs = new Set<number | null>();
  for (const r of legacy.runs) {
    const result = replayMatchupRun(r.seed, unzip(r.raw), r.rev);
    ok(!result.flagged && result.score === r.score && fnv(JSON.stringify(result.state)) === r.stateHash, `matchupRev ${r.rev ?? "none"} ${r.level} seed ${r.seed}: ${r.score} as on main (got ${result.score}${result.flagged ? ", flagged" : ""})`);
    ok(!("std" in result.state) && !("gemsCleared" in result.state) && !("bigLines" in result.state), `matchupRev ${r.rev ?? "none"}: no matchupRev 11 field`);
    revs.add(r.rev);
  }
  ok(legacy.runs.length >= 60 && [null, 2, 3, 4, 5, 6, 7, 8, 9, 10].every((r) => revs.has(r)), `${legacy.runs.length} legacy runs over every older revision`);
  for (const rev of [undefined, 2, 5, 8, 9, 10]) {
    const s = matchupGameFor(rev).init(7) as MatchupState;
    ok(!("std" in s), `matchupRev ${rev ?? "none"}: init has no std field`);
  }
}

/* 2. Stamps and text */
// matchupRev 12 (six goals and six treasures, gemstone-rev12-check) moved rooms on from matchupRev 11, which replays and
// scores here as before; the dealt stamp's help, intro and demo gate are checked at their matchupRev 12 values.
section("Rooms deal matchupRev 11's successor (12); help, intro, demo and reveal follow it");
for (let k = 0; k < 5; k++) ok((generatePuzzle("matchup") as any).matchupRev === MATCHUP_REV_SIX && MATCHUP_REV_STD === 11 && MATCHUP_REV_SIX === MATCHUP_REV_STD + 1, "rooms deal matchupRev 12 (matchupRev 11's successor)");
ok(LIVE_BANDS.matchup.rev === MATCHUP_REV_SIX && LIVE_BANDS.matchup.curve === MATCHUP_V12_BAND_CURVE, "the help reads matchupRev 12's core line (matchupRev 11's successor)");
ok(MATCHUP_V11_BAND_CURVE.units.length === 2 && MATCHUP_V11_BAND_CURVE.units[1] === MATCHUP_V11_CORE_GEMS && MATCHUP_V11_BAND_CURVE.points[1] === MATCHUP_V11_CORE_MAX, "the core is one straight line (two knots), 0 → 110");
ok(game.runTicks === 5400 && matchupWorldHFor(MATCHUP_REV_STD) === MATCHUP_V9_WORLD_H && matchupRowsFor(MATCHUP_REV_STD) === MATCHUP_V9_ROWS, "90 s on the 7 × 10 board in the 390 × 720 world");
ok(roundMaxFor("matchup") === 200, "the round maximum stays 200");
{
  const demo = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/matchupRev !== MATCHUP_REV_SIX\) return null/.test(demo), "the intro demo stays stopped until recorded on matchupRev 12 (matchupRev 11's successor)");
  const help = PUZZLE_INSTRUCTIONS.matchup.score;
  for (const text of ["More gems cleared", `up to ${MATCHUP_V12_CORE_MAX}`, `${MATCHUP_V12_TREASURE_PTS} for each brought down (up to ${MATCHUP_V12_TREASURE_MAX})`, `${MATCHUP_V12_GOAL_PTS} for each of the ${MATCHUP_V12_GOALS} colour goals met (up to ${MATCHUP_V12_GOALS_MAX})`, `(up to ${MATCHUP_V12_ICE_MAX})`, `${MATCHUP_V12_BIG_PTS} for each line of 4 or 5 you match (up to ${MATCHUP_V12_BIG_MAX})`, "make 200", "Up to 200."])
    ok(help.includes(text), `the help says "${text}": ${help}`);
  ok(!/cascade multiplier|match points/i.test(help), "the help no longer pays match points or the cascade multiplier");
  const how = PUZZLE_INSTRUCTIONS.matchup.how.map((l) => `${l.action} ${l.detail}`).join(" ");
  ok(/swaps with a gem that then makes a line of three/.test(how) && /Six goals/.test(how) && !/Cascades multiply/.test(how), "the help's rules: treasure swaps, the dealt stamp's six goals (matchupRev 12), no cascade multiplier");
  ok(/treasure, goals, ice and lines of 4 or 5/.test(INTRO_SCORE.matchup) && !/cascades/.test(INTRO_SCORE.matchup), `the intro's score line: ${INTRO_SCORE.matchup}`);
}

/* 3. The deal */
section("The deal: matchupRev 10's board, exactly 10 frozen cells, the same for everyone");
for (let seed = 1; seed <= 300; seed++) {
  const s = game.init(seed) as MatchupState;
  const t = ten.init(seed) as MatchupState;
  ok(s.std === 1 && s.iceSwap === 1 && s.goals === 1 && s.gemsCleared === 0 && s.bigLines === 0, `seed ${seed}: a matchupRev 11 state`);
  ok(JSON.stringify([s.cells, s.queues, s.plan, s.rng, s.ice]) === JSON.stringify([t.cells, t.queues, t.plan, t.rng, t.ice]), `seed ${seed}: matchupRev 10's board, queues, plan and ice`);
  ok(iceCount(s) === MATCHUP_V10_ICE && (s.ice ?? []).every((v, i) => !v || i >= 4 * MATCHUP_SIZE), `seed ${seed}: exactly ${MATCHUP_V10_ICE} frozen cells in rows 4–9 (${iceCount(s)})`);
  if (seed <= 20) ok(JSON.stringify(game.init(seed)) === JSON.stringify(s), `seed ${seed}: the same init every time`);
}
{
  // The k-th goal and treasure are the seed's, whatever is played (weak, good and elite logs).
  let compared = 0;
  for (let n = 0; n < 3; n++) {
    const seed = spec.seedFor(n + 20);
    const logs = roomIdentity.logs(seed);
    const lists = logs.map((l) => roomIdentity.scheduleOf(seed, MATCHUP_REV_STD, l.log));
    const upto = Math.min(...lists.map((l) => l.endTick));
    const cut = (l: { entries: { t: number; what: string }[] }) => l.entries.filter((e) => e.t <= upto).map((e) => e.what).join(" | ");
    ok(lists.every((l) => cut(l) === cut(lists[0]!)), `seed ${seed}: the ice, goals and treasure columns agree for every log`);
    compared += upto;
  }
  ok(compared >= 3, `goals and treasures compared across logs (${compared})`);
}

/* 4. Rules */
section("Rules: treasure swaps that make a line, four treasures, four goal levels, valid hints");
let treasureSwaps = 0;
let treasureRefused = 0;
const probe = (s: MatchupState, label: string) => {
  const t = s.cells.indexOf(MATCHUP_TREASURE);
  if (t < 0 || s.tick + 1 < (s.busyUntil ?? 0)) return;
  const r = Math.floor(t / MATCHUP_SIZE), c = t % MATCHUP_SIZE;
  for (const [r2, c2] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as const) {
    if (r2 < 0 || r2 >= MATCHUP_V9_ROWS || c2 < 0 || c2 >= MATCHUP_SIZE) continue;
    const g = matchupIndex(r2, c2);
    const after = game.step(s, { t: s.tick + 1, k: 3, a: r, b: c, c: r2, d: c2 }) as MatchupState;
    const accepted = after.swaps === s.swaps + 1;
    const cells = [...s.cells];
    [cells[t], cells[g]] = [cells[g]!, cells[t]!];
    const line = matchupRuns(cells).some((run) => run.cells.includes(t));
    const expect = isNormal(s.cells[g]!) && line;
    ok(accepted === expect, `${label} (${r},${c})↔(${r2},${c2}): a treasure swap goes through exactly when the gem then makes a line (gem ${s.cells[g]}, line ${line}, accepted ${accepted})`);
    if (accepted) {
      treasureSwaps++;
      const home = (after.treasures ?? 0) > (s.treasures ?? 0);
      ok(home || after.lastAnimation[0]!.before[g] === MATCHUP_TREASURE, `${label}: the treasure takes the gem's old cell`);
      // The gem's line clears (a cell of it may become the line's bomb or star instead).
      const step0 = after.lastAnimation[0]!;
      const run = matchupRuns(cells).find((x) => x.cells.includes(t))!;
      ok(run.cells.every((i) => step0.cleared.includes(i) || step0.created.some((c) => c.index === i)), `${label}: the gem's line clears`);
    } else treasureRefused++;
  }
};
for (let seed = 1; seed <= 120; seed++) probe(game.init(seed) as MatchupState, `seed ${seed}`);
// A treasure with no plain neighbour making a line, and one swapped with a special, are refused.
{
  const s = game.init(11) as MatchupState;
  const t = s.cells.indexOf(MATCHUP_TREASURE);
  const below = t + MATCHUP_SIZE;
  const cells = [...s.cells];
  cells[below] = 6; // a bomb under the treasure
  const st = { ...s, cells };
  const after = game.step(st, { t: 1, k: 3, a: Math.floor(t / MATCHUP_SIZE), b: t % MATCHUP_SIZE, c: Math.floor(below / MATCHUP_SIZE), d: below % MATCHUP_SIZE }) as MatchupState;
  ok(after.swaps === 0 && after.cells[t] === MATCHUP_TREASURE, "a treasure never swaps with a special");
}

const LEVELS: SkillLevel[] = ["weak", "good", "near", "perfect"];
const scores: Record<string, number[]> = {};
let maxLevels = 0;
let maxPlaced = 0;
let bigSeen = 0;
for (const level of LEVELS)
  for (let n = 0; n < 7; n++) {
    const seed = spec.seedFor(n);
    const events = bot({ game, seed, rev: MATCHUP_REV_STD, human: new Human("matchup", seed, level), fixes: true }).events ?? [];
    const byTick = new Map(events.map((e: any) => [e.t, e]));
    let s = game.init(seed) as MatchupState;
    const cols = s.plan!.treasureCols;
    const checkpoints: any[] = [];
    while (!game.isOver(s)) {
      const prev = s;
      if (n < 2 && s.tick % 61 === 0) {
        probe(s, `${level} #${n} tick ${s.tick}`);
        if (s.tick + 1 >= (s.busyUntil ?? 0)) {
          const h = matchupHintSwap(s);
          if (h) ok((game.step(s, { t: s.tick + 1, k: 3, a: h.row1, b: h.col1, c: h.row2, d: h.col2 }) as MatchupState).swaps === s.swaps + 1, `${level} #${n} tick ${s.tick}: the hint is a swap the sim accepts`);
        }
      }
      s = game.step(s, (byTick.get(s.tick + 1) as any) ?? null) as MatchupState;
      if (s.tick % 300 === 0) checkpoints.push(matchupCheckpoint(s));
      if ((s.treasurePlaced ?? 0) > (prev.treasurePlaced ?? 0)) {
        const at = s.cells.indexOf(MATCHUP_TREASURE);
        ok(at % MATCHUP_SIZE === cols[(s.treasurePlaced ?? 1) - 1], `${level} #${n}: treasure ${s.treasurePlaced} in the plan's column`);
      }
      if (s.swaps > prev.swaps) {
        const gems = s.lastAnimation.reduce((sum, a) => sum + a.cleared.filter((i) => a.before[i] !== MATCHUP_TREASURE).length, 0);
        const big = s.lastAnimation[0] ? matchupRuns(s.lastAnimation[0].before).filter((r) => r.length >= 4).length : 0;
        ok(s.gemsCleared === (prev.gemsCleared ?? 0) + gems && s.bigLines === (prev.bigLines ?? 0) + big, `${level} #${n} tick ${s.tick}: gems cleared and big lines counted`);
        bigSeen += big;
      }
      ok(iceCount(s) <= iceCount(prev), `${level} #${n}: ice never comes back`);
    }
    maxLevels = Math.max(maxLevels, s.levels ?? 0);
    maxPlaced = Math.max(maxPlaced, s.treasurePlaced ?? 0);
    ok((s.treasurePlaced ?? 0) <= MATCHUP_V11_TREASURES && (s.treasures ?? 0) <= MATCHUP_V11_TREASURES, `${level} #${n}: at most ${MATCHUP_V11_TREASURES} treasures (${s.treasurePlaced} placed)`);
    ok((s.levels ?? 0) <= MATCHUP_V11_GOAL_LEVELS, `${level} #${n}: at most ${MATCHUP_V11_GOAL_LEVELS} goal levels (${s.levels})`);
    if ((s.levels ?? 0) === MATCHUP_V11_GOAL_LEVELS) ok((s.goalLeft ?? []).every((v) => v === 0) && matchupGoalsMet(s) === MATCHUP_V11_GOALS, `${level} #${n}: every goal met, none follow`);
    const score = game.score(s);
    const p = matchupStdParts(s);
    ok(score === Math.max(1, p.core + p.treasure + p.goals + p.ice + p.big), `${level} #${n}: the score is its parts`);
    ok(score >= 1, `${level} #${n}: a played run scores at least 1 (${score})`);
    const raw = encodeMatchupRun({ seed, claimedScore: score, events: events as any, endTick: s.tick, checkpoints });
    const replay = replayMatchupRun(seed, raw, MATCHUP_REV_STD);
    ok(!replay.flagged && replay.score === score && replay.endedSeconds === 90, `${level} #${n}: replays to ${score} over 90 s (got ${replay.score}${replay.flagged ? `, flagged: ${replay.reason}` : ""})`);
    const reveal = buildArcadeReveal("matchup", replay, replay.score);
    ok(reveal?.axis.label === "Gems cleared" && reveal.lines[0]?.includes("gems cleared") && reveal.tiles.some((t) => t.label === "Treasure"), `${level} #${n}: the reveal shows gems cleared and the parts`);
    (scores[level] ??= []).push(score);
  }
ok(treasureSwaps >= 5 && treasureRefused >= 20, `treasure swaps both made (${treasureSwaps}) and refused (${treasureRefused})`);
ok(maxLevels === MATCHUP_V11_GOAL_LEVELS && maxPlaced === MATCHUP_V11_TREASURES && bigSeen > 0, `real play reaches all ${MATCHUP_V11_GOAL_LEVELS} goal levels (${maxLevels}), all ${MATCHUP_V11_TREASURES} treasures placed (${maxPlaced}) and big lines (${bigSeen})`);
const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
const meds = LEVELS.map((l) => median(scores[l]!));
ok(meds.every((m, i) => i === 0 || m > meds[i - 1]!), `medians rise ${LEVELS.map((l, i) => `${l} ${meds[i]}`).join(" < ")}`);

/* 5. Scoring */
section("Scoring: straight core, fixed features, total 200, at least 1");
{
  const base = { ...(game.init(4) as MatchupState), acted: 1 };
  const withState = (o: Partial<MatchupState>) => ({ ...base, ...o }) as MatchupState;
  let straight = true;
  for (let g = 0; g <= MATCHUP_V11_CORE_GEMS + 50; g++) {
    const core = matchupStdParts(withState({ gemsCleared: g })).core;
    if (core !== Math.min(MATCHUP_V11_CORE_MAX, Math.floor((MATCHUP_V11_CORE_MAX * g) / MATCHUP_V11_CORE_GEMS)) || core !== bandPoints(MATCHUP_V11_BAND_CURVE, g)) straight = false;
  }
  ok(straight, `core = floor(110 × gems ÷ ${MATCHUP_V11_CORE_GEMS}), capped at 110`);
  ok(matchupStdParts(withState({ gemsCleared: 100000 })).core === MATCHUP_V11_CORE_MAX, "the core caps at 110");
  for (let k = 0; k <= 6; k++) ok(matchupStdParts(withState({ treasures: k })).treasure === Math.min(40, 10 * k), `${k} treasures → ${Math.min(40, 10 * k)}`);
  for (let k = 0; k <= 12; k++) ok(matchupStdParts(withState({ iceBroken: k })).ice === Math.min(10, k), `${k} ice → ${Math.min(10, k)}`);
  for (let k = 0; k <= 8; k++) ok(matchupStdParts(withState({ bigLines: k })).big === Math.min(10, 2 * k), `${k} big lines → ${Math.min(10, 2 * k)}`);
  // Goals: every colour goal met pays 3, levels 1–4 hold 2 + 2 + 3 + 3.
  const plan = base.plan!;
  ok(plan.colours.slice(0, 4).reduce((n, c) => n + c.length, 0) === MATCHUP_V11_GOALS, "the four goal levels hold 10 colour goals");
  ok(matchupStdParts(withState({ level: 0 })).goals === 0, "no goal met → 0");
  {
    const left = [...(base.goalLeft ?? [])];
    left[plan.colours[0]![0]!] = 0;
    ok(matchupStdParts(withState({ level: 0, goalLeft: left })).goals === 3, "one colour goal met → 3");
  }
  {
    const left = [0, 0, 0, 0, 0, 0];
    for (const c of plan.colours[2]!) left[c] = 5;
    left[plan.colours[2]![1]!] = 0;
    ok(matchupGoalsMet(withState({ level: 2, levels: 2, goalLeft: left })) === 5 && matchupStdParts(withState({ level: 2, levels: 2, goalLeft: left })).goals === 15, "two levels and one more colour → 5 goals, 15");
  }
  ok(matchupStdParts(withState({ level: 4, levels: 4, goalLeft: [0, 0, 0, 0, 0, 0] })).goals === MATCHUP_V11_GOALS_MAX, "all four levels → 30");
  ok(STANDARD.parts.reduce((n, p) => n + p.max, 0) === 200 && MATCHUP_V11_CORE_MAX + MATCHUP_V11_TREASURE_MAX + MATCHUP_V11_GOALS_MAX + MATCHUP_V11_ICE_MAX + MATCHUP_V11_BIG_MAX === 200, "the parts' maxima total 200");
  const full = withState({ gemsCleared: 999, treasures: 4, iceBroken: 10, bigLines: 9, level: 4, levels: 4, goalLeft: [0, 0, 0, 0, 0, 0] });
  ok(matchupStdScore(full) === 200 && game.score(full) === 200, "every part full → 200");
  ok(matchupStdScore(withState({})) === 1 && game.score(withState({})) === 1, "a played run with nothing scored → 1");
  ok(game.score({ ...withState({ gemsCleared: 200 }), acted: 0 }) === 0, "no input → 0");
  ok(game.score(withState({ gemsCleared: 200, cascadeExtra: 0 })) === game.score(withState({ gemsCleared: 200, cascadeExtra: 9000, raw: 99999 })), "the cascade multiplier and match points pay nothing");
  // No input at all: the run ends at 90 s with 0.
  let s = game.init(3) as MatchupState;
  while (!game.isOver(s)) s = game.step(s, null) as MatchupState;
  ok(s.tick === 5400 && game.score(s) === 0, "no input scores 0 at 90 s");
  // A single refused swap counts as playing: at least 1.
  let one = game.init(3) as MatchupState;
  one = game.step(one, { t: 1, k: 3, a: 0, b: 0, c: 0, d: 0 }) as MatchupState;
  while (!game.isOver(one)) one = game.step(one, null) as MatchupState;
  ok(game.score(one) === 1, `a run with one input and nothing cleared scores 1 (${game.score(one)})`);
}

/* 6. Recorded rev-11 runs and the perfect run */
section("Recorded matchupRev 11 runs replay unchanged; the flawless run is 200");
{
  const rec = JSON.parse(readFileSync("scripts/fixtures/gemstone-standard-runs.json", "utf8")) as { perfect: { seed: number }; runs: { level: string; seed: number; score: number; stateHash: number; raw: string }[] };
  for (const r of rec.runs) {
    const result = replayMatchupRun(r.seed, unzip(r.raw), MATCHUP_REV_STD);
    ok(!result.flagged && result.score === r.score && fnv(JSON.stringify(result.state)) === r.stateHash, `rev 11 ${r.level} seed ${r.seed}: ${r.score} (got ${result.score})`);
  }
  // The arcade-standard entry moved on to matchupRev 12 (gemstone-rev12-check proves its perfect run); matchupRev 11's
  // recorded flawless run still replays to 200 with every matchupRev 11 part at its maximum.
  const rec11 = rec as unknown as { perfect: { seed: number; raw: string } };
  const run11 = replayMatchupRun(rec11.perfect.seed, unzip(rec11.perfect.raw), MATCHUP_REV_STD);
  const parts11 = matchupStdParts(run11.state as MatchupState) as unknown as Record<string, number>;
  ok(!run11.flagged && run11.score === 200, `the recorded matchupRev 11 flawless run replays to 200 (${run11.score})`);
  const max11: Record<string, number> = { core: MATCHUP_V11_CORE_MAX, treasure: MATCHUP_V11_TREASURE_MAX, goals: MATCHUP_V11_GOALS_MAX, ice: MATCHUP_V11_ICE_MAX, big: MATCHUP_V11_BIG_MAX };
  for (const [key, max] of Object.entries(max11)) ok(parts11[key] === max, `the matchupRev 11 flawless run's ${key} is at its max ${max} (${parts11[key]})`);
  const perfect = STANDARD.perfect();
  ok(perfect.score === 200, `the arcade-standard entry's flawless run replays to 200 (${perfect.score})`);
  for (const part of STANDARD.parts) ok(perfect.parts[part.key] === part.max, `the entry's flawless run's ${part.key} is at its max ${part.max} (${perfect.parts[part.key]})`);
  ok(STANDARD.id === "matchup" && STANDARD.stampKey === "matchupRev" && STANDARD.stamp === MATCHUP_REV_SIX, "the standard module names matchupRev 12 (matchupRev 11's successor)");
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL gemstone-standard-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS gemstone-standard-check: ${checks} checks in ${((Date.now() - started) / 1000).toFixed(1)} s — older stamps unchanged, matchupRev 11's parts to 200, treasure swaps, four goal levels, scores rising with skill`);
