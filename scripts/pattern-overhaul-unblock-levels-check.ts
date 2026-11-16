/**
 * pattern-overhaul-unblock-levels-check (the Pattern overhaul, stage 3, 15 Nov 2026): Gridlock's difficulty levels
 * (src/lib/levels/pattern/unblock.levels.ts). The levels' `oneSolution` is `open` (any route out counts) and names
 * this check as the proof of each board's minimum.
 *
 *  1. The registry: Easy, Normal, Hard and Expert; each level's settings as Joe's spec; every clock ≤ 120 s.
 *  2. The banks (src/lib/duel/unblockLevelsBank.server.ts): each level holds BANK_SIZE distinct boards, each a legal
 *     lot of the level's size (gold car on the exit row, no overlaps, inside the lot), its car count and stored
 *     minimum inside the level's range, the stored solution playing out legally in exactly that many moves to a solve,
 *     and (proof) breadth-first search over the board's whole reachable lot giving its start exactly that distance
 *     from solved (no shorter route). Quick depth: 15 boards a level; CHECKS_FULL=1 every board.
 *  3. Rebuilt byte for byte from the seed stream (scripts/unblock-levels-bank.ts): quick depth the first Easy boards
 *     and one Hard board; CHECKS_FULL=1 the whole file (`--check`).
 *  4. Deals: each level dealt through generatePuzzle (rooms and practice), stamped `level`, unblockRev 4, par = the
 *     bank's minimum, the board one of the level's bank; `cols` only on Easy (6), `timeLimitMs` only on Expert (75 s);
 *     the same bank seed deals every player the same board; a pre-drawn Normal row never reaches another level.
 *  5. Normal is today's deal: `level: "normal"` deals exactly what no level deals, with no level, size or clock field.
 *  6. The grid fits: every level's bays are at least 40 px on a 375 px phone (a 351 px board), with the lot's box
 *     unchanged (the lot is the same square at every level).
 *  7. Grading reads the stored puzzle: a flawless solve (the stored line, inside the full-speed time) scores 200 at
 *     every level; Easy's line solves only on its own 6 × 6 lot (read as 7 × 7 it doesn't); the solver's unfinished
 *     credit reads the lot's size; the stage-1 legacy fixture (unblockRev 2 and 3) still regrades exactly.
 *  8. The stage, the reveal and the lot art follow the lot's size (lot-6.webp, bays of 100/6 %, the clock's lock-in).
 *
 *   bun scripts/pattern-overhaul-unblock-levels-check.ts        (CHECKS_FULL=1 for full depth)
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/", width: 390, height: 844 });
const g = globalThis as Record<string, unknown>;
for (const key of ["window", "document", "navigator", "Node", "Element", "HTMLElement", "SVGElement", "Text", "Event", "CustomEvent", "getComputedStyle", "MutationObserver"]) {
  if (g[key] === undefined) g[key] = key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
}
g["ResizeObserver"] ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { generatePuzzle, gradeAnswer } = await import("../src/lib/duel/generate.server");
const { withSeededRandom } = await import("../src/lib/duel/random");
const { puzzleTimeLimitMs } = await import("../src/lib/duel/catalogue");
const { levelsOf, levelProof, gameLevelSettings } = await import("../src/lib/levels/gameLevels");
const { MAX_ROUND_CLOCK_MS, puzzleLevel } = await import("../src/lib/levels/levels");
const { LEVELS_UNBLOCK } = await import("../src/lib/levels/pattern/unblock.levels");
const { UNBLOCK_LEVEL_BANK } = await import("../src/lib/duel/unblockLevelsBank.server");
const { parseLayout, decodeMoves, replayUnblock, vehicleCells } = await import("../src/lib/duel/unblock");
const { unblockCols, UNBLOCK_EXIT_ROW, UNBLOCK_TIME_MS } = await import("../src/lib/duel/types");
const bankTool = await import("./unblock-levels-bank");
const { UnblockPuzzle } = await import("../src/components/puzzles/UnblockPuzzle");
const { unblockPuzzle } = await import("../src/puzzles/unblock");
const { UNBLOCK_WALL, UNBLOCK_LOT6_SPRITE } = await import("../src/components/puzzles/pattern/unblockArt");
type UnblockPuzzleData = import("../src/lib/duel/types").UnblockPuzzleData;
type Level = import("../src/lib/levels/levels").Level;
type UnblockLevelSettings = import("../src/lib/levels/pattern/unblock.levels").UnblockLevelSettings;

const FULL = process.env["CHECKS_FULL"] === "1" || process.argv.includes("--full");
const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const BANKED = ["easy", "hard", "expert"] as const;
const settingsOf = (level: (typeof BANKED)[number]) => gameLevelSettings<UnblockLevelSettings>("unblock", level)!;

/* ---------------------------------------------------------------- 1. the registry */
{
  check(same(levelsOf("unblock"), ["easy", "normal", "hard", "expert"]), `unblock offers ${levelsOf("unblock").join(", ")}`);
  const spec: Record<(typeof BANKED)[number], UnblockLevelSettings> = {
    easy: { cols: 6, minMoves: [6, 12], cars: [8, 10], timeLimitMs: 60_000 },
    hard: { cols: 7, minMoves: [22, 30], cars: [12, 14], timeLimitMs: 60_000 },
    expert: { cols: 7, minMoves: [30, 40], cars: [13, 15], timeLimitMs: 75_000 },
  };
  for (const level of BANKED) {
    check(same(settingsOf(level), spec[level]), `${level}: settings ${JSON.stringify(settingsOf(level))}`);
    check(settingsOf(level).timeLimitMs <= MAX_ROUND_CLOCK_MS, `${level}: clock over 120 s`);
    const proof = levelProof("unblock", level);
    check(!!proof && "open" in proof && /any route/.test(proof.open), `${level}: oneSolution is not the open "any route" note`);
  }
  check(/pattern-overhaul-unblock-levels-check/.test(readFileSync(new URL("../src/lib/levels/pattern/unblock.levels.ts", import.meta.url), "utf8")), "the levels file doesn't name this check as the minimum's proof");
  check(LEVELS_UNBLOCK.levels.normal === undefined, "Normal has a registry entry (it must be today's game)");
}

