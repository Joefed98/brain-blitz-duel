/**
 * Gemstone matchupRev 12: six goals shown at once and six treasures (docs/arcade-standard/matchup.md, "matchupRev 12"):
 *  1. Older stamps unchanged: every run in scripts/fixtures/gemstone-rev12-legacy.json (bot runs on matchupRev 10 and
 *     11, recorded on main before the change by scripts/gemstone-rev12-legacy.ts) replays through the server to the
 *     same score and the same final state; older states carry no matchupRev 12 field (older stamps still:
 *     gemstone-standard-check's gemstone-standard-legacy.json).
 *  2. Rooms deal matchupRev 12; the help, intro, demo gate, reveal and the arcade-standard entry follow it; 90 s on the
 *     7 × 10 board.
 *  3. The deal: matchupRev 11's board, queues, plan, rng and ice for the same seed; the six goals are the ladder in a
 *     seeded order (the same for every player; same seed → same init; the k-th treasure the same whatever is played).
 *  4. Rules: six treasures (the plan's first six columns, one at a time); every gem of a colour counts toward its goal;
 *     a goal met stays met; `levels` counts the goals met; the treasure swap and hint rules as matchupRev 11.
 *  5. Scoring: core = gems cleared on one straight line to 108 at MATCHUP_V12_CORE_GEMS; treasure 6 each (36); goals 6
 *     each (36); ice 1 a cell (10); big lines 2 each (10); parts total 200; any played run scores at least 1, none 0.
 *  6. Real play through the server's encode + replay (recorded rev-12 runs, fresh bot runs): no desync, the score is its
 *     parts, all six treasures and goals reachable, medians rise weak < good < near < flawless; the recorded flawless
 *     run is 200 with every part at its maximum.
 *
 *   bun scripts/gemstone-rev12-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { hasScorePart } from "../src/lib/duel/scoreList";
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
  matchupCoreGemsOf,
  matchupGameFor,
  matchupGoalsMet,
  matchupGoalsOf,
  matchupHintSwap,
  matchupRowsFor,
  matchupStdBandParts,
  matchupStdParts,
  matchupStdScore,
  matchupTreasuresOf,
  matchupV12GoalNeed,
  matchupWorldHFor,
  MATCHUP_REV_SIX,
  MATCHUP_REV_STD,
  MATCHUP_SIZE,
  MATCHUP_TREASURE,
  MATCHUP_V10_ICE,
  MATCHUP_V12_BAND_CURVE,
  MATCHUP_V12_BIG_MAX,
  MATCHUP_V12_BIG_PTS,
  MATCHUP_V12_CORE_GEMS,
  MATCHUP_V12_CORE_MAX,
  MATCHUP_V12_GOAL_LADDER,
  MATCHUP_V12_GOAL_PTS,
  MATCHUP_V12_GOALS,
  MATCHUP_V12_GOALS_MAX,
  MATCHUP_V12_ICE_MAX,
  MATCHUP_V12_ICE_PTS,
  MATCHUP_V12_TREASURE_MAX,
  MATCHUP_V12_TREASURE_PTS,
  MATCHUP_V12_TREASURES,
  MATCHUP_V9_ROWS,
  MATCHUP_V9_WORLD_H,
  type MatchupState,
} from "../src/lib/arcade/matchup";

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  checks++;
  if (!cond && failures.length < 60) failures.push(label);
}
const section = (title: string) => console.log(`— ${title}`);
const started = Date.now();
const spec: any = GAME_BY_TYPE.get("matchup" as never)!;
const game = matchupGameFor(MATCHUP_REV_SIX);
const eleven = matchupGameFor(MATCHUP_REV_STD);
const unzip = (b64: string) => gunzipSync(Buffer.from(b64, "base64")).toString();
const iceCount = (s: MatchupState) => (s.ice ?? []).reduce((n, v) => n + (v ? 1 : 0), 0);
const sorted = (v: readonly number[]) => [...v].sort((a, b) => a - b);

/* 1. Older stamps */
section("Older stamps (matchupRev 10 and 11) replay and score exactly as before");
{
  const legacy = JSON.parse(readFileSync("scripts/fixtures/gemstone-rev12-legacy.json", "utf8")) as { runs: { rev: number; level: string; seed: number; score: number; stateHash: number; raw: string }[] };
  const revs = new Map<number, number>();
  for (const r of legacy.runs) {
    const result = replayMatchupRun(r.seed, unzip(r.raw), r.rev);
    ok(!result.flagged && result.score === r.score && fnv(JSON.stringify(result.state)) === r.stateHash, `matchupRev ${r.rev} ${r.level} seed ${r.seed}: ${r.score} as on main (got ${result.score}${result.flagged ? ", flagged" : ""})`);
    ok(!("six" in result.state) && !("goalNeed" in result.state), `matchupRev ${r.rev} ${r.level}: no matchupRev 12 field`);
    if (r.rev === MATCHUP_REV_STD) ok(matchupTreasuresOf(result.state) === 4 && matchupGoalsOf(result.state) === 10 && matchupCoreGemsOf(result.state) === 375, `matchupRev 11 ${r.level}: still four treasures, ten goals, the core at 375`);
    revs.set(r.rev, (revs.get(r.rev) ?? 0) + 1);
  }
  ok(legacy.runs.length >= 35 && (revs.get(10) ?? 0) >= 7 && (revs.get(11) ?? 0) >= 28, `${legacy.runs.length} legacy runs on matchupRev 10 and 11`);
  for (const rev of [undefined, 2, 5, 8, 9, 10, 11]) {
    const s = matchupGameFor(rev).init(7) as MatchupState;
    ok(!("six" in s) && !("goalNeed" in s), `matchupRev ${rev ?? "none"}: init has no matchupRev 12 field`);
  }
}

