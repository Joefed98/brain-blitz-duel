/**
 * practice-bests-check (17 Oct 2026): personal bests in practice (presentation only;
 * src/lib/duel/practiceBest.ts, practiceStamps.ts, src/routes/practice.tsx, NewBestMoment).
 *
 *  1. The stamp table is current: every registered game is dealt again (scripts/practice-stamps.ts)
 *     and its version-stamp signature matches PRACTICE_STAMPS, the same from three bank seeds.
 *  2. stampSignature reads only top-level version stamps (…Rev, …Version, speedPar), sorted, and
 *     changes when any stamp changes.
 *  3. The best only ever rises: a first run records it without "New best!"; a lower or equal score
 *     leaves it and is not a new best; a higher one replaces it and is. Random runs agree with a
 *     plain running maximum.
 *  4. A new version starts afresh: the same game under other stamps has no best, its first run is
 *     not a new best, and the old version's best is untouched. Bests kept before stamps (the old
 *     unversioned key) are never read.
 *  5. Blocked or failing storage: practice still works for the session; bad scores are ignored.
 *  6. The wiring (the card's best is aria-hidden and only describes the button, whose accessible
 *     name stays exactly the game's, as the browser checks find it): practice records and reads under the dealt puzzle's own stamps, the list's cards
 *     read the current stamps, intro-example runs are never recorded, the reveal's moment shows only
 *     in practice on a new best, uses an existing cue, and is skipped with reduced motion or effects;
 *     room code never imports the practice record.
 *
 *   bun scripts/practice-bests-check.ts
 */
import { readFileSync } from "node:fs";

import { buildPracticeStamps, practiceStampsSource } from "./practice-stamps";
import { PRACTICE_BEST_PREFIX, RETIRED_PRACTICE_BEST_PREFIXES, practiceBestKey, readPracticeBest, recordPracticeBest } from "../src/lib/duel/practiceBest";
import { PRACTICE_STAMPS } from "../src/lib/duel/practiceStamps.data";
import { currentPracticeStamp, stampSignature } from "../src/lib/duel/practiceStamps";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else if (failures.length < 40) failures.push(message);
}

/* A device's storage: a plain map, which can be made to throw. */
const store = new Map<string, string>();
let blocked = false;
const localStorage = {
  getItem: (k: string) => {
    if (blocked) throw new Error("blocked");
    return store.get(k) ?? null;
  },
  setItem: (k: string, v: string) => {
    if (blocked) throw new Error("blocked");
    store.set(k, v);
  },
  removeItem: (k: string) => void store.delete(k),
};
(globalThis as unknown as { window: unknown }).window = { localStorage };

/* 1. The table is current. */
{
  const { table, problems } = buildPracticeStamps();
  for (const p of problems) check(false, p);
  check(
    practiceStampsSource(table) === readFileSync("src/lib/duel/practiceStamps.data.ts", "utf8"),
    "src/lib/duel/practiceStamps.data.ts is out of date: run bun scripts/practice-stamps.ts",
  );
  check(Object.keys(PRACTICE_STAMPS).length >= 74, `the table lists every game (${Object.keys(PRACTICE_STAMPS).length})`);
  for (const [type, sig] of Object.entries(PRACTICE_STAMPS)) {
    check(currentPracticeStamp(type) === sig, `${type}: currentPracticeStamp reads the table`);
    check(/speedPar=1/.test(sig), `${type}: its stamps include speedPar (${sig})`);
  }
  check(currentPracticeStamp("no-such-game") === "", "an unknown game has the empty signature");
}

/* 2. stampSignature. */
{
  const a = stampSignature({ type: "hover", seed: 5, hoverRev: 5, speedPar: 1, puzzleScoreRev: 1, timeLimitMs: 60000 });
  check(a === "hoverRev=5 puzzleScoreRev=1 speedPar=1", `signature sorted, stamps only (got "${a}")`);
  check(stampSignature({ type: "bomb", bombVersion: 3, rulesVersion: 2, seed: 1 }) === "bombVersion=3 rulesVersion=2", "…Version fields count");
  check(stampSignature({ type: "x", seed: 4, par: 82, minMoves: 3, tier: 3 }) === "", "seeds, pars and sizes are not stamps");
  check(stampSignature({ type: "hover", hoverRev: 6, speedPar: 1 }) !== stampSignature({ type: "hover", hoverRev: 5, speedPar: 1 }), "a changed stamp changes the signature");
  check(stampSignature({ type: "x", fooRev: "2" }) === "", "only numeric stamps");
}

