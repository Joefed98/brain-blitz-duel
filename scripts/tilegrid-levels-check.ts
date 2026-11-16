/**
 * tilegrid-levels-check (the Word overhaul, stage 3, 15 Nov 2026; src/lib/levels/word/tilegrid.ts): Interlock's Easy,
 * Hard and Expert.
 *
 *  1. The registry (open by design: any grid of real words using every tile finishes), the level lines, the clocks (at
 *     most 120 s), Normal byte for byte the plain deal, every level the same deal for every player (word-levels-shared.ts).
 *  2. Every level board is an H of three common words, fifteen tiles, every run a real word, its tray the solution's
 *     letters, and the H read back from the solution keeps the level's crossing rules (Easy: each down word starts on
 *     the across word; Hard: a 7-letter across word, each down word crossed away from both its ends; Expert: that, and
 *     never on the across word's first or last letter).
 *  3. The tuning numbers: the kit's near-perfect and great play, graded by the server, on fixed seeds per level.
 *
 *   bun scripts/tilegrid-levels-check.ts
 */
import { TG_TIME_MS } from "../src/lib/duel/tileGrid";
import { tileGridRuns, placedCount, TG_TILES, TG_SIZE } from "../src/lib/duel/tileGrid";
import { tileGridValid, wordPool } from "../src/lib/duel/tileGrid.server";
import type { TileGridPuzzleData } from "../src/lib/duel/types";
import { TILEGRID_LEVEL_SETTINGS } from "../src/lib/levels/word/tilegrid";
import { BEYOND, checkCount, commonLevelChecks, kitScore, ok, roomDeal } from "./word-levels-shared";

const t0 = Date.now();
const SEEDS = [11, 202, 3003, 40004, 500005, 6000006, 70, 81, 92, 103];
const deals = commonLevelChecks("tilegrid", "open", SEEDS, (level) => TILEGRID_LEVEL_SETTINGS[level].timeLimitMs);
const pool = new Set(wordPool().map((w) => w.toUpperCase()));

for (const level of BEYOND) {
  const s = TILEGRID_LEVEL_SETTINGS[level];
  for (const d of deals.get(level)! as TileGridPuzzleData[]) {
    const sol = d.solution ?? [];
    ok(placedCount(sol) === TG_TILES && tileGridValid(sol), `tilegrid ${level}: fifteen tiles, every run a real word`);
    ok([...d.tray].sort().join("") === sol.filter(Boolean).sort().join(""), `tilegrid ${level}: the tray holds the solution's letters`);
    const runs = tileGridRuns(sol).filter((r) => r.word.length >= 3);
    const across = runs.filter((r) => r.horizontal);
    const downs = runs.filter((r) => !r.horizontal);
    ok(across.length === 1 && downs.length === 2, `tilegrid ${level}: an H of one across word and two down words`);
    ok(runs.every((r) => pool.has(r.word)), `tilegrid ${level}: all three are common words`);
    const a = across[0]!;
    if (s.acrossLen) ok(a.word.length === s.acrossLen, `tilegrid ${level}: a ${s.acrossLen}-letter across word`);
    const row = Math.floor(a.cells[0]! / TG_SIZE);
    for (const down of downs) {
      const j = down.cells.findIndex((c) => Math.floor(c / TG_SIZE) === row);
      const i = a.cells.indexOf(down.cells[j]!);
      ok(j >= 0 && i >= 0, `tilegrid ${level}: each down word crosses the across word`);
      if (s.cross === "start") ok(j === 0, `tilegrid ${level}: the down word starts on the across word`);
      else ok(j > 0 && j < down.word.length - 1, `tilegrid ${level}: crossed away from both ends of the down word`);
      if (s.innerAcross) ok(i > 0 && i < a.word.length - 1, `tilegrid ${level}: never on the across word's first or last letter`);
    }
  }
}

// 3. The tuning numbers (Joe's tool's bots and grading, on six fixed seeds).
const TUNE = [0, 1, 2, 3, 4, 5].map((n) => 9000 + n * 37);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const bands: Record<string, { near: number; great: number }> = {};
for (const level of ["easy", "normal", "hard", "expert"] as const) {
  const near: number[] = [];
  const great: number[] = [];
  for (const seed of TUNE) {
    const d = roomDeal("tilegrid", seed, level === "normal" ? undefined : level);
    near.push(kitScore("tilegrid", d, "near", `${level}:${seed}`).score);
    great.push(kitScore("tilegrid", d, "great", `${level}:${seed}`).score);
  }
  bands[level] = { near: avg(near), great: avg(great) };
}
// Tuned 16 Nov 2026 (Joe: a clear step up, Expert still scoring well for the near-perfect player): the near-perfect
// player scores well on every level, the great player steps down on Hard and Expert, whose clocks bite.
for (const level of ["easy", "normal", "hard", "expert"] as const) {
  ok(bands[level]!.near >= 190, `tilegrid ${level}: near-perfect averages ${bands[level]!.near.toFixed(1)} (at least 190)`);
}
ok(bands["easy"]!.great >= 185 && bands["normal"]!.great >= 185, "tilegrid: Easy and Normal are comfortable for the great player (185+)");
ok(bands["hard"]!.great < bands["normal"]!.great, "tilegrid: Hard is a step up for the great player");
ok(bands["expert"]!.great < bands["hard"]!.great, "tilegrid: Expert is a further step up for the great player");
ok(bands["expert"]!.great >= 100, "tilegrid: the great player still scores on Expert (100+)");
ok(TG_TIME_MS === 100_000, "tilegrid: Normal keeps its 100 s");

console.log(`PASS: tilegrid levels — ${checkCount()} checks in ${((Date.now() - t0) / 1000).toFixed(1)} s (near-perfect ${["easy", "normal", "hard", "expert"].map((l) => `${l} ${bands[l]!.near.toFixed(0)}`).join(", ")})`);
