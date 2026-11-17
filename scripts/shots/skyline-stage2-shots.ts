/**
 * High Rise's stage-2 gallery frames (the Action overhaul, 15 Nov 2026; docs/design/pages-review/action/skyline/): the
 * effects strip (a drop falling, a perfect drop's gold ring, a trim crumbling, a sliver wobbling, a lost life, the end's
 * count) drawn by the game's own renderer on one scripted skylineRev 11 run, and the answer reveal before and after: the
 * stored reveal's breakdown and tiles as main shows them, and the new picture of the run (drawSkylineRunPicture) with its
 * three big numbers and legend, set in the reveal's gradient at the reveal's type sizes. In @napi-rs/canvas, no browser,
 * so the reveal's text is drawn to the layout here, not by the app's CSS. A design tool, not a check.
 *
 *   bun scripts/shots/skyline-stage2-shots.ts <out dir>
 *
 * Writes effects-s2.png, reveal-s2.png (before | after) and reveal-s3.png (stage 3: the reveal's order, the big numbers and
 * the picture straight under the score, the shared breakdown list below); the gallery's WebPs are made with Pillow.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { createCanvas, GlobalFonts, Path2D as NapiPath2D, type SKRSContext2D } from "@napi-rs/canvas";

GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");

let clockMs = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clockMs } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 1, getComputedStyle: (el: { style?: Record<string, string> }) => el.style ?? {} },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const S = await import("../../src/lib/arcade/skyline");
const R = await import("../../src/lib/arcade/skyline.renderer");
const { encodeSkylineRun, replaySkylineRun } = await import("../../src/lib/duel/skyline");
const { skylineRunSummary } = await import("../../src/lib/duel/skylineSummary");
const { buildArcadeReveal } = await import("../../src/lib/arcade/reveal");
const { breakdownRows, rowText } = await import("../../src/lib/duel/revealBreakdown");
const { bandStdLines } = await import("../../src/lib/duel/arcadeBandStd");
const { REVEAL_PALETTE } = await import("../../src/lib/duel/revealPalette.data");

const out = process.argv[2] ?? ".shots/skyline-s2";
mkdirSync(out, { recursive: true });
const g = S.skylineGameFor(S.SKYLINE_REV_LIVES);
const WH = S.skylineWorldHFor(S.SKYLINE_REV_LIVES);
const size = { width: S.SKYLINE_WORLD_W, height: WH };
const SEED = 13;

/* ---------------- The run: trims, a sliver, two lost lives, perfect drops (the check's player plus a sliver). ---------------- */
type Moment = "drop" | "perfect" | "trim" | "sliver" | "lost" | "end";
const want: Record<Moment, number> = { drop: 2, perfect: 9, trim: 7, sliver: 22, lost: 14, end: 40 };
const frames = new Map<Moment, ReturnType<typeof createCanvas>>();
const world = createCanvas(size.width, size.height);
const wc = world.getContext("2d") as unknown as CanvasRenderingContext2D;
let s = g.init(SEED);
const taps: number[] = [];
const checkpoints: ReturnType<typeof S.skylineCheckpoint>[] = [];
const pending: { moment: Moment; at: number }[] = [];
const grab = (m: Moment) => {
  if (frames.has(m)) return;
  const c = createCanvas(size.width, size.height);
  c.getContext("2d").drawImage(world, 0, 0);
  frames.set(m, c);
};
for (let t = 1; t <= S.SKYLINE_RUN_TICKS && !g.isOver(s); t++) {
  const top = s.blocks[s.blocks.length - 1]!;
  const off = s.x - top.x;
  const overlap = Math.min(s.x + s.w, top.x + top.w) - Math.max(s.x, top.x);
  const rearmed = !s.lostTick || t - s.lostTick > S.SKYLINE_V11_REARM_TICKS;
  let tap = false;
  if (s.placed >= 2 && s.placed < 7) tap = off > 6_000 && off < 8_000;
  else if ((s.placed === 9 || s.placed === 16) && (s.livesLost ?? 0) < (s.placed === 9 ? 1 : 2)) tap = rearmed && overlap <= 0;
  else if (s.placed === 24) tap = overlap > 0 && overlap * 4 < s.w && overlap * 6 > s.w;
  else tap = Math.abs(off) <= 700;
  if (tap) taps.push(t);
  const before = s;
  s = g.step(s, tap);
  if (s.tick % S.SKYLINE_CHECKPOINT_INTERVAL === 0) checkpoints.push(S.skylineCheckpoint(s));
  if (s.blocks.length > before.blocks.length) {
    const nt = s.blocks[s.blocks.length - 1]!;
    if (s.perfects > before.perfects && s.placed === 12) pending.push({ moment: "drop", at: t + want.drop }, { moment: "perfect", at: t + want.perfect });
    else if (s.perfects === before.perfects && nt.w * 4 < before.w) pending.push({ moment: "sliver", at: t + want.sliver });
    else if (s.perfects === before.perfects && s.placed === 4) pending.push({ moment: "trim", at: t + want.trim });
  }
  if ((s.livesLost ?? 0) > (before.livesLost ?? 0) && s.livesLost === 2) pending.push({ moment: "lost", at: t + want.lost });
  clockMs += 1000 / 60;
  R.drawSkylineArt(wc, s, size);
  for (const p of pending) if (p.at === t) grab(p.moment);
}
// The end's frames, one every 6 (100 ms), for the clip (end-00.png …): the camera pulling back as the count rises.
for (let k = 0; k < 72; k++) {
  clockMs += 1000 / 60;
  R.drawSkylineArt(wc, s, size);
  if (k === want.end) grab("end");
  if (k % 6 === 0) {
    const f = createCanvas(Math.round(size.width / 1.5), Math.round(size.height / 1.5));
    f.getContext("2d").drawImage(world, 0, 0, f.width, f.height);
    writeFileSync(`${out}/end-${String(k / 6).padStart(2, "0")}.png`, f.toBuffer("image/png"));
  }
}

