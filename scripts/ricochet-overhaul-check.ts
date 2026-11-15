/**
 * Moon Climb's Action overhaul, stage 1 (15 Nov 2026; docs/arcade-standard/ricochet.md "The Action overhaul";
 * display only, no stamp, no scoring change) and stage 2 (sections 9 and 10: ricoRev 4 and the look pass):
 *
 *  1. scores unchanged: 24 ricoRev 3 runs (skill-band bots, weak to flawless, on 8 seeds) recorded before the overhaul
 *     (scripts/fixtures/ricochet-overhaul-runs.json, `--record` writes it from the unchanged sim) and the 12 ricoRev 2
 *     runs recorded on main (moon-blockzone-legacy.json) replay through the server to the same score and state;
 *  2. the HUD: a second row shows lantern RIDES n/6 and SCROLLS n/3 (gold once complete), the first HEIGHT and FLOW;
 *     every chip fits its row at the widest values without the two sides meeting;
 *  3. the reveal's hits line (moonRevealHits.ts): "Hits: 11 · knocked down 3 m each" / "Hits: none" for ricoRev 3
 *     only, read from the stored Hits stat; its constants match the sim; it reads as one note row in the breakdown,
 *     the parts and total unchanged; a replayed run's stored reveal carries the Hits stat;
 *  4. the night (moonNight / moonPlace): 0 at the foot, 1 at the core's full height, never going back as the run
 *     climbs, the same for any two states at the same best height; the moon stays between the walls and rises;
 *  5. the bounds rule: katanas and shurikens drawn inside their sim boxes (+2 px), the bolder ninja no bigger than
 *     main's figure (scripts/fixtures/hero-bounds-main.json, + 0.5 px, as art-check);
 *  6. the 120 s rule (the run 60 s, the round's clock under 120 s) and grace (a hit never ends the run: a run of
 *     hits only lasts the minute);
 *  7. "Moonwalker" (245 m on Hard) stays possible: every dealt tower's witness climbs 245 m or more.
 *  8. edge to edge (below), for ricoRev 3 and 4.
 *
 * Stage 2 (15 Nov 2026, the look pass and the bigger ninja; docs/design/pages-review/action/GALLERY.md):
 *  9. ricoRev 4, the bigger ninja: ricoRev 3 unchanged on fixtures recorded before it, the deal and its pin, the body,
 *     every tower re-proved to 200 through the server replay, grace, the hit box, the bands rising;
 * 10. the look: a sky lantern's light only on the stone (no glow round it), far lanterns display only and small, the
 *     moon large, the walls' raking moonlight, the bigger figure and no rim round it;
 * 11. stage 2's effects (dust, air ring, scuff trail, lantern sway, scroll tally, the hit's tumble and "−3 m") and the
 *     answer reveal's run picture.
 *
 *   bun scripts/ricochet-overhaul-check.ts [--record]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createCanvas } from "@napi-rs/canvas";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { actionChipWidth, ACTION_HUD_EDGE, ACTION_CHIP_GAP } from "../src/lib/arcade/actionHud.renderer";
import {
  KATANA_HALF, KATANA_LEN, MOON_CORE_FULL_M, MOON_REV, MOON_SCROLLS, MOON_SKY, NINJA_CHECKPOINT_INTERVAL, NINJA_INPUT_TAP,
  NINJA_KNOCK, NINJA_PX_PER_M, NINJA_RUN_SECONDS, NINJA_START, NINJA_WALL_L, NINJA_WALL_R, NINJA_WORLD_W, SHURIKEN_R,
  moonCheckpoint, moonDeal, moonGame, ninjaMetres, type MoonState,
  MOON_BIG_BODY, MOON_BIG_HH, MOON_BIG_HW, MOON_BIG_REV, MOON_BIG_STD_SPEC, MOON_LEDGE_HW, MOON_SKY_R, MOON_STD_SPEC, MODE_FLIGHT, NINJA_BODY,
  NINJA_LEAP_TICKS, katanaTouches, moonGameFor, moonLeapTicks, moonLedgeX, moonSkyAt, ninjaBodyFor, ninjaSurface, MOON_FLOW_SLIDE, SURF_MOSS,
} from "../src/lib/arcade/ricochetNinja";
import {
  drawKatana, drawNinja, drawNinjaWorld as drawWorld, drawShuriken, FAR_LANTERN_COUNT, farLanternAt, moonHudRows, moonNight, moonPlace, ninjaArtScale,
  ninjaCamera, ninjaDrawPoint, ninjaScreenY, wallRake,
} from "../src/lib/arcade/ricochetNinja.renderer";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { ARCADE_STANDARD } from "../src/lib/arcade/standard";
import { generateRicochet, pinRicoPreBig } from "../src/lib/duel/arcade.server";
import { DEAL_PIN_NAMES } from "../src/lib/duel/dealEra";
import { POST_RECORDING_PINS } from "./deal-identity-lib";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { encodeMoonRun, replayMoonRun, replayNinjaRun } from "../src/lib/duel/ricochet";
import { MOON_HIT_KNOCK_M, MOON_HITS_REV, moonHitsLine } from "../src/lib/duel/moonRevealHits";
import { breakdownRows } from "../src/lib/duel/revealBreakdown";
import { CATALOGUE_DATA as CATALOGUE } from "../src/lib/duel/catalogue.data";
import { ALL_LEVELS, Human } from "./arcade-skill-bands/human";
import { bot as ricoBot } from "./arcade-skill-bands/bots/ricochet";

console.error = () => {};
let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const digest = (state: unknown) => createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 16);
const tap = (t: number, a = 0): ArcadeInputEvent => ({ t, k: NINJA_INPUT_TAP, a, b: 0, c: 0, d: 0 });

/** A Moon Climb run as the phone sends it (with checkpoints). */
function moonRaw(seed: number, events: ArcadeInputEvent[]): string {
  const at = new Map(events.map((e) => [e.t, e]));
  let s = moonGame.init(seed);
  const cps = [];
  while (!moonGame.isOver(s)) {
    s = moonGame.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % NINJA_CHECKPOINT_INTERVAL === 0) cps.push(moonCheckpoint(s));
  }
  return encodeMoonRun({ seed, claimedScore: moonGame.score(s), events, endTick: s.tick, checkpoints: cps });
}

/** A Moon Climb ricoRev 4 run as the phone sends it (with checkpoints). */
function moonRaw4(seed: number, events: ArcadeInputEvent[]): string {
  const game = moonGameFor(4);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const cps = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % NINJA_CHECKPOINT_INTERVAL === 0) cps.push(moonCheckpoint(s));
  }
  return encodeMoonRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints: cps });
}

