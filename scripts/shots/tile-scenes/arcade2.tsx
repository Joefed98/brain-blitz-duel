/** Arcade games' tile scenes, second half (and the retired arcade games), painted with each game's own renderer (scene.tsx has the rules). */
import { BT_PALETTE } from "@/lib/arcade/ballTrack";
import { brassPin, btMarble, strokeChannels, symbol } from "@/lib/arcade/ballTrackArt.renderer";
import { BEAT_LANE_COLOURS } from "@/lib/arcade/beat";
import { paintNote } from "@/lib/arcade/beat.renderer";
import { BINTOSS_FLOOR_Y } from "@/lib/arcade/binToss";
import { BINTOSS_BALL, drawBucket, drawRubberBall } from "@/lib/arcade/binTossArt.renderer";
import { BURST_COLOURS, BURST_RADIUS } from "@/lib/arcade/burst";
import { SHIP_ROWS, paintAtom, plainSprite } from "@/lib/arcade/burst.renderer";
import { drawHero, heroPose, type HeroPose } from "@/lib/arcade/hero.renderer";
import { glow } from "@/lib/arcade/polishA1.renderer";
import { REAL_GOLD } from "@/lib/arcade/realworld.renderer";
import { RETRO_WHITE, pixelRect, retroNeon } from "@/lib/arcade/retro.renderer";
import { STEEL_LIGHT, drawBlock } from "@/lib/arcade/skyline.renderer";
import { SLICE_SILVER } from "@/lib/arcade/slice";
import { paintFood, sprite as sliceSprite } from "@/lib/arcade/slice.renderer";
import { drawArtSprite } from "@/lib/arcade/sprites.renderer";
import { drawCoin } from "@/lib/arcade/swing.renderer";
import { TOY_INK, TOY_OAK } from "@/lib/arcade/toybox.renderer";

import { BAS_DIRS, drawBasShape, drawBasTurret } from "@/lib/arcade/bastion";
import { DUAL_GROUND, DUAL_RUNNER, DUAL_RUNNER_R, DUAL_SPIKE, DUAL_SPIKE_H, DUAL_SPIKE_LEAN, DUAL_SPIKE_W } from "@/lib/arcade/dual";
import { HOT_BG, HOT_GOLD, HOT_RED } from "@/lib/arcade/hotFloor";
import { JUNC_CX, JUNC_CY } from "@/lib/arcade/junction";
import { CAR_COLOURS, HALF as JUNC_HALF, LANE as JUNC_LANE, drawCar, drawLight, drawScene } from "@/lib/arcade/junction.renderer";
import { drawCoin as drawNinjaCoin, drawKatana, drawLantern, drawNinja, drawShuriken } from "@/lib/arcade/ricochetNinja.renderer";
import { ROOF_GOLD, ROOF_LANES, ROOF_LOW, ROOF_WALL, drawRoofObstacle, drawRoofRunner, project as roofProject } from "@/lib/arcade/rooftop";
import { STD_DOT, STD_DOT_R, STD_GOLD } from "@/lib/arcade/steady";
import { SWERVE_LANE_X, swerveGame, type SwerveState } from "@/lib/arcade/swerve";

import { at, canvasScene, noText, type SceneSet } from "./scene";

type Ctx = CanvasRenderingContext2D;

/** A slice food's cached stamp (the game's own sprite, shading included), drawn as a disc of radius r at (x, y). */
function food(c: Ctx, k: number, kind: "bagel" | "cabbage" | "onion" | "meat", x: number, y: number, r: number, cut = false): void {
  const stamp = sliceSprite(cut ? `${kind}-face` : kind, r * 2 * k, paintFood(kind, cut));
  if (stamp) c.drawImage(stamp as CanvasImageSource, x - r, y - r, r * 2, r * 2);
}

/** A fresh hero pose for one scene paint, its details judged at the scene's real px per pose unit. */
function sceneHero(scale: number, k: number): HeroPose {
  return Object.assign(heroPose(), { headR: 3.4, stick: 2.4, scale: 1, detailScale: scale * k });
}

