/**
 * Review frames for the skins (a tool, not a check): every look of the named games through scripts/skins/frames.ts,
 * saved as PNGs.   bun scripts/skins/preview.ts <game…> [--out=<dir>] [--only=<frame substring>]
 */
import { createCanvas } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";
import { drawFrames, SKIN_GAMES, type SkinGame } from "./frames";
import { GAME_SKIN_IDS, NO_LOOK, WORLD_THEME_IDS, setSkinReducedMotion } from "../../src/lib/arcade/skins/look";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/skins";
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const games = (process.argv.slice(2).filter((a) => !a.startsWith("--")) as SkinGame[]).filter((g) => SKIN_GAMES.includes(g));
mkdirSync(out, { recursive: true });
setSkinReducedMotion(true);
for (const g of games.length ? games : SKIN_GAMES) {
  const looks = [NO_LOOK, ...GAME_SKIN_IDS[g].map((skin) => ({ skin, world: null })), ...WORLD_THEME_IDS[g].map((world) => ({ skin: null, world })), ...WORLD_THEME_IDS[g].flatMap((world) => GAME_SKIN_IDS[g].slice(0, 1).map((skin) => ({ skin, world })))];
  for (const look of looks) {
    const frames = await drawFrames(g, look);
    for (const f of frames) {
      if (only ? !f.name.includes(only) : !/@1$|^r\d+-s\d+-t\d+$|^scene/.test(f.name)) continue;
      const c = createCanvas(f.w, f.h);
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(f.w, f.h);
      img.data.set(f.data);
      ctx.putImageData(img, 0, 0);
      const tag = [look.skin?.split(".").pop(), look.world ? "world" : null].filter(Boolean).join("+") || "default";
      writeFileSync(`${out}/${g}-${tag}-${f.name.replace(/[@]/g, "x")}.png`, c.toBuffer("image/png"));
    }
  }
}
console.log("wrote", out);
