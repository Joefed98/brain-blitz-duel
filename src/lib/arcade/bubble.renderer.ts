/**
 * Bubble Pop art: an underwater reef in the High Seas world. Render only.
 * Uses the sim's own stretched world transform (scaleX/scaleY) and draws every
 * bubble at the sim's radius on its sim cell; rock, kelp and coral sit only in
 * the side wall margins and above the sim ceiling line.
 */
import type { CanvasSize } from "./engine";
import { artReady, drawArtSprite } from "./sprites.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { bubbleFxFor } from "./arcadeFxGames.renderer";
import { successHud, successFrame } from './success.renderer';
import {
  bubbleGame,
  bubCellX,
  bubCellY,
  bubColour,
  bubIsSpecial,
  bubNextColour,
  bubRowCols,
  BUB_BOMB,
  BUB_CHEST,
  BUB_COLS,
  BUB_JOKER,
  BUB_LINE,
  BUB_PALETTE,
  BUB_HUD_H,
  BUB_R,
  BUB_ROW_H,
  BUB_SHOOTER_X,
  BUB_TOP,
  BUB_WALL,
  BUB_WORLD_W,
  bubShooterY,
  bubWorldH,
  bubDangerLine,
  bubRowsOf,
  BUB_V8_CHESTS,
  type BubState,
} from "./bubble";
import { reducedMotion } from "./art.renderer";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import {
  seaClock,
  seaCoral,
  seaDeviceScale,
  seaKelp,
  seaNow,
  seaLayer,
  seaSprite,
  seaWater,
  SEA_BRASS,
  SEA_BRASS_DARK,
  SEA_GOLD,
  SEA_TEXT,
} from "./seas.renderer";

export type BubCreature = "crab" | "starfish" | "fish" | "jellyfish" | "shell";
/** Colour value 1…5 → creature, one-to-one. */
export const BUB_CREATURES: readonly BubCreature[] = ["crab", "starfish", "fish", "jellyfish", "shell"];
export function bubCreature(value: number): BubCreature {
  return BUB_CREATURES[(value - 1) % BUB_CREATURES.length] ?? "fish";
}

/** True once all five creature sprites are ready; art is all five or none. */
function creatureArtReady(): boolean {
  return BUB_CREATURES.every((k) => artReady("underwater", k));
}

/** Draws a creature centred at (cx, cy), fitting radius r. */
export function drawCreature(c: CanvasRenderingContext2D, kind: BubCreature, cx: number, cy: number, r: number): void {
  // Art pilot (Underwater): creature sprites inside the bubble (the bubble circle stays the drawn bound),
  // only once all five are ready so art and drawn symbols never mix.
  if (creatureArtReady() && drawArtSprite(c, "underwater", kind, cx - r * 0.62, cy - r * 0.62, r * 1.24, r * 1.24)) return;
  c.save();
  c.fillStyle = "rgba(8,20,36,0.82)";
  c.strokeStyle = "rgba(8,20,36,0.82)";
  c.lineWidth = Math.max(1, r * 0.13);
  c.lineCap = "round";
  switch (kind) {
    case "fish":
      c.beginPath();
      c.ellipse(cx - r * 0.12, cy, r * 0.55, r * 0.34, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(cx + r * 0.35, cy);
      c.lineTo(cx + r * 0.78, cy - r * 0.34);
      c.lineTo(cx + r * 0.78, cy + r * 0.34);
      c.closePath();
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.beginPath();
      c.arc(cx - r * 0.38, cy - r * 0.07, r * 0.09, 0, Math.PI * 2);
      c.fill();
      break;
    case "starfish":
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const d = i % 2 === 0 ? r * 0.72 : r * 0.3;
        c.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
      }
      c.closePath();
      c.fill();
      break;
    case "shell":
      c.beginPath();
      c.moveTo(cx, cy + r * 0.6);
      c.arc(cx, cy + r * 0.05, r * 0.62, Math.PI * 1.05, Math.PI * 1.95);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.55)";
      c.lineWidth = Math.max(0.8, r * 0.07);
      c.beginPath();
      for (const dx of [-0.36, -0.12, 0.12, 0.36]) {
        c.moveTo(cx, cy + r * 0.55);
        c.lineTo(cx + dx * r * 1.4, cy - r * 0.38);
      }
      c.stroke();
      break;
    case "crab":
      c.beginPath();
      c.ellipse(cx, cy + r * 0.1, r * 0.42, r * 0.28, 0, 0, Math.PI * 2);
      c.fill();
      for (const side of [-1, 1]) {
        c.beginPath();
        c.arc(cx + side * r * 0.55, cy - r * 0.32, r * 0.17, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.moveTo(cx + side * r * 0.3, cy);
        c.lineTo(cx + side * r * 0.52, cy - r * 0.22);
        for (const k of [0, 1, 2]) {
          c.moveTo(cx + side * r * 0.3, cy + r * (0.12 + k * 0.1));
          c.lineTo(cx + side * r * 0.66, cy + r * (0.26 + k * 0.14));
        }
        c.stroke();
      }
      break;
    case "jellyfish":
      c.beginPath();
      c.arc(cx, cy - r * 0.05, r * 0.5, Math.PI, 0);
      c.closePath();
      c.fill();
      c.beginPath();
      for (const dx of [-0.32, -0.1, 0.12, 0.34]) {
        c.moveTo(cx + dx * r, cy);
        c.quadraticCurveTo(cx + (dx - 0.12) * r, cy + r * 0.32, cx + dx * r, cy + r * 0.62);
      }
      c.stroke();
      break;
  }
  c.restore();
}

/**
 * bubbleRev 2 specials, each with its own look and none of the creature
 * symbols, all drawn inside the bubble circle (the collision bound):
 *  - Joker (Tuning B): a night-black bubble with a thin five-colour rainbow
 *    rim, a gold three-point crown with three jewels and white glints.
 *  - Mine: a black naval sea mine with round-tipped horns and a red light, on an
 *    amber warning bubble.
 *  - Torpedo: a silver torpedo side-on (red-banded nose, cross fins, propeller)
 *    with arrowheads at both ends of the bubble: it clears the whole row.
 *    bubbleRev 4 (`directional`): one arrowhead, at the nose only, and the
 *    sprite is turned to the way it travels (it destroys what it runs into).
 */
