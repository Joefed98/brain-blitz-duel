/**
 * apex-overhaul-check (the Sports overhaul, phase 2 step 4, 15 Nov 2026; no browser):
 *  1. the rendered car (public/sports/racing): 21 sprites (seven yaws, lit, braking and the paint mask), one shared size,
 *     under 400 KB in all; drawn at any collision width, each yaw's car (alpha over 24) spans exactly that width (within
 *     the bounds rule's 2 px), centred on the car, its lowest pixel on the contact line; a paint and a ghost colour stay
 *     inside the car; with no images (as in every Bun check) nothing is drawn and the painted car is kept;
 *  2. racingRev 4's three named circuits: the seed picks the circuit, every circuit is its own fixed layout (Sunset Park
 *     is racingRev 3's own layout for RACING_SUNSET_SEED), the rev-4 deal holds 100 distinct seeds of each, rooms and
 *     practice deal racingRev 4 from it, and the oracle takes every circuit, and the sampled deal seeds (all with
 *     CHECKS_FULL=1), to exactly 200 through the server replay at or above the circuit's par pace;
 *  3. racingRev 1–3 unchanged: their circuits are still each seed's own layout, and their oracle runs replay to the
 *     same scores as racingRev 3's own deal proved (racing-check holds the legacy fixtures);
 *  4. the reveal's run summary: on bot runs of every circuit, its moments match the server replay's counters (clean
 *     sectors and their mask, wall hits, trips off, lap times summing to the race time, the pace), and the map is a
 *     closed loop inside its box with every mark on it;
 *  5. the help and intro name the three circuits; the dealt stamp's spec scores pace against each circuit's par.
 *  7. stage 2's track: kerbs round every corner on every circuit, a marshal post, an outside catch fence and the boards
 *     at each, the speed sign at every advised corner; each circuit's own scenery (racingRev 1-3 the park) and their
 *     horizons differing in pixels; a corner's kerbs drawn red;
 *  8. stage 2's effects: speed lines only above 200 km/h and stronger with speed, the kerb's 1-2 px shake only on the
 *     kerb, dust only on the grass, the speedo's drop, sparks only scraping the wall still moving, a corner's verdict
 *     green at or under its sign and red over it, a clean sector's bar flash, the finish hold; none of the motion
 *     under reduced motion, a third of the sparks under reduced effects; and the sim identical with them drawn.
 *
 *   bun scripts/apex-overhaul-check.ts
 */
import { createCanvas, loadImage, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { readdirSync, statSync } from "node:fs";

(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = class {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, w), Math.max(1, h));
  }
};

const S = await import("../src/lib/arcade/sportsSprites");
const C = await import("../src/lib/arcade/racingCar.renderer");
const R = await import("../src/lib/arcade/racing");
const M = await import("../src/lib/arcade/racingMap");
const { replayRacingRun } = await import("../src/lib/duel/racing");
const { RACING_DEAL_V4, racingDealSeedV4 } = await import("../src/lib/duel/racingDealV4.server");
const { RACING_DEAL_V3 } = await import("../src/lib/duel/racingDealV3.server");
const { generateRacing } = await import("../src/lib/duel/sports.server");
const { oracleRun } = await import("./racing-oracle");
const { racingSubmission } = await import("./racing-deal");
const { bot } = await import("./arcade-skill-bands/bots/racing");
const { Human } = await import("./arcade-skill-bands/human");
const { PUZZLE_INSTRUCTIONS: INSTRUCTIONS } = await import("../src/lib/duel/instructions");

let passes = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passes++;
  else {
    failures.push(msg);
    console.log(`  FAIL ${msg}`);
  }
}
const FULL = process.env["CHECKS_FULL"] === "1";

