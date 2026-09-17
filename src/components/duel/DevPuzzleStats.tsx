/**
 * Temporary dev readout: shows the generator's own stored figures for the
 * current puzzle. Every value comes from the server-side generator output that
 * travelled with the puzzle — nothing here is recomputed on the client.
 */

import type { PuzzleData } from "@/lib/duel/types";

function rows(puzzle: PuzzleData): [string, string][] | null {
  if (puzzle.type === "laser" && puzzle.stats) {
    const s = puzzle.stats;
    return [
      ["blocks", String(s.blocks)],
      ["mirrors", String(s.mirrors)],
      ["route bends", String(s.bends)],
      ["gems / bombs", `${s.gems} / ${s.bombs}`],
      ["necessity", `${s.necessityPass ? "pass" : "fail"} · ${s.subsetsTested} tested`],
      ["attempts", String(s.attempts)],
    ];

  }
  if (puzzle.type === "iceslide" && puzzle.stats) {
    const s = puzzle.stats;
    return [
      ["walls", String(s.walls)],
      ["holes", String(s.holes)],
      ["arrows", String(s.arrows)],
      ["minimum moves", String(s.minMoves)],
      ["exit in ≤5", s.easyExit ? "yes" : "no"],
      ["stoppers", String(s.stoppers)],
    ];
  }
  if (puzzle.type === "push" && puzzle.stats) {
    const s = puzzle.stats;
    return [
      ["crates", String(s.crates)],
      ["minimum pushes", String(s.minPushes)],
      ["minimum moves", String(s.minMoves)],
      ["detour", s.detour ? "yes" : "no"],
    ];
  }
  if (puzzle.type === "tower" && puzzle.stats) {
    const s = puzzle.stats;
    return [
      ["discs", String(s.discs)],
      ["pegs", String(s.pegs)],
      ["minimum moves", String(s.minMoves)],
      ["attempts", String(s.attempts)],
    ];
  }
  return null;
}

export function DevPuzzleStats({ puzzle }: { puzzle: PuzzleData }) {
  const list = rows(puzzle);
  if (!list) return null;
  return (
    <div className="mt-1 shrink-0 rounded-md bg-muted/60 px-2 py-1 font-mono text-[10px] leading-tight text-muted-foreground">
      {list.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3">
          <span>{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}
