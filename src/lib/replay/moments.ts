/**
 * Replay moments (display only): the success moments each engine game fires
 * today, detected from SIM STATE while a stored round is re-simulated — never
 * from live drawing state — plus near-misses and final-second saves where the
 * sim defines them. One table gives every moment a weight, so rarer and harder
 * moments rank higher across games (a boss kill above a 5-in-a-line above a
 * streak banner). Picking is deterministic: weight, then the earlier tick, then
 * the table order.
 *
 * Source of the arcade rows: the success-event declarations in
 * arcadeFxGames.renderer.ts (`ARCADE_FX_SPECS`, `ORBIT3_FX`, `ENGINE_FX_SPECS`),
 * which are pure reads of counters the sims already keep. Each row names the
 * event by its index and kind; scripts/replay-check.ts fails if a game's events
 * and its rows ever drift apart. Bonk, Pull!, Tenfall and Mixed Signals fire no
 * shared success events, so their rows read their own sim counters here.
 */
import type { ArcadeFxEvent, ArcadeFxKind } from "@/lib/arcade/arcadeFx.renderer";
import { ARCADE_FX_SPECS, ENGINE_FX_SPECS, ORBIT3_FX } from "@/lib/arcade/arcadeFxGames.renderer";
import type { PuzzleData } from "@/lib/duel/types";
import { ORBIT_REV3 } from "@/lib/arcade/orbit";
import { TD_TARGETS } from "@/lib/arcade/tenDrop";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type MomentCategory = "success" | "finish" | "near-miss" | "save";

export interface MomentRow {
  game: string;
  /** Stable moment id within the game. */
  id: string;
  /** Rank weight; 0 = fires today but is not a highlight (an every-hit light, an info banner). */
  weight: number;
  category: MomentCategory;
  /** What the moment is, for docs and as the caption when the event has no text. */
  name: string;
  /** Arcade rows: the index and kind of the success event in the game's spec. */
  fx?: { index: number; kind: ArcadeFxKind; spec?: "orbit3" };
}

const fx = (
  game: string,
  index: number,
  kind: ArcadeFxKind,
  id: string,
  weight: number,
  name: string,
  category: MomentCategory = "success",
  spec?: "orbit3",
): MomentRow => ({
  game,
  id,
  weight,
  category,
  name,
  fx: spec ? { index, kind, spec } : { index, kind },
});
const own = (
  game: string,
  id: string,
  weight: number,
  name: string,
  category: MomentCategory = "success",
): MomentRow => ({ game, id, weight, category, name });

