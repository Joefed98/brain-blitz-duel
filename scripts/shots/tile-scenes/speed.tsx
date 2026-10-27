/** Speed games' tile scenes (scene.ts has the rules). */
import type { ClayState } from "@/lib/arcade/clayShoot";
import { drawClay, drawShatter } from "@/lib/arcade/clayShootArt.renderer";
import { WHACK_COLS, WHACK_GAP_PX } from "@/lib/arcade/whack";
import { drawTarget, paintMeadow } from "@/lib/arcade/whack.renderer";
import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { ChainDefs, ChainLine, NodeGlyph } from "@/puzzles/chainTap";
import { Circle as AscendDisc } from "@/puzzles/numberHunt";

import { Scaled, at, canvasScene, domScene, type SceneSet } from "./scene";

/** The live round's polish hooks (the in-play look of every speed board). */
const PLAY = { "data-puzzle-play": "", "data-category": "speed" };

/* Bonk: its board geometry (4 columns, 8 px gaps), sized so a burrow cell is CELL px. */
const BONK_CELL = 44;
const BONK_W = BONK_CELL * WHACK_COLS + WHACK_GAP_PX * (WHACK_COLS - 1);

function bonkHole(h: number): { cx: number; cy: number } {
  const col = h % WHACK_COLS, row = Math.floor(h / WHACK_COLS);
  return { cx: col * (BONK_CELL + WHACK_GAP_PX) + BONK_CELL / 2, cy: row * (BONK_CELL + WHACK_GAP_PX) + BONK_CELL / 2 };
}

/** A target up in its burrow, as drawBonk draws one: the warm light behind it, clipped to the hole. */
function bonkUp(c: CanvasRenderingContext2D, h: number, kind: number): void {
  const { cx, cy } = bonkHole(h);
  c.save();
  c.beginPath();
  c.ellipse(cx, cy, BONK_CELL * 0.47, BONK_CELL * 0.45, 0, 0, Math.PI * 2);
  c.clip();
  const glow = c.createRadialGradient(cx, cy + BONK_CELL * 0.08, 0, cx, cy + BONK_CELL * 0.08, BONK_CELL * 0.47);
  glow.addColorStop(0, "rgba(255,226,160,0.62)");
  glow.addColorStop(1, "rgba(255,226,160,0)");
  c.fillStyle = glow;
  c.fillRect(cx - BONK_CELL / 2, cy - BONK_CELL / 2, BONK_CELL, BONK_CELL);
  drawTarget(c, cx, cy, BONK_CELL * 0.3, kind);
  c.restore();
}

/** Pull!: a hand-made state with one clay (the fields drawShatter reads). */
function clayAt(x: number, y: number, gold: boolean, vx: number): ClayState {
  return { x: [x * 256], y: [y * 256], schedule: { kind: [gold ? 1 : 0], vx: [vx * 256] } } as unknown as ClayState;
}

