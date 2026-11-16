/**
 * The Attention intro demos (15 Nov 2026, the Attention overhaul's stage 3; the merge captain's demo plan, the pattern
 * of Action #436 and Sports #444): each game's demo is a run on its fixed intro example (the one deal with a fixed seed,
 * practiceGenerateFn with example: true, the only deal the Save demo function accepts), kept in
 * scripts/fixtures/attention-demos.json as the rows the manual "Save intro demos" workflow writes to `intro_demos`
 * after the final merge. Nothing here touches a database.
 *
 * A puzzle's demo is the touches a practice run made on the example (PuzzleDemoLog, with the overhaul's presentation
 * tag), plus the answer the phone sent for them and the score the server's grade stored, so the check can prove the
 * run scores exactly what the server says.
 */
import type { PuzzleData } from "../src/lib/duel/types";

export const DEMOS_FIXTURE = new URL("./fixtures/attention-demos.json", import.meta.url);
export const DEMO_GAMES = ["symscan", "spotdiff", "countup", "maze", "bomb", "pairmatch"] as const;
export type DemoGame = (typeof DEMO_GAMES)[number];

/** One saved demo, in `intro_demos`' columns as savePuzzleDemoFn writes them, plus the run's answer and stored score. */
export interface DemoRow {
  game_type: DemoGame;
  /** The public half of the intro example deal (what the save stores). */
  puzzle: Record<string, unknown> & { type: DemoGame };
  /** The touches (PuzzleDemoLog with its presentation tag), exactly as the app's Save button sends them. */
  input_log: { actions: { t: number; action: string; args?: Record<string, unknown> }[]; w: number; h: number; presentation?: string; layout?: number; [k: string]: unknown };
  /** The answer the phone sent for the run (its draft timeline included) and the time it had left. */
  answer: string;
  msRemaining: number;
  /** The score and verdict the server's grade stored for that answer. */
  score: number;
  isCorrect: boolean;
}

/** The game's intro example deal, both halves, as the server deals it (practiceGenerateFn's example path). */
export async function exampleDealFull(game: DemoGame): Promise<PuzzleData> {
  const { withSeededRandom } = await import("../src/lib/duel/random");
  const { INTRO_EXAMPLE_SEED } = await import("../src/lib/duel/puzzleDemo");
  const { bankedIntroExample } = await import("../src/lib/duel/puzzleBank.server");
  const { generatePuzzle } = await import("../src/lib/duel/generate.server");
  return bankedIntroExample(game) ?? withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(game, { unblockRow: null } as never));
}

/** The public half of the example (what the Save demo function stores and the save script compares). */
export async function exampleDeal(game: DemoGame): Promise<DemoRow["puzzle"]> {
  const { splitPuzzle } = await import("../src/lib/duel/secrets");
  return splitPuzzle(await exampleDealFull(game)).pub as unknown as DemoRow["puzzle"];
}

const SIMPLE_ESCAPES: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\0" };

/** A seroval string's escapes undone. */
export function unescapeWire(text: string): string {
  return text.replace(/\\(x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|[\s\S])/g, (_, e: string) =>
    e.length > 1 ? String.fromCharCode(parseInt(e.slice(1), 16)) : (SIMPLE_ESCAPES[e] ?? e),
  );
}

/** A server-function body or reply as plain data (requests wrap the node in `t`; replies are the node itself). */
export function wireBody(text: string): unknown {
  const parsed = JSON.parse(text) as { t?: unknown };
  return fromWire(parsed && typeof parsed.t === "object" ? parsed.t : parsed);
}

/** A minimal reader for the server functions' wire format (seroval JSON): objects, arrays, strings, numbers, booleans. */
export function fromWire(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  const n = node as { t: number; s?: unknown; p?: { k: string[]; v: unknown[] }; a?: unknown[]; i?: number };
  switch (n.t) {
    case 0: // number
      return typeof n.s === "number" ? n.s : Number(n.s);
    case 1: // string: seroval escapes quotes, backslashes, controls and <, >, / (\\", \\\\, \\n, \\xNN, \\uNNNN)
      return typeof n.s === "string" ? unescapeWire(n.s) : n.s;
    case 2: // constants: 0 null, 1 undefined, 2 true, 3 false…
      return n.s === 2 ? true : n.s === 3 ? false : n.s === 0 ? null : undefined;
    case 9: // array
      return (n.a ?? []).map(fromWire);
    case 10: // object
    case 11: {
      const out: Record<string, unknown> = {};
      (n.p?.k ?? []).forEach((k, i) => (out[k] = fromWire(n.p!.v[i])));
      return out;
    }
    default:
      return { __wire: n.t };
  }
}