/* 1. Scores unchanged. */
const FIXTURE = "scripts/fixtures/ricochet-overhaul-runs.json";
type Rec = { seed: number; level: string; raw: string; score: number; digest: string };
if (process.argv.includes("--record")) {
  const runs: Rec[] = [];
  const levels = ["weak", "average", "great", "perfect"].filter((l) => (ALL_LEVELS as readonly string[]).includes(l));
  for (let n = 0; n < 6; n++)
    for (const level of levels) {
      const seed = 4100 + n * 97;
      const ev = ricoBot({ game: moonGame as any, seed, rev: MOON_REV, human: new Human("ricochet", seed, level as any), fixes: true }).events ?? [];
      const raw = moonRaw(seed, ev);
      const out = replayMoonRun(seed, raw);
      runs.push({ seed, level, raw, score: out.score, digest: digest(out.state) });
    }
  writeFileSync(FIXTURE, JSON.stringify({ recorded: "the unchanged ricoRev 3 sim, before the Action overhaul's look (15 Nov 2026)", runs }) + "\n");
  console.log(`recorded ${runs.length} runs to ${FIXTURE}`);
}
{
  const fx = JSON.parse(readFileSync(FIXTURE, "utf8")) as { runs: Rec[] };
  const bad: string[] = [];
  for (const r of fx.runs) {
    const out = replayMoonRun(r.seed, r.raw);
    if (out.score !== r.score || digest(out.state) !== r.digest) bad.push(`seed ${r.seed} ${r.level}: ${out.score} vs ${r.score}`);
  }
  ok(fx.runs.length === 24 && bad.length === 0, `ricoRev 3: ${fx.runs.length} recorded runs replay to the same score and state${bad.length ? ` (${bad.join("; ")})` : ""}`);
  ok(new Set(fx.runs.map((r) => r.score)).size >= 6, "ricoRev 3: the recorded runs span a range of scores");
  const legacy = JSON.parse(readFileSync("scripts/fixtures/moon-blockzone-legacy.json", "utf8")) as { runs: { type: string; rev: number; seed: number; raw: string; score: number; digest: string }[] };
  const two = legacy.runs.filter((r) => r.type === "ricochet" && r.rev === 2);
  const bad2 = two.filter((r) => {
    const out = replayNinjaRun(r.seed, r.raw);
    return out.score !== r.score || digest(out.state) !== r.digest;
  });
  ok(two.length === 12 && bad2.length === 0, `ricoRev 2: the 12 runs recorded on main replay to the same score and state (${bad2.length} differ)`);
}

/* 2. The HUD. */
{
  const s0 = moonGame.init(7) as MoonState;
  const rows = moonHudRows(s0);
  ok(rows.length === 2, "HUD: two rows");
  ok(rows[0]!.left[0]!.label === "HEIGHT" && rows[0]!.right?.[0]?.label === "FLOW", "HUD: HEIGHT left and FLOW right on the first row");
  ok(rows[1]!.left[0]!.label === "RIDES" && rows[1]!.left[0]!.value === `0/${MOON_SKY}`, `HUD: RIDES 0/${MOON_SKY} at the start`);
  ok(rows[1]!.right?.[0]?.label === "SCROLLS" && rows[1]!.right?.[0]?.value === `0/${MOON_SCROLLS}`, `HUD: SCROLLS 0/${MOON_SCROLLS} at the start`);
  const full = { ...s0, rides: MOON_SKY, scrolls: MOON_SCROLLS, best: NINJA_START + 999 * NINJA_PX_PER_M * 256, streak: 999 } as MoonState;
  const r2 = moonHudRows(full);
  ok(r2[1]!.left[0]!.value === `${MOON_SKY}/${MOON_SKY}` && r2[1]!.left[0]!.tone === "gold", "HUD: RIDES 6/6 turns gold");
  ok(r2[1]!.right![0]!.value === `${MOON_SCROLLS}/${MOON_SCROLLS}` && r2[1]!.right![0]!.tone === "gold", "HUD: SCROLLS 3/3 turns gold");
  // The HUD of a real run part-way up, read from the run's own counts.
  const at = new Map(moonDeal(5).witness.map((e) => [e.t, e.a]));
  let s = moonGame.init(5);
  while (s.tick < 2400) {
    const a = at.get(s.tick + 1);
    s = moonGame.step(s, a === undefined ? null : tap(s.tick + 1, a));
  }
  const live = moonHudRows(s);
  ok(live[1]!.left[0]!.value === `${s.rides}/${MOON_SKY}` && live[1]!.right![0]!.value === `${s.scrolls}/${MOON_SCROLLS}` && s.rides > 0, `HUD: a run part-way shows its own rides and scrolls (${live[1]!.left[0]!.value}, ${live[1]!.right![0]!.value})`);
  const ctx = createCanvas(10, 10).getContext("2d") as unknown as CanvasRenderingContext2D;
  for (const row of r2) {
    const lw = row.left.reduce((w, c) => w + actionChipWidth(ctx, c) + ACTION_CHIP_GAP, ACTION_HUD_EDGE);
    const rw = (row.right ?? []).reduce((w, c) => w + actionChipWidth(ctx, c) + ACTION_CHIP_GAP, ACTION_HUD_EDGE);
    ok(lw + rw <= NINJA_WORLD_W, `HUD: "${row.left.map((c) => c.label).join(", ")}" and "${(row.right ?? []).map((c) => c.label).join(", ")}" fit one row at their widest (${lw} + ${rw} px)`);
  }
}

