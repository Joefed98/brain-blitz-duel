/**
 * tilt-rev12-check (3 Nov 2026, docs/arcade-standard/tilt.md "tiltRev 12"): Tilt tiltRev 12, Joe's audit. tiltRev 11's
 * four mazes, pars, rules and parts exactly, with bigger marbles (the collision radius, drawn exactly), bigger keys (a
 * wider pickup reach, drawn to it) and bigger cups (display), dealt from its own proved deal.
 *
 *  1. Wiring: rooms deal tiltRev 12 from TILT_DEAL_V12; LIVE_BANDS on tiltRev 11's core line; the parts (core 140, par
 *     24, clean 12, speed 24 = 200) and the help unchanged; the standard module names tiltRev 12 and its perfect runs
 *     score 200 with every part full; the intro demo plays only when recorded on tiltRev 12; the renderer: its own art
 *     game, the walnut and brass board, the bigger cups and keys, the HUD in the shared pills with "Over par" only once
 *     the par has passed (renderer source).
 *  2. Older stamps unchanged: 34 runs (24 on tiltRev 11 at every skill level, then tiltRev 10, 9, 8, 4 and unstamped),
 *     recorded on the tree before tiltRev 12 (scripts/fixtures/tilt-rev12-legacy.json.gz, `bun scripts/tilt-rev12-record.ts
 *     --legacy`), replay to the same score, flag, final state and checkpoints, with no tiltRev 12 field; tiltRev 11's mazes
 *     carry no key reach.
 *  3. The rules: tiltRev 12's mazes are tiltRev 11's (the same carve, holes, keys, gates, ice, cups and pars) but for
 *     the marble radius (41 % of a cell in mazes 1–3, 45 % in maze 4, each under half a cell) and the key reach (45 %);
 *     the start is tiltRev 11's plus `big: 1`, in the checksum; a marble 40 % of a cell from a key takes it on tiltRev 12
 *     and not on 11; the parts are tiltRev 11's on bot and random runs; no input 0, any input at least 1; the par
 *     countdown: tiltOverParT is 0 at every maze's start and up to its par, and counts only once it has passed.
 *  4. The deal: every seed in TILT_DEAL_V12 is a bank seed (in the bank's order) and its stored witness
 *     (scripts/fixtures/tilt-deal-v12-witness.json.gz) replays through the server to exactly 200 with every part full;
 *     the deal file rebuilds from the witnesses byte for byte (`bun scripts/tilt-deal.ts --check --full` re-runs the
 *     oracle on every candidate too).
 *  5. Stored tiltRev 12 runs (scripts/fixtures/tilt-rev12-runs.json.gz, `bun scripts/tilt-rev12-record.ts --new`) replay
 *     through the server to their score and state, unflagged; every oracle run is 200.
 *  6. Rooms identical: idle, random, weak and elite logs meet the same mazes, pars, marbles and keys.
 *  7. The reveal: tiltRev 11's lines and tiles on tiltRev 12.
 *
 *   bun scripts/tilt-rev12-check.ts
 */