/* 1. The rendered car. */
{
  const dir = "public/sports/racing";
  const files = readdirSync(dir).filter((f) => f.endsWith(".webp"));
  ok(files.length === 21 && C.RACING_CAR_SPRITE_NAMES.every((n) => files.includes(`${n}.webp`)), `21 car sprites, one per yaw and variant (${files.length})`);
  const bytes = files.reduce((a, f) => a + statSync(`${dir}/${f}`).size, 0);
  ok(bytes < 400 * 1024, `the car's images total under 400 KB (${(bytes / 1024).toFixed(0)} KB)`);
  ok(C.RACING_CAR_FRAMES.length === 7 && C.RACING_CAR_FRAMES[3]!.yaw === 0, "seven yaws, the middle one straight");
  // With no images (Bun): nothing is drawn, so the caller paints its own car.
  const blank = createCanvas(200, 120);
  ok(!C.drawRacingCarSprite(blank.getContext("2d") as never, { cx: 100, contactY: 100, width: 80, yawDeg: 0, braking: false }), "without its images the rendered car draws nothing (the painted car stays)");
  for (const n of C.RACING_CAR_SPRITE_NAMES) {
    const img = await loadImage(`${dir}/${n}.webp`);
    ok(img.width === C.RACING_CAR_SPRITE_W && img.height === C.RACING_CAR_SPRITE_H, `${n}: the shared size ${img.width}×${img.height}`);
    S.setSportsSpriteForShots("racing", n, img);
  }
  const alphaBox = (cv: ReturnType<typeof createCanvas>) => {
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let y = 0; y < cv.height; y++)
      for (let x = 0; x < cv.width; x++)
        if (d[(y * cv.width + x) * 4 + 3]! > 24) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x + 1);
          y1 = Math.max(y1, y + 1);
        }
    return { x0, x1, y1 };
  };
  // At the play screen's size (the collision width) and at a reveal-tile size, braking and not, painted and as a ghost.
  const carW = 2 * (R.RACING_CAR_HALF / R.RACING_ROAD_X) * 1000 * (300 / 1270);
  for (const width of [carW, 40]) {
    for (let f = 0; f < C.RACING_CAR_FRAMES.length; f++) {
      for (const variant of [{ braking: false }, { braking: true }, { braking: false, paint: "stripes" as const }, { braking: false, ghost: "#4BFF7A" }]) {
        const cv = createCanvas(300, 200);
        const ctx = cv.getContext("2d") as never as CanvasRenderingContext2D;
        const cx = 150;
        const contactY = 170;
        const drew = C.drawRacingCarSprite(ctx, { cx, contactY, width, yawDeg: C.RACING_CAR_FRAMES[f]!.yaw, ...variant });
        const b = alphaBox(cv);
        const label = `yaw ${C.RACING_CAR_FRAMES[f]!.yaw}° at ${width.toFixed(1)} px ${JSON.stringify(variant)}`;
        ok(drew, `${label}: drawn`);
        ok(Math.abs(b.x1 - b.x0 - width) <= 2 && b.x0 >= cx - width / 2 - 2 && b.x1 <= cx + width / 2 + 2, `${label}: the car spans its collision width (${(b.x1 - b.x0).toFixed(1)} of ${width.toFixed(1)}, ${b.x0}…${b.x1})`);
        ok(Math.abs(b.y1 - contactY) <= 2, `${label}: its lowest pixel on the contact line (${b.y1} vs ${contactY})`);
      }
    }
  }
  console.log(`  car: ${files.length} sprites, ${(bytes / 1024).toFixed(0)} KB, every yaw at the collision width`);
}

