/**
 * depth-wordsmith-check (25 Oct 2026, word depth d1; docs/depth/d1-word.md): Nucleus `wordsmithRev 3`.
 *
 *   1. Legacy: room puzzles dealt on the pre-depth stamps (wordsmithRev 2, plus the same boards restamped
 *      wordsmithRev 1 and unstamped) with kit answers (every level, nothing, spam), recorded on main before the
 *      change (scripts/fixtures/depth-wordsmith-legacy.json.gz), regrade to the same score, isCorrect and extra.
 *   2. The new stamp: new rounds deal wordsmithRev 3; scores stay 0–200; the score never falls as word points
 *      rise; without a word using every tile it stays at most WORDSMITH_V3_CAP (so 190–200 needs the pangram);
 *      the pangram adds WORDSMITH_V3_PANGRAM_BONUS; a solid haul scores what it did on rev 2; the stored
 *      breakdown adds up to the score; the elite kit player reaches 190–200; the help and intro texts.
 *
 *   bun scripts/depth-wordsmith-check.ts [--record]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { pinPreDepth } from "../src/lib/duel/wordDepth";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, WordsmithPuzzleData } from "../src/lib/duel/types";
import { pinPreTopup } from "../src/lib/duel/depthTopup";

// The puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md) deals newer stamps; this check proves the stamps it was
// written for, so new deals are pinned to them (depth-topup-check proves the top-up's).
pinPreTopup(true);

const FIXTURE = "scripts/fixtures/depth-wordsmith-legacy.json.gz";
const RECORD = process.argv.includes("--record");
const kit = KITS.wordsmith!;

interface Case {
  seed: number;
  stamp: number | null;
  label: string;
  answer: string;
  ms: number;
  score: number;
  isCorrect: boolean;
  extra: unknown;
}

const failures: string[] = [];
let passes = 0;
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else if (failures.length < 40) failures.push(message);
}

function restamp(p: PuzzleData, stamp: number | null): PuzzleData {
  const out = { ...(p as WordsmithPuzzleData) } as WordsmithPuzzleData;
  if (stamp === null) delete out.wordsmithRev;
  else out.wordsmithRev = stamp;
  return out as PuzzleData;
}

/** Kit answers for one board: nothing, spam and every level's final answer (and a mid-run draft). */
function answersFor(p: PuzzleData, seed: number): { label: string; answer: string; ms: number }[] {
  const limit = puzzleTimeLimitMs(p);
  const out = [{ label: "nothing", answer: kit.nothing(p), ms: 0 }];
  const rng = makeRng(hashText(`depth-wordsmith:spam:${seed}`));
  for (const s of kit.spam(p, rng, limit)) out.push({ label: s.label, answer: s.answer, ms: 0 });
  for (const level of LEVELS) {
    const play = kit.play(p, makeRng(hashText(`depth-wordsmith:${seed}:${level}`)), SKILLS[level], limit);
    const inTime = play.steps.filter((s) => s.atMs <= limit);
    const mid = inTime[Math.floor(inTime.length / 2)];
    if (mid) out.push({ label: `${level}-mid`, answer: mid.answer, ms: 0 });
    const last = inTime[inTime.length - 1];
    if (last) out.push({ label: level, answer: last.answer, ms: 0 });
  }
  // Every allowed word (the source word included) at the buzzer and early.
  const all = ((p as WordsmithPuzzleData).words ?? []).map((w) => w.word).join(",");
  out.push({ label: "all", answer: all, ms: 0 }, { label: "all-early", answer: all, ms: 30_000 });
  return out;
}

const SEEDS = Array.from({ length: 20 }, (_, i) => 4200 + i);

if (RECORD) {
  const boards: Record<number, PuzzleData> = {};
  const cases: Case[] = [];
  pinPreDepth(true);
  for (const seed of SEEDS) {
    const p = roomPuzzle("wordsmith", seed);
    boards[seed] = p;
    for (const stamp of [2, 1, null] as const) {
      const q = restamp(p, stamp);
      for (const a of answersFor(p, seed)) {
        const g = gradeAnswer(q, a.answer, a.ms);
        cases.push({ seed, stamp, ...a, score: g.score, isCorrect: g.isCorrect, extra: g.extra });
      }
    }
  }
  pinPreDepth(false);
  writeFileSync(FIXTURE, gzipSync(JSON.stringify({ recordedOn: "main before word depth d1, 25 Oct 2026", boards, cases })));
  console.log(`recorded ${cases.length} cases on ${SEEDS.length} boards`);
  process.exit(0);
}

/* 1. Legacy. */
if (!existsSync(FIXTURE)) {
  failures.push(`missing ${FIXTURE}`);
} else {
  const fx = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as { boards: Record<string, PuzzleData>; cases: Case[] };
  let n = 0;
  for (const c of fx.cases) {
    const g = gradeAnswer(restamp(fx.boards[c.seed]!, c.stamp), c.answer, c.ms);
    ok(g.score === c.score && g.isCorrect === c.isCorrect && JSON.stringify(g.extra) === JSON.stringify(c.extra), `legacy seed ${c.seed} rev ${c.stamp} ${c.label}: ${g.score} (stored ${c.score})`);
    n++;
  }
  ok(n >= 600, `legacy fixture holds ${n} cases`);
}

/* 2. The new stamp. */
await import("./depth-wordsmith-lib").then((m) => m.checkNew(ok));

if (failures.length) {
  console.log(`FAIL depth-wordsmith-check: ${failures.length} failing\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`PASS depth-wordsmith-check: ${passes} checks — rev 1/2/unstamped Nucleus rounds regrade exactly as recorded; wordsmithRev 3 scores to 200, 190+ only with the pangram`);
