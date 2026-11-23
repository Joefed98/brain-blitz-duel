/**
 * Builds Mahjong's D6 Expert deal list (mahjongRev 3, 23 Nov 2026; src/lib/duel/mahjongExpertDeals.server.ts): the
 * first DEALS seeds of a fixed candidate stream whose 136-tile Expert deal (mahjongBuild on the level, all 34 faces dealt
 * four times) is forgiving: eight person-like lines (take the pair that frees most, a little noise between near-equal
 * pairs; scripts/cards/mahjongLines.ts) all clear it without a shuffle. On an all-quad board most deals trap a careful
 * player in a dead end (the elite under HUMAN_LIMITS shuffled on 77 of 96 unfiltered boards), so Expert's difficulty is
 * the size of the stack and the clock, not a coin toss on which copy of a face to take. Each kept deal's build order,
 * played at a human pace (an input every 24 ticks: HUMAN_LIMITS' 0.25 s to react and 0.15 s to move), scores exactly 200
 * through the server's grade.
 *
 *   bun scripts/mahjong-expert-deals.ts            (searches the stream; writes the list)
 *   bun scripts/mahjong-expert-deals.ts --check    (re-proves every listed seed and that the list rebuilds byte for byte)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mahjongBuild, mahjongBuildClears, mahjongCheckpoint, mahjongLevelGame, MAHJONG_INPUT_TAP, MAHJONG_REV_LEVELS } from "../src/lib/arcade/mahjong";
import { encodeMahjongRun } from "../src/lib/duel/mahjong";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { inputAt, recordInput, type ArcadeInputEvent, type InputRange } from "../src/lib/arcade/engine";
import type { PuzzleData } from "../src/lib/duel/types";
import { mahjongForgiving } from "./cards/mahjongLines";

const OUT = new URL("../src/lib/duel/mahjongExpertDeals.server.ts", import.meta.url);
const DEALS = 200;
export const MJ_HUMAN_GAP = 24;

function* candidates(): Generator<number> {
  let a = 0x6d6a_7833 >>> 0;
  for (;;) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    yield ((((t ^ (t >>> 14)) >>> 0) % 0x7fff_ffff) + 1) >>> 0;
  }
}

/** The deal's build order at a human pace through the grade: its score. */
export function mahjongExpertWitnessScore(seed: number): number {
  const game = mahjongLevelGame("expert", MAHJONG_REV_LEVELS);
  const deal = mahjongBuild(seed, "expert", MAHJONG_REV_LEVELS);
  const inputs = deal.order.flatMap(([a, b]) => [a, b]);
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: unknown[] = [];
  let k = 0;
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    if (k < inputs.length && t >= MJ_HUMAN_GAP * (k + 1)) recordInput(events, { k: MAHJONG_INPUT_TAP, a: inputs[k++]!, b: 0, c: 0, d: 0, t }, (game.inputRanges ?? []) as readonly InputRange[]);
    state = game.step(state, inputAt(events, t));
    if (state.tick % 300 === 0) checkpoints.push(mahjongCheckpoint(state));
  }
  const raw = encodeMahjongRun({ seed, claimedScore: game.score(state), events, endTick: state.tick, checkpoints } as never);
  const p = { type: "mahjong", seed, mahjongRev: MAHJONG_REV_LEVELS, level: "expert" } as unknown as PuzzleData;
  return gradeAnswer(p, raw, 0).score;
}

function keep(seed: number): boolean {
  return mahjongBuildClears(seed, "expert", MAHJONG_REV_LEVELS) && mahjongForgiving(mahjongBuild(seed, "expert", MAHJONG_REV_LEVELS).face, seed);
}

function render(list: number[]): string {
  return `/**
 * Mahjong's D6 Expert deals (mahjongRev 3; built by \`bun scripts/mahjong-expert-deals.ts\`, do not edit): ${list.length} seeds
 * of a fixed candidate stream whose 136-tile deal eight person-like lines all clear without a shuffle, each deal's build
 * order scoring 200 at a human pace through the server's grade. Server-only.
 */
export const MAHJONG_EXPERT_DEALS: readonly number[] = [${list.join(",")}];
`;
}

if (import.meta.main) {
  console.error = () => {};
  const check = process.argv.includes("--check");
  const list: number[] = [];
  let tried = 0;
  for (const seed of candidates()) {
    if (list.length >= DEALS) break;
    tried++;
    if (keep(seed)) {
      const score = mahjongExpertWitnessScore(seed);
      if (score !== 200) throw new Error(`seed ${seed}: the build order scores ${score}`);
      list.push(seed);
    }
  }
  const text = render(list);
  if (check) {
    const same = existsSync(OUT) && readFileSync(OUT, "utf8") === text;
    console.log(same ? `PASS mahjong Expert deals: ${list.length} re-proved, the list rebuilds byte for byte` : "FAIL mahjong Expert deals differ from a rebuild");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(OUT, text);
  console.log(`kept ${list.length} of ${tried} candidates; wrote ${OUT.pathname}`);
}
