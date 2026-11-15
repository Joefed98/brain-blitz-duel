/**
 * Orbit's stage-2 gallery frames (the Action overhaul, 15 Nov 2026; docs/design/pages-review/action/orbit/): the effects
 * strip (the launch puff, a catch's lock ring, low fuel, out of fuel drifting, the respawn's hold and GO, the sun's bloom)
 * drawn by the game's own renderer on the fixed intro example's course, played by the skill-band bots (elite to the sun,
 * weak for the slips), and the answer reveal before and after: the stored breakdown and tiles as main shows them, and the
 * new run picture (the course map, drawOrbitRunMap, with its big numbers and legend), set in the reveal's gradient at the
 * reveal's type sizes. In @napi-rs/canvas, no browser, so the reveal's text is drawn to the layout here. A design tool,
 * not a check.
 *
 *   bun scripts/shots/orbit-stage2-shots.ts <out dir>
 *
 * Writes effects-s2.png and reveal-s2.png (before | after); the gallery's WebPs are made from them with Pillow.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";

let clockMs = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clockMs } });
const g = globalThis as Record<string, unknown>;
g.document = { createElement: () => createCanvas(1, 1), fonts: { load: async () => [], check: () => true }, documentElement: { dataset: {}, classList: { contains: () => false } }, hidden: false, addEventListener() {} };
g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
g.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 1, location: { pathname: "/", search: "", href: "http://localhost/" }, addEventListener() {}, removeEventListener() {} };
g.matchMedia = (g.window as { matchMedia: unknown }).matchMedia;
GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");

const R3 = await import("../../src/lib/arcade/orbitRev3");
const O = await import("../../src/lib/arcade/orbit");
const art = await import("../../src/lib/arcade/orbit.renderer");
const planetsR = await import("../../src/lib/arcade/orbitPlanets.renderer");
const { ORBIT_PLANET_MAPS } = await import("../../src/lib/arcade/orbitPlanetMaps.data");
const { drawOrbitRunMap, ORBIT_MAP_COLOURS } = await import("../../src/lib/arcade/orbitReveal.renderer");
const { encodeOrbitRun, replayOrbitRun } = await import("../../src/lib/duel/orbit");
const { traceOrbitRun } = await import("../../src/lib/duel/orbitRunTrace");
const { buildArcadeReveal } = await import("../../src/lib/arcade/reveal");
const { breakdownRows, rowText } = await import("../../src/lib/duel/revealBreakdown");
const { bandStdLines } = await import("../../src/lib/duel/arcadeBandStd");
const { REVEAL_PALETTE } = await import("../../src/lib/duel/revealPalette.data");
const { bot } = await import("../arcade-skill-bands/bots/orbit");
const { Human } = await import("../arcade-skill-bands/human");
const { exampleFor } = await import("./examples");

for (const [name, m] of Object.entries(ORBIT_PLANET_MAPS)) {
  for (const [key, file] of [[name, `${name}.webp`], ...(m.height ? [[`${name}-h`, `${name}-h.webp`]] : [])] as [string, string][]) {
    const img = await loadImage(`public/orbit/planets/${file}`);
    const c = createCanvas(img.width, img.height);
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    planetsR.setOrbitPlanetMap(key as never, { w: img.width, h: img.height, data: x.getImageData(0, 0, img.width, img.height).data as never });
  }
}

const out = process.argv[2] ?? ".shots/orbit-s2";
mkdirSync(out, { recursive: true });
const puzzle = exampleFor("orbit" as never) as unknown as { type: "orbit"; seed: number; orbitRev: number; planets: never; holes: never; extras: never };
const start = R3.orbitStartForPuzzle(puzzle as never)!;
const game = { ...R3.orbitRev3Game, init: start } as never;
type S = InstanceType<typeof Object> & ReturnType<typeof start>;

function runOf(level: string) {
  const res = bot({ game, seed: puzzle.seed, rev: puzzle.orbitRev, human: new Human("orbit", puzzle.seed, level as never), fixes: true } as never) as { events?: { t: number }[] };
  const events = (res.events ?? []) as never[];
  const byTick = new Map(events.map((e: { t: number }) => [e.t, e]));
  const states: S[] = [];
  let s = start() as S;
  states.push(s);
  const checkpoints: unknown[] = [];
  while (!s.ended && s.tick < R3.orbitRev3Game.runTicks) {
    s = R3.orbitRev3Game.step(s, (byTick.get(s.tick + 1) as never) ?? null) as S;
    states.push(s);
    if (s.tick % O.ORBIT_CHECKPOINT_INTERVAL === 0) checkpoints.push(O.orbitCheckpoint(s as never));
  }
  const raw = encodeOrbitRun({ seed: puzzle.seed, claimedScore: R3.orbitRev3Game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  return { states, raw, end: s };
}

const W = 450, H = art.orbitDrawHFor(puzzle.orbitRev);
/** Draws states[from..to] in order on one canvas (the effects' memories see every frame), the clock 1/60 s a frame. */
function film(states: S[], to: number, extraMs = 0): ReturnType<typeof createCanvas> {
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  const from = Math.max(0, to - 90);
  for (let i = from; i <= to; i++) {
    clockMs += 1000 / 60;
    art.orbitRev3ArtGame.draw(ctx, states[i]!, { width: W, height: H });
  }
  if (extraMs) {
    clockMs += extraMs;
    art.orbitRev3ArtGame.draw(ctx, states[to]!, { width: W, height: H });
  }
  return c;
}