function paintSpecial(value: number, directional: boolean) {
  return (c: CanvasRenderingContext2D, size: number) => {
    const r = size / 2;
    c.save();
    c.beginPath();
    c.arc(r, r, r - 0.5, 0, Math.PI * 2);
    c.clip();
    if (value === BUB_JOKER) {
      // Tuning B redesign: a night-black bubble (every creature bubble is a
      // bright colour, the mine amber, the torpedo sea blue) with a thin
      // rainbow rim, a gold crown with three jewels and white glints: reads as
      // "wild" at a glance and shares no shape with a creature.
      const night = c.createRadialGradient(r * 0.75, r * 0.68, r * 0.05, r, r, r);
      night.addColorStop(0, "#3A2A6E");
      night.addColorStop(1, "#0E0820");
      c.fillStyle = night;
      c.fillRect(0, 0, size, size);
      // Rainbow rim: the five creature colours in an even ring round the edge.
      const rim = Math.max(1.5, r * 0.2);
      c.lineWidth = rim;
      BUB_PALETTE.forEach((colour, i) => {
        const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / BUB_PALETTE.length;
        c.strokeStyle = colour;
        c.beginPath();
        c.arc(r, r, r - rim / 2, a0 - 0.03, a0 + (2 * Math.PI) / BUB_PALETTE.length + 0.03);
        c.stroke();
      });
      // Gold crown: band and three points, each tipped with a ball.
      const base = r + r * 0.28;
      const band = r * 0.2;
      const left = r - r * 0.46;
      const right = r + r * 0.46;
      const tip = r - r * 0.36;
      const crown = c.createLinearGradient(0, tip, 0, base);
      crown.addColorStop(0, "#FFF1A8");
      crown.addColorStop(1, "#E3A81B");
      c.fillStyle = crown;
      c.beginPath();
      c.moveTo(left, base);
      c.lineTo(left, base - band);
      c.lineTo(left - r * 0.04, tip + r * 0.06);
      c.lineTo(r - r * 0.2, base - band - r * 0.12);
      c.lineTo(r, tip);
      c.lineTo(r + r * 0.2, base - band - r * 0.12);
      c.lineTo(right + r * 0.04, tip + r * 0.06);
      c.lineTo(right, base - band);
      c.lineTo(right, base);
      c.closePath();
      c.fill();
      c.strokeStyle = "#7A4A00";
      c.lineWidth = Math.max(0.8, r * 0.06);
      c.lineJoin = "round";
      c.stroke();
      c.fillStyle = "#FFE066";
      for (const [x, y] of [[left - r * 0.04, tip + r * 0.06], [r, tip], [right + r * 0.04, tip + r * 0.06]] as const) {
        c.beginPath();
        c.arc(x, y, r * 0.08, 0, Math.PI * 2);
        c.fill();
      }
      // Three jewels on the band: pink, cyan, lime.
      ["#FF4FA3", "#3FE0F0", "#9BF24B"].forEach((jewel, i) => {
        c.fillStyle = jewel;
        c.beginPath();
        c.arc(r + (i - 1) * r * 0.27, base - band / 2, r * 0.075, 0, Math.PI * 2);
        c.fill();
      });
      // White four-point glints.
      const glint = (cx: number, cy: number, outer: number) => {
        c.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 4;
          const d = i % 2 === 0 ? outer : outer * 0.25;
          c.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
        }
        c.closePath();
        c.fill();
      };
      c.fillStyle = "#FFFFFF";
      glint(r + r * 0.42, r - r * 0.5, r * 0.16);
      glint(r - r * 0.5, r + r * 0.48, r * 0.11);
    } else if (value === BUB_BOMB) {
      const warn = c.createRadialGradient(r * 0.75, r * 0.7, r * 0.1, r, r, r);
      warn.addColorStop(0, "#FFC46B");
      warn.addColorStop(1, "#E0662A");
      c.fillStyle = warn;
      c.fillRect(0, 0, size, size);
      // Horns with round tips, then the black body over their roots.
      c.strokeStyle = "#141519";
      c.fillStyle = "#141519";
      c.lineWidth = Math.max(1.5, r * 0.15);
      c.lineCap = "round";
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 4;
        c.beginPath();
        c.moveTo(r + Math.cos(a) * r * 0.4, r + Math.sin(a) * r * 0.4);
        c.lineTo(r + Math.cos(a) * r * 0.72, r + Math.sin(a) * r * 0.72);
        c.stroke();
        c.beginPath();
        c.arc(r + Math.cos(a) * r * 0.76, r + Math.sin(a) * r * 0.76, r * 0.11, 0, Math.PI * 2);
        c.fill();
      }
      const body = c.createRadialGradient(r * 0.8, r * 0.78, r * 0.05, r, r, r * 0.55);
      body.addColorStop(0, "#4A4E58");
      body.addColorStop(1, "#141519");
      c.fillStyle = body;
      c.beginPath();
      c.arc(r, r, r * 0.52, 0, Math.PI * 2);
      c.fill();
      // Red light with a glint.
      c.fillStyle = "#FF2E2E";
      c.beginPath();
      c.arc(r, r, r * 0.17, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.85)";
      c.beginPath();
      c.arc(r - r * 0.06, r - r * 0.06, r * 0.06, 0, Math.PI * 2);
      c.fill();
    } else {
      const sea = c.createRadialGradient(r * 0.75, r * 0.7, r * 0.1, r, r, r);
      sea.addColorStop(0, "#2E7FA8");
      sea.addColorStop(1, "#0D3550");
      c.fillStyle = sea;
      c.fillRect(0, 0, size, size);
      // Arrowheads at both edges: it clears left and right (rev 4: the nose only, it runs where it points).
      c.fillStyle = "#FFE14D";
      for (const side of directional ? [-1] : [-1, 1]) {
        c.beginPath();
        c.moveTo(r + side * r * 0.86, r);
        c.lineTo(r + side * r * 0.64, r - r * 0.26);
        c.lineTo(r + side * r * 0.64, r + r * 0.26);
        c.closePath();
        c.fill();
      }
      // Torpedo, nose left: tail fins, body, nose band, propeller.
      const top = r - r * 0.17, h = r * 0.34;
      const left = r - r * 0.56, right = r + r * 0.34;
      c.fillStyle = "#8E98A6";
      c.beginPath();
      c.moveTo(right - r * 0.06, top + h * 0.15);
      c.lineTo(right + r * 0.16, top - r * 0.14);
      c.lineTo(right + r * 0.16, top + h + r * 0.14);
      c.lineTo(right - r * 0.06, top + h * 0.85);
      c.closePath();
      c.fill();
      const metal = c.createLinearGradient(0, top, 0, top + h);
      metal.addColorStop(0, "#F2F5F8");
      metal.addColorStop(0.55, "#B8C1CC");
      metal.addColorStop(1, "#6E7884");
      c.fillStyle = metal;
      c.beginPath();
      c.moveTo(left + h / 2, top);
      c.lineTo(right, top);
      c.lineTo(right, top + h);
      c.lineTo(left + h / 2, top + h);
      c.arc(left + h / 2, r, h / 2, Math.PI / 2, Math.PI * 1.5);
      c.closePath();
      c.fill();
      c.fillStyle = "#E23B3B";
      c.fillRect(left + h * 0.62, top, r * 0.1, h);
      c.fillStyle = "#3C434D";
      c.fillRect(right, r - r * 0.06, r * 0.12, r * 0.12);
      c.fillRect(right + r * 0.1, r - r * 0.16, r * 0.05, r * 0.32);
    }
    c.restore();
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.lineWidth = Math.max(1, r * 0.1);
    c.beginPath();
    c.arc(r, r, r - c.lineWidth / 2 - 0.5, 0, Math.PI * 2);
    c.stroke();
    // Rim highlight, as on the colour bubbles.
    c.strokeStyle = "rgba(255,255,255,0.7)";
    c.lineWidth = Math.max(1, r * 0.1);
    c.lineCap = "round";
    c.beginPath();
    c.arc(r, r, r * 0.8, Math.PI * 1.12, Math.PI * 1.42);
    c.stroke();
    bubbleGloss(c, r);
  };
}

/**
 * Polish A3: the glass finish every bubble shares, inside its circle (the collision bound): a fine dark
 * outer rim, a soft specular sheen high on the lit side and a thin bright line just inside the rim.
 */
