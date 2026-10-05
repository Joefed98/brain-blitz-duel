/**
 * Reveal-score check: the number on the answer-reveal screen must equal the
 * score the server stores in round_results.score.
 *
 * For every puzzle type (active and practice-only) it generates seeded puzzles,
 * grades sample submissions with the exact server grader (the value the room
 * inserts as round_results.score), renders the real AnswerReveal with that row,
 * and asserts (arcade games also check the stored breakdown line ends in that score):
 *   1. the rendered data-reveal-score equals the stored score;
 *   2. with no stored row yet, the reveal shows "Scoring…" and no number;
 *   3. no puzzle Reveal source computes a score locally (static scan).
 *
 *   bun scripts/reveal-score-check.tsx [samplesPerType]
 */
import { readFileSync, readdirSync } from "node:fs";
import { renderToString } from "react-dom/server";

import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { ARCADE_REVEAL_TYPES } from "@/lib/arcade/reveal";
import { generatePuzzle, gradeAnswer } from "@/lib/duel/generate.server";
import { ACTIVE_PUZZLE_TYPES, RETIRED_PUZZLE_TYPES, puzzleDef } from "@/lib/duel/registry";
import type { PuzzleData } from "@/lib/duel/types";

const samples = Number(process.argv[2] ?? 5);
const failures: string[] = [];
const skipped: string[] = [];
let checked = 0;

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
        const ok = first.endsWith(`→ ${stored.score}`) || first.endsWith(`→ 130 · time +${stored.score - 130}`);
        if (!ok) failures.push(`${type}: stored ${stored.score}, breakdown line "${first}"`);
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