/* 2. Stamps and text */
section("Rooms deal matchupRev 12; help, intro, demo, reveal and the standard entry follow it");
for (let k = 0; k < 5; k++) ok((generatePuzzle("matchup") as any).matchupRev === MATCHUP_REV_SIX && MATCHUP_REV_SIX === 12, "rooms deal matchupRev 12");
ok(LIVE_BANDS.matchup.rev === MATCHUP_REV_SIX && LIVE_BANDS.matchup.curve === MATCHUP_V12_BAND_CURVE, "the help reads matchupRev 12's core line");
ok(MATCHUP_V12_BAND_CURVE.units.length === 2 && MATCHUP_V12_BAND_CURVE.units[1] === MATCHUP_V12_CORE_GEMS && MATCHUP_V12_BAND_CURVE.points[1] === MATCHUP_V12_CORE_MAX, "the core is one straight line (two knots), 0 → 108");
ok(game.runTicks === 5400 && matchupWorldHFor(MATCHUP_REV_SIX) === MATCHUP_V9_WORLD_H && matchupRowsFor(MATCHUP_REV_SIX) === MATCHUP_V9_ROWS, "90 s on the 7 × 10 board in the 390 × 720 world");
ok(roundMaxFor("matchup") === 200, "the round maximum stays 200");
ok(entry.rev === MATCHUP_REV_SIX && entry.field === "matchupRev" && entry.parts.map((p) => `${p.key} ${p.max}`).join(", ") === "core 108, treasure 36, goals 36, ice 10, big 10", `the arcade-standard entry: ${entry.parts.map((p) => `${p.key} ${p.max}`).join(", ")}`);
{
  const demo = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/matchupRev !== MATCHUP_REV_SIX\) return null/.test(demo), "the intro demo stays stopped until recorded on matchupRev 12");
  const help = PUZZLE_INSTRUCTIONS.matchup.score;
  for (const text of [`Treasure: ${MATCHUP_V12_TREASURE_PTS} for each treasure brought down, up to ${MATCHUP_V12_TREASURE_MAX}.`, `Goals: ${MATCHUP_V12_GOAL_PTS} for each of the ${MATCHUP_V12_GOALS} colour goals met, up to ${MATCHUP_V12_GOALS_MAX}.`, `Ice: ${MATCHUP_V12_ICE_PTS} for each frozen cell broken, up to ${MATCHUP_V12_ICE_MAX}.`, `Big lines: ${MATCHUP_V12_BIG_PTS} for each line of 4 or 5, up to ${MATCHUP_V12_BIG_MAX}.`, "Total 200."])
    ok(help.includes(text), `the help says "${text}": ${help}`);
  // Text pass (4 Nov 2026): the help is a list, one line a part ("More gems cleared … make 200" was the old wording).
  ok(hasScorePart(help, "Gems", MATCHUP_V12_CORE_MAX), `the help's gems line: ${help}`);
  const how = PUZZLE_INSTRUCTIONS.matchup.how.map((l) => `${l.action} ${l.detail}`).join(" ");
  ok(/Six goals/.test(how) && /6 come a round/.test(how) && !/Four levels/.test(how), "the help's rules: six goals, six treasures, no levels");
  // Text pass (4 Nov 2026): the intro names the bonuses in one plain sentence (no internal figures).
  ok(/gems/.test(INTRO_SCORE.matchup) && /treasure, colour goals, ice and big lines/.test(INTRO_SCORE.matchup) && INTRO_SCORE.matchup.endsWith("Up to 200."), `the intro's score line: ${INTRO_SCORE.matchup}`);
  const renderer = readFileSync("src/lib/arcade/matchup.renderer.ts", "utf8");
  ok(/if \(state\.six\) \{\s*drawSixGoalsPanel/.test(renderer) && /for \(let kind = 0; kind < MATCHUP_V12_GOALS; kind\+\+\)/.test(renderer), "the panel under the board draws the six goals side by side");
}

