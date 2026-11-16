/**
 * pattern-overhaul-gravity-levels-check (the Pattern overhaul, stage 3, 16 Nov 2026): Topsy-Turvy's difficulty levels
 * (src/lib/levels/pattern/gravity.levels.ts). The levels' `oneSolution` is `open` (any tilt list that gets every ball
 * home counts) and names this check as the proof of each board's minimum.
 *
 *  1. The registry: Easy, Normal, Hard and Expert; each level's settings as Joe's spec (Easy 3 balls, 2 boards, 2–4
 *     tilts, a generous limit; Hard 6 balls, 3 boards, 6–9, the fewest + 6, full speed by 30 s, under Normal's 32; Expert 8 balls, 3 boards, 7–10, the fewest
 *     + 5); every clock 120 s; `oneSolution` open.
 *  2. The banks (src/lib/duel/topsyLevelsBank.server.ts), every board every run: the level's ball count, distinct
 *     squares on the 10 × 10 board, a ball home blocking, no stars, no ball dropping on the first tilt, no board twice;
 *     the stored route clears the board in exactly the stored number of tilts, inside the board's tilt limit (the limit
 *     is reachable); (the proof) breadth-first search over every ball's square finds no shorter route, so the stored
 *     number is the board's minimum, and it lies in the level's range; Expert: the person-like solver
 *     (scripts/topsy-human.ts) clears every board inside its limit.
 *  3. Rebuilt byte for byte from the seed stream (scripts/topsy-levels-bank.ts): quick depth the first Easy, Hard and
 *     Expert boards; `--rebuild` the whole file (about two minutes).
 *  4. Deals: each level dealt through generatePuzzle, stamped `level`, gravityRev 8, the level's boards drawn from its
 *     bank by the bank seed (the same seed, the same round), each limit the board's fewest + the level's spare, the par
 *     the fewest added up, passing the generator's verifier; Normal never draws from a level bank.
 *  5. Normal is today's game: `level: "normal"` deals exactly what no level deals, and 16 Normal deals and their 128
 *     grades match the ones recorded before the levels (scripts/fixtures/pattern-overhaul-gravity-levels-normal.json.gz).
 *  6. The board and the art: every level keeps the 10 × 10 board (squares as Normal's); eight ball colours, each with
 *     its own mark (eight distinct drawings), marble and cup sprites as WebP with alpha, each within 25 KB.
 *  7. Grading reads the stored puzzle: each level's full-speed time (Easy 20 s, Hard 30 s since 16 Nov 2026 (was 45), Expert 50 s; Normal and every
 *     puzzle without a level 32 s); a flawless solve inside it scores 200 at every level, a later one less; an empty
 *     answer 0; the level's spare limits a board (a board played to its limit without clearing is out of tilts there,
 *     and its par shown is the fewest); a level's tilts read the board's own balls (Easy's six balls in all).
 *  8. The stage and the reveal draw the round's own boards and balls: Easy two boards and six balls in all, Expert
 *     eight rings a board and its two extra cups; the reveal's switcher has a tab a board.
 *  9. Joe's stage-2 answer (the Round row on one line at 375 and 390 px, never under 11 px): the CSS keeps the pills on
 *     one line at the sizes measured, and the widest possible row, measured with Archivo and calibrated on the
 *     Chromium measurement of 16 Nov 2026, fits the reveal's width at both sizes.
 *
 *   bun scripts/pattern-overhaul-gravity-levels-check.ts        (--rebuild: the whole bank rebuilt too)
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
const { levelsOf, levelProof } = await import("../src/lib/levels/gameLevels");
const { MAX_ROUND_CLOCK_MS, puzzleLevel } = await import("../src/lib/levels/levels");
const { LEVELS_GRAVITY } = await import("../src/lib/levels/pattern/gravity.levels");
const { TOPSY_LEVEL_BANK } = await import("../src/lib/duel/topsyLevelsBank.server");
const { parseTopsyBankEntry, topsySearch, verifyTopsyPuzzle } = await import("../src/lib/duel/topsy.server");
const { replayTopsy, replayTopsyPuzzle, topsyBoardPar, topsyStart, topsyTilt, topsyTotalBalls, TOPSY_CELLS, TOPSY_SIZE, TOPSY_V8_SPARE } = await import("../src/lib/duel/topsy");
const bankTool = await import("./topsy-levels-bank");
const { humanBoard } = await import("./topsy-human");
const { dealNormal, normalCases } = await import("./pattern-overhaul-gravity-levels-record");
const { gravityMazePuzzle } = await import("../src/puzzles/gravityMaze");
const { TopsyStage, TOPSY_COLOURS } = await import("../src/components/puzzles/pattern/topsyBoard");
const { TOPSY_ART_COLOURS, TOPSY_SPRITES, topsyHoleUrl, topsyMarbleUrl } = await import("../src/components/puzzles/pattern/topsyArt");
type GravityPuzzleData = import("../src/lib/duel/types").GravityPuzzleData;
type GravityDir = import("../src/lib/duel/types").GravityDir;
type TopsyLevelSettings = import("../src/lib/levels/pattern/gravity.levels").TopsyLevelSettings;

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const BANKED = ["easy", "hard", "expert"] as const;
type Banked = (typeof BANKED)[number];
const settingsOf = (level: Banked) => LEVELS_GRAVITY.levels[level]!.settings as TopsyLevelSettings;
const DIRS: GravityDir[] = ["U", "D", "L", "R"];

/* ---------------------------------------------------------------- 1. the registry */
{
  check(same(levelsOf("gravity"), ["easy", "normal", "hard", "expert"]), `gravity offers ${levelsOf("gravity").join(", ")}`);
  const spec: Record<Banked, TopsyLevelSettings> = {
    easy: { balls: 3, boards: 2, minTilts: [2, 4], walls: [14, 22], spare: 12, timeLimitMs: 120_000, speedFullByS: 20 },
    hard: { balls: 6, boards: 3, minTilts: [6, 9], walls: [14, 22], spare: 6, timeLimitMs: 120_000, speedFullByS: 30 },
    expert: { balls: 8, boards: 3, minTilts: [7, 10], walls: [14, 22], spare: 5, timeLimitMs: 120_000, speedFullByS: 50, personSolvable: true },
  };
  for (const level of BANKED) {
    check(same(settingsOf(level), spec[level]), `${level}: settings ${JSON.stringify(settingsOf(level))}`);
    check(settingsOf(level).timeLimitMs <= MAX_ROUND_CLOCK_MS, `${level}: clock over 120 s`);
    const proof = levelProof("gravity", level);
    check(!!proof && "open" in proof && proof.open === "any tilt sequence that homes every ball counts; each board's minimum is proved by BFS", `${level}: oneSolution is not the open "any tilt sequence" note`);
  }
  // Easy's limit is generous (more spare than Normal's 8), Hard's and Expert's tighter.
  check(settingsOf("easy").spare > TOPSY_V8_SPARE && settingsOf("hard").spare === 6 && settingsOf("expert").spare === 5, "the spare tilts don't step down Easy → Expert");
  // Joe, 16 Nov 2026: Hard is clearly harder than Normal by design: more tilts (6–9 over Normal's 4–7), a tighter limit
  // (+6 over +8) and full speed asked for sooner than Normal's 32 s (30 s), so its speed points want quicker play per tilt.
  const { PAR_STRICT_FULL_BY_S } = await import("../src/lib/duel/parMoves");
  const normalFullBy = (PAR_STRICT_FULL_BY_S as Record<string, number>)["gravity"]!;
  check(normalFullBy === 32 && settingsOf("hard").speedFullByS < normalFullBy, `Hard's full-speed time ${settingsOf("hard").speedFullByS} s isn't under Normal's ${normalFullBy} s`);
  check(settingsOf("hard").minTilts[0] > 4 && settingsOf("hard").spare < TOPSY_V8_SPARE, "Hard isn't more tilts and a tighter limit than Normal");
  check(/pattern-overhaul-gravity-levels-check/.test(src("src/lib/levels/pattern/gravity.levels.ts")), "the levels file doesn't name this check as the minimum's proof");
  check(LEVELS_GRAVITY.levels.normal === undefined, "Normal has a registry entry (it must be today's game)");
}

