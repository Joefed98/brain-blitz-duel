/**
 * ricochet-mid-check (D5, 22 Nov 2026; Joe's approval of 20 Nov 2026, the polish plan's row C3.5;
 * docs/arcade-standard/ricochet.md "ricoRev 5"): Moon Climb's ricoRev 5, the 30 × 60 ninja.
 *
 *  1. Older rounds unchanged: every ricoRev 4 tower (Normal, Easy, Hard and Expert) and ricoRev 3 tower recorded before
 *     the change (scripts/fixtures/ricochet-mid-legacy.json.gz, scripts/ricochet-mid-legacy-record.ts) deals the same
 *     tower, witness, witness metres and first state; every recorded run (random taps and the skill-band bots, weak to
 *     flawless) replays through the server's replay to the same score, state and checkpoints, unflagged, and grades
 *     (`gradeAnswer` on the stored puzzle) to the same score and extra; the parts' specs and bodies are as recorded;
 *     the deals rooms made at every level are the recorded puzzles under the `ricoPreMid` pin;
 *  2. the stamp and the pin: rooms deal ricoRev 5 at every level (the level stamped as before); `ricoPreMid` deals
 *     ricoRev 4 (and `ricoPreBig` still 3, winning over it); the pin is an era switch; DealOptions pins it for one
 *     call; the live bands, the standard's spec, the practice stamps and the intro demo's stamp follow;
 *  3. the body: 30 × 60 (half-widths 15 × 30) on rev 5 and later, 34 × 68 on exactly rev 4, 26 × 52 before; the cling
 *     x, the floor's standing height (metres measured from it), a wall-to-wall leap still NINJA_LEAP_TICKS, the ledge
 *     faces and the lantern hang follow it; the hit box is the body (a katana inside the 30 × 60 box but outside the
 *     26 × 52 one hits rev 5 and misses rev 3; one just outside it misses rev 5 and hits rev 4); the parts are rev 4's
 *     at every level under the new stamp and sum to 200; every part full scores 200;
 *  4. the figure follows the body: ninjaArtScale(5) = 15 / 13, the body's own growth; every pose's drawn extent is
 *     main's recorded figure's allowance grown by that scale (art-check 4a's rule for rev 4, at 15 / 13), between rev
 *     3's and rev 4's figure on every side; the stage's art game is the sim's rev-5 game at every level;
 *  5. every rev-5 tower proved at every level: each sampled dealt tower's witness scores exactly 200 through the
 *     server's grade with every part full and no hit; the towers are rev 5's own (not rev 4's); the same seed and level
 *     build the same tower fresh or cached; Moonwalker (245 m on Hard) is met on every sampled Hard tower;
 *  6. the 120 s rule and grace on rev 5 at every level (a run of hits lasts the minute); the skill-band bots' runs on
 *     rev 5 replay unflagged to the phone's own score, and the bands rise weak < great < flawless.
 *
 *   bun scripts/ricochet-mid-check.ts [--verbose]   (CHECKS_FULL=1: 40 towers a level, else 12)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createCanvas } from "@napi-rs/canvas";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  MOON_BIG_BODY, MOON_BIG_REV, MOON_BIG_STD_SPEC, MOON_LEDGE_HW, MOON_LEVELS, MOON_MID_BODY, MOON_MID_HH, MOON_MID_HW, MOON_MID_REV,
  MOON_MID_STD_SPEC, MOON_REV, MOON_SCROLLS, MOON_SKY, MOON_SKY_R, MOON_STD_SPEC, MOON_V5_BAND_CURVE, NINJA_BODY, NINJA_CHECKPOINT_INTERVAL,
  NINJA_HH, NINJA_HW, NINJA_INPUT_TAP, NINJA_LEAP_TICKS, NINJA_PX_PER_M, NINJA_RUN_TICKS, NINJA_WALL_L, NINJA_WALL_R, isMoonState,
  katanaTouches, moonBuildDeal, moonCheckpoint, moonDeal, moonGameFor, moonLedgeX, moonLeapTicks, moonMidGame, moonRideHang, moonStdSpecFor,
  ninjaBodyFor, ninjaMetres, type MoonLevel, type MoonState,
} from "../src/lib/arcade/ricochetNinja";
import { drawNinja, moonArtGameFor, moonBigArtGame, ninjaArtScale } from "../src/lib/arcade/ricochetNinja.renderer";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { ARCADE_STANDARD } from "../src/lib/arcade/standard";
import { decodeMoonRun, encodeMoonRun, replayMoonRun } from "../src/lib/duel/ricochet";
import { generateRicochet, pinRicoPreBig, pinRicoPreMid } from "../src/lib/duel/arcade.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { DEAL_PIN_NAMES, activeDealPins } from "../src/lib/duel/dealEra";
import { ACTION_DEMO_REVS } from "../src/lib/duel/introDemo.functions";
import { challengesFor, goalMet } from "../src/lib/duel/practiceChallenges";
import { puzzleTimeLimitMs } from "../src/lib/duel/catalogue";
import { MAX_ROUND_CLOCK_MS, puzzleLevel } from "../src/lib/levels/levels";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { bot as ricoBot } from "./arcade-skill-bands/bots/ricochet";

console.error = () => {};
let checks = 0;
const failures: string[] = [];
const VERBOSE = process.argv.includes("--verbose");
function ok(cond: boolean, label: string): void {
  checks++;
  if (VERBOSE) console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures.push(label);
}
const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);
const json = (v: unknown) => JSON.stringify(v);
/** The graded extra without the replay's own wall time (`diag.replayMs`), as the fixture recorded it. */
function stableExtra(extra: unknown): unknown {
  const e = (extra ?? {}) as Record<string, unknown>;
  const diag = e["diag"] as Record<string, unknown> | undefined;
  if (!diag || typeof diag !== "object") return e;
  const { replayMs: _ms, ...rest } = diag;
  return { ...e, diag: rest };
}
const tap =(t: number, a = 0): ArcadeInputEvent => ({ t, k: NINJA_INPUT_TAP, a, b: 0, c: 0, d: 0 });
const FULL = process.env.CHECKS_FULL === "1";
const N = FULL ? 40 : 12;
const LEVELS: (MoonLevel | null)[] = [null, "easy", "hard", "expert"];
const name = (lv: MoonLevel | null) => lv ?? "normal";

