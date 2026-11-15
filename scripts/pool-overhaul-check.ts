/**
 * pool-overhaul-check (the Sports overhaul, phase 2 step 4: Cue Ball; display only, no stamp): the new look's rules.
 *
 *  1. The Captain's arm (public/sports/pool/arm.webp, poolArmPlacement) never reaches the cue ball, the aim ahead of it,
 *     the ghost ball or the target: for every cue-ball spot on a grid, 72 aims and pulls 0 / 0.5 / 1, the whole arm
 *     (hand to shoulder, its drawn half-width) lies behind the cue ball and clear of it.
 *  2. The black's lock (poolBlackStatus) is "locked" exactly while fewer than seven of the set are down and the black
 *     is up, on every tick of every stored run; the drawn frame shows the lock badge only then and the gold ring only
 *     once the seven are down.
 *  3. The reveal's run events (poolRunEvents) agree with the server's replay (replayPoolRun) on every stored run:
 *     fouls, scratches, the set's balls potted, the best streak, the black, the clear time and the final state.
 *  4. Stored runs replay to the score and final state recorded on main (pool-check's fixtures, poolRev 2–4).
 *  5. The summary draws, its stat labels are plain (no "×"), the rendered table (public/sports/pool/table.webp) sits
 *     on the sim's table, and Cue Ball's new images stay under 400 KB.
 *
 *   bun scripts/pool-overhaul-check.ts      (~5 s, no browser)
 */
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { readdirSync, readFileSync, statSync } from "node:fs";

(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;

const { poolArmPlacement, poolBlackStatus, drawPool, POOL_BALL_DRAW_R, POOL_BLACK_LOCKED_ALPHA } = await import("../src/lib/arcade/pool.renderer");
const { poolCheckpoint, poolGameFor, POOL_BLACK, POOL_CB, POOL_CL, POOL_CR, POOL_CT, POOL_SPOTS } = await import("../src/lib/arcade/pool");
const { replayPoolRun } = await import("../src/lib/duel/pool");
const { poolRunEvents } = await import("../src/lib/arcade/poolRunEvents");
const { drawPoolSummary, poolSummaryHeight } = await import("../src/lib/arcade/poolSummary.renderer");
const { poolSummaryStats } = await import("../src/components/duel/summaries/PoolSummary");
const { decodeSportsRun } = await import("../src/lib/arcade/sportsKit");
const { checkInputEvents } = await import("../src/lib/arcade/engine");

// The witnesses carry no checkpoints, so the replay logs a desync note for each: not this check's subject.
console.error = () => {};
let passes = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) {
    passes++;
    console.log(`  ok ${msg}`);
  } else {
    failures.push(msg);
    console.log(`  FAIL ${msg}`);
  }
}

/* 1. The arm stays behind the cue ball. */
{
  let cases = 0;
  let bad = 0;
  let nearest = Infinity;
  for (let gx = POOL_CL + 10; gx <= POOL_CR - 10; gx += 40) {
    for (let gy = POOL_CT + 10; gy <= POOL_CB - 10; gy += 60) {
      for (let a = 0; a < 72; a++) {
        const ang = (a / 72) * Math.PI * 2;
        const ux = Math.cos(ang);
        const uy = Math.sin(ang);
        for (const pull of [0, 0.5, 1]) {
          cases++;
          const p = poolArmPlacement(gx, gy, ux, uy, pull);
          // Sample the arm's axis and its two edges; every point must be behind the cue ball (negative along the aim)
          // and clear of the ball's drawn radius plus a gap.
          const nx = -(p.sy - p.hy);
          const ny = p.sx - p.hx;
          const nl = Math.hypot(nx, ny) || 1;
          let wrong = false;
          for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            for (const e of [-1, 0, 1]) {
              const x = p.hx + (p.sx - p.hx) * t + (nx / nl) * p.halfW * e;
              const y = p.hy + (p.sy - p.hy) * t + (ny / nl) * p.halfW * e;
              const along = (x - gx) * ux + (y - gy) * uy;
              const d = Math.hypot(x - gx, y - gy);
              nearest = Math.min(nearest, d);
              if (along > -POOL_BALL_DRAW_R || d < POOL_BALL_DRAW_R + 120) wrong = true;
            }
          }
          if (wrong) bad++;
        }
      }
    }
  }
  ok(bad === 0, `the Captain's arm stays behind the cue ball and over 120 px clear of it in all ${cases} aims and pulls (nearest ${nearest.toFixed(0)} px)`);
}

