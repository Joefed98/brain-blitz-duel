import { artCanvas, artContext, type ArtCanvas } from './cache.renderer';
const frames: ArtCanvas[] = [];
/** Eight lazy raster frames; the fixed 40×28 envelope never bobs. */
export function drawGrapplerDragon(c: CanvasRenderingContext2D, x: number, y: number, phase: number): void {
  const frame = Math.floor(phase) % 8;
  let sprite = frames[frame];
  if (!sprite) {
    const surface = artCanvas(80, 56);
    const g = surface ? artContext(surface) : null;
    if (!surface || !g) return;
    g.scale(2, 2);
    const bob = Math.sin(frame * Math.PI / 4) * .8;
    // Wingtips/tail/horns keep the enclosing silhouette within 1px of every edge.
    g.fillStyle = '#39D6C2'; g.strokeStyle = '#D9FFF0'; g.lineWidth = .8;
    for (const side of [-1, 1]) {
      g.beginPath(); g.moveTo(20, 16 + bob);
      g.lineTo(20 + side * 19, 1 + (frame % 4) * .4);
      g.lineTo(20 + side * 16, 13); g.lineTo(20 + side * 10, 10 + (frame % 4));
      g.lineTo(20 + side * 8, 20); g.closePath(); g.fill(); g.stroke();
    }
    g.fillStyle = '#137D85'; g.beginPath(); g.ellipse(20, 19 + bob, 8, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#69EACA'; g.beginPath(); g.ellipse(22, 13 + bob, 7, 6, -.15, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#C8FFDD'; g.beginPath(); g.moveTo(17, 9 + bob); g.lineTo(17, 4); g.lineTo(20, 8 + bob); g.moveTo(25, 8 + bob); g.lineTo(28, 4); g.lineTo(27, 11 + bob); g.fill();
    g.fillStyle = '#E9FFF6'; g.fillRect(20, 11 + bob, 2, 2); g.fillRect(25, 11 + bob, 2, 2);
    g.fillStyle = '#092B39'; g.fillRect(21, 11 + bob, 1, 2); g.fillRect(26, 11 + bob, 1, 2);
    g.strokeStyle = '#092B39'; g.beginPath(); g.moveTo(22, 16 + bob); g.lineTo(26, 16 + bob); g.stroke();
    g.fillStyle = '#C8FFDD'; g.fillRect(22, 16 + bob, 1, 2); g.fillRect(25, 16 + bob, 1, 2);
    g.fillStyle = '#69EACA'; g.fillRect(15, 25, 4, 2); g.fillRect(23, 25, 4, 2);
    frames[frame] = surface; sprite = surface;
  }
  c.drawImage(sprite, x - 20, y - 14, 40, 28);
}