export const ARCADE2_SCENES: SceneSet = {
  // Slice: the blade's silver swipe through a cabbage (its two halves parting on the cut face), a bagel and a steak waiting.
  slice: canvasScene((c, k) => {
    food(c, k, "bagel", 26, 27, 19);
    food(c, k, "meat", 80, 80, 18);
    // The cut cabbage: each half clipped on the blade's line, the cut face showing along the chord (as the game draws halves).
    const angle = -0.62;
    const cx = 54;
    const cy = 56;
    const r = 20;
    const whole = sliceSprite("cabbage", r * 2 * k, paintFood("cabbage"));
    const face = sliceSprite("cabbage-face", r * 2 * k, paintFood("cabbage", true));
    for (const side of [-1, 1]) {
      const spread = 6;
      c.save();
      c.translate(cx - Math.sin(angle) * spread * side, cy + Math.cos(angle) * spread * side);
      c.rotate(angle);
      c.beginPath();
      c.rect(-r, side < 0 ? -r : 0, r * 2, r);
      c.clip();
      c.rotate(-angle);
      if (whole) c.drawImage(whole as CanvasImageSource, -r, -r, 2 * r, 2 * r);
      c.rotate(angle);
      c.beginPath();
      c.rect(-r, -5, r * 2, 10);
      c.clip();
      c.rotate(-angle);
      if (face) c.drawImage(face as CanvasImageSource, -r, -r, 2 * r, 2 * r);
      c.restore();
    }
    // The blade: the game's silver swipe with its white core.
    c.lineCap = "round";
    const [x1, y1, x2, y2] = [8, 56 + 46 * Math.tan(-angle), 100, 56 - 46 * Math.tan(-angle)];
    c.strokeStyle = SLICE_SILVER;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    c.strokeStyle = "#FFF9EB";
    c.lineWidth = 1;
    c.stroke();
  }),

  // Fission: the pixel ship firing its green beam up into a big atom, two smaller atoms drifting by.
  burst: canvasScene((c) => {
    const s = 104 / 120;
    at(c, 0, 0, s, () => {
      const atom = (size: number, x: number, y: number) => {
        const r = BURST_RADIUS[size]!;
        const colour = retroNeon(BURST_COLOURS[size]!);
        glow(c, colour, x, y, r + 3, r + 3, 0.42);
        c.save();
        c.translate(x - r, y - r);
        paintAtom(c, r, colour, size);
        c.restore();
      };
      const floor = 118;
      pixelRect(c, 0, floor - 2, 120, 2, "#3DFFE030");
      // The beam: a soft halo and its hard 2 px core, from the ship's nose up to the atom.
      const shipX = 42;
      const top = 30 + BURST_RADIUS[1]! - 2;
      glow(c, "#4BFF7A", shipX, (top + floor - 36) / 2, 6, (floor - 36 - top) / 2 + 4, 0.6);
      pixelRect(c, shipX - 1, top, 2, floor - 36 - top, "#4BFF7A");
      atom(1, shipX, 30);
      atom(2, 96, 42);
      atom(3, 92, 88);
      plainSprite(c, SHIP_ROWS, shipX - 12, floor - 36, 2, "#FFD84A");
      pixelRect(c, shipX - 2, floor - 28, 4, 2, "#000000");
    });
  }),

  // High Rise: a stack of lit glass floors and the next floor hanging from the crane's hook on its slings.
  skyline: canvasScene((c) => {
    const s = 0.5;
    at(c, 0, 0, s, () => {
      const H = 36;
      const base = 200;
      c.fillStyle = "#424F60";
      c.fillRect(0, base, 208, 12);
      const floors: Array<[number, number]> = [
        [26, 150],
        [36, 146],
      ];
      floors.forEach(([x, w], i) => drawBlock(c, x, base - (i + 1) * H, w, H, i, 100));
      // The hanging floor, its cable, slings and gold hook (as the game draws them).
      const bx = 52;
      const bw = 146;
      const top = base - 3 * H - 26;
      const hookX = bx + bw / 2;
      c.strokeStyle = STEEL_LIGHT;
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(hookX, -10);
      c.lineTo(hookX, top - 14);
      c.moveTo(hookX, top - 14);
      c.lineTo(bx + 3, top);
      c.moveTo(hookX, top - 14);
      c.lineTo(bx + bw - 3, top);
      c.stroke();
      c.fillStyle = REAL_GOLD;
      c.fillRect(hookX - 5, top - 20, 10, 8);
      drawBlock(c, bx, top, bw, H, 2);
    });
  }),

  // Ball Tracker: a red marble rolling round a carved channel towards its red cup; a switch channel with its brass pin drops to the blue cup.
  balltrack: canvasScene((c) => {
    at(c, 0, 0, 0.5, () => {
      strokeChannels(
        c,
        (cc) => {
          cc.moveTo(-20, 52);
          cc.quadraticCurveTo(50, 52, 50, 122);
          cc.lineTo(50, 150);
        },
        false,
      );
      strokeChannels(
        c,
        (cc) => {
          cc.moveTo(152, -20);
          cc.lineTo(152, 150);
        },
        true,
      );
      brassPin(c, 152, 72);
      const trayY = 150;
      const h = 34;
      [0, 1].forEach((tray, col) => {
        const x = col * 102 + 6;
        const w = 88;
        c.fillStyle = TOY_OAK;
        c.fillRect(x, trayY, w, h);
        const hollow = c.createLinearGradient(0, trayY + 3, 0, trayY + h - 3);
        hollow.addColorStop(0, "rgba(40,22,8,0.62)");
        hollow.addColorStop(0.45, "rgba(62,39,22,0.34)");
        hollow.addColorStop(1, "rgba(62,39,22,0.18)");
        c.fillStyle = hollow;
        c.fillRect(x + 4, trayY + 3, w - 8, h - 6);
        c.globalAlpha = 0.25;
        c.fillStyle = BT_PALETTE[tray]!;
        c.fillRect(x, trayY, w, h);
        c.globalAlpha = 1;
        c.strokeStyle = BT_PALETTE[tray]!;
        c.globalAlpha = 0.3;
        c.lineWidth = 9;
        c.strokeRect(x, trayY, w, h);
        c.globalAlpha = 1;
        c.lineWidth = 4;
        c.strokeRect(x, trayY, w, h);
        c.lineWidth = 2.5;
        c.strokeStyle = TOY_INK;
        symbol(c, tray, x + w / 2, trayY + h / 2, 8);
        c.stroke();
      });
      btMarble(c, 40, 72, 22.5, BT_PALETTE[0], 2);
      btMarble(c, 152, 20, 22.5, BT_PALETTE[1], 5);
    });
  }),

  // Grappler: the Joulz hero swinging on its rope from an iron ring over the lava, a gold star ring ahead.
  swing: canvasScene((c, k) => {
    // Lava pool along the bottom (the game's gradient and lit surface).
    const lavaTop = 90;
    c.beginPath();
    c.moveTo(0, 104);
    for (let x = 0; x <= 104; x += 4) c.lineTo(x, lavaTop + Math.sin(x * 0.12) * 1.5);
    c.lineTo(104, 104);
    c.closePath();
    const lava = c.createLinearGradient(0, lavaTop, 0, 104);
    lava.addColorStop(0, "#FFB23A");
    lava.addColorStop(0.3, "#FF5A1F");
    lava.addColorStop(1, "#B3200F");
    c.fillStyle = lava;
    c.fill();
    // The star ring ahead.
    drawCoin(c, 86, 22, 11, 0, false);
    // The anchor ring and the rope down to the hero's hand.
    const ax = 26;
    const ay = 12;
    const s = 3.2;
    const fx = 58;
    const fy = 54;
    const hx = fx + 1.5 * s;
    const hy = fy - 6 * s;
    c.lineCap = "round";
    c.strokeStyle = "#6B4A2A";
    c.lineWidth = 3.2;
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(hx, hy);
    c.stroke();
    c.strokeStyle = "#D8B27A";
    c.lineWidth = 1.5;
    c.setLineDash([3, 4]);
    c.stroke();
    c.setLineDash([]);
    if (!drawArtSprite(c, "cavelava", "anchor", ax - 9, ay - 9, 18, 18)) {
      c.strokeStyle = "#C9A25A";
      c.lineWidth = 3.5;
      c.beginPath();
      c.arc(ax, ay, 8, 0, Math.PI * 2);
      c.stroke();
    }
    const hero = sceneHero(s, k);
    Object.assign(hero, {
      headX: 0,
      headY: -6.5,
      neckX: 0,
      neckY: -3,
      hipX: 0,
      hipY: 3,
      shoulderX: 0,
      shoulderY: -2,
      handAX: 1.5,
      handAY: -6,
      handBX: -3,
      handBY: 1,
      footAX: -3,
      footAY: 8,
      footBX: 3,
      footBY: 7.5,
      moveX: 0.6,
      moveY: -0.8,
      speed: 0.5,
      face: 0.6,
    });
    at(c, fx, fy, s, () => drawHero(c, hero));
  }),

  // Tempo: neon notes falling down their lanes to the white hit line, one landing on it in a PERFECT burst.
  beat: canvasScene((c) => {
    const laneW = 26;
    const hitY = 80;
    const neon = BEAT_LANE_COLOURS.map(retroNeon);
    neon.forEach((colour, lane) => {
      const x = lane * laneW;
      const tint = c.createLinearGradient(0, 0, 0, hitY);
      tint.addColorStop(0, `${colour}00`);
      tint.addColorStop(1, `${colour}30`);
      c.fillStyle = tint;
      c.fillRect(x, 0, laneW, hitY);
      c.fillStyle = `${colour}A0`;
      c.fillRect(x + 1, 0, 1, hitY + 16);
      c.fillRect(x + laneW - 2, 0, 1, hitY + 16);
    });
    pixelRect(c, 0, hitY - 1, 104, 2, RETRO_WHITE);
    neon.forEach((colour, lane) => {
      const cx = lane * laneW + laneW / 2;
      glow(c, colour, cx, hitY, 15, 5, 0.55);
      pixelRect(c, cx - 8, hitY - 2, 16, 4, colour);
      pixelRect(c, cx - 5, hitY - 1, 10, 2, RETRO_WHITE);
    });
    const note = (lane: number, y: number) =>
      at(c, lane * laneW + 4, y, 0.5, () => paintNote(c, neon[lane]!, 36));
    note(0, 14);
    note(1, 46);
    note(3, 28);
    // Lane 2's note on the line: its PERFECT burst (rays and a glow inside the lane).
    const cx = 2 * laneW + laneW / 2;
    glow(c, neon[2]!, cx, hitY, 18, 18, 0.8);
    note(2, hitY - 4);
    for (let i = 0; i < 10; i++) {
      const a = Math.PI + (i / 9) * Math.PI;
      const d = 14 * (0.7 + ((i * 7) % 5) / 10);
      pixelRect(c, cx + Math.cos(a) * d - 1.5, hitY + Math.sin(a) * d * 0.8 - 6, 3, 3, i % 3 === 0 ? RETRO_WHITE : neon[2]!);
    }
  }),

  // Swish: the red rubber ball dropping into the tin bucket at the end of its arc.
  bintoss: canvasScene((c) => {
    const floor = BINTOSS_FLOOR_Y / 256;
    at(c, 0, 0, 0.8, () => {
      c.translate(0, 132 - floor);
      drawBucket(c, 78, 40, 0, false);
      // The ball's fading trail along its arc, then the ball dropping in over the rim.
      const arc: Array<[number, number]> = [
        [6, 470],
        [18, 440],
        [32, 416],
        [47, 400],
        [62, 393],
      ];
      c.fillStyle = BINTOSS_BALL;
      arc.forEach(([x, y], i) => {
        c.globalAlpha = 0.45 * ((i + 1) / arc.length);
        c.beginPath();
        c.arc(x, y, 13 * (0.5 + (0.5 * (i + 1)) / arc.length), 0, Math.PI * 2);
        c.fill();
      });
      c.globalAlpha = 1;
      drawRubberBall(c, 80, 398, 14, 0.6);
    });
  }),
  // Ricochet (ricoRev 2): the Joulz hero in ninja gear mid-leap between two temple walls, a katana in the left wall, a shuriken
  // spinning across the gap, a coin on the arc and a gold lantern on the right wall (the game's own painters).
  ricochet: canvasScene((c) => {
    const stone = (x0: number, w: number) => {
      c.fillStyle = "#14151D";
      c.fillRect(x0, 0, w, 104);
      for (let r = 0; r < 8; r++)
        for (let bx = x0 - (r % 2 ? 9 : 0); bx < x0 + w; bx += 18) {
          c.fillStyle = (r * 3 + bx) % 5 === 0 ? "#363746" : "#2B2C38";
          const a = Math.max(x0, bx + 1);
          const b = Math.min(x0 + w, bx + 17);
          if (b > a) c.fillRect(a, r * 13 + 1, b - a, 11);
        }
    };
    stone(0, 22);
    stone(82, 22);
    c.save();
    c.translate(22 - 70 * 0.62, 0);
    c.scale(0.62, 0.62);
    drawKatana(c as CanvasRenderingContext2D, 0, 150, 0, 3);
    c.restore();
    drawShuriken(c as CanvasRenderingContext2D, 44, 30, 4);
    drawNinjaCoin(c as CanvasRenderingContext2D, 64, 50, 0);
    c.save();
    c.translate(82 - 9, 74);
    c.scale(0.8, 0.8);
    drawLantern(c as CanvasRenderingContext2D, 0, 0, 0);
    c.restore();
    c.save();
    c.translate(50, 54);
    c.scale(1.12, 1.12);
    drawNinja(c as CanvasRenderingContext2D, 0, 0, 1, 1, 6);
    c.restore();
  }),

  /* ---------------- Retired arcade games (practice only) ---------------- */

  // Swerve: the gold chevron in its lane, steering for the gap and the coin between the teal blocks (the game's own draw, three lanes in view).
  swerve: canvasScene((c) => {
    const row = (top: number, blocked: number[], coinLane: number) => ({ y0: top * 256, blocked, coinLane, coinCollected: false });
    const state = {
      rows: [row(372, [1, 3], 2)],
      distance: 0,
      x: SWERVE_LANE_X[2],
      crashed: false,
      coins: 0,
      totalCoins: 0,
      tick: 0,
      lastCoinRow: -1,
      lastCoinTick: 0,
    } as unknown as SwerveState;
    const s = 104 / 160;
    c.save();
    c.beginPath();
    c.rect(0, 0, 104, 104);
    c.clip();
    c.scale(s, s);
    c.translate(-115, -340);
    noText(c, () => swerveGame.draw(c, state, { width: 390, height: 560 }));
    c.restore();
  }),

  // Bastion: the gold turret's barrel swung to the right, two bolts flying up at a teal circle; a pink triangle and a blue square falling.
  bastion: canvasScene((c) => {
    const s = 104 / 90;
    at(c, 0, 0, s, () => {
      const dir = BAS_DIRS[40]!;
      const ux = dir[0] / 256;
      const uy = dir[1] / 256;
      drawBasShape(c, 0, 45 + ux * 70, 82 + uy * 70, false);
      drawBasShape(c, 2, 19, 20, false);
      drawBasShape(c, 1, 14, 52, false);
      c.fillStyle = "#F5B82E";
      for (const t of [40, 54]) {
        c.beginPath();
        c.arc(45 + ux * t, 82 + uy * t, 3, 0, Math.PI * 2);
        c.fill();
      }
      drawBasTurret(c, 45, 80, dir, 5, 88, 90);
    });
  }),

  // Dual: two runners side by side, one leaping its red spike, the other with a spike coming at it.
  dual: canvasScene((c) => {
    const s = 0.9;
    const ground = 80;
    const panel = (ox: number, lift: number, spikeX: number) => {
      c.fillStyle = DUAL_GROUND;
      c.fillRect(ox + 3, ground, 46, 4);
      at(c, ox + spikeX, ground, s, () => {
        c.fillStyle = DUAL_SPIKE;
        c.beginPath();
        c.moveTo(-DUAL_SPIKE_LEAN, -DUAL_SPIKE_H);
        c.lineTo(-DUAL_SPIKE_LEAN + DUAL_SPIKE_W, -DUAL_SPIKE_H + DUAL_SPIKE_H * (9 / 22));
        c.lineTo(DUAL_SPIKE_W / 2, -4);
        c.lineTo(-DUAL_SPIKE_W / 2, -4);
        c.lineTo(-DUAL_SPIKE_LEAN - DUAL_SPIKE_W, -DUAL_SPIKE_H + DUAL_SPIKE_H * (9 / 22));
        c.closePath();
        c.fill();
      });
      c.fillStyle = DUAL_RUNNER;
      c.beginPath();
      c.arc(ox + 14, ground - DUAL_RUNNER_R * s - lift, DUAL_RUNNER_R * s, 0, Math.PI * 2);
      c.fill();
    };
    panel(0, 30, 16);
    panel(52, 0, 42);
    c.strokeStyle = "rgba(255, 255, 255, 0.12)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(52.5, 10);
    c.lineTo(52.5, 104);
    c.stroke();
  }),

  // Junction: the crossroads (its asphalt, zebras and stop lines), a car waiting at a red light, another crossing on green.
  junction: canvasScene((c) => {
    const s = 104 / 150;
    at(c, 0, 0, s, () => {
      c.translate(75 - JUNC_CX, 75 - JUNC_CY);
      c.save();
      c.beginPath();
      c.rect(JUNC_CX - JUNC_HALF - 3, 0, JUNC_HALF * 2 + 6, 620);
      c.rect(0, JUNC_CY - JUNC_HALF - 3, 390, JUNC_HALF * 2 + 6);
      c.clip();
      drawScene(c);
      c.restore();
      drawCar(c, JUNC_CX - JUNC_HALF - 22, JUNC_CY + JUNC_LANE, 1, 0, CAR_COLOURS[0]!, false, 0);
      drawCar(c, JUNC_CX + JUNC_LANE, JUNC_CY + 26, 0, 1, CAR_COLOURS[3]!, false, 0);
      drawLight(c, JUNC_CX - JUNC_HALF - 16, JUNC_CY + JUNC_HALF + 18, false);
      drawLight(c, JUNC_CX + JUNC_HALF + 16, JUNC_CY - JUNC_HALF - 18, true);
    });
  }),

  // Hot Floor: numbered floor tiles, the gold route hopping across them to the glowing exit, the figure at the start.
  hotfloor: canvasScene((c) => {
    const T = 34;
    const ox = 1;
    const oy = 1;
    const cells: Array<[number, number, number | "exit" | "start" | "gone"]> = [
      [0, 0, 3],
      [0, 1, 2],
      [0, 2, "exit"],
      [1, 0, 1],
      [1, 1, 4],
      [1, 2, 3],
      [2, 0, "start"],
      [2, 1, 5],
      [2, 2, "gone"],
    ];
    const numbers: Array<[number, number, number]> = [];
    for (const [r, col, v] of cells) {
      const x = ox + col * T;
      const y = oy + r * T;
      c.beginPath();
      c.roundRect(x + 2.5, y + 2.5, T - 5, T - 5, 4.5);
      if (v === "gone") {
        c.fillStyle = "#0B0B11";
        c.fill();
        continue;
      }
      c.fillStyle = v === "exit" ? HOT_GOLD : "#1A1A24";
      c.fill();
      if (v === "exit") {
        c.strokeStyle = HOT_GOLD;
        c.globalAlpha = 0.6;
        c.lineWidth = 3;
        c.stroke();
        c.globalAlpha = 1;
      }
      if (typeof v === "number") numbers.push([x, y, v]);
    }
    const centre = (r: number, col: number) => [ox + col * T + T / 2, oy + r * T + T / 2] as const;
    c.strokeStyle = HOT_GOLD;
    c.globalAlpha = 0.85;
    c.lineWidth = 3;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    ([[2, 0], [1, 0], [1, 1], [0, 1], [0, 2]] as const).forEach(([r, col], i) => {
      const [x, y] = centre(r, col);
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    });
    c.stroke();
    c.globalAlpha = 1;
    c.font = "700 19px JetBrains Mono, monospace";
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const [x, y, v] of numbers) {
      c.fillStyle = v <= 1 ? HOT_RED : v <= 2 ? "#F28C28" : "#E8E8ED";
      c.fillText(String(v), x + T / 2, y + T / 2 + 1);
    }
    const [fx, fy] = centre(2, 0);
    c.fillStyle = HOT_GOLD;
    c.beginPath();
    c.roundRect(fx - 6, fy - 9, 12, 18, 6);
    c.fill();
    c.strokeStyle = HOT_BG;
    c.lineWidth = 1.5;
    c.stroke();
  }),

  // Steady: the teal dot riding inside the winding gold-edged track.
  steady: canvasScene((c) => {
    const half = 13;
    const centre = (y: number) => 52 + 20 * Math.sin((y - 10) * 0.045);
    const ys: number[] = [];
    for (let y = -4; y <= 108; y += 2) ys.push(y);
    c.fillStyle = "rgba(46, 211, 183, 0.10)";
    c.beginPath();
    ys.forEach((y, i) => (i === 0 ? c.moveTo(centre(y) - half, y) : c.lineTo(centre(y) - half, y)));
    for (let i = ys.length - 1; i >= 0; i--) c.lineTo(centre(ys[i]!) + half, ys[i]!);
    c.closePath();
    c.fill();
    c.strokeStyle = STD_GOLD;
    c.lineWidth = 2;
    for (const side of [-half, half]) {
      c.beginPath();
      ys.forEach((y, i) => (i === 0 ? c.moveTo(centre(y) + side, y) : c.lineTo(centre(y) + side, y)));
      c.stroke();
    }
    c.fillStyle = STD_DOT;
    c.beginPath();
    c.arc(centre(60) + 3, 60, STD_DOT_R * 0.7, 0, Math.PI * 2);
    c.fill();
  }),

  // Rooftop Run: the gold runner leaping down the receding rooftop lanes, teal hazards ahead.
  rooftop: canvasScene((c) => {
    const s = 104 / 220;
    at(c, 0, 0, s, () => {
      c.translate(-85, -326);
      c.lineWidth = 4;
      for (let edge = 0; edge <= ROOF_LANES; edge++) {
        const near = roofProject(edge - 0.5, 0);
        const far = roofProject(edge - 0.5, 2200);
        c.strokeStyle = edge === 0 || edge === ROOF_LANES ? ROOF_GOLD : "rgba(245,184,46,0.25)";
        c.beginPath();
        c.moveTo(near.x, 620);
        c.lineTo(far.x, far.y);
        c.stroke();
      }
      const wall = roofProject(0, 150);
      drawRoofObstacle(c, ROOF_WALL, wall.x, wall.y, wall.s);
      const low = roofProject(2, 70);
      drawRoofObstacle(c, ROOF_LOW, low.x, low.y, low.s);
      const me = roofProject(1, 0);
      drawRoofRunner(c, me.x, me.y - 22, 26, false, 0, true, 0);
    });
  }),
};
