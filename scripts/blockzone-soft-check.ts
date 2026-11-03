/**
 * blockzone-soft-check (3 Nov 2026): Blockzone's soft drop ends when the finger lifts, and every new piece starts at
 * its normal speed (Joe's phone note: after a soft drop the following pieces kept falling very fast).
 *
 * The cause, shown first: a drag down that ended in a flick sent only the hard drop on release, never the soft drop's
 * "off", and blockfallRev 2's sim keeps `soft` until an input clears it, so every later piece fell at the soft-drop
 * speed. The fix is input mapping only (src/lib/arcade/blockfallSoftDrop.ts, no stamp, the sim untouched): this check
 * plays the phone's bookkeeping through the real sim (blockzoneGame), with the stage's discrete queue as
 * ArcadeCanvasStage runs it (discreteTick first, then one queued input a tick), for:
 *   1. a drag down ending in a flick (the bug), 2. a flick released before its "on" reached the sim,
 *   3. a slow drag released, 4. a drag held down across a lock, 5. ↓ held across a lock, 6. a drag turned back up.
 * After each, the sim's soft drop is off within two ticks of the lift (or lock) and the next piece takes exactly its
 * level's gravity to fall a row.
 */
import { BF_INPUT_DROP, BF_ZONE_GRAVITY, bfLevelFor, BLOCKFALL_REV_ZONE, blockzoneGame, bzInit, type BfState } from "../src/lib/arcade/blockfall";
import { createSoftDrop, type SoftPayload } from "../src/lib/arcade/blockfallSoftDrop";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

class Stage {
  state: BfState;
  queue: SoftPayload[] = [];
  soft = createSoftDrop();
  constructor(seed: number) {
    this.state = bzInit(seed);
  }
  push(p: SoftPayload | null) {
    if (p && this.queue.length < 4) this.queue.push(p);
  }
  /** One sim tick, as ArcadeCanvasStage's discrete loop runs it. */
  tick(fixed = true) {
    if (fixed) this.push(this.soft.tick(this.state));
    const next = this.queue.shift() ?? null;
    const input = next ? { t: this.state.tick + 1, k: next.k, a: next.a, b: next.b, c: next.c, d: 0 } : null;
    this.state = blockzoneGame.step(this.state, input);
  }
  run(n: number, fixed = true) {
    for (let i = 0; i < n && !this.state.ended; i++) this.tick(fixed);
  }
  /** Ticks from a fresh piece's spawn until it first moves down a row (its gravity), soft drop off. */
  nextPieceFallTicks(fixed = true): number {
    const pieces = this.state.pieces;
    let guard = 0;
    while (this.state.pieces === pieces && guard++ < 4000) this.tick(fixed);
    const y0 = this.state.piece.y;
    let n = 0;
    while (this.state.piece.y === y0 && n < 400) {
      this.tick(fixed);
      n++;
    }
    return n;
  }
}

const gravityNow = (s: BfState) => BF_ZONE_GRAVITY[bfLevelFor(s.tick, BLOCKFALL_REV_ZONE)]!;
const DROP: SoftPayload = { k: BF_INPUT_DROP, a: 0, b: 0, c: 0 };

