/**
 * Letterfall (wordfall) checks:
 *  1. Dictionary: the committed phone list is exactly the rebuild from the SCOWL
 *     list (minus blocked words and Q-without-U words), decodes to the stated
 *     count and hash, and agrees with the server's isWord on every SCOWL word;
 *     the phone's public text file and cache key match it exactly; reports the
 *     download size it adds (raw, gzip, brotli).
 *  2. Plan: the same seed gives the same queue, columns and drops (tick by tick,
 *     with no input); rev 1: every 20 consecutive queue tiles hold at least 8
 *     vowels, drop intervals fall 1.6 s → 0.8 s across five 18 s phases;
 *     wordfallRev 2: at most 2 vowels in a row, 3 in any 6 tiles and 3
 *     consonants in a row, fewer vowels overall, drops 2.0 s → 1.1 s, a slower
 *     fall, and the Enter box (a tap inside it submits; on rev 1 the same tap
 *     misses) drawn exactly on its tap box.
 *  2b. Legacy: real rev-1 runs recorded on main before wordfallRev 2
 *     (fixtures/wordfall-rev1-legacy.json.gz: strong, slow, quitting and random
 *     play, stamped 1 and unstamped) replay to the identical score, final state
 *     and checkpoints.
 *  3. Par: a scripted word-finding bot, playing through recordInput as the phone
 *     does on today's revision (pressing the Enter box), reaches par inside the
 *     90 s run on every tested seed, and the server replay of its submitted
 *     string scores 150.
 *  4. Identity proof (both revisions): random input logs, including out-of-range
 *     payloads and unknown kinds, recorded through recordInput (always on the
 *     next sim tick, as the phone records),
 *     replay to the identical state, checkpoints and score; a hand-built bad log
 *     (out-of-order ticks, out-of-range payloads, an unknown kind) is repaired,
 *     flagged, and replays exactly as the sim driven with the repaired log.
 *
 *   bun scripts/wordfall-check.ts [botSeeds]
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { brotliCompressSync, gunzipSync, gzipSync } from "node:zlib";

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
  wfInEnterV2,
  wfWorldHFor,
  wordfallCheckpoint,
  wordfallGameFor,
  wordfallPlan,
  wordfallScore,
  WF_CELL,
  WF_CHECKPOINT_INTERVAL,
  WF_COLS,
  WF_ENTER_V2,
  WF_FALL,
  WF_FALL_V2,
  WF_H,
  WF_H_V2,
  WF_INPUT_ENTER,
  WF_INPUT_TAP,
  WF_PAR,
  WF_QUEUE_LEN,
  WF_ROWS,
  WF_RUN_TICKS,
  WF_START_TILES,
  WF_VOWEL_MIN,
  WF_VOWEL_WINDOW,
  WF_V2_CONSONANT_RUN,
  WF_V2_VOWEL_RUN,
  WF_V2_VOWEL_SPAN,
  WF_V2_VOWEL_SPAN_MAX,
  WF_W,
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
import { wordfallDataSource, wordfallMetaSource } from "./wordfall-dict";
import { WORDFALL_DATA_PATH, WORDFALL_META_PATH, WORDFALL_PUBLIC_DIR, wordfallWordsHash } from "./wordfall-lib";
import { WORDFALL_META } from "@/lib/arcade/wordfallWords.meta";

const BOT_SEEDS = Number(process.argv[2] ?? 20);
/** The revision rooms deal today, and the original rules stored rounds keep. */
const REV = 2;
const wordfallGame = wordfallGameFor(1);
const gameV2 = wordfallGameFor(REV);
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
  check(readFileSync(WORDFALL_META_PATH, "utf8") === wordfallMetaSource(), "wordfallWords.meta.ts is not the current rebuild (run bun scripts/wordfall-dict.ts)");
  check(WORDFALL_META.count === WORDFALL_WORD_COUNT && WORDFALL_META.hash === WORDFALL_WORDS_HASH, "phone cache key (meta) disagrees with the data file");
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
  const publicPath = WORDFALL_PUBLIC_DIR + WORDFALL_META.url.split("/").pop();
  const txt = existsSync(publicPath) ? readFileSync(publicPath) : Buffer.from("");
  check(txt.toString("utf8") === WORDFALL_WORDS_FC, `phone copy ${WORDFALL_META.url} is missing or differs from the server's list`);
  check(readdirSync(WORDFALL_PUBLIC_DIR).length === 1, "public/wordfall holds stale word-list versions");
  const js = txt;
  console.log(
    `dictionary: ${WORDFALL_WORD_COUNT} words, agrees with isWord on ${scowl.size} SCOWL words; ` +
      `phone download (${WORDFALL_META.url}) ${(js.length / 1024).toFixed(0)} KB raw, ${(gzipSync(js).length / 1024).toFixed(0)} KB gzip, ${(brotliCompressSync(js).length / 1024).toFixed(0)} KB brotli`,
  );
}

