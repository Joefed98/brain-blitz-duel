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
const { drawPoolSummary, poolSummaryHeight, poolSummarySizes } = await import("../src/lib/arcade/poolSummary.renderer");
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
  // The table spans the reveal column's whole width (opaque at both side edges, half way down), at least 200 px tall at
  // a 390 px phone's column, with pots, numbers and foul marks at least 1.6× the table's own ball size.
  {
    const w = 358;
    const h = poolSummaryHeight(w);
    const c = createCanvas(w, h);
    drawPoolSummary(c.getContext("2d") as unknown as CanvasRenderingContext2D, w, h, poolRunEvents(allRuns[0]!.seed, allRuns[0]!.raw, allRuns[0]!.rev));
    const alpha = (x: number) => c.getContext("2d").getImageData(x, Math.round(h / 2), 1, 1).data[3]!;
    const z = poolSummarySizes(w);
    ok(alpha(1) > 200 && alpha(w - 2) > 200 && h >= 200, `the summary's table fills the column's width (${w} px) and is ${h} px tall`);
    ok(z.potR >= 1.6 * z.tableBallR && z.numberR * 2 >= 1.6 * z.tableBallR && z.foulR >= 1.6 * z.tableBallR, `pots (r ${z.potR.toFixed(1)}), order numbers (r ${z.numberR.toFixed(1)}) and foul marks (r ${z.foulR.toFixed(1)}) are at least 1.6× the table's balls (r ${z.tableBallR.toFixed(1)})`);
  }
  {
    const ev = poolRunEvents(allRuns[0]!.seed, allRuns[0]!.raw, allRuns[0]!.rev);
    const fouls = poolSummaryStats({ ...ev, fouls: [] }, 4).find((s) => s.label === "Fouls")?.value;
    const streak = poolSummaryStats({ ...ev, streakBest: 3 }, 4).find((s) => s.label === "Best streak")?.value;
    ok(fouls === "0" && streak === "3 pots", `the tiles read "Fouls ${fouls}" and "Best streak ${streak}"`);
  }
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

