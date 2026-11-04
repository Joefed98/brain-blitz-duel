/**
 * Spacewalk's pixel art (3 Nov 2026, Joe's audit; display only, every crossRev): Jaywalk's crossing re-themed as
 * a spacewalk. The rules, lanes, timings and every hit box are the sim's own and unchanged (`cross.ts`); this file
 * only paints. Each piece is drawn inside the box the sim collides with:
 *
 *  - cars → small ships, filling the vehicle's lane box (hull pointed to the front, engines glowing at the back);
 *  - buses → long slow cargo freighters (a cab and a row of containers), filling the bus's box;
 *  - motorbikes and bikes → fast comets (a bright head at the front, a fading tail behind) on glowing plasma lanes;
 *  - cones and barriers → drifting debris inside the closed columns' span;
 *  - the grass island → a docking platform; the kerbs and pavements → station decks; the verges → open space;
 *  - the walker → a pixel astronaut, larger and brighter than the old figure but no wider than the hit box
 *    (crossPlayerR either side of the column centre).
 *
 * Render only: never imported by the sim or the server.
 */
import { artHash, reducedMotion } from "./art.renderer";
import { pixelRect } from "./retro.renderer";

export const SPACE_VOID = "#04051A";
export const SPACE_VOID_DEEP = "#020310";
export const SPACE_LANE = "#0A0E2A";
export const SPACE_DECK = "#2B3346";
export const SPACE_DECK_DARK = "#1B2130";
export const SPACE_DECK_SEAM = "#11151F";
export const SPACE_HAZARD = "#FFC23A";
export const SPACE_CYAN = "#3DFFE0";
export const SPACE_PLASMA = "#FF4FD8";
export const SPACE_FREIGHT = "#FFB02E";
/** The astronaut's suit and visor. */
export const SUIT = "#F4F7FF";
export const SUIT_SHADE = "#AEB7CC";
export const VISOR = "#FFC23A";

/** Ship hull colours (in place of the car colours). */
export const SHIP_HULLS = ["#3DFFE0", "#FF6FD8", "#7CF29A", "#5CD0FF", "#FFB02E", "#B49CFF"] as const;
export const FREIGHT_HULLS = ["#FF8A3C", "#5CD0FF", "#A6FF3A"] as const;
export const COMET_COLOURS = ["#7FFFFF", "#FF9BFF", "#FFE08A", "#9CFF9C"] as const;

/** Deep space with fixed pixel stars over a world rectangle (seeded by position, so it never shimmers). */
export function paintSpaceVoid(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed = 11): void {
  if (w <= 0 || h <= 0) return;
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, SPACE_VOID);
  g.addColorStop(1, SPACE_VOID_DEEP);
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  const n = Math.ceil((w * h) / 420);
  for (let k = 0; k < n; k++) {
    const r = artHash(k, seed);
    const sx = Math.round(x + ((r % 1000) / 1000) * w);
    const sy = Math.round(y + (((r >>> 10) % 1000) / 1000) * h);
    const tier = (r >>> 20) % 9;
    c.fillStyle = tier === 0 ? "#FFFFFF" : tier < 3 ? "rgba(200,220,255,0.7)" : "rgba(160,180,255,0.35)";
    c.fillRect(sx, sy, tier === 0 ? 2 : 1, tier === 0 ? 2 : 1);
  }
  c.restore();
}

/**
 * A station deck (a kerb or pavement): dark metal plates on a 2 px seam grid, rivets, a lit edge strip and a
 * hazard band along the side the lanes are on (`edge` "top" or "bottom", or "none").
 */
