/**
 * iron-wall-view-check (3 Nov 2026, the Action polish; docs/arcade-standard/bastion.md "The view"): Iron Wall's view
 * (src/lib/arcade/bastionView.ts, display and input mapping only) shows less sky and larger tanks, and the crosshair
 * still lands where it is drawn.
 *
 *  1. The view: the horizon 60 px higher (190), the wall line and everything below it unchanged, the far end's tanks at
 *     least 1.25× their world size, the near ones at 1×.
 *  2. The inverse is exact: world → view → world returns every y in the world and every x across it (to 1e-6 px).
 *  3. What is drawn is what is hit: for every tank kind and lane at depths from the far end to the wall, a tank is drawn as
 *     its collision rectangles under btViewTransform (exact at its centre, with the warp's scale and shear there); every view pixel the drawn hull or turret covers by more than 2 px
 *     maps (through the stage's inverse) inside that rectangle in the world, and every view pixel more than 2 px outside
 *     maps outside it.
 *  4. The stage sends the inverse of the crosshair's view point (btWorldX / btWorldY), the renderer draws the crosshair,
 *     the shells, the impacts and the tanks through the view, and the play screen has no standing hint line.
 *
 *   bun scripts/iron-wall-view-check.ts      # ~2 s
 */
import { readFileSync } from "node:fs";
import { bastionTankRects, BT2_FAR, BT2_HORIZON_Y, BT2_WALL_Y, BT2_WORLD_H, BT2_WORLD_W, type Bt2Rect } from "../src/lib/arcade/bastionTank";
import { BT_VIEW_HORIZON, btViewMatrix, btViewScale, btViewX, btViewY, btWorldX, btWorldY } from "../src/lib/arcade/bastionView";

const failures: string[] = [];
let passes = 0;
function ok(cond: unknown, message: string): void {
  if (cond) passes++;
  else if (failures.length < 60) failures.push(message);
}

/* 1. */
ok(BT_VIEW_HORIZON === BT2_HORIZON_Y - 60 && btViewY(BT2_HORIZON_Y) === BT_VIEW_HORIZON, "the view's horizon is 60 px higher");
ok([BT2_WALL_Y, 620, 660, BT2_WORLD_H].every((y) => btViewY(y) === y && btViewScale(y) === 1), "the wall line and everything below it are unchanged");
const far = bastionTankRects(2, 1, BT2_FAR * 256);
ok(btViewScale(far.ground) >= 1.25, `the far end's tanks are drawn at least 1.25× (${btViewScale(far.ground).toFixed(3)})`);
ok(Math.abs(btViewScale(bastionTankRects(2, 1, 0).ground) - 1) < 1e-9, "tanks at the wall are drawn at 1×");

/* 2. */
let worst = 0;
for (let y = 0; y <= BT2_WORLD_H; y += 0.5)
  for (let x = -40; x <= BT2_WORLD_W + 40; x += 13) {
    const vy = btViewY(y);
    const vx = btViewX(x, y);
    worst = Math.max(worst, Math.abs(btWorldY(vy) - y), Math.abs(btWorldX(vx, vy) - x));
  }
ok(worst < 1e-6, `the inverse is exact (worst ${worst.toExponential(2)} px)`);

/* 3. */
const inRect = (r: Bt2Rect, x: number, y: number) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
let pixels = 0;
let worstTank = "";
for (const kind of [0, 1, 2])
  for (const lane of [0, 1, 2])
    for (const z of [BT2_FAR, 1000, 700, 400, 200, 80, 0]) {
      const r = bastionTankRects(kind, lane, z * 256);
      // The tank's transform, as the renderer applies it (btViewTransform at its centre): x' = a·x + c·y + e, y' = d·y + f.
      const [a, , c, d, e, f] = btViewMatrix(r.cx, (r.turret[1] + r.ground) / 2);
      for (const part of [r.hull, r.turret]) {
        // The drawn parallelogram: a row at view y covers [a·x0 + c·y + e, a·x1 + c·y + e] for the world y it came from.
        const top = d * part[1] + f;
        const bottom = d * part[3] + f;
        const ext = [a * part[0] + c * part[1] + e, a * part[2] + c * part[3] + e];
        for (let vy = Math.floor(top) - 4; vy <= Math.ceil(bottom) + 4; vy++)
          for (let vx = Math.floor(Math.min(...ext)) - 8; vx <= Math.ceil(Math.max(...ext)) + 8; vx++) {
            const px = vx + 0.5;
            const py = vy + 0.5;
            const wy = (py - f) / d;
            const x0 = a * part[0] + c * wy + e;
            const x1 = a * part[2] + c * wy + e;
            const inside = px > x0 + 2 && px < x1 - 2 && py > top + 2 && py < bottom - 2;
            const outside = px < x0 - 2 || px > x1 + 2 || py < top - 2 || py > bottom + 2;
            if (!inside && !outside) continue;
            pixels++;
            const hit = inRect(part, btWorldX(px, py), btWorldY(py));
            if (inside !== hit && !worstTank) worstTank = `kind ${kind} lane ${lane} z ${z}: view (${px}, ${py}) ${inside ? "inside" : "outside"} the drawn shape maps ${hit ? "inside" : "outside"}`;
          }
      }
    }
ok(!worstTank, `every drawn tank pixel more than 2 px from its edge maps to the matching side of its rectangle (${pixels} pixels): ${worstTank}`);

/* 4. */
const stage = readFileSync("src/puzzles/bastion.tsx", "utf8");
ok(/btWorldX\(aim\.current\.x, aim\.current\.y\)/.test(stage) && /btWorldY\(aim\.current\.y\)/.test(stage) && /k: BT2_INPUT_AIM, \.\.\.worldAim\(\)/.test(stage), "the stage sends the crosshair's world point (the view's exact inverse)");
const art = readFileSync("src/lib/arcade/bastionTank.renderer.ts", "utf8");
ok(/btViewTransform\(ctx, tr\.cx, \(tr\.turret\[1\] \+ tr\.ground\) \/ 2\)/.test(art) && /const x = btViewX\(state\.aimX, state\.aimY\);/.test(art) && /btViewTransform\(ctx, m\.x, m\.y\)/.test(art) && /btViewX\(sh\.x, sh\.y\)/.test(art), "the renderer draws tanks, impacts, shells and the crosshair through the view");
ok(!/Drag to aim/.test(art) && /let hint = "";/.test(art), "no standing hint line on the play screen");

console.log(
  failures.length === 0
    ? `PASS iron-wall-view-check: ${passes} checks`
    : `FAIL iron-wall-view-check: ${failures.length} of ${passes + failures.length} checks failed\n${failures.map((f) => `  ✗ ${f}`).join("\n")}`,
);
process.exit(failures.length ? 1 : 0);
