/**
 * Letterfall (wordfall) checks:
 *  1. Dictionary: the committed phone list is exactly the rebuild from the SCOWL
 *     list (minus blocked words and Q-without-U words), decodes to the stated
 *     count and hash, and agrees with the server's isWord on every SCOWL word;
 *     reports the download size it adds (raw, gzip, brotli).
 *  2. Plan: the same seed gives the same queue, columns and drops (tick by tick,
 *     with no input); every 20 consecutive queue tiles hold at least 8 vowels;
 *     drop intervals fall 1.6 s → 0.8 s across five 18 s phases.
 *  3. Par: a scripted word-finding bot, playing through recordInput as the phone
 *     does, reaches par inside the 90 s run on every tested seed, and the server
 *     replay of its submitted string scores 150.
 *  4. Identity proof (this sim only): random input logs, including out-of-range
 *     payloads and unknown kinds, recorded through recordInput (always on the
 *     next sim tick, as the phone records),
 *     replay to the identical state, checkpoints and score; a hand-built bad log
 *     (out-of-order ticks, out-of-range payloads, an unknown kind) is repaired,
 *     flagged, and replays exactly as the sim driven with the repaired log.
 *
 *   bun scripts/wordfall-check.ts [botSeeds]
 */
import { readFileSync } from "node:fs";
import { brotliCompressSync, gzipSync } from "node:zlib";

