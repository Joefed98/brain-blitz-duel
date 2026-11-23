/**
 * sports-demos-check (the Sports overhaul, 15 Nov 2026; ~1 s, no browser): Cue Ball, Curl Champ and Apex's saved intro
 * demos play only when recorded on the stamp rooms deal today (poolRev 4, curlRev 4, racingRev 4), so a demo recorded
 * before the overhaul (the old table, sheet or road, Curl Champ's older buttons, Apex's single circuit) never plays under
 * the new look. Read from the server's own rule in src/lib/duel/introDemo.functions.ts, as each game's check reads its own.
 *
 * The demos themselves (the merge captain's demo pattern, 15 Nov 2026): scripts/fixtures/sports-demos.json holds one row
 * per game exactly as upsertIntroDemo stores it (written by scripts/sports-demos-record.ts), for the "Save intro demos"
 * workflow to save after the final merge. Each must be on the stamp rooms deal, pass the demo rule above, carry its own
 * run's seed, fit the demo's size limit, and score exactly its stored score through the server's own replay, unflagged.
 *
 *   bun scripts/sports-demos-check.ts
 */
import { readFileSync } from "node:fs";

import { POOL_REV } from "../src/lib/arcade/pool";
import { CURLING_REV } from "../src/lib/arcade/curling";
import { RACING_REV_4, RACING_REV_DEALT } from "../src/lib/arcade/racing";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { DEMO_LENGTH_TICKS, DEMO_MAX_CHARS, DEMO_START_TICK, runSeed } from "../src/lib/arcade/introDemo";
import { replayPoolRun } from "../src/lib/duel/pool";
import { replayCurlingRun } from "../src/lib/duel/curling";
import { replayRacingRun } from "../src/lib/duel/racing";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { exampleFor } from "./shots/examples";
import { pinPrePoolFifth } from "../src/lib/duel/d6Normal";

// Changed with Joe's approval, 23 Nov 2026 (D6): Cue Ball's Normal moved to poolRev 5 (Speed from the fifth pot); this check was written for poolRev 4, so it deals it (d6-normal-stamps-check proves poolRev 5).
pinPrePoolFifth(true);

const failures: string[] = [];
let passes = 0;
const ok = (cond: boolean, line: string) => {
  if (cond) {
    passes++;
    console.log(`  ok ${line}`);
  } else {
    failures.push(line);
    console.log(`  FAIL ${line}`);
  }
};

const src = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
const live = LIVE_BANDS as Record<string, { rev?: number } | undefined>;
const RULES: [string, string, string, number][] = [
  ["pool", "poolRev", "POOL_REV", POOL_REV],
  ["curling", "curlRev", "CURLING_REV", CURLING_REV],
  ["racing", "racingRev", "RACING_REV_DEALT", RACING_REV_DEALT],
];
for (const [type, field, name, rev] of RULES) {
  const rule = `if (data.type === "${type}" && demo?.puzzle.type === "${type}" && demo.puzzle.${field} !== ${name}) return null;`;
  ok(src.includes(rule), `${type}: the intro demo plays only when recorded on ${field} ${rev} (${name})`);
  ok(live[type]?.rev === rev, `${type}: ${name} is the stamp rooms deal (LIVE_BANDS ${live[type]?.rev})`);
}
ok(RACING_REV_DEALT === RACING_REV_4, "Apex: the demo's stamp is racingRev 4, the three circuits");

// The demos to save.
type Row = { game_type: string; seed: number; puzzle: Record<string, unknown>; input_log: { run: string }; start_tick: number; length_ticks: number; score: number };
const fixture = JSON.parse(readFileSync("scripts/fixtures/sports-demos.json", "utf8")) as { demos: Row[] };
const REPLAY: Record<string, (seed: number, raw: string, rev: number) => { score: number; flagged: boolean }> = {
  pool: replayPoolRun,
  curling: replayCurlingRun,
  racing: replayRacingRun,
};
const KEYS = ["game_type", "seed", "puzzle", "input_log", "start_tick", "length_ticks", "score"].sort().join();
ok(fixture.demos.map((d) => d.game_type).sort().join() === RULES.map(([t]) => t).sort().join(), "one demo for each of Cue Ball, Curl Champ and Apex");
for (const [type, field, , rev] of RULES) {
  const d = fixture.demos.find((x) => x.game_type === type);
  if (!d) continue;
  ok(Object.keys(d).sort().join() === KEYS && Object.keys(d.input_log).join() === "run", `${type}: the row is the stored shape (upsertIntroDemo's columns, input_log { run }) plus its score`);
  ok(d.puzzle["type"] === type && d.puzzle[field] === rev, `${type}: dealt on ${field} ${rev}, the stamp rooms deal, so the demo rule plays it`);
  // saveIntroDemoFn takes only a run on a deal the server sealed: the intro example (practiceGenerateFn, example: true),
  // which deals exactly as exampleFor does (the bank's example, else the example seed's live deal).
  const canon = (v: unknown): string =>
    Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(v);
  ok(canon(d.puzzle) === canon(splitPuzzle(exampleFor(type as never)).pub), `${type}: the puzzle is exactly the intro example deal the server seals (practiceGenerateFn, example)`);
  ok(d.seed === runSeed(d.input_log.run) && d.seed === Number(d.puzzle["seed"]), `${type}: the row's seed is its run's and its puzzle's (${d.seed})`);
  ok(d.start_tick === DEMO_START_TICK && d.length_ticks === DEMO_LENGTH_TICKS, `${type}: the demo's window is the intro's (${d.start_tick} + ${d.length_ticks} ticks)`);
  ok(d.input_log.run.length > 0 && d.input_log.run.length <= DEMO_MAX_CHARS, `${type}: the run fits the demo limit (${d.input_log.run.length} of ${DEMO_MAX_CHARS} chars)`);
  const r = REPLAY[type]!(Number(d.puzzle["seed"]), d.input_log.run, rev);
  ok(!r.flagged && r.score === d.score, `${type}: the server's replay scores it ${r.score} (stored ${d.score}), unflagged`);
}

if (failures.length) {
  console.log(`FAIL sports-demos-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`PASS sports-demos-check: ${passes} checks`);
