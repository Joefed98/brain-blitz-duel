/**
 * The Attention games' level deals (the Attention overhaul, stage 3, 15 Nov 2026): after the Normal deal and every deal
 * layer, a puzzle dealt at Easy, Hard or Expert is re-dealt on that level's levers (src/lib/levels/attentionLevels.data.ts)
 * with the same seeded randomness, and given its level's clock. Never called at Normal (generate.server.ts), so every
 * Normal deal is exactly today's. Server-only (the generators' private halves stay here).
 */
import type { Level } from "@/lib/levels/levels";
import { BOMB_LEVELS, MAZE_LEVELS, PAIR_LEVELS, SCAN_LEVELS, SCAN_MINUTE_MS, SPOT_LEVELS, TALLY_LEVELS } from "@/lib/levels/attentionLevels.data";
import { SPOT_ENAMEL, lightness } from "./attentionPalette.data";
import { buildSpotPictureAt, differenceGroups, hideBonus } from "@/puzzles/spotTheDifference";
import { buildScanGridsAt } from "@/puzzles/symbolScan";
import { buildTallyAt } from "@/puzzles/countUp";
import { BOMB_EASY_BANK, BOMB_EXPERT_BANK, BOMB_HARD_BANK } from "./bombLevelsBank.server";
import { generateMazeLevel } from "./maze.server";
import { parOfParMoves } from "./parMoves";
import { PAIR_CLEAR_COLOURS, PAIR_CLEAR_SHAPES, legibleSpot, spreadTally, tallyColourClear, tallyCountedColours, preAttentionOverhaulPinned, spotColourSwaps } from "./attentionOverhaul";
import { randomBelow, shuffled } from "./random";
import type { BombPuzzleData, CountUpPuzzleData, SymbolScanPuzzleData, MazePuzzleData, PairCard, PairPuzzleData, PuzzleData, SpotPuzzleData, SpotShape, StroopColour } from "./types";

type OffNormal = Exclude<Level, "normal">;

/** Matchmaker at a level: its own count of pairs from its own share of the six shapes, a gold pair, its clock. */
function dealPairLevel(p: PairPuzzleData, level: OffNormal): PairPuzzleData {
  const row = PAIR_LEVELS[level];
  const shapes = shuffled([...PAIR_CLEAR_SHAPES]).slice(0, row.shapes);
  const combos: PairCard[] = shapes.flatMap((shape) => PAIR_CLEAR_COLOURS.map((colour) => ({ shape, colour }) as PairCard));
  const chosen = shuffled(combos).slice(0, row.pairs);
  const cards = shuffled(chosen.flatMap((card) => [card, { ...card }]));
  const gold = chosen[randomBelow(row.pairs)]!;
  return { ...p, cards, gold: { ...gold }, timeLimitMs: row.timeLimitMs } as PairPuzzleData;
}

/**
 * Labyrinth at a level: a new maze on the level's levers with the Normal deal's stamps (mazeRev and the stricter par's
 * stored `par`, the route's steps), no stars, its clock.
 */
function dealMazeLevel(p: MazePuzzleData, level: OffNormal): MazePuzzleData {
  const row = MAZE_LEVELS[level];
  const maze = generateMazeLevel(row);
  const { stars: _stars, ...normal } = p;
  const next: MazePuzzleData = { ...normal, cells: maze.cells, start: maze.start, exit: maze.exit, solution: maze.solution!, cols: row.cols, rows: row.rows, timeLimitMs: row.timeLimitMs };
  return typeof p.par === "number" ? { ...next, par: parOfParMoves(next) } : next;
}

/** Hard's subtler colours: each colour change takes the legible colour nearest in lightness (still the 12 L* minimum). */
function subtleColours(top: SpotShape[], bottom: SpotShape[]): SpotShape[] {
  const hex = (c: StroopColour) => SPOT_ENAMEL[c as keyof typeof SPOT_ENAMEL] ?? SPOT_ENAMEL.BROWN;
  const byCell = new Map(top.map((t) => [t.cell, t]));
  return bottom.map((b) => {
    const t = byCell.get(b.cell);
    if (!t || t.colour === b.colour || t.kind !== b.kind) return b;
    const options = spotColourSwaps(t.colour);
    if (!options.length) return b;
    const gap = (c: StroopColour) => Math.abs(lightness(hex(c)) - lightness(hex(t.colour)));
    const nearest = [...options].sort((x, y) => gap(x) - gap(y))[0]!;
    return { ...b, colour: nearest };
  });
}

/**
 * Double Take at a level: two pictures on the level's grid with its own count and kinds of difference (each kept only
 * when its panels differ in exactly those ways), the hidden seventh in one of them where the level has it, every
 * colour change legible by lightness (Hard's the nearest legible one), the Normal deal's stamps, its clock.
 */
