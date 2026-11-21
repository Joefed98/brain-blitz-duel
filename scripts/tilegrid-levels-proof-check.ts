/**
 * tilegrid-levels-proof-check (D1, 21 Nov 2026; difficulty-spec.md "Interlock"): Interlock's redesigned levels and the
 * proof behind them.
 *
 *  1. The ladder: tiles in the tray 10 / 15 / 19 / 23 on boards of 6 / 7 / 8 / 9, clocks inside 120 s, Expert's words lit
 *     only on Done.
 *  2. The banks (scripts/tilegrid-level-bank.ts): every entry a board of the level's side holding exactly its tiles, every
 *     run a real word, the runs exactly the level's crossing words (5 and 6 letters), no rack twice.
 *  3. The deals: tileGridRev 5 with the level, size, tile count and clock stored; the tray is the board's letters; the
 *     same seed deals the same board; Normal deals today's tileGridRev 4 on 7 × 7 with no size or tile count.
 *  4. Grading on the stored size: the board's own grid finishes; an unfinished grid earns 120 × tiles counted ÷ tiles.
 *  5. The proof (HUMAN_LIMITS: 0.25 s to react, 0.15 s a tap; scripts/word-human-solvers.ts tilegridLine): the person-
 *     like builder (scripts/tilegrid-human.ts, never sees the board) finishes every sampled Hard board inside its clock,
 *     and on every sampled Expert board its timed line scores 200 through the server's grader. Quick depth samples 12
 *     deals a level; CHECKS_FULL=1 plays every bank entry.
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { decodeTileGrid, encodeTileGrid, tileGridRuns, TILE_GRID_LEVEL_REV } from "../src/lib/duel/tileGrid";
import { tileGridValid } from "../src/lib/duel/tileGrid.server";
import { TILEGRID_LEVEL_BANK } from "../src/lib/duel/tilegridLevelBank.server";
import { tileGridLevelPuzzle } from "../src/lib/duel/levels/tilegrid.server";
import type { TileGridPuzzleData } from "../src/lib/duel/types";
import { TILEGRID_LEVEL_SETTINGS } from "../src/lib/levels/word/tilegrid";
import { MAX_ROUND_CLOCK_MS } from "../src/lib/levels/levels";
import { WORD_HUMAN_LIMITS } from "../src/lib/duel/levels/humanLimits";
import { HUMAN_LIMITS } from "./arcade-skill-bands/human";
import { tilegridLine } from "./word-human-solvers";

const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
let passes = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};
type Lv = "easy" | "hard" | "expert";
const LEVELS: readonly Lv[] = ["easy", "hard", "expert"];
const deal = (seed: number, level?: Lv) =>
  withSeededRandom(seed, () => generatePuzzle("tilegrid", { bankSeed: seed, ...(level ? { level } : {}) })) as TileGridPuzzleData;

/* 1. The ladder */
{
  const s = TILEGRID_LEVEL_SETTINGS;
  ok(s.easy.tiles < 15 && 15 < s.hard.tiles && s.hard.tiles < s.expert.tiles, `tiles rise easy ${s.easy.tiles} < normal 15 < hard ${s.hard.tiles} < expert ${s.expert.tiles}`);
  ok(s.easy.size < 7 && 7 < s.hard.size && s.hard.size < s.expert.size, `boards grow easy ${s.easy.size} < 7 < hard ${s.hard.size} < expert ${s.expert.size}`);
  for (const l of LEVELS) {
    ok(s[l].timeLimitMs <= MAX_ROUND_CLOCK_MS, `${l}: clock ${s[l].timeLimitMs} ms inside 120 s`);
    ok(s[l].lengths.reduce((a, b) => a + b, 0) - (s[l].lengths.length - 1) === s[l].tiles, `${l}: the crossing words' letters less one a crossing are the ${s[l].tiles} tiles`);
  }
  ok(s.expert.lightsOnDone === true && !s.hard.lightsOnDone && !s.easy.lightsOnDone, "only Expert lights words on Done");
  ok(WORD_HUMAN_LIMITS.reactMs === HUMAN_LIMITS.reactMs && WORD_HUMAN_LIMITS.moveMs === HUMAN_LIMITS.moveMs, "the level deals' human limits are HUMAN_LIMITS");
}

/* 2. The banks */
for (const l of LEVELS) {
  const s = TILEGRID_LEVEL_SETTINGS[l];
  const bank = TILEGRID_LEVEL_BANK[l];
  ok(bank.length >= 120, `${l}: bank of ${bank.length} boards (at least 120)`);
  const racks = new Set<string>();
  let shaped = 0;
  for (const entry of bank) {
    const cells = decodeTileGrid(entry, s.size);
    const runs = tileGridRuns(cells).map((r) => r.word.length).sort();
    const want = [...s.lengths].sort();
    if (entry.length === s.size * s.size && cells.filter(Boolean).length === s.tiles && tileGridValid(cells) && runs.join() === want.join()) shaped++;
    racks.add(cells.filter(Boolean).sort().join(""));
  }
  ok(shaped === bank.length, `${l}: every board ${s.size} × ${s.size}, ${s.tiles} tiles, runs exactly ${s.lengths.join(" + ")} real words (${shaped} of ${bank.length})`);
  ok(racks.size === bank.length, `${l}: no rack twice (${racks.size} of ${bank.length})`);
}

