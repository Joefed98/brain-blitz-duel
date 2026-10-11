// Room rotation (12 Oct 2026 rule): every room plays at least 6 rounds. 6 or 7
// categories play one round each; fewer fill to 6, spread as evenly as possible,
// with the extras' categories, the order and every game drawn from the room seed.
// Covers 1, 2, 4 and 7 selected categories.
import { readFileSync } from "node:fs";
import { CATEGORY_ORDER } from "../src/lib/duel/categories.ts";
import { puzzleDef, typesInCategory } from "../src/lib/duel/registry.ts";
import { categoryOrderFor, pickRoundOrder, roomRoundCount } from "../src/lib/duel/selection.ts";
import type { PuzzleCategory, PuzzleType } from "../src/lib/duel/types.ts";

const failures: string[] = [];
const fail = (message: string) => {
  if (failures.length < 40) console.log("FAIL", message);
  failures.push(message);
};

const ROOM_CATEGORIES = CATEGORY_ORDER.filter((c) => c !== "memory");
const SELECTIONS: PuzzleCategory[][] = [
  ["arcade"],
  ["word"],
  ["logic", "arcade"],
  ["pattern", "number"],
  ["logic", "speed", "word", "arcade"],
  ["pattern", "attention", "number", "arcade"],
  [...ROOM_CATEGORIES],
];
const EXPECTED_ROUNDS: Record<number, number> = { 1: 6, 2: 6, 4: 6, 7: 7 };
const SEEDS = 300;

// Every category must hold enough active games for the most rounds it can be
// dealt (6 in a one-category room), or a room could repeat a game.
for (const category of ROOM_CATEGORIES) {
  const active = typesInCategory(category).length;
  const needed = roomRoundCount([category]);
  if (active < needed) fail(`${category}: ${active} active games, a room can need ${needed}`);
}

const category = (type: PuzzleType) => puzzleDef(type).category;
const recentFor = (seed: number): PuzzleType[][] =>
  seed % 3 === 0 ? [] : [pickRoundOrder({ categories: [...ROOM_CATEGORIES], seed: seed + 100_000 })];

let rooms = 0;
for (const selection of SELECTIONS) {
  const n = selection.length;
  const want = EXPECTED_ROUNDS[n]!;
  if (roomRoundCount(selection) !== want)
    fail(`${selection.join("+")}: roomRoundCount ${roomRoundCount(selection)}, want ${want}`);
  const extraCounts = new Map<PuzzleCategory, number>();
  for (let s = 0; s < SEEDS; s++) {
    const seed = s * 7919 + n;
    const recent = recentFor(s);
    const order = pickRoundOrder({ categories: selection, seed, recent });
    rooms++;
    const tag = `${selection.join("+")} seed ${seed}`;

    // Round count.
    if (order.length !== want) fail(`${tag}: ${order.length} rounds, want ${want}`);
    // No repeated game.
    if (new Set(order).size !== order.length) fail(`${tag}: a game repeats (${order.join(",")})`);
    // Even spread: every selected category gets floor or ceil of rounds / n.
    const counts = new Map<PuzzleCategory, number>();
    for (const type of order) counts.set(category(type), (counts.get(category(type)) ?? 0) + 1);
    const low = Math.floor(want / n);
    const high = Math.ceil(want / n);
    for (const c of selection) {
      const k = counts.get(c) ?? 0;
      if (k < low || k > high) fail(`${tag}: ${c} has ${k} rounds, want ${low}–${high}`);
      if (k === high && high > low) extraCounts.set(c, (extraCounts.get(c) ?? 0) + 1);
    }
    for (const c of counts.keys()) if (!selection.includes(c)) fail(`${tag}: drew ${c}, not selected`);
    // No category in back-to-back rounds when more than one is selected.
    if (n > 1)
      for (let i = 1; i < order.length; i++)
        if (category(order[i]!) === category(order[i - 1]!)) fail(`${tag}: ${category(order[i]!)} twice in a row`);
    // Same seed (and history) → identical room, order and games.
    const again = pickRoundOrder({ categories: selection, seed, recent });
    if (again.join() !== order.join()) fail(`${tag}: same seed gave ${again.join(",")} then ${order.join(",")}`);
    if (categoryOrderFor(selection, seed).join() !== order.map(category).join())
      fail(`${tag}: category order is not the seeded deal`);
    // Recent-avoidance: last room's games are skipped while a category has alternatives.
    const last = recent[0] ?? [];
    for (const type of order)
      if (last.includes(type) && typesInCategory(category(type)).length - (counts.get(category(type)) ?? 0) >= 4)
        fail(`${tag}: repeated ${type} from the previous room despite alternatives`);
  }
  // The seed, not a fixed rule, picks which categories take the extra rounds.
  if (n === 4 && extraCounts.size < 4) fail(`${selection.join("+")}: extras only ever went to ${[...extraCounts.keys()].join(",")}`);
}

// Different seeds give different rooms.
const distinct = new Set(
  Array.from({ length: 50 }, (_, s) => pickRoundOrder({ categories: ["arcade"], seed: s }).join()),
);
if (distinct.size < 40) fail(`one-category rooms: only ${distinct.size} distinct deals from 50 seeds`);

// Every round-count display reads the room's stored round_count (in play) or
// roomRoundCount (lobby, before the deal), never the category count.
const room = readFileSync("src/routes/duel.$code.tsx", "utf8");
const lobby = readFileSync("src/components/duel/RoomLobby.tsx", "utf8");
if (!/roomRoundCount\(categories\)/.test(lobby)) fail("lobby round count does not use roomRoundCount");
if (/categories\.length\} \{/.test(lobby) || /roundCount = categories\.length/.test(lobby))
  fail("lobby still counts categories as rounds");
for (const [label, pattern] of [
  ["round title", /<RoundTitle[^>]*totalRounds=\{duel\.round_count/],
  ["intro", /<RoundIntro[\s\S]*?totalRounds=\{duel\.round_count\}/],
  ["reveal", /<AnswerReveal[\s\S]*?totalRounds=\{duel\.round_count/],
  ["game header", /label=\{`Round \$\{round\} of \$\{duel\.round_count/],
  ["standings", /<Standings[\s\S]*?totalRounds=\{duel\.round_count/],
  ["podium", /<Podium[\s\S]*?standings\(roomPlayers, results, duel\.round_count/],
] as const)
  if (!pattern.test(room)) fail(`${label} does not read duel.round_count`);
const home = readFileSync("src/routes/index.tsx", "utf8");
if (/One round per category/i.test(home)) fail("home tagline still says one round per category");

if (failures.length) {
  console.log(`FAIL: ${failures.length} room-round problem(s)`);
  process.exit(1);
}
console.log(
  `PASS: ${rooms} seeded rooms over 1, 2, 4 and 7 categories: 6/6/6/7 rounds, even spread, no repeated games or back-to-back categories, identical deals from the same seed; every category has enough active games`,
);
