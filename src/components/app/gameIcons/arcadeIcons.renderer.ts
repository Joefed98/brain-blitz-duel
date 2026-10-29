/**
 * Game icons for the arcade-stage games (the 22 arcade games and the five engine games), painted
 * by each game's own renderer: the same function that draws the sprite on the game's screen
 * (Hover's saucer, Gemstone's gem, Bonk's gopher…) called on a small canvas. Presentation only:
 * no sim state is created or stepped; renderers only observe plain values here.
 *
 * Every painter draws a 64 × 64 icon space (the canvas is scaled to the icon's size and pixel
 * ratio first). Text is never drawn: tile faces that carry a letter or digit in play are painted
 * with fillText suppressed (`noText`).
 *
 * Grappler, Jaywalk and Roofbound draw the Joulz hero (hero.renderer) on their game's own joints,
 * painted as vectors at the icon's real pixel size (never an enlarged sprite). Each paint gets a
 * fresh pose, so the cape snaps to its angle and never shares the game's eased one.
 *
 * Orbit, Breaker, Gemstone, Meteor and Tempo (Prompt Q, 23 Oct 2026) paint their sprite's own art
 * (the renderer's paint function behind its cached sprite) at the icon's real pixel size, never an
 * enlarged small sprite, so they stay sharp on the 104 px Practice tile; glows are scaled by `k` to
 * keep the sprite's look.
 */
import { drawSaucer } from "@/lib/arcade/hover.renderer";
import { HOVER_IMPULSE, type HoverState } from "@/lib/arcade/hover";
import { drawBlock } from "@/lib/arcade/skyline.renderer";
import { drawRubberBall } from "@/lib/arcade/binTossArt.renderer";
import { drawDart, paintBoard } from "@/lib/arcade/bullseye.renderer";
import { BULLSEYE_RING_VALUES } from "@/lib/arcade/bullseye";
import { paintMatchupGem } from "@/lib/arcade/matchup.renderer";
import { paintBrick } from "@/lib/arcade/breaker.renderer";
import { RETRO_WHITE, retroBall, retroNeon, retroPaddle } from "@/lib/arcade/retro.renderer";
import { drawBall as drawPinball, paintBumper } from "@/lib/arcade/pinball.renderer";
import { paintFood } from "@/lib/arcade/slice.renderer";
import { paintBubble } from "@/lib/arcade/bubble.renderer";
import { paintNote } from "@/lib/arcade/beat.renderer";
import { BEAT_LANE_COLOURS } from "@/lib/arcade/beat";
import { paintStamp as paintMeteorStamp } from "@/lib/arcade/snake.renderer";
import { SNAKE_CELL } from "@/lib/arcade/snake";
import { drawVehicle, drawWalkerHero } from "@/lib/arcade/cross.renderer";
import { drawFighter } from "@/lib/arcade/wavefront.renderer";
import { drawRunnerHero } from "@/lib/arcade/flipArt.renderer";
import { FLIP_REV, type FlipState } from "@/lib/arcade/flip";
import { INK_RAINBOW, coin, pot } from "@/lib/arcade/inkBridge.renderer";
import { paintAtom } from "@/lib/arcade/burst.renderer";
import { BURST_COLOURS } from "@/lib/arcade/burst";
import { drawPlanet, paintRocket } from "@/lib/arcade/orbit.renderer";
import { drawHero, heroPose, type HeroPose } from "@/lib/arcade/hero.renderer";
import { apple } from "@/lib/arcade/snip.renderer";
import { TILT_MARBLE_BLUE, paintDisc } from "@/lib/arcade/tiltArt.renderer";
import { toyMarble } from "@/lib/arcade/toybox.renderer";
import { drawArtSprite } from "@/lib/arcade/sprites.renderer";
import { btMarble } from "@/lib/arcade/ballTrackArt.renderer";
import { BT_PALETTE } from "@/lib/arcade/ballTrack";
import { paintGate } from "@/lib/arcade/colourClash.renderer";
import { CLASH_COLOURS } from "@/lib/arcade/colourClash";
import { paintGopher, paintHat } from "@/lib/arcade/whack.renderer";
import { tileSprite } from "@/lib/arcade/tenDrop.renderer";
import { PICK_FACE, TILE_EDGE, TILE_FACE, drawTile } from "@/lib/arcade/wordfall.renderer";
import { drawClay } from "@/lib/arcade/clayShootArt.renderer";

