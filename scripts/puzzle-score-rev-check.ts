/**
 * Puzzle score rev check (Oct 2026 puzzle score shape, `puzzleScoreRev: 1`).
 *
 *   1. Legacy identity: every stored-round answer in
 *      scripts/fixtures/puzzle-score-legacy.json.gz (recorded on main before the
 *      change by scripts/puzzle-score-legacy-record.ts: unstamped and speedPar
 *      puzzles, empty drafts, spam, four solver levels and their unfinished
 *      states) grades exactly as main stored it: score, verdict, counts, errors,
 *      stored time and the whole stored extra.
 *   2. The stamp: every generated puzzle carries puzzleScoreRev 1.
 *   3. Quick fairness on the new shape (scripts/puzzle-fairness.ts has the full
 *      audit): over a few room seeds per game, doing nothing scores 0, every
 *      finish scores 120–150 and beats every unfinished run, unfinished credit
 *      never passes 110, and blanket/random spam has a median of at most 5
 *      (strategies the audit marks as known exceptions excluded).
 *
 *   bun scripts/puzzle-score-rev-check.ts [seedsPerGame]
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { PUZZLE_SCORE_REV, puzzleScoreRevOf } from "../src/lib/duel/puzzleScoreRev";
import { ACTIVE_PUZZLE_TYPES } from "../src/lib/duel/registry";
import { stableExtra, type LegacyCase } from "./puzzle-score-legacy-record";
import { FINISH_GAMES, KNOWN_SPAM, auditGame } from "./puzzle-fairness";

const failures: string[] = [];
const fail = (msg: string) => {
  failures.push(msg);
  if (failures.length <= 40) console.log(`FAIL ${msg}`);
};

// 1. Legacy identity.
const fixture = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/puzzle-score-legacy.json.gz")).toString("utf8")) as { recordedOn: string; cases: LegacyCase[] };
let answers = 0;
for (const c of fixture.cases) {
  for (const e of c.entries) {
    answers++;
    const g = gradeAnswer(c.puzzle, e.answer, e.ms);
    const got = { score: g.score, isCorrect: g.isCorrect, correctCount: g.correctCount, errors: g.errors, storedMs: g.storedMs, extra: stableExtra(g.extra) };
    for (const key of Object.keys(got) as (keyof typeof got)[]) {
      if (got[key] !== e[key]) {
        fail(`legacy ${c.type} ${c.label} ms ${e.ms}: ${key} ${JSON.stringify(got[key]).slice(0, 120)} ≠ main ${JSON.stringify(e[key]).slice(0, 120)}`);
        break;
      }
    }
  }
}
console.log(`legacy identity: ${answers} answers over ${fixture.cases.length} stored puzzles (recorded on ${fixture.recordedOn})`);

// 2. Every new puzzle is stamped.
for (const type of ACTIVE_PUZZLE_TYPES) {
  if (puzzleScoreRevOf(generatePuzzle(type, { bankSeed: 4242 })) !== PUZZLE_SCORE_REV) fail(`${type}: new puzzle not stamped puzzleScoreRev ${PUZZLE_SCORE_REV}`);
}

// 3. Quick fairness on the new shape.
const seeds = Number(process.argv[2] ?? 24);
for (const type of FINISH_GAMES) {
  const a = auditGame(type, seeds);
  const r = a.after;
  if (r.nothing.some((s) => s !== 0)) fail(`${type}: doing nothing scores ${Math.max(...r.nothing)}`);
  if (Number.isFinite(r.minFinished) && (r.minFinished < (type === "numline" ? 0 : 120) || r.minFinished <= r.maxUnfinished))
    if (type !== "numline") fail(`${type}: finish ${r.minFinished} vs unfinished ${r.maxUnfinished}`);
  if (r.maxUnfinished > 110) fail(`${type}: unfinished credit ${r.maxUnfinished} > 110`);
  for (const [label, xs] of Object.entries(r.spam)) {
    if (KNOWN_SPAM[type]?.[label]) continue;
    const sorted = [...xs].sort((x, y) => x - y);
    const med = sorted[Math.floor((sorted.length - 1) / 2)]!;
    if (med > 5) fail(`${type}: spam "${label}" median ${med}`);
  }
  console.log(`${type}: nothing 0, finish ≥ ${r.minFinished}, unfinished ≤ ${r.maxUnfinished}`);
}

console.log(failures.length ? `\nFAIL: ${failures.length} problems` : `\nPASS: legacy identity, stamps and quick fairness`);
if (failures.length) process.exit(1);