/* 3. The best only rises; a first run is never "New best!". */
{
  store.clear();
  const s = "hoverRev=5 puzzleScoreRev=1 speedPar=1";
  check(readPracticeBest("hover", s) === null, "no best before a first run");
  let r = recordPracticeBest("hover", s, 90);
  check(r.best === 90 && !r.improved, `first run: best 90, not a new best (${JSON.stringify(r)})`);
  r = recordPracticeBest("hover", s, 80);
  check(r.best === 90 && !r.improved, `lower: best stays 90, not a new best (${JSON.stringify(r)})`);
  r = recordPracticeBest("hover", s, 90);
  check(r.best === 90 && !r.improved, `equal: not a new best (${JSON.stringify(r)})`);
  r = recordPracticeBest("hover", s, 132);
  check(r.best === 132 && r.improved, `higher: best 132, a new best (${JSON.stringify(r)})`);
  check(readPracticeBest("hover", s) === 132, "the best reads back");
  r = recordPracticeBest("hover", s, 0);
  check(r.best === 132 && !r.improved, "a zero never lowers it");
  // A first run that scores 0 still records a best of 0, so a later 1 is a new best.
  store.clear();
  r = recordPracticeBest("flood", "floodRev=2 speedPar=1", 0);
  check(r.best === 0 && !r.improved, "a first run of 0 records 0, not a new best");
  r = recordPracticeBest("flood", "floodRev=2 speedPar=1", 1);
  check(r.best === 1 && r.improved, "then 1 is a new best");

  // Random runs against a running maximum.
  let seed = 1017;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let t = 0; t < 200; t++) {
    store.clear();
    const type = `game${t}`;
    let max: number | null = null;
    for (let i = 0; i < 20; i++) {
      const score = Math.floor(rand() * 151);
      const out = recordPracticeBest(type, "speedPar=1", score);
      const improved = max !== null && score > max;
      max = max === null ? score : Math.max(max, score);
      if (out.best !== max || out.improved !== improved) {
        check(false, `random run ${t}.${i}: score ${score} gave ${JSON.stringify(out)}, want best ${max} improved ${improved}`);
        break;
      }
    }
    check(readPracticeBest(type, "speedPar=1") === max, `random run ${t}: stored best ${max}`);
  }
}

/* 4. A new version starts afresh; old keys are never read. */
{
  store.clear();
  const v5 = "hoverRev=5 puzzleScoreRev=1 speedPar=1";
  const v6 = "hoverRev=6 puzzleScoreRev=1 speedPar=1";
  recordPracticeBest("hover", v5, 140);
  check(readPracticeBest("hover", v6) === null, "a new version has no best");
  const first = recordPracticeBest("hover", v6, 60);
  check(first.best === 60 && !first.improved, `a new version's first run is not a new best (${JSON.stringify(first)})`);
  check(readPracticeBest("hover", v5) === 140, "the older version's best is untouched");
  const next = recordPracticeBest("hover", v6, 61);
  check(next.improved && next.best === 61, "the new version compares only with itself");
  store.set("duelz-practice-best:snake", "150");
  check(readPracticeBest("snake", "snakeRev=6 puzzleScoreRev=1 speedPar=1") === null, "an unversioned (pre-stamp) best is never read");
  const fresh = recordPracticeBest("snake", "snakeRev=6 puzzleScoreRev=1 speedPar=1", 20);
  check(!fresh.improved && fresh.best === 20, "and never makes a first run look like a lower score");
}

/* 5. Blocked storage and bad scores. */
{
  store.clear();
  blocked = true;
  const s = "tiltRev=4 speedPar=1";
  const a = recordPracticeBest("tilt", s, 50);
  const b = recordPracticeBest("tilt", s, 70);
  check(!a.improved && b.improved && b.best === 70, "blocked storage: the session keeps the best");
  check(readPracticeBest("tilt", s) === 70, "blocked storage: reads the session's best");
  blocked = false;
  for (const bad of [NaN, -1, Infinity]) {
    const r = recordPracticeBest("tilt", s, bad);
    check(!r.improved && r.best === 70, `a bad score (${bad}) changes nothing`);
  }
  store.set(practiceBestKey("slice", "speedPar=1"), "junk");
  check(readPracticeBest("slice", "speedPar=1") === null, "a corrupt stored value reads as no best");
}

