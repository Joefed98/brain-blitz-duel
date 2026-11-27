/**
 * Builds Mahjong's D6 Hard and Expert deal lists (mahjongRev 3, 23 Nov 2026; src/lib/duel/mahjongExpertDeals.server.ts):
 * for each, the first DEALS seeds of a fixed candidate stream whose deal (mahjongBuild on the level: Hard 104 tiles, 18
 * faces four times; Expert 136, all 34 faces four times) is forgiving: eight person-like lines (take the pair that frees most, a little noise between near-equal
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

type ML = "hard" | "expert";
const MJ_LEVELS: ML[] = ["hard", "expert"];
/**
 * Of eight person-like lines, at least this many must clear a board without a shuffle (Hard a little forgiving, Expert
 * more: with only Expert's boards filtered, a careful player found Expert's easier to clear than Hard's).
 */
export const MJ_FORGIVING_NEED: Record<ML, number> = { hard: 5, expert: 7 };

/** The deal's build order at a human pace through the grade: its score. */
export function mahjongExpertWitnessScore(seed: number, level: ML = "expert"): number {
  const game = mahjongLevelGame(level, MAHJONG_REV_LEVELS);
  const deal = mahjongBuild(seed, level, MAHJONG_REV_LEVELS);
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
  const p = { type: "mahjong", seed, mahjongRev: MAHJONG_REV_LEVELS, level } as unknown as PuzzleData;
  return gradeAnswer(p, raw, 0).score;
}

function keep(seed: number, level: ML): boolean {
  return mahjongBuildClears(seed, level, MAHJONG_REV_LEVELS) && mahjongForgiving(mahjongBuild(seed, level, MAHJONG_REV_LEVELS).face, seed, 8, MJ_FORGIVING_NEED[level]);
}

function render(lists: Record<ML, number[]>): string {
  return `/**
 * Mahjong's D6 Hard and Expert deals (mahjongRev 3; built by \`bun scripts/mahjong-expert-deals.ts\`, do not edit): ${DEALS}
 * seeds each of a fixed candidate stream whose deal (Hard 104 tiles, Expert 136) eight person-like lines all clear without
 * a shuffle, each deal's build order scoring 200 at a human pace through the server's grade. Server-only.
 */
export const MAHJONG_HARD_DEALS: readonly number[] = [${lists.hard.join(",")}];
export const MAHJONG_EXPERT_DEALS: readonly number[] = [${lists.expert.join(",")}];
`;
}

if (import.meta.main) {
  console.error = () => {};
  const check = process.argv.includes("--check");
  const lists = { hard: [] as number[], expert: [] as number[] };
  const tried = { hard: 0, expert: 0 };
  for (const level of MJ_LEVELS) {
    for (const seed of candidates()) {
      if (lists[level].length >= DEALS) break;
      tried[level]++;
      if (keep(seed, level)) {
        const score = mahjongExpertWitnessScore(seed, level);
        if (score !== 200) throw new Error(`${level} seed ${seed}: the build order scores ${score}`);
        lists[level].push(seed);
      }
    }
  }
  const text = render(lists);
  if (check) {
    const same = existsSync(OUT) && readFileSync(OUT, "utf8") === text;
    console.log(same ? `PASS mahjong Hard and Expert deals: ${lists.hard.length} and ${lists.expert.length} re-proved, the lists rebuild byte for byte` : "FAIL mahjong Hard and Expert deals differ from a rebuild");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(OUT, text);
  console.log(`kept hard ${lists.hard.length} of ${tried.hard}, expert ${lists.expert.length} of ${tried.expert} candidates; wrote ${OUT.pathname}`);
}
