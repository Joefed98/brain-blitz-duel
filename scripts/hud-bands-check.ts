/**
 * hud-bands-check (27 Nov 2026, P4 desktop size PR 1; docs/desktop-support.md "The HUD row given back"; display only,
 * ~5 s, no browser). Proves:
 *
 *   1. Every band in src/lib/gameFrame/hudBands.ts belongs to a live (playable) game and was measured on the stamps
 *      that game is dealt on today at every level, so a new stamp is measured again before any of its world can be
 *      cut; bands are whole and positive.
 *   2. Only the arena's live arcade round is cut, by one rule (hudCut): ArcadeArenaSlot crops only with the arena on,
 *      the HUD's values in the panel, the panels showing and a band given, PhoneShell gives a band only to the arena's
 *      arcade play screen (so phones, tablets upright, intros, demos, reveals and hidden-panel play draw the whole world,
 *      as before), and both arena draw paths put the success layer's frame effects on the visible edge by the same rule.
 *   3. Out of the world (inside a stage's draw on the arena), Blockzone's speed and Gemstone's goals panel are noted
 *      for the side panel and draw nothing; in the world they draw exactly the pixels they drew before (the same draw
 *      inside and outside a stage's draw, and Gemstone's foot strip unchanged by the noting).
 *   4. Nothing the game draws ever enters its band (28 Nov 2026). Every recorded run of each game on the stamps it is
 *      dealt on (scripts/fixtures/replay-runs.json and the intro-demo fixtures; each replayed through the game's own
 *      sim, as the server replays it, to exactly its stored score) and a weak and a near-perfect skill-band bot on a
 *      fresh deal at every level, their states every half second (SAMPLE ticks) and the last, are drawn in order, each on its own tick's time (so effects start, move and fade as on screen), by the game's own renderer
 *      with the HUD in the side panel, at the size the arena draws the world on a sideways tablet (1180x820, DPR 2) and
 *      a computer (1440x900, DPR 1), and every draw's box is recorded (scripts/draw-bounds-lib.ts: paths through the
 *      transform, strokes with their width, text by its measured ink, images by their pixels at least 8 of 255 visible,
 *      shadows, clips). Fails if any draw reaches above the band's foot (`top`) or below its top from the world's foot
 *      (`bottom`). A draw spanning 95 % or more of the width (the backdrop, scanlines, the world's frame) is not counted;
 *      --report prints how many entered a band, and each game's highest and lowest counted draws. So a band declared
 *      larger than the empty strip, by even a fraction of a unit, fails on the draw it would cut.
 *   5. The measurement catches a band too large: Meteor's band one unit past its board's top fails it.
 *
 *   bun scripts/hud-bands-check.ts [--report] [--part=k/n] [game ids…]
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createCanvas, retroArtFor, retroRun, retroWorldSize } from "./retro-render-lib";
import { LAYOUTS, LEVELS, artFor, botStates, clockFor, dealtStamps, measureState, recordedRuns, replayStates, type Run } from "./hud-bands-lib";

const ARGS = process.argv.slice(2);
const REPORT = ARGS.includes("--report");
const ONLY = ARGS.filter((a) => !a.startsWith("--"));
/** --part=k/n: section 4 on every n-th game from the k-th (sections 1 to 3 and 5 run in every part). */
const [PART_K, PART_N] = (ARGS.find((a) => a.startsWith("--part="))?.slice(7) ?? "1/1").split("/").map(Number) as [number, number];
/** Ticks between the states drawn (twice a second), in order, each on its own tick's time. */
const SAMPLE = 30;
/** Floating-point noise in the transforms (a hundredth of a unit), never more. */
const EPS = 0.01;

const { HUD_BANDS } = await import("../src/lib/gameFrame/hudBands");
const { generatePuzzle } = await import("../src/lib/duel/generate.server");
const { withSeededRandom } = await import("../src/lib/duel/random");
const { isPlayable } = await import("../src/lib/duel/catalogue");
const { takeHud, withHudInWorld } = await import("../src/lib/arcade/hudPlacement");

let passes = 0;
const ok = (line: string) => {
  passes++;
  console.log(`  ok ${line}`);
};