const elite = runOf("elite");
const weak = runOf("weak");
const find = (states: S[], f: (a: S, b: S) => boolean) => states.findIndex((s, i) => i > 0 && f(states[i - 1]!, s));
const frames: [string, ReturnType<typeof createCanvas> | null][] = [];
const release = find(elite.states, (a, b) => b.releaseTick !== a.releaseTick && b.flying > 0 && b.tick > 300);
frames.push(["Launch: the thruster puff", release > 0 ? film(elite.states, release + 6) : null]);
const caught = find(elite.states, (a, b) => b.captured > a.captured && b.captured >= 3);
frames.push(["Every catch: the lock ring", caught > 0 ? film(elite.states, caught, 230) : null]);
const low = find(weak.states, (a, b) => (b.fuel ?? 999) <= 30 && (a.fuel ?? 999) > 30 && b.flying > 0);
frames.push(["Low fuel: red gauge, stuttering flame", low > 0 ? film(weak.states, low) : null]);
const dry = find(weak.states, (a, b) => b.dry !== a.dry && b.dry !== undefined && b.dry >= 0);
frames.push(["Out of fuel: cough, fizzle, drift", dry > 0 ? film(weak.states, dry + 18) : null]);
const held = find(weak.states, (a, b) => (b.hold ?? 0) > 0 && (b.hold ?? 0) === 90);
frames.push(["The hold: the arc drains, BACK IN 2", held > 0 ? film(weak.states, held) : null]);
const sun = elite.states.length - 1;
frames.push(["The sun: bloom, ALL 40 PLANETS!", elite.end.finished ? film(elite.states, sun, 420) : null]);

const TW = 230, TH = Math.round((H * TW) / W);
const strip = createCanvas(TW * frames.length + 10 * (frames.length + 1), TH + 56);
const sc = strip.getContext("2d") as unknown as SKRSContext2D;
sc.fillStyle = "#0B0F1A";
sc.fillRect(0, 0, strip.width, strip.height);
frames.forEach(([label, f], i) => {
  const x = 10 + i * (TW + 10);
  sc.fillStyle = "#F3F1EC";
  sc.font = "700 14px Archivo";
  sc.textBaseline = "middle";
  sc.fillText(label, x, 24);
  if (f) sc.drawImage(f, x, 46, TW, TH);
  else {
    sc.fillStyle = "#FF6B74";
    sc.fillText("(not reached)", x, 80);
  }
});
writeFileSync(`${out}/effects-s2.png`, strip.toBuffer("image/png"));