/** A run as the phone sends it (with checkpoints) on a stamp and level, and its checkpoint checksums. */
function encode(rev: number, level: MoonLevel | null, seed: number, events: readonly ArcadeInputEvent[]): { raw: string; sums: number[]; claimed: number } {
  const game = moonGameFor(rev, level);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const cps = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % NINJA_CHECKPOINT_INTERVAL === 0) cps.push(moonCheckpoint(s));
  }
  const claimed = game.score(s);
  return { raw: encodeMoonRun({ seed, claimedScore: claimed, events: [...events], endTick: s.tick, checkpoints: cps }), sums: cps.map((c) => c.checksum), claimed };
}
/** A Moon Climb deal at a level, as rooms and practice deal it (seeded Math.random, the room path). */
const dealAt = (n: number, level: string | null) => withSeededRandom(roomSeed(n), () => generatePuzzle("ricochet", { bankSeed: roomSeed(n), ...(level && level !== "normal" ? { level: level as never } : {}) })) as any;

ok(activeDealPins().length === 0, "0: nothing pinned at the start (the live deal)");

/* 1. Older rounds unchanged. */
{
  type Tower = { rev: number; level: MoonLevel | null; seed: number; tower: string; witness: string; metres: number; init: string };
  type Run = { rev: number; level: MoonLevel | null; seed: number; skill: string; raw: string; score: number; replayScore: number; flagged: boolean; state: string; sums: number[]; extra: string };
  const L = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/ricochet-mid-legacy.json.gz", import.meta.url))).toString()) as {
    towers: Tower[];
    runs: Run[];
    deals: { level: string; n: number; puzzle: Record<string, unknown> }[];
    specs: Record<string, unknown>;
    bodies: Record<string, unknown>;
  };
  ok(L.towers.length === 60 && L.runs.length === 150 && L.deals.length === 24, `1: the fixture holds 60 towers, 150 runs and 24 deals (${L.towers.length}, ${L.runs.length}, ${L.deals.length})`);
  for (const rev of [MOON_BIG_REV, MOON_REV])
    for (const lv of rev === MOON_BIG_REV ? LEVELS : [null]) {
      const ts = L.towers.filter((t) => t.rev === rev && t.level === lv);
      const bad = ts.filter((t) => {
        const d = moonDeal(t.seed, rev, lv);
        return digest(d.tower) !== t.tower || digest(d.witness) !== t.witness || d.witnessMetres !== t.metres || digest(moonGameFor(rev, lv).init(t.seed)) !== t.init;
      });
      ok(ts.length === 12 && bad.length === 0, `1a ricoRev ${rev} ${name(lv)}: the 12 towers recorded before ricoRev 5 deal the same tower, witness, metres and first state (${bad.map((t) => t.seed).join(", ") || "all"})`);
      const rs = L.runs.filter((r) => r.rev === rev && r.level === lv);
      const badRuns = rs.filter((r) => {
        const out = replayMoonRun(r.seed, r.raw, rev, lv);
        const g = moonGameFor(rev, lv);
        const at = new Map(decodeMoonRun(r.raw).events.map((e) => [e.t, e]));
        let s = g.init(r.seed);
        const sums: number[] = [];
        while (!g.isOver(s)) {
          s = g.step(s, at.get(s.tick + 1) ?? null);
          if (s.tick % NINJA_CHECKPOINT_INTERVAL === 0) sums.push(moonCheckpoint(s).checksum);
        }
        const graded = gradeAnswer({ type: "ricochet", seed: r.seed, ricoRev: rev, ...(lv ? { level: lv } : {}) } as any, r.raw, 0);
        return out.score !== r.replayScore || Boolean(out.flagged) !== r.flagged || digest(out.state) !== r.state || json(sums) !== json(r.sums) || graded.score !== r.score || digest(stableExtra(graded.extra)) !== r.extra;
      });
      ok(rs.length === 30 && badRuns.length === 0 && new Set(rs.map((r) => r.skill)).size === 6, `1b ricoRev ${rev} ${name(lv)}: the 30 runs recorded before ricoRev 5 replay and grade to the same score, state, checkpoints and extra (${badRuns.map((r) => `${r.seed}/${r.skill}`).join(", ") || "all"})`);
    }
  ok(L.runs.filter((r) => r.rev === MOON_REV).every((r) => replayMoonRun(r.seed, r.raw).score === r.replayScore), "1c: a stored round with no stamp argument still replays as ricoRev 3");
  ok(json(L.specs) === json({ normal4: moonStdSpecFor(MOON_BIG_REV, null), easy4: moonStdSpecFor(MOON_BIG_REV, "easy"), hard4: moonStdSpecFor(MOON_BIG_REV, "hard"), expert4: moonStdSpecFor(MOON_BIG_REV, "expert"), normal3: moonStdSpecFor(MOON_REV, null) }), "1d: ricoRev 4's parts at every level and ricoRev 3's are as recorded");
  ok(json(L.bodies) === json({ 2: ninjaBodyFor(2), 3: ninjaBodyFor(3), 4: ninjaBodyFor(4) }), "1e: the bodies of ricoRev 2, 3 and 4 are as recorded");
  const was = pinRicoPreMid(true);
  const badDeals = L.deals.filter((d) => json(dealAt(d.n, d.level)) !== json(d.puzzle));
  pinRicoPreMid(was);
  ok(badDeals.length === 0, `1f: under the ricoPreMid pin, rooms deal exactly the puzzles recorded before ricoRev 5 at every level (${badDeals.map((d) => `${d.level}/${d.n}`).join(", ") || "all 24"})`);
  const live = L.deals.filter((d) => json(dealAt(d.n, d.level)) !== json({ ...d.puzzle, ricoRev: MOON_MID_REV }));
  ok(live.length === 0, `1g: live, the same deals with ricoRev 5 in place of 4 and nothing else changed (${live.map((d) => `${d.level}/${d.n}`).join(", ") || "all 24"})`);
}

