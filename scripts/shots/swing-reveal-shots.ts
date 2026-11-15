/**
 * Grappler's reveal picture at the phone sizes (stage 3 of the Action overhaul, 15 Nov 2026; a design tool, not a
 * check): an average skill-band run on a dealt swingRev 18 course replayed by the server's own replay (traceSwingRun),
 * its run picture drawn by `drawSwingRunPicture` at the reveal's real width on each phone (the viewport less the play
 * screen's 4 px padding, AnswerReveal's 12 px and the reveal column's 12 px each side), with the four big numbers and
 * the legend drawn as the reveal's CSS sets them (text-2xl / text-sm, Archivo), on the reveal's gradient.
 * `--old=<file>` draws another renderer (e.g. the stage-2 one from git) for a before → after pair.
 *
 *   bun scripts/shots/swing-reveal-shots.ts [--old=<renderer file>] [--tag=after] [--out=<dir>]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { createCanvas, GlobalFonts, Path2D as NapiPath2D } from "@napi-rs/canvas";

if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });
GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const OUT = arg("out") ?? ".shots/swing-reveal";
const TAG = arg("tag") ?? "after";
mkdirSync(OUT, { recursive: true });

const S = await import("../../src/lib/arcade/swing");
const RV = await import(arg("old") ? resolve(arg("old")!) : "../../src/lib/arcade/swingReveal.renderer");
const { traceSwingRun } = await import("../../src/lib/duel/swingRunTrace");
const { encodeSwingRun } = await import("../../src/lib/duel/swing");
const { Human } = await import("../arcade-skill-bands/human");
const { bot } = await import("../arcade-skill-bands/bots/swing");

/** The reveal's picture width on a phone: the viewport less 4 + 12 + 12 px each side (pad-game-safe, AnswerReveal, the column). */
export const revealPictureWidth = (viewport: number) => viewport - 2 * (4 + 12 + 12);

const big = S.swingGameFor(S.SWING_REV_BIG);
const bigW = (JSON.parse(gunzipSync(readFileSync("scripts/fixtures/swing-big-deal-witness.json.gz")).toString()) as { witnesses: { seed: number }[] }).witnesses;
const seed = bigW[3]!.seed;
const level = (arg("level") ?? "average") as never;
const events = (bot({ game: big, seed, rev: S.SWING_REV_BIG, human: new Human("swing", seed, level) } as never).events ?? []) as { t: number }[];
const byT = new Map(events.map((e) => [e.t, e]));
let st = big.init(seed);
const cps: unknown[] = [];
while (!big.isOver(st)) {
  st = big.step(st, (byT.get(st.tick + 1) ?? null) as never);
  if (st.tick % S.SWING_CHECKPOINT_INTERVAL === 0) cps.push(S.swingCheckpoint(st));
}
const raw = encodeSwingRun({ seed, claimedScore: big.score(st), events, inputs: [], taps: [], endTick: st.tick, checkpoints: cps } as never);
const trace = traceSwingRun(seed, raw, S.SWING_REV_BIG)!;

for (const [vw, vh] of [[375, 667], [390, 844]] as const) {
  const width = revealPictureWidth(vw);
  const ph = RV.swingRunPictureHeight(width);
  const dpr = 2;
  const H = 120 + ph + 70;
  const c = createCanvas(vw * dpr, H * dpr);
  const x = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  x.scale(dpr, dpr);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1F5A34");
  g.addColorStop(1, "#0C2516");
  x.fillStyle = g;
  x.fillRect(0, 0, vw, H);
  const left = 28;
  // The four big numbers (BigStat: text-2xl numbers, text-sm labels).
  const stats: [string, string][] = [[`${trace.percent}%`, "Course"], [`${trace.cleared}/${trace.total}`, "Stretches"], [`${trace.underPar}`, "Under par"], [`${trace.gates}/${trace.gateTotal}`, "Gates"]];
  const cw = (width - 24) / 4;
  stats.forEach(([v, l], i) => {
    const cx = left + i * (cw + 8);
    x.fillStyle = "rgba(255,255,255,0.05)";
    x.beginPath();
    x.roundRect(cx, 16, cw, 70, 12);
    x.fill();
    x.textAlign = "center";
    x.fillStyle = "#F5F5F7";
    x.font = "800 24px Archivo";
    x.fillText(v, cx + cw / 2, 50);
    x.fillStyle = "#E0E7F6";
    x.font = "600 14px Archivo";
    x.fillText(l, cx + cw / 2, 74);
  });
  x.save();
  x.translate(left, 104);
  RV.drawSwingRunPicture(x, trace, { width, height: ph });
  x.restore();
  // The legend (text-sm).
  x.textAlign = "left";
  x.font = "600 14px Archivo";
  x.fillStyle = "#E0E7F6";
  const legend = `Under par · Cleared · ${trace.finished ? "" : "Ended here · "}Fell ${trace.falls} times · Best streak ${trace.bestStreak}`;
  x.fillText(legend, left, 104 + ph + 30, width);
  x.fillStyle = "#FFFFFF";
  x.font = "700 12px Archivo";
  x.fillText(`${vw} × ${vh}: the picture ${width} × ${ph} px on screen`, left, H - 10);
  const file = `${OUT}/swing-reveal-${vw}x${vh}-${TAG}.png`;
  writeFileSync(file, c.toBuffer("image/png"));
  console.log(file);
}
