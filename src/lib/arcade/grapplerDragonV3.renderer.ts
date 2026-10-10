import { artCanvas, artContext, type ArtCanvas } from './cache.renderer';

/**
 * swingRev 3 dragon art: a classic storybook dragon — long neck, horned head with
 * snout and open jaws, leathery bat wings on visible bones, a scaled body and a
 * spiked tail. Crimson body, glowing eyes, dark outline and ember rim light.
 * Eight lazy raster frames; the fixed 64×44 envelope never moves — only the
 * wing flap and a small bob inside it do. Original design.
 */
const frames: ArtCanvas[] = [];

const OUTLINE = '#140203';
const BODY = '#7E0F14';
const BODY_DARK = '#4F080B';
const BELLY = '#B3452A';
const MEMBRANE = '#5A0A0E';
const MEMBRANE_LIGHT = '#7A1A16';
const BONE = '#2A0405';
const HORN = '#E6D3A6';
const EYE = '#FFD93A';
const EMBER = 'rgba(255,140,60,0.6)';

export function drawGrapplerDragonV3(c: CanvasRenderingContext2D, x: number, y: number, phase: number): void {
  const frame = Math.floor(phase) % 8;
  let sprite = frames[frame];
  if (!sprite) {
    const surface = artCanvas(128, 88);
    const g = surface ? artContext(surface) : null;
    if (!surface || !g) return;
    g.scale(2, 2);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const bob = Math.sin((frame * Math.PI) / 4) * 1.1;
    // Wing beat: tips swing between high (0) and low (1) across the cycle.
    const beat = (1 - Math.cos((frame * Math.PI) / 4)) / 2;

    // ---- Far wing (behind body), darker, a little smaller.
    drawWing(g, 27, 21 + bob, 0.82, beat, true);

    // ---- Tail: tapering curve to the left edge with a spade tip.
    g.strokeStyle = OUTLINE;
    g.lineWidth = 5.4;
    g.beginPath();
    g.moveTo(22, 27 + bob);
    g.quadraticCurveTo(12, 34 + bob * 0.6, 4.5, 30 + bob * 0.3);
    g.stroke();
    g.strokeStyle = BODY;
    g.lineWidth = 3.6;
    g.stroke();
    g.fillStyle = BODY_DARK;
    g.strokeStyle = OUTLINE;
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(5.5, 30 + bob * 0.3);
    g.lineTo(1, 26 + bob * 0.3);
    g.lineTo(2.2, 31.5 + bob * 0.3);
    g.lineTo(1.2, 35 + bob * 0.3);
    g.closePath();
    g.fill();
    g.stroke();
    // Tail spikes.
    g.fillStyle = BONE;
    for (const [tx, ty] of [[17, 30.2], [12, 31.4], [8, 30.6]] as const) {
      g.beginPath();
      g.moveTo(tx - 1.4, ty + bob * 0.5);
      g.lineTo(tx, ty - 3 + bob * 0.5);
      g.lineTo(tx + 1.4, ty + bob * 0.5);
      g.closePath();
      g.fill();
    }

    // ---- Hind leg and fore leg with claws.
    g.fillStyle = BODY_DARK;
    g.strokeStyle = OUTLINE;
    g.lineWidth = 0.9;
    limb(g, 25, 30 + bob, 23, 38 + bob * 0.4, 26, 41.5);
    limb(g, 36, 30 + bob, 37, 37 + bob * 0.4, 40, 40.5);

    // ---- Body: long scaled torso, belly plates underneath.
    g.fillStyle = BODY;
    g.strokeStyle = OUTLINE;
    g.lineWidth = 1.3;
    g.beginPath();
    g.ellipse(30, 27 + bob, 11.5, 6.6, -0.08, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = BELLY;
    g.beginPath();
    g.ellipse(30.5, 30.2 + bob, 8.5, 2.6, -0.06, 0, Math.PI);
    g.fill();
    g.strokeStyle = 'rgba(20,2,3,0.55)';
    g.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      const bx = 24.5 + i * 3;
      g.beginPath();
      g.moveTo(bx, 30.4 + bob);
      g.lineTo(bx + 0.4, 32.4 + bob);
      g.stroke();
    }
    // Scales: small dark arcs over the back.
    g.strokeStyle = BODY_DARK;
    g.lineWidth = 0.6;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 5; i++) {
        const sx = 22.5 + i * 3.6 + row * 1.8;
        const sy = 24 + row * 2.6 + bob;
        g.beginPath();
        g.arc(sx, sy, 1.3, 0.1 * Math.PI, 0.9 * Math.PI);
        g.stroke();
      }
    }

    // ---- Neck: long S-curve rising to the head at the right.
    g.strokeStyle = OUTLINE;
    g.lineWidth = 6.8;
    g.beginPath();
    g.moveTo(38, 25 + bob);
    g.bezierCurveTo(44, 22 + bob, 43, 13 + bob, 49, 10 + bob);
    g.stroke();
    g.strokeStyle = BODY;
    g.lineWidth = 5;
    g.stroke();
    // Neck belly stripe.
    g.strokeStyle = BELLY;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(39.5, 27 + bob);
    g.bezierCurveTo(45.5, 24 + bob, 45, 15 + bob, 50, 12.6 + bob);
    g.stroke();

    // ---- Back ridge spikes along body and neck.
    g.fillStyle = BONE;
    const ridge: [number, number][] = [[21, 21.6], [25, 20.6], [29, 20.2], [33, 20.6], [37.5, 21.5], [41.4, 18], [43, 13.6], [46, 9.6]];
    for (const [rx, ry] of ridge) {
      g.beginPath();
      g.moveTo(rx - 1.5, ry + 1.4 + bob);
      g.lineTo(rx - 0.4, ry - 2.6 + bob);
      g.lineTo(rx + 1.4, ry + 1.2 + bob);
      g.closePath();
      g.fill();
    }

    // ---- Head: wedge skull, long snout, open jaws with fangs.
    const hy = 9 + bob;
    g.fillStyle = BODY;
    g.strokeStyle = OUTLINE;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(46.5, hy - 3);
    g.lineTo(53, hy - 4.6);
    g.lineTo(61, hy - 1.6); // snout tip (upper jaw)
    g.lineTo(62.4, hy + 0.6);
    g.lineTo(55, hy + 1.2);
    g.lineTo(48, hy + 4);
    g.closePath();
    g.fill();
    g.stroke();
    // Lower jaw, dropped open.
    g.fillStyle = BODY_DARK;
    g.beginPath();
    g.moveTo(49, hy + 3.6);
    g.lineTo(55, hy + 2.4);
    g.lineTo(60.6, hy + 4.4);
    g.lineTo(55, hy + 5.6);
    g.lineTo(49.5, hy + 5.4);
    g.closePath();
    g.fill();
    g.stroke();
    // Mouth interior.
    g.fillStyle = '#2B0204';
    g.beginPath();
    g.moveTo(53, hy + 1.6);
    g.lineTo(61, hy + 1.1);
    g.lineTo(60, hy + 3.9);
    g.lineTo(54, hy + 2.6);
    g.closePath();
    g.fill();
    // Fangs.
    g.fillStyle = '#F4ECD8';
    for (const fx of [56, 58.6]) {
      g.beginPath();
      g.moveTo(fx - 0.6, hy + 1.2);
      g.lineTo(fx, hy + 3);
      g.lineTo(fx + 0.6, hy + 1.1);
      g.closePath();
      g.fill();
    }
    g.beginPath();
    g.moveTo(57, hy + 4.4);
    g.lineTo(57.5, hy + 2.8);
    g.lineTo(58.1, hy + 4.5);
    g.closePath();
    g.fill();
    // Nostril and brow ridge.
    g.fillStyle = OUTLINE;
    g.fillRect(59.6, hy - 1.4, 1, 0.8);
    g.strokeStyle = OUTLINE;
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(50, hy - 2.6);
    g.lineTo(54.6, hy - 2.2);
    g.stroke();
    // Swept-back horns.
    g.fillStyle = HORN;
    g.strokeStyle = OUTLINE;
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(48.4, hy - 3.2);
    g.quadraticCurveTo(44, hy - 6, 41.6, hy - 8.4);
    g.quadraticCurveTo(46, hy - 6.4, 50.6, hy - 4.2);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(50.8, hy - 4);
    g.quadraticCurveTo(48.6, hy - 7.4, 47.6, hy - 8.4);
    g.quadraticCurveTo(50.6, hy - 7, 52.8, hy - 4.4);
    g.closePath();
    g.fill();
    g.stroke();
    // Glowing eye: soft halo then slit pupil.
    g.fillStyle = 'rgba(255,217,58,0.35)';
    g.beginPath();
    g.ellipse(53, hy - 1.2, 2.4, 1.6, -0.15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = EYE;
    g.beginPath();
    g.ellipse(53, hy - 1.2, 1.5, 0.9, -0.15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = OUTLINE;
    g.fillRect(52.8, hy - 2, 0.5, 1.6);

    // ---- Near wing (in front of the far wing, over the shoulder).
    drawWing(g, 31, 22 + bob, 1, beat, false);

    // ---- Ember rim light along back, neck top and near wing arm.
    g.strokeStyle = EMBER;
    g.lineWidth = 0.9;
    g.beginPath();
    g.ellipse(30, 27 + bob, 11.5, 6.6, -0.08, Math.PI * 1.1, Math.PI * 1.75);
    g.stroke();
    g.beginPath();
    g.moveTo(39, 22.6 + bob);
    g.bezierCurveTo(42.6, 20 + bob, 42, 12 + bob, 47.4, 7.4 + bob);
    g.stroke();

    frames[frame] = surface;
    sprite = surface;
  }
  c.drawImage(sprite, x - 32, y - 22, 64, 44);
}