/** The one weight table: (game, moment, weight). */
export const MOMENT_TABLE: readonly MomentRow[] = [
  // Hover
  fx("hover", 0, "pop", "barrier", 0, "Barrier passed (border light only)"),
  fx("hover", 1, "streak", "zone", 30, "New zone (every 7 barriers)"),
  fx("hover", 2, "perfect", "gold-star", 40, "Gold star"),
  fx("hover", 3, "pop", "two-gap", 20, "Through a two-gap barrier"),
  fx("hover", 4, "pop", "slipped-through", 30, "Slipped through a moving barrier", "near-miss"),
  fx("hover", 5, "final", "all-barriers", 90, "Every barrier passed", "finish"),
  // hoverRev 9 (the 200 expansion): fire on hoverRev 9 rounds only.
  fx("hover", 6, "perfect", "tight-gate", 45, "Through a tight gate"),
  fx("hover", 7, "clear", "star-chain", 55, "A whole star chain"),
  fx("hover", 8, "pop", "shield", 10, "Shield picked up"),
  fx("hover", 9, "combo", "centre-line", 35, "Along a tight gate's centre line"),
  // Breaker
  fx("breaker", 0, "perfect", "power-up", 25, "Power-up caught"),
  fx("breaker", 1, "streak", "bricks", 20, "Bricks streak (every 10)"),
  fx("breaker", 2, "perfect", "fireball", 40, "Fireball caught"),
  fx("breaker", 3, "pop", "moving-target", 25, "Brick out of a sliding row"),
  fx("breaker", 4, "clear", "row-clear", 35, "Row cleared"),
  fx("breaker", 5, "final", "wall-cleared", 95, "Wall cleared", "finish"),
  // brkRev 9 (expansion E3): fire on brkRev 9 rounds only.
  fx("breaker", 6, "perfect", "gold-brick", 55, "Gold brick broken by a direct hit"),
  // No combo moment: the combo pop above the paddle is gone (Joe's phone notes, 28 Oct 2026).
  // Pinball
  fx("minigolf", 0, "pop", "hole-done", 20, "A hole holed at par or worse"),
  fx("minigolf", 1, "perfect", "under-par", 60, "A hole under par (a birdie or better)"),
  fx("minigolf", 2, "final", "all-holed", 90, "All five holes holed", "finish"),
  fx("curling", 0, "perfect", "on-the-button", 40, "A stone on the button"),
  fx("curling", 1, "pop", "takeout", 30, "An opponent stone out of the house"),
  fx("curling", 2, "final", "shot-stone", 80, "Holding shot at the end", "finish"),
  fx("pool", 0, "combo", "pots-in-a-row", 40, "Pots in a row"),
  fx("pool", 1, "clear", "spots-cleared", 50, "All seven spots down"),
  fx("pool", 2, "final", "cleared", 90, "The black, table cleared", "finish"),
  fx("pinball", 0, "pop", "bumper", 0, "Bumper hit (border ripple only)"),
  fx("pinball", 1, "perfect", "target", 15, "Drop target knocked down"),
  fx("pinball", 2, "clear", "bank-down", 50, "Whole bank of drop targets down"),
  fx("pinball", 3, "pop", "lane-lit", 10, "Top lane lit"),
  fx("pinball", 4, "streak", "multiplier", 60, "All three lanes lit: multiplier up"),
  fx("pinball", 5, "combo", "spinner", 25, "Spinner ripped (8+ turns at once)"),
  // Minesweeper (Cards & Board, 30 Oct 2026)
  fx("minesweeper", 0, "pop", "big-opening", 15, "Eight or more squares opened at once"),
  fx("minesweeper", 1, "streak", "safe-squares", 30, "Safe squares streak (every 25)"),
  fx("minesweeper", 2, "final", "board-cleared", 95, "Board cleared", "finish"),
  // Mahjong Solitaire (Cards & Board, 30 Oct 2026)
  fx("mahjong", 0, "pop", "pair", 5, "Pair taken away"),
  fx("mahjong", 1, "streak", "pairs", 30, "Pairs streak (every 6)"),
  fx("mahjong", 2, "final", "stack-cleared", 95, "Stack cleared", "finish"),
  // Cards & Board (30 Oct 2026)
  fx("freecell", 0, "pop", "home", 0, "Card home (burst only)"),
  fx("freecell", 1, "streak", "suit-home", 40, "Thirteen more cards home"),
  fx("freecell", 2, "final", "all-home", 95, "All 52 cards home", "finish"),
  fx("tripeaks", 0, "combo", "run", 25, "A run of five or more"),
  fx("tripeaks", 1, "perfect", "peak", 40, "A peak top cleared"),
  fx("tripeaks", 2, "final", "cleared", 95, "All 28 peak cards cleared", "finish"),
  fx("pokersquares", 0, "pop", "hand", 20, "A row or column makes a hand"),
  fx("pokersquares", 1, "final", "target", 70, "The deal's target reached"),
  fx("fivehands", 0, "pop", "hand", 20, "A row makes a hand"),
  fx("fivehands", 1, "final", "target", 70, "The full hand points reached"),
  // Ricochet (ricoRev 2, the ninja wall-climb, 1 Nov 2026)
  fx("ricochet", 0, "pop", "coin-taken", 5, "Coin taken"),
  fx("ricochet", 1, "combo", "lantern-taken", 30, "Gold lantern taken"),
  fx("ricochet", 2, "perfect", "scroll-taken", 50, "Scroll taken"),
  fx("ricochet", 3, "streak", "height", 25, "Another 50 m climbed"),
  fx("ricochet", 4, "final", "full-height", 80, "The core's full height reached"),
  // Rally
  fx("rally", 0, "streak", "long-rally", 35, "Long rally (every 10 returns)"),
  fx("rally", 1, "pop", "gold", 25, "Gold ball returned"),
  fx("rally", 2, "perfect", "target", 45, "Far-wall target struck"),
  fx("rally", 3, "pop", "bumper", 10, "Off the bumper"),
  fx("rally", 4, "pop", "hit", 0, "Paddle hit (court lights only)"),
  // rallyRev 10 (expansion E9): fires on rallyRev 10 rounds only.
  fx("rally", 5, "perfect", "gold-target", 50, "Gold bonus target struck"),
  // Tempo
  fx("beat", 0, "combo", "combo", 30, "Combo (every 10)"),
  fx("beat", 1, "pop", "swipe", 15, "Swipe note hit"),
  fx("beat", 2, "final", "full-combo", 95, "Full combo", "finish"),
  // Meteor
  fx("snake", 0, "streak", "stars", 30, "Stars streak (every 10)"),
  fx("snake", 1, "pop", "dodged", 25, "Rock dodged", "near-miss"),
  fx("snake", 2, "streak", "shower", 20, "Meteor shower incoming"),
  fx("snake", 3, "perfect", "shower-dodged", 60, "Meteor shower dodged", "near-miss"),
  fx("snake", 4, "final", "all-eaten", 90, "Every star eaten", "finish"),
  // Fission
  fx("burst", 0, "clear", "wave-cleared", 45, "Wave cleared"),
  fx("burst", 1, "perfect", "freeze", 30, "Freeze caught"),
  fx("burst", 2, "final", "flawless", 90, "Flawless finish", "finish"),
  // burstRev 8 (expansion E9): fire on burstRev 8 rounds only.
  fx("burst", 3, "perfect", "golden-atom", 45, "Golden atom taken"),
  fx("burst", 4, "clear", "clean-wave", 40, "Wave cleared without a miss"),
  own("burst", "last-life-wave", 55, "Wave cleared on the last life", "near-miss"),
  // Wavefront
  fx("wavefront", 0, "perfect", "saucer", 55, "Saucer shot down"),
  fx("wavefront", 1, "clear", "wave-cleared", 45, "Wave cleared"),
  fx("wavefront", 2, "pop", "diver-down", 25, "Diver shot mid-dive"),
  fx("wavefront", 3, "streak", "boss-hits", 40, "Boss hit streak (every 6)"),
  fx(
    "wavefront",
    4,
    "final",
    "boss-down",
    100,
    "Boss destroyed (all waves on older rounds)",
    "finish",
  ),
  // Orbit (rev 1/2 spec, and the rev 3+ camera spec with black holes)
  fx("orbit", 0, "streak", "planets", 35, "Planets streak (every 10)"),
  fx("orbit", 1, "final", "all-planets", 95, "All 40 planets", "finish"),
  fx("orbit", 0, "streak", "planets", 35, "Planets streak (every 10)", "success", "orbit3"),
  fx("orbit", 1, "final", "all-planets", 95, "All 40 planets", "finish", "orbit3"),
  fx("orbit", 2, "clear", "black-hole", 60, "Through a black hole", "success", "orbit3"),
  // The Sports group (30 Oct 2026)
  fx("homerun", 0, "perfect", "home-run", 40, "Home run"),
  fx("homerun", 1, "streak", "sign-hit", 60, "A sign beyond the fence struck"),
  fx("freekick", 0, "perfect", "goal-scored", 35, "Goal"),
  fx("freekick", 1, "streak", "target-hit", 60, "A target hit"),
  fx("racing", 0, "pop", "clean-sector", 15, "Clean sector"),
  fx("racing", 1, "clear", "lap-done", 60, "Lap complete", "finish"),
  // High Rise
  fx("skyline", 0, "perfect", "perfect-drop", 20, "Perfect drop"),
  fx("skyline", 1, "streak", "floors", 35, "Floors streak (every 10)"),
  fx("skyline", 2, "combo", "streak", 40, "Perfect streak"),
  fx("skyline", 3, "pop", "wind-flag", 0, "Wind flag raised (info only)"),
  fx("skyline", 4, "perfect", "wind-perfect", 50, "Perfect drop in the wind"),
  // Jaywalk
  fx("cross", 0, "clear", "crossing", 35, "Road crossed"),
  fx("cross", 1, "pop", "bikes", 20, "Past the cyclists"),
  fx("cross", 2, "pop", "cones", 20, "Through the roadworks"),
  fx("cross", 3, "pop", "coin", 15, "Gold coin collected (crossRev 9)"),
  fx("cross", 4, "pop", "checkpoint", 20, "Checkpoint island reached (crossRev 9)"),
  fx("cross", 5, "streak", "streak", 40, "Streak multiplier up (crossRev 9)"),
  fx("cross", 6, "pop", "close-call", 20, "Close call (crossRev 9)"),
  // Junction (practice only)
  fx("junction", 0, "perfect", "ambulance", 45, "Ambulance through"),
  fx("junction", 1, "streak", "cleared", 25, "Cars cleared (every 10)"),
  fx("junction", 2, "pop", "new-road", 0, "New road built (info only)"),
  fx("junction", 3, "pop", "bus", 20, "Bus through"),
  fx("junction", 4, "streak", "new-roads", 20, "New roads' traffic (every 5)"),
  // Rainbow Bridge
  fx("inkbridge", 0, "clear", "level", 35, "Level cleared"),
  fx("inkbridge", 1, "perfect", "gold-star", 45, "Coin through the gold star"),
  fx("inkbridge", 2, "final", "all-levels", 95, "All 10 levels", "finish"),
  fx("inkbridge", 3, "combo", "trick-shot", 50, "Trick shot off a bounce cloud"),
  fx("inkbridge", 4, "perfect", "shamrock-moment", 60, "Coin through the shamrock"),
  // Slice
  fx("slice", 0, "combo", "combo", 25, "Combo multiplier"),
  fx("slice", 1, "perfect", "frenzy", 30, "Sauce frenzy"),
  fx("slice", 2, "perfect", "simmer", 30, "Simmer (slow time)"),
  fx("slice", 3, "streak", "sliced", 25, "Sliced streak (every 25)"),
  fx("slice", 4, "perfect", "mayo", 30, "Mayonnaise squeezed"),
  fx("slice", 5, "combo", "many-in-one", 55, "Four or more in one cut"),
  // Swish
  fx("bintoss", 0, "combo", "in-a-row", 35, "Buckets in a row (3+)"),
  fx("bintoss", 1, "perfect", "hoop", 40, "Through the hoop"),
  fx("bintoss", 2, "pop", "spinner", 20, "Past the spinner"),
  fx("bintoss", 3, "final", "ten-of-ten", 95, "Ten out of ten", "finish"),
  // Flightpath
  fx("bullseye", 0, "perfect", "bullseye", 40, "Bullseye"),
  fx("bullseye", 1, "perfect", "inner-bull", 60, "Inner bull"),
  fx("bullseye", 2, "pop", "balloon", 20, "Balloon popped"),
  fx("bullseye", 3, "combo", "bulls-in-a-row", 55, "Bulls in a row"),
  fx("bullseye", 4, "final", "all-on-target", 80, "All ten on target", "finish"),
  // Coral Pop
  fx("bubble", 0, "combo", "big-pop", 55, "Big pop (5+)"),
  fx("bubble", 1, "perfect", "big-drop", 60, "Big drop (3+)"),
  fx("bubble", 2, "perfect", "joker", 30, "Joker"),
  fx("bubble", 3, "perfect", "mine", 40, "Mine"),
  fx("bubble", 4, "perfect", "torpedo", 40, "Torpedo"),
  fx("bubble", 5, "final", "reef-cleared", 95, "Reef cleared", "finish"),
  // Roofbound
  fx("flip", 0, "streak", "seconds", 20, "Survival streak (every 10 s)"),
  fx("flip", 1, "final", "survived", 80, "Survived", "finish"),
  fx("flip", 2, "pop", "star", 15, "Star taken"),
  fx("flip", 3, "perfect", "all-stars", 70, "All 10 stars"),
  fx("flip", 4, "pop", "just-in-time", 40, "Off a crumbling tile just in time", "near-miss"),
  fx("flip", 5, "pop", "trail-star", 10, "Trail star taken (flipRev 8)"),
  fx("flip", 6, "perfect", "star-trail", 55, "A whole star trail (flipRev 8)"),
  fx("flip", 7, "combo", "double-flip", 45, "Double flip (flipRev 8)"),
  fx("flip", 8, "streak", "checkpoint", 15, "Checkpoint passed (flipRev 8)"),
  fx("flip", 9, "pop", "saved", 35, "A crash saved by a checkpoint (flipRev 8)", "save"),
  fx("flip", 10, "streak", "speed-zone", 15, "Into a speed zone (flipRev 8)"),
  fx("flip", 11, "pop", "sweet-spot", 25, "A sweet landing on a roof's sweet spot (flipRev 8)"),
  // Grappler
  fx("swing", 0, "streak", "distance", 30, "Distance (every 100 m)"),
  fx("swing", 1, "perfect", "star", 25, "Star"),
  fx("swing", 2, "pop", "dodged", 30, "Stalactite dodged", "near-miss"),
  fx("swing", 3, "pop", "over-lava", 20, "Over the lava jet"),
  fx("swing", 4, "final", "finish", 95, "500 m (dragon outrun)", "finish"),
  fx("swing", 5, "pop", "gem", 15, "High-route gem (swingRev 13)"),
  fx("swing", 6, "pop", "speed-gate", 25, "Speed gate lit (swingRev 13)"),
  fx("swing", 7, "pop", "ledge", 15, "Landed on a ledge (swingRev 13)"),
  fx("swing", 8, "streak", "combo", 40, "Swing combo point (swingRev 13)"),
  fx("swing", 9, "perfect", "section", 55, "Set-route section cleared (swingRev 13)"),
  fx("swing", 10, "pop", "par", 50, "Section finished under par (swingRev 13)"),
  fx("swing", 11, "pop", "gate14", 25, "Speed gate lit (swingRev 14)"),
  fx("swing", 12, "pop", "gem14", 25, "Gem on a harder line (swingRev 14)"),
  fx("swing", 13, "perfect", "star14", 30, "Star on a tighter swing (swingRev 14)"),
  fx("swing", 14, "pop", "clear14", 10, "Section cleared (swingRev 14)"),
  fx("swing", 15, "final", "course14", 95, "Course cleared (swingRev 14)", "finish"),
  // Scrumper
  fx("snip", 0, "pop", "leaf", 15, "Leaf taken"),
  fx("snip", 1, "clear", "level", 35, "Apple fed"),
  fx("snip", 2, "final", "all-apples", 95, "All 10 apples", "finish"),
  fx("snip", 3, "pop", "spring", 10, "Off a springy branch"),
  // snipRev 11: a golden apple fed in time, a ring's catch, a level fed quick and clean (under par time at par cuts).
  fx("snip", 4, "pop", "golden", 30, "Golden apple"),
  fx("snip", 5, "pop", "ring", 12, "Caught by a ring"),
  fx("snip", 6, "pop", "quick", 25, "Under par time"),
  // Tilt
  fx("tilt", 0, "clear", "maze", 45, "Maze done"),
  fx("tilt", 1, "final", "all-mazes", 95, "All 4 mazes", "finish"),
  fx("tilt", 2, "pop", "star", 25, "Bonus star"),
  fx("tilt", 3, "pop", "first-marble", 25, "First marble home"),
  // Ball Tracker
  fx("balltrack", 0, "streak", "home", 25, "Marbles home (every 5)"),
  fx("balltrack", 1, "final", "all-home", 95, "All 30 home", "finish"),
  fx("balltrack", 2, "pop", "turned-home", 20, "Home off a turned tube"),
  fx("balltrack", 3, "pop", "switched-home", 20, "Home past a switch"),
  // Gemstone
  fx("matchup", 0, "combo", "cascade", 50, "Cascade (3+ steps)"),
  fx("matchup", 1, "perfect", "line-of-five", 70, "Five or more in a line"),
  fx("matchup", 2, "perfect", "jackpot-gem", 75, "Jackpot gem made"),
  fx("matchup", 3, "combo", "jackpot", 65, "Jackpot set off"),
  fx("matchup", 4, "final", "par-smashed", 85, "Par smashed", "finish"),
  // Letterfall
  fx("wordfall", 0, "pop", "word", 15, "Word made"),
  fx("wordfall", 1, "perfect", "long-word", 55, "Six-letter (or longer) word"),
  fx("wordfall", 2, "final", "par", 80, "Par reached", "finish"),
  // Bonk, Pull!, Tenfall, Mixed Signals: their own sim counters
  own("whack", "bonks", 25, "Bonks streak (every 10)"),
  own("whack", "clean-twenty", 60, "Twenty bonks without a wrong tap"),
  own("clayshoot", "gold", 40, "Gold clay"),
  own("clayshoot", "clays", 25, "Clays streak (every 10)"),
  own("clayshoot", "double", 55, "Two clays with one shot"),
  own("tendrop", "ten", 20, "Ten made"),
  own("tendrop", "all-cleared", 90, "Every target cleared", "finish"),
  own("stroop", "sorted", 20, "Sorted streak (every 5)"),
  own("stroop", "all-sorted", 70, "Whole queue sorted", "finish"),
  own("stroop", "flawless", 90, "Whole queue sorted without a mistake", "finish"),
  // Moment cards (rounds that don't replay well), from the stored answers.
  own("reaction", "fastest", 30, "Fastest reaction"),
  own("reaction", "lightning", 50, "Reaction under 200 ms"),
  own("stopwatch", "closest", 30, "Closest stop"),
  own("stopwatch", "dead-on", 60, "Stopped within 10 ms"),
  own("wordsmith", "best-word", 30, "Best word"),
  own("wordsmith", "pangram", 60, "Pangram (every letter)"),
  own("wordhunt", "best-word", 30, "Best word"),
  own("wordhunt", "long-word", 50, "Seven-letter (or longer) word"),
  // Puzzle time-lapses (stored ordered move lists).
  own("puzzle", "solved", 45, "Puzzle solved (time-lapse)"),
  own("puzzle", "minimum", 70, "Puzzle solved in the minimum moves (time-lapse)"),
  // Every game: the run's last scoring moment lands in the final two seconds.
  own("shared", "final-second", 55, "Final-second save: scored in the last two seconds", "save"),
];