/* 3. The deal */
section("The deal: matchupRev 11's board, the six goals from the seed, the same for everyone");
{
  const ladder = sorted(MATCHUP_V12_GOAL_LADDER);
  ok(MATCHUP_V12_GOAL_LADDER.length === MATCHUP_V12_GOALS && MATCHUP_V12_GOALS === 6 && MATCHUP_V12_TREASURES === 6, "six goals and six treasures");
  const orders = new Set<string>();
  for (let seed = 1; seed <= 300; seed++) {
    const s = game.init(seed) as MatchupState;
    const t = eleven.init(seed) as MatchupState;
    ok(s.six === 1 && s.std === 1 && s.iceSwap === 1 && s.goals === 1 && s.gemsCleared === 0 && s.bigLines === 0, `seed ${seed}: a matchupRev 12 state`);
    ok(JSON.stringify([s.cells, s.queues, s.plan, s.rng, s.ice, s.treasurePlaced]) === JSON.stringify([t.cells, t.queues, t.plan, t.rng, t.ice, t.treasurePlaced]), `seed ${seed}: matchupRev 11's board, queues, plan, rng and ice`);
    ok(iceCount(s) === MATCHUP_V10_ICE, `seed ${seed}: exactly ${MATCHUP_V10_ICE} frozen cells (${iceCount(s)})`);
    ok(JSON.stringify(sorted(s.goalNeed ?? [])) === JSON.stringify(ladder) && JSON.stringify(s.goalLeft) === JSON.stringify(s.goalNeed), `seed ${seed}: the six goals are the ladder (${s.goalNeed?.join(",")})`);
    ok(JSON.stringify(s.goalNeed) === JSON.stringify(matchupV12GoalNeed(seed)), `seed ${seed}: the goals come from the seed alone`);
    ok(matchupGoalsMet(s) === 0 && (s.levels ?? 0) === 0, `seed ${seed}: no goal met at the start`);
    orders.add((s.goalNeed ?? []).join(","));
    if (seed <= 20) ok(JSON.stringify(game.init(seed)) === JSON.stringify(s), `seed ${seed}: the same init every time`);
  }
  ok(orders.size >= 200, `the goals' order varies with the seed (${orders.size} orders over 300 seeds)`);
  // The goals and the k-th treasure are the seed's, whatever is played (weak, good and elite logs).
  let compared = 0;
  for (let n = 0; n < 3; n++) {
    const seed = spec.seedFor(n + 20);
    const lists = roomIdentity.logs(seed).map((l) => roomIdentity.scheduleOf(seed, MATCHUP_REV_SIX, l.log));
    const upto = Math.min(...lists.map((l) => l.endTick));
    const cut = (l: { entries: { t: number; what: string }[] }) => l.entries.filter((e) => e.t <= upto).map((e) => e.what).join(" | ");
    ok(lists.every((l) => cut(l) === cut(lists[0]!)), `seed ${seed}: the ice, goals and treasure columns agree for every log`);
    ok(lists.every((l) => l.entries.some((e) => e.what.startsWith("goals "))), `seed ${seed}: the schedule lists the six goals`);
    compared += upto;
  }
  ok(compared >= 3, `goals and treasures compared across logs (${compared})`);
}