/* 2. The black's lock follows the rule on every tick of stored runs. */
type LegacyRun = { type: string; rev: number; seed: number; label: string; raw: string; score: number; checksum: number; tick: number };
const nov3 = (JSON.parse(readFileSync(new URL("./fixtures/sports-nov3-legacy.json", import.meta.url), "utf8")) as { runs: LegacyRun[] }).runs.filter((r) => r.type === "pool");
const nov1 = (JSON.parse(readFileSync(new URL("./fixtures/tuning-nov1-legacy.json", import.meta.url), "utf8")) as { runs: LegacyRun[] }).runs.filter((r) => r.type === "pool");
const witnessV4 = JSON.parse(readFileSync(new URL("./fixtures/pool-witness-v4.json", import.meta.url), "utf8")) as Record<string, string>;
const v4Runs = Object.entries(witnessV4)
  .slice(0, 20)
  .map(([seed, raw]) => ({ rev: 4, seed: Number(seed), raw, label: "witness" }));
const allRuns: { rev: number; seed: number; raw: string; label: string }[] = [...nov3, ...nov1, ...v4Runs];
{
  let ticks = 0;
  let wrong = 0;
  let sawOpen = 0;
  let sawLocked = 0;
  for (const run of allRuns) {
    const game = poolGameFor(run.rev);
    const dec = decodeSportsRun(run.raw, game.runTicks);
    const events = new Map(checkInputEvents(dec.events, game.runTicks, game.inputRanges ?? []).events.map((e) => [e.t, e]));
    let s = game.init(run.seed);
    for (let t = 1; t <= game.runTicks; t++) {
      s = game.step(s, events.get(t) ?? null);
      ticks++;
      const want = s.black === 1 ? "down" : s.black === 2 ? "early" : s.spotsDown < POOL_SPOTS ? "locked" : "open";
      const got = poolBlackStatus(s);
      if (got !== want) wrong++;
      if (got === "open") sawOpen++;
      if (got === "locked") sawLocked++;
      if (game.isOver(s)) break;
    }
  }
  ok(wrong === 0 && sawOpen > 0 && sawLocked > 0, `the black's lock is shown exactly while fewer than seven are down (${ticks} ticks of ${allRuns.length} runs; locked ${sawLocked}, open ${sawOpen})`);
  // Drawn: the lock badge's gold sits up and right of a locked black, absent once it is open.
  const game = poolGameFor(4);
  const base = game.init(v4Runs[0]!.seed);
  const black = base.balls.find((b) => b.id === POOL_BLACK)!;
  const bx = black.x / 256 + POOL_BALL_DRAW_R * 0.85;
  const by = black.y / 256 - POOL_BALL_DRAW_R * 0.85;
  const goldAt = (s: typeof base, x: number, y: number): boolean => {
    const c = createCanvas(390 * 2, 740 * 2);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.scale(2, 2);
    drawPool(ctx, s, null);
    const d = c.getContext("2d").getImageData(Math.round(x * 2) - 3, Math.round(y * 2) - 3, 7, 7).data;
    let gold = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i]! > 200 && d[i + 1]! > 160 && d[i + 2]! < 140) gold++;
    return gold > 0;
  };
  const locked = { ...base, shots: 1, spotsDown: 3 };
  const open = { ...base, shots: 1, spotsDown: POOL_SPOTS };
  // The badge's dark disc, away from where an open black's ring passes: dark when locked, the felt's green when open.
  const pixel = (s: typeof base, x: number, y: number): number[] => {
    const c = createCanvas(390 * 2, 740 * 2);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.scale(2, 2);
    drawPool(ctx, s, null);
    return [...c.getContext("2d").getImageData(Math.round(x * 2), Math.round(y * 2), 1, 1).data];
  };
  const discL = pixel(locked, bx + 3, by - 3);
  const discO = pixel(open, bx + 3, by - 3);
  const dark = (p: number[]) => p[0]! < 40 && p[1]! < 40 && p[2]! < 40;
  const felt = (p: number[]) => p[1]! > p[0]! + 15 && p[1]! > 50;
  ok(goldAt(locked, bx, by + 1.6) && dark(discL) && felt(discO), `a locked black is drawn with its lock badge (${discL.slice(0, 3)}); an open black has none (${discO.slice(0, 3)})`);
  const ringX = black.x / 256 + POOL_BALL_DRAW_R + 2.2;
  ok(goldAt(open, ringX, black.y / 256) && !goldAt(locked, ringX, black.y / 256), "an open black is drawn with its gold ring; a locked black has none");
  ok(POOL_BLACK_LOCKED_ALPHA > 0.3 && POOL_BLACK_LOCKED_ALPHA < 0.8, `a locked black stays visible, dimmed to ${POOL_BLACK_LOCKED_ALPHA}`);
}

