/**
 * tilt-rev11-check (3 Nov 2026, docs/arcade-standard/tilt.md "tiltRev 11"): Tilt tiltRev 11. tiltRev 10's four mazes
 * and play exactly, less the gold stars (none dealt, drawn or scored), scored on par times and a clean run.
 *
 *  1. Wiring: rooms deal tiltRev 11 from the bank; LIVE_BANDS reads its core line (TILT_V11_BAND_CURVE: 0 → 0, 140 →
 *     140); the "?" help, HOW lines and intro (under 90 characters) state par, the clean run and the parts making 200,
 *     and no gold stars; the standard module names tiltRev 11 and its perfect runs score 200 with every part at its
 *     maximum; ROUND_MAX 200; the expansion's world; the intro demo plays only when recorded on tiltRev 11; the HUD and
 *     the success layer show par and the clean run (renderer source).
 *  2. Older stamps unchanged: 53 runs on unstamped and tiltRev 2–10 rounds (21 on tiltRev 10, the stamp rooms dealt
 *     before), recorded on unmodified main 63261010 (scripts/fixtures/tilt-rev11-legacy.json.gz,
 *     `bun scripts/tilt-rev11-record.ts --legacy`), replay to the same score, flag, final state and checkpoints, with
 *     no tiltRev 11 field.
 *  3. The same world less the stars: on 40 bank seeds tiltRev 11's mazes are tiltRev 10's with no gold stars and their
 *     own par (tiltParT, from the maze alone); the start state is tiltRev 10's plus the tiltRev 11 fields; bot and random
 *     logs played on both stamps move the marbles identically tick for tick (the stars never touched the physics).
 *  4. The rules: each finished maze's time (mazeTicks) against its par gives parsMet; the first fall fixes cleanTo at
 *     the mazes finished before it; the parts (core 35 a maze, up to 20 of it for progress in the maze being played, par 6 a maze, clean 3 a maze
 *     before the first fall, speed 24 once all four are done, full by 60 s); the core never depends on par or falls;
 *     no input 0, any input at least 1, never above 200; a fall changes the checkpoint checksum's clean marker.
 *  5. Stored tiltRev 11 runs (scripts/fixtures/tilt-rev11-runs.json.gz, `bun scripts/tilt-rev11-record.ts --new`)
 *     replay through the server to their score and state, unflagged; every oracle run is 200 with every part full.
 *  6. Rooms identical: idle, random, weak and elite logs meet the same mazes, pars and items (room-identity module).
 *  7. The reveal: band lines from tiltParBandParts (par, clean), tiles Mazes / Under par / Falls; grading keeps
 *     parsMet and cleanMazes.
 *
 *   bun scripts/tilt-rev11-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  tiltCheckpoint,
  tiltGameFor,
  tiltIsExpand,
  tiltMazesP,
  tiltMazesS,
  tiltParParts,
  tiltParT,
  tiltWorldHFor,
  TILT_P_CLEAN_POINTS,
  TILT_P_CORE_MAX,
  TILT_P_MAZE_POINTS,
  TILT_P_PAR_MAX,
  TILT_P_PAR_POINTS,
  TILT_P_PROGRESS_POINTS,
  TILT_P_SPEED_FULL,
  TILT_P_SPEED_POINTS,
  TILT_REV_PAR,
  TILT_REV_STD,
  TILT_RUN_TICKS,
  TILT_S_MAZES,
  TILT_V11_BAND_CURVE,
  TILT_X_H,
  type TiltState,
} from "../src/lib/arcade/tilt";
import { replayTiltRun } from "../src/lib/duel/tilt";
import { TILT_BANK } from "../src/lib/duel/tiltBank.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { ROUND_MAX } from "../src/lib/duel/roundMax";
import { tiltStateDigest } from "./tilt-expand-record";
import { jsonDigest, randomLog, botLog, type Row } from "./tilt-rev11-record";
import { roomIdentity } from "./room-identity/tilt";
import { entry } from "./arcade-standard/tilt";
import type { StdRun } from "./arcade-standard/entry";

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
};
const section = (name: string) => console.log(`— ${name}`);
/** JSON with the top-level keys sorted (field order is not state). */
const sorted = (o: object) => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))));
const load = (path: string) => (JSON.parse(gunzipSync(readFileSync(path)).toString()) as { runs: Row[]; recordedOn?: string });
const v10 = tiltGameFor(TILT_REV_STD);
const v11 = tiltGameFor(TILT_REV_PAR);
type Ev = { t: number; k: number; a: number; b: number; c: number; d: number };
const play = (seed: number, events: Ev[], game = v11, each?: (prev: TiltState, s: TiltState) => void): TiltState => {
  const by = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as TiltState;
  while (!game.isOver(s) && s.tick < game.runTicks) {
    const prev = s;
    s = game.step(s, (by.get(s.tick + 1) as never) ?? null) as TiltState;
    each?.(prev, s);
  }
  return s;
};

