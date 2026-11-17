/**
 * curling-levels-check (~1 min): Curl Champ's four levels (the Sports overhaul, 16 Nov 2026;
 * docs/arcade-standard/curling.md "Levels").
 *
 *   1. The level registry (GAME_LEVELS.curling) agrees with the sim's CURL_LEVEL_REDS, CURL_LEVEL_AIDS and Easy's core
 *      figure (curlCoreFullFor), every level has its line (levelNotes.ts) on the intro and the help, and no level's
 *      clock is over 120 s (each plays curlRev 4's 120 s).
 *   2. Normal is byte for byte as before: 60 room deals and their starting states, and curlRev 1–4's starting states,
 *      hash to the digest recorded on the session head before the levels (scripts/curling-levels-digest.ts); a Normal
 *      deal carries no `level`, and curlingGameFor(4) with no level, "normal" or junk starts identically.
 *   3. Each level deals from its own bank: the level stamped, curlRev 4, a seed from that level's bank.
 *   4. Every bank entry starts with the level's red count, each red within its cm range (and the ranges' split: one red
 *      at most half way out, one beyond), and its witness (scripts/fixtures/curling-witness-levels.json) scores exactly
 *      200 through the server's replay at its level, unflagged; the same throws on any other level do not replay as a
 *      200 there with the wrong reds' checksum (a level's run is graded on its own sheet).
 *   5. The display rules per level (curlAidsFor): Easy zone + whole path, Normal and Hard zone + a third, Expert neither.
 *   6. Older stamps: curlRev 1–3 ignore a level (identical starting states), and the bank file matches the witnesses.
 */
import { readFileSync } from "node:fs";

import {
  CURL_LEVEL_AIDS,
  CURL_LEVEL_REDS,
  CURL_NORMAL_AIDS,
  CU,
  CURLING_REV,
  curlAidsFor,
  curlCoreFullFor,
  CURL_V4_CORE_FULL,
  curlingGameFor,
  type CurlLevel,
} from "../src/lib/arcade/curling";
import { replayCurlingRun } from "../src/lib/duel/curling";
import { CURLING_LEVEL_BANKS } from "../src/lib/duel/curlingLevelBanks.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/catalogue";
import { GAME_LEVELS, gameLevelSettings, levelsOf } from "../src/lib/levels/gameLevels";
import { levelNote } from "../src/lib/levels/levelNotes";
import { MAX_ROUND_CLOCK_MS } from "../src/lib/levels/levels";
import { roomSeed } from "./arcade-skill-bands/games";
import { witnessRaw, type WitnessV2 } from "./curling-bank";
import { normalDigest } from "./curling-levels-digest";

const { curlingPuzzle } = await import("../src/puzzles/curling");

/** Recorded on 58396e49 (the session head before the levels) by scripts/curling-levels-digest.ts. */
const NORMAL_DIGEST = "bf2e181c915f650edcbccf438becd7cdd092c2eb7afdd7d4e98d0c37ec7913ec";
const LEVELS: CurlLevel[] = ["easy", "hard", "expert"];

const failures: string[] = [];
let passes = 0;
function ok(cond: boolean, what: string): void {
  if (cond) passes++;
  else failures.push(what);
}