/* 3 and 4. Run events against the server's replay; stored runs score as recorded. */
{
  let same = 0;
  let agree = 0;
  const notes: string[] = [];
  for (const run of allRuns) {
    const r = replayPoolRun(run.seed, run.raw, run.rev);
    const ev = poolRunEvents(run.seed, run.raw, run.rev);
    const legacy = run as Partial<LegacyRun>;
    if (legacy.score === undefined || (r.score === legacy.score && poolCheckpoint(r.state).checksum === legacy.checksum && r.state.tick === legacy.tick)) same++;
    else notes.push(`replay ${run.rev}/${run.seed} ${run.label}: ${r.score} (main ${legacy.score})`);
    const mineSet = ev.pots.filter((p) => p.mine && p.id !== POOL_BLACK).length;
    const checks = [
      ev.fouls.length === r.fouls,
      ev.scratches.length === r.scratches,
      ev.spots === r.spots && mineSet === r.spots,
      ev.streakBest === r.streakBest,
      (ev.black === "down") === r.black && (ev.black === "early") === r.blackEarly,
      ev.shots === r.shots,
      poolCheckpoint(ev.state).checksum === poolCheckpoint(r.state).checksum && ev.state.tick === r.state.tick,
      ev.black !== "down" || (ev.clearedAt !== null && ev.clearedAt > 0),
    ];
    if (checks.every(Boolean)) agree++;
    else notes.push(`events ${run.rev}/${run.seed} ${run.label}: ${checks.map((c) => (c ? 1 : 0)).join("")}`);
  }
  for (const n of notes.slice(0, 8)) console.log(`    ${n}`);
  const fouls = allRuns.reduce((a, run) => a + poolRunEvents(run.seed, run.raw, run.rev).fouls.length, 0);
  ok(agree === allRuns.length && fouls > 0, `the reveal's run events match the server's replay on all ${allRuns.length} stored runs (${fouls} fouls among them)`);
  ok(same === allRuns.length, `all ${allRuns.length} stored runs (poolRev 2–4) replay to their recorded score and final state`);
}

/* 5. The summary draws; its labels are plain; the images' budget. */
{
  let drawn = 0;
  let plain = true;
  for (const run of allRuns.slice(0, 12)) {
    const ev = poolRunEvents(run.seed, run.raw, run.rev);
    const w = 360;
    const h = poolSummaryHeight(w);
    const c = createCanvas(w, h);
    drawPoolSummary(c.getContext("2d") as unknown as CanvasRenderingContext2D, w, h, ev);
    const d = c.getContext("2d").getImageData(0, 0, w, h).data;
    let painted = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) painted++;
    if (painted > w * h * 0.5) drawn++;
    for (const s of poolSummaryStats(ev, run.rev)) if (/×|\bx\d/.test(`${s.label} ${s.value}`)) plain = false;
  }
  ok(drawn === 12, `the reveal's table summary draws the table for every run (${drawn} of 12)`);
  ok(plain, "the summary's stat labels and values are plain words (no ×)");
  // The rendered table sits exactly on the sim's table: every pocket's centre is dark, the cloth's middle is felt, and
  // the rails' outer edge is where the painted table draws it (opaque just inside, clear just outside).
  {
    const { loadImage } = await import("@napi-rs/canvas");
    const { POOL_POCKETS, POOL_RAIL, POOL_W, POOL_H } = await import("../src/lib/arcade/pool");
    const img = await loadImage(new URL("../public/sports/pool/table.webp", import.meta.url).pathname);
    const k = img.width / POOL_W;
    const c = createCanvas(img.width, img.height);
    const cx = c.getContext("2d");
    cx.drawImage(img, 0, 0);
    const at = (x: number, y: number) => [...cx.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data];
    const holes = POOL_POCKETS.every((p) => {
      const q = at(p.x / 256 + (p.corner ? 0 : p.x < POOL_W * 128 ? -p.r / 512 : p.r / 512), p.y / 256);
      // Dark: the leather-lined hole (about 50 a channel), well under the lit walnut (77+) and the felt.
      return q[3]! > 200 && q[0]! < 64 && q[1]! < 64 && q[2]! < 64;
    });
    const mid = at(POOL_W / 2, POOL_H / 2);
    const edgeIn = at(POOL_CL - POOL_RAIL + 1.5, POOL_H / 2);
    const edgeOut = at(POOL_CL - POOL_RAIL - 1.5, POOL_H / 2);
    ok(
      img.width === POOL_W * 3 && img.height === POOL_H * 3 && holes && mid[1]! > mid[0]! + 15 && edgeIn[3]! > 200 && edgeOut[3]! < 40,
      `the rendered table (${img.width}×${img.height}) sits on the sim's table: pockets dark, felt in the middle, the rails' edge in place`,
    );
  }
  const dir = new URL("../public/sports/pool/", import.meta.url).pathname;
  const kb = readdirSync(dir).reduce((a, f) => a + statSync(dir + f).size, 0) / 1024;
  ok(kb < 400, `Cue Ball's new images total ${kb.toFixed(1)} KB (budget 400 KB)`);
}

if (failures.length) {
  console.log(`FAIL pool-overhaul-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`PASS pool-overhaul-check: ${passes} checks`);