/* ---------------- The effects strip. ---------------- */
const LABELS: [Moment, string][] = [
  ["drop", "Drop: falls the last floor"],
  ["perfect", "Perfect: gold ring at the join"],
  ["trim", "Trim: the overhang crumbles"],
  ["sliver", "Sliver: wobbles on its foot"],
  ["lost", "Life lost: tumbles away"],
  ["end", "The end: count and pull-back"],
];
const TW = 260;
const TH = Math.round((WH * TW) / size.width);
const strip = createCanvas(TW * LABELS.length + 10 * (LABELS.length + 1), TH + 56);
const sc = strip.getContext("2d") as unknown as SKRSContext2D;
sc.fillStyle = "#0B0F1A";
sc.fillRect(0, 0, strip.width, strip.height);
LABELS.forEach(([m, label], i) => {
  const x = 10 + i * (TW + 10);
  sc.fillStyle = "#F3F1EC";
  sc.font = "700 17px sans-serif";
  sc.textBaseline = "middle";
  sc.fillText(label, x, 24);
  const f = frames.get(m);
  if (f) sc.drawImage(f, x, 46, TW, TH);
  else {
    sc.fillStyle = "#FF6B74";
    sc.fillText("(not reached)", x, 80);
  }
});
writeFileSync(`${out}/effects-s2.png`, strip.toBuffer("image/png"));