// 1. The registry.
ok(JSON.stringify(levelsOf("curling")) === JSON.stringify(["easy", "normal", "hard", "expert"]), "curling offers Easy, Normal, Hard and Expert");
for (const lv of LEVELS) {
  const s = gameLevelSettings<Record<string, unknown>>("curling", lv);
  const reds = CURL_LEVEL_REDS[lv];
  const aids = CURL_LEVEL_AIDS[lv];
  ok(!!s && s.reds === reds.reds && s.minCm === reds.minCm && s.maxCm === reds.maxCm, `${lv}: registry reds match the sim`);
  const line = aids.aimPart === 1 ? "full" : aids.aimPart === 3 ? "third" : "none";
  ok(!!s && s.houseZone === aids.houseZone && s.aimLine === line, `${lv}: registry aids match the sim`);
  const note = levelNote("curling", lv) ?? "";
  ok(note.startsWith(lv[0]!.toUpperCase() + lv.slice(1) + ":") && note.includes(["", "", "two", "", "four", "five"][reds.reds]!), `${lv}: its level line names the level and its reds`);
  ok(curlingPuzzle.introLine?.({ type: "curling", seed: 1, curlRev: CURLING_REV, level: lv } as never) === note, `${lv}: the intro shows the level line`);
  ok(curlCoreFullFor(lv) === ((s?.coreFull as number | undefined) ?? CURL_V4_CORE_FULL), `${lv}: the registry's core full figure matches the sim (${curlCoreFullFor(lv)})`);
  ok(GAME_LEVELS.curling?.levels[lv]?.oneSolution === undefined, `${lv}: an arcade level needs no uniqueness proof`);
}
ok(levelNote("curling", "normal") === null && curlingPuzzle.introLine?.({ type: "curling", seed: 1, curlRev: CURLING_REV } as never) === null, "Normal has no level line");
ok(curlCoreFullFor(undefined) === CURL_V4_CORE_FULL && curlCoreFullFor("normal") === CURL_V4_CORE_FULL, "Normal's core is full at 95, as before");
// An arcade run's clock is its run length (the definition's 3 s after the buzzer is not play), as difficulty-check reads it.
for (const lv of [undefined, ...LEVELS]) {
  const p = withSeededRandom(roomSeed(0), () => generatePuzzle("curling", { bankSeed: roomSeed(0), ...(lv ? { level: lv } : {}) }));
  ok(puzzleTimeLimitMs(p) - 3000 === MAX_ROUND_CLOCK_MS, `${lv ?? "normal"}: the round's clock is 120 s, the cap`);
}
for (const lv of LEVELS) ok(Math.round((curlingGameFor(4, lv).runTicks * 1000) / 60) === MAX_ROUND_CLOCK_MS, `${lv}: plays curlRev 4's 120 s run`);

// 2. Normal byte for byte.
ok(normalDigest() === NORMAL_DIGEST, "Normal's deals and starting states hash to the digest recorded before the levels");
for (let n = 0; n < 20; n++) {
  const seed = roomSeed(n);
  const p = withSeededRandom(seed, () => generatePuzzle("curling", { bankSeed: seed })) as unknown as Record<string, unknown>;
  ok(!("level" in p), `Normal deal ${n} carries no level`);
  const q = withSeededRandom(seed, () => generatePuzzle("curling", { bankSeed: seed, level: "normal" }));
  ok(JSON.stringify(q) === JSON.stringify(p), `Normal deal ${n}: asking for Normal deals the same`);
  const a = JSON.stringify(curlingGameFor(4).init(seed));
  ok(a === JSON.stringify(curlingGameFor(4, "normal").init(seed)) && a === JSON.stringify(curlingGameFor(4, "junk").init(seed)), `Normal start ${n}: a non-level is Normal`);
}

// 3. Each level deals from its own bank.
for (const lv of LEVELS) {
  const bank = new Set(CURLING_LEVEL_BANKS[lv]);
  ok(bank.size >= 20, `${lv}: the bank holds at least 20 sheets (${bank.size})`);
  for (let n = 0; n < 30; n++) {
    const seed = roomSeed(n);
    const p = withSeededRandom(seed, () => generatePuzzle("curling", { bankSeed: seed, level: lv })) as unknown as Record<string, unknown>;
    ok(p.level === lv && p.curlRev === CURLING_REV && bank.has(p.seed as number), `${lv} deal ${n}: stamped, curlRev 4, from its bank`);
  }
}