/* ---------------------------------------------------------------- 2. the banks, every minimum proved */
{
  for (const level of BANKED) {
    const s = settingsOf(level);
    const bank = UNBLOCK_LEVEL_BANK[level];
    check(bank.length === bankTool.BANK_SIZE, `${level}: ${bank.length} boards, not ${bankTool.BANK_SIZE}`);
    check(new Set(bank.map((e) => e.split("|")[0])).size === bank.length, `${level}: a layout appears twice`);
    const sample = FULL ? bank.map((_, i) => i) : Array.from({ length: Math.min(15, bank.length) }, (_, k) => Math.floor((k * bank.length) / 15));
    let proved = 0;
    for (let i = 0; i < bank.length; i++) {
      const [layout, min, solution] = bank[i]!.split("|");
      const vs = parseLayout(layout!);
      const n = s.cols;
      const minMoves = Number(min);
      const cars = vs.length - 1;
      const gold = vs[0];
      const cells = vs.flatMap((v) => vehicleCells(v, n));
      const inside = vs.every((v) => v.row >= 0 && v.col >= 0 && (v.axis === "h" ? v.col + v.len <= n && v.row < n : v.row + v.len <= n && v.col < n));
      const ok =
        vs.every((v, k) => v.id === k) &&
        !!gold && gold.axis === "h" && gold.len === 2 && gold.row === UNBLOCK_EXIT_ROW &&
        inside && new Set(cells).size === cells.length &&
        cars >= s.cars[0] && cars <= s.cars[1] &&
        minMoves >= s.minMoves[0] && minMoves <= s.minMoves[1];
      if (!ok) {
        failures.push(`${level} #${i}: not a legal ${n}×${n} board of ${s.cars[0]}–${s.cars[1]} cars and ${s.minMoves[0]}–${s.minMoves[1]} moves (${cars} cars, ${minMoves} moves)`);
        continue;
      }
      const line = decodeMoves((solution ?? "").split(";").join(","));
      const replay = replayUnblock(vs, line, n);
      if (!(replay.solved && replay.moves === minMoves && line.length === minMoves)) {
        failures.push(`${level} #${i}: the stored solution doesn't solve in ${minMoves} legal moves`);
        continue;
      }
      if (!sample.includes(i)) continue;
      // The proof: the exact distance of the start from solved, over the whole reachable lot.
      const comp = bankTool.component(vs, n, Number.POSITIVE_INFINITY);
      const d = comp ? comp.dist[comp.indexOf(bankTool.keyOf(vs))] : -1;
      if (d !== minMoves) failures.push(`${level} #${i}: breadth-first search gives ${d} moves, the bank stores ${minMoves}`);
      else proved++;
    }
    check(proved === sample.length, `${level}: ${proved} of ${sample.length} minimums proved`);
    const mins = bank.map((e) => Number(e.split("|")[1]));
    console.log(`  ${level}: ${bank.length} boards, minimum ${Math.min(...mins)}–${Math.max(...mins)} (mean ${(mins.reduce((a, b) => a + b, 0) / mins.length).toFixed(1)}), ${proved} proved by BFS`);
  }
}