export const SPEED_SCENES: SceneSet = {
  // Bonk: four of its burrows; a gold-hatted gopher up and ringed by the hit, a hedgehog and a red hat up beside it.
  whack: canvasScene((c) => {
    at(c, 3, 3, 98 / 96, () => {
      c.save();
      c.beginPath();
      for (const h of [0, 1, 4, 5]) {
        const { cx, cy } = bonkHole(h);
        c.moveTo(cx + BONK_CELL * 0.5, cy);
        c.ellipse(cx, cy, BONK_CELL * 0.5, BONK_CELL * 0.5, 0, 0, Math.PI * 2);
      }
      c.clip();
      paintMeadow(c, BONK_W, BONK_W);
      c.restore();
      bonkUp(c, 0, 0);
      bonkUp(c, 5, 2);
      bonkUp(c, 1, 1);
      // The hit's gold ring over the gold gopher (drawBonk's hit ring, a few ticks in).
      const { cx, cy } = bonkHole(0);
      c.strokeStyle = "#F5B82E";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(cx, cy, BONK_CELL * 0.3 * 1.5, 0, Math.PI * 2);
      c.stroke();
    });
  }),

  // Pull!: an orange clay shattering, a gold clay still in flight.
  clayshoot: canvasScene((c, k) => {
    at(c, 0, 0, 2.2, () => {
      drawShatter(c, clayAt(17, 17, false, 1), 0, 6, true);
      drawClay(c, 31, 33, true, 1, 0, Math.max(1, Math.ceil(k * 2.2)), true);
    });
  }),

  // Bang On: the watch face, its lit gold zone and dead-centre line, the marker stopped right beside the line.
  stopwatch: domScene(() => (
    <Scaled x={8} y={22} scale={0.5} attrs={PLAY}>
      <div data-polish="stopwatch" style={{ width: 176 }}>
        <div data-bangon-face="" className="bangon-face relative overflow-hidden rounded-2xl border border-border bg-card" style={{ height: 120 }}>
          <span aria-hidden="true" className="bangon-ticks" />
          <span className="bangon-target absolute inset-y-0 bg-primary/45" style={{ left: "40%", width: "26%" }}>
            <span data-bangon-centre="" className="bangon-dead-centre absolute inset-y-2 left-1/2 w-[3px] -translate-x-1/2 rounded-full" style={{ width: 6 }} />
          </span>
          <span className="bangon-marker absolute inset-y-0 rounded-full bg-foreground" style={{ width: 10, left: "60%", transform: "translateX(-50%)" }} />
          <span aria-hidden="true" className="bangon-crystal" />
        </div>
      </div>
    </Scaled>
  )),

  // Don't Break the Chain: three enamel charms joined by the gold chain, a fourth waiting.
  chain: domScene(() => {
    const nodes = [
      { x: 20, y: 72, shape: "circle", colour: "RED" },
      { x: 46, y: 28, shape: "square", colour: "BLUE" },
      { x: 76, y: 66, shape: "triangle", colour: "GREEN" },
    ] as const;
    return (
      <Scaled x={0} y={0} scale={1} attrs={PLAY}>
        <div data-polish="chain" style={{ position: "relative", width: 104, height: 104 }}>
          <ChainDefs />
          <ChainLine nodes={nodes as never} path={[0, 1, 2]} broken={false} />
          {nodes.map((n, i) => (
            <span key={i} className="absolute flex items-center justify-center" style={{ left: `calc(${n.x}% - 22px)`, top: `calc(${n.y}% - 22px)`, width: 44, height: 44 }}>
              <NodeGlyph shape={n.shape} colour={GLYPH_COLOURS[n.colour]} size={40} />
            </span>
          ))}
        </div>
      </Scaled>
    );
  }),

  // Ascend: three of its discs climbing the felt, 1 and 2 tapped gold, 3 next.
  numhunt: domScene(() => (
    <Scaled x={0} y={0} scale={1} attrs={PLAY}>
      <div data-polish="numhunt" style={{ position: "relative", width: 104, height: 104 }}>
        <span aria-hidden="true" />
        {[
          { x: 25, y: 76, n: 1, done: true },
          { x: 50, y: 48, n: 2, done: true },
          { x: 77, y: 25, n: 3, done: false },
        ].map((d) => (
          <span key={d.n} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${d.x}%`, top: `${d.y}%` }}>
            <AscendDisc n={d.n} done={d.done} size={38} />
          </span>
        ))}
      </div>
    </Scaled>
  )),

  // Flash: a red decoy screen behind, the gold flash in front with the tap's ring.
  reaction: domScene(() => (
    <Scaled x={0} y={0} scale={1} attrs={PLAY}>
      <div data-polish="reaction" style={{ position: "relative", width: 104, height: 104 }}>
        <div data-flash-cue="decoy" className="flash-arena bg-destructive absolute overflow-hidden rounded-2xl border border-border" style={{ left: 8, top: 8, width: 56, height: 56 }}>
          <span aria-hidden="true" className="flash-art" />
        </div>
        <div data-flash-cue="gold" className="flash-arena bg-primary absolute flex items-center justify-center overflow-hidden rounded-2xl border border-border" style={{ left: 28, top: 28, width: 68, height: 68, boxShadow: "0 4px 12px rgba(0,0,0,.6)" }}>
          <span aria-hidden="true" className="flash-art" />
          {/* The tap ripple (styles.css .reaction-tap-ripple) caught part-way, drawn still. */}
          <span aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", width: 24, height: 24, border: "2px solid var(--foreground)", borderRadius: "50%", opacity: 0.85, transform: "translate(-50%, -50%) scale(1.6)" }} />
        </div>
      </div>
    </Scaled>
  )),
};
