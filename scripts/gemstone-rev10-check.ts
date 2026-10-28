/**
 * Gemstone matchupRev 10 (27 Oct 2026, Joe's phone-test notes; docs/phone-notes-oct-2026/gemstone.md):
 *  1. Rooms deal matchupRev 10; the help reads its curve; every older revision still runs 60 s.
 *  2. The run lasts 90 s (sim, server replay and the round's clock).
 *  3. Ice: laid once at the start (MATCHUP_V10_ICE cells, rows 4–9) and never refreshed; a swap into or out
 *     of an iced cell goes through only when it makes a line of three; treasure never moves.
 *  4. The hint only offers swaps the sim accepts.
 *  5. Real play through the server's encode + replay: no desync, 90 s, the score is its breakdown, anyone who
 *     plays scores above 0, and the medians rise weak → good → elite on the same seeds.
 *  6. Look: no gem counter at the top; the treasure is bronze. Help and intro say 90 seconds.
 * Older revisions' replays are proved unchanged by e6-check, matchup-check and replay-check.
 *
 *   bun scripts/gemstone-rev10-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/matchup";
import { bandTotal } from "../src/lib/arcade/scoreBands";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { puzzleDef } from "../src/lib/duel/registry";
import { encodeMatchupRun, replayMatchupRun } from "../src/lib/duel/matchup";
import {
  matchupCheckpoint,
  matchupGameFor,
  matchupHintSwap,
  matchupIceParts,
  matchupIndex,
  matchupRuns,
  matchupRowsFor,
  matchupWorldHFor,
  MATCHUP_REV_GOALS,
  MATCHUP_REV_ICE,
  MATCHUP_RUN_TICKS,
  MATCHUP_SIZE,
  MATCHUP_TREASURE,
  MATCHUP_V10_BAND_CURVE,
  MATCHUP_V10_ICE,
  MATCHUP_V10_RUN_TICKS,
  MATCHUP_V9_ROWS,
  MATCHUP_V9_TREASURE_ROW,
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
const game = matchupGameFor(MATCHUP_REV_ICE);
const iceCount = (s: MatchupState) => (s.ice ?? []).reduce((n, v) => n + (v ? 1 : 0), 0);

/* 1. Stamps */
section("Rooms deal matchupRev 10; older revisions keep 60 s");
for (let k = 0; k < 5; k++) ok((generatePuzzle("matchup") as any).matchupRev === MATCHUP_REV_ICE, "rooms deal matchupRev 10");
ok(LIVE_BANDS.matchup.rev === MATCHUP_REV_ICE && LIVE_BANDS.matchup.curve === MATCHUP_V10_BAND_CURVE, "the help reads matchupRev 10's curve");
for (const rev of [undefined, 2, 3, 4, 5, 6, 7, 8, 9]) {
  ok(matchupGameFor(rev).runTicks === MATCHUP_RUN_TICKS && MATCHUP_RUN_TICKS === 3600, `matchupRev ${rev ?? "none"}: 60 s`);
  const s = matchupGameFor(rev).init(5) as MatchupState;
  ok(!("iceSwap" in s), `matchupRev ${rev ?? "none"}: no iceSwap field`);
}
ok(matchupWorldHFor(MATCHUP_REV_ICE) === MATCHUP_V9_WORLD_H && matchupRowsFor(MATCHUP_REV_ICE) === MATCHUP_V9_ROWS, "the 7 × 10 board in the 390 × 720 world");
{
  const demo = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/matchupRev !== MATCHUP_REV_ICE\) return null/.test(demo), "Gemstone's demo stays stopped until recorded on matchupRev 10");
}

/* 2. 90 s */
section("The run lasts 90 s");
ok(game.runTicks === MATCHUP_V10_RUN_TICKS && MATCHUP_V10_RUN_TICKS === 5400, "matchupRev 10 runs 5,400 ticks");
{
  let s = game.init(3) as MatchupState;
  for (let t = 0; t < 3600; t++) s = game.step(s, null) as MatchupState;
  ok(!game.isOver(s), "still running at 60 s");
  for (let t = 3600; t < 5400; t++) s = game.step(s, null) as MatchupState;
  ok(game.isOver(s) && s.endedTick === 5400, "over at 90 s");
  ok(game.score(s) === 0, "no input scores 0");
}
ok(puzzleDef("matchup").timeLimitMs === 93_000, "the round's clock is 90 s plus the usual 3 s of slack");

/* 3. Ice */
section("Ice: laid once, swaps into and out of it make a line, never refreshed");
let iceSwapsSeen = 0;
let iceRefusedSeen = 0;
for (let seed = 1; seed <= 60; seed++) {
  const s = game.init(seed) as MatchupState;
  ok(s.iceSwap === 1 && s.goals === 1, `seed ${seed}: a matchupRev 10 state`);
  ok(iceCount(s) === MATCHUP_V10_ICE && (s.ice ?? []).every((v, i) => !v || i >= 4 * MATCHUP_SIZE), `seed ${seed}: ${MATCHUP_V10_ICE} frozen cells in rows 4–9 (${iceCount(s)})`);
  const t = s.cells.indexOf(MATCHUP_TREASURE);
  ok(t >= MATCHUP_V9_TREASURE_ROW * MATCHUP_SIZE && t < (MATCHUP_V9_TREASURE_ROW + 1) * MATCHUP_SIZE, `seed ${seed}: the treasure in row ${MATCHUP_V9_TREASURE_ROW}`);
  for (let r = 0; r < MATCHUP_V9_ROWS; r++)
    for (let c = 0; c < MATCHUP_SIZE; c++)
      for (const [r2, c2] of [[r, c + 1], [r + 1, c]] as const) {
        if (r2 >= MATCHUP_V9_ROWS || c2 >= MATCHUP_SIZE) continue;
        const a = matchupIndex(r, c), b = matchupIndex(r2, c2);
        const after = game.step(s, { t: 1, k: 3, a: r, b: c, c: r2, d: c2 }) as MatchupState;
        const accepted = after.swaps === 1;
        const cells = [...s.cells];
        [cells[a], cells[b]] = [cells[b]!, cells[a]!];
        const line = matchupRuns(cells).some((run) => run.cells.includes(a) || run.cells.includes(b));
        if (s.cells[a] === MATCHUP_TREASURE || s.cells[b] === MATCHUP_TREASURE) ok(!accepted, `seed ${seed}: the treasure never moves`);
        else if (s.ice?.[a] || s.ice?.[b]) {
          ok(accepted === line, `seed ${seed} (${r},${c})↔(${r2},${c2}): an ice swap goes through exactly when it makes a line`);
          if (accepted) iceSwapsSeen++;
          else iceRefusedSeen++;
        }
      }
}
ok(iceSwapsSeen > 10 && iceRefusedSeen > 10, `ice swaps both made (${iceSwapsSeen}) and refused (${iceRefusedSeen}) on the first boards`);