/* 1. Wiring. */
section("wiring: the deal, the help, the intro, the standard module, the demo and the HUD");
{
  for (let k = 0; k < 12; k++) {
    const p = generatePuzzle("tilt") as unknown as { tiltRev: number; seed: number };
    ok(p.tiltRev === TILT_REV_PAR && TILT_BANK.includes(p.seed), `rooms deal tiltRev 11 from the bank (got ${p.tiltRev}, ${p.seed})`);
  }
  ok(TILT_REV_PAR === TILT_REV_STD + 1, "tiltRev 11 is one above the stamp it replaces");
  const live = LIVE_BANDS.tilt as { field: string; rev: number; curve: typeof TILT_V11_BAND_CURVE };
  ok(live.field === "tiltRev" && live.rev === TILT_REV_PAR && live.curve === TILT_V11_BAND_CURVE, "LIVE_BANDS: tiltRev 11 on its core's line");
  ok(TILT_V11_BAND_CURVE.units.join() === `0,${TILT_P_CORE_MAX}` && TILT_V11_BAND_CURVE.points.join() === `0,${TILT_P_CORE_MAX}`, "the core's line is straight, 0 → 0 and 140 → 140");
  ok(TILT_P_CORE_MAX === 140 && TILT_P_PAR_MAX === 24 && TILT_P_CLEAN_POINTS === 12 && TILT_P_SPEED_POINTS === 24, "parts: core 140, par 24, clean 12, speed 24");
  ok(TILT_P_CORE_MAX + TILT_P_PAR_MAX + TILT_P_CLEAN_POINTS + TILT_P_SPEED_POINTS === 200, "the parts' maxima add up to 200");
  ok(ROUND_MAX.tilt === 200, "ROUND_MAX: Tilt is 200");
  ok(tiltWorldHFor(TILT_REV_PAR) === TILT_X_H && tiltIsExpand(TILT_REV_PAR), "tiltRev 11 plays in the expansion's world");
  const help = PUZZLE_INSTRUCTIONS.tilt.score;
  for (const words of ["counts 35", "up to 20 more", "up to 140", "within its par adds 6", "24 for all 4", "clean run adds up to 12", "3 for each maze", "up to 24 for speed", "by 60 s", "140 + 24 + 12 + 24 = 200", "at least 1", "Up to 200."])
    ok(help.includes(words), `the help says "${words}": ${help}`);
  ok(!/gold star|quick star|skill/i.test(help), "the help names no gold or quick stars and no skill pay");
  const how = PUZZLE_INSTRUCTIONS.tilt.how.map((h) => `${h.action} ${h.detail}`).join(" ");
  ok(/Par:/.test(how) && /Clean run:/.test(how) && !/gold star/i.test(how) && /maze 4/.test(how), `the HOW lines name par, the clean run and maze 4, and no gold stars: ${how}`);
  const intro = INTRO_SCORE.tilt;
  ok(intro.length <= 90 && intro.includes("35 a maze") && intro.includes("+6 a maze beaten in time") && intro.includes("clean run 12") && !/star/i.test(intro), `the intro (${intro.length} chars): ${intro}`);
  ok(entry.type === "tilt" && entry.field === "tiltRev" && entry.rev === TILT_REV_PAR, "the standard module names tiltRev 11");
  ok(entry.parts.reduce((t, p) => t + p.max, 0) === 200 && JSON.stringify(entry.parts.map((p) => [p.key, p.max])) === JSON.stringify([["core", 140], ["par", 24], ["clean", 12], ["speed", 24]]), "the standard module's parts: core 140, par 24, clean 12, speed 24");
  const perfect = entry.perfect() as StdRun[];
  ok(perfect.length >= 1 && perfect.every((r) => r.score === 200 && entry.parts.every((p) => r.parts?.[p.key] === p.max)), `the standard module's perfect runs: 200 with every part full (${JSON.stringify(perfect)})`);
  const demos = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/tiltRev !== TILT_REV_PAR\) return null/.test(demos), "the intro demo plays only when recorded on tiltRev 11");
  const art = readFileSync("src/lib/arcade/tiltArt.renderer.ts", "utf8");
  ok(/if \(state\.parClean\)[\s\S]{0,400}`Par \$\{Math\.ceil\(left \/ 60\)\} s`[\s\S]{0,300}"Clean"/.test(art), "the HUD shows the par countdown and \"Clean\" on tiltRev 11 (no star count)");
  ok(/label: \(\) => "UNDER PAR!"/.test(art) && /if \(rev === TILT_REV_PAR\) return tiltParArtGame;/.test(art), "the success layer pops UNDER PAR! and tiltRev 11 has its own art game");
}