import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import {
  checkInputEvents,
  inputAt,
  recordInput,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";
import {
  wfDropInterval,
  wfIsVowel,
  wfRestY,
  wfSettled,
  wfSpelling,
  wfWordPoints,
  wordfallCheckpoint,
  wordfallGame,
  wordfallPlan,
  wordfallScore,
  WF_CELL,
  WF_CHECKPOINT_INTERVAL,
  WF_COLS,
  WF_INPUT_ENTER,
  WF_INPUT_TAP,
  WF_PAR,
  WF_QUEUE_LEN,
  WF_RUN_TICKS,
  WF_START_TILES,
  WF_VOWEL_MIN,
  WF_VOWEL_WINDOW,
  WF_WELL_X,
  WF_WELL_Y,
  type WordfallState,
} from "@/lib/arcade/wordfall";
import { decodeWordfallWords, isWordfallWord, wordfallWordCount } from "@/lib/arcade/wordfallDict";
import { WORDFALL_WORD_COUNT, WORDFALL_WORDS_FC, WORDFALL_WORDS_HASH } from "@/lib/arcade/wordfallWords.data";
import { isWord } from "@/lib/duel/dictionary.server";
import { SCOWL_WORDS_RAW } from "@/lib/duel/wordlist.server";
import { encodeWordfallRun, replayWordfallRun } from "@/lib/duel/wordfall";
import "@/lib/duel/wordfallDict.server";
import { wordfallDataSource } from "./wordfall-dict";
import { WORDFALL_DATA_PATH, wordfallWordsHash } from "./wordfall-lib";

const BOT_SEEDS = Number(process.argv[2] ?? 20);
let failures = 0;
let checks = 0;
const fail = (msg: string) => {
  failures++;
  console.log("FAIL", msg);
};
const check = (ok: boolean, msg: string) => {
  checks++;
  if (!ok) fail(msg);
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ------------------------------ 1. Dictionary ------------------------------ */
{
  check(readFileSync(WORDFALL_DATA_PATH, "utf8") === wordfallDataSource(), "wordfallWords.data.ts is not the current rebuild (run bun scripts/wordfall-dict.ts)");
  const decoded = [...decodeWordfallWords(WORDFALL_WORDS_FC)];
  check(decoded.length === WORDFALL_WORD_COUNT, `decoded ${decoded.length} words, file says ${WORDFALL_WORD_COUNT}`);
  check(wordfallWordsHash(decoded) === WORDFALL_WORDS_HASH, "decoded list hash differs from the stated hash");
  check(wordfallWordCount() === WORDFALL_WORD_COUNT, "server install has the wrong word count");
  let disagree = 0;
  let example = "";
  const scowl = new Set(SCOWL_WORDS_RAW.split(/\s+/).filter(Boolean));
  for (const word of scowl) {
    if (!/^[a-z]+$/.test(word)) continue;
    const want = isWord(word) && !/q(?!u)/.test(word) && word.length >= 3 && word.length <= 12;
    if (isWordfallWord(word) !== want) {
      disagree++;
      example ||= word;
    }
  }
  for (const word of ["cat", "quit", "queen", "qat", "xx", "zzz", "aardvarks", "colour", "color"]) {
    const want = isWord(word) && !/q(?!u)/.test(word);
    if (isWordfallWord(word) !== want) {
      disagree++;
      example ||= word;
    }
  }
  check(disagree === 0, `phone list disagrees with the server's isWord on ${disagree} words (e.g. ${example})`);
  const js = readFileSync(WORDFALL_DATA_PATH);
  console.log(
    `dictionary: ${WORDFALL_WORD_COUNT} words, agrees with isWord on ${scowl.size} SCOWL words; ` +
      `download ${(js.length / 1024).toFixed(0)} KB raw, ${(gzipSync(js).length / 1024).toFixed(0)} KB gzip, ${(brotliCompressSync(js).length / 1024).toFixed(0)} KB brotli`,
  );
}

/* --------------------------------- 2. Plan -------------------------------- */
interface DropRecord {
  tick: number;
  col: number;
  letter: number;
}
function idleRun(seed: number): { drops: DropRecord[]; state: WordfallState } {
  let state = wordfallGame.init(seed);
  const drops: DropRecord[] = [];
  while (!wordfallGame.isOver(state)) {
    const before = state.drops;
    state = wordfallGame.step(state, null);
    if (state.drops > before) {
      const col = state.plan.cols[before]!;
      const top = state.well[col]![state.well[col]!.length - 1]!;
      drops.push({ tick: state.tick, col, letter: top.l });
    }
  }
  return { drops, state };
}
{
  for (let seed = 1; seed <= 2000; seed++) {
    const s = seed * 7919;
    const a = wordfallPlan(s);
    const b = wordfallPlan(s);
    if (!same(a, b)) fail(`seed ${s}: plan differs between two builds`);
    const letters = a.plan.letters;
    if (letters.length !== WF_QUEUE_LEN) fail(`seed ${s}: queue length ${letters.length}`);
    for (let i = 0; i + WF_VOWEL_WINDOW <= letters.length; i++) {
      let v = 0;
      for (let j = i; j < i + WF_VOWEL_WINDOW; j++) if (wfIsVowel(letters[j]!)) v++;
      if (v < WF_VOWEL_MIN) {
        fail(`seed ${s}: ${v} vowels in queue tiles ${i}-${i + WF_VOWEL_WINDOW - 1}`);
        break;
      }
    }
    const cols = a.plan.cols;
    for (let i = 0; i + 6 <= cols.length; i += 6) {
      if (new Set(cols.slice(i, i + 6)).size !== 6) fail(`seed ${s}: column bag ${i / 6} is not all six columns`);
    }
    for (let i = 1; i < cols.length; i++) if (cols[i] === cols[i - 1]) fail(`seed ${s}: column ${cols[i]} twice in a row at drop ${i}`);
    checks += 3;
  }
  // Same seed, same drops tick by tick; another seed differs.
  for (const seed of [1, 42, 123456789, -77]) {
    const a = idleRun(seed);
    const b = idleRun(seed);
    check(same(a, b), `seed ${seed}: two idle runs differ`);
    const plan = wordfallPlan(seed).plan;
    a.drops.forEach((d, i) => {
      if (d.col !== plan.cols[i] || d.letter !== plan.letters[WF_START_TILES + i]) fail(`seed ${seed}: drop ${i} is not queue tile ${WF_START_TILES + i}`);
    });
    check(a.state.over === 1, `seed ${seed}: an idle run should overflow`);
  }
  check(!same(idleRun(1).drops, idleRun(2).drops), "seeds 1 and 2 drop the same tiles");
  const intervals = [0, 1079, 1080, 2160, 3240, 4320, 5399].map(wfDropInterval);
  check(same(intervals, [96, 96, 84, 72, 60, 48, 48]), `drop intervals ${intervals.join(",")}`);
  check(same([3, 4, 5, 6, 7, 9, 12].map(wfWordPoints), [1, 2, 4, 7, 11, 11, 11]), "word points table");
  check(wordfallScore(45) === 150 && wordfallScore(60) === 150 && wordfallScore(30) === 100 && wordfallScore(1) === 3 && wordfallScore(0) === 0, "score formula");
  console.log("plan: 2000 seeds, every 20-tile window ≥ 8 vowels, balanced column bags, identical drops per seed");
}

/* ---------------------------------- 3. Par --------------------------------- */
const PREFIXES = (() => {
  const set = new Set<string>();
  for (const word of decodeWordfallWords(WORDFALL_WORDS_FC)) for (let i = 1; i <= word.length; i++) set.add(word.slice(0, i));
  return set;
})();

interface Cell {
  col: number;
  index: number;
  id: number;
  letter: number;
}

/**
 * The bot's word on the settled tiles: most points, then the tallest columns
 * cleared. Patient: below 5 letters it waits for more tiles unless a column is
 * getting tall (danger) or the run is nearly over.
 */
function bestWord(state: WordfallState): Cell[] | null {
  const cells: Cell[][] = state.well.map((stack, col) => {
    const out: Cell[] = [];
    for (let index = 0; index < stack.length; index++) {
      const t = stack[index]!;
      if (!wfSettled(t, index)) break;
      out.push({ col, index, id: t.id, letter: t.l });
    }
    return out;
  });
  const heights = state.well.map((s) => s.length);
  let best: Cell[] | null = null;
  let bestValue = -1;
  const path: Cell[] = [];
  const used = new Set<number>();
  const visit = (cell: Cell, word: string) => {
    const w = word + wfSpelling(cell.letter);
    if (!PREFIXES.has(w) || path.length >= 12) return;
    path.push(cell);
    used.add(cell.id);
    if (w.length >= 3 && isWordfallWord(w)) {
      let danger = 0;
      for (const c of path) danger += heights[c.col]! * heights[c.col]!;
      const value = wfWordPoints(w.length) * 1000 + danger;
      if (value > bestValue) {
        bestValue = value;
        best = [...path];
      }
    }
    for (let dc = -1; dc <= 1; dc++) {
      for (let di = -1; di <= 1; di++) {
        const next = cells[cell.col + dc]?.[cell.index + di];
        if (next && !used.has(next.id)) visit(next, w);
      }
    }
    path.pop();
    used.delete(cell.id);
  };
  for (const column of cells) for (const cell of column) visit(cell, "");
  const chosen = best as Cell[] | null;
  if (!chosen) return null;
  const length = chosen.reduce((n, c) => n + wfSpelling(c.letter).length, 0);
  const tallest = Math.max(...heights);
  const late = state.tick > WF_RUN_TICKS - 240;
  if (length >= 5 || tallest >= 7 || late) return chosen;
  return null;
}

function tapAtCell(state: WordfallState, cell: Cell, t: number): ArcadeInputEvent {
  void state;
  return {
    t,
    k: WF_INPUT_TAP,
    a: WF_WELL_X + cell.col * WF_CELL + WF_CELL / 2,
    b: WF_WELL_Y + wfRestY(cell.index) / 256 + WF_CELL / 2,
    c: 0,
    d: 0,
  };
}

function botRun(seed: number): { state: WordfallState; raw: string; parTick: number } {
  let state = wordfallGame.init(seed);
  const log: ArcadeInputEvent[] = [];
  const cps: ReturnType<typeof wordfallCheckpoint>[] = [];
  let plan: Cell[] = [];
  let step = 0;
  let parTick = -1;
  while (!wordfallGame.isOver(state)) {
    const t = state.tick + 1;
    let cand: ArcadeInputEvent | null = null;
    if (step === 0 && state.chain.length === 0) {
      plan = bestWord(state) ?? [];
    }
    if (plan.length) {
      if (step < plan.length) cand = tapAtCell(state, plan[step]!, t);
      else cand = { t, k: WF_INPUT_ENTER, a: 0, b: 0, c: 0, d: 0 };
      step++;
      if (step > plan.length) {
        plan = [];
        step = 0;
      }
    }
    recordInput(log, cand, wordfallGame.inputRanges);
    state = wordfallGame.step(state, inputAt(log, t));
    if (state.tick % WF_CHECKPOINT_INTERVAL === 0) cps.push(wordfallCheckpoint(state));
    if (parTick < 0 && state.points >= WF_PAR) parTick = state.tick;
  }
  const score = wordfallGame.score(state);
  const raw = appendClientCounters(
    encodeWordfallRun({ seed, claimedScore: score, events: log, endTick: state.tick, checkpoints: cps }),
    arcadeCounters("wordfall", state, score),
  );
  return { state, raw, parTick };
}
{
  const parTicks: number[] = [];
  let totalPoints = 0;
  for (let n = 0; n < BOT_SEEDS; n++) {
    const seed = (n * 2654435761 + 97) | 0;
    const { state, raw, parTick } = botRun(seed);
    const result = replayWordfallRun(seed, raw);
    totalPoints += state.points;
    if (result.score !== 150 || parTick < 0)
      fail(`bot seed ${seed}: ${state.points} points (${state.words} words, ${state.over ? "overflowed" : "survived"}) → ${result.score}, par not reached`);
    if (!same(result.state, state) || result.flagged) fail(`bot seed ${seed}: replay differs from the played run (${result.reason ?? ""})`);
    if (parTick > 0) parTicks.push(parTick);
    checks += 2;
  }
  parTicks.sort((a, b) => a - b);
  console.log(
    `par: bot reached ${WF_PAR} on ${parTicks.length}/${BOT_SEEDS} seeds (median ${((parTicks[Math.floor(parTicks.length / 2)] ?? 0) / 60).toFixed(1)} s, slowest ${((parTicks[parTicks.length - 1] ?? 0) / 60).toFixed(1)} s); mean ${(totalPoints / BOT_SEEDS).toFixed(1)} points by the end`,
  );
}

/* ----------------------------- 4. Identity proof ----------------------------- */
{
  let rng = 4242;
  const rand = (n: number) => {
    rng = (Math.imul(rng, 1103515245) + 12345) >>> 0;
    return rng % Math.max(1, n);
  };
  const RUNS = 60;
  let maxEvents = 0;
  for (let run = 0; run < RUNS; run++) {
    const seed = rand(0x7ffffffe) + 1;
    let state = wordfallGame.init(seed);
    const log: ArcadeInputEvent[] = [];
    const cps: ReturnType<typeof wordfallCheckpoint>[] = [];
    // Half the runs aim at real tiles (building and submitting chains), half tap anywhere.
    const aim = run % 2 === 0;
    while (!wordfallGame.isOver(state)) {
      const t = state.tick + 1;
      let cand: ArcadeInputEvent | null = null;
      if (rand(100) < 12) {
        const kind = rand(20) === 0 ? 99 : rand(6) === 0 ? WF_INPUT_ENTER : WF_INPUT_TAP;
        if (aim && kind === WF_INPUT_TAP) {
          const col = rand(WF_COLS);
          const index = rand(Math.max(1, state.well[col]!.length));
          cand = tapAtCell(state, { col, index, id: 0, letter: 0 }, t);
        } else {
          cand = { t, k: kind, a: rand(520) - 60, b: rand(800) - 80, c: rand(5) - 2, d: rand(5) - 2 };
        }
      }
      recordInput(log, cand, wordfallGame.inputRanges);
      state = wordfallGame.step(state, inputAt(log, t));
      if (state.tick % WF_CHECKPOINT_INTERVAL === 0) cps.push(wordfallCheckpoint(state));
    }
    maxEvents = Math.max(maxEvents, log.length);
    const score = wordfallGame.score(state);
    const raw = appendClientCounters(
      encodeWordfallRun({ seed, claimedScore: score, events: log, endTick: state.tick, checkpoints: cps }),
      arcadeCounters("wordfall", state, score),
    );
    const result = replayWordfallRun(seed, raw);
    const problems: string[] = [];
    if (result.score !== score) problems.push(`score ${score} vs ${result.score}`);
    if (!same(result.state, state)) problems.push("final state");
    if (!same(result.checkpoints, cps)) problems.push("checkpoints");
    if (result.flagged || result.inputDiag.clamped || result.inputDiag.dropped) problems.push(`flagged ${result.reason ?? ""}`);
    if (problems.length) fail(`identity run ${run} seed ${seed}: ${problems.join(", ")}`);
    checks++;
  }
  // A bad log the phone could never record: the server repairs, flags and replays it deterministically.
  const seed = 9001;
  const tap = (t: number, col: number, index: number): ArcadeInputEvent => ({ t, k: WF_INPUT_TAP, a: WF_WELL_X + col * WF_CELL + 30, b: WF_WELL_Y + wfRestY(index) / 256 + 30, c: 0, d: 0 });
  const bad: ArcadeInputEvent[] = [
    tap(30, 0, 0),
    tap(25, 1, 0), // out of order
    { t: 40, k: WF_INPUT_TAP, a: 9999, b: -50, c: 0, d: 0 }, // out of range
    { t: 41, k: 77, a: 1, b: 1, c: 0, d: 0 }, // unknown kind
    { t: 50, k: WF_INPUT_ENTER, a: 5, b: 0, c: 0, d: 0 }, // payload out of range
    { t: 99999, k: WF_INPUT_TAP, a: 100, b: 600, c: 0, d: 0 }, // after the run
  ];
  const raw = encodeWordfallRun({ seed, claimedScore: 0, events: bad, endTick: 0, checkpoints: [] });
  const r1 = replayWordfallRun(seed, raw);
  const r2 = replayWordfallRun(seed, raw);
  const repaired = checkInputEvents(bad, WF_RUN_TICKS, wordfallGame.inputRanges ?? []);
  let state = wordfallGame.init(seed);
  const byTick = new Map(repaired.events.map((e) => [e.t, e]));
  while (!wordfallGame.isOver(state)) state = wordfallGame.step(state, byTick.get(state.tick + 1) ?? null);
  check(r1.flagged && r1.inputDiag.first !== null, "bad log not flagged");
  check(r1.inputDiag.dropped === 1 && r1.inputDiag.clamped === 4, `bad log diag ${JSON.stringify(r1.inputDiag)}`);
  check(same(r1.state, r2.state) && r1.score === r2.score, "bad log replays differently twice");
  check(same(r1.state, state), "bad log replay differs from the sim driven with the repaired log");
  console.log(`identity: ${RUNS} random runs (max ${maxEvents} events) replay identically; bad log repaired (${r1.inputDiag.clamped} clamped, ${r1.inputDiag.dropped} dropped, first: ${r1.inputDiag.first?.reason}) and replays deterministically`);
}

if (failures) {
  console.log(`FAIL: ${failures} of ${checks} wordfall checks`);
  process.exit(1);
}
console.log(`Letterfall checks passed: ${checks} assertions`);