export function paintStationDeck(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, edge: "top" | "bottom" | "none", plate = 26): void {
  if (w <= 0 || h <= 0) return;
  c.fillStyle = SPACE_DECK;
  c.fillRect(x, y, w, h);
  c.fillStyle = SPACE_DECK_SEAM;
  for (let sx = x + plate; sx < x + w; sx += plate) c.fillRect(Math.round(sx), y, 2, h);
  for (let sy = y + 16; sy < y + h; sy += 16) c.fillRect(x, Math.round(sy), w, 2);
  c.fillStyle = "rgba(255,255,255,0.07)";
  for (let sx = x; sx < x + w; sx += plate) c.fillRect(Math.round(sx) + 2, y, plate - 4, 2);
  c.fillStyle = "#5A657E";
  for (let sx = x + 5; sx < x + w; sx += plate) {
    for (let sy = y + 5; sy < y + h - 3; sy += 16) c.fillRect(Math.round(sx), Math.round(sy), 2, 2);
  }
  if (edge === "none") return;
  // The hazard band: amber and black blocks, 4 px deep, then a cyan light strip on the lane side.
  const band = edge === "top" ? y : y + h - 6;
  for (let sx = x, k = 0; sx < x + w; sx += 8, k++) {
    c.fillStyle = k % 2 ? SPACE_DECK_SEAM : SPACE_HAZARD;
    c.fillRect(sx, edge === "top" ? band + 2 : band, Math.min(8, x + w - sx), 4);
  }
  c.fillStyle = SPACE_CYAN;
  c.fillRect(x, edge === "top" ? band : band + 4, w, 2);
}

/** One traffic lane of open space: a dark band with a row of beacon dots along its upper edge. */
export function paintSpaceLane(c: CanvasRenderingContext2D, x: number, top: number, w: number, laneH: number, lane: number, beacons: boolean): void {
  c.fillStyle = SPACE_LANE;
  c.fillRect(x, top, w, laneH);
  c.save();
  c.beginPath();
  c.rect(x, top, w, laneH);
  c.clip();
  for (let k = 0; k < Math.ceil((w * laneH) / 600); k++) {
    const r = artHash(lane * 97 + k, 23);
    c.fillStyle = r % 4 === 0 ? "rgba(255,255,255,0.8)" : "rgba(170,190,255,0.4)";
    c.fillRect(Math.round(x + ((r % 1000) / 1000) * w), Math.round(top + (((r >>> 10) % 1000) / 1000) * laneH), 1, 1);
  }
  c.restore();
  if (!beacons) return;
  for (let bx = x + 6; bx < x + w; bx += 34) {
    c.fillStyle = "rgba(61,255,224,0.25)";
    c.fillRect(Math.round(bx) - 1, top - 2, 8, 4);
    c.fillStyle = "rgba(61,255,224,0.85)";
    c.fillRect(Math.round(bx) + 1, top - 1, 4, 2);
  }
}

/** A plasma lane (the cyclist and motorbike lanes): a glowing magenta band with bright rails top and bottom. */
export function paintPlasmaLane(c: CanvasRenderingContext2D, x: number, top: number, w: number, laneH: number): void {
  const g = c.createLinearGradient(0, top, 0, top + laneH);
  g.addColorStop(0, "rgba(255,79,216,0.32)");
  g.addColorStop(0.5, "rgba(120,40,200,0.16)");
  g.addColorStop(1, "rgba(255,79,216,0.32)");
  c.fillStyle = g;
  c.fillRect(x, top, w, laneH);
  c.fillStyle = SPACE_PLASMA;
  c.fillRect(x, top + 1, w, 2);
  c.fillRect(x, top + laneH - 3, w, 2);
  c.fillStyle = "rgba(255,200,245,0.6)";
  for (let sx = x + 10; sx < x + w; sx += 22) c.fillRect(Math.round(sx), Math.round(top + laneH / 2), 8, 1);
}

/** A freight lane (the bus lane): amber guide rails either side of a faintly lit band. */
export function paintFreightLane(c: CanvasRenderingContext2D, x: number, top: number, w: number, laneH: number): void {
  c.fillStyle = "rgba(255,176,46,0.1)";
  c.fillRect(x, top, w, laneH);
  c.fillStyle = SPACE_FREIGHT;
  for (let sx = x; sx < x + w; sx += 12) {
    c.fillRect(Math.round(sx), top + 1, 6, 2);
    c.fillRect(Math.round(sx), top + laneH - 3, 6, 2);
  }
}