/* ---------------------------------------------------------------- 3. rebuilt byte for byte */
{
  if (FULL) {
    const rebuilt = bankTool.bankSource(Object.fromEntries(BANKED.map((l) => [l, bankTool.buildLevel(l, bankTool.BANK_SIZE)])) as Record<(typeof BANKED)[number], string[]>);
    check(rebuilt === readFileSync(new URL(`../${bankTool.BANK_FILE}`, import.meta.url), "utf8"), "the level banks don't rebuild byte for byte");
  } else {
    const rebuild = (level: (typeof BANKED)[number], i: number) => {
      const bank = UNBLOCK_LEVEL_BANK[level];
      const earlier = new Set(bank.slice(0, i).map((e) => e.split("|")[0]!));
      return bankTool.buildEntry(level, i, earlier).entry === bank[i];
    };
    for (const i of [0, 1, 2, 3, 4]) check(rebuild("easy", i), `easy #${i} doesn't rebuild from its seed`);
    check(rebuild("hard", 0), "hard #0 doesn't rebuild from its seed");
  }
}

/* ---------------------------------------------------------------- 4. deals at each level */
const dealt: Partial<Record<Level, UnblockPuzzleData>> = {};
{
  const normalRow = { layout: "0h220,1v224", min_moves: 1, solution: "1:3;0:5" };
  for (const level of BANKED) {
    const s = settingsOf(level);
    const bank = UNBLOCK_LEVEL_BANK[level];
    for (const seed of [7, 2024, 31337]) {
      const p = withSeededRandom(seed, () => generatePuzzle("unblock", { bankSeed: seed, level, unblockRow: normalRow })) as UnblockPuzzleData & { level?: string };
      const again = withSeededRandom(seed + 1, () => generatePuzzle("unblock", { bankSeed: seed, level })) as UnblockPuzzleData;
      check(same(p, again), `${level} seed ${seed}: the same room seed dealt two different boards`);
      check(puzzleLevel(p) === level && p.level === level, `${level}: the deal is stamped ${String(p.level)}`);
      check(p.unblockRev === 4 && p.par === p.minMoves, `${level}: unblockRev ${p.unblockRev}, par ${p.par}, minimum ${p.minMoves}`);
      check(unblockCols(p) === s.cols && (s.cols === 7 ? p.cols === undefined : p.cols === s.cols), `${level}: the lot is ${String(p.cols)}`);
      check(puzzleTimeLimitMs(p) === s.timeLimitMs && (s.timeLimitMs === UNBLOCK_TIME_MS ? p.timeLimitMs === undefined : p.timeLimitMs === s.timeLimitMs), `${level}: clock ${puzzleTimeLimitMs(p)}`);
      check(puzzleTimeLimitMs(p) <= MAX_ROUND_CLOCK_MS, `${level}: clock over 120 s`);
      const entry = `${p.vehicles.map((v) => `${v.id}${v.axis}${v.len}${v.row}${v.col}`).join(",")}|${p.minMoves}|${(p.solution ?? "").split(",").join(";")}`;
      check(bank.includes(entry), `${level} seed ${seed}: the board isn't one of the level's bank (a Normal row leaked in?)`);
      dealt[level] ??= p;
    }
    const seen = new Set(Array.from({ length: 40 }, (_, k) => JSON.stringify((generatePuzzle("unblock", { bankSeed: 1000 + k, level }) as UnblockPuzzleData).vehicles)));
    check(seen.size >= 25, `${level}: 40 room seeds dealt only ${seen.size} different boards`);
  }
  /* ---------------------------------------------------------------- 5. Normal is today's deal */
  for (const seed of [5, 99]) {
    const plain = withSeededRandom(seed, () => generatePuzzle("unblock", { bankSeed: seed, unblockRow: normalRow })) as Record<string, unknown>;
    const asked = withSeededRandom(seed, () => generatePuzzle("unblock", { bankSeed: seed, unblockRow: normalRow, level: "normal" })) as Record<string, unknown>;
    check(same(plain, asked), `seed ${seed}: level "normal" deals something other than no level`);
    check(!("level" in plain) && !("cols" in plain) && !("timeLimitMs" in plain), `seed ${seed}: the Normal deal carries a level, size or clock field`);
    check(plain["minMoves"] === 1 && same(plain["vehicles"], parseLayout(normalRow.layout)), `seed ${seed}: Normal no longer deals the drawn bank row`);
  }
}

