/**
 * Orbit legacy replay check: pins current replayOrbitRun(seed, raw) (the
 * no-rev / classic-course path) against the orbit.ts revision that predates
 * today's Orbit rev3 export work (commit f45ca5dd, 2026-10-06 19:52:19 UTC —
 * the last orbit.ts commit before d9b22e51's rev3 constant exports and the
 * new OrbitState.worldW field, landed 2026-10-09 16:35:45 UTC). For 20
 * deterministic seeds we record an identical synthetic tap log against both
 * engines and assert the classic score/extra fields are byte-identical, and
 * separately confirm the new worldW field appears on the live state/result
 * but was never part of the scored extras.
 *
 * The old engine source lives outside the project (/tmp/orbit-base) so it is
 * reconstructed on every run from git history rather than committed; a
 * fixture of its reference outputs is checked into
 * scripts/fixtures/orbit-legacy.json so the check can run in CI-like settings
 * without git history (and to catch drift even if /tmp/orbit-base is stale).
 *
 *   bun run scripts/orbit-legacy-replay-check.ts
 */
import { strict as assert } from "node:assert";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const BASE_COMMIT = "f45ca5dd"; // last orbit.ts rev before rev3 exports/worldW (2026-10-06 19:52:19 +0000)
const BASE_DIR = "/tmp/orbit-base";
const FIXTURE_PATH = "scripts/fixtures/orbit-legacy.json";

function rebuildBase() {
  mkdirSync(`${BASE_DIR}/src/lib/arcade`, { recursive: true });
  mkdirSync(`${BASE_DIR}/src/lib/duel`, { recursive: true });
  const show = (path: string) => execSync(`git show ${BASE_COMMIT}:${path}`, { cwd: process.cwd() }).toString();
  writeFileSync(`${BASE_DIR}/src/lib/arcade/orbit.ts`, show("src/lib/arcade/orbit.ts"));
  writeFileSync(`${BASE_DIR}/src/lib/arcade/trig.ts`, show("src/lib/arcade/trig.ts"));
  let duel = show("src/lib/duel/orbit.ts");
  duel = duel.replace('"@/lib/arcade/orbit"', '"../arcade/orbit"').replace('"./arcadeRun"', `"${process.cwd()}/src/lib/duel/arcadeRun"`);
  writeFileSync(`${BASE_DIR}/src/lib/duel/orbit.ts`, duel);
}
rebuildBase();

const oldOrbit = await import(`${BASE_DIR}/src/lib/arcade/orbit.ts`);
const oldDuel = await import(`${BASE_DIR}/src/lib/duel/orbit.ts`);
const newOrbit = await import("../src/lib/arcade/orbit");
const newDuel = await import("../src/lib/duel/orbit");
const { inputAt, recordInput } = await import("../src/lib/arcade/engine");

// A deterministic bot: probe whether tapping now lands safely on the next
// planet without ending the run; if so tap, otherwise wait one tick. This is
// intentionally simple/sub-optimal (so most seeds end in a crash well before
// planet 40), which is fine — we only need identical old/new engine behaviour
// on an identical tap log, not a winning run.
function flightOutcome(game: any, state: any, event: (t: number, k: number) => any) {
  let probe = game.step(state, event(state.tick + 1, 0));
  while (probe.flying > 0 && !game.isOver(probe)) probe = game.step(probe, null);
  return probe;
}

function recordRun(game: any, seed: number, checkpointInterval: number, checkpointFn: (s: any) => any) {
  const event = (t: number, k: number) => ({ t, k, a: 0, b: 0, c: 0, d: 0 });
  let state = game.init(seed);
  const events: any[] = [];
  const checkpoints: any[] = [];
  let guard = 0;
  while (!game.isOver(state) && guard++ < 20000) {
    const tick = state.tick + 1;
    let kind: number | undefined;
    if (state.flying === 0) {
      const probe = flightOutcome(game, state, event);
      if (probe.cur > state.cur && probe.ended === 0) kind = 0;
    }
    if (kind !== undefined) recordInput(events, event(tick, kind), game.inputRanges);
    state = game.step(state, inputAt(events, tick));
    if (state.tick % checkpointInterval === 0) checkpoints.push(checkpointFn(state));
  }
  return { state, events, checkpoints, endTick: state.tick };
}