/* ---------------------------------------------------------------- 2. the banks, every minimum proved */
{
  for (const level of BANKED) {
    const s = settingsOf(level);
    const bank = TOPSY_LEVEL_BANK[level];
    check(bank.length === bankTool.BANK_SIZE, `${level}: ${bank.length} boards, not ${bankTool.BANK_SIZE}`);
    check(new Set(bank.map((e) => bankTool.boardKey(parseTopsyBankEntry(e).board))).size === bank.length, `${level}: a board appears twice`);
    let proved = 0;
    let person = 0;
    for (let i = 0; i < bank.length; i++) {
      const { board, min, route } = parseTopsyBankEntry(bank[i]!);
      const all = [...board.walls, ...board.starts, ...board.holes];
      const legal =
        board.starts.length === s.balls && board.holes.length === s.balls && board.stars.length === 0 && board.homeBlocks === true &&
        board.walls.length >= s.walls[0] && board.walls.length <= s.walls[1] &&
        new Set(all).size === all.length && all.every((c) => Number.isInteger(c) && c >= 0 && c < TOPSY_CELLS) &&
        min >= s.minTilts[0] && min <= s.minTilts[1];
      if (!legal) {
        failures.push(`${level} #${i}: not a legal board of ${s.balls} balls and ${s.minTilts[0]}–${s.minTilts[1]} tilts (${board.starts.length} balls, ${min} tilts)`);
        continue;
      }
      const walls = new Set(board.walls);
      if (DIRS.some((d) => topsyTilt(board, walls, topsyStart(board), d).dropped.length)) {
        failures.push(`${level} #${i}: a ball drops on the very first tilt`);
        continue;
      }
      const limit = min + s.spare;
      const played = replayTopsy([board], route.split("") as GravityDir[], [limit], undefined, true);
      if (!(played.solved && played.tilts === min && route.length === min)) {
        failures.push(`${level} #${i}: the stored route doesn't clear the board in ${min} tilts inside its limit of ${limit}`);
        continue;
      }
      // The proof: breadth-first search over every ball's square finds nothing shorter (and the same length).
      const found = topsySearch(board, false, min, 2_000_000);
      if (found?.min !== min) failures.push(`${level} #${i}: breadth-first search gives ${found?.min ?? "nothing"}, the bank stores ${min}`);
      else proved++;
      if (s.personSolvable) {
        if (humanBoard(board, limit).cleared) person++;
        else failures.push(`${level} #${i}: the person-like solver doesn't clear it inside ${limit} tilts`);
      }
    }
    check(proved === bank.length, `${level}: ${proved} of ${bank.length} minimums proved`);
    if (s.personSolvable) check(person === bank.length, `${level}: the person-like solver clears ${person} of ${bank.length}`);
    const mins = bank.map((e) => parseTopsyBankEntry(e).min);
    console.log(`  ${level}: ${bank.length} boards, fewest tilts ${Math.min(...mins)}–${Math.max(...mins)} (mean ${(mins.reduce((a, b) => a + b, 0) / mins.length).toFixed(1)}), ${proved} proved by BFS${s.personSolvable ? `, ${person} cleared by the person-like solver` : ""}`);
  }
}

