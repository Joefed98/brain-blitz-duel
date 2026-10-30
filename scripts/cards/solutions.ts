/** The banks' proved lines (scripts/fixtures/*-solutions.json; checks and bots only, never shipped to the phone). */
import { readFileSync } from "node:fs";
import type { FcMove } from "./freecellSolver";

const root = new URL("../fixtures/", import.meta.url);
let fc: FcMove[][] | null = null;
let tp: number[][] | null = null;

/** FreeCell's solution for bank index `i`: [from, index, to] moves, `par` of them. */
export function freecellSolution(i: number): FcMove[] {
  fc ??= (JSON.parse(readFileSync(new URL("freecell-solutions.json", root), "utf8")) as string[]).map((s) =>
    s.split(",").filter(Boolean).map((m) => m.split(":").map(Number) as unknown as FcMove),
  );
  return fc[i]!;
}

/** TriPeaks' clearing line (with a run of ten) for bank index `i`: taps, a peak card's index or the stock (28). */
export function tripeaksSolution(i: number): number[] {
  tp ??= (JSON.parse(readFileSync(new URL("tripeaks-solutions.json", root), "utf8")) as string[]).map((s) => s.split(",").filter(Boolean).map(Number));
  return tp[i]!;
}