/* --------------------------------- 2. Plan -------------------------------- */
interface DropRecord {
  tick: number;
  col: number;
  letter: number;
}
function idleRun(seed: number, game = wordfallGame): { drops: DropRecord[]; state: WordfallState } {
  let state = game.init(seed);
  const drops: DropRecord[] = [];
  while (!game.isOver(state)) {
    const before = state.drops;
    state = game.step(state, null);
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
  const intervals = [0, 1079, 1080, 2160, 3240, 4320, 5399].map((t) => wfDropInterval(t));
  check(same(intervals, [96, 96, 84, 72, 60, 48, 48]), `drop intervals ${intervals.join(",")}`);
  check(same([3, 4, 5, 6, 7, 9, 12].map(wfWordPoints), [1, 2, 4, 7, 11, 11, 11]), "word points table");
  check(wordfallScore(30) === 150 && wordfallScore(60) === 150 && wordfallScore(15) === 75 && wordfallScore(1) === 5 && wordfallScore(0) === 0, "score formula");
  console.log("plan: 2000 seeds, every 20-tile window ≥ 8 vowels, balanced column bags, identical drops per seed");

  // wordfallRev 2: the run rules on every seed, fewer vowels, the same column bags, slower drops.
  let vowels = 0;
  let tiles = 0;
  let minWindow = 99;
  for (let seed = 1; seed <= 2000; seed++) {
    const s = seed * 7919;
    const a = wordfallPlan(s, REV);
    if (!same(a, wordfallPlan(s, REV))) fail(`rev 2 seed ${s}: plan differs between two builds`);
    if (a.plan.letters.length !== WF_QUEUE_LEN || a.plan.cols.length !== WF_QUEUE_LEN) fail(`rev 2 seed ${s}: queue length`);
    const letters = a.plan.letters;
    let vRun = 0;
    let cRun = 0;
    for (let i = 0; i < letters.length; i++) {
      const v = wfIsVowel(letters[i]!);
      vRun = v ? vRun + 1 : 0;
      cRun = v ? 0 : cRun + 1;
      if (v) vowels++;
      tiles++;
      if (vRun > WF_V2_VOWEL_RUN) fail(`rev 2 seed ${s}: ${vRun} vowels in a row at ${i}`);
      if (cRun > WF_V2_CONSONANT_RUN) fail(`rev 2 seed ${s}: ${cRun} consonants in a row at ${i}`);
      if (i + 1 >= WF_V2_VOWEL_SPAN) {
        let n = 0;
        for (let j = i + 1 - WF_V2_VOWEL_SPAN; j <= i; j++) if (wfIsVowel(letters[j]!)) n++;
        if (n > WF_V2_VOWEL_SPAN_MAX) fail(`rev 2 seed ${s}: ${n} vowels in tiles ${i + 1 - WF_V2_VOWEL_SPAN}-${i}`);
      }
      if (i + 1 >= WF_VOWEL_WINDOW) {
        let n = 0;
        for (let j = i + 1 - WF_VOWEL_WINDOW; j <= i; j++) if (wfIsVowel(letters[j]!)) n++;
        minWindow = Math.min(minWindow, n);
      }
    }
    const cols = a.plan.cols;
    for (let i = 0; i + 6 <= cols.length; i += 6) if (new Set(cols.slice(i, i + 6)).size !== 6) fail(`rev 2 seed ${s}: column bag ${i / 6}`);
    for (let i = 1; i < cols.length; i++) if (cols[i] === cols[i - 1]) fail(`rev 2 seed ${s}: column twice in a row at ${i}`);
    checks += 3;
  }
  const share = vowels / tiles;
  check(share > 0.33 && share < 0.42, `rev 2 vowel share ${(share * 100).toFixed(1)} %, want 33-42 %`);
  check(minWindow >= 5, `rev 2: only ${minWindow} vowels in some 20-tile window`);
  for (const seed of [1, 42, 123456789, -77]) {
    const a = idleRun(seed, gameV2);
    check(same(a, idleRun(seed, gameV2)), `rev 2 seed ${seed}: two idle runs differ`);
    const plan = wordfallPlan(seed, REV).plan;
    a.drops.forEach((d, i) => {
      if (d.col !== plan.cols[i] || d.letter !== plan.letters[WF_START_TILES + i]) fail(`rev 2 seed ${seed}: drop ${i} is not queue tile ${WF_START_TILES + i}`);
    });
    check(a.state.over === 1 && a.state.rev === REV, `rev 2 seed ${seed}: an idle run should overflow`);
    check(a.state.tick > idleRun(seed).state.tick, `rev 2 seed ${seed}: idle overflow not later than rev 1`);
  }
  const intervalsV2 = [0, 1079, 1080, 2160, 3240, 4320, 5399].map((t) => wfDropInterval(t, REV));
  check(same(intervalsV2, [120, 120, 105, 90, 78, 66, 66]), `rev 2 drop intervals ${intervalsV2.join(",")}`);
  check(WF_FALL_V2 < WF_FALL, "rev 2 fall is not slower");
  // A dropped tile falls WF_FALL_V2 a tick on rev 2.
  {
    let st = gameV2.init(5);
    while (st.drops === 0) st = gameV2.step(st, null);
    const col = st.plan.cols[0]!;
    const y0 = st.well[col]![st.well[col]!.length - 1]!.y;
    st = gameV2.step(st, null);
    check(st.well[col]![st.well[col]!.length - 1]!.y - y0 === WF_FALL_V2, "rev 2 fall step");
  }
  check(wfWorldHFor(REV) === WF_H_V2 && wfWorldHFor(1) === WF_H && wfWorldHFor(undefined) === WF_H, "world heights by revision");
  check(WF_ENTER_V2.y >= WF_WELL_Y + WF_ROWS * WF_CELL + 8 && WF_ENTER_V2.y + WF_ENTER_V2.h <= WF_H_V2 && WF_ENTER_V2.x >= 0 && WF_ENTER_V2.x + WF_ENTER_V2.w <= WF_W, "Enter box sits under the well frame inside the rev-2 world");
  // A chain of three settled tiles, then a tap in the Enter box: submitted on rev 2, a miss on rev 1.
  for (const rev of [1, REV]) {
    const game = wordfallGameFor(rev);
    let st = game.init(77);
    const taps = [tapAtCell(st, { col: 0, index: 0, id: 0, letter: 0 }, 1), tapAtCell(st, { col: 1, index: 0, id: 0, letter: 0 }, 2), tapAtCell(st, { col: 2, index: 0, id: 0, letter: 0 }, 3)];
    for (const ev of taps) st = game.step(st, ev);
    check(st.chain.length === 3, `rev ${rev}: chain of three not built`);
    const enter = { t: 4, k: WF_INPUT_TAP, a: WF_ENTER_V2.x + 1, b: WF_ENTER_V2.y + WF_ENTER_V2.h - 1, c: 0, d: 0 };
    const after = game.step(st, enter);
    if (rev === REV) check(after.submits === 1 && after.chain.length === 0 && after.taps === st.taps + 1, "rev 2: a tap in the Enter box does not submit");
    else check(after.submits === 0 && after.chain.length === 3, "rev 1: a tap below the well changed the chain");
    const outside = game.step(st, { ...enter, a: WF_ENTER_V2.x - 1 });
    check(outside.submits === 0 && outside.chain.length === 3, `rev ${rev}: a tap 1 px left of the Enter box submitted`);
  }
  check(wfInEnterV2(WF_ENTER_V2.x, WF_ENTER_V2.y) && !wfInEnterV2(WF_ENTER_V2.x + WF_ENTER_V2.w, WF_ENTER_V2.y) && !wfInEnterV2(WF_ENTER_V2.x, WF_ENTER_V2.y + WF_ENTER_V2.h), "Enter box edges");
  console.log(`plan rev 2: 2000 seeds, ≤ ${WF_V2_VOWEL_RUN} vowels in a row, ≤ ${WF_V2_VOWEL_SPAN_MAX} in any ${WF_V2_VOWEL_SPAN}, ≤ ${WF_V2_CONSONANT_RUN} consonants in a row; vowels ${(share * 100).toFixed(1)} % (min ${minWindow} per 20); drops 2.0 s → 1.1 s; Enter box submits`);
}

/* ------------------------- 2a. Enter box art = tap box ------------------------- */
{
  // Draw a rev-2 state lit (a 3-tile chain) and muted (the same state over): the only pixels
  // that differ are the Enter box's, and they reach every edge of its tap box within 2 px.
  const { createCanvas } = await import("@napi-rs/canvas");
  Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => 10_000 } });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 1 },
  });
  const { drawWordfall } = await import("@/lib/arcade/wordfall.renderer");
  let st = gameV2.init(77);
  for (const [i, col] of [0, 1, 2].entries()) st = gameV2.step(st, tapAtCell(st, { col, index: 0, id: 0, letter: 0 }, i + 1));
  const frame = (s: WordfallState) => {
    const c = createCanvas(WF_W, WF_H_V2);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    drawWordfall(ctx, s, { width: WF_W, height: WF_H_V2 });
    return ctx.getImageData(0, 0, WF_W, WF_H_V2).data;
  };
  const lit = frame(st);
  const muted = frame({ ...st, over: 1 });
  let x0 = WF_W, y0 = WF_H_V2, x1 = -1, y1 = -1;
  for (let y = 0; y < WF_H_V2; y++) for (let x = 0; x < WF_W; x++) {
    const i = (y * WF_W + x) * 4;
    if (Math.abs(lit[i]! - muted[i]!) + Math.abs(lit[i + 1]! - muted[i + 1]!) + Math.abs(lit[i + 2]! - muted[i + 2]!) > 24) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  const e = WF_ENTER_V2;
  const box = `${x0},${y0}-${x1 + 1},${y1 + 1}`;
  check(x1 >= 0, "Enter box art did not change between lit and muted");
  check(Math.abs(x0 - e.x) <= 2 && Math.abs(y0 - e.y) <= 2 && Math.abs(x1 + 1 - (e.x + e.w)) <= 2 && Math.abs(y1 + 1 - (e.y + e.h)) <= 2,
    `Enter box drawn at ${box}, tap box ${e.x},${e.y}-${e.x + e.w},${e.y + e.h}`);
  console.log(`enter box: drawn ${box}, tap box ${e.x},${e.y}-${e.x + e.w},${e.y + e.h} (within 2 px)`);
}

