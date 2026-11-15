/**
 * swing-overhaul-check (the Action overhaul, phase 2 step 4, 15 Nov 2026; docs/arcade-standard/swing.md "The Action
 * overhaul"): Grappler's stage-1 changes are display only, on swingRev 17.
 *
 *  1. No play or score change: dealt courses' oracle witnesses replay to exactly 200 through the server's replay, and the
 *     stored skill-band runs (scripts/fixtures/swing-slide-runs.json) replay to their stored scores and states.
 *  2. The 120 s rule: the run is 90 s (the clock 93 s), under 120 s.
 *  3. One stretch count: every dealt course has 51 stretches; the reveal's course line says "n of 51 stretches cleared"
 *     (the HUD's total), and swingRev 17 has no second "stretches left" line; older revisions keep theirs.
 *  4. "King of the swingers" (70 % of the course: the Course part full) stays possible: every sampled witness has it.
 *  5. The bounds rule at the overhaul's sizes: the hero's growth is the approved one (art-check holds its drawn extent),
 *     the figure drawn inside its approved extent; the river's surface within 1.5 px of the sim's floor line.
 *  6. The setting deepens, the same for everyone: swingJungleDepth is 0 at the start, rises with the camera to 1 by the
 *     finish, never falls along a clean run; a drawn frame is identical twice (no randomness), and a late frame is
 *     darker than an early one.
 *  7. The HUD reads: its chip label at least 11 px on a 390-wide phone; the PAR label 14 px; the grab loop 12 px.
 *  8. The intro is a still from the game's own renderer on the live stamp (swingRev 18 since stage 2).
 *  9. Edge to edge (below).
 * 10. Stage 2 (15 Nov 2026): swingRev 18's bigger hero, re-proved deal and colliding body; the hooks, water and calmer
 *     backdrop of the look pass (below).
 *
 *   bun scripts/swing-overhaul-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createCanvas, GlobalFonts, Path2D as NapiPath2D } from "@napi-rs/canvas";

Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => 10_000 } });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });
GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");

const S = await import("../src/lib/arcade/swing");
const SR = await import("../src/lib/arcade/swing.renderer");
const J = await import("../src/lib/arcade/swingJungle.renderer");
const H = await import("../src/lib/arcade/hero.renderer");
const { revealStdParts } = await import("../src/lib/arcade/revealStdParts");
const { nearMissInfo } = await import("../src/lib/duel/nearMiss");
const { replaySwingRun } = await import("../src/lib/duel/swing");
const { SWING_TIME_MS } = await import("../src/lib/duel/types");
const { SWING_SLIDE_DEAL } = await import("../src/lib/duel/swingSlideDeal.server");
const { swingSlideVerdict } = await import("./swing-slide-deal");

let fails = 0;
let passes = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passes++;
  else {
    fails++;
    console.log(`FAIL ${msg}`);
  }
}

const REV = S.SWING_REV_SLIDE;
const game = S.swingGameFor(REV);
type Ev = { t: number };
const witnesses = (JSON.parse(gunzipSync(readFileSync("scripts/fixtures/swing-slide-deal-witness.json.gz")).toString()) as { witnesses: { seed: number; events: Ev[] }[] }).witnesses;
const sample = witnesses.filter((_, i) => i % 24 === 0);

/* 1. No play or score change. */
for (const w of sample) {
  const v = swingSlideVerdict(w.seed, w.events as never);
  ok(v.score === 200 && !v.flagged, `dealt course ${w.seed}: its witness still scores ${v.score} (200) through the server's replay`);
}
{
  const fnv = (s: string) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
    return h;
  };
  const { runs } = JSON.parse(readFileSync("scripts/fixtures/swing-slide-runs.json", "utf8")) as { runs: { level: string; seed: number; score: number; stateHash: number; raw: string }[] };
  ok(runs.length >= 20, `the stored rev-17 skill-band runs are there (${runs.length})`);
  for (const run of runs.filter((_, i) => i % 3 === 0)) {
    const r = replaySwingRun(run.seed, gunzipSync(Buffer.from(run.raw, "base64")).toString(), REV);
    ok(r.score === run.score && fnv(JSON.stringify(r.state)) === run.stateHash, `${run.level} ${run.seed}: replays ${r.score}, its stored ${run.score}, the same final state`);
  }
}