function bubbleGloss(c: CanvasRenderingContext2D, r: number): void {
  c.save();
  const fine = Math.max(0.8, r * 0.06);
  c.strokeStyle = "rgba(3,12,28,0.7)";
  c.lineWidth = fine;
  c.beginPath();
  c.arc(r, r, r - 0.5 - fine / 2, 0, Math.PI * 2);
  c.stroke();
  c.translate(r * 0.66, r * 0.46);
  c.rotate(-0.6);
  c.scale(1, 0.55);
  const sheen = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.42);
  sheen.addColorStop(0, "rgba(255,255,255,0.9)");
  sheen.addColorStop(0.55, "rgba(255,255,255,0.32)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = sheen;
  c.beginPath();
  c.arc(0, 0, r * 0.42, 0, Math.PI * 2);
  c.fill();
  c.restore();
  c.strokeStyle = "rgba(255,255,255,0.45)";
  c.lineWidth = Math.max(0.8, r * 0.05);
  c.beginPath();
  c.arc(r, r, r - fine - Math.max(0.6, r * 0.05), Math.PI * 0.55, Math.PI * 1.05);
  c.stroke();
  // Refinement (A3): a bright highlight crescent high on the lit side, inside the rim.
  c.save();
  c.strokeStyle = "rgba(255,255,255,0.92)";
  c.lineCap = "round";
  c.lineWidth = Math.max(1, r * 0.11);
  c.beginPath();
  c.arc(r, r, r * 0.8, Math.PI * 1.12, Math.PI * 1.5);
  c.stroke();
  c.restore();
}

/**
 * bubbleRev 8: the treasure chest bubble. The same glass bubble (gloss, rim, sheen) round a small
 * wooden chest with brass bands, a lock plate and a gold glint, on a warm amber glow, so it reads as
 * "not a colour" next to the creature bubbles and the specials.
 */
function paintChest(c: CanvasRenderingContext2D, size: number): void {
  const r = size / 2;
  c.save();
  c.beginPath();
  c.arc(r, r, r - 0.5, 0, Math.PI * 2);
  c.clip();
  const water = c.createRadialGradient(r * 0.8, r * 0.7, r * 0.08, r, r, r);
  water.addColorStop(0, "#FFE7A0");
  water.addColorStop(0.55, "#C98A2E");
  water.addColorStop(1, "#5A3510");
  c.fillStyle = water;
  c.fillRect(0, 0, size, size);
  // Chest: a lid (rounded top) over a box, both wood, with brass bands and a lock plate.
  const w = r * 1.2, h = r * 0.62, lidH = r * 0.36;
  const x0 = r - w / 2, boxTop = r - h / 2 + r * 0.14;
  const wood = c.createLinearGradient(0, boxTop - lidH, 0, boxTop + h);
  wood.addColorStop(0, "#A5642A");
  wood.addColorStop(1, "#5C3412");
  c.fillStyle = wood;
  c.beginPath();
  c.moveTo(x0, boxTop);
  c.quadraticCurveTo(x0, boxTop - lidH * 1.1, r, boxTop - lidH * 1.15);
  c.quadraticCurveTo(x0 + w, boxTop - lidH * 1.1, x0 + w, boxTop);
  c.lineTo(x0 + w, boxTop + h);
  c.lineTo(x0, boxTop + h);
  c.closePath();
  c.fill();
  c.strokeStyle = "#2E1806";
  c.lineWidth = Math.max(0.8, r * 0.06);
  c.stroke();
  c.fillStyle = SEA_BRASS;
  c.fillRect(x0, boxTop - r * 0.04, w, r * 0.1);
  for (const bx of [x0 + w * 0.2, x0 + w * 0.8]) c.fillRect(bx - r * 0.05, boxTop - lidH, r * 0.1, h + lidH);
  c.fillStyle = "#FFE7A0";
  c.fillRect(r - r * 0.1, boxTop - r * 0.02, r * 0.2, r * 0.24);
  c.fillStyle = "#2E1806";
  c.fillRect(r - r * 0.025, boxTop + r * 0.07, r * 0.05, r * 0.08);
  // A gold glint escaping under the lid.
  c.fillStyle = "rgba(255,240,170,0.95)";
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    const d = i % 2 === 0 ? r * 0.2 : r * 0.05;
    c.lineTo(r + r * 0.42 + Math.cos(a) * d, r - r * 0.42 + Math.sin(a) * d);
  }
  c.closePath();
  c.fill();
  c.restore();
  c.strokeStyle = "rgba(255,240,200,0.85)";
  c.lineWidth = Math.max(1, r * 0.1);
  c.beginPath();
  c.arc(r, r, r - c.lineWidth / 2 - 0.5, 0, Math.PI * 2);
  c.stroke();
  bubbleGloss(c, r);
}

export function paintBubble(value: number) {
  if (value === BUB_CHEST) return paintChest;
  if (bubIsSpecial(value)) return paintSpecial(value, false);
  return (c: CanvasRenderingContext2D, size: number) => {
    const r = size / 2;
    const colour = bubColour(value);
    const g = c.createRadialGradient(r * 0.75, r * 0.7, r * 0.1, r, r, r);
    g.addColorStop(0, colour + "B0");
    g.addColorStop(0.8, colour + "D8");
    g.addColorStop(1, colour);
    c.fillStyle = g;
    c.beginPath();
    c.arc(r, r, r - 0.5, 0, Math.PI * 2);
    c.fill();
    // Glass depth: a shaded lower edge and a soft glow through the centre.
    const shade = c.createRadialGradient(r * 0.8, r * 0.72, r * 0.2, r, r, r);
    shade.addColorStop(0, "rgba(255,255,255,0.16)");
    shade.addColorStop(0.62, "rgba(255,255,255,0)");
    shade.addColorStop(1, "rgba(4,16,34,0.34)");
    c.fillStyle = shade;
    c.beginPath();
    c.arc(r, r, r - 0.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.55)";
    c.lineWidth = Math.max(1, r * 0.08);
    c.beginPath();
    c.arc(r, r, r - c.lineWidth, 0, Math.PI * 2);
    c.stroke();
    // Refinement (A3): the creature fills about 60 % of the bubble's diameter (was ~80 %), so more glass shows.
    drawCreature(c, bubCreature(value), r, r + r * 0.03, r * 0.75);
    // Rim highlight, a round glint and the reflected light low on the far side.
    c.strokeStyle = "rgba(255,255,255,0.85)";
    c.lineWidth = Math.max(1, r * 0.12);
    c.lineCap = "round";
    c.beginPath();
    c.arc(r, r, r * 0.74, Math.PI * 1.1, Math.PI * 1.45);
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.9)";
    c.beginPath();
    c.arc(r * 0.62, r * 0.42, Math.max(0.8, r * 0.07), 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.35)";
    c.lineWidth = Math.max(0.8, r * 0.07);
    c.beginPath();
    c.arc(r, r, r * 0.8, Math.PI * 0.15, Math.PI * 0.5);
    c.stroke();
    bubbleGloss(c, r);
  };
}

/** Polish A3: the sand's colour at the world's very bottom, where the screen fill-in (bubbleFill) carries on. */
export const BUB_SAND_FOOT = "#6E5A3E";
/** The sandy floor's depth above the world's bottom, in world px (the gun's base rests on it). */
const SAND_DEPTH = 26;

/**
 * The cached reef layer: deeper water, a far reef in silhouette, shaded margin rock up to the walls, then
 * the sandy floor under the gun with ripples, pebbles and shells, and pink coral and stones on it. All of it
 * sits below the shooter line (the field never reaches it) or in the side margins.
 */
