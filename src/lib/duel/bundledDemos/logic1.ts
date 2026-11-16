/**
 * The Logic overhaul's intro demos bundled with the app (session 1; Joe 16 Nov 2026: "record them by real play on Normal
 * and bundle them with the app, as Pattern did"). Each file is one `intro_demos` row: a real solve of the game's fixed
 * intro example in dev practice ("Intro examples" mode, the touch recorder on), captured as the Save button sends it
 * (scripts/logic-demos-puzzle-record.ts), on today's presentation (nov15-logic-overhaul-1) and layout. getIntroDemoFn
 * plays one when the live row is missing or would not play; a live row recorded on today's presentation still wins, so a
 * re-record through the Save button replaces a bundled demo without a code change. Stored rows are never touched.
 *
 * Registered in the one registry, bundledDemos/index.ts (BUNDLED_INTRO_DEMOS, puzzle train combine, 16 Nov 2026).
 * logic-demos-check proves each against today's intro example deal and rules.
 */
import { puzzleInputDemoCompatible } from "@/components/puzzles/wordInput";

import type { IntroDemoRow } from "../introDemo.functions";
import { logicDemoPlays } from "../logicDemoRules";

import flood from "./flood.json";
import nonogram from "./nonogram.json";
import safe from "./safe.json";
import sudoku from "./sudoku.json";
import tower from "./tower.json";
import tubes from "./tubes.json";

export const LOGIC_1_BUNDLED_DEMOS: Readonly<Record<string, IntroDemoRow>> = {
  sudoku: sudoku as unknown as IntroDemoRow,
  tubes: tubes as unknown as IntroDemoRow,
  tower: tower as unknown as IntroDemoRow,
  safe: safe as unknown as IntroDemoRow,
  nonogram: nonogram as unknown as IntroDemoRow,
  flood: flood as unknown as IntroDemoRow,
};

/** The bundled demo for one of the six games, or null. */
export function bundledLogicDemo(type: string): IntroDemoRow | null {
  return Object.hasOwn(LOGIC_1_BUNDLED_DEMOS, type) ? LOGIC_1_BUNDLED_DEMOS[type]! : null;
}

/** Whether a live saved row plays for the game today (recorded on Normal, on today's presentation). */
export function liveLogicDemoPlays(type: string, live: IntroDemoRow | null): boolean {
  return Boolean(live && logicDemoPlays(type, live.puzzle) && puzzleInputDemoCompatible(type, live.input_log));
}

/** The demo the intro plays for one of the six: the live row when it plays, else the bundled one. */
export function pickLogicDemo(type: string, live: IntroDemoRow | null): IntroDemoRow | null {
  const bundled = bundledLogicDemo(type);
  if (!bundled) return live;
  return liveLogicDemoPlays(type, live) ? live : bundled;
}