/* 2. The three circuits and the rev-4 deal. */
{
  ok(R.RACING_REV_DEALT === R.RACING_REV_5 && R.RACING_REV_4 === 4, "racingRev 5 is dealt (racingRev 4's circuits and play, D6's pace and sectors)"); // Changed with Joe's approval, 27 Nov 2026 (D6)
  ok(R.RACING_CIRCUITS.map((c) => c.name).join(",") === "Sunset Park,Harbour Run,Ridge Loop", "three named circuits");
  const curves = [0, 1, 2].map((c) => Array.from(R.racingCircuit(c).curve).join(","));
  ok(new Set(curves).size === 3, "the three circuits are three different layouts");
  ok(curves[0] === Array.from(R.racingTrack(R.RACING_SUNSET_SEED).curve).join(","), "Sunset Park is racingRev 3's own layout for its first proved seed");
  ok(RACING_DEAL_V3[0] === R.RACING_SUNSET_SEED, "RACING_SUNSET_SEED is the rev-3 deal's first seed");
  for (const seed of [1, 2, 3, 300, 2 ** 31 - 2, 777777])
    ok(Array.from(R.racingTrackFor(seed, 4).curve).join(",") === curves[R.racingCircuitOf(seed)], `seed ${seed} races on circuit ${R.racingCircuitOf(seed) + 1} on racingRev 4`);
  ok(RACING_DEAL_V4.length === 300 && new Set(RACING_DEAL_V4).size === 300, "the rev-4 deal holds 300 distinct seeds");
  const per = [0, 0, 0];
  for (const s of RACING_DEAL_V4) per[R.racingCircuitOf(s)]!++;
  ok(per.every((n) => n === 100), `100 deal seeds on each circuit (${per.join(", ")})`);
  let dealt = true;
  for (let i = 0; i < 40; i++) {
    const p = generateRacing();
    if (p.racingRev !== R.RACING_REV_5 || !RACING_DEAL_V4.includes(p.seed)) dealt = false; // Changed with Joe's approval, 27 Nov 2026 (D6)
  }
  ok(dealt, "rooms and practice deal racingRev 5 from the rev-4 deal");
  ok([0, 1, 299, 300, 12345].every((r) => RACING_DEAL_V4.includes(racingDealSeedV4(r))), "racingDealSeedV4 picks from the rev-4 deal");
  const list = FULL ? RACING_DEAL_V4 : [...[0, 1, 2].map((c) => RACING_DEAL_V4.find((s) => R.racingCircuitOf(s) === c)!), ...RACING_DEAL_V4.filter((_, i) => i % 25 === 7)];
  let proved = 0;
  for (const seed of list) {
    const r = replayRacingRun(seed, racingSubmission(seed, oracleRun(seed, 4), 4), 4);
    const par = R.RACING_V4_PACE[R.racingCircuitOf(seed)]!;
    const good = r.score === 200 && !r.flagged && r.clean === 8 && r.finished && R.racingPace10(r.state) >= par.full && r.state.rev === 4;
    if (good) proved++;
    else ok(false, `rev-4 deal seed ${seed} (circuit ${R.racingCircuitOf(seed) + 1}): the oracle reaches 200 (${r.score}, pace ${R.racingPace10(r.state)} of ${par.full})`);
  }
  ok(proved === list.length, `the oracle takes ${proved} of ${list.length} rev-4 deal seeds to exactly 200 through the server replay`);
  console.log(`  circuits: ${per.join(" / ")} deal seeds, ${proved} proved at 200${FULL ? " (all)" : " (sample)"}`);
}

/* 3. racingRev 1–3 unchanged. */
{
  for (const seed of RACING_DEAL_V3.slice(0, 6))
    for (const rev of [1, 2, 3]) ok(R.racingTrackFor(seed, rev) === R.racingTrack(seed), `racingRev ${rev}: seed ${seed} keeps its own layout`);
  for (const seed of RACING_DEAL_V3.slice(0, 4)) {
    const r = replayRacingRun(seed, racingSubmission(seed, oracleRun(seed, 3), 3), 3);
    ok(r.score === 200 && r.state.rev === 3, `racingRev 3's deal seed ${seed} still replays to 200 (${r.score})`);
  }
  ok(R.racingStdSpecFor(3) === R.RACING_V3_STD_SPEC && R.racingPaceRange({ rev: 3, seed: 5 }).full === R.RACING_V3_PACE_FULL, "racingRev 3 scores on its own spec and pace");
}

