/**
 * Moon Climb's Action overhaul, stage 1 (15 Nov 2026; docs/arcade-standard/ricochet.md "The Action overhaul";
 * display only, no stamp, no scoring change):
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
} from "../src/lib/arcade/ricochetNinja";
import { drawKatana, drawNinja, drawShuriken, moonHudRows, moonNight, moonPlace } from "../src/lib/arcade/ricochetNinja.renderer";
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

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL ricochet-overhaul-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS ricochet-overhaul-check: ${checks} checks`);