/** A detected moment in one stored round. */
export interface Moment {
  game: string;
  id: string;
  tick: number;
  weight: number;
  category: MomentCategory;
  /** On-screen caption: the event's own text, else the row's name. */
  caption: string;
  /** Where it happened in world coordinates, when the event says. */
  at: { x: number; y: number } | null;
}

const rowsByGame = new Map<string, MomentRow[]>();
for (const row of MOMENT_TABLE)
  rowsByGame.set(row.game, [...(rowsByGame.get(row.game) ?? []), row]);

export function momentRows(game: string): readonly MomentRow[] {
  return rowsByGame.get(game) ?? [];
}

/** The success events a game declares today, for the spec a stored round draws with. */
export function fxEventsFor(game: string, spec?: "orbit3"): readonly ArcadeFxEvent<any>[] {
  if (spec === "orbit3") return ORBIT3_FX.events as readonly ArcadeFxEvent<any>[];
  const specs = { ...ARCADE_FX_SPECS, ...ENGINE_FX_SPECS } as Record<
    string,
    { events: readonly ArcadeFxEvent<any>[] }
  >;
  return specs[game]?.events ?? [];
}

export interface Counter {
  row: MomentRow;
  count: (s: any) => number;
  min?: number;
  every?: number;
  minDelta?: number;
  when?: (s: any) => boolean;
  label?: (s: any, count: number, delta: number) => string | null;
  at?: (s: any) => { x: number; y: number } | null | undefined;
}

