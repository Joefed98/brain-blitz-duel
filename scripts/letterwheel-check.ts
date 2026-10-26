/**
 * Roundabout (letterwheel) check (wheelRev 1, 14 Oct 2026: 11–14 word crosswords and
 * an attempt-log answer; unstamped stored rounds unchanged):
 *   1. legacy identity: 3,456 stored-round cases recorded on main before the change
 *      (scripts/fixtures/letterwheel-legacy.json.gz, recorded by
 *      scripts/letterwheel-legacy-record.ts: 24 room seeds × 3 stamp variants × 12
 *      answers × 4 times left) grade, check and reveal exactly as main did; the old
 *      bank rebuilds byte for byte (`letter-wheel-bank.ts --legacy --check`) and the
 *      legacy draw still returns its entries unchanged;
 *   2. new bank proofs: the rev-1 bank rebuilds byte for byte, and every entry is
 *      re-proved here: 11–14 different everyday words, at least 7 of 4+ letters and at
 *      most 5 of 3, every word a dictionary word spellable from the 7 wheel letters,
 *      at most 11 × 9, crossings consistent, every run of 2+ letters exactly one slot,
 *      one connected grid, the wheel not itself a word;
 *   3. room draw: new puzzles are stamped wheelRev 1 (and puzzleScoreRev 1), the room
 *      seed deals the same board every time and every player in a room gets it, the
 *      words stay server-only (splitPuzzle);
 *   4. log cost: exact score anchors (finish 120 + accuracy + speed, unfinished 12 / 5
 *      per word up to 110), the 5 free misses then 3 each, neutral real words and
 *      repeats free, untraceable traces are misses and fill nothing, the log is read
 *      in order and capped, a word list without the log keeps grading as found words;
 *   5. random play: random 3-letter and 3–5 letter traces and a 3-letter sweep on 30
 *      room seeds score about 0 (median ≤ 5); the simulated players (fairness kit) keep
 *      their bands and every finish beats every unfinished run.
 *
 *   bun scripts/letterwheel-check.ts
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { commonWords, isWord } from "../src/lib/duel/dictionary.server";
import { buildRoomPuzzles, generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import {
  LW_FREE_MISSES,
  LW_MAX_TRACES,
  LW_MISS_COST,
  LW_REV1_LIMITS,
  lwEncodeLog,
  lwSlotCells,
  lwTallyLog,
  lwWordCredit,
} from "../src/lib/duel/letterWheel";
import { generateLetterWheelLegacy } from "../src/lib/duel/letterWheel.server";
import { LETTER_WHEEL_BANK } from "../src/lib/duel/letterWheelBank.server";
import { LETTER_WHEEL_BANK_REV1 } from "../src/lib/duel/letterWheelBankRev1.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import {
  LETTERWHEEL_TIME_MS,
  type LetterWheelPuzzleData,
  type PuzzleData,
} from "../src/lib/duel/types";
import { letterWheelPuzzle } from "../src/puzzles/letterWheel";
import { roomPuzzle, runPlay, runSpam } from "./puzzle-fairness/run";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS } from "./puzzle-fairness/kit";
import { pinDealtPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";
import { pinPreDepth } from "../src/lib/duel/wordDepth";

// Written for the rev-1 puzzle shape: new puzzles here carry puzzleScoreRev 1 (rooms deal rev 2 since 19 Oct 2026, scoring-bands-check).
pinDealtPuzzleScoreRev(1);
// Word depth (25 Oct 2026): this check proves wheelRev 1; depth-letterwheel-check proves wheelRev 2.
pinPreDepth(true);

const failures: string[] = [];
let checks = 0;
function check(label: string, ok: boolean) {
  checks++;
  if (!ok) failures.push(label);
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
const T = LETTERWHEEL_TIME_MS;
const BANK_SCRIPT = new URL("./letter-wheel-bank.ts", import.meta.url).pathname;

// ── 1. Legacy identity ──
interface Case {
  puzzle: PuzzleData;
  answer: string;
  ms: number;
  reveal?: string;
  check: boolean;
  g: {
    score: number;
    isCorrect: boolean;
    correctCount: number | null;
    errors: number | null;
    extra: unknown;
    storedMs: number;
    answer: string;
  };
}
const cases = JSON.parse(
  gunzipSync(
    readFileSync(new URL("./fixtures/letterwheel-legacy.json.gz", import.meta.url)),
  ).toString(),
) as Case[];
let legacyBad = 0;
let reveals = 0;
for (const c of cases) {
  const g = gradeAnswer(c.puzzle, c.answer, c.ms);
  const same =
    g.score === c.g.score &&
    g.isCorrect === c.g.isCorrect &&
    g.correctCount === c.g.correctCount &&
    g.errors === c.g.errors &&
    g.storedMs === c.g.storedMs &&
    g.answer === c.g.answer &&
    JSON.stringify(g.extra) === JSON.stringify(c.g.extra) &&
    letterWheelPuzzle.check(c.answer, c.puzzle) === c.check;
  if (!same && legacyBad++ < 5)
    failures.push(`legacy case ${c.answer.slice(0, 30)} @${c.ms}: ${g.score} vs ${c.g.score}`);
  if (c.reveal !== undefined) {
    reveals++;
    const html = renderToStaticMarkup(
      createElement(letterWheelPuzzle.Reveal, {
        puzzle: c.puzzle,
        myAnswer: c.answer,
        myCorrect: c.g.isCorrect,
        myReactionAvgMs: null,
        myMsRemaining: c.ms,
        timeLimitMs: T,
      }),
    );
    if (html !== c.reveal && legacyBad++ < 5)
      failures.push(`legacy reveal differs: ${c.answer.slice(0, 30)}`);
  }
}
check(
  `legacy: ${cases.length} stored-round cases grade as on main (${legacyBad} differ)`,
  cases.length >= 3000 && legacyBad === 0,
);
check(`legacy: ${reveals} reveals render as on main`, reveals > 500);
check(
  "legacy: fixture puzzles are unstamped",
  cases.every((c) => (c.puzzle as { wheelRev?: number }).wheelRev === undefined),
);
// The legacy draw still returns its bank entries unchanged.
for (const seed of [1, 2, 3, 99, 12345]) {
  const p = withSeededRandom(seed, () => generateLetterWheelLegacy());
  check(
    `legacy draw ${seed} comes from the old bank`,
    p.wheelRev === undefined &&
      LETTER_WHEEL_BANK.some(
        (e) => e.letters === p.letters && JSON.stringify(e.words) === JSON.stringify(p.words),
      ),
  );
}
const legacyBuild = spawnSync(process.execPath, [BANK_SCRIPT, "--legacy", "--check"], {
  encoding: "utf8",
});
check(
  `legacy bank rebuilds byte for byte: ${(legacyBuild.stdout + legacyBuild.stderr).trim().split("\n").at(-1)}`,
  legacyBuild.status === 0,
);

// ── 2. New bank proofs ──
const rev1Build = spawnSync(process.execPath, [BANK_SCRIPT, "--check"], { encoding: "utf8" });
check(
  `rev-1 bank rebuilds byte for byte: ${(rev1Build.stdout + rev1Build.stderr).trim().split("\n").at(-1)}`,
  rev1Build.status === 0,
);
const everyday = new Set(commonWords());
let bankBad = 0;
const L = LW_REV1_LIMITS;
for (const [n, e] of LETTER_WHEEL_BANK_REV1.entries()) {
  const why: string[] = [];
  if (e.letters.length !== 7) why.push("wheel not 7 letters");
  if (isWord(e.letters)) why.push("wheel order is a word");
  if (e.cols > L.maxCols || e.rows > L.maxRows) why.push("too big");
  if (
    e.words.length < L.minWords ||
    e.words.length > L.maxWords ||
    e.slots.length !== e.words.length
  )
    why.push("word count");
  if (new Set(e.words).size !== e.words.length) why.push("repeat");
  if (e.words.filter((w) => w.length >= 4).length < L.minLong) why.push("few long");
  if (e.words.filter((w) => w.length === 3).length > L.maxShort) why.push("many short");
  for (const w of e.words) {
    if (!isWord(w) || !everyday.has(w.toLowerCase())) why.push(`${w} not everyday`);
    const left = [...e.letters];
    for (const ch of w) {
      const at = left.indexOf(ch);
      if (at < 0) why.push(`${w} untraceable`);
      else left.splice(at, 1);
    }
  }
  const grid: (string | null)[] = Array(e.cols * e.rows).fill(null);
  e.slots.forEach((s, i) => {
    if (s.len !== e.words[i]!.length) why.push("slot length");
    if (s.across ? s.col + s.len > e.cols : s.row + s.len > e.rows) why.push("slot outside");
    lwSlotCells(s, e.cols).forEach((cell, j) => {
      const ch = e.words[i]![j]!;
      if (grid[cell] && grid[cell] !== ch) why.push("clash");
      grid[cell] = ch;
    });
  });
  // Every maximal run of 2+ letters is exactly one slot.
  const slotKeys = new Set(e.slots.map((s) => `${s.row},${s.col},${s.across}`));
  let runs = 0;
  for (const across of [true, false]) {
    const outer = across ? e.rows : e.cols,
      inner = across ? e.cols : e.rows;
    for (let a = 0; a < outer; a++) {
      let start = -1;
      for (let b = 0; b <= inner; b++) {
        const on = b < inner && grid[(across ? a : b) * e.cols + (across ? b : a)] !== null;
        if (on && start < 0) start = b;
        if (!on && start >= 0) {
          if (b - start >= 2) {
            runs++;
            if (!slotKeys.has(across ? `${a},${start},true` : `${start},${a},false`))
              why.push("accidental word");
          }
          start = -1;
        }
      }
    }
  }
  if (runs !== e.slots.length) why.push("run count");
  // One connected grid; the box is tight.
  const cells = grid.flatMap((ch, i) => (ch ? [i] : []));
  const seen = new Set([cells[0]!]);
  const queue = [cells[0]!];
  while (queue.length) {
    const c = queue.pop()!;
    const r = Math.floor(c / e.cols),
      col = c % e.cols;
    for (const [dr, dc] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as const) {
      const nr = r + dr,
        nc = col + dc;
      const k = nr * e.cols + nc;
      if (nr >= 0 && nr < e.rows && nc >= 0 && nc < e.cols && grid[k] && !seen.has(k)) {
        seen.add(k);
        queue.push(k);
      }
    }
  }
  if (seen.size !== cells.length) why.push("not connected");
  const rowsUsed = new Set(cells.map((c) => Math.floor(c / e.cols))),
    colsUsed = new Set(cells.map((c) => c % e.cols));
  if (rowsUsed.size !== e.rows || colsUsed.size !== e.cols) why.push("loose box");
  if (why.length && bankBad++ < 5) failures.push(`rev-1 bank #${n}: ${why.join(", ")}`);
}
check(
  `rev-1 bank: ${LETTER_WHEEL_BANK_REV1.length} entries proved (${bankBad} bad)`,
  LETTER_WHEEL_BANK_REV1.length >= 300 && bankBad === 0,
);

// ── 3. Room draw ──
const drawn = new Set<string>();
for (let seed = 1; seed <= 60; seed++) {
  const a = generatePuzzle("letterwheel", { bankSeed: seed * 7919 }) as LetterWheelPuzzleData;
  const b = generatePuzzle("letterwheel", { bankSeed: seed * 7919 }) as LetterWheelPuzzleData;
  check(`seed ${seed}: same board twice`, JSON.stringify(a) === JSON.stringify(b));
  check(
    `seed ${seed}: stamped wheelRev 1, puzzleScoreRev 1`,
    a.wheelRev === 1 && (a as { puzzleScoreRev?: number }).puzzleScoreRev === 1,
  );
  check(
    `seed ${seed}: from the rev-1 bank`,
    LETTER_WHEEL_BANK_REV1.some(
      (e) => e.letters === a.letters && JSON.stringify(e.words) === JSON.stringify(a.words),
    ),
  );
  const { pub } = splitPuzzle(a);
  check(`seed ${seed}: words stay server-only`, !("words" in (pub as object)));
  drawn.add(a.letters);
}
check(`60 room seeds spread over the bank (${drawn.size} boards)`, drawn.size >= 45);
{
  // A room whose rounds include Roundabout deals the identical board on every build (every player's copy).
  let found = false;
  for (let seed = 1; seed <= 400 && !found; seed++) {
    const room = buildRoomPuzzles({ seed, categories: ["word"] });
    const at = room.roundOrder.indexOf("letterwheel");
    if (at < 0) continue;
    found = true;
    const again = buildRoomPuzzles({ seed, categories: ["word"] });
    check(
      `room ${seed}: identical Roundabout board on every build`,
      JSON.stringify(room.puzzles[at]) === JSON.stringify(again.puzzles[at]) &&
        (room.puzzles[at] as LetterWheelPuzzleData).wheelRev === 1,
    );
  }
  check("a word room deals Roundabout", found);
}

// ── 4. Log cost ──
const p = roomPuzzle("letterwheel", 5001) as LetterWheelPuzzleData;
const words = p.words!;
const total = words.length;
const others = (() => {
  const out: string[] = [];
  for (const w of commonWords()) {
    const u = w.toUpperCase();
    if (
      u.length >= 3 &&
      u.length <= 7 &&
      !words.includes(u) &&
      lwTallyLog([], p.letters, [u], () => true).misses === 0
    )
      out.push(u);
    if (out.length >= 10) break;
  }
  return out;
})();
// A non-word that can be traced on this wheel.
const junk: string[] = [];
const L7 = [...p.letters];
for (let a = 0; a < 7 && junk.length < 20; a++)
  for (let b = 0; b < 7 && junk.length < 20; b++)
    for (let c = 0; c < 7 && junk.length < 20; c++) {
      const w = L7[a]! + L7[b]! + L7[c]!;
      if (a !== b && b !== c && a !== c && !isWord(w) && !words.includes(w) && !junk.includes(w))
        junk.push(w);
    }
const g = (traces: string[], ms = 0) => gradeAnswer(p, lwEncodeLog(traces), ms);
const n = (k: number) => junk.slice(0, k);
check(
  `log: ${total} words, ${others.length} other real words, ${junk.length} non-words to test with`,
  total >= 11 && others.length >= 3 && junk.length >= 20,
);
check("log: empty scores 0", g([]).score === 0 && g([], T).score === 0);
check(
  "log: every word at half time = 150",
  g(words, T / 2).score === 150 && g(words, T / 2).isCorrect,
);
check("log: every word at the buzzer = 135", g(words, 0).score === 135);
check("log: every word with 25 s left = 120 + 15 + 8", g(words, 25_000).score === 143);
check("log: 5 misses are free on a finish", g([...n(5), ...words], T / 2).score === 150);
check("log: the 6th miss costs 3 on a finish", g([...n(6), ...words], T / 2).score === 147);
check("log: 10 misses cost 15 (accuracy 0)", g([...n(10), ...words], T / 2).score === 135);
check(
  "log: 20 misses still finish at 120 + speed",
  g([...n(20), ...words], T / 2).score === 135 && g([...n(20), ...words], 0).score === 120,
);
check("log: finish ≥ 120 whatever the misses", g([...junk, ...junk, ...words], 0).score === 120);
for (let k = 0; k < total; k++)
  check(
    `log: ${k} words unfinished = ${lwWordCredit(k)}`,
    g(words.slice(0, k)).score === lwWordCredit(k),
  );
check(
  "log: unfinished credit 12 / 5 per word",
  lwWordCredit(1) === 12 &&
    lwWordCredit(6) === 72 &&
    lwWordCredit(7) === 77 &&
    lwWordCredit(13) === 107 &&
    lwWordCredit(20) === 110,
);
check("log: unfinished never above 110", g(words.slice(0, -1)).score <= 110);
check("log: 6 words + 5 misses = 72", g([...words.slice(0, 6), ...n(5)]).score === 72);
check(
  "log: 6 words + 8 misses = 63",
  g([...words.slice(0, 6), ...n(8)]).score === 72 - 3 * LW_MISS_COST,
);
check("log: misses floor unfinished credit at 0", g([words[0]!, ...junk]).score === 0);
check(
  "log: other real words are free",
  g([...others, ...others, ...words.slice(0, 6)]).score === 72,
);
check(
  "log: repeating a slot word is free",
  g([...words.slice(0, 6), words[0]!, words[0]!, words[1]!]).score === 72,
);
check(
  "log: repeating a non-word counts each time",
  g([...words.slice(0, 6), ...Array(8).fill(junk[0]!)]).score === 63,
);
check(
  "log: an untraceable trace is a miss and fills nothing",
  (() => {
    const bad = "QQQ";
    const t = lwTallyLog(words, p.letters, [bad, words[0]!], isWord);
    return t.misses === 1 && t.slots.length === 1;
  })(),
);
check(
  "log: a slot word with a letter the wheel lacks is refused",
  (() => {
    const t = lwTallyLog(words, p.letters.slice(1), words, isWord);
    return t.slots.length < total;
  })(),
);
check(
  "log: the stored extra counts traces, misses and the free allowance",
  (() => {
    const e = g([...n(7), ...others.slice(0, 2), ...words.slice(0, 4)]).extra ?? {};
    return (
      e["misses"] === 7 &&
      e["neutral"] === 2 &&
      e["traces"] === 13 &&
      e["slots"] === 4 &&
      e["freeMisses"] === LW_FREE_MISSES &&
      e["total"] === total
    );
  })(),
);
check(
  "log: the stored breakdown is 120 + accuracy + speed",
  (() => {
    const e = g([...n(7), ...words], 30_000).extra ?? {};
    const parts = e["parts"] as {
      kind: string;
      base: number;
      efficiency: number;
      speed: number;
      measure: string;
    };
    return (
      parts.kind === "finish" &&
      parts.base === 120 &&
      parts.efficiency === 9 &&
      parts.speed === 9 &&
      parts.measure === "accuracy"
    );
  })(),
);
check(
  `log: only the first ${LW_MAX_TRACES} traces are read`,
  g([...Array(LW_MAX_TRACES).fill(others[0]!), ...words], T).score === 0,
);
check(
  "log: bad tokens are dropped, case is ignored",
  g([" " + words[0]!.toLowerCase(), "A1", "", ...words.slice(1)], T / 2).score === 150,
);
check(
  "log: correctCount and errors are the slots and misses",
  (() => {
    const r = g([...n(3), ...words.slice(0, 5)]);
    return r.correctCount === 5 && r.errors === 3 && !r.isCorrect;
  })(),
);
// The reveal shows the stored misses and the log's own slot words.
const html = renderToStaticMarkup(
  createElement(letterWheelPuzzle.Reveal, {
    puzzle: p,
    myAnswer: lwEncodeLog([...n(7), ...words.slice(0, 4)]),
    myCorrect: false,
    myReactionAvgMs: null,
    myMsRemaining: 0,
    timeLimitMs: T,
    myExtra: { misses: 7 },
  }),
);
check(
  "reveal: rev-1 shows found words and stored misses",
  html.includes(`4 / ${total} words`) && html.includes('data-lw-reveal-misses="7"'),
);

// ── 5. Random play and bands ──
const kit = KITS["letterwheel"]!;
const spam = new Map<string, number[]>();
const levels = new Map<string, number[]>();
let minFinish = Infinity;
let maxUnfinished = 0;
for (let seed = 5001; seed <= 5030; seed++) {
  const puzzle = roomPuzzle("letterwheel", seed);
  for (const s of runSpam(kit, puzzle, seed))
    spam.set(s.label, [...(spam.get(s.label) ?? []), s.score]);
  for (const level of LEVELS) {
    const r = runPlay(kit, puzzle, seed, level);
    levels.set(level, [...(levels.get(level) ?? []), r.score]);
    if (r.isCorrect) minFinish = Math.min(minFinish, r.score);
    else maxUnfinished = Math.max(maxUnfinished, r.score);
    for (const u of r.unfinished) maxUnfinished = Math.max(maxUnfinished, u.score);
  }
}
for (const [label, scores] of spam)
  check(
    `random: ${label} median ${median(scores)} (max ${Math.max(...scores)}) ≤ 5`,
    median(scores) <= 5,
  );
check(`random: at least 3 spam strategies (${[...spam.keys()].join(", ")})`, spam.size >= 3);
const band: Record<string, [number, number]> = {
  average: [60, 85],
  good: [90, 115],
  great: [125, 150],
  near: [140, 150],
};
for (const [level, scores] of levels) {
  const m = median(scores);
  const [lo, hi] = band[level]!;
  check(`bands: ${level} median ${m} in ${lo}–${hi}`, m >= lo && m <= hi);
}
check(
  `bands: every finish (min ${minFinish}) beats every unfinished run (max ${maxUnfinished})`,
  minFinish >= 120 && maxUnfinished <= 110,
);

const summary = [...levels].map(([l, s]) => `${l} ${median(s)}`).join(", ");
if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} letterwheel checks`);
  process.exit(1);
}
console.log(
  `letterwheel-check: ${checks} checks passed (legacy ${cases.length} cases; rev-1 bank ${LETTER_WHEEL_BANK_REV1.length}; ${summary})`,
);
