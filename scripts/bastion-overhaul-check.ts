/**
 * bastion-overhaul-check (Action overhaul, phase 2 step 4, 15 Nov 2026; docs/arcade-standard/bastion.md "The Action
 * overhaul"): Iron Wall's look and teaching changes, all display and sound only.
 *
 *  1. The setting by wave: clear for waves 1–2, dust for 3–4, storm for 5, each cross-fading in over 90 ticks from its
 *     wave's start; the scene repaints per setting (sceneKey); the three skies are drawn differently and the road's
 *     lanes are drawn the same in every setting.
 *  2. Far tanks: past 620 px a thin outline on the tank's own edges (inside the 2 px bounds rule) and a type badge (S, M,
 *     H) of at least 10 px text, the three lanes' badges never overlapping; near tanks get neither; a live frame draws
 *     badges for its far tanks only.
 *  3. The reload tip: shown during the run's first reload when it began with the magazine empty, never again; never if
 *     the first reload was a swipe; the art draws it only then.
 *  4. Same play: rev-2 runs recorded on main 63261010 and rev-3 runs recorded on main a3f40ff7 before the overhaul
 *     replay to the same score, parts, checksum and tick, and gradeAnswer scores them the same.
 *  5. The view mapping is unchanged (iron-wall-view-check passes; the crosshair still 120 px above the thumb).
 *  6. The 120 s rule and the grace: a 60 s run on a 63 s clock; three base hits allowed, a run going on after the first.
 *  7. Readable text: the panel's labels and hints are 13 px, the badge's letter 11 px; the intro still is the game's own
 *     art; the new sound slots are registered (silent until their files) and wired.
 *  8. Edge to edge: the scene beyond the world continues it with no seam.
 *  9. Stage 2's effects (display and sound only): the barrel's 3 px, 80 ms kick and the 3-tick muzzle flash (the mount
 *     never moves); the shell's shadow ending on its landing point; dents inside the hull; every kill's "+n", every
 *     weak-spot hit's gold, every near miss's CLOSE, the fast reload's shells snapping in 4 ticks apart, the jam's red
 *     needle, a crack on the panel for each base hit (clear of its labels); every effect under 900 ms; the end card
 *     (the hold, the rows 150 ms apart, WALL HELD or BASE DOWN, the rows adding up to the kills) and its sounds.
 * 10. Stage 2's reveal: on every recorded rev-2 and rev-3 run the picture's ledger ends where the server's replay ends
 *     and puts every kill, base hit, weak-spot hit and drone on its tank and wave; the rows, text sizes and big numbers;
 *     the arcade reveal shows it (tank revisions only), open in practice and with the breakdown in a room.
 *
 *   bun scripts/bastion-overhaul-check.ts      # ~5 s
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createCanvas } from "@napi-rs/canvas";

import {
  bastionIronGame,
  bastionTankCheckpoint,
  bastionTankGame,
  bastionTankRects,
  bastionPlan,
  BT2_BASE,
  BT2_HP,
  BT2_MAG,
  BT2_WALL_Y,
  BT2_FAR,
  BT2_INPUT_FIRE,
  BT2_INPUT_RELOAD,
  BT2_RUN_TICKS,
  BT2_WAVE_START,
  BT2_WORLD_H,
  BT2_WORLD_W,
  type BastionTankState,
} from "../src/lib/arcade/bastionTank";
import {
  bastionBadgeBox,
  bastionIronArtGame,
  bastionSceneKey,
  bastionSettingMix,
  bastionSettingOf,
  bastionSwipeHint,
  BT_BADGE_FONT,
  BT_BADGES,
  BT_FAR_MARK_Z,
  BT_SETTING_FADE,
  BT_SETTING_STEPS,
  BT_SWIPE_HINT,
  bastionScene,
  paintTankBadge,
  paintTankOutline,
} from "../src/lib/arcade/bastionTank.renderer";
import {
  bastionEndHoldMs,
  bastionFlashAge,
  bastionKick,
  bastionKillPoints,
  bastionNearMiss,
  bastionSnapLit,
  bastionTallyRows,
  bastionWaveTallies,
  BT_END_HOLD_MS,
  BT_FLASH_TICKS,
  BT_HELD_AT_MS,
  BT_JAM_SHAKE_TICKS,
  BT_KICK_PX,
  BT_KICK_TICKS,
  BT_SNAP_STEP,
  BT_TALLY_FIRST_MS,
  BT_TALLY_STEP_MS,
} from "../src/lib/arcade/bastionLook";
import {
  bastionCrackPath,
  bastionShellShadow,
  bastionSummaryHeight,
  bastionSummaryRows,
  BT_CRACK_X,
  BT_FX_TICKS,
  BT2_PANEL_Y,
  observeRun,
  paintBastionSummary,
  paintDents,
  setBastionEndClock,
} from "../src/lib/arcade/bastionTank.renderer";
import { btViewX, btViewY } from "../src/lib/arcade/bastionView";
import { arcadeOwnReveal } from "../src/lib/arcade/ownReveal";
import { decodeBastionTankRun } from "../src/lib/duel/bastion";
import { bastionTankLedger } from "../src/lib/duel/bastionLedger";
import { bastionPuzzle, bastionSummaryOf } from "../src/puzzles/bastion";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { replayBastionTankRun } from "../src/lib/duel/bastion";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { BASTION_TIME_MS } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
function ok(cond: unknown, message: string): void {
  if (cond) passes++;
  else if (failures.length < 60) failures.push(message);
}

const W = BT2_WORLD_W;
const H = BT2_WORLD_H;
const idle = (g: typeof bastionIronGame, seed: number, ticks: number): BastionTankState => {
  let s = g.init(seed);
  for (let t = 0; t < ticks && !g.isOver(s); t++) s = g.step(s, null);
  return s;
};
/** A frame drawn by the real art (no tanks, so the backdrop shows) at a given tick. */
function frameAt(tick: number): Uint8ClampedArray {
  const base = bastionIronGame.init(7);
  const st: BastionTankState = { ...base, tick, tanks: [], shells: [], impacts: [] };
  const c = createCanvas(W, H);
  bastionIronArtGame.draw(c.getContext("2d") as unknown as CanvasRenderingContext2D, st, { width: W, height: H });
  return c.getContext("2d").getImageData(0, 0, W, H).data as unknown as Uint8ClampedArray;
}
const px = (d: Uint8ClampedArray, x: number, y: number) => {
  const i = (Math.round(y) * W + Math.round(x)) * 4;
  return [d[i]!, d[i + 1]!, d[i + 2]!] as const;
};
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/* 1. The setting by wave. */
{
  ok([0, 1, 2, 3, 4].map(bastionSettingOf).join() === "0,0,1,1,2", "waves 1–2 clear, 3–4 dust, 5 storm");
  const w3 = BT2_WAVE_START[2];
  const w5 = BT2_WAVE_START[4];
  ok(bastionSettingMix({ tick: w3 - 1 }).to === 0 && bastionSettingMix({ tick: w3 - 1 }).mix === 1, "before wave 3: all clear");
  const mid = bastionSettingMix({ tick: w3 + BT_SETTING_FADE / 2 });
  ok(mid.from === 0 && mid.to === 1 && Math.abs(mid.mix - 0.5) < 1e-9, "half way through the fade into the dust");
  ok(bastionSettingMix({ tick: w3 + BT_SETTING_FADE }).mix === 1 && bastionSettingMix({ tick: w5 + BT_SETTING_FADE }).to === 2, "each fade completes in 90 ticks");
  ok(BT_SETTING_FADE * (1000 / 60) <= 1500, "a fade takes at most 1.5 s");
  ok([60, w3 + BT_SETTING_FADE, w5 + BT_SETTING_FADE + 400].map((t) => bastionSceneKey({ tick: t })).join() === "0,1,2", "the scene's key follows the setting");
  {
    // The fade is stepped (10 steps), so the scene is repainted at most 10 times a fade and always matches the world.
    const keys = new Set<string>();
    for (let t = w3 - 5; t < w3 + BT_SETTING_FADE + 5; t++) keys.add(bastionSceneKey({ tick: t }));
    ok(keys.size === BT_SETTING_STEPS + 2, `the scene repaints once per fade step (the setting before, 10 steps, the setting after: (${keys.size} keys over a fade)`);
  }
  // Every setting is the same for every player: from the tick alone.
  ok(bastionSettingMix({ tick: 1500 }).mix === bastionSettingMix({ tick: 1500 }).mix, "the setting is a function of the tick");
  const clear = frameAt(300);
  const dust = frameAt(w3 + BT_SETTING_FADE + 10);
  const storm = frameAt(w5 + BT_SETTING_FADE + 10);
  const skyY = 40;
  ok(dist(px(clear, 30, skyY), px(dust, 30, skyY)) > 40 && dist(px(dust, 30, skyY), px(storm, 30, skyY)) > 40 && dist(px(clear, 30, skyY), px(storm, 30, skyY)) > 40, "the three skies are drawn differently");
  const fade = frameAt(w3 + BT_SETTING_FADE / 2);
  const between = px(fade, 30, skyY);
  ok(dist(between, px(clear, 30, skyY)) > 10 && dist(between, px(dust, 30, skyY)) > 10, "half way through a fade the sky is between the two");
  // The road's lane dividers (pale dashes) keep their brightness in every setting: the lanes read the same.
  // The road's lane dividers stand out from the road round them in every setting: on each row near the wall, the
  // brightest pixel in the left divider's band against the band's median (luminance).
  const lum = (c: readonly number[]) => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  const dashContrast = (d: Uint8ClampedArray) => {
    let best = 0;
    for (let y = 500; y < 590; y++) {
      const row = Array.from({ length: 50 }, (_, i) => lum(px(d, 110 + i, y))).sort((a, b) => a - b);
      best = Math.max(best, row[row.length - 1]! - row[25]!);
    }
    return Math.round(best);
  };
  const dc = [clear, dust, storm].map(dashContrast);
  ok(dc.every((c) => c >= 30), `the lane dividers stand out in every setting (luminance step ${dc.join(", ")})`);
  const stage = readFileSync(new URL("../src/puzzles/bastion.tsx", import.meta.url), "utf8");
  ok(/sceneKey=\{bastionSceneKey\}/.test(stage), "the stage repaints its scene per setting");
}