/** Own counters for the engine games without shared success events. */
function ownCounters(game: string, rows: readonly MomentRow[]): Counter[] {
  const row = (id: string) => rows.find((r) => r.id === id)!;
  switch (game) {
    case "whack":
      return [
        { row: row("bonks"), count: (s) => s.hits, every: 10, label: (_s, n) => `${n} BONKS` },
        {
          row: row("clean-twenty"),
          count: (s) => (s.hits >= 20 && s.wrong + s.bombs === 0 ? 1 : 0),
          label: () => "20 CLEAN BONKS!",
        },
      ];
    case "clayshoot":
      return [
        { row: row("gold"), count: (s) => s.goldHits, label: () => "GOLD CLAY!" },
        { row: row("clays"), count: (s) => s.hits, every: 10, label: (_s, n) => `${n} CLAYS` },
        {
          row: row("double"),
          count: (s) => s.hits,
          minDelta: 2,
          label: (_s, _n, d) => (d >= 3 ? "TRIPLE!" : "DOUBLE!"),
        },
      ];
    case "tendrop":
      return [
        { row: row("ten"), count: (s) => s.cleared, label: () => "TEN!" },
        {
          row: row("all-cleared"),
          count: (s) => (s.cleared >= TD_TARGETS ? 1 : 0),
          label: () => "ALL CLEARED!",
        },
      ];
    case "stroop":
      return [
        { row: row("sorted"), count: (s) => s.correct, every: 5, label: (_s, n) => `${n} SORTED` },
        {
          row: row("all-sorted"),
          count: (s) => (s.finishTick > 0 && (s.wrong > 0 || s.missed > 0) ? 1 : 0),
          label: () => "ALL SORTED!",
        },
        {
          row: row("flawless"),
          count: (s) => (s.finishTick > 0 && s.wrong === 0 && s.missed === 0 ? 1 : 0),
          label: () => "FLAWLESS!",
        },
      ];
    case "burst":
      return [
        {
          row: row("last-life-wave"),
          count: (s) => s.cleared,
          when: (s) => s.lives === 1,
          label: () => "LAST-LIFE CLEAR!",
        },
      ];
    default:
      return [];
  }
}

