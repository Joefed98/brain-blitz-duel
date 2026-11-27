/**
 * ricochet-ladder-check (D5, 23 Nov 2026; Joe's decisions of 23 Nov 2026; docs/arcade-standard/ricochet.md "ricoRev 5:
 * lines, limits and levels"): Moon Climb's Normal scoring refit and its levels, folded into the unshipped ricoRev 5.
 *
 *  1. Older rounds unchanged: every ricoRev 4 run recorded before ricoRev 5 at every level, and every ricoRev 3 run
 *     (scripts/fixtures/ricochet-mid-legacy.json.gz), grades through the server to the same score; ricoRev 4's level
 *     table (MOON_LEVELS) and parts are as before;
 *  2. the stamp and the pin: rooms deal ricoRev 5 at every level, the level stamped only off Normal (a Normal deal is
 *     byte for byte the deal with no level asked); the ricoPreMid pin deals ricoRev 4;
 *  3. the level rules as dealt: ricoRev 5's levels build their towers with ricoRev 4's settings (blades, shuriken pace,
 *     patches, ice, lanterns) and Hard's knock-down 3.5 m; Normal's lines (220 m, 4 Flow steps, 3 rides, 2 scrolls) and
 *     each level's own; the parts sum to 200 at every level; the registry (GAME_LEVELS.ricochet) mirrors the sim's table;
 *     a hit on Hard knocks the ninja down 3.5 m;
 *  4. the proof: every sampled dealt tower (12 a level, CHECKS_FULL=1 96) is built and kept only with a witness that keeps
 *     the human limits, checked here on its own (every input 9 ticks or more after the one before; every leap off a
 *     landing 3 or more after it; everything near its path in the camera's view 15 ticks before the input), and that
 *     witness scores exactly 200 through the server's grade on the dealt puzzle, with every part full and no hit; the
 *     camera the view test reads is the renderer's; ricoRev 4's frame-exact witnesses break the limits;
 *  5. the recorded 96-deal ladder (scripts/fixtures/d5-ladder-ricochet.json.gz,
 *     `bun scripts/d5-ladder-record.ts ricochet --deals=96`), and a live re-play sample (2 runs a level and player)
 *     scoring exactly as recorded; the proof player (the flawless skill-band level) scores 200 on every sampled deal;
 *  6. the practice challenges count the things themselves (all three scrolls, all six rides, 220 m on Hard), so the
 *     lower lines never make one easier.
 *
 *   bun scripts/ricochet-ladder-check.ts [--verbose]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  MODE_CLING, MODE_FLIGHT, MODE_RIDE, MOON_BIG_REV, MOON_HUMAN_LAND_TICKS, MOON_HUMAN_MOVE_TICKS, MOON_HUMAN_REACT_TICKS, MOON_LEVELS, MOON_MID_LEVELS,
  MOON_MID_LINES, MOON_MID_REV, MOON_MID_STD_SPEC, MOON_REV, MOON_SCROLLS, MOON_SKY, MOON_VIEW_ABOVE, MOON_VIEW_BELOW, NINJA_CHECKPOINT_INTERVAL, NINJA_INPUT_TAP,
  NINJA_KNOCK, NINJA_PX_PER_M, NINJA_WORLD_H, moonBuildDeal, moonBuildStats, moonCheckpoint, moonDeal, moonGameFor, moonStdSpecFor, moonViewCam, moonWitnessHuman,
  ninjaBodyFor, type MoonLevel, type MoonState,
} from "../src/lib/arcade/ricochetNinja";
import { ninjaCamera, ninjaScreenY } from "../src/lib/arcade/ricochetNinja.renderer";
import { encodeMoonRun } from "../src/lib/duel/ricochet";
import { generateRicochet, pinRicoPreMid } from "../src/lib/duel/arcade.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { challengesFor, goalMet } from "../src/lib/duel/practiceChallenges";
import { gameLevelSettings } from "../src/lib/levels/gameLevels";
import { puzzleLevel } from "../src/lib/levels/levels";
import { roomSeed } from "./arcade-skill-bands/games";
import { playDealt, replaySample } from "./d5-ladder-lib";

console.error = () => {};
let checks = 0;
const failures: string[] = [];
const VERBOSE = process.argv.includes("--verbose");
function ok(cond: boolean, label: string): void {
  checks++;
  if (VERBOSE) console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures.push(label);
}
const json = (v: unknown) => JSON.stringify(v);
const FULL = process.env.CHECKS_FULL === "1";
const N = FULL ? 96 : 12;
const LEVELS: (MoonLevel | null)[] = [null, "easy", "hard", "expert"];
const name = (lv: MoonLevel | null) => lv ?? "normal";
const tap = (t: number, a = 0): ArcadeInputEvent => ({ t, k: NINJA_INPUT_TAP, a, b: 0, c: 0, d: 0 });
const dealAt = (n: number, level: MoonLevel | null) => withSeededRandom(roomSeed(n), () => generatePuzzle("ricochet", { bankSeed: roomSeed(n), ...(level ? { level } : {}) })) as any;
function encode(rev: number, level: MoonLevel | null, seed: number, events: readonly ArcadeInputEvent[]): string {
  const game = moonGameFor(rev, level);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const cps = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % NINJA_CHECKPOINT_INTERVAL === 0) cps.push(moonCheckpoint(s));
  }
  return encodeMoonRun({ seed, claimedScore: game.score(s), events: [...events], endTick: s.tick, checkpoints: cps });
}

/* 1. Older rounds unchanged. */
{
  type Run = { rev: number; level: MoonLevel | null; seed: number; raw: string; score: number };
  const L = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/ricochet-mid-legacy.json.gz", import.meta.url))).toString()) as { runs: Run[] };
  const bad = L.runs.filter((r) => gradeAnswer({ type: "ricochet", seed: r.seed, ricoRev: r.rev, ...(r.level ? { level: r.level } : {}) } as any, r.raw, 0).score !== r.score);
  ok(L.runs.length === 150 && bad.length === 0, `1a: the 150 ricoRev 4 (every level) and ricoRev 3 runs recorded before ricoRev 5 grade to the same score (${bad.map((r) => `${r.rev}/${name(r.level)}/${r.seed}`).join(", ") || "all"})`);
  ok(MOON_LEVELS.hard.knock === NINJA_KNOCK && MOON_LEVELS.easy.fullM === 200 && MOON_LEVELS.hard.fullM === 245 && MOON_LEVELS.expert.fullM === 260, "1b: ricoRev 4's own table is unchanged (Hard 3 m, full heights 200 / 245 / 260 m)");
  ok(moonStdSpecFor(MOON_BIG_REV, null).parts[0]!.of === 245 && moonStdSpecFor(MOON_BIG_REV, "hard").parts[0]!.of === 245 && moonStdSpecFor(MOON_REV, null).parts[0]!.of === 245, "1c: ricoRev 4's and 3's height parts are still full at 245 m");
}