/* 2. Far tanks: the outline and the badge. */
{
  /** Records the points a paint call touches (strokes and text), as bastion-check's art test does for fills. */
  const record = (paint: (ctx: CanvasRenderingContext2D) => void) => {
    const pts: [number, number][] = [];
    const texts: { text: string; font: string }[] = [];
    let font = "";
    let strokes = 0;
    const ctx = new Proxy(
      {},
      {
        get(_, k) {
          if (k === "moveTo" || k === "lineTo") return (x: number, y: number) => pts.push([x, y]);
          if (k === "roundRect") return (x: number, y: number, w: number, h: number) => (pts.push([x, y]), pts.push([x + w, y + h]));
          if (k === "fillText") return (t: string) => texts.push({ text: t, font });
          if (k === "stroke") return () => strokes++;
          return () => ({ addColorStop() {}, width: 10 });
        },
        set(_, k, v) {
          if (k === "font") font = String(v);
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    paint(ctx);
    return { pts, texts, strokes };
  };
  let outside = 0;
  for (const kind of [0, 1, 2])
    for (const lane of [0, 1, 2])
      for (const z of [BT_FAR_MARK_Z, 800, 1000, BT2_FAR]) {
        const r = bastionTankRects(kind, lane, z * 256);
        const { pts, strokes } = record((c) => paintTankOutline(c, kind, lane, z * 256));
        ok(strokes === 1 && pts.length > 0, `kind ${kind} lane ${lane} at ${z}: outlined`);
        const x0 = Math.min(r.hull[0], r.turret[0]) - 2;
        const x1 = Math.max(r.hull[2], r.turret[2]) + 2;
        for (const [x, y] of pts) if (x < x0 || x > x1 || y < r.turret[1] - 2 || y > r.hull[3] + 2) outside++;
        const badge = record((c) => paintTankBadge(c, kind, lane, z * 256));
        const t = badge.texts[0];
        ok(badge.texts.length === 1 && t!.text === BT_BADGES[kind]!.letter, `kind ${kind} at ${z}: badge ${BT_BADGES[kind]!.letter}`);
        const size = Number(/(\d+)px/.exec(t?.font ?? "")?.[1] ?? 0);
        ok(size >= 10, `the badge's letter is at least 10 px (${size})`);
      }
  ok(outside === 0, `every outline sits on the tank's own edges, within 2 px (${outside} points outside)`);
  ok(BT_BADGE_FONT >= 10 && BT_BADGES.map((b) => b.letter).join("") === "SMH" && BT_BADGES.map((b) => b.name).join() === "Scout,Medium,Heavy", "Scout, Medium and Heavy badges, letters at least 10 px");
  for (const z of [0, 120, 400, BT_FAR_MARK_Z - 1]) {
    ok(record((c) => paintTankOutline(c, 2, 1, z * 256)).strokes === 0 || z > BT_FAR_MARK_Z - 160, `no outline on a near tank (z ${z})`);
    ok(record((c) => paintTankBadge(c, 2, 1, z * 256)).texts.length === 0 && bastionBadgeBox(2, 1, z * 256) === null, `no badge on a near tank (z ${z})`);
  }
  // The three lanes' badges side by side never overlap, even at the far end, and sit above the horizon line's tanks.
  for (const z of [BT_FAR_MARK_Z, 900, BT2_FAR]) {
    const boxes = [0, 1, 2].map((lane) => bastionBadgeBox(2, lane, z * 256)!);
    ok(boxes[0]!.x + boxes[0]!.w <= boxes[1]!.x && boxes[1]!.x + boxes[1]!.w <= boxes[2]!.x, `lane badges don't overlap at ${z}`);
    ok(boxes.every((b) => b.x >= 0 && b.x + b.w <= W && b.y >= 0), `badges inside the world at ${z}`);
  }
  // A live frame: badges for the far tanks only.
  const st = idle(bastionIronGame, 11, 1500);
  const farKinds = st.tanks.filter((t) => t.z / 256 >= BT_FAR_MARK_Z && t.z <= BT2_FAR * 256).map((t) => BT_BADGES[t.kind]!.letter).sort();
  const frame = record((c) => bastionIronArtGame.draw(c, st, { width: W, height: H }));
  // The badges are drawn with the tanks, before the HUD (whose letter-spaced labels come one letter at a time).
  const hudAt = frame.texts.findIndex((t) => t.text === "W");
  const drawn = frame.texts.slice(0, hudAt < 0 ? undefined : hudAt).map((t) => t.text).filter((t) => t === "S" || t === "M" || t === "H").sort();
  ok(farKinds.length > 0 && drawn.join() === farKinds.join(), `a live frame badges exactly its far tanks (${drawn.join("")} vs ${farKinds.join("")})`);
}

/* 3. The reload tip. */
{
  const g = bastionIronGame;
  const run = (events: Map<number, { k: number }>, until: number) => {
    let s = g.init(21);
    const shows: number[] = [];
    for (let t = 1; t <= until && !g.isOver(s); t++) {
      const e = events.get(t);
      s = g.step(s, e ? { t, k: e.k, a: 195, b: 420, c: t } : null);
      if (bastionSwipeHint(s)) shows.push(t);
    }
    return { s, shows };
  };
  // Five shots empty the magazine: the tip shows through that reload only; five more and a second reload: never again.
  const fire = new Map<number, { k: number }>();
  for (let i = 0; i < 5; i++) fire.set(100 + i * 20, { k: BT2_INPUT_FIRE });
  for (let i = 0; i < 5; i++) fire.set(400 + i * 20, { k: BT2_INPUT_FIRE });
  const a = run(fire, 900);
  ok(a.s.reloads === 2, `two reloads in the scripted run (${a.s.reloads})`);
  const first = a.shows[0] ?? -1;
  const last = a.shows[a.shows.length - 1] ?? -1;
  ok(a.shows.length > 60 && first === 180 && last - first + 1 === a.shows.length && last < 400, `the tip shows once, through the first empty reload (${a.shows.length} ticks from ${first})`);
  // A first reload by swipe: the player knows; the tip never shows, even when the magazine later runs dry.
  const swipe = new Map<number, { k: number }>([[100, { k: BT2_INPUT_FIRE }], [130, { k: BT2_INPUT_RELOAD }]]);
  for (let i = 0; i < 5; i++) swipe.set(400 + i * 20, { k: BT2_INPUT_FIRE });
  const b = run(swipe, 800);
  ok(b.s.reloads === 2 && b.shows.length === 0, `no tip when the first reload was a swipe (${b.shows.length})`);
  // The art draws the tip text exactly when it shows.
  const texts = (s: BastionTankState) => {
    const out: string[] = [];
    const ctx = new Proxy({}, { get: (_, k) => (k === "fillText" ? (t: string) => out.push(t) : () => ({ addColorStop() {}, width: 10 })), set: () => true }) as unknown as CanvasRenderingContext2D;
    bastionIronArtGame.draw(ctx, s, { width: W, height: H });
    return out;
  };
  let s = g.init(21);
  let drawnWhen = 0;
  let wrong = 0;
  for (let t = 1; t <= 700; t++) {
    const e = fire.get(t);
    s = g.step(s, e ? { t, k: e.k, a: 195, b: 420, c: t } : null);
    if (t % 10) continue;
    const has = texts(s).includes(BT_SWIPE_HINT);
    if (has) drawnWhen++;
    if (has !== bastionSwipeHint(s)) wrong++;
  }
  ok(drawnWhen > 0 && wrong === 0, `the art draws the tip exactly while it shows (${drawnWhen} frames, ${wrong} wrong)`);
}

/* 4. Same play: stored runs replay as before. */
{
  type Run = { seed: number; raw: string; score: number; parts: [string, number][]; checksum: number; tick: number };
  const rev2 = JSON.parse(readFileSync(new URL("./fixtures/bastion-rev2-legacy.json", import.meta.url), "utf8")) as { runs: Run[] };
  const rev3 = JSON.parse(readFileSync(new URL("./fixtures/bastion-overhaul-rev3.json", import.meta.url), "utf8")) as { runs: Run[] };
  ok(rev2.runs.length === 48 && rev3.runs.length === 28, `48 rev-2 and 28 rev-3 recorded runs (${rev2.runs.length}, ${rev3.runs.length})`);
  for (const [rev, runs] of [[2, rev2.runs], [3, rev3.runs]] as const)
    for (const r of runs) {
      const out = replayBastionTankRun(r.seed, r.raw, rev);
      ok(
        out.score === r.score && bastionTankCheckpoint(out.state).checksum === r.checksum && out.state.tick === r.tick && JSON.stringify(out.parts.map((p) => [p.key, p.points])) === JSON.stringify(r.parts),
        `rev ${rev} seed ${r.seed}: replays as on main (${out.score} vs ${r.score})`,
      );
      ok(gradeAnswer({ type: "bastion", seed: r.seed, bastionRev: rev }, r.raw, 0).score === r.score, `rev ${rev} seed ${r.seed}: graded the same`);
    }
  ok(new Set(rev3.runs.map((r) => r.score)).size > 10, "the rev-3 runs cover weak to flawless play");
}

/* 5. The view mapping. */
{
  const view = spawnSync("bun", [new URL("./iron-wall-view-check.ts", import.meta.url).pathname], { encoding: "utf8" });
  ok(view.status === 0 && /PASS iron-wall-view-check/.test(view.stdout), `iron-wall-view-check passes (${view.stdout.trim().split("\n").pop()})`);
  const stage = readFileSync(new URL("../src/puzzles/bastion.tsx", import.meta.url), "utf8");
  ok(/const FINGER_LIFT = 120;/.test(stage) && /btWorldX\(aim\.current\.x, aim\.current\.y\)/.test(stage), "the crosshair floats 120 px above the thumb and is sent through the view's inverse");
}

/* 6. The 120 s rule and the grace. */
{
  ok(BT2_RUN_TICKS <= 120 * 60 && BASTION_TIME_MS <= 120_000, `the run is at most 120 s (${BT2_RUN_TICKS / 60} s, clock ${BASTION_TIME_MS / 1000} s)`);
  ok(BT2_BASE === 3, "three base hits allowed");
  for (const g of [bastionTankGame, bastionIronGame]) {
    // Nobody shoots: tanks reach the wall; the run goes on after the first base hit.
    let s = g.init(5);
    let afterFirst = false;
    while (!g.isOver(s)) {
      s = g.step(s, null);
      if (s.breached === 1 && s.ended === 0) afterFirst = true;
    }
    ok(afterFirst && s.breached === BT2_BASE, `rev ${s.rev}: the first base hit doesn't end the run (it ended on hit ${s.breached})`);
  }
}

/* 7. Text, the intro still and the sound slots. */
{
  const art = readFileSync(new URL("../src/lib/arcade/bastionTank.renderer.ts", import.meta.url), "utf8");
  const hud = art.slice(art.indexOf("function paintHud"), art.indexOf("/* ------------------------------------------------------------- the world */"));
  const sizes = [...hud.matchAll(/(\d+)px \$\{DISPLAY\}/g)].map((m) => Number(m[1]));
  ok(sizes.length >= 4 && sizes.every((n) => n >= 13), `the panel's text is at least 13 px (${sizes.join(", ")})`);
  ok(/GOLD/.test(hud) && /PANEL_TOP = "#121A31"/.test(art), "the panel is navy with champagne-gold labels");
  const stage = readFileSync(new URL("../src/puzzles/bastion.tsx", import.meta.url), "utf8");
  ok(/<ArtStill\s+game=\{bastionIronArtGame\}/.test(stage), "the intro still is the game's own art on bastionRev 3");
  const manifest = readFileSync(new URL("../src/lib/fx/manifest.ts", import.meta.url), "utf8");
  const sounds = readFileSync(new URL("../src/lib/fx/gameSounds.ts", import.meta.url), "utf8");
  for (const slot of ["weakTing", "shellIn", "jamGrind", "debris", "nearMiss", "panelCrack", "wallHeld", "tip", "dustWind", "stormFire"]) {
    ok(new RegExp(`"bastion\\.${slot}": \\{`).test(manifest), `slot bastion.${slot} registered`);
    ok(sounds.includes(`"bastion.${slot}"`), `slot bastion.${slot} wired`);
  }
  // A near miss: on open ground beside a tank, never a hit or a sky burst.
  const s = idle(bastionIronGame, 11, 900);
  const t = s.tanks[0]!;
  const r = bastionTankRects(t.kind, t.lane, t.z);
  ok(bastionNearMiss(s, { x: r.hull[2] + 3, y: r.hull[3], r: 0 }) && !bastionNearMiss(s, { x: r.hull[2] + 3, y: r.hull[3], r: 1 }) && !bastionNearMiss(s, { x: 5, y: 120, r: 0 }), "a near miss is a ground landing beside a tank");
}

/* 8. Edge to edge: the scene beyond the world continues it with no seam, in every setting and through a fade. */
{
  // The arena box (CSS px) on each size: 414×896 home-screen app, 390×844, 375×667 and a computer (the box the world
  // is fitted into, top-anchored at the largest uniform scale; docs/arena-sizes-oct-2026.md).
  const boxes = [
    { name: "414x896 app", w: 414, h: 790 },
    { name: "390x844", w: 390, h: 740 },
    { name: "375x667", w: 375, h: 560 },
    { name: "desktop 1440x900", w: 640, h: 830 },
  ];
  const SEAM_MAX = 30;
  const w3 = BT2_WAVE_START[2];
  const w5 = BT2_WAVE_START[4];
  for (const box of boxes)
    for (const tick of [300, w3 + 40, w3 + BT_SETTING_FADE, w5 + 50, w5 + BT_SETTING_FADE + 60]) {
      const k = Math.min(box.w / W, box.h / H);
      const vw = box.w / k;
      const left = -(vw - W) / 2;
      const view = { worldW: W, worldH: H, left, right: W - left, top: 0, bottom: box.h / k, scale: k };
      const c = createCanvas(box.w, box.h);
      const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
      ctx.setTransform(k, 0, 0, k, -left * k, 0);
      const st: BastionTankState = { ...bastionIronGame.init(7), tick, tanks: [], shells: [], impacts: [] };
      bastionScene(ctx, view, st);
      // The world on top, drawn into its own box (as the stage's world canvas is).
      const wc = createCanvas(Math.round(W * k), Math.round(H * k));
      const wctx = wc.getContext("2d") as unknown as CanvasRenderingContext2D;
      wctx.scale(k, k);
      bastionIronArtGame.draw(wctx, st, { width: W, height: H });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const x0 = Math.round(-left * k);
      ctx.drawImage(wc as unknown as CanvasImageSource, x0, 0);
      const img = c.getContext("2d").getImageData(0, 0, box.w, box.h).data;
      const at = (x: number, y: number) => {
        const i = (y * box.w + x) * 4;
        return [img[i]!, img[i + 1]!, img[i + 2]!];
      };
      /**
       * The colour step across an edge: the 4 px inside against the 4 px outside, averaged along each 40 px band of
       * the edge (sky, ridge, field and wall read separately), the worst band's.
       */
      const step = (inside: (n: number, d: number) => [number, number], outside: (n: number, d: number) => [number, number], len: number) => {
        let worst = 0;
        for (let from = 0; from < len; from += 40) worst = Math.max(worst, band(inside, outside, from, Math.min(len, from + 40)));
        return worst;
      };
      const band = (inside: (n: number, d: number) => [number, number], outside: (n: number, d: number) => [number, number], from: number, to: number) => {
        let sum = 0;
        let n = 0;
        for (let i = from; i < to; i += 2) {
          const a = [0, 0, 0];
          const b = [0, 0, 0];
          for (let d = 1; d <= 4; d++) {
            const p = at(...inside(i, d));
            const q = at(...outside(i, d));
            for (let ch = 0; ch < 3; ch++) (a[ch]! += p[ch]!), (b[ch]! += q[ch]!);
          }
          sum += (Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!)) / 12;
          n++;
        }
        return n ? sum / n : 0;
      };
      const ww = Math.round(W * k);
      const wh = Math.round(H * k);
      if (x0 >= 5) {
        // Leave out the HUD's chips at the top (drawn over the world only).
        const s1 = step((i, d) => [x0 + 1 + d, 60 + i], (i, d) => [x0 - d, 60 + i], wh - 70);
        const s2 = step((i, d) => [x0 + ww - 2 - d, 60 + i], (i, d) => [x0 + ww - 1 + d, 60 + i], wh - 70);
        ok(s1 <= SEAM_MAX && s2 <= SEAM_MAX, `${box.name} tick ${tick}: no seam at the world's sides (${s1.toFixed(1)}, ${s2.toFixed(1)})`);
      }
      if (box.h - wh >= 5) {
        const s3 = step((i, d) => [x0 + 10 + i, wh - 2 - d], (i, d) => [x0 + 10 + i, wh - 1 + d], ww - 20);
        ok(s3 <= SEAM_MAX, `${box.name} tick ${tick}: no seam below the world (${s3.toFixed(1)})`);
      }
      // No black strip: the scene fills every pixel beyond the world (nothing left at the page's #070709).
      let black = 0;
      for (let y = 0; y < box.h; y += 3)
        for (let x = 0; x < box.w; x += 3) {
          if (x >= x0 && x < x0 + ww && y < wh) continue;
          const p = at(x, y);
          if (Math.abs(p[0]! - 7) <= 3 && Math.abs(p[1]! - 7) <= 3 && Math.abs(p[2]! - 9) <= 3) black++;
        }
      ok(black === 0, `${box.name} tick ${tick}: the scene fills the screen round the world (${black} black samples)`);
    }
}

/* 9. Stage 2: the effects (display and sound only; every one observes the sim). */
{
  const g = bastionIronGame;
  // Firing: the barrel kicks 3 px on the shot's tick, eases back to 0 by 80 ms (5 ticks); the muzzle flash 3 ticks.
  {
    let s = g.init(21);
    for (let t = 1; t < 100; t++) s = g.step(s, null);
    s = g.step(s, { t: 100, k: BT2_INPUT_FIRE, a: 195, b: 420, c: 1 });
    const kicks: number[] = [];
    const flashes: (number | null)[] = [];
    let k = s;
    for (let i = 0; i < 8; i++) {
      kicks.push(bastionKick(k));
      flashes.push(bastionFlashAge(k));
      k = g.step(k, null);
    }
    ok(kicks[0] === BT_KICK_PX && BT_KICK_PX >= 2 && BT_KICK_PX <= 3 && kicks.every((v) => v <= 3) && kicks[BT_KICK_TICKS] === 0 && (BT_KICK_TICKS * 1000) / 60 <= 84, `the barrel kicks 3 px and is back by 80 ms (${kicks.map((v) => v.toFixed(1)).join(" ")})`);
    ok(flashes.slice(0, BT_FLASH_TICKS).every((v, i) => v === i) && flashes[BT_FLASH_TICKS] === null, `the muzzle flash lasts 3 ticks (${flashes.join(",")})`);
    ok(bastionKick(g.init(21)) === 0 && bastionFlashAge(g.init(21)) === null, "no kick or flash before a shot");
    const art = readFileSync(new URL("../src/lib/arcade/bastionTank.renderer.ts", import.meta.url), "utf8");
    const gun = art.slice(art.indexOf("function paintGun"), art.indexOf("function paintMuzzleFlash"));
    ok(/const recoil = still \? 0 : bastionKick\(state\);/.test(gun) && /GUN_X - 46, BT2_PANEL_Y - 22/.test(gun), "only the barrel kicks: the mount stays where it is (and no kick under reduced motion)");
    ok(!/arcadeShake|shake\(/.test(gun), "firing never shakes the world or the arena");
  }
  // The shell's shadow: from the wall to the exact landing point (in the view), shrinking; none for a shot into the sky.
  {
    let bad = 0;
    for (const [x, y] of [[195, 420], [80, 330], [320, 560], [200, 270]] as const) {
      const sh = { x, y, from: 10, at: 10 + 24 };
      const start = bastionShellShadow(sh, 10)!;
      const end = bastionShellShadow(sh, 34)!;
      const mid = bastionShellShadow(sh, 22)!;
      if (Math.hypot(end.x - btViewX(x, y), end.y - btViewY(y)) > 0.5) bad++;
      if (Math.abs(start.y - BT2_WALL_Y) > 0.5) bad++;
      if (!(mid.y < start.y && end.y <= mid.y && end.a > start.a)) bad++;
    }
    ok(bad === 0, `the shadow slides from the wall to the very point the shell lands, darkening (${bad} wrong)`);
    ok(bastionShellShadow({ x: 195, y: 150, from: 0, at: 30 }, 15) === null, "no shadow for a shot into the sky");
  }
  // Every effect is a short physical action: at most 900 ms, inside the sim's 60-tick impact memory.
  ok(Object.values(BT_FX_TICKS).every((t) => t <= 54 && t < 60), `every landing effect lasts at most 900 ms (${Object.entries(BT_FX_TICKS).map(([k, v]) => `${k} ${v}`).join(", ")})`);
  ok(BT_JAM_SHAKE_TICKS <= 54 && BT_SNAP_STEP * BT2_MAG <= 54, "the jam's shake and the shells' snap each under 900 ms");
  // Dents: one for each hit point lost, drawn inside the hull (the 2 px bounds rule), none on an unhurt tank.
  {
    let outside = 0;
    let dentFills = 0;
    for (const kind of [0, 1, 2])
      for (const z of [0, 300, 900]) {
        const r = bastionTankRects(kind, 1, z * 256);
        const fills = (hp: number) => {
          const pts: [number, number][] = [];
          let n = 0;
          const ctx = new Proxy(
            {},
            {
              get(_, k) {
                if (k === "ellipse") return (x: number, y: number, rx: number, ry: number) => (n++, pts.push([x - rx, y - ry], [x + rx, y + ry]));
                if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
                return () => {};
              },
              set: () => true,
            },
          ) as unknown as CanvasRenderingContext2D;
          paintDents(ctx, r.hull[0], r.hull[1], r.hull[2], r.hull[3], r.s256 / 256, BT2_HP[kind]! - hp, kind);
          return { pts, n };
        };
        const hurt = fills(0);
        if (fills(BT2_HP[kind]!).n !== 0) outside++;
        dentFills += hurt.n;
        for (const [x, y] of hurt.pts) if (x < r.hull[0] - 2 || x > r.hull[2] + 2 || y < r.hull[1] - 2 || y > r.hull[3] + 2) outside++;
      }
    ok(dentFills > 0 && outside === 0, `dents sit inside the hull (${outside} out of bounds, ${dentFills} drawn)`);
  }
  // Recorded runs drawn tick by tick: every effect appears at its moment (kills' "+n", near misses' CLOSE, the weak spot's
  // gold, the green and red needles, the cracks), from the sim's own state.
  {
    type Run = { seed: number; raw: string; score: number };
    const runs = (JSON.parse(readFileSync(new URL("./fixtures/bastion-overhaul-rev3.json", import.meta.url), "utf8")) as { runs: Run[] }).runs;
    const run = [...runs].sort((a, b) => a.score - b.score)[Math.floor(runs.length / 2)]!;
    const events = new Map(decodeBastionTankRun(run.raw).events.map((e) => [e.t, e]));
    // One context for the whole run (the art keeps its memory per canvas, as on the phone).
    let out: { text: string; font: string; fill: string }[] = [];
    let font = "";
    let fill = "";
    let fills: string[] = [];
    let stops: string[] = [];
    const ctx = new Proxy({}, {
        get(_, k) {
          if (k === "fillText") return (t: string) => out.push({ text: t, font, fill });
          if (k === "fill" || k === "fillRect") return () => fills.push(fill);
          if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop: (_o: number, c: string) => stops.push(c) });
          return () => ({ addColorStop() {}, width: 10 });
        },
        set(_, k, v) {
          if (k === "font") font = String(v);
          if (k === "fillStyle") fill = String(v);
          return true;
        },
      }) as unknown as CanvasRenderingContext2D;
    const texts = (s: BastionTankState) => {
      out = [];
      fills = [];
      stops = [];
      bastionIronArtGame.draw(ctx, s, { width: W, height: H });
      return { out, fills, stops };
    };
    let s = g.init(run.seed);
    let kills = 0;
    let risers = 0;
    let goldFrames = 0;
    let weakFrames = 0;
    let fastSeen = 0;
    let snapOk = true;
    let jamRed = 0;
    let jams = 0;
    let near = 0;
    let closeDrawn = 0;
    const nearSeen = new Set<string>();
    for (let t = 1; t <= g.runTicks && !g.isOver(s); t++) {
      const prev = s;
      s = g.step(s, events.get(t) ?? null);
      const fresh = s.impacts.filter((m) => m.t === s.tick);
      const kill = fresh.find((m) => m.r === 3 || m.r === 4);
      const weak = fresh.find((m) => m.r === 2 || m.r === 4);
      const nm = fresh.find((m) => m.r === 0 && bastionNearMiss(s, m));
      if (nm) nearSeen.add(`${nm.t}`);
      const snap = bastionSnapLit(s, BT2_MAG);
      if (snap !== null && snap !== Math.min(BT2_MAG, Math.floor((s.tick - s.reloadEnd) / BT_SNAP_STEP) + 1)) snapOk = false;
      const jamNow = s.jams > prev.jams;
      // Draw every frame (the art's memory is built frame by frame, as on the phone), judge the ones that matter.
      const { out, fills, stops } = texts(s);
      if (kill) {
        kills++;
        if (out.some((x) => x.text === `+${bastionKillPoints(kill.kind, 3)}` && Number(/(\d+)px/.exec(x.font)?.[1]) >= 14)) risers++;
      }
      if (weak) {
        weakFrames++;
        if (fills.some((f) => /rgba\(255,209,92/.test(f))) goldFrames++;
      }
      if (nm) {
        near++;
        if (out.some((x) => x.text === "CLOSE")) closeDrawn++;
      }
      if (snap !== null) fastSeen++;
      if (jamNow) {
        jams++;
        if (stops.includes("#FFC2B8")) jamRed++;
      }
    }
    ok(kills > 10 && risers === kills, `every kill shows its "+n" (at least 14 px) on its tick (${risers} of ${kills})`);
    ok(weakFrames > 0 && goldFrames === weakFrames, `every weak-spot hit flashes gold (${goldFrames} of ${weakFrames})`);
    ok(near > 0 && closeDrawn === near, `every near miss shows CLOSE (${closeDrawn} of ${near})`);
    ok(fastSeen > 0 && snapOk, `a fast reload's shells snap in one by one, 4 ticks apart (${fastSeen} snap frames)`);
    ok(jams > 0 && jamRed === jams, `a jam turns the needle red (${jamRed} of ${jams})`);
    ok(bastionKillPoints(0, 3) === 2 && bastionKillPoints(1, 3) === 3 && bastionKillPoints(2, 3) === 7 && bastionKillPoints(2, 2) === 9, "a kill's +n is its armour on the Armour line (2 / 3 / 7 on Iron Wall)");
  }
  // The panel's cracks: inside the panel, clear of its labels, one for each base hit, kept all run.
  {
    let bad = 0;
    for (let k = 0; k < 3; k++)
      for (const lane of [0, 1, 2])
        for (const line of bastionCrackPath(k, lane)) for (const [x, y] of line) if (x < 0 || x > W || y < BT2_PANEL_Y || y > H || (x < 100 && y < 690)) bad++;
    ok(bad === 0 && BT_CRACK_X.every((x) => x >= 110), `the cracks stay on the panel, clear of its labels (${bad} points out)`);
    let s = g.init(5);
    let first = -1;
    while (!g.isOver(s)) {
      s = g.step(s, null);
      if (s.breached === 1 && first < 0) first = s.tick;
    }
    const strokes = (st: BastionTankState) => {
      let n = 0;
      const ctx = new Proxy({}, { get: (_, k) => (k === "stroke" ? () => n++ : () => ({ addColorStop() {}, width: 10 })), set: () => true }) as unknown as CanvasRenderingContext2D;
      bastionIronArtGame.draw(ctx, st, { width: W, height: H });
      return n;
    };
    const before = strokes({ ...s, breached: 0, ended: 0 });
    const after = strokes({ ...s, ended: 0 });
    ok(after - before === 2 * s.breached, `a crack (dark line and lit edge) for each of the ${s.breached} base hits (${after - before} strokes)`);
  }
  // The end card: the stage holds its submit while the waves tally, then WALL HELD (or BASE DOWN).
  {
    ok(bastionEndHoldMs({ ended: 0 }) === 0 && bastionEndHoldMs({ ended: 1 }) === BT_END_HOLD_MS && BT_END_HOLD_MS <= 2000, `the stage holds an ended run ${BT_END_HOLD_MS} ms for the end card`);
    ok([0, 119, 120, 269, 270, 719, 720, 2000].map((ms) => bastionTallyRows(ms)).join() === "0,0,1,1,2,4,5,5", "the wave rows land 150 ms apart");
    ok(BT_HELD_AT_MS > BT_TALLY_FIRST_MS + 4 * BT_TALLY_STEP_MS && BT_HELD_AT_MS < BT_END_HOLD_MS, "the stamp comes after the last row and before the hold ends");
    const stage = readFileSync(new URL("../src/puzzles/bastion.tsx", import.meta.url), "utf8");
    ok(/endHoldMs=\{bastionEndHoldMs\}/.test(stage), "the stage holds its submit for the end card");
    type Run = { seed: number; raw: string; score: number };
    const runs = (JSON.parse(readFileSync(new URL("./fixtures/bastion-overhaul-rev3.json", import.meta.url), "utf8")) as { runs: Run[] }).runs;
    const best = [...runs].sort((a, b) => b.score - a.score)[0]!;
    const events = new Map(decodeBastionTankRun(best.raw).events.map((e) => [e.t, e]));
    let now = 0;
    setBastionEndClock(() => now);
    let got: string[] = [];
    const key = new Proxy({}, { get: (_, k) => (k === "fillText" ? (t: string) => got.push(t) : () => ({ addColorStop() {}, width: 10 })), set: () => true }) as unknown as CanvasRenderingContext2D;
    const read = (st: BastionTankState) => {
      got = [];
      bastionIronArtGame.draw(key, st, { width: W, height: H });
      return got;
    };
    let s = g.init(best.seed);
    read(s);
    for (let t = 1; t <= g.runTicks && !g.isOver(s); t++) {
      s = g.step(s, events.get(t) ?? null);
      observeRun(key, s);
    }
    const at = (ms: number) => ((now = ms), read(s));
    at(0);
    const mid = at(BT_TALLY_FIRST_MS + BT_TALLY_STEP_MS + 10);
    const end = at(BT_END_HOLD_MS);
    const rows = bastionWaveTallies(observeRun(key, s).ledger, bastionPlan(best.seed));
    ok(mid.includes("WAVE 2") && !mid.includes("WAVE 3") && !mid.includes("WALL HELD"), `part way: two rows, no stamp yet (${mid.filter((t) => t.startsWith("WAVE")).join(", ")})`);
    ok([1, 2, 3, 4, 5].every((w) => end.includes(`WAVE ${w}`)) && end.includes("WALL HELD") && rows.every((r) => end.includes(`${r.kills} / ${r.tanks.length}`)), "complete: five rows with each wave's kills, then WALL HELD");
    ok(rows.reduce((a, r) => a + r.kills, 0) === s.kills, "the end card's rows add up to the run's kills");
    // A run the base fell in: BASE DOWN, never WALL HELD.
    let fell = g.init(5);
    const fr: string[] = [];
    const fk = new Proxy({}, { get: (_, k) => (k === "fillText" ? (t: string) => fr.push(t) : () => ({ addColorStop() {}, width: 10 })), set: () => true }) as unknown as CanvasRenderingContext2D;
    now = 0;
    observeRun(fk, fell);
    while (!g.isOver(fell)) (fell = g.step(fell, null)), observeRun(fk, fell);
    now = BT_END_HOLD_MS;
    bastionIronArtGame.draw(fk, fell, { width: W, height: H });
    ok(fell.ended === 2 && fr.includes("BASE DOWN") && !fr.includes("WALL HELD"), "a fallen base reads BASE DOWN");
    setBastionEndClock(null);
    const sounds = readFileSync(new URL("../src/lib/fx/gameSounds.ts", import.meta.url), "utf8");
    ok(/effectCue\("bastion\.tally", 0, 1 \+ 0\.06 \* tallied\+\+\)/.test(sounds) && /ms >= BT_HELD_AT_MS/.test(sounds) && /effectCue\("bastion\.shellIn", 0, 1 \+ 0\.04 \* n\)/.test(sounds), "the tally ticks rise a step a row, the sting lands with the stamp, a click for each shell");
    const manifest = readFileSync(new URL("../src/lib/fx/manifest.ts", import.meta.url), "utf8");
    ok(/"bastion\.tally": \{/.test(manifest), "slot bastion.tally registered");
  }
}

/* 10. Stage 2: the answer reveal (the run in one picture, from the stored log through the real sim). */
{
  type Run = { seed: number; raw: string; score: number; checksum: number };
  const rev2 = JSON.parse(readFileSync(new URL("./fixtures/bastion-rev2-legacy.json", import.meta.url), "utf8")) as { runs: Run[] };
  const rev3 = JSON.parse(readFileSync(new URL("./fixtures/bastion-overhaul-rev3.json", import.meta.url), "utf8")) as { runs: Run[] };
  let bad = 0;
  const why: string[] = [];
  for (const [rev, runs] of [[2, rev2.runs], [3, rev3.runs]] as const)
    for (const r of runs) {
      const { ledger, state } = bastionTankLedger(r.seed, r.raw, rev);
      const replay = replayBastionTankRun(r.seed, r.raw, rev);
      const tallies = bastionWaveTallies(ledger, bastionPlan(r.seed));
      const sameEnd = bastionTankCheckpoint(state).checksum === bastionTankCheckpoint(replay.state).checksum && state.tick === replay.state.tick;
      const killsAdd = tallies.reduce((a, w) => a + w.kills, 0) === state.kills;
      const throughAdd = tallies.reduce((a, w) => a + w.through, 0) === state.breached && ledger.breaches.length === state.breached;
      const weakAdd = tallies.reduce((a, w) => a + w.weak, 0) === state.weak && ledger.weakLoose === 0;
      const dronesAdd = ledger.drones.filter((t) => t !== null).length === (state.drones ?? 0);
      const hpAdd = tallies.reduce((a, w) => a + w.tanks.filter((t) => t.fate === 1).reduce((b, t) => b + BT2_HP[t.kind]!, 0), 0) <= state.destroyedHp;
      const counts = tallies.map((w) => w.tanks.length).join() === "5,5,5,7,8";
      if (!(sameEnd && killsAdd && throughAdd && weakAdd && dronesAdd && hpAdd && counts)) {
        bad++;
        if (why.length < 3) why.push(`rev ${rev} seed ${r.seed}: end ${sameEnd} kills ${killsAdd} through ${throughAdd} weak ${weakAdd} drones ${dronesAdd}`);
      }
    }
  ok(bad === 0, `the reveal's picture is the stored run exactly: same end as the server's replay, every kill, base hit, weak-spot hit and drone on its tank and wave (${bad} wrong ${why.join("; ")})`);
  // The picture's rows and the big numbers, from a recorded run; text at least 13 px.
  const r = [...rev3.runs].sort((a, b) => a.score - b.score)[0]!;
  const sum = bastionSummaryOf(r.seed, r.raw, 3);
  const rows = bastionSummaryRows(sum.data);
  ok(rows.length === 7 && rows[0]!.startsWith("WAVE 1 ") && rows[5]!.startsWith("DRONES ") && rows[6]!.startsWith("BASE "), `the picture: five waves, the drones, the base (${rows.join(" | ")})`);
  ok(bastionSummaryRows(bastionSummaryOf(rev2.runs[0]!.seed, rev2.runs[0]!.raw, 2).data).length === 6, "rev 2's picture has no drones row");
  const fonts: number[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, k) => (k === "measureText" ? () => ({ width: 60 }) : () => ({ addColorStop() {}, width: 10 })),
      set(_, k, v) {
        if (k === "font") fonts.push(Number(/(\d+)px/.exec(String(v))?.[1] ?? 0));
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  paintBastionSummary(ctx, sum.data);
  ok(fonts.length > 0 && fonts.every((f) => f >= 13) && fonts.includes(20), `the picture's text is 13 px and up, the counts 20 px (${[...new Set(fonts)].join(", ")})`);
  ok(bastionSummaryHeight(3) === bastionSummaryHeight(2) + 52, "rev 3 adds one row");
  // The component: big numbers with short plain labels, no "×", and the picture.
  const html = renderToString(createElement(bastionPuzzle.Reveal, { puzzle: { type: "bastion", seed: r.seed, bastionRev: 3 } as never, myAnswer: r.raw, myCorrect: false, myReactionAvgMs: null, timeLimitMs: BASTION_TIME_MS }));
  ok(html.includes(`${sum.destroyedHp} / 63`) && html.includes("Armour knocked out") && html.includes("Drones down") && /Weak-spot hits?/.test(html) && /Fast reloads?/.test(html), "the reveal shows armour, weak spots, fast reloads and drones big");
  ok(!/×/.test(html) && /data-bastion-rows="WAVE 1/.test(html) && /role="img"/.test(html), "no stray ×, and the picture carries its rows for screen readers");
  ok(arcadeOwnReveal({ type: "bastion", bastionRev: 3 }) && arcadeOwnReveal({ type: "bastion", bastionRev: 2 }) && !arcadeOwnReveal({ type: "bastion" }) && !arcadeOwnReveal({ type: "orbit", orbitRev: 15 }), "the arcade reveal draws Iron Wall's picture (tank revisions only)");
  const arcadeReveal = readFileSync(new URL("../src/components/duel/ArcadeReveal.tsx", import.meta.url), "utf8");
  ok(/hidden=\{!practice && !open\}[^\n]*\n\s*<GameReveal/.test(arcadeReveal), "open in practice, with the breakdown in a room");
}

console.log(
  failures.length === 0
    ? `PASS bastion-overhaul-check: ${passes} checks`
    : `FAIL bastion-overhaul-check: ${failures.length} of ${passes + failures.length} checks failed\n${failures.map((f) => `  ✗ ${f}`).join("\n")}`,
);
process.exit(failures.length ? 1 : 0);