/* ---------------------------------------------------------------- 6. the grid fits a 375 px phone */
{
  const board = 375 - 2 * 12;
  for (const level of BANKED) {
    const bay = (board * (1 - (2 * UNBLOCK_WALL) / 100)) / settingsOf(level).cols;
    check(bay >= 40, `${level}: bays of ${bay.toFixed(1)} px on a 375 px phone`);
  }
  const css = readFileSync(new URL("../src/polish-pattern/unblock.css", import.meta.url), "utf8");
  check(/\.unblock-lot \{[^}]*aspect-ratio: 1;/.test(css) && /\.unblock-grid \{ position: absolute; inset: 4\.5%; \}/.test(css), "the lot's box changed (it must be the same square at every level)");
}

/* ---------------------------------------------------------------- 7. grading reads the stored puzzle */
{
  for (const level of BANKED) {
    const p = dealt[level]!;
    const limit = puzzleTimeLimitMs(p);
    const flawless = gradeAnswer(p, p.solution ?? "", limit - 20_000);
    check(flawless.isCorrect && flawless.score === 200, `${level}: a flawless solve scores ${flawless.score} (${flawless.isCorrect})`);
    const nothing = gradeAnswer(p, "", 0);
    check(!nothing.isCorrect && nothing.score === 0, `${level}: an empty answer scores ${nothing.score}`);
    const half = decodeMoves(p.solution ?? "").slice(0, Math.floor((p.minMoves ?? 0) / 2));
    const partial = gradeAnswer(p, half.map((m) => `${m.id}:${m.to}`).join(","), 0);
    check(!partial.isCorrect && partial.score > 0 && partial.score < 150, `${level}: half the line scores ${partial.score}`);
  }
  const easy = dealt.easy!;
  const asSeven = { ...easy } as UnblockPuzzleData;
  delete asSeven.cols;
  check(!gradeAnswer(asSeven, easy.solution ?? "", 40_000).isCorrect, "Easy's line also solves read as a 7×7 lot (the grader isn't reading the size)");
  // Older stamps: the stage-1 legacy fixture regrades exactly.
  const fixture = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/pattern-overhaul-unblock-legacy.json.gz", import.meta.url))).toString()) as {
    puzzles: { era: string; seed: number; puzzle: UnblockPuzzleData }[];
    cases: { era: string; seed: number; answer: string; msLeft: number; score: number; isCorrect: boolean; extra: unknown }[];
  };
  let diffs = 0;
  for (const c of fixture.cases) {
    const p = fixture.puzzles.find((x) => x.era === c.era && x.seed === c.seed)!.puzzle;
    const g2 = gradeAnswer(p, c.answer, c.msLeft);
    if (g2.score !== c.score || g2.isCorrect !== c.isCorrect || !same(g2.extra ?? null, c.extra)) diffs++;
  }
  check(fixture.cases.length >= 40 && diffs === 0, `${diffs} of ${fixture.cases.length} legacy cases grade differently`);
}

