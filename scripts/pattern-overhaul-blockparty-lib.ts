/**
 * Tessellate answers for the Pattern overhaul's recorder and check (pattern-overhaul-blockparty-*): built from the
 * stored solution the way the phone sends them (each draft with its round-clock time, the timeline attached on
 * standard stamps). Script-only.
 */
import {
  absoluteCells,
  blockGeometry,
  encodePlacements,
  orientationsFor,
} from "../src/lib/duel/blockParty";
import { TimelineRecorder } from "../src/lib/duel/standard/timeline";
import { standardTimesParts } from "../src/lib/duel/standard/stamps";
import type { BlockPlacement, PuzzleData } from "../src/lib/duel/types";
import { makeRng } from "./puzzle-fairness/kit";

type Block = Extract<PuzzleData, { type: "blockparty" }>;
export interface BlockCase {
  label: string;
  answer: string;
  msLeft: number;
}

const LIMIT = 60_000;

/** The answer the phone sends after these drafts (the last one, with its timeline on standard stamps). */
export function sent(p: PuzzleData, drafts: readonly { answer: string; at: number }[], suffix = ""): string {
  const last = drafts[drafts.length - 1];
  if (!last) return "";
  if (!standardTimesParts(p)) return last.answer + suffix;
  const rec = new TimelineRecorder();
  for (const d of drafts) rec.note(d.answer + suffix, d.at);
  return rec.attach(last.answer + suffix);
}

/** A legal spot for `piece` on the board as it stands, other than `avoid` (cells key); null when there is none. */
export function otherSpot(p: Block, placed: readonly BlockPlacement[], piece: number, avoid: string): number[] | null {
  const geo = blockGeometry(p);
  const taken = new Set<number>(p.blockers);
  for (const pl of placed) for (const c of pl.cells) taken.add(c);
  for (const o of orientationsFor(geo)[piece] ?? []) {
    for (let r = 0; r < geo.cols; r++) for (let c = 0; c < geo.cols; c++) {
      const cells = absoluteCells(o, r, c, geo.cols);
      if (!cells || cells.some((x) => taken.has(x))) continue;
      if ([...cells].sort((a, b) => a - b).join(",") === avoid) continue;
      return cells;
    }
  }
  return null;
}

/** Drafts placing the solution's pieces in order, one every `step` ms from `start`. */
function solveDrafts(sol: readonly BlockPlacement[], start: number, step: number, upTo = sol.length) {
  const drafts: { answer: string; at: number }[] = [];
  for (let i = 1; i <= upTo; i++) drafts.push({ answer: encodePlacements(sol.slice(0, i)), at: start + i * step });
  return drafts;
}

/** Several ways to play one board (deterministic from `seed`). */
export function blockCases(puzzle: PuzzleData, seed: number): BlockCase[] {
  const p = puzzle as Block;
  const sol = p.solution ?? [];
  const rng = makeRng(seed);
  const out: BlockCase[] = [];
  if (!sol.length) return out;
  // A clean solve, quick and slow.
  for (const step of [2500, 5200]) {
    const d = solveDrafts(sol, 0, step);
    out.push({ label: `clean ${step}`, answer: sent(p, d), msLeft: Math.max(0, LIMIT - d[d.length - 1]!.at) });
  }
  // A solve with the first piece dropped elsewhere first, then moved to its spot.
  {
    const first = sol[0]!;
    const key = [...first.cells].sort((a, b) => a - b).join(",");
    const elsewhere = otherSpot(p, [], first.piece, key);
    if (elsewhere) {
      const d = [{ answer: encodePlacements([{ piece: first.piece, cells: elsewhere }]), at: 1500 }, ...solveDrafts(sol, 2000, 3000)];
      out.push({ label: "moved", answer: sent(p, d), msLeft: Math.max(0, LIMIT - d[d.length - 1]!.at) });
    }
  }
  // A part-filled board at the buzzer.
  for (const k of [3, Math.max(1, sol.length - 1)]) {
    out.push({ label: `partial ${k}`, answer: sent(p, solveDrafts(sol, 0, 4000, k)), msLeft: 0 });
  }
  // Random legal drops.
  {
    const placed: BlockPlacement[] = [];
    const d: { answer: string; at: number }[] = [];
    const pieces = blockGeometry(p).pieces.length;
    for (let i = 0; i < 6; i++) {
      const piece = rng.below(pieces);
      if (placed.some((x) => x.piece === piece)) continue;
      const cells = otherSpot(p, placed, piece, "");
      if (!cells) continue;
      placed.push({ piece, cells });
      d.push({ answer: encodePlacements(placed), at: 3000 * (i + 1) });
    }
    if (d.length) out.push({ label: "random", answer: sent(p, d), msLeft: 0 });
  }
  // A finish with no timeline (an older phone).
  out.push({ label: "bare", answer: encodePlacements(sol), msLeft: 20_000 });
  return out;
}
