/**
 * cards-board-check (30 Oct 2026): Arcade's Cards & Board games, Minesweeper (minesRev 1) and Mahjong Solitaire
 * (mahjongRev 1). docs/arcade-standard/minesweeper.md and mahjong.md.
 *
 *  1. The deal: the same seed always deals the same board (a digest of room seeds 0–99 pinned below); Minesweeper's
 *     boards have 25 mines, none on the start square or its neighbours, an opening of 20–60 squares, and the logic solver (no guess) clears every
 *     one from its opening; Mahjong's faces are 6 dealt four times and 24 twice, and the backwards build's order clears
 *     the stack. Proved on the tuning seeds 0–59, the fresh seeds 10000–10199 and 1,500 more (3,000 with --full).
 *  2. Every dealt seed reaches 200: the oracle (the deal's own proof, scripts/cards-board-oracles.ts) replayed through
 *     the server (replayMinesweeperRun / replayMahjongRun) scores exactly 200 on the tuning and fresh seeds, and the
 *     room generators deal only seeds whose own proof holds (sampled).
 *  3. The rules: a mine costs 5, is marked and play goes on; a flag protects its square; a chord opens a number's other
 *     neighbours only when its flags are all placed; a blocked Mahjong tile can't be taken; a mismatch moves the
 *     selection; a Shuffle keeps the remaining faces, is the same for the same seed and log, and leaves a board with a
 *     clearing (proved from 400 random-play states, dead ends included); the replay flags a tampered score.
 *  4. The round: 90 s and 120 s runs on 93 s and 123 s clocks; rooms deal both games.
 *
 *   bun scripts/cards-board-check.ts [--full]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import {
  minesBoard,
  minesNeighbours,
  minesSolve,
  minesweeperGame,
  MINES_BOOM,
  MINES_CELLS,
  MINES_COLS,
  MINES_COUNT,
  MINES_FLAG,
  MINES_HIDDEN,
  MINES_INPUT_TAP,
  MINES_MODE_FLAG,
  MINES_MODE_REVEAL,
  MINES_OPEN,
  MINES_FALLBACK_SEED,
  MINES_OPENING_MAX,
  MINES_OPENING_MIN,
  MINES_MAX_TRIES,
  MINES_REV_STD,
  MINES_RUN_TICKS,
  MINES_SAFE,
  type MinesState,
} from "../src/lib/arcade/minesweeper";
import {
  mahjongBuild,
  mahjongBuildClears,
  mahjongFree,
  mahjongGame,
  mahjongMoves,
  mahjongReshuffle,
  MAHJONG_INPUT_SHUFFLE,
  MAHJONG_INPUT_TAP,
  MAHJONG_PAIRS,
  MAHJONG_QUADS,
  MAHJONG_DOUBLES,
  MAHJONG_REV_STD,
  MAHJONG_REV_DEALT,
  mahjongParts,
  MAHJONG_SHUFFLE_COST,
  MAHJONG_REV_UNDO,
  MAHJONG_INPUT_BUTTON,
  MAHJONG_BUTTON_RESET,
  MAHJONG_BUTTON_UNDO,
  mahjongGameFor,
  MAHJONG_RUN_TICKS,
  MAHJONG_TILES,
  type MahjongState,
} from "../src/lib/arcade/mahjong";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { replayMinesweeperRun } from "../src/lib/duel/minesweeper";
import { replayMahjongRun } from "../src/lib/duel/mahjong";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs, typesInCategory } from "../src/lib/duel/registry";
import { arcadeGroupOf } from "../src/lib/duel/arcadeGroups";
import { roomSeed } from "./arcade-skill-bands/games";
import { encodeOracle, mahjongOracle, minesOracle } from "./cards-board-oracles";

const FULL = process.argv.includes("--full") || process.env.CHECKS_FULL === "1";
let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond && failures.length < 60) failures.push(label);
  else if (!cond) failures.push("…");
}
const t0 = Date.now();

/** Deal digests of room seeds 0–99, recorded when the games were added (30 Oct 2026): a change to a deal fails here. */
const MINES_DIGEST = "98d960fd96290e4cabe51faea6f44bf63c84d223fcc0b976cececbc92bc065ad";
const MAHJONG_DIGEST = "7ff9fecb367197173f5913b9bbccbf06480bf4585e5b709cea999a3f7def8e2b";

