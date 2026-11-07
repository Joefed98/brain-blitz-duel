/**
 * art-check (design foundation F5, 6 Nov 2026; ~3 s, no browser): the approved art (docs/art/) stays the art the
 * app draws.
 *
 *  1. Rewards: src/design/art/markup.ts, with every token resolved from src/design/tokens.css, writes each of the
 *     17 approved reward SVGs (emblems, medals, trophies, badges) byte for byte as docs/art/svg/ has them.
 *  2. Tokens: the five metals' stops, their inks and the glow in tokens.css are docs/art/README.md's values.
 *  3. Captain Joulz: the renderer's poses are docs/art/source/captain-poses.json exactly, and drawCaptain at
 *     the art's scale matches docs/art/svg/captain-joulz-{ready,run,win}.svg pixel for pixel but for
 *     anti-aliasing (under 0.5 % of pixels more than 96 levels apart).
 *  4. The games' figures (Grappler's cave and jungle, Moon Climb with its gear) are drawn no further out on any
 *     side than today's figure, recorded on main (scripts/fixtures/hero-bounds-main.json), plus 0.5 px.
 *  5. The celebration poses keep their contract (feet on the ground, arms up in a V, the run leaving the
 *     ground) and draw without error.
 *  6. Medal: 1st to 3rd render the medal art (no number), 4th on the plain number, a shared place says so.
 *
 *   bun scripts/art-check.tsx [--record=<main checkout>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createCanvas, loadImage } from "@napi-rs/canvas";
import { renderToStaticMarkup } from "react-dom/server";

import * as A from "../src/design/art/markup";
import * as H from "../src/lib/arcade/hero.renderer";
import { Medal } from "../src/design/components/Medal";
import { Badge, Emblem, Trophy } from "../src/design/art";
import { drawNinja } from "../src/lib/arcade/ricochetNinja.renderer";

let passes = 0;
const fails: string[] = [];
const ok = (cond: boolean, msg: string) => {
  if (cond) passes++;
  else fails.push(msg);
};

/* 1–2. rewards and tokens */
const css = readFileSync("src/design/tokens.css", "utf8");
const token = (name: string): string => {
  if (name === "--jz-font") return "Archivo, sans-serif";
  const m = css.match(new RegExp(`${name.replace(/-/g, "\\-")}:\\s*([^;]+);`));
  return m ? m[1]!.trim() : `MISSING${name}`;
};
const doc = (box: { x: number; y: number; w: number; h: number }, w: number, h: number, inner: string) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='${box.x} ${box.y} ${box.w} ${box.h}'>${inner}</svg>`;
const pieces: [string, string][] = [];
for (const m of ["gold", "silver", "bronze"] as const) pieces.push([`medal-${m}`, doc(A.MEDAL_BOX, 120, 140, A.defs("m") + A.medal("m", m))]);
for (const t of ["spark", "charge", "volt", "surge", "storm", "lightning"] as const)
  pieces.push([`emblem-${t}`, doc(A.EMBLEM_BOX, 140, 164, A.defs("e") + A.emblem("e", t))]);
for (const k of ["bronze", "silver", "gold", "championship"] as const) {
  const b = A.TROPHY_BOX[k];
  const L = A.TROPHY_LEVEL[k];
  pieces.push([`trophy-${k}`, doc(b, b.w, b.h, A.defs("t") + A.trophy("t", L.metal, L.level))]);
}
for (const k of ["winner", "arena", "club", "founder"] as const) pieces.push([`badge-${k}`, doc(A.BADGE_BOX, 120, 120, A.defs("b") + A.badge("b", k, 42))]);
for (const [name, mine] of pieces) {
  const ref = readFileSync(`docs/art/svg/${name}.svg`, "utf8").trim();
  ok(A.resolved(mine, token) === ref, `${name}: the art's markup differs from docs/art/svg/${name}.svg`);
  ok(!/#[0-9A-Fa-f]{3,8}\b/.test(mine.replace(/url\(#[^)]*\)|id='[^']*'|>[^<]*</g, "")), `${name}: a colour value in the markup (tokens only)`);
}
const README_METALS: Record<string, string[]> = {
  bronze: ["#F6D2AE", "#D49461", "#9A5E30", "#E2AB76"],
  silver: ["#FFFFFF", "#D3DCEF", "#97A4C0", "#E6ECF8"],
  gold: ["#FBEDC4", "#E6C67E", "#D2AC5E", "#EED79C"],
  platinum: ["#F2FCFF", "#AEEAF7", "#62B9CE", "#D6F7FF"],
  obsidian: ["#4A5680", "#1E2640", "#0B0F1C", "#36406A"],
};
const README_INK: Record<string, string> = { bronze: "#2A1608", silver: "#151B2C", gold: "#1A1206", platinum: "#08202A" };
for (const [m, stops] of Object.entries(README_METALS)) {
  stops.forEach((s, i) => ok(token(`--jz-metal-${m}-${i + 1}`).toUpperCase() === s, `--jz-metal-${m}-${i + 1} is not ${s}`));
  if (README_INK[m]) ok(token(`--jz-ink-${m}`).toUpperCase() === README_INK[m], `--jz-ink-${m} is not ${README_INK[m]}`);
}
ok(token("--jz-ink-obsidian") === token("--jz-gold"), "obsidian's ink is not the gold");
ok(token("--jz-glow").toUpperCase() === "#F3D894", "--jz-glow is not #F3D894");
ok(token("--jz-art-edge").toUpperCase() === "#06080F", "--jz-art-edge is not #06080F");