// 1: live games, today's stamps, sane sizes.
{
  const entries = Object.entries(HUD_BANDS);
  assert.ok(entries.length >= 6, "the bands cover the arcade games that have one");
  for (const [type, band] of entries) {
    assert.ok(band, `${type}: a band`);
    assert.ok(isPlayable(type), `${type}: a live game (a retired game is never played)`);
    const [field, ...measured] = band.stamp;
    const dealt = await dealtStamps(type, field);
    for (const [level, value] of Object.entries(dealt))
      assert.ok(measured.includes(value), `${type}: ${level} dealt on ${field} ${String(value)}, its band measured on ${measured.join(", ")}; measure the new stamp's HUD band again`);
    for (const value of measured) assert.ok(Object.values(dealt).includes(value), `${type}: its band lists ${field} ${value}, which no level deals`);
    assert.ok(Number.isInteger(band.top) && band.top >= 0, `${type}: a whole top band (0 for none)`);
    assert.ok(band.bottom === undefined || (Number.isInteger(band.bottom) && band.bottom > 0), `${type}: a whole, positive foot band`);
    assert.ok(band.top > 0 || (band.bottom ?? 0) > 0, `${type}: a band at the top, the foot or both`);
  }
  ok(`${entries.length} bands: live games, each measured on the stamps dealt today at every level`);
}

