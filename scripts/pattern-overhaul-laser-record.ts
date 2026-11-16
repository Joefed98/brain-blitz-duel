/**
 * Records pattern-overhaul-laser-check's legacy fixture (scripts/fixtures/pattern-overhaul-laser-legacy.json.gz):
 * Lightbender puzzles dealt on the stamps before the Pattern overhaul (laserRev 3 under `pinPrePatternNov15(true)`, and
 * laserRev 2 with the scoring standard pinned off too), each with every kit level's answer, the kit's spam, the
 * solution fired first, second and third, and hand-made action logs that turn, move, take back and put back pieces
 * (the verbs laserRev 4's Undo sends), graded before the overhaul. The check regrades them on the branch and fails on
 * any difference.
 *
 *   bun scripts/pattern-overhaul-laser-record.ts [--out=<path>]
 *
 * Recorded before the overhaul's Undo change (15 Nov 2026); never re-record over it.
 */
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { pinPrePatternNov15 } from "../src/lib/duel/patternNov15";
import { pinPreStandard } from "../src/lib/duel/standard/stamps";
import { appendAction, encodeActionLog, type LoggedAction } from "../src/lib/duel/actionLog";
import { laserAction } from "../src/lib/duel/laserLog";
import { flipMirror } from "../src/lib/duel/laser";
import { LASER_CELLS, type LaserPuzzleData, type PuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { sentAnswer } from "./standard-lib";

export const LASER_LEGACY_SEEDS = [8100, 8117, 8134, 8151, 8168, 8185];
export const LASER_LEGACY_ERAS = ["rev3", "rev2"] as const;
export type LegacyEra = (typeof LASER_LEGACY_ERAS)[number];
export const LASER_OVERHAUL_FIXTURE = new URL("./fixtures/pattern-overhaul-laser-legacy.json.gz", import.meta.url);

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

/** Deals a Lightbender puzzle on the era's stamps (the pins restored after). */
export function dealEra(era: LegacyEra, seed: number): LaserPuzzleData {
  const a = pinPrePatternNov15(true);
  const b = era === "rev2" ? pinPreStandard(true) : null;
  try {
    return withSeededRandom(seed, () => generatePuzzle("laser", { bankSeed: seed })) as LaserPuzzleData;
  } finally {
    pinPrePatternNov15(a);
    if (b !== null) pinPreStandard(b);
  }
}

/** A free cell (not fixed, not in `used`), the first from `from` (deterministic). */
function freeCell(p: LaserPuzzleData, used: Set<number>, from: number): number {
  const fixed = new Set([p.source, ...p.gems, ...p.bombs, ...p.blocks, ...(p.splitters ?? [])]);
  for (let k = 0; k < LASER_CELLS; k++) {
    const c = (from + k) % LASER_CELLS;
    if (!fixed.has(c) && !used.has(c)) return c;
  }
  return 0;
}

/**
 * Hand-made logs from the stored solution alone: the board built with detours (a wrong turn turned back, a piece
 * moved away and back, a piece taken off and put back, a Reset then everything put back), as laserRev 4's Undo sends
 * them, then fired; and the same without the fire, and fired wrongly first.
 */
export function handLogs(p: LaserPuzzleData): { label: string; answer: string; msLeft: number }[] {
  const sol = p.solution ?? [];
  if (!sol.length) return [];
  const out: { label: string; answer: string; msLeft: number }[] = [];
  const used = new Set(sol.map((m) => m.cell));
  const run = (label: string, build: (add: (a: string) => void) => void, msLeft: number) => {
    let log: LoggedAction[] = [];
    let t = 800;
    build((a) => {
      log = appendAction(log, a, (t += 700));
    });
    out.push({ label, answer: encodeActionLog(log), msLeft });
  };
  const placeAll = (add: (a: string) => void) => sol.forEach((m) => add(laserAction.place(m.cell, m.kind)));
  // A turn and its undo (a second turn) on every piece, then fire.
  run("turn and back", (add) => {
    placeAll(add);
    for (const m of sol) {
      add(laserAction.turn(m.cell));
      add(laserAction.turn(m.cell));
    }
    add(laserAction.fire());
  }, 30_000);
  // A piece moved away and back (move then the reverse move), then fire.
  run("move and back", (add) => {
    placeAll(add);
    const away = freeCell(p, used, sol[0]!.cell + 13);
    add(laserAction.move(sol[0]!.cell, away));
    add(laserAction.move(away, sol[0]!.cell));
    add(laserAction.fire());
  }, 28_000);
  // A piece taken back to the tray and put back, then fire.
  run("remove and back", (add) => {
    placeAll(add);
    const last = sol[sol.length - 1]!;
    add(laserAction.remove(last.cell));
    add(laserAction.place(last.cell, last.kind));
    add(laserAction.fire());
  }, 26_000);
  // Reset, then every piece put back (Undo of a Reset), then fire.
  run("reset and back", (add) => {
    placeAll(add);
    add(laserAction.reset());
    placeAll(add);
    add(laserAction.fire());
  }, 24_000);
  // A wrong turn fired first (a miss), then turned back and fired (a 2nd-shot solve).
  run("miss then fix", (add) => {
    placeAll(add);
    add(laserAction.turn(sol[0]!.cell));
    add(laserAction.fire());
    add(laserAction.turn(sol[0]!.cell));
    add(laserAction.fire());
  }, 20_000);
  // Three misses, then edits after the last shot (unfinished; the layout at the buzzer).
  run("three misses then edits", (add) => {
    placeAll(add);
    add(laserAction.turn(sol[0]!.cell));
    add(laserAction.fire());
    add(laserAction.fire());
    add(laserAction.fire());
    add(laserAction.turn(sol[0]!.cell));
  }, 0);
  // Half the pieces, one wrongly turned, never fired (unfinished).
  run("half unfired", (add) => {
    sol.slice(0, Math.ceil(sol.length / 2)).forEach((m, i) => add(laserAction.place(m.cell, i === 0 ? flipMirror(m.kind) : m.kind)));
  }, 0);
  return out;
}

/** Every case for one era and seed (answers built from the dealt puzzle alone, so the check rebuilds the same). */
export function casesFor(era: LegacyEra, seed: number, p: LaserPuzzleData): Omit<LegacyCase, "score" | "isCorrect" | "extra">[] {
  const out: Omit<LegacyCase, "score" | "isCorrect" | "extra">[] = [];
  const limit = puzzleTimeLimitMs(p as PuzzleData);
  const kit = KITS.laser!;
  for (const level of LEVELS) {
    const play = kit.play(p, makeRng(hashText(`pol:${era}:${seed}:${level}`)), SKILLS[level], limit);
    const steps = play.steps.filter((s) => s.atMs <= limit);
    const last = steps[steps.length - 1];
    if (last) out.push({ era, seed, label: level, answer: sentAnswer(p, steps), msLeft: play.solved ? Math.max(0, limit - last.atMs) : 0 });
  }
  for (const sp of kit.spam(p, makeRng(hashText(`pol:${era}:spam:${seed}`)), limit)) out.push({ era, seed, label: `spam ${sp.label}`, answer: sp.answer, msLeft: 0 });
  for (const m of handLogs(p)) out.push({ era, seed, ...m });
  return out;
}

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? LASER_OVERHAUL_FIXTURE.pathname;
  const cases: LegacyCase[] = [];
  const puzzles: { era: LegacyEra; seed: number; puzzle: LaserPuzzleData }[] = [];
  for (const era of LASER_LEGACY_ERAS) {
    for (const seed of LASER_LEGACY_SEEDS) {
      const p = dealEra(era, seed);
      puzzles.push({ era, seed, puzzle: p });
      for (const c of casesFor(era, seed, p)) {
        const g = gradeAnswer(p, c.answer, c.msLeft);
        cases.push({ ...c, score: g.score, isCorrect: g.isCorrect, extra: g.extra ?? null });
      }
    }
  }
  writeFileSync(out, gzipSync(JSON.stringify({ puzzles, cases })));
  const stamps = [...new Set(puzzles.map((x) => `${x.era}:${x.puzzle.laserRev}`))].join(" ");
  console.log(`wrote ${out}: ${puzzles.length} puzzles (${stamps}), ${cases.length} cases`);
}
