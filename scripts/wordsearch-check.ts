/**
 * Lookout (wordsearch) check.
 *
 *   bun scripts/wordsearch-check.ts
 *
 * 1. Word lists: the bank script's own rules (70+ categories, 38+ words each, dictionary words,
 *    no blocked substrings, no word in two categories, no plural of another listed word).
 * 2. Bank: rebuilds the seeded bank and proves it byte-for-byte equal to wordSearchBank.server.ts;
 *    20 grids per category; every target once, no other word of its category anywhere, both
 *    directions accepted, every live check passes, a full find is a finish.
 * 3. Rev 1 stamp: new puzzles carry wordSearchRev 1 and public wordLengths (placement order);
 *    the split keeps placements private and the lengths public.
 * 4. Legacy identity: stored rounds recorded on main before rev 1
 *    (scripts/fixtures/wordsearch-legacy.json.gz: the room stamp and fully unstamped) grade exactly as before.
 * 5. Chips: rev 1 shows one chip per word with its letter count and never the word; stored rounds keep
 *    blank chips; found words take the first open chip of their length; the reveal shows each count.
 * 6. wordSearchRev 2 (19 Oct 2026, no hidden word is or contains its theme's name, wsThemeClash): the rule on
 *    named cases; the seeded replacements (wordSearchBankRev2.server.ts) rebuild byte-for-byte; every one of
 *    the 1,520 grids rev 2 deals hides no clashing word and shows none anywhere, keeps the bank rules (targets
 *    once, no stray theme word, mixed lengths, finish / backwards / live), 20 grids per theme; grids without
 *    a clash are dealt unchanged; each theme's remaining words are reported.
 * 7. Rev-1 identity: 60 rev-1 puzzles dealt on main before rev 2 (scripts/fixtures/wordsearch-rev1-legacy.json.gz)
 *    are bank grids dealt under rev 1 exactly as stored and every recorded answer grades identically.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { WORD_SEARCH_CATEGORIES } from "../src/lib/duel/wordSearchWords";
import { WORD_SEARCH_BANK } from "../src/lib/duel/wordSearchBank.server";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { pinPreDepth } from "../src/lib/duel/wordDepth";
// Written for wordSearchRev 2: new deals are pinned to it (depth-wordsearch-check proves rev 3).
pinPreDepth(true);
import { splitPuzzle } from "../src/lib/duel/secrets";
import {
  checkWordSearchPath,
  wsChipSlots,
  wsEncode,
  WS_REV,
  wsThemeClash,
  wsThemeForms,
} from "../src/lib/duel/wordSearch";
import { wordSearchEntry, wordSearchFromIndex } from "../src/lib/duel/wordSearch.server";
import { pinDealtPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";
import type { PuzzleData, WordSearchPuzzleData } from "../src/lib/duel/types";
import { wordSearchPuzzle } from "../src/puzzles/wordSearch";
import {
  bankSource,
  buildBank,
  buildRev2Replacements,
  countInGrid,
  rev2Source,
  rev2Words,
  MIN_CATEGORIES,
  MIN_WORDS,
  PER_CATEGORY,
  validateCategories,
} from "./word-search-bank";

// Rev-1 fixtures and the anchors here are the rev-1 score shape (rooms deal puzzleScoreRev 2, scoring-bands-check).
pinDealtPuzzleScoreRev(1);

const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);
const LIMIT = wordSearchPuzzle.timeLimitMs;

// 1. Word lists
const problems = validateCategories();
for (const p of problems.slice(0, 20)) fail(`word lists: ${p}`);
const cats = Object.entries(WORD_SEARCH_CATEGORIES);
const words = cats.reduce((n, [, w]) => n + w.length, 0);
console.log(
  `word lists: ${cats.length} categories (min ${MIN_CATEGORIES}), ${words} words, smallest ${Math.min(...cats.map(([, w]) => w.length))} (min ${MIN_WORDS}), ${problems.length} problems`,
);

// 2. Bank
const t0 = performance.now();
const { bank } = buildBank();
const committed = readFileSync(
  new URL("../src/lib/duel/wordSearchBank.server.ts", import.meta.url),
  "utf8",
);
if (bankSource(bank) !== committed)
  fail(
    "bank: wordSearchBank.server.ts is not the seeded build of wordSearchWords.ts (run bun scripts/word-search-bank.ts)",
  );
if (WORD_SEARCH_BANK.length !== cats.length * PER_CATEGORY)
  fail(`bank: ${WORD_SEARCH_BANK.length} grids, expected ${cats.length * PER_CATEGORY}`);
const perCat = new Map<string, number>();
let finishes = 0,
  backwards = 0,
  live = 0,
  clean = 0;
for (const e of WORD_SEARCH_BANK) {
  perCat.set(e.category, (perCat.get(e.category) ?? 0) + 1);
  const list = WORD_SEARCH_CATEGORIES[e.category];
  if (!list) {
    fail(`bank: unknown category ${e.category}`);
    continue;
  }
  const g = e.grid.split("");
  const targets = e.placements.map((p) => p.word);
  const ok =
    e.placements.every(
      (p) =>
        list.includes(p.word) &&
        countInGrid(g, p.word) === 1 &&
        p.cells.map((c) => g[c]).join("") === p.word,
    ) && list.every((w) => targets.includes(w) || countInGrid(g, w) === 0);
  if (ok) clean++;
  else
    fail(
      `bank: ${e.category} grid ${e.grid.slice(0, 12)}… has a doubled target or a stray category word`,
    );
  const p = {
    type: "wordsearch",
    size: 10,
    grid: e.grid,
    category: e.category,
    wordCount: 6,
    wordSearchRev: WS_REV,
    wordLengths: e.placements.map((x) => x.word.length),
    placements: e.placements,
    speedPar: 1,
    puzzleScoreRev: 1,
  } as PuzzleData;
  const full = gradeAnswer(p, wsEncode(e.placements.map((x) => x.cells)), 90_000);
  if (full.isCorrect && full.score >= 120) finishes++;
  if (gradeAnswer(p, wsEncode(e.placements.map((x) => [...x.cells].reverse())), 0).isCorrect)
    backwards++;
  if (e.placements.every((x) => checkWordSearchPath(e.placements, 10, x.cells, []).valid)) live++;
}
for (const [c] of cats)
  if (perCat.get(c) !== PER_CATEGORY)
    fail(`bank: ${c} has ${perCat.get(c) ?? 0} grids, expected ${PER_CATEGORY}`);
for (const [label, n] of [
  ["finish ≥ 120", finishes],
  ["backwards accepted", backwards],
  ["live checks", live],
] as const) {
  if (n !== WORD_SEARCH_BANK.length) fail(`bank: ${label} ${n}/${WORD_SEARCH_BANK.length}`);
}
console.log(
  `bank: ${WORD_SEARCH_BANK.length} grids (${PER_CATEGORY} per category), seeded rebuild ${bankSource(bank) === committed ? "identical" : "DIFFERENT"} in ${((performance.now() - t0) / 1000).toFixed(1)} s · ${clean} clean · ${finishes} finish · ${backwards} backwards · ${live} live`,
);

// 3. Rev 1 stamp
let stamped = 0;
for (let i = 0; i < 40; i++) {
  const p = generatePuzzle("wordsearch") as WordSearchPuzzleData;
  const lengths = (p.placements ?? []).map((x) => x.word.length);
  if (
    p.wordSearchRev !== WS_REV ||
    JSON.stringify(p.wordLengths) !== JSON.stringify(lengths) ||
    lengths.length !== 6
  ) {
    fail(
      `stamp: generated puzzle ${p.category} has wordSearchRev ${p.wordSearchRev}, lengths ${JSON.stringify(p.wordLengths)} vs ${JSON.stringify(lengths)}`,
    );
    continue;
  }
  const clash = (p.placements ?? []).find((x) => wsThemeClash(p.category, x.word));
  if (clash) fail(`stamp: generated ${p.category} hides ${clash.word}`);
  const { pub, priv } = splitPuzzle(p);
  const pubW = pub as WordSearchPuzzleData;
  if (
    pubW.placements ||
    !priv["placements"] ||
    JSON.stringify(pubW.wordLengths) !== JSON.stringify(lengths)
  )
    fail("stamp: split leaks placements or drops wordLengths");
  else if (
    JSON.stringify(pub).match(
      new RegExp(`"(${(p.placements ?? []).map((x) => x.word).join("|")})"`),
    )
  )
    fail(`stamp: a hidden word reaches the phone (${p.category})`);
  else stamped++;
}
console.log(
  `stamp: ${stamped}/40 generated puzzles carry wordSearchRev ${WS_REV} and public lengths, placements private`,
);

// 4. Legacy identity
const fixture = JSON.parse(
  gunzipSync(
    readFileSync(new URL("./fixtures/wordsearch-legacy.json.gz", import.meta.url)),
  ).toString("utf8"),
) as {
  recordedOn: string;
  cases: {
    label: string;
    puzzle: PuzzleData;
    entries: {
      answer: string;
      ms: number;
      score: number;
      isCorrect: boolean;
      correctCount: number | null;
      errors: number | null;
      extra: string;
    }[];
  }[];
};
let legacyAnswers = 0;
for (const c of fixture.cases) {
  if ((c.puzzle as WordSearchPuzzleData).wordSearchRev !== undefined)
    fail(`legacy ${c.label}: fixture puzzle is stamped`);
  for (const e of c.entries) {
    const g = gradeAnswer(c.puzzle, e.answer, e.ms);
    legacyAnswers++;
    for (const key of ["score", "isCorrect", "correctCount", "errors"] as const) {
      if (g[key] !== e[key])
        fail(`legacy ${c.label} ms ${e.ms}: ${key} ${String(g[key])} ≠ main ${String(e[key])}`);
    }
    if (JSON.stringify(g.extra) !== e.extra)
      fail(`legacy ${c.label} ms ${e.ms}: extra ${JSON.stringify(g.extra)} ≠ main ${e.extra}`);
  }
}
console.log(
  `legacy identity: ${legacyAnswers} answers over ${fixture.cases.length} stored puzzles (${fixture.recordedOn})`,
);

// 5. Chips and reveal
const slotsCase = wsChipSlots([5, 7, 5, 4, 8, 6], ["APPLE", "LEMON", "MEDLAR"]);
if (
  JSON.stringify(slotsCase) !==
  JSON.stringify([
    { length: 5, word: "APPLE" },
    { length: 7, word: null },
    { length: 5, word: "LEMON" },
    { length: 4, word: null },
    { length: 8, word: null },
    { length: 6, word: "MEDLAR" },
  ])
)
  fail(`chips: wsChipSlots ${JSON.stringify(slotsCase)}`);
if (wsChipSlots(undefined, ["APPLE"]) !== null)
  fail("chips: a stored round without lengths must keep blank chips");
const e0 = WORD_SEARCH_BANK[0]!;
const rev1 = {
  type: "wordsearch",
  size: 10,
  grid: e0.grid,
  category: e0.category,
  wordCount: 6,
  wordSearchRev: WS_REV,
  wordLengths: e0.placements.map((x) => x.word.length),
} as PuzzleData;
const noop = () => undefined;
const stageProps = (puzzle: PuzzleData, key: string) => ({
  puzzle,
  locked: false,
  onSubmit: noop,
  onDraftAnswer: noop,
  checkWord: async () => ({ valid: false, points: 0, word: "" }),
  stateKey: key,
});
const stageHtml = renderToStaticMarkup(
  createElement(wordSearchPuzzle.Stage, stageProps(rev1, "wscheck-rev1") as never),
);
const openChips = [...stageHtml.matchAll(/data-ws-chip="open" data-ws-length="(\d)"/g)].map((m) =>
  Number(m[1]),
);
if (JSON.stringify(openChips) !== JSON.stringify(e0.placements.map((x) => x.word.length)))
  fail(`chips: rev 1 stage shows lengths ${JSON.stringify(openChips)}`);
for (const p of e0.placements)
  if (stageHtml.includes(`>${p.word}<`)) fail(`chips: rev 1 stage shows the hidden word ${p.word}`);
const legacyPuzzle = { ...fixture.cases[1]!.puzzle } as Record<string, unknown>;
delete legacyPuzzle.placements;
const legacyHtml = renderToStaticMarkup(
  createElement(
    wordSearchPuzzle.Stage,
    stageProps(legacyPuzzle as unknown as PuzzleData, "wscheck-legacy") as never,
  ),
);
const blank = (legacyHtml.match(/class="lookout-word-placeholder"/g) ?? []).length;
if (blank !== 6 || legacyHtml.includes("data-ws-length"))
  fail(`chips: a stored round must keep six blank chips (got ${blank})`);
const full0 = { ...rev1, placements: e0.placements } as PuzzleData;
const revealHtml = renderToStaticMarkup(
  createElement(wordSearchPuzzle.Reveal, {
    puzzle: full0,
    myAnswer: wsEncode([e0.placements[0]!.cells]),
    myMsRemaining: 0,
    timeLimitMs: LIMIT,
  } as never),
);
for (const p of e0.placements)
  if (
    !revealHtml.includes(`data-ws-reveal-word="${p.word}"`) ||
    !revealHtml.match(new RegExp(`>${p.word}<span[^>]*>${p.word.length}</span>`))
  )
    fail(`chips: reveal lacks ${p.word}'s count`);
console.log(
  `chips: rev 1 open chips ${JSON.stringify(openChips)}, stored round ${blank} blank chips, reveal counts shown`,
);

// 6. Rev 2: no hidden word is or contains its theme's name.
{
  const named: [string, string, boolean][] = [
    ["Fruit", "FRUIT", true],
    ["Fruit", "fruitcake", true],
    ["Birds", "BIRD", true],
    ["Dogs", "BULLDOG", true],
    ["Dogs", "POODLE", false],
    ["Sea creatures", "SEAHORSE", true],
    ["Sea creatures", "SEAL", true],
    ["Circus and funfair", "FAIR", true],
    ["Circus and funfair", "CIRCUS", true],
    ["Herbs and spices", "ALLSPICE", true],
    ["Ways of cooking", "COOK", true],
    ["Nuts, seeds and grains", "PEANUT", true],
    ["Hobbies and crafts", "HOBBY", true],
    ["Meals and dishes", "DISH", true],
    ["Toys and games", "SANDBOX", false],
    ["At the seaside", "SUNBATHE", false],
    ["Mammals", "BEAVER", false],
  ];
  for (const [theme, word, want] of named)
    if (wsThemeClash(theme, word) !== want) fail(`rev 2 rule: ${theme} / ${word} should ${want ? "" : "not "}clash`);
  if (JSON.stringify(wsThemeForms("Nuts, seeds and grains").forms) !== JSON.stringify(["NUTS", "NUT", "SEEDS", "SEED", "GRAINS", "GRAIN"]))
    fail(`rev 2 rule: forms ${JSON.stringify(wsThemeForms("Nuts, seeds and grains").forms)}`);

  const t1 = performance.now();
  const { replacements } = buildRev2Replacements(bank);
  const committed2 = readFileSync(new URL("../src/lib/duel/wordSearchBankRev2.server.ts", import.meta.url), "utf8");
  if (rev2Source(replacements) !== committed2)
    fail("rev 2: wordSearchBankRev2.server.ts is not the seeded build (run bun scripts/word-search-bank.ts)");
  const perCat2 = new Map<string, number>();
  let ok2 = 0, unchanged = 0, replaced = 0;
  for (let i = 0; i < WORD_SEARCH_BANK.length; i++) {
    const b = WORD_SEARCH_BANK[i]!;
    const e = wordSearchEntry(i, 2);
    const p = wordSearchFromIndex(i, 2);
    perCat2.set(e.category, (perCat2.get(e.category) ?? 0) + 1);
    const list = WORD_SEARCH_CATEGORIES[e.category] ?? [];
    const g = e.grid.split("");
    const targets = e.placements.map((x) => x.word);
    const bankClash = b.placements.some((x) => wsThemeClash(b.category, x.word));
    if (e.category !== b.category) fail(`rev 2 grid ${i}: theme ${e.category} ≠ bank ${b.category}`);
    if (!bankClash && e !== b) fail(`rev 2 grid ${i}: a grid without a clash was replaced`);
    if (bankClash && e === b) fail(`rev 2 grid ${i}: a clashing grid was not replaced`);
    if (bankClash) replaced++;
    else unchanged++;
    const shortN = targets.filter((w) => w.length <= 5).length;
    const longN = targets.filter((w) => w.length >= 7).length;
    const fine =
      e.placements.length === 6 &&
      new Set(targets).size === 6 &&
      shortN >= 2 &&
      longN >= 2 &&
      e.placements.every(
        (x) => list.includes(x.word) && !wsThemeClash(e.category, x.word) && countInGrid(g, x.word) === 1 && x.cells.map((c) => g[c]).join("") === x.word,
      ) &&
      list.every((w) => targets.includes(w) || countInGrid(g, w) === 0) &&
      p.wordSearchRev === 2 &&
      JSON.stringify(p.wordLengths) === JSON.stringify(targets.map((w) => w.length));
    const stamped = { ...p, speedPar: 1, puzzleScoreRev: 1 } as PuzzleData;
    const finish = gradeAnswer(stamped, wsEncode(e.placements.map((x) => x.cells)), 90_000);
    const back = gradeAnswer(stamped, wsEncode(e.placements.map((x) => [...x.cells].reverse())), 0);
    const liveOk = e.placements.every((x) => checkWordSearchPath(e.placements, 10, x.cells, []).valid);
    if (fine && finish.isCorrect && finish.score >= 120 && back.isCorrect && liveOk) ok2++;
    else fail(`rev 2 grid ${i} (${e.category}): breaks a rule (${targets.join(",")})`);
  }
  for (const [c] of cats) if (perCat2.get(c) !== PER_CATEGORY) fail(`rev 2: ${c} has ${perCat2.get(c) ?? 0} grids`);
  const lost = cats
    .map(([c, w]) => ({ c, lost: w.filter((x) => wsThemeClash(c, x)), left: rev2Words(c) }))
    .filter((x) => x.lost.length);
  for (const x of lost) {
    const sh = x.left.filter((w) => w.length <= 5).length;
    const lg = x.left.filter((w) => w.length >= 7).length;
    if (x.left.length < 30 || sh < 4 || lg < 4) fail(`rev 2: ${x.c} runs short (${x.left.length} words, ${sh} short, ${lg} long)`);
  }
  const fewest = lost.reduce((m, x) => (x.left.length < m.left.length ? x : m), lost[0]!);
  console.log(
    `rev 2: ${ok2}/${WORD_SEARCH_BANK.length} dealt grids clean (${unchanged} bank grids unchanged, ${replaced} seeded replacements, rebuild ${rev2Source(replacements) === committed2 ? "identical" : "DIFFERENT"} in ${((performance.now() - t1) / 1000).toFixed(1)} s); ${lost.length} themes lose ${lost.reduce((n, x) => n + x.lost.length, 0)} words, fewest left ${fewest.left.length} (${fewest.c})`,
  );
}

// 7. Rev-1 identity: puzzles dealt on main before rev 2.
{
  type Entry = { scoreRev: number; answer: string; ms: number; score: number; isCorrect: boolean; correctCount: number | null; errors: number | null; extra: string };
  const fx = JSON.parse(
    gunzipSync(readFileSync(new URL("./fixtures/wordsearch-rev1-legacy.json.gz", import.meta.url))).toString("utf8"),
  ) as { cases: { puzzle: WordSearchPuzzleData & { puzzleScoreRev?: number }; entries: Entry[] }[] };
  let graded = 0;
  for (const [k, c] of fx.cases.entries()) {
    const i = WORD_SEARCH_BANK.findIndex((e) => e.grid === c.puzzle.grid);
    const { puzzleScoreRev, speedPar, ...stored } = c.puzzle as WordSearchPuzzleData & { puzzleScoreRev?: number; speedPar?: number };
    if (c.puzzle.wordSearchRev !== 1) fail(`rev-1 legacy ${k}: stored puzzle is not rev 1`);
    if (i < 0 || JSON.stringify(wordSearchFromIndex(i, 1)) !== JSON.stringify(stored))
      fail(`rev-1 legacy ${k}: bank grid ${i} under rev 1 is not the stored puzzle`);
    const { puzzleScoreRev: _d, ...unstamped } = c.puzzle;
    void puzzleScoreRev;
    void speedPar;
    for (const e of c.entries) {
      const g = gradeAnswer((e.scoreRev ? c.puzzle : unstamped) as PuzzleData, e.answer, e.ms);
      graded++;
      if (g.score !== e.score || g.isCorrect !== e.isCorrect || g.correctCount !== e.correctCount || g.errors !== e.errors || JSON.stringify(g.extra) !== e.extra)
        fail(`rev-1 legacy ${k} (${c.puzzle.category}) ms ${e.ms} rev ${e.scoreRev}: ${g.score} vs main ${e.score}`);
    }
  }
  console.log(`rev-1 identity: ${fx.cases.length} stored rev-1 puzzles rebuild from the bank, ${graded} answers grade identically`);
}

if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  console.log(`\nFAIL: ${failures.length} problems`);
  process.exit(1);
}
console.log("\nPASS: word lists, seeded bank, rev 2 stamp, legacy identity, chips, rev 2 theme rule, rev-1 identity");
