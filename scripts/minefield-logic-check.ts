/**
 * minefield-logic-check (13 Nov 2026, Joe's decision): Minefield (`minesweeper`) as a Logic game on minesRev 2 with 20
 * mines, and Tenfall (`tendrop`) moved from Number to Speed. docs/arcade-standard/minesweeper.md "minesRev 2".
 *
 *  1. Rev 1 unchanged: 30 minesRev 1 runs recorded on main before the change (skill-band bots at four levels, the
 *     oracle's perfect line and an idle run on five room seeds; scripts/fixtures/minefield-logic-legacy.json,
 *     `bun scripts/minefield-logic-legacy-record.ts <main checkout>`) replay to the same score, final tick, squares and
 *     final-state checksum, and the rev-1 boards of room seeds 0–99 have main's digest.
 *  2. The rev-2 deal: rooms and Practice deal minesRev 2 (minesPreLogic pins rev 1); each board has exactly 20 mines,
 *     none on the start square or its neighbours, an opening of 20–60 squares, and the logic solver (no guess) clears it,
 *     on the tuning seeds 0–59, the fresh seeds 10000–10199 and 1,500 more (3,000 with --full); the deals of room seeds
 *     0–99 match the digest in scripts/fixtures/minefield-logic-deal.json (`--record` writes it once).
 *  3. Every dealt seed reaches 200: the oracle (the deal's own proof) replayed through the server scores exactly 200 on
 *     every tuning and fresh seed; the parts are 150 + 20 + 30 with Speed full by 37 s; an idle run scores 0.
 *  4. The moves: Minefield is a Logic game on the arcade engine (arcadeRun, its arcade clock, the puzzle reveal with its
 *     breakdown), in ENGINE_GAME_WORLDS and no arcade group; Tenfall is a Speed game, its deal and stamps unchanged.
 *
 *   bun scripts/minefield-logic-check.ts [--full] [--record]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import {
  minesBoard,
  minesCheckpoint,
  minesCountFor,
  minesNeighbours,
  minesParts,
  minesSafeFor,
  minesSolve,
  minesStdSpecFor,
  minesweeperGameFor,
  MINES_COUNT_V2,
  MINES_MAX_TRIES,
  MINES_OPENING_MAX,
  MINES_OPENING_MIN,
  MINES_REV_LOGIC,
  MINES_REV_STD,
  MINES_SPEED_FULL_S_V2,
} from "../src/lib/arcade/minesweeper";
import { ACTIVE_ARCADE_GAMES, ENGINE_GAME_WORLDS } from "../src/lib/arcade/arcadeFxGames.renderer";
import { arcadeGroupOf } from "../src/lib/duel/arcadeGroups";
import { PUZZLE_CATALOGUE, typesInCategory, usesArcadeClock } from "../src/lib/duel/catalogue";
import { replayMinesweeperRun } from "../src/lib/duel/minesweeper";
import { generateMinesweeper, pinMinesPreLogic } from "../src/lib/duel/arcade.server";
import { PUZZLE_REVEAL_ENGINE_TYPES } from "../src/components/duel/AnswerReveal";
import { PRACTICE_STAMPS } from "../src/lib/duel/practiceStamps.data";
import { encodeOracle, minesOracle } from "./cards-board-oracles";
import { roomSeed } from "./arcade-skill-bands/games";

const FULL = process.argv.includes("--full") || process.env["CHECKS_FULL"] === "1";
const RECORD = process.argv.includes("--record");
let passes = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  if (cond) passes += 1;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

/* 1. Rev 1 unchanged */
{
  const fixture = JSON.parse(readFileSync("scripts/fixtures/minefield-logic-legacy.json", "utf8")) as {
    recordedOn: string;
    boardsDigest: string;
    runs: { seed: number; label: string; raw: string; score: number; checksum: number; tick: number; revealed: number; hits: number }[];
  };
  let same = 0;
  for (const run of fixture.runs) {
    const r = replayMinesweeperRun(run.seed, run.raw, MINES_REV_STD);
    const match = r.score === run.score && minesCheckpoint(r.state).checksum === run.checksum && r.state.tick === run.tick && r.revealed === run.revealed && r.hits === run.hits;
    ok(match, `rev 1 ${run.seed} ${run.label}: replays as on main ${fixture.recordedOn} (${r.score} vs ${run.score})`);
    if (match) same += 1;
  }
  ok(fixture.runs.length === 30, `30 recorded rev-1 runs (${fixture.runs.length})`);
  const boards = createHash("sha256");
  for (let n = 0; n < 100; n++) {
    const b = minesBoard(roomSeed(n));
    boards.update(`${n}:${b.start}:${b.tries}:${b.mines.join("")};`);
  }
  ok(boards.digest("hex") === fixture.boardsDigest, "rev 1: the boards of room seeds 0–99 are main's");
  console.log(`  rev 1: ${same} of ${fixture.runs.length} runs recorded on main replay identically`);
}