/* ---------------------------------------------------------------- 3. rebuilt byte for byte */
{
  if (process.argv.includes("--rebuild")) {
    const rebuilt = bankTool.bankSource(Object.fromEntries(BANKED.map((l) => [l, bankTool.buildLevel(l)])) as Record<Banked, string[]>);
    check(rebuilt === src(bankTool.BANK_FILE), "the level banks don't rebuild byte for byte");
  } else {
    const rebuild = (level: Banked, i: number) => {
      const bank = TOPSY_LEVEL_BANK[level];
      const earlier = new Set(bank.slice(0, i).map((e) => bankTool.boardKey(parseTopsyBankEntry(e).board)));
      return bankTool.encodeEntry(bankTool.buildEntry(level, i, earlier)) === bank[i];
    };
    for (const i of [0, 1, 2, 3]) check(rebuild("easy", i), `easy #${i} doesn't rebuild from its seed`);
    for (const i of [0, 1]) check(rebuild("hard", i), `hard #${i} doesn't rebuild from its seed`);
    check(rebuild("expert", 0), "expert #0 doesn't rebuild from its seed");
  }
}

/* ---------------------------------------------------------------- 4. deals at each level */
type Leveled = GravityPuzzleData & { level?: string };
const dealt: Partial<Record<Banked, Leveled>> = {};
{
  for (const level of BANKED) {
    const s = settingsOf(level);
    const bank = TOPSY_LEVEL_BANK[level];
    for (const seed of [7, 2024, 31337]) {
      const p = withSeededRandom(seed, () => generatePuzzle("gravity", { bankSeed: seed, level })) as Leveled;
      const again = withSeededRandom(seed + 1, () => generatePuzzle("gravity", { bankSeed: seed, level })) as Leveled;
      check(same(p, again), `${level} seed ${seed}: the same room seed dealt two different rounds`);
      check(puzzleLevel(p) === level && p.level === level, `${level}: the deal is stamped ${String(p.level)}`);
      check(p.gravityRev === 8, `${level}: gravityRev ${p.gravityRev}`);
      check(p.boards?.length === s.boards && p.boards.every((b) => b.starts.length === s.balls && b.stars.length === 0), `${level}: ${p.boards?.length} boards of ${p.boards?.[0]?.starts.length} balls`);
      check(new Set(p.boards!.map((b) => bankTool.boardKey(b))).size === s.boards, `${level} seed ${seed}: a board twice in one round`);
      for (const [i, b] of p.boards!.entries()) {
        const entry = `${bankTool.boardKey(b)}|${p.boardMins![i]}|${p.boardSolutions![i]}`;
        check(bank.includes(entry), `${level} seed ${seed} board ${i + 1}: not one of the level's bank (a Normal board leaked in?)`);
      }
      check(same(p.tiltLimits, p.boardMins!.map((m) => m + s.spare)), `${level}: limits ${p.tiltLimits} aren't the fewest ${p.boardMins} + ${s.spare}`);
      check(p.par === p.boardMins!.reduce((n, m) => n + m, 0) && p.minMoves === p.par, `${level}: par ${p.par}, minimum ${p.minMoves}`);
      check(p.boards!.every((_, i) => topsyBoardPar(p, i) === p.boardMins![i]), `${level}: the board par shown isn't the board's fewest`);
      check(puzzleTimeLimitMs(p) === s.timeLimitMs && puzzleTimeLimitMs(p) <= MAX_ROUND_CLOCK_MS, `${level}: clock ${puzzleTimeLimitMs(p)}`);
      check(verifyTopsyPuzzle(p) === null, `${level} seed ${seed}: the verifier refuses the deal (${verifyTopsyPuzzle(p)})`);
      check(verifyTopsyPuzzle({ ...p, tiltLimits: p.tiltLimits!.map((l) => l + 1) }) !== null, `${level}: the verifier accepts a wrong limit`);
      dealt[level] ??= p;
    }
    const seen = new Set(Array.from({ length: 30 }, (_, k) => JSON.stringify((generatePuzzle("gravity", { bankSeed: 1000 + k, level }) as Leveled).boards)));
    check(seen.size >= 25, `${level}: 30 room seeds dealt only ${seen.size} different rounds`);
    // Practice without a bank seed draws from the bank too.
    const free = withSeededRandom(55, () => generatePuzzle("gravity", { level })) as Leveled;
    check(free.level === level && free.boards!.every((b, i) => bank.includes(`${bankTool.boardKey(b)}|${free.boardMins![i]}|${free.boardSolutions![i]}`)), `${level}: a deal without a bank seed doesn't draw from the bank`);
  }
}

