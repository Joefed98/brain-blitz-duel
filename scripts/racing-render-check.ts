/**
 * Apex's renderer saving (1 Nov 2026, the computer layout's 60 fps; display only): drawWorld no longer fills the near
 * grass's bands where the haze under the road is already exactly that colour (racing.renderer.ts HAZE_END). This
 * draws frames across whole races (six seeds, both revisions, steering, three world sizes, the play view and the
 * view beyond the world) with the saving on and off through @napi-rs/canvas and fails on any pixel that differs.
 *
 *   bun scripts/racing-render-check.ts
 *
 * Each revision draws in its own child process (`--rev=N`, 3 Nov 2026): @napi-rs/canvas's native memory grows by about
 * 4 GB a revision here and is only returned when the process exits, so with racingRev 3 added one process peaked at
 * ~12 GB and the CI runner was shut down mid-check. The frames, pixels and pass rule are unchanged.
 */
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

const REVS = [1, 2, 3];
const revArg = process.argv.find((a) => a.startsWith("--rev="));
if (!revArg) {
  let frames = 0;
  let differ = 0;
  for (const rev of REVS) {
    const child = Bun.spawnSync(["bun", import.meta.path, `--rev=${rev}`], { stdout: "pipe", stderr: "inherit" });
    const out = child.stdout.toString();
    for (const line of out.split("\n")) if (line.startsWith("  ")) console.log(line);
    const m = /^RESULT (\d+) (\d+)$/m.exec(out);
    if (child.exitCode !== 0 || !m) {
      console.log(`FAIL racing-render-check: racingRev ${rev} did not finish (exit ${child.exitCode})`);
      process.exit(1);
    }
    frames += Number(m[1]);
    differ += Number(m[2]);
  }
  if (differ) {
    console.log(`FAIL racing-render-check: ${differ} of ${frames} frames differ with the grass saving`);
    process.exit(1);
  }
  console.log(`PASS racing-render-check: ${frames} frames (world and beyond, 3 sizes, 6 seeds, racingRev 1, 2 and 3) identical with and without the grass saving`);
  process.exit(0);
}
const ONLY_REV = Number(revArg.slice(6));

(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
const R = await import("../src/lib/arcade/racing.renderer");
const { racingGameFor, RACING_WORLD_W, RACING_WORLD_H } = await import("../src/lib/arcade/racing");

const canvases = new Map<string, { c: ReturnType<typeof createCanvas>; b: ReturnType<typeof createCanvas> }>();
const pair = (w: number, h: number) => {
  const key = `${w}x${h}`;
  let p = canvases.get(key);
  if (!p) canvases.set(key, (p = { c: createCanvas(w, h), b: createCanvas(w * 2, h) }));
  return p;
};
let frames = 0;
let differ = 0;
const failures: string[] = [];
for (const rev of [ONLY_REV]) {
  for (const seed of [1, 7, 42, 256, 1234, 9001]) {
    const game = racingGameFor(rev);
    let s = game.init(seed) as Parameters<typeof R.drawRacingPlay>[1];
    for (let t = 0; t < 5700; t++) {
      const input = t >= 340 ? { t: s.tick + 1, k: 7, a: Math.round(40 * Math.sin(t / 90)), b: 0, c: 0, d: 0 } : null;
      s = game.step(s, input as never) as typeof s;
      if (t % 380 !== 0) continue;
      for (const [w, h] of [[335, 624], [430, 801], [538, 1003]] as const) {
        const draw = (skip: boolean) => {
          R.setRacingGrassSkip(skip);
          const { c, b } = pair(w, h);
          const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, w, h);
          ctx.scale(w / RACING_WORLD_W, h / RACING_WORLD_H);
          R.drawRacingPlay(ctx, s, { width: RACING_WORLD_W, height: RACING_WORLD_H });
          // The view beyond the world (the play screen's fill) on a wider canvas round it.
          const bctx = b.getContext("2d") as unknown as CanvasRenderingContext2D;
          bctx.setTransform(1, 0, 0, 1, 0, 0);
          bctx.clearRect(0, 0, w * 2, h);
          const k = w / RACING_WORLD_W;
          bctx.setTransform(k, 0, 0, k, w / 2, 0);
          R.racingAmbient.draw(bctx, { worldW: RACING_WORLD_W, worldH: RACING_WORLD_H, left: -RACING_WORLD_W / 2, right: RACING_WORLD_W * 1.5, top: 0, bottom: RACING_WORLD_H, scale: k, boxTop: 0 }, 0, false);
          return [c.getContext("2d").getImageData(0, 0, w, h).data, b.getContext("2d").getImageData(0, 0, w * 2, h).data];
        };
        draw(true); // warm the renderer's cached layers for this size, so both draws below use them
        const on = draw(true);
        const off = draw(false);
        frames += 2;
        for (const [i, a] of on.entries()) {
          const o = off[i]!;
          let n = 0;
          for (let j = 0; j < a.length; j++) if (a[j] !== o[j]) n++;
          if (n) {
            differ++;
            if (failures.length < 5) failures.push(`rev ${rev} seed ${seed} tick ${s.tick} ${w}x${h} ${i ? "beyond" : "world"}: ${n} channels differ`);
          }
        }
      }
    }
  }
}
R.setRacingGrassSkip(true);
for (const f of failures) console.log(`  ${f}`);
console.log(`RESULT ${frames} ${differ}`);