/* 2. The stamp and the pin. */
{
  ok(MOON_MID_REV === 5 && generateRicochet().ricoRev === MOON_MID_REV, "2a: rooms deal ricoRev 5");
  for (const lv of LEVELS) {
    const p = dealAt(3, lv);
    ok(p.ricoRev === MOON_MID_REV && puzzleLevel(p) === name(lv) && (lv ? p.level === lv : !("level" in p)), `2b ${name(lv)}: the deal is ricoRev 5 with the level stamped as before`);
  }
  let was = pinRicoPreMid(true);
  ok(generateRicochet().ricoRev === MOON_BIG_REV && dealAt(1, "hard").ricoRev === MOON_BIG_REV, "2c: the ricoPreMid pin deals ricoRev 4 (every level)");
  const wasBig = pinRicoPreBig(true);
  ok(generateRicochet().ricoRev === MOON_REV, "2d: with ricoPreBig on as well, ricoRev 3 (the earlier era wins)");
  pinRicoPreBig(wasBig);
  pinRicoPreMid(was);
  was = pinRicoPreBig(true);
  ok(generateRicochet().ricoRev === MOON_REV, "2e: the ricoPreBig pin alone still deals ricoRev 3");
  pinRicoPreBig(was);
  ok(activeDealPins().length === 0 && generateRicochet().ricoRev === MOON_MID_REV, "2f: the pins restored, ricoRev 5 again");
  ok(DEAL_PIN_NAMES.includes("ricoPreMid"), "2g: ricoPreMid is an era switch in DEAL_PINS");
  ok((generatePuzzle("ricochet", {}, { pins: ["ricoPreMid"] }) as any).ricoRev === MOON_BIG_REV && activeDealPins().length === 0, "2h: DealOptions pins ricoPreMid for one call only");
  ok(LIVE_BANDS.ricochet!.rev === MOON_MID_REV && LIVE_BANDS.ricochet!.std === MOON_MID_STD_SPEC && LIVE_BANDS.ricochet!.curve === MOON_V5_BAND_CURVE, "2i: the live bands carry ricoRev 5's spec and curve");
  ok(ARCADE_STANDARD.ricochet!.spec === MOON_MID_STD_SPEC, "2j: the standard's spec is ricoRev 5's");
  ok(/"ricochet": "[^"]*ricoRev=5/.test(readFileSync("src/lib/duel/practiceStamps.data.ts", "utf8")), "2k: the practice stamps carry ricoRev=5");
  ok(ACTION_DEMO_REVS.ricochet === MOON_MID_REV, "2l: the intro demo's stamp is ricoRev 5 (a ricoRev 4 demo stays stopped until one is recorded)");
}