/* ---------------------------------------------------------------- 5. Normal is today's game */
{
  for (const seed of [5, 99]) {
    const plain = withSeededRandom(seed, () => generatePuzzle("gravity", { bankSeed: seed })) as Record<string, unknown>;
    const asked = withSeededRandom(seed, () => generatePuzzle("gravity", { bankSeed: seed, level: "normal" })) as Record<string, unknown>;
    check(same(plain, asked), `seed ${seed}: level "normal" deals something other than no level`);
    check(!("level" in plain) && (plain["boards"] as unknown[]).length === 3, `seed ${seed}: the Normal deal carries a level or isn't three boards`);
  }
  const fixture = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/pattern-overhaul-gravity-levels-normal.json.gz", import.meta.url))).toString()) as {
    puzzles: { seed: number; banked: boolean; puzzle: GravityPuzzleData }[];
    cases: { seed: number; banked: boolean; label: string; answer: string; msLeft: number; score: number; isCorrect: boolean; extra: unknown }[];
  };
  check(fixture.puzzles.length === 16 && fixture.cases.length === 128, `the Normal fixture holds ${fixture.puzzles.length} deals and ${fixture.cases.length} grades`);
  for (const { seed, banked, puzzle } of fixture.puzzles) {
    check(same(dealNormal(seed, banked), puzzle), `Normal seed ${seed}${banked ? " (room)" : ""}: the deal differs from the one before the levels`);
    check(same(normalCases(puzzle).map((c) => c.answer), fixture.cases.filter((c) => c.seed === seed && c.banked === banked).map((c) => c.answer)), `Normal seed ${seed}: the answers no longer rebuild the same`);
  }
  let diffs = 0;
  for (const c of fixture.cases) {
    const p = fixture.puzzles.find((x) => x.seed === c.seed && x.banked === c.banked)!.puzzle;
    const g2 = gradeAnswer(p, c.answer, c.msLeft);
    if (g2.score !== c.score || g2.isCorrect !== c.isCorrect || !same(g2.extra ?? null, c.extra)) {
      diffs++;
      if (diffs <= 5) failures.push(`Normal seed ${c.seed} ${c.label}: ${c.score}/${c.isCorrect} became ${g2.score}/${g2.isCorrect}`);
    }
  }
  check(diffs === 0, `${diffs} of ${fixture.cases.length} Normal grades differ from before the levels`);
}

