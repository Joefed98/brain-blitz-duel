/**
 * Iron Wall's stage-2 review frames (Action overhaul, 15 Nov 2026; a tool, not a check): the game's own art drawn with
 * @napi-rs/canvas on recorded runs (scripts/fixtures/bastion-overhaul-rev3.json) at the moments each effect plays, the
 * end card, and the reveal's picture of a run.
 *
 *   bun scripts/shots/bastion-fx-shots.ts [--out=<dir>]    # default .shots/bastion-fx
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";

import { bastionIronGame, BT2_WORLD_H, BT2_WORLD_W, type BastionTankState } from "../../src/lib/arcade/bastionTank";
import { bastionIronArtGame, bastionSummaryHeight, BT_SUMMARY_W, observeRun, paintBastionSummary, setBastionEndClock } from "../../src/lib/arcade/bastionTank.renderer";
import { decodeBastionTankRun } from "../../src/lib/duel/bastion";
import { bastionSummaryOf } from "../../src/puzzles/bastion";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/bastion-fx";
mkdirSync(out, { recursive: true });
const W = BT2_WORLD_W;
const H = BT2_WORLD_H;
const S = 2;

type Run = { seed: number; raw: string; score: number };
const runs = (JSON.parse(readFileSync(new URL("../fixtures/bastion-overhaul-rev3.json", import.meta.url), "utf8")) as { runs: Run[] }).runs;

/** Plays a run on one canvas frame by frame (so the art's memory builds as live), calling `at` on every tick. */
export function playRun(run: Run, at: (state: BastionTankState, draw: () => Buffer) => boolean | void, clock?: () => number): void {
  const events = new Map(decodeBastionTankRun(run.raw).events.map((e) => [e.t, e]));
  const c = createCanvas(W * S, H * S);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  if (clock) setBastionEndClock(clock);
  let s = bastionIronGame.init(run.seed);
  const draw = () => {
    ctx.setTransform(S, 0, 0, S, 0, 0);
    bastionIronArtGame.draw(ctx, s, { width: W, height: H });
    return c.toBuffer("image/png");
  };
  draw();
  for (let t = 1; t <= bastionIronGame.runTicks; t++) {
    s = bastionIronGame.step(s, events.get(t) ?? null);
    // The art's memory, as a live frame builds it (cheap; the full frame is drawn only when asked for).
    observeRun(ctx, s);
    if (at(s, draw) === true) break;
    if (bastionIronGame.isOver(s)) break;
  }
  setBastionEndClock(null);
}

if (import.meta.main) {
  const best = [...runs].sort((a, b) => b.score - a.score)[0]!;
  const mid = [...runs].sort((a, b) => a.score - b.score)[Math.floor(runs.length / 2)]!;
  const want: Record<string, (p: BastionTankState, s: BastionTankState) => boolean> = {
    fire: (p, s) => s.shots > p.shots,
    flight: (p, s) => s.shells.length > 0 && s.shells.some((sh) => s.tick - sh.from === Math.floor((sh.at - sh.from) * 0.6) && sh.y > 300),
    weak: (p, s) => s.impacts.some((m) => m.r === 2 && s.tick - m.t === 3),
    kill: (p, s) => s.impacts.some((m) => m.r >= 3 && s.tick - m.t === 10),
    near: (p, s) => s.impacts.some((m) => m.r === 0 && m.y > 300 && s.tick - m.t === 8),
    fast: (p, s) => s.reloadAt < 0 && s.reloadTap === 1 && s.tick - s.reloadEnd === 9,
    jam: (p, s) => s.jams > p.jams,
    crack: (p, s) => s.breached > p.breached,
  };
  const done = new Set<string>();
  for (const run of [best, mid, ...runs]) {
    let prev: BastionTankState | null = null;
    playRun(run, (s, draw) => {
      if (prev)
        for (const [name, test] of Object.entries(want))
          if (!done.has(name) && test(prev, s)) {
            // A few ticks on for the fire, jam and crack moments so their effect shows.
            done.add(name);
            writeFileSync(`${out}/${name}.png`, draw());
          }
      prev = s;
      return done.size === Object.keys(want).length;
    });
    if (done.size === Object.keys(want).length) break;
  }
  // The end card, part way through its tally and complete.
  for (const [name, ms] of [["end-tally", 520], ["end-held", 1500]] as const) {
    let now = 0;
    playRun(best, (s, draw) => {
      if (s.ended !== 0) {
        now = ms;
        writeFileSync(`${out}/${name}.png`, draw());
        return true;
      }
    }, () => now);
  }
  // The reveal's picture of the best and the middle run.
  for (const [name, run] of [["summary-best", best], ["summary-mid", mid]] as const) {
    const sum = bastionSummaryOf(run.seed, run.raw, 3);
    const h = bastionSummaryHeight(3);
    const c = createCanvas(BT_SUMMARY_W * S, h * S);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "#2A1F1A";
    ctx.fillRect(0, 0, BT_SUMMARY_W * S, h * S);
    ctx.scale(S, S);
    paintBastionSummary(ctx, sum.data);
    writeFileSync(`${out}/${name}.png`, c.toBuffer("image/png"));
    console.log(name, run.score, JSON.stringify({ hp: sum.destroyedHp, weak: sum.weak, fast: sum.fast, drones: sum.drones }));
  }
  console.log(`frames in ${out}: ${[...done].join(", ")}`);
}