/* 3. The body. */
{
  const B = MOON_MID_BODY;
  ok(B.hw === 15 && B.hh === 30 && MOON_MID_HW === 15 && MOON_MID_HH === 30, "3a: the body box 30 × 60 (half-widths 15 × 30)");
  ok(ninjaBodyFor(5) === B && ninjaBodyFor(6) === B && ninjaBodyFor(4) === MOON_BIG_BODY && ninjaBodyFor(3) === NINJA_BODY && ninjaBodyFor(2) === NINJA_BODY && ninjaBodyFor(undefined) === NINJA_BODY, "3b: rev 5 and later the 30 × 60 body, exactly rev 4 the 34 × 68, before the 26 × 52");
  ok(B.hw > NINJA_HW && B.hw < MOON_BIG_BODY.hw && B.hh > NINJA_HH && B.hh < MOON_BIG_BODY.hh && B.hw * NINJA_HH === B.hh * NINJA_HW, "3c: between the two, the old box's shape (× 15 / 13)");
  ok(B.clingX[0] === NINJA_WALL_L + 15 && B.clingX[1] === NINJA_WALL_R - 15 && B.start === (30 + 4) * 256 && B.gap === B.clingX[1] - B.clingX[0], "3d: the cling x, the floor's standing height and the gap follow the body");
  ok(moonLeapTicks(B.gap, B) === NINJA_LEAP_TICKS, "3e: a wall-to-wall leap is still NINJA_LEAP_TICKS");
  const ledge = { x: 195, lo: 400, hi: 520 };
  ok(moonLedgeX(ledge, 0, B) === 195 - MOON_LEDGE_HW - 15 && moonLedgeX(ledge, 1, B) === 195 + MOON_LEDGE_HW + 15, "3f: the ledge faces follow the body");
  ok(moonRideHang(5) === MOON_SKY_R + 30 - 4 && moonRideHang(4) === MOON_SKY_R + 34 - 4, "3g: the lantern hang follows the body");
  for (const lv of LEVELS) {
    const s = moonGameFor(5, lv).init(21) as MoonState;
    ok(s.rev === 5 && isMoonState(s) && s.x === B.clingX[0] && s.y === B.start && s.best === B.start && ninjaMetres(s) === 0 && (lv ? s.lvl === lv : !("lvl" in s)), `3h ${name(lv)}: a rev-5 run starts on the floor at the 30 × 60 body's place, 0 m, carrying its level`);
  }
  const s5 = moonGameFor(5).init(21) as MoonState;
  ok(ninjaMetres({ ...s5, best: B.start + 245 * NINJA_PX_PER_M * 256 }) === 245, "3i: metres are measured from the 30 × 60 body's floor height");
  // The hit box: a katana on the left wall, its blade's top edge placed against the box's bottom.
  const x = B.clingX[0];
  const y = 500;
  const kAt = (dy: number) => ({ wall: 0, y: y - dy });
  const reach = (k: { wall: number; y: number }, b: typeof B) => katanaTouches(k, x, y, 0, b);
  let inside = -1;
  let outside = -1;
  for (let dy = 0; dy < 120 && (inside < 0 || outside < 0); dy++) {
    if (inside < 0 && reach(kAt(dy), B) && !reach(kAt(dy), NINJA_BODY)) inside = dy;
    if (inside >= 0 && outside < 0 && !reach(kAt(dy), B)) outside = dy;
  }
  ok(inside >= 0 && outside >= 0 && reach(kAt(outside), MOON_BIG_BODY), `3j: the hit box is the 30 × 60 body: a blade ${inside} px below hits rev 5 and misses rev 3; one ${outside} px below misses rev 5 and hits rev 4`);
  ok(json(MOON_MID_STD_SPEC.parts) === json(MOON_STD_SPEC.parts) && json(MOON_MID_STD_SPEC.parts) === json(MOON_BIG_STD_SPEC.parts) && MOON_MID_STD_SPEC.rev === 5, "3k: Normal's parts are rev 4's (and 3's) exactly, under the new stamp");
  for (const lv of LEVELS) {
    const sp5 = moonStdSpecFor(5, lv);
    const sp4 = moonStdSpecFor(4, lv);
    ok(json(sp5.parts) === json(sp4.parts) && sp5.rev === 5 && sp5.parts.reduce((a, q) => a + q.max, 0) === 200, `3l ${name(lv)}: the parts are rev 4's at the level, under the new stamp, summing to 200`);
    const g = moonGameFor(5, lv);
    const c = lv ? MOON_LEVELS[lv] : null;
    const full = { ...(g.init(3) as MoonState), acted: 1, best: B.start + 300 * NINJA_PX_PER_M * 256, flow: 10, rides: c ? c.sky : MOON_SKY, scrolls: MOON_SCROLLS } as MoonState;
    ok(g.score(full) === 200 && g.score({ ...full, rides: 0 }) === 200 - sp5.parts[2]!.max, `3m ${name(lv)}: every part full scores 200 on rev 5 (less the rides part without them)`);
  }
}

