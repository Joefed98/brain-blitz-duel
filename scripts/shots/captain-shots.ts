/**
 * Captain Joulz for review (design foundation F5, 6 Nov 2026; a design tool, not a check; no browser):
 *
 *   captain-approved-vs-canvas.png  the approved SVGs (top) over drawCaptain's canvas port (bottom), ready, run, win
 *   celebrations-<tag>.png          the victory pose (t 0 and 300 ms), the run cycle, the dance, and Moon Climb's
 *                                   five poses with their ninja gear, as celebrationCanvas and the game draw them
 *   game-figures.png                Grappler (swing, hang), Roofbound and Moon Climb's leap at 2× device pixels, in
 *                                   their body boxes (red, + 2 px); with --old, the older figure above each
 *
 *   bun scripts/shots/captain-shots.ts [--old=<checkout of main>] [--out=screenshots/art-f5-nov-2026]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { createCanvas, loadImage } from "@napi-rs/canvas";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/art-f5-nov-2026";
const OLD = process.argv.find((a) => a.startsWith("--old="))?.slice(6);
mkdirSync(OUT, { recursive: true });

type Hero = typeof import("../../src/lib/arcade/hero.renderer");
type Ninja = typeof import("../../src/lib/arcade/ricochetNinja.renderer");
type Ctx = CanvasRenderingContext2D;
const load = async (root: string) => ({
  H: (await import(`${root}/src/lib/arcade/hero.renderer.ts`)) as Hero,
  N: (await import(`${root}/src/lib/arcade/ricochetNinja.renderer.ts`)) as Ninja,
});
const now = await load(resolve("."));
const old = OLD ? await load(resolve(OLD)) : null;

/* the approved art against the canvas port */
{
  const S = 3, W = 180 * S, HH = 240 * S;
  const sheet = createCanvas(W * 3, HH * 2);
  const sx = sheet.getContext("2d");
  for (const [i, pose] of (["ready", "run", "win"] as const).entries()) {
    sx.fillStyle = "#0F1424";
    sx.fillRect(i * W, 0, W, HH * 2);
    sx.drawImage(await loadImage(readFileSync(`docs/art/svg/captain-joulz-${pose}.svg`)), i * W, 0, W, HH);
    const c = createCanvas(W, HH);
    const x = c.getContext("2d") as unknown as Ctx;
    x.translate(10 * S, 40 * S);
    x.scale(S, S);
    now.H.drawCaptain(x, now.H.captainArtRig(now.H.captainRig(), pose));
    sx.drawImage(c, i * W, HH);
  }
  writeFileSync(join(OUT, "captain-approved-vs-canvas.png"), sheet.toBuffer("image/png"));
}

/* the celebrations and Moon Climb */
for (const [tag, m] of [["after", now], ...(old ? [["before", old] as const] : [])] as const) {
  const c = createCanvas(1500, 520);
  const x = c.getContext("2d") as unknown as Ctx;
  x.fillStyle = "#0F1424";
  x.fillRect(0, 0, 1500, 520);
  x.scale(2, 2);
  x.fillStyle = "#EEF2FF";
  x.font = "11px sans-serif";
  const ground = 150, h = 100;
  const lab = (t: string, X: number, Y = 14) => x.fillText(t, X, Y);
  lab("victory 0 ms", 10); m.H.drawHero(x, m.H.heroVictoryPose(m.H.heroPose(), 50, ground, h, 0));
  lab("victory 300 ms", 95); m.H.drawHero(x, m.H.heroVictoryPose(m.H.heroPose(), 140, ground, h, 300));
  for (let k = 0; k < 4; k++) {
    lab(`run ${k / 4}`, 200 + k * 85);
    m.H.drawHero(x, m.H.heroRunPose(m.H.heroPose(), 240 + k * 85, ground, h, k / 4));
  }
  for (let k = 0; k < 2; k++) {
    lab(`dance ${k * 150} ms`, 540 + k * 80);
    m.H.drawHero(x, m.H.heroDancePose(m.H.heroPose(), 580 + k * 80, ground, h, k * 150));
  }
  lab("Moon Climb: cling, leap, tuck, stunned, lantern", 10, 176);
  for (const pose of [0, 1, 2, 3, 4]) m.N.drawNinja(x, 60 + pose * 60, 215, pose, 1, 30, 0.6, 1);
  writeFileSync(join(OUT, `celebrations-${tag}.png`), c.toBuffer("image/png"));
}