/* 3. Captain Joulz */
const poses = JSON.parse(readFileSync("docs/art/source/captain-poses.json", "utf8")) as Record<string, unknown>;
for (const name of ["ready", "run", "win"] as const)
  ok(JSON.stringify(H.CAPTAIN_POSES[name]) === JSON.stringify(poses[name]), `the ${name} pose differs from captain-poses.json`);
const S = 3;
const W = 180 * S;
const HH = 240 * S;
for (const pose of ["ready", "run", "win"] as const) {
  const ref = createCanvas(W, HH);
  const rx = ref.getContext("2d");
  rx.fillStyle = "#0F1424";
  rx.fillRect(0, 0, W, HH);
  rx.drawImage(await loadImage(readFileSync(`docs/art/svg/captain-joulz-${pose}.svg`)), 0, 0, W, HH);
  const mine = createCanvas(W, HH);
  const mx = mine.getContext("2d") as unknown as CanvasRenderingContext2D;
  mx.fillStyle = "#0F1424";
  mx.fillRect(0, 0, W, HH);
  mx.translate(10 * S, 40 * S);
  mx.scale(S, S);
  H.drawCaptain(mx, H.captainArtRig(H.captainRig(), pose));
  const a = rx.getImageData(0, 0, W, HH).data;
  const b = (mx as unknown as ReturnType<typeof rx.getContext>).getImageData(0, 0, W, HH).data;
  let big = 0;
  for (let k = 0; k < a.length; k += 4) {
    const d = Math.max(Math.abs(a[k]! - b[k]!), Math.abs(a[k + 1]! - b[k + 1]!), Math.abs(a[k + 2]! - b[k + 2]!));
    if (d > 96) big++;
  }
  const share = big / (W * HH);
  ok(share < 0.005, `Captain Joulz ${pose}: ${(100 * share).toFixed(2)} % of pixels differ from the approved SVG`);
}

/*
 * 4. The games' figures are no bigger than the figure they replace. Today's hero already reaches past its body
 * (Grappler's hands to the rope, Moon Climb's glow and headband tails), so each pose's drawn extent (left, right,
 * top, bottom, measured at 4×) is held to the old figure's, recorded on main ca4066ce
 * (scripts/fixtures/hero-bounds-main.json), plus half a pixel. Roofbound clips its runner to its collision box.
 * `--record=<main checkout>` re-measures the old figure.
 */