/* 4 + 6. Rules and real play */
section("Rules and real play: six treasures, six goals, the score its parts, through the server replay");
const LEVELS: SkillLevel[] = ["weak", "good", "near", "perfect"];
const scores: Record<string, number[]> = {};
let maxGoals = 0;
let maxPlaced = 0;
let maxTreasures = 0;
for (const level of LEVELS)
  for (let n = 0; n < 7; n++) {
    const seed = spec.seedFor(n);
    const events = bot({ game, seed, rev: MATCHUP_REV_SIX, human: new Human("matchup", seed, level), fixes: true }).events ?? [];
    const byTick = new Map(events.map((e: any) => [e.t, e]));
    let s = game.init(seed) as MatchupState;
    const cols = s.plan!.treasureCols;
    const need = s.goalNeed!;
    const cleared = [0, 0, 0, 0, 0, 0];
    const checkpoints: any[] = [];
    while (!game.isOver(s)) {
      const prev = s;
      if (n < 2 && s.tick % 61 === 0 && s.tick + 1 >= (s.busyUntil ?? 0)) {
        const h = matchupHintSwap(s);
        if (h) ok((game.step(s, { t: s.tick + 1, k: 3, a: h.row1, b: h.col1, c: h.row2, d: h.col2 }) as MatchupState).swaps === s.swaps + 1, `${level} #${n} tick ${s.tick}: the hint is a swap the sim accepts`);
      }
      s = game.step(s, (byTick.get(s.tick + 1) as any) ?? null) as MatchupState;
      if (s.tick % 300 === 0) checkpoints.push(matchupCheckpoint(s));
      if ((s.treasurePlaced ?? 0) > (prev.treasurePlaced ?? 0)) {
        const at = s.cells.indexOf(MATCHUP_TREASURE);
        ok(at % MATCHUP_SIZE === cols[(s.treasurePlaced ?? 1) - 1] && Math.floor(at / MATCHUP_SIZE) === 3, `${level} #${n}: treasure ${s.treasurePlaced} in the plan's column, row 4`);
        ok(prev.cells.indexOf(MATCHUP_TREASURE) < 0 || (s.treasures ?? 0) > (prev.treasures ?? 0), `${level} #${n}: one treasure at a time`);
      }
      if (s.swaps > prev.swaps) for (const a of s.lastAnimation) for (const i of a.cleared) { const k = a.before[i] ?? -1; if (k >= 0 && k < 6) cleared[k] = (cleared[k] ?? 0) + 1; }
      ok(s.goalNeed === prev.goalNeed || JSON.stringify(s.goalNeed) === JSON.stringify(need), `${level} #${n}: the goals never change`);
      ok((s.goalLeft ?? []).every((left, k) => left === Math.max(0, need[k]! - cleared[k]!)), `${level} #${n} tick ${s.tick}: each goal counts every gem of its colour cleared`);
      ok((s.levels ?? 0) === matchupGoalsMet(s) && matchupGoalsMet(s) >= matchupGoalsMet(prev) && (s.level ?? 0) === 0, `${level} #${n}: levels count the goals met, a goal stays met, no level follows`);
      ok(iceCount(s) <= iceCount(prev), `${level} #${n}: ice never comes back`);
    }
    maxGoals = Math.max(maxGoals, matchupGoalsMet(s));
    maxPlaced = Math.max(maxPlaced, s.treasurePlaced ?? 0);
    maxTreasures = Math.max(maxTreasures, s.treasures ?? 0);
    ok((s.treasurePlaced ?? 0) <= MATCHUP_V12_TREASURES && (s.treasures ?? 0) <= MATCHUP_V12_TREASURES, `${level} #${n}: at most ${MATCHUP_V12_TREASURES} treasures (${s.treasurePlaced} placed)`);
    const score = game.score(s);
    const p = matchupStdParts(s);
    ok(score === Math.max(1, p.core + p.treasure + p.goals + p.ice + p.big), `${level} #${n}: the score is its parts`);
    ok(score >= 1, `${level} #${n}: a played run scores at least 1 (${score})`);
    const bp = matchupStdBandParts(s);
    ok(bp.points === p.core && bp.bonus === p.treasure + p.goals + p.ice + p.big && bp.bonusText?.includes(`goals ${matchupGoalsMet(s)}/6`), `${level} #${n}: the band breakdown is the parts (${bp.bonusText})`);
    const raw = encodeMatchupRun({ seed, claimedScore: score, events: events as any, endTick: s.tick, checkpoints });
    const replay = replayMatchupRun(seed, raw, MATCHUP_REV_SIX);
    ok(!replay.flagged && replay.score === score && replay.endedSeconds === 90, `${level} #${n}: replays to ${score} over 90 s (got ${replay.score}${replay.flagged ? `, flagged: ${replay.reason}` : ""})`);
    const reveal = buildArcadeReveal("matchup", replay, replay.score);
    ok(reveal?.axis.max === MATCHUP_V12_CORE_GEMS && reveal.tiles.some((t) => t.label === "Goals" && t.value.endsWith("/ 6")) && reveal.tiles.some((t) => t.label === "Treasure" && t.value.endsWith("/ 6")), `${level} #${n}: the reveal shows gems cleared to ${MATCHUP_V12_CORE_GEMS}, goals and treasure out of 6`);
    (scores[level] ??= []).push(score);
  }
