import type { GridGeometry } from "./GridDrag";

/** Coordinate recordings made before these control-layout changes cannot replay. */
export const POLISH_A_DEMOS = new Set(["wordhunt", "tilegrid", "wordslide", "wordsearch", "letterwheel", "target", "equation", "numpyramid", "trail", "stopwatch", "numhunt", "reaction"]);
export const POLISH_A_PRESENTATION = "oct10-polish-a";
/** Roundabout re-balanced crossword/wheel split; older Roundabout coordinate demos are rejected. */
export const ROUNDABOUT_PRESENTATION = "oct10-roundabout-balance";
/** Polish B rescaled/centred these boards; older coordinate demos are rejected. */
export const POLISH_B_DEMOS = new Set(["maze", "pairmatch", "unblock", "blockparty", "gravity", "tiles", "laser", "lightsout", "sudoku", "flow", "safe", "bomb", "nonogram", "shikaku", "lightup"]);
export const POLISH_B_PRESENTATION = "oct10-polish-b";
/** Word polish (13 Oct 2026) re-centred these boards; older coordinate demos are rejected. */
export const WORD_POLISH_DEMOS = new Set(["wordsmith", "tilegrid", "wordslide", "letterwheel", "strikeout", "swapword", "codeword"]);
export const WORD_POLISH_PRESENTATION = "oct13-word-polish";
/** Logic polish (13 Oct 2026) centred and resized these boards; older coordinate demos are rejected. */
export const LOGIC_POLISH_DEMOS = new Set(["lightsout", "sudoku", "tower", "tubes", "safe", "bomb", "nonogram", "flood", "tents", "shikaku", "lightup"]);
export const LOGIC_POLISH_PRESENTATION = "oct13-logic-polish";
/** Number polish (13 Oct 2026) moved these boards and controls; older coordinate demos are rejected. */
export const NUMBER_POLISH_DEMOS = new Set(["target", "equation", "balance", "numpyramid", "trail", "measure", "checkout", "numline"]);
export const NUMBER_POLISH_PRESENTATION = "oct13-number-polish";
/**
 * Pattern polish (13 Oct 2026) moved these boards and controls: played against today's layout
 * (scripts/shots/demo-taps.ts), coordinate demos recorded before it miss, so they are rejected.
 * (Tessellate's touches all land since its tray draws in the demo player, so it keeps Polish B.)
 */
export const PATTERN_POLISH_DEMOS = new Set(["unblock", "iceslide", "tiles", "rings", "pipes", "push"]);
export const PATTERN_POLISH_PRESENTATION = "oct13-pattern-polish";
/** Speed & Attention polish (13 Oct 2026) moved these boards; older coordinate demos miss and are rejected. */
export const SPEED_POLISH_DEMOS = new Set(["numhunt", "symscan", "spotdiff", "countup"]);
export const SPEED_POLISH_PRESENTATION = "oct13-speed-polish";
/** Move limits (13 Oct 2026): Operator's tries line sits inside its board and moves the equation; older coordinate demos are rejected. */
export const MOVE_LIMIT_DEMOS = new Set(["equation"]);
export const MOVE_LIMIT_PRESENTATION = "oct13-move-limits";
/**
 * Pattern / Logic batch (14 Oct 2026): Jumbled's board became the 3×3 grid plus one extra cell
 * (tilesRev 1), Polypotions' Undo / Reset grew and moved up, and Colour Flood's moves line moved
 * above its raised colours. Their boards move, so older coordinate demos are rejected.
 * (Bomb Defusal's demos are stopped by version in introDemo.functions.ts; Box Six's board did not move.)
 */
export const OCT14_BATCH_DEMOS = new Set(["tiles", "tubes", "flood"]);
export const OCT14_BATCH_PRESENTATION = "oct14-pattern-logic-batch";
/**
 * Attention rework (14 Oct 2026): Eagle Eye's grid 3 header shows two targets, Double Take
 * has a picture counter, a misses counter and a Next picture button, and Tally has four trays,
 * so every board moved; older coordinate demos are rejected until re-recorded.
 */