function defaultCaption(kind: ArcadeFxKind, count: number, delta: number): string {
  switch (kind) {
    case "pop":
      return `+${delta}`;
    case "perfect":
      return "PERFECT";
    case "streak":
      return `STREAK ${count}`;
    case "combo":
      return `COMBO ×${count}`;
    case "clear":
      return "CLEAR!";
    case "final":
      return "FULL CLEAR!";
  }
}

/** Which spec variant a stored round's moments come from (Orbit rev 3+ has its own). */
function specVariant(puzzle: PuzzleData): "orbit3" | undefined {
  const rev = (puzzle as unknown as { orbitRev?: number }).orbitRev;
  return puzzle.type === "orbit" && typeof rev === "number" && rev >= ORBIT_REV3
    ? "orbit3"
    : undefined;
}

/**
 * Every counter a game's moments read, weight-0 rows included: the shared success
 * layer's events for the spec the run draws with, then the game's own counters.
 * Also used live (src/lib/fx/momentCues.ts) so a cue fires on exactly the frame
 * its effect starts.
 */
export function momentCounters(game: string, variant?: "orbit3"): Counter[] {
  const counters: Counter[] = [];
  const rows = momentRows(game);
  const events = fxEventsFor(game, variant);
  for (const row of rows) {
    if (!row.fx || row.fx.spec !== variant) continue;
    const event = events[row.fx.index];
    if (!event || event.kind !== row.fx.kind) continue;
    counters.push({
      row,
      count: event.count,
      ...(event.min !== undefined ? { min: event.min } : {}),
      ...(event.every !== undefined ? { every: event.every } : {}),
      ...(event.minDelta !== undefined ? { minDelta: event.minDelta } : {}),
      ...(event.when ? { when: event.when } : {}),
      ...(event.label ? { label: event.label } : {}),
      ...(event.at ? { at: event.at } : {}),
    });
  }
  counters.push(...ownCounters(game, rows));
  return counters;
}