ok(maxGoals === MATCHUP_V12_GOALS && maxPlaced === MATCHUP_V12_TREASURES, `real play meets all six goals (${maxGoals}) and places all six treasures (${maxPlaced}; ${maxTreasures} brought down at most)`);
const median = (v: number[]) => sorted(v)[Math.floor(v.length / 2)]!;
const meds = LEVELS.map((l) => median(scores[l]!));
ok(meds.every((m, i) => i === 0 || m > meds[i - 1]!), `medians rise ${LEVELS.map((l, i) => `${l} ${meds[i]}`).join(" < ")}`);

/* 5. Scoring */
section("Scoring: straight core, fixed features, total 200, at least 1");
{
  const base = { ...(game.init(4) as MatchupState), acted: 1 };
  const withState = (o: Partial<MatchupState>) => ({ ...base, ...o }) as MatchupState;
  let straight = true;
  for (let g = 0; g <= MATCHUP_V12_CORE_GEMS + 50; g++) {
    const core = matchupStdParts(withState({ gemsCleared: g })).core;
    if (core !== Math.min(MATCHUP_V12_CORE_MAX, Math.floor((MATCHUP_V12_CORE_MAX * g) / MATCHUP_V12_CORE_GEMS)) || core !== bandPoints(MATCHUP_V12_BAND_CURVE, g)) straight = false;
  }
  ok(straight, `core = floor(108 × gems ÷ ${MATCHUP_V12_CORE_GEMS}), capped at 108`);
  ok(matchupStdParts(withState({ gemsCleared: 100000 })).core === MATCHUP_V12_CORE_MAX, "the core caps at 108");
  for (let k = 0; k <= 8; k++) ok(matchupStdParts(withState({ treasures: k })).treasure === Math.min(36, 6 * k), `${k} treasures → ${Math.min(36, 6 * k)}`);
  for (let k = 0; k <= 12; k++) ok(matchupStdParts(withState({ iceBroken: k })).ice === Math.min(10, k), `${k} ice → ${Math.min(10, k)}`);
  for (let k = 0; k <= 8; k++) ok(matchupStdParts(withState({ bigLines: k })).big === Math.min(10, 2 * k), `${k} big lines → ${Math.min(10, 2 * k)}`);
  for (let k = 0; k <= 6; k++) {
    const left = [...(base.goalNeed ?? [])].map((v, i) => (i < k ? 0 : v));
    ok(matchupGoalsMet(withState({ goalLeft: left })) === k && matchupStdParts(withState({ goalLeft: left })).goals === 6 * k, `${k} goals met → ${6 * k}`);
  }
  ok(MATCHUP_V12_CORE_MAX + MATCHUP_V12_TREASURE_MAX + MATCHUP_V12_GOALS_MAX + MATCHUP_V12_ICE_MAX + MATCHUP_V12_BIG_MAX === 200 && entry.parts.reduce((n, p) => n + p.max, 0) === 200, "the parts' maxima total 200");
  ok(MATCHUP_V12_TREASURE_MAX === MATCHUP_V12_TREASURES * MATCHUP_V12_TREASURE_PTS && MATCHUP_V12_GOALS_MAX === MATCHUP_V12_GOALS * MATCHUP_V12_GOAL_PTS && MATCHUP_V12_ICE_MAX === MATCHUP_V10_ICE * MATCHUP_V12_ICE_PTS, "6 treasures × 6, 6 goals × 6, 10 ice × 1");
  const full = withState({ gemsCleared: 999, treasures: 6, iceBroken: 10, bigLines: 9, goalLeft: [0, 0, 0, 0, 0, 0] });
  ok(matchupStdScore(full) === 200 && game.score(full) === 200, "every part full → 200");
  ok(game.score(withState({ gemsCleared: 999, treasures: 5, iceBroken: 10, bigLines: 9, goalLeft: [0, 0, 0, 0, 0, 0] })) === 194, "one treasure short → 194");
  ok(matchupStdScore(withState({})) === 1 && game.score(withState({})) === 1, "a played run with nothing scored → 1");
  ok(game.score({ ...withState({ gemsCleared: 200 }), acted: 0 }) === 0, "no input → 0");
  ok(game.score(withState({ gemsCleared: 200, cascadeExtra: 0 })) === game.score(withState({ gemsCleared: 200, cascadeExtra: 9000, raw: 99999 })), "the cascade multiplier and match points pay nothing");
  let s = game.init(3) as MatchupState;
  while (!game.isOver(s)) s = game.step(s, null) as MatchupState;
  ok(s.tick === 5400 && game.score(s) === 0, "no input scores 0 at 90 s");
  let one = game.init(3) as MatchupState;
  one = game.step(one, { t: 1, k: 3, a: 0, b: 0, c: 0, d: 0 }) as MatchupState;
  while (!game.isOver(one)) one = game.step(one, null) as MatchupState;
  ok(game.score(one) === 1, `a run with one input and nothing cleared scores 1 (${game.score(one)})`);
  // matchupRev 11's scoring is untouched: the same counters score its own amounts.
  const e = { ...(eleven.init(4) as MatchupState), acted: 1, gemsCleared: 375, treasures: 4, iceBroken: 10, bigLines: 5, level: 4, levels: 4, goalLeft: [0, 0, 0, 0, 0, 0] } as MatchupState;
  ok(eleven.score(e) === 200 && matchupStdParts(e).core === 110 && matchupStdParts(e).treasure === 40 && matchupStdParts(e).goals === 30, "matchupRev 11 still scores 110 + 40 + 30 + 10 + 10");
}