/* 4. The figure follows the body. */
{
  const k = ninjaArtScale(5);
  ok(k === MOON_MID_HW / NINJA_HW && Math.abs(k - MOON_MID_HH / NINJA_HH) < 1e-9 && ninjaArtScale(4) === MOON_BIG_BODY.hw / NINJA_HW && ninjaArtScale(3) === 1, `4a: ricoRev 5 draws the figure at ${k.toFixed(4)} (15 / 13, the body's own growth); rev 4 at 17 / 13, rev 3 at 1`);
  const Z = 4;
  const ink = (scale: number, pose: number, face: number, tick: number) => {
    const C = 160;
    const c = createCanvas(C * Z, C * Z);
    const x = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    x.translate((C * Z) / 2, (C * Z) / 2);
    x.scale(Z, Z);
    drawNinja(x, 0, 0, pose, face, tick, pose === 2 ? 0.7 : 0, scale);
    const d = (x as any).getImageData(0, 0, C * Z, C * Z).data as Uint8ClampedArray;
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
    for (let yy = 0; yy < C * Z; yy++)
      for (let i = 0; i < C * Z; i++)
        if (d[(yy * C * Z + i) * 4 + 3]! > 40) {
          l = Math.min(l, i); r = Math.max(r, i); t = Math.min(t, yy); b = Math.max(b, yy);
        }
    const h = (C * Z) / 2;
    return [(h - l) / Z, (r + 1 - h) / Z, (h - t) / Z, (b + 1 - h) / Z];
  };
  const main = JSON.parse(readFileSync("scripts/fixtures/hero-bounds-main.json", "utf8")) as Record<string, number[]>;
  const over: string[] = [];
  const between: string[] = [];
  let worst = [0, 0, 0, 0];
  for (const pose of [0, 1, 2, 3, 4])
    for (const face of [1, -1])
      for (const tick of [0, 7, 19]) {
        const key = `ninja-p${pose}-f${face}-t${tick}`;
        const was = main[key]!;
        const e5 = ink(k, pose, face, tick);
        const e4 = ink(ninjaArtScale(4), pose, face, tick);
        const e3 = ink(1, pose, face, tick);
        e5.forEach((v, i) => {
          if (!(v <= (was[i]! + 0.5) * k + 0.25)) over.push(`${key} side ${i}: ${v.toFixed(2)} > ${((was[i]! + 0.5) * k).toFixed(2)}`);
          if (!(v >= e3[i]! - 0.25 && v <= e4[i]! + 0.25)) between.push(`${key} side ${i}: ${e3[i]} / ${v} / ${e4[i]}`);
        });
        const box = [MOON_MID_HW, MOON_MID_HW, MOON_MID_HH, MOON_MID_HH];
        worst = worst.map((w, i) => Math.max(w, e5[i]! - box[i]!));
      }
  ok(over.length === 0, `4b: every pose on rev 5 within main's figure's allowance grown by 15 / 13 (art-check 4a's rule; ${over.join("; ") || "all 30"})`);
  ok(between.length === 0, `4c: every pose on rev 5 drawn between rev 3's and rev 4's figure on every side (${between.join("; ") || "all 30"})`);
  if (VERBOSE) console.log(`     rev 5's figure past its box at most: ${worst.map((v) => v.toFixed(2)).join(" / ")} px (left / right / up / down)`);
  ok(moonArtGameFor(4) === moonBigArtGame && moonArtGameFor(5) !== moonBigArtGame, "4d: the stage's art game for rev 5 is its own (rev 4's unchanged)");
  for (const lv of LEVELS) {
    const art = moonArtGameFor(5, lv);
    ok(json(art.init(77)) === json(moonGameFor(5, lv).init(77)) && json(art.init(77)) !== json(moonArtGameFor(4, lv).init(77)) && json(moonArtGameFor(4, lv).init(77)) === json(moonGameFor(4, lv).init(77)), `4e ${name(lv)}: the stage plays the sim's rev-5 game (and rev 4's its own) at the level`);
  }
  ok(moonGameFor(5) === moonMidGame && moonGameFor(5, "normal") === moonMidGame && moonGameFor(5, "junk") === moonMidGame, "4f: rev 5 Normal (or junk) is the one rev-5 game");
}

