/**
 * Tile backgrounds (30 Oct 2026; a design tool, never imported by the app): under each game's tile scene,
 * a small echo of that game's own screen, its colours and design (Hover's synthwave sky and grid,
 * Breaker's navy, Wavefront's purple nebula, Fission's green lab glow, Jaywalk's grass and road, a
 * puzzle's board colours), painted by `bun scripts/shots/tile-scenes.ts` into the same WebP.
 *
 * The style (docs/design-system.md "Game icon tiles"): the background fills the whole TILE × TILE square
 * (the tile's border is drawn over its edge by GameIcon); it is quieter than the game: `fade` darkens
 * all of it (0 none … 1 black) and `spot` darkens a soft disc behind the picture (centre `spotAt`),
 * so busy backgrounds never compete with the scene's pieces. Motifs are few, low-contrast and large
 * enough to read at 34 px as texture, never as pieces. The same picture every build: no clock and no
 * Math.random (a seeded `rand` only).
 */
import { drawPagoda } from "../../../src/lib/arcade/ricochetNinja.renderer";
import type { PuzzleType } from "@/lib/duel/types";

import { TILE } from "./scene";

type Ctx = CanvasRenderingContext2D;

export interface TileBackground {
  paint: (c: Ctx) => void;
  /** Darkens the whole background after painting (0 = as painted). */
  fade?: number;
  /** Darkens a soft disc behind the picture (0 = none, about 0.3–0.6 for busy backgrounds). */
  spot?: number;
  /** The spot's centre (default the tile's centre). */
  spotAt?: [number, number];
}

const T = TILE;

/** A seeded generator (mulberry32): the same picture every build. */
export function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A top-to-bottom gradient over the whole tile ([offset, colour] stops). */
export function vgrad(c: Ctx, stops: [number, string][], y0 = 0, y1 = T): void {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g;
  c.fillRect(0, y0, T, y1 - y0);
}

/** A radial glow (stops from the centre out), drawn over what is there. */
export function radial(c: Ctx, x: number, y: number, r: number, stops: [number, string][]): void {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g;
  c.fillRect(0, 0, T, T);
}

export function fill(c: Ctx, colour: string): void {
  c.fillStyle = colour;
  c.fillRect(0, 0, T, T);
}

/** A square grid of lines every `step` px from (ox, oy). */
export function grid(c: Ctx, step: number, colour: string, width = 1, ox = 0, oy = 0): void {
  c.save();
  c.strokeStyle = colour;
  c.lineWidth = width;
  c.beginPath();
  for (let x = ox % step; x <= T; x += step) {
    c.moveTo(x, 0);
    c.lineTo(x, T);
  }
  for (let y = oy % step; y <= T; y += step) {
    c.moveTo(0, y);
    c.lineTo(T, y);
  }
  c.stroke();
  c.restore();
}