/*
 * 6. Stage 2's effects (display only; poolFx.ts and pool.renderer.ts). Every effect is read off the sim's own state:
 *    a. the preview's side-spin bend turns the way the sim turns the cue ball at a cushion, by about as much;
 *    b. the contact flash shows at the meeting point on (nearly) every ball-on-ball tick, and only within its ticks;
 *    c. a jaw rattle is detected only on a tick a cushion or jaw was struck, for a ball on the table at a jaw;
 *    d. a potted ball of the set flies to the rack exactly after its drop, and lights the rack on landing; no other
 *       ball flies;
 *    e. "FOUL −10" sits inside the table, beside the cue ball, for exactly its ticks after a foul;
 *    f. under reduced motion no transient flourish is drawn (the thrust, the puff, the flash, the flight);
 *    g. drawing a state never changes it, so the sim is identical with the effects on and off;
 *    h. the reveal's pots land one by one and end on the final table; none move under reduced motion or calm;
 *    i. the success layer's streak sits by the rack, and CLEARED! carries the clear's time.
 */
{
  const fx = await import("../src/lib/arcade/poolFx");
  const R = await import("../src/lib/arcade/pool.renderer");
  const P = await import("../src/lib/arcade/pool");
  const { POOL_FX } = await import("../src/lib/arcade/sportsFx.renderer");
  const { poolLandingPlan, poolLandingAt } = await import("../src/components/duel/summaries/PoolSummary");

  // a. Side spin against the sim: a lone cue ball shot into the right cushion with no side, then with ±side.
  {
    const angleAfterBounce = (side: number, rev: number): number | null => {
      const game = P.poolGameFor(rev);
      let s = game.init(v4Runs[0]!.seed);
      s = { ...s, balls: s.balls.map((b) => (b.id === P.POOL_CUE ? { ...b, x: 150 * 256, y: 380 * 256, vx: 0, vy: 0 } : { ...b, down: 1 })) };
      const shot = { t: s.tick + 1, k: P.POOL_INPUT_SHOT, a: 4096, b: 900, ...P.poolShot2(600, side, 0) };
      let prevVx = 0;
      for (let t = 0; t < 400; t++) {
        const before = s.balls.find((b) => b.id === P.POOL_CUE)!;
        prevVx = before.vx;
        s = game.step(s, t === 0 ? (shot as never) : null);
        const cue = s.balls.find((b) => b.id === P.POOL_CUE)!;
        if (prevVx > 0 && cue.vx < 0) return Math.atan2(cue.vy, cue.vx);
      }
      return null;
    };
    let right = 0;
    let cases = 0;
    const notes: string[] = [];
    for (const rev of [2, 3, 4]) {
      const plain = angleAfterBounce(0, rev);
      for (const side of [-100, -50, 50, 100]) {
        cases++;
        const spun = angleAfterBounce(side, rev);
        if (plain === null || spun === null) continue;
        const simTurn = spun - plain;
        const bent = fx.poolSideBend(Math.cos(plain), Math.sin(plain), side, rev);
        const shownTurn = Math.atan2(bent.vy, bent.vx) - plain;
        const close = Math.sign(simTurn) === Math.sign(shownTurn) && Math.abs(shownTurn - simTurn) <= Math.abs(simTurn) * 0.35 + 0.01;
        if (close) right++;
        else notes.push(`rev ${rev} side ${side}: sim ${simTurn.toFixed(3)} rad, preview ${shownTurn.toFixed(3)} rad`);
      }
    }
    for (const n of notes.slice(0, 4)) console.log(`    ${n}`);
    ok(right === cases, `the preview's side-spin bend turns the sim's way by about the sim's amount at a cushion (${right} of ${cases}: poolRev 2–4, four sides)`);
    // The preview draws the spun bounce (gold) only with side on the dot.
    const game = P.poolGameFor(4);
    const s0 = game.init(v4Runs[0]!.seed);
    const cue = s0.balls.find((b) => b.id === P.POOL_CUE)!;
    const drawAimAt = (spinX: number) => {
      const c = createCanvas(390, 740);
      R.drawPool(c.getContext("2d") as unknown as CanvasRenderingContext2D, s0, { dx: 1, dy: 0.15, power: 0.5, spinX, spinY: 0 });
      return c.getContext("2d").getImageData(0, 0, 390, 740).data;
    };
    const plain = drawAimAt(0);
    const spun = drawAimAt(80);
    let diff = 0;
    for (let i = 0; i < plain.length; i += 4) if (Math.abs(plain[i]! - spun[i]!) > 30) diff++;
    ok(diff > 20 && R.poolAimSide({ spinX: 80 }, 4) === 80 && R.poolAimSide({ spinX: 80 }, 1) === 2, `side on the dot draws the spun bounce (${diff} px differ from no side; cue at ${(cue.x / 256).toFixed(0)}, ${(cue.y / 256).toFixed(0)})`);
  }

  // Every tick of the stored runs, through the sim, for b–e.
  let hitTicks = 0;
  let flashed = 0;
  let flashOutside = 0;
  let jawSeen = 0;
  let jawWrong = 0;
  let flightsWrong = 0;
  let flightsSeen = 0;
  let foulWrong = 0;
  let foulSeen = 0;
  let mutated = 0;
  for (const run of allRuns) {
    const game = P.poolGameFor(run.rev);
    const dec = decodeSportsRun(run.raw, game.runTicks);
    const events = new Map(checkInputEvents(dec.events, game.runTicks, game.inputRanges ?? []).events.map((e) => [e.t, e]));
    let s = game.init(run.seed);
    for (let t = 1; t <= game.runTicks; t++) {
      s = game.step(s, events.get(t) ?? null);
      // b. The flash.
      const c = fx.poolContactPoint(s);
      if (s.hitTick === s.tick && s.hits > 0) {
        hitTicks++;
        if (c) flashed++;
      }
      if (c && (s.tick - s.hitTick >= fx.POOL_FX_FLASH_TICKS || s.tick < s.hitTick)) flashOutside++;
      // c. The jaw.
      const jaw = fx.poolJawContact(s);
      if (jaw !== null) {
        jawSeen++;
        const b = s.balls.find((x) => x.id === jaw)!;
        if (s.cushionTick !== s.tick || b.down) jawWrong++;
      }
      // d. Flights: exactly in their window, the set's balls only, and the rack lit from landing.
      for (const b of s.balls) {
        const f = fx.poolFlight(s, b);
        if (f !== null) flightsSeen++;
        if (b.downAt === undefined || !b.down) {
          if (f !== null) flightsWrong++;
          continue;
        }
        const age = s.tick - b.downAt - fx.POOL_FX_DROP_TICKS;
        const inWindow = age >= 0 && age < fx.POOL_FX_FLIGHT_TICKS;
        const flies = b.id >= 1 && b.id <= P.POOL_SPOTS;
        if ((f !== null) !== (inWindow && flies)) flightsWrong++;
        if (flies && fx.poolInRack(s, b) !== (age >= fx.POOL_FX_FLIGHT_TICKS || s.over === 1)) flightsWrong++;
      }
      // e. The foul label.
      const lab = fx.poolFoulLabel(s);
      const cue = s.balls.find((b) => b.id === P.POOL_CUE && !b.down);
      const live = s.fouls > 0 && s.tick - s.foulTick < fx.POOL_FX_FOUL_TICKS && !!cue;
      if (lab) {
        foulSeen++;
        const inside = lab.x - 37 >= P.POOL_CL && lab.x + 37 <= P.POOL_CR && lab.y - 10 >= P.POOL_CT && lab.y + 10 <= P.POOL_CB;
        const near = cue ? Math.hypot(lab.x - cue.x / 256, lab.y - cue.y / 256) <= 55 : false;
        if (!inside || !near || !live || lab.text !== `FOUL −${P.POOL_FOUL_PTS}`) foulWrong++;
      } else if (live) foulWrong++;
      if (game.isOver(s)) break;
    }
    // g. Drawing never touches a state (a sample of ticks per run).
    let s2 = game.init(run.seed);
    for (let t = 1; t <= game.runTicks; t++) {
      s2 = game.step(s2, events.get(t) ?? null);
      if (t % 37 === 0) {
        const before = JSON.stringify(s2);
        const cv = createCanvas(390, 740);
        R.drawPool(cv.getContext("2d") as unknown as CanvasRenderingContext2D, s2, { dx: 0.6, dy: -0.8, power: 0.4, spinX: 40, spinY: 20 });
        if (JSON.stringify(s2) !== before) mutated++;
      }
      if (game.isOver(s2)) break;
    }
  }
  ok(hitTicks > 0 && flashed >= hitTicks * 0.9 && flashOutside === 0, `the contact flash shows on ${flashed} of ${hitTicks} ball-on-ball ticks and never outside its ${fx.POOL_FX_FLASH_TICKS} ticks`);
  ok(jawSeen > 0 && jawWrong === 0, `a jaw rattle is read only on a tick a cushion or jaw was struck, for a ball still on the table (${jawSeen} rattles)`);
  ok(flightsSeen > 0 && flightsWrong === 0, `potted balls of the set fly to the rack exactly after their drop and light it on landing; no other ball flies (${flightsSeen} flight frames)`);
  ok(foulSeen > 0 && foulWrong === 0, `"FOUL −${P.POOL_FOUL_PTS}" sits inside the table beside the cue ball for exactly its ticks after a foul (${foulSeen} frames)`);
  ok(mutated === 0, "drawing a state with every effect never changes it: the sim is identical with the effects on and off");

  // f. Reduced motion: a strike, a flash and a flight are drawn (full), and none of them under reduced motion.
  {
    const run = allRuns.find((r) => r.rev >= 2)!;
    const game = P.poolGameFor(run.rev);
    const dec = decodeSportsRun(run.raw, game.runTicks);
    const events = new Map(checkInputEvents(dec.events, game.runTicks, game.inputRanges ?? []).events.map((e) => [e.t, e]));
    let s = game.init(run.seed);
    let strike: typeof s | null = null;
    let flight: typeof s | null = null;
    for (let t = 1; t <= game.runTicks && (!strike || !flight); t++) {
      s = game.step(s, events.get(t) ?? null);
      if (!strike && fx.poolStrikePoint(s)?.age === 2) strike = s;
      if (!flight && s.balls.some((b) => (fx.poolFlight(s, b) ?? 0) > 0.4)) flight = s;
      if (game.isOver(s)) break;
    }
    const frame = (st: typeof s) => {
      const c = createCanvas(390, 740);
      R.drawPool(c.getContext("2d") as unknown as CanvasRenderingContext2D, st, null);
      return Buffer.from(c.getContext("2d").getImageData(0, 0, 390, 740).data).toString("base64");
    };
    // The same state with the effect's moment moved out of reach draws no flourish.
    const noStrike = (st: typeof s) => ({ ...st, shotTicks: 999 });
    const noFlight = (st: typeof s) => ({ ...st, over: 1 });
    const fullDiffers = !!strike && !!flight && frame(strike) !== frame(noStrike(strike)) && frame(flight) !== frame({ ...flight, balls: flight.balls.map((b) => (b.downAt !== undefined ? { ...b, downAt: -9999 } : b)) });
    (globalThis as unknown as { window: unknown }).window = { matchMedia: () => ({ matches: true }) };
    const stillSame = !!strike && frame(strike) === frame(noStrike(strike)) && !!flight && frame(flight) === frame({ ...flight, balls: flight.balls.map((b) => (b.downAt !== undefined ? { ...b, downAt: -9999 } : b)) });
    void noFlight;
    ok(fullDiffers && stillSame, "the strike's thrust and puff and the flight to the rack are drawn, and under reduced motion none of them is (the state drawn still)");
    delete (globalThis as unknown as { window?: unknown }).window;
  }

  // h. The reveal's pots land one by one and end on the final table; nothing moves under reduced motion or calm.
  {
    const plan = poolLandingPlan(5, "full")!;
    // Five pots, 140 ms apart, each landing over 260 ms: every sample until 820 ms is on its way, then it stops.
    const at = [0, 100, 300, 600, 800, 2000].map((ms) => poolLandingAt(plan, ms));
    const ordered = at.slice(0, -1).every((a, i) => i === 0 || (a !== null && at[i - 1] !== null && a.pots >= at[i - 1]!.pots));
    ok(
      poolLandingPlan(5, "reduced") === null && poolLandingPlan(5, "calm") === null && poolLandingPlan(0, "full") === null && poolLandingPlan(5, "lite")!.land < plan.land && ordered && at[5] === null,
      "the reveal's pots land in order and stop; reduced motion, celebrations off and a run with no pots draw the final table at once",
    );
    const ev = poolRunEvents(allRuns[0]!.seed, allRuns[0]!.raw, allRuns[0]!.rev);
    const w = 358;
    const h = poolSummaryHeight(w);
    const draw = (l?: { pots: number; land: number }) => {
      const c = createCanvas(w, h);
      drawPoolSummary(c.getContext("2d") as unknown as CanvasRenderingContext2D, w, h, ev, l);
      return Buffer.from(c.getContext("2d").getImageData(0, 0, w, h).data).toString("base64");
    };
    const last = Math.max(0, ev.pots.length - 1);
    ok(ev.pots.length > 0 && draw({ pots: last, land: 1 }) === draw() && draw({ pots: 0, land: 0 }) !== draw(), `the landing ends exactly on the final table (${ev.pots.length} pots)`);
  }

  // i. The success layer: the streak by the rack, CLEARED! with the time.
  {
    const combo = POOL_FX.events.find((e) => e.kind === "combo")!;
    const fin = POOL_FX.events.find((e) => e.kind === "final")!;
    const spot = combo.at!({} as never);
    const s = { ...poolGameFor(4).init(1), black: 1, finishAt: 2472 };
    ok(spot.y <= 80 && spot.x <= 200, `the streak's count pops by the rack (${spot.x}, ${spot.y}), not mid-table`);
    ok((fin.label as (s: unknown) => string)(s) === "CLEARED! 41.2 s", `the clear reads "${(fin.label as (s: unknown) => string)(s)}"`);
  }
}

if (failures.length) {
  console.log(`FAIL pool-overhaul-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`PASS pool-overhaul-check: ${passes} checks`);