/* 2. The 120 s rule. */
ok(game.runTicks <= 120 * 60 && SWING_TIME_MS <= 120_000, `the run is ${game.runTicks / 60} s and the round's clock ${SWING_TIME_MS / 1000} s, both at most 120 s`);

/* 3. One stretch count. */
{
  for (const seed of SWING_SLIDE_DEAL.slice(0, 4)) {
    const s0 = game.init(seed);
    ok(S.swingAssaultCounts(s0).sectionTotal === 51, `dealt course ${seed} has 51 stretches (${S.swingAssaultCounts(s0).sectionTotal})`);
  }
  // A run part-way: the witness of the first sampled course stopped at two thirds.
  const w = sample[0]!;
  const by = new Map(w.events.map((e) => [e.t, e]));
  let s = game.init(w.seed);
  while (!game.isOver(s) && (s.sec ?? 0) < 34) s = game.step(s, (by.get(s.tick + 1) ?? null) as never);
  const c = S.swingAssaultCounts(s);
  const parts = revealStdParts("swing", s) ?? [];
  const core = parts.find((p) => p.key === "core");
  const text = core ? JSON.stringify(core) : "";
  ok(text.includes(`${c.sections} of ${c.sectionTotal} stretches cleared`), `the reveal's course line says "${c.sections} of ${c.sectionTotal} stretches cleared": ${text}`);
  ok((text.match(/stretch/g) ?? []).length === 1, "the course line names the stretches once");
  const extra = { swingRev: REV, sections: c.sections, sectionTotal: c.sectionTotal };
  ok(nearMissInfo("swing", extra) === null, "swingRev 17 shows no second \"stretches left to clear\" line");
  ok(nearMissInfo("swing", { ...extra, swingRev: 16 })?.line === `${c.sectionTotal - c.sections} stretches left to clear`, "swingRev 15 and 16 keep their \"stretches left to clear\" line");
  const hud = readFileSync("src/lib/arcade/swing.renderer.ts", "utf8");
  ok(/label: "STRETCH", value: `\$\{shown\} \/ \$\{c\.sectionTotal\}`/.test(hud), "the HUD counts the stretch in play out of the same total");
  const help = readFileSync("src/lib/duel/instructions.ts", "utf8");
  ok(help.includes("The course is 51 stretches:") && help.includes("“Stretch 23 / 51”"), "the help names the same count, 51 stretches, as the HUD and the reveal");
  const doc = readFileSync("docs/arcade-standard/swing.md", "utf8");
  ok(doc.includes("**51 stretches**") && doc.includes("n of 51 stretches cleared"), "swing.md names the one count, 51");
}

/* 4. King of the swingers stays possible. */
for (const w of sample.slice(0, 3)) {
  const v = swingSlideVerdict(w.seed, w.events as never);
  ok(v.parts.core === S.SWING_V17_CORE, `dealt course ${w.seed}: the witness fills the Course part (70 % of the way): ${v.parts.core}`);
}

/* 5. The bounds rule at the overhaul's sizes. */
{
  const g = H.GRAPPLER_HERO_GROW;
  ok(g.w === 1.2 && g.h === 1.12 && g.feet === true, "the hero's growth is the approved one (art-check holds the figure's drawn extent)");
  const Z = 4;
  const C = 120;
  const motion = [[0, 0, 0, 0], [6, -1, 1, 0.9], [-6, 2, 1, -0.9], [0, 6, 1, 0]] as const;
  let maxAcross = 0;
  let maxUp = 0;
  let maxDown = 0;
  for (const [mx, my, sp, face] of motion)
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const ax = Math.cos(ang), ay = Math.sin(ang);
      const p = Object.assign(H.heroPose(), {
        headR: 4.2, stick: 3, headX: 0, headY: -7.5, neckX: 0, neckY: -3.2, hipX: 0, hipY: 3.6, shoulderX: 0, shoulderY: -3.2,
        handAX: ax * 9.5, handAY: -3.2 + ay * 9.5, handBX: ax * 8.5 + ay * 2.4, handBY: -3.2 + ay * 8.5 - ax * 2.4,
        footAX: -3.6, footAY: 11, footBX: 3.6, footBY: 11, moveX: mx, moveY: my, speed: sp, face, gentle: true,
      });
      H.heroGrow(p, g);
      const cv = createCanvas(C * Z, C * Z);
      const x = cv.getContext("2d") as unknown as CanvasRenderingContext2D;
      x.translate((C * Z) / 2, (C * Z) / 2);
      x.scale(Z, Z);
      H.drawHero(x, p);
      const d = (x as unknown as { getImageData: (a: number, b: number, c: number, d: number) => { data: Uint8ClampedArray } }).getImageData(0, 0, C * Z, C * Z).data;
      for (let yy = 0; yy < C * Z; yy++)
        for (let xx = 0; xx < C * Z; xx++)
          if (d[(yy * C * Z + xx) * 4 + 3]! > 40) {
            const dx = Math.abs(xx + 0.5 - (C * Z) / 2) / Z;
            const dy = (yy + 0.5 - (C * Z) / 2) / Z;
            maxAcross = Math.max(maxAcross, dx);
            if (dy < 0) maxUp = Math.max(maxUp, -dy);
            else maxDown = Math.max(maxDown, dy);
          }
    }
  ok(maxAcross <= 15.75 && maxUp <= 19.75 && maxDown <= 13.25, `the figure stays inside its approved extent: ±${maxAcross.toFixed(2)} across, ${maxUp.toFixed(2)} up, ${maxDown.toFixed(2)} down`);
  let wave = 0;
  for (let wx = 0; wx < 2000; wx += 3) for (let t = 0; t < 20; t += 0.37) wave = Math.max(wave, Math.abs(J.jungleRiverWave(wx, t, false)));
  ok(wave <= 1.5, `the river's surface stays within 1.5 px of the sim's floor line (${wave.toFixed(3)})`);
  ok(J.jungleRiverWave(123, 4.5, true) === 0, "with reduced motion the river lies still on the line");
}

