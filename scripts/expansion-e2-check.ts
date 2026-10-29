/**
 * expansion-e2-check (25 Oct 2026, docs/expansions/e2.md): Meteor snakeRev 9 and Tempo beatRev 9, the two games
 * raised to 200 by expansion E2 (Fission stays on burstRev 6 at 150).
 *
 *  1. Legacy identity: 192 skill-band runs recorded on unmodified main (scripts/fixtures/expansion-e2-legacy.json.gz:
 *     every older revision, snakeRev 1–8 and beatRev 1–8, every level) replay through the server path to their
 *     stored score, flag and final state, byte for byte.
 *  2. Rooms deal the new revisions, ROUND_MAX states 200 for the two, the "?" help reads their curves, and
 *     Fission was split out of E2 (burstRev 6 stays its score-bands revision; expansion E9 moved rooms on to
 *     burstRev 8, docs/expansions/e9.md, proved by expansion-e9-check).
 *  3. The new revisions: the same seed builds the same world twice (room-identical); the features exist where
 *     the rules say (wormholes off the border and clear of stars and rocks, lanes, the gold schedule; five lanes only after the break, none inside it, double taps 9 ticks apart in one lane);
 *     a run with no input scores 0.
 *  4. New-stamp runs (scripts/fixtures/expansion-e2-new.json.gz, recorded on this branch with --record) replay to
 *     their stored scores; every score is at most 200 with each feature at most its cap (50 in all), and the
 *     near-perfect bots using the features reach 180+ in every game; a stored Tempo run scores 200.
 *
 *   bun scripts/expansion-e2-check.ts [--record]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gunzipSync, gzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, LEVELS } from "./arcade-skill-bands/human";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { ROUND_MAX } from "../src/lib/duel/roundMax";
import { LIVE_BANDS, liveStrictRev } from "../src/lib/arcade/liveBands";
import { snakeV9Bonus, snakeRow, snakeCol, SNAKE_REV_200, SNAKE_REV_10, SNAKE_REV_STRICT, SNAKE_V9_CAPS, SNAKE_V9_COLS, SNAKE_V9_ROWS, SNAKE_V9_BAND_CURVE } from "../src/lib/arcade/snake";
import { BURST_REV_STD, BURST_REV_STRICT, BURST_V6_BAND_CURVE } from "../src/lib/arcade/burst";
import { beatV9Bonus, BEAT_REV_200, BEAT_REV_EASE, BEAT_REV_STRICT, BEAT_V9_CAPS, BEAT_V9_FIVE_FROM, BEAT_V9_BREAK, BEAT_DOUBLE_GAP, BEAT_V9_BAND_CURVE, BEAT_V9_RUN_TICKS } from "../src/lib/arcade/beat";

const RECORD = process.argv.includes("--record");
const NEW_FIXTURE = "scripts/fixtures/expansion-e2-new.json.gz";
/** Seeds recorded per game and level (9 since the Tempo retune, so the stored runs include a 200). */
const RECORD_SEEDS = 9;
let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
};
const digest = (state: unknown) => createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 24);

/* 1. Legacy identity. */
const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/expansion-e2-legacy.json.gz")).toString()) as { runs: any[] };
for (const run of legacy.runs) {
  const spec = GAME_BY_TYPE.get(run.type)!;
  const now = spec.replay(run.seed, run.raw, run.rev);
  const tag = `${run.type} rev ${run.rev} ${run.level} seed ${run.seed}`;
  ok(now.score === run.score, `${tag}: replays to its stored ${run.score} (got ${now.score})`);
  ok(Boolean(now.flagged) === run.flagged, `${tag}: flagged ${run.flagged} as recorded`);
  ok(digest(now.state) === run.digest, `${tag}: identical final state`);
}
ok(legacy.runs.length === 192, `192 legacy runs (got ${legacy.runs.length})`);
for (const [type, top] of [["snake", SNAKE_REV_STRICT], ["beat", BEAT_REV_STRICT]] as const)
  for (let rev = 1; rev <= top; rev++) ok(legacy.runs.some((r) => r.type === type && r.rev === rev), `${type}: legacy runs on rev ${rev}`);