/* 2. The stamp and the pin. */
{
  ok(generateRicochet().ricoRev === MOON_MID_REV, "2a: rooms deal ricoRev 5");
  for (const lv of LEVELS) {
    const p = dealAt(4, lv);
    ok(p.ricoRev === MOON_MID_REV && puzzleLevel(p) === name(lv) && (lv ? p.level === lv : !("level" in p)), `2b ${name(lv)}: the deal is ricoRev 5, its level stamped only off Normal`);
  }
  const plain = withSeededRandom(roomSeed(7), () => generatePuzzle("ricochet", { bankSeed: roomSeed(7) })) as any;
  const normal = withSeededRandom(roomSeed(7), () => generatePuzzle("ricochet", { bankSeed: roomSeed(7), level: "normal" as never })) as any;
  ok(json(plain) === json(normal) && !("level" in normal), "2c: a Normal deal is byte for byte the deal with no level asked");
  const was = pinRicoPreMid(true);
  ok(generateRicochet().ricoRev === MOON_BIG_REV && dealAt(2, "hard").ricoRev === MOON_BIG_REV, "2d: the ricoPreMid pin deals ricoRev 4 (every level)");
  pinRicoPreMid(was);
}

/* 3. The level rules as dealt. */
{
  const L = MOON_MID_LINES;
  ok(L.fullM === 220 && L.flowFull === 4 && L.ridesFull === 3 && L.scrollsFull === 2 && L.coreMax + L.flowMax + L.ridesMax + L.scrollsMax === 200, "3a: Normal's lines: height 220 m, 4 Flow steps, 3 rides, 2 scrolls; 125 + 30 + 30 + 15 = 200");
  for (const lv of ["easy", "hard", "expert"] as MoonLevel[]) {
    const c = MOON_MID_LEVELS[lv];
    const o = MOON_LEVELS[lv];
    ok(c.blades === o.blades && c.pace === o.pace && c.patchGap === o.patchGap && c.ice === o.ice && c.sky === o.sky && c.skyVy === o.skyVy && c.salt === o.salt, `3b ${lv}: the towers are built with ricoRev 4's settings (blades ×${c.blades / 1000}, ${c.ice / 10} % ice, ${c.sky} lanterns)`);
    ok(c.knock === (lv === "hard" ? 140 : o.knock), `3c ${lv}: the knock-down ${c.knock / NINJA_PX_PER_M} m (Hard 3.5 m; ricoRev 4: ${o.knock / NINJA_PX_PER_M} m)`);
    const l = c.lines;
    ok(l.coreMax + l.flowMax + l.ridesMax + l.scrollsMax === 200 && l.ridesFull <= c.sky && l.scrollsFull <= MOON_SCROLLS && c.fullM === l.fullM && c.coreMax === l.coreMax, `3d ${lv}: the parts sum to 200 (height ${l.coreMax} full at ${l.fullM} m, flow 30 at ${l.flowFull}, rides ${l.ridesMax} at ${l.ridesFull} of ${c.sky}, scrolls 15 at ${l.scrollsFull})`);
    const spec = moonStdSpecFor(MOON_MID_REV, lv);
    ok(spec.parts.reduce((a, q) => a + q.max, 0) === 200 && spec.parts[0]!.of === l.fullM && spec.parts[2]!.of === c.sky, `3e ${lv}: the level's spec carries its lines`);
    const reg = gameLevelSettings<{ blades: number; ice: number; knockM: number; lanterns: number; fullM: number; flowFull: number; ridesFull: number; scrollsFull: number }>("ricochet", lv)!;
    ok(Math.round(reg.blades * 1000) === c.blades && Math.round(reg.ice * 1000) === c.ice && reg.knockM * NINJA_PX_PER_M === c.knock && reg.lanterns === c.sky && reg.fullM === l.fullM && reg.flowFull === l.flowFull && reg.ridesFull === l.ridesFull && reg.scrollsFull === l.scrollsFull, `3f ${lv}: GAME_LEVELS.ricochet mirrors the sim's table`);
  }
  ok(MOON_MID_LEVELS.easy.blades < 1000 && MOON_MID_LEVELS.hard.blades > 1000 && MOON_MID_LEVELS.expert.blades > MOON_MID_LEVELS.hard.blades, "3g: the lever: blades ×0.5 / ×1 / ×1.3 / ×1.6");
  ok(MOON_MID_LEVELS.hard.lines.fullM < MOON_MID_LINES.fullM && MOON_MID_LEVELS.expert.lines.fullM < MOON_MID_LEVELS.hard.lines.fullM, "3h: the lines step down with the blades (200 stays within reach on the harder towers)");
  // A hit on Hard: the knock-down is 3.5 m (and Normal's 3 m).
  for (const lv of [null, "hard"] as (MoonLevel | null)[]) {
    const g = moonGameFor(MOON_MID_REV, lv);
    const want = (lv ? MOON_MID_LEVELS[lv].knock : NINJA_KNOCK) * 256;
    // The first hit high enough up the tower that the knock-down isn't held at the floor, over a few tap rhythms.
    let found: MoonState | null = null;
    for (let every = 9; every <= 16 && !found; every++) {
      let s = g.init(5) as MoonState;
      while (!g.isOver(s) && !found) {
        const before = s.hits;
        s = g.step(s, (s.tick + 1) % every === 0 ? tap(s.tick + 1) : null) as MoonState;
        if (s.hits > before && s.y - ninjaBodyFor(MOON_MID_REV).start > want) found = s;
      }
    }
    ok(found !== null && found.y - found.knockTo === want, `3i ${name(lv)}: a hit knocks the ninja down ${want / 256 / NINJA_PX_PER_M} m (${found ? (found.y - found.knockTo) / 256 / NINJA_PX_PER_M : "no hit"} m)`);
  }
}

