import { successFrame, SUCCESS_ACCENTS } from "./success.renderer";
/**
 * Ball Track in the Toybox world: a wooden marble run. Render only; mirrors
 * btDraw's private geometry (tile centres, tube path, ball radius 22.5) and
 * reads state without writing it.
 */
import {
  BT_BALLS, BT_COLS, BT_CORNER, BT_H, BT_HOPPER_COL, BT_HOPPER_H, BT_KIND, BT_PALETTE,
  BT_ROWS, BT_SHUFFLE_TICKS, BT_TILE, BT_TRAY_H, BT_W, E, N, S, W,
  btBallPoint, btEventCountdown, btRotatable, btTraysAt, type BtCourse, type BtState,
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

function symbol(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, r: number) {
  ctx.beginPath();
  const s = BT_SYMBOLS[kind % BT_SYMBOLS.length];
  if (s === "circle") ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (s === "square") ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else if (s === "triangle") { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath(); }
  else { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
}

export function btArtDraw(ctx: CanvasRenderingContext2D, course: BtCourse, s: BtState, rotatable?: Set<number>) {
  const gridY = BT_HOPPER_H;
  const rot = rotatable ?? new Set(btRotatable(course));
  toyTabletop(ctx);
  toyBoard(ctx, 0, 0, BT_W, BT_H, 14);
  // Hopper shelf and tray shelf in darker wood.
  ctx.fillStyle = "rgba(60,35,15,0.25)";
  ctx.fillRect(0, 0, BT_W, gridY);
  ctx.fillRect(0, gridY + BT_ROWS * BT_TILE, BT_W, BT_TRAY_H);

  const maskOf = (cell: number) => (cell >= (BT_ROWS - 1) * BT_COLS && (btTraysAt(course, s.tick)[cell % BT_COLS] ?? -1) >= 0 ? N | S : BT_KIND[cell] === 2 ? BT_CORNER[cell]! : s.vert[cell] ? N | S : E | W);
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
      for (let cell = 0; cell < BT_KIND.length; cell++) if (BT_KIND[cell] && rot.has(cell) === movable) tubePath(ctx, cell, maskOf(cell));
      ctx.stroke();
    }
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
    const p = btBallPoint(s, b);
    toyMarble(ctx, p.x, p.y, BALL_R, BT_PALETTE[b.colour]!, 0, b.colour);
  }
  const lastHome=[...s.landings].reverse().find(m=>m.ok);
  successFrame(ctx,{id:'balltrack',tick:s.tick,count:s.home,eventTick:lastHome?.tick,misses:s.wrong+s.lost,colour:TOY_BRASS,width:BT_W,height:BT_H,point:{x:(lastHome?.cell??0)*BT_TILE+BT_TILE/2,y:trayY+BT_TRAY_H/2,shape:'ring',radius:20}});
  void TOY_WOOD_DARK;
}
