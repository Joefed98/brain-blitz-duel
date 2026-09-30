import { inkBridgeGame, INK_INPUT_RELEASE, INK_INPUT_STROKE } from "@/lib/arcade/inkBridge";
import { burstGame } from "@/lib/arcade/burst";
import { juncApproachAt, junctionGame } from "@/lib/arcade/junction";
let withLines = 0, released = 0;
for (let run = 0; run < 200; run++) {
  let s = inkBridgeGame.init(run * 31 + 5); let maxSegs = 0; let r = run * 977 + 1;
  const rnd = (n: number) => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return r % n; };
  for (let t = 1; t <= 1200 && !inkBridgeGame.isOver(s); t++) {
    const roll = rnd(100);
    const ev = roll < 4 ? { t, k: INK_INPUT_STROKE, a: rnd(390), b: rnd(620), c: 1, d: 0 } : roll < 40 ? { t, k: INK_INPUT_STROKE, a: rnd(390), b: rnd(620), c: 0, d: 0 } : roll < 41 ? { t, k: INK_INPUT_RELEASE, a: rnd(256), b: 0, c: 0, d: 0 } : null;
    s = inkBridgeGame.step(s, ev); maxSegs = Math.max(maxSegs, s.segs.length);
    if (ev?.k === INK_INPUT_RELEASE && s.dropping) released++;
  }
  if (maxSegs > 0) withLines++;
}
console.log(`ink: random strokes made lines in ${withLines}/200 runs; ${released} releases dropped the ball`);
const b = burstGame.init(3); console.log("burst wave1:", JSON.stringify(b.waves[0]), "wave2:", JSON.stringify(b.waves[1]), "runTicks", burstGame.runTicks);
console.log("junction corners BR/TR/TL/BL:", juncApproachAt(300, 500), juncApproachAt(300, 100), juncApproachAt(50, 100), juncApproachAt(50, 500), "road:", juncApproachAt(195, 100));
console.log("junction score 30 cars, 2 gave up, survived:", junctionGame.score({ ...junctionGame.init(1), cleared: 30, gaveUp: 2, ended: 1 }));
