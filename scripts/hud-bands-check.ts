/**
 * hud-bands-check (27 Nov 2026, P4 desktop size PR 1; docs/desktop-support.md "The HUD row given back"; display only,
 * ~5 s, no browser). Proves:
 *
 *   1. Every band in src/lib/gameFrame/hudBands.ts belongs to a live (playable) game and was measured on the stamp
 *      that game is dealt on today, so a new stamp is measured again before any of its world can be cut; bands are
 *      whole, positive and leave at least two thirds of the world.
 *   2. Only the arena's live arcade round is cut: ArcadeArenaSlot crops only with the arena on, the HUD's values in the
 *      panel, the panels showing and a band given, and PhoneShell gives a band only to the arena's arcade play screen
 *      (so phones, tablets upright, intros, demos, reveals and hidden-panel play draw the whole world, as before).
 *   3. Out of the world (inside a stage's draw on the arena), Blockzone's speed and Gemstone's goals panel are noted
 *      for the side panel and draw nothing; in the world they draw exactly the pixels they drew before (the same draw
 *      inside and outside a stage's draw, and Gemstone's foot strip unchanged by the noting).
 *
 *   bun scripts/hud-bands-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createCanvas, retroArtFor, retroRun, retroWorldSize } from "./retro-render-lib";

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
  assert.ok(entries.length >= 15, "the bands cover the arcade games that have one");
  for (const [type, band] of entries) {
    assert.ok(band, `${type}: a band`);
    assert.ok(isPlayable(type), `${type}: a live game (a retired game is never played)`);
    const puzzle = withSeededRandom(11, () => generatePuzzle(type as never)) as unknown as Record<string, unknown>;
    const [field, value] = band.stamp;
    assert.equal(puzzle[field], value, `${type}: dealt on ${field} ${String(puzzle[field])}, its band measured on ${value}; measure the new stamp's HUD band again`);
    assert.ok(Number.isInteger(band.top) && band.top > 0, `${type}: a whole, positive top band`);
    assert.ok(band.bottom === undefined || (Number.isInteger(band.bottom) && band.bottom > 0), `${type}: a whole, positive foot band`);
  }
  ok(`${entries.length} bands: live games, each measured on the stamp dealt today`);
}

// 2: only the arena's live arcade round is cut.
{
  const slot = readFileSync("src/components/puzzles/ArcadeArenaSlot.tsx", "utf8");
  assert.match(slot, /const cropping = arenaOn && ARENA_HUD_IN_PANEL && !panelsHidden && hudBand !== undefined;/, "the slot crops only on the arena with the HUD in the panel, the panels showing and a band");
  assert.match(slot, /Math\.min\(hudBand\.top, height \/ 3\)/, "never more than a third of the world from the top");
  assert.match(slot, /Math\.min\(hudBand\.bottom \?\? 0, height \/ 3\)/, "never more than a third from the foot");
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

console.log(`PASS hud-bands-check: ${passes} sections`);