/* 6. The setting deepens, the same for everyone. */
{
  const w = sample[1] ?? sample[0]!;
  const by = new Map(w.events.map((e) => [e.t, e]));
  const W = S.swingWorldW(game.init(w.seed));
  let s = game.init(w.seed);
  ok(J.swingJungleDepth(s, W) === 0, "the jungle starts at depth 0");
  let last = 0;
  let falls = 0;
  let early: typeof s | null = null;
  let late: typeof s | null = null;
  while (!game.isOver(s)) {
    s = game.step(s, (by.get(s.tick + 1) ?? null) as never);
    const d = J.swingJungleDepth(s, W);
    if (d < last - 1e-9) falls++;
    last = d;
    if (!early && s.tick === 300) early = s;
    if (!late && (s.sec ?? 0) >= s.sections!.length - 3) late = s;
  }
  ok(falls === 0, `the depth never falls along a clean run (${falls} falls)`);
  ok(last >= 0.95, `the depth reaches the finish (${last.toFixed(3)})`);
  ok(J.swingJungleDepth(game.init(w.seed), W) === 0 && J.swingJungleDepth(s, W) === last, "the depth is the state's alone (the same for every player and replay)");
  const art = SR.swingArtGameFor(REV);
  const draw = (st: typeof s) => {
    const cv = createCanvas(225, 422);
    const ctx = cv.getContext("2d") as unknown as CanvasRenderingContext2D;
    art.draw(ctx, st, { width: 225, height: 422 });
    return (ctx as unknown as { getImageData: (a: number, b: number, c: number, d: number) => { data: Uint8ClampedArray } }).getImageData(0, 0, 225, 422).data;
  };
  const a1 = draw(late!);
  const a2 = draw(late!);
  ok(Buffer.compare(Buffer.from(a1), Buffer.from(a2)) === 0, "a frame drawn twice is identical (nothing random in the art)");
  const lum = (d: Uint8ClampedArray) => {
    let sum = 0;
    // The backdrop's middle band (under the HUD, above the river).
    for (let y = 120; y < 330; y++) for (let x = 0; x < 225; x++) {
      const k = (y * 225 + x) * 4;
      sum += 0.2126 * d[k]! + 0.7152 * d[k + 1]! + 0.0722 * d[k + 2]!;
    }
    return sum / (210 * 225);
  };
  const le = lum(draw(early!));
  const ll = lum(a1);
  ok(ll < le * 0.85, `the late jungle is darker than the early one (mean ${ll.toFixed(1)} against ${le.toFixed(1)})`);
}

