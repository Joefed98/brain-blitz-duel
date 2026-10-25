/**
 * Don't Break the Chain, Depth to 200 (25 Oct 2026, `chainDepthRev: 1`; docs/depth/d3-speed-attention.md).
 *
 *   1. Legacy: every round recorded on main before the change (scripts/fixtures/depth-chain-pair-legacy.json.gz,
 *      scripts/depth/chain-pair-legacy-record.ts) grades to the same score, verdict, time and detail.
 *   2. Dealt: new puzzles carry chainDepthRev 1 and the same boards as before (the stamp changes no play);
 *      the stamp gates the new scoring and older demos stay stopped.
 *   3. Rules: milestones at 10 / 20 / 30 from the tap times, the finish exactly rev 3's up to 150's pace, the
 *      stretch above it only for a clean, fast finish, unfinished below every finish, 200 the ceiling.
 *   4. Bots: the kit players and an elite one, old stamp vs new (median, top 10 %, best); a solid player within
 *      ±10 %, today's 150s 150–165, only elite play 190+.
 *
 *   bun scripts/depth-chain-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { generateChain } from "../src/lib/duel/chain.server";
import { chainBoardIndex, chainDemoCompatible, chainRequiredAt, chainRules, encodeChainAnswer, type ChainTap } from "../src/lib/duel/chain";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { rev3Finish } from "../src/lib/duel/puzzleScoreRev3";
import { CHAIN_TIME_MS, type ChainPuzzleData, type PuzzleData } from "../src/lib/duel/types";
import {
  CHAIN_DEPTH_REV,
  CHAIN_FLOW_FULL_MS,
  CHAIN_FLOW_ZERO_MS,
  CHAIN_MILESTONE_POINTS,
  CHAIN_STRETCH,
  chainMilestonePoints,
  chainMilestones,
  chainUsesDepth,
} from "../src/lib/duel/depth/chain";
import { BOT_LEVELS, botRuns, levelRow, printTable, quantile } from "./depth/chain-pair-bots";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}

/* ------------------------------------------------------------------ 1. legacy */
interface Recorded { type: string; seed: number; label: string; puzzle: PuzzleData; answer: string; ms: number; score: number; isCorrect: boolean; extra: unknown; storedMs: number }
const recorded = (JSON.parse(gunzipSync(readFileSync("scripts/fixtures/depth-chain-pair-legacy.json.gz")).toString()) as Recorded[]).filter((r) => r.type === "chain");
let same = 0;
for (const r of recorded) {
  const g = gradeAnswer(r.puzzle, r.answer, r.ms);
  const match = g.score === r.score && g.isCorrect === r.isCorrect && g.storedMs === r.storedMs && JSON.stringify(g.extra) === JSON.stringify(r.extra);
  if (match) same++;
  else ok(false, `legacy ${r.seed} ${r.label}: ${r.score} → ${g.score}`);
}
ok(recorded.length >= 200 && same === recorded.length, `legacy rounds regrade identically (${same}/${recorded.length})`);
ok(recorded.every((r) => !chainUsesDepth(r.puzzle as ChainPuzzleData) && r.score <= 150), "legacy rounds are unstamped and at most 150");

/* ------------------------------------------------------------------ 2. dealt */
const dealt = withSeededRandom(5, () => generatePuzzle("chain")) as ChainPuzzleData;
ok(dealt.chainDepthRev === CHAIN_DEPTH_REV && chainUsesDepth(dealt), "new puzzles deal chainDepthRev 1");
for (let seed = 0; seed < 50; seed++) {
  const p = generateChain(seed);
  const { chainDepthRev: _rev, ...rest } = p;
  ok(_rev === CHAIN_DEPTH_REV && JSON.stringify(rest.boards) === JSON.stringify(generateChain(seed).boards), `seed ${seed}: stamped, same boards`);
}
ok(roundMaxFor("chain") === 200, "the chain's maximum is 200");
ok(!chainDemoCompatible({ ...dealt, chainDepthRev: undefined }) && chainDemoCompatible(dealt), "a demo before chainDepthRev 1 stays stopped");

/* ------------------------------------------------------------------ 3. rules */
ok(chainMilestonePoints(CHAIN_FLOW_FULL_MS) === CHAIN_MILESTONE_POINTS && chainMilestonePoints(CHAIN_FLOW_ZERO_MS) === 0 && chainMilestonePoints(1000) === 0, "milestone points: full to none");