/** The docking platform (crossRev 9's island): a deck between cyan-lit edges with a docking clamp at each end. */
export function paintDockingPlatform(c: CanvasRenderingContext2D, x: number, top: number, w: number, h: number): void {
  paintStationDeck(c, x, top, w, h, "none");
  c.fillStyle = SPACE_CYAN;
  c.fillRect(x, top, w, 2);
  c.fillRect(x, top + h - 2, w, 2);
  c.fillStyle = "rgba(61,255,224,0.18)";
  c.fillRect(x, top + 2, w, 3);
  c.fillRect(x, top + h - 5, w, 3);
  // Docking clamps at both ends, clear of the outer columns (column 0's centre is 26 px in).
  for (const cx of [x, x + w - 9]) {
    c.fillStyle = "#50607E";
    c.fillRect(cx, top + 6, 9, h - 12);
    c.fillStyle = SPACE_HAZARD;
    for (let sy = top + 8; sy < top + h - 8; sy += 8) c.fillRect(cx + 2, sy, 5, 3);
  }
}

/**
 * Drifting debris filling the span [x0, x1] of a closed run of columns, centred on the lane: chunky rock and
 * scrap blocks that bob up to 1 px on the presentation clock (inside the same span; the columns are closed by
 * the course, so the walker never stands there).
 */
export function drawDebris(ctx: CanvasRenderingContext2D, x0: number, x1: number, midY: number, seed: number, clock: number): void {
  const still = reducedMotion();
  const n = Math.max(1, Math.round((x1 - x0) / 13));
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const r = artHash(seed * 31 + i, 67);
    const w = 8 + (r % 5);
    const h = 7 + ((r >>> 4) % 6);
    const cx = x0 + step * (i + 0.5);
    const bob = still ? 0 : Math.round(Math.sin(clock / 700 + i * 1.7));
    const x = Math.round(Math.max(x0, Math.min(x1 - w, cx - w / 2)));
    const y = Math.round(midY - h / 2 + ((r >>> 8) % 5) - 2 + bob);
    const rock = r % 3 !== 0;
    pixelRect(ctx, x, y, w, h, rock ? "#6B5E57" : "#7C8798");
    pixelRect(ctx, x, y, w, 2, rock ? "#9A8A80" : "#C2CBD8");
    pixelRect(ctx, x + w - 2, y + 2, 2, h - 2, rock ? "#3E3532" : "#4A5466");
    if (!rock) pixelRect(ctx, x + 2, y + 3, Math.max(2, w - 6), 2, SPACE_HAZARD);
    else pixelRect(ctx, x + 2, y + 3, 2, 2, "#3E3532");
  }
}

/**
 * A small ship filling its lane box (x, y, w, h), facing `dir` (+1 right): a pointed nose, a cockpit, a hull in
 * its colour and two engine glows at the back. Every pixel is inside the box.
 */