/* the game figures in their boxes */
{
  type P = Record<string, number>;
  const g = (ax: number, ay: number): P => ({
    headR: 4.2, stick: 3, headX: 0, headY: -7.5, neckX: 0, neckY: -3.2, hipX: 0, hipY: 3.6, shoulderX: 0, shoulderY: -3.2,
    handAX: ax * 9.5, handAY: -3.2 + ay * 9.5, handBX: ax * 8.5 + ay * 2.4, handBY: -3.2 + ay * 8.5 - ax * 2.4,
    footAX: -3.6, footAY: 11, footBX: 3.6, footBY: 11, moveX: 4, moveY: -1, speed: 0.6, face: 0.9,
  });
  const roof: P = { headR: 3.4, stick: 2.4, headX: 0, headY: -6.5, neckX: 0, neckY: -3, hipX: 0, hipY: 3, shoulderX: 0, shoulderY: -3, handAX: -5, handAY: 3.2, handBX: 5, handBY: -0.2, footAX: -1.8, footAY: 9, footBX: 1.8, footBY: 9, moveX: 1, moveY: 0, speed: 0.8, face: 1 };
  const cases: [string, P | null, number, (x: Ctx) => void][] = [
    ["Grappler swing", g(0.6, -0.8), 1, (x) => { x.beginPath(); x.arc(0, 0, 12, 0, 7); x.stroke(); }],
    ["Grappler hang", g(0, -1), 1, (x) => { x.beginPath(); x.arc(0, 0, 12, 0, 7); x.stroke(); }],
    ["Roofbound run", roof, 1.65, (x) => x.strokeRect(-14 / 1.65, -16 / 1.65, 28 / 1.65, 32 / 1.65)],
    ["Moon Climb leap", null, 1, (x) => x.strokeRect(-15, -28, 30, 56)],
  ];
  const rows = old ? [old, now] : [now];
  const Z = 6, C = 70;
  const c = createCanvas(C * Z * cases.length, C * Z * rows.length + 36);
  const x = c.getContext("2d") as unknown as Ctx;
  x.fillStyle = "#1B3A2C";
  x.fillRect(0, 0, c.width, c.height);
  for (const [i, [name, p, sc, box]] of cases.entries())
    for (const [row, m] of rows.entries()) {
      const t = createCanvas(C * 2, C * 2);
      const tx = t.getContext("2d") as unknown as Ctx;
      tx.translate(C, C);
      tx.scale(2 * sc, 2 * sc);
      if (p) m.H.drawHero(tx, Object.assign(m.H.heroPose(), p, { scale: sc }));
      else m.N.drawNinja(tx, 0, 0, 1, 1, 30, 0, 1);
      tx.strokeStyle = "rgba(255,80,80,0.9)";
      tx.lineWidth = 0.5 / sc;
      box(tx);
      (x as unknown as { imageSmoothingEnabled: boolean }).imageSmoothingEnabled = false;
      x.drawImage(t as unknown as CanvasImageSource, i * C * Z, 36 + row * C * Z, C * Z, C * Z);
      x.fillStyle = "#fff";
      x.font = "20px sans-serif";
      x.fillText(name + (old ? " (top: before, bottom: F5)" : ""), i * C * Z + 8, 26);
    }
  writeFileSync(join(OUT, "game-figures.png"), c.toBuffer("image/png"));
}
console.log(`wrote ${OUT}/captain-approved-vs-canvas.png, celebrations-after.png${old ? ", celebrations-before.png" : ""}, game-figures.png`);