export const ATTENTION_REWORK_DEMOS = new Set(["symscan", "spotdiff", "countup"]);
export const ATTENTION_REWORK_PRESENTATION = "oct14-attention-rework";
/** Speed tuning (14 Oct 2026): Ascend's move timer sits above the board, so the board moves; older coordinate demos are rejected. */
export const SPEED_TUNING_DEMOS = new Set(["numhunt"]);
export const SPEED_TUNING_PRESENTATION = "oct14-speed-tuning";
/**
 * Number tuning (14 Oct 2026): Counterweight's rack and Ballpark's Place button stand 16 px higher, which moves
 * both boards (and Counterweight deals a fourth, 10-notch scale); older coordinate demos would miss, so they are
 * rejected until re-recorded. Integer Pyramid's fix there changes no layout and keeps its demos.
 */
export const NUMBER_TUNING_DEMOS = new Set(["balance", "numline"]);
export const NUMBER_TUNING_PRESENTATION = "oct14-number-tuning";
/**
 * Word batch (14 Oct 2026): Strikeout's one-word-at-a-time board, Lookout's larger themed bank and counted
 * chips, Roundabout's bigger crosswords with raised buttons and Cryptogrid's fifth starting letter change
 * the fixed intro examples and move their boards; older coordinate demos are rejected until re-recorded.
 */
export const WORD_BATCH_DEMOS = new Set(["strikeout", "wordsearch", "letterwheel", "codeword"]);
export const WORD_BATCH_PRESENTATION = "oct14-word-batch";
/**
 * Number depth to 200 (25 Oct 2026, depthRev 1): Exact deals targets with a five- and a six-number answer and
 * Checkout's boards take a big finish, so both fixed intro examples change; older coordinate demos would tap the
 * wrong numbers and wedges, so they are rejected (the intro shows the game's still) until re-recorded.
 */
export const NUMBER_DEPTH_DEMOS = new Set(["target", "checkout"]);
export const NUMBER_DEPTH_PRESENTATION = "oct25-number-depth";
/**
 * Lookout depth (25 Oct 2026, wordSearchRev 3): the board hides a bonus word (its letters change the intro grid)
 * and the chips gain the bonus star; older coordinate demos are rejected until re-recorded.
 */
export const LOOKOUT_DEPTH_DEMOS = new Set(["wordsearch"]);
export const LOOKOUT_DEPTH_PRESENTATION = "oct25-lookout-bonus";
/**
 * Forage depth (25 Oct 2026, wordHuntRev 3): the 6×6 board with its golden tile replaces the 5×5 one, so every tile
 * moved; older coordinate demos are rejected (the intro shows its still) until re-recorded.
 */
export const FORAGE_DEPTH_DEMOS = new Set(["wordhunt"]);
export const FORAGE_DEPTH_PRESENTATION = "oct25-forage-depth";
/**
 * Roundabout depth (25 Oct 2026, wheelRev 2): the bonus jar sits in the trace row and real non-crossword words now
 * fill it; older demos never show it, so they are rejected (the intro shows its still) until re-recorded.
 */