/* --------------------------- 2b. Legacy rev-1 runs --------------------------- */
{
  const path = new URL("./fixtures/wordfall-rev1-legacy.json.gz", import.meta.url).pathname;
  const fixture = JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as {
    runs: { label: string; seed: number; rev: number | null; raw: string; score: number; stateDigest: string; checkpointsDigest: string }[];
  };
  const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
  let scored = 0;
  for (const run of fixture.runs) {
    const r = replayWordfallRun(run.seed, run.raw, run.rev ?? undefined);
    const problems: string[] = [];
    if (r.score !== run.score) problems.push(`score ${r.score}, recorded ${run.score}`);
    if (digest(r.state) !== run.stateDigest) problems.push("final state");
    if (digest(r.checkpoints) !== run.checkpointsDigest) problems.push("checkpoints");
    if (r.state.rev !== 1) problems.push(`state rev ${r.state.rev}`);
    if (problems.length) fail(`legacy ${run.label} (rev ${run.rev ?? "unstamped"}): ${problems.join(", ")}`);
    if (run.score > 0) scored++;
    checks++;
  }
  check(fixture.runs.length >= 30 && scored >= 20, `legacy fixture too thin (${fixture.runs.length} runs, ${scored} scoring)`);
  console.log(`legacy: ${fixture.runs.length} real rev-1 replays (stamped 1 and unstamped; ${scored} scoring) give the recorded score, state and checkpoints`);
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

/** wordfallRev 2's Enter: a tap in the middle of the Enter box. */
function enterTap(t: number): ArcadeInputEvent {
  return { t, k: WF_INPUT_TAP, a: WF_ENTER_V2.x + WF_ENTER_V2.w / 2, b: WF_ENTER_V2.y + WF_ENTER_V2.h / 2, c: 0, d: 0 };
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

function botRun(seed: number, game = gameV2): { state: WordfallState; raw: string; parTick: number } {
  let state = game.init(seed);
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
      else cand = state.rev === 2 ? enterTap(t) : { t, k: WF_INPUT_ENTER, a: 0, b: 0, c: 0, d: 0 };
      step++;
      if (step > plan.length) {
        plan = [];
        step = 0;
      }
    }
    recordInput(log, cand, game.inputRanges);
    state = game.step(state, inputAt(log, t));
    if (state.tick % WF_CHECKPOINT_INTERVAL === 0) cps.push(wordfallCheckpoint(state));
    if (parTick < 0 && state.points >= WF_PAR) parTick = state.tick;
  }
  const score = game.score(state);
  const raw = appendClientCounters(
    encodeWordfallRun({ seed, claimedScore: score, events: log, endTick: state.tick, checkpoints: cps }, state.rev),
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
    const result = replayWordfallRun(seed, raw, REV);
    totalPoints += state.points;
    if (result.score !== 150 || parTick < 0)
      fail(`bot seed ${seed}: ${state.points} points (${state.words} words, ${state.over ? "overflowed" : "survived"}) → ${result.score}, par not reached`);
    if (!same(result.state, state) || result.flagged) fail(`bot seed ${seed}: replay differs from the played run (${result.reason ?? ""})`);
    if (parTick > 0) parTicks.push(parTick);
    checks += 2;
  }
  parTicks.sort((a, b) => a - b);
  console.log(
    `par (rev ${REV}, Enter box): bot reached ${WF_PAR} on ${parTicks.length}/${BOT_SEEDS} seeds (median ${((parTicks[Math.floor(parTicks.length / 2)] ?? 0) / 60).toFixed(1)} s, slowest ${((parTicks[parTicks.length - 1] ?? 0) / 60).toFixed(1)} s); mean ${(totalPoints / BOT_SEEDS).toFixed(1)} points by the end`,
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
    // Alternate revisions: even pairs on rev 1, odd pairs on rev 2.
    const rev = Math.floor(run / 2) % 2 === 0 ? 1 : REV;
    const wordfallGame = wordfallGameFor(rev);
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
        } else if (kind === WF_INPUT_TAP && rand(4) === 0) {
          cand = enterTap(t);
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
      encodeWordfallRun({ seed, claimedScore: score, events: log, endTick: state.tick, checkpoints: cps }, rev),
      arcadeCounters("wordfall", state, score),
    );
    const result = replayWordfallRun(seed, raw, rev);
    const problems: string[] = [];
    if (result.score !== score) problems.push(`score ${score} vs ${result.score}`);
    if (!same(result.state, state)) problems.push("final state");
    if (!same(result.checkpoints, cps)) problems.push("checkpoints");
    if (result.flagged || result.inputDiag.clamped || result.inputDiag.dropped) problems.push(`flagged ${result.reason ?? ""}`);
    if (problems.length) fail(`identity run ${run} (rev ${rev}) seed ${seed}: ${problems.join(", ")}`);
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