/** Bat wing: arm + three finger bones radiating from the wrist, membrane scalloped between. */
function drawWing(g: CanvasRenderingContext2D, sx: number, sy: number, scale: number, beat: number, far: boolean): void {
  const lift = (1 - beat) * 7 * scale;
  const wx = sx - 4 * scale;
  const wy = sy - 9 * scale - lift * 0.6;
  // Finger tips spread left/up; the whole fan rises with the beat.
  const tips: [number, number][] = [
    [sx - 6 * scale, Math.max(0.8, sy - 20 * scale - lift)],
    [sx - 14 * scale, Math.max(0.8, sy - 17 * scale - lift * 0.8)],
    [sx - 19 * scale, sy - 10 * scale - lift * 0.5],
  ];
  const root: [number, number] = [sx - 9 * scale, sy + 2];
  g.fillStyle = far ? MEMBRANE : MEMBRANE_LIGHT;
  g.strokeStyle = OUTLINE;
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(sx, sy);
  g.lineTo(wx, wy);
  g.lineTo(tips[0]![0], tips[0]![1]);
  for (let i = 1; i < tips.length; i++) {
    const a = tips[i - 1]!, b = tips[i]!;
    // Scalloped trailing edge sags toward the wrist between bones.
    const mx = (a[0] + b[0]) / 2 + (wx - (a[0] + b[0]) / 2) * 0.28;
    const my = (a[1] + b[1]) / 2 + (wy - (a[1] + b[1]) / 2) * 0.28;
    g.quadraticCurveTo(mx, my, b[0], b[1]);
  }
  const last = tips[tips.length - 1]!;
  g.quadraticCurveTo((last[0] + root[0]) / 2 + 2 * scale, (last[1] + root[1]) / 2 - 1, root[0], root[1]);
  g.closePath();
  g.fill();
  g.stroke();
  // Bones: arm then fingers from the wrist.
  g.strokeStyle = BONE;
  g.lineWidth = 1.3 * scale;
  g.beginPath();
  g.moveTo(sx, sy);
  g.lineTo(wx, wy);
  g.stroke();
  g.lineWidth = 0.8 * scale;
  for (const [tx, ty] of tips) {
    g.beginPath();
    g.moveTo(wx, wy);
    g.lineTo(tx, ty);
    g.stroke();
  }
  // Wrist claw.
  g.fillStyle = HORN;
  g.beginPath();
  g.moveTo(wx, wy);
  g.lineTo(wx + 1.6 * scale, wy - 2 * scale);
  g.lineTo(wx + 1.2 * scale, wy + 0.4);
  g.closePath();
  g.fill();
}

function limb(g: CanvasRenderingContext2D, hx: number, hy: number, kx: number, ky: number, fx: number, fy: number): void {
  g.lineWidth = 3;
  g.strokeStyle = OUTLINE;
  g.beginPath();
  g.moveTo(hx, hy);
  g.lineTo(kx, ky);
  g.lineTo(fx, fy);
  g.stroke();
  g.lineWidth = 1.8;
  g.strokeStyle = BODY_DARK;
  g.stroke();
  g.fillStyle = HORN;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(fx - 0.6 + i * 1.2, fy);
    g.lineTo(fx + i * 1.2, fy + 1.6);
    g.lineTo(fx + 0.6 + i * 1.2, fy);
    g.closePath();
    g.fill();
  }
}