/* ---------------- The reveal: before (main's breakdown and tiles) | after (the run picture). ---------------- */
for (const [tag, run] of [["weak", weak], ["elite", elite]] as const) {
  const replay = replayOrbitRun(puzzle.seed, run.raw, puzzle.orbitRev, puzzle.planets, puzzle.holes, puzzle.extras);
  const reveal = buildArcadeReveal("orbit", replay as never, replay.score)!;
  const lines = bandStdLines(puzzle as never, reveal.lines, replay.score) ?? reveal.lines;
  const rows = breakdownRows(lines, replay.score).map(rowText);
  const trace = traceOrbitRun(puzzle as never, run.raw)!;
  const palette = REVEAL_PALETTE["orbit"]!;
  const PW = 390, PH = 900;
  const panel = (title: string, body: (c: SKRSContext2D, y: number) => void) => {
    const c = createCanvas(PW, PH);
    const x = c.getContext("2d") as unknown as SKRSContext2D;
    const grad = x.createLinearGradient(0, 0, 0, PH);
    palette.forEach((stop, i) => grad.addColorStop(i / (palette.length - 1), stop));
    x.fillStyle = grad;
    x.fillRect(0, 0, PW, PH);
    x.fillStyle = "#F3F1EC";
    x.font = "800 18px Archivo";
    x.textBaseline = "middle";
    x.fillText("Orbit", 16, 30);
    x.font = "600 13px Archivo";
    x.fillStyle = "rgba(243,241,236,0.75)";
    x.textAlign = "right";
    x.fillText(title, PW - 16, 30);
    x.textAlign = "center";
    x.fillStyle = "#F3F1EC";
    x.font = "800 64px Archivo";
    x.fillText(String(replay.score), PW / 2, 100);
    x.font = "600 15px Archivo";
    x.fillStyle = "rgba(243,241,236,0.75)";
    x.fillText("points", PW / 2, 142);
    x.textAlign = "left";
    let y = 176;
    x.font = "600 15px Archivo";
    for (const r of rows) {
      x.fillStyle = "#F3F1EC";
      x.fillText(r, 20, y);
      y += 26;
    }
    body(x, y + 10);
    return c;
  };
  const before = panel("Today (main)", (x, y0) => {
    let y = y0;
    for (const t of reveal.tiles.slice(0, 4)) {
      x.fillStyle = "rgba(255,255,255,0.08)";
      x.fillRect(16, y - 16, PW - 32, 34);
      x.fillStyle = "#F3F1EC";
      x.font = "600 15px Archivo";
      x.textAlign = "left";
      x.fillText(t.label, 26, y);
      x.textAlign = "right";
      x.fillText(t.value, PW - 26, y);
      y += 40;
    }
    x.textAlign = "left";
  });
  const after = panel("New", (x, y0) => {
    let y = y0;
    if (trace.finished) {
      x.textAlign = "center";
      x.fillStyle = "#F3F1EC";
      x.font = "800 20px Archivo";
      x.fillText("All 40 planets!", PW / 2, y + 6);
      y += 30;
    }
    const stats: [string, string][] = [
      [`${trace.best}/40`, "Planets"],
      [`${trace.counts.dust}/${trace.counts.dustTotal}`, "Stardust"],
      [`${trace.counts.slings}/${trace.counts.slingsTotal}`, "Slings"],
      [String(trace.slips.length), trace.slips.length === 1 ? "Slip" : "Slips"],
    ];
    stats.forEach(([v, label], i) => {
      const cx = PW / 8 + (i * PW) / 4;
      x.fillStyle = "rgba(255,255,255,0.06)";
      x.fillRect(cx - 42, y - 4, 84, 62);
      x.textAlign = "center";
      x.fillStyle = "#F3F1EC";
      x.font = "800 24px Archivo";
      x.fillText(v, cx, y + 18);
      x.font = "600 14px Archivo";
      x.fillStyle = "rgba(243,241,236,0.75)";
      x.fillText(label, cx, y + 44);
    });
    y += 74;
    const pw = PW - 30, ph = Math.round((pw * 300) / 360);
    const pic = createCanvas(pw, ph);
    drawOrbitRunMap(pic.getContext("2d") as unknown as CanvasRenderingContext2D, trace, pw, ph);
    x.drawImage(pic, 15, y);
    y += ph + 20;
    const fuel = trace.slips.filter((s) => s.kind === "fuel").length;
    const legend: [string, string][] = [
      [ORBIT_MAP_COLOURS.flight, "Flights"],
      ...(fuel ? [[ORBIT_MAP_COLOURS.fuel, "Out of fuel"] as [string, string]] : []),
      ...(trace.slips.length - fuel ? [[ORBIT_MAP_COLOURS.crash, "Crash"] as [string, string]] : []),
      [ORBIT_MAP_COLOURS.dust, "Stardust"],
      [ORBIT_MAP_COLOURS.moon, "Slingshot"],
    ];
    x.font = "600 13px Archivo";
    x.textAlign = "left";
    let lx = 22;
    for (const [colour, text] of legend) {
      x.fillStyle = colour;
      x.fillRect(lx, y - 4, 12, 8);
      x.fillStyle = "rgba(243,241,236,0.8)";
      x.fillText(text, lx + 16, y);
      lx += 28 + x.measureText(text).width;
    }
  });
  const pair = createCanvas(PW * 2 + 30, PH + 20);
  const pc = pair.getContext("2d") as unknown as SKRSContext2D;
  pc.fillStyle = "#0B0F1A";
  pc.fillRect(0, 0, pair.width, pair.height);
  pc.drawImage(before, 10, 10);
  pc.drawImage(after, PW + 20, 10);
  writeFileSync(`${out}/reveal-s2-${tag}.png`, pair.toBuffer("image/png"));
  console.log(`${tag}: score ${replay.score}, planets ${trace.best}, slips ${trace.slips.length}, flights ${trace.flights.length}, dust ${trace.counts.dust}`);
}
console.log(`effects: ${frames.map(([l, f]) => `${l.split(":")[0]} ${f ? "ok" : "missing"}`).join(", ")}`);