/** A clean chain with a fixed gap (ms) between links, the first tap at `start`. */
function cleanChain(puzzle: ChainPuzzleData, gapMs: number, start = 600, links = chainRules(puzzle).length): ChainTap[] {
  const taps: ChainTap[] = [];
  const used: number[][] = [];
  for (let link = 0; link < links; link++) {
    const board = chainBoardIndex(link, puzzle);
    const need = chainRequiredAt(puzzle, link)!;
    const node = puzzle.boards[board]!.findIndex((n, i) => n.shape === need.shape && n.colour === need.colour && !(used[board] ?? []).includes(i));
    (used[board] ??= []).push(node);
    taps.push({ node, t: start + link * gapMs });
  }
  return taps;
}
const unstamped = { ...dealt, chainDepthRev: undefined } as ChainPuzzleData;
for (const gap of [350, 400, 450, 500, 550, 650, 800, 1000]) {
  const taps = cleanChain(dealt, gap);
  const answer = encodeChainAnswer({ taps, reason: "complete" });
  const ms = CHAIN_TIME_MS - taps.at(-1)!.t;
  const g = gradeAnswer(dealt, answer, ms);
  const old = gradeAnswer(unstamped, answer, ms);
  const m = chainMilestones(taps, taps.length);
  const left = ms / CHAIN_TIME_MS;
  const rev3 = rev3Finish("chain", ms, CHAIN_TIME_MS, 1).score;
  ok(g.isCorrect && old.score === rev3, `gap ${gap}: the old stamp scores rev 3's finish (${old.score} vs ${rev3})`);
  ok(m.length === 3 && m.every((x) => x.gapMs === gap), `gap ${gap}: three milestones at the gap`);
  const milestonePts = m.reduce((a, x) => a + x.points, 0);
  if (left <= CHAIN_STRETCH.fastShare) ok(g.score === old.score + milestonePts, `gap ${gap}: below 150's pace the score is rev 3's plus the milestones (${g.score})`);
  else ok(g.score > old.score && g.score <= 200, `gap ${gap}: past 150's pace the clean finish keeps climbing (${old.score} → ${g.score})`);
}
const fastest = cleanChain(dealt, 250);
const top = gradeAnswer(dealt, encodeChainAnswer({ taps: fastest, reason: "complete" }), CHAIN_TIME_MS - fastest.at(-1)!.t);
ok(top.score === 200 && roundMaxFor("chain") === 200, `a very fast, clean chain scores 200 (${top.score})`);
// Unfinished: below every finish, milestones kept.
for (const links of [9, 10, 19, 20, 30, 39]) {
  const taps = cleanChain(dealt, 380, 600, links);
  const wrongTap = { node: taps.at(-1)!.node, t: taps.at(-1)!.t + 300 };
  const g = gradeAnswer(dealt, encodeChainAnswer({ taps: [...taps, wrongTap], reason: "wrong" }), 0);
  const old = gradeAnswer(unstamped, encodeChainAnswer({ taps: [...taps, wrongTap], reason: "wrong" }), 0);
  const pts = chainMilestones(taps, links).reduce((a, x) => a + x.points, 0);
  ok(!g.isCorrect && g.score < 120 && g.score === Math.min(119, old.score + pts), `unfinished ${links} links: rev 3's credit ${old.score} + milestones ${pts} = ${g.score}, below a finish`);
}

/* ------------------------------------------------------------------ texts */
const intro = INTRO_SCORE.chain;
ok(intro.length <= 90 && /\b200\b/.test(intro) && /10, 20 and 30/.test(intro), `intro: ${intro}`);
const help = PUZZLE_INSTRUCTIONS.chain;
ok(/Milestones/.test(help.score) && /\b200\b/.test(help.score) && help.how.some((h) => /Milestones/.test(h.action) && !h.helpOnly), "help and intro explain the milestones");

/* ------------------------------------------------------------------ 4. bots */
const strip = (p: PuzzleData) => ({ ...(p as ChainPuzzleData), chainDepthRev: undefined }) as PuzzleData;
const SEEDS = 40;
const rows = BOT_LEVELS.map(([level, skill]) => levelRow(level, botRuns("chain", skill, level, SEEDS, strip)));
printTable(`Don't Break the Chain, ${SEEDS} room seeds per bot (old = chainDepthRev absent, new = chainDepthRev 1)`, rows);
const row = (l: string) => rows.find((r) => r.level === l)!;
for (const l of ["average", "good", "great"]) {
  const r = row(l);
  ok(Math.abs(r.now.median - r.old.median) <= Math.max(3, 0.1 * r.old.median), `${l}: median within ±10 % (${r.old.median} → ${r.now.median})`);
}
const near = row("near-perfect");
ok(near.old.median >= 145 && near.now.median >= 150 && near.now.median <= 165, `near-perfect (today's 150): 150–165 (${near.now.median})`);
const elite = row("elite");
ok(elite.now.median >= 185 && elite.now.best >= 195, `elite: 190–200 (median ${elite.now.median}, best ${elite.now.best})`);
ok(rows.filter((r) => r.level !== "elite").every((r) => r.now.best < 190), "only elite play reaches 190");
ok(rows.every((r) => r.old.best <= 150 && r.now.best <= 200), "old at most 150, new at most 200");
void quantile;

if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  console.log(`FAIL: depth-chain-check ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: depth-chain-check ${checks} checks (${recorded.length} legacy rounds identical)`);