/* 4. The proof: every dealt tower's witness keeps the human limits and scores exactly 200. */
{
  ok(MOON_HUMAN_MOVE_TICKS === 9 && MOON_HUMAN_REACT_TICKS === 15 && MOON_HUMAN_LAND_TICKS === 3, "4a: the limits in ticks: 0.15 s to move (9), 0.25 s to react (15), a leap off a landing 3 or more after it");
  // The view test reads the renderer's camera.
  let camSame = 0;
  for (const yp of [0, 30, 100, 253, 400, 900, 5000, 12000]) {
    const s = { y: yp * 256 } as MoonState;
    const cam = ninjaCamera(s);
    if (cam === moonViewCam(yp) && ninjaScreenY(cam, cam + MOON_VIEW_ABOVE) === 0 && ninjaScreenY(cam, cam - MOON_VIEW_BELOW) === NINJA_WORLD_H) camSame++;
  }
  ok(camSame === 8, `4b: the witness's view test is the renderer's camera (ninjaCamera, the top and bottom rows; ${camSame} / 8)`);
  for (const lv of LEVELS) {
    const bad: string[] = [];
    let limits = 0;
    for (let n = 0; n < N; n++) {
      const p = dealAt(n, lv);
      const d = moonBuildDeal(p.seed, p.ricoRev, lv);
      const proved = moonBuildStats.proved;
      // The limits, checked here on their own: input gaps and the leap off each landing.
      const ev = [...d.witness].sort((a, b) => a.t - b.t);
      let gapOk = ev.every((e, i) => i === 0 || e.t - ev[i - 1]!.t >= MOON_HUMAN_MOVE_TICKS);
      const g = moonGameFor(MOON_MID_REV, lv);
      const at = new Map(ev.map((e) => [e.t, e.a]));
      let s = g.init(p.seed) as MoonState;
      let rest = 0;
      while (!g.isOver(s)) {
        const t = s.tick + 1;
        const a = at.get(t);
        if (a !== undefined && (s.mode === MODE_CLING || s.mode === MODE_RIDE) && t - rest < MOON_HUMAN_LAND_TICKS) gapOk = false;
        const was = s.mode;
        s = g.step(s, a === undefined ? null : tap(t, a)) as MoonState;
        if (was === MODE_FLIGHT && s.mode !== MODE_FLIGHT) rest = s.tick;
      }
      if (gapOk && moonWitnessHuman(d.tower, d.witness, MOON_MID_REV, lv)) limits++;
      const graded = gradeAnswer(p, encode(MOON_MID_REV, lv, p.seed, ev.map((e) => tap(e.t, e.a))), 0);
      const x = graded.extra as any;
      const sky = lv ? MOON_MID_LEVELS[lv].sky : MOON_SKY;
      const fullM = lv ? MOON_MID_LEVELS[lv].lines.fullM : MOON_MID_LINES.fullM;
      if (!proved || graded.score !== 200 || x?.flagged || x?.hits !== 0 || x?.rides !== sky || x?.scrolls !== MOON_SCROLLS || x?.metres < fullM) bad.push(`${p.seed}: ${graded.score}, ${x?.metres} m, ${x?.hits} hits${proved ? "" : ", unproved"}`);
      if (json(d) !== json(moonDeal(p.seed, p.ricoRev, lv))) bad.push(`${p.seed}: the cached deal differs`);
    }
    ok(limits === N, `4c ${name(lv)}: every sampled tower's witness keeps the human limits (${limits} / ${N})`);
    ok(bad.length === 0, `4d ${name(lv)}: every sampled tower's witness scores exactly 200 through the server's grade, every part full, no hit (${N} towers${bad.length ? `: ${bad.join("; ")}` : ""})`);
  }
  // ricoRev 4's frame-exact witnesses are not a person's: the limits refuse them.
  let refused = 0;
  for (let n = 0; n < 6; n++) {
    const d = moonDeal(roomSeed(n), MOON_BIG_REV, null);
    if (!moonWitnessHuman(d.tower, d.witness, MOON_BIG_REV, null)) refused++;
  }
  ok(refused === 6, `4e: ricoRev 4's frame-exact witnesses break the limits (${refused} / 6 refused)`);
}

