/**
 * round-engine-parity-check's deal side (B6, docs/round-engine/plan.md): deals the same sequence of rooms, dailies,
 * challenges and practice rounds through main's code (`legacy`, scripts/round-engine/legacy.ts) or the engine's
 * (`engine`), each in a fresh process, and prints one digest per deal. Generators keep caches across calls (a second
 * deal of the same seed in one process can draw differently, on main as today), so the two sides never share a
 * process: the check runs both and compares the digests.
 *
 *   bun scripts/round-engine/deals.ts legacy|engine [--full]
 *
 * Temporary: retired with legacy.ts at the start of wave 3, with Joe's approval.
 */
import { createHash } from "node:crypto";

import * as legacy from "./legacy";
import { buildRoomPuzzles, dealOne, generatePuzzle } from "../../src/lib/duel/generate.server";
import { dealDaily } from "../../src/lib/duel/daily.server";
import { dealChallenge } from "../../src/lib/duel/challenge.server";
import { dealRoomRounds } from "../../src/lib/duel/roomDeal";
import { ROOM_PRESETS } from "../../src/lib/duel/roomSettings";
import { ACTIVE_PUZZLE_TYPES } from "../../src/lib/duel/catalogue";
import { withSeededRandom } from "../../src/lib/duel/random";
import { newRoomSeed } from "../../src/lib/duel/selection";
import { splitPuzzle } from "../../src/lib/duel/secrets";
import type { PuzzleCategory, PuzzleType } from "../../src/lib/duel/types";

const side = process.argv[2];
if (side !== "legacy" && side !== "engine") throw new Error("usage: deals.ts legacy|engine [--full]");
const FULL = process.argv.includes("--full");

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // Lightbender stores how long its build took (laser.server.ts): wall-clock time, not part of the deal.
      if (k === "generationMs") continue;
      out[k] = v === undefined ? { __undef: true } : stable(v);
    }
    return out;
  }
  return value;
}
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex").slice(0, 24);

/**
 * Every draw from one seed for the call: withSeededRandom (random.ts) for the generators that read its seeded draw, and
 * the platform's own sources (crypto.getRandomValues, Math.random) under it, since under bun a module reached through
 * the `@/` alias (src/puzzles' generators) can load its own copy of random.ts that the seeded hook never reaches (main
 * dealt its dailies differently in two processes for that reason). Checks only; nothing in the app changes.
 */
function seeded<T>(seed: number, fn: () => T): T {
  let state = (seed * 2654435761) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const cryptoObj = globalThis.crypto as Crypto & { getRandomValues: Crypto["getRandomValues"] };
  const savedValues = cryptoObj.getRandomValues;
  const savedRandom = Math.random;
  cryptoObj.getRandomValues = (<A extends ArrayBufferView | null>(array: A): A => {
    if (array instanceof Uint32Array) for (let i = 0; i < array.length; i++) array[i] = next();
    else if (array instanceof Uint8Array) for (let i = 0; i < array.length; i++) array[i] = next() & 255;
    else if (array instanceof Uint16Array) for (let i = 0; i < array.length; i++) array[i] = next() & 0xffff;
    else throw new Error("deals.ts: an unexpected random buffer");
    return array;
  }) as Crypto["getRandomValues"];
  Math.random = () => next() / 0x1_0000_0000;
  try {
    return withSeededRandom(seed, fn);
  } finally {
    cryptoObj.getRandomValues = savedValues;
    Math.random = savedRandom;
  }
}

const out: Record<string, string> = {};
const saved = [console.log, console.warn, console.error, console.info] as const;
console.log = console.warn = console.error = console.info = () => {};

const roomSeeds = FULL ? 40 : 12;
for (let seed = 1; seed <= roomSeeds; seed++) {
  // An older room (the category rule) and every preset at 3, 6 and 12 rounds.
  const orders: (PuzzleType[] | undefined)[] = [undefined];
  for (const preset of ROOM_PRESETS) for (const rounds of [3, 6, 12]) orders.push(dealRoomRounds({ picks: [...preset.picks], rounds }, { seed }).types);
  for (const [i, roundOrder] of orders.entries()) {
    if (!FULL && i > 0 && (seed + i) % 3 !== 0) continue;
    const opts = { seed, unblockRow: null, recentBankKeys: new Set<string>(["none"]), roundOrder };
    const dealt = seeded(seed * 101 + i, () => (side === "legacy" ? legacy.buildRoomPuzzles(opts) : buildRoomPuzzles(opts)));
    out[`room|${seed}|${i}`] = digest(dealt);
  }
}
for (const kind of ["puzzle", "arcade"] as const)
  for (let seed = 1; seed <= (FULL ? 20 : 4); seed++) {
    const input = { seed, recent: [["sudoku", "reaction"]], unblockRow: null, recentBankKeys: new Set<string>() };
    out[`daily|${kind}|${seed}`] = digest(seeded(seed, () => (side === "legacy" ? legacy.dealDaily(kind, input) : dealDaily(kind, input))));
  }
const shapes: [PuzzleCategory[], number][] = [
  [["word", "number", "speed", "attention", "pattern", "logic", "arcade"], 3],
  [["word", "logic"], 6],
  [["arcade"], 10],
];
for (const [categories, rounds] of shapes)
  for (let seed = 1; seed <= (FULL ? 12 : 3); seed++) {
    const input = { categories, rounds, seed, unblockRow: null };
    out[`challenge|${categories.join("+")}|${rounds}|${seed}`] = digest(
      seeded(seed, () => (side === "legacy" ? legacy.dealChallenge(input) : dealChallenge(input))),
    );
  }
// Practice: main's dealPractice body (newRoomSeed, then generatePuzzle on that seed, split) against today's (the same
// with dealOne), run synchronously under one fixed random (main's awaits only load modules already loaded here; the
// check proves today's dealPractice text is main's with generatePuzzle → dealOne).
for (const type of ACTIVE_PUZZLE_TYPES)
  for (const seed of FULL ? [1, 2, 3, 4, 5, 6] : [1]) {
    const dealt = seeded(seed, () => {
      const bankSeed = newRoomSeed();
      const context = { unblockRow: null as never, bankSeed };
      const { pub, priv } = splitPuzzle(side === "legacy" ? generatePuzzle(type, context) : dealOne(type, context));
      return { pub, priv, seed: bankSeed };
    });
    out[`practice|${type}|${seed}`] = digest(dealt);
  }

[console.log, console.warn, console.error, console.info] = saved as unknown as [typeof console.log, typeof console.log, typeof console.log, typeof console.log];
console.log(JSON.stringify(out));