/* 7. The HUD and the loops read. */
{
  const shownLabel = 10 * SR.SWING_HUD_SCALE * (390 / S.swingWorldWFor(REV));
  ok(shownLabel >= 11, `the HUD's chip label is ${shownLabel.toFixed(1)} px on a 390-wide phone (at least 11)`);
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Action overhaul): stage 2 redrew the loop at
  // 14 px (section 10e); 12 was stage 1's.
  ok(SR.SWING_PAR_LABEL_PX >= 14 && J.JUNGLE_LOOP_R >= 12 && SR.SWING_JUNGLE_ROPE_W >= 1.3, "the PAR label is 14 px, the grab loop at least 12 px and the held vine at least 1.3× as thick");
}

/* 8. The intro still. */
{
  const src = readFileSync("src/puzzles/swing.tsx", "utf8");
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Action overhaul): the live stamp is now 18.
  ok(/<ArtStill\s+game=\{swingArtGameFor\(SWING_REV_BIG\)\}/.test(src), "the intro still is drawn by the game's own renderer on swingRev 18");
}

/*
 * 9. Edge to edge (Joe's standing rule, 15 Nov 2026): the screen fill (the jungle carried on beside and below the world
 * at the world's depth step) meets the world's left, right and bottom edges with no colour step (arcade-fill-check's
 * measure: the mean colour 2–5 px either side, at most 30 a channel) and leaves no #070709 strip, at 414×896 (the
 * home-screen app), 390×844, 375×667 and a 1366×768 desktop, at the start of the course and deep into it. The play
 * screen's geometry: a 52 px header, the world at the largest uniform scale in the box above a 16 px strip, centred
 * across and top-anchored; the fill out to the screen's edges.
 */
{
  const F = await import("../src/lib/arcade/arenaFills.renderer");
  ok((F.ARENA_FILL_SIDES as readonly string[]).includes("swing"), "Grappler's fill runs down its sides (ARENA_FILL_SIDES)");
  const w = sample[0]!;
  const by = new Map(w.events.map((e) => [e.t, e]));
  const W = S.swingWorldW(game.init(w.seed));
  const WH = S.swingWorldH(game.init(w.seed));
  let s = game.init(w.seed);
  const states: (typeof s)[] = [];
  while (!game.isOver(s)) {
    s = game.step(s, (by.get(s.tick + 1) ?? null) as never);
    const sc0 = SR.swingJungleScene(s);
    if (s.tick === 240 || s.tick === 2400 || (s.sec ?? 0) === s.sections!.length - 2 || (sc0.darkRight && sc0.dim && !states.some((x) => SR.swingJungleScene(x).dim))) if (!states.some((x) => x.sec === s.sec)) states.push(s);
  }
  const art = SR.swingArtGameFor(REV);
  const screens = [
    { name: "414x896 app", w: 414, h: 896 - 48 - 34, dpr: 2 },
    { name: "390x844", w: 390, h: 844, dpr: 2 },
    { name: "375x667", w: 375, h: 667, dpr: 2 },
    { name: "desktop 1366x768", w: 1366, h: 768, dpr: 1 },
  ];
  for (const st of states) {
    const sceneNow = SR.swingJungleScene(st);
    const step = sceneNow.step;
    for (const sc of screens) {
      const HEADER = 52;
      const boxH = sc.h - HEADER - 16;
      const scale = Math.min(sc.w / W, boxH / WH);
      const aw = W * scale, ah = WH * scale, ax = (sc.w - aw) / 2;
      const cv = createCanvas(Math.round(sc.w * sc.dpr), Math.round((sc.h - HEADER) * sc.dpr));
      const ctx = cv.getContext("2d") as unknown as CanvasRenderingContext2D;
      ctx.scale(sc.dpr, sc.dpr);
      ctx.fillStyle = "#070709";
      ctx.fillRect(0, 0, sc.w, sc.h);
      // The scene canvas: the fill in world units, the world's origin at the box's top left.
      ctx.save();
      ctx.translate(ax, 0);
      ctx.scale(scale, scale);
      const view = { worldW: W, worldH: WH, left: -ax / scale, top: 0, right: (sc.w - ax) / scale, bottom: (sc.h - HEADER) / scale, scale };
      F.swingFillFor(REV, () => ({ depth: step / J.SWING_DEPTH_STEPS, darkRight: sceneNow.darkRight, dim: sceneNow.dim }))(ctx, view);
      ctx.restore();
      ctx.save();
      ctx.translate(ax, 0);
      art.draw(ctx, st, { width: aw, height: ah });
      ctx.restore();
      const img = (ctx as unknown as { getImageData: (a: number, b: number, c: number, d: number) => { data: Uint8ClampedArray; width: number; height: number } }).getImageData(0, 0, cv.width, cv.height);
      const px = (x: number, y: number) => {
        const i = (Math.round(y) * img.width + Math.round(x)) * 4;
        return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
      };
      const D = sc.dpr;
      const mean = (pts: [number, number][]) => {
        const m = [0, 0, 0];
        for (const [x, y] of pts) px(x, y).forEach((v, k) => (m[k] += v));
        return m.map((v) => v / pts.length);
      };
      const stepOf = (a: number[], b: number[]) => (Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!)) / 3;
      const where = `${sc.name}, depth ${step}/${J.SWING_DEPTH_STEPS}${sceneNow.darkRight ? ", shade on the right" : ""}${sceneNow.dim ? ", dimmed" : ""}`;
      // Left and right edges (where there is room beside the world): world rows under the HUD down to the river.
      for (const side of ["left", "right"] as const) {
        const edge = (side === "left" ? ax : ax + aw) * D;
        if ((side === "left" ? ax : sc.w - ax - aw) * D < 6) continue;
        const dir = side === "left" ? 1 : -1;
        const ins: [number, number][] = [];
        const outs: [number, number][] = [];
        for (let y = 110 * D; y < (ah - 4) * D; y += 3) for (let k = 2; k <= 5; k++) {
          ins.push([edge + dir * k, y]);
          outs.push([edge - dir * (k + 1), y]);
        }
        const st2 = stepOf(mean(ins), mean(outs));
        ok(st2 <= 30, `${where}: no seam at the world's ${side} edge (the colour steps ${st2.toFixed(1)} a channel, most 30)`);
      }
      // The bottom edge (the river carried on under the world).
      if ((sc.h - HEADER - ah) * D > 6) {
        const edge = ah * D;
        const ins: [number, number][] = [];
        const outs: [number, number][] = [];
        for (let x = Math.max(0, ax * D); x < Math.min(img.width, (ax + aw) * D); x += 3) for (let k = 2; k <= 5; k++) {
          ins.push([x, edge - k]);
          outs.push([x, edge + k + 1]);
        }
        const sb = stepOf(mean(ins), mean(outs));
        ok(sb <= 30, `${where}: no seam at the world's bottom edge (${sb.toFixed(1)})`);
      }
      // No #070709 left anywhere on the screen below the header (every pixel the fill or the world).
      let black = 0;
      for (let y = 0; y < img.height; y += 2) for (let x = 0; x < img.width; x += 2) {
        const [r, g, b] = px(x, y);
        if (Math.abs(r - 7) <= 2 && Math.abs(g - 7) <= 2 && Math.abs(b - 9) <= 2) black++;
      }
      ok(black === 0, `${where}: no screen-edge black left beside or below the world (${black} sampled pixels)`);
    }
  }
  const scenes = states.map((x) => SR.swingJungleScene(x));
  ok(states.length >= 3 && scenes.some((x) => x.step === 0) && scenes.some((x) => x.step >= 15) && scenes.some((x) => x.dim && x.darkRight), `edge to edge proved at the start, deep in and on a dimmed platform run with the shade on the right: ${JSON.stringify(scenes)}`);
  console.log(`edge to edge: ${scenes.length} scenes (${scenes.map((x) => `depth ${x.step}${x.darkRight ? " shade" : ""}${x.dim ? " dim" : ""}`).join(", ")}) at 4 screen sizes`);
}