type Ctx = CanvasRenderingContext2D;
/** Paints one icon in the 64-unit space; `k` is device pixels per unit (for cached sprites). */
export type IconPainter = (c: Ctx, k: number) => void;

/** Runs a painter with text drawing switched off on this context (tiles that carry a letter in play). */
function noText(c: Ctx, paint: () => void): void {
  const own = c as unknown as { fillText: unknown; strokeText: unknown };
  own.fillText = () => undefined;
  own.strokeText = () => undefined;
  try {
    paint();
  } finally {
    delete own.fillText;
    delete own.strokeText;
  }
}

/** Draws a renderer's sprite painter (origin top-left, `size` square) at x, y. */
function sprite(
  c: Ctx,
  painter: (c: Ctx, size: number) => void,
  x: number,
  y: number,
  size: number,
): void {
  c.save();
  c.translate(x, y);
  painter(c, size);
  c.restore();
}

/** A fresh hero pose for one icon paint: the game's head and stick, details judged at the icon's real px per pose unit. */
function iconHero(headR: number, stick: number, scale: number, realPx: number): HeroPose {
  return Object.assign(heroPose(), { headR, stick, scale, detailScale: realPx });
}

function scaled(c: Ctx, x: number, y: number, s: number, paint: () => void): void {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  paint();
  c.restore();
}

