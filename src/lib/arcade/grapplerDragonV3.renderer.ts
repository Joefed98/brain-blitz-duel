import { artCanvas, artContext, type ArtCanvas } from './cache.renderer';

/**
 * swingRev 3 dragon art: a menacing crimson dragon, bigger than swingRev 2's
 * mint dragon. Eight lazy raster frames; the fixed 64×44 envelope never bobs
 * — only the art inside it does. Original design.
 */
const frames: ArtCanvas[] = [];

export function drawGrapplerDragonV3(c: CanvasRenderingContext2D, x: number, y: number, phase: number): void {
  const frame = Math.floor(phase) % 8;
  let sprite = frames[frame];
  if (!sprite) {
    const surface = artCanvas(128, 88);
    const g = surface ? artContext(surface) : null;
    if (!surface || !g) return;
    g.scale(2, 2);
    const bob = Math.sin((frame * Math.PI) / 4) * 1.2;
    const flap = (frame % 4) * 0.8;
    const cx = 32;
    const cy = 22 + bob;

    // Bat wings: dark crimson membrane, darker outline, behind the body.
    g.fillStyle = '#4A0808';
    g.strokeStyle = '#120202';
    g.lineWidth = 1.2;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx, cy - 4);
      g.lineTo(cx + side * 30, cy - 20 - flap);
      g.lineTo(cx + side * 24, cy - 6);
      g.lineTo(cx + side * 18, cy - 12 + flap);
      g.lineTo(cx + side * 13, cy);
      g.lineTo(cx + side * 6, cy + 6);
      g.closePath();
      g.fill();
      g.stroke();
    }

    // Spiked back ridge.
    g.fillStyle = '#2A0404';
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(cx - 2 + i * 6, cy - 9);
      g.lineTo(cx + i * 6, cy - 18 - (i === 0 ? 2 : 0));
      g.lineTo(cx + 2 + i * 6, cy - 9);
      g.closePath();
      g.fill();
    }

    // Body: deep crimson with darker scale shading, dark outline.
    g.fillStyle = '#7A0E12';
    g.strokeStyle = '#1A0203';
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(cx, cy + 3, 15, 12, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#5A0A0D';
    g.beginPath();
    g.ellipse(cx - 4, cy + 7, 8, 5, 0.3, 0, Math.PI * 2);
    g.fill();

    // Head.
    g.fillStyle = '#8A1216';
    g.beginPath();
    g.ellipse(cx + 5, cy - 3, 9, 8, -0.1, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // Horns.
    g.fillStyle = '#E8D8B0';
    g.beginPath();
    g.moveTo(cx, cy - 10);
    g.lineTo(cx - 2, cy - 19);
    g.lineTo(cx + 3, cy - 10);
    g.moveTo(cx + 9, cy - 9);
    g.lineTo(cx + 13, cy - 17);
    g.lineTo(cx + 10, cy - 8);
    g.fill();

    // Glowing yellow eyes.
    g.fillStyle = '#FFE24A';
    g.beginPath();
    g.ellipse(cx + 7, cy - 4, 2.2, 1.6, 0.2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1A0203';
    g.lineWidth = 0.6;
    g.stroke();

    // Fangs.
    g.fillStyle = '#F5EEDD';
    g.beginPath();
    g.moveTo(cx + 8, cy + 1);
    g.lineTo(cx + 9, cy + 5);
    g.lineTo(cx + 10, cy + 1);
    g.fill();

    // Tail.
    g.strokeStyle = '#7A0E12';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx - 14, cy + 6);
    g.lineTo(cx - 24, cy + 10 + bob * 0.4);
    g.stroke();

    // Faint ember rim light on the top/back edge for contrast against lava.
    g.strokeStyle = 'rgba(255,140,60,0.55)';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(cx, cy + 3, 15, 12, 0, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();

    frames[frame] = surface;
    sprite = surface;
  }
  c.drawImage(sprite, x - 32, y - 22, 64, 44);
}