/* ---------------------------------------------------------------- 6. the board and the art */
{
  // The board stays 10 × 10 at every level (each round's squares the same size as Normal's).
  for (const level of BANKED) check(dealt[level]!.boards!.every((b) => [...b.walls, ...b.starts, ...b.holes].every((c) => c < TOPSY_SIZE * TOPSY_SIZE)), `${level}: a square off the 10 × 10 board`);
  check(TOPSY_SIZE === 10, `the board is ${TOPSY_SIZE} across`);
  check(TOPSY_COLOURS.length === 8 && new Set(TOPSY_COLOURS).size === 8 && TOPSY_ART_COLOURS.length === 8, "eight ball colours aren't defined (Expert's eight balls)");
  const marks = src("src/components/puzzles/pattern/topsyBoard.tsx").match(/const MARKS = \[([\s\S]*?)\n\];/)?.[1] ?? "";
  const drawings = marks.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("<"));
  check(drawings.length === 8 && new Set(drawings).size === 8, `${drawings.length} ball marks, ${new Set(drawings).size} distinct (Expert needs eight)`);
  check(TOPSY_SPRITES.length === 19, `${TOPSY_SPRITES.length} sprites (8 marbles, 8 cups, block, floor, frame)`);
  for (let i = 0; i < 8; i++) {
    for (const url of [topsyMarbleUrl(i), topsyHoleUrl(i)]) {
      const path = new URL(`../public${url}`, import.meta.url);
      if (!existsSync(path)) {
        failures.push(`${url} is missing`);
        continue;
      }
      const buf = readFileSync(path);
      const riff = buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP";
      const chunk = buf.subarray(12, 16).toString("latin1");
      const alpha = chunk === "VP8X" ? (buf[20]! & 0x10) !== 0 : chunk === "VP8L" ? ((buf.readUInt32LE(21) >> 28) & 1) === 1 : false;
      check(riff && alpha && statSync(path).size <= 25_000, `${url}: not a WebP with alpha within 25 KB`);
    }
  }
  check(/"green": "#8BE04A", "white": "#E8ECF2"/.test(src("docs/design/game-art/pattern/source/gravity.py")), "the Blender source doesn't render Expert's two colours");
  check(TOPSY_COLOURS[6] === "#8BE04A" && TOPSY_COLOURS[7] === "#E8ECF2", "the board's seventh and eighth colours aren't the rendered ones");
}

