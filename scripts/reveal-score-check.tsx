/**
 * Reveal-score check: the number on the answer-reveal screen must equal the
 * score the server stores in round_results.score.
 *
 * For every puzzle type (active and practice-only) it generates seeded puzzles,
 * grades sample submissions with the exact server grader (the value the room
 * inserts as round_results.score), renders the real AnswerReveal with that row,
 * and asserts (arcade summaries check their total; Cross checks both terms and cap):
 *   1. the rendered data-reveal-score equals the stored score;
 *   2. with no stored row yet, the reveal shows "Scoring…" and no number;
 *   3. no puzzle Reveal source computes a score locally (static scan).
 *
 *   bun scripts/reveal-score-check.tsx [samplesPerType]
 */
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";

import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { ARCADE_REVEAL_TYPES, buildArcadeReveal } from "@/lib/arcade/reveal";
import { crossGame, crossTotalLanes, CROSS_LANE_POINTS, CROSS_CROSSING_POINTS } from "@/lib/arcade/cross";
import { generatePuzzle, gradeAnswer } from "@/lib/duel/generate.server";
import { ACTIVE_PUZZLE_TYPES, RETIRED_PUZZLE_TYPES, puzzleDef } from "@/lib/duel/registry";
import type { PuzzleData } from "@/lib/duel/types";

const samples = Number(process.argv[2] ?? 5);
const failures: string[] = [];
const skipped: string[] = [];
let checked = 0;

/** Cross has two additive terms followed by a capped total, not a first-line total. */
function crossBreakdownMatches(lines: string[], score: number): boolean {
  if (lines.length !== 3) return false;
  const lanes = /^(\d+) lanes × (\d+) = (\d+)$/.exec(lines[0] ?? "");
  const crossings = /^(\d+) crossings × (\d+) = (\d+)$/.exec(lines[1] ?? "");
  const total = /^Total → (\d+) · capped at 150$/.exec(lines[2] ?? "");
  if (!lanes || !crossings || !total) return false;
  const laneCount = Number(lanes[1]), laneRate = Number(lanes[2]), lanePoints = Number(lanes[3]);
  const crossingCount = Number(crossings[1]), crossingRate = Number(crossings[2]), crossingPoints = Number(crossings[3]);
  return laneRate === CROSS_LANE_POINTS && crossingRate === CROSS_CROSSING_POINTS
    && lanePoints === laneCount * laneRate && crossingPoints === crossingCount * crossingRate
    && Number(total[1]) === score && Math.min(150, lanePoints + crossingPoints) === score;
}

// Exercise the real score function and summary builder at zero, partial, completed
// and capped progress. Also prove a matching headline cannot hide incorrect terms.
const crossInitial = crossGame.init(17);
for (const [crossings, reached] of [[0, 0], [0, 5], [1, 0], [3, 4], [7, 0]]) {
  const state = { ...crossInitial, crossings, reached };
  const score = crossGame.score(state);
  const reveal = buildArcadeReveal("cross", { lanes: crossTotalLanes(state), crossings, livesLost: 0 }, score);
  assert.ok(reveal);
  assert.ok(crossBreakdownMatches(reveal.lines, score));
  assert.ok(!crossBreakdownMatches(["1 lanes × 2 = 0", reveal.lines[1] ?? "", reveal.lines[2] ?? ""], score));
  assert.ok(!crossBreakdownMatches([reveal.lines[0] ?? "", reveal.lines[1] ?? "", `Total → ${score + 1} · capped at 150`], score));
  console.log(`Cross regression: lanes ${crossTotalLanes(state)}, crossings ${crossings}, stored ${score}; ${reveal.lines.join("; ")}`);
}
assert.ok(!crossBreakdownMatches(["1 lanes × 2 = 2", "0 crossings × 4 = 0", "Total → 0 · capped at 150"], 0));

function seeded(n: number): () => number {
  let x = n >>> 0 || 1;
  return () => ((x = (x * 1103515245 + 12345) >>> 0) / 2 ** 32);
}

/** Sample submissions: empty, a short garbage string, and the arcade idle run. */
function answersFor(rand: () => number): string[] {
  return ["", String(Math.floor(rand() * 100)), "x"];
}