/* 2. Older stamps. */
section("older stamps replay exactly as on main");
{
  const fx = load("scripts/fixtures/tilt-rev11-legacy.json.gz");
  const legacy = fx.runs;
  const revs = new Set(legacy.map((r) => r.rev));
  ok(legacy.length === 53 && [null, 2, 3, 4, 5, 6, 8, 9, 10].every((r) => revs.has(r)) && legacy.filter((r) => r.rev === 10).length === 21, `53 legacy runs over every older stamp, 21 on tiltRev 10 (got ${legacy.length})`);
  ok(/63261010/.test(fx.recordedOn ?? ""), `recorded on unmodified main 63261010 (${fx.recordedOn})`);
  for (const run of legacy) {
    const tag = `tiltRev ${run.rev ?? "(none)"} ${run.seed} ${run.kind}`;
    const r = replayTiltRun(run.seed, run.raw, run.rev);
    ok(r.score === run.score && Boolean(r.flagged) === run.flagged, `${tag}: stored ${run.score}, replays ${r.score}${r.flagged ? " (flagged)" : ""}`);
    ok(tiltStateDigest(r.state) === run.digest && jsonDigest(r.checkpoints) === run.checkpoints, `${tag}: the same final state and checkpoints`);
    ok(r.state.parClean === undefined && r.state.parsMet === undefined && r.state.cleanTo === undefined && r.state.mazeTicks === undefined, `${tag}: no tiltRev 11 field`);
    ok(!("parsMet" in r), `${tag}: no tiltRev 11 reveal fields`);
  }
}

