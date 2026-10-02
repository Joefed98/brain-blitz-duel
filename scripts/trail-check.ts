import { TRAIL_BANK } from "../src/lib/duel/trailBank.server";
import { scoreTrail, trComplete, trCountSolutions, trCorrectPrefix } from "../src/lib/duel/trail";
let bad = 0;
const seen = new Set<string>();
for (const e of TRAIL_BANK) {
  const n = e.givens.filter((g) => g != null).length;
  if (n < 8 || n > 12 || e.givens[e.solution[0]!] !== 1 || e.givens[e.solution[35]!] !== 36) bad++;
  if (!trComplete(e.givens, e.solution) || trCountSolutions(e.givens, 2) !== 1) bad++;
  if (trCorrectPrefix(e.solution.slice(0, 20), e.solution) !== 20) bad++;
  seen.add(e.solution.join("."));
}
console.log(`checked ${TRAIL_BANK.length} trails, distinct ${seen.size}, problems ${bad}; half time = ${scoreTrail(true, 60_000, 120_000, 36)}, 18 right = ${scoreTrail(false, 0, 120_000, 18)}`);
