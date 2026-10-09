import { whackGame, WHACK_COLS, WHACK_HOLES, WHACK_GAP_PX, WHACK_STATUS_WRONG, WHACK_STATUS_RETIRED, WHACK_STATUS_UP, WHACK_STATUS_HIT, type WhackState } from './whack';
import type { CanvasSize } from './engine';
import { artCanvas, artContext, type ArtCanvas } from './cache.renderer';
import { BONK_BODY, BONK_HAT, BONK_SPIKES } from './bonkShapes.renderer';
const PALETTE = { gold: '#F5B82E', red: '#E0503C', fur: '#8A7365', muzzle: '#F0D7AC', ink: '#241C22', spines: '#B7A18C', shine: '#FFF4CF', hole: '#131114', rim: '#58493E', ground: '#28251F', groundLight: '#343127' };
const sprites = new Map<number, ArtCanvas>();
let backdrop: { width: number; height: number; canvas: ArtCanvas } | null = null;
function ground(width: number, height: number): ArtCanvas | null {
 if(backdrop?.width===width && backdrop.height===height)return backdrop.canvas;
 const canvas=artCanvas(Math.ceil(width),Math.ceil(height)),c=canvas?artContext(canvas):null;
 if(!canvas||!c)return null;
 const g=c.createLinearGradient(0,0,width,height);g.addColorStop(0,PALETTE.groundLight);g.addColorStop(1,PALETTE.ground);c.fillStyle=g;c.fillRect(0,0,width,height);
 c.fillStyle=PALETTE.rim;c.globalAlpha=.3;
 for(let y=5;y<height;y+=13)for(let x=4;x<width;x+=17)c.fillRect(x+(y%7),y,2,1);
 backdrop={width,height,canvas};return canvas;
}
function target(kind: number): ArtCanvas | null {
 const cached=sprites.get(kind);if(cached)return cached;
 const canvas=artCanvas(200,200),c=canvas?artContext(canvas):null;if(!canvas||!c)return null;
 c.scale(2,2);
 // Every silhouette is clipped inside the original circular target footprint.
 c.beginPath();c.arc(50,50,49,0,Math.PI*2);c.clip();
 if(kind===2){c.fillStyle=PALETTE.spines;c.fill(new Path2D(BONK_SPIKES));c.fillStyle=PALETTE.fur;c.beginPath();c.arc(50,54,32,0,Math.PI*2);c.fill();c.fillStyle=PALETTE.muzzle;c.beginPath();c.ellipse(49,64,19,13,0,0,Math.PI*2);c.fill();c.fillStyle=PALETTE.ink;for(const x of [43,57]){c.beginPath();c.arc(x,57,3,0,Math.PI*2);c.fill();}c.beginPath();c.arc(50,66,4,0,Math.PI*2);c.fill();}
 else {c.fillStyle=PALETTE.fur;c.fill(new Path2D(BONK_BODY));c.fillStyle=PALETTE.muzzle;c.beginPath();c.ellipse(51,75,22,17,0,0,Math.PI*2);c.fill();c.strokeStyle=PALETTE.ink;c.lineWidth=4;c.lineCap='round';c.beginPath();c.moveTo(35,58);c.lineTo(43,58);c.moveTo(61,58);c.lineTo(69,58);c.stroke();c.fillStyle=PALETTE.ink;c.beginPath();c.arc(51,68,5,0,Math.PI*2);c.fill();c.lineWidth=3;c.beginPath();c.moveTo(43,79);c.quadraticCurveTo(51,88,59,79);c.stroke();c.fillStyle=kind===0?PALETTE.gold:PALETTE.red;c.fill(new Path2D(BONK_HAT));c.strokeStyle=PALETTE.shine;c.lineWidth=3;c.beginPath();c.moveTo(25,38);c.quadraticCurveTo(26,19,43,15);c.stroke();}
 sprites.set(kind,canvas);return canvas;
}
function drawTarget(c:CanvasRenderingContext2D,x:number,y:number,r:number,kind:number):void{const sprite=target(kind);if(sprite)c.drawImage(sprite,x-r,y-r,r*2,r*2);}
/** Draws the 4×4 board filling the canvas; the overlay grid shares the geometry. */
export function drawBonk(ctx: CanvasRenderingContext2D, state: WhackState, size: CanvasSize): void {
  const gap = WHACK_GAP_PX;
  const cellW = (size.width - gap * (WHACK_COLS - 1)) / WHACK_COLS;
  const cellH = (size.height - gap * (WHACK_COLS - 1)) / WHACK_COLS;
  const cell = Math.min(cellW, cellH);
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  const bg = ground(size.width, size.height);
  if (bg) ctx.drawImage(bg, 0, 0, size.width, size.height);
  const origin = (h: number) => ({
    x: (h % WHACK_COLS) * (cellW + gap),
    y: Math.floor(h / WHACK_COLS) * (cellH + gap),
  });

  const flashWrong = new Set<number>();
  for (let i = 0; i < state.status.length; i++) {
    if (state.status[i] === WHACK_STATUS_WRONG && state.tick - state.doneTick[i]! < 12) {
      flashWrong.add(state.schedule.hole[i]!);
    }
  }

  for (let h = 0; h < PALETTE.holeS; h++) {
    const { x, y } = origin(h);
    ctx.fillStyle = flashWrong.has(h) ? "rgba(224,80,60,0.45)" : PALETTE.hole;
    ctx.beginPath();
    ctx.ellipse(x + cellW/2, y + cellH/2, cellW*.47, cellH*.45, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle=PALETTE.rim;ctx.lineWidth=1.5;ctx.stroke();
  }

  const { kind, hole, at: spawn } = state.schedule;
  const tick = state.tick;
  const r = cell * 0.3;
  for (let i = 0; i < state.next; i++) {
    if (spawn[i]! > tick) continue;
    if (state.status[i] === WHACK_STATUS_RETIRED && tick - state.doneTick[i]! >= 10) continue;
    const { x, y } = origin(hole[i]!);
    const cx = x + cellW / 2;
    const cy = y + cellH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, cellW, cellH, Math.min(14, cell * 0.18));
    ctx.clip();
    if (state.status[i] === WHACK_STATUS_UP) {
      const grow = Math.min(1, (tick - spawn[i]! + 1) / 7);
      drawTarget(ctx, cx, cy + (1 - grow) * cellH * 0.35, r * (0.4 + 0.6 * grow), kind[i]!);
    } else if (state.status[i] === WHACK_STATUS_RETIRED) {
      const fall = (tick - state.doneTick[i]!) / 10;
      ctx.globalAlpha = 1 - fall;
      drawTarget(ctx, cx, cy + fall * cellH * 0.5, r * (1 - 0.3 * fall), kind[i]!);
    } else if (state.status[i] === WHACK_STATUS_HIT) {
      const age = tick - state.doneTick[i]!;
      if (age < 10) {
        ctx.globalAlpha = 1 - age / 10;
        ctx.strokeStyle = PALETTE.gold;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1 + age * 0.08), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

export const whackArtGame = { ...whackGame, draw: drawBonk };