/* 5. Every rev-5 tower proved at every level. */
{
  const moonwalker = challengesFor("ricochet").find((c) => c.name === "Moonwalker");
  for (const lv of LEVELS) {
    const bad: string[] = [];
    const walks: string[] = [];
    let own = 0;
    for (let n = 0; n < N; n++) {
      const p = dealAt(n, lv);
      const d = moonDeal(p.seed, p.ricoRev, lv);
      const { raw } = encode(MOON_MID_REV, lv, p.seed, d.witness.map((e) => tap(e.t, e.a)));
      const graded = gradeAnswer(p, raw, 0);
      const extra = graded.extra as any;
      const fullM = lv ? MOON_LEVELS[lv].fullM : 245;
      const sky = lv ? MOON_LEVELS[lv].sky : MOON_SKY;
      if (p.ricoRev !== 5 || graded.score !== 200 || extra?.flagged || extra?.hits !== 0 || extra?.rides !== sky || extra?.scrolls !== MOON_SCROLLS || extra?.metres < fullM) bad.push(`${p.seed}: ${graded.score}, ${extra?.metres} m, ${extra?.hits} hits`);
      if (lv === "hard" && moonwalker && !goalMet(moonwalker.goal, { score: graded.score, extra: graded.extra as never })) walks.push(String(p.seed));
      if (json(d.tower) !== json(moonDeal(p.seed, MOON_BIG_REV, lv).tower)) own++;
    }
    ok(bad.length === 0, `5a ${name(lv)}: every sampled rev-5 tower's witness scores exactly 200 through the server's grade, every part full, no hit (${N} towers${bad.length ? `: ${bad.join("; ")}` : ""})`);
    ok(own === N, `5b ${name(lv)}: the rev-5 towers are their own, built and proved with the 30 × 60 body (${own} of ${N} differ from rev 4's)`);
    if (lv === "hard") ok(Boolean(moonwalker) && walks.length === 0, `5c: Moonwalker's goal is met on every sampled rev-5 Hard tower${walks.length ? `: not on ${walks.join(", ")}` : ""}`);
    const fresh = moonBuildDeal(roomSeed(2), MOON_MID_REV, lv);
    ok(json(fresh) === json(moonDeal(roomSeed(2), MOON_MID_REV, lv)) && json(dealAt(2, lv)) === json(dealAt(2, lv)), `5d ${name(lv)}: the same seed and level deal the same puzzle and tower, built fresh or from the cache`);
    if (lv) ok(json(moonDeal(roomSeed(2), MOON_MID_REV, lv).tower) !== json(moonDeal(roomSeed(2), MOON_MID_REV).tower), `5e ${lv}: the level's rev-5 tower is its own (not Normal's)`);
  }
  ok(json(moonDeal(77, 5)) === json(moonDeal(77, 6)) && moonGameFor(6).init(3).rev === 5, "5f: a later stamp reads as ricoRev 5 (its towers and its state)");
}