const tuning = Array.from({ length: 60 }, (_, n) => roomSeed(n));
const fresh = Array.from({ length: 200 }, (_, n) => roomSeed(10000 + n));
const extra = Array.from({ length: FULL ? 3000 : 1500 }, (_, n) => roomSeed(20000 + n));

/* ============================== Minesweeper ============================== */
{
  const digest = createHash("sha256");
  for (let n = 0; n < 100; n++) {
    const b = minesBoard(roomSeed(n));
    digest.update(`${b.start}:${b.mines.join("")};`);
  }
  const d = digest.digest("hex");
  ok(d === MINES_DIGEST || process.argv.includes("--print-digests"), `minesweeper: the deals of room seeds 0–99 are unchanged (digest ${d})`);
  if (process.argv.includes("--print-digests")) console.log(`MINES_DIGEST ${d}`);

  let maxTries = 0;
  for (const seed of [...tuning, ...fresh, ...extra]) {
    const b = minesBoard(seed);
    const again = minesBoard(seed);
    const mines = b.mines.reduce((a, m) => a + m, 0);
    const banned = [b.start, ...minesNeighbours(b.start)];
    maxTries = Math.max(maxTries, b.tries);
    ok(again.mines.join("") === b.mines.join("") && again.start === b.start, `minesweeper ${seed}: the same seed deals the same board`);
    ok(mines === MINES_COUNT, `minesweeper ${seed}: ${MINES_COUNT} mines (${mines})`);
    ok(banned.every((c) => !b.mines[c]), `minesweeper ${seed}: no mine on the start square or its neighbours`);
    ok(b.tries >= 0 && b.tries < MINES_MAX_TRIES, `minesweeper ${seed}: a board found within ${MINES_MAX_TRIES} tries (${b.tries})`);
    const proof = minesSolve(b.mines, b.start);
    ok(proof.solved, `minesweeper ${seed}: the logic solver clears the board from its opening (no guess)`);
    const opening = proof.steps[0]?.length ?? 0;
    ok(opening >= MINES_OPENING_MIN && opening <= MINES_OPENING_MAX && opening === minesweeperGame.init(seed).opening, `minesweeper ${seed}: the opening reveals ${MINES_OPENING_MIN}–${MINES_OPENING_MAX} squares (${opening})`);
  }
  ok(minesSolve(minesBoard(MINES_FALLBACK_SEED).mines, minesBoard(MINES_FALLBACK_SEED).start).solved && minesBoard(MINES_FALLBACK_SEED).tries >= 0, "minesweeper: the fallback seed's board is solvable on its own");
  console.log(`  minesweeper: ${tuning.length + fresh.length + extra.length} seeds dealt solvable boards (most tries ${maxTries + 1} of ${MINES_MAX_TRIES})`);

  // Every tuning and fresh seed: the oracle, replayed by the server, scores exactly 200.
  let perfect = 0;
  for (const seed of [...tuning, ...fresh]) {
    const r = replayMinesweeperRun(seed, encodeOracle(seed, minesOracle(seed), "minesweeper"), MINES_REV_STD);
    if (r.score === 200 && r.cleared && r.hits === 0 && !r.flagged) perfect++;
    else ok(false, `minesweeper ${seed}: the oracle scores 200 through the replay (got ${r.score}, cleared ${r.cleared}, hits ${r.hits}, flagged ${r.flagged})`);
  }
  ok(perfect === tuning.length + fresh.length, `minesweeper: the oracle scores 200 on all ${tuning.length + fresh.length} tuning and fresh seeds (${perfect})`);
  // The room generator deals only proved seeds.
  for (let i = 0; i < 40; i++) {
    const p = generatePuzzle("minesweeper") as any;
    ok(p.minesRev === MINES_REV_STD && minesBoard(p.seed).tries >= 0 && minesSolve(minesBoard(p.seed).mines, minesBoard(p.seed).start).solved, `minesweeper: a room deal (seed ${p.seed}) is proved`);
  }

  // The rules on room seed 3.
  const seed = roomSeed(3);
  const s0 = minesweeperGame.init(seed);
  const at = (s: MinesState, t: number, a: number, b: number) => minesweeperGame.step({ ...s, tick: t - 1 }, { t, k: MINES_INPUT_TAP, a, b, c: 0, d: 0 } as ArcadeInputEvent);
  const mine = s0.mines.findIndex((m, c) => m && s0.open[c] === MINES_HIDDEN);
  const hit = at(s0, 10, mine, MINES_MODE_REVEAL);
  ok(hit.hits === 1 && hit.open[mine] === MINES_BOOM && !minesweeperGame.isOver(hit) && minesweeperGame.score(hit) === 1, "minesweeper: a mine hit is marked, costs 5 (held at 1 here) and play goes on");
  const flagged = at(s0, 10, mine, MINES_MODE_FLAG);
  ok(flagged.open[mine] === MINES_FLAG && flagged.flags === 1, "minesweeper: a flag marks the square");
  const tapFlag = at(flagged, 11, mine, MINES_MODE_REVEAL);
  ok(tapFlag.open[mine] === MINES_FLAG && tapFlag.hits === 0, "minesweeper: a reveal tap on a flag does nothing");
  const unflag = at(flagged, 11, mine, MINES_MODE_FLAG);
  ok(unflag.open[mine] === MINES_HIDDEN && unflag.flags === 0, "minesweeper: a second flag tap takes the flag away");
  // A chord: a number with all its mines flagged opens its other hidden neighbours; with a flag missing, nothing.
  const number = s0.open.findIndex((v, c) => v === MINES_OPEN && s0.nums[c]! > 0 && minesNeighbours(c).some((n) => s0.open[n] === MINES_HIDDEN && !s0.mines[n]));
  if (number >= 0) {
    const around = minesNeighbours(number);
    let s = s0;
    let t = 10;
    for (const c of around) if (s0.mines[c] && s0.open[c] === MINES_HIDDEN) s = at(s, t++, c, MINES_MODE_FLAG);
    const before = s.revealed;
    const chord = at(s, t, number, MINES_MODE_REVEAL);
    ok(chord.revealed > before && chord.hits === 0 && chord.chords === 1 && around.every((c) => chord.open[c] !== MINES_HIDDEN), "minesweeper: a chord on a fully flagged number opens its other neighbours");
    const short = at(s0, 10, number, MINES_MODE_REVEAL);
    ok(short.revealed === s0.revealed && short.chords === 0, "minesweeper: a chord without the flags placed does nothing");
  } else ok(false, "minesweeper: room seed 3 has a number to chord");
  // A wrong flag makes a chord hit the mine it hides: it costs 5.
  {
    const n = s0.open.findIndex((v, c) => v === MINES_OPEN && s0.nums[c] === 1 && minesNeighbours(c).filter((x) => s0.open[x] === MINES_HIDDEN).length >= 2);
    if (n >= 0) {
      const hidden = minesNeighbours(n).filter((x) => s0.open[x] === MINES_HIDDEN);
      const wrong = hidden.find((x) => !s0.mines[x])!;
      const chord = at(at(s0, 10, wrong, MINES_MODE_FLAG), 11, n, MINES_MODE_REVEAL);
      ok(chord.hits === 1, "minesweeper: a chord round a wrong flag reveals the real mine (a hit)");
    }
  }
  // Nothing happens after the run (90 s) and the board clears by the oracle.
  ok(minesweeperGame.runTicks === MINES_RUN_TICKS && MINES_RUN_TICKS === 90 * 60, "minesweeper: a 90 s run");
  ok(MINES_SAFE === MINES_CELLS - MINES_COUNT && MINES_COLS === 10, "minesweeper: 10 × 16, 135 safe squares");
  // A tampered claim is flagged; the server's score stands.
  const honest = encodeOracle(seed, minesOracle(seed), "minesweeper");
  const tampered = honest.replace(/^(\d+)\|(\d+)\|/, (_m, a) => `${a}|199|`);
  const tr = replayMinesweeperRun(seed, tampered, MINES_REV_STD);
  ok(tr.flagged && tr.score === 200, "minesweeper: a tampered claim is flagged and the replay's own score kept");
  // A slower oracle (a tap every 30 ticks) still clears, with less speed.
  const slow = replayMinesweeperRun(seed, encodeOracle(seed, minesOracle(seed, 1, 30), "minesweeper"), MINES_REV_STD);
  ok(slow.cleared && slow.score < 200 || slow.clearedSeconds <= 48, `minesweeper: a slower clear scores less speed (${slow.score}, ${slow.clearedSeconds} s)`);
}