/* 5b. Bests v3 (25 Oct 2026, the 200-point foundation): every device's bests start fresh once; v2 is kept, never read. */
{
  store.clear();
  check(PRACTICE_BEST_PREFIX === "duelz-practice-best:v3:" && !RETIRED_PRACTICE_BEST_PREFIXES.includes(PRACTICE_BEST_PREFIX as never), "bests are stored under the v3 prefix");
  const games = Object.keys(PRACTICE_STAMPS).slice(0, 12);
  // A device from before the switch: a v2 best (and an older unversioned one) for every game under today's stamps.
  for (const [i, type] of games.entries()) {
    store.set(`duelz-practice-best:v2:${type}@${currentPracticeStamp(type)}`, String(148 - i));
    store.set(`duelz-practice-best:${type}`, "150");
  }
  const before = new Map(store);
  for (const type of games) check(readPracticeBest(type, currentPracticeStamp(type)) === null, `${type}: an old v2 best is not read after the switch (no best until a new run)`);
  for (const [i, type] of games.entries()) {
    const run = recordPracticeBest(type, currentPracticeStamp(type), 40 + i);
    check(run.best === 40 + i && !run.improved, `${type}: the first run after the switch is the best, never a "New best!" over an old one`);
    check(store.get(practiceBestKey(type, currentPracticeStamp(type))) === String(40 + i), `${type}: the new best is written under v3`);
  }
  for (const [key, value] of before) check(store.get(key) === value, `old data is left as it was (${key})`);
  check(games.every((type) => practiceBestKey(type, currentPracticeStamp(type)).startsWith(PRACTICE_BEST_PREFIX)), "every key the app reads is a v3 key");
  const src = readFileSync("src/lib/duel/practiceBest.ts", "utf8");
  check(!/removeItem|\.clear\(/.test(src), "the switch deletes nothing");
  check((src.match(/getItem\(/g) ?? []).length === 1 && /const PREFIX = PRACTICE_BEST_PREFIX;/.test(src), "the only read is under the v3 prefix");
}

/* 6. The wiring. */
{
  const practice = readFileSync("src/routes/practice.tsx", "utf8");
  check(/recordPracticeBest\(puzzle\.type, stampSignature\(puzzle\), result\.score\)/.test(practice), "practice records under the dealt puzzle's stamps");
  check(/if \(!wasExample\) \{\s*const record = recordPracticeBest/.test(practice), "intro-example runs are never recorded");
  check(/readPracticeBest\(next, stampSignature\(made\.puzzle/.test(practice), "the intro reads the dealt puzzle's best");
  check(/function RowBest[\s\S]*?readPracticeBest\(type, currentPracticeStamp\(type\)\)/.test(practice), "the list's rows read the current stamps");
  // Category lists (tab pages refresh, 26 Oct 2026): every list draws one row (row(key…)), which carries the best in
  // the BEST column and its description.
  check((practice.match(/<RowBest type=\{key\} \/>/g) ?? []).length === 1 && /rows\.map\(\(key\) => row\(key\)\)/.test(practice) && /previewRows\.map\(\(key\) => row\(key\)\)/.test(practice) && /retiredRows\.map\(\(key\) => row\(key, true\)\)/.test(practice), "every practice row shows its best (category lists, preview, retired)");
  check(/\{best \?\? "–"\}/.test(practice) && /data-none=\{best === null \|\| undefined\}/.test(practice), 'a row with no best shows a quiet "–"');
  check(/className="ap-best"/.test(practice) && /\.ap-best \{[^}]*width: 56px;[^}]*text-align: right;/.test(readFileSync("src/polish-layout/app-pages.css", "utf8")), "the best sits in one fixed-width right-aligned BEST column");
  // 17 Oct 2026 (CI on #108): the best inside the button changed its accessible name ("Grappler Best 45"), so
  // arcade-play-check and arcade-lowend-check, which reopen the list and find each game's button by its exact
  // name, lost multi-segment games after their first run. The best is now only the button's description.
  check(/id=\{cardBestId\(type\)\}\s*aria-hidden="true"/.test(practice), "the card's best is left out of the button's name");
  check((practice.match(/aria-describedby=\{cardBestId\(key\)\}/g) ?? []).length === 1 && /aria-label=\{PUZZLE_REGISTRY\[key\]\.name\}/.test(practice), "every card's button is named its game and described by its best");

  const reveal = readFileSync("src/components/duel/AnswerReveal.tsx", "utf8");
  check(/\{practice && personalBest && myScore !== null \? <NewBestMoment \/> : null\}/.test(reveal), "the moment shows only in practice, on a new best, once the score is in");
  check(/personalBest=\{practice \? false : undefined\}/.test(reveal), "arcade practice gets the same moment, not a second celebration");
  check(/personalBest=\{newBest\}/.test(practice), "practice passes its own verdict");

  const moment = readFileSync("src/components/duel/NewBestMoment.tsx", "utf8");
  const cue = /soundCue\("([^"]+)"\)/.exec(moment)?.[1];
  check(!!cue && cue in SOUND_MANIFEST && !!(SOUND_MANIFEST as Record<string, { url: string | null }>)[cue]?.url, `the moment plays an existing cue with a file (${cue})`);
  check(/prefersReducedMotion\(\) \|\| arcadeReducedEffects\(\)/.test(moment) && /if \(calm\.current\) return null;/.test(moment) && /if \(calm\.current\) return;\s*const timer/.test(moment),
    "reduced motion or reduced effects skip the moment and its sound");
  check(/pointer-events-none absolute/.test(moment), "the moment is laid over the reveal (nothing moves)");

  for (const file of ["src/routes/duel.$code.tsx", "src/lib/duel/duel.functions.ts", "src/lib/duel/grade.ts", "src/lib/duel/scoring.ts"]) {
    check(!/practiceBest/.test(readFileSync(file, "utf8")), `${file} never touches the practice record`);
  }
}

console.log(`practice-bests-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`FAIL: ${f}`);
  process.exit(1);
}
console.log("PASS: practice bests are kept per game and stamps, only rise, never celebrate a first run, and the reveal's moment is practice-only and calm-aware");