export function drawSpaceShip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: number, hull: string, t: number): void {
  const X = (dx: number, ww: number) => (dir > 0 ? x + dx : x + w - dx - ww);
  const mid = y + h / 2;
  const nose = Math.min(12, Math.round(w * 0.22));
  const engine = Math.min(6, Math.round(w * 0.12));
  // Hull: the body between engine and nose, then the nose in two steps.
  pixelRect(ctx, X(engine, w - engine - nose), y + 4, w - engine - nose, h - 8, hull);
  pixelRect(ctx, X(w - nose, Math.ceil(nose / 2)), y + 7, Math.ceil(nose / 2), h - 14, hull);
  pixelRect(ctx, X(w - Math.floor(nose / 2), Math.floor(nose / 2)), mid - 3, Math.floor(nose / 2), 6, hull);
  // Wings top and bottom (the box's full height).
  pixelRect(ctx, X(engine + 2, Math.round(w * 0.3)), y, Math.round(w * 0.3), 4, "#1C2236");
  pixelRect(ctx, X(engine + 2, Math.round(w * 0.3)), y + h - 4, Math.round(w * 0.3), 4, "#1C2236");
  pixelRect(ctx, X(engine + 2, Math.round(w * 0.3)), y, Math.round(w * 0.3), 1, hull);
  pixelRect(ctx, X(engine + 2, Math.round(w * 0.3)), y + h - 1, Math.round(w * 0.3), 1, hull);
  // Hull shading and a light stripe.
  pixelRect(ctx, X(engine, w - engine - nose), y + h - 8, w - engine - nose, 2, "rgba(0,0,0,0.35)");
  pixelRect(ctx, X(engine, w - engine - nose), y + 4, w - engine - nose, 2, "rgba(255,255,255,0.45)");
  // Cockpit.
  const cockW = Math.max(6, Math.round(w * 0.18));
  pixelRect(ctx, X(w - nose - cockW, cockW), mid - 4, cockW, 8, "#0B1230");
  pixelRect(ctx, X(w - nose - cockW + 2, cockW - 4), mid - 3, cockW - 4, 2, "#9FE8FF");
  // Engines: a flicker of hot colour at the back edge.
  const flick = reducedMotion() ? 1 : 0.75 + 0.25 * Math.sin(t / 60 + x);
  ctx.globalAlpha = flick;
  pixelRect(ctx, X(0, engine), mid - 6, engine, 4, "#FF9A3C");
  pixelRect(ctx, X(0, engine), mid + 2, engine, 4, "#FF9A3C");
  pixelRect(ctx, X(engine - 2, 2), mid - 5, 2, 2, "#FFF2A8");
  pixelRect(ctx, X(engine - 2, 2), mid + 3, 2, 2, "#FFF2A8");
  ctx.globalAlpha = 1;
}

/** A long slow cargo freighter filling the bus's box: a cab at the front and a row of containers behind it. */
export function drawFreighter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: number, hull: string, t: number): void {
  const X = (dx: number, ww: number) => (dir > 0 ? x + dx : x + w - dx - ww);
  const cab = Math.min(26, Math.round(w * 0.22));
  const engine = 6;
  // The spine.
  pixelRect(ctx, X(engine, w - engine), y + Math.round(h / 2) - 3, w - engine, 6, "#3A4152");
  // Containers.
  const bay = w - cab - engine - 2;
  const n = Math.max(2, Math.round(bay / 22));
  const cw = bay / n;
  for (let i = 0; i < n; i++) {
    const cx = engine + i * cw;
    const colour = i % 2 ? "#5A657E" : hull;
    pixelRect(ctx, X(cx + 1, cw - 2), y + 2, cw - 2, h - 4, colour);
    pixelRect(ctx, X(cx + 1, cw - 2), y + 2, cw - 2, 2, "rgba(255,255,255,0.4)");
    for (let k = 4; k < cw - 4; k += 4) pixelRect(ctx, X(cx + k, 1), y + 6, 1, h - 12, "rgba(0,0,0,0.3)");
  }
  // The cab: a squared bridge with a window strip.
  pixelRect(ctx, X(w - cab, cab), y, cab, h, "#D6DCE8");
  pixelRect(ctx, X(w - cab, cab), y + h - 3, cab, 3, "#8C96AA");
  pixelRect(ctx, X(w - cab + 4, cab - 8), y + 4, cab - 8, 5, "#0B1230");
  pixelRect(ctx, X(w - cab + 5, cab - 10), y + 5, cab - 10, 2, "#9FE8FF");
  // Running lights and the engines.
  const blink = reducedMotion() || Math.floor(t / 400) % 2 === 0;
  if (blink) pixelRect(ctx, X(w - 4, 2), y + 1, 2, 2, "#FF3B5C");
  pixelRect(ctx, X(0, engine), y + 3, engine, h - 6, "#3A4152");
  pixelRect(ctx, X(0, 2), y + 5, 2, h - 10, "#FF9A3C");
}

