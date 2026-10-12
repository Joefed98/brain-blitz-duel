import { successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { BALLTRACK_FX } from "./arcadeFxGames.renderer";
/**
 * Ball Track in the Toybox world: a wooden marble run. Render only; mirrors
 * btDraw's private geometry (tile centres, tube path, ball radius 22.5) and
 * reads state without writing it.
 */
import {
  BT_BALLS, BT_COLS, BT_CORNER, BT_H, BT_HOPPER_COL, BT_HOPPER_H, BT_KIND, BT_PALETTE,
  BT_REV, BT_ROWS, BT_SHUFFLE_TICKS, BT_TILE, BT_TRAY_H, BT_TURN_TICKS, BT_W, E, N, S, W,
  btBallPoint, btEventCountdown, btRotatable, btSwitchedOn, btTraysAt, rowDir,
  type BtBall, type BtCourse, type BtState,
} from "./ballTrack";
import {
  TOY_BRASS, TOY_INK, TOY_OAK, TOY_WOOD_DARK, TOY_WOOD_DEEP,
  toyBoard, toyMarble, toyTabletop,
} from "./toybox.renderer";

const BALL_R = 22.5;
const SLOT = 100;
const CHANNEL_FIXED = "#9C6B3E";
const CHANNEL_SWITCH = "#B5683A";
const GROOVE = "#5A3519";
const SWITCH_BRASS = "#A47726";
const SWITCH_EDGE = "#493619";
/** Carved symbol per colour index: circle, square, triangle, diamond. */
export const BT_SYMBOLS = ["circle", "square", "triangle", "diamond"] as const;

const cellCentre = (cell: number) => ({
  x: (cell % BT_COLS) * BT_TILE + BT_TILE / 2,
  y: BT_HOPPER_H + Math.floor(cell / BT_COLS) * BT_TILE + BT_TILE / 2,
});
const pointOf = (cell: number) => {
  if (cell < 0) return { x: BT_HOPPER_COL * BT_TILE + BT_TILE / 2, y: BT_HOPPER_H / 2 };
  if (cell >= SLOT) return { x: (cell - SLOT) * BT_TILE + BT_TILE / 2, y: BT_HOPPER_H + BT_ROWS * BT_TILE + BT_TRAY_H / 2 };
  return cellCentre(cell);
};

function tubePath(ctx: CanvasRenderingContext2D, cell: number, mask: number) {
  const { x, y } = cellCentre(cell);
  const h = BT_TILE / 2 - 2;
  const end = (side: number) => ({ x: x + (side === E ? h : side === W ? -h : 0), y: y + (side === S ? h : side === N ? -h : 0) });
  const sides = [N, E, S, W].filter((side) => mask & side);
  if (sides.length === 2 && !(mask === (N | S) || mask === (E | W))) {
    const a = end(sides[0]!), b = end(sides[1]!);
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(x, y, b.x, b.y);
  } else if (sides.length === 2) {
    const a = end(sides[0]!), b = end(sides[1]!);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  } else {
    for (const side of sides) {
      const p = end(side);
      ctx.moveTo(x, y);
      ctx.lineTo(p.x, p.y);
    }
  }
}

/**
 * Rev 2 turn animation: the eased turn progress of a tube (1 when settled) and
 * the swing direction (+1 clockwise) that carries a marble's entry end to the
 * upstream side, so a riding marble keeps rolling the way it was going.
 */
function turnOf(s: BtState, cell: number): { u: number; sign: number } {
  const since = s.tick - (s.turned?.[cell] ?? -1000);
  const k = Math.max(0, Math.min(1, since / BT_TURN_TICKS));
  const d = rowDir(Math.floor(cell / BT_COLS));
  const toVertical = s.vert[cell] === 1;
  return { u: k * k * (3 - 2 * k), sign: toVertical ? (d > 0 ? 1 : -1) : (d > 0 ? -1 : 1) };
}

/** Where a marble is drawn: rev 2 marbles in a tube turned since they entered swing round with it. */
function ballPoint(s: BtState, b: BtBall, rot: Set<number>) {
  const p = btBallPoint(s, b);
  if (s.rev !== BT_REV || b.cell < 0 || b.cell >= SLOT || !rot.has(b.cell)) return p;
  const enteredVertical = b.above === 1;
  if (enteredVertical === (s.vert[b.cell] === 1)) return p;
  const c = cellCentre(b.cell);
  const { u, sign } = turnOf(s, b.cell);
  const a = sign * (Math.PI / 2) * u;
  const dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
}

/** Rev 2 switch point badge on a live bottom-row drop: ↓ drops into the tray, → sends marbles on. */
function drawSwitch(ctx: CanvasRenderingContext2D, cell: number, on: boolean) {
  const { x, y } = cellCentre(cell);
  ctx.save();
  ctx.fillStyle = on ? "#2B1A0E" : "#3A2614";
  ctx.strokeStyle = on ? "#FFD27A" : "#FFF1CF";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.translate(x, y);
  if (on) ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = on ? "#FFD27A" : "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(-4, -12);
  ctx.lineTo(4, -12);
  ctx.lineTo(4, 1);
  ctx.lineTo(11, 1);
  ctx.lineTo(0, 13);
  ctx.lineTo(-11, 1);
  ctx.lineTo(-4, 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function symbol(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, r: number) {
  ctx.beginPath();
  const s = BT_SYMBOLS[kind % BT_SYMBOLS.length];
  if (s === "circle") ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (s === "square") ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else if (s === "triangle") { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath(); }
  else { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
}

/** Ball Tracker drawing (world units; the caller scales) through the shared success layer. */
export function btArtDraw(ctx: CanvasRenderingContext2D, course: BtCourse, s: BtState, rotatable?: Set<number>) {
  arcadeFx(ctx, BALLTRACK_FX, s, () => btArtDrawWorld(ctx, course, s, rotatable));
}

function btArtDrawWorld(ctx: CanvasRenderingContext2D, course: BtCourse, s: BtState, rotatable?: Set<number>) {
  const gridY = BT_HOPPER_H;
  const rot = rotatable ?? new Set(btRotatable(course));
  toyTabletop(ctx);
  toyBoard(ctx, 0, 0, BT_W, BT_H, 14);
  // Hopper shelf and tray shelf in darker wood.
  ctx.fillStyle = "rgba(60,35,15,0.25)";
  ctx.fillRect(0, 0, BT_W, gridY);
  ctx.fillRect(0, gridY + BT_ROWS * BT_TILE, BT_W, BT_TRAY_H);

  const v2 = s.rev === BT_REV;
  const liveDrop = (cell: number) => cell >= (BT_ROWS - 1) * BT_COLS && (btTraysAt(course, s.tick)[cell % BT_COLS] ?? -1) >= 0;
  const maskOf = (cell: number) => (liveDrop(cell) && !btSwitchedOn(s.sw, cell % BT_COLS) ? N | S : BT_KIND[cell] === 2 ? BT_CORNER[cell]! : s.vert[cell] ? N | S : E | W);
  // Rev 2: tubes mid-turn are drawn on their own, swung back by the part of the turn still to come.
  const turning = new Set<number>();
  if (v2) for (const cell of rot) if (turnOf(s, cell).u < 1) turning.add(cell);
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  // Wooden channels: dark rim, wood bed, centre groove — same widths as the sim's tubes.
  for (const movable of [false, true]) {
    const layers: [number, string][] = [
      [BALL_R * 3 + 6, TOY_WOOD_DEEP],
      [BALL_R * 3, movable ? CHANNEL_SWITCH : CHANNEL_FIXED],
      [BALL_R * 2, movable ? "#C47A48" : "#AD7A4A"],
      [3, GROOVE],
    ];
    for (const [width, colour] of layers) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let cell = 0; cell < BT_KIND.length; cell++) if (BT_KIND[cell] && rot.has(cell) === movable && !turning.has(cell)) tubePath(ctx, cell, maskOf(cell));
      ctx.stroke();
    }
  }
  for (const cell of turning) {
    const { x, y } = cellCentre(cell);
    const { u, sign } = turnOf(s, cell);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-sign * (Math.PI / 2) * (1 - u));
    ctx.translate(-x, -y);
    for (const [width, colour] of [[BALL_R * 3 + 6, TOY_WOOD_DEEP], [BALL_R * 3, CHANNEL_SWITCH], [BALL_R * 2, "#C47A48"], [3, GROOVE]] as [number, string][]) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      tubePath(ctx, cell, maskOf(cell));
      ctx.stroke();
    }
    ctx.restore();
  }
  // Switches: a brass pin at each rotatable paddle's centre.
  for (const cell of rot) {
    const { x, y } = cellCentre(cell);
    ctx.fillStyle = SWITCH_BRASS;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = SWITCH_EDGE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  if (v2) for (let col = 1; col < BT_COLS; col++) {
    const cell = (BT_ROWS - 1) * BT_COLS + col;
    if (liveDrop(cell)) drawSwitch(ctx, cell, btSwitchedOn(s.sw, col));
  }

  // Wooden cups, each carved with its symbol; same slide/flash timing as before.
  const trayY = gridY + BT_ROWS * BT_TILE + 6;
  const event = s.tick >= course.shuffle.tick ? course.shuffle : s.tick >= course.relay.tick ? course.relay : null;
  const prior = event ? btTraysAt(course, event.tick - 1) : course.trays;
  const since = event ? s.tick - event.tick : -1;
  const k = since < 0 ? 0 : Math.min(1, since / BT_SHUFFLE_TICKS);
  const ease = k * k * (3 - 2 * k);
  const shuffleFlash = since >= 0 && since < BT_SHUFFLE_TICKS + 20 && Math.floor(since / 5) % 2 === 0;
  const now = btTraysAt(course, s.tick);
  prior.forEach((tray, from) => {
    if (tray < 0) return;
    const to = event ? event.trays.indexOf(tray) : from;
    const col = from + (to - from) * ease;
    const x = col * BT_TILE + 6, w = BT_TILE - 12, h = BT_TRAY_H - 10;
    const landed = now.indexOf(tray);
    const flash = shuffleFlash || s.landings.some((m) => m.cell === landed && s.tick - m.tick < 30);
    ctx.fillStyle = TOY_OAK;
    ctx.fillRect(x, trayY, w, h);
    ctx.fillStyle = TOY_WOOD_DEEP;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x + 4, trayY + 3, w - 8, h - 6);
    ctx.globalAlpha = flash ? 0.6 : 0.25;
    ctx.fillStyle = BT_PALETTE[tray]!;
    ctx.fillRect(x, trayY, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = shuffleFlash ? "#FFFFFF" : BT_PALETTE[tray]!;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, trayY, w, h);
    // Carved symbol: dark cut with a light lower edge.
    const sx = x + w / 2, sy = trayY + h / 2;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(255,235,200,0.5)";
    ctx.save();
    ctx.translate(0, 1);
    symbol(ctx, tray, sx, sy, 8);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = TOY_INK;
    symbol(ctx, tray, sx, sy, 8);
    ctx.stroke();
  });

  // Landings: a settle wobble in the cup (right) or a grey marble bouncing out (wrong). Animation only.
  for (const m of s.landings) {
    const age = s.tick - m.tick;
    if (age < 0 || age >= 30) continue;
    const trays = btTraysAt(course, m.tick);
    const x = m.cell * BT_TILE + BT_TILE / 2;
    const cupY = trayY + (BT_TRAY_H - 10) / 2;
    const u = age / 30;
    if (m.ok) {
      ctx.globalAlpha = 1 - u * 0.6;
      toyMarble(ctx, x + Math.sin(age * 0.9) * 4 * (1 - u), cupY, BALL_R * 0.6, BT_PALETTE[m.colour]!, 0, m.colour);
    } else if ((trays[m.cell] ?? -1) >= 0) {
      ctx.globalAlpha = 1 - u;
      toyMarble(ctx, x + u * 18, cupY - Math.sin(u * Math.PI) * 34, BALL_R * 0.6, "#8A8F98", 0, 1);
    }
    ctx.globalAlpha = 1;
  }

  // Lost balls fade where they fell.
  for (const m of s.falls) {
    const age = s.tick - m.tick;
    if (age >= 40) continue;
    const p = pointOf(m.cell);
    ctx.globalAlpha = 1 - age / 40;
    ctx.strokeStyle = BT_PALETTE[m.colour]!;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, BALL_R + age / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const hy = BT_HOPPER_H / 2;
  const countdown = btEventCountdown(course, s.tick);
  if (countdown !== null) {
    ctx.save();
    ctx.fillStyle = TOY_INK;
    ctx.font = '24px "JetBrains Mono", monospace';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(countdown), BT_W - 12, hy);
    ctx.restore();
  }
  const leadX = BT_HOPPER_COL * BT_TILE + BT_TILE / 2;
  const queueGap = BALL_R;
  const leadOutline = BALL_R + 6 + 1.5;
  const queuedRadius = Math.min(BALL_R, (leadX - 4 - leadOutline - 5 * queueGap) / 10);
  for (let i = s.next; i < Math.min(BT_BALLS, s.next + 6); i++) {
    const offset = i - s.next;
    const x = offset === 0 ? leadX : leadX - leadOutline - queueGap - queuedRadius - (offset - 1) * (queuedRadius * 2 + queueGap);
    const colour = course.balls[i]!;
    ctx.globalAlpha = i === s.next ? 1 : 0.7;
    toyMarble(ctx, x, hy, offset === 0 ? BALL_R : queuedRadius, BT_PALETTE[colour]!, 0, colour);
    ctx.globalAlpha = 1;
    if (i === s.next) {
      ctx.strokeStyle = TOY_BRASS;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, hy, BALL_R + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (const b of s.balls) {
    const p = ballPoint(s, b, rot);
    toyMarble(ctx, p.x, p.y, BALL_R, BT_PALETTE[b.colour]!, 0, b.colour);
  }
  const lastHome=[...s.landings].reverse().find(m=>m.ok);
  successFrame(ctx,{id:'balltrack',tick:s.tick,count:s.home,eventTick:lastHome?.tick,misses:s.wrong+s.lost,colour:TOY_BRASS,width:BT_W,height:BT_H,point:{x:(lastHome?.cell??0)*BT_TILE+BT_TILE/2,y:trayY+BT_TRAY_H/2,shape:'ring',radius:20}});
  void TOY_WOOD_DARK;
}
