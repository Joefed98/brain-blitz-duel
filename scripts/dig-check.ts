import { DIG_BANK } from "../src/lib/duel/digBank.server";
import { digDecode, digEncode, digLine, digReplay, scoreDig, DIG_COLS, DIG_ROWS, type DigBoard } from "../src/lib/duel/dig";

let bad = 0;
const fail = (m: string) => {
  bad++;
  if (bad < 20) console.log(m);
};
const scores: number[] = [];
DIG_BANK.forEach((e, n) => {
  const board: DigBoard = { cols: DIG_COLS, rows: DIG_ROWS, tiles: e.tiles, water: e.water, budget: e.budget, minDigs: e.minDigs, targets: e.targets };
  const log = digDecode(e.intended, 192);
  const a = digReplay(board, digDecode(digEncode(log), 192));
  const b = digReplay(board, log);
  if (JSON.stringify(a.state) !== JSON.stringify(b.state)) fail(`${n}: replay identity`);
  if (!a.state.completeStep) fail(`${n}: intended incomplete`);
  if (a.dug !== e.minDigs) fail(`${n}: intended digs ${a.dug} ≠ min ${e.minDigs}`);
  if (e.budget !== e.minDigs + 3 || e.minDigs < 4) fail(`${n}: budget`);
  const s = a.state;
  const left = s.water.reduce((x, y) => x + y, 0);
  const inDrains = s.drained.reduce((x, y) => x + y, 0);
  if (inDrains + s.toxicIn > s.pool || s.lost + s.settledUnits + left > s.pool) fail(`${n}: conservation`);
  scores.push(scoreDig(s, e.minDigs));
  if (scoreDig(digReplay(board, []).state, e.minDigs) !== 0) fail(`${n}: empty score`);
});
// Interpolated drags are orthogonally connected.
for (let k = 0; k < 2000; k++) {
  const x = Math.floor(Math.random() * 192);
  const y = Math.floor(Math.random() * 192);
  let prev = x;
  for (const c of digLine(x, y, DIG_COLS)) {
    const d = Math.abs(c - prev);
    if (d !== 1 && d !== DIG_COLS) fail(`line gap ${x}->${y}`);
    prev = c;
  }
  if (x !== y && prev !== y) fail(`line end ${x}->${y}`);
}
console.log(
  `dig: ${DIG_BANK.length} boards (${DIG_BANK.filter((e) => e.tier === "hard").length} hard), problems ${bad}, intended scores ${Math.min(...scores)}–${Math.max(...scores)}`,
);
void DIG_ROWS;
