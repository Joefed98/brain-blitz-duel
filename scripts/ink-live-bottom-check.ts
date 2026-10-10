/**
 * Rainbow Bridge live rounds: a live stroke drawn anywhere (outside the coin's no-draw
 * ring), including the bottom 20% of the arena, commits as a solid line the coin hits.
 * Drives the real client queue (InkInputQueue) with finger samples at 60 Hz on two phone
 * arenas, into the real rev-3 sim. Also shows the old drain (every 12 px sample queued)
 * failing low in the arena, which is the phone bug.
 */
import assert from "node:assert/strict";
import { inkBridgeInkRev3Game as game, inkIsLive, INK_INPUT_RELEASE, INK_INPUT_STROKE, INK_REV3, INK_WORLD_H, INK_WORLD_W, inkBudgetFor, type InkState } from "../src/lib/arcade/inkBridge";
import { InkInputQueue } from "../src/lib/arcade/inkInputQueue";

const FP = 256;
/** Arena pixel boxes of the two phones (play area below header, above the controls). */
const PHONES = [{ name: "360×640", w: 352, h: 420 }, { name: "390×844", w: 382, h: 600 }];
const HEIGHTS = [0.3, 0.5, 0.65, 0.8, 0.88, 0.95]; // fraction of arena height; 0.8+ is the bottom 20%
const FINGER_PX_PER_S = 900;

function toLevel(seed: number, level: number): InkState {
  let s = game.init(seed) as InkState;
  // Jump straight to the live level (test only): fresh level state, same plan.
  // Birds are stripped so the coin's fall is clean: this proves drawing/commit at every
  // height, independent of where a layout's obstacles sit; the pot is moved below the arena so
  // the coin meets the drawn line first.
  const list = s.list.map((lvl, i) => (i === level ? { ...lvl, blocks: [], bucketY: INK_WORLD_H + 200 } : lvl));
  s = { ...s, list, ink: inkBudgetFor(level, INK_REV3) * FP, level, ball: { ...s.ball, x: s.list[level]!.spoutX * FP, y: 50 * FP, vx: 0, vy: 0, on: -1 }, segs: [], strokeStarts: [], draftSegs: [], draftStrokeStarts: [], liveLifts: 0, preInkUsed: 0 };
  return s;
}

type Mode = "new" | "old";
function trial(seed: number, level: number, frac: number, phone: (typeof PHONES)[number], mode: Mode) {
  let s = toLevel(seed, level);
  const q = new InkInputQueue();
  const lineY = Math.round(frac * INK_WORLD_H);
  const step = (ev: { k: number; a: number; b: number; c: number } | null) => {
    s = game.step(s, ev ? { t: s.tick + 1, ...ev, d: 0 } : null) as InkState;
  };
  step({ k: INK_INPUT_RELEASE, a: 1, b: 0, c: 0 });
  const bx = s.ball.x / FP;
  const x0 = Math.max(4, Math.round(bx - 90)), x1 = Math.min(INK_WORLD_W - 4, Math.round(bx + 90));
  const pxToWorldX = INK_WORLD_W / phone.w, pxToWorldY = INK_WORLD_H / phone.h;
  // Finger samples every frame (16.7 ms), moving at FINGER_PX_PER_S screen px.
  const perTick = (FINGER_PX_PER_S / 60) * pxToWorldX;
  const samples: { kind: "down" | "move" | "up"; x: number; y: number }[] = [];
  const tilt = 12 * pxToWorldY / pxToWorldX; // slight downhill so the coin rolls along
  for (let x = x0, i = 0; ; x += perTick, i++) {
    const cx = Math.min(x1, Math.round(x));
    samples.push({ kind: i === 0 ? "down" : cx >= x1 ? "up" : "move", x: cx, y: Math.round(lineY + ((cx - x0) / (x1 - x0)) * tilt) });
    if (cx >= x1) break;
  }
  // A player draws ahead of the coin: start when the coin would reach the line just
  // 8 ticks after the finger lifts (the latest sensible moment), never inside its ring.
  const g = 54 / 256;
  const reach = () => {
    const y = s.ball.y / FP, vy = s.ball.vy / FP, d = lineY - y;
    return (-vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, d))) / g;
  };
  while (s.dropping && reach() > samples.length + 8) step(null);
  if (!s.dropping || lineY - s.ball.y / FP < 30) return { committed: false, caught: false, skipped: true };
  const segsBefore = s.segs.length;
  let committedAt = -1;
  for (let t = 0; s.dropping && t < 400; t++) {
    const live = s.dropping === 1 && inkIsLive(s.level, INK_REV3);
    const sample = samples[t];
    if (sample) {
      const now = q.pointer(sample.kind, sample.x, sample.y, live);
      void now;
    }
    const ev = mode === "new" ? q.next(live) : (q.pending.shift() ?? null);
    const levelBefore = s.level;
    step(ev);
    if (s.level !== levelBefore) break;
    if (committedAt < 0 && s.segs.length > segsBefore) committedAt = t;
    if (committedAt >= 0 && s.ball.on >= segsBefore) return { committed: true, caught: true, skipped: false };
  }
  if (process.env.INKDBG) console.log({ lineY, committedAt, ballY: s.ball.y / FP, ballX: s.ball.x / FP, on: s.ball.on, segs: s.segs.length, segsBefore, level: s.level, fails: s.fails, x0, x1, dropping: s.dropping, seg0: s.segs[segsBefore] });
  return { committed: committedAt >= 0, caught: false, skipped: false };
}