/* 3. The deals */
for (const l of LEVELS) {
  const s = TILEGRID_LEVEL_SETTINGS[l];
  for (const seed of [3, 41, 977]) {
    const p = deal(seed, l);
    const sol = p.solution ?? [];
    ok(p.tileGridRev === TILE_GRID_LEVEL_REV && (p as { level?: string }).level === l && p.size === s.size && p.tiles === s.tiles && p.timeLimitMs === s.timeLimitMs, `${l} ${seed}: tileGridRev 5 with level, size ${p.size}, tiles ${p.tiles}, clock ${p.timeLimitMs}`);
    ok([...p.tray].sort().join("") === sol.filter(Boolean).sort().join("") && p.tray.length === s.tiles, `${l} ${seed}: the tray is the board's ${s.tiles} letters`);
    ok(TILEGRID_LEVEL_BANK[l].includes(encodeTileGrid(sol, s.size)), `${l} ${seed}: the board is a bank entry`);
    ok(JSON.stringify(deal(seed, l)) === JSON.stringify(p), `${l} ${seed}: the same seed deals the same board`);
    ok(!!p.lightsOnDone === !!s.lightsOnDone, `${l} ${seed}: lights on Done ${!!p.lightsOnDone}`);
  }
}
for (const seed of [3, 41]) {
  const n = deal(seed);
  ok(n.tileGridRev === 4 && n.size === undefined && n.tiles === undefined && (n.solution ?? []).length === 49 && n.tray.length === 15, `normal ${seed}: today's tileGridRev 4, 7 × 7, fifteen tiles, no size stored`);
}

/* 4. Grading on the stored size */
for (const l of LEVELS) {
  const s = TILEGRID_LEVEL_SETTINGS[l];
  const p = deal(11, l);
  const sol = p.solution ?? [];
  const full = encodeTileGrid(sol, s.size);
  const g = gradeAnswer(p, full, s.timeLimitMs - 20_000);
  ok(g.isCorrect && g.score >= 190, `${l}: the board's own grid finishes in 20 s (${g.score})`);
  // The first word alone: credit 120 × its tiles ÷ the level's tiles (plus the early share and big words).
  const run = tileGridRuns(sol)[0]!;
  const partial = Array.from({ length: s.size * s.size }, () => "");
  run.cells.forEach((c) => (partial[c] = sol[c]!));
  const u = gradeAnswer(p, encodeTileGrid(partial, s.size), 0);
  const base = (120 * run.cells.length) / s.tiles;
  ok(!u.isCorrect && u.score >= Math.floor(base) && u.score <= Math.ceil(base + 1.5 * run.cells.length + 30), `${l}: one word of ${run.cells.length} tiles unfinished earns 120 × ${run.cells.length} ÷ ${s.tiles} ≈ ${base.toFixed(0)} plus extras (${u.score})`);
  ok(gradeAnswer(p, encodeTileGrid([], s.size), 0).score === 0, `${l}: an empty board scores 0`);
}

/* 5. The proof under the human limits */
{
  const sample = (l: Lv): TileGridPuzzleData[] => {
    if (!FULL) return Array.from({ length: 12 }, (_, i) => deal(5000 + i * 7, l));
    const s = TILEGRID_LEVEL_SETTINGS[l];
    return TILEGRID_LEVEL_BANK[l].map((entry) => {
      const cells = decodeTileGrid(entry, s.size);
      // Every entry as the deal stamps it (the layers add the score shape on top; the grade reads the stored rules).
      return { ...deal(5000, l), ...tileGridLevelPuzzle(l, entry, cells.filter(Boolean)) };
    });
  };
  for (const l of ["hard", "expert"] as const) {
    const s = TILEGRID_LEVEL_SETTINGS[l];
    const lines = sample(l).map((p) => tilegridLine(p));
    const done = lines.filter((x) => x.finished && x.ms <= s.timeLimitMs).length;
    ok(done === lines.length, `${l}: the person-like builder finishes ${done} of ${lines.length} boards inside ${s.timeLimitMs / 1000} s at the human limits`);
    if (l === "expert") {
      const at200 = lines.filter((x) => x.score >= 200).length;
      ok(at200 === lines.length, `expert: its timed line scores 200 on ${at200} of ${lines.length} boards (slowest ${(Math.max(...lines.map((x) => x.ms)) / 1000).toFixed(1)} s)`);
    }
  }
}

if (failures.length) {
  console.log(`FAIL tilegrid-levels-proof-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS tilegrid-levels-proof-check: ${passes} checks${FULL ? " (full)" : ""}`);