/** A fast comet filling its box: a bright round head at the front and a tapering tail streaming behind. */
export function drawComet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: number, colour: string): void {
  const X = (dx: number, ww: number) => (dir > 0 ? x + dx : x + w - dx - ww);
  const mid = y + h / 2;
  const head = Math.min(h, Math.max(12, Math.round(w * 0.4)));
  const r = head / 2;
  // The tail: three tapering bands, fading towards the back.
  const tail = w - head;
  if (tail > 0) {
    for (let k = 0; k < 3; k++) {
      const len = Math.round(tail * (1 - k * 0.28));
      const hh = Math.max(2, Math.round(h * (0.62 - k * 0.18)));
      ctx.globalAlpha = 0.28 + k * 0.22;
      pixelRect(ctx, X(tail - len + r * 0.5, len), mid - hh / 2, len, hh, k === 2 ? "#FFFFFF" : colour);
    }
    ctx.globalAlpha = 1;
  }
  // The head: a pixel disc with a white core.
  for (let dy = -r; dy < r; dy += 2) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - (dy + 1) * (dy + 1))));
    pixelRect(ctx, X(w - r - half, half * 2), mid + dy, half * 2, 2, colour);
  }
  const core = Math.max(4, Math.round(r));
  pixelRect(ctx, X(w - r - core / 2, core), mid - core / 2, core, core, "#FFFFFF");
}

/**
 * The astronaut, centred on (x, y): a white suit with a gold visor and a backpack, drawn in 2 px blocks. `half`
 * is the hit box's half-width (crossPlayerR): the figure is at most that wide either side of x. `facing` 0 up,
 * 1 down, 2 left, 3 right; `stride` −1…1 swings the legs and arms; `angle` tumbles it (a hit).
 */
export function drawAstronaut(ctx: CanvasRenderingContext2D, x: number, y: number, half: number, facing: number, stride: number, angle: number, glowOn: boolean): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (angle) ctx.rotate(angle);
  const s = Math.min(1, (half * 2) / 26);
  ctx.scale(s, s);
  const side = facing === 2 ? -1 : facing === 3 ? 1 : 0;
  const back = facing === 0;
  const B = (bx: number, by: number, bw: number, bh: number, colour: string) => pixelRect(ctx, bx, by, bw, bh, colour);
  // A soft glow so the crosser reads against the traffic.
  if (glowOn) {
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
    g.addColorStop(0, "rgba(255,240,200,0.32)");
    g.addColorStop(1, "rgba(255,240,200,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-13, -20, 26, 40);
  }
  const legA = Math.round(stride * 3);
  // Legs and boots.
  B(-6, 6 + Math.max(0, legA), 5, 9 - Math.max(0, legA), SUIT_SHADE);
  B(1, 6 + Math.max(0, -legA), 5, 9 - Math.max(0, -legA), SUIT_SHADE);
  B(-7, 14, 6, 3, "#5A657E");
  B(1, 14, 6, 3, "#5A657E");
  // Backpack (behind the torso; shows either side when seen from the back).
  B(-9, -5, 18, 11, back ? "#C9D1E2" : "#8C96AA");
  // Torso and belt.
  B(-7, -6, 14, 13, SUIT);
  B(-7, 4, 14, 2, SUIT_SHADE);
  if (!back) {
    B(-3, -3, 6, 4, "#5CD0FF");
    B(-2, -2, 2, 2, "#FF3B5C");
  }
  // Arms.
  B(-12, -5 - legA, 5, 9, SUIT);
  B(7, -5 + legA, 5, 9, SUIT);
  B(-12, 3 - legA, 5, 3, "#5A657E");
  B(7, 3 + legA, 5, 3, "#5A657E");
  // Helmet with its visor (gold, sliding to the side faced; none from the back).
  B(-7, -18, 14, 12, SUIT);
  B(-5, -20, 10, 2, SUIT);
  B(-7, -8, 14, 2, SUIT_SHADE);
  if (!back) {
    B(-5 + side * 2, -16, 10, 7, VISOR);
    B(-4 + side * 2, -15, 3, 2, "#FFF6D0");
  } else {
    B(-3, -16, 6, 6, "#DDE3EF");
  }
  ctx.restore();
}

/** A small helmet for the lives readout. */
export function drawHelmetIcon(ctx: CanvasRenderingContext2D, x: number, y: number, lit: boolean): void {
  pixelRect(ctx, x - 5, y - 5, 10, 10, lit ? SUIT : "rgba(255,255,255,0.18)");
  if (lit) pixelRect(ctx, x - 3, y - 3, 6, 4, VISOR);
}