const Z = 4;
type Ext = [number, number, number, number];
type Mods = { H: typeof H; drawNinja: typeof drawNinja };
function ink(draw: (x: CanvasRenderingContext2D) => void, C = 120): Ext {
  const c = createCanvas(C * Z, C * Z);
  const x = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  x.translate((C * Z) / 2, (C * Z) / 2);
  x.scale(Z, Z);
  draw(x);
  const d = (x as unknown as { getImageData: (a: number, b: number, c: number, d: number) => { data: Uint8ClampedArray } }).getImageData(0, 0, C * Z, C * Z).data;
  let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
  for (let y = 0; y < C * Z; y++)
    for (let i = 0; i < C * Z; i++)
      if (d[(y * C * Z + i) * 4 + 3]! > 40) {
        l = Math.min(l, i); r = Math.max(r, i); t = Math.min(t, y); b = Math.max(b, y);
      }
  const h = (C * Z) / 2;
  return [(h - l) / Z, (r + 1 - h) / Z, (h - t) / Z, (b + 1 - h) / Z];
}
function measure(m: Mods): Record<string, Ext> {
  const out: Record<string, Ext> = {};
  const motion = [[0, 0, 0, 0], [6, -1, 1, 0.9], [-6, 2, 1, -0.9], [0, 6, 1, 0], [3, -6, 0.6, 0.4]] as const;
  // Grappler's two caves (swing.renderer.ts: the cave figure and the jungle's larger one), the arms round the clock.
  for (const [name, headR, stick, hy, ny, hipy, arm, fx, fy] of [
    ["cave", 3.4, 2.4, -6.5, -3, 3, 8, 3, 9],
    ["jungle", 4.2, 3, -7.5, -3.2, 3.6, 9.5, 3.6, 11],
  ] as const)
    for (const [mi, [mx, my, sp, face]] of motion.entries())
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const ax = Math.cos(ang), ay = Math.sin(ang);
        const p = Object.assign(m.H.heroPose(), {
          headR, stick, headX: 0, headY: hy, neckX: 0, neckY: ny, hipX: 0, hipY: hipy, shoulderX: 0, shoulderY: ny,
          handAX: ax * arm, handAY: ny + ay * arm, handBX: ax * (arm - 1) + ay * 2.4, handBY: ny + ay * (arm - 1) - ax * 2.4,
          footAX: -fx, footAY: fy, footBX: fx, footBY: fy, moveX: mx, moveY: my, speed: sp, face, gentle: true,
        });
        out[`grappler-${name}-m${mi}-a${a}`] = ink((x) => m.H.drawHero(x, p));
      }
  // Moon Climb through its own drawNinja (the gear overlaid).
  for (const pose of [0, 1, 2, 3, 4])
    for (const face of [1, -1])
      for (const tick of [0, 7, 19])
        out[`ninja-p${pose}-f${face}-t${tick}`] = ink((x) => m.drawNinja(x, 0, 0, pose, face, tick, pose === 2 ? 0.7 : 0, 1));
  return out;
}
const FIXTURE = "scripts/fixtures/hero-bounds-main.json";
const record = process.argv.find((a) => a.startsWith("--record="))?.slice(9);
if (record) {
  const root = resolve(record);
  const old = measure({
    H: (await import(`${root}/src/lib/arcade/hero.renderer.ts`)) as typeof H,
    drawNinja: ((await import(`${root}/src/lib/arcade/ricochetNinja.renderer.ts`)) as { drawNinja: typeof drawNinja }).drawNinja,
  });
  writeFileSync(FIXTURE, JSON.stringify(old, null, 0) + "\n");
  console.log(`recorded ${Object.keys(old).length} poses from ${root} to ${FIXTURE}`);
}
{
  const old = JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, Ext>;
  const now = measure({ H, drawNinja });
  const sides = ["left", "right", "top", "bottom"];
  for (const [key, ext] of Object.entries(now)) {
    const was = old[key];
    ok(Boolean(was), `${key}: no recorded extent on main`);
    if (!was) continue;
    ext.forEach((v, i) => ok(v <= was[i]! + 0.5, `${key}: drawn ${v.toFixed(2)} px to the ${sides[i]}, the old figure ${was[i]!.toFixed(2)} (+0.5 allowed)`));
  }
}