/* 5. the recorded ladder, and a live re-play sample. */
{
  // The recorded 96-deal figures are reported, not targets (Joe, 27 Nov 2026: sessions don't decide difficulty), so this
  // check no longer holds them to the ladder test; it re-plays a sample to show the figures are today's game.
  for (const [cond, label] of await replaySample("ricochet", 2)) ok(cond, `5b: ${label}`);
  for (const lv of ["easy", "normal", "hard", "expert"] as const) {
    const scores: number[] = [];
    for (const n of [0, 13]) scores.push((await playDealt("ricochet", dealAt(n, lv === "normal" ? null : lv), "perfect")).score);
    ok(scores.every((s) => s === 200), `5c ${lv}: the proof player (the flawless skill-band level, the human-limited witness) scores 200 (${scores.join(", ")})`);
  }
}

/* 6. The practice challenges count the things themselves. */
{
  const ch = Object.fromEntries(challengesFor("ricochet").map((c) => [c.name, c]));
  const met = (n: string, extra: Record<string, number>, score = 150) => goalMet(ch[n]!.goal, { score, extra: { ricoRev: 5, ...extra } as never });
  ok(Boolean(ch["Scroll keeper"]) && met("Scroll keeper", { scrolls: 3, rides: 0, metres: 100, flow: 0 }) && !met("Scroll keeper", { scrolls: 2, rides: 6, metres: 300, flow: 10 }), "6a: Scroll keeper needs all three scrolls (two fill the part on ricoRev 5)");
  ok(Boolean(ch["Lantern lift"]) && met("Lantern lift", { rides: 6, scrolls: 0, metres: 100, flow: 0 }) && !met("Lantern lift", { rides: 5, scrolls: 3, metres: 300, flow: 10 }), "6b: Lantern lift needs all six rides (three fill the part)");
  ok(Boolean(ch["Moonwalker"]) && met("Moonwalker", { metres: 220, rides: 0, scrolls: 0, flow: 0 }) && !met("Moonwalker", { metres: 219, rides: 6, scrolls: 3, flow: 10 }), "6c: Moonwalker needs 220 m, Normal's full height (Hard's height fills at 190 m)");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL ricochet-ladder-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS ricochet-ladder-check: ${checks} checks`);