/* ---------------- The reveal: before (main's tiles) | after (the picture). ---------------- */
const raw = encodeSkylineRun({ seed: SEED, claimedScore: g.score(s), inputs: taps, endTick: s.tick, checkpoints });
const replay = replaySkylineRun(SEED, raw, S.SKYLINE_REV_LIVES);
const reveal = buildArcadeReveal("skyline", replay as never, replay.score)!;
const puzzle = { type: "skyline", seed: SEED, skylineRev: S.SKYLINE_REV_LIVES } as Record<string, unknown> & { type: string };
const lines = bandStdLines(puzzle, reveal.lines, replay.score) ?? reveal.lines;
const rows = breakdownRows(lines, replay.score).map(rowText);
const sum = skylineRunSummary(SEED, raw, S.SKYLINE_REV_LIVES);
const palette = REVEAL_PALETTE["skyline"]!;
const PW = 390;
const PH = 844;
function panel(title: string, body: (c: SKRSContext2D, y: number) => void): ReturnType<typeof createCanvas> {
  const c = createCanvas(PW, PH);
  const x = c.getContext("2d") as unknown as SKRSContext2D;
  const grad = x.createLinearGradient(0, 0, 0, PH);
  palette.forEach((stop, i) => grad.addColorStop(i / (palette.length - 1), stop));
  x.fillStyle = grad;
  x.fillRect(0, 0, PW, PH);
  x.fillStyle = "#F3F1EC";
  x.font = "800 18px sans-serif";
  x.textBaseline = "middle";
  x.fillText("High Rise", 16, 30);
  x.font = "600 13px sans-serif";
  x.fillStyle = "rgba(243,241,236,0.75)";
  x.textAlign = "right";
  x.fillText(title, PW - 16, 30);
  x.textAlign = "center";
  x.fillStyle = "#F3F1EC";
  x.font = "800 64px sans-serif";
  x.fillText(String(replay.score), PW / 2, 100);
  x.font = "600 15px sans-serif";
  x.fillStyle = "rgba(243,241,236,0.75)";
  x.fillText("points", PW / 2, 142);
  x.textAlign = "left";
  let y = 176;
  x.font = "600 15px sans-serif";
  for (const r of rows) {
    x.fillStyle = "#F3F1EC";
    x.fillText(r, 20, y);
    y += 26;
  }
  body(x, y + 10);
  return c;
}
const before = panel("Today (main)", (x, y0) => {
  let y = y0;
  for (const t of reveal.tiles) {
    x.fillStyle = "rgba(255,255,255,0.08)";
    x.fillRect(16, y - 16, PW - 32, 34);
    x.fillStyle = "#F3F1EC";
    x.font = "600 15px sans-serif";
    x.textAlign = "left";
    x.fillText(t.label, 26, y);
    x.textAlign = "right";
    x.fillText(t.value, PW - 26, y);
    y += 40;
  }
  x.textAlign = "left";
});
const after = panel("New", (x, y0) => {
  const stats: [number, string][] = [[sum.placed, "Floors"], [sum.perfects, "Perfect drops"], [sum.bestStreak, "Best streak"]];
  stats.forEach(([v, label], i) => {
    const cx = PW / 6 + (i * PW) / 3;
    x.textAlign = "center";
    x.fillStyle = "#F3F1EC";
    x.font = "800 36px sans-serif";
    x.fillText(String(v), cx, y0 + 18);
    x.font = "600 14px sans-serif";
    x.fillStyle = "rgba(243,241,236,0.75)";
    x.fillText(label, cx, y0 + 48);
  });
  const pic = createCanvas(PW - 24, 240);
  R.drawSkylineRunPicture(pic.getContext("2d") as unknown as CanvasRenderingContext2D, sum, { width: PW - 24, height: 240 });
  x.drawImage(pic, 12, y0 + 70);
  const legend: [string, string][] = [
    [R.SKYLINE_RUN_COLOURS.perfect, `Perfect ${sum.floors.filter((f) => f.kind === "perfect").length}`],
    [R.SKYLINE_RUN_COLOURS.trim, `Trimmed ${sum.floors.filter((f) => f.kind === "trim").length}`],
    [R.SKYLINE_RUN_COLOURS.wide, `Wide block ${sum.floors.filter((f) => f.kind === "wide").length}`],
    [R.SKYLINE_RUN_COLOURS.gold, `Gold block ${sum.floors.filter((f) => f.kind === "gold").length}`],
    [R.SKYLINE_RUN_COLOURS.lost, `Life lost ${sum.livesLost}`],
  ];
  x.font = "600 14px sans-serif";
  x.textAlign = "left";
  let lx = 22;
  let ly = y0 + 330;
  for (const [colour, text] of legend) {
    const w = 26 + x.measureText(text).width;
    if (lx + w > PW - 16) {
      lx = 22;
      ly += 24;
    }
    if (text.startsWith("Life")) {
      x.strokeStyle = colour;
      x.lineWidth = 2;
      x.strokeRect(lx + 1, ly - 5, 14, 10);
    } else {
      x.fillStyle = colour;
      x.fillRect(lx, ly - 6, 16, 12);
    }
    x.fillStyle = "#F3F1EC";
    x.fillText(text, lx + 22, ly);
    lx += w + 16;
  }
});
const pair = createCanvas(PW * 2 + 30, PH + 20);
const pc = pair.getContext("2d") as unknown as SKRSContext2D;
pc.fillStyle = "#0B0F1A";
pc.fillRect(0, 0, pair.width, pair.height);
pc.drawImage(before, 10, 10);
pc.drawImage(after, PW + 20, 10);
writeFileSync(`${out}/reveal-s2.png`, pair.toBuffer("image/png"));
console.log(`effects ${[...frames.keys()].join(", ")}; score ${replay.score}, ${sum.placed} floors, ${sum.livesLost} lost, rescues ${sum.rescues}; rows ${rows.length}`);