function paintReef(c: CanvasRenderingContext2D, w: number, h: number, margin: number, sy: number): void {
  seaWater(c, w, h);
  // A deeper ocean: a touch of sunlit teal under the surface, sinking to near-black navy at depth.
  const depth = c.createLinearGradient(0, 0, 0, h);
  depth.addColorStop(0, "rgba(46,150,205,0.16)");
  depth.addColorStop(0.3, "rgba(10,40,80,0)");
  depth.addColorStop(0.75, "rgba(2,10,28,0.32)");
  depth.addColorStop(1, "rgba(1,6,18,0.5)");
  c.fillStyle = depth;
  c.fillRect(0, 0, w, h);
  const floor = h - SAND_DEPTH * sy;
  // The far reef: soft dark mounds and fans in silhouette just above the sand, low enough to stay under the shooter line.
  c.fillStyle = "rgba(18,62,96,0.5)";
  c.beginPath();
  c.moveTo(0, floor + 2);
  for (let i = 0; i <= 12; i++) {
    const x = (i / 12) * w;
    const hump = (16 + ((i * 37) % 5) * 6) * sy;
    c.quadraticCurveTo(x - w / 24, floor - hump, x, floor - hump * 0.45);
  }
  c.lineTo(w, floor + 2);
  c.closePath();
  c.fill();
  // Margin rock: darker towards the screen edge, ending exactly at the wall line the bubbles bounce off.
  for (const [x0, x1] of [[0, margin], [w, w - margin]] as const) {
    const g = c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, "rgba(2,10,22,0.45)");
    g.addColorStop(1, "rgba(2,10,22,0.12)");
    c.fillStyle = g;
    c.fillRect(Math.min(x0, x1), 0, margin, h);
    c.fillStyle = "rgba(150,200,235,0.16)";
    c.fillRect(x1 - (x1 > x0 ? 1 : 0), 0, 1, floor);
  }
  // The sandy floor: a lit wavy crest, warm sand darkening to the bottom edge, ripples, grains, pebbles, shells.
  const crest = (x: number) => floor + Math.sin(x / (w * 0.11)) * 2.2 * sy + Math.sin(x / (w * 0.031)) * 0.8 * sy;
  const sand = c.createLinearGradient(0, floor - 3 * sy, 0, h);
  sand.addColorStop(0, "#B89C6A");
  sand.addColorStop(0.35, "#9A8058");
  sand.addColorStop(1, BUB_SAND_FOOT);
  c.fillStyle = sand;
  c.beginPath();
  c.moveTo(0, h);
  for (let x = 0; x <= w + 4; x += 4) c.lineTo(x, crest(x));
  c.lineTo(w, h);
  c.closePath();
  c.fill();
  // A soft shadow under the crest's water side and a sunlit line along it.
  c.strokeStyle = "rgba(255,236,190,0.45)";
  c.lineWidth = Math.max(1, 1.2 * sy);
  c.beginPath();
  for (let x = 0; x <= w + 4; x += 4) (x ? c.lineTo(x, crest(x)) : c.moveTo(x, crest(x)));
  c.stroke();
  c.strokeStyle = "rgba(70,52,30,0.35)";
  c.lineWidth = Math.max(0.8, sy);
  for (let k = 0; k < 9; k++) {
    const y = floor + (6 + (k % 3) * 6) * sy;
    const x0 = ((k * 0.37) % 1) * w;
    const len = w * (0.12 + ((k * 7) % 5) * 0.02);
    c.beginPath();
    c.moveTo(x0, y);
    c.quadraticCurveTo(x0 + len / 2, y - 2.2 * sy, x0 + len, y);
    c.stroke();
  }
  for (let i = 0; i < 90; i++) {
    const x = ((i * 157) % 401) / 401 * w;
    const y = floor + 3 * sy + (((i * 71) % 97) / 97) * (h - floor - 3 * sy);
    c.fillStyle = i % 3 ? "rgba(230,210,160,0.35)" : "rgba(80,60,36,0.35)";
    c.fillRect(x, y, i % 7 ? 1 : 1.6, i % 7 ? 1 : 1.6);
  }
  // Pebbles and two small shells, clear of the gun and its magazine (x 160–300 of 390).
  for (const [fx, s] of [[0.07, 4], [0.33, 3], [0.81, 3.5], [0.95, 2.6]] as const) {
    const x = fx * w;
    const y = h - 8 * sy;
    c.fillStyle = "#4E4636";
    c.beginPath();
    c.ellipse(x, y, s * 1.5 * sy, s * sy, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(230,220,200,0.3)";
    c.beginPath();
    c.ellipse(x - s * 0.4 * sy, y - s * 0.4 * sy, s * 0.7 * sy, s * 0.3 * sy, 0, 0, Math.PI * 2);
    c.fill();
  }
  for (const [fx, flip] of [[0.22, 1], [0.88, -1]] as const) {
    const x = fx * w;
    const y = h - 12 * sy;
    const s = 5 * sy;
    c.save();
    c.translate(x, y);
    c.scale(flip, 1);
    c.fillStyle = "#F0C9B4";
    c.beginPath();
    c.moveTo(0, s * 0.6);
    c.arc(0, s * 0.1, s * 0.8, Math.PI * 1.05, Math.PI * 1.95);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(150,90,70,0.6)";
    c.lineWidth = Math.max(0.6, 0.5 * sy);
    c.beginPath();
    for (const dx of [-0.4, 0, 0.4]) {
      c.moveTo(0, s * 0.55);
      c.lineTo(dx * s, -s * 0.5);
    }
    c.stroke();
    c.restore();
  }
  // Pink and coral-red reef on the sand either side of the gun, below the shooter line, plus the margin coral.
  seaCoral(c, w * 0.1, crest(w * 0.1) + 2 * sy, 30 * sy, "#F07FB0");
  seaCoral(c, w * 0.29, crest(w * 0.29) + 2 * sy, 20 * sy, "#E0705A");
  seaCoral(c, w * 0.86, crest(w * 0.86) + 2 * sy, 26 * sy, "#F59AC2");
  seaCoral(c, margin * 0.55, floor, margin * 0.8, "#E0705A");
  seaCoral(c, w - margin * 0.45, floor, margin * 0.7, "#E58FB4");
  // Brain coral domes: round pink mounds with a lit top and grooves.
  for (const [fx, rr] of [[0.18, 9], [0.95, 8]] as const) {
    const x = fx * w;
    const y = crest(x) + 3 * sy;
    const R = rr * sy;
    const dome = c.createRadialGradient(x - R * 0.3, y - R * 0.6, R * 0.1, x, y, R * 1.1);
    dome.addColorStop(0, "#FFB7CF");
    dome.addColorStop(0.6, "#D9668F");
    dome.addColorStop(1, "#8E3558");
    c.fillStyle = dome;
    c.beginPath();
    c.ellipse(x, y, R * 1.3, R, 0, Math.PI, 0);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(110,30,60,0.45)";
    c.lineWidth = Math.max(0.6, 0.6 * sy);
    for (let k = 1; k <= 3; k++) {
      c.beginPath();
      c.ellipse(x, y, R * 1.3 * (k / 4), R * (k / 4), 0, Math.PI * 1.1, Math.PI * 1.9);
      c.stroke();
    }
  }
}

/** Light rays slanting down from the surface, brighter than the shared sea's (additive; none under reduced effects). */
function bubbleRays(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  if (arcadeReducedEffects()) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 5; i++) {
    const sway = Math.sin(t * 0.22 + i * 1.9) * w * 0.03;
    const x = w * (0.06 + i * 0.22) + sway;
    const spread = w * (0.1 + (i % 2) * 0.05);
    const ray = ctx.createLinearGradient(0, 0, 0, h * 0.85);
    ray.addColorStop(0, `rgba(170,225,255,${i % 2 ? 0.2 : 0.28})`);
    ray.addColorStop(0.6, "rgba(150,215,255,0.08)");
    ray.addColorStop(1, "rgba(150,215,255,0)");
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.035, 0);
    ctx.lineTo(x + w * 0.035, 0);
    ctx.lineTo(x + spread, h * 0.85);
    ctx.lineTo(x - spread * 0.3, h * 0.85);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Plankton specks drifting slowly through the water (presentation clock; none under reduced motion or effects). */