/**
 * The shared success layer's firing rule: the counter rises (to at least `min`,
 * across a multiple of `every`, by at least `minDelta`, with `when` true).
 */
export function counterFired(
  c: Counter,
  previous: any,
  state: any,
): { before: number; after: number } | null {
  let before: number;
  let after: number;
  try {
    before = Number(c.count(previous)) || 0;
    after = Number(c.count(state)) || 0;
  } catch {
    return null;
  }
  if (after <= before) return null;
  if (c.min !== undefined && after < c.min) return null;
  if (c.every !== undefined && Math.floor(after / c.every) <= Math.floor(before / c.every))
    return null;
  if (c.minDelta !== undefined && after - before < c.minDelta) return null;
  if (c.when && !safe(() => c.when!(state), false)) return null;
  return { before, after };
}

/**
 * Watches one replay tick by tick (feed it to ReplayTimeline as its observer)
 * and collects moments with the shared success layer's firing rule: a counter
 * rises (at `min`, crossing a multiple of `every`, by `minDelta`, `when` true).
 */
export class MomentDetector {
  readonly moments: Moment[] = [];
  private counters: Counter[] = [];
  private finished = false;
  private lastScoreTick = 0;
  private lastScore = 0;
  private readonly lastTick: number;
  private readonly score: (s: any) => number;
  private readonly game: string;