function dealSpotLevel(p: SpotPuzzleData, level: OffNormal): SpotPuzzleData {
  const row = SPOT_LEVELS[level];
  const picture = () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const pic = buildSpotPictureAt({ cols: row.cols, rows: row.rows, differences: row.differences, kinds: row.kinds });
      if (pic.differences.length === row.differences && differenceGroups(pic.top, pic.bottom).length === row.differences && pic.top.length === row.cols * row.rows) return pic;
    }
    throw new Error("Double Take could not build a level picture");
  };
  const shop = picture();
  const reef = picture();
  const scene = Math.random() < 0.5 ? 0 : 1;
  const hidden = row.hidden ? hideBonus(scene === 0 ? shop : reef, row.cols) : null;
  const pics = [shop, reef].map((pic, i) => (i === scene && hidden ? { ...pic, top: hidden.top, bottom: hidden.bottom } : pic));
  const { bonus: _bonus, ...normal } = p;
  const dealt: SpotPuzzleData = legibleSpot({
    ...normal,
    top: pics[0]!.top,
    bottom: pics[0]!.bottom,
    reef: { top: pics[1]!.top, bottom: pics[1]!.bottom },
    differences: [...shop.differences.map((d) => ({ ...d, scene: 0 })), ...reef.differences.map((d) => ({ ...d, scene: 1 }))],
    ...(hidden ? { bonus: { ...hidden.bonus, scene } } : {}),
    timeLimitMs: row.timeLimitMs,
  });
  if (!row.subtleColours) return dealt;
  return { ...dealt, bottom: subtleColours(dealt.top, dealt.bottom), reef: { top: dealt.reef!.top, bottom: subtleColours(dealt.reef!.top, dealt.reef!.bottom) } };
}

/** Eagle Eye at a level: three grids on its levers (the Normal deal's stamps, scanRev 5), the 60 s clock. */
function dealScanLevel(p: SymbolScanPuzzleData, level: OffNormal): SymbolScanPuzzleData {
  const built = buildScanGridsAt(SCAN_LEVELS[level]);
  return { ...p, stages: built.stages, targets: built.targets, timeLimitMs: SCAN_MINUTE_MS };
}

/** Tally at a level: its trays on its levers, spread and made legible as the Normal deal (countRev 7), its clock. */
function dealTallyLevel(p: CountUpPuzzleData, level: OffNormal): CountUpPuzzleData {
  const row = TALLY_LEVELS[level];
  // Expert's two counted colours leave fewer colours clear of both in lightness: a tray the spread can't make legible
  // (an uncounted colour too close to a counted one) is dealt again.
  for (let attempt = 0; ; attempt++) {
    const built = buildTallyAt(row);
    const dealt = spreadTally({ ...p, stages: built.stages, counts: built.counts, timeLimitMs: row.timeLimitMs });
    const legible = dealt.stages.every((stage) => {
      const counted = tallyCountedColours(stage);
      return stage.shapes.every((shape) => tallyColourClear(shape.colour, counted));
    });
    if (legible || attempt >= 60) return dealt;
  }
}

/**
 * Bomb Defusal at a level: a panel from the level's bank (each proved: exactly one answer, every clue needed;
 * scripts/bomb-levels-bank.ts), drawn by the room seed; Expert's carries `bombInstant`. The Normal deal's stamps.
 */
function dealBombLevel(p: BombPuzzleData, level: OffNormal): BombPuzzleData {
  const bank = level === "easy" ? BOMB_EASY_BANK : level === "hard" ? BOMB_HARD_BANK : BOMB_EXPERT_BANK;
  const panel = bank[randomBelow(bank.length)]!;
  const { bombInstant: _instant, ...normal } = p;
  return { ...normal, ...panel, ...(p.depthRev !== undefined ? { depthRev: p.depthRev } : {}), timeLimitMs: BOMB_LEVELS[level].timeLimitMs, ...(BOMB_LEVELS[level].instant ? { bombInstant: 1 as const } : {}) };
}

/** A puzzle dealt at Easy, Hard or Expert on its level's levers; any other game unchanged. */
export function dealAttentionLevel(puzzle: PuzzleData, level: Level): PuzzleData {
  if (level === "normal" || preAttentionOverhaulPinned()) return puzzle;
  if (puzzle.type === "pairmatch") return dealPairLevel(puzzle, level);
  if (puzzle.type === "maze") return dealMazeLevel(puzzle, level);
  if (puzzle.type === "spotdiff") return dealSpotLevel(puzzle, level);
  if (puzzle.type === "symscan") return dealScanLevel(puzzle, level);
  if (puzzle.type === "countup") return dealTallyLevel(puzzle, level);
  if (puzzle.type === "bomb") return dealBombLevel(puzzle, level);
  return puzzle;
}
