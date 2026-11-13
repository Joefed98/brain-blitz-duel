/**
 * Cosmetics review (13 Nov 2026), a tool, not a check: every game skin, world theme and card back drawn inside its
 * game by the game's own renderer (scripts/skins/frames.ts: the very draw calls the live stage makes, the sim's own
 * states), under Reduce Motion, beside nothing else — the contact sheet puts the approved still next to it.
 *
 *   phone   — the world at 2 device px a world unit (a phone's arena is about world size at DPR 2)
 *   desktop — the world at 1 px a world unit with its scene round it (the 1440 × 900 "tall" column draws the same
 *             world, upright; Cue Ball turned 90°)
 *
 *   bun docs/cosmetics-review/tools/render-games.ts
 */
import { createCanvas } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";

import { drawFrames, type Frame, type SkinGame } from "../../../scripts/skins/frames";
import { looksFor } from "../../../scripts/skins/looks";
import { setSkinReducedMotion } from "../../../src/lib/arcade/skins/motion.renderer";

const OUT = "docs/cosmetics-review/png/games";
mkdirSync(OUT, { recursive: true });
setSkinReducedMotion(true);

const toPng = (f: Frame) => {
  const c = createCanvas(f.w, f.h);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(f.w, f.h);
  img.data.set(f.data);
  ctx.putImageData(img, 0, 0);
  return c.toBuffer("image/png");
};

/** The in-play frame of the newest revision (the second seed, part way through a run). */
function pick(frames: Frame[], scale: 1 | 2): Frame | undefined {
  const play = frames.filter((f) => /^r\d+-s\d+-t\d+/.test(f.name) && !/-t0(@|$)/.test(f.name));
  const revs = [...new Set(play.map((f) => Number(/^r(\d+)/.exec(f.name)![1])))].sort((a, b) => b - a);
  const newest = play.filter((f) => f.name.startsWith(`r${revs[0]}-`));
  return newest.find((f) => f.name.endsWith(`@${scale}`)) ?? newest.find((f) => !f.name.includes("@"));
}

const games: SkinGame[] = ["pool", "minigolf", "curling", "racing", "freekick", "pokersquares"];
const index: Record<string, { look: string; phone: string; desktop: string; scene?: string }[]> = {};
for (const g of games) {
  for (const look of looksFor(g).filter((l) => !l.back)) {
    // Full House draws no back in these at-rest frames: render-cards.ts draws the backs.
    const frames = await drawFrames(g, look);
    const tag = [look.skin, look.world, look.back].filter(Boolean).join("+") || "default";
    const phone = pick(frames, 2)!;
    const desk = pick(frames, 1)!;
    const scene = frames.find((f) => f.name.startsWith("scene") && (!/-r\d+$/.test(f.name) || f.name.endsWith(`-r${/^r(\d+)/.exec(desk.name)![1]}`))) ?? frames.find((f) => f.name.startsWith("scene"));
    const base = `${g}--${tag}`;
    writeFileSync(`${OUT}/${base}--phone.png`, toPng(phone));
    if (scene) writeFileSync(`${OUT}/${base}--scene.png`, toPng(scene));
    (index[g] ??= []).push({ look: tag, phone: `${base}--phone.png`, desktop: `${base}--desktop.png`, scene: scene ? `${base}--scene.png` : undefined });
  }
  console.log(`${g}: ${index[g]!.length} looks`);
}
writeFileSync("docs/cosmetics-review/tools/games-shots.json", JSON.stringify(index, null, 1));
