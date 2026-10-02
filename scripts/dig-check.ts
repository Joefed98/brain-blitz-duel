import { DIG_BANK } from "../src/lib/duel/digBank.server";
import { digDecode, digEncode, digReplay, scoreDig, DIG_COLS, DIG_ROWS } from "../src/lib/duel/dig";
let bad = 0; const scores: number[] = [];
for (const e of DIG_BANK) {
  const board = { cols: DIG_COLS, rows: DIG_ROWS, tiles: e.tiles, water: e.water };
  const intended = [...e.route].reverse().map((cell, i) => ({ step: i + 1, cell }));
  const a = digReplay(board, digDecode(digEncode(intended), 192));
  const b = digReplay(board, intended);
  if (JSON.stringify(a.state) !== JSON.stringify(b.state)) bad++;
  if (a.state.collected < a.state.full) bad++;
  const water0 = [...e.water].reduce((n, c) => n + +c, 0);
  if (a.state.collected + a.state.lost + a.state.water.reduce((n, x) => n + x, 0) !== water0) bad++;
  scores.push(scoreDig(a.state));
  if (scoreDig(digReplay(board, []).state) !== 0) bad++;
}
console.log(`dig: ${DIG_BANK.length} boards, problems ${bad}, intended-route scores ${Math.min(...scores)}–${Math.max(...scores)}`);