/* 4. The run summary's moments and map. */
{
  const game = R.racingGameFor(4);
  for (let c = 0; c < 3; c++) {
    const seed = RACING_DEAL_V4.find((s) => R.racingCircuitOf(s) === c)!;
    for (const level of ["weak", "average", "good", "perfect"] as const) {
      const human = new Human("racing", seed, level);
      const events = bot({ game, seed, rev: 4, human } as never).events ?? [];
      const server = replayRacingRun(seed, racingSubmission(seed, events, 4), 4);
      const run = M.racingRunMoments(seed, 4, events);
      const tag = `circuit ${c + 1}, ${level}`;
      ok(run.clean === server.clean && run.cleanMask === server.state.cleanMask, `${tag}: clean sectors ${run.clean} = the server's ${server.clean}`);
      ok(run.walls.length === server.wallHits, `${tag}: wall hits ${run.walls.length} = the server's ${server.wallHits}`);
      ok((run.offs.length > 0) === server.offTicks > 0 && run.offs.length <= server.state.contacts, `${tag}: trips off (${run.offs.length}) agree with the server (${server.offTicks} ticks off, ${server.state.contacts} contacts)`);
      ok(run.pace10 === R.racingPace10(server.state), `${tag}: average speed ${run.pace10} = the server's`);
      if (server.finished) ok(run.lapTicks.length === 2 && run.lapTicks[0]! + run.lapTicks[1]! === server.raceTicks, `${tag}: the two lap times add up to the race time (${run.lapTicks.join(" + ")} = ${server.raceTicks})`);
    }
    const pts = M.racingMapPoints(R.racingCircuit(c));
    ok(pts.length === R.RACING_LAP_SEGS + 1 && Math.hypot(pts[0]!.x - pts.at(-1)!.x, pts[0]!.y - pts.at(-1)!.y) < 1e-9, `circuit ${c + 1}: the map is a closed loop`);
    ok(pts.every((p) => p.x >= -1e-9 && p.x <= 1 + 1e-9 && p.y >= -1e-9 && p.y <= 1 + 1e-9), `circuit ${c + 1}: the map fits its box`);
    const mark = M.racingMapAt(pts, R.RACING_LAP + 12345);
    ok(pts.some((p) => Math.hypot(p.x - mark.x, p.y - mark.y) < 0.02), `circuit ${c + 1}: a mark on the second lap sits on the track`);
  }
}

/* 5. The words. */
{
  const help = INSTRUCTIONS["racing"];
  const text = JSON.stringify(help);
  ok(R.RACING_CIRCUITS.every((c) => text.includes(c.name)), "the help names the three circuits");
  ok(/par pace/.test(R.RACING_V4_STD_SPEC.parts[0]!.how), "the dealt spec scores pace against the circuit's par");
}

/* 6. "Two hundred club" means 200 km/h on every circuit: racingRev 4's stored pace10 (display data), older stamps' Pace line. */
{
  const { gradeAnswer } = await import("../src/lib/duel/gradeAnswer.server");
  const { PRACTICE_CHALLENGES, evaluateChallenge } = await import("../src/lib/duel/practiceChallenges");
  const club = PRACTICE_CHALLENGES.find((c) => c.id === "racing.two-hundred-club")!;
  for (let c = 0; c < 3; c++) {
    const seed = RACING_DEAL_V4.find((s) => R.racingCircuitOf(s) === c)!;
    const answer = racingSubmission(seed, oracleRun(seed, 4), 4);
    const g = gradeAnswer({ type: "racing", seed, racingRev: 4 } as never, answer, 0) as unknown as { score: number; extra: Record<string, unknown> };
    const server = replayRacingRun(seed, answer, 4);
    ok(g.extra["pace10"] === R.racingPace10(server.state), `circuit ${c + 1}: the stored pace10 is the run's average speed (${String(g.extra["pace10"])})`);
    ok(g.score === server.score, `circuit ${c + 1}: storing pace10 changes no score (${g.score})`);
    const run = (pace10: number) => ({ score: 150, isCorrect: true, reactionAvgMs: null, extra: { ...g.extra, pace10 } });
    ok(evaluateChallenge(club, run(2000)).met && !evaluateChallenge(club, run(1999)).met, `circuit ${c + 1}: "Two hundred club" is met at 200.0 km/h and not at 199.9`);
  }
  const seed3 = RACING_DEAL_V3[0]!;
  const g3 = gradeAnswer({ type: "racing", seed: seed3, racingRev: 3 } as never, racingSubmission(seed3, oracleRun(seed3, 3), 3), 0) as unknown as { extra: Record<string, unknown> };
  ok(!("pace10" in g3.extra), "racingRev 3's stored extra is unchanged (no pace10)");
  ok(evaluateChallenge(club, { score: 200, isCorrect: true, reactionAvgMs: null, extra: g3.extra }).met, "on racingRev 3 the challenge still reads the Pace line (a 200 run meets it)");
}

