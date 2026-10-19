/**
 * Records scripts/fixtures/swapword-rev2-legacy.json.gz: Swapword rev-2 rounds
 * (`swapwordRev: 2`, budget max(16, minimum + 5)) graded by a tree that
 * predates swapwordRev 3 (budget minimum + 8, 19 Oct 2026), so swapword-check
 * can prove stored rev-2 rounds grade, store and live-check exactly as before.
 * Run it against an unmodified checkout of the commit before the change
 * (recorded on main 8d1651b):
 *
 *   bun scripts/swapword-rev2-legacy-record.ts <path to that tree> [label, e.g. "main 8d1651b"]
 *
 * Each case: the rev-2 puzzle as that tree generated it (stamped, and without
 * its puzzleScoreRev / speedPar stamps), an answer (empty, the witness, partial
 * witnesses, wasted swaps then the witness up to and past the rev-2 budget,
 * random swaps, malformed tokens) and a time left; recorded: the whole Graded
 * result and the live-check reply.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const gen = await import(`${root}/src/lib/duel/generate.server.ts`);
const sw = await import(`${root}/src/lib/duel/swapword.ts`);
const sws = await import(`${root}/src/lib/duel/swapword.server.ts`);

const LIMIT = 120_000; // SWAPWORD_TIME_MS
const cases: unknown[] = [];
let state = 0x5eed;
const rand = () => ((state = (Math.imul(state, 1103515245) + 12345) >>> 0) / 0x1_0000_0000);
for (const seed of [3, 14, 159, 2653, 58979, 323846, 26433, 832795, 28841, 971693, 99375, 105820]) {
  const stamped = gen.generatePuzzle("swapword", { bankSeed: seed });
  if (stamped.swapwordRev !== 2) throw new Error(`seed ${seed}: not a rev-2 puzzle (run this on the tree before swapwordRev 3)`);
  const { puzzleScoreRev: _a, ...noScoreRev } = stamped;
  const { speedPar: _b, ...legacy } = noScoreRev;
  const witness: [number, number][] = sws.witnessSwaps(stamped.start, stamped.solution);
  const tiles = stamped.start.length;
  const free = [...Array(tiles).keys()].filter((t: number) => stamped.start[t] !== stamped.solution[t]);
  const waste = (n: number) => Array.from({ length: n }, () => [free[0], free[1]] as [number, number]);
  const answers = new Set<string>(["", sw.encodeSwapword(witness)]);
  for (const k of [1, 3, Math.floor(witness.length / 2), witness.length - 1]) answers.add(sw.encodeSwapword(witness.slice(0, k)));
  // Wasted swaps (an even number, so the board is back where it was) then the witness: inside, at and past the rev-2 budget.
  for (const extra of [2, 4, 6, 8, 10]) answers.add(sw.encodeSwapword([...waste(extra), ...witness]));
  answers.add(sw.encodeSwapword(waste(stamped.maxSwaps + 4)));
  for (let r = 0; r < 4; r++) answers.add(sw.encodeSwapword(Array.from({ length: 4 + Math.floor(rand() * 20) }, () => [Math.floor(rand() * tiles), Math.floor(rand() * tiles)] as [number, number])));
  answers.add(`${sw.encodeSwapword(witness.slice(0, 2))},x-1,99-0,,3-3`);
  for (const puzzle of [stamped, noScoreRev, legacy]) {
    for (const answer of answers) {
      for (const ms of [0, 30_000, LIMIT / 2, LIMIT]) {
        cases.push({ seed, puzzle, answer, ms, graded: gen.gradeAnswer(puzzle, answer, ms), view: sws.checkSwapwordMoves(puzzle, answer) });
      }
    }
  }
}
const out = new URL("./fixtures/swapword-rev2-legacy.json.gz", import.meta.url);
writeFileSync(out, gzipSync(JSON.stringify({ recordedFrom: process.argv[3] ?? root, cases })));
console.log(`wrote ${cases.length} Swapword rev-2 cases`);