let pass = 0, oldFails = 0, total = 0, bottom = 0;
for (const phone of PHONES) {
  for (let seed = 1; seed <= 20; seed++) {
    for (const level of [8, 9]) {
      for (const frac of HEIGHTS) {
        const r = trial(seed, level, frac, phone, "new");
        if (r.skipped) continue;
        total++;
        if (frac >= 0.8) bottom++;
        assert(r.committed, `${phone.name} seed ${seed} level ${level + 1} y ${frac}: live stroke did not commit`);
        assert(r.caught, `${phone.name} seed ${seed} level ${level + 1} y ${frac}: coin did not land on the committed line`);
        pass++;
        if (!trial(seed, level, frac, phone, "old").caught) oldFails++;
      }
    }
  }
}
// Several strokes in one drop, each lower than the last (the phone pattern): side strokes at
// 30/45/60/75% height away from the coin, then a catch stroke in the bottom 20%. Every one
// must commit; the old two-stroke cap left the third onwards as dashed drafts.
let multi = 0;
for (const phone of PHONES) {
  for (let seed = 1; seed <= 20; seed++) {
    for (const level of [8, 9]) {
      let s = toLevel(seed, level);
      const q = new InkInputQueue();
      const step = (ev: { k: number; a: number; b: number; c: number } | null) => { s = game.step(s, ev ? { t: s.tick + 1, ...ev, d: 0 } : null) as InkState; };
      step({ k: INK_INPUT_RELEASE, a: 1, b: 0, c: 0 });
      const bx = s.ball.x / FP;
      const side = bx < INK_WORLD_W / 2 ? INK_WORLD_W - 120 : 20;
      const strokes = [0.3, 0.45, 0.6, 0.75].map(f => ({ x0: side, x1: side + 100, y: Math.round(f * INK_WORLD_H) }));
      const catchY = Math.round(0.9 * INK_WORLD_H);
      strokes.push({ x0: Math.max(4, Math.round(bx - 70)), x1: Math.min(INK_WORLD_W - 4, Math.round(bx + 70)), y: catchY });
      const scale = INK_WORLD_W / phone.w, per = Math.round((FINGER_PX_PER_S / 60) * scale);
      const samples: { kind: "down" | "move" | "up"; x: number; y: number }[] = [];
      for (const st of strokes) {
        for (let x = st.x0, i = 0; ; x += per, i++) {
          const cx = Math.min(st.x1, x);
          samples.push({ kind: i === 0 ? "down" : cx >= st.x1 ? "up" : "move", x: cx, y: st.y + Math.round((cx - st.x0) / 10) });
          if (cx >= st.x1) break;
        }
        samples.push({ kind: "move", x: -1, y: -1 }); // finger travelling between strokes (no sample)
      }
      let caught = false;
      for (let t = 0; s.dropping && t < 500; t++) {
        const live = s.dropping === 1;
        const sm = samples[t];
        if (sm && sm.x >= 0) q.pointer(sm.kind, sm.x, sm.y, live);
        step(q.next(live));
        if (s.ball.on >= 0) { caught = true; break; }
      }
      assert(caught, `${phone.name} seed ${seed} level ${level + 1}: catch stroke in the bottom 20% did not hold the coin`);
      assert.equal(s.liveLifts, 5, `${phone.name} seed ${seed} level ${level + 1}: all five live strokes commit (got ${s.liveLifts})`);
      assert.equal(s.draftSegs.length, 0, "no stroke left as a dashed draft");
      multi++;
    }
  }
}
console.log(`multi-stroke PASS: ${multi} drops, five live strokes each (third, fourth and fifth would have been dropped by the old cap), bottom-20% catch held every coin`);
console.log(`ink-live-bottom-check: PASS ${pass}/${total} live strokes committed and caught the coin (${bottom} in the bottom 20%) on ${PHONES.map(p => p.name).join(" and ")}; old one-sample-per-tick drain missed ${oldFails}/${total}`);
