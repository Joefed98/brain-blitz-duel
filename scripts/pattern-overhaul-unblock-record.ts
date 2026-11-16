/**
 * Records pattern-overhaul-unblock-check's legacy fixture (scripts/fixtures/pattern-overhaul-unblock-legacy.json.gz):
 * Gridlock puzzles dealt on the stamps before the Pattern overhaul (unblockRev 3 under `pinPrePatternNov15(true)`, and
 * unblockRev 2 with the partial-credit fixes pinned off too), each with every kit level's answer (the kit's own undos
 * included), the flawless line's prefixes, its spam and hand-made answers holding Undo (-1:0) and Reset (-2:0)
 * markers, graded before unblockRev 4's change. The check regrades them on the branch and fails on any difference.
 *
 *   bun scripts/pattern-overhaul-unblock-record.ts [--out=<path>]
 *
 * Recorded before the grading change (15 Nov 2026); never re-record over it.
 */
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { pinPrePatternNov15 } from "../src/lib/duel/patternNov15";
import { pinPrePartialCredit } from "../src/lib/duel/partialCredit";
import { decodeMoves, encodeMoves, slideRange, position, applyMove, type UnblockMove } from "../src/lib/duel/unblock";
import type { PuzzleData, UnblockPuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { sentAnswer } from "./standard-lib";

export const UNBLOCK_LEGACY_SEEDS = [7100, 7113, 7126, 7139, 7152, 7165];
export const UNBLOCK_LEGACY_ERAS = ["rev3", "rev2"] as const;
export type LegacyEra = (typeof UNBLOCK_LEGACY_ERAS)[number];

export interface LegacyCase {
  era: LegacyEra;
  seed: number;
  label: string;
  answer: string;
  msLeft: number;
  score: number;
  isCorrect: boolean;
  extra: unknown;
}

/** Deals a Gridlock puzzle on the era's stamps (the pins restored after). */
export function dealEra(era: LegacyEra, seed: number): UnblockPuzzleData {
  const a = pinPrePatternNov15(true);
  const b = era === "rev2" ? pinPrePartialCredit(true) : null;
  try {
    return withSeededRandom(seed, () => generatePuzzle("unblock", { bankSeed: seed })) as UnblockPuzzleData;
  } finally {
    pinPrePatternNov15(a);
    if (b !== null) pinPrePartialCredit(b);
  }
}

/** A legal slide other than `avoid` (the first found, deterministic). */
function otherSlide(p: UnblockPuzzleData, state: UnblockPuzzleData["vehicles"], avoid: UnblockMove | undefined): UnblockMove | null {
  for (const v of state) {
    const { min, max } = slideRange(state, v.id);
    for (let to = min; to <= max; to++) {
      if (to === position(v)) continue;
      if (avoid && avoid.id === v.id && avoid.to === to) continue;
      return { id: v.id, to };
    }
  }
  void p;
  return null;
}

/** Hand-made answers with Undo and Reset markers, built from the stored solution alone. */
export function markerAnswers(p: UnblockPuzzleData): { label: string; answer: string; msLeft: number }[] {
  const line = decodeMoves(p.solution ?? "");
  const out: { label: string; answer: string; msLeft: number }[] = [];
  if (!line.length) return out;
  const UNDO: UnblockMove = { id: -1, to: 0 };
  const RESET: UnblockMove = { id: -2, to: 0 };
  const stateAt = (k: number) => {
    let s = p.vehicles.map((v) => ({ ...v }));
    for (const m of line.slice(0, k)) s = applyMove(s, m) ?? s;
    return s;
  };
  // A wrong slide and its Undo at three places in the line (each a solve).
  for (const at of [0, Math.floor(line.length / 2), line.length - 1]) {
    const wrong = otherSlide(p, stateAt(at), line[at]);
    if (!wrong) continue;
    const moves = [...line.slice(0, at), wrong, UNDO, ...line.slice(at)];
    out.push({ label: `undo at ${at}`, answer: encodeMoves(moves), msLeft: 30_000 });
  }
  // Two wrong slides and two Undos early, then the line.
  {
    const w1 = otherSlide(p, stateAt(0), line[0]);
    if (w1) {
      const s1 = applyMove(stateAt(0), w1)!;
      const w2 = otherSlide(p, s1, undefined);
      const moves = w2 ? [w1, w2, UNDO, UNDO, ...line] : [w1, UNDO, ...line];
      out.push({ label: "double undo", answer: encodeMoves(moves), msLeft: 25_000 });
    }
  }
  // Half the line, Reset, the whole line (a solve).
  out.push({ label: "reset then line", answer: encodeMoves([...line.slice(0, Math.ceil(line.length / 2)), RESET, ...line]), msLeft: 20_000 });
  // Half the line, Undo once (unfinished).
  const half = line.slice(0, Math.ceil(line.length / 2));
  out.push({ label: "half then undo", answer: encodeMoves([...half, UNDO]), msLeft: 0 });
  // Half the line and a Reset (unfinished, back on the start).
  out.push({ label: "half then reset", answer: encodeMoves([...half, RESET]), msLeft: 0 });
  // Undo with nothing to undo, then the line.
  out.push({ label: "undo on start", answer: encodeMoves([UNDO, RESET, ...line]), msLeft: 35_000 });
  return out;
}

/** Every case for one era and seed (answers built from the dealt puzzle alone, so the check rebuilds the same). */
export function casesFor(era: LegacyEra, seed: number, p: UnblockPuzzleData): Omit<LegacyCase, "score" | "isCorrect" | "extra">[] {
  const out: Omit<LegacyCase, "score" | "isCorrect" | "extra">[] = [];
  const limit = puzzleTimeLimitMs(p as PuzzleData);
  const kit = KITS.unblock!;
  const flawless = kit.play(p, makeRng(hashText(`pou:${era}:${seed}:line`)), { ...SKILLS.near, err: 0 }, limit).steps;
  for (const i of [0, Math.floor(flawless.length / 2), flawless.length - 1]) {
    if (i < 0 || !flawless[i]) continue;
    out.push({ era, seed, label: `line ${i + 1}`, answer: sentAnswer(p, flawless.slice(0, i + 1)), msLeft: i === flawless.length - 1 ? Math.max(0, limit - flawless[i]!.atMs) : 0 });
  }
  for (const level of LEVELS) {
    const play = kit.play(p, makeRng(hashText(`pou:${era}:${seed}:${level}`)), SKILLS[level], limit);
    const steps = play.steps.filter((s) => s.atMs <= limit);
    const last = steps[steps.length - 1];
    if (last) out.push({ era, seed, label: level, answer: sentAnswer(p, steps), msLeft: play.solved ? Math.max(0, limit - last.atMs) : 0 });
  }
  for (const sp of kit.spam(p, makeRng(hashText(`pou:${era}:spam:${seed}`)), limit)) out.push({ era, seed, label: `spam ${sp.label}`, answer: sp.answer, msLeft: 0 });
  for (const m of markerAnswers(p)) out.push({ era, seed, ...m });
  return out;
}

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/pattern-overhaul-unblock-legacy.json.gz";
  const cases: LegacyCase[] = [];
  const puzzles: { era: LegacyEra; seed: number; puzzle: UnblockPuzzleData }[] = [];
  for (const era of UNBLOCK_LEGACY_ERAS) {
    for (const seed of UNBLOCK_LEGACY_SEEDS) {
      const p = dealEra(era, seed);
      puzzles.push({ era, seed, puzzle: p });
      for (const c of casesFor(era, seed, p)) {
        const g = gradeAnswer(p, c.answer, c.msLeft);
        cases.push({ ...c, score: g.score, isCorrect: g.isCorrect, extra: g.extra ?? null });
      }
    }
  }
  writeFileSync(out, gzipSync(JSON.stringify({ puzzles, cases })));
  const stamps = [...new Set(puzzles.map((x) => `${x.era}:${x.puzzle.unblockRev}`))].join(" ");
  console.log(`wrote ${out}: ${puzzles.length} puzzles (${stamps}), ${cases.length} cases`);
}
