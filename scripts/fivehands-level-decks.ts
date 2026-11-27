/**
 * Builds Five Hands' level decks (D6, 23 Nov 2026; docs/arcade-standard/fivehands.md "Levels on fiveHandsRev 4"):
 * src/lib/duel/fiveHandsLevelDecks.server.ts lists, for Easy, Hard and Expert, the first DECKS candidate seeds (a fixed
 * stream, below) whose exact best arrangement on the level's hand table (scripts/cards/fiveHandsBest.ts: the five rows
 * plus the best column) reaches the level's 200 (FH_LEVEL_RULES_V4[level].full hand points), and whose best line, played
 * at a human pace (one input every HUMAN_GAP ticks: HUMAN_LIMITS' 0.25 s to react and 0.15 s to move), replays through
 * the server's own grade (gradeAnswer on a fiveHandsRev 4 level puzzle) to exactly 200. Witnesses (each deck's taps):
 * scripts/fixtures/fivehands-level-decks.json.gz.
 *
 *   bun scripts/fivehands-level-decks.ts            (searches every candidate in order; writes the decks and witnesses)
 *   bun scripts/fivehands-level-decks.ts --check    (replays every stored witness through the grade, each exactly 200 at
 *                                                    the human pace; the deck file rebuilds byte for byte from them)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { fhCheckpoint, FH_INPUT_PICK, FH_INPUT_PLACE, FH_LEVEL_RULES_V4, FH_REV_128, fiveHandsLevelGame } from "../src/lib/arcade/cards/fiveHands";
import { encodeFiveHandsRun } from "../src/lib/duel/cards";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { ARCADE_PHASE_SLACK_MS } from "../src/lib/duel/catalogue";
import { inputAt, recordInput, type ArcadeInputEvent, type InputRange } from "../src/lib/arcade/engine";
import type { PuzzleData } from "../src/lib/duel/types";
import { fhBest } from "./cards/fiveHandsBest";

export const FH_LEVEL_DECK_LEVELS = ["easy", "hard", "expert"] as const;
export type FhDeckLevel = (typeof FH_LEVEL_DECK_LEVELS)[number];
const OUT = new URL("../src/lib/duel/fiveHandsLevelDecks.server.ts", import.meta.url);
export const FH_LEVEL_DECKS_WITNESS = new URL("./fixtures/fivehands-level-decks.json.gz", import.meta.url);
/** Decks kept a level. */
const DECKS = 300;
/** HUMAN_LIMITS (0.25 s to react, 0.15 s to move) in ticks: the witness's gap between inputs. */
export const HUMAN_GAP = 24;

/** The candidate stream: mulberry32 from a fixed start, seeds in arcadeSeed's range (1 to 2^31 − 1). */
function candidates(): () => number {
  let a = 0x5d6f_1a23 >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((((t ^ (t >>> 14)) >>> 0) % 0x7fff_ffff) + 1) >>> 0;
  };
}

export type FhDeckWitness = { seed: number; taps: number[]; column: number };

/** Plays a witness at the human pace on the level's game and grades it as the server does. */
export function fhDeckVerdict(level: FhDeckLevel, w: FhDeckWitness): { score: number; flagged: boolean } {
  const game = fiveHandsLevelGame(level, FH_REV_128);
  const inputs = [...w.taps.map((row) => ({ k: FH_INPUT_PLACE, a: row, b: 0, c: 0, d: 0 })), { k: FH_INPUT_PICK, a: w.column, b: 0, c: 0, d: 0 }];
  let state = game.init(w.seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: unknown[] = [];
  let k = 0;
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    if (k < inputs.length && t >= HUMAN_GAP * (k + 1)) recordInput(events, { ...inputs[k++]!, t }, (game.inputRanges ?? []) as readonly InputRange[]);
    state = game.step(state, inputAt(events, t));
    if (state.tick % 300 === 0) checkpoints.push(fhCheckpoint(state));
  }
  const raw = encodeFiveHandsRun({ seed: w.seed, claimedScore: game.score(state), events, endTick: state.tick, checkpoints } as never);
  const r = FH_LEVEL_RULES_V4[level];
  const puzzle = { type: "fivehands", seed: w.seed, fiveHandsRev: FH_REV_128, level, timeLimitMs: r.seconds * 1000 + ARCADE_PHASE_SLACK_MS } as unknown as PuzzleData;
  const g = gradeAnswer(puzzle, raw, 0);
  return { score: g.score, flagged: Boolean((g.extra as { flagged?: unknown } | undefined)?.flagged) };
}