/* 2. Dealt revisions, maxima and help curves. */
// Joe's phone notes (27 Oct 2026): rooms moved on to snakeRev 10 (snake-rev10-check) and beatRev 10 (tempo-ease-check); snakeRev 9 and beatRev 9 stay proved below.
ok((generatePuzzle("snake") as any).snakeRev === SNAKE_REV_10, "rooms deal snakeRev 10");
ok((generatePuzzle("beat") as any).beatRev === BEAT_REV_EASE, "rooms deal beatRev 10 (beatRev 9 before the phone notes)");
ok(ROUND_MAX.snake === 200 && ROUND_MAX.beat === 200, "ROUND_MAX: Meteor and Tempo are 200");
ok(LIVE_BANDS.snake.curve === SNAKE_V9_BAND_CURVE && LIVE_BANDS.beat.curve === BEAT_V9_BAND_CURVE, "the help reads the new curves");
ok(liveStrictRev("snake") === SNAKE_REV_STRICT && liveStrictRev("beat") === BEAT_REV_STRICT, "their score-bands revisions are the ones rooms dealt before (strictRev)");
// Fission was split out of E2: burstRev 6 stays its score-bands revision on its strict curve; expansion E9 (docs/expansions/e9.md)
// then moved rooms on to burstRev 8 at 200 (expansion-e9-check covers it).
ok((generatePuzzle("burst") as any).burstRev === BURST_REV_STD && ROUND_MAX.burst === 200 && liveStrictRev("burst") === BURST_REV_STRICT && BURST_V6_BAND_CURVE.points.at(-1) === 140, "Fission is not E2's: burstRev 6 stays its strict revision (its strict curve, 140 at the top); rooms deal burstRev 10 (the arcade scoring standard, after E9's burstRev 8 and the phone-test notes' 9) at 200");
ok(SNAKE_V9_CAPS.gold + SNAKE_V9_CAPS.combo + SNAKE_V9_CAPS.lane + SNAKE_V9_CAPS.warp === 50, "Meteor's caps add to 50");
ok(BEAT_V9_CAPS.fever + BEAT_V9_CAPS.gold + BEAT_V9_CAPS.double + BEAT_V9_CAPS.streak === 50, "Tempo's caps add to 50");

/* 3. The new worlds. */
const NEW: Record<string, number> = { snake: SNAKE_REV_200, beat: BEAT_REV_200 };
for (const [type, rev] of Object.entries(NEW)) {
  const spec = GAME_BY_TYPE.get(type as never)!;
  for (let n = 0; n < 20; n++) {
    const seed = spec.seedFor(n);
    const game = spec.gameFor(rev, seed);
    const a = game.init(seed);
    ok(JSON.stringify(a) === JSON.stringify(game.init(seed)), `${type} seed ${seed}: the same world twice`);
    if (type === "snake") {
      const cells = new Set([...(a.rockSlots ?? []).map((r: any) => r.cell), ...(a.showerCells ?? [])]);
      const stars = new Set(a.queue);
      ok(a.cols === SNAKE_V9_COLS && a.rows === SNAKE_V9_ROWS, `${type} seed ${seed}: the 19 × 34 field`);
      ok(a.warps.length === 4 && new Set(a.warps).size === 4, `${type} seed ${seed}: two wormhole pairs`);
      for (const w of a.warps) {
        const r = snakeRow(w, SNAKE_V9_COLS), c = snakeCol(w, SNAKE_V9_COLS);
        ok(r >= 2 && r < SNAKE_V9_ROWS - 2 && c >= 2 && c < SNAKE_V9_COLS - 2, `${type} seed ${seed}: mouth ${w} off the border`);
        ok(!stars.has(w) && !cells.has(w) && r !== a.laneRow && c !== a.laneCol, `${type} seed ${seed}: mouth ${w} clear of stars, rocks and lanes`);
      }
      ok(a.golds.length >= 6 && a.golds.every((g: any) => !stars.has(g.cell) && !cells.has(g.cell) && !a.warps.includes(g.cell)), `${type} seed ${seed}: 6+ gold stars, never on a star, rock or mouth`);
    } else {
      const { ticks, lanes, pairs } = a.chart;
      ok(ticks.every((t: number, i: number) => (t < BEAT_V9_FIVE_FROM ? lanes[i] < 4 : lanes[i] < 5)), `${type} seed ${seed}: four lanes, then five`);
      ok(lanes.some((l: number) => l === 4), `${type} seed ${seed}: the fifth lane is used`);
      ok(ticks.every((t: number) => !(t > BEAT_V9_FIVE_FROM - BEAT_V9_BREAK && t < BEAT_V9_FIVE_FROM + 15)), `${type} seed ${seed}: no note in the break`);
      ok(pairs.every((p: number, i: number) => p < 0 || (ticks[i] - ticks[p] === BEAT_DOUBLE_GAP && lanes[i] === lanes[p])), `${type} seed ${seed}: double taps 9 ticks apart in one lane`);
      ok(ticks.at(-1) < BEAT_V9_RUN_TICKS && ticks.at(-1) > 3600, `${type} seed ${seed}: the song runs past 60 s`);
    }
    let s = a;
    while (!game.isOver(s)) s = game.step(s, null);
    ok(game.score(s) === 0, `${type} seed ${seed}: no input scores 0`);
  }
}