export const ROUNDABOUT_DEPTH_DEMOS = new Set(["letterwheel"]);
export const ROUNDABOUT_DEPTH_PRESENTATION = "oct25-roundabout-jar";
export function puzzlePresentation(type: string): string {
  if (ROUNDABOUT_DEPTH_DEMOS.has(type)) return ROUNDABOUT_DEPTH_PRESENTATION;
  if (FORAGE_DEPTH_DEMOS.has(type)) return FORAGE_DEPTH_PRESENTATION;
  if (LOOKOUT_DEPTH_DEMOS.has(type)) return LOOKOUT_DEPTH_PRESENTATION;
  if (NUMBER_DEPTH_DEMOS.has(type)) return NUMBER_DEPTH_PRESENTATION;
  if (OCT14_BATCH_DEMOS.has(type)) return OCT14_BATCH_PRESENTATION;
  if (WORD_BATCH_DEMOS.has(type)) return WORD_BATCH_PRESENTATION;
  if (ATTENTION_REWORK_DEMOS.has(type)) return ATTENTION_REWORK_PRESENTATION;
  if (SPEED_TUNING_DEMOS.has(type)) return SPEED_TUNING_PRESENTATION;
  if (NUMBER_TUNING_DEMOS.has(type)) return NUMBER_TUNING_PRESENTATION;
  if (MOVE_LIMIT_DEMOS.has(type)) return MOVE_LIMIT_PRESENTATION;
  if (PATTERN_POLISH_DEMOS.has(type)) return PATTERN_POLISH_PRESENTATION;
  if (SPEED_POLISH_DEMOS.has(type)) return SPEED_POLISH_PRESENTATION;
  if (WORD_POLISH_DEMOS.has(type)) return WORD_POLISH_PRESENTATION;
  if (LOGIC_POLISH_DEMOS.has(type)) return LOGIC_POLISH_PRESENTATION;
  if (NUMBER_POLISH_DEMOS.has(type)) return NUMBER_POLISH_PRESENTATION;
  return type === "letterwheel" ? ROUNDABOUT_PRESENTATION : POLISH_B_DEMOS.has(type) ? POLISH_B_PRESENTATION : POLISH_A_DEMOS.has(type) ? POLISH_A_PRESENTATION : type === "wordsmith" ? WORDSMITH_PRESENTATION : type === "balance" ? BALANCE_PRESENTATION : PUZZLE_INPUT_PRESENTATION;
}
export const REVISED_PUZZLE_DEMOS = new Set([...NUMBER_DEPTH_DEMOS, ...ROUNDABOUT_DEPTH_DEMOS, ...FORAGE_DEPTH_DEMOS, ...LOOKOUT_DEPTH_DEMOS, ...OCT14_BATCH_DEMOS, ...WORD_BATCH_DEMOS, ...ATTENTION_REWORK_DEMOS, ...SPEED_TUNING_DEMOS, ...NUMBER_TUNING_DEMOS, ...MOVE_LIMIT_DEMOS, ...POLISH_A_DEMOS, ...POLISH_B_DEMOS, ...WORD_POLISH_DEMOS, ...LOGIC_POLISH_DEMOS, ...NUMBER_POLISH_DEMOS, ...PATTERN_POLISH_DEMOS, ...SPEED_POLISH_DEMOS, "wordsmith", "wordhunt", "target", "lightsout", "maze", "rings", "flood", "balance"]);
export const BALANCE_PRESENTATION = "oct9b-tall-beam";
export const PUZZLE_INPUT_PRESENTATION = "oct6-ring-controls";
export function puzzleInputDemoCompatible(type: string, log: unknown): boolean {
  if (!REVISED_PUZZLE_DEMOS.has(type)) return true;
  if (typeof log !== "object" || log === null || !("presentation" in log)) return false;
  return log.presentation === puzzlePresentation(type);
}
export const WORDSMITH_PRESENTATION = WORD_POLISH_PRESENTATION;

/** A tile can be used once; re-tapping removes only that occurrence. */
export function toggleWordsmithTile(selected: readonly number[], index: number): number[] {
  return selected.includes(index) ? selected.filter((tile) => tile !== index) : [...selected, index];
}

/** Strict inner-60% hit box, with no nearest-cell or gap snapping. */
export function wordHuntInnerCell(g: GridGeometry | null, cols: number, rows: number): number | null {
  if (!g || g.cellW <= 0 || g.cellH <= 0) return null;
  const col = Math.floor(g.x / (g.cellW + g.gapX));
  const row = Math.floor(g.y / (g.cellH + g.gapY));
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  const x = g.x - col * (g.cellW + g.gapX);
  const y = g.y - row * (g.cellH + g.gapY);
  return x >= g.cellW * 0.2 && x <= g.cellW * 0.8 && y >= g.cellH * 0.2 && y <= g.cellH * 0.8
    ? row * cols + col : null;
}

export function extendWordHuntPath(path: readonly number[], cell: number, cols: number): number[] {
  const last = path.at(-1);
  if (last === undefined) return [cell];
  if (last === cell) return [...path];
  if (path.length > 1 && path.at(-2) === cell) return path.slice(0, -1);
  const dr = Math.abs(Math.floor(last / cols) - Math.floor(cell / cols));
  const dc = Math.abs(last % cols - cell % cols);
  if (path.includes(cell) || dr > 1 || dc > 1) return [...path];
  return [...path, cell];
}