/* 3. The same world less the stars. */
section("tiltRev 10's mazes and play, with no gold stars and a par per maze");
{
  for (let n = 0; n < 40; n++) {
    const seed = TILT_BANK[(n * 7) % TILT_BANK.length]!;
    const a = tiltMazesS(seed);
    const b = tiltMazesP(seed);
    const strip = (m: object) => {
      const { stars: _s, starXY: _x, par: _p, ...rest } = m as Record<string, unknown>;
      return JSON.stringify(rest);
    };
    ok(a.length === 4 && b.length === 4 && a.every((m, k) => strip(m) === strip(b[k]!)), `seed ${seed}: tiltRev 10's four mazes`);
    ok(b.every((m) => (m.stars?.length ?? 0) === 0 && (m.starXY?.length ?? 0) === 0), `seed ${seed}: no gold stars dealt`);
    ok(a.slice(0, 3).every((m) => (m.stars?.length ?? 0) === 1), `seed ${seed}: tiltRev 10 dealt a gold star in mazes 1–3`);
    ok(b.every((m) => m.par === tiltParT(m) && m.par! > 0 && m.par! < TILT_RUN_TICKS / 2), `seed ${seed}: each maze's par is tiltParT of the maze (${b.map((m) => m.par).join(", ")})`);
    const s10 = v10.init(seed) as TiltState;
    const s11 = v11.init(seed) as TiltState;
    // The maze's star flags (starGot) follow its stars: one on tiltRev 10, none on tiltRev 11.
    const { list: _l10, starGot: g10, ...r10 } = s10;
    const { list: _l11, starGot: g11, parClean, parsMet, mazeTicks, ...r11 } = s11;
    ok(sorted(r10) === sorted(r11) && parClean === 1 && parsMet === 0 && JSON.stringify(mazeTicks) === "[]" && s11.cleanTo === undefined, `seed ${seed}: the start is tiltRev 10's plus the tiltRev 11 fields`);
    ok(JSON.stringify(g10) === "[0]" && JSON.stringify(g11) === "[]", `seed ${seed}: no star flags on tiltRev 11 (${JSON.stringify(g10)} → ${JSON.stringify(g11)})`);
    ok(JSON.stringify(s11.list) === JSON.stringify(b), `seed ${seed}: init deals tiltMazesP`);
  }
  // The same logs on both stamps: the marbles, mazes and falls identical tick for tick.
  const keys = ["tick", "level", "mazes", "angle", "x", "y", "vx", "vy", "b", "aHome", "bHome", "keysGot", "falls", "ended", "endedTick", "holdA", "holdB", "acted"] as const;
  for (let n = 0; n < 6; n++) {
    const seed = TILT_BANK[100 + n * 13]!;
    const logs = [randomLog(TILT_REV_STD, seed, n), botLog(TILT_REV_STD, seed, n % 2 ? "elite" : "average")];
    for (const [li, log] of logs.entries()) {
      const by = new Map(log.map((e) => [e.t, e]));
      let a = v10.init(seed) as TiltState;
      let b = v11.init(seed) as TiltState;
      let same = true;
      while (!v10.isOver(a) && a.tick < v10.runTicks) {
        const ev = by.get(a.tick + 1) ?? null;
        a = v10.step(a, ev) as TiltState;
        b = v11.step(b, ev) as TiltState;
        if (keys.some((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))) {
          same = false;
          break;
        }
      }
      ok(same && v11.isOver(b) === v10.isOver(a), `seed ${seed} log ${li}: the same play on tiltRev 10 and 11 tick for tick (tick ${a.tick})`);
      ok((b.stars ?? 0) === 0, `seed ${seed} log ${li}: no star taken on tiltRev 11`);
    }
  }
}