/* 4. New-stamp runs. */
const bonusOf: Record<string, (s: any) => { total: number }> = { snake: snakeV9Bonus, beat: beatV9Bonus };
const capsOf: Record<string, Record<string, number>> = { snake: SNAKE_V9_CAPS, beat: BEAT_V9_CAPS };
const fresh: any[] = [];
if (RECORD) {
  for (const [type, rev] of Object.entries(NEW)) {
    const spec = GAME_BY_TYPE.get(type as never)!;
    const bot = (await import(`./arcade-skill-bands/bots/${type}.ts`)).bot;
    for (const level of LEVELS)
      for (let n = 0; n < RECORD_SEEDS; n++) {
        const seed = spec.seedFor(n);
        const game = spec.gameFor(rev, seed);
        const out = bot({ game, seed, rev, human: new Human(type, seed, level) });
        let state = game.init(seed);
        const by = new Map((out.events ?? []).map((e: any) => [e.t, e]));
        const checkpoints: unknown[] = [];
        while (!game.isOver(state)) {
          state = game.step(state, by.get(state.tick + 1) ?? null);
          if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
        }
        const raw = spec.encode({ seed, claimedScore: game.score(state), events: out.events ?? [], endTick: state.tick, checkpoints }, rev, seed);
        const result = spec.replay(seed, raw, rev);
        fresh.push({ type, rev, level, seed, raw, score: result.score, digest: digest(result.state) });
      }
  }
  writeFileSync(NEW_FIXTURE, gzipSync(JSON.stringify({ recorded: "expansion E2 branch (Meteor and Tempo; Tempo skill-pay retune), 26 Oct 2026", runs: fresh })));
  console.log(`wrote ${NEW_FIXTURE} (${fresh.length} runs)`);
}
const recorded = JSON.parse(gunzipSync(readFileSync(NEW_FIXTURE)).toString()) as { runs: any[] };
const best: Record<string, number> = {};
const top: Record<string, number> = {};
for (const run of recorded.runs) {
  const spec = GAME_BY_TYPE.get(run.type)!;
  const now = spec.replay(run.seed, run.raw, run.rev);
  const tag = `${run.type} rev ${run.rev} ${run.level} seed ${run.seed}`;
  ok(!now.flagged, `${tag}: replays unflagged (${now.reason ?? ""})`);
  ok(now.score === run.score && digest(now.state) === run.digest, `${tag}: replays to its stored ${run.score} (got ${now.score})`);
  ok(now.score <= 200, `${tag}: at most 200`);
  const b = bonusOf[run.type]!(now.state) as Record<string, number>;
  ok(b.total! <= 50 && Object.entries(capsOf[run.type]!).every(([k, cap]) => (b[k] ?? 0) <= cap), `${tag}: each feature within its cap`);
  if (run.level === "near") best[run.type] = Math.max(best[run.type] ?? 0, now.score);
  top[run.type] = Math.max(top[run.type] ?? 0, now.score);
}
for (const type of Object.keys(NEW)) ok((best[type] ?? 0) >= 180, `${type}: near-perfect players using the features reach 180+ (best ${best[type]})`);
ok(top.beat === 200, `beat: a stored beatRev 9 run scores 200, the maximum is reachable (best ${top.beat})`);

if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL expansion-e2-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS expansion-e2-check: ${checks} checks — ${legacy.runs.length} legacy runs identical, rooms deal the new revisions at 200, the new worlds, ${recorded.runs.length} new-stamp runs (best ${Object.entries(best).map(([t, s]) => `${t} ${s}`).join(", ")})`);
