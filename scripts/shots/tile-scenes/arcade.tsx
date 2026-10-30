/** Arcade games' tile scenes, painted with each game's own renderer (scene.ts has the rules). */
import { MINES_ART, paintMinesCover, paintMinesFlag, paintMinesHexes, paintMinesMine, paintMinesOpen } from "@/lib/arcade/minesweeper.renderer";
import { paintMahjongFace, paintMahjongTile } from "@/lib/arcade/mahjong.renderer";
import { BRK_BALL_R, BRK_BRICK_H, BRK_BRICK_W } from "@/lib/arcade/breaker";
import { PADDLE as BRK_PADDLE, RAINBOW as BRK_RAINBOW, paintBrick } from "@/lib/arcade/breaker.renderer";
import { glow } from "@/lib/arcade/polishA1.renderer";
import { RETRO_WHITE, drawRetroTrail, retroBall, retroPaddle, pixelRect } from "@/lib/arcade/retro.renderer";
import { STAR_GLOW as METEOR_STAR_GLOW, stamp as meteorStamp } from "@/lib/arcade/snake.renderer";
import { SNAKE_CELL } from "@/lib/arcade/snake";
import { apple, basket, leaf as goldLeaf, twine } from "@/lib/arcade/snip.renderer";
import { drawFighter, drawHull, drawShipFlame, drawWavefrontBeam } from "@/lib/arcade/wavefront.renderer";
import { WAV_CELL, WAV_COLOURS } from "@/lib/arcade/wavefront";
import { drawAtmosphere, drawPlanet, drawRocketFlame, paintRocket } from "@/lib/arcade/orbit.renderer";
import { drawPipe, drawSaucer, drawShipLight, drawStar as hoverStar } from "@/lib/arcade/hover.renderer";
import { HOVER_DISC_X, type HoverState } from "@/lib/arcade/hover";
import { REAL_ASPHALT, drawVehicle, drawWalkerHero } from "@/lib/arcade/cross.renderer";
import { heroPose, type HeroPose } from "@/lib/arcade/hero.renderer";
import { drawDart, paintBoard } from "@/lib/arcade/bullseye.renderer";
import { BULLSEYE_RING_VALUES } from "@/lib/arcade/bullseye";
import { drawBall as drawPinball, drawFlippers, paintBumper } from "@/lib/arcade/pinball.renderer";
import { PIN_FLIP_REST, PIN_FLIP_UP, type PinState } from "@/lib/arcade/pinball";
import { COURT as RALLY_COURT, PAD as RALLY_PAD, PADDLE as RALLY_PADDLE, drawBumper as rallyBumper, drawPad as rallyPad } from "@/lib/arcade/rally.renderer";
import { RALLY_BALL_R, RALLY_HUD_H, RALLY_PADDLE_H, RALLY_WALL } from "@/lib/arcade/rally";
import { drawSocket, paintMatchupGem } from "@/lib/arcade/matchup.renderer";
import { MATCHUP_CELL_PX, MATCHUP_GOLD, MATCHUP_SYMBOL_PCT } from "@/lib/arcade/matchup";
import { paintBubble } from "@/lib/arcade/bubble.renderer";
import { SEA_BRASS, SEA_BRASS_DARK } from "@/lib/arcade/seas.renderer";
import {
  CUP_GLASS,
  TILT_MARBLE_BLUE,
  drawBigCup,
  drawDiscBed,
  drawPits,
  drawStrips,
  marbleGloss,
  marbleShadow,
  paintDisc,
} from "@/lib/arcade/tiltArt.renderer";
import type { Maze } from "@/lib/arcade/tilt";
import { toyMarble } from "@/lib/arcade/toybox.renderer";
import { drawArtSprite } from "@/lib/arcade/sprites.renderer";
import { coin, drawPot, rainbow } from "@/lib/arcade/inkBridge.renderer";
import { MATERIAL, drawFlipPool, drawRockObstacle, drawRunnerHero, drawStar as flipStar } from "@/lib/arcade/flipArt.renderer";
import { FLIP_REV, type FlipState } from "@/lib/arcade/flip";

import { at, canvasScene, noText, TILE, type SceneSet } from "./scene";

type Ctx = CanvasRenderingContext2D;