import { hasScorePart } from "../src/lib/duel/scoreList";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  tiltCheckpoint,
  tiltGameFor,
  tiltIsExpand,
  tiltMazesB,
  tiltMazesP,
  tiltOverParT,
  tiltParLeftX,
  tiltParParts,
  tiltParScore,
  tiltWorldHFor,
  TILT_B_BALL,
  TILT_B_BALL4,
  TILT_B_KEY_REACH,
  TILT_INPUT_DRAG,
  TILT_P_CLEAN_POINTS,
  TILT_P_CORE_MAX,
  TILT_P_PAR_MAX,
  TILT_P_SPEED_POINTS,
  TILT_REV_BIG,
  TILT_REV_PAR,
  TILT_V11_BAND_CURVE,
  TILT_V12_BAND_CURVE,
  TILT_X_H,
  tiltCellCentre,
  type TiltState,
} from "../src/lib/arcade/tilt";
import { replayTiltRun } from "../src/lib/duel/tilt";
import { TILT_BANK } from "../src/lib/duel/tiltBank.server";
import { TILT_DEAL_V12 } from "../src/lib/duel/tiltDealV12.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { ROUND_MAX } from "../src/lib/duel/roundMax";
import { tiltStateDigest } from "./tilt-expand-record";
import { jsonDigest, randomLog, botLog, type Row } from "./tilt-rev11-record";
import { roomIdentity } from "./room-identity/tilt";
import { entry } from "./arcade-standard/tilt";
import { dealFileText, tiltDealVerdict, TILT_DEAL_WITNESS, type TiltWitness } from "./tilt-deal";
import type { StdRun } from "./arcade-standard/entry";

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
};
const section = (name: string) => console.log(`— ${name}`);
const sorted = (o: object) => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))));
const load = (path: string) => JSON.parse(gunzipSync(readFileSync(path)).toString()) as { runs: Row[]; recordedOn?: string };
const v11 = tiltGameFor(TILT_REV_PAR);
const v12 = tiltGameFor(TILT_REV_BIG);
type Ev = { t: number; k: number; a: number; b: number; c: number; d: number };
const play = (seed: number, events: Ev[], game = v12, each?: (prev: TiltState, s: TiltState) => void): TiltState => {
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
section("wiring: the deal, the parts, the standard module, the demo and the renderer");
{
  for (let k = 0; k < 16; k++) {
    const p = generatePuzzle("tilt") as unknown as { tiltRev: number; seed: number };
    ok(p.tiltRev === TILT_REV_BIG && TILT_DEAL_V12.includes(p.seed), `rooms deal tiltRev 12 from its proved deal (got ${p.tiltRev}, ${p.seed})`);
  }
  ok(TILT_REV_BIG === TILT_REV_PAR + 1, "tiltRev 12 is one above the stamp it replaces");
  const live = LIVE_BANDS.tilt as { field: string; rev: number; curve: typeof TILT_V12_BAND_CURVE };
  ok(live.field === "tiltRev" && live.rev === TILT_REV_BIG && live.curve === TILT_V12_BAND_CURVE && TILT_V12_BAND_CURVE === TILT_V11_BAND_CURVE, "LIVE_BANDS: tiltRev 12 on tiltRev 11's core line");
  ok(TILT_P_CORE_MAX === 140 && TILT_P_PAR_MAX === 24 && TILT_P_CLEAN_POINTS === 12 && TILT_P_SPEED_POINTS === 24 && TILT_P_CORE_MAX + TILT_P_PAR_MAX + TILT_P_CLEAN_POINTS + TILT_P_SPEED_POINTS === 200, "parts: core 140, par 24, clean 12, speed 24 = 200");
  ok(v12.score === tiltParScore && ROUND_MAX.tilt === 200, "tiltRev 12 scores with tiltRev 11's parts; ROUND_MAX 200");
  ok(tiltWorldHFor(TILT_REV_BIG) === TILT_X_H && tiltIsExpand(TILT_REV_BIG), "tiltRev 12 plays in the expansion's world");
  const help = PUZZLE_INSTRUCTIONS.tilt.score;
  // Text pass (4 Nov 2026): one line a part, then the total.
  for (const [label, max] of [["Mazes", 140], ["Par times", 24], ["Clean run", 12], ["Speed", 24]] as const) ok(hasScorePart(help, label, max), `the help says "${label}: …, up to ${max}."`);
  ok(help.endsWith("Total 200."), "the help ends with its total");
  ok(entry.type === "tilt" && entry.field === "tiltRev" && entry.rev === TILT_REV_BIG, "the standard module names tiltRev 12");
  ok(JSON.stringify(entry.parts.map((p) => [p.key, p.max])) === JSON.stringify([["core", 140], ["par", 24], ["clean", 12], ["speed", 24]]), "the standard module's parts");
  const perfect = entry.perfect() as StdRun[];
  ok(perfect.length >= 1 && perfect.every((r) => r.score === 200 && entry.parts.every((p) => r.parts?.[p.key] === p.max)), `the standard module's perfect runs: 200 with every part full (${JSON.stringify(perfect)})`);
  const demos = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/tiltRev !== TILT_REV_BIG\) return null/.test(demos), "the intro demo plays only when recorded on tiltRev 12");
  const server = readFileSync("src/lib/duel/arcade.server.ts", "utf8");
  ok(/TILT_DEAL_V12\[/.test(server) && /tiltRev: TILT_REV_BIG/.test(server), "generateTilt deals TILT_DEAL_V12 on tiltRev 12");
  const art = readFileSync("src/lib/arcade/tiltArt.renderer.ts", "utf8");
  ok(/if \(rev === TILT_REV_BIG\) return tiltBigArtGame;/.test(art) && /const big = !!state\.big;/.test(art), "tiltRev 12 has its own art game and the drawing reads the state's marker");
  ok(/if \(big\) drawWalnutTable\(c, W, H\);/.test(art) && /if \(big\) paintWalnutDisc/.test(art) && /if \(big\) drawBrassStrips/.test(art) && /drawBrassBed\(c, R\)/.test(art), "tiltRev 12: walnut table and disc, brass rim and walls");
  ok(/big \? cupOfB\(m, o, exit, exitDir\)/.test(art) && /TILT_B_CUP\) \/ 100/.test(art) && /cs \* \(big \? TILT_B_KEY_SIZE : 0\.42\)/.test(art), "tiltRev 12: the bigger cups and keys");
  ok(/tiltOverParT\(state\) > 0\) pills\.push\(\{ label: "", value: "Over par"/.test(art) && /drawHudPillRow\(ctx, 12, 12, pills/.test(art) && /label: "Maze", value:/.test(art), "tiltRev 12's HUD: pills, Maze first, \"Over par\" only once the par has passed");
  const stage = readFileSync("src/puzzles/tilt.tsx", "utf8");
  ok(/data\?\.tiltRev === TILT_REV_BIG \? WALNUT_TABLE/.test(stage) && /if \(rev === TILT_REV_BIG\) return \(ctx, view\) => tiltWalnutFill/.test(art), "the stage's edge and the screen fill are walnut on tiltRev 12");
}

/* 2. Older stamps. */
section("older stamps replay exactly as before tiltRev 12");
{
  const fx = load("scripts/fixtures/tilt-rev12-legacy.json.gz");
  const legacy = fx.runs;
  const revs = new Set(legacy.map((r) => r.rev));
  ok(legacy.length === 34 && [null, 4, 8, 9, 10, 11].every((r) => revs.has(r)) && legacy.filter((r) => r.rev === 11).length === 24, `34 legacy runs, 24 on tiltRev 11 (got ${legacy.length})`);
  ok(/before tiltRev 12/.test(fx.recordedOn ?? ""), `recorded before tiltRev 12 (${fx.recordedOn})`);
  for (const run of legacy) {
    const tag = `tiltRev ${run.rev ?? "(none)"} ${run.seed} ${run.kind}`;
    const r = replayTiltRun(run.seed, run.raw, run.rev);
    ok(r.score === run.score && Boolean(r.flagged) === run.flagged, `${tag}: stored ${run.score}, replays ${r.score}${r.flagged ? " (flagged)" : ""}`);
    ok(tiltStateDigest(r.state) === run.digest && jsonDigest(r.checkpoints) === run.checkpoints, `${tag}: the same final state and checkpoints`);
    ok(r.state.big === undefined && r.state.list.every((m) => m.keyReach === undefined), `${tag}: no tiltRev 12 field`);
  }
}

/* 3. The rules. */
section("the rules: tiltRev 11's mazes with bigger marbles and keys, the parts, the par countdown");
{
  for (let n = 0; n < 40; n++) {
    const seed = TILT_DEAL_V12[(n * 7) % TILT_DEAL_V12.length]!;
    const a = tiltMazesP(seed);
    const b = tiltMazesB(seed);
    const strip = (m: object) => {
      const { br: _b, keyReach: _k, ...rest } = m as Record<string, unknown>;
      return JSON.stringify(rest);
    };
    ok(a.length === 4 && b.length === 4 && a.every((m, k) => strip(m) === strip(b[k]!)), `seed ${seed}: tiltRev 11's four mazes and pars`);
    ok(b.every((m, k) => m.br === Math.trunc((m.cs * (k === 3 ? TILT_B_BALL4 : TILT_B_BALL)) / 100) && 2 * m.br < m.cs && m.br > a[k]!.br), `seed ${seed}: the marbles 41 % / 45 % of a cell, under half a cell, bigger than tiltRev 11's (${b.map((m) => m.br).join(",")} vs ${a.map((m) => m.br).join(",")})`);
    ok(b.every((m) => m.keyReach === Math.trunc((m.cs * TILT_B_KEY_REACH) / 100) && m.keyReach > Math.trunc(m.cs / 3)), `seed ${seed}: the key reach 45 % of a cell (cs / 3 before)`);
    const s11 = v11.init(seed) as TiltState;
    const s12 = v12.init(seed) as TiltState;
    const { list: _l11, ...r11 } = s11;
    const { list: _l12, big, ...r12 } = s12;
    ok(sorted(r11) === sorted(r12) && big === 1, `seed ${seed}: the start is tiltRev 11's plus big: 1`);
    ok(JSON.stringify(s12.list) === JSON.stringify(b), `seed ${seed}: init deals tiltMazesB`);
  }
  const s0 = v12.init(TILT_DEAL_V12[0]!) as TiltState;
  ok(tiltCheckpoint(s0).checksum !== tiltCheckpoint({ ...s0, big: undefined }).checksum, "big is in the checkpoint checksum");
  // A marble 40 % of a cell from a key, coming in along its open side: taken on tiltRev 12 (reach 45 %), not on 11 (cs / 3).
  let reachTried = 0;
  for (const seed of TILT_DEAL_V12.slice(0, 30)) {
    const m12 = tiltMazesB(seed)[0]!;
    const m11 = tiltMazesP(seed)[0]!;
    const key = m12.keys?.[0];
    if (key === undefined) continue;
    let dir = -1;
    for (let d = 0; d < 4; d++) {
      const i = (key % m12.n) + [1, 0, -1, 0][d]!;
      const j = Math.trunc(key / m12.n) + [0, 1, 0, -1][d]!;
      if (i < 0 || j < 0 || i >= m12.n || j >= m12.n || !m12.inside[j * m12.n + i]) continue;
      const nc = j * m12.n + i;
      const wall = d === 0 ? m12.wallR[key] : d === 1 ? m12.wallD[key] : d === 2 ? m12.wallR[nc] : m12.wallD[nc];
      if (!wall) dir = d;
    }
    if (dir < 0) continue;
    const c = tiltCellCentre(m12, key);
    const off = Math.trunc((m12.cs * 40) / 100);
    const at = { x: c.x + [1, 0, -1, 0][dir]! * off, y: c.y + [0, 1, 0, -1][dir]! * off };
    const put = (game: typeof v12, list: typeof m12[]) => {
      const s = game.init(seed) as TiltState;
      return game.step({ ...s, list: [list[0]!, ...s.list.slice(1)], x: at.x, y: at.y, vx: 0, vy: 0 }, null) as TiltState;
    };
    const t12 = put(v12, [m12]);
    const t11 = put(v11, [m11]);
    ok((t12.keysGot ?? 0) === 1 && (t11.keysGot ?? 0) === 0, `seed ${seed}: a marble 40 % of a cell from the key takes it on tiltRev 12 only (${t12.keysGot}, ${t11.keysGot})`);
    reachTried++;
  }
  ok(reachTried >= 10, `the key reach was tried on ${reachTried} mazes`);
  // The parts on bot and random runs, and the par countdown tick by tick.
  let pars = 0;
  let overSeen = 0;
  for (const [i, seed] of TILT_DEAL_V12.slice(40, 44).entries()) {
    for (const log of [randomLog(TILT_REV_BIG, seed, i + 3), botLog(TILT_REV_BIG, seed, "weak"), botLog(TILT_REV_BIG, seed, "good"), botLog(TILT_REV_BIG, seed, "elite")]) {
      let countdown = true;
      const s = play(seed, log, v12, (prev, next) => {
        if (next.ended) return;
        const m = next.list[next.level]!;
        const elapsed = next.tick - (next.mazeAt ?? 0);
        const over = tiltOverParT(next);
        if (next.level !== prev.level && (over !== 0 || tiltParLeftX(next) !== m.par)) countdown = false;
        if ((over > 0) !== (elapsed > m.par!) || (over > 0 && over !== elapsed - m.par!)) countdown = false;
        if (over > 0) overSeen++;
      });
      ok(countdown, `seed ${seed}: "Over par" only once the par has passed, never at a maze's start`);
      const met = (s.mazeTicks ?? []).filter((t, k) => t <= s.list[k]!.par!).length;
      ok(s.parsMet === met, `seed ${seed}: parsMet follows each maze's time against its par`);
      const p = tiltParParts(s);
      ok(v12.score(s) === Math.max(s.acted ? 1 : 0, Math.min(200, p.core + p.par + p.clean + p.speed)), `seed ${seed}: the score is tiltRev 11's parts' sum (${v12.score(s)})`);
      pars += met;
    }
  }
  ok(pars > 0 && overSeen > 0, `the scripted runs include mazes within par and time over par (${pars}, ${overSeen})`);
  const seed = TILT_DEAL_V12[3]!;
  ok(v12.score(play(seed, [])) === 0, "no input scores 0");
  ok(v12.score(play(seed, [{ t: 5, k: TILT_INPUT_DRAG, a: 200, b: 0, c: 1, d: 0 }])) >= 1, "one drag scores at least 1");
}

/* 4. The deal. */
section("the deal: every seed proved to 200 on tiltRev 12");
{
  const stored = JSON.parse(gunzipSync(readFileSync(TILT_DEAL_WITNESS)).toString()) as { rev: number; candidates: number; witnesses: TiltWitness[] };
  ok(stored.rev === TILT_REV_BIG && stored.candidates === TILT_BANK.length, `the witnesses are tiltRev 12's over the ${TILT_BANK.length} bank seeds`);
  ok(TILT_DEAL_V12.length >= 260 && new Set(TILT_DEAL_V12).size === TILT_DEAL_V12.length, `the deal holds 260 or more distinct seeds (${TILT_DEAL_V12.length})`);
  ok(JSON.stringify(TILT_DEAL_V12) === JSON.stringify(stored.witnesses.map((w) => w.seed)), "the deal is exactly the witnessed seeds, in order");
  let order = -1;
  let inOrder = true;
  for (const seed of TILT_DEAL_V12) {
    const at = TILT_BANK.indexOf(seed);
    if (at <= order) inOrder = false;
    order = at;
  }
  ok(inOrder, "every deal seed is a bank seed, in the bank's order");
  let proved = 0;
  for (const w of stored.witnesses) {
    const v = tiltDealVerdict(w);
    ok(v.score === 200 && !v.flagged && v.full, `seed ${w.seed}: the witness replays to ${v.score}${v.flagged ? " (flagged)" : ""}${v.full ? "" : " (a part short)"}`);
    if (v.score === 200 && v.full) proved++;
  }
  ok(proved === TILT_DEAL_V12.length, `all ${TILT_DEAL_V12.length} deal seeds proved at 200 (${proved})`);
  ok(dealFileText(TILT_DEAL_V12, TILT_BANK.length) === readFileSync("src/lib/duel/tiltDealV12.server.ts", "utf8"), "the deal file rebuilds from the witnesses byte for byte");
  console.log(`  ${proved} deal seeds proved at 200 (${TILT_BANK.length - TILT_DEAL_V12.length} of ${TILT_BANK.length} bank seeds dropped)`);
}

/* 5. Stored runs. */
section("stored tiltRev 12 runs replay through the server");
{
  const runs = load("scripts/fixtures/tilt-rev12-runs.json.gz").runs;
  ok(runs.length === 19 && runs.filter((r) => r.kind === "oracle").length === 4, `19 stored runs, 4 oracle (${runs.length})`);
  for (const run of runs) {
    const tag = `${run.seed} ${run.kind}`;
    const r = replayTiltRun(run.seed, run.raw, TILT_REV_BIG);
    ok(run.rev === TILT_REV_BIG && !r.flagged && r.desyncTick === null, `${tag}: replays unflagged (${r.reason ?? ""})`);
    ok(r.score === run.score && tiltStateDigest(r.state) === run.digest && jsonDigest(r.checkpoints) === run.checkpoints, `${tag}: stored ${run.score}, replays ${r.score}`);
    ok(r.state.big === 1 && r.score >= 1 && r.score <= 200, `${tag}: a tiltRev 12 state scoring 1–200 (${r.score})`);
    if (run.kind === "oracle") ok(r.score === 200 && (r.state.falls ?? 0) === 0, `${tag}: a perfect 200 with no fall`);
  }
}

/* 6. Rooms identical. */
section("rooms identical: the same mazes, pars, marbles and keys whatever is played");
{
  ok(roomIdentity.rev === TILT_REV_BIG, "the room-identity module plays tiltRev 12");
  for (const seed of [TILT_DEAL_V12[7]!, TILT_DEAL_V12[77]!]) {
    const logs = roomIdentity.logs(seed);
    const schedules = logs.map((l) => roomIdentity.scheduleOf(seed, TILT_REV_BIG, l));
    const reached = schedules.map((s) => new Set(s.map((e) => Math.floor(e.t / 100_000))));
    for (let i = 1; i < schedules.length; i++) {
      const common = (e: { t: number }) => reached[0]!.has(Math.floor(e.t / 100_000)) && reached[i]!.has(Math.floor(e.t / 100_000));
      ok(JSON.stringify(schedules[0]!.filter(common)) === JSON.stringify(schedules[i]!.filter(common)), `seed ${seed}: log ${i} meets the same mazes, pars, marbles and keys`);
    }
    ok(schedules[0]!.some((e) => /ball \d+, key reach \d+/.test(e.what)), `seed ${seed}: the schedule names the marble and the key reach`);
  }
}

/* 7. The reveal. */
section("the reveal");
{
  const runs = load("scripts/fixtures/tilt-rev12-runs.json.gz").runs;
  const o = runs.find((x) => x.kind === "oracle")!;
  const ro = replayTiltRun(o.seed, o.raw, TILT_REV_BIG);
  const rv = buildArcadeReveal("tilt", { ...ro, tiltRev: TILT_REV_BIG }, ro.score)!;
  const text = rv.lines.join(" | ");
  ok(rv.outcome === "finish" && text.includes("Par 4 / 4 mazes +24") && text.includes("clean 4 / 4 +12") && text.includes("speed +24"), `the perfect reveal: ${text}`);
  ok(rv.tiles.some((t) => t.label === "Under par" && t.value === "4 / 4"), `the reveal's tiles: ${JSON.stringify(rv.tiles)}`);
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL tilt-rev12-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS tilt-rev12-check: ${checks} checks — older stamps replay as before, tiltRev 11's mazes with bigger marbles and keys, the par countdown, every deal seed proved at 200, rooms identical`);