function render(puzzle: PuzzleData, row: { answer: string; isCorrect: boolean; score: number; storedMs: number; reactionAvgMs: number | null; extra: unknown } | null) {
  return renderToString(
    <AnswerReveal
      round={1}
      puzzle={puzzle}
      answersReady
      myAnswer={row ? row.answer || null : null}
      myCorrect={row?.isCorrect ?? false}
      myReactionAvgMs={row?.reactionAvgMs ?? null}
      myMsRemaining={row?.storedMs ?? 0}
      myScore={row ? row.score : null}
      myExtra={(row?.extra as Record<string, unknown> | null) ?? null}
      startedAt={0}
      now={0}
    />,
  );
}

for (const type of [...ACTIVE_PUZZLE_TYPES, ...RETIRED_PUZZLE_TYPES]) {
  const rand = seeded(type.length * 7919 + 17);
  for (let i = 0; i < samples; i++) {
    let puzzle: PuzzleData;
    try {
      puzzle = generatePuzzle(type);
    } catch (error) {
      skipped.push(`${type}: generate failed (${(error as Error).message})`);
      break;
    }
    for (const answer of answersFor(rand)) {
      const ms = Math.floor(rand() * puzzleDef(type).timeLimitMs);
      let graded: ReturnType<typeof gradeAnswer>;
      try {
        graded = gradeAnswer(puzzle, answer, ms, {});
      } catch {
        continue; // the server rejects this submission, so no row is stored
      }
      const stored = { ...graded, answer: graded.answer ?? "" };
      let html: string;
      try {
        html = render(puzzle, stored);
      } catch (error) {
        failures.push(`${type}: reveal failed to render (${(error as Error).message})`);
        continue;
      }
      const shown = [...html.matchAll(/data-reveal-score="([^"]*)"/g)].map((m) => m[1]);
      if (shown.length !== 1 || shown[0] !== String(stored.score)) {
        failures.push(`${type}: stored ${stored.score}, reveal shows ${shown.join(",") || "nothing"}`);
      }
      const reveal = (stored.extra as Record<string, unknown> | null)?.["reveal"] as { lines: string[] } | undefined;
      if (ARCADE_REVEAL_TYPES.includes(type)) {
        const first = reveal?.lines[0] ?? "";
        const ok = type === "cross"
          ? crossBreakdownMatches(reveal?.lines ?? [], stored.score)
          : first.endsWith(`→ ${stored.score}`) || first.endsWith(`→ 130 · time +${stored.score - 130}`);
        if (!ok) failures.push(`${type}: stored ${stored.score}, breakdown "${reveal?.lines.join("; ") ?? "missing"}"`);
        if (type === "cross" && reveal) {
          for (const line of reveal.lines) {
            if (!html.includes(line)) failures.push(`${type}: stored breakdown not rendered: "${line}"`);
          }
        }
      }
      checked++;
    }
    const pending = render(puzzle, null);
    if (!pending.includes('data-reveal-score="pending"') || !pending.includes("Scoring…")) {
      failures.push(`${type}: no "Scoring…" before the stored score lands`);
    }
  }
}

// Static guard: no puzzle Reveal may work out a score of its own.
const banned = /\bscore[A-Z]\w*\(|\.score\b|Game\.score\(|\w+Points\((?!word)|\bclaimedScore\b/;
for (const file of readdirSync("src/puzzles").filter((f) => f.endsWith(".tsx"))) {
  const src = readFileSync(`src/puzzles/${file}`, "utf8");
  const start = src.search(/\nfunction Reveal\(/);
  if (start < 0) continue;
  const rest = src.slice(start + 1);
  const end = rest.slice(10).search(/\n(export |function |\/\*\*)/);
  const body = end < 0 ? rest : rest.slice(0, end + 10);
  const hit = body.split("\n").find((line) => banned.test(line.replace(/wordsmithPoints|wordHuntPoints|countStagePoints/g, "")));
  if (hit) failures.push(`${file}: Reveal computes a score locally → ${hit.trim()}`);
}

console.log(`checked ${checked} stored rows across ${ACTIVE_PUZZLE_TYPES.length} active + ${RETIRED_PUZZLE_TYPES.length} practice-only types`);
if (skipped.length) console.log("skipped:\n  " + skipped.join("\n  "));
if (failures.length) {
  console.log("FAIL\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log("PASS: every reveal shows round_results.score");