/* 4 and 5. Real play */
section("Real play through the server replay: ice never refreshed, hints valid, scores rise with skill");
const spec: any = GAME_BY_TYPE.get("matchup" as never)!;
const LEVELS: SkillLevel[] = ["weak", "good", "elite"];
const scores: Record<string, number[]> = { weak: [], good: [], elite: [] };
let levelsMet = 0;
let iceBrokenInSwaps = 0;
for (const level of LEVELS)
  for (let n = 0; n < 8; n++) {
    const seed = spec.seedFor(n);
    const events = bot({ game, seed, rev: MATCHUP_REV_ICE, human: new Human("matchup", seed, level), fixes: true }).events ?? [];
    const byTick = new Map(events.map((e: any) => [e.t, e]));
    let s = game.init(seed) as MatchupState;
    const checkpoints: any[] = [];
    while (!game.isOver(s)) {
      const prev = s;
      if (n < 2 && s.tick % 97 === 0 && s.tick >= (s.busyUntil ?? 0)) {
        const h = matchupHintSwap(s);
        if (h) ok((game.step(s, { t: s.tick + 1, k: 3, a: h.row1, b: h.col1, c: h.row2, d: h.col2 }) as MatchupState).swaps === s.swaps + 1, `${level} #${n} tick ${s.tick}: the hint is a swap the sim accepts`);
      }
      s = game.step(s, (byTick.get(s.tick + 1) as any) ?? null) as MatchupState;
      if (s.tick % 300 === 0) checkpoints.push(matchupCheckpoint(s));
      ok(iceCount(s) <= iceCount(prev), `${level} #${n} tick ${s.tick}: ice came back`);
      if (iceCount(s) < iceCount(prev)) iceBrokenInSwaps++;
      if ((s.levels ?? 0) > (prev.levels ?? 0)) levelsMet++;
    }
    ok(s.tick === 5400, `${level} #${n}: the run reaches 90 s`);
    const score = game.score(s);
    ok(score === bandTotal(matchupIceParts(s), Boolean(s.acted), 200), `${level} #${n}: the score is its breakdown`);
    ok(score > 0, `${level} #${n}: a played run scores above 0 (${score})`);
    const raw = encodeMatchupRun({ seed, claimedScore: score, events: events as any, endTick: s.tick, checkpoints });
    const replay = replayMatchupRun(seed, raw, MATCHUP_REV_ICE);
    ok(!replay.flagged && replay.score === score && replay.endedSeconds === 90, `${level} #${n}: replays to ${score} over 90 s (got ${replay.score}${replay.flagged ? `, flagged: ${replay.reason}` : ""})`);
    scores[level]!.push(score);
  }
ok(levelsMet > 0 && iceBrokenInSwaps > 0, `goals met (${levelsMet}) and ice broken (${iceBrokenInSwaps}) in real play`);
const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
ok(median(scores.weak!) < median(scores.good!) && median(scores.good!) < median(scores.elite!), `medians rise weak ${median(scores.weak!)} < good ${median(scores.good!)} < elite ${median(scores.elite!)}`);
// matchupRev 9 replays are unchanged: a rev-9 run of the same log still stops at 60 s.
{
  const seed = spec.seedFor(0);
  const nine = matchupGameFor(MATCHUP_REV_GOALS);
  let s = nine.init(seed) as MatchupState;
  while (!nine.isOver(s)) s = nine.step(s, null) as MatchupState;
  ok(s.tick === 3600, "matchupRev 9 still ends at 60 s");
}

/* 6. Look and text */
section("Look and text");
{
  const art = readFileSync("src/lib/arcade/matchup.renderer.ts", "utf8");
  ok(!/drawCollection|COLLECT_X/.test(art), "the gem counter at the top is gone");
  ok(/#C8803E/.test(art) && !/#FFCF4A/.test(art), "the treasure is bronze (no gold medallion)");
  const help = PUZZLE_INSTRUCTIONS.matchup.how.map((l) => `${l.action} ${l.detail}`).join(" ");
  ok(/Ninety seconds/.test(help) && !/Sixty seconds/.test(help), "the help says ninety seconds");
  ok(/line of three/.test(help) && !/with more ice/.test(help), "the help says ice swaps need a line and ice doesn't refresh");
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL gemstone-rev10-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS gemstone-rev10-check: ${checks} checks — matchupRev 10's 90 s run, ice swaps that make a line, ice laid once, real play replayed, scores rising with skill`);