function bubbleDrift(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  if (reducedMotion() || arcadeReducedEffects()) return;
  for (let i = 0; i < 26; i++) {
    const vx = 4 + (i % 5) * 1.6;
    const x = (((i * 0.383) % 1) * w + t * vx * (i % 2 ? 1 : -1) + w * 4) % w;
    const y = (((i * 0.617) % 1) * h * 0.86 + Math.sin(t * 0.5 + i) * 6 + t * 2.5) % (h * 0.86);
    ctx.fillStyle = i % 4 === 0 ? "rgba(190,255,235,0.4)" : "rgba(210,235,255,0.28)";
    const d = i % 6 === 0 ? 2 : 1.2;
    ctx.fillRect(x, y, d, d);
  }
}

/**
 * Blits a cached bubble sprite at CSS-px centre with CSS-px radius. `heading`
 * (radians, screen space) is given only for a bubbleRev-4 Torpedo: its
 * one-arrow sprite is turned so the nose points that way (the circle, the
 * collision bound, is unchanged by the turn).
 */
function blitBubble(ctx: CanvasRenderingContext2D, value: number, x: number, y: number, radius: number, dpr: number, alpha = 1, heading?: number): void {
  const directional = heading !== undefined && value === BUB_LINE;
  const key = directional ? `bub-special4-${value}` : bubIsSpecial(value) ? `bub-special2-${value}` : `bub2-${value}${creatureArtReady() ? "-art" : ""}`;
  const sprite = seaSprite(key, radius * 2 * dpr, directional ? paintSpecial(value, true) : paintBubble(value));
  if (!sprite) return;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (directional) {
    // The sprite's nose points left (angle π).
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading - Math.PI);
    ctx.drawImage(sprite as CanvasImageSource, -radius, -radius, radius * 2, radius * 2);
    ctx.restore();
  } else ctx.drawImage(sprite as CanvasImageSource, x - radius, y - radius, radius * 2, radius * 2);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

/** Torpedo heading for the art: up while loaded (bubbleRev 4 only; undefined otherwise). */
function loadedHeading(state: BubState, value: number): number | undefined {
  return state.lineRev !== undefined && value === BUB_LINE ? -Math.PI / 2 : undefined;
}

/** kind 0 pop, 1 drop; bubbleRev 2: 2 bomb blast, 3 torpedo row flash, 4 joker sparkle. */
interface Fx { kind: 0 | 1 | 2 | 3 | 4; value: number; x: number; y: number; born: number; seed: number }
interface Memo {
  tick: number;
  grid: number[];
  descents: number;
  fx: Fx[];
  specials: number;
  blast: Fx | null;
  cleared: number;
  rise: { born: number; seed: number } | null;
  /** bubbleRev 4: where the Torpedo in flight has been (world px), newest last; empty otherwise. */
  wake: { x: number; y: number }[];
  /** bubbleRev 8: floating words (a chest's "TREASURE", "BANK", "COMBO ×n") and the counters they follow. */
  notes: Note[];
  banks: number;
  combos: number;
}
/** bubbleRev 8: a floating word (world px), coloured gold for treasure, sea glass for bank and combo shots. */
interface Note { text: string; x: number; y: number; born: number; gold: boolean }
const NOTE_CAP = 4;
const memos = new WeakMap<object, Memo>();
const FX_CAP = 4;

function memoFor(ctx: CanvasRenderingContext2D, state: BubState): Memo {
  let m = memos.get(ctx);
  if (!m || state.tick < m.tick) {
    m = { tick: state.tick, grid: [...state.grid], descents: state.descents, fx: [], specials: specialCount(state), blast: null, cleared: state.popped + state.dropped, rise: null, wake: [], notes: [], banks: state.banks ?? 0, combos: state.combos ?? 0 };
    memos.set(ctx, m);
  }
  return m;
}

function specialCount(state: BubState): number {
  return (state.jokers ?? 0) + (state.bombs ?? 0) + (state.lines ?? 0);
}

/** A shot that pops or drops at least this many bubbles at once sends a burst of bubbles up the screen. */
const BIG_HIT = 8;
/** The rising burst: how many bubbles, how long each takes bottom to top, and the most any one waits (seconds). */
const RISE_COUNT = 22;
const RISE_SECONDS = 1.1;
const RISE_STAGGER = 0.35;

function trackRemovals(m: Memo, state: BubState, colour: number): void {
  if (state.tick === m.tick) return;
  const now = seaNow();
  // Tuning B: a big hit (lots popped or dropped in one go) sends bubbles rising
  // from the bottom of the screen to the top. Presentation clock only.
  const cleared = state.popped + state.dropped;
  if (cleared - m.cleared >= BIG_HIT && !reducedMotion()) m.rise = { born: now, seed: state.tick };
  m.cleared = cleared;
  // bubbleRev 4: the Torpedo's wake follows its path; what it runs into pops as it goes.
  const drilling = state.lineRev !== undefined && state.flightColour === BUB_LINE;
  if (drilling) {
    m.wake.push({ x: state.x / 256, y: state.y / 256 });
    if (m.wake.length > WAKE_LEN) m.wake.shift();
  }
  // bubbleRev 2: a special went off since the last frame; what it cleared pops (no fall).
  const special = specialCount(state) > m.specials;
  if (special && state.lineRev !== undefined && state.lastSpecial === BUB_LINE) {
    // bubbleRev 4: the Torpedo bursts where it stopped (the sim's last position).
    m.blast = { kind: 3, value: BUB_LINE, x: state.x / 256, y: state.y / 256, born: now, seed: state.tick };
  } else if (special && (state.lastSpecialCell ?? -1) >= 0) {
    const cell = state.lastSpecialCell!;
    const row = Math.floor(cell / BUB_COLS);
    const kind = state.lastSpecial === BUB_BOMB ? 2 : state.lastSpecial === BUB_LINE ? 3 : 4;
    m.blast = { kind, value: state.lastSpecial ?? 0, x: bubCellX(row, cell % BUB_COLS), y: bubCellY(row, m.descents), born: now, seed: cell };
  }
  m.specials = specialCount(state);
  if (special || drilling) colour = -1;
  if (!drilling) m.wake = [];
  if (state.popped + state.dropped > 0 && state.grid !== m.grid) {
    for (let row = 0; row < bubRowsOf(state.grid); row++) {
      for (let col = 0; col < bubRowCols(row); col++) {
        const i = row * BUB_COLS + col;
        const was = m.grid[i]!;
        if (!was || state.grid[i]) continue;
        // bubbleRev 8: a chest that fell with a cluster pays (one destroyed by a mine or torpedo is in `fx` only).
        if (was === BUB_CHEST && state.reef && (state.chests ?? 0) > 0 && colour !== -1) note(m, "TREASURE", bubCellX(row, col), bubCellY(row, m.descents), now, true);
        if (m.fx.length >= FX_CAP) m.fx.shift();
        m.fx.push({
          kind: was === colour || colour === -1 ? 0 : 1,
          value: was,
          x: bubCellX(row, col),
          y: bubCellY(row, m.descents),
          born: now,
          seed: i * 7919,
        });
      }
    }
  }
  // bubbleRev 8: a bank shot and a combo shot each get a word where the shot finished.
  if (state.reef) {
    const at = m.fx[m.fx.length - 1];
    const x = at?.x ?? state.x / 256;
    const y = at?.y ?? state.y / 256;
    if ((state.banks ?? 0) > m.banks) note(m, "BANK", x, y + 18, now, false);
    if ((state.combos ?? 0) > m.combos && (state.streak ?? 0) >= 2) note(m, `COMBO ×${state.streak}`, x, y - 4, now, false);
    m.banks = state.banks ?? 0;
    m.combos = state.combos ?? 0;
  }
  m.tick = state.tick;
  m.grid = [...state.grid];
  m.descents = state.descents;
}