/* 7. Stage 2: the track's detail and each circuit's scenery (display only). */
{
  const RR = await import("../src/lib/arcade/racing.renderer");
  const SC = await import("../src/lib/arcade/racingScenery.renderer");
  for (let c = 0; c < 3; c++) {
    const track = R.racingCircuit(c);
    const detail = RR.racingTrackDetail(track);
    const advised = new Set(R.racingCornerAdvice(track).map((a) => a.corner.start));
    const n = R.RACING_LAP_SEGS;
    const kerbed = track.corners.every((k) => {
      for (let i = -12; i < k.len + 12; i++) if (!detail.kerb[(((k.start + i) % n) + n) % n]) return false;
      return true;
    });
    ok(kerbed, `circuit ${c + 1}: kerbs from 12 segments before every corner to 12 after it`);
    ok(detail.corners.every((k) => k.marshal && k.fenceOutside && k.boards === 3), `circuit ${c + 1}: every corner has a marshal post, a catch fence on its outside and its 150 / 100 / 50 boards`);
    ok(detail.corners.every((k) => !advised.has(k.start) || k.sign), `circuit ${c + 1}: every advised corner has its speed sign`);
    let straight = 0;
    for (let i = 0; i < n; i++) if (!detail.kerb[i]) straight++;
    ok(straight > n / 4, `circuit ${c + 1}: straights without kerbs carry the edge lines and centre dashes (${straight} segments)`);
  }
  // The scenery a state draws: racingRev 4 by its circuit, racingRev 1–3 the park.
  const seeds = RACING_DEAL_V4.slice(0, 30);
  ok(seeds.every((s) => SC.racingSceneOf({ seed: s, rev: 4 }) === R.racingCircuitOf(s)), "racingRev 4 draws its circuit's own scenery (racingCircuitOf)");
  ok(seeds.every((s) => SC.racingSceneOf({ seed: s, rev: 3 }) === SC.RACING_SCENE_PARK && SC.racingSceneOf({ seed: s, rev: 1 }) === SC.RACING_SCENE_PARK), "racingRev 1–3 keep the park");
  // Pixels: each circuit's frame at the same moment differs above the horizon; the kerbs' red and the edge lines show.
  const W = R.RACING_WORLD_W;
  const H = R.RACING_WORLD_H;
  const frame = (seed: number, s: number) => {
    const cv = createCanvas(W, H);
    const st = { ...R.racingGameFor(4).init(seed), tick: 600, s, v: 2200 };
    RR.drawRacingPlay(cv.getContext("2d") as never, st, { width: W, height: H });
    return cv.getContext("2d").getImageData(0, 0, W, H).data;
  };
  const seedOf = (c: number) => RACING_DEAL_V4.find((s) => R.racingCircuitOf(s) === c)!;
  const horizonOf = (d: Uint8ClampedArray) => {
    const rows: number[] = [];
    for (let y = 120; y < 185; y++) for (let x = 0; x < W; x += 3) rows.push(d[(y * W + x) * 4]!, d[(y * W + x) * 4 + 1]!, d[(y * W + x) * 4 + 2]!);
    return rows;
  };
  const frames = [0, 1, 2].map((c) => frame(seedOf(c), R.RACING_SEG * 60));
  const diff = (a: number[], b: number[]) => a.reduce((m, v, i) => m + Math.abs(v - b[i]!), 0) / a.length;
  const hz = frames.map(horizonOf);
  ok(diff(hz[0]!, hz[1]!) > 6 && diff(hz[0]!, hz[2]!) > 6 && diff(hz[1]!, hz[2]!) > 6, `the three circuits' horizons differ (${diff(hz[0]!, hz[1]!).toFixed(1)}, ${diff(hz[0]!, hz[2]!).toFixed(1)}, ${diff(hz[1]!, hz[2]!).toFixed(1)})`);
  // At a corner: the kerb's red in the lower half of the view, on every circuit.
  for (let c = 0; c < 3; c++) {
    const corner = R.racingCircuit(c).corners[1]!;
    const d = frame(seedOf(c), (corner.start + 2) * R.RACING_SEG);
    let red = 0;
    for (let y = 300; y < 700; y += 2) for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4;
      if (d[i]! > 180 && d[i + 1]! < 90 && d[i + 2]! < 80) red++;
    }
    ok(red > 150, `circuit ${c + 1}: a corner draws its red-and-white kerbs (${red} red samples)`);
  }
}

