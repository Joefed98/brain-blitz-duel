/**
 * sports-demos-check (the Sports overhaul, 15 Nov 2026; ~1 s, no browser): Cue Ball, Curl Champ and Apex's saved intro
 * demos play only when recorded on the stamp rooms deal today (poolRev 4, curlRev 4, racingRev 4), so a demo recorded
 * before the overhaul (the old table, sheet or road, Curl Champ's older buttons, Apex's single circuit) never plays under
 * the new look. Read from the server's own rule in src/lib/duel/introDemo.functions.ts, as each game's check reads its own.
 *
 *   bun scripts/sports-demos-check.ts
 */
import { readFileSync } from "node:fs";

import { POOL_REV } from "../src/lib/arcade/pool";
import { CURLING_REV } from "../src/lib/arcade/curling";
import { RACING_REV_4, RACING_REV_DEALT } from "../src/lib/arcade/racing";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";

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

if (failures.length) {
  console.log(`FAIL sports-demos-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`PASS sports-demos-check: ${passes} checks`);