/* ---------------------------------------------------------------- 7. grading reads the stored puzzle */
{
  const { topsyLevelSettings } = await import("../src/lib/duel/topsy");
  for (const level of BANKED) {
    const p = dealt[level]!;
    const limit = puzzleTimeLimitMs(p);
    const fullBy = settingsOf(level).speedFullByS;
    check(topsyLevelSettings(p)?.speedFullByS === fullBy, `${level}: the puzzle doesn't read its level's settings`);
    const line = (p.boardSolutions ?? []).join("");
    const flawless = gradeAnswer(p, line, limit - (fullBy - 1) * 1000);
    check(flawless.isCorrect && flawless.score === 200, `${level}: a flawless solve inside ${fullBy} s scores ${flawless.score} (${flawless.isCorrect})`);
    const later = gradeAnswer(p, line, limit - (fullBy + 15) * 1000);
    check(later.isCorrect && later.score < 200 && later.score >= 150, `${level}: a flawless solve 15 s after full speed scores ${later.score}`);
    const nothing = gradeAnswer(p, "", 0);
    check(!nothing.isCorrect && nothing.score === 0, `${level}: an empty answer scores ${nothing.score}`);
    // The level's spare limits the first board: tilting back and forth without clearing it uses its limit up.
    const b0 = p.boards![0]!;
    const walls = new Set(b0.walls);
    let state = topsyStart(b0);
    const waste: GravityDir[] = [];
    for (let k = 0; waste.length < p.tiltLimits![0]! && k < 400; k++) {
      const options = DIRS.filter((d) => {
        const out = topsyTilt(b0, walls, state, d);
        return out.moved && out.state.balls.some((x) => x !== -1);
      });
      if (!options.length) break;
      const d = options[k % options.length]!;
      state = topsyTilt(b0, walls, state, d).state;
      waste.push(d);
      if (state.balls.every((x) => x === -1)) break;
    }
    const r = replayTopsyPuzzle(p as never, waste);
    check(waste.length === p.tiltLimits![0] && r.boards[0]?.outOfTilts === true && r.current === 1, `${level}: ${waste.length} tilts on board 1 don't run it out of tilts at its limit ${p.tiltLimits![0]}`);
    const partial = gradeAnswer(p, p.boardSolutions![0]!, 0);
    const homeShare = p.boards![0]!.starts.length / topsyTotalBalls(p);
    check(!partial.isCorrect && partial.score > 0 && partial.score < 150 && (partial.extra as { home?: number })?.home === p.boards![0]!.starts.length, `${level}: board 1 cleared alone scores ${partial.score} (${(homeShare * 100).toFixed(0)} % of the balls)`);
  }
  // Normal and every puzzle without a level: full speed by 32 s (the stricter-par stamp's).
  const normal = dealNormal(5, true);
  const at = (msLeft: number) => gradeAnswer(normal, (normal.boardSolutions ?? []).join(""), msLeft).score;
  check(at(120_000 - 31_000) === 200 && at(120_000 - 40_000) < 200, `Normal isn't full speed by 32 s (${at(89_000)}, ${at(80_000)})`);
  // Easy's speed reads its level: at 25 s an Easy round has lost speed, the same boards read as Normal haven't.
  const easy = dealt.easy!;
  const asNormal = { ...easy, level: undefined, tiltLimits: easy.boardMins!.map((m) => m + TOPSY_V8_SPARE) } as GravityPuzzleData;
  const line = (easy.boardSolutions ?? []).join("");
  check(gradeAnswer(easy, line, 95_000).score < 200 && gradeAnswer(asNormal, line, 95_000).score === 200, "Easy's full-speed time isn't read from its level");
}