// 2: only the arena's live arcade round is cut.
{
  const slot = readFileSync("src/components/puzzles/ArcadeArenaSlot.tsx", "utf8");
  assert.match(slot, /const \{ top: crop, bottom: cropB \} = hudCut\(arenaOn && ARENA_HUD_IN_PANEL && !panelsHidden, hudBand, height\);/, "the slot crops only on the arena with the HUD in the panel, the panels showing and a band");
  const { hudCut } = await import("../src/lib/gameFrame/hudBands");
  const band = { top: 40, bottom: 20, stamp: ["x", 1] as const };
  assert.deepEqual(hudCut(false, band, 600), { top: 0, bottom: 0 }, "no cut off the arena, with the panels hidden or the HUD in the world");
  assert.deepEqual(hudCut(true, undefined, 600), { top: 0, bottom: 0 }, "no cut for a game with no band");
  assert.deepEqual(hudCut(true, band, 600), { top: 40, bottom: 20 }, "the band, on the arena with the HUD in the panel");
  assert.deepEqual(hudCut(true, { ...band, top: 300 }, 600), { top: 200, bottom: 20 }, "never more than a third of the world");
  // The effects' visible frame reads the same rule on both of the arena's draw paths.
  const stage = readFileSync("src/components/puzzles/ArcadeCanvasStage.tsx", "utf8");
  assert.match(stage, /const cut = hudCut\(Boolean\(arenaRef\.current && ARENA_HUD_IN_PANEL\) && !arenaPanelsHidden\(\), hudBandRef\.current, worldH\);/, "ArcadeCanvasStage cuts the effects' frame by the same rule");
  assert.match(stage, /withArcadeFxInset\(cut\.top, cut\.bottom,/, "ArcadeCanvasStage draws inside the effects' visible frame");
  const own = readFileSync("src/lib/gameFrame/arenaHud.ts", "utf8");
  assert.match(own, /const cut = hudCut\(Boolean\(onArena && ARENA_HUD_IN_PANEL\) && !arenaPanelsHidden\(\), hudBandRef\.current\);/, "the own-loop stages cut the effects' frame by the same rule");
  assert.match(own, /withArcadeFxInset\(cut\.top, cut\.bottom, draw\)/, "the own-loop stages draw inside the effects' visible frame");
  const shell = readFileSync("src/components/duel/PhoneShell.tsx", "utf8");
  assert.match(shell, /hudBand: arena && arcadePlay \? hudBandFor\(gameType\) : undefined,/, "the shell gives a band only to the arena's arcade play screen");
  ok("only the arena's live arcade round, with the HUD in the panel and the panels showing, is cut");
}

type Ctx = CanvasRenderingContext2D;
const pixels = (w: number, h: number, paint: (ctx: Ctx) => void): Buffer => {
  const c = createCanvas(w, h);
  paint(c.getContext("2d") as unknown as Ctx);
  return Buffer.from(c.getContext("2d").getImageData(0, 0, w, h).data);
};

// 3a: Blockzone's speed.
{
  const run = await retroRun("blockfall", { every: 600 });
  const draw = await retroArtFor("blockfall", run.rev);
  const state = run.states.at(-1)!;
  const size = await retroWorldSize("blockfall", state);
  const plain = pixels(size.width, size.height, (ctx) => draw(ctx, state, size));
  const inside = pixels(size.width, size.height, (ctx) => withHudInWorld(true, () => draw(ctx, state, size)));
  assert.ok(plain.equals(inside), "Blockzone: every pixel the same drawn inside a stage's draw (the speed in the world)");
  const inWorld = takeHud();
  assert.ok(!inWorld.some((i) => i.label === "Speed"), "Blockzone: in the world the speed is drawn, not noted");
  withHudInWorld(false, () => draw(createCanvas(size.width, size.height).getContext("2d") as unknown as Ctx, state, size));
  const off = takeHud();
  const speed = off.find((i) => i.label === "Speed");
  assert.ok(speed && /^\d+\/\d+$/.test(speed.value), `Blockzone: out of the world the speed is noted for the panel (${speed?.value})`);
  ok(`Blockzone (blockfallRev ${run.rev}): the speed noted for the panel out of the world, drawn as before in it`);
}

// 3b: Gemstone's goals panel.
{
  const { matchupGameFor } = await import("../src/lib/arcade/matchup");
  const { drawMatchupArt } = await import("../src/lib/arcade/matchup.renderer");
  const puzzle = withSeededRandom(11, () => generatePuzzle("matchup" as never)) as unknown as { matchupRev: number; seed: number };
  const game = matchupGameFor(puzzle.matchupRev, null);
  let state = game.init(puzzle.seed ?? 1);
  for (let i = 0; i < 180; i++) state = game.step(state, null);
  const W = 390;
  const H = 720;
  const size = { width: W, height: H };
  const plain = pixels(W, H, (ctx) => drawMatchupArt(ctx, state, size));
  const inside = pixels(W, H, (ctx) => withHudInWorld(true, () => drawMatchupArt(ctx, state, size)));
  assert.ok(plain.equals(inside), "Gemstone: every pixel the same drawn inside a stage's draw (the goals panel in the world)");
  takeHud();
  const offPixels = pixels(W, H, (ctx) => withHudInWorld(false, () => drawMatchupArt(ctx, state, size)));
  const off = takeHud();
  const goals = off.filter((i) => /^(Circle|Square|Triangle|Diamond|Star|Hexagon|Heart|Pearl|Gem)$/.test(i.label));
  assert.ok(goals.length >= 5, `Gemstone: out of the world every goal is noted for the panel (${goals.length})`);
  for (const label of ["Ice", "Treasure", "Big lines"]) assert.ok(off.some((i) => i.label === label), `Gemstone: the panel's ${label} noted`);
  // The foot the band gives back (shown below 625) holds nothing of the panel once it is out of the world.
  const footRow = (buf: Buffer, y: number) => buf.subarray(y * W * 4, (y + 1) * W * 4);
  let changed = 0;
  for (let y = 630; y < 700; y++) if (!footRow(offPixels, y).equals(footRow(plain, y))) changed++;
  assert.ok(changed > 0, "Gemstone: the goals panel is not drawn out of the world (its rows change)");
  ok(`Gemstone (matchupRev ${puzzle.matchupRev}): ${goals.length} goals and the panel's pills noted out of the world, drawn as before in it`);
}

// 4: nothing drawn enters a band.
async function runsOf(type: string, field: string, stamps: readonly number[]): Promise<{ runs: Run[]; recorded: number }> {
  const runs: Run[] = [];
  let recorded = 0;
  for (const r of recordedRuns(type, field, stamps)) {
    const x = await replayStates(type, r.puzzle, r.run, SAMPLE);
    assert.equal(x.score, x.stored, `${type}: ${r.source} replays to ${x.score}, stored ${x.stored} (the replay must match the server's)`);
    runs.push({ source: r.source, puzzle: r.puzzle, states: x.states });
    recorded++;
  }
  for (const level of LEVELS) for (const skill of ["weak", "near"]) runs.push(await botStates(type, field, level, skill, 1, SAMPLE));
  return { runs, recorded };
}

interface Seen {
  top: number;
  topAt: string;
  bottom: number;
  bottomAt: string;
  worldH: number;
  frames: number;
  wide: number;
}

async function seenFor(type: string, band: { top: number; bottom?: number; stamp: readonly [string, ...number[]] }, runs: Run[]): Promise<Seen> {
  const seen: Seen = { top: Infinity, topAt: "", bottom: -Infinity, bottomAt: "", worldH: 0, frames: 0, wide: 0 };
  for (const [n, run] of runs.entries()) {
    const art = await artFor(type, run.puzzle);
    for (const layout of LAYOUTS) {
      const canvases = new Map();
      for (const state of run.states) {
        const tick = (state as { tick: number }).tick;
        const r = await measureState(type, art, state, layout, band, canvases, clockFor(n, tick));
        seen.frames++;
        seen.wide += r.wide;
        seen.worldH = (await art.world(state)).height;
        const at = (box: typeof r.topBy) => `${box?.op}${box?.text ? ` "${box.text}"` : ""} at tick ${(state as { tick: number }).tick} of ${run.source} on the ${layout.name}`;
        if (r.top < seen.top) {
          seen.top = r.top;
          seen.topAt = at(r.topBy);
        }
        if (r.bottom > seen.bottom) {
          seen.bottom = r.bottom;
          seen.bottomAt = at(r.bottomBy);
        }
      }
    }
  }
  return seen;
}

const failures: string[] = [];
{
  let frames = 0;
  for (const [i, [type, band]] of Object.entries(HUD_BANDS).entries()) {
    if (!band || (ONLY.length && !ONLY.includes(type)) || i % PART_N !== PART_K - 1) continue;
    const t0 = Date.now();
    const [field, ...stamps] = band.stamp;
    const { runs, recorded } = await runsOf(type, field, stamps);
    assert.ok(recorded >= 1, `${type}: at least one recorded run on ${field} ${stamps.join(", ")} (scripts/fixtures/replay-runs.json or an intro-demo fixture)`);
    const seen = await seenFor(type, band, runs);
    frames += seen.frames;
    // The cut is never clamped (hudCut's third of the world), so the slot and the effects' frame always agree.
    assert.ok(band.top + (band.bottom ?? 0) <= seen.worldH / 3, `${type}: its band (${band.top} + ${band.bottom ?? 0}) leaves more than two thirds of its ${seen.worldH}-unit world`);
    const foot = seen.worldH - seen.bottom;
    if (REPORT)
      console.log(`  ${type}: band top ${band.top}, foot ${band.bottom ?? 0}; draws reach ${seen.top.toFixed(1)} from the top (${seen.topAt}) and ${foot.toFixed(1)} from the foot (${seen.bottomAt}); ${seen.wide} full-width draws in the band not counted; ${runs.length} runs (${recorded} recorded), ${seen.frames} frames, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (seen.top < band.top - EPS) failures.push(`${type}: a draw reaches ${seen.top.toFixed(1)} from the world's top, inside its ${band.top}-unit band (${seen.topAt}); the band may be at most ${Math.floor(seen.top)}`);
    if (band.bottom && foot < band.bottom - EPS) failures.push(`${type}: a draw reaches ${foot.toFixed(1)} from the world's foot, inside its ${band.bottom}-unit foot band (${seen.bottomAt}); the foot band may be at most ${Math.floor(foot)}`);
  }
  if (!failures.length) ok(`nothing any game draws enters its band: ${frames} frames of recorded and bot runs at every level, on the tablet and the computer`);
}

// 5: a band too large fails: Meteor's, one unit past its board's top (SNAKE_BOARD_Y, fixed in the sim), on one run.
{
  const { SNAKE_BOARD_Y } = await import("../src/lib/arcade/snake");
  const band = HUD_BANDS.snake!;
  const [field, ...stamps] = band.stamp;
  const first = recordedRuns("snake", field, stamps)[0]!;
  const x = await replayStates("snake", first.puzzle, first.run, SAMPLE);
  const tooLarge = SNAKE_BOARD_Y + 1;
  const seen = await seenFor("snake", { ...band, top: tooLarge }, [{ source: first.source, puzzle: first.puzzle, states: x.states }]);
  assert.ok(seen.top < tooLarge - EPS, `Meteor: a band of ${tooLarge}, past its board's top at ${SNAKE_BOARD_Y}, is caught`);
  ok(`a band too large is caught: Meteor's band at ${tooLarge}, past its board at ${SNAKE_BOARD_Y}, meets a draw at ${seen.top.toFixed(1)}`);
}

if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  console.log(`FAIL hud-bands-check: ${failures.length} band(s) entered by a draw`);
  process.exit(1);
}
console.log(`PASS hud-bands-check: ${passes} sections`);