for (const seed of [1, 7, 42, 1234, 99991]) {
  // 0. The cause: the old mapping (no "off" after a flick) leaves the soft drop on for the next pieces.
  {
    const s = new Stage(seed);
    s.run(5);
    s.push({ k: 6, a: 1, b: 0, c: 0 });
    s.run(10, false);
    s.push(DROP);
    const n = s.nextPieceFallTicks(false);
    check(s.state.soft === 1 && n <= 2, `seed ${seed}: the old mapping reproduces the bug (soft ${s.state.soft}, next piece fell a row in ${n} ticks)`);
  }
  // 1. Drag down, then a flick: the release sends the drop; the "off" follows.
  {
    const s = new Stage(seed);
    s.run(5);
    s.push(s.soft.on("drag"));
    s.run(10);
    s.soft.lifted();
    s.push(DROP);
    s.run(2);
    check(s.state.soft === 0, `seed ${seed}: flick: soft drop off two ticks after the lift (${s.state.soft})`);
    const n = s.nextPieceFallTicks();
    check(n === gravityNow(s.state) || n === gravityNow(s.state) - 1, `seed ${seed}: flick: the next piece falls a row in ${n} ticks, its gravity ${gravityNow(s.state)}`);
  }
  // 2. A flick so quick its release comes before the "on" reaches the sim.
  {
    const s = new Stage(seed);
    s.run(5);
    s.push(s.soft.on("drag"));
    s.soft.lifted();
    s.push(DROP);
    s.run(4);
    check(s.state.soft === 0, `seed ${seed}: instant flick: soft drop off (${s.state.soft})`);
    const n = s.nextPieceFallTicks();
    check(n >= gravityNow(s.state) - 1, `seed ${seed}: instant flick: next piece at its gravity (${n})`);
  }
  // 3. A slow drag released: the release itself sends the "off".
  {
    const s = new Stage(seed);
    s.run(5);
    s.push(s.soft.on("drag"));
    s.run(8);
    s.soft.lifted();
    s.push(s.soft.off());
    s.run(2);
    check(s.state.soft === 0, `seed ${seed}: slow release: soft drop off (${s.state.soft})`);
  }
  // 4. A drag held down across a lock: the new piece starts at its normal speed.
  for (const by of ["drag", "key"] as const) {
    const s = new Stage(seed);
    s.run(5);
    s.push(s.soft.on(by));
    const pieces = s.state.pieces;
    let guard = 0;
    while (s.state.pieces === pieces && guard++ < 2000) s.tick();
    check(s.state.pieces === pieces + 1, `seed ${seed}: ${by} held: the piece locked`);
    s.run(2);
    check(s.state.soft === 0, `seed ${seed}: ${by} held across a lock: the new piece's soft drop is off (${s.state.soft})`);
    const y0 = s.state.piece.y;
    let n = 2;
    while (s.state.piece.y === y0 && n < 400) {
      s.tick();
      n++;
    }
    check(n >= gravityNow(s.state) - 1, `seed ${seed}: ${by} held across a lock: the new piece falls a row in ${n} ticks (gravity ${gravityNow(s.state)})`);
    // Letting go afterwards sends nothing more.
    check(s.soft.off() === null, `seed ${seed}: ${by}: no second "off" after the lock's`);
  }
  // 6. A drag turned back up: the move sends the "off".
  {
    const s = new Stage(seed);
    s.run(5);
    s.push(s.soft.on("drag"));
    s.run(6);
    s.push(s.soft.off());
    s.run(2);
    check(s.state.soft === 0, `seed ${seed}: turned back: soft drop off (${s.state.soft})`);
  }
}

// The phone uses it: the stage's discreteTick, the release and the keys go through createSoftDrop.
{
  const { readFileSync } = await import("node:fs");
  const stage = readFileSync("src/puzzles/blockfall.tsx", "utf8");
  check(/createSoftDrop\(\)/.test(stage) && /discreteTick=\{discreteTick\}/.test(stage) && /soft\.lifted\(\)/.test(stage) && /softOn\("key"\)/.test(stage), "the Blockzone stage uses createSoftDrop for drags, releases, keys and every tick");
  const canvas = readFileSync("src/components/puzzles/ArcadeCanvasStage.tsx", "utf8");
  check(/const extra = propsRef\.current\.discreteTick\?\.\(state\.current\);\s*if \(extra && queue\.current\.length < 4\) queue\.current\.push\(extra\);\s*const next = queue\.current\.shift\(\);/.test(canvas), "ArcadeCanvasStage calls discreteTick before reading the queue");
}

if (failures.length) {
  for (const f of failures.slice(0, 30)) console.log(`FAIL ${f}`);
  console.log(`FAIL blockzone-soft-check: ${failures.length} of ${passes + failures.length} failed`);
  process.exit(1);
}
console.log(`PASS blockzone-soft-check: ${passes} checks (the old mapping's bug reproduced; the soft drop ends on lift and on lock, every new piece at its gravity)`);