/* ---------------------------------------------------------------- 8. the stage and the reveal */
{
  const stage = (p: GravityPuzzleData) => renderToStaticMarkup(React.createElement(TopsyStage, { puzzle: p, phaseStartedAt: 0, now: 0, locked: false, onSubmit: () => {} } as never));
  const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const easyHtml = stage(dealt.easy!);
  check((easyHtml.match(/data-topsy-ring="/g) ?? []).length === 3 && /0 of 3 balls home/.test(easyHtml) && /Board 1\/2/.test(text(easyHtml)), `the Easy stage doesn't draw three rings on board 1 of 2`);
  const expertHtml = stage(dealt.expert!);
  check((expertHtml.match(/data-topsy-ring="/g) ?? []).length === 8 && /0 of 8 balls home/.test(expertHtml) && /Board 1\/3/.test(text(expertHtml)), `the Expert stage doesn't draw eight rings on board 1 of 3`);
  for (const level of ["easy", "expert"] as const) {
    const p = dealt[level]!;
    const answer = (p.boardSolutions ?? []).join("");
    const gr = gradeAnswer(p, answer, 90_000);
    const html = renderToStaticMarkup(React.createElement(gravityMazePuzzle.Reveal, { timeLimitMs: 120_000, puzzle: p, myAnswer: answer, myCorrect: gr.isCorrect, myMsRemaining: 90_000, myExtra: gr.extra ?? null } as never));
    check((html.match(/role="tab"/g) ?? []).length === p.boards!.length, `${level}: the reveal's switcher doesn't have a tab a board`);
    const round = text(html.slice(html.indexOf("data-topsy-keys")));
    check(round.includes(`Boards ${p.boards!.length}/${p.boards!.length}`) && round.includes(`Home ${topsyTotalBalls(p)}/${topsyTotalBalls(p)}`) && round.includes("Left 90 s"), `${level}: the reveal's round row: ${round.slice(0, 120)}`);
    if (level === "expert") check(html.includes(`src="${topsyHoleUrl(6)}"`) && html.includes(`src="${topsyHoleUrl(7)}"`), "the Expert reveal doesn't draw the green and white cups");
  }
}

/* ---------------------------------------------------------------- 9. the Round row on one line at 375 and 390 px */
{
  // Changed with Joe's approval, 15 Nov 2026 (Topsy-Turvy's Round row on one line).
  const css = src("src/polish-pattern/topsy.css");
  const rule = (sel: string) => css.match(new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";
  const pills = rule(".topsy-round-pills");
  const pill = rule(".topsy-round-pills .topsy-key");
  const value = rule(".topsy-round-pills .topsy-key b");
  check(/flex-wrap: nowrap/.test(pills) && /white-space: nowrap/.test(pills) && /gap: 3px/.test(pills), `the Round pills aren't held on one line with 3 px gaps: ${pills}`);
  check(/flex: 0 0 auto/.test(pill) && /gap: 2px/.test(pill) && /padding: 4px 5px/.test(pill) && /font-size: 11px/.test(pill), `the Round pill isn't 11 px with 4 × 5 px padding: ${pill}`);
  check(/font-size: 12px/.test(value), `the Round pill's figure isn't 12 px: ${value}`);
  check(/\.topsy-round \.topsy-round-label \{[^}]*font-size: 11px/.test(css), "the Round label isn't 11 px");
  // Nothing in the row is under 11 px.
  const sizes = [pill, value, css.match(/\.topsy-round \.topsy-round-label \{([^}]*)\}/)?.[1] ?? ""].flatMap((r) => [...r.matchAll(/font-size: (\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])));
  check(sizes.length >= 3 && sizes.every((s) => s >= 11), `a Round row text under 11 px (${sizes})`);
  // Widths with Archivo (canvas), calibrated on Chromium (16 Nov 2026, 390 × 844, Normal's solved row
  // "Boards 3/3 · Home 18/18 · Tilts 18 · Par 18 · Left 99 s" measured 304 px wide on one line); the reveal's content
  // is 319 px wide at 375 px and 334 px at 390 px (measured the same day).
  const { GlobalFonts, createCanvas } = await import("@napi-rs/canvas");
  GlobalFonts.registerFromPath(new URL("../public/fonts/archivo-var-latin.woff2", import.meta.url).pathname, "ArchivoCheck");
  const ctx = createCanvas(10, 10).getContext("2d");
  const rowWidth = (items: [string, string][]) =>
    items.reduce((w, [label, val]) => {
      ctx.font = "11px ArchivoCheck";
      const l = ctx.measureText(label).width;
      ctx.font = "12px ArchivoCheck";
      return w + 10 + l + 2 + ctx.measureText(val).width;
    }, 0) + 3 * (items.length - 1);
  const reference = rowWidth([["Boards", "3/3"], ["Home", "18/18"], ["Tilts", "18"], ["Par", "18"], ["Left", "99 s"]]);
  const k = 304 / reference;
  // The widest row any level can show: Expert's 24 balls, two-digit tilts and par, a three-digit time left.
  const widest = k * rowWidth([["Boards", "3/3"], ["Home", "24/24"], ["Tilts", "45"], ["Par", "30"], ["Left", "120 s"]]);
  for (const [vw, room] of [[375, 319], [390, 334]] as const) check(widest <= room - 2, `the widest Round row (${widest.toFixed(0)} px) doesn't fit the ${vw} px reveal (${room} px)`);
  console.log(`  Round row: widest ${widest.toFixed(0)} px against 319 px (375) and 334 px (390)`);
}

const total = passes + failures.length;
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`\npattern-overhaul-gravity-levels-check: FAIL (${failures.length} of ${total})`);
  process.exit(1);
}
console.log(`pattern-overhaul-gravity-levels-check: ${passes} passed`);
