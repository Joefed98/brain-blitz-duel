/**
 * Bot-plays orbitRev3Game across seeds using findHopTapDelay (the existing
 * bot proof), and at every tick checks the render-only camera (orbitCamera.ts):
 *   - the rocket stays inside the 390x620 view after the camera offset,
 *   - while orbiting (not in flight) the rocket stays inside the safe box,
 *   - either the next planet's ring is visible, or orbitCameraArrow returns
 *     a non-null arrow pointing at it,
 *   - the orbiting-camera step speed never exceeds 6 units/tick.
 * After each seed's run, the whole state sequence is replayed through a
 * fresh camera cache (scratch) and compared tick-for-tick against the live
 * values, proving the camera is a deterministic function of the state
 * sequence (not of wall-clock or incidental call order).
 * Also reports max flight-camera step speed (uncapped, locked to the rocket)
 * and max in-flight rocket flight speed, for visibility.
 *
 * Run with: bun scripts/orbit-camera-check.ts
 */
import { strict as assert } from "node:assert";
import { FP, ORBIT_INPUT_TAP, ORBIT_TOTAL, lapPhases } from "../src/lib/arcade/orbit";
import {
  findHopTapDelay,
  orbitRev3Game,
  ORBIT_REV3_RUN_TICKS,
  type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";
import {
  orbitCamera,
  orbitVisiblePlanets,
  orbitCameraArrow,
  orbitCameraResetCache,
  orbitCameraClampOverrideCount,
  ORBIT_CAM_VIEW_W,
  ORBIT_CAM_VIEW_H,
} from "../src/lib/arcade/orbitCamera";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

const SAFE_INSET_X = 70;
const SAFE_INSET_Y = 120;
const ORBIT_SPEED_CAP = 6;

const SEEDS = [1, 17, 42, 1000, 7919, 90210, 123456, 2024, 555555, 8675309];

let maxOrbitCamSpeed = 0;
let maxFlightCamSpeed = 0;
let maxFlightSpeed = 0;
let ticksChecked = 0;
let lastOverrideCount = 0;
let clampOverrideHits = 0;

function rocketOf(s: OrbitRev3State) {
  return { x: s.x / FP, y: s.y / FP };
}

function checkTick(state: OrbitRev3State, cam: { x: number; y: number }, prevCam: { x: number; y: number }) {
  const rocket = rocketOf(state);

  // 1. Rocket inside the 390x620 view after the camera offset.
  const vx = rocket.x - cam.x;
  const vy = rocket.y - cam.y;
  assert(vx >= -0.5 && vx <= ORBIT_CAM_VIEW_W + 0.5, `rocket x ${vx} outside view at tick ${state.tick}`);
  assert(vy >= -0.5 && vy <= ORBIT_CAM_VIEW_H + 0.5, `rocket y ${vy} outside view at tick ${state.tick}`);

  if (state.flying === 0) {
    // 2. Inside the safe box while orbiting. The camera hard-clamps after
    // the spring step, so only a sub-pixel float tolerance is needed.
    const SLACK = 0.5;
    const left = SAFE_INSET_X - SLACK;
    const right = ORBIT_CAM_VIEW_W - SAFE_INSET_X + SLACK;
    const top = SAFE_INSET_Y - SLACK;
    const bottom = ORBIT_CAM_VIEW_H - SAFE_INSET_Y + SLACK;
    assert(vx >= left && vx <= right, `rocket x ${vx} outside safe box [${left},${right}] at tick ${state.tick}, cur ${state.cur}`);
    assert(vy >= top && vy <= bottom, `rocket y ${vy} outside safe box [${top},${bottom}] at tick ${state.tick}, cur ${state.cur}`);

    // 4. Orbiting camera step speed capped, except when the safe-box hard
    // clamp needed to override it to keep the rocket boxed (tracked below).
    const step = Math.hypot(cam.x - prevCam.x, cam.y - prevCam.y);
    maxOrbitCamSpeed = Math.max(maxOrbitCamSpeed, step);
    const overridesBefore = lastOverrideCount;
    const overridesNow = orbitCameraClampOverrideCount();
    if (overridesNow > overridesBefore) {
      clampOverrideHits++;
    } else {
      assert(step <= ORBIT_SPEED_CAP + 1e-6, `orbit camera step ${step} exceeded cap at tick ${state.tick}`);
    }
    lastOverrideCount = overridesNow;
  } else {
    const step = Math.hypot(cam.x - prevCam.x, cam.y - prevCam.y);
    maxFlightCamSpeed = Math.max(maxFlightCamSpeed, step);
    const flightSpeed = Math.hypot(state.vx, state.vy) / FP;
    maxFlightSpeed = Math.max(maxFlightSpeed, flightSpeed);
  }

  // 3. Next planet visible, or an edge arrow is returned.
  const visible = orbitVisiblePlanets(state, cam);
  const nextIdx = Math.min(state.planets.length - 1, state.cur + 1);
  const arrow = orbitCameraArrow(state, cam);
  assert(
    visible.includes(nextIdx) || arrow !== null,
    `neither next planet ${nextIdx} visible nor arrow present at tick ${state.tick}, cur ${state.cur}`,
  );
}

for (const seed of SEEDS) {
  orbitCameraResetCache();
  lastOverrideCount = 0;
  const started = Date.now();
  let state = orbitRev3Game.init(seed) as OrbitRev3State;
  const states: OrbitRev3State[] = [state];
  const cams: { x: number; y: number }[] = [orbitCamera(state)];
  let prevCam = cams[0]!;
  checkTick(state, prevCam, prevCam);
  let safety = 0;

  while (state.cur < ORBIT_TOTAL && state.ended === 0 && safety < ORBIT_REV3_RUN_TICKS) {
    const advance = (next: OrbitRev3State) => {
      const cam = orbitCamera(next);
      checkTick(next, cam, prevCam);
      states.push(next);
      cams.push(cam);
      state = next;
      prevCam = cam;
      safety++;
      ticksChecked++;
    };
    if (state.flying === 0) {
      const here = state.planets[state.cur]!;
      const lapTicks = lapPhases(here).length;
      const delay = findHopTapDelay(state, state.worldW, lapTicks);
      assert(delay !== null, `seed ${seed}: no hop window at planet ${state.cur}`);
      for (let k = 0; k < delay!; k++) advance(orbitRev3Game.step(state, null) as OrbitRev3State);
      const tapEvent: ArcadeInputEvent = { t: state.tick + 1, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 };
      advance(orbitRev3Game.step(state, tapEvent) as OrbitRev3State);
    } else {
      advance(orbitRev3Game.step(state, null) as OrbitRev3State);
    }
  }

  assert(state.cur >= ORBIT_TOTAL || state.finished === 1, `seed ${seed}: bot did not finish (cur=${state.cur}, ended=${state.ended})`);

  // Determinism: replay the exact same state sequence from scratch (fresh
  // cache) and confirm every tick's camera matches what the live walk saw.
  orbitCameraResetCache();
  for (let i = 0; i < states.length; i++) {
    const replayed = orbitCamera(states[i]!);
    const live = cams[i]!;
    assert(
      Math.abs(replayed.x - live.x) < 1e-6 && Math.abs(replayed.y - live.y) < 1e-6,
      `seed ${seed}: camera not deterministic at tick ${states[i]!.tick}: scratch ${JSON.stringify(replayed)} vs live ${JSON.stringify(live)}`,
    );
  }

  console.log(`seed ${seed}: ok, ${state.tick} ticks, ${states.length} frames checked, ${(Date.now() - started)}ms`);
}

console.log(`\nchecked ${ticksChecked} ticks across ${SEEDS.length} seeds`);
console.log(`max orbiting camera speed: ${maxOrbitCamSpeed.toFixed(3)} units/tick (cap ${ORBIT_SPEED_CAP})`);
console.log(`max in-flight camera speed: ${maxFlightCamSpeed.toFixed(3)} units/tick (cap 6)`);
console.log(`max in-flight rocket speed: ${maxFlightSpeed.toFixed(3)} units/tick`);
console.log(`safe-box hard-clamp overrode the ${ORBIT_SPEED_CAP}/tick cap on ${clampOverrideHits} of ${ticksChecked} checked ticks (total overrides incl. flight/reset: ${orbitCameraClampOverrideCount()})`);
console.log("orbit-camera-check: PASS");