/** A fresh hero pose for one tile paint (the game's head and stick, details judged at the tile's real px). */
function tileHero(headR: number, stick: number, scale: number, realPx: number): HeroPose {
  return Object.assign(heroPose(), { headR, stick, scale, detailScale: realPx });
}

export const ARCADE_SCENES: SceneSet = {
  // Breaker: three rows of its rainbow bricks (one gold), the paddle and the ball rising towards the gap.
  breaker: canvasScene((c) => {
    const s = 0.5;
    at(c, 8, 12, s, () => {
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 4; col++) {
          if (row === 2 && col === 1) continue;
          c.save();
          c.translate(col * BRK_BRICK_W, row * (BRK_BRICK_H + 4));
          paintBrick(c, row === 1 && col === 2 ? BRK_PADDLE : BRK_RAINBOW[row % BRK_RAINBOW.length]!, -1, 0, 0);
          c.restore();
        }
    });
    at(c, 0, 0, 1, () => {
      glow(c, "#9FEFFF", 46, 60, BRK_BALL_R + 7, BRK_BALL_R + 7, 0.5);
      retroBall(c, 46, 60, BRK_BALL_R, "#BFF6FF", RETRO_WHITE);
      glow(c, BRK_PADDLE, 52, 88, 34, 10, 0.42);
      retroPaddle(c, 30, 84, 44, 8, BRK_PADDLE, "#5A4510", 0);
    });
  }),

  // Meteor: the glowing white-gold comet head and its tapering, fading tail turning a corner on the grid, a star just ahead, a landed rock.
  snake: canvasScene((c) => {
    const s = 104 / (4 * SNAKE_CELL);
    const cell = (col: number, row: number) => ({ x: col * SNAKE_CELL + SNAKE_CELL / 2, y: row * SNAKE_CELL + SNAKE_CELL / 2 });
    const blit = (sprite: CanvasImageSource | null, col: number, row: number) => {
      if (!sprite) return;
      const p = cell(col, row);
      c.drawImage(sprite, p.x - SNAKE_CELL / 2, p.y - SNAKE_CELL / 2, SNAKE_CELL, SNAKE_CELL);
    };
    at(c, 0, 52 - 1.5 * SNAKE_CELL * s, s, () => {
      // Head first: the head at (2,0) heading right at the star, the tail coiling down and back.
      const body: [number, number][] = [[2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [1, 2]];
      const star = cell(3, 0);
      glow(c, METEOR_STAR_GLOW, star.x, star.y, 16, 16, 0.7);
      blit(meteorStamp("star") as CanvasImageSource | null, 3, 0);
      blit(meteorStamp("rock") as CanvasImageSource | null, 3, 2);
      for (let i = body.length - 1; i >= 0; i--) {
        const level = Math.min(4, Math.round((i / (body.length - 1)) * 4));
        blit(meteorStamp(i === 0 ? "head" : "bead", i === 0 ? 0 : level, 1, 0) as CanvasImageSource | null, body[i]![0], body[i]![1]);
      }
      const head = cell(2, 0);
      glow(c, "#FFC23E", head.x, head.y, 14, 14, 0.5);
    });
  }),

  // Scrumper: the shiny apple hanging on its twine above the wicker basket, a golden leaf beside it.
  snip: canvasScene((c) => {
    twine(c, [[44, -2], [44, 26]], 1);
    at(c, 44 - 17, 22, 34 / 24, () => apple(c));
    at(c, 66, 14, 26 / 48, () => goldLeaf(c));
    at(c, 52 - 30, 64, 60 / 64, () => basket(c));
  }),

  // Wavefront: three enemy hulls in formation, the player's fighter below firing its green beam up at them.
  wavefront: canvasScene((c) => {
    const s = 30 / WAV_CELL;
    at(c, 0, 0, s, () => {
      drawHull(c, 0, WAV_COLOURS[0]!, 4 / s, 8 / s, WAV_CELL, 0);
      drawHull(c, 1, WAV_COLOURS[1]!, 37 / s, 4 / s, WAV_CELL, 0);
      drawHull(c, 0, WAV_COLOURS[2]!, 70 / s, 8 / s, WAV_CELL, 0);
    });
    at(c, 52, 0, 1.6, () => {
      drawWavefrontBeam(c, 0, 26, "player");
    });
    at(c, 52, 80, 1.05, () => {
      drawShipFlame(c, 0, 12, true, 0, true);
      drawFighter(c, 0, 0, 40, 24, false, 0, 0);
    });
  }),

  // Orbit: the rocket riding the dashed orbit round a ringed gas giant, heading for the next planet.
  orbit: canvasScene((c, k) => {
    const px = 48, py = 60, orbitR = 38;
    drawAtmosphere(c, px, py, 17, "#4D8CFF");
    c.save();
    c.strokeStyle = "#4D8CFF";
    c.lineCap = "round";
    c.globalAlpha = 0.2;
    c.lineWidth = 7;
    c.beginPath();
    c.arc(px, py, orbitR, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([7, 5]);
    c.globalAlpha = 0.95;
    c.lineWidth = 2;
    c.stroke();
    c.restore();
    drawPlanet(c, px, py, 18, { type: 1, colour: "#4D8CFF", ring: true, tilt: -0.35, h: 0x9e3779b1 });
    drawAtmosphere(c, 88, 18, 9, "#3DDC84");
    drawPlanet(c, 88, 18, 10, { type: 0, colour: "#3DDC84", ring: false, tilt: 0, h: 0x2545f491 });
    // On the orbit at its upper left, nose along the path towards the green planet.
    const a = (-125 * Math.PI) / 180;
    const rx = px + Math.cos(a) * orbitR;
    const ry = py + Math.sin(a) * orbitR;
    c.save();
    c.translate(rx, ry);
    c.rotate(a + Math.PI / 2);
    c.scale(1.35, 1.35);
    drawRocketFlame(c, 1, -1, 0, true);
    paintRocket(c, false, 1.35 * k);
    c.restore();
  }),

  // Hover: the gold saucer flying at a neon barrier's gap, a gold star waiting in the gap.
  hover: canvasScene((c) => {
    const s = 1.1;
    const gapTop = 36, gapH = 42, left = 158, w = 40, worldH = 110;
    const state = { y: 52 * 256, vy: 0, crashed: false, tick: 0, starsTaken: [] } as unknown as HoverState;
    const pillar = { gapTop: gapTop * 256, gapH: gapH * 256, starDy: (gapH / 2) * 256 } as unknown as HoverState["pillars"][number];
    at(c, 22 - (HOVER_DISC_X / 256) * s, -9.6, s, () => {
      const colour = "#3DFFE0";
      drawPipe(c, left, 0, w, gapTop, colour, 0, 0, "bottom");
      drawPipe(c, left, gapTop + gapH, w, worldH - gapTop - gapH, colour, 0, 0, "top");
      hoverStar(c, state, pillar, 0, left + w / 2);
      drawShipLight(c, state);
      drawSaucer(c, state, false);
    });
  }),

  // Jaywalk: the hero walker crossing two lanes of traffic, a car coming each way.
  cross: canvasScene((c, k) => {
    const top = 20, laneH = 32;
    c.fillStyle = REAL_ASPHALT;
    c.fillRect(0, top, 104, laneH * 2);
    c.fillStyle = "rgba(20,24,30,0.1)";
    for (const lane of [0, 1]) {
      c.fillRect(0, top + lane * laneH + 6, 104, 4);
      c.fillRect(0, top + lane * laneH + laneH - 10, 104, 4);
    }
    c.fillStyle = "rgba(250,250,250,0.85)";
    c.fillRect(0, top + 1, 104, 2);
    c.fillRect(0, top + laneH * 2 - 3, 104, 2);
    c.fillStyle = "rgba(248,250,252,0.9)";
    for (let x = -6; x < 104; x += 26) c.fillRect(x, top + laneH - 1, 13, 2);
    drawVehicle(c, 62, top + 4, 50, laneH - 8, -1, "#5AA9FF", false, false);
    drawVehicle(c, -14, top + laneH + 4, 50, laneH - 8, 1, "#F25C54", false, false);
    const s = 1.35;
    at(c, 46, top + laneH - 2, s, () => drawWalkerHero(c, 0, 0, 0, 0.6, 0, 0.6, true, tileHero(4, 3, 1, s * k)));
  }),

  // Flightpath: the ring board on its hay bale with a dart in the bull and one in a ring.
  bullseye: canvasScene((c) => {
    paintBoard(c, 52, 42, 44, BULLSEYE_RING_VALUES);
    drawDart(c, 53, 40, 1.15, "#D9363E");
    drawDart(c, 34, 30, 1.0, "#2ED3B7");
  }),

  // Pinball: the two gold flippers (left one raised), the chrome ball above them and a pop bumper.
  pinball: canvasScene((c) => {
    // A pop bumper above the flippers (paintBumper, the table's own), the left flipper raised, the chrome ball coming off it.
    const s = 0.62;
    const state = { flips: [PIN_FLIP_UP, PIN_FLIP_REST], held: 1 } as unknown as PinState;
    at(c, 52 - 181 * s, 54 - 590 * s, s, () => {
      paintBumper(c, 181, 538);
      drawFlippers(c, state);
      drawPinball(c, 162, 590);
    });
  }),

  // Minesweeper (Cards & Board): the slate board over its faint hexagons, bevelled covered squares, sunk revealed
  // ones, a red pennant flag and a revealed mine (numbers are digits, so none: the tile rules).
  minesweeper: canvasScene((c) => {
    c.fillStyle = MINES_ART.bg;
    c.fillRect(0, 0, TILE, TILE);
    c.save();
    c.globalAlpha = 0.6;
    paintMinesHexes(c, TILE, TILE, "rgba(120,150,180,0.12)");
    c.restore();
    const size = 30;
    const ox = 7, oy = 7;
    c.fillStyle = MINES_ART.slate;
    c.fillRect(ox - 2, oy - 2, size * 3 + 4, size * 3 + 4);
    const grid = ["OOC", "OFC", "CCM"];
    grid.forEach((row, r) =>
      [...row].forEach((ch, col) => {
        const x = ox + col * size;
        const y = oy + r * size;
        if (ch === "O") paintMinesOpen(c, x, y, size);
        else if (ch === "M") {
          c.fillStyle = MINES_ART.boom;
          c.fillRect(x + 1, y + 1, size - 2, size - 2);
          paintMinesMine(c, x + size / 2, y + size / 2, size);
        } else {
          paintMinesCover(c, x, y, size);
          if (ch === "F") paintMinesFlag(c, x, y, size);
        }
      }),
    );
  }),

  // Mahjong Solitaire (Cards & Board): two ivory tiles on the jade mat and a third stacked on them, glowing gold
  // (selected): a dot, a bamboo and the red dragon.
  mahjong: canvasScene((c) => {
    c.fillStyle = "#14503A";
    c.fillRect(0, 0, TILE, TILE);
    c.save();
    c.globalAlpha = 0.7;
    c.strokeStyle = "#D9B45A";
    c.setLineDash([4, 3]);
    c.lineWidth = 1.2;
    c.strokeRect(5, 5, TILE - 10, TILE - 10);
    c.restore();
    const w = 36, h = 48;
    paintMahjongTile(c, 12, 46, w, h, 5);
    paintMahjongFace(c, 13, 12, 46, w, h);
    paintMahjongTile(c, 50, 46, w, h, 5);
    paintMahjongFace(c, 2, 50, 46, w, h);
    paintMahjongTile(c, 27, 14, w, h, 5);
    paintMahjongFace(c, 31, 27, 14, w, h);
    glow(c, "#F2C75C", 27 + w / 2, 14 + h / 2, w * 0.9, h * 0.75, 0.25);
    c.strokeStyle = "#F2C75C";
    c.lineWidth = 2.4;
    c.strokeRect(26, 13, w + 2, h + 2);
  }),

  // Rally: the teal paddle, the ball bouncing up towards a pink pad in the far wall, a bumper post.
  rally: canvasScene((c) => {
    const s = 0.9;
    const wall = RALLY_HUD_H + RALLY_WALL;
    at(c, 52 - 195 * s, 12 - wall * s, s, () => {
      pixelRect(c, 120, wall - 2, 150, 2, `${RALLY_COURT}70`);
      noText(c, () => rallyPad(c, 196, 0, false));
      rallyBumper(c, 152, wall + 40, false, 0);
      const bx = 214, by = wall + 50;
      drawRetroTrail(c, [{ x: 194, y: by + 48 }, { x: 199, y: by + 36 }, { x: 204, y: by + 24 }, { x: 208, y: by + 14 }, { x: 210, y: by + 7 }, { x: bx, y: by }], RALLY_BALL_R, RETRO_WHITE);
      glow(c, RETRO_WHITE, bx, by, RALLY_BALL_R + 8, RALLY_BALL_R + 8, 0.45);
      retroBall(c, bx, by, RALLY_BALL_R, RETRO_WHITE);
      const pw = 76, py = wall + 92;
      glow(c, RALLY_PADDLE, 200, py + RALLY_PADDLE_H / 2, pw / 2 + 16, 16, 0.4);
      retroPaddle(c, 200 - pw / 2, py, pw, RALLY_PADDLE_H, RALLY_PADDLE, "#0E4A44", 0);
    });
    void RALLY_PAD;
  }),

  // Gemstone: velvet sockets with cut gems, three alike in the middle row.
  matchup: canvasScene((c) => {
    const s = 32 / MATCHUP_CELL_PX;
    const radius = (MATCHUP_CELL_PX * MATCHUP_SYMBOL_PCT) / 200;
    const kinds = [
      [1, 4, 0],
      [2, 2, 2],
      [5, 0, 3],
    ];
    at(c, 4, 4, s, () => {
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 3; col++) drawSocket(c, col * MATCHUP_CELL_PX, row * MATCHUP_CELL_PX, (row + col) % 2);
      glow(c, MATCHUP_GOLD, 1.5 * MATCHUP_CELL_PX, 1.5 * MATCHUP_CELL_PX, 1.6 * MATCHUP_CELL_PX, 0.55 * MATCHUP_CELL_PX, 0.55);
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 3; col++)
          paintMatchupGem(c, kinds[row]![col]!, (col + 0.5) * MATCHUP_CELL_PX, (row + 0.5) * MATCHUP_CELL_PX, radius * 1.08, 0);
    });
  }),

  // Coral Pop: the reef of creature bubbles above, the loaded bubble in the brass gun and its aim.
  bubble: canvasScene((c) => {
    const d = 21;
    const bubble = (value: number, x: number, y: number) => {
      c.save();
      c.translate(x - d / 2, y - d / 2);
      paintBubble(value)(c, d);
      c.restore();
    };
    [3, 3, 1, 4, 2].forEach((v, i) => bubble(v, 10 + i * 21, 12));
    [5, 4, 1, 1].forEach((v, i) => (i === 2 ? undefined : bubble(v, 20.5 + i * 21, 30)));
    // The aim: the game's faint dotted trail, from the gun up to the gap.
    c.fillStyle = "rgba(225,242,255,0.5)";
    c.strokeStyle = "rgba(255,255,255,0.7)";
    c.lineWidth = 0.8;
    for (let i = 1; i <= 4; i++) {
      c.beginPath();
      c.arc(52 + (62.5 - 52) * (i / 5), 84 - (84 - 30) * (i / 5), 1.6, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    // The diver's bubble gun: riveted brass base and the brass cradle ring (bubble.renderer's own drawing).
    const gx = 52, gy = 84, rs = 0.62;
    c.fillStyle = SEA_BRASS_DARK;
    c.beginPath();
    c.roundRect(gx - 26 * rs, gy + 12 * rs, 52 * rs, 14 * rs, 5 * rs);
    c.fill();
    const brass = c.createLinearGradient(0, gy + 14 * rs, 0, gy + 23 * rs);
    brass.addColorStop(0, "#F0D58A");
    brass.addColorStop(0.45, SEA_BRASS);
    brass.addColorStop(1, "#9A7A30");
    c.fillStyle = brass;
    c.beginPath();
    c.roundRect(gx - 22 * rs, gy + 14 * rs, 44 * rs, 9 * rs, 4 * rs);
    c.fill();
    c.strokeStyle = SEA_BRASS_DARK;
    c.lineWidth = 2.8;
    c.beginPath();
    c.arc(gx, gy, d / 2 + 2, Math.PI * 0.15, Math.PI * 0.85);
    c.stroke();
    c.strokeStyle = SEA_BRASS;
    c.lineWidth = 1.8;
    c.stroke();
    bubble(1, gx, gy);
  }),

  // Tilt: the oak labyrinth disc with its raised strips, a pit, the blue marble and its cup.
  tilt: canvasScene((c) => {
    const cs = 26;
    const n = 3;
    const maze = {
      n,
      cs: cs * 256,
      inside: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      wallR: [0, 1, 0, 1, 0, 0, 0, 0, 0],
      wallD: [1, 0, 0, 0, 1, 0, 0, 0, 0],
      pits: [5],
      start: 6,
      exit: -1,
      exitDir: 0,
      br: 8 * 256,
      crevice: -1,
      gateDir: 0,
      lock: -1,
    } as unknown as Maze;
    const centre = (cell: number) => ({ x: (cell % n) * cs + cs / 2 - (n * cs) / 2, y: Math.trunc(cell / n) * cs + cs / 2 - (n * cs) / 2 });
    at(c, 52, 52, 1, () => {
      drawDiscBed(c, 58);
      paintDisc(c, 58);
      drawPits(c, maze);
      drawStrips(c, maze, false);
      const cup = centre(2);
      drawBigCup(c, { x: cup.x, y: cup.y, r: 10 }, TILT_MARBLE_BLUE, CUP_GLASS, false);
      const m = centre(6);
      marbleShadow(c, m.x, m.y, 8, 0);
      if (!drawArtSprite(c, "toybox", "marble", m.x - 8, m.y - 8, 16, 16)) toyMarble(c, m.x, m.y, 8, TILT_MARBLE_BLUE, 0);
      marbleGloss(c, m.x, m.y, 8, 0);
    });
  }),

  // Rainbow Bridge: a drawn rainbow line carrying the gold coin down into the pot of gold.
  inkbridge: canvasScene((c) => {
    const x0 = 8, y0 = 34, x1 = 70, y1 = 70;
    c.lineCap = "round";
    c.lineWidth = 7;
    c.strokeStyle = rainbow(c, x0, y0, x1, y1, 0, Math.hypot(x1 - x0, y1 - y0));
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    c.lineWidth = 1.4;
    c.strokeStyle = "rgba(255,255,255,0.5)";
    c.beginPath();
    c.moveTo(x0 + 0.7, y0 - 1.3);
    c.lineTo(x1 + 0.7, y1 - 1.3);
    c.stroke();
    at(c, 27 - 10, 24, 20 / 14, () => coin(c));
    at(c, 84, 74, 0.6, () => drawPot(c, 0, 0, false));
  }),

  // Roofbound: the hero running along the lava-lit tunnel floor towards a lava pool, a spike overhead.
  flip: canvasScene((c, k) => {
    const ceil = 24, floor = 80;
    const ceilAt = () => ceil;
    const floorAt = () => floor;
    const rock = (y0: number, y1: number, toward: number) => {
      const g = c.createLinearGradient(0, toward, 0, toward === y0 ? y1 : y0);
      g.addColorStop(0, MATERIAL.nearRock);
      g.addColorStop(1, MATERIAL.farRock);
      c.fillStyle = g;
      c.fillRect(0, y0, 104, y1 - y0);
    };
    rock(0, ceil, ceil);
    rock(floor, 104, floor);
    const air = c.createLinearGradient(0, ceil, 0, floor);
    air.addColorStop(0, "#2A1714");
    air.addColorStop(0.18, "#161518");
    air.addColorStop(0.5, MATERIAL.tunnel);
    air.addColorStop(0.82, "#161518");
    air.addColorStop(1, "#2A1714");
    c.fillStyle = air;
    c.fillRect(0, ceil, 104, floor - ceil);
    const poolA = 62, poolB = 98;
    const rail = (y: number, gaps: [number, number][]) => {
      c.beginPath();
      let from = 0;
      for (const [a, b] of gaps) {
        c.moveTo(from, y);
        c.lineTo(a, y);
        from = b;
      }
      c.moveTo(from, y);
      c.lineTo(104, y);
      for (const [w, colour] of [[2.4, MATERIAL.lava], [1.1, MATERIAL.hot], [0.5, "rgba(255,240,200,0.7)"]] as const) {
        c.strokeStyle = colour;
        c.lineWidth = w;
        c.stroke();
      }
    };
    drawFlipPool(c, poolA, poolB, -1, floorAt, 0, 7);
    drawRockObstacle(c, 30, 56, 1, ceilAt, 20, 11, 0.5);
    rail(ceil, []);
    rail(floor, [[poolA, poolB]]);
    flipStar(c, 80, ceil + 16, 0, true);
    const state = { ended: 0, flipT: 0, side: 0, rev: FLIP_REV, tick: 0, segs: [] } as unknown as FlipState;
    at(c, 30 - 90, 0, 1, () => drawRunnerHero(c, state, floor - 18, true, null, tileHero(3.4, 2.4, 1.65, 1.65 * k)));
  }),
};

export type _Unused = HoverState | PinState | FlipState | Maze | Ctx;
