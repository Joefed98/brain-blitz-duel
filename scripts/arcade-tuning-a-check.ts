/**
 * Tuning A (Oct 2026): High Rise, Wavefront wavRev 4, Orbit orbitRev 6,
 * Grappler swingRev 6, Tilt.
 *
 *  1. Old rounds: 40 real runs recorded with the code before Tuning A on each
 *     game's then-live revision (scripts/fixtures/arcade-tuning-a-legacy.json,
 *     scripts/arcade-tuning-a-legacy.ts) replay through today's server path to
 *     the same score and the same final state, unflagged.
 *  2. Per game, the new rules: shapes, fly-in, the earlier end to a miss (it
 *     never ends a flight that could still be caught), touch stars on proved
 *     lines and 150 through the server replay, the 2 s crumble, every Tilt cup
 *     reachable, the stamps new rounds carry, and the display-only pieces.
 *
 *   bun scripts/arcade-tuning-a-check.ts          (TUNING_A_ONLY=wavefront,orbit,…; CHECKS_FULL=1 for full depth)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv, TUNING_A_GAMES, type TuningARecord } from "./arcade-tuning-a-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { BAND_STAMPS, puzzleUsesBands } from "../src/lib/arcade/bandParts";
import { recordInput } from "../src/lib/arcade/engine";
import {
  wavCheckpoint,
  wavForm,
  wavFormSize,
  wavefrontGameFor,
  wavShapeBox,
  WAV_ARMOUR_BY_WAVE,
  WAV_ARMOUR_CODE,
  WAV_CELL,
  WAV_FORMS,
  WAV_REV_BAND,
  WAV_REV_SHAPES,
  WAV_SHAPES,
  WAV_V2_WAVES,
  WAV_WORLD_W,
  type WavState,
} from "../src/lib/arcade/wavefront";
import { encodeWavefrontRun, replayWavefrontRun } from "../src/lib/duel/wavefront";
import { orbitCanSetCheckpoint, orbitCheckpoint, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP, ORBIT_REV_BAND, ORBIT_REV_TUNED, ORBIT_REV_XP, ORBIT_TOTAL, orbitPos } from "../src/lib/arcade/orbit";
import {
  decodeOrbitHoles,
  decodeRev3Planets,
  initBandFrom,
  initTunedFrom,
  orbitPastReach,
  orbitRev3Game,
  orbitWarpPos,
  ORBIT_REV3_WORLD_W,
  ORBIT_WARP_OUT,
  ORBIT_WARP_TICKS,
  type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";
import { encodeOrbitRun, replayOrbitRun } from "../src/lib/duel/orbit";
import { ORBIT_HOLE_BANK } from "../src/lib/duel/orbitHoleBank.server";
import { ORBIT_REV3_BANK } from "../src/lib/duel/orbitRev3Bank.server";
import {
  swingCheckpoint,
  swingGameFor,
  swingMetres,
  swingStarTotal,
  SWING_CHASE_PACE,
  SWING_JET_HALF_W,
  SWING_REV_BAND,
  SWING_REV_TUNED,
  SWING_ROCK_LEAD_V6,
  SWING_ROCK_WARN,
  SWING_ROCK_WARN_V6,
  SWING_STARS,
  SWING_STAR_TOUCH,
  type SwingState,
} from "../src/lib/arcade/swing";
import { encodeSwingRun, replaySwingRun } from "../src/lib/duel/swing";
import { SWING_V4_BANK } from "../src/lib/duel/swingBankV4.server";
import { proveSwingSeedV4 } from "../src/lib/duel/swingProof.server";
import { tiltCupReachable, tiltDealableX, tiltGameFor, tiltSeedCupsReachable, TILT_REV_BAND, TILT_REV_EXPAND } from "../src/lib/arcade/tilt";
import { generateOrbit, generateSkyline, generateSwing, generateTilt, generateWavefront } from "../src/lib/duel/arcade.server";
import { skylineGameFor, SKYLINE_REV_EXPAND, SKYLINE_REV_LIFT, SKYLINE_REV_TALL } from "../src/lib/arcade/skyline";
import { APP_FLAG_LOGO_URL } from "../src/lib/brand";
import { PUZZLE_INSTRUCTIONS as INSTRUCTIONS } from "../src/lib/duel/instructions";
import { playRevOf } from "./scoring-targets-revs";

const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
const ONLY = (process.env.TUNING_A_ONLY ?? "").split(",").filter(Boolean);
const want = (type: string) => ONLY.length === 0 || ONLY.includes(type);
const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const section = (name: string) => console.log(`— ${name}`);
const FP = 256;

/* =============================== 1. Old rounds =============================== */
section("Old rounds replay and score exactly as before");
{
  const fixture = JSON.parse(readFileSync("scripts/fixtures/arcade-tuning-a-legacy.json", "utf8")) as { runs: TuningARecord[] };
  const per = new Map<string, number>();
  for (const run of fixture.runs) {
    if (!want(run.type)) continue;
    const spec = GAME_BY_TYPE.get(run.type as never)!;
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = spec.replay(run.seed, raw, run.rev);
    ok(result.score === run.score && !result.flagged, `${run.type} ${run.level} ${run.seed}: stored ${run.score}, replays ${result.score}${result.flagged ? " (flagged)" : ""}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `${run.type} ${run.level} ${run.seed}: the replayed final state changed`);
    per.set(run.type, (per.get(run.type) ?? 0) + 1);
  }
  for (const type of TUNING_A_GAMES) if (want(type)) ok((per.get(type) ?? 0) >= 8, `${type}: ${per.get(type) ?? 0} recorded runs`);
}

/* ============================== 2a. High Rise ============================== */
if (want("skyline")) {
  section("High Rise: logo flag, wind unchanged");
  // Tuning A changed no High Rise play; Tuning E (Oct 2026) later stamps its taller view, skylineRev 4, with the same play and curve.
  // Expansion E4 (25 Oct 2026) moved High Rise rooms on to skylineRev 7 (e4-expansion-check covers it); skylineRev 4, which
  // stored rounds play, keeps the band play and curve (Tuning E's taller view only).
  ok(generateSkyline().skylineRev === SKYLINE_REV_LIFT, "new High Rise rounds are dealt skylineRev 8 (expansion E4 on a gentler curve)");
  ok(skylineGameFor(SKYLINE_REV_TALL).score === skylineGameFor(BAND_STAMPS.skyline![1]).score, "High Rise skylineRev 4 keeps the band play and curve (Tuning E's taller view only)");
  // Prompt R (23 Oct 2026): the manifest holds the new icon in three files (192, 512, maskable); the flag draws its
  // 512 px "any" icon (APP_FLAG_LOGO_URL), so the PWA icon and the flag are still one logo file.
  ok(APP_FLAG_LOGO_URL.startsWith("/") && existsSync(`public${APP_FLAG_LOGO_URL}`), `the app logo file ${APP_FLAG_LOGO_URL} exists`);
  const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as { icons: { src: string; purpose?: string; sizes?: string }[] };
  ok(manifest.icons.some((i) => i.src === APP_FLAG_LOGO_URL && i.purpose === "any" && i.sizes === "512x512"), "the PWA icon is the same logo file the flag draws");
  const art = readFileSync("src/lib/arcade/skyline.renderer.ts", "utf8");
  ok(art.includes("APP_FLAG_LOGO_URL") && !art.includes("FLAG_RED") && !art.includes("FLAG_WHITE"), "the flag draws the app logo, not red and white");
  const sim = readFileSync("src/lib/arcade/skyline.ts", "utf8");
  ok(!sim.includes("APP_FLAG_LOGO_URL") && !sim.includes("APP_LOGO_URL"), "the logo is render-only (the sim never sees it)");
}

/* ============================== 2b. Wavefront ============================== */
if (want("wavefront")) {
  section("Wavefront wavRev 4: shaped formations");
  // Taller worlds batch 1 (16 Oct 2026) moved Wavefront on to wavRev 6 (arcade-tuning-g1-check).
  // Taller worlds batch 1 moved Wavefront on to wavRev 6, and the 200 expansion (26 Oct 2026) on to wavRev 10
  // (wavefront-expand-check), which still flies the shapes (with escorts).
  ok(generateWavefront().wavRev === WAV_REV_SHAPES + 6 && wavefrontGameFor(WAV_REV_SHAPES + 6).init(1).shaped === 1, "new Wavefront rounds are stamped wavRev 10 (the expansion, after the taller world's wavRev 6), still shaped");
  ok(puzzleUsesBands({ type: "wavefront", wavRev: WAV_REV_SHAPES }) && puzzleUsesBands({ type: "wavefront", wavRev: WAV_REV_BAND }), "wavRev 3 and 4 both score on the band curve");
  for (let wave = 2; wave <= WAV_V2_WAVES; wave++) {
    const form = WAV_FORMS[wave]!;
    const [cells] = WAV_ARMOUR_BY_WAVE[wave - 2]!;
    const size = wavFormSize(wave);
    ok(form.length === WAV_SHAPES, `wave ${wave}: ${form.length} ships, the grid's ${WAV_SHAPES}`);
    ok(size.w <= WAV_WORLD_W - 2 * 8 - 8 * 4, `wave ${wave}: ${size.w} px wide leaves room to march`);
    // The armour core: two rows on the 44 × 36 grid pitch, slot 0 its top-left cell.
    const w = cells / 2;
    let core = true;
    for (let i = 0; i < cells; i++) {
      const [x, y] = form[i]!;
      core &&= x === form[0]![0] + (i % w) * 44 && y === form[0]![1] + Math.trunc(i / w) * 36;
    }
    ok(core, `wave ${wave}: the ${cells} armour cells form its ${w} × 2 core`);
    let overlap = 0;
    let unique = true;
    for (let i = 0; i < form.length; i++)
      for (let j = i + 1; j < form.length; j++) {
        const dx = Math.abs(form[i]![0] - form[j]![0]);
        const dy = Math.abs(form[i]![1] - form[j]![1]);
        if (dx === 0 && dy === 0) unique = false;
        if (dx < WAV_CELL && dy < WAV_CELL) overlap = Math.max(overlap, Math.min(WAV_CELL - dx, WAV_CELL - dy));
      }
    ok(unique && overlap <= 8, `wave ${wave}: ships at distinct places, boxes overlap at most 8 px (${overlap})`);
    // The outline ships sit around the core, never inside it.
    const cx0 = form[0]![0], cy0 = form[0]![1], cx1 = form[cells - 1]![0] + WAV_CELL, cy1 = form[cells - 1]![1] + WAV_CELL;
    ok(form.slice(cells).every(([x, y]) => x + WAV_CELL <= cx0 || x >= cx1 || y + WAV_CELL <= cy0 || y >= cy1), `wave ${wave}: outline ships clear of the armour core`);
  }
  // Waves in play: wave 1 is the grid, waves 2-5 their shapes with the armour core, through the server replay.
  const game = wavefrontGameFor(WAV_REV_SHAPES);
  const legacy = wavefrontGameFor(WAV_REV_BAND);
  ok(JSON.stringify({ ...game.init(7), shaped: undefined }) === JSON.stringify({ ...legacy.init(7), shaped: undefined }), "wave 1 is the rev-3 grid (same ships, same draws)");
  {
    let s = game.init(11) as WavState;
    const seenWaves = new Set<number>();
    for (let k = 0; k < 4000 && !s.ended && s.wave <= WAV_V2_WAVES; k++) {
      if ((s.enter ?? 0) === 0 && s.wave === 1) s = { ...s, shapes: s.shapes.map(() => 0) };
      else if ((s.enter ?? 0) === 0 && s.wave >= 2 && !seenWaves.has(s.wave)) {
        seenWaves.add(s.wave);
        const form = wavForm(s)!;
        ok(Boolean(form) && wavShapeBox(s, 5).x === s.fx + form[5]![0] && wavShapeBox(s, 5).y === s.fy + form[5]![1], `wave ${s.wave}: ships sit on its shape`);
        const [cells, hp] = WAV_ARMOUR_BY_WAVE[s.wave - 2]!;
        ok(s.shapes.slice(0, cells).every((c) => c === WAV_ARMOUR_CODE) && s.armour?.maxHp === hp, `wave ${s.wave}: the armour core has ${cells} cells and ${hp} hits`);
        // Clear the wave by hand to move on (the sim then deals the next one).
        s = { ...s, shapes: s.shapes.map(() => 0), armour: null };
      }
      s = game.step(s, null) as WavState;
    }
    ok(seenWaves.size === 4, `waves 2-5 all flew their shapes (${[...seenWaves].join(", ")})`);
  }
  // A real 150 on wavRev 4 through the server replay (near-perfect skill-band player).
  {
    const spec = GAME_BY_TYPE.get("wavefront")!;
    const { bot } = await import("./arcade-skill-bands/bots/wavefront");
    let best = 0;
    for (let n = 0; n < 12 && best < 150; n++) {
      const seed = spec.seedFor(n);
      const g = spec.gameFor(WAV_REV_SHAPES, seed);
      const out = bot({ game: g, seed, rev: WAV_REV_SHAPES, human: new Human("wavefront", seed, "near") });
      let st = g.init(seed);
      const checkpoints: unknown[] = [];
      const byTick = new Map(out.events!.map((e) => [e.t, e]));
      while (!g.isOver(st) && st.tick < g.runTicks) {
        st = g.step(st, byTick.get(st.tick + 1) ?? null);
        if (st.tick % 300 === 0) checkpoints.push(wavCheckpoint(st));
      }
      const r = replayWavefrontRun(seed, encodeWavefrontRun({ seed, claimedScore: g.score(st), events: out.events!, endTick: st.tick, checkpoints: checkpoints as never }), WAV_REV_SHAPES);
      ok(!r.flagged && r.score === g.score(st), `wavefront ${seed}: the server replay agrees (${r.score})`);
      best = Math.max(best, r.score);
    }
    ok(best === 150, `a near-perfect run scores 150 on wavRev 4 through the server replay (best ${best})`);
  }
  // The SAUCER! pop is anchored where the saucer was hit, not at the cleared saucerX (0).
  {
    const fx = readFileSync("src/lib/arcade/arcadeFxGames.renderer.ts", "utf8");
    ok(/if \(b\.c === 3\) x = b\.x/.test(fx), "the saucer pop reads the saucer's burst position");
    const paint = readFileSync("src/lib/arcade/arcadeFx.renderer.ts", "utf8");
    ok(/measureText\(pop\.text\)/.test(paint) && /clip\.x \+ clip\.w - half/.test(paint), "every arcade pop is clamped inside the arena");
  }
  const help = INSTRUCTIONS.wavefront!;
  ok(help.how.some((h) => /triangle, a circle, a pentagon and an octagon/.test(h.detail)), "the help names the shapes");
}

/* ================================ 2c. Orbit ================================ */
if (want("orbit")) {
  section("Orbit orbitRev 6: black-hole fly-in, earlier end to a miss");
  {
    const p = generateOrbit();
    // Tuning F (Oct 2026) moved rooms on to orbitRev 7 (rev-6 play with swept black holes), and taller worlds batch 3
    // (16 Oct 2026) to orbitRev 8 (rev 7 in a taller view); arcade-tuning-f-check and arcade-tuning-g3-check cover them.
    // The expansion to 200 (docs/expansions/x200-orbit.md) then moved rooms on to orbitRev 12; orbit-expand-check covers it.
    ok(p.orbitRev === ORBIT_REV_XP && p.planets?.length === ORBIT_TOTAL + 1, "new Orbit rounds are stamped orbitRev 12 (the expansion to 200) with their planets");
  }
  const bankBySeed = new Map(ORBIT_REV3_BANK.map((e) => [e.seed, e]));
  const courses = ORBIT_HOLE_BANK.slice(0, FULL ? 40 : 6);
  const tap = (t: number) => ({ t, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
  let missesCut = 0;
  let ticksSaved = 0;
  let forks = 0;
  for (const entry of courses) {
    const course = bankBySeed.get(entry.seed)!;
    const planets = decodeRev3Planets(course.planets);
    const holes = decodeOrbitHoles(entry.holes);
    // The fly-in: the hole witness's first jump on rev 6 eases from ORBIT_WARP_OUT outside the orbit into it over 60 ticks.
    {
      let s = initTunedFrom(planets, ORBIT_REV3_WORLD_W, holes);
      const witness = new Set(entry.taps);
      while (!s.ended && (s.jumps ?? 0) === 0) s = orbitRev3Game.step(s, witness.has(s.tick + 1) ? tap(s.tick + 1) : null) as OrbitRev3State;
      ok((s.jumps ?? 0) === 1 && s.warp === ORBIT_WARP_TICKS, `course ${entry.seed}: the first hole starts a ${ORBIT_WARP_TICKS}-tick fly-in`);
      const to = planets[s.cur]!;
      const d0 = Math.hypot(s.x - orbitPos(to, s.angle).x, s.y - orbitPos(to, s.angle).y);
      ok(Math.abs(d0 - ORBIT_WARP_OUT) <= 2 * FP, `course ${entry.seed}: it comes out ${Math.round(d0 / FP)} px outside its orbit`);
      ok(!orbitCanSetCheckpoint(s as never), "no checkpoint while flying in");
      let prev = d0;
      let monotone = true;
      let ignored = true;
      for (let k = 0; k < ORBIT_WARP_TICKS; k++) {
        // A tap mid fly-in does nothing; the rocket keeps easing in.
        const next = orbitRev3Game.step(s, k === 10 ? tap(s.tick + 1) : k === 20 ? { t: s.tick + 1, k: ORBIT_INPUT_CHECKPOINT, a: 0, b: 0, c: 0, d: 0 } : null) as OrbitRev3State;
        if (next.flying !== 0 || next.checkpoint !== s.checkpoint) ignored = false;
        s = next;
        const d = Math.hypot(s.x - orbitPos(to, s.angle).x, s.y - orbitPos(to, s.angle).y);
        if (d > prev + FP) monotone = false;
        prev = d;
      }
      ok(ignored, `course ${entry.seed}: taps and the checkpoint wait until the rocket is in orbit`);
      ok(monotone && s.warp === 0 && s.x === orbitPos(to, s.angle).x && s.y === orbitPos(to, s.angle).y, `course ${entry.seed}: it settles into the orbit in exactly ${ORBIT_WARP_TICKS} ticks`);
      ok(orbitWarpPos(to, s.angle, 0).x === orbitPos(to, s.angle).x, "no offset once the fly-in ends");
    }
    // Every planet the plain proof visits: fork a release at each of 80 consecutive ticks on rev 5 and rev 6.
    // A flight rev 5 catches is caught identically on rev 6; a miss ends no later, never past what could still catch it.
    {
      let band = initBandFrom(planets, ORBIT_REV3_WORLD_W, holes);
      let tuned = initTunedFrom(planets, ORBIT_REV3_WORLD_W, holes);
      const taps = new Set(course.taps);
      for (let t = 1; !band.ended && t < 6000; t++) {
        if (band.flying === 0 && t % 3 === 0 && band.cur < ORBIT_TOTAL && (t % (FULL ? 3 : 9) === 0)) {
          let a = orbitRev3Game.step(band, tap(t)) as OrbitRev3State;
          let b = orbitRev3Game.step(tuned, tap(t)) as OrbitRev3State;
          let same = true;
          while (a.flying > 0 && !a.ended && a.respawnTick !== a.tick) {
            a = orbitRev3Game.step(a, null) as OrbitRev3State;
            if (b.flying > 0 && !b.ended) b = orbitRev3Game.step(b, null) as OrbitRev3State;
          }
          // Reaching the sun ends the run as a finish, which counts as caught too.
          const caught = (a.ended === 0 && a.flying === 0 && a.cur > band.cur) || a.finished === 1;
          if (caught) same = b.cur === a.cur && b.tick === a.tick && (b.jumps ?? 0) === (a.jumps ?? 0) && b.finished === a.finished;
          else {
            same = b.ended === 2 && b.endedTick <= a.endedTick;
            if (same) {
              missesCut++;
              ticksSaved += a.endedTick - b.endedTick;
            }
          }
          forks++;
          ok(same, `course ${entry.seed} planet ${band.cur} tick ${t}: rev 6 ${caught ? "catches differently" : "ends a miss later"} than rev 5`);
        }
        const ev = taps.has(t) ? tap(t) : null;
        band = orbitRev3Game.step(band, ev) as OrbitRev3State;
        tuned = orbitRev3Game.step(tuned, ev) as OrbitRev3State;
      }
      ok(band.finished === 1 && tuned.finished === 1 && tuned.endedTick === band.endedTick, `course ${entry.seed}: the plain proof finishes identically on rev 6`);
      // The miss rule's own invariant along a dying flight: once past reach, nothing catches it later (rev 5 replay).
    }
    // 150 through the server replay on rev 6: the course's own proof taps (no holes taken).
    {
      let s = initTunedFrom(planets, ORBIT_REV3_WORLD_W, holes);
      const events: any[] = [];
      const checkpoints: unknown[] = [];
      const taps = new Set(course.taps);
      while (!orbitRev3Game.isOver(s)) {
        const ev = taps.has(s.tick + 1) ? tap(s.tick + 1) : null;
        if (ev) events.push(ev);
        s = orbitRev3Game.step(s, ev) as OrbitRev3State;
        if (s.tick % 300 === 0) checkpoints.push(orbitCheckpoint(s as never));
      }
      const r = replayOrbitRun(entry.seed, encodeOrbitRun({ seed: entry.seed, claimedScore: orbitRev3Game.score(s), events, endTick: s.tick, checkpoints: checkpoints as never }), ORBIT_REV_TUNED, course.planets, entry.holes);
      ok(!r.flagged && r.finished && r.score === orbitRev3Game.score(s), `course ${entry.seed}: the server replay of a finish agrees (${r.score})`);
      if (s.endedTick <= 45 * 60) ok(r.score === 150, `course ${entry.seed}: a finish with half the time left scores 150 (${r.score})`);
    }
  }
  ok(missesCut > 0, `misses end sooner (${missesCut} of ${forks} forked releases missed; ${missesCut ? Math.round(ticksSaved / missesCut) : 0} ticks sooner on average)`);
  // The rule itself: a flight past every reach can never get back within reach.
  {
    const entry = ORBIT_HOLE_BANK[0]!;
    const planets = decodeRev3Planets(bankBySeed.get(entry.seed)!.planets);
    let s = initTunedFrom(planets, ORBIT_REV3_WORLD_W, decodeOrbitHoles(entry.holes));
    s = orbitRev3Game.step(s, tap(1)) as OrbitRev3State;
    while (s.flying > 0 && !s.ended && !orbitPastReach(s)) s = orbitRev3Game.step(s, null) as OrbitRev3State;
    ok(s.ended === 2 || s.flying === 0, "a release at tick 1 either lands or ends once it is past reach");
  }
  ok(puzzleUsesBands({ type: "orbit", orbitRev: ORBIT_REV_TUNED }) && puzzleUsesBands({ type: "orbit", orbitRev: ORBIT_REV_BAND }), "orbitRev 5 and 6 both score on the band curve");
  const footer = readFileSync("src/puzzles/orbit.tsx", "utf8");
  // Superseded 15 Oct 2026 (arcade play screen): the 44 px row ends 16 px above the visible bottom, as every arcade control row.
  ok(/data-game-controls="checkpoint" className="flex h-11 shrink-0 items-center justify-center">/.test(footer) && /className="h-11 px-3 text-\[11px\] /.test(footer), "SET CHECKPOINT: a 44 px row ending 16 px above the bottom, still 44 px tall, narrower since 15 Oct 2026");
}

/* =============================== 2d. Grappler =============================== */
if (want("swing")) {
  section("Grappler swingRev 6: touch stars, crumbling stalactites");
  // Tuning F (Oct 2026) moved new Grappler rounds on to swingRev 8 (evenly spread stars); swing-rev8-check covers it.
  // Taller worlds batch 3 (16 Oct 2026) moved rooms on to swingRev 9 (the taller cavern); arcade-tuning-g3-check covers it.
  // Grappler's 200 expansion (26 Oct 2026) moved rooms on to swingRev 13 (swing-x200-check).
  ok(playRevOf("swing", generateSwing().swingRev) === SWING_REV_TUNED + 8, "new Grappler rounds are stamped swingRev 14 (the assault course, after swingRev 6, 7, 8, 9 and 13)");
  ok(puzzleUsesBands({ type: "swing", swingRev: SWING_REV_TUNED }) && puzzleUsesBands({ type: "swing", swingRev: SWING_REV_BAND }), "swingRev 5 and 6 both score on the band curve");
  ok(SWING_CHASE_PACE === 4 * FP, "the chasing dragon keeps its pace (4 px a tick)");
  ok(SWING_ROCK_WARN === 60 && SWING_ROCK_WARN_V6 === 120, "stalactites crumble for 2 s on rev 6 (1 s before)");
  const tuned = swingGameFor(SWING_REV_TUNED);
  const band = swingGameFor(SWING_REV_BAND);
  const seeds = SWING_V4_BANK.slice(0, FULL ? SWING_V4_BANK.length : 12).map((e) => e.seed);
  for (const seed of seeds) {
    const a = band.init(seed);
    const b = tuned.init(seed);
    ok(JSON.stringify(a.anchors) === JSON.stringify(b.anchors) && JSON.stringify(a.jets) === JSON.stringify(b.jets) && a.rng === b.rng, `course ${seed}: same cavern, anchors and lava jets as rev 5`);
    ok((b.starAnchors ?? []).length === 0 && swingStarTotal(b) === SWING_STARS && swingStarTotal(a) === SWING_STARS, `course ${seed}: ${swingStarTotal(b)} touch stars, as many as rev 5's star anchors`);
    ok(b.rocks!.every((r, i) => r.trigger === a.rocks![i]!.trigger + SWING_ROCK_LEAD_V6 && r.x === a.rocks![i]!.x), `course ${seed}: stalactites in the same places, crumbling ${SWING_ROCK_LEAD_V6 / FP} px further ahead`);
    ok(b.starSpots!.every(([x]) => b.jets!.every((j) => Math.abs(j.x - x) > SWING_JET_HALF_W + SWING_STAR_TOUCH)), `course ${seed}: no star over a lava jet`);
    ok(b.starSpots!.every(([x, y]) => b.anchors.every((an) => Math.abs(an.x - x) > 30 * FP || Math.abs(an.y - y) > 30 * FP)), `course ${seed}: stars clear of the anchor rings`);
    const ys = b.starSpots!.map(([, y]) => y);
    ok(Math.max(...ys) - Math.min(...ys) >= 80 * FP, `course ${seed}: stars at varied heights (${Math.round((Math.max(...ys) - Math.min(...ys)) / FP)} px apart)`);
  }
  // Touching a star takes it once.
  {
    const s0 = tuned.init(seeds[0]!);
    const [x, y] = s0.starSpots![0]!;
    let s = { ...s0, x, y, vx: 0, vy: 0, rope: -1 } as SwingState;
    s = tuned.step(s, null) as SwingState;
    ok((s.stars ?? 0) === 1 && (s.starsTaken ?? []).includes(0), "touching a star takes it");
    s = tuned.step({ ...s, x, y, vx: 0, vy: 0 } as SwingState, null) as SwingState;
    ok((s.stars ?? 0) === 1, "a star is taken only once");
    const g = band.step({ ...band.init(seeds[0]!), x, y, vx: 0, vy: 0, rope: -1 } as SwingState, null) as SwingState;
    ok((g.stars ?? 0) === 0, "rev 5 has no touch stars");
  }
  // A crumbling stalactite drops 120 ticks after it starts.
  {
    let s = tuned.init(seeds[0]!) as SwingState;
    const r0 = s.rocks![0]!;
    s = { ...s, x: r0.x - r0.trigger + FP, maxX: r0.x - r0.trigger + FP, rope: -1, vx: 0, vy: -FP * 0, y: 300 * FP };
    let warnAt = -1;
    let fallAt = -1;
    for (let k = 0; k < 200 && fallAt < 0; k++) {
      s = { ...s, x: r0.x - r0.trigger + FP, y: 300 * FP, vx: 0, vy: 0, rope: -1, ended: 0 } as SwingState;
      s = tuned.step(s, null) as SwingState;
      if (warnAt < 0 && s.rocks![0]!.phase === 1) warnAt = s.tick;
      if (s.rocks![0]!.phase === 2) fallAt = s.tick;
    }
    ok(warnAt > 0 && fallAt - warnAt === SWING_ROCK_WARN_V6, `a stalactite drops ${fallAt - warnAt} ticks after it starts to crumble (want ${SWING_ROCK_WARN_V6})`);
  }
  // 150 through the server replay: the course's search witness takes all ten touch stars and reaches 500 m.
  for (const seed of seeds.slice(0, FULL ? 6 : 2)) {
    const w = proveSwingSeedV4(seed, { rev: SWING_REV_TUNED });
    ok(Boolean(w) && w!.stars === SWING_STARS, `course ${seed}: a run takes all ten touch stars and reaches 500 m (${w?.stars ?? 0} stars)`);
    if (!w) continue;
    let s = tuned.init(seed) as SwingState;
    const events: any[] = [];
    const checkpoints: unknown[] = [];
    const byTick = new Map(w.log.map((e) => [e.t, e]));
    while (!tuned.isOver(s)) {
      const ev = byTick.get(s.tick + 1) ?? null;
      if (ev) recordInput(events, ev, tuned.inputRanges ?? []);
      s = tuned.step(s, ev) as SwingState;
      if (s.tick % 300 === 0) checkpoints.push(swingCheckpoint(s));
    }
    const r = replaySwingRun(seed, encodeSwingRun({ seed, claimedScore: tuned.score(s), events, endTick: s.tick, checkpoints: checkpoints as never }), SWING_REV_TUNED);
    ok(!r.flagged && r.score === 150 && swingMetres(r.state) >= 500, `course ${seed}: 150 through the server replay (${r.score})`);
  }
  const art = readFileSync("src/lib/arcade/swing.renderer.ts", "utf8");
  ok(/if \(r\.phase === 1 && state\.tuned\)[\s\S]{0,200}drawCrumble/.test(art), "rev-6 stalactites crumble instead of showing the red warning line");
  const help = INSTRUCTIONS.swing!;
  ok(help.how.some((h) => /Touch stars/.test(h.action)) && !help.how.some((h) => /star anchors/i.test(`${h.action} ${h.detail}`)), "the help describes touch stars");
}

/* ================================= 2e. Tilt ================================= */
if (want("tilt")) {
  section("Tilt: every cup reachable, the orange marble always drawn");
  const p = generateTilt();
  // Tuning C moved new Tilt rounds on to tiltRev 4 (arcade-tuning-c-check), the expansion (26 Oct 2026) on to tiltRev 8
  // (tilt-expand-check); every cup stays reachable.
  ok(p.tiltRev === TILT_REV_EXPAND && tiltDealableX(p.seed), "new Tilt rounds are stamped tiltRev 8 (the expansion) and deal a seed with every key and cup reachable");
  ok(TILT_REV_BAND + 1 === 4 && typeof tiltSeedCupsReachable === "function", "tiltRev 4 still follows the band revision");
  const n = FULL ? 40_000 : 4_000;
  let bad = 0;
  let amber = 0;
  const game = tiltGameFor(TILT_REV_BAND);
  for (let k = 0; k < n; k++) {
    const seed = (Math.imul(k + 1, 0x9e3779b1) ^ 0x5bd1e995) | 0;
    for (const m of game.init(seed).list) {
      if (!tiltCupReachable(m, 0) || !tiltCupReachable(m, 1)) bad++;
      if ((m.start2 ?? -1) >= 0) amber++;
    }
  }
  ok(bad === 0, `every maze of ${n} seeds has both cups reachable (${bad} sealed; ${amber} orange cups proved)`);
  ok(amber >= n * 2, `every seed's mazes 3 and 4 carry the orange marble (${amber})`);
  const art = readFileSync("src/lib/arcade/tiltArt.renderer.ts", "utf8");
  ok(/c === m\.exit2 && d === m\.exitDir2\) continue/.test(art), "the orange cup's exit is drawn open");
  ok(/TILT_MARBLE_AMBER, -rot, 3\);\s*ctx\.restore\(\);/.test(art) && /Math\.hypot\(bx - mx, by - my\) < mr/.test(art), "an orange marble under the blue one is drawn over it (half and half)");
  ok(/!prev2\.bHome\) toyMarble/.test(art), "an orange marble finishing last sinks into its own cup");
  const stage = readFileSync("src/puzzles/tilt.tsx", "utf8");
  // Superseded 15 Oct 2026 (arcade play screen): Tilt's arena starts under the compact header like every other.
  ok(!/arenaDrop|TILT_ARENA_DROP/.test(stage) && /fitWorld/.test(stage), "Tilt's arena sits at the shared fixed top, no drop");
}

/* ============================ 3. Help copy rules ============================ */
for (const type of TUNING_A_GAMES) {
  if (!want(type)) continue;
  const help = INSTRUCTIONS[type]!;
  // Screen audit Oct 2026 (Batch 5): a spaced en dash " – " everywhere; no em dash and no spaced or leading hyphen.
  for (const row of help.how) ok(!/—|(^| )- /.test(`${row.action} ${row.detail}`), `${type}: help uses spaced en dashes`);
}

if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} Tuning A checks`);
  process.exit(1);
}
console.log(`Tuning A: ${checks} checks passed${FULL ? " (full depth)" : ""} — old rounds unchanged; Wavefront shapes and 150; Orbit fly-in and earlier misses (never a catchable flight); Grappler touch stars, crumble and 150; every Tilt cup reachable`);