/* ---------------- Stage 3 (15 Nov 2026): the reveal's order, before | after, the breakdown as the shared list. ---------------- */
{
  const parts = breakdownRows(lines, replay.score);
  const H3 = 900;
  /** The shared breakdown list (RevealBreakdown): a dark panel, one row a part (name, detail, points of max, a bar). */
  const list = (x: SKRSContext2D, y0: number): number => {
    const rowH = 50;
    x.fillStyle = "rgba(7,7,10,0.55)";
    x.beginPath();
    x.roundRect(12, y0, PW - 24, rowH * parts.length + 8, 10);
    x.fill();
    parts.forEach((row, i) => {
      const y = y0 + 8 + i * rowH;
      x.textAlign = "left";
      x.fillStyle = row.kind === "total" ? "#F2C75C" : "#F3F1EC";
      x.font = "700 15px Archivo, sans-serif";
      x.fillText(row.name, 24, y + 12);
      if (row.detail) {
        x.font = "500 13px Archivo, sans-serif";
        x.fillStyle = "rgba(243,241,236,0.8)";
        x.fillText(row.detail, 24, y + 30);
      }
      x.textAlign = "right";
      x.font = "700 15px Archivo, sans-serif";
      x.fillStyle = row.kind === "total" ? "#F2C75C" : "#F3F1EC";
      if (row.points !== null) x.fillText(row.max !== null ? `${row.points} of ${row.max}` : `${row.points} points`, PW - 24, y + 12);
      if (row.max) {
        x.fillStyle = "rgba(255,255,255,0.12)";
        x.fillRect(24, y + 41, PW - 48, 3);
        x.fillStyle = "#F2C75C";
        x.fillRect(24, y + 41, ((PW - 48) * Math.max(0, Math.min(1, (row.points ?? 0) / row.max))), 3);
      }
    });
    return y0 + rowH * parts.length + 8;
  };
  /** The run picture as the component lays it out: three big numbers, the tower, the legend. */
  const picture = (x: SKRSContext2D, y0: number): number => {
    const stats: [number, string][] = [[sum.placed, "Floors"], [sum.perfects, "Perfect drops"], [sum.bestStreak, "Best streak"]];
    stats.forEach(([v, label], i) => {
      const cx = PW / 6 + (i * PW) / 3;
      x.textAlign = "center";
      x.fillStyle = "#F3F1EC";
      x.font = "800 36px Archivo, sans-serif";
      x.fillText(String(v), cx, y0 + 18);
      x.font = "600 14px Archivo, sans-serif";
      x.fillStyle = "rgba(243,241,236,0.75)";
      x.fillText(label, cx, y0 + 48);
    });
    const pic = createCanvas(PW - 24, 220);
    R.drawSkylineRunPicture(pic.getContext("2d") as unknown as CanvasRenderingContext2D, sum, { width: PW - 24, height: 220 });
    x.drawImage(pic, 12, y0 + 70);
    x.textAlign = "center";
    x.font = "600 14px Archivo, sans-serif";
    x.fillStyle = "#F3F1EC";
    x.fillText(`Perfect ${sum.floors.filter((f) => f.kind === "perfect").length} · Trimmed ${sum.floors.filter((f) => f.kind === "trim").length} · Life lost ${sum.livesLost}`, PW / 2, y0 + 306);
    return y0 + 324;
  };
  const shell = (title: string): [ReturnType<typeof createCanvas>, SKRSContext2D] => {
    const c = createCanvas(PW, H3);
    const x = c.getContext("2d") as unknown as SKRSContext2D;
    const grad = x.createLinearGradient(0, 0, 0, H3);
    palette.forEach((stop, i) => grad.addColorStop(i / (palette.length - 1), stop));
    x.fillStyle = grad;
    x.fillRect(0, 0, PW, H3);
    x.textBaseline = "middle";
    x.fillStyle = "#F3F1EC";
    x.font = "800 18px Archivo, sans-serif";
    x.fillText("High Rise", 16, 30);
    x.textAlign = "right";
    x.font = "600 13px Archivo, sans-serif";
    x.fillStyle = "rgba(243,241,236,0.75)";
    x.fillText(title, PW - 16, 30);
    x.textAlign = "center";
    x.fillStyle = "#F3F1EC";
    x.font = "800 64px Archivo, sans-serif";
    x.fillText(String(replay.score), PW / 2, 96);
    x.font = "600 15px Archivo, sans-serif";
    x.fillStyle = "rgba(243,241,236,0.75)";
    x.fillText("points", PW / 2, 136);
    return [c, x];
  };
  const [b3, bx] = shell("Before (stage 2), practice");
  picture(bx, list(bx, 160) + 18);
  const [a3, ax] = shell("After, practice");
  list(ax, picture(ax, 166) + 10);
  const pair3 = createCanvas(PW * 2 + 30, H3 + 20);
  const p3 = pair3.getContext("2d") as unknown as SKRSContext2D;
  p3.fillStyle = "#0B0F1A";
  p3.fillRect(0, 0, pair3.width, pair3.height);
  p3.drawImage(b3, 10, 10);
  p3.drawImage(a3, PW + 20, 10);
  writeFileSync(`${out}/reveal-s3.png`, pair3.toBuffer("image/png"));
}