function render(decks: Record<FhDeckLevel, number[]>): string {
  const rows = FH_LEVEL_DECK_LEVELS.map((l) => `  ${l}: [${decks[l].join(",")}],`).join("\n");
  const rule = (l: FhDeckLevel) => `${l} 200 at ${FH_LEVEL_RULES_V4[l].full} hand points in ${FH_LEVEL_RULES_V4[l].seconds} s`;
  return `/**
 * Five Hands' level decks on fiveHandsRev 4 (built by \`bun scripts/fivehands-level-decks.ts\`, do not edit): for each
 * level the first ${DECKS} seeds of a fixed candidate stream whose exact best arrangement on the level's hand table reaches
 * the level's 200 (${FH_LEVEL_DECK_LEVELS.map(rule).join("; ")}), the best line played at a human pace (an input every
 * ${HUMAN_GAP} ticks) replaying through the server's grade to exactly 200 (witnesses in
 * scripts/fixtures/fivehands-level-decks.json.gz). Server-only.
 */
export const FH_LEVEL_DECKS: Readonly<Record<"easy" | "hard" | "expert", readonly number[]>> = {
${rows}
};
`;
}

if (import.meta.main && process.argv.includes("--check")) {
  console.error = () => {};
  const stored = JSON.parse(gunzipSync(readFileSync(FH_LEVEL_DECKS_WITNESS)).toString("utf8")) as Record<FhDeckLevel, FhDeckWitness[]>;
  let bad = 0;
  for (const l of FH_LEVEL_DECK_LEVELS) {
    for (const w of stored[l]) {
      const v = fhDeckVerdict(l, w);
      if (v.score !== 200 || v.flagged) {
        bad++;
        console.log(`FAIL ${l} seed ${w.seed}: ${v.score}${v.flagged ? " (flagged)" : ""}`);
      }
    }
  }
  const decks = Object.fromEntries(FH_LEVEL_DECK_LEVELS.map((l) => [l, stored[l].map((w) => w.seed)])) as Record<FhDeckLevel, number[]>;
  const same = existsSync(OUT) && readFileSync(OUT, "utf8") === render(decks);
  if (!same) console.log("FAIL the deck file does not rebuild byte for byte from the witnesses");
  console.log(bad === 0 && same ? `PASS ${FH_LEVEL_DECK_LEVELS.map((l) => `${l} ${stored[l].length}`).join(", ")} decks at 200` : `FAIL ${bad} witnesses`);
  process.exit(bad === 0 && same ? 0 : 1);
} else if (import.meta.main) {
  console.error = () => {};
  const out = {} as Record<FhDeckLevel, FhDeckWitness[]>;
  for (const l of FH_LEVEL_DECK_LEVELS) {
    const r = FH_LEVEL_RULES_V4[l];
    const next = candidates();
    const kept: FhDeckWitness[] = [];
    let tried = 0;
    while (kept.length < DECKS) {
      const seed = next();
      tried++;
      const best = fhBest(seed, r.tableRev);
      if (best.total < r.full!) continue;
      const w = { seed, taps: best.taps, column: best.column };
      const v = fhDeckVerdict(l, w);
      if (v.score !== 200 || v.flagged) throw new Error(`${l} seed ${seed}: the best line scores ${v.score} through the grade`);
      kept.push(w);
    }
    out[l] = kept;
    console.log(`${l}: ${kept.length} of ${tried} candidates kept`);
  }
  writeFileSync(FH_LEVEL_DECKS_WITNESS, gzipSync(JSON.stringify(out)));
  writeFileSync(OUT, render(Object.fromEntries(FH_LEVEL_DECK_LEVELS.map((l) => [l, out[l].map((w) => w.seed)])) as Record<FhDeckLevel, number[]>));
  console.log("wrote", OUT.pathname);
}