/* 4. The rules. */
section("the rules: par, the clean run, the parts");
{
  let falls = 0;
  let pars = 0;
  const seeds = [TILT_BANK[30]!, TILT_BANK[31]!, TILT_BANK[32]!, TILT_BANK[40]!, TILT_BANK[41]!];
  for (const [i, seed] of seeds.entries()) {
    for (const log of [randomLog(TILT_REV_PAR, seed, i + 11), botLog(TILT_REV_PAR, seed, "weak"), botLog(TILT_REV_PAR, seed, "good"), botLog(TILT_REV_PAR, seed, "elite")]) {
      const times: number[] = [];
      let at = 0;
      let firstFall = -1;
      let rising = true;
      let fixed = true;
      const s = play(seed, log, v11, (prev, next) => {
        if (next.mazes > prev.mazes) {
          times.push(next.tick - at);
          at = next.tick;
        }
        if (firstFall < 0 && (next.falls ?? 0) > (prev.falls ?? 0)) firstFall = prev.mazes;
        if ((next.parsMet ?? 0) < (prev.parsMet ?? 0)) rising = false;
        if (prev.cleanTo !== undefined && next.cleanTo !== prev.cleanTo) fixed = false;
      });
      ok(rising && fixed, `seed ${seed}: parsMet never falls and cleanTo stays fixed once set`);
      const met = times.filter((t, k) => t <= s.list[k]!.par!).length;
      ok(JSON.stringify(s.mazeTicks) === JSON.stringify(times) && s.parsMet === met, `seed ${seed}: mazeTicks and parsMet follow each maze's time against its par (${times.join(",")} vs ${s.list.map((m) => m.par).join(",")})`);
      ok(firstFall < 0 ? s.cleanTo === undefined : s.cleanTo === firstFall, `seed ${seed}: cleanTo is the mazes done before the first fall (${s.cleanTo})`);
      falls += firstFall >= 0 ? 1 : 0;
      pars += met;
      const p = tiltParParts(s);
      const done = s.mazes >= TILT_S_MAZES;
      const prog = done || s.progMaze !== s.mazes ? 0 : Math.trunc((TILT_P_PROGRESS_POINTS * (s.prog ?? 0)) / 1000);
      ok(p.core === (TILT_P_MAZE_POINTS + TILT_P_PROGRESS_POINTS) * s.mazes + prog, `seed ${seed}: the core is 35 a maze plus progress, whatever the par or falls (${p.core})`);
      ok(p.par === TILT_P_PAR_POINTS * met, `seed ${seed}: par 6 a maze within par (${p.par})`);
      const cleanMazes = s.cleanTo ?? s.mazes;
      ok(p.clean === Math.floor((TILT_P_CLEAN_POINTS * cleanMazes) / 4), `seed ${seed}: clean 3 a maze before the first fall (${p.clean})`);
      const speed = !done ? 0 : s.endedTick <= TILT_P_SPEED_FULL ? TILT_P_SPEED_POINTS : Math.trunc((TILT_P_SPEED_POINTS * (TILT_RUN_TICKS - s.endedTick)) / (TILT_RUN_TICKS - TILT_P_SPEED_FULL));
      ok(p.speed === speed, `seed ${seed}: speed only on all four, full by 60 s (${p.speed})`);
      const total = p.core + p.par + p.clean + p.speed;
      ok(v11.score(s) === Math.max(1, Math.min(200, total)) && v11.score(s) <= 200, `seed ${seed}: the score is the parts' sum, at least 1 for a played run (${v11.score(s)})`);
      // The core never depends on the features: the same state with par and clean wiped has the same core.
      const bare = tiltParParts({ ...s, parsMet: 0, cleanTo: 0 });
      ok(bare.core === p.core && bare.speed === p.speed, `seed ${seed}: par and the clean run never change the core`);
    }
  }
  ok(falls > 0, `the scripted runs include a fall (${falls})`);
  ok(pars > 0, `the scripted runs include mazes within par (${pars})`);
  // A fall changes the checksum through the clean marker; no input scores 0.
  const seed = TILT_BANK[30]!;
  const idle = play(seed, []);
  ok(v11.score(idle) === 0 && !idle.acted, "no input scores 0");
  const s0 = v11.init(seed) as TiltState;
  ok(tiltCheckpoint({ ...s0, cleanTo: 0 }).checksum !== tiltCheckpoint(s0).checksum && tiltCheckpoint({ ...s0, parsMet: 1 }).checksum !== tiltCheckpoint(s0).checksum, "parsMet and cleanTo are in the checkpoint checksum");
  const one = play(seed, [{ t: 5, k: 7, a: 200, b: 0, c: 1, d: 0 }]);
  ok(v11.score(one) >= 1, `one drag scores at least 1 (${v11.score(one)})`);
}