/* ============================== Mahjong Solitaire ============================== */
{
  const digest = createHash("sha256");
  for (let n = 0; n < 100; n++) digest.update(`${mahjongBuild(roomSeed(n)).face.join(",")};`);
  const d = digest.digest("hex");
  ok(d === MAHJONG_DIGEST || process.argv.includes("--print-digests"), `mahjong: the deals of room seeds 0–99 are unchanged (digest ${d})`);
  if (process.argv.includes("--print-digests")) console.log(`MAHJONG_DIGEST ${d}`);

  for (const seed of [...tuning, ...fresh, ...extra]) {
    const deal = mahjongBuild(seed);
    const counts = new Map<number, number>();
    for (const f of deal.face) counts.set(f, (counts.get(f) ?? 0) + 1);
    const fours = [...counts.values()].filter((c) => c === 4).length;
    const twos = [...counts.values()].filter((c) => c === 2).length;
    ok(deal.face.every((f) => f >= 0) && fours === MAHJONG_QUADS && twos === MAHJONG_DOUBLES, `mahjong ${seed}: 72 tiles, ${MAHJONG_QUADS} faces four times and ${MAHJONG_DOUBLES} twice (${fours}, ${twos})`);
    ok(mahjongBuild(seed).face.join() === deal.face.join(), `mahjong ${seed}: the same seed deals the same stack`);
    ok(mahjongBuildClears(seed), `mahjong ${seed}: the build order clears the stack through the sim`);
  }
  console.log(`  mahjong: ${tuning.length + fresh.length + extra.length} seeds dealt stacks their build order clears`);

  let perfect = 0;
  for (const seed of [...tuning, ...fresh]) {
    const r = replayMahjongRun(seed, encodeOracle(seed, mahjongOracle(seed), "mahjong"), MAHJONG_REV_STD);
    if (r.score === 200 && r.cleared && r.shuffles === 0 && !r.flagged) perfect++;
    else ok(false, `mahjong ${seed}: the oracle scores 200 through the replay (got ${r.score})`);
  }
  ok(perfect === tuning.length + fresh.length, `mahjong: the oracle scores 200 on all ${tuning.length + fresh.length} tuning and fresh seeds (${perfect})`);
  for (let i = 0; i < 40; i++) {
    const p = generatePuzzle("mahjong") as any;
    ok(p.mahjongRev === MAHJONG_REV_DEALT && MAHJONG_REV_DEALT === MAHJONG_REV_UNDO && mahjongBuildClears(p.seed), `mahjong: a room deal (seed ${p.seed}) is mahjongRev 2 and proved`);
  }

  // mahjongRev 2 (31 Oct 2026): Undo and Reset. The same deal; the oracle reaches 200 on every tuning and fresh seed through
  // the rev-2 replay, also with Undo and Reset used along the way (taking pairs, undoing them, resetting, then the
  // build order), all well inside the speed's 65 s.
  const btn = (t: number, a: number): ArcadeInputEvent => ({ t, k: MAHJONG_INPUT_BUTTON, a, b: 0, c: 0, d: 0 });
  let perfect2 = 0;
  let perfectDetour = 0;
  for (const seed of [...tuning, ...fresh]) {
    ok(mahjongGameFor(MAHJONG_REV_UNDO).init(seed).face.join() === mahjongGame.init(seed).face.join(), `mahjong ${seed}: rev 2 deals rev 1's stack`);
    const r = replayMahjongRun(seed, encodeOracle(seed, mahjongOracle(seed), "mahjong", MAHJONG_REV_UNDO), MAHJONG_REV_UNDO);
    if (r.score === 200 && r.cleared && r.shuffles === 0 && !r.flagged) perfect2++;
    else ok(false, `mahjong ${seed}: the oracle scores 200 through the rev-2 replay (got ${r.score})`);
    // Four pairs, two Undos, a pair again, a Reset, then the whole build order.
    const o = mahjongOracle(seed);
    const detour = [...o.slice(0, 8), btn(9, MAHJONG_BUTTON_UNDO), btn(10, MAHJONG_BUTTON_UNDO), ...o.slice(4, 6).map((e, i) => ({ ...e, t: 11 + i })), btn(13, MAHJONG_BUTTON_RESET), ...mahjongOracle(seed, 14)];
    const d = replayMahjongRun(seed, encodeOracle(seed, detour, "mahjong", MAHJONG_REV_UNDO), MAHJONG_REV_UNDO);
    if (d.score === 200 && d.cleared && d.shuffles === 0 && !d.flagged) perfectDetour++;
    else ok(false, `mahjong ${seed}: the oracle with Undo and Reset scores 200 through the rev-2 replay (got ${d.score})`);
  }
  ok(perfect2 === tuning.length + fresh.length, `mahjong rev 2: the oracle scores 200 on all ${tuning.length + fresh.length} tuning and fresh seeds (${perfect2})`);
  ok(perfectDetour === tuning.length + fresh.length, `mahjong rev 2: the oracle with Undo and Reset scores 200 on all ${tuning.length + fresh.length} tuning and fresh seeds (${perfectDetour})`);
  {
    const g2 = mahjongGameFor(MAHJONG_REV_UNDO);
    const sd = roomSeed(5);
    const step2 = (s: MahjongState, e: ArcadeInputEvent) => g2.step({ ...s, tick: e.t - 1 }, e);
    const o = mahjongOracle(sd);
    let s = g2.init(sd);
    const deal = s.face.join();
    for (const e of o.slice(0, 6)) s = step2(s, e);
    const three = s.face.join();
    ok(s.pairs === 3, "mahjong rev 2: three pairs taken");
    s = step2(s, btn(s.tick + 1, MAHJONG_BUTTON_UNDO));
    ok(s.pairs === 2 && s.face.join() === step2(step2(step2(step2(g2.init(sd), o[0]!), o[1]!), o[2]!), o[3]!).face.join() && s.sel === -1, "mahjong rev 2: Undo puts back the last pair");
    s = step2(s, btn(s.tick + 1, MAHJONG_BUTTON_UNDO));
    s = step2(s, btn(s.tick + 1, MAHJONG_BUTTON_UNDO));
    ok(s.pairs === 0 && s.face.join() === deal, "mahjong rev 2: Undo as often as there are moves, back to the deal");
    const idle = step2(s, btn(s.tick + 1, MAHJONG_BUTTON_UNDO));
    ok(idle.face === s.face && idle.pairs === 0 && (idle.undos ?? 0) === (s.undos ?? 0), "mahjong rev 2: Undo with nothing to undo does nothing");
    ok(g2.score({ ...s, tick: g2.runTicks }) === 1, "mahjong rev 2: Undo is free (all undone, a played run scores 1)");
    // A Shuffle, undone: the board comes back, the Shuffle still counts.
    for (const e of o.slice(0, 6)) s = step2(s, { ...e, t: s.tick + 1 });
    ok(s.face.join() === three, "mahjong rev 2: the same pairs again give the same board");
    const before = s.face.join();
    s = step2(s, { t: s.tick + 1, k: MAHJONG_INPUT_SHUFFLE, a: 0, b: 0, c: 0, d: 0 });
    ok(s.shuffles === 1 && s.face.join() !== before, "mahjong rev 2: a Shuffle re-deals");
    s = step2(s, btn(s.tick + 1, MAHJONG_BUTTON_UNDO));
    ok(s.shuffles === 1 && s.face.join() === before && s.pairs === 3, "mahjong rev 2: an undone Shuffle puts the board back and still counts");
    // Reset: the original deal; Shuffles used still count; the clock runs on.
    s = step2(s, { t: s.tick + 1, k: MAHJONG_INPUT_SHUFFLE, a: 0, b: 0, c: 0, d: 0 });
    const tick = s.tick;
    s = step2(s, btn(s.tick + 1, MAHJONG_BUTTON_RESET));
    ok(s.face.join() === deal && s.pairs === 0 && s.shuffles === 2 && s.tick === tick + 1 && (s.history ?? []).length === 0, "mahjong rev 2: Reset restores the deal, keeps both Shuffles, the clock runs on, nothing left to undo");
    ok(mahjongParts(s).penalty === 2 * MAHJONG_SHUFFLE_COST && mahjongParts(s).clean === 0, "mahjong rev 2: Shuffles before a Reset still cost and still void No shuffles");
    // Rev 1: every button press is a Shuffle (its `a` clamped to 0), so stored rev-1 runs replay as before.
    const r1 = replayMahjongRun(sd, encodeOracle(sd, [btn(20, MAHJONG_BUTTON_UNDO)], "mahjong", MAHJONG_REV_STD), MAHJONG_REV_STD);
    ok(r1.shuffles === 1 && r1.flagged && r1.reason === "input payload out of range", "mahjong rev 1: a button press with a = 1 is clamped to a Shuffle and flagged, as before");
    ok(mahjongGame.init(sd).history === undefined && mahjongGame.init(sd).start === undefined, "mahjong rev 1: states carry no undo fields");
  }

  // The rules.
  const seed = roomSeed(3);
  const s0 = mahjongGame.init(seed);
  const tap = (s: MahjongState, t: number, a: number) => mahjongGame.step({ ...s, tick: t - 1 }, { t, k: MAHJONG_INPUT_TAP, a, b: 0, c: 0, d: 0 } as ArcadeInputEvent);
  const blocked = s0.face.findIndex((_, i) => !mahjongFree(s0.face, i));
  const b1 = tap(s0, 5, blocked);
  ok(b1.sel === -1 && b1.blocked === 1 && b1.pairs === 0, "mahjong: a blocked tile can't be selected");
  const [pa, pb] = mahjongMoves(s0.face)[0]!;
  const other = s0.face.findIndex((f, i) => mahjongFree(s0.face, i) && f !== s0.face[pa]);
  const m1 = tap(tap(s0, 5, other), 6, pa);
  ok(m1.sel === pa && m1.misses === 1 && m1.pairs === 0, "mahjong: a second tile that doesn't match takes the selection");
  const m2 = tap(m1, 7, pb);
  ok(m2.pairs === 1 && m2.face[pa] === -1 && m2.face[pb] === -1 && m2.sel === -1, "mahjong: a matching free pair is taken away");
  const d1 = tap(tap(s0, 5, pa), 6, pa);
  ok(d1.sel === -1 && d1.pairs === 0, "mahjong: tapping the selected tile again deselects it");
  ok(mahjongGame.runTicks === MAHJONG_RUN_TICKS && MAHJONG_RUN_TICKS === 120 * 60 && MAHJONG_TILES === 72 && MAHJONG_PAIRS === 36, "mahjong: 72 tiles, 36 pairs, a 120 s run");

  // The Shuffle, from 400 random-play states (dead ends included): the faces left are kept, the result is the same for
  // the same state, and the board after it has a clearing (the build's order exists, so a pair is free).
  let shuffled = 0;
  let deadEnds = 0;
  for (let g = 0; g < 40; g++) {
    const sd = roomSeed(g);
    let s = mahjongGame.init(sd);
    let t = 1;
    let r = (g * 7919) | 1;
    for (let step = 0; step < 40 && s.pairs < MAHJONG_PAIRS; step++) {
      const moves = mahjongMoves(s.face);
      if (step % 4 === 3 || moves.length === 0) {
        if (moves.length === 0) deadEnds++;
        const before = [...s.face].filter((f) => f >= 0).sort((a, b) => a - b).join();
        const again = mahjongReshuffle(s.face, s.rng);
        const next = mahjongGame.step({ ...s, tick: t - 1 }, { t, k: MAHJONG_INPUT_SHUFFLE, a: 0, b: 0, c: 0, d: 0 } as ArcadeInputEvent);
        t++;
        const after = [...next.face].filter((f) => f >= 0).sort((a, b) => a - b).join();
        ok(after === before, `mahjong ${sd}: a Shuffle keeps the faces left`);
        ok(next.face.join() === again.face.join() && next.shuffles === s.shuffles + 1, `mahjong ${sd}: a Shuffle is the same for the same state`);
        // Clearable: the Shuffle's own build order, played forwards through the sim, clears the board.
        let c = next;
        let tc = t;
        for (const [a, b] of again.order) {
          c = tap(tap(c, tc, a), tc + 1, b);
          tc += 2;
        }
        ok(c.face.every((f) => f < 0) && c.pairs === MAHJONG_PAIRS, `mahjong ${sd}: the board after a Shuffle clears by its build order`);
        ok(mahjongMoves(next.face).length > 0, `mahjong ${sd}: a pair is free after a Shuffle`);
        shuffled++;
        s = next;
        continue;
      }
      r = (Math.imul(r, 1103515245) + 12345) | 0;
      const [a, b] = moves[(r >>> 8) % moves.length]!;
      s = tap(tap(s, t, a), t + 1, b);
      t += 2;
    }
  }
  // Dead ends: random play until no pair is free, then a Shuffle (the packed fallback included when the places left
  // can't be cleared as they stand).
  let packed = 0;
  for (let g = 0; g < 300; g++) {
    const sd = roomSeed(500 + g);
    let s = mahjongGame.init(sd);
    let t = 1;
    let r = (g * 2654435761) | 1;
    for (;;) {
      const moves = mahjongMoves(s.face);
      if (!moves.length || s.pairs >= MAHJONG_PAIRS) break;
      r = (Math.imul(r, 1103515245) + 12345) | 0;
      const [a, b] = moves[(r >>> 8) % moves.length]!;
      s = tap(tap(s, t, a), t + 1, b);
      t += 2;
    }
    if (s.pairs >= MAHJONG_PAIRS) continue;
    deadEnds++;
    const again = mahjongReshuffle(s.face, s.rng);
    if (again.packed) packed++;
    let c = mahjongGame.step({ ...s, tick: t - 1 }, { t, k: MAHJONG_INPUT_SHUFFLE, a: 0, b: 0, c: 0, d: 0 } as ArcadeInputEvent);
    ok([...c.face].filter((f) => f >= 0).sort((x, y) => x - y).join() === [...s.face].filter((f) => f >= 0).sort((x, y) => x - y).join(), `mahjong ${sd}: a dead end's Shuffle keeps the faces left`);
    let tc = t + 1;
    for (const [a, b] of again.order) {
      c = tap(tap(c, tc, a), tc + 1, b);
      tc += 2;
    }
    ok(c.pairs === MAHJONG_PAIRS, `mahjong ${sd}: a dead end's Shuffle leaves a board its build order clears${again.packed ? " (packed)" : ""}`);
    shuffled++;
  }
  ok(deadEnds >= 20, `mahjong: the random play met dead ends to shuffle (${deadEnds})`);
  console.log(`  mahjong: ${shuffled} Shuffles from random-play states (${deadEnds} dead ends, ${packed} packed onto the lowest places) kept the faces and a clearing`);

  const honest = encodeOracle(seed, mahjongOracle(seed), "mahjong");
  const tr = replayMahjongRun(seed, honest.replace(/^(\d+)\|(\d+)\|/, (_m, a) => `${a}|7|`), MAHJONG_REV_STD);
  ok(tr.flagged && tr.score === 200, "mahjong: a tampered claim is flagged and the replay's own score kept");
}

/* ============================== The round ============================== */
{
  ok((["minesweeper", "mahjong"] as const).every((t) => typesInCategory("arcade").includes(t) && arcadeGroupOf(t) === "cards"), "rooms deal both Cards & Board games, in the Cards & Board group");
  ok(puzzleTimeLimitMs(generatePuzzle("minesweeper")) === 93_000 && puzzleTimeLimitMs(generatePuzzle("mahjong")) === 123_000, "Minesweeper's 90 s and Mahjong's 120 s runs on 93 s and 123 s clocks");
  void MINES_REV_STD;
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL cards-board-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS cards-board-check: ${checks} checks (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
void MINES_OPEN;