  constructor(
    puzzle: PuzzleData,
    opts: { runTicks: number; lastTick: number; score: (s: any) => number },
  ) {
    this.game = puzzle.type;
    this.lastTick = opts.lastTick;
    this.score = opts.score;
    this.counters = momentCounters(puzzle.type, specVariant(puzzle));
  }

  /** The observer: compare this tick's counters with the previous tick's. */
  observe = (state: any, tick: number, previous: any): void => {
    for (const c of this.counters) {
      const fired = counterFired(c, previous, state);
      if (!fired) continue;
      const { after, before } = fired;
      if (c.row.weight <= 0) continue;
      // The text the effect shows today; an event with no text gets the row's name.
      const kind = c.row.fx?.kind;
      const caption = c.label
        ? (safe(() => c.label!(state, after, after - before), null) ?? c.row.name)
        : kind
          ? defaultCaption(kind, after, after - before)
          : c.row.name;
      const at = c.at ? safe(() => c.at!(state) ?? null, null) : null;
      this.moments.push({
        game: this.game,
        id: c.row.id,
        tick,
        weight: c.row.weight,
        category: c.row.category,
        caption,
        at,
      });
    }
    // Final-second save: track the last tick the score rose.
    if (tick >= this.lastTick - 600) {
      const now = safe(() => this.score(state), this.lastScore);
      if (now > this.lastScore) this.lastScoreTick = tick;
      this.lastScore = now;
    }
  };

