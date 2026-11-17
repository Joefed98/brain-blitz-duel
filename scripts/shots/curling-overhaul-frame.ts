/**
 * Curl Champ's overhaul frames (a design tool, not a check): draws curlRev 4 play frames through the real renderer with
 * the rendered images handed in (the arena, the stones, the Captain), as the phone draws them once loaded.
 *
 *   bun scripts/shots/curling-overhaul-frame.ts [--out=<dir>] [--fallback]
 *
 * Writes play-aim.png (aiming, the Captain beside the stone), play-travel.png (a stone running, brushing) and
 * play-house.png (late in the run, stones in the house), 390 × 640 at 2×. --fallback draws without the images.
 */
import { createCanvas, loadImage, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
(globalThis as unknown as { document: unknown }).document = { createElement: () => createCanvas(1, 1) };
const { CURL_AIM, CURL_TRAVEL, CURLING_REV, CURLING_W, curlingGameFor, curlingWorldHFor, curlAimPath, curlDrawZone } = await import("../../src/lib/arcade/curling");
const { drawCurling, curlingScene } = await import("../../src/lib/arcade/curling.renderer");
const { setSportsSpriteForShots } = await import("../../src/lib/arcade/sportsSprites");
const { witnessRaw } = await import("../curling-bank");

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/curling-overhaul";
mkdirSync(out, { recursive: true });
if (!process.argv.includes("--fallback")) {
  for (const n of ["arena", "stone-gold", "stone-red", "slide", "release"]) {
    const img = await loadImage(readFileSync(join("public/sports/curling", `${n}.webp`)));
    setSportsSpriteForShots("curling", n, img);
  }
}
const witnesses = JSON.parse(readFileSync("scripts/fixtures/curling-witness-v4.json", "utf8")) as { seed: number; throws: number[][] }[];
const w = witnesses[3]!;
const raw = witnessRaw(w as never, CURLING_REV);
const events = new Map<number, unknown>();
for (const part of raw.split("|")[2]!.split(",").filter(Boolean)) {
  const [t, k, a, b, c, d] = part.split(":").map(Number);
  events.set(t!, { t, k, a, b, c, d: d ?? 0 });
}
const game = curlingGameFor(CURLING_REV);
const H = curlingWorldHFor(CURLING_REV);
let s = game.init(w.seed);
const shots: { name: string; when: (st: typeof s) => boolean }[] = [
  { name: "play-aim", when: (st) => st.phase === CURL_AIM && st.thrown === 2 && st.tick > 20 },
  { name: "play-travel", when: (st) => st.phase === CURL_TRAVEL && st.thrown === 5 && st.travelTicks === 70 },
  { name: "play-house", when: (st) => st.phase === CURL_AIM && st.thrown === 7 && st.tick > 20 },
];
const done = new Set<string>();
while (!game.isOver(s) && done.size < shots.length) {
  s = game.step(s, (events.get(s.tick + 1) ?? null) as never);
  for (const sh of shots) {
    if (done.has(sh.name) || !sh.when(s)) continue;
    done.add(sh.name);
    const n = Math.min(s.thrown, 7);
    const th = w.throws[n]!;
    const aim = { broomX: th[1]!, broomY: th[2]!, startX: th[0]!, turn: th[4]!, swipe: null, keyWeight: th[3]!, zone: curlDrawZone(th[0]!, th[1]!, th[2]!, th[4]!, CURLING_REV), path: null as unknown, lastRelease: null };
    if (s.phase === CURL_AIM) aim.path = curlAimPath(s, th[0]!, th[1]!, th[2]!, aim.zone?.tee ?? 316, th[4]!);
    const c = createCanvas(CURLING_W * 2, H * 2);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.scale(2, 2);
    curlingScene(ctx, { worldW: CURLING_W, worldH: H, left: 0, right: CURLING_W, top: 0, bottom: H, scale: 2, boxTop: 0 } as never, CURLING_REV);
    drawCurling(ctx, s, aim as never);
    writeFileSync(join(out, `${sh.name}.png`), c.toBuffer("image/png"));
    console.log(`  ${sh.name}.png (tick ${s.tick})`);
  }
}
