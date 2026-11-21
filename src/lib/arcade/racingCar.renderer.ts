/**
 * Apex's rendered race car (the Sports overhaul, 15 Nov 2026; display only): the open prototype with Captain Joulz at
 * the wheel, rendered in Blender (docs/design/game-art/sports/render_sports.py) at seven yaws, with brake lights and a
 * paint mask, into public/sports/racing/ (one shared box, so the three variants overlay exactly).
 *
 * Bounds rule (rule 3): each yaw's car (its alpha over 24, recorded in SPORTS_SPRITES.racing.frames) is drawn exactly
 * `width` wide (the collision width), centred, its lowest pixel on the contact line; nothing else is drawn outside it.
 *
 * Paints (wave 2 skins) and ghosts: the paint mask is the paint's own shading; a colour multiplied into it replaces the
 * graphite where the paint is, so a skin or a ghost's colour keeps the car's light and shape. Until the images arrive
 * (and in Bun, where there is no Image) `drawRacingCarSprite` answers false and the caller paints its own car.
 */
import { sportsSprite, SPORTS_SPRITES } from "./sportsSprites";
import type { CarPaint } from "./skins/racing.skins";

type Ctx2D = CanvasRenderingContext2D;
interface FrameBox {
  yaw: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const DATA = (SPORTS_SPRITES as unknown as { racing: { w: number; h: number; frames: FrameBox[] } }).racing;
/** The rendered yaws (degrees) and each frame's car box in the shared sprite box. */
export const RACING_CAR_FRAMES: readonly FrameBox[] = DATA.frames;
export const RACING_CAR_SPRITE_W = DATA.w;
export const RACING_CAR_SPRITE_H = DATA.h;

/**
 * The frame nearest a yaw in degrees (positive = turning right, the sim's steer and the painted car's turn).
 *
 * The rendered frames turn the other way (20 Nov 2026, the polish plan's C4.7): render_sports.py turns the car
 * about +z with the camera behind it, so the frame labelled +5° shows the nose swung to the screen's LEFT. Until
 * this fix the game fed its right-steer yaw straight to the table and the car turned the wrong way round every bend.
 * The table keeps the frames' own labels; this lookup mirrors the asked yaw onto them.
 */
export function racingCarFrameFor(yawDeg: number): number {
  const frameYaw = -yawDeg;
  let best = 0;
  for (let i = 1; i < RACING_CAR_FRAMES.length; i++)
    if (Math.abs(RACING_CAR_FRAMES[i]!.yaw - frameYaw) < Math.abs(RACING_CAR_FRAMES[best]!.yaw - frameYaw)) best = i;
  return best;
}

/** Where a frame is drawn for a car `width` wide centred on `cx` with its lowest pixel on `contactY` (the bounds rule). */
export function racingCarPlacement(frame: number, cx: number, contactY: number, width: number): { x: number; y: number; w: number; h: number; scale: number } {
  const f = RACING_CAR_FRAMES[frame]!;
  const scale = width / (f.right - f.left);
  const x = cx - ((f.left + f.right) / 2) * scale;
  const y = contactY - f.bottom * scale;
  return { x, y, w: RACING_CAR_SPRITE_W * scale, h: RACING_CAR_SPRITE_H * scale, scale };
}

/** The paint a skin wears on the sprite (a colour into the mask, and its marks over it). */
function paintColour(paint: CarPaint): string {
  return paint === "stripes" ? "#2050D8" : paint === "neon" ? "#2A1F6A" : "#F2C14E";
}

const tinted = new Map<string, HTMLCanvasElement | OffscreenCanvas>();

function surface(w: number, h: number): HTMLCanvasElement | OffscreenCanvas | null {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
}

/** The paint layer of a frame in `colour` (the mask's shading × the colour, inside the mask), cached per frame and colour. */
function paintLayer(frame: number, colour: string, marks: CarPaint | null, mask: HTMLImageElement): HTMLCanvasElement | OffscreenCanvas | null {
  const key = `${frame}|${colour}|${marks ?? ""}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const c = surface(RACING_CAR_SPRITE_W, RACING_CAR_SPRITE_H);
  if (!c) return null;
  const g = c.getContext("2d") as unknown as Ctx2D | null;
  if (!g) return null;
  g.drawImage(mask, 0, 0);
  g.globalCompositeOperation = "multiply";
  g.fillStyle = colour;
  g.fillRect(0, 0, RACING_CAR_SPRITE_W, RACING_CAR_SPRITE_H);
  if (marks === "stripes" || marks === "neon") {
    // Racing Stripes' two white stripes, the Neon paint's cyan one, down the car's middle (inside the mask below).
    const f = RACING_CAR_FRAMES[frame]!;
    const cx = (f.left + f.right) / 2;
    const w = f.right - f.left;
    g.globalCompositeOperation = "source-over";
    g.fillStyle = marks === "stripes" ? "rgba(255,255,255,0.92)" : "rgba(34,228,255,0.9)";
    if (marks === "stripes") {
      g.fillRect(cx - w * 0.09, 0, w * 0.06, RACING_CAR_SPRITE_H);
      g.fillRect(cx + w * 0.03, 0, w * 0.06, RACING_CAR_SPRITE_H);
    } else g.fillRect(cx - w * 0.03, 0, w * 0.06, RACING_CAR_SPRITE_H);
  }
  g.globalCompositeOperation = "destination-in";
  g.drawImage(mask, 0, 0);
  if (tinted.size > 64) tinted.clear();
  tinted.set(key, c);
  return c;
}

export interface RacingCarDraw {
  cx: number;
  contactY: number;
  /** The collision width on screen. */
  width: number;
  /** Degrees, positive = turning right. */
  yawDeg: number;
  braking: boolean;
  /** The player's paint (null: the default graphite). */
  paint?: CarPaint | null;
  /** A ghost's colour (the whole paint in it, drawn translucent by the caller). */
  ghost?: string | null;
}

/** Draws the rendered car; false when its images haven't arrived (the caller paints its own). */
export function drawRacingCarSprite(ctx: Ctx2D, o: RacingCarDraw): boolean {
  const frame = racingCarFrameFor(o.yawDeg);
  const body = sportsSprite("racing", `${o.braking ? "brake" : "car"}-${frame}`);
  if (!body) return false;
  const p = racingCarPlacement(frame, o.cx, o.contactY, o.width);
  // A soft contact shadow, inside the car's width and above its contact line.
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.beginPath();
  ctx.ellipse(o.cx, o.contactY - o.width * 0.045, o.width * 0.48, o.width * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(body, p.x, p.y, p.w, p.h);
  const colour = o.ghost ?? (o.paint ? paintColour(o.paint) : null);
  if (colour) {
    const mask = sportsSprite("racing", `mask-${frame}`);
    const layer = mask ? paintLayer(frame, colour, o.ghost ? null : (o.paint ?? null), mask) : null;
    if (layer) ctx.drawImage(layer as CanvasImageSource, p.x, p.y, p.w, p.h);
  }
  ctx.restore();
  return true;
}

/** The images to ask for ahead of the race (the intro): every yaw, lit and braking, and the masks. */
export const RACING_CAR_SPRITE_NAMES: readonly string[] = ["car", "brake", "mask"].flatMap((v) => RACING_CAR_FRAMES.map((_, i) => `${v}-${i}`));