/* 5. Stored runs. */
section("stored tiltRev 11 runs replay through the server");
{
  const runs = load("scripts/fixtures/tilt-rev11-runs.json.gz").runs;
  ok(runs.length === 19 && runs.filter((r) => r.kind === "oracle").length === 4, `19 stored runs, 4 oracle (${runs.length})`);
  for (const run of runs) {
    const tag = `${run.seed} ${run.kind}`;
    const r = replayTiltRun(run.seed, run.raw, TILT_REV_PAR);
    ok(run.rev === TILT_REV_PAR && !r.flagged && r.desyncTick === null, `${tag}: replays unflagged (${r.reason ?? ""})`);
    ok(r.score === run.score && tiltStateDigest(r.state) === run.digest && jsonDigest(r.checkpoints) === run.checkpoints, `${tag}: stored ${run.score}, replays ${r.score}`);
    ok(r.state.parClean === 1 && r.score >= 1 && r.score <= 200 && (r.stars ?? 0) === 0, `${tag}: a tiltRev 11 state scoring 1–200 with no stars (${r.score})`);
    if (run.kind === "oracle") {
      const p = tiltParParts(r.state);
      ok(r.score === 200 && p.core === TILT_P_CORE_MAX && p.par === TILT_P_PAR_MAX && p.clean === TILT_P_CLEAN_POINTS && p.speed === TILT_P_SPEED_POINTS && (r.state.falls ?? 0) === 0, `${tag}: a perfect 200, every maze within par, no fall (${JSON.stringify(p)})`);
    }
  }
}

/* 6. Rooms identical. */
section("rooms identical: the same mazes, pars and items whatever is played");
{
  ok(roomIdentity.rev === TILT_REV_PAR, "the room-identity module plays tiltRev 11");
  for (const seed of [TILT_BANK[7]!, TILT_BANK[77]!]) {
    const logs = roomIdentity.logs(seed);
    const schedules = logs.map((l) => roomIdentity.scheduleOf(seed, TILT_REV_PAR, l));
    const reached = schedules.map((s) => new Set(s.map((e) => Math.floor(e.t / 100_000))));
    for (let i = 1; i < schedules.length; i++) {
      const common = (e: { t: number }) => reached[0]!.has(Math.floor(e.t / 100_000)) && reached[i]!.has(Math.floor(e.t / 100_000));
      ok(JSON.stringify(schedules[0]!.filter(common)) === JSON.stringify(schedules[i]!.filter(common)), `seed ${seed}: log ${i} meets the same mazes and pars`);
    }
    ok(schedules.every((s) => s.every((e) => !/gold star/.test(e.what))), `seed ${seed}: no gold star in any schedule`);
  }
}

/* 7. The reveal and grading. */
section("the reveal and grading");
{
  const runs = load("scripts/fixtures/tilt-rev11-runs.json.gz").runs;
  const o = runs.find((x) => x.kind === "oracle")!;
  const ro = replayTiltRun(o.seed, o.raw, TILT_REV_PAR);
  const rv = buildArcadeReveal("tilt", { ...ro, tiltRev: TILT_REV_PAR }, ro.score)!;
  const text = rv.lines.join(" | ");
  ok(rv.outcome === "finish" && text.includes("Par 4 / 4 mazes +24") && text.includes("clean 4 / 4 +12") && text.includes("speed +24") && !/star/i.test(text), `the perfect reveal: ${text}`);
  ok(rv.tiles.some((t) => t.label === "Under par" && t.value === "4 / 4") && rv.tiles.some((t) => t.label === "Falls") && !rv.tiles.some((t) => /star/i.test(t.label)), `the reveal's tiles: ${JSON.stringify(rv.tiles)}`);
  const weak = runs.find((x) => x.kind === "random 2")!;
  const rw = replayTiltRun(weak.seed, weak.raw, TILT_REV_PAR);
  const rvw = buildArcadeReveal("tilt", { ...rw, tiltRev: TILT_REV_PAR }, rw.score)!;
  ok(rvw.lines[0]!.includes("/ 4 mazes × 35") && (rw.parsMet ?? -1) >= 0 && (rw.cleanMazes ?? -1) >= 0, `a partial reveal: ${rvw.lines.join(" | ")}`);
  const grade = readFileSync("src/lib/duel/grade.ts", "utf8");
  ok(/run\.parsMet !== undefined \? \{ parsMet: run\.parsMet, cleanMazes: run\.cleanMazes \}/.test(grade), "grading keeps parsMet and cleanMazes on tiltRev 11 rounds");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL tilt-rev11-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS tilt-rev11-check: ${checks} checks — older stamps replay as on main, tiltRev 10's mazes and play with no gold stars, par and the clean run, 200 perfect runs, rooms identical, the words`);