/** Small dots of light (stars, sparkles, bubbles), seeded. */
export function stars(c: Ctx, seed: number, n: number, colours: string[], maxR = 0.9, alpha = 0.8, area: [number, number, number, number] = [0, 0, T, T]): void {
  const r = rand(seed);
  c.save();
  for (let i = 0; i < n; i++) {
    c.globalAlpha = alpha * (0.35 + 0.65 * r());
    c.fillStyle = colours[i % colours.length]!;
    c.beginPath();
    c.arc(area[0] + r() * area[2], area[1] + r() * area[3], 0.3 + r() * maxR, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** CRT scanlines: a dark line every `step` px. */
export function scanlines(c: Ctx, step = 3, alpha = 0.22): void {
  c.save();
  c.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let y = 0; y < T; y += step) c.fillRect(0, y, T, 1);
  c.restore();
}

/** A soft cloud of colour (nebula, glow pools). */
export function cloud(c: Ctx, x: number, y: number, r: number, colour: string, alpha: number): void {
  c.save();
  c.globalAlpha = alpha;
  radial(c, x, y, r, [
    [0, colour],
    [1, "rgba(0,0,0,0)"],
  ]);
  c.restore();
}

/** A synthwave floor: horizon at `y`, lines converging to the vanishing point, rows closing up towards it. */
export function perspectiveGrid(c: Ctx, horizon: number, colour: string, width = 1): void {
  c.save();
  c.strokeStyle = colour;
  c.lineWidth = width;
  c.beginPath();
  const vx = T / 2;
  for (let i = -8; i <= 8; i++) {
    c.moveTo(vx + i * 4, horizon);
    c.lineTo(vx + i * 26, T);
  }
  for (let k = 1; k <= 7; k++) {
    const y = horizon + (T - horizon) * Math.pow(k / 7, 1.8);
    c.moveTo(0, y);
    c.lineTo(T, y);
  }
  c.stroke();
  c.restore();
}

/** Diagonal stripes (a wood grain, a hazard band, a lawn mow) across the tile. */
export function stripes(c: Ctx, step: number, colour: string, width: number, angle = 0): void {
  c.save();
  c.translate(T / 2, T / 2);
  c.rotate(angle);
  c.fillStyle = colour;
  for (let x = -T; x < T; x += step) c.fillRect(x, -T, width, 2 * T);
  c.restore();
}

/** Paints a background, then its fade and spot. */
export function paintTileBackground(c: Ctx, bg: TileBackground): void {
  c.save();
  bg.paint(c);
  c.restore();
  if (bg.fade) {
    c.fillStyle = `rgba(0,0,0,${bg.fade})`;
    c.fillRect(0, 0, T, T);
  }
  if (bg.spot) {
    const [x, y] = bg.spotAt ?? [T / 2, T / 2];
    radial(c, x, y, T * 0.5, [
      [0, `rgba(0,0,0,${bg.spot})`],
      [0.55, `rgba(0,0,0,${bg.spot * 0.6})`],
      [1, "rgba(0,0,0,0)"],
    ]);
  }
}

const bg = (paint: (c: Ctx) => void, opts: Omit<TileBackground, "paint"> = {}): TileBackground => ({ paint, ...opts });

/* ------------------------------------------------------------------ shared worlds */

/** The retro screen's black with its 1 px scanline every 3 px (retro.renderer.ts). */
const retroLines = (c: Ctx) => scanlines(c, 3, 0.28);

/** The fairground stall Flightpath and Swish share: dusk sky to the sunset at the counter, the canopy's stripes on top. */
function fairground(c: Ctx, counter = 84): void {
  vgrad(c, [[0, "#070C26"], [0.3, "#141E4C"], [0.56, "#3B2768"], [0.76, "#7A3878"], [0.9, "#E2703E"], [1, "#FFB466"]], 0, counter);
  stars(c, 31, 18, ["#CFE0FF", "#F4EDE0"], 0.6, 0.7, [0, 12, T, 30]);
  cloud(c, T / 2, counter, 46, "#FFC878", 0.4);
  c.fillStyle = "#21153A";
  c.beginPath();
  c.moveTo(0, counter - 12);
  c.quadraticCurveTo(26, counter - 22, 52, counter - 14);
  c.quadraticCurveTo(80, counter - 6, T, counter - 18);
  c.lineTo(T, counter);
  c.lineTo(0, counter);
  c.fill();
  vgrad(c, [[0, "#B07A47"], [0.12, "#7C4F2C"], [1, "#5C3A20"]], counter, T);
  c.fillStyle = "#4E3019";
  c.fillRect(0, counter + 9, T, 1);
  for (let x = 0; x < T; x += 18) {
    c.fillStyle = (x / 18) % 2 ? "#F4EDE0" : "#D9363E";
    c.fillRect(x, 0, 18, 7);
    c.beginPath();
    c.arc(x + 9, 7, 9, 0, Math.PI);
    c.fill();
  }
}

/** Oak (Tilt, Ball Tracker, the toybox): planks with a soft grain and a lamp pool. */
function oak(c: Ctx, base: string, grain: string, seam: number): void {
  fill(c, base);
  const r = rand(7);
  c.save();
  c.strokeStyle = grain;
  c.globalAlpha = 0.5;
  c.lineWidth = 1;
  for (let y = 4; y < T; y += 7) {
    c.beginPath();
    c.moveTo(0, y);
    c.bezierCurveTo(30, y + (r() - 0.5) * 6, 70, y + (r() - 0.5) * 6, T, y + (r() - 0.5) * 4);
    c.stroke();
  }
  c.restore();
  c.fillStyle = "rgba(70,40,16,0.32)";
  for (let y = seam; y < T; y += seam) c.fillRect(0, y, T, 1);
  radial(c, T / 2, T / 2, 60, [[0, "rgba(255,214,140,0.3)"], [1, "rgba(0,0,0,0)"]]);
  radial(c, T / 2, T / 2, 80, [[0.6, "rgba(0,0,0,0)"], [1, "rgba(40,20,5,0.35)"]]);
}

/** A board's well: a rounded panel of the board's surface with its frame, under the scene's pieces. */
function well(c: Ctx, surface: string, frame: string, inset = 8, radius = 10): void {
  c.save();
  c.fillStyle = surface;
  c.strokeStyle = frame;
  c.lineWidth = 1.5;
  c.beginPath();
  c.roundRect(inset, inset, T - 2 * inset, T - 2 * inset, radius);
  c.fill();
  c.stroke();
  c.restore();
}

/** A board's cell lines inside its well. */
function cells(c: Ctx, n: number, colour: string, inset = 8): void {
  const step = (T - 2 * inset) / n;
  c.save();
  c.strokeStyle = colour;
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 1; i < n; i++) {
    c.moveTo(inset + i * step, inset);
    c.lineTo(inset + i * step, T - inset);
    c.moveTo(inset, inset + i * step);
    c.lineTo(T - inset, inset + i * step);
  }
  c.stroke();
  c.restore();
}

/* ------------------------------------------------------------------ the arcade games */

const ARCADE_BACKGROUNDS: Partial<Record<PuzzleType, TileBackground>> = {
  // The Sports group's scenes (Home Run Derby, Free Kick, Racing) fill the whole tile with their own venue, drawn in
  // this style by their session; these paint each game's base colour under them (night sky, pitch, dusk tarmac).
  homerun: bg((c) => vgrad(c, [[0, "#070C1C"], [0.55, "#111A33"], [0.6, "#0F5A3A"], [1, "#0B3A26"]]), { fade: 0.2 }),
  freekick: bg((c) => vgrad(c, [[0, "#05070B"], [0.4, "#0B1A12"], [0.42, "#0F5A3A"], [1, "#0B4A30"]]), { fade: 0.2 }),
  racing: bg((c) => vgrad(c, [[0, "#2C2F5E"], [0.3, "#6B4778"], [0.32, "#1A1418"], [1, "#121014"]]), { fade: 0.2 }),
  // Minesweeper (Cards & Board): its slate field of raised squares, low-contrast, under a soft vignette.
  minesweeper: bg((c) => {
    vgrad(c, [[0, "#15181D"], [1, "#0B0D11"]]);
    const step = 13;
    for (let y = 0; y < T; y += step) for (let x = 0; x < T; x += step) {
      c.fillStyle = (x / step + y / step) % 2 ? "#1A1F25" : "#1E2329";
      c.fillRect(x + 1, y + 1, step - 2, step - 2);
    }
  }, { fade: 0.25, spot: 0.4 }),
  // Mahjong Solitaire (Cards & Board): its green baize table, a faint warm wood edge round it.
  mahjong: bg((c) => {
    vgrad(c, [[0, "#2A1A10"], [0.08, "#160D07"], [0.1, "#1F6B4E"], [0.9, "#14503A"], [0.92, "#160D07"], [1, "#2A1A10"]]);
    cloud(c, T / 2, T / 2, 56, "#1E7A58", 0.3);
  }, { fade: 0.3, spot: 0.35 }),
  // Free Cell, Summit and Full House (Cards & Board): their scenes lay the game's own blue felt over the whole tile;
  // these paint its base under them (deep navy, lamp-lit at the centre).
  freecell: bg((c) => { vgrad(c, [[0, "#0E2A57"], [1, "#081A38"]]); cloud(c, T / 2, T / 2, 56, "#1A3F7A", 0.3); }, { fade: 0.3, spot: 0.35 }),
  tripeaks: bg((c) => { vgrad(c, [[0, "#0E2A57"], [1, "#081A38"]]); cloud(c, T / 2, T / 2, 56, "#1A3F7A", 0.3); }, { fade: 0.3, spot: 0.35 }),
  pokersquares: bg((c) => { vgrad(c, [[0, "#0E2A57"], [1, "#081A38"]]); cloud(c, T / 2, T / 2, 56, "#1A3F7A", 0.3); }, { fade: 0.3, spot: 0.35 }),
  // Five Hands (Cards & Board, 31 Oct 2026): the same blue felt.
  fivehands: bg((c) => { vgrad(c, [[0, "#0E2A57"], [1, "#081A38"]]); cloud(c, T / 2, T / 2, 56, "#1A3F7A", 0.3); }, { fade: 0.3, spot: 0.35 }),
  // Pyramid and Golf Solitaire (1 Nov 2026): the same blue felt; Muggins its green baize.
  pyramid: bg((c) => { vgrad(c, [[0, "#0E2A57"], [1, "#081A38"]]); cloud(c, T / 2, T / 2, 56, "#1A3F7A", 0.3); }, { fade: 0.3, spot: 0.35 }),
  golfsol: bg((c) => { vgrad(c, [[0, "#0E2A57"], [1, "#081A38"]]); cloud(c, T / 2, T / 2, 56, "#1A3F7A", 0.3); }, { fade: 0.3, spot: 0.35 }),
  muggins: bg((c) => { vgrad(c, [[0, "#0F4A2C"], [1, "#072414"]]); cloud(c, T / 2, T / 2, 56, "#1E7A48", 0.3); }, { fade: 0.3, spot: 0.35 }),
  // Minigolf, Speed Pool and Curling (Sports): their scenes fill the tile with the game's own course, table or sheet;
  // these paint each game's base under them (night turf, the cloth, the ice settling to its far blue).
  minigolf: bg((c) => vgrad(c, [[0, "#0C2216"], [1, "#071510"]]), { fade: 0.2 }),
  pool: bg((c) => { vgrad(c, [[0, "#1F6B45"], [1, "#0F3F28"]]); cloud(c, T / 2, T / 2, 56, "#2A7F55", 0.3); }, { fade: 0.25, spot: 0.35 }),
  curling: bg((c) => vgrad(c, [[0, "#B9C9D6"], [1, "#E9F1F6"]]), { fade: 0.2 }),
  // Blockfall (Retro, 1 Nov 2026): the cabinet's navy fading to black, a cyan haze where the well glows.
  blockfall: bg((c) => {
    vgrad(c, [[0, "#071425"], [1, "#050B16"]]);
    cloud(c, T / 2, T * 0.7, 50, "#36E2F5", 0.12);
    retroLines(c);
  }, { fade: 0.15, spot: 0.25 }),
  // Alley Roll (Sports, 1 Nov 2026): the alley's warm dark room, a glow behind the board.
  alleyroll: bg((c) => {
    vgrad(c, [[0, "#22090E"], [1, "#3A121A"]]);
    cloud(c, T / 2, T / 2, 56, "#FFBE6E", 0.18);
  }, { fade: 0.25, spot: 0.35 }),
  // Hover: its deep space lifting to a synthwave violet at the horizon, a faint magenta grid floor below.
  hover: bg((c) => {
    vgrad(c, [[0, "#02030A"], [0.35, "#080B20"], [0.62, "#2A0E4A"], [0.7, "#5A1A6E"], [0.7, "#0A0614"], [1, "#05030A"]]);
    stars(c, 11, 26, ["#FFFFFF", "#CFD8FF", "#A9BDFF", "#FFE9C4"], 0.7, 0.75, [0, 0, T, 66]);
    cloud(c, T / 2, 72, 40, "#FF5FD0", 0.28);
    perspectiveGrid(c, 73, "rgba(255,95,208,0.32)");
    retroLines(c);
  }, { fade: 0.1, spot: 0.25 }),
  // Breaker: its navy fading to black, a blue glow above, pixel stars.
  breaker: bg((c) => {
    vgrad(c, [[0, "#071433"], [0.45, "#060F28"], [0.85, "#030817"], [1, "#010206"]]);
    cloud(c, 52, 24, 60, "#1C3C8C", 0.45);
    cloud(c, 16, 84, 40, "#3A2A8C", 0.22);
    stars(c, 12, 22, ["#FFFFFF", "#BFD4FF", "#E6D8FF"], 0.5, 0.6);
    retroLines(c);
  }),
  // Rally: the dark checker court, blue glow, the dashed centre line and dotted circle in #1F6F8B.
  rally: bg((c) => {
    for (let y = 0; y < T; y += 13) for (let x = 0; x < T; x += 13) {
      c.fillStyle = (x + y) % 26 ? "#04080B" : "#020507";
      c.fillRect(x, y, 13, 13);
    }
    cloud(c, T / 2, T / 2, 70, "#123A8C", 0.5);
    cloud(c, T / 2, 0, 40, "#7A2C8C", 0.16);
    grid(c, 13, "rgba(31,111,139,0.14)");
    c.save();
    c.strokeStyle = "rgba(31,111,139,0.75)";
    c.lineWidth = 1.5;
    c.setLineDash([5, 5]);
    c.beginPath();
    c.moveTo(0, T / 2);
    c.lineTo(T, T / 2);
    c.stroke();
    c.setLineDash([2, 4]);
    c.beginPath();
    c.arc(T / 2, T / 2, 22, 0, Math.PI * 2);
    c.stroke();
    c.restore();
    retroLines(c);
  }, { spot: 0.3 }),
  // Wavefront: violet space with its purple and blue nebulae and stars.
  wavefront: bg((c) => {
    vgrad(c, [[0, "#0D0B22"], [0.6, "#08081A"], [1, "#07070C"]]);
    cloud(c, 86, 14, 70, "#9646DC", 0.45);
    cloud(c, 14, 88, 60, "#3264EB", 0.38);
    cloud(c, 52, 50, 50, "#6E50F0", 0.22);
    stars(c, 13, 30, ["#FFF4E0", "#C9D6FF", "#FFFFFF"], 0.6, 0.8);
  }, { spot: 0.2 }),
  // Fission: the green-black lab with its floor glow rising and green-teal pools.
  burst: bg((c) => {
    vgrad(c, [[0, "#020604"], [0.6, "#03100A"], [1, "#072019"]]);
    cloud(c, T / 2, T + 6, 70, "#0F7A45", 0.75);
    cloud(c, 14, 16, 46, "#0B5A3A", 0.4);
    cloud(c, 96, 46, 40, "#126B5A", 0.32);
    stars(c, 14, 16, ["#FFFFFF", "#B8FFD0", "#9FF5EA"], 0.5, 0.55);
    retroLines(c);
  }),
  // Tempo: the purple synthwave stage, its four neon lanes faint, the magenta glow on the hit line.
  beat: bg((c) => {
    vgrad(c, [[0, "#0D0619"], [0.4, "#1A0A33"], [0.75, "#2A0E4A"], [1, "#0D0A14"]]);
    const lanes = ["#3DFFE0", "#FFD84A", "#B49CFF", "#5CD0FF"];
    for (let i = 0; i < 4; i++) {
      c.fillStyle = lanes[i]!;
      c.globalAlpha = 0.07;
      c.fillRect(8 + i * 22, 0, 22, T);
      c.globalAlpha = 0.35;
      c.fillRect(8 + i * 22, 0, 1, T);
    }
    c.globalAlpha = 0.35;
    c.fillRect(96, 0, 1, T);
    c.globalAlpha = 1;
    cloud(c, T / 2, 80, 50, "#C23CFF", 0.35);
  }, { fade: 0.2, spot: 0.3 }),
  // Meteor: near black with violet and teal nebulae, stars and the faint green board grid.
  snake: bg((c) => {
    fill(c, "#04030A");
    cloud(c, 14, 16, 60, "#5B2A9E", 0.6);
    cloud(c, 92, 90, 56, "#137A78", 0.5);
    cloud(c, 52, 52, 40, "#7A3FC4", 0.2);
    stars(c, 15, 22, ["#FFFFFF", "#CFC4FF", "#9FF5EA", "#FFE9A8"], 0.5, 0.7);
    grid(c, 13, "rgba(75,255,122,0.09)");
    retroLines(c);
  }, { spot: 0.15 }),
  // Orbit: black space and its white star layers (no nebula since 27 Oct).
  orbit: bg((c) => {
    fill(c, "#06060F");
    stars(c, 16, 44, ["#FFFFFF", "#D6E4FF", "#FFF0D6"], 0.7, 0.75);
    stars(c, 17, 6, ["#BFD8FF"], 1.1, 0.9);
  }),
  // Jaywalk: the evening verges and the asphalt with its dashed lane lines, a dusk wash and a lamp pool.
  cross: bg((c) => {
    fill(c, "#2F4B31");
    c.fillStyle = "#5F646E";
    c.fillRect(0, 14, T, 8);
    c.fillRect(0, 82, T, 8);
    c.fillStyle = "#25292F";
    c.fillRect(0, 22, T, 60);
    c.fillStyle = "rgba(248,250,252,0.6)";
    for (const y of [42, 62]) for (let x = 2; x < T; x += 22) c.fillRect(x, y, 10, 1.5);
    fill(c, "rgba(16,22,58,0.22)");
    cloud(c, 18, 96, 34, "#FFC478", 0.35);
    cloud(c, 88, 8, 30, "#FFC478", 0.3);
  }, { fade: 0.2 }),
  // Pinball: the rich purple table with colour pools and the magenta horizon grid low down.
  pinball: bg((c) => {
    vgrad(c, [[0, "#3A1468"], [0.5, "#25094A"], [1, "#13052A"]]);
    cloud(c, 20, 30, 34, "#3DFFE0", 0.12);
    cloud(c, 86, 40, 34, "#FF4FD8", 0.14);
    cloud(c, 50, 80, 40, "#FFD84A", 0.08);
    perspectiveGrid(c, 64, "rgba(255,77,255,0.16)");
    stripes(c, 5, "rgba(255,255,255,0.025)", 1, -0.8);
    radial(c, T / 2, T / 2, 80, [[0.55, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.45)"]]);
  }, { fade: 0.15, spot: 0.25 }),
  // Flightpath: the fairground stall's dusk sky, canopy and counter.
  bullseye: bg((c) => fairground(c, 86), { fade: 0.3, spot: 0.35 }),
  // Swish: the same fairground stall.
  bintoss: bg((c) => fairground(c, 88), { fade: 0.3, spot: 0.35 }),
  // Slice: the chopping board's three planks with grain, the tiled strip above.
  slice: bg((c) => {
    vgrad(c, [[0, "#EEF6F4"], [1, "#C4D6D2"]], 0, 14);
    c.fillStyle = "#A5BFBA";
    c.fillRect(0, 7, T, 1);
    for (let x = 0; x < T; x += 20) c.fillRect(x + ((x / 20) % 2 ? 10 : 0), 0, 1, 14);
    const planks = ["#A87448", "#B88554", "#A06B42"];
    for (let i = 0; i < 3; i++) {
      c.fillStyle = planks[i]!;
      c.fillRect(i * 35, 14, 35, T);
      c.fillStyle = "rgba(48,24,8,0.55)";
      c.fillRect(i * 35, 14, 1, T);
    }
    c.strokeStyle = "rgba(98,58,30,0.42)";
    for (let x = 6; x < T; x += 9) {
      c.beginPath();
      c.moveTo(x, 14);
      c.bezierCurveTo(x + 3, 44, x - 3, 70, x + 2, T);
      c.stroke();
    }
    cloud(c, T / 2, 50, 60, "#FFD696", 0.25);
  }, { fade: 0.42, spot: 0.25 }),
  // Tilt: the oak board under its lamp.
  tilt: bg((c) => oak(c, "#C99A62", "#A87843", 29), { fade: 0.42, spot: 0.2 }),
  // Gemstone: the velvet with its violet glow and the checker sockets of the board.
  matchup: bg((c) => {
    vgrad(c, [[0, "#1B1131"], [0.55, "#130E21"], [1, "#0B0B0F"]]);
    well(c, "#2A1748", "rgba(245,184,46,0.3)", 6, 14);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      c.fillStyle = (x + y) % 2 ? "#15151C" : "#101017";
      c.fillRect(12 + x * 20, 12 + y * 20, 20, 20);
    }
    cloud(c, T / 2, T / 2, 60, "#7850C8", 0.25);
  }),
  // High Rise: the night sky with stars and moon, the far indigo towers with lit windows.
  skyline: bg((c) => {
    vgrad(c, [[0, "#060B1F"], [0.55, "#121A44"], [1, "#2B2766"]]);
    stars(c, 18, 20, ["#FFF1D0", "#E5EDFF"], 0.5, 0.7, [0, 0, T, 60]);
    cloud(c, 86, 16, 18, "#FBFCEF", 0.35);
    c.fillStyle = "#FBFCEF";
    c.beginPath();
    c.arc(86, 16, 5, 0, Math.PI * 2);
    c.fill();
    cloud(c, T / 2, T, 50, "#966ED2", 0.3);
    const r = rand(19);
    for (let x = -4; x < T; x += 13) {
      const h = 22 + r() * 34;
      c.fillStyle = "#1E2150";
      c.fillRect(x, T - h, 11, h);
      c.fillStyle = "rgba(169,184,255,0.45)";
      for (let wy = T - h + 4; wy < T - 3; wy += 6) for (let wx = x + 2; wx < x + 10; wx += 4) if (r() > 0.45) c.fillRect(wx, wy, 1.5, 2);
    }
  }, { fade: 0.15, spot: 0.25 }),
  // Coral Pop: the blue water deepening, caustic ripples near the top, the reef's sand at the bottom.
  bubble: bg((c) => {
    vgrad(c, [[0, "#1D6A9E"], [0.45, "#0C3561"], [1, "#06172E"]]);
    c.save();
    c.strokeStyle = "rgba(216,240,255,0.14)";
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.ellipse(10 + i * 18, 10 + (i % 2) * 8, 10, 3, 0.3, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
    stars(c, 20, 18, ["#CFE8F5"], 0.5, 0.5);
    vgrad(c, [[0, "#B89C6A"], [0.5, "#9A8058"], [1, "#6E5A3E"]], 92, T);
  }, { fade: 0.15, spot: 0.25 }),
  // Roofbound: the lava cave: basalt ceiling and floor with glowing veins, the dark tunnel air between.
  flip: bg((c) => {
    vgrad(c, [[0, "#1E1412"], [0.5, "#080A0C"], [1, "#1E1412"]]);
    vgrad(c, [[0, "#111115"], [1, "#34313B"]], 0, 14);
    vgrad(c, [[0, "#34313B"], [1, "#111115"]], 90, T);
    c.strokeStyle = "rgba(255,74,36,0.7)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, 14);
    c.lineTo(T, 14);
    c.moveTo(0, 90);
    c.lineTo(T, 90);
    c.stroke();
    cloud(c, T / 2, 96, 40, "#FF4A24", 0.25);
    stars(c, 21, 8, ["#6FE3C8", "#C8FFF0"], 0.6, 0.5, [0, 18, T, 68]);
  }),
  // Rainbow Bridge: the daytime sky, the sun's haze top right and the green hill.
  inkbridge: bg((c) => {
    vgrad(c, [[0, "#2A86DA"], [0.45, "#6BBDF0"], [0.85, "#C3E8F8"], [1, "#E4F5FA"]]);
    cloud(c, 90, 12, 40, "#FFFCE4", 0.8);
    c.fillStyle = "rgba(146,206,128,0.8)";
    c.beginPath();
    c.moveTo(0, 80);
    c.quadraticCurveTo(40, 66, T, 78);
    c.lineTo(T, T);
    c.lineTo(0, T);
    c.fill();
    vgrad(c, [[0, "#78C957"], [1, "#3C8A36"]], 88, T);
  }, { fade: 0.4, spot: 0.2 }),
  // Ball Tracker: the oak toy board's bevelled square tiles under the lamp.
  balltrack: bg((c) => {
    fill(c, "#C99A62");
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const px = 2 + x * 26;
      const py = 2 + y * 26;
      c.fillStyle = "rgba(255,238,205,0.35)";
      c.fillRect(px, py, 24, 2);
      c.fillStyle = "rgba(62,30,8,0.4)";
      c.fillRect(px, py + 22, 24, 2);
    }
    radial(c, T / 2, T / 2, 60, [[0, "rgba(255,220,160,0.3)"], [1, "rgba(0,0,0,0)"]]);
    radial(c, T / 2, T / 2, 80, [[0.6, "rgba(0,0,0,0)"], [1, "rgba(40,20,5,0.35)"]]);
  }, { fade: 0.45, spot: 0.2 }),
  // Grappler: the dark cavern, rock overhead, the lava's glow at the bottom.
  swing: bg((c) => {
    vgrad(c, [[0, "#0A070B"], [0.6, "#160B0C"], [1, "#2A0D08"]]);
    vgrad(c, [[0, "#0C090B"], [1, "#241A1D"]], 0, 12);
    c.fillStyle = "#160D10";
    for (const [x, h] of [[18, 14], [52, 10], [84, 16]] as const) {
      c.beginPath();
      c.moveTo(x - 7, 12);
      c.lineTo(x, 12 + h);
      c.lineTo(x + 7, 12);
      c.fill();
    }
    vgrad(c, [[0, "#FFB23A"], [0.2, "#FF5A1F"], [0.6, "#B3200F"], [1, "#4A0B08"]], 94, T);
    cloud(c, T / 2, T, 50, "#FF5A1F", 0.35);
  }),
  // Scrumper (retired): the orchard's sky and green hill.
  snip: bg((c) => {
    vgrad(c, [[0, "#5EAFE6"], [0.55, "#89CEF2"], [1, "#D4EEF8"]]);
    cloud(c, 90, 14, 30, "#FFFBE6", 0.7);
    vgrad(c, [[0, "#98D674"], [0.5, "#65B94B"], [1, "#408B37"]], 86, T);
  }, { fade: 0.4, spot: 0.2 }),
  // Junction (retired): daylight grass and the crossing roads.
  junction: bg((c) => {
    fill(c, "#86BF63");
    c.fillStyle = "#555B64";
    c.fillRect(36, 0, 32, T);
    c.fillRect(0, 36, T, 32);
    c.fillStyle = "#F4F6F8";
    for (let i = 0; i < T; i += 10) {
      c.fillRect(51.5, i, 1, 5);
      c.fillRect(i, 51.5, 5, 1);
    }
  }, { fade: 0.45, spot: 0.15 }),
  // The other retired arcade games: their dark arena and its one accent.
  swerve: bg((c) => {
    fill(c, "#0B0B0F");
    c.fillStyle = "rgba(247,247,248,0.12)";
    for (const x of [34, 69]) for (let y = 0; y < T; y += 14) c.fillRect(x, y, 1.5, 8);
  }),
  steady: bg((c) => {
    fill(c, "#0B0B0F");
    c.fillStyle = "rgba(46,211,183,0.12)";
    c.fillRect(0, 40, T, 24);
  }),
  dual: bg((c) => {
    fill(c, "#0B0B0F");
    c.fillStyle = "rgba(255,255,255,0.12)";
    c.fillRect(51.5, 0, 1, T);
  }),
  // Ricochet (ricoRev 2): the night over the temple, the moon and the distant pagoda between the walls.
  ricochet: bg((c) => {
    vgrad(c, [[0, "#070A18"], [0.55, "#121A36"], [1, "#1E2240"]]);
    stars(c, 47, 14, ["#E8ECFF"], 0.6, 0.7, [22, 0, 60, 60]);
    cloud(c, 66, 22, 22, "#FFF0CD", 0.3);
    c.fillStyle = "#FBF1D6";
    c.beginPath();
    c.arc(66, 22, 9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#151A33";
    c.fillRect(0, 86, T, T - 86);
    drawPagoda(c as CanvasRenderingContext2D, 52, 92, 0.42);
  }),
  // Bastion (bastionRev 2): the slate dusk sky over the earth field (the mockups' palette).
  bastion: bg((c) => {
    vgrad(c, [[0, "#2A3240"], [0.42, "#46515F"], [0.45, "#6F5E46"], [1, "#5A4B37"]]);
  }, { fade: 0.2 }),
  rooftop: bg((c) => {
    vgrad(c, [[0, "#05050A"], [1, "#1B1530"]]);
    c.strokeStyle = "rgba(245,184,46,0.25)";
    c.beginPath();
    for (const dx of [-30, -10, 10, 30]) {
      c.moveTo(T / 2 + dx * 0.3, 30);
      c.lineTo(T / 2 + dx * 2, T);
    }
    c.stroke();
  }),
  hotfloor: bg((c) => {
    fill(c, "#07070D");
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      c.fillStyle = "#14141D";
      c.beginPath();
      c.roundRect(3 + x * 20, 3 + y * 20, 18, 18, 4);
      c.fill();
    }
  }, { fade: 0.1 }),
  dig: bg((c) => {
    categoryScreen(c, "logic");
    board(c, "#1E1F25", "#0B0B0F", "rgba(245,184,46,0.25)", { cells: 5 });
  }),
  // Letterfall (retired; Word): the oak well on its dark tabletop.
  wordfall: bg((c) => {
    radial(c, T / 2, T / 2, 80, [[0, "#5A3E2A"], [1, "#2A1C14"]]);
    c.fillStyle = "#C99A62";
    c.fillRect(14, 0, 76, T);
    c.fillStyle = "rgba(70,40,15,0.22)";
    for (let x = 14 + 19; x < 90; x += 19) c.fillRect(x, 0, 1, T);
  }, { fade: 0.45, spot: 0.2 }),
  // Engine games (their own categories' puzzles on the arcade stage).
  // Tenfall: its oak board with four carved lanes and the dark rails between.
  tendrop: bg((c) => {
    vgrad(c, [[0, "#E4BA80"], [0.55, "#C99A62"], [1, "#A97A44"]]);
    for (let i = 1; i < 4; i++) {
      c.fillStyle = "#6B4426";
      c.fillRect(i * 26 - 1, 0, 2, T);
    }
    vgrad(c, [[0, "rgba(43,26,14,0.55)"], [1, "rgba(43,26,14,0)"]], 0, 16);
  }, { fade: 0.45, spot: 0.2 }),
  // Mixed Signals: the dark stage, its dot grid and lane wells.
  stroop: bg((c) => {
    fill(c, "#07070D");
    radial(c, T / 2, T / 2, 70, [[0, "rgba(40,44,72,0.5)"], [1, "rgba(0,0,0,0)"]]);
    c.fillStyle = "rgba(255,255,255,0.05)";
    for (let i = 1; i < 4; i++) c.fillRect(i * 26, 0, 1, T);
    stars(c, 22, 0, ["#fff"]);
    for (let y = 4; y < T; y += 8) for (let x = 4; x < T; x += 8) c.fillRect(x, y, 1, 1);
  }),
  // Bonk: the meadow with its mown bands.
  whack: bg((c) => {
    vgrad(c, [[0, "#36552A"], [1, "#27401F"]]);
    c.fillStyle = "rgba(255,255,255,0.06)";
    for (let y = 8; y < T; y += 32) c.fillRect(0, y, T, 14);
    stars(c, 23, 30, ["#4E7638", "#1E3318"], 0.6, 0.8);
  }, { fade: 0.2 }),
  // Pull!: the blue sky to the horizon, the tree line and the mown grass.
  clayshoot: bg((c) => {
    vgrad(c, [[0, "#1C4774"], [0.5, "#3A78AE"], [0.85, "#79AFD8"], [1, "#B4D3E7"]], 0, 78);
    cloud(c, 86, 14, 30, "#FFE9B0", 0.5);
    c.fillStyle = "#22432F";
    c.fillRect(0, 74, T, 6);
    vgrad(c, [[0, "#557E3C"], [1, "#2A4723"]], 80, T);
    c.fillStyle = "rgba(255,255,255,0.05)";
    for (let x = 0; x < T; x += 20) c.fillRect(x, 80, 10, T);
  }, { fade: 0.3, spot: 0.2 }),
};

/* ------------------------------------------------------------------ the puzzles */

/** Each puzzle category's accent and its deep tint (game-frame.css: accent 10 % into #0D0D0F). */
const CAT: Record<string, [string, string]> = {
  word: ["#4D8CFF", "#131A27"],
  number: ["#3DDC84", "#12221B"],
  speed: ["#FF8A3D", "#251A14"],
  attention: ["#FF6BD6", "#251623"],
  pattern: ["#B26BFF", "#1E1627"],
  logic: ["#2ED3B7", "#102120"],
};

/** The puzzle play screen (game-frame.css): deep → #0D0D0F → deep, the accent's glow from the top and bottom, the vignette. */
function categoryScreen(c: Ctx, category: string): void {
  const [accent, deep] = CAT[category]!;
  vgrad(c, [[0, deep], [0.45, "#0D0D0F"], [0.6, "#0D0D0F"], [1, deep]]);
  c.save();
  c.globalAlpha = 0.32;
  c.translate(T / 2, 0);
  c.scale(1.3, 0.45);
  radial(c, 0, 0, T * 0.65, [[0, accent], [1, "rgba(0,0,0,0)"]]);
  c.restore();
  c.save();
  c.globalAlpha = 0.22;
  c.translate(T / 2, T);
  c.scale(1.2, 0.4);
  radial(c, 0, 0, T * 0.7, [[0, accent], [1, "rgba(0,0,0,0)"]]);
  c.restore();
  radial(c, T / 2, T / 2, T * 0.75, [[0.55, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.5)"]]);
}

/** A board panel: its surface (a top → bottom pair), its frame, optional cell lines. */
function board(c: Ctx, top: string, bottom: string, frame: string, opts: { inset?: number; radius?: number; cells?: number; line?: string } = {}): void {
  const inset = opts.inset ?? 7;
  c.save();
  c.beginPath();
  c.roundRect(inset, inset, T - 2 * inset, T - 2 * inset, opts.radius ?? 10);
  const g = c.createLinearGradient(0, inset, 0, T - inset);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = frame;
  c.lineWidth = 1.5;
  c.stroke();
  c.clip();
  if (opts.cells) cells(c, opts.cells, opts.line ?? "rgba(255,255,255,0.06)", inset);
  c.restore();
}

/** A puzzle tile: its category's screen, then its board's look (motif), a little faded. */
const pz = (category: string, motif?: (c: Ctx) => void, opts: Omit<TileBackground, "paint"> = {}): TileBackground =>
  bg((c) => {
    categoryScreen(c, category);
    motif?.(c);
  }, opts);

const graphPaper = (c: Ctx, top: string, step: number) => {
  board(c, top, "#14141B", "rgba(61,220,132,0.25)");
  grid(c, step, "rgba(255,255,255,0.04)", 1, 7, 7);
};

const PUZZLE_BACKGROUNDS: Partial<Record<PuzzleType, TileBackground>> = {
  // Word: letter-tile boards washed blue.
  codeword: pz("word", (c) => board(c, "#181E2E", "#0A0A0D", "rgba(77,140,255,0.3)", { cells: 5 })),
  letterwheel: pz("word", (c) => {
    c.fillStyle = "#1F2941";
    c.beginPath();
    c.arc(T / 2, T / 2, 44, 0, Math.PI * 2);
    c.fill();
    radial(c, T / 2, T / 2, 44, [[0.6, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.4)"]]);
  }),
  strikeout: pz("word", (c) => board(c, "#1A1F2C", "#0E0F14", "rgba(77,140,255,0.22)", { inset: 10 })),
  swapword: pz("word", (c) => board(c, "#24242C", "#16161D", "#3C3C44", { cells: 5 })),
  tilegrid: pz("word", (c) => board(c, "#161E30", "#0E1018", "rgba(77,140,255,0.3)", { cells: 5 })),
  wordhunt: pz("word", (c) => board(c, "#18213A", "#0E1220", "rgba(77,140,255,0.3)", { cells: 4 })),
  wordsearch: pz("word", (c) => board(c, "#1A2440", "#0D1019", "rgba(77,140,255,0.3)", { cells: 6 })),
  wordslide: pz("word", (c) => board(c, "#161E30", "#0E1018", "rgba(77,140,255,0.3)", { cells: 5 })),
  wordsmith: pz("word", (c) => cloud(c, T / 2, T / 2, 50, "#4D8CFF", 0.35)),
  // Number.
  balance: pz("number", (c) => {
    vgrad(c, [[0, "#261F16"], [0.6, "#1A1510"], [1, "#120F0C"]]);
    cloud(c, T / 2, 10, 50, "#D6AA54", 0.25);
    vgrad(c, [[0, "#7A5030"], [1, "#2A180B"]], 86, T);
  }),
  // Kakuro (1 Nov 2026): its board's dark clue cells and glass squares.
  kakuro: pz("number", (c) => board(c, "#1C1F26", "#101116", "rgba(61,220,132,0.3)", { cells: 6, line: "rgba(255,255,255,0.05)" })),
  checkout: pz("number", (c) => {
    vgrad(c, [[0, "#0D1838"], [0.8, "#3B2C63"], [1, "#F08A3C"]]);
    stars(c, 41, 14, ["#FFD27A"], 0.7, 0.6, [0, 0, T, 50]);
  }, { fade: 0.25 }),
  equation: pz("number", (c) => graphPaper(c, "#203832", 12)),
  measure: pz("number", (c) => {
    cloud(c, T / 2, 30, 50, "#78AFFF", 0.18);
    c.fillStyle = "rgba(220,236,255,0.12)";
    c.fillRect(6, 88, T - 12, 2);
  }),
  numpyramid: pz("number", (c) => {
    const r = rand(42);
    for (let row = 0; row < 4; row++) for (let i = 0; i <= row; i++) {
      const w = 22;
      c.fillStyle = r() > 0.5 ? "#D5B27A" : "#B48B52";
      c.globalAlpha = 0.28;
      c.fillRect(T / 2 - ((row + 1) * w) / 2 + i * w + 1, 14 + row * 22, w - 2, 20);
    }
    c.globalAlpha = 1;
  }),
  numline: pz("number", (c) => {
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.fillRect(0, 60, T, 16);
    c.fillStyle = "rgba(61,220,132,0.22)";
    c.fillRect(0, 67, T, 2);
  }),
  target: pz("number", (c) => graphPaper(c, "#203A33", 11)),
  // Speed.
  chain: pz("speed", (c) => {
    board(c, "#2C2122", "#0F0E13", "rgba(255,138,61,0.22)");
    stripes(c, 4, "rgba(255,255,255,0.025)", 1, 0.78);
  }),
  numhunt: pz("speed", (c) => {
    board(c, "#322625", "#0C0C10", "rgba(255,138,61,0.22)");
    grid(c, 14, "rgba(255,255,255,0.04)", 1, 7, 7);
  }),
  reaction: pz("speed", (c) => {
    board(c, "#26262E", "#121216", "rgba(255,138,61,0.55)", { inset: 9, radius: 12 });
    scanlines(c, 3, 0.18);
  }),
  stopwatch: pz("speed", (c) => {
    cloud(c, T / 2, T / 2, 56, "#FF8A3D", 0.25);
    c.fillStyle = "#23232B";
    c.beginPath();
    c.arc(T / 2, T / 2, 44, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#44444F";
    c.lineWidth = 3;
    c.stroke();
  }),
  // Attention.
  countup: pz("attention", (c) => {
    board(c, "#342939", "#111217", "rgba(255,107,214,0.22)");
    for (let y = 10; y < T - 7; y += 5) for (let x = 10; x < T - 7; x += 5) {
      c.fillStyle = "rgba(255,255,255,0.03)";
      c.fillRect(x, y, 1, 1);
    }
  }),
  maze: pz("attention", (c) => board(c, "#2A313B", "#161B21", "rgba(142,154,168,0.5)", { cells: 6, line: "rgba(142,154,168,0.14)" })),
  pairmatch: pz("attention", (c) => {
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      c.fillStyle = "rgba(72,38,67,0.65)";
      c.beginPath();
      c.roundRect(8 + x * 30, 8 + y * 30, 26, 26, 5);
      c.fill();
    }
  }),
  spotdiff: pz("attention", (c) => {
    board(c, "#2A2230", "#1A1620", "rgba(255,107,214,0.35)", { inset: 6 });
    c.fillStyle = "rgba(138,90,52,0.35)";
    c.fillRect(6, 50, T - 12, 3);
  }),
  symscan: pz("attention", (c) => {
    fill(c, "rgba(56,27,52,0.6)");
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      c.fillStyle = "rgba(44,69,89,0.55)";
      c.fillRect(6 + x * 23.5, 6 + y * 23.5, 21, 21);
    }
  }, { fade: 0.1 }),
  // Pattern.
  blockparty: pz("pattern", (c) => {
    board(c, "#2B2D3A", "#181921", "rgba(178,107,255,0.22)");
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      c.fillStyle = "#14151B";
      c.beginPath();
      c.arc(17 + x * 17.5, 17 + y * 17.5, 3, 0, Math.PI * 2);
      c.fill();
    }
  }),
  flow: pz("pattern", (c) => board(c, "#15171E", "#0B0C10", "#3D4252", { cells: 5, line: "rgba(61,66,82,0.6)" })),
  gravity: pz("pattern", (c) => board(c, "#1D2333", "#0F131C", "#3A4052", { inset: 6 })),
  iceslide: pz("pattern", (c) => {
    board(c, "#3A5063", "#1A2733", "#1D2A36", { cells: 5, line: "rgba(191,224,245,0.08)" });
    c.strokeStyle = "rgba(191,224,245,0.12)";
    c.beginPath();
    c.moveTo(20, 30);
    c.lineTo(60, 22);
    c.moveTo(40, 80);
    c.lineTo(86, 70);
    c.stroke();
  }, { fade: 0.15 }),
  laser: pz("pattern", (c) => board(c, "#14161D", "#0B0C10", "rgba(245,198,76,0.2)", { cells: 5 })),
  pipes: pz("pattern", (c) => board(c, "#343B45", "#1B2027", "#2F3640", { cells: 4, line: "rgba(0,0,0,0.35)" })),
  push: pz("pattern", (c) => {
    fill(c, "#24201C");
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      const wall = x === 0 || y === 0 || x === 4 || y === 4;
      c.fillStyle = wall ? "#682F23" : "rgba(142,135,124,0.35)";
      c.fillRect(x * 21 + 0.5, y * 21 + 0.5, 20, 20);
    }
  }, { fade: 0.3 }),
  rings: pz("pattern", (c) => {
    fill(c, "#17181C");
    radial(c, T / 2, T / 2, 46, [[0, "#8F959E"], [0.9, "#4C5158"], [1, "rgba(0,0,0,0)"]]);
  }, { fade: 0.5 }),
  tiles: pz("pattern", (c) => board(c, "#1D1D25", "#131319", "rgba(178,107,255,0.3)", { cells: 5, line: "#060609" })),
  unblock: pz("pattern", (c) => {
    board(c, "#2C2E34", "#1A1B20", "#4C4F58", { inset: 6 });
    c.fillStyle = "rgba(233,228,210,0.14)";
    for (let i = 1; i < 6; i++) c.fillRect(6 + i * 15.3, 6, 1, T - 12);
  }),
  // Logic.
  bomb: pz("logic", (c) => {
    board(c, "#23252C", "#121318", "#3A3D45");
    c.fillStyle = "rgba(245,184,46,0.25)";
    for (let x = 7; x < T - 7; x += 8) c.fillRect(x, 7, 4, 3);
  }),
  flood: pz("logic", (c) => {
    const cols = ["#C94B83", "#3A6EE6", "#47BFA6", "#E3C548", "#E57D24"];
    const r = rand(43);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      c.fillStyle = cols[Math.floor(r() * 5)]!;
      c.fillRect(x * 17.4, y * 17.4, 17.4, 17.4);
    }
  }, { fade: 0.72 }),
  lightup: pz("logic", (c) => {
    board(c, "#1E1A14", "#110F0B", "#585961", { cells: 5, line: "rgba(88,89,97,0.25)" });
    cloud(c, 30, 30, 34, "#FFDC82", 0.18);
  }),
  lightsout: pz("logic", (c) => {
    board(c, "#17181E", "#0E0F13", "rgba(46,211,183,0.25)");
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      c.fillStyle = (x + y) % 3 === 0 ? "rgba(90,67,23,0.55)" : "#191A21";
      c.beginPath();
      c.arc(22 + x * 20, 22 + y * 20, 7, 0, Math.PI * 2);
      c.fill();
    }
  }),
  sudoku: pz("logic", (c) => {
    board(c, "#16161D", "#101016", "rgba(233,230,239,0.45)", { cells: 6 });
    c.fillStyle = "rgba(46,211,183,0.08)";
    c.fillRect(7, 7, 45, 30);
    c.fillRect(52, 37, 45, 30);
  }),
  nonogram: pz("logic", (c) => board(c, "#141A1A", "#0E1013", "rgba(46,211,183,0.25)", { cells: 6, line: "rgba(0,0,0,0.5)" })),
  safe: pz("logic", (c) => {
    vgrad(c, [[0, "#4A4F5A"], [0.5, "#2A2E36"], [1, "#1C1F25"]]);
    for (const [x, y] of [[8, 8], [96, 8], [8, 96], [96, 96]] as const) {
      c.fillStyle = "#8A909C";
      c.beginPath();
      c.arc(x, y, 2.2, 0, Math.PI * 2);
      c.fill();
    }
  }, { fade: 0.35 }),
  shikaku: pz("logic", (c) => board(c, "#2A2C33", "#15161B", "rgba(10,10,14,0.85)", { cells: 5, line: "rgba(10,10,14,0.8)" })),
  // The new grid puzzles (1 Nov 2026): their dark glass boards.
  fences: pz("logic", (c) => board(c, "#1E2027", "#111217", "rgba(46,211,183,0.3)", { cells: 6, line: "rgba(255,255,255,0.05)" })),
  fillomino: pz("logic", (c) => board(c, "#20222A", "#121318", "rgba(10,10,14,0.85)", { cells: 7, line: "rgba(10,10,14,0.7)" })),
  bridges: pz("logic", (c) => {
    board(c, "#10222A", "#0A1216", "rgba(46,211,183,0.3)");
    cloud(c, T / 2, T / 2, 46, "#2ED3B7", 0.1);
  }),
  tubes: pz("logic", (c) => cloud(c, T / 2, 60, 50, "#2ED3B7", 0.15)),
  tents: pz("logic", (c) => {
    board(c, "#17221A", "#0D140F", "rgba(61,138,74,0.35)", { cells: 5, line: "rgba(0,0,0,0.3)" });
    stars(c, 44, 30, ["#2F7A45", "#1E5631"], 0.6, 0.5, [8, 8, 88, 88]);
  }),
  tower: pz("logic", (c) => {
    c.fillStyle = "rgba(107,68,35,0.55)";
    c.fillRect(6, 90, T - 12, 6);
  }),
  trail: pz("logic", (c) => {
    board(c, "#18382C", "#0C110B", "#0F150D");
    stars(c, 45, 40, ["#263322", "#161E13"], 1.4, 0.7, [8, 8, 88, 88]);
  }),
};

export const TILE_BACKGROUNDS: Partial<Record<PuzzleType, TileBackground>> = {
  ...ARCADE_BACKGROUNDS,
  ...PUZZLE_BACKGROUNDS,
};