// 4. Every bank entry: its reds and its witness at 200.
const witnesses = JSON.parse(readFileSync(new URL("./fixtures/curling-witness-levels.json", import.meta.url), "utf8")) as Record<CurlLevel, WitnessV2[]>;
for (const lv of LEVELS) {
  const { reds, minCm, maxCm } = CURL_LEVEL_REDS[lv];
  const mid = (minCm + maxCm) >> 1;
  const byseed = new Map(witnesses[lv].map((w) => [w.seed, w]));
  ok(JSON.stringify(witnesses[lv].map((w) => w.seed)) === JSON.stringify(CURLING_LEVEL_BANKS[lv]), `${lv}: the bank is the witnesses' seeds, in order`);
  for (const seed of CURLING_LEVEL_BANKS[lv]) {
    const s = curlingGameFor(4, lv).init(seed);
    ok(s.lvl === lv, `${lv} ${seed}: the state carries its level`);
    ok(s.x.length === reds && s.live.every((l) => l === 1), `${lv} ${seed}: ${reds} reds (${s.x.length})`);
    const d = s.x.map((x, i) => Math.hypot(x / CU, s.y[i]! / CU));
    ok(d.every((v) => v >= minCm - 1e-9 && v <= maxCm + 1e-9), `${lv} ${seed}: every red ${minCm}–${maxCm} cm (${d.map((v) => v.toFixed(0)).join(", ")})`);
    ok(d[0]! <= mid && d[1]! > mid, `${lv} ${seed}: one red at most ${mid} cm, one beyond`);
    const w = byseed.get(seed);
    ok(!!w, `${lv} ${seed}: has a witness`);
    if (!w) continue;
    const r = replayCurlingRun(seed, witnessRaw(w, 4, lv), 4, lv);
    ok(!r.flagged && r.score === 200, `${lv} ${seed}: the witness scores 200 through the server replay (${r.flagged ? "flagged" : r.score})`);
  }
  // A level's run is its own sheet: the first witness graded as Normal is not a clean 200.
  const w0 = witnesses[lv][0]!;
  // (the replay logs the desync it finds; quiet for this one call)
  const quiet = console.error;
  console.error = () => {};
  const asNormal = replayCurlingRun(w0.seed, witnessRaw(w0, 4, lv), 4);
  console.error = quiet;
  ok(asNormal.flagged || asNormal.score !== 200 || JSON.stringify(curlingGameFor(4).init(w0.seed)) === JSON.stringify(curlingGameFor(4, lv).init(w0.seed)), `${lv}: a level's run graded without its level does not pass as the same run`);
}

// 5. The display rules.
ok(JSON.stringify(curlAidsFor(null)) === JSON.stringify(CURL_NORMAL_AIDS) && JSON.stringify(curlAidsFor("normal")) === JSON.stringify(CURL_NORMAL_AIDS), "Normal: zone and a third of the line");
ok(curlAidsFor("easy").houseZone && curlAidsFor("easy").aimPart === 1, "Easy: zone and the whole path");
ok(curlAidsFor("hard").houseZone && curlAidsFor("hard").aimPart === 3, "Hard: zone and a third of the line");
ok(!curlAidsFor("expert").houseZone && curlAidsFor("expert").aimPart === 0, "Expert: no zone, no line");

// 6. Older stamps ignore a level.
for (let n = 0; n < 10; n++) {
  const seed = roomSeed(n);
  for (const rev of [1, 2, 3]) {
    const a = JSON.stringify(curlingGameFor(rev).init(seed));
    ok(LEVELS.every((lv) => JSON.stringify(curlingGameFor(rev, lv).init(seed)) === a), `curlRev ${rev} start ${n}: a level changes nothing`);
  }
}
const bankText = readFileSync(new URL("../src/lib/duel/curlingLevelBanks.server.ts", import.meta.url), "utf8");
ok(LEVELS.every((lv) => bankText.includes(`${lv}: [${CURLING_LEVEL_BANKS[lv].join(",")}]`)), "the bank file lists the witnesses' seeds");

if (failures.length) {
  console.log(`curling-levels-check: FAIL (${failures.length} of ${passes + failures.length})`);
  for (const f of failures.slice(0, 40)) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`curling-levels-check: OK (${passes} checks)`);
