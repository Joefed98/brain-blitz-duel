/**
 * word-demos-check (the Word overhaul, 15 Nov 2026): the Word games' intro-demo runs (scripts/fixtures/word-demos.json,
 * `bun scripts/word-demos-record.ts`, scripts/word-demos-lib.ts) and the demo version rules.
 *
 *  1. The fixture holds one run for each of the nine Word games, recorded on today's intro example.
 *  2. Each run's example is the one practice deals today, on the stamps rooms deal (the dealt signature), and each run
 *     scores exactly what the server's grade (gradeAnswer, as a phone sends the drafts) says; a fresh play gives the same
 *     run, and every run is a demo worth showing (150 or more).
 *  3. The version rules: an older Word demo stops (the presentation revision and the dealt stamp), a demo recorded on the
 *     overhaul's revision and today's stamp plays, and other games' rules are unchanged.
 *  4. Nothing here saves a demo: no database client in the recorder or its library.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LIVE_DEAL } from "../src/lib/duel/dealSignature";
import { WORD_DEMO_STAMP, wordDemoStampOk } from "../src/lib/duel/wordDemoStamps";
import {
  LOOKOUT_DEPTH_PRESENTATION,
  ROUNDABOUT_DEPTH_PRESENTATION,
  FORAGE_DEPTH_PRESENTATION,
  WORD_BATCH_PRESENTATION,
  WORD_OVERHAUL_DEMOS,
  WORD_OVERHAUL_PRESENTATION,
  WORD_POLISH_PRESENTATION,
  WORDSMITH_PRESENTATION,
  puzzleInputDemoCompatible,
  puzzlePresentation,
} from "../src/components/puzzles/wordInput";
import { INTRO_EXAMPLE_ID } from "../src/lib/duel/puzzleDemo";
import { hashText } from "./puzzle-fairness/kit";
import { gradeSteps } from "./standard-lib";
import { DEMO_OPEN_CAP_MS, DEMO_OPEN_TYPES, WORD_DEMO_LEVEL, WORD_DEMO_TYPES, exampleStamps, playWordDemo, publicDigestOf, wordIntroExample, type WordDemoRun } from "./word-demos-lib";
import { splitPuzzle } from "../src/lib/duel/secrets";

let checks = 0;
const ok = (cond: unknown, message: string) => {
  assert.ok(cond, message);
  checks++;
};

// 1. The fixture.
const fixture = JSON.parse(readFileSync("scripts/fixtures/word-demos.json", "utf8")) as { level: string; runs: WordDemoRun[] };
ok(fixture.level === WORD_DEMO_LEVEL, "the fixture's runs are the near-perfect player's");
ok(JSON.stringify(fixture.runs.map((r) => r.type)) === JSON.stringify(WORD_DEMO_TYPES), "one run for each of the nine Word games, in order");
ok(WORD_DEMO_TYPES.every((t) => WORD_OVERHAUL_DEMOS.has(t)) && WORD_OVERHAUL_DEMOS.size === WORD_DEMO_TYPES.length, "the demo revision covers exactly the nine Word games");

// 2. Each run: today's example, today's stamps, the server's score.
for (const run of fixture.runs) {
  const t = run.type;
  ok(run.exampleId === INTRO_EXAMPLE_ID, `${t}: recorded on today's intro example (${INTRO_EXAMPLE_ID})`);
  const example = wordIntroExample(t);
  ok(hashText(JSON.stringify(example)) === run.exampleDigest, `${t}: the example practice deals today is the one the run played`);
  ok(JSON.stringify(exampleStamps(example)) === JSON.stringify(run.stamps), `${t}: the run's stamps are the example's`);
  ok(publicDigestOf(splitPuzzle(example).pub as typeof example) === run.publicDigest, `${t}: the served half's digest is the example's (the save script compares it)`);
  const field = WORD_DEMO_STAMP[t]!;
  ok(run.stamps[field] === LIVE_DEAL[t]?.[field], `${t}: ${field} ${run.stamps[field]} is the stamp rooms deal (${LIVE_DEAL[t]?.[field]})`);
  for (const [k, v] of Object.entries(run.stamps)) {
    if (LIVE_DEAL[t]?.[k] !== undefined) ok(LIVE_DEAL[t]![k] === v, `${t}: ${k} ${v} matches the dealt signature`);
  }
  ok(wordDemoStampOk(t, example), `${t}: the demo rule lets a run on today's stamp play`);
  const regraded = gradeSteps(example, run.steps, run.timed);
  ok(regraded.score === run.score, `${t}: the stored score ${run.score} is the server's grade (${regraded.score})`);
  ok(regraded.isCorrect === run.isCorrect, `${t}: the stored verdict is the server's`);
  ok(run.steps.length > 0 && run.steps.every((s, i) => i === 0 || s.atMs >= run.steps[i - 1]!.atMs), `${t}: drafts in round-clock order`);
  ok(run.score >= (DEMO_OPEN_TYPES.has(t) ? 60 : 150), `${t}: a demo worth showing (${run.score})`);
  if (DEMO_OPEN_TYPES.has(t)) ok(run.steps.every((s) => s.atMs <= DEMO_OPEN_CAP_MS) && run.steps.length >= 3, `${t}: an open game's demo is its first 30 s (${run.steps.length} moves)`);
  const again = playWordDemo(t);
  ok(JSON.stringify(again) === JSON.stringify(run), `${t}: a fresh play records the same run`);
}

// 3. The version rules.
const older = [WORD_POLISH_PRESENTATION, WORD_BATCH_PRESENTATION, ROUNDABOUT_DEPTH_PRESENTATION, FORAGE_DEPTH_PRESENTATION, LOOKOUT_DEPTH_PRESENTATION, "oct10-polish-a"];
for (const t of WORD_DEMO_TYPES) {
  ok(puzzlePresentation(t) === WORD_OVERHAUL_PRESENTATION, `${t}: the current presentation is the overhaul's`);
  ok(puzzleInputDemoCompatible(t, { presentation: WORD_OVERHAUL_PRESENTATION }), `${t}: a demo recorded on the overhaul plays`);
  ok(!puzzleInputDemoCompatible(t, {}), `${t}: an unstamped demo stops`);
  for (const p of older) ok(!puzzleInputDemoCompatible(t, { presentation: p }), `${t}: a ${p} demo stops`);
  const field = WORD_DEMO_STAMP[t]!;
  const dealt = LIVE_DEAL[t]![field]!;
  ok(!wordDemoStampOk(t, { type: t, [field]: dealt - 1 }), `${t}: a demo on ${field} ${dealt - 1} stops`);
  ok(!wordDemoStampOk(t, { type: t }), `${t}: an unstamped demo stops`);
  ok(wordDemoStampOk(t, { type: t, [field]: dealt }), `${t}: a demo on ${field} ${dealt} plays`);
}
ok(WORDSMITH_PRESENTATION === WORD_OVERHAUL_PRESENTATION, "Nucleus's presentation is the overhaul's");
for (const t of ["sudoku", "maze", "balance", "orbit", "wordfall"]) ok(wordDemoStampOk(t, { type: t }), `${t}: not a Word game, the Word stamp rule leaves it alone`);
for (const t of ["sudoku", "maze", "balance"]) ok(puzzlePresentation(t) !== WORD_OVERHAUL_PRESENTATION, `${t}: keeps its own presentation`);
const intro = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
ok(/if \(demo && !wordDemoStampOk\(data\.type, demo\.puzzle\)\) return null;/.test(intro), "the intro demo read applies the Word stamp rule");
ok(/demo\.puzzle\.strikeoutRev \?\? 0\) < STRIKEOUT_REV4\) return null;/.test(intro), "Strikeout demos before rev 4 still stop");

// 4. Nothing saved.
for (const file of ["scripts/word-demos-lib.ts", "scripts/word-demos-record.ts"]) {
  const src = readFileSync(file, "utf8");
  ok(!/supabase|createClient|saveIntroDemo|savePuzzle/i.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), `${file}: never touches a database`);
}

// 5. The save script (scripts/word-demos-save.ts): every game has a step player; without the URL or the key it saves
// nothing and exits 2; it never prints the key.
{
  const { STEP_PLAYERS } = await import("./word-demos-players");
  for (const t of WORD_DEMO_TYPES) ok(typeof STEP_PLAYERS[t]?.step === "function", `${t}: a step player for the save`);
  const { spawnSync } = await import("node:child_process");
  const run = (env: Record<string, string>, extra: string[] = []) => {
    const r = spawnSync(process.execPath, ["scripts/word-demos-save.ts", ...extra], {
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env },
      encoding: "utf8",
    });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const secret = "check-secret-4b7e";
  const noUrl = run({ INTRO_DEMO_KEY: secret });
  ok(noUrl.code === 2 && !noUrl.out.includes(secret), "save: no URL exits 2 and never prints the key");
  const noKey = run({ DEMOS_URL: "http://127.0.0.1:9" });
  ok(noKey.code === 2, "save: no key exits 2");
  const flagKey = run({}, [`--key=${secret}`]);
  ok(flagKey.code === 2 && !flagKey.out.includes(secret), "save: a key passed as a flag is never printed either");
  const src = readFileSync("scripts/word-demos-save.ts", "utf8");
  ok(/served deal isn't the fixture's intro example/.test(src) && /answer sent isn't the run's/.test(src), "save: refuses a deal or an answer that isn't the fixture's");
  ok(!/console\.log\([^)]*\bkey\b(?!\))/.test(src.replace(/demo key|the key|INTRO_DEMO_KEY|--key/g, "")), "save: no log line prints the key");
}

console.log(`PASS: word demos — ${checks} checks (${fixture.runs.map((r) => `${r.type} ${r.score}`).join(", ")})`);