/* 3. The reveal's hits line. */
{
  ok(MOON_HITS_REV === MOON_REV, "hits line: its stamp is MOON_REV");
  ok(MOON_HIT_KNOCK_M * NINJA_PX_PER_M === NINJA_KNOCK, "hits line: 3 m is NINJA_KNOCK ÷ NINJA_PX_PER_M");
  const tiles = [{ label: "Height", value: "200 m" }, { label: "Hits", value: "11" }];
  ok(moonHitsLine({ type: "ricochet", ricoRev: 3 }, tiles) === "Hits: 11 · knocked down 3 m each", "hits line: 11 hits read as one plain line");
  ok(moonHitsLine({ type: "ricochet", ricoRev: 3 }, [{ label: "Hits", value: "0" }]) === "Hits: none", "hits line: a clean climb reads Hits: none");
  ok(moonHitsLine({ type: "ricochet", ricoRev: 2 }, tiles) === null, "hits line: never on ricoRev 2");
  ok(moonHitsLine({ type: "ricochet" }, tiles) === null, "hits line: never on the unstamped shaft");
  ok(moonHitsLine({ type: "skyline", ricoRev: 3 }, tiles) === null, "hits line: never on another game");
  ok(moonHitsLine({ type: "ricochet", ricoRev: 3 }, [{ label: "Height", value: "1 m" }]) === null, "hits line: none without a stored Hits stat");
  // A real run's stored reveal, its rows with the line added: one note row, the parts and total unchanged.
  const seed = 4100;
  const ev = ricoBot({ game: moonGame as any, seed, rev: MOON_REV, human: new Human("ricochet", seed, "average" as any), fixes: true }).events ?? [];
  const run = replayMoonRun(seed, moonRaw(seed, ev));
  const reveal = buildArcadeReveal("ricochet", run, run.score);
  ok(!!reveal && reveal.tiles.some((t) => t.label === "Hits" && t.value === String(run.hits)), "hits line: a replayed run's reveal stores its Hits stat");
  if (reveal) {
    const line = moonHitsLine({ type: "ricochet", ricoRev: 3 }, reveal.tiles)!;
    const before = breakdownRows(reveal.lines, run.score);
    const after = breakdownRows([...reveal.lines, line], run.score);
    const note = after.filter((r) => !before.some((b) => b.kind === r.kind && b.name === r.name && b.points === r.points));
    ok(note.length === 1 && note[0]!.kind === "note" && note[0]!.points === null && note[0]!.name.startsWith("Hits:"), `hits line: one note row with no points (${note.map((r) => r.name).join("; ")})`);
    const sum = (rows: typeof before) => rows.filter((r) => r.kind !== "total" && r.points !== null).reduce((a, r) => a + r.points!, 0);
    ok(sum(after) === sum(before) && after.at(-1)?.kind === "total" && after.at(-1)?.points === run.score, "hits line: the parts and total unchanged, the total last");
  }
  const src = readFileSync("src/components/duel/ArcadeReveal.tsx", "utf8");
  ok(/moonHitsLine\(/.test(src) && /\[\.\.\.shown\.lines, hitsLine\]/.test(src), "hits line: the arcade reveal adds it to the breakdown");
}

/* 4. The night. */
{
  ok(moonNight({ best: NINJA_START }) === 0, "night: 0 at the foot of the tower");
  ok(moonNight({ best: NINJA_START + MOON_CORE_FULL_M * NINJA_PX_PER_M * 256 }) === 1, "night: 1 at the core's full height");
  ok(moonNight({ best: NINJA_START + 400 * NINJA_PX_PER_M * 256 }) === 1, "night: held at 1 above it");
  let last = -1;
  let rises = true;
  for (let m = 0; m <= 260; m++) {
    const p = moonNight({ best: NINJA_START + m * NINJA_PX_PER_M * 256 });
    if (p < last) rises = false;
    last = p;
    const moon = moonPlace(p);
    if (moon.x - moon.r < NINJA_WALL_L || moon.x + moon.r > NINJA_WALL_R) rises = false;
  }
  ok(rises, "night: never goes back as the climb goes on, the moon between the walls");
  ok(moonPlace(1).y < moonPlace(0).y - 300 && moonPlace(1).r < moonPlace(0).r, "night: the moon rises and draws smaller");
  const a = moonGame.init(9) as MoonState;
  ok(moonNight({ ...a, best: a.best + 50000 }) === moonNight({ best: a.best + 50000 }), "night: read from the best height alone");
}

/* 5. The bounds rule. */
{
  const Z = 4;
  const ink = (draw: (x: CanvasRenderingContext2D) => void, C = 160): [number, number, number, number] => {
    const c = createCanvas(C * Z, C * Z);
    const x = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    x.scale(Z, Z);
    draw(x);
    const d = (x as any).getImageData(0, 0, C * Z, C * Z).data as Uint8ClampedArray;
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
    for (let y = 0; y < C * Z; y++)
      for (let i = 0; i < C * Z; i++)
        if (d[(y * C * Z + i) * 4 + 3]! > 40) {
          l = Math.min(l, i); r = Math.max(r, i); t = Math.min(t, y); b = Math.max(b, y);
        }
    return [l / Z, (r + 1) / Z, t / Z, (b + 1) / Z];
  };
  for (const wall of [0, 1])
    for (const tick of [0, 10, 40]) {
      const [l, r, t, b] = ink((x) => drawKatana(x, wall, 80, tick, 5), 400);
      const face = wall === 0 ? NINJA_WALL_L : NINJA_WALL_R;
      const lo = wall === 0 ? face : face - KATANA_LEN;
      const hi = wall === 0 ? face + KATANA_LEN : face;
      // The guard sits on the wall (inside the stone); the blade must stay inside the box.
      ok(l >= lo - 8 && r <= hi + 8 && (wall === 0 ? r <= hi + 2 : l >= lo - 2) && t >= 80 - 6 - 2 && b <= 80 + 6 + 2, `bounds: katana on wall ${wall} at tick ${tick} drawn ${l}–${r} × ${t}–${b}, its blade ${lo}–${hi} × ±${KATANA_HALF}`);
    }
  for (const tick of [0, 5, 13]) {
    const [l, r, t, b] = ink((x) => drawShuriken(x, 80, 80, tick));
    ok(l >= 80 - SHURIKEN_R - 2 && r <= 80 + SHURIKEN_R + 2 && t >= 80 - SHURIKEN_R - 2 && b <= 80 + SHURIKEN_R + 2, `bounds: shuriken at tick ${tick} inside its ${SHURIKEN_R} px radius (+2)`);
  }
  const main = JSON.parse(readFileSync("scripts/fixtures/hero-bounds-main.json", "utf8")) as Record<string, [number, number, number, number]>;
  for (const pose of [0, 1, 2, 3, 4])
    for (const face of [1, -1]) {
      const [l, r, t, b] = ink((x) => drawNinja(x, 80, 80, pose, face, 7, pose === 2 ? 0.7 : 0, 1));
      const was = main[`ninja-p${pose}-f${face}-t7`]!;
      const now = [80 - l, r - 80, 80 - t, b - 80];
      ok(now.every((v, i) => v <= was[i]! + 0.5), `bounds: the bolder ninja (pose ${pose}, face ${face}) no bigger than main's figure (${now.join(", ")} vs ${was.join(", ")})`);
    }
}

/* 6. The 120 s rule and grace. */
{
  ok(NINJA_RUN_SECONDS <= 120, `120 s: the run is ${NINJA_RUN_SECONDS} s`);
  ok(CATALOGUE.ricochet.timeLimitMs <= 120_000, `120 s: the round's clock is ${CATALOGUE.ricochet.timeLimitMs} ms`);
  // Leap into everything, tapping every 12 ticks: the hits never end the run before the minute.
  let s = moonGame.init(31);
  while (!moonGame.isOver(s)) s = moonGame.step(s, (s.tick + 1) % 12 === 0 ? tap(s.tick + 1) : null);
  ok(s.tick >= NINJA_RUN_SECONDS * 60 && s.hits > 0, `grace: a run that takes ${s.hits} hits lasts the whole minute (${s.tick} ticks)`);
}

/* 7. Moonwalker stays possible. */
{
  const seeds = [0, 1, 2, 3, 77, 10000, 4100, 5131];
  const low = seeds.filter((seed) => moonDeal(seed).witnessMetres < 245);
  ok(low.length === 0, `Moonwalker: every tower's witness climbs 245 m (${low.join(", ") || "all"})`);
  const d = moonDeal(77);
  const run = replayMoonRun(77, moonRaw(77, d.witness.map((e) => tap(e.t, e.a))));
  ok(ninjaMetres(run.state) >= 245 && run.score === 200, `Moonwalker: a witness run through the server replay climbs ${ninjaMetres(run.state)} m and scores ${run.score}`);
}

/*
 * 8. Edge to edge (Joe's standing rule, 15 Nov 2026): the play screen's fill (ricochetNinjaScene.renderer.ts) carries
 * the world on with no colour step at its edges, at the start (the floor at the bottom), part-way and at the top of
 * the climb (the night at the bottom), below the world on every phone size and beside it on a wide screen. The step
 * is arcade-fill-check's measure (the 4 px inside against the 4 px outside, averaged along the edge, per channel),
 * held to its SEAM_MAX (read from that file); arcade-fill-check proves the same in the browser at 414x896 and 390x844.
 */
{
  const SEAM_MAX = Number(/export const SEAM_MAX = (\d+)/.exec(readFileSync("scripts/arcade-fill-check.ts", "utf8"))?.[1]);
  ok(SEAM_MAX > 0, "edge: arcade-fill-check's SEAM_MAX read");
  const { ninjaScene } = await import("../src/lib/arcade/ricochetNinjaScene.renderer");
  const { drawNinjaWorld } = await import("../src/lib/arcade/ricochetNinja.renderer");
  const H = 730;
  // World units below and beside the world for each size (the world fits the width on a phone, the height on desktop).
  const sizes = [
    { name: "414x896 app", left: 0, right: 390, bottom: H + 90 },
    { name: "390x844", left: 0, right: 390, bottom: H + 60 },
    { name: "375x667", left: 0, right: 390, bottom: H + 20 },
    { name: "desktop 1366x768", left: -220, right: 610, bottom: H + 16 },
  ];
  const at = new Map(moonDeal(11).witness.map((e) => [e.t, e.a]));
  let s = moonGame.init(11);
  const states: [string, MoonState][] = [["start", s as MoonState]];
  for (const T of [1800, 3500]) {
    while (s.tick < T) {
      const a = at.get(s.tick + 1);
      s = moonGame.step(s, a === undefined ? null : tap(s.tick + 1, a));
    }
    states.push([`${ninjaMetres(s)} m`, s as MoonState]);
  }
  // ricoRev 4's bigger ninja (the stage-2 look pass): the same edges at its start and part-way.
  {
    const g4 = moonGameFor(4);
    const at4 = new Map(moonDeal(11, 4).witness.map((e) => [e.t, e.a]));
    let s4 = g4.init(11);
    states.push(["rev 4 start", s4 as MoonState]);
    while (s4.tick < 2200) {
      const a = at4.get(s4.tick + 1);
      s4 = g4.step(s4, a === undefined ? null : tap(s4.tick + 1, a));
    }
    states.push([`rev 4 ${ninjaMetres(s4)} m`, s4 as MoonState]);
  }
  const mean = (d: Uint8ClampedArray, w: number, x0: number, y0: number, x1: number, y1: number) => {
    const m = [0, 0, 0];
    let n = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        m[0] += d[i]!; m[1] += d[i + 1]!; m[2] += d[i + 2]!;
        n++;
      }
    return m.map((v) => v / n);
  };
  const step = (a: number[], b: number[]) => (Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!)) / 3;
  for (const size of sizes)
    for (const [label, st] of states) {
      const w = size.right - size.left;
      const c = createCanvas(w, size.bottom);
      const x = c.getContext("2d") as unknown as CanvasRenderingContext2D;
      x.translate(-size.left, 0);
      ninjaScene(x, { worldW: 390, worldH: H, left: size.left, top: 0, right: size.right, bottom: size.bottom, scale: 1 });
      x.save();
      x.beginPath();
      x.rect(0, 0, 390, H);
      x.clip();
      drawNinjaWorld(x, st);
      x.restore();
      const d = (x as any).getImageData(0, 0, w, size.bottom).data as Uint8ClampedArray;
      const ox = -size.left;
      const bottom = step(mean(d, w, ox, H - 4, ox + 390, H), mean(d, w, ox, H, ox + 390, H + 4));
      if (process.argv.includes("--verbose")) console.log(size.name, label, bottom.toFixed(1));
      ok(bottom <= SEAM_MAX, `edge: ${size.name}, ${label}: the world's bottom edge steps ${bottom.toFixed(1)} per channel into the fill (most ${SEAM_MAX})`);
      if (size.left < 0) {
        const left = step(mean(d, w, ox, 0, ox + 4, H), mean(d, w, ox - 4, 0, ox, H));
        const right = step(mean(d, w, ox + 386, 0, ox + 390, H), mean(d, w, ox + 390, 0, ox + 394, H));
        ok(left <= SEAM_MAX && right <= SEAM_MAX, `edge: ${size.name}, ${label}: the side edges step ${left.toFixed(1)} / ${right.toFixed(1)} per channel (most ${SEAM_MAX})`);
      }
    }
}