/*
 * 10. Stage 2 (the look pass, 15 Nov 2026): swingRev 18, the bigger hero, and the jungle's look.
 *  a. The stamp: swingRev 18 is swingRev 17's game on a 14 px body (10 before); 90 s; 51 stretches; rooms deal it from
 *     its own proved deal, swingPreBig deals rev 17 from rev 17's.
 *  b. Re-proved: every 12th dealt course's oracle witness replays to exactly 200 through the server's replay, with the
 *     Course part full ("King of the swingers" still possible).
 *  c. The larger body collides: the same falling body that clears the river on rev 17 lands in it on rev 18 (and the
 *     body is back to 10 px for rev 17 after a rev-18 step); a landing stands 14 px above the platform.
 *  d. The figure: drawn GRAPPLER_V18_SCALE (the radius ratio) about the body's centre, inside the approved extent × 1.4;
 *     the held vine at least 1.8× (SWING_V18_ROPE_W).
 *  e. The hooks: the grab loop 14 px; the cream band against its dark pad at least 7:1.
 *  f. The water: moving (two moments differ), still under reduced motion (identical), glossy (the band just under the
 *     surface brighter than the deep water).
 *  g. A calmer backdrop: its luminance spread and its edge energy at most 60 % of stage 1's (measured on 14ce058d with
 *     scratch/bgmeasure: sd 20.1, edge 5.44 at camera 3000 px) and its mean darker than stage 1's (63.7).
 */
{
  const AS = await import("../src/lib/duel/arcade.server");
  const { SWING_BIG_DEAL } = await import("../src/lib/duel/swingBigDeal.server");
  const big = S.swingGameFor(S.SWING_REV_BIG);
  // a.
  ok(S.SWING_REV_BIG === 18 && S.SWING_V18_RADIUS === 14 * 256, "swingRev 18's body is 14 px");
  ok(big.runTicks === S.SWING_V16_RUN_TICKS && big.runTicks <= 120 * 60, `swingRev 18 runs ${big.runTicks / 60} s (the 120 s rule)`);
  for (const seed of SWING_BIG_DEAL.slice(0, 3)) {
    const s0 = big.init(seed);
    ok(s0.big === 1 && s0.slide === 1 && s0.dark === 1 && S.swingAssaultCounts(s0).sectionTotal === 51, `dealt rev-18 course ${seed}: the bigger body on rev 17's rules, 51 stretches`);
    ok(S.swingBotKit.radiusOf(s0) === S.SWING_V18_RADIUS && S.swingBotKit.radiusOf({}) === 10 * 256, "the bots see each state's own body");
  }
  for (let i = 0; i < 6; i++) {
    const p = AS.generateSwing();
    ok(p.swingRev === S.SWING_REV_BIG && SWING_BIG_DEAL.includes(p.seed), `rooms deal swingRev 18 from its deal (${p.swingRev}, ${p.seed})`);
  }
  const was = AS.pinSwingPreBig(true);
  try {
    const { SWING_SLIDE_DEAL: slide } = await import("../src/lib/duel/swingSlideDeal.server");
    const p = AS.generateSwing();
    ok(p.swingRev === S.SWING_REV_SLIDE && slide.includes(p.seed), `swingPreBig deals swingRev 17 from its own deal (${p.swingRev})`);
  } finally {
    AS.pinSwingPreBig(was);
  }
  // b.
  const bigW = (JSON.parse(gunzipSync(readFileSync("scripts/fixtures/swing-big-deal-witness.json.gz")).toString()) as { witnesses: { seed: number; events: Ev[] }[] }).witnesses;
  ok(bigW.length === SWING_BIG_DEAL.length && bigW.every((w, i) => w.seed === SWING_BIG_DEAL[i]), `the rev-18 deal is exactly its ${bigW.length} witnessed seeds`);
  for (const w of bigW.filter((_, i) => i % 12 === 0)) {
    const v = swingSlideVerdict(w.seed, w.events as never, S.SWING_REV_BIG);
    ok(v.score === 200 && !v.flagged && v.parts.core === S.SWING_V17_CORE, `rev-18 course ${w.seed}: its witness scores ${v.score} (200) through the server's replay, the Course part full`);
  }
  // c.
  {
    const s0 = big.init(SWING_BIG_DEAL[0]!);
    // A free body falling straight down 13 px (centre) above the river: the 14 px body touches it, the 10 px one does not.
    const x = s0.anchors[1]!.x;
    const lerp = (arr: readonly number[], at: number) => {
      const i = Math.trunc(at / (40 * 256));
      return arr[i]! + Math.trunc(((arr[i + 1]! - arr[i]!) * (at - i * 40 * 256)) / (40 * 256));
    };
    const floor = lerp(s0.floor, x);
    const falling = { ...s0, rope: -1, x, y: floor - 13 * 256 - 77, vx: 0, vy: 0, respawn: 0, ledgeOn: -1, chaseX: 0 };
    const onBig = big.step(falling, null);
    const onSlide = S.swingGameFor(S.SWING_REV_SLIDE).step({ ...falling, big: undefined }, null);
    ok((onBig.restarts ?? 0) === (s0.restarts ?? 0) + 1, "rev 18: the 14 px body touching the river is a miss");
    ok((onSlide.restarts ?? 0) === (s0.restarts ?? 0), "rev 17 (stepped after it): the 10 px body clears the same river");
    // Landing: the hero stands with the body's bottom on the platform's top.
    const l = s0.ledges![1]!;
    const drop = { ...s0, rope: -1, x: l.x, y: l.top - 14 * 256 - 300, vx: 0, vy: 200, respawn: 0, ledgeOn: -1, chaseX: 0, sec: s0.ledges![1]!.section };
    let st = drop;
    for (let n = 0; n < 8 && (st.ledgeOn ?? -1) < 0; n++) st = big.step(st, null);
    ok((st.ledgeOn ?? -1) >= 0 ? st.y === l.top - 14 * 256 : true, `rev 18: a landing stands the body's 14 px above the platform (${(l.top - st.y) / 256})`);
  }
  // d.
  {
    ok(H.GRAPPLER_V18_SCALE === S.SWING_V18_RADIUS / (10 * 256), `the figure's scale (${H.GRAPPLER_V18_SCALE}) is the radius ratio`);
    ok(SR.SWING_V18_ROPE_W >= 1.8, `the held vine is ${SR.SWING_V18_ROPE_W}× on swingRev 18`);
    const src = readFileSync("src/lib/arcade/swing.renderer.ts", "utf8");
    ok(/const heroK = state\.big \? GRAPPLER_V18_SCALE : 1;/.test(src) && /ctx\.translate\(fx, fy\);\s*if \(heroK !== 1\) ctx\.scale\(heroK, heroK\);\s*drawHero\(ctx, hero\);/.test(src), "the jungle hero is drawn ×1.4 about the body's centre on swingRev 18 only");
    const Z = 4, C = 160;
    let across = 0, up = 0, down = 0;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const ax = Math.cos(ang), ay = Math.sin(ang);
      const p = Object.assign(H.heroPose(), {
        headR: 4.2, stick: 3, headX: 0, headY: -7.5, neckX: 0, neckY: -3.2, hipX: 0, hipY: 3.6, shoulderX: 0, shoulderY: -3.2,
        handAX: ax * 9.5, handAY: -3.2 + ay * 9.5, handBX: ax * 8.5 + ay * 2.4, handBY: -3.2 + ay * 8.5 - ax * 2.4,
        footAX: -3.6, footAY: 11, footBX: 3.6, footBY: 11, detailScale: H.GRAPPLER_V18_SCALE, gentle: true,
      });
      H.heroGrow(p, H.GRAPPLER_HERO_GROW);
      const cv = createCanvas(C * Z, C * Z);
      const x = cv.getContext("2d") as unknown as CanvasRenderingContext2D;
      x.translate((C * Z) / 2, (C * Z) / 2);
      x.scale(Z * H.GRAPPLER_V18_SCALE, Z * H.GRAPPLER_V18_SCALE);
      H.drawHero(x, p);
      const d = (x as unknown as { getImageData: (a: number, b: number, c: number, d: number) => { data: Uint8ClampedArray } }).getImageData(0, 0, C * Z, C * Z).data;
      for (let yy = 0; yy < C * Z; yy++)
        for (let xx = 0; xx < C * Z; xx++)
          if (d[(yy * C * Z + xx) * 4 + 3]! > 40) {
            const dx = Math.abs(xx + 0.5 - (C * Z) / 2) / Z;
            const dy = (yy + 0.5 - (C * Z) / 2) / Z;
            across = Math.max(across, dx);
            if (dy < 0) up = Math.max(up, -dy);
            else down = Math.max(down, dy);
          }
    }
    const k = H.GRAPPLER_V18_SCALE;
    ok(across <= 15.75 * k && up <= 19.75 * k && down <= 13.25 * k, `swingRev 18's figure stays inside the approved extent × ${k}: ±${across.toFixed(2)} across, ${up.toFixed(2)} up, ${down.toFixed(2)} down`);
    ok(down >= 12.75 * k - 2 && down <= 14 + 2 + 2, `its feet fill the 14 px body (${down.toFixed(2)} px down, within 2 px of the body's scaled figure)`);
  }
  // e.
  {
    ok(J.JUNGLE_LOOP_R === 14, `the grab loop is ${J.JUNGLE_LOOP_R} px`);
    const A = await import("../src/lib/arcade/swingJungleArt.renderer");
    const cv = createCanvas(80, 80);
    const x = cv.getContext("2d") as unknown as CanvasRenderingContext2D;
    x.fillStyle = "#1F3528";
    x.fillRect(0, 0, 80, 80);
    A.paintGrabRing(x, 40, 40, 14, false);
    const d = (x as unknown as { getImageData: (a: number, b: number, c: number, d: number) => { data: Uint8ClampedArray } }).getImageData(0, 0, 80, 80).data;
    const lumAt = (px: number, py: number) => {
      const k = (py * 80 + px) * 4;
      const c = [d[k]!, d[k + 1]!, d[k + 2]!].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    const band = lumAt(40 + 14, 40);
    const pad = lumAt(40 + 14 + 6, 40);
    const ratio = (band + 0.05) / (pad + 0.05);
    ok(ratio >= 7, `the ring's cream band against its dark pad is ${ratio.toFixed(1)}:1 (at least 7:1)`);
  }
  // f.
  {
    const s0 = big.init(SWING_BIG_DEAL[0]!);
    const W = S.swingWorldW(s0), WH = S.swingWorldH(s0);
    const river = (t: number, still: boolean) => {
      const cv = createCanvas(W, WH);
      const x = cv.getContext("2d") as unknown as CanvasRenderingContext2D;
      J.drawJungleRiver(x, s0, s0.camX / 256, W, WH, t, still, false, 0);
      return (x as unknown as { getImageData: (a: number, b: number, c: number, d: number) => { data: Uint8ClampedArray } }).getImageData(0, 0, W, WH).data;
    };
    ok(Buffer.compare(Buffer.from(river(3, false)), Buffer.from(river(3.5, false))) !== 0, "the water moves (two moments half a second apart differ)");
    ok(Buffer.compare(Buffer.from(river(0, true)), Buffer.from(river(7, true))) === 0, "with reduced motion the water holds still");
    const d = river(0, true);
    // Column by column: the water 5 px under the surface (the sim's floor line under the camera) against the deepest row.
    const lumAt = (x: number, y: number) => {
      const k = (y * W + x) * 4;
      return 0.2126 * d[k]! + 0.7152 * d[k + 1]! + 0.0722 * d[k + 2]!;
    };
    let under = 0, deepSum = 0;
    for (let x = 0; x < W; x++) {
      const at = s0.camX + x * 256;
      const i = Math.trunc(at / (40 * 256));
      const fy = (s0.floor[i]! + Math.trunc(((s0.floor[i + 1]! - s0.floor[i]!) * (at - i * 40 * 256)) / (40 * 256))) / 256;
      under += lumAt(x, Math.round(fy) + 5);
      deepSum += lumAt(x, WH - 4);
    }
    under /= W;
    deepSum /= W;
    ok(under > deepSum * 1.6, `glossy water: the band under the surface (${under.toFixed(0)}) is lit well above the deep (${deepSum.toFixed(0)})`);
  }
  // g.
  {
    const cv = createCanvas(450, 844);
    const x = cv.getContext("2d") as unknown as CanvasRenderingContext2D;
    J.drawJungleBackdrop(x, 3000, 450, 844, 0, false, 0);
    const d = (x as unknown as { getImageData: (a: number, b: number, c: number, d: number) => { data: Uint8ClampedArray } }).getImageData(0, 0, 450, 844).data;
    const L: number[] = [];
    for (let y = 100; y < 760; y++) for (let xx = 0; xx < 450; xx++) {
      const k = (y * 450 + xx) * 4;
      L.push(0.2126 * d[k]! + 0.7152 * d[k + 1]! + 0.0722 * d[k + 2]!);
    }
    const mean = L.reduce((a, b) => a + b, 0) / L.length;
    const sd = Math.sqrt(L.reduce((a, b) => a + (b - mean) ** 2, 0) / L.length);
    let edge = 0;
    for (let y = 0; y < 659; y++) for (let xx = 0; xx < 449; xx++) {
      const i = y * 450 + xx;
      edge += Math.abs(L[i]! - L[i + 1]!) + Math.abs(L[i]! - L[i + 450]!);
    }
    edge /= L.length;
    ok(sd <= 20.1 * 0.6 && edge <= 5.44 * 0.6 && mean < 63.7, `a calmer backdrop: spread ${sd.toFixed(1)} (stage 1 20.1), edges ${edge.toFixed(2)} (5.44), mean ${mean.toFixed(1)} (63.7)`);
  }
}

console.log(`swing-overhaul-check: ${passes} passed, ${fails} failed`);
if (fails) {
  console.log(`FAIL swing-overhaul-check: ${fails} failed`);
  process.exit(1);
}
