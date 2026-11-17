/**
 * Apex's overhaul review images (the Sports overhaul, 15 Nov 2026; a tool, not a check): each of racingRev 4's three
 * circuits from above with a run's marks (the reveal's run map: a good bot's run, so the grass and wall marks show), and
 * the chase view mid-race on each with the rendered car (the sprites handed in from public/sports/racing), at 2×.
 *
 *   bun scripts/shots/apex-overhaul-shots.ts <out dir> [--level=good] [--t=1500]
 */
import { createCanvas, loadImage, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { mkdirSync } from "node:fs";

(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = class {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, w), Math.max(1, h));
  }
};

const { setSportsSpriteForShots } = await import("../../src/lib/arcade/sportsSprites");
const { RACING_CAR_SPRITE_NAMES } = await import("../../src/lib/arcade/racingCar.renderer");
const { drawRacingPlay } = await import("../../src/lib/arcade/racing.renderer");
const R = await import("../../src/lib/arcade/racing");
const { racingRunMoments } = await import("../../src/lib/arcade/racingMap");
const { drawRacingRunMap } = await import("../../src/lib/arcade/racingMap.renderer");
const { bot } = await import("../arcade-skill-bands/bots/racing");
const { Human } = await import("../arcade-skill-bands/human");

const out = process.argv[2] ?? ".shots/apex";
const level = (process.argv.find((a) => a.startsWith("--level="))?.slice(8) ?? "good") as "good";
const at = Number(process.argv.find((a) => a.startsWith("--t="))?.slice(4) ?? 1500);
mkdirSync(out, { recursive: true });
for (const n of RACING_CAR_SPRITE_NAMES) setSportsSpriteForShots("racing", n, await loadImage(`public/sports/racing/${n}.webp`));

const game = R.racingGameFor(R.RACING_REV_4);
for (let c = 0; c < R.RACING_CIRCUITS.length; c++) {
  const seed = c + 3 * 1000;
  const human = new Human("racing", seed, level);
  const events = bot({ game, seed, rev: R.RACING_REV_4, human } as never).events ?? [];
  const run = racingRunMoments(seed, R.RACING_REV_4, events);
  const track = R.racingTrackFor(seed, R.RACING_REV_4);
  const size = 600;
  const map = createCanvas(size, size);
  const mctx = map.getContext("2d") as unknown as CanvasRenderingContext2D;
  mctx.fillStyle = "#151319";
  mctx.fillRect(0, 0, size, size);
  drawRacingRunMap(mctx, track, run, 0, 0, size);
  const id = R.RACING_CIRCUITS[c]!.id;
  await Bun.write(`${out}/circuit-${id}.png`, map.toBuffer("image/png"));
  // The chase view mid-race (the oracle's line, so the car is on the racing line at speed).
  const { racingDrive, ORACLE_TUNING } = await import("../racing-oracle");
  const log = racingDrive(seed, ORACLE_TUNING, 1, R.RACING_REV_4).events;
  const byTick = new Map(log.map((e) => [e.t, e]));
  let st = game.init(seed);
  while (st.tick < at) st = game.step(st, byTick.get(st.tick + 1) ?? null);
  const view = createCanvas(R.RACING_WORLD_W * 2, R.RACING_WORLD_H * 2);
  const vctx = view.getContext("2d") as unknown as CanvasRenderingContext2D;
  vctx.scale(2, 2);
  drawRacingPlay(vctx, st, { width: R.RACING_WORLD_W, height: R.RACING_WORLD_H } as never);
  await Bun.write(`${out}/play-${id}.png`, view.toBuffer("image/png"));
  console.log(`${id}: ${level} run ${run.clean}/8 clean, ${run.offs.length} off, ${run.walls.length} walls, pace ${run.pace10 / 10}`);
}