/*
 * 9. ricoRev 4, the bigger ninja (the Action overhaul's stage 2, 15 Nov 2026; Joe's ask; docs/arcade-standard/ricochet.md
 * "ricoRev 4"): rev 3's game with the body box MOON_BIG_HW × MOON_BIG_HH either side (34 × 68, was 26 × 52).
 *  a. ricoRev 3 unchanged: 60 towers (tower, witness and its metres) and 40 runs (random and every skill level, 5
 *     seeds) recorded on 14ce058d before the change (scripts/fixtures/ricochet-big-legacy.json,
 *     scripts/ricochet-big-legacy-record.ts) deal and replay to the same digests and scores;
 *  b. rooms deal ricoRev 4; the ricoPreBig pin deals ricoRev 3; the live bands, the standard's spec and the practice
 *     stamps follow;
 *  c. the body: the box, the cling x, the floor's standing height (metres measured from it), a wall-to-wall leap still
 *     NINJA_LEAP_TICKS, the ledge faces; rev 3 keeps the old body; the parts are rev 3's exactly;
 *  d. every tower re-proved: each dealt tower's witness through the server's rev-4 replay scores exactly 200 with every
 *     part full and no hit (24 seeds; CHECKS_FULL 120), so "Moonwalker" (245 m on Hard) stays possible on every tower;
 *  e. the 120 s rule and grace on rev 4: a run of hits still lasts the minute;
 *  f. the hits follow the bigger body: a katana the old box missed by 2 px now hits;
 *  g. the bands still rise weak → flawless on rev 4 (4 seeds, quick).
 */
{
  const L = JSON.parse(readFileSync("scripts/fixtures/ricochet-big-legacy.json", "utf8")) as { deals: Record<string, string>; runs: Rec[] };
  const badDeals = Object.entries(L.deals).filter(([seed, dg]) => {
    const d = moonDeal(Number(seed), MOON_REV);
    return digest({ tower: d.tower, witness: d.witness, metres: d.witnessMetres }) !== dg;
  });
  ok(Object.keys(L.deals).length === 60 && badDeals.length === 0, `ricoRev 4 a: the 60 ricoRev 3 towers recorded before it deal the same (${badDeals.map(([s]) => s).join(", ") || "all"})`);
  const badRuns = L.runs.filter((r) => {
    const out = replayMoonRun(r.seed, r.raw, MOON_REV);
    return out.score !== r.score || digest(out.state) !== r.digest;
  });
  ok(L.runs.length === 40 && badRuns.length === 0 && new Set(L.runs.map((r) => r.level)).size === 8, `ricoRev 4 a: the 40 ricoRev 3 runs recorded before it replay to the same score and state (${badRuns.length} differ)`);
  ok(L.runs.every((r) => replayMoonRun(r.seed, r.raw).score === r.score), "ricoRev 4 a: a stored round with no stamp argument still replays as ricoRev 3");

  // b. The deal.
  ok(MOON_BIG_REV === 4 && generateRicochet().ricoRev === MOON_BIG_REV, "ricoRev 4 b: rooms deal ricoRev 4");
  const was = pinRicoPreBig(true);
  ok(generateRicochet().ricoRev === MOON_REV, "ricoRev 4 b: the ricoPreBig pin deals ricoRev 3");
  pinRicoPreBig(was);
  ok(LIVE_BANDS.ricochet!.rev === MOON_BIG_REV && LIVE_BANDS.ricochet!.std === MOON_BIG_STD_SPEC, "ricoRev 4 b: the live bands carry ricoRev 4's spec");
  ok(ARCADE_STANDARD.ricochet!.spec === MOON_BIG_STD_SPEC, "ricoRev 4 b: the standard's spec is ricoRev 4's");
  ok(/ricochet": "[^"]*ricoRev=4/.test(readFileSync("src/lib/duel/practiceStamps.data.ts", "utf8")), "ricoRev 4 b: the practice stamps carry ricoRev=4");
  ok(DEAL_PIN_NAMES.includes("ricoPreBig") && POST_RECORDING_PINS.includes("ricoPreBig"), "ricoRev 4 b: ricoPreBig is an era switch, pinned by deal-identity's recording");

  // c. The body.
  const B = MOON_BIG_BODY;
  ok(B.hw === 17 && B.hh === 34 && MOON_BIG_HW === 17 && MOON_BIG_HH === 34, "ricoRev 4 c: the body box 34 × 68");
  ok(ninjaBodyFor(4) === B && ninjaBodyFor(3) === NINJA_BODY && ninjaBodyFor(2) === NINJA_BODY && NINJA_BODY.hw === 13 && NINJA_BODY.hh === 26, "ricoRev 4 c: rev 4 the bigger body, rev 2 and 3 the old");
  ok(B.clingX[0] === NINJA_WALL_L + 17 && B.clingX[1] === NINJA_WALL_R - 17 && B.start === (34 + 4) * 256, "ricoRev 4 c: cling x and the floor's standing height follow the body");
  ok(moonLeapTicks(B.gap, B) === NINJA_LEAP_TICKS && moonLeapTicks(NINJA_BODY.gap) === NINJA_LEAP_TICKS, "ricoRev 4 c: a wall-to-wall leap is still NINJA_LEAP_TICKS");
  const s4 = moonGameFor(4).init(21) as MoonState;
  const s3 = moonGameFor(3).init(21) as MoonState;
  ok(s4.rev === 4 && s4.x === B.clingX[0] && s4.y === B.start && s4.best === B.start && ninjaMetres(s4) === 0, "ricoRev 4 c: a rev-4 run starts on the floor at the bigger body's place, 0 m");
  ok(s3.rev === 3 && s3.x === NINJA_BODY.clingX[0] && s3.y === NINJA_START, "ricoRev 4 c: a rev-3 run starts where it always did");
  ok(ninjaMetres({ ...s4, best: B.start + 245 * NINJA_PX_PER_M * 256 }) === 245, "ricoRev 4 c: metres are measured from the bigger body's floor height");
  const ledge = { x: 195, lo: 400, hi: 520 };
  ok(moonLedgeX(ledge, 0, B) === 195 - MOON_LEDGE_HW - 17 && moonLedgeX(ledge, 1, B) === 195 + MOON_LEDGE_HW + 17 && moonLedgeX(ledge, 0) === 195 - MOON_LEDGE_HW - 13, "ricoRev 4 c: the ledge faces follow the body");
  ok(JSON.stringify(MOON_BIG_STD_SPEC.parts) === JSON.stringify(MOON_STD_SPEC.parts) && MOON_BIG_STD_SPEC.rev === 4 && MOON_STD_SPEC.rev === 3, "ricoRev 4 c: the parts are rev 3's exactly, under the new stamp");
  const full4 = { ...s4, acted: 1, best: B.start + 300 * NINJA_PX_PER_M * 256, flow: 10, rides: MOON_SKY, scrolls: MOON_SCROLLS } as MoonState;
  ok(moonGameFor(4).score(full4) === 200 && moonGameFor(3).score({ ...full4, rev: 3, best: NINJA_START + 300 * NINJA_PX_PER_M * 256 } as MoonState) === 200, "ricoRev 4 c: every part full scores 200 on both");

  // d. Every tower re-proved through the server replay.
  const SEEDS4 = process.env["CHECKS_FULL"] === "1" ? Array.from({ length: 120 }, (_, i) => i * 7919 + 3) : [0, 1, 2, 3, 11, 77, 4100, 10000, 123456789, ...Array.from({ length: 15 }, (_, i) => 5000 + i * 131)];
  const notPerfect: string[] = [];
  for (const seed of SEEDS4) {
    const d = moonDeal(seed, MOON_BIG_REV);
    const run = replayMoonRun(seed, moonRaw4(seed, d.witness.map((e) => tap(e.t, e.a))), MOON_BIG_REV);
    const st = run.state as MoonState;
    if (run.flagged || run.score !== 200 || st.hits !== 0 || st.rides !== MOON_SKY || st.scrolls !== MOON_SCROLLS || ninjaMetres(st) < 245) notPerfect.push(`${seed}: ${run.score}, ${ninjaMetres(st)} m, ${st.hits} hits`);
  }
  ok(notPerfect.length === 0, `ricoRev 4 d: every tower's witness scores 200 through the server's rev-4 replay, every part full, no hit, 245 m or more (${SEEDS4.length} seeds; ${notPerfect.join("; ") || "all"})`);
  ok(moonDeal(77, MOON_BIG_REV).witnessMetres >= 245 && JSON.stringify(moonDeal(77, MOON_BIG_REV).tower) !== JSON.stringify(moonDeal(77, MOON_REV).tower), "ricoRev 4 d: rev 4's towers are their own (built and proved with the bigger body), each witness at 245 m or more");

  // e. 120 s and grace.
  let g = moonGameFor(4).init(31);
  while (!moonGameFor(4).isOver(g)) g = moonGameFor(4).step(g, (g.tick + 1) % 12 === 0 ? tap(g.tick + 1) : null);
  ok(g.tick >= NINJA_RUN_SECONDS * 60 && g.hits > 0, `ricoRev 4 e: a run that takes ${g.hits} hits lasts the whole minute (${g.tick} ticks)`);

  // f. The hit box is the bigger body: a katana 2 px beyond the old box's top edge misses rev 3 and hits rev 4.
  const k = { wall: 0, y: 500 };
  const ypx = k.y + KATANA_HALF + 26 + 2; // the old box's foot 2 px above the blade
  ok(!katanaTouches(k, NINJA_WALL_L + 13, ypx) && katanaTouches(k, NINJA_WALL_L + 17, ypx, 0, B), "ricoRev 4 f: a katana 2 px clear of the old box touches the bigger one");

  // g. The bands still rise (quick).
  const lv = ["weak", "great", "perfect"] as const;
  const med: number[] = [];
  for (const level of lv) {
    const xs: number[] = [];
    for (const seed of [4100, 4197, 4294]) {
      const ev = ricoBot({ game: moonGameFor(4) as any, seed, rev: MOON_BIG_REV, human: new Human("ricochet", seed, level as any), fixes: true }).events ?? [];
      xs.push(replayMoonRun(seed, moonRaw4(seed, ev), MOON_BIG_REV).score);
    }
    med.push(xs.sort((a, b) => a - b)[1]!);
  }
  ok(med[0]! < med[1]! && med[1]! < med[2]! && med[2] === 200, `ricoRev 4 g: weak < great < flawless (${med.join(" < ")})`);
}

/*
 * 10. The stage-2 look pass (15 Nov 2026, display only; concept ricochet-A): every frame below drawn by the real renderer.
 *  a. the sky lantern's light falls on the stone only: a frame with a lantern differs from the same frame without it
 *     only inside the lantern's own touch radius (+2, the bounds rule) or on the walls and ledges (no glow round it);
 *  b. the far lanterns are display only and small: placed by the tick alone, inside the shaft, never larger than half a
 *     sky lantern; the sim never imports the renderer;
 *  c. the moon is large and warm low down and rises (section 4), drawn inside the sky between the walls;
 *  d. the wall's moonlight rakes: brighter at the moon's height than far from it, none in the world's bottom 40 px;
 *  e. the bigger ninja draws at ninjaArtScale(4) = 17/13 and fills its box: wider and taller than the old figure, each
 *     pose within main's figure's allowance grown by that scale (art-check holds the same); no rim round it.
 */
{
  const frame = (s: MoonState) => {
    const c = createCanvas(390, 730);
    const x = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    drawWorld(x, s);
    return (x as any).getImageData(0, 0, 390, 730).data as Uint8ClampedArray;
  };
  // a. A rev-4 run when a sky lantern is in view mid-shaft.
  const d = moonDeal(11, MOON_BIG_REV);
  const at = new Map(d.witness.map((e) => [e.t, e.a]));
  let s = moonGameFor(4).init(11) as MoonState;
  let found: { s: MoonState; i: number } | null = null;
  while (!s.ended && !found) {
    const a = at.get(s.tick + 1);
    s = moonGameFor(4).step(s, a === undefined ? null : tap(s.tick + 1, a)) as MoonState;
    if (s.mode !== MODE_FLIGHT && s.mode !== 0) continue;
    s.tower.sky.forEach((l, i) => {
      const p = moonSkyAt(l, s.tick);
      if (!found && p && !s.gotSky[i] && Math.abs(p.y - (s.y >> 8)) < 160) found = { s, i };
    });
  }
  ok(!!found, "look a: a frame with a sky lantern in view");
  if (found) {
    const { s: st, i } = found as { s: MoonState; i: number };
    const without = { ...st, gotSky: st.gotSky.map((g, j) => (j === i ? 1 : g)) } as MoonState;
    const A = frame({ ...st, hitTick: -999, pickTick: -999, flowTick: -999, grabTick: -999 } as MoonState);
    const Bf = frame({ ...without, hitTick: -999, pickTick: -999, flowTick: -999, grabTick: -999 } as MoonState);
    const cam = ninjaCamera(st);
    const p = moonSkyAt(st.tower.sky[i]!, st.tick)!;
    const lx = p.x;
    const ly = ninjaScreenY(cam, p.y);
    const ledges = st.tower.ledges.map((l) => ({ x0: l.x - MOON_LEDGE_HW, x1: l.x + MOON_LEDGE_HW, y0: ninjaScreenY(cam, l.hi), y1: ninjaScreenY(cam, l.lo) }));
    const ninja = ninjaDrawPoint(st);
    let stray = 0;
    let lit = 0;
    for (let y = 60; y < 700; y++)
      for (let x = 0; x < 390; x++) {
        const k = (y * 390 + x) * 4;
        const diff = Math.abs(A[k]! - Bf[k]!) + Math.abs(A[k + 1]! - Bf[k + 1]!) + Math.abs(A[k + 2]! - Bf[k + 2]!);
        if (diff <= 6) continue;
        const onStone = x < NINJA_WALL_L || x >= NINJA_WALL_R || ledges.some((l) => x >= l.x0 && x < l.x1 && y >= l.y0 && y < l.y1);
        const inLantern = Math.hypot(x + 0.5 - lx, y + 0.5 - ly) <= MOON_SKY_R + 2;
        const nearNinja = Math.abs(x - ninja.x) <= 40 && Math.abs(y - ninja.y) <= 60;
        if (onStone) lit++;
        else if (!inLantern && !nearNinja) stray++;
      }
    ok(stray === 0, `look a: the lantern changes nothing in the gap outside its own radius (+2): ${stray} pixels`);
    ok(lit > 400, `look a: its warm light falls on the stone near it (${lit} wall or ledge pixels lit)`);
  }
  // b. Far lanterns.
  const sim = readFileSync("src/lib/arcade/ricochetNinja.ts", "utf8");
  ok(!/renderer/.test(sim.split("\n").filter((l) => l.startsWith("import")).join("\n")), "look b: the sim imports no renderer");
  let inside = true;
  let small = true;
  for (let i = 0; i < FAR_LANTERN_COUNT; i++)
    for (const t of [0, 500, 1800, 3599]) {
      const f = farLanternAt(i, t);
      const g2 = farLanternAt(i, t);
      if (f.x !== g2.x || f.y !== g2.y) inside = false;
      if (f.x < NINJA_WALL_L + 8 || f.x > NINJA_WALL_R - 8) inside = false;
      if (7 * f.s > MOON_SKY_R) small = false;
    }
  ok(FAR_LANTERN_COUNT >= 4 && inside, "look b: the far lanterns are placed by the tick alone, inside the shaft");
  ok(small, "look b: a far lantern is never taller than half a sky lantern");
  // c. The moon: large and low at the foot.
  ok(moonPlace(0).r >= 80 && moonPlace(1).r >= 60, `look c: the moon is large (${moonPlace(0).r} px low down, ${moonPlace(1).r} px high)`);
  // d. The rake.
  {
    const c = createCanvas(390, 730);
    const x = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    x.fillStyle = "#000";
    x.fillRect(0, 0, 390, 730);
    wallRake(x, 0, 300, 0.5);
    const px = (xx: number, yy: number) => (x as any).getImageData(xx, yy, 1, 1).data[0] as number;
    ok(px(NINJA_WALL_L - 2, 300) > px(NINJA_WALL_L - 2, 60) && px(NINJA_WALL_L - 2, 300) > px(10, 300), "look d: the moon rakes brightest at its height and on the face towards the gap");
    let foot = 0;
    for (let y = 690; y < 730; y++) foot = Math.max(foot, px(NINJA_WALL_L - 2, y));
    wallRake(x, 0, 700, 1);
    let foot2 = 0;
    for (let y = 690; y < 730; y++) foot2 = Math.max(foot2, px(NINJA_WALL_L - 2, y));
    ok(foot === 0 && foot2 === 0, "look d: no rake in the world's bottom 40 px (the fill below carries none)");
  }
  // e. The bigger ninja.
  ok(ninjaArtScale(4) === MOON_BIG_HW / 13 && ninjaArtScale(3) === 1, "look e: rev 4 draws the figure at 17/13");
  const inkOf = (scale: number) => {
    const c = createCanvas(240, 240);
    const x = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    drawNinja(x, 120, 120, 0, 1, 7, 0, scale);
    const dd = (x as any).getImageData(0, 0, 240, 240).data as Uint8ClampedArray;
    let l = 999, r = -1, t = 999, b = -1;
    for (let y = 0; y < 240; y++)
      for (let xx = 0; xx < 240; xx++)
        if (dd[(y * 240 + xx) * 4 + 3]! > 40) {
          l = Math.min(l, xx); r = Math.max(r, xx); t = Math.min(t, y); b = Math.max(b, y);
        }
    return { w: r - l + 1, h: b - t + 1 };
  };
  const small1 = inkOf(1);
  const big = inkOf(ninjaArtScale(4));
  ok(big.w >= small1.w * 1.25 && big.h >= small1.h * 1.25, `look e: the bigger ninja is drawn larger (${big.w} × ${big.h} px, was ${small1.w} × ${small1.h})`);
  const src = readFileSync("src/lib/arcade/ricochetNinja.renderer.ts", "utf8");
  ok(!/rgba\(242,199,92,0\.55\)/.test(src), "look e: no gold rim round the ninja (Joe: no glowing edges)");
}

/*
 * 11. Stage 2's effects and the answer reveal (15 Nov 2026, display only; docs/arcade-standard/ricochet.md "Stage 2:
 *     effects and the reveal"):
 *  a. every effect observes the sim: a run drawn every tick ends in exactly the state of the same run not drawn;
 *  b. the events: a leap off a wall kicks dust at that wall's face, a double jump a ring under the feet, a scroll its
 *     flight to the HUD (whose SCROLLS chip flashes as it lands), a hit a red "−3 m"; the same states give the same
 *     events on any canvas; every physical action ends within 900 ms (54 ticks); the sound's tally tick matches;
 *  c. the scuff trail turns red only once a slide on moss or ice would break a running streak (MOON_FLOW_SLIDE);
 *  d. the grabbed lantern brightens and sways, settling over its ride; the hit tumbles through the knock-down's fall;
 *  e. sounds: lanternSway on a grab, scrollTally on the landing, wired and documented (their rows moved to
 *     arcade-effects.md);
 *  f. the reveal's run picture: the stored log replayed through the real sim (moonRunSummary) agrees with the server's
 *     replay (height, rides, scrolls, hits, best flow) on runs at every level; each hit's metres lost at most 3; the
 *     drawing shows the reached height, the hits in red and the best flow in gold; the component shows four big
 *     numbers with short plain labels and one picture, and the shared reveal draws it in place of the tiles.
 */
{
  const R = await import("../src/lib/arcade/ricochetNinja.renderer");
  const g4 = moonGameFor(4);
  // a + b. A run with every kind of event, drawn every tick on one canvas.
  const seed = 4100;
  const ev = ricoBot({ game: g4 as any, seed, rev: MOON_BIG_REV, human: new Human("ricochet", seed, "average" as any), fixes: true }).events ?? [];
  const at = new Map(ev.map((e) => [e.t, e]));
  const c = createCanvas(390, 730);
  const x = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  let drawn = g4.init(seed) as MoonState;
  let plain = g4.init(seed) as MoonState;
  const seen = { dust: 0, ring: 0, scroll: 0, loss: 0, trail: 0 } as Record<string, number>;
  let dustAtFace = true;
  let lossText = true;
  let scrollFlash = true;
  let mem = new Set<string>();
  const ctxKey = {};
  for (let t = 1; t <= 2400 && !g4.isOver(drawn); t++) {
    const input = at.get(t) ?? null;
    const before = drawn;
    drawn = g4.step(drawn, input) as MoonState;
    plain = g4.step(plain, input) as MoonState;
    R.drawNinjaWorld(x, drawn);
    const events = R.moonFxEvents(ctxKey, drawn);
    for (const e of events) {
      const id = `${e.kind}:${e.t}`;
      if (mem.has(id)) continue;
      mem.add(id);
      seen[e.kind] = (seen[e.kind] ?? 0) + 1;
      if (e.kind === "dust" && before.ledge < 0 && e.x !== NINJA_WALL_L && e.x !== NINJA_WALL_R) dustAtFace = false;
      if (e.kind === "loss" && e.n !== 3 && drawn.knockTo > MOON_BIG_BODY.start) lossText = false;
    }
    if (drawn.scrolls > before.scrolls) {
      const rows0 = moonHudRows(drawn);
      if ((rows0[1]!.right![0]!.flash ?? 0) !== 0) scrollFlash = false;
      const landed = moonHudRows({ ...drawn, tick: drawn.tick + R.MOON_FX_SCROLL_TICKS } as MoonState);
      if (!((landed[1]!.right![0]!.flash ?? 0) > 0.9)) scrollFlash = false;
    }
  }
  ok(JSON.stringify(drawn) === JSON.stringify(plain), "effects a: a run drawn every tick ends in the same state as the same run not drawn");
  ok(seen.dust! > 10 && seen.ring! > 2 && seen.loss! > 0 && seen.scroll! > 0, `effects b: the run shows dust, air rings, hits and scrolls (${JSON.stringify(seen)})`);
  ok(dustAtFace, "effects b: a leap's dust kicks off the face of the wall it leaves");
  ok(lossText, "effects b: a hit shows the metres it knocked the ninja down (3)");
  ok(scrollFlash, "effects b: the SCROLLS chip flashes when the flying scroll lands, not before");
  const again = {};
  let a2 = g4.init(seed) as MoonState;
  for (let t = 1; t <= 600; t++) {
    a2 = g4.step(a2, at.get(t) ?? null) as MoonState;
    R.moonFxEvents(again, a2);
  }
  const b2 = {};
  let s2 = g4.init(seed) as MoonState;
  for (let t = 1; t <= 600; t++) {
    s2 = g4.step(s2, at.get(t) ?? null) as MoonState;
    R.moonFxEvents(b2, s2);
  }
  ok(JSON.stringify(R.moonFxEvents(again, a2)) === JSON.stringify(R.moonFxEvents(b2, s2)), "effects b: the same states give the same events on any canvas");
  ok(Math.max(R.MOON_FX_DUST_TICKS, R.MOON_FX_RING_TICKS, R.MOON_FX_SCROLL_TICKS, R.MOON_FX_TRAIL_FADE, R.MOON_FX_TUMBLE_TICKS) <= 54, "effects b: every physical action ends within 900 ms");
  const { MOON_SCROLL_TALLY_TICKS } = await import("../src/lib/fx/gameSounds");
  ok(MOON_SCROLL_TALLY_TICKS === R.MOON_FX_SCROLL_TICKS, "effects b: the tally sound lands with the scroll");
  // c. The scuff trail.
  const base = g4.init(5) as MoonState;
  const patch = base.tower.patches.find((p) => p.wall === 0 && p.kind === SURF_MOSS)!;
  const on = { ...base, mode: 0, ledge: -1, wall: 0, y: (patch.lo + 20) * 256 } as MoonState;
  ok(R.moonScuff({ ...on, slid: 0 }) === null, "effects c: no trail before the slide starts");
  ok(R.moonScuff({ ...on, slid: 8 * 256, streak: 4 })?.redFrom === null, "effects c: a short slide's trail is not red");
  ok(R.moonScuff({ ...on, slid: MOON_FLOW_SLIDE + 256, streak: 4 })?.redFrom !== null, "effects c: past MOON_FLOW_SLIDE with a streak running the trail turns red");
  ok(R.moonScuff({ ...on, slid: MOON_FLOW_SLIDE + 256, streak: 0 })?.redFrom === null, "effects c: with no streak to break it stays plain");
  ok(R.moonScuff({ ...on, y: (patch.hi + 300) * 256, slid: 9000 }) === null || ninjaSurface(base.tower.patches, 0, patch.hi + 300) !== 0, "effects c: no scuff on plain stone");
  // d. The lantern sway and the tumble.
  const s0 = R.moonLanternSway(0);
  const s40 = R.moonLanternSway(40);
  const s100 = R.moonLanternSway(100);
  ok(s0.flare === 1 && s40.flare < 0.1 && Math.abs(s100.angle) < 0.06, "effects d: the grabbed lantern flares and its sway settles over the ride");
  const rsrc = readFileSync("src/lib/arcade/ricochetNinja.renderer.ts", "utf8");
  ok(/fallAge < MOON_FX_TUMBLE_TICKS/.test(rsrc) && R.MOON_FX_TUMBLE_TICKS === 20, "effects d: a hit tumbles the ninja through the knock-down's fall");
  // e. Sounds.
  const snd = readFileSync("src/lib/fx/gameSounds.ts", "utf8");
  ok(/effectCue\("ricochet\.lanternSway"\)/.test(snd) && /effectCue\("ricochet\.scrollTally"\)/.test(snd) && /effectCue\("ricochet\.fallWhistle"\)/.test(snd) && /effectCue\("ricochet\.flowBreak"/.test(snd) && /loopCue\("ricochet\.scuff"/.test(snd), "effects e: every effect's sound is wired to its slot");
  const fx = readFileSync("docs/sound-cues/arcade-effects.md", "utf8");
  const st2 = readFileSync("docs/sound-cues/action-overhaul-stage2.md", "utf8");
  ok(/`ricochet\.scrollTally`/.test(fx) && /`ricochet\.lanternSway`/.test(fx) && !/`ricochet\./.test(st2), "effects e: their rows moved to arcade-effects.md");
  // f. The run picture.
  const { moonRunSummary } = await import("../src/lib/duel/moonSummary");
  let agree = 0;
  let runs = 0;
  let lastRaw = "";
  let lastSum: ReturnType<typeof moonRunSummary> | null = null;
  for (const [sd, level] of [[4100, "weak"], [4197, "average"], [4294, "great"], [5131, "perfect"]] as const) {
    const e2 = ricoBot({ game: g4 as any, seed: sd, rev: MOON_BIG_REV, human: new Human("ricochet", sd, level as any), fixes: true }).events ?? [];
    const raw = moonRaw4(sd, e2);
    const run = replayMoonRun(sd, raw, MOON_BIG_REV);
    const sum = moonRunSummary(sd, raw, MOON_BIG_REV);
    runs++;
    const st = run.state as MoonState;
    if (sum.metres === run.metres && sum.rideCount === run.rides && sum.scrollCount === run.scrolls && sum.hitCount === run.hits && sum.hits.length === run.hits && sum.rides.length === run.rides && sum.scrolls.length === run.scrolls && sum.bestStreak === st.bestStreak && sum.hits.every((h) => h.lostM >= 0 && h.lostM <= 3)) agree++;
    if (run.hits > 2) {
      lastRaw = raw;
      lastSum = sum;
    }
  }
  // A stored rev-3 run too (the recorded fixture), on its own stamp.
  const L3 = JSON.parse(readFileSync("scripts/fixtures/ricochet-big-legacy.json", "utf8")) as { runs: Rec[] };
  for (const r of L3.runs.slice(0, 16)) {
    const run = replayMoonRun(r.seed, r.raw, MOON_REV);
    const sum = moonRunSummary(r.seed, r.raw, MOON_REV);
    runs++;
    if (sum.metres === run.metres && sum.hitCount === run.hits && sum.rideCount === run.rides && sum.scrollCount === run.scrolls) agree++;
  }
  ok(agree === runs, `reveal f: the picture's numbers are the server replay's on ${agree} of ${runs} runs (rev 4 at every level, stored rev-3 runs)`);
  if (lastSum) {
    const W = 340;
    const cc = createCanvas(W, 360);
    const px = cc.getContext("2d") as unknown as CanvasRenderingContext2D;
    R.drawMoonRunPicture(px, lastSum, { width: W, height: 360 });
    const d = (px as any).getImageData(0, 0, W, 360).data as Uint8ClampedArray;
    let red = 0;
    let gold = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i]! > 220 && d[i + 1]! < 120 && d[i + 2]! < 130) red++;
      if (d[i]! > 220 && d[i + 1]! > 170 && d[i + 2]! < 120) gold++;
    }
    ok(red > 30 && gold > 100, `reveal f: the picture shows the hits in red (${red} px) and the best flow and full height in gold (${gold} px)`);
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { ricochetPuzzle } = await import("../src/puzzles/ricochet");
    ok(typeof ricochetPuzzle.RunPicture === "function", "reveal f: Moon Climb declares its run picture");
    const html = renderToStaticMarkup(React.createElement(ricochetPuzzle.RunPicture!, { puzzle: { type: "ricochet", seed: 4294, ricoRev: MOON_BIG_REV } as never, myAnswer: lastRaw }));
    const stat = (name: string) => new RegExp(`data-moon-stat="${name}"[^>]*><span[^>]*>([^<]+)</span>`).exec(html)?.[1];
    ok(stat("height") === `${lastSum.metres} m` && stat("flow") === String(lastSum.bestStreak) && stat("rides") === `${lastSum.rideCount}/6` && stat("scrolls") === `${lastSum.scrollCount}/3`, `reveal f: four big numbers, height, best flow, rides and scrolls (${stat("height")}, ${stat("flow")}, ${stat("rides")}, ${stat("scrolls")})`);
    ok(/text-3xl/.test(html) && (html.match(/<canvas/g) ?? []).length === 1, "reveal f: big type and one picture");
    for (const name of ["flow", "hit", "full"]) ok(html.includes(`data-moon-legend="${name}"`), `reveal f: the legend names ${name}`);
    const text = html.replace(/<[^>]+>/g, " ");
    ok(!/[×→·]/.test(text) && !/\bcore\b|\bunits\b/i.test(text), "reveal f: no stray ×, arrows or jargon in the picture's text");
    const ar = readFileSync("src/components/duel/ArcadeReveal.tsx", "utf8");
    ok(/<GameRunPicture puzzle=\{puzzle\} myAnswer=\{myAnswer\} \/>/.test(ar) && /ownPicture \? \[\]/.test(ar) && /hitsLine/.test(ar), "reveal f: the shared reveal draws it in place of the tiles, the stage-1 hits line kept");
    if (process.env.EFFECT_SHOTS) (await import("node:fs")).writeFileSync(`${process.env.EFFECT_SHOTS}/moon-picture.png`, cc.toBuffer("image/png"));
  } else ok(false, "reveal f: a run with hits to draw");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL ricochet-overhaul-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS ricochet-overhaul-check: ${checks} checks`);