function note(m: Memo, text: string, x: number, y: number, born: number, gold: boolean): void {
  if (m.notes.length >= NOTE_CAP) m.notes.shift();
  m.notes.push({ text, x: Math.max(70, Math.min(BUB_WORLD_W - 70, x)), y, born, gold });
}

/** bubbleRev 8: a small chest for the HUD's tally (the chest bubble's own sprite, no bubble round it would read smaller). */
function drawChestTally(ctx: CanvasRenderingContext2D, state: BubState, right: number, cy: number, rs: number, dpr: number): void {
  const got = state.chests ?? 0;
  ctx.save();
  ctx.font = `bold ${Math.round(15 * rs)}px ui-monospace, monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = got > 0 ? SEA_GOLD : SEA_TEXT;
  const text = `${got}/${BUB_V8_CHESTS}`;
  ctx.fillText(text, right, cy);
  const w = ctx.measureText(text).width;
  blitBubble(ctx, BUB_CHEST, right - w - 13 * rs, cy, 10 * rs, dpr);
  ctx.restore();
}

let lastFlight = 0;
/** bubbleRev 4: wake points kept behind the Torpedo (one a tick). */
const WAKE_LEN = 18;

/** The game's drawing through the shared success layer (presentation only). */
export function drawBubbleArt(ctx: CanvasRenderingContext2D, state: BubState, size: CanvasSize): void {
  arcadeFx(ctx, bubbleFxFor(state), state, () => drawBubbleArtWorld(ctx, state, size), size);
}

function drawBubbleArtWorld(ctx: CanvasRenderingContext2D, state: BubState, size: CanvasSize): void {
  // bubbleRev 5: the deeper tank and its lower gun (the original 620 / 560 otherwise).
  const BUB_WORLD_H = bubWorldH(state);
  const BUB_SHOOTER_Y = bubShooterY(state);
  const sx = size.width / BUB_WORLD_W;
  const sy = size.height / BUB_WORLD_H;
  const rs = Math.min(sx, sy);
  const dpr = seaDeviceScale(ctx);
  const t = seaClock();
  const X = (x: number) => x * sx;
  const Y = (y: number) => y * sy;

  ctx.save();
  // Water, margin rock and coral are one cached layer; rays, drifting bubbles and kelp move over it.
  const margin = X(BUB_WALL);
  const floor = size.height;
  seaLayer(ctx, "bubble-reef-a3", size.width, size.height, dpr, (c) => paintReef(c, size.width, size.height, margin, sy));
  bubbleRays(ctx, size.width, size.height, t);
  bubbleDrift(ctx, size.width, size.height, t);

  // Rising background bubbles (margins and open water, behind everything).
  if (!reducedMotion()) {
    ctx.fillStyle = "rgba(220,240,255,0.22)";
    for (let i = 0; i < 10; i++) {
      const speed = 18 + (i * 37) % 23;
      const yy = size.height - ((t * speed + i * 97) % (size.height + 20));
      const xx = ((i * 131) % 100) / 100 * size.width + Math.sin(t + i) * 4;
      ctx.beginPath();
      ctx.arc(xx, yy, 1.2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Kelp in the side margins, and short fronds on the sand beside the gun (below the shooter line).
  seaKelp(ctx, margin * 0.45, floor, size.height * 0.42, Math.max(2, margin * 0.16), 0);
  seaKelp(ctx, size.width - margin * 0.5, floor, size.height * 0.34, Math.max(2, margin * 0.16), 2.1);
  const sand = floor - SAND_DEPTH * sy + 3 * sy;
  seaKelp(ctx, size.width * 0.04, sand, 52 * sy, Math.max(2, 3 * rs), 1.2);
  seaKelp(ctx, size.width * 0.93, sand, 44 * sy, Math.max(2, 2.6 * rs), 3.4);

  // Rock ledge from the top down to the sim ceiling line: shaded stone, a lit lip, pebbles and barnacles.
  const ceiling = Y(BUB_TOP + state.descents * BUB_ROW_H);
  const bumps = 14;
  const lip: [number, number][] = [];
  for (let i = bumps; i >= 0; i--) lip.push([(i / bumps) * size.width, ceiling - (((i * 53) % 7) / 7) * Y(5)]);
  const rock = ctx.createLinearGradient(0, 0, 0, ceiling);
  rock.addColorStop(0, "#1C2028");
  rock.addColorStop(0.75, "#2A2F38");
  rock.addColorStop(1, "#353B46");
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size.width, 0);
  ctx.lineTo(size.width, ceiling);
  for (const [x, y] of lip) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3B424D";
  for (let i = 0; i < 9; i++) {
    const x = ((i * 0.13 + 0.05) % 1) * size.width;
    const y = (((i * 41) % 10) / 10) * Math.max(2, ceiling - Y(10)) + Y(4);
    ctx.beginPath();
    ctx.ellipse(x, y, X(14), Y(5), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(120,140,160,0.18)";
  for (let i = 0; i < 9; i++) {
    const x = ((i * 0.13 + 0.05) % 1) * size.width;
    const y = (((i * 41) % 10) / 10) * Math.max(2, ceiling - Y(10)) + Y(4);
    ctx.beginPath();
    ctx.ellipse(x - X(3), y - Y(1.5), X(8), Y(2), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Barnacles hanging just above the lip (inside the rock, never below the ceiling).
  ctx.fillStyle = "#C9C2B0";
  for (let i = 0; i < 12; i++) {
    const x = ((i * 37 + 11) % 97) / 97 * size.width;
    const y = ceiling - Y(9) - ((i * 5) % 4) * Y(2);
    if (y < Y(4)) continue;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, 2.2 * rs), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Strata: a few darker seams across the stone.
  ctx.strokeStyle = "rgba(8,10,16,0.35)";
  ctx.lineWidth = Math.max(0.8, rs);
  for (let i = 0; i < 3; i++) {
    const y = ((i + 1) / 4) * Math.max(4, ceiling - Y(12));
    if (y < Y(3)) continue;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let k = 1; k <= 6; k++) ctx.lineTo((k / 6) * size.width, y + (((k * 29 + i * 13) % 7) - 3) * rs);
    ctx.stroke();
  }
  // Polish A3: the lip lit from below by the water's glow: a soft light band inside the rock, then a bright edge.
  const glowH = Y(12);
  const lit = ctx.createLinearGradient(0, ceiling - glowH, 0, ceiling);
  lit.addColorStop(0, "rgba(110,190,235,0)");
  lit.addColorStop(1, "rgba(110,190,235,0.28)");
  ctx.fillStyle = lit;
  ctx.beginPath();
  ctx.moveTo(0, ceiling - glowH);
  ctx.lineTo(size.width, ceiling - glowH);
  for (const [x, y] of lip) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(120,200,240,0.28)";
  ctx.lineWidth = Math.max(2, 3.5 * rs);
  ctx.beginPath();
  lip.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - 1.5 * rs) : ctx.moveTo(x, y - 1.5 * rs)));
  ctx.stroke();
  ctx.strokeStyle = "rgba(210,240,255,0.7)";
  ctx.lineWidth = Math.max(1, 1.3 * rs);
  ctx.beginPath();
  lip.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - 1) : ctx.moveTo(x, y - 1)));
  ctx.stroke();

  // Shooter line, faint.
  ctx.strokeStyle = "rgba(245,197,66,0.28)";
  ctx.setLineDash([6 * rs, 6 * rs]);
  ctx.lineWidth = Math.max(1, 1.5 * rs);
  ctx.beginPath();
  // bubbleRev 8: the deeper reef's line sits just above the gun.
  ctx.moveTo(X(BUB_WALL), Y(bubDangerLine(state)));
  ctx.lineTo(X(BUB_WORLD_W - BUB_WALL), Y(bubDangerLine(state)));
  ctx.stroke();
  ctx.setLineDash([]);

  // Field.
  const radius = (BUB_R - 1) * rs;
  for (let row = 0; row < bubRowsOf(state.grid); row++) {
    for (let col = 0; col < bubRowCols(row); col++) {
      const value = state.grid[row * BUB_COLS + col]!;
      if (!value) continue;
      blitBubble(ctx, value, X(bubCellX(row, col)), Y(bubCellY(row, state.descents)), radius, dpr);
    }
  }

  // Pops and drops (presentation memory only).
  const m = memoFor(ctx, state);
  if (state.flightColour) lastFlight = state.flightColour;
  trackRemovals(m, state, lastFlight);
  const now = seaNow();
  const still = reducedMotion();
  m.fx = m.fx.filter((f) => now - f.born < (still ? 160 : 480));
  for (const f of m.fx) {
    const age = (now - f.born) / 1000;
    if (f.kind === 0) {
      const k = age / (still ? 0.16 : 0.48);
      // Symbol drifts up and fades; a stream of tiny bubbles.
      ctx.save();
      ctx.globalAlpha = 1 - k;
      drawCreature(ctx, 'fish', X(f.x), Y(f.y) - (still ? 0 : age * 60 * rs), radius * 0.3);
      ctx.fillStyle = "rgba(230,245,255,0.85)";
      if (!still) {
        for (let i = 0; i < 3; i++) {
          const a = ((f.seed + i * 1301) % 628) / 100;
          ctx.beginPath();
          ctx.arc(
            X(f.x) + Math.cos(a) * radius * (0.3 + k),
            Y(f.y) - age * (70 + i * 14) * rs,
            Math.max(0.8, (1.6 + (i % 2)) * rs),
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      ctx.restore();
    } else {
      const k = age / (still ? 0.16 : 0.48);
      blitBubble(ctx, f.value, X(f.x), Y(f.y) + (still ? 0 : age * age * 520 * rs), radius, dpr, 1 - k);
    }
  }

  // bubbleRev 2: the special's blast — a ring for the Bomb, a flash along the row for the Torpedo, a sparkle for the Joker.
  if (m.blast) {
    const f = m.blast;
    const age = (now - f.born) / 1000;
    const life = still ? 0.2 : 0.55;
    if (age >= life) m.blast = null;
    else {
      const k = age / life;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      if (f.kind === 2) {
        ctx.strokeStyle = "#FFB347";
        ctx.lineWidth = Math.max(2, 5 * rs * (1 - k));
        ctx.beginPath();
        ctx.arc(X(f.x), Y(f.y), (BUB_R + (still ? 2 : k * 2.4) * BUB_ROW_H) * rs, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,240,200,0.5)";
        ctx.beginPath();
        ctx.arc(X(f.x), Y(f.y), BUB_R * rs * (1.2 - k * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (f.kind === 3 && state.lineRev !== undefined) {
        // bubbleRev 4: a burst where the Torpedo stopped (no row flash: it never clears a row).
        ctx.strokeStyle = "#7FE6F5";
        ctx.lineWidth = Math.max(2, 4 * rs * (1 - k));
        ctx.beginPath();
        ctx.arc(X(f.x), Y(f.y), (BUB_R + (still ? 2 : k * 22)) * rs, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(220,250,255,0.6)";
        ctx.beginPath();
        ctx.arc(X(f.x), Y(f.y), BUB_R * rs * (1 - k * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (f.kind === 3) {
        ctx.fillStyle = "rgba(200,250,255,0.75)";
        const h = BUB_R * 2 * sy * (1 - k * 0.7);
        ctx.fillRect(X(BUB_WALL), Y(f.y) - h / 2, X(BUB_WORLD_W - 2 * BUB_WALL), h);
      } else {
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = Math.max(1.5, 2.5 * rs);
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          const d = (BUB_R + (still ? 4 : k * 26)) * rs;
          ctx.strokeStyle = BUB_PALETTE[i] ?? "#FFFFFF";
          ctx.beginPath();
          ctx.moveTo(X(f.x) + Math.cos(a) * d * 0.6, Y(f.y) + Math.sin(a) * d * 0.6);
          ctx.lineTo(X(f.x) + Math.cos(a) * d, Y(f.y) + Math.sin(a) * d);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  // Tuning B big-hit burst: see-through bubbles race from the bottom of the
  // screen to the top in about a second, drawn behind the gun and the loaded
  // bubble so the next shot is never covered.
  if (m.rise) {
    const age = (seaNow() - m.rise.born) / 1000;
    if (age > RISE_SECONDS + RISE_STAGGER || age < 0) m.rise = null;
    else {
      ctx.save();
      for (let i = 0; i < RISE_COUNT; i++) {
        const h = (m.rise.seed * 131 + i * 977) % 1000;
        const delay = ((h % 97) / 97) * RISE_STAGGER;
        const k = (age - delay) / RISE_SECONDS;
        if (k <= 0 || k >= 1) continue;
        const r = (3 + (h % 8)) * rs;
        const x = ((i + 0.5) / RISE_COUNT) * size.width + Math.sin(k * 9 + i) * 6 * rs;
        const y = size.height + r - k * (size.height + 2 * r);
        ctx.globalAlpha = 0.6 * Math.min(1, (1 - k) * 3);
        ctx.fillStyle = "rgba(200,236,255,0.14)";
        ctx.strokeStyle = "rgba(225,245,255,0.85)";
        ctx.lineWidth = Math.max(1, 1.4 * rs);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(x - r * 0.35, y - r * 0.35, Math.max(0.8, r * 0.22), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // bubbleRev 8: floating words over the reef (held still, briefly, under reduced motion).
  if (state.reef && m.notes.length) {
    const life = still ? 0.5 : 0.9;
    m.notes = m.notes.filter((n) => now - n.born < life * 1000);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${Math.round(16 * rs)}px Archivo, ui-sans-serif, sans-serif`;
    ctx.lineJoin = "round";
    for (const n of m.notes) {
      const k = (now - n.born) / (life * 1000);
      const y = Y(n.y) - (still ? 0 : k * 26 * rs);
      ctx.globalAlpha = Math.min(1, (1 - k) * 2.5);
      ctx.strokeStyle = "rgba(4,16,34,0.85)";
      ctx.lineWidth = Math.max(2, 4 * rs);
      ctx.strokeText(n.text, X(n.x), y);
      ctx.fillStyle = n.gold ? SEA_GOLD : "#BFF4FF";
      ctx.fillText(n.text, X(n.x), y);
    }
    ctx.restore();
  }

  // Diver's bubble gun: riveted brass base and the brass cradle ring.
  const gx = X(BUB_SHOOTER_X);
  const gy = Y(BUB_SHOOTER_Y);
  ctx.fillStyle = SEA_BRASS_DARK;
  ctx.beginPath();
  ctx.roundRect(gx - 26 * rs, gy + 12 * sy, 52 * rs, 14 * sy, 5 * rs);
  ctx.fill();
  const brass = ctx.createLinearGradient(0, gy + 14 * sy, 0, gy + 23 * sy);
  brass.addColorStop(0, "#F0D58A");
  brass.addColorStop(0.45, SEA_BRASS);
  brass.addColorStop(1, "#9A7A30");
  ctx.fillStyle = brass;
  ctx.beginPath();
  ctx.roundRect(gx - 22 * rs, gy + 14 * sy, 44 * rs, 9 * sy, 4 * rs);
  ctx.fill();
  ctx.fillStyle = SEA_BRASS_DARK;
  for (const dx of [-17, -6, 6, 17]) {
    ctx.beginPath();
    ctx.arc(gx + dx * rs, gy + 18.5 * sy, Math.max(0.8, 1.3 * rs), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = SEA_BRASS_DARK;
  ctx.lineWidth = Math.max(2.5, 4.5 * rs);
  ctx.beginPath();
  ctx.arc(gx, gy, (BUB_R + 2) * rs, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.strokeStyle = SEA_BRASS;
  ctx.lineWidth = Math.max(1.5, 3 * rs);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,240,200,0.6)";
  ctx.lineWidth = Math.max(0.6, rs);
  ctx.beginPath();
  ctx.arc(gx, gy, (BUB_R + 1) * rs, Math.PI * 0.3, Math.PI * 0.7);
  ctx.stroke();
  const holding = bubNextColour(state, 0);
  if (holding) blitBubble(ctx, holding, gx, gy, radius, dpr, 1, loadedHeading(state, holding));

  // Loaded queue: the next three in a brass magazine beside the gun.
  const qy = gy + 19 * sy;
  ctx.fillStyle = "rgba(10,30,52,0.7)";
  ctx.beginPath();
  ctx.roundRect(gx + 30 * rs, qy - 9 * rs, 68 * rs, 18 * rs, 9 * rs);
  ctx.fill();
  ctx.strokeStyle = SEA_BRASS;
  ctx.lineWidth = Math.max(1, 1.5 * rs);
  ctx.stroke();
  ctx.fillStyle = "rgba(200,235,255,0.14)";
  ctx.beginPath();
  ctx.roundRect(gx + 34 * rs, qy - 7 * rs, 60 * rs, 5 * rs, 2.5 * rs);
  ctx.fill();
  for (let ahead = 1; ahead <= 3; ahead++) {
    const value = bubNextColour(state, ahead);
    if (value) blitBubble(ctx, value, gx + (30 + ahead * 20 - 6) * rs, qy, 8 * rs, dpr, 1, loadedHeading(state, value));
  }

  // bubbleRev 4: the Torpedo's wake (a fading trail of fizz along the path it drilled), then the
  // Torpedo itself turned to the way it travels.
  const drillingNow = state.lineRev !== undefined && state.flightColour === BUB_LINE;
  if (drillingNow && m.wake.length > 1) {
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 1; i < m.wake.length; i++) {
      const a = m.wake[i - 1]!;
      const b = m.wake[i]!;
      const k = i / m.wake.length;
      ctx.strokeStyle = `rgba(190,245,255,${(0.5 * k).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, (3 + 7 * k) * rs);
      ctx.beginPath();
      ctx.moveTo(X(a.x), Y(a.y));
      ctx.lineTo(X(b.x), Y(b.y));
      ctx.stroke();
    }
    if (!still) {
      ctx.fillStyle = "rgba(230,250,255,0.7)";
      for (let i = 0; i < m.wake.length; i += 3) {
        const p = m.wake[i]!;
        const wob = (((i * 7919 + state.tick) % 9) - 4) * 0.8;
        ctx.beginPath();
        ctx.arc(X(p.x) + wob * rs, Y(p.y), Math.max(0.8, (1 + (i % 2)) * rs), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  if (state.flightColour) {
    const heading = drillingNow ? Math.atan2(state.vy * sy, state.vx * sx) : undefined;
    blitBubble(ctx, state.flightColour, X(state.x / 256), Y(state.y / 256), radius, dpr, 1, heading);
  }

  // HUD readout on the rock.
  ctx.fillStyle = SEA_GOLD;
  ctx.font = `bold ${Math.round(18 * rs)}px ui-monospace, monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  successHud(ctx,'bubble',state.tick,14,18,()=>{ctx.fillText(`Popped ${state.popped}`, X(14), Y(BUB_HUD_H * 0.36));});
  // bubbleRev 8: the chest tally on the rock's right, and the pop streak once it is a combo.
  if (state.reef) {
    drawChestTally(ctx, state, X(BUB_WORLD_W - 14), Y(BUB_HUD_H * 0.36), rs, dpr);
    if ((state.streak ?? 0) >= 2) {
      ctx.save();
      ctx.font = `bold ${Math.round(13 * rs)}px ui-monospace, monospace`;
      ctx.fillStyle = "#BFF4FF";
      ctx.textAlign = "left";
      ctx.fillText(`COMBO ×${state.streak}`, X(14), Y(BUB_HUD_H * 0.72));
      ctx.restore();
    }
  }
  const pop=m.fx[m.fx.length-1];
  successFrame(ctx,{id:'bubble',tick:state.tick,count:state.popped,colour:SEA_GOLD,width:size.width,height:size.height,point:{x:X(pop?.x??BUB_SHOOTER_X),y:Y(pop?.y??BUB_TOP),shape:'fish'},hud:{x:X(14),y:Y(8),text:`Popped ${state.popped}`}});
  successFrame(ctx,{id:'bubble-drop',tick:state.tick,count:Math.floor(state.dropped/5),colour:SEA_TEXT,width:size.width,height:size.height,point:{x:X(pop?.x??BUB_SHOOTER_X),y:Y(pop?.y??BUB_TOP),shape:'bubble'}});
  ctx.fillStyle = SEA_TEXT;
  ctx.restore();
}

/** Faint dotted bubble trail for the current aim; same path maths the stage used. */
export function drawBubbleAimTrail(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  shot: { vx: number; vy: number } | null,
  state: BubState,
): void {
  if (!shot || state.flightColour !== 0) return;
  const BUB_WORLD_H = bubWorldH(state);
  const BUB_SHOOTER_Y = bubShooterY(state);
  const sx = size.width / BUB_WORLD_W;
  const sy = size.height / BUB_WORLD_H;
  const rs = Math.min(sx, sy);
  const left = BUB_WALL + BUB_R;
  const right = BUB_WORLD_W - BUB_WALL - BUB_R;
  let x = BUB_SHOOTER_X;
  let y = BUB_SHOOTER_Y;
  let vx = shot.vx / 64;
  const vy = shot.vy / 64;
  let travelled = 0;
  let next = 10;
  ctx.save();
  ctx.fillStyle = "rgba(225,242,255,0.5)";
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = Math.max(0.8, rs);
  const stepLen = Math.hypot(vx, vy);
  for (let i = 0; i < 160 && y > 0; i++) {
    x += vx;
    y += vy;
    if (x < left) {
      x = left + (left - x);
      vx = -vx;
    } else if (x > right) {
      x = right - (x - right);
      vx = -vx;
    }
    travelled += stepLen;
    if (travelled >= next) {
      next += 11;
      const r = Math.max(1.2, (2.6 - i * 0.004) * rs);
      ctx.beginPath();
      ctx.arc(x * sx, y * sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export const bubbleArtGame = { ...bubbleGame, draw: drawBubbleArt };
