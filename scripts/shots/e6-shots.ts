/**
 * Expansion E6 review frames (25 Oct 2026, a design tool, not a check): Coral Pop, Gemstone and Ball Tracker
 * mid-play on their new stamps, drawn by the games' real renderers (@napi-rs/canvas) at an iPhone 11's width.
 * A near-perfect skill-band bot plays a room seed through the sim; each frame is the world at the moment a
 * feature fires (a chest falling, a bank shot and combo; a goal met, ice, treasure and a cascade; gold marbles,
 * a boosted marble, crossovers and the combo), the presentation memory warmed by the frames before it. The
 * world is fitted into the 414 × 772 arena box of a 414 × 896 home-screen app (60 px game header above it),
 * as ArcadeArenaSlot places it.
 *
 *   bun scripts/shots/e6-shots.ts [--out=screenshots/e6-oct-2026]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

let clock = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 2, getComputedStyle: () => ({}) },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/e6-oct-2026";
const W = 414, H = 896, TOP = 48 + 60, BOX_H = 772 - 60, DPR = 2;

const { GAME_BY_TYPE } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const { drawBubbleArt } = await import("../../src/lib/arcade/bubble.renderer");
const { drawMatchupArt } = await import("../../src/lib/arcade/matchup.renderer");
const { btArtDraw } = await import("../../src/lib/arcade/ballTrackArt.renderer");
const { BUB_WORLD_W, BUB_TALL_H } = await import("../../src/lib/arcade/bubble");
const { MATCHUP_WORLD_W, MATCHUP_V9_WORLD_H } = await import("../../src/lib/arcade/matchup");
const { BT_W, BT_V7_H } = await import("../../src/lib/arcade/ballTrack");

/** Runs the near-perfect bot on a game's new stamp and returns its states, tick by tick. */
async function play(type: string, rev: number, n: number): Promise<any[]> {
  const spec: any = GAME_BY_TYPE.get(type as never)!;
  const { bot } = await import(`../arcade-skill-bands/bots/${type}.ts`);
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const events = bot({ game, seed, rev, human: new Human(type, seed, "near") }).events ?? [];
  const byTick = new Map(events.map((e: any) => [e.t, e]));
  const states = [game.init(seed)];
  while (!game.isOver(states.at(-1))) states.push(game.step(states.at(-1), byTick.get(states.at(-1).tick + 1) ?? null));
  return states.map((s) => Object.assign(s, { __game: game }));
}

/** A 414 × 896 frame: the screen edge colour, a header strip, and the world fitted into the arena box. */
function frame(name: string, worldW: number, worldH: number, states: any[], at: number, draw: (ctx: any, s: any, w: number, h: number) => void, label: string) {
  const canvas = createCanvas(W * DPR, H * DPR);
  const ctx: any = canvas.getContext("2d");
  ctx.scale(DPR, DPR);
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, W, H);
  const scale = Math.min(W / worldW, BOX_H / worldH);
  const w = worldW * scale, h = worldH * scale;
  const ox = (W - w) / 2;
  // Warm the renderer's presentation memory on the frames before, one 60th of a second apart.
  for (let t = Math.max(0, at - 45); t <= at; t++) {
    clock = 10_000 + t * (1000 / 60);
    ctx.save();
    ctx.translate(ox, TOP);
    draw(ctx, states[t], w, h);
    ctx.restore();
  }
  // The header strip over everything (a world's table layer may reach past its box).
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, W, 48);
  ctx.fillStyle = "#101015";
  ctx.fillRect(0, 48, W, 60);
  ctx.fillStyle = "#F3F1EC";
  ctx.font = "700 16px sans-serif";
  ctx.fillText(name, 16, 76);
  ctx.fillStyle = "#BDBDCC";
  ctx.font = "500 12px sans-serif";
  ctx.fillText(label, 16, 96);
  return canvas;
}

mkdirSync(OUT, { recursive: true });
const save = (file: string, canvas: any) => {
  writeFileSync(`${OUT}/${file}`, canvas.toBuffer("image/png"));
  console.log(`${OUT}/${file}`);
};

// Coral Pop: the frame just after a chest falls with a cluster (bank shots and the combo in the HUD).
{
  let states: any[] = [], at = -1;
  for (let n = 0; n < 12 && at < 0; n++) {
    states = await play("bubble", 8, n);
    at = states.findIndex((s, i) => i > 0 && (s.chests ?? 0) > (states[i - 1].chests ?? 0) && (s.streak ?? 0) >= 2);
  }
  const s = states[at + 8]!;
  save("coral-pop-414x896.png", frame("Coral Pop · bubbleRev 8", BUB_WORLD_W, BUB_TALL_H, states, at + 8, (ctx, st, w, h) => drawBubbleArt(ctx, st, { width: w, height: h }),
    `chests ${s.chests}/6 · banks ${s.banks} · combos ${s.combos} · streak ×${s.streak}`));
}
// Gemstone: a swap that meets a goal or brings a treasure down (ice, the goals panel and the cascade).
{
  let states: any[] = [], at = -1;
  for (let n = 0; n < 12 && at < 0; n++) {
    states = await play("matchup", 9, n);
    at = states.findIndex((s, i) => i > 0 && ((s.treasures ?? 0) > (states[i - 1].treasures ?? 0) || ((s.levels ?? 0) > (states[i - 1].levels ?? 0) && (s.lastMult ?? 0) >= 3)));
  }
  if (at < 0) at = Math.floor(states.length / 2);
  const s = states[at + 20]!;
  save("gemstone-414x896.png", frame("Gemstone · matchupRev 9", MATCHUP_WORLD_W, MATCHUP_V9_WORLD_H, states, at + 20, (ctx, st, w, h) => drawMatchupArt(ctx, st, { width: w, height: h }),
    `level ${(s.level ?? 0) + 1} · goals ${s.levels} · ice ${s.iceBroken} · treasure ${s.treasures} · cascades +${s.cascadeExtra}`));
}
// Ball Tracker: mid-run with a boosted marble on the board, a gold marble in play and a combo running.
{
  let states: any[] = [], at = -1;
  for (let n = 0; n < 12 && at < 0; n++) {
    states = await play("balltrack", 7, n);
    const game = states[0].__game;
    at = states.findIndex((s) => s.tick > 900 && (s.streak ?? 0) >= 4 && s.balls.some((b: any) => (b.bst ?? 0) > 0) && s.balls.some((b: any) => game.course.gold?.includes(b.id)));
  }
  const game = states[0].__game;
  const s = states[at]!;
  save("ball-tracker-414x896.png", frame("Ball Tracker · btRev 7", BT_W, BT_V7_H, states, at, (ctx, st, w) => {
    const k = w / BT_W;
    ctx.scale(k, k);
    btArtDraw(ctx, game.course, st, game.rotatable);
  }, `home ${s.home} · gold ${s.golds} · boosted ${s.boosts} · combo ×${s.streak}`));
}