/* 2. The rev-2 deal */
{
  const dealt = new Set<number>();
  for (let i = 0; i < 40; i++) dealt.add(generateMinesweeper().minesRev ?? 0);
  ok(dealt.size === 1 && dealt.has(MINES_REV_LOGIC), `rooms and Practice deal minesRev ${MINES_REV_LOGIC} (${[...dealt].join(", ")})`);
  const before = pinMinesPreLogic(true);
  ok(generateMinesweeper().minesRev === MINES_REV_STD, "minesPreLogic deals minesRev 1");
  pinMinesPreLogic(before);
  ok(generateMinesweeper().minesRev === MINES_REV_LOGIC, "unpinned, the deal is minesRev 2 again");
  // The rev-1 deal is check-only: the generator reads it only through checkOverride, which a production build turns
  // off before reading any stand-in (Vite's literal replacement, done here as security-hardening-check does).
  const gen = readFileSync("src/lib/duel/arcade.server.ts", "utf8");
  const body = gen.slice(gen.indexOf("export function generateMinesweeper"), gen.indexOf("export function pinMinesPreLogic"));
  ok(/checkOverride<boolean>\("__DUELZ_MINES_PRE_LOGIC__"\) === true \? MINES_REV_STD : MINES_REV_LOGIC/.test(body) && !/dealPinned/.test(body), "the rev-1 deal is read only through checkOverride");
  const helper = readFileSync("src/lib/checkOverride.ts", "utf8");
  const asBuilt = (prod: string) =>
    new Bun.Transpiler({ loader: "ts" }).transformSync(helper.replaceAll("import.meta.env.PROD", prod)).replace(/export\s+function/g, "function").replace(/export\s+type[^;]+;/g, "") + "\nreturn { checkOverride, setCheckOverride };";
  const built = new Function(asBuilt("true"))() as { checkOverride: (n: string) => unknown; setCheckOverride: (n: string, v: unknown) => void };
  const dev = new Function(asBuilt("false"))() as typeof built;
  dev.setCheckOverride("__DUELZ_MINES_PRE_LOGIC__", true);
  built.setCheckOverride("__DUELZ_MINES_PRE_LOGIC__", true);
  ok(built.checkOverride("__DUELZ_MINES_PRE_LOGIC__") === undefined && dev.checkOverride("__DUELZ_MINES_PRE_LOGIC__") === true, "built for production, the rev-1 switch is ignored; under a check it works");
  dev.setCheckOverride("__DUELZ_MINES_PRE_LOGIC__", undefined);
  ok(minesCountFor(MINES_REV_LOGIC) === 20 && MINES_COUNT_V2 === 20 && minesCountFor(MINES_REV_STD) === 25 && minesCountFor(undefined) === 25, "20 mines on rev 2, 25 on rev 1 and unstamped");
  ok(minesSafeFor(MINES_REV_LOGIC) === 140 && minesSafeFor(MINES_REV_STD) === 135, "140 safe squares on rev 2, 135 on rev 1");

  const tuning = Array.from({ length: 60 }, (_, n) => roomSeed(n));
  const fresh = Array.from({ length: 200 }, (_, n) => roomSeed(10000 + n));
  const extra = Array.from({ length: FULL ? 3000 : 1500 }, (_, n) => roomSeed(20000 + n));
  let maxTries = 0;
  let bad = 0;
  for (const seed of [...tuning, ...fresh, ...extra]) {
    const b = minesBoard(seed, MINES_REV_LOGIC);
    const mines = b.mines.reduce((a, m) => a + m, 0);
    const banned = [b.start, ...minesNeighbours(b.start)];
    const proof = minesSolve(b.mines, b.start, MINES_COUNT_V2);
    const opening = proof.steps[0]?.length ?? 0;
    const game = minesweeperGameFor(MINES_REV_LOGIC).init(seed);
    maxTries = Math.max(maxTries, b.tries);
    const good =
      mines === 20 &&
      banned.every((c) => !b.mines[c]) &&
      b.tries >= 0 &&
      b.tries < MINES_MAX_TRIES &&
      proof.solved &&
      opening >= MINES_OPENING_MIN &&
      opening <= MINES_OPENING_MAX &&
      game.opening === opening &&
      game.rev === MINES_REV_LOGIC &&
      game.mines.join("") === b.mines.join("");
    if (!good) {
      bad += 1;
      ok(false, `rev 2 seed ${seed}: 20 mines clear of the start, a logic-only board with a 20–60 opening (mines ${mines}, tries ${b.tries}, opening ${opening}, solved ${proof.solved})`);
    }
  }
  ok(bad === 0, `rev 2: every one of ${tuning.length + fresh.length + extra.length} seeds deals a solvable 20-mine board (most tries ${maxTries + 1})`);

  const digest = createHash("sha256");
  for (let n = 0; n < 100; n++) {
    const b = minesBoard(roomSeed(n), MINES_REV_LOGIC);
    digest.update(`${n}:${b.start}:${b.tries}:${b.mines.join("")};`);
  }
  const d = digest.digest("hex");
  const file = "scripts/fixtures/minefield-logic-deal.json";
  if (RECORD && !existsSync(file)) writeFileSync(file, JSON.stringify({ rev: MINES_REV_LOGIC, digest: d }, null, 1) + "\n");
  const want = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { digest: string }).digest : null;
  ok(want !== null && d === want, `rev 2: the deals of room seeds 0–99 match ${file} (${d.slice(0, 12)})`);

  /* 3. Every dealt seed reaches 200 */
  let perfect = 0;
  for (const seed of [...tuning, ...fresh]) {
    const r = replayMinesweeperRun(seed, encodeOracle(seed, minesOracle(seed, 1, 1, MINES_REV_LOGIC), "minesweeper", MINES_REV_LOGIC), MINES_REV_LOGIC);
    const p = minesParts(r.state);
    const good = r.score === 200 && r.cleared && !r.flagged && r.hits === 0 && p.core === 150 && p.clean === 20 && p.speed === 30;
    if (good) perfect += 1;
    else ok(false, `rev 2 seed ${seed}: the oracle scores 200 through the server replay (${r.score}, flagged ${r.flagged})`);
  }
  ok(perfect === tuning.length + fresh.length, `rev 2: the oracle reaches 200 on all ${tuning.length + fresh.length} tuning and fresh seeds (${perfect})`);
  const idle = replayMinesweeperRun(tuning[3]!, encodeOracle(tuning[3]!, [], "minesweeper", MINES_REV_LOGIC), MINES_REV_LOGIC);
  ok(idle.score === 0, `rev 2: no input scores 0 (${idle.score})`);
  const spec = minesStdSpecFor(MINES_REV_LOGIC);
  ok(spec.rev === MINES_REV_LOGIC && spec.parts.reduce((a, p) => a + p.max, 0) === 200, "rev 2's parts sum to 200");
  ok(MINES_SPEED_FULL_S_V2 === 37 && /within 37 s/.test(spec.parts.find((p) => p.key === "speed")!.how), "rev 2's Speed is full by 37 s (the near-perfect median clear on rev 2)");
}

