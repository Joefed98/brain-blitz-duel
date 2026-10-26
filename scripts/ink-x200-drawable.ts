/**
 * Rainbow Bridge inkRev 10 drawable scan (a tool, not a check; ink-x200-check runs a sample): for each skill-band seed
 * index, every level must have a line a finger can draw: levels 1–8 a reference line drawn as a phone sends it
 * (inkPhoneLine) that pots and still pots moved 3 px each way (three of four) on its own release, and a bonus line that
 * does too; levels 9–10 the pre-release line plus the hand-drawn live stroke, played through the real step (also
 * started 5 ticks late). Prints any level that fails and the totals.
 *
 *   bun scripts/ink-x200-drawable.ts [from] [count]
 */
import { inkX200Proof } from "../src/lib/arcade/inkBridge";
import { roomSeed } from "./arcade-skill-bands/games";

const from = Number(process.argv[2] ?? 0);
const count = Number(process.argv[3] ?? 260);
let levels = 0;
const bad: string[] = [];
const t = performance.now();
for (let n = from; n < from + count; n++) {
  for (const l of inkX200Proof(roomSeed(n))) {
    levels++;
    const ok = l.ref && !l.unaided && (l.level < 8 ? l.bonus === true && l.silverOnLine === l.silver && l.shamrock !== false : l.hand === true);
    if (!ok) {
      bad.push(`n${n} L${l.level + 1} (${l.kind}: ref ${l.ref}, bonus ${l.bonus}, hand ${l.hand}, unaided ${l.unaided})`);
      console.error(`FAILING ${bad[bad.length - 1]}`);
    }
  }
  if ((n - from) % 250 === 249) console.error(`… ${n - from + 1} seeds, ${bad.length} failing levels, ${((performance.now() - t) / 1000).toFixed(0)} s`);
}
console.log(`inkRev 10 drawable scan, seed indices ${from}–${from + count - 1}: ${levels} levels, ${bad.length} without a hand-drawable proof${bad.length ? `: ${bad.slice(0, 40).join("; ")}` : ""}`);
if (bad.length) process.exit(1);