  /** Called once the run is fully scanned: adds the final-second save when it applies. */
  finish(endTick: number): Moment[] {
    if (this.finished) return this.moments;
    this.finished = true;
    const row = rowsByGame.get("shared")!.find((r) => r.id === "final-second")!;
    if (
      endTick >= this.lastTick &&
      this.lastScoreTick > 0 &&
      this.lastScoreTick >= this.lastTick - 120
    ) {
      this.moments.push({
        game: this.game,
        id: row.id,
        tick: this.lastScoreTick,
        weight: row.weight,
        category: row.category,
        caption: "FINAL-SECOND SAVE!",
        at: null,
      });
    }
    return this.moments;
  }
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Deterministic order: weight (high first), then the earlier tick, then table order. */
export function rankMoments(moments: readonly Moment[]): Moment[] {
  const order = new Map(MOMENT_TABLE.map((row, i) => [`${row.game}:${row.id}`, i]));
  const key = (m: Moment) => order.get(`${m.game}:${m.id}`) ?? order.get(`shared:${m.id}`) ?? 9999;
  return [...moments].sort((a, b) => b.weight - a.weight || a.tick - b.tick || key(a) - key(b));
}

/**
 * The top `count` moments for a highlight: the best first, then the best that
 * is a different moment or at least `gap` ticks away (so two clips never show
 * the same few seconds).
 */
export function pickMoments(moments: readonly Moment[], count = 2, gap = 300): Moment[] {
  const ranked = rankMoments(moments);
  const picked: Moment[] = [];
  for (const m of ranked) {
    if (picked.length >= count) break;
    if (picked.some((p) => Math.abs(p.tick - m.tick) < gap)) continue;
    picked.push(m);
  }
  return picked.sort((a, b) => a.tick - b.tick);
}