/* ---------------------------------------------------------------- 8. the stage, the reveal and the art */
{
  const lot6 = new URL(`../public${UNBLOCK_LOT6_SPRITE}`, import.meta.url);
  check(existsSync(lot6) && statSync(lot6).size <= 25_000, "lot-6.webp missing or over 25 KB");
  if (existsSync(lot6)) {
    const head = readFileSync(lot6).subarray(0, 32).toString("latin1");
    check(head.startsWith("RIFF") && head.includes("WEBP"), "lot-6.webp isn't a WebP");
  }
  const stage = (p: UnblockPuzzleData) =>
    renderToStaticMarkup(React.createElement(UnblockPuzzle, { puzzle: p, phaseStartedAt: 0, now: 1_000, locked: false, onSubmit: () => {} }));
  const easyHtml = stage(dealt.easy!);
  check(easyHtml.includes("lot-6.webp") && easyHtml.includes('data-unblock-cols="6"'), "the Easy stage doesn't draw the 6×6 lot");
  const gold = dealt.easy!.vehicles[0]!;
  check(easyHtml.includes(`left:${(gold.col * 100) / 6}%`) && easyHtml.includes(`width:${200 / 6}%`), "the Easy stage's cars aren't placed in sixths");
  const hardHtml = stage(dealt.hard!);
  check(hardHtml.includes("/lot.webp") && hardHtml.includes('data-unblock-cols="7"') && !hardHtml.includes("lot-6"), "the Hard stage doesn't draw the 7×7 lot");
  const Reveal = unblockPuzzle.Reveal!;
  const reveal = renderToStaticMarkup(
    React.createElement(Reveal, { timeLimitMs: 60_000, puzzle: dealt.easy!, myAnswer: dealt.easy!.solution ?? "", myCorrect: true, myMsRemaining: 30_000, myExtra: { moves: dealt.easy!.minMoves, par: dealt.easy!.minMoves } } as never),
  );
  check(reveal.includes("lot-6.webp") && !reveal.includes("Solution unavailable") && reveal.includes(`data-unblock-route="${dealt.easy!.minMoves}"`), "the Easy reveal doesn't play its line on the 6×6 lot");
  const src = readFileSync(new URL("../src/components/puzzles/UnblockPuzzle.tsx", import.meta.url), "utf8");
  check(/phaseStartedAt \+ clockMs - now/.test(src) && /puzzle\.timeLimitMs \?\? UNBLOCK_TIME_MS/.test(src), "the stage's lock-in doesn't read the puzzle's own clock (Expert's 75 s)");
}

const total = passes + failures.length;
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`\npattern-overhaul-unblock-levels-check: FAIL (${failures.length} of ${total})`);
  process.exit(1);
}
console.log(`pattern-overhaul-unblock-levels-check: ${passes} passed${FULL ? " (full depth)" : ""}`);
