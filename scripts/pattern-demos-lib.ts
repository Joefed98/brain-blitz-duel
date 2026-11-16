/**
 * The Pattern overhaul's intro demos (15 Nov 2026): the fixture `scripts/fixtures/pattern-demos.json` and what both its
 * check (pattern-demos-check) and its save script (pattern-demos-save) need: reading the fixture and comparing a deal's
 * public half with the fixture's puzzle. Imports nothing from the app, so the save script stays a plain HTTP client.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface PatternDemoRow {
  game_type: string;
  seed: number;
  puzzle: Record<string, unknown> & { type: string };
  input_log: { actions: { t: number; action: string; args: Record<string, unknown> }[]; w: number; h: number; presentation?: string } & Record<string, unknown>;
  example_id: string;
  start_tick: number;
  length_ticks: number;
}

export interface PatternDemo {
  game: string;
  /** The stamp the demo is recorded on (today's, the overhaul's). */
  stamp: { key: string; rev: number };
  /** How the run was made: by hand-written play of the example, or the bundled demo's own touches played back. */
  how: string;
  /** The intro_demos row, as the Save button's request makes it (src/lib/duel/bundledDemos/<game>.json, byte for byte). */
  row: PatternDemoRow;
  /** What the same touches sent to practice's grader in the real stage, and what the dev server's grader answered. */
  run: { answer: string; msRemaining: number; extra?: Record<string, unknown>; score: number; isCorrect: boolean; storedMs: number };
}

export const PATTERN_DEMO_GAMES = ["blockparty", "pipes", "flow", "iceslide", "gravity", "unblock", "laser"] as const;

export function patternDemosPath(root = process.cwd()): string {
  return join(root, "scripts/fixtures/pattern-demos.json");
}

export function loadPatternDemos(path = patternDemosPath()): PatternDemo[] {
  return (JSON.parse(readFileSync(path, "utf8")) as { games: PatternDemo[] }).games;
}

/**
 * The public half of a deal as the fixture compares it: Lightbender's `stats.generationMs` is the deal's own build time
 * (a live generation; deal-identity-check leaves it out too), so it differs on every deal and is dropped. Nothing else is.
 */
export function comparablePuzzle(puzzle: unknown): unknown {
  const p = JSON.parse(JSON.stringify(puzzle ?? null)) as Record<string, unknown> | null;
  if (p && p["type"] === "laser" && p["stats"] && typeof p["stats"] === "object") delete (p["stats"] as Record<string, unknown>)["generationMs"];
  return p;
}

/** The top-level fields where a deal's public half differs from the fixture's puzzle (empty when it is the same deal). */
export function puzzleDifferences(dealt: unknown, fixture: unknown): string[] {
  const a = comparablePuzzle(dealt) as Record<string, unknown> | null;
  const b = comparablePuzzle(fixture) as Record<string, unknown> | null;
  if (!a || !b) return ["puzzle"];
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return keys.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

/** JSON with every object's keys sorted (a database's jsonb keeps its own key order, never the value). */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])]))
        : v;
  return JSON.stringify(sort(value));
}

/** True when the dealt public half is exactly the fixture's puzzle (key order included, generationMs aside). */
export function samePuzzle(dealt: unknown, fixture: unknown): boolean {
  return JSON.stringify(comparablePuzzle(dealt)) === JSON.stringify(comparablePuzzle(fixture));
}
