/**
 * retro-demos-check (the Retro overhaul, stage 3, 16 Nov 2026; ~10 s, no browser, no database): the Retro intro demos in
 * scripts/retro-demos.json (scripts/retro-demos-lib.ts, recorded by scripts/retro-demos-record.ts) can be saved and will play.
 *
 *  1. Every Retro game has exactly one demo, in order.
 *  2. Each demo's puzzle is the game's intro example deal exactly (the public half practiceGenerateFn returns with
 *     `example: true`), so saveIntroDemoFn, which takes only a run on a deal the server sealed, accepts it.
 *  3. Its stamp is the one rooms deal (generatePuzzle) and LIVE_BANDS lists, and the run is on the deal's own seed.
 *  4. The intro-demo stop rule (introDemo.functions.ts) reads that stamp for the game, so the saved demo plays.
 *  5. Each run scores exactly what the server's replay says (gradeAnswer on the full example deal), and is played (not 0),
 *     and fits the demo allowance.
 *  6. The save script never prompts, reads only DEMOS_URL / INTRO_DEMO_KEY / DEMOS_GAMES / DEMOS_DRY, exits 2 without the
 *     URL or key and never prints the key.
 */
import { readFileSync } from "node:fs";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { DEMO_MAX_CHARS, runSeed } from "../src/lib/arcade/introDemo";
import { demoRevAccepted, SAME_PLAY_DEMO_REVS } from "../src/lib/duel/introDemo.functions";
import { exampleDeal, FIXTURE_PATH, RETRO_DEMO_GAMES, serverScore, stampField, type RetroDemoFixture } from "./retro-demos-lib";

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  checks += 1;
  if (!cond) failures.push(`  ✗ ${label}`);
}
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as RetroDemoFixture;

/* 1 */
ok(fixture.demos.map((d) => d.type).join() === RETRO_DEMO_GAMES.join(), `one demo for each Retro game, in order (${fixture.demos.map((d) => d.type).join()})`);

const stopRules = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
for (const demo of fixture.demos) {
  const t = demo.type;
  const { full, pub } = exampleDeal(t);
  const loose = full as unknown as Record<string, unknown>;
  /* 2 */
  ok(canon(demo.puzzle) === canon(pub), `${t}: the demo's puzzle is the intro example deal exactly`);
  /* 3 */
  const field = stampField(t);
  const dealt = (generatePuzzle(t) as unknown as Record<string, unknown>)[field];
  ok(demo.field === field && demo.rev === dealt && demo.rev === loose[field], `${t}: recorded on the dealt stamp (${field} ${demo.rev}, rooms deal ${String(dealt)})`);
  ok(LIVE_BANDS[t as keyof typeof LIVE_BANDS]!.rev === demo.rev, `${t}: LIVE_BANDS lists the demo's stamp`);
  ok(runSeed(demo.run) === loose["seed"], `${t}: the run is on the deal's own seed (${runSeed(demo.run)})`);
  /* 4 */
  const rule = t in SAME_PLAY_DEMO_REVS
    ? demoRevAccepted(t as keyof typeof SAME_PLAY_DEMO_REVS, demo.rev) && stopRules.includes(`!demoRevAccepted("${t}", demo.puzzle.${field})) return null`)
    : new RegExp(`data\\.type === "${t}" && demo\\?\\.puzzle\\.type === "${t}" && [^\\n]*demo\\.puzzle\\.${field} !== `).test(stopRules);
  ok(rule, `${t}: the intro-demo stop rule reads ${field} and lets the dealt stamp play`);
  /* 5 */
  const graded = serverScore(full, demo.run);
  ok(graded === demo.score, `${t}: the run scores what the server's replay says (${demo.score} stored, ${graded} graded)`);
  ok(demo.score > 0, `${t}: a played run (${demo.score})`);
  ok(demo.run.length <= DEMO_MAX_CHARS, `${t}: the run fits the demo allowance (${demo.run.length} chars)`);
}

/* 6 */
{
  const save = readFileSync("scripts/retro-demos-save.ts", "utf8");
  const envs = [...save.matchAll(/process\.env\[?\.?"?([A-Z_]+)"?\]?/g)].map((m) => m[1]);
  ok(envs.every((e) => ["DEMOS_URL", "INTRO_DEMO_KEY", "DEMOS_GAMES", "DEMOS_DRY", "NODE_OPTIONS"].includes(e!)), `the save script reads only its four variables (${[...new Set(envs)].join(", ")})`);
  ok(!/readline|prompt\(|process\.stdin/.test(save), "the save script never prompts");
  ok(/process\.exit\(2\)/.test(save) && /process\.exit\(1\)/.test(save) && /process\.exit\(0\)/.test(save), "the save script exits 0 / 1 / 2");
  ok(!/console\.\w+\([^)]*\bkey\b[^)]*\)/.test(save.replace(/INTRO_DEMO_KEY/g, "")), "the save script never prints the key");
  const run = Bun.spawnSync(["bun", "scripts/retro-demos-save.ts"], { env: { PATH: process.env["PATH"] ?? "" } });
  ok(run.exitCode === 2, `the save script exits 2 with no URL or key (${run.exitCode})`);
}

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL retro-demos-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS retro-demos-check: ${checks} checks — a demo for each Retro game on its intro example deal and dealt stamp, scoring what the server's replay says, playable under the stop rules; the save script's contract`);