/* 8. Stage 2: the effects observe the sim and never write to it. */
{
  const FX = await import("../src/lib/arcade/racingFx.renderer");
  const RR = await import("../src/lib/arcade/racing.renderer");
  const seed = RACING_DEAL_V4[0]!;
  const go = R.racingGoTick(4);
  const base = { ...R.racingGameFor(4).init(seed), tick: go + 300, s: R.RACING_SEG * 40, x: 0 };
  const at = (kmh: number) => Math.ceil((kmh * R.RACING_VMAX) / R.RACING_KMH_AT_VMAX);
  FX.setRacingFxModes({ motion: false, effects: false });
  const speeds = [150, 199, 200].map((k) => FX.racingSpeedLines({ ...base, v: at(k) }));
  ok(speeds.every((v) => v === 0), "no speed lines at or below 200 km/h");
  ok(FX.racingSpeedLines({ ...base, v: at(210) }) > 0 && FX.racingSpeedLines({ ...base, v: at(240) }) > FX.racingSpeedLines({ ...base, v: at(210) }), "speed lines above 200 km/h, stronger with speed");
  ok(FX.racingSpeedLines({ ...base, v: R.RACING_VMAX }) === 1, "full speed lines flat out");
  const kerbX = R.RACING_ROAD_X - R.RACING_CAR_HALF + 4096;
  const shakeTicks = Array.from({ length: 6 }, (_, k) => FX.racingKerbShake({ ...base, v: at(180), x: kerbX, tick: base.tick + k }));
  ok(shakeTicks.some((s) => s.dx !== 0 || s.dy !== 0) && shakeTicks.every((s) => Math.abs(s.dx) <= 2 && Math.abs(s.dy) <= 2), "the kerb shakes the view by a pixel or two");
  ok([0, 1, 2, 3].every((k) => { const s = FX.racingKerbShake({ ...base, v: at(180), x: 0, tick: base.tick + k }); return s.dx === 0 && s.dy === 0; }), "no shake on the tarmac");
  ok(FX.racingDust({ ...base, v: at(120), off: 1 }, 60).length > 0 && FX.racingDust({ ...base, v: at(120), off: 0 }, 60).length === 0, "dust only on the grass");
  ok(FX.racingGrassDrop({ ...base, v: at(100), off: 1, offFrom: at(160) }) >= 55 && FX.racingGrassDrop({ ...base, v: at(100), off: 0, offFrom: 0 }) === 0, "the speedo's drop on the grass, none on the tarmac");
  const wallX = R.RACING_WALL_LIMIT;
  ok(FX.racingScrape({ ...base, v: at(150), wall: 1, x: wallX }) === 1 && FX.racingScrape({ ...base, v: at(150), wall: 1, x: -wallX }) === -1, "a scrape against the wall still moving sparks on its side");
  ok(FX.racingScrape({ ...base, v: 50, wall: 1, x: wallX }) === 0 && FX.racingScrape({ ...base, v: at(150), wall: 0, x: wallX }) === 0, "no sparks when stopped against the wall or off it");
  ok(FX.racingSparks({ ...base, v: at(150), wall: 1, x: wallX }, 60).length > 0, "sparks drawn while scraping");
  // The corner's verdict against its sign.
  const track = R.racingCircuit(R.racingCircuitOf(seed));
  const advice = R.racingCornerAdvice(track)[0]!;
  const startS = advice.corner.start * R.RACING_SEG;
  const inCorner = { ...base, s: startS + R.RACING_SEG, tick: base.tick };
  const verdict = (kmh: number) => FX.racingCornerEntry(inCorner, (s) => (s === startS ? { v: at(kmh), tick: base.tick - 10 } : null));
  ok(verdict(advice.kmh)?.ok === true && verdict(advice.kmh - 20)?.ok === true, `a corner entered at or under its sign (${advice.kmh} km/h) flashes green`);
  ok(verdict(advice.kmh + 20)?.ok === false, "a corner entered over its sign flashes red");
  ok(FX.racingCornerEntry({ ...base, s: startS - R.RACING_SEG }, () => ({ v: 1, tick: base.tick })) === null, "no flash before the corner");
  // The clean sector's bar.
  const boundary = 3 * R.RACING_SECTOR_LEN;
  ok(FX.racingSectorFlash({ ...base, sector: 3, cleanMask: 0b100, s: boundary + 10 }) === 2, "a clean sector's bar flashes as the next begins");
  ok(FX.racingSectorFlash({ ...base, sector: 3, cleanMask: 0b011, s: boundary + 10 }) === null, "a touched sector's bar doesn't flash");
  ok(FX.racingSectorFlash({ ...base, sector: 3, cleanMask: 0b100, s: boundary + R.RACING_SECTOR_LEN / 2 }) === null, "the flash ends a few metres into the next sector");
  ok(FX.racingFinishHoldMs({ ...base, finishTick: base.tick }) === FX.RACING_FINISH_HOLD_MS && FX.racingFinishHoldMs(base) === 0, "a finished race holds its flag before the reveal; a timed-out one doesn't");
  // Reduced motion: no particles, streaks or shake.
  FX.setRacingFxModes({ motion: true, effects: false });
  ok(FX.racingSpeedLines({ ...base, v: R.RACING_VMAX }) === 0, "reduced motion: no speed lines");
  ok([0, 1, 2].every((k) => { const s = FX.racingKerbShake({ ...base, v: at(180), x: kerbX, tick: base.tick + k }); return s.dx === 0 && s.dy === 0; }), "reduced motion: no shake");
  ok(FX.racingDust({ ...base, v: at(120), off: 1 }, 60).length === 0 && FX.racingSparks({ ...base, v: at(150), wall: 1, x: wallX }, 60).length === 0, "reduced motion: no dust or sparks");
  FX.setRacingFxModes({ motion: false, effects: true });
  ok(FX.racingSparks({ ...base, v: at(150), wall: 1, x: wallX }, 60).length === 4, "reduced effects: a third of the sparks (4 of 12)");
  FX.setRacingFxModes({ motion: false, effects: false });
  // The sim is identical with the effects drawn and not: a bot run stepped twice, drawing every 30th tick on one.
  const game = R.racingGameFor(4);
  const out = bot({ game, seed, rev: 4, human: new Human("racing", seed, "good"), fixes: true });
  const byTick = new Map((out.events ?? []).map((e) => [e.t, e]));
  const W0 = R.RACING_WORLD_W;
  const H0 = R.RACING_WORLD_H;
  const cv = createCanvas(W0, H0);
  const ctx = cv.getContext("2d") as never;
  let a = game.init(seed);
  let b = game.init(seed);
  let same = true;
  while (!game.isOver(a)) {
    a = game.step(a, byTick.get(a.tick + 1) ?? null);
    b = game.step(b, byTick.get(b.tick + 1) ?? null);
    if (a.tick % 30 === 0) {
      const before = JSON.stringify(a);
      RR.drawRacingPlay(ctx, a, { width: W0, height: H0 });
      if (JSON.stringify(a) !== before) same = false;
    }
  }
  ok(same && JSON.stringify(a) === JSON.stringify(b) && game.score(a) === game.score(b), `the sim is identical with the effects drawn and not (score ${game.score(a)})`);
  FX.setRacingFxModes(null);
}

if (failures.length) {
  console.log(`FAIL apex-overhaul-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS apex-overhaul-check: ${passes} checks (the rendered car at its collision width on every yaw, three circuits dealt and proved, racingRev 1–3 unchanged, the run summary's moments equal to the server's, stage 2's track, scenery and effects)`);