const seeds = Array.from({ length: 20 }, (_, i) => 1000 + i * 137);

interface FixtureEntry {
  seed: number;
  score: number;
  extra: Record<string, unknown>;
  hasWorldW: boolean;
}

const fixtureExists = existsSync(FIXTURE_PATH);
const fixture: FixtureEntry[] = fixtureExists ? JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) : [];
const fixtureBySeed = new Map(fixture.map((f) => [f.seed, f]));
const produced: FixtureEntry[] = [];

let checked = 0;
for (const seed of seeds) {
  // Record the tap log and matching checkpoints in a single deterministic
  // pass against the OLD engine (the real client records checkpoints inline
  // as it steps, never by a separate replay pass), then feed that exact raw
  // string through both old and current replayOrbitRun(seed, raw).
  const { events, checkpoints: oldCheckpoints, endTick, state: oldState } = recordRun(
    oldOrbit.orbitGame,
    seed,
    oldOrbit.ORBIT_CHECKPOINT_INTERVAL,
    oldOrbit.orbitCheckpoint,
  );
  const claimedScore = oldOrbit.orbitGame.score(oldState);
  const raw = oldDuel.encodeOrbitRun({ seed, events, checkpoints: oldCheckpoints, endTick, claimedScore });

  const oldResult = oldDuel.replayOrbitRun(seed, raw);
  const newResult = newDuel.replayOrbitRun(seed, raw);

  assert.equal(newResult.flagged, false, `seed ${seed}: new replay must not be flagged: ${newResult.reason ?? ""}`);
  assert.equal(oldResult.flagged, false, `seed ${seed}: old replay must not be flagged: ${oldResult.reason ?? ""}`);
  assert.equal(newResult.score, oldResult.score, `seed ${seed}: score mismatch old=${oldResult.score} new=${newResult.score}`);

  const oldExtra = oldOrbit.orbitExtra(oldResult.state);
  const newExtra = newOrbit.orbitExtra(newResult.state);
  assert.deepEqual(newExtra, oldExtra, `seed ${seed}: extra mismatch`);
  for (const key of Object.keys(oldExtra)) {
    assert.equal((newResult as any)[key], (oldResult as any)[key], `seed ${seed}: result.${key} mismatch`);
  }

  // The new OrbitState carries a worldW field the old one never had; confirm
  // it is present on the live state but is not one of the scored extras, so
  // it can never silently change score/extra parity checked above.
  const hasWorldWOnState = Object.prototype.hasOwnProperty.call(newResult.state, "worldW");
  assert.equal(hasWorldWOnState, true, `seed ${seed}: expected worldW on new OrbitState`);
  assert.equal(Object.prototype.hasOwnProperty.call(newExtra, "worldW"), false, `seed ${seed}: worldW must not leak into scored extra`);
  assert.equal(Object.prototype.hasOwnProperty.call(newResult, "worldW"), false, `seed ${seed}: worldW must not leak into stored flat result`);

  const entry: FixtureEntry = { seed, score: newResult.score, extra: newExtra, hasWorldW: hasWorldWOnState };
  produced.push(entry);
  const recorded = fixtureBySeed.get(seed);
  if (recorded) {
    assert.equal(entry.score, recorded.score, `seed ${seed}: score drifted from fixture`);
    assert.deepEqual(entry.extra, recorded.extra, `seed ${seed}: extra drifted from fixture`);
    assert.equal(entry.hasWorldW, recorded.hasWorldW, `seed ${seed}: worldW presence drifted from fixture`);
  }
  checked++;
}

if (!fixtureExists) {
  mkdirSync("scripts/fixtures", { recursive: true });
  writeFileSync(FIXTURE_PATH, JSON.stringify(produced, null, 2) + "\n");
  console.log(`wrote fixture ${FIXTURE_PATH} (${produced.length} seeds)`);
}

console.log(`Orbit legacy replay check: ${checked}/${seeds.length} seeds matched old (pre-rev3, ${BASE_COMMIT}) and current replayOrbitRun scores/extras; worldW confirmed on state only, never in scored extras.`);
