/**
 * Shared by depth-eagleeye-check, depth-doubletake-check and depth-tally-check (depth to 200, 25 Oct 2026;
 * docs/depth/d3-speed-attention.md): the legacy fixture replay (scripts/fixtures/depth-attention-legacy.json.gz,
 * recorded on unmodified main by scripts/depth-attention-record.ts), and the old-versus-new score table from the
 * fairness kits' simulated players plus two clean fast players ("150 pace", the speed that reached 150 on the old
 * stamp, and "elite"). Script-only: floats are fine.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { gradeRoomAnswer } from "../src/lib/duel/roomGrade.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { LEVELS, SKILLS, type Skill } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";
import { playToAnswer, type DepthRun } from "./depth-attention-record";

export const FIXTURE = "scripts/fixtures/depth-attention-legacy.json.gz";

let checks = 0;
const failures: string[] = [];
export function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond && failures.length < 400) failures.push(label);
}
export function finish(name: string): void {
  if (failures.length) {
    console.log(failures.slice(0, 60).join("\n"));
    console.log(`FAIL: ${name}: ${failures.length} of ${checks} checks failed`);
    process.exit(1);
  }
  console.log(`PASS: ${name}: ${checks} checks`);
}

/** Every fixture run of `type` grades to its stored score, verdict and extra, in practice and as a room. */
export function replayLegacy(type: PuzzleType): number {
  const runs = (JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as DepthRun[]).filter((r) => r.type === type);
  ok(runs.length >= 90, `${type}: the legacy fixture has its runs (${runs.length})`);
  for (const r of runs) {
    const g = gradeAnswer(r.puzzle, r.answer, r.ms);
    const same = g.score === r.score && g.isCorrect === r.isCorrect && JSON.stringify(g.extra) === JSON.stringify(r.extra);
    ok(same, `${type} seed ${r.seed} ${r.label}: legacy grade changed (${r.score}${r.isCorrect ? "✓" : ""} → ${g.score}${g.isCorrect ? "✓" : ""})`);
    ok(r.score <= 150, `${type} seed ${r.seed} ${r.label}: a legacy round above 150 (${r.score})`);
    const limit = puzzleTimeLimitMs(r.puzzle);
    // As a room: received in the puzzle phase 80 ms after the claim, or in the reveal phase for a time-out (scoring-rev3-check's receipts).
    const startedAt = 1_000_000;
    const room = gradeRoomAnswer(
      r.puzzle,
      { phase: r.ms > 0 ? "puzzle" : "reveal", phaseStartedAt: new Date(startedAt).toISOString(), nowMs: r.ms > 0 ? startedAt + (limit - r.ms) + 80 : startedAt + limit + 100 },
      r.answer,
      r.ms,
    );
    ok(room.graded.score === r.score, `${type} seed ${r.seed} ${r.label}: the room grade differs (${room.graded.score} vs ${r.score})`);
  }
  return runs.length;
}

export const TABLE_SKILLS: { label: string; skill: Skill }[] = [
  ...LEVELS.map((level) => ({ label: level, skill: SKILLS[level] })),
  { label: "150 pace", skill: { level: "near", pace: 0.36, err: 0, reactionMs: 140, reactionSd: 12 } },
  { label: "elite", skill: { level: "near", pace: 0.25, err: 0, reactionMs: 120, reactionSd: 10 } },
];

export interface TableRow {
  label: string;
  old: number[];
  now: number[];
}

const quantile = (xs: number[], f: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(f * s.length))]!;
};

/** Plays each table skill on `seeds` room puzzles under the new stamp and its old-stamp copy (`toOld`). */
export function scoreTable(type: PuzzleType, seeds: number[], toOld: (p: PuzzleData) => PuzzleData): TableRow[] {
  return TABLE_SKILLS.map(({ label, skill }) => {
    const old: number[] = [];
    const now: number[] = [];
    for (const seed of seeds) {
      const p = roomPuzzle(type, seed);
      const o = toOld(p);
      const a = playToAnswer(type, p, seed, `table:${label}`, skill);
      const b = playToAnswer(type, o, seed, `table:${label}`, skill);
      now.push(gradeAnswer(p, a.answer, a.ms).score);
      old.push(gradeAnswer(o, b.answer, b.ms).score);
    }
    return { label, old, now };
  });
}

export function printTable(title: string, rows: TableRow[]): void {
  console.log(`\n${title}`);
  console.log("| Player | old median | old top 10 % | old best | new median | new top 10 % | new best |");
  console.log("| --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows)
    console.log(`| ${r.label} | ${quantile(r.old, 0.5)} | ${quantile(r.old, 0.9)} | ${Math.max(...r.old)} | ${quantile(r.now, 0.5)} | ${quantile(r.now, 0.9)} | ${Math.max(...r.now)} |`);
}

export function median(xs: number[]): number {
  return quantile(xs, 0.5);
}
export function top10(xs: number[]): number {
  return quantile(xs, 0.9);
}

export const TABLE_SEEDS = Array.from({ length: 40 }, (_, i) => 71_000 + i * 31);

/** The intro and "?" help state the new stamp's numbers and the game's 200. */
export async function checkTexts(type: PuzzleType, intro: string, help: string): Promise<void> {
  const { INTRO_SCORE } = await import("../src/lib/duel/introScore");
  const { PUZZLE_INSTRUCTIONS } = await import("../src/lib/duel/instructions");
  const { fillMax } = await import("../src/lib/duel/roundMax");
  // The texts describe the live deal: since the scoring standard (27 Oct 2026) that is the standard's stamp, whose texts
  // are standard/attentionTexts.ts; the depth texts are still checked for themselves.
  const { STANDARD_STAMPS } = await import("../src/lib/duel/standard/stamps");
  const { STANDARD_ATTENTION_INTRO, STANDARD_ATTENTION_HELP } = await import("../src/lib/duel/standard/attentionTexts");
  const live = STANDARD_STAMPS[type] && type in STANDARD_ATTENTION_INTRO
    ? { intro: STANDARD_ATTENTION_INTRO[type as keyof typeof STANDARD_ATTENTION_INTRO], help: STANDARD_ATTENTION_HELP[type as keyof typeof STANDARD_ATTENTION_HELP](), what: "standard" }
    : { intro, help, what: "depth" };
  ok(INTRO_SCORE[type] === fillMax(live.intro, type) && fillMax(intro, type).length <= 90 && INTRO_SCORE[type].length <= 90, `${type}: the intro line is the live deal's (${live.what}) line (${INTRO_SCORE[type]})`);
  ok(fillMax(intro, type).includes("200") && INTRO_SCORE[type].includes("200"), `${type}: the intro states the 200 top (${fillMax(intro, type)})`);
  ok(PUZZLE_INSTRUCTIONS[type]?.score === fillMax(live.help, type) && help.includes("200"), `${type}: the "?" help is the live deal's (${live.what}) text`);
}
