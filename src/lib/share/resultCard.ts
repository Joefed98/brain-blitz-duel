/**
 * The shared results card: a 1080 × 1350 PNG (4:5, the shape feeds and chats show whole) drawn on a
 * canvas in the app's gold-on-black skin (theme.css tokens): the app name (APP_NAME), the sharer's
 * place and total, the top three with medals, the round games' icons and the room code. It draws
 * only what RoomShareData carries, so no answer or puzzle content can reach it. Presentation only.
 */
import { APP_NAME } from "@/lib/brand";
import {
  GOLD_SHINE_STOPS,
  LOGO_BOX,
  LOGO_COLOURS,
  LOGO_LEAD,
  LOGO_LOWER,
  LOGO_TRAIL,
  LOGO_UPPER,
} from "@/components/brand/logoGeometry";
import { arcadeGroupInfo, arcadeGroupOf } from "@/lib/duel/arcadeGroups";
import { ordinal } from "@/lib/duel/ordinal";
import { puzzleDef } from "@/lib/duel/registry";

import type { RoomShareData } from "./roomShare";

export const CARD_W = 1080;
export const CARD_H = 1350;

/** The skin's tokens (polish-layout/theme.css). */
const INK = "#07070A";
const TEXT = "#F5F5F7";
const MUTED = "#BDBDCC";
const GOLD = "#F2C75C";
const GOLD_HI = "#FFE7A3";
const GOLD_LO = "#B9862A";
const MEDALS: Record<number, [string, string]> = {
  1: ["#FFE07A", "#C9971F"],
  2: ["#E4E8EE", "#8E96A3"],
  3: ["#EBA866", "#9A5B22"],
};
/** Category colours (styles.css --category-*), for icon tiles. */
const CATEGORY: Record<string, string> = {
  word: "#4D8CFF",
  number: "#3DDC84",
  speed: "#FF8A3D",
  attention: "#FF6BD6",
  pattern: "#B26BFF",
  logic: "#2ED3B7",
  arcade: "#FF4D4D",
};

// One font since design foundation F1 (DESIGN.md): Archivo for every line; numbers drawn tabular by the glyphs.
const DISPLAY = `"Archivo", system-ui, sans-serif`;
const BODY = `"Archivo", system-ui, sans-serif`;
const MONO = `"Archivo", system-ui, sans-serif`;

/** The card's fonts, loaded before drawing (self-hosted, so this is quick once the app has shown them). */
export async function loadCardFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  await Promise.all(
    [
      `800 100px "Archivo"`,
      `700 100px "Archivo"`,
      `700 40px "Archivo"`,
      `600 40px "Archivo"`,
    ].map((f) => document.fonts.load(f).catch(() => [])),
  );
}

type Ctx = CanvasRenderingContext2D;