export const ARCADE_ICON_PAINTERS: Record<string, IconPainter> = {
  // Hover: the pixel saucer (hover.renderer drawSaucer), at rest.
  hover: (c) =>
    scaled(c, 32, 33, 2.4, () => {
      c.translate(-130, 0);
      drawSaucer(
        c,
        { y: 0, vy: HOVER_IMPULSE - 4_000, crashed: false } as unknown as HoverState,
        false,
      );
    }),
  // High Rise: three stacked tower blocks with lit windows (skyline.renderer drawBlock).
  skyline: (c) =>
    scaled(c, 0, 0, 0.62, () => {
      drawBlock(c, 22, 63, 58, 36, 2, 40);
      drawBlock(c, 30, 27, 58, 36, 5, 40);
      drawBlock(c, 26, -9, 58, 36, 1, 40);
    }),
  // Swish: the white baseball (binTossArt drawRubberBall).
  bintoss: (c) => drawRubberBall(c, 32, 32, 19, 0.7),
  // Flightpath: the ring target (bullseye paintBoard) with a dart in it (drawDart).
  bullseye: (c) => {
    paintBoard(c, 32, 30, 30, BULLSEYE_RING_VALUES);
    drawDart(c, 37, 26, 0.85, "#F5B82E");
  },
  // Gemstone: a cut gem (matchup paintMatchupGem, the gem sprite's art).
  matchup: (c) => paintMatchupGem(c, 3, 32, 32, 25),
  // Breaker: neon bricks, the paddle and the ball (breaker paintBrick, the brick sprite's art; retroPaddle, retroBall).
  breaker: (c) => {
    const colours = ["#FF3B5C", "#FFD84A", "#3DFFE0", "#C59CFF"];
    scaled(c, 4, 6, 0.62, () => {
      for (let row = 0; row < 2; row++)
        for (let col = 0; col < 2; col++) {
          c.save();
          c.translate(col * 46, row * 22);
          paintBrick(c, colours[row * 2 + col]!, 0, 0, 0);
          c.restore();
        }
    });
    retroBall(c, 38, 40, 5, "#BFF6FF");
    retroPaddle(c, 16, 50, 32, 7, "#FFD84A", "#5A4510", 0);
  },
  // Pinball: a pop bumper and the chrome ball (pinball paintBumper, drawBall).
  pinball: (c) =>
    scaled(c, 30, 28, 1.05, () => {
      paintBumper(c, 0, 0);
      drawPinball(c, 16, 17);
    }),
  // Rally: the ball over the paddle (retroBall, retroPaddle in the court's colours).
  rally: (c) => {
    retroBall(c, 34, 24, 8, RETRO_WHITE);
    retroPaddle(c, 12, 44, 40, 9, "#3DFFE0", "#0E4A44", 0);
  },
  // Slice: a cabbage on the board (slice paintFood).
  slice: (c) => sprite(c, paintFood("cabbage"), 9, 9, 46),
  // Coral Pop: a glass bubble with its creature (bubble paintBubble).
  bubble: (c) => sprite(c, paintBubble(4), 8, 8, 48),
  // Tempo: falling neon note bars (beat paintNote, the note sprite's art).
  beat: (c) => {
    BEAT_LANE_COLOURS.forEach((colour, lane) => {
      c.save();
      c.translate(4 + lane * 15, [36, 12, 44, 24][lane]!);
      paintNote(c, retroNeon(colour), 12);
      c.restore();
    });
  },
  // Meteor: the flaming head and its tail beads (snake paintStamp, the stamp sprite's art), heading up, and a star pellet.
  snake: (c, k) => {
    const s = 20 / SNAKE_CELL;
    const draw = (kind: "bead" | "head" | "star", x: number, y: number, dir = 0) =>
      scaled(c, x - 10, y - 10, s, () => {
        // The sprite's canvas clipped each glow to its cell; so does this.
        c.beginPath();
        c.rect(0, 0, SNAKE_CELL, SNAKE_CELL);
        c.clip();
        paintMeteorStamp(c, kind, 0, dir, 0, s * k);
      });
    draw("bead", 24, 52);
    draw("bead", 24, 36);
    draw("head", 24, 18, 0);
    draw("star", 48, 22);
  },
  // Jaywalk: the hero walker crossing in front of a car (cross drawWalkerHero, drawVehicle), facing the viewer.
  cross: (c, k) => {
    drawVehicle(c, -14, 40, 44, 22, 1, "#5AA9FF", false, false);
    scaled(c, 38, 28, 1.6, () =>
      drawWalkerHero(c, 0, 0, 1, 0, 0, 0, true, iconHero(4, 3, 1, 1.6 * k)),
    );
  },
  // Wavefront: the player fighter (wavefront drawFighter; the bundled PNG once loaded).
  wavefront: (c) => scaled(c, 32, 34, 1.25, () => drawFighter(c, 0, 0, 40, 24, false, 0, 0)),
  // Roofbound: the hero runner (flipArt drawRunnerHero, rev 2's 1.65 figure), standing.
  flip: (c, k) =>
    scaled(c, 32, 33, 1.45, () => {
      c.translate(-90, 0);
      drawRunnerHero(
        c,
        { ended: 0, flipT: 0, side: 0, rev: FLIP_REV, tick: 0 } as unknown as FlipState,
        0,
        true,
        null,
        iconHero(3.4, 2.4, 1.65, 1.45 * 1.65 * k),
      );
    }),
  // Rainbow Bridge: a rainbow line, the falling coin and the pot of gold (inkBridge coin, pot).
  inkbridge: (c) => {
    c.lineCap = "round";
    INK_RAINBOW.forEach((colour, i) => {
      c.strokeStyle = colour;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(32, 50, 34 - i * 2, Math.PI * 1.08, Math.PI * 1.62);
      c.stroke();
    });
    scaled(c, 6, 38, 0.8, () => pot(c));
    scaled(c, 36, 10, 1.3, () => coin(c));
  },
  // Fission: a neon atom (burst paintAtom).
  burst: (c) => scaled(c, 8, 8, 1, () => paintAtom(c, 24, retroNeon(BURST_COLOURS[0]), 3)),
  // Orbit: a ringed planet and the rocket (orbit drawPlanet, paintRocket).
  orbit: (c, k) => {
    drawPlanet(c, 25, 38, 15, {
      type: 1,
      colour: "#5AA9FF",
      ring: true,
      tilt: -0.35,
      h: 0x9e3779b1,
    });
    // The rocket sprite's art (orbit paintRocket), 48 sprite px in 44 units.
    c.save();
    c.translate(46, 18);
    c.rotate(-Math.PI / 4);
    c.scale(44 / 48, 44 / 48);
    paintRocket(c, false, (44 / 48) * k);
    c.restore();
  },
  // Grappler: the hero on its rope from the anchor (hero.renderer drawHero on the icon's joints, the anchor art).
  swing: (c, k) => {
    const fx = 38;
    const fy = 38;
    const s = 2.3;
    c.strokeStyle = "#D8C79A";
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(18, 8);
    c.lineTo(fx + 1.5 * s, fy - 6 * s);
    c.stroke();
    if (!drawArtSprite(c, "cavelava", "anchor", 12, 2, 12, 12)) {
      c.strokeStyle = "#F5B82E";
      c.lineWidth = 2.4;
      c.beginPath();
      c.arc(18, 8, 4.5, 0, Math.PI * 2);
      c.stroke();
    }
    // The icon's own pose (its rope hand up to the rope), swinging up and to the right with the cape trailing.
    const hero = iconHero(3.4, 2.4, 1, s * k);
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
    scaled(c, fx, fy, s, () => drawHero(c, hero));
  },
  // Scrumper: the apple on its twine (snip apple).
  snip: (c) => {
    c.strokeStyle = "#C9A86A";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(32, 0);
    c.lineTo(32, 16);
    c.stroke();
    scaled(c, 14, 14, 1.5, () => apple(c));
  },
  // Tilt: the blue marble in the wooden disc (tiltArt paintDisc; the bundled marble, else toyMarble).
  tilt: (c) => {
    scaled(c, 32, 32, 30 / 204, () => paintDisc(c));
    if (!drawArtSprite(c, "toybox", "marble", 22, 22, 20, 20))
      toyMarble(c, 32, 32, 10, TILT_MARBLE_BLUE, 0, 3);
  },
  // Ball Tracker: a marble in a carved channel (ballTrackArt btMarble).
  balltrack: (c) => {
    c.lineCap = "round";
    c.strokeStyle = "#9C6B3E";
    c.lineWidth = 30;
    c.beginPath();
    c.moveTo(-4, 44);
    c.quadraticCurveTo(28, 44, 40, 14);
    c.stroke();
    c.strokeStyle = "#5A3519";
    c.lineWidth = 20;
    c.stroke();
    btMarble(c, 26, 38, 13, BT_PALETTE[0], 2);
  },
  // Mixed Signals: the coloured gates the words fall into (colourClash paintGate).
  stroop: (c) =>
    scaled(c, 0, 0, 0.82, () => {
      c.translate(-10, 18);
      paintGate(c, CLASH_COLOURS[1], 34);
      c.translate(42, 0);
      paintGate(c, CLASH_COLOURS[0], 34);
    }),
  // Bonk: the gopher in its gold hard hat (whack paintGopher, paintHat).
  whack: (c) =>
    scaled(c, 3, 4, 0.58, () => {
      c.save();
      c.beginPath();
      c.arc(50, 50, 49, 0, Math.PI * 2);
      c.clip();
      paintGopher(c);
      paintHat(c, "#F5B82E");
      c.restore();
    }),
  // Tenfall: a cream number tile and a brass operator tile, faces blank (tenDrop tileSprite).
  tendrop: (c, k) => {
    const digit = tileSprite("", "digit", 76, 64, Math.max(1, Math.ceil(k)), true);
    const op = tileSprite("", "op", 76, 64, Math.max(1, Math.ceil(k)), true);
    if (op) c.drawImage(op as CanvasImageSource, 18, 4, 44, 37);
    if (digit) c.drawImage(digit as CanvasImageSource, 2, 24, 44, 37);
  },
  // Letterfall: two letter tiles, faces blank (wordfall drawTile).
  wordfall: (c) =>
    noText(c, () =>
      scaled(c, 0, 0, 0.62, () => {
        drawTile(c, 40, 6, 0, PICK_FACE, TILE_EDGE);
        drawTile(c, 10, 42, 0, TILE_FACE, TILE_EDGE);
      }),
    ),
  // Pull!: the orange clay in flight (clayShootArt drawClay).
  clayshoot: (c, k) =>
    scaled(c, 32, 32, 2, () => drawClay(c, 0, 0, false, 0, 0, Math.max(1, Math.ceil(k * 2)), true)),
};
