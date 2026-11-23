/**
 * strategy-demos-check (the Strategy overhaul, stage 3, 16 Nov 2026): the intro demos in scripts/fixtures/strategy-demos.json
 * (built by `bun scripts/strategy-demos-record.ts`) are ready to save.
 *
 *  - one demo for each of Tilt, Gemstone, Coral Pop, Rainbow Bridge and Ball Tracker;
 *  - each demo's puzzle is exactly the public half of the game's intro example deal (the fixed-seed Normal deal
 *    `practiceGenerateFn` gives with `example: true`, the only deal `saveIntroDemoFn` takes a run on), on the stamp rooms
 *    deal and at Normal (no `level` field);
 *  - each run scores exactly what the server's replay says (`gradeAnswer` on the example deal), the run is not flagged,
 *    and it fits the demo allowance;
 *  - the demo version rules (`getIntroDemoFn`, src/lib/duel/introDemo.functions.ts) accept each demo's stamp, so a demo
 *    recorded on an older stamp, or at another level, stays stopped.
 */
import { readFileSync } from "node:fs";

import { gradeAnswer } from "../src/lib/duel/generate.server";
import { DEMO_MAX_CHARS, DEMO_LENGTH_TICKS, runSeed } from "../src/lib/arcade/introDemo";
import { dealtSignature } from "../src/lib/duel/dealSignature";
import { DEMOS_FIXTURE, STRATEGY_DEMO_TYPES, exampleDeal, type DemoEntry } from "./strategy-demos-record";
import { pinPreTiltThree } from "../src/lib/duel/d6Normal";

// Changed with Joe's approval, 23 Nov 2026 (D6): Tilt's Normal moved to tiltRev 13 (three mazes); this check was written for tiltRev 12, so it deals it (d6-normal-stamps-check proves tiltRev 13).
pinPreTiltThree(true);

let failed = 0;
let passed = 0;
function ok(cond: boolean, label: string): void {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  ✗ ${label}`);
  }
}

/** Stable JSON (sorted keys), so two equal deals compare equal whatever their key order. */
function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const demos = JSON.parse(readFileSync(DEMOS_FIXTURE, "utf8")) as DemoEntry[];
ok(demos.length === STRATEGY_DEMO_TYPES.length && STRATEGY_DEMO_TYPES.every((t) => demos.some((d) => d.type === t)), `one demo for each Strategy game (${demos.map((d) => d.type).join(", ")})`);

const rules = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
for (const demo of demos) {
  const { full, pub } = exampleDeal(demo.type);
  ok(canon(demo.puzzle) === canon(pub), `${demo.type}: the demo's puzzle is exactly the intro example deal's public half`);
  ok(!("level" in demo.puzzle), `${demo.type}: the example deal is Normal (no level)`);
  // The stamp rooms deal: the example deal carries the game's live stamps.
  const sig = dealtSignature(demo.type);
  const stamps = sig.split(" ").filter(Boolean);
  ok(stamps.every((kv) => { const [k, v] = kv.split("="); return String((demo.puzzle as Record<string, unknown>)[k!]) === v; }), `${demo.type}: on the stamps rooms deal (${sig})`);
  const graded = gradeAnswer(full, demo.run, 0);
  ok(graded.score === demo.score, `${demo.type}: the run scores exactly what the server's replay says (${graded.score} = ${demo.score})`);
  ok(!(graded.extra as Record<string, unknown> | undefined)?.["flagged"], `${demo.type}: the server's replay doesn't flag the run`);
  ok(demo.score > 0, `${demo.type}: the demo plays (scores ${demo.score})`);
  ok(demo.run.length > 0 && demo.run.length <= DEMO_MAX_CHARS, `${demo.type}: the run fits the demo allowance (${demo.run.length} chars)`);
  ok(runSeed(demo.run) === Number((demo.puzzle as Record<string, unknown>)["seed"]), `${demo.type}: the run's seed is the deal's`);
  const ticks = Number(demo.run.split("~")[0]!.split("|")[3]);
  ok(ticks >= DEMO_LENGTH_TICKS, `${demo.type}: the run covers the demo's ${DEMO_LENGTH_TICKS} ticks (${ticks})`);
}

// The version rules: each game's rule names today's stamp, and a demo at another level never plays.
ok(/data\.type === "tilt" && demo\?\.puzzle\.type === "tilt" && demo\.puzzle\.tiltRev !== TILT_REV_BIG/.test(rules), "Tilt: only a tiltRev 12 demo plays");
ok(/data\.type === "matchup" && demo\?\.puzzle\.type === "matchup" && demo\.puzzle\.matchupRev !== MATCHUP_REV_ICE2/.test(rules), "Gemstone: only a matchupRev 13 demo plays");
ok(/data\.type === "bubble" && demo\?\.puzzle\.type === "bubble" && demo\.puzzle\.bubbleRev !== BUB_REV_FAST/.test(rules), "Coral Pop: only a bubbleRev 12 demo plays");
ok(/data\.type === "inkbridge" && demo\?\.puzzle\.type === "inkbridge" && demo\.puzzle\.inkRev !== INK_REV_HILLS/.test(rules), "Rainbow Bridge: only an inkRev 15 demo plays");
ok(/data\.type === "balltrack" && demo\?\.puzzle\.type === "balltrack" && !btIsV7Play\(demo\.puzzle\.btRev\)/.test(rules), "Ball Tracker: only a btRev 7+ demo plays");
ok(/STRATEGY_DEMO_GAMES\.has\(data\.type\) && demo && puzzleLevel\(demo\.puzzle\) !== NORMAL\) return null/.test(rules), "a Strategy demo dealt at another level than Normal never plays");

// The save script: refuses a deal that isn't the fixture's, never prints the key, the agreed exits.
const save = readFileSync("scripts/strategy-demos-save.ts", "utf8");
ok(/canon\(deal\.puzzle\) !== canon\(demo\.puzzle\)/.test(save), "the save script refuses unless the server's deal matches the fixture exactly");
ok(/process\.exit\(2\)/.test(save) && /process\.exit\(any \? 1 : 0\)/.test(save), "the save script exits 2 without a URL or key, 1 on any failure, 0 when all saved");
ok(!/console\.(log|error)\([^)]*\bkey\b(?!s)/.test(save), "the save script never prints the key");

console.log(failed ? `FAIL strategy-demos-check: ${failed} of ${passed + failed} checks failed` : `PASS strategy-demos-check: ${passed} checks — five Strategy demos on their intro example deals, each scoring what the server's replay says`);
process.exit(failed ? 1 : 0);