/* 5. celebration poses */
{
  const v = H.heroVictoryPose(H.heroPose(), 50, 200, 100, 0);
  ok(v.footAY === 200 && v.footBY === 200, "the victory pose's feet are off the ground");
  ok(v.handAY < v.headY && v.handBY < v.headY && v.handAX < v.headX && v.handBX > v.headX, "the victory pose's arms are not up in a V");
  let lowest = Infinity;
  let highest = -Infinity;
  for (let k = 0; k < 40; k++) {
    const p = H.heroRunPose(H.heroPose(), 50, 200, 100, k / 40);
    const g = Math.max(p.footAY, p.footBY);
    lowest = Math.min(lowest, g);
    highest = Math.max(highest, g);
  }
  ok(highest > 199 && highest <= 200.01 && lowest > 190, `the run cycle's feet ${lowest.toFixed(1)}–${highest.toFixed(1)}, not touching down and lifting under 10 px`);
  const c = createCanvas(200, 200);
  const x = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  H.drawHero(x, H.heroVictoryPose(H.heroPose(), 100, 190, 120, 0));
  H.drawHero(x, H.heroRunPose(H.heroPose(), 100, 190, 120, 0.3));
  H.drawHero(x, H.heroDancePose(H.heroPose(), 100, 190, 120, 140));
  ok(true, "the celebration poses draw");
}

/* 6. Medal and the art components */
for (const [place, metal] of [[1, "gold"], [2, "silver"], [3, "bronze"]] as const) {
  const html = renderToStaticMarkup(<Medal place={place} />);
  ok(html.includes("<svg") && html.includes(`--jz-metal-${metal}-1`), `Medal ${place} does not draw the ${metal} medal art`);
  ok(!/>\s*\d\s*</.test(html), `Medal ${place} shows a number on the art`);
  ok(/role="img"/.test(html) && html.includes(`aria-label="${place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"}"`), `Medal ${place} has no accessible label`);
  for (const [size, px] of [["s", 22], ["m", 36], ["l", 64]] as const)
    ok(renderToStaticMarkup(<Medal place={place} size={size} />).includes(`width="${px}"`), `Medal ${place} at ${size} is not ${px} px wide`);
}
ok(renderToStaticMarkup(<Medal place={1} shared />).includes('aria-label="Joint 1st"'), "a shared 1st does not read Joint 1st");
ok(/>4</.test(renderToStaticMarkup(<Medal place={4} />)), "4th lost its number");
ok(renderToStaticMarkup(<Emblem tier="volt" division={2} size={28} />).includes('aria-label="Volt II"'), "the emblem's label");
ok(renderToStaticMarkup(<Emblem tier="lightning" rank={37} size={150} />).includes("#<!-- -->37") || renderToStaticMarkup(<Emblem tier="lightning" rank={37} size={150} />).includes("#37"), "Lightning shows no rank");
ok(renderToStaticMarkup(<Badge kind="founder" player={42} />).includes("#0042"), "the founder badge's number is not data");
ok(renderToStaticMarkup(<Trophy kind="championship" />).includes("CHAMPION"), "the championship trophy's plate");

// An unchanged ArtSvg re-rendered (a room or game clock tick) changes nothing in the DOM.
{
  const { createElement, Fragment } = await import("react");
  const { rerenderMutations } = await import("./rerender-mutations");
  const mutations = await rerenderMutations(() =>
    createElement(Fragment, null, createElement(Medal, { place: 2 }), createElement(Trophy, { kind: "championship" }), createElement(Emblem, { tier: "volt", division: 2 })),
  );
  if (mutations === 0) passes++;
  else fails.push(`an unchanged ArtSvg re-rendered makes ${mutations} DOM change(s): keep one dangerouslySetInnerHTML object per markup`);
}

if (fails.length) {
  for (const f of fails) console.log(`FAIL ${f}`);
  console.log(`FAIL art-check: ${fails.length} failed, ${passes} passed`);
  process.exit(1);
}
console.log(`PASS art-check: ${passes} checks (17 reward pieces byte for byte, metals, the three captain poses, game figures no bigger than before, celebrations, Medal)`);
