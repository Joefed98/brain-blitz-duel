/** Number games' tile scenes, built from each game's own components, CSS and renderer (scene.tsx has the rules). */
import { tileSprite } from "@/lib/arcade/tenDrop.renderer";
import { PolishStyle } from "@/components/puzzles/numberPolish";
import { BalanceArt, Beam } from "@/puzzles/balance";
import { Board as CheckoutBoard } from "@/puzzles/checkout";
import { OPERATOR_CSS, OperatorSlot } from "@/puzzles/equation";
import { Jugs, MEASURE_CSS } from "@/puzzles/measure";
import { Pyramid } from "@/puzzles/numberPyramid";
import { Line as TapeLine, Pin } from "@/puzzles/numline";
import { EXACT_CSS, EXACT_RINGS } from "@/puzzles/targetNumber";
import { Grid as TrailGrid } from "@/puzzles/trail";

import { Scaled, canvasScene, domScene, type SceneSet } from "./scene";

/** The standard dartboard order, as Checkout deals it on a plain board. */
const DART_WEDGES = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export const NUMBER_SCENES: SceneSet = {
  // Counterweight: the middle of the brass beam, level, a grey fixed kettlebell left and the gold one hung to match it.
  balance: domScene(() => (
    <>
      <style>{`[data-tile-balance] .bal-notch-label { visibility: hidden; }`}</style>
      <Scaled x={-50} y={12} scale={0.85} attrs={{ "data-tile-balance": "" }}>
        <BalanceArt />
        <Beam scale={{ fixed: [{ peg: 2, w: 3 }], tray: [3] }} placement={[5]} spacing={30} />
      </Scaled>
    </>
  )),

  // Trail: a 3 × 3 patch of mossy ground, the milestone 1 and the stepping stones 2–5 along the worn footpath.
  trail: domScene(() => (
    <Scaled x={2} y={2} scale={1}>
      <TrailGrid size={3} givens={[1, null, null, null, null, null, null, null, 9]} path={[0, 1, 2, 5, 4]} cell={30} gap={4} animate={false} />
    </Scaled>
  )),

  // Integer Pyramid: three rows of carved stone, the 5 just set in sand between 2 + 3.
  numpyramid: domScene(() => (
    <Scaled x={4} y={8} scale={1}>
      <Pyramid rows={3} givens={[12, null, 7, 2, 3, 4]} values={[12, 5, 7, 2, 3, 4]} cellW={30} cellH={26} gap={3} plinth animate={false} />
    </Scaled>
  )),

  // Operator: the equation strip with the gold × chip in its slot, and the gold target.
  equation: domScene(() => (
    <Scaled x={4} y={8} scale={1} attrs={{ "data-polish": "equation" }}>
      <PolishStyle id="equation" css={OPERATOR_CSS} />
      <div
        className="op-equation flex flex-col items-center justify-center gap-1 py-2 font-mono font-bold tabular-nums"
        style={{ width: 96, ["--fit-fs" as string]: "30px" }}
      >
        <span className="op-line">
          <span className="op-term">
            <span>3</span>
            <OperatorSlot value="×" />
          </span>
          <span className="op-term">
            <span>4</span>
          </span>
        </span>
        <span className="op-goal" style={{ fontSize: 26 }}>= 12</span>
      </div>
    </Scaled>
  )),

  // Brimful: the 5 and 3 glass jugs, the big one filled to its gold target line.
  measure: domScene(() => (
    <Scaled x={10} y={-19} scale={1} attrs={{ "data-polish": "measure" }}>
      <PolishStyle id="measure" css={MEASURE_CSS} />
      <Jugs board={{ caps: [5, 3], start: [0, 0], tap: true, goal: "amount", target: 4 }} amounts={[4, 2]} litre={15} width={36} celebrate="static" />
    </Scaled>
  )),

  // Ballpark: the steel tape from 0 to 1 and the gold pin pushed in near 3/8.
  numline: domScene(() => (
    <Scaled x={0} y={0} scale={1}>
      <p className="font-display font-bold text-foreground" style={{ position: "absolute", left: 0, width: 104, top: 10, textAlign: "center", fontSize: 30, lineHeight: 1 }}>
        3/8
      </p>
      <div style={{ position: "absolute", left: 0, top: 44 }}>
        <TapeLine stage={{ lo: 0, hi: 1 }} width={104} height={56} t={12} label={14} yShare={0.36}>
          {(x, _y, geom) => <Pin cx={x(0.38)} geom={geom} r={7} rise={14} fill={`url(#${geom.id}-pin)`} needle="var(--primary)" />}
        </TapeLine>
      </div>
    </Scaled>
  )),

  // Checkout: the top of the fairground dartboard, two darts in the treble 20 and one in the double.
  checkout: domScene(() => (
    <Scaled x={-88} y={-8} scale={1}>
      <CheckoutBoard
        stage={{ wedges: DART_WEDGES, quad: false }}
        darts={[
          { wedge: 0, ring: 3 },
          { wedge: 0, ring: 3 },
          { wedge: 0, ring: 2 },
        ]}
        size={280}
      />
    </Scaled>
  )),

  // Exact: the gold target over its faint bullseye, and three number tiles (the large 75, a picked 6).
  target: domScene(() => (
    <Scaled x={2} y={4} scale={0.6} attrs={{ "data-polish": "target" }}>
      <PolishStyle id="target" css={EXACT_CSS} />
      <div style={{ width: 166, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div className="exact-plaque">
          {EXACT_RINGS}
          <span className="exact-number" style={{ fontSize: 56 }}>462</span>
        </div>
        <div className="exact-tiles" style={{ width: 166 }}>
          <div className="exact-tile" data-large="true"><span className="exact-face">75</span></div>
          <div className="exact-tile" data-state="selected"><span className="exact-face">6</span></div>
          <div className="exact-tile"><span className="exact-face">2</span></div>
        </div>
      </div>
    </Scaled>
  )),

  // Tenfall: wooden tiles dropping down their lanes: a brass ×2, a cream 7 and a gold 3.
  tendrop: canvasScene((c, k) => {
    const w = 46;
    const h = 39;
    const tile = (label: string, look: "digit" | "op" | "gold", x: number, y: number) => {
      const s = tileSprite(label, look, w, h, k, true);
      if (s) c.drawImage(s as CanvasImageSource, x - 2, y - 2, w + 4, h + 4);
    };
    tile("×2", "op", 54, 8);
    tile("7", "digit", 4, 32);
    tile("3", "gold", 54, 58);
  }),
};
