/** Focused seeded spawn-lane regression; no browser or other-game proofs. */
import { colourClashGame, clashLaneCount, CLASH_INITIAL_LANES, CLASH_EXPANDED_LANES, CLASH_LANE_EXPAND_TICK, CLASH_RUN_TICKS, type ClashState } from "../src/lib/arcade/colourClash";
import { rngBelow } from "../src/lib/arcade/engine";

function check(ok: boolean, message: string) { if (!ok) throw new Error(message); }
const counts = [Array(CLASH_INITIAL_LANES).fill(0), Array(CLASH_EXPANDED_LANES).fill(0)];
function count(state: ClashState) {
  const band = state.tick >= CLASH_LANE_EXPAND_TICK ? 1 : 0;
  const lanes = clashLaneCount(state.tick);
  check(Number.isInteger(state.lane) && state.lane >= 0 && state.lane < lanes, "Spawn outside current lanes");
  const row = counts[band];
  if (!row) throw new Error("Missing lane counts");
  row[state.lane] += 1;
}
function integers(value: unknown): boolean {
  if (typeof value === "number") return Number.isInteger(value);
  if (value && typeof value === "object") return Object.values(value).every(integers);
  return true;
}
check(clashLaneCount(CLASH_LANE_EXPAND_TICK - 1) === CLASH_INITIAL_LANES, "Expanded early");
check(clashLaneCount(CLASH_LANE_EXPAND_TICK) === CLASH_EXPANDED_LANES, "Expansion boundary wrong");
for (let seed = 1; seed <= 200; seed++) {
  let state = colourClashGame.init(seed);
  let twin = colourClashGame.init(seed);
  count(state);
  while (state.tick < CLASH_RUN_TICKS) {
    const previous = state;
    state = colourClashGame.step(state, null);
    twin = colourClashGame.step(twin, null);
    check(JSON.stringify(state) === JSON.stringify(twin), "Same seed diverged");
    check(integers(state), "Non-integer simulation state");
    if (state.items.length > previous.items.length) {
      // Two existing colour draws, then exactly one spawn-lane draw.
      const colour1 = rngBelow(previous.rng, 1);
      const colour2 = rngBelow(colour1.state, 1);
      const expected = rngBelow(colour2.state, clashLaneCount(state.tick));
      check(state.rng === expected.state && state.lane === expected.value, "Lane is not the saved seeded PRNG draw");
      count(state);
    }
  }
}
check(counts.every((row) => row.every((n) => n > 0)), "Spawn pattern omits a lane");
console.log(`Colour Clash: 200 seeds, integer states and saved PRNG draws passed; three-lane counts ${counts[0]}, four-lane counts ${counts[1]}`);