/** Mixes a #rrggbb colour toward black (t = 0) or keeps it (t = 1). */
export function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v * t);
  return `rgb(${ch((n >> 16) & 255)} ${ch((n >> 8) & 255)} ${ch(n & 255)})`;
}

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Cuts text to fit `max` px with an ellipsis. */
export function fitText(c: Ctx, text: string, max: number): string {
  if (c.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && c.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function goldFill(c: Ctx, top: number, bottom: number): CanvasGradient {
  const g = c.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, GOLD_HI);
  g.addColorStop(0.48, GOLD);
  g.addColorStop(0.52, "#E2AE3E");
  g.addColorStop(1, GOLD_LO);
  return g;
}

function bolt(c: Ctx, x: number, y: number, s: number): void {
  // The Wordmark's BoltGlyph path (24-unit box).
  const k = s / 24;
  const p: [number, number][] = [
    [14, 2],
    [5, 14],
    [11, 14],
    [9, 22],
    [19, 9],
    [13, 9],
    [14, 2],
  ];
  c.beginPath();
  p.forEach(([px, py], i) =>
    i ? c.lineTo(x + px * k, y + py * k) : c.moveTo(x + px * k, y + py * k),
  );
  c.closePath();
  c.fill();
}

/** The app's logo (Prompt R): the inverted mark on a rounded square of the gold shine (logoGeometry.ts). */
function logoMark(c: Ctx, x: number, y: number, s: number): void {
  c.save();
  c.shadowBlur = 0;
  roundRect(c, x, y, s, s, s * 0.225);
  const shine = c.createLinearGradient(0, y, 0, y + s);
  for (const [offset, colour] of GOLD_SHINE_STOPS) shine.addColorStop(offset, colour);
  c.fillStyle = shine;
  c.fill();
  const k = (s * 0.58) / LOGO_BOX.h;
  const ox = x + (s - LOGO_BOX.w * k) / 2;
  const oy = y + (s - LOGO_BOX.h * k) / 2;
  const look = LOGO_COLOURS.inverted;
  const polygon = (points: readonly (readonly [number, number])[], colours: readonly string[]) => {
    const fill = c.createLinearGradient(0, oy + Math.min(...points.map((p) => p[1])) * k, 0, oy + Math.max(...points.map((p) => p[1])) * k);
    colours.forEach((colour, i) => fill.addColorStop(i / (colours.length - 1), colour));
    c.beginPath();
    points.forEach(([px, py], i) => (i ? c.lineTo(ox + px * k, oy + py * k) : c.moveTo(ox + px * k, oy + py * k)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  };
  polygon(LOGO_UPPER, look.upper);
  polygon(LOGO_LOWER, look.lower);
  c.lineWidth = k;
  c.lineCap = "round";
  for (const line of [LOGO_TRAIL, LOGO_LEAD]) {
    const fade = c.createLinearGradient(ox + line.from * k, 0, ox + line.to * k, 0);
    fade.addColorStop(0, `rgb(13 13 15 / ${look.lineOpacity})`);
    fade.addColorStop(1, "rgb(13 13 15 / 0)");
    c.strokeStyle = fade;
    c.beginPath();
    c.moveTo(ox + line.from * k, oy + line.y * k);
    c.lineTo(ox + line.to * k, oy + line.y * k);
    c.stroke();
  }
  c.restore();
}

function medal(c: Ctx, cx: number, cy: number, r: number, place: number): void {
  const [hi, lo] = MEDALS[place] ?? ["#3A3D4C", "#2A2C38"];
  const g = c.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, hi);
  g.addColorStop(1, lo);
  c.fillStyle = g;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgb(255 255 255 / 0.35)";
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = place <= 3 ? "#1A1405" : TEXT;
  c.font = `700 ${Math.round(r * 1.05)}px ${MONO}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(String(place), cx, cy + r * 0.06);
}

/** A game's icon tile as the app draws it (GameIcon): black, the game's drawing, a border in its category's colour (or the app's bolt). */
function iconTile(
  c: Ctx,
  x: number,
  y: number,
  s: number,
  type: string,
  art: CanvasImageSource | null | undefined,
): void {
  let cat = "arcade";
  try {
    cat = puzzleDef(type as never).category;
  } catch {
    /* a removed game keeps the default tile */
  }
  const group = arcadeGroupOf(type);
  const colour = (group ? arcadeGroupInfo(group).colour : CATEGORY[cat]) ?? GOLD;
  const border = Math.max(1.5, Math.round(s * 0.045 * 2) / 2);
  c.save();
  roundRect(c, x, y, s, s, s * 0.28);
  c.clip();
  c.fillStyle = "#000";
  c.fillRect(x, y, s, s);
  if (art) {
    c.drawImage(art, x, y, s, s);
  } else {
    c.fillStyle = colour;
    bolt(c, x + s * 0.22, y + s * 0.2, s * 0.56);
  }
  c.restore();
  c.save();
  roundRect(c, x + border / 2, y + border / 2, s - border, s - border, s * 0.28 - border / 2);
  c.strokeStyle = colour;
  c.lineWidth = border;
  c.stroke();
  c.restore();
}

export type CardIcons = ReadonlyMap<string, CanvasImageSource | null>;

/** Draws the card on a 1080 × 1350 context. */
export function drawResultCard(c: Ctx, data: RoomShareData, icons: CardIcons = new Map()): void {
  c.save();
  c.textAlign = "center";
  c.textBaseline = "alphabetic";

  // Background: the skin's near-black, a warm glow behind the place, a fine gold frame.
  c.fillStyle = INK;
  c.fillRect(0, 0, CARD_W, CARD_H);
  const glow = c.createRadialGradient(CARD_W / 2, 470, 40, CARD_W / 2, 470, 640);
  glow.addColorStop(0, "rgb(242 199 92 / 0.22)");
  glow.addColorStop(0.55, "rgb(242 199 92 / 0.05)");
  glow.addColorStop(1, "rgb(242 199 92 / 0)");
  c.fillStyle = glow;
  c.fillRect(0, 0, CARD_W, CARD_H);
  roundRect(c, 36, 36, CARD_W - 72, CARD_H - 72, 52);
  c.strokeStyle = goldFill(c, 36, CARD_H - 36);
  c.lineWidth = 4;
  c.stroke();

  // The app name: Archivo 800, its last letter gold (the Wordmark), the logo beside it.
  c.font = `800 112px ${DISPLAY}`;
  const head = APP_NAME.slice(0, -1);
  const last = APP_NAME.slice(-1);
  const headW = c.measureText(head).width;
  const lastW = c.measureText(last).width;
  const boltS = 92;
  const nameW = headW + lastW + 18 + boltS;
  let x = CARD_W / 2 - nameW / 2;
  c.textAlign = "left";
  c.fillStyle = TEXT;
  c.fillText(head, x, 196);
  c.fillStyle = goldFill(c, 110, 200);
  c.shadowColor = "rgb(242 199 92 / 0.6)";
  c.shadowBlur = 24;
  c.fillText(last, x + headW, 196);
  x += headW + lastW + 18;
  logoMark(c, x, 106, boltS);
  c.shadowBlur = 0;
  c.textAlign = "center";

  c.fillStyle = MUTED;
  c.font = `700 34px ${BODY}`;
  c.letterSpacing = "8px";
  c.fillText("ROOM RESULTS", CARD_W / 2, 262);
  c.letterSpacing = "0px";

  // Place and total.
  const placeText = data.place ? ordinal(data.place).toUpperCase() : "GG";
  c.font = `800 260px ${DISPLAY}`;
  c.fillStyle = goldFill(c, 330, 520);
  c.shadowColor = "rgb(242 199 92 / 0.45)";
  c.shadowBlur = 40;
  c.fillText(placeText, CARD_W / 2, 520);
  c.shadowBlur = 0;
  c.fillStyle = MUTED;
  c.font = `600 38px ${BODY}`;
  const of = data.place ? `of ${data.players} player${data.players === 1 ? "" : "s"} · ` : "";
  c.fillText(`${of}${data.rounds} rounds`, CARD_W / 2, 584);
  c.fillStyle = TEXT;
  c.font = `700 92px ${MONO}`;
  c.fillText(`${data.total} pts`, CARD_W / 2, 684);

  // The top three.
  const panelX = 110;
  const panelW = CARD_W - 220;
  const rowH = 88;
  const panelY = 736;
  const panelH = rowH * Math.max(1, data.top.length) + 24;
  roundRect(c, panelX, panelY, panelW, panelH, 32);
  c.fillStyle = "rgb(255 255 255 / 0.045)";
  c.fill();
  c.strokeStyle = "rgb(255 255 255 / 0.12)";
  c.lineWidth = 2;
  c.stroke();
  data.top.forEach((row, i) => {
    const cy = panelY + 12 + rowH * i + rowH / 2;
    medal(c, panelX + 66, cy, 32, row.place);
    c.textBaseline = "middle";
    c.textAlign = "right";
    c.font = `700 50px ${MONO}`;
    c.fillStyle = row.place === 1 ? GOLD : TEXT;
    const totalText = String(row.total);
    c.fillText(totalText, panelX + panelW - 40, cy + 2);
    const totalW = c.measureText(totalText).width;
    c.textAlign = "left";
    c.font = `700 46px ${BODY}`;
    c.fillStyle = TEXT;
    c.fillText(fitText(c, row.name, panelW - 140 - totalW - 70), panelX + 122, cy + 2);
    c.textBaseline = "alphabetic";
  });

  // The round games, in order.
  const games = data.games.slice(0, 7);
  const size = games.length > 6 ? 104 : 116;
  const gap = games.length > 6 ? 20 : 24;
  const rowW = games.length * size + Math.max(0, games.length - 1) * gap;
  // Anchored to the bottom, whatever the podium's height.
  const iconsY = 1068 + (116 - size) / 2;
  games.forEach((type, i) =>
    iconTile(c, CARD_W / 2 - rowW / 2 + i * (size + gap), iconsY, size, type, icons.get(type)),
  );

  // The room code and where to play.
  c.textAlign = "center";
  c.fillStyle = GOLD;
  c.font = `700 44px ${MONO}`;
  c.letterSpacing = "6px";
  c.fillText(`${data.codeLabel ?? "ROOM"} ${data.roomCode}`, CARD_W / 2, CARD_H - 110);
  c.letterSpacing = "0px";
  c.fillStyle = MUTED;
  c.font = `600 30px ${BODY}`;
  let host = "";
  try {
    host = new URL(data.link).host;
  } catch {
    /* no host line */
  }
  if (host) c.fillText(`Play at ${host}`, CARD_W / 2, CARD_H - 66);
  c.restore();
}

/** Draws the card and encodes it as a PNG file (null when the canvas can't be encoded). */
export async function resultCardFile(
  data: RoomShareData,
  icons: CardIcons = new Map(),
): Promise<File | null> {
  if (typeof document === "undefined") return null;
  await loadCardFonts();
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const c = canvas.getContext("2d");
  if (!c) return null;
  drawResultCard(c, data, icons);
  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), "image/png");
    } catch {
      resolve(null);
    }
  });
  if (!blob) return null;
  return new File([blob], `${APP_NAME.toLowerCase()}-results-${data.roomCode}.png`, {
    type: "image/png",
  });
}