/* 6. The 120 s rule, grace, and the bots' runs on rev 5. */
{
  for (const lv of LEVELS) {
    const game = moonGameFor(MOON_MID_REV, lv);
    const p = dealAt(5, lv);
    ok(game.runTicks === NINJA_RUN_TICKS && NINJA_RUN_TICKS <= 120 * 60 && puzzleTimeLimitMs(p) - 3000 <= MAX_ROUND_CLOCK_MS, `6a ${name(lv)}: the run is ${NINJA_RUN_TICKS / 60} s and the round's clock under 120 s`);
    let s = game.init(31) as MoonState;
    while (!game.isOver(s)) s = game.step(s, (s.tick + 1) % 12 === 0 ? tap(s.tick + 1) : null) as MoonState;
    ok(s.hits >= 3 && s.tick === NINJA_RUN_TICKS, `6b ${name(lv)}: a careless run's ${s.hits} hits never end it (it lasts the minute)`);
  }
  const med: number[] = [];
  const flagged: string[] = [];
  for (const level of ["weak", "great", "perfect"] as const) {
    const xs: number[] = [];
    for (const seed of [4100, 4197, 4294]) {
      const ev = ricoBot({ game: moonGameFor(5) as any, seed, rev: MOON_MID_REV, human: new Human("ricochet", seed, level as any), fixes: true }).events ?? [];
      const { raw, claimed } = encode(MOON_MID_REV, null, seed, ev);
      const out = replayMoonRun(seed, raw, MOON_MID_REV);
      if (out.flagged || out.score !== claimed) flagged.push(`${level}/${seed}`);
      xs.push(out.score);
    }
    med.push(xs.sort((a, b) => a - b)[1]!);
  }
  ok(flagged.length === 0, `6c: the bots' rev-5 runs replay unflagged to the phone's own score (${flagged.join(", ") || "all"})`);
  ok(med[0]! < med[1]! && med[1]! < med[2]! && med[2] === 200, `6d: weak < great < flawless on rev 5 (${med.join(" < ")})`);
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL ricochet-mid-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS ricochet-mid-check: ${checks} checks`);