/* 4. The moves */
{
  const mines = PUZZLE_CATALOGUE.minesweeper;
  ok(mines.category === "logic" && mines.arcadeRun === true && usesArcadeClock("minesweeper"), "Minefield is a Logic game on the arcade clock");
  ok(typesInCategory("logic").includes("minesweeper") && !typesInCategory("arcade").includes("minesweeper"), "Minefield deals in Logic, not Arcade");
  ok(arcadeGroupOf("minesweeper") === null, "Minefield is in no arcade group");
  ok("minesweeper" in ENGINE_GAME_WORLDS && !(ACTIVE_ARCADE_GAMES as readonly string[]).includes("minesweeper"), "Minefield's world is an engine game's, not an active arcade game's");
  ok(PUZZLE_REVEAL_ENGINE_TYPES.has("minesweeper"), "Minefield takes the puzzle reveal with its breakdown");
  ok(PRACTICE_STAMPS.minesweeper?.includes(`minesRev=${MINES_REV_LOGIC}`) === true, `practice stamps name minesRev ${MINES_REV_LOGIC} (${PRACTICE_STAMPS.minesweeper})`);
  const ten = PUZZLE_CATALOGUE.tendrop;
  ok(ten.category === "speed" && ten.arcadeRun === true && typesInCategory("speed").includes("tendrop") && !typesInCategory("number").includes("tendrop"), "Tenfall is a Speed game, out of Number");
  ok(PRACTICE_STAMPS.tendrop === "puzzleScoreRev=3 speedPar=1 tenRev=5", `Tenfall's stamps are unchanged (${PRACTICE_STAMPS.tendrop})`);
}

console.log(`minefield-logic-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