/* 6. Recorded rev-12 runs and the perfect run */
section("Recorded matchupRev 12 runs replay unchanged; the flawless run is 200");
{
  const rec = JSON.parse(readFileSync("scripts/fixtures/gemstone-rev12-runs.json", "utf8")) as { perfect: { seed: number }; runs: { level: string; seed: number; score: number; stateHash: number; raw: string }[] };
  for (const r of rec.runs) {
    const result = replayMatchupRun(r.seed, unzip(r.raw), MATCHUP_REV_SIX);
    ok(!result.flagged && result.score === r.score && fnv(JSON.stringify(result.state)) === r.stateHash, `rev 12 ${r.level} seed ${r.seed}: ${r.score} (got ${result.score})`);
  }
  ok(rec.runs.length === 14, `${rec.runs.length} recorded runs`);
  const perfect = (entry.perfect() as StdRun[])[0]!;
  ok(perfect.score === 200, `the recorded flawless run replays to 200 (${perfect.score})`);
  for (const part of entry.parts) ok(perfect.parts?.[part.key] === part.max, `the flawless run's ${part.key} is at its max ${part.max} (${perfect.parts?.[part.key]})`);
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL gemstone-rev12-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS gemstone-rev12-check: ${checks} checks in ${((Date.now() - started) / 1000).toFixed(1)} s — matchupRev 10 and 11 unchanged, matchupRev 12's six goals and six treasures, parts to 200, scores rising with skill`);
