/**
 * The practice challenge catalogue (wave 2, train C, C1b; docs/challenges/catalogue.md is its live copy): 261
 * challenges over the 92 active games, from the draft Joe reviewed on 10 Nov 2026. Data only, shared by the phone (the
 * lists) and the server (the checker, src/lib/challenges/challenges.server.ts). Every number here is proved against the
 * live game by practice-goals-check (scripts/practice-challenge-numbers.ts): a retune that moves one fails it.
 *
 * Levels: only Classic is live in wave 2 (LIVE_CHALLENGE_LEVELS); the Hard and Expert ones wait for wave 3.5's levels.
 * Coins: 17 Classic challenges pay 100 (live now); 13 Hard pay 100 and 9 Expert 250 once their level is live. The
 * other 222 pay nothing and show no reward (every one counts towards the Challenger badges, C2).
 *
 * Kinds (the shapes the first 40 used, kept for them and for every challenge that fits one exactly):
 *   part   an arcade standard part (ARCADE_STANDARD) at its maximum, read from the stored reveal line;
 *   bonus  a standard puzzle's finish with its bonus (extra.parts.efficiency) at the maximum;
 *   speed  the same finish with its speed points (extra.parts.speed) at the maximum (finished by the "full by" time);
 *   score  one run scoring `score` or more;
 *   check  every condition in `all` holds in one graded run (fields of the stored extra, reveal lines and tiles).
 */
import type { PuzzleType } from "./types";

export type ChallengeLevel = "classic" | "hard" | "expert";
export type ChallengeStyle =
  | "finish"
  | "clean"
  | "par"
  | "speed"
  | "streak"
  | "combo"
  | "fullset"
  | "target"
  | "maxout"
  | "bigscore"
  | "perfect";
export type CmpOp = "eq" | "gte" | "lte" | "lt" | "gt";

/** One condition on a graded run (score, isCorrect, reactionAvgMs and the stored extra). */
export type ChallengeCond =
  /** A puzzle on the scoring standard that finished (extra.standard 1, extra.parts.kind "finish"). */
  | { c: "finish" }
  /** The stored score. */
  | { c: "score"; op: CmpOp; v: number }
  /** The result's isCorrect. */
  | { c: "correct" }
  /** The result's reactionAvgMs. */
  | { c: "avgMs"; op: CmpOp; v: number }
  /** A number (or boolean, as 1 / 0) in the stored extra at a dotted path, against a number or another path ("@a.b"). */
  | { c: "field"; path: string; op: CmpOp; v: number | string }
  /** The length of an array in the stored extra. */
  | { c: "len"; path: string; op: CmpOp; v: number }
  /** Every entry of an array in the stored extra is true (and there is at least one). */
  | { c: "all"; path: string }
  /** An arcade standard part's points, from its stored reveal line "<label>: … → n of m". */
  | { c: "line"; label: string; op: CmpOp; v: number }
  /** An arcade standard part at its maximum `max` (the stored line's "of m" must be `max`). */
  | { c: "full"; label: string; max: number }
  /** An arcade reveal tile's leading whole number (extra.reveal.tiles). */
  | { c: "tile"; label: string; op: CmpOp; v: number };

export type ChallengeGoal =
  | { kind: "part"; label: string; max: number }
  | { kind: "bonus"; max: number }
  | { kind: "speed"; max: number; withinS: number }
  | { kind: "score"; score: number }
  | { kind: "check"; all: readonly ChallengeCond[]; bar?: number };

export interface PracticeChallenge {
  /** Stable id: `<type>.<name>`; progress is stored under it. */
  id: string;
  type: PuzzleType;
  /** The challenge's name, unique across the catalogue. */
  name: string;
  /** The goal in plain words, one line. */
  text: string;
  level: ChallengeLevel;
  style: ChallengeStyle;
  /** Coins paid once per account on completion (0: none). */
  coins: 0 | 100 | 250;
  /** What completing it earns, in words ("100 coins"), or "" where it pays nothing (Joe, 11 Nov 2026: no reward shown). */
  reward: string;
  goal: ChallengeGoal;
}

/* ---- builders ---- */
type Lv = "C" | "H" | "E";
const LEVEL: Record<Lv, ChallengeLevel> = { C: "classic", H: "hard", E: "expert" };
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** One challenge: `id` is today's id for the first 40, else `<type>.<slug of the name>`. */
function ch(
  type: PuzzleType,
  name: string,
  text: string,
  lv: Lv,
  style: ChallengeStyle,
  coin: boolean,
  goal: ChallengeGoal,
  id?: string,
): PracticeChallenge {
  const level = LEVEL[lv];
  const coins = (coin ? (level === "expert" ? 250 : 100) : 0) as 0 | 100 | 250;
  return { id: id ?? `${type}.${slug(name)}`, type, name, text, level, style, coins, reward: coins ? `${coins} coins` : "", goal };
}

const part = (label: string, max: number): ChallengeGoal => ({ kind: "part", label, max });
const bonus = (max: number): ChallengeGoal => ({ kind: "bonus", max });
const speed = (max: number, withinS: number): ChallengeGoal => ({ kind: "speed", max, withinS });
const score = (n: number): ChallengeGoal => ({ kind: "score", score: n });
const all = (...conds: ChallengeCond[]): ChallengeGoal => ({ kind: "check", all: conds });
/** A check whose progress bar follows condition `bar` (default: the last numeric one). */
const allBar = (bar: number, ...conds: ChallengeCond[]): ChallengeGoal => ({ kind: "check", all: conds, bar });

const FIN: ChallengeCond = { c: "finish" };
const f = (path: string, op: CmpOp, v: number | string): ChallengeCond => ({ c: "field", path, op, v });
const sc = (op: CmpOp, v: number): ChallengeCond => ({ c: "score", op, v });
const line = (label: string, op: CmpOp, v: number): ChallengeCond => ({ c: "line", label, op, v });
const full = (label: string, max: number): ChallengeCond => ({ c: "full", label, max });
const tile = (label: string, op: CmpOp, v: number): ChallengeCond => ({ c: "tile", label, op, v });
const len = (path: string, op: CmpOp, v: number): ChallengeCond => ({ c: "len", path, op, v });
const eff = (n: number) => f("parts.efficiency", "gte", n);
const spd = (n: number) => f("parts.speed", "gte", n);

/* eslint-disable max-len */
export const CATALOGUE: readonly PracticeChallenge[] = [
  /* ================================================================ Logic */
  // Blackout (lightsout): 150 + speed 30 (20 s) + par 20.
  ch("lightsout", "Lights out, on par", "Turn every light off in par presses.", "C", "par", false, bonus(20), "lightsout.par"),
  ch("lightsout", "Blink", "Turn every light off within 20 s.", "C", "speed", false, speed(30, 20), "lightsout.speed"),
  ch("lightsout", "Power cut", "Clear an Expert board in par presses.", "E", "par", true, bonus(20)),
  // Box Six (sudoku): 150 + speed 40 (45 s) + clean grid 10.
  ch("sudoku", "Ink, not pencil", "Fill the grid without a single wrong digit.", "C", "clean", false, bonus(10), "sudoku.clean"),
  ch("sudoku", "Six by six by speed", "Solve it within 45 s.", "C", "speed", false, speed(40, 45), "sudoku.speed"),
  ch("sudoku", "Box clever", "Score 200 on a Hard grid: no mistakes, within 45 s.", "H", "perfect", true, score(200)),
  // Hanoi (tower): 150 + speed 40 (45 s) + par 10.
  ch("tower", "Monk’s patience", "Move the tower in the fewest possible moves.", "C", "par", false, bonus(10), "tower.par"),
  ch("tower", "Tower sprint", "Move the tower within 45 s.", "C", "speed", false, speed(40, 45), "tower.speed"),
  // Polypotions (tubes): 150 + speed 35 (45 s) + par 15.
  ch("tubes", "Measured pour", "Sort every flask in par pours.", "C", "par", false, bonus(15)),
  ch("tubes", "Potion master", "Sort a Hard set within 45 s.", "H", "speed", false, speed(35, 45)),
  // Safe Cracker (safe): 150 + speed 40 (30 s) + first try 10.
  ch("safe", "First turn", "Open the safe on your first try.", "C", "clean", false, all(FIN, f("openedOn", "eq", 1)), "safe.clean"),
  ch("safe", "Light fingers", "Open the safe within 30 s.", "C", "speed", false, speed(40, 30), "safe.speed"),
  ch("safe", "Safe hands", "Open an Expert safe on your first try.", "E", "clean", true, all(FIN, f("openedOn", "eq", 1))),
  // Mosaic (nonogram): 150 + speed 40 (60 s) + clean picture 10.
  ch("nonogram", "Steady brush", "Finish the picture with no wrong cells.", "C", "clean", false, all(FIN, f("mistakes", "eq", 0))),
  ch("nonogram", "Quick sketch", "Finish the picture within 60 s.", "C", "speed", false, speed(40, 60)),
  // Colour Flood (flood): 150 + speed 10 (30 s) + par 40.
  ch("flood", "High tide", "Flood the board in par moves.", "C", "par", false, bonus(40), "flood.par"),
  ch("flood", "Flash flood", "Flood the board within 30 s.", "C", "speed", false, speed(10, 30), "flood.speed"),
  ch("flood", "Flood warning", "Flood a Hard board in par moves.", "H", "par", false, bonus(40)),
  // Tents and Trees (tents): 150 + speed 40 (45 s) + clean camp 10.
  ch("tents", "Happy campers", "Pitch every tent with none in the wrong place.", "C", "clean", false, all(FIN, f("mistakes", "eq", 0))),
  ch("tents", "Glamping", "Score 200 on a Hard camp.", "H", "perfect", true, score(200)),
  // Shikaku (shikaku): 150 + speed 40 (45 s) + clean cuts 10.
  ch("shikaku", "Clean cuts", "Cut the grid with no wrong rectangles.", "C", "clean", false, all(FIN, f("mistakes", "eq", 0))),
  ch("shikaku", "Sharp knife", "Cut the grid within 45 s.", "C", "speed", false, speed(40, 45)),
  // Lamplighter (lightup): 150 + speed 40 (45 s) + clean board 10.
  ch("lightup", "No dark corners", "Light every square.", "C", "finish", false, all(FIN)),
  ch("lightup", "Bright spark", "Score 190 or more.", "C", "bigscore", false, score(190)),
  ch("lightup", "Lighthouse keeper", "Light an Expert board with no wrong bulbs.", "E", "clean", false, all(FIN, f("mistakes", "eq", 0))),
  // Trail (trail): 150 + speed 40 (60 s) + clean path 10.
  ch("trail", "No backtracking", "Draw the whole path without undoing a step.", "C", "clean", false, all(FIN, f("cleanPath", "eq", 1))),
  ch("trail", "Trailblazer", "Finish the path within 60 s.", "C", "speed", false, speed(40, 60)),
  // Loopline (fences): 150 + speed 40 (45 s) + clean loop 10.
  ch("fences", "Closed loop", "Close the loop.", "C", "finish", false, all(FIN)),
  ch("fences", "Clean loop", "Close the loop with no wrong edges.", "C", "clean", false, all(FIN, f("mistakes", "eq", 0))),
  ch("fences", "Loop the loop", "Score 200 on a Hard loop.", "H", "perfect", true, score(200)),
  // Regions (fillomino): 150 + speed 40 (45 s) + clean fill 10.
  ch("fillomino", "Right sizes", "Fill the grid with no wrong numbers.", "C", "clean", false, all(FIN, f("mistakes", "eq", 0))),
  ch("fillomino", "Quick fill", "Fill the grid within 45 s.", "C", "speed", false, speed(40, 45)),
  // Island Link (bridges): 150 + speed 40 (45 s) + clean build 10.
  ch("bridges", "Bridge builder", "Link every island.", "C", "finish", false, all(FIN)),
  ch("bridges", "Chartered engineer", "Link a Hard chain with no wrong bridges.", "H", "clean", false, all(FIN, f("mistakes", "eq", 0))),
  ch("bridges", "Iron bridge", "Link an Expert chain within 45 s.", "E", "speed", true, speed(40, 45)),

  /* ================================================================ Pattern */
  // Gridlock (unblock): 150 + speed 30 (40 s) + moves 20 (par).
  ch("unblock", "Clear road", "Free the gold block in par moves.", "C", "par", false, bonus(20), "unblock.par"),
  ch("unblock", "Rush hour", "Free the gold block within 40 s.", "C", "speed", false, speed(30, 40), "unblock.speed"),
  ch("unblock", "Green wave", "Score 200 on an Expert jam.", "E", "perfect", true, score(200)),
  // Tessellate (blockparty): 150 + speed 40 (40 s) + first time 10.
  ch("blockparty", "No second thoughts", "Fill the board without moving a piece twice.", "C", "clean", false, all(FIN, eff(10))),
  ch("blockparty", "Snap fit", "Fill the board within 40 s.", "C", "speed", false, speed(40, 40)),
  // Skid (iceslide): 150 + speed 30 (30 s) + slides 20 (par).
  ch("iceslide", "Ice cool", "Reach the exit in par slides.", "C", "par", false, all(FIN, f("slides", "lte", "@parSlides"))),
  ch("iceslide", "Black ice", "Score 200 on a Hard rink.", "H", "perfect", false, score(200)),
  // Topsy-Turvy (gravity): 150 + speed 30 (32 s) + tilts 20 (par).
  ch("gravity", "Right way up", "Sink every ball in par tilts.", "C", "par", false, bonus(20)),
  ch("gravity", "Head rush", "Sink every ball within 32 s.", "C", "speed", false, speed(30, 32)),
  // Gradient (tiles): 150 + speed 35 (30 s) + swaps 15 (par).
  ch("tiles", "Smooth blend", "Rebuild the gradient in par swaps.", "C", "par", false, bonus(15), "tiles.par"),
  ch("tiles", "Colour rush", "Rebuild the gradient within 30 s.", "C", "speed", false, speed(35, 30), "tiles.speed"),
  ch("tiles", "Spectrum", "Rebuild an Expert gradient in par swaps.", "E", "par", false, bonus(15)),
  // Turntable (rings): 150 + speed 35 (40 s) + turns 15 (par).
  ch("rings", "Full circle", "Match every spoke.", "C", "finish", false, all(FIN)),
  ch("rings", "Spin doctor", "Match every spoke in par turns.", "C", "par", false, bonus(15)),
  // Lightbender (laser): 150 + speed 40 (15 s) + mirrors 5 + first shot 5.
  ch("laser", "One shot", "Light all six gems with your first FIRE.", "C", "clean", false, all(FIN, f("fires", "eq", 1))),
  ch("laser", "Hall of mirrors", "Light all six on the first shot with par mirrors.", "C", "par", false, all(FIN, eff(10))),
  ch("laser", "Speed of light", "Light all six within 15 s.", "C", "speed", true, speed(40, 15)),
  // Chroma Lines (flow): 150 + speed 40 (20 s) + clean lines 10.
  ch("flow", "No redraws", "Join every pair without redrawing a line.", "C", "clean", false, all(FIN, f("redraws", "eq", 0))),
  ch("flow", "Paint stripper", "Join every pair within 20 s.", "C", "speed", false, speed(40, 20)),
  ch("flow", "Spaghetti junction", "Fill a Hard board.", "H", "finish", false, all(FIN)),
  // Pipeline (pipes): 150 + speed 40 (60 s) + taps 10 (par).
  ch("pipes", "No leaks", "Connect every pipe.", "C", "finish", false, all(FIN)),
  ch("pipes", "Plumber’s par", "Connect every pipe in par turns.", "C", "par", false, bonus(10)),
  ch("pipes", "Mains pressure", "Connect a Hard network within 60 s.", "H", "speed", false, speed(40, 60)),
  // Heave (push): 150 + speed 25 (45 s) + gold crate 10 + pushes 15 (par).
  ch("push", "Gold standard", "Finish with the gold crate on the gold mark.", "C", "target", false, all(FIN, f("goldHome", "eq", 1))),
  ch("push", "Heavy lifting", "Gold crate home and par pushes.", "C", "par", false, all(FIN, eff(25))),
  ch("push", "Crate expectations", "Place every crate within 45 s.", "C", "speed", false, speed(25, 45)),

  /* ================================================================ Speed */
  // Flash (reaction): reactions 186 + steady hand 15, capped at 200.
  ch("reaction", "Clean start", "Catch every flash with no false starts.", "C", "clean", false, all(f("falseStarts", "eq", 0), f("misses", "eq", 0), f("taps", "gte", 1))),
  ch("reaction", "Quarter second", "Average under 250 ms.", "C", "speed", false, all({ c: "avgMs", op: "lt", v: 250 })),
  ch("reaction", "Steady hand", "Catch all, no false starts, slowest within 50 ms of fastest.", "C", "maxout", false, all(f("depth.steady", "gte", 15))),
  ch("reaction", "Greased lightning", "Average under 180 ms with no false starts on Hard.", "H", "speed", true, all({ c: "avgMs", op: "lt", v: 180 }, f("falseStarts", "eq", 0), f("misses", "eq", 0))),
  // Bang On (stopwatch): closeness 150 + dead centre and zone streak up to 50.
  ch("stopwatch", "In the zone", "Stop all ten watches in the gold zone.", "C", "fullset", false, all({ c: "all", path: "depth.zone" }, len("depth.zone", "eq", 10))),
  ch("stopwatch", "Bang on", "Hit dead centre five times.", "C", "target", false, all(f("depth.centreHits", "gte", 5))),
  ch("stopwatch", "Ten in a row", "Stop all ten in the zone without a break.", "H", "streak", false, all(f("depth.bestStreak", "gte", 10))),
  // Ascend (numhunt): 150 + speed 40 (40 s) + flow 10.
  ch("numhunt", "No slips", "Tap all 24 without a wrong tap.", "C", "clean", false, all(FIN, f("wrongTaps", "eq", 0))),
  ch("numhunt", "In the flow", "Tap all 24 in one unbroken run of right taps.", "C", "streak", false, all(FIN, f("bestRun", "gte", 24))),
  ch("numhunt", "Stairway", "Tap all 24 within 40 s.", "C", "speed", false, speed(40, 40)),
  // Don't Break the Chain (chain): 150 + speed 50 (30 s).
  ch("chain", "Unbroken", "Tap all 40 charms.", "C", "finish", false, all(FIN)),
  ch("chain", "Chain reaction", "Tap all 40 within 30 s.", "C", "speed", false, speed(50, 30)),
  ch("chain", "Iron links", "Tap all 40 on Hard.", "H", "finish", false, all(FIN)),
  // Bonk (whack): hits 150 + combo 44 + diamonds 6.
  ch("whack", "Hedgehog friendly", "Bonk 30 or more without a wrong hat or a hedgehog.", "C", "clean", false, all(f("hits", "gte", 30), f("wrong", "eq", 0), f("bombs", "eq", 0))),
  ch("whack", "Diamond geezer", "Bonk every diamond.", "C", "fullset", false, all(f("depth.diamondHits", "gte", "@depth.diamondTotal"), f("depth.diamondTotal", "gte", 1))),
  ch("whack", "Combo king", "Bonk 47 in a row, each within 150 ms of rising.", "C", "combo", true, all(f("depth.combo", "gte", 44))),
  // Pull! (clayshoot): clays 110 + quick hits 40 + doubles 14 + streak 36.
  ch("clayshoot", "Bird lover", "Hit 15 clays without hitting a bird.", "C", "clean", false, all(f("hits", "gte", 15), f("birdHits", "eq", 0))),
  ch("clayshoot", "Double trouble", "Hit both clays of every double.", "C", "fullset", false, all(f("depth.doublesHit", "gte", "@depth.doublesTotal"), f("depth.doublesTotal", "gte", 1))),
  ch("clayshoot", "Dead eye", "Hit all 25 clays in a row, each within a quarter second.", "C", "streak", true, all(f("depth.streak", "gte", 36))),

  /* ================================================================ Attention */
  // Mixed Signals (stroop): finish 150 + speed 15 + streak 20 + gold words 15.
  ch("stroop", "Sorted", "Sort all 52 words.", "C", "finish", false, all({ c: "correct" }, f("depth.standard", "eq", 1))),
  ch("stroop", "All that glitters", "Sort every gold word.", "C", "fullset", false, all(f("depth.golds", "gte", "@depth.goldWords"), f("depth.goldWords", "gte", 1))),
  ch("stroop", "Colour blind", "Sort all 52 words right in a row.", "C", "streak", false, all(f("depth.streak", "gte", 20))),
  // Eagle Eye (symscan): 150 + speed 10 (20 s) + clean grids 40.
  ch("symscan", "Sharp eyes", "Finish all three grids clean.", "C", "clean", false, all(FIN, f("cleanGrids", "gte", 3))),
  ch("symscan", "Bird of prey", "Score 200 on Hard.", "H", "perfect", true, score(200)),
  // Double Take (spotdiff): 150 + speed 20 (40 s) + no wrong taps 10 + hidden difference 20.
  ch("spotdiff", "Seventh sense", "Find the hidden seventh difference.", "C", "fullset", false, all(FIN, f("hiddenPoints", "gte", 20))),
  ch("spotdiff", "No guesswork", "Find them all without a wrong tap.", "C", "clean", false, all(FIN, f("wrongTaps", "eq", 0))),
  ch("spotdiff", "Spot on", "Find them all within 40 s.", "C", "speed", false, speed(20, 40)),
  // Tally (countup): 150 + speed 50 (30 s).
  ch("countup", "Head count", "Get all four trays right.", "C", "finish", false, all(FIN, f("exactTrays", "gte", 4))),
  ch("countup", "Quick count", "Get all four right within 30 s.", "C", "speed", false, speed(50, 30)),
  // Labyrinth (maze): 150 + speed 30 (32 s) + moves 20 (par).
  ch("maze", "Shortest way out", "Reach the exit in par moves.", "C", "par", false, all(FIN, f("steps", "lte", "@parSteps"))),
  ch("maze", "Minotaur", "Score 200 on a Hard maze.", "H", "perfect", true, score(200)),
  // Matchmaker (pairmatch): 150 + speed 30 (60 s) + streak 5 + gold pair 15.
  ch("pairmatch", "Golden couple", "Find the gold pair in the first 30 s.", "C", "target", false, all(f("goldPoints", "gte", 15))),
  ch("pairmatch", "Total recall", "Match eight pairs in a row without a miss.", "C", "streak", false, all(f("streakPoints", "gte", 5))),
  ch("pairmatch", "Speed dating", "Find all 15 pairs within 60 s.", "C", "speed", false, speed(30, 60)),
  // Bomb Defusal (bomb): defuse 150 + speed 50 (30 s).
  ch("bomb", "Cool head", "Defuse the bomb.", "C", "finish", false, all(FIN)),
  ch("bomb", "Snip snip", "Defuse it within 30 s.", "C", "speed", false, speed(50, 30)),
  ch("bomb", "Bomb squad", "Defuse an Expert bomb.", "E", "finish", true, all(FIN)),

  /* ================================================================ Word */
  // Nucleus (wordsmith): words 180 + every-tile word 20.
  ch("wordsmith", "Every last letter", "Make a word that uses every tile.", "C", "maxout", false, all(f("pangramBonus", "gt", 0))),
  ch("wordsmith", "Fifteen and counting", "Make 15 words.", "C", "target", false, all(len("words", "gte", 15))),
  ch("wordsmith", "Nuclear", "Score 180 or more.", "C", "bigscore", false, score(180)),
  // Forage (wordhunt): words 150 + long words and gold 50.
  ch("wordhunt", "Gold digger", "Find a word through the gold tile.", "C", "target", false, all(len("goldWords", "gte", 1))),
  ch("wordhunt", "Long haul", "Find three words of six letters or more.", "C", "target", false, all(f("longWords", "gte", 3))),
  ch("wordhunt", "Clean forage", "Find 10 words without a single miss.", "C", "clean", false, all(len("words", "gte", 10), f("misses", "eq", 0))),
  ch("wordhunt", "Forager supreme", "Score 170 or more on Hard.", "H", "bigscore", true, score(170)),
  // Interlock (tilegrid): 150 + speed 20 (33 s) + big words 30.
  ch("tilegrid", "Locked in", "Place all 15 tiles.", "C", "finish", false, all(FIN)),
  ch("tilegrid", "Big words", "Finish with 5+ letter words scoring at least the solution’s.", "C", "maxout", false, all(FIN, f("bigWordPoints", "gte", 30))),
  // Slider (wordslide): 150 + speed 35 (33 s) + moves 15 (par).
  ch("wordslide", "Slick", "Make all five words in par moves.", "C", "par", false, bonus(15), "wordslide.par"),
  ch("wordslide", "Slide rule", "Make all five words within 33 s.", "C", "speed", false, speed(35, 33), "wordslide.speed"),
  // Lookout (wordsearch): 150 + speed 20 (40 s) + bonus word 30.
  ch("wordsearch", "Hidden gem", "Find the unlisted seventh word.", "C", "fullset", false, bonus(30)),
  ch("wordsearch", "Eagle-eyed", "Find all six within 40 s.", "C", "speed", false, speed(20, 40)),
  ch("wordsearch", "Crow’s nest", "Score 200 on Hard.", "H", "perfect", true, score(200)),
  // Roundabout (letterwheel): 150 + speed 20 (40 s) + bonus jar 30.
  ch("letterwheel", "Jar of five", "Drop five bonus words in the jar.", "C", "target", false, all(f("bonusWords", "gte", 5))),
  ch("letterwheel", "Jar full", "Finish with the jar full; a bonus word adds 1 to 4 drops.", "C", "maxout", false, all(FIN, f("jarPoints", "gte", 30))),
  ch("letterwheel", "Dizzy", "Fill the crossword within 40 s.", "C", "speed", false, speed(20, 40)),
  // Strikeout (strikeout): 150 + speed 20 (40 s) + early solves 20 + strikes left 10.
  ch("strikeout", "Five for five", "Solve all five words.", "C", "finish", false, all(FIN)),
  ch("strikeout", "Strike light", "Solve all five with two strikes or fewer.", "C", "clean", false, all(FIN, f("strikePoints", "gte", 10))),
  ch("strikeout", "Early bird", "Solve all five, each with 3 letters or more still hidden.", "C", "maxout", false, all(FIN, f("earlySolvePoints", "gte", 20))),
  // Cryptogrid (codeword): 150 + speed 40 (60 s) + clean crack 10.
  ch("codeword", "Clean crack", "Crack it without a wrong letter.", "C", "clean", false, bonus(10), "codeword.clean"),
  ch("codeword", "Codebreaker", "Crack it within 60 s.", "C", "speed", false, speed(40, 60), "codeword.speed"),
  ch("codeword", "Enigma", "Crack an Expert grid without a wrong letter.", "E", "clean", true, all(FIN, f("wrongEntered", "eq", 0))),
  // Swapword (swapword): 150 + speed 20 (60 s) + swaps 30 (par).
  ch("swapword", "Swap shop", "Finish in par swaps.", "C", "par", false, bonus(30), "swapword.par"),
  ch("swapword", "Quick swap", "Finish within 60 s.", "C", "speed", false, speed(20, 60), "swapword.speed"),

  /* ================================================================ Number */
  // Exact (target): 150 + speed 35 (30 s) + elegance 15.
  ch("target", "Bang on target", "Make the target exactly.", "C", "finish", false, all(FIN)),
  ch("target", "Elegant", "Make it with the fewest numbers possible.", "C", "par", false, all(FIN, f("tilesUsed", "lte", "@minTiles"))),
  ch("target", "Countdown", "Make it within 30 s.", "C", "speed", false, speed(35, 30)),
  // Operator (equation): 150 + speed 40 (60 s) + first try 10.
  ch("equation", "First time right", "Get all four equations right first time.", "C", "clean", false, all(FIN, f("cleanEquations", "gte", 4))),
  ch("equation", "Smooth operator", "Fill a Hard set within 60 s.", "H", "speed", false, speed(40, 60)),
  // Counterweight (balance): 150 + speed 35 (60 s) + hangs 15 (par).
  ch("balance", "Perfectly balanced", "Balance all four scales in par hangs.", "C", "par", false, all(FIN, f("hangsUsed", "lte", "@parHangs"))),
  ch("balance", "Heavyweight", "Balance all four within 60 s.", "C", "speed", false, speed(35, 60)),
  // Integer Pyramid (numpyramid): 150 + speed 40 (75 s) + clean pyramids 10.
  ch("numpyramid", "Solid base", "Build all four pyramids clean.", "C", "clean", false, all(FIN, f("cleanPyramids", "gte", 4))),
  ch("numpyramid", "Pharaoh", "Score 200 on Expert.", "E", "perfect", true, score(200)),
  // Brimful (measure): 150 + speed 35 (60 s) + pours 15 (par).
  ch("measure", "Fill her up", "Measure all four targets.", "C", "finish", false, all(FIN)),
  ch("measure", "Not a drop spilt", "Measure all four in par pours.", "C", "par", false, all(FIN, f("pours", "lte", "@parPours"))),
  ch("measure", "Quick pint", "Measure all four within 60 s.", "C", "speed", false, speed(35, 60)),
  // Checkout (checkout): 150 + speed 30 (60 s) + darts 10 + big finishes 10.
  ch("checkout", "Game shot", "Check out all five boards.", "C", "finish", false, all(FIN)),
  ch("checkout", "Fewest darts", "Check out all five in the fewest darts.", "C", "par", false, all(FIN, f("darts", "lte", "@fewestDarts"))),
  ch("checkout", "Big fish", "Take every big finish on offer.", "C", "maxout", false, all(FIN, f("bigFinishes", "gte", "@bigBoards"), f("bigBoards", "gte", 1))),
  // Ballpark (numline): accuracy 150 + speed 20 (60 s) + bullseyes 30.
  ch("numline", "In the ballpark", "Place all 15 with none wildly off.", "C", "clean", false, all(FIN, f("wild", "eq", 0))),
  ch("numline", "Bullseye", "Land eight bullseyes.", "C", "target", false, all(f("bullseyes", "gte", 8))),
  ch("numline", "Fifteen bulls", "Land a bullseye with every number.", "C", "maxout", true, all(f("bullseyes", "gte", 15))),
  // Tenfall (tendrop): 150 + speed 30 (60 s) + gold tiles 20.
  ch("tendrop", "Ten out of ten", "Hit all ten targets.", "C", "finish", false, all(f("cleared", "gte", 10))),
  ch("tendrop", "No overshoot", "Hit all ten without a reset.", "C", "clean", false, all(f("cleared", "gte", 10), f("resets", "eq", 0))),
  ch("tendrop", "Gold tens", "Hit all ten targets with a gold tile.", "C", "maxout", false, all(f("cleared", "gte", 10), f("goldTens", "gte", 10))),
  // Kakuro (kakuro): 150 + speed 40 (60 s) + clean grid 10.
  ch("kakuro", "Sum total", "Fill the grid with no wrong digits.", "C", "clean", false, all(FIN, f("mistakes", "eq", 0))),
  ch("kakuro", "Mental arithmetic", "Fill a Hard grid.", "H", "finish", false, all(FIN)),
  ch("kakuro", "Human calculator", "Fill the grid within 60 s.", "C", "speed", false, speed(40, 60)),

  /* ================================================================ Action */
  // Iron Wall (bastion): armour 110 + weak spots 30 + fast reloads 20 + drones 30 + base intact 10.
  ch("bastion", "Drone strike", "Down all three drones.", "C", "fullset", false, part("Drones", 30), "bastion.drones"),
  ch("bastion", "Hold the wall", "Keep the base untouched.", "C", "clean", false, part("Base intact", 10), "bastion.base"),
  ch("bastion", "Quick hands", "Make ten fast reloads.", "C", "maxout", false, part("Fast reloads", 20)),
  ch("bastion", "Weak at the knees", "Land 30 hits on glowing weak spots.", "C", "maxout", true, part("Weak spots", 30)),
  // Roofbound (flip): clean time 100 + perfect landings 60 + double flips 20 + flow streak 20.
  ch("flip", "Double or nothing", "Land eight double flips.", "C", "combo", false, all(full("Double flips", 20))),
  ch("flip", "Sweet spot", "Land every sweet spot.", "C", "fullset", false, all(full("Perfect landings", 60))),
  ch("flip", "Flow rider", "Make 50 clean jumps in a row.", "C", "streak", true, all(full("Flow streak", 20))),
  // Grappler (swing): course 110 + pars 40 + gates 10 + clean-swing streak 40.
  ch("swing", "Gatecrasher", "Fly through every gate.", "C", "fullset", false, all(full("Gates", 10))),
  ch("swing", "Vine time", "Make ten runs of eight clean swings.", "C", "streak", false, all(line("Clean-swing streak", "gte", 20))),
  ch("swing", "King of the swingers", "Get 70 % of the way on Expert.", "E", "maxout", false, all(full("Course", 110))),
  // Moon Climb (ricochet): height 125 + flow 30 + lantern rides 30 + scrolls 15.
  ch("ricochet", "Scroll keeper", "Grab all three scrolls.", "C", "fullset", false, part("Scrolls", 15)),
  ch("ricochet", "Lantern lift", "Ride all six sky lanterns.", "C", "fullset", false, part("Lantern rides", 30)),
  ch("ricochet", "Moonwalker", "Climb 245 m on Hard.", "H", "maxout", false, part("Height", 125)),
  // High Rise (skyline): floors 140 + perfect drops 30 + perfect streak 10 + gold blocks 20.
  ch("skyline", "Gold top", "Land all five gold blocks perfectly.", "C", "fullset", false, part("Gold blocks", 20), "skyline.gold"),
  ch("skyline", "Thirty perfect", "Make 30 perfect drops.", "C", "target", false, all(f("perfects", "gte", 30)), "skyline.perfects"),
  ch("skyline", "Steady crane", "Make ten perfect drops in a row.", "C", "streak", false, part("Perfect streak", 10)),
  ch("skyline", "Skyscraper", "Build 61 floors on Expert.", "E", "maxout", true, part("Floors", 140)),
  // Slice (slice): food 120 + combos 40 + golden fruit 20 + bread tickets 10 + dodges 10.
  ch("slice", "Mild", "Score 100 without cutting a chilli.", "C", "clean", false, all(sc("gte", 100), f("bombsHit", "eq", 0))),
  ch("slice", "Golden delicious", "Slice every golden fruit.", "C", "fullset", false, all(f("goldenSliced", "gte", "@goldenDealt"), f("goldenDealt", "gte", 1))),
  ch("slice", "Combo chef", "Slice 110 foods in combos.", "C", "combo", false, all(tile("Combo foods", "gte", 110))),
  // Orbit (orbit): planets 130 + speed 20 + stardust 15 + slingshots 12 + asteroid fields 12 + perfect orbits 11.
  ch("orbit", "Sun seeker", "Reach the sun.", "C", "finish", false, all(f("finished", "eq", 1))),
  ch("orbit", "Slingshot", "Pull all four slingshots.", "C", "fullset", false, all(full("Slingshots", 12))),
  ch("orbit", "Stargazer", "Collect all the stardust on Hard.", "H", "fullset", false, all(full("Stardust", 15))),

  /* ================================================================ Retro */
  // Tempo (beat): accuracy 130 + fever 25 + golden notes 15 + double taps 15 + perfect streak 15.
  ch("beat", "Fever pitch", "Start all four fevers.", "C", "fullset", false, part("Fever", 25)),
  ch("beat", "Golden ear", "Hit every golden note dead on.", "C", "maxout", false, part("Golden notes", 15), "beat.gold"),
  ch("beat", "Encore", "Score 180 or more.", "C", "bigscore", true, score(180), "beat.score180"),
  // Blockzone (blockfall): lines 95 + pieces placed 65 + multi-line clears 24 + low stack 16.
  ch("blockfall", "Thirty lines", "Clear 30 lines.", "C", "target", false, all(f("lines", "gte", 30))),
  ch("blockfall", "Low rider", "Finish with the stack in the bottom four rows.", "C", "clean", false, part("Low stack", 16), "blockfall.low"),
  ch("blockfall", "Multi-tasker", "Clear four lines at once twice (or six doubles).", "C", "combo", false, part("Multi-line clears", 24), "blockfall.multi"),
  // Breaker (breaker): bricks 140 + clear 10 + speed 20 + gold bricks 30.
  ch("breaker", "Twenty-four carat", "Break every gold brick.", "C", "fullset", false, all(f("goldBroken", "gte", "@goldDealt"), f("goldDealt", "gte", 1))),
  ch("breaker", "No drops", "Score 100 without losing a ball.", "C", "clean", false, all(sc("gte", 100), f("losses", "eq", 0))),
  ch("breaker", "Wall breaker", "Clear the whole wall on Hard.", "H", "finish", false, all(f("cleared", "eq", 1))),
  // Fission (burst): atoms 140 + wave clears 35 + golden atoms 25.
  ch("burst", "Golden touch", "Pop all five golden atoms.", "C", "fullset", false, all(f("goldens", "gte", "@goldensDealt"), f("goldensDealt", "gte", 5))),
  ch("burst", "Sharpshooter", "Pop 40 atoms without a wasted-shot cost.", "C", "clean", false, all(f("atoms", "gte", 40), f("missCost", "eq", 0))),
  ch("burst", "Meltdown", "Clear all five waves.", "C", "finish", false, all(f("done", "eq", 1))),
  // Spacewalk (cross): rows and crossings 150 + no-stop streak 40 + close calls 10.
  ch("cross", "Unscathed", "Make four crossings without a hit.", "C", "clean", false, all(f("crossings", "gte", 4), f("livesLost", "eq", 0))),
  ch("cross", "Near miss", "Make ten close calls.", "C", "target", false, all(f("closeCalls", "gte", 10))),
  ch("cross", "Keep moving", "Make four no-stop crossings, each after a no-stop one.", "C", "streak", true, all(f("streakPts", "gte", 40))),
  // Hover (hover): barriers 120 + star chains 30 + gold stars 20 + tight gates 20 + centre lines 10.
  ch("hover", "Tight squeeze", "Thread all five tight gates.", "C", "fullset", false, all(f("tightGates", "gte", 5))),
  ch("hover", "Chain gang", "Complete all five star chains.", "C", "fullset", false, all(f("chainPts", "gte", 30))),
  ch("hover", "All the way", "Pass every barrier.", "C", "finish", true, all(f("gates", "gte", "@totalGates"), f("totalGates", "gte", 1))),
  // Pinball (pinball): table points 130 + J-O-U-L-Z 20 + multiball 20 + jackpots 15 + ramp combos 15.
  ch("pinball", "Multiball madness", "Start multiball.", "C", "target", false, part("Multiball", 20), "pinball.multiball"),
  ch("pinball", "Spell it out", "Spell J-O-U-L-Z twice.", "C", "maxout", false, part("J-O-U-L-Z", 20), "pinball.joulz"),
  ch("pinball", "Jackpot", "Hit three jackpots.", "C", "fullset", true, part("Jackpots", 15)),
  // Rally (rally): gold-ball hits 140 + pink pads 30 + gold targets 30.
  ch("rally", "Pink pong", "Strike pink pads five times.", "C", "target", false, all(line("Pink pads", "gte", 15))),
  ch("rally", "Target practice", "Hit all six gold targets.", "C", "fullset", false, part("Gold targets", 30)),
  ch("rally", "Rally king", "Return 23 gold balls on Hard.", "H", "maxout", false, part("Gold-ball hits", 140)),
  // Meteor (snake): stars 120 + gold stars 40 + combos 20 + lane rides 10 + warp stars 10.
  ch("snake", "Star eater", "Eat 28 stars; a gold star counts as two.", "C", "target", false, all(f("meteorParts.core", "gte", 120))),
  ch("snake", "Comet tail", "Score 150 or more.", "C", "bigscore", false, score(150)),
  ch("snake", "Golden comet", "Eat all seven gold stars.", "C", "fullset", false, all(f("goldStars", "gte", "@goldStarsDealt"), f("goldStarsDealt", "gte", 7))),
  // Wavefront (wavefront): ships 150 + boss destroyed 10 + boss speed 10 + saucers 20 + cannons and weak points 10.
  ch("wavefront", "Boss fight", "Destroy the boss.", "C", "finish", false, all(f("bossKilled", "gte", 1))),
  ch("wavefront", "Saucer spotter", "Shoot all five saucers.", "C", "fullset", false, all(f("saucers", "gte", 5))),
  ch("wavefront", "Not a scratch", "Destroy the boss without losing a life.", "H", "clean", true, all(f("bossKilled", "gte", 1), f("lives", "gte", 3))),

  /* ================================================================ Sports */
  // Ringer (alleyroll): ring points 140 + gold cup 30 + roll streak 20 + pocket hits 10.
  ch("alleyroll", "Pocket rocket", "Land in both 100 pockets.", "C", "fullset", false, part("Pocket hits", 10)),
  ch("alleyroll", "Hot hand", "Roll five 30+ balls, each straight after another 30+ ball.", "C", "streak", false, part("Roll streak", 20)),
  ch("alleyroll", "Gold cup final", "Land in the gold cup three times on Hard.", "H", "fullset", false, part("Gold cup", 30)),
  // Swish (bintoss): buckets 130 + far buckets 36 + hoops 24 + all ten in 10.
  ch("bintoss", "Hoop dreams", "Throw through all three hoops.", "C", "fullset", false, part("Hoops", 24), "bintoss.hoops"),
  ch("bintoss", "Nothing but bucket", "Get all ten in.", "C", "clean", false, part("All ten in", 10), "bintoss.finish"),
  ch("bintoss", "Long range", "Hit the far bucket on all six chances.", "C", "maxout", true, part("Far buckets", 36)),
  // Flightpath (bullseye): dart total 150 + bull streaks 30 + dead-centre darts 20.
  ch("bullseye", "On a roll", "Throw four golds in a row.", "C", "streak", false, all(line("Bull streaks", "gte", 6))),
  ch("bullseye", "Dead centre", "Hit the dead-centre ring on every board with a 10 in the middle.", "C", "maxout", false, part("Dead-centre darts", 20), "bullseye.dead"),
  ch("bullseye", "One hundred and twelve", "Score 112 with your ten darts.", "C", "maxout", false, part("Dart total", 150)),
  // Crazy Golf (minigolf): holes 120 + par 40 + under par 20 + speed 20 (53 s).
  ch("minigolf", "Birdie", "Hole one under par.", "C", "par", false, all(line("Under par", "gte", 4))),
  ch("minigolf", "Par for the course", "Hole all five in par or better.", "C", "par", false, part("Par", 40)),
  ch("minigolf", "Quick round", "Hole all five within 53 s.", "C", "speed", false, part("Speed", 20)),
  ch("minigolf", "Under, under", "Hole all five under par on Hard.", "H", "par", true, part("Under par", 20)),
  // Cue Ball (pool): your balls 140 + black 10 + pots in a row 30 + speed 20 (69 s).
  ch("pool", "Behind the eight", "Pot the black.", "C", "finish", false, part("Black", 10), "pool.black"),
  ch("pool", "Clean break", "Pot the black without a foul.", "C", "clean", false, all(full("Black", 10), f("fouls", "eq", 0))),
  ch("pool", "Run out", "Pot a ball straight after another, six times.", "C", "streak", false, part("Pots in a row", 30), "pool.streak"),
  // Curl Champ (curling): stones 150 + takeouts 20 + red ring 20 + holding shot 10.
  ch("curling", "Shot stone", "Finish holding shot.", "C", "target", false, part("Holding shot", 10)),
  ch("curling", "House clearance", "Knock every red out of the house.", "C", "maxout", false, part("Takeouts", 20)),
  ch("curling", "Red ring circus", "Stop all eight stones in the red ring.", "C", "fullset", true, part("Red ring", 20)),
  // Home Run (homerun): distance 120 + home runs 40 + bonus signs 20 + perfect streak 20.
  ch("homerun", "Sign here", "Hit the lit sign five times.", "C", "target", false, all(line("Bonus signs", "gte", 10))),
  ch("homerun", "Out of the park", "Hit ten home runs.", "C", "fullset", false, part("Home runs", 40), "homerun.homers"),
  ch("homerun", "Perfect ten", "Make ten perfect swings in a row.", "C", "streak", true, part("Perfect streak", 20), "homerun.streak"),
  // Top Bins (freekick): goals 120 + targets 40 + round the wall 10 + curl bonus 20 + five in a row 10.
  ch("freekick", "Five alive", "Score five in a row.", "C", "streak", false, part("Five in a row", 10)),
  ch("freekick", "Bend it", "Score five well-bent goals.", "C", "target", false, all(line("Curl bonus", "gte", 10))),
  ch("freekick", "Top bins", "Score through all four hoops.", "C", "fullset", true, part("Targets", 40)),
  // Apex (racing): pace 160 + clean sectors 40.
  ch("racing", "Clean half", "Drive four sectors clean.", "C", "clean", false, all(line("Clean sectors", "gte", 20))),
  ch("racing", "Two hundred club", "Average 200 km/h.", "C", "speed", false, all(line("Pace", "gte", 110))),
  ch("racing", "Grand slam", "Drive all eight sectors clean on Expert.", "E", "clean", false, part("Clean sectors", 40)),

  /* ================================================================ Cards and Board */
  // Five Hands (fivehands): rows plus the picked column, × 1.4, capped at 200.
  ch("fivehands", "Handsome", "Score 150 or more.", "C", "bigscore", false, score(150)),
  ch("fivehands", "Pick of the bunch", "Pick the best bonus column on the table.", "C", "par", false, all(f("column", "gte", 0), f("columnPoints", "gte", "@bestColumnPoints"))),
  ch("fivehands", "High roller", "Score 170 or more on Hard.", "H", "bigscore", true, score(170)),
  // Free Cell (freecell): cards 105 + par moves 50 + speed 45 (32 s).
  ch("freecell", "All home", "Get all 40 cards home.", "C", "finish", false, part("Cards", 105)),
  ch("freecell", "By the book", "Finish in par moves.", "C", "par", false, part("Par moves", 50)),
  ch("freecell", "Card sharp", "Finish within 32 s.", "C", "speed", true, part("Speed", 45)),
  // Mahjong Solitaire (mahjong): pairs 150 + no shuffles 20 + speed 30 (65 s).
  ch("mahjong", "No shuffle", "Clear the stack without a Shuffle.", "C", "clean", false, all(full("Pairs", 150), full("No shuffles", 20))),
  ch("mahjong", "Tile rush", "Clear a Hard stack within 65 s.", "H", "speed", false, part("Speed", 30)),
  // Minefield (minesweeper): safe squares 150 + no mines hit 20 + speed 30 (50 s).
  ch("minesweeper", "Light feet", "Clear the board without hitting a mine.", "C", "clean", false, all(full("Safe squares", 150), full("No mines hit", 20))),
  ch("minesweeper", "Sweep", "Clear the board within 50 s.", "C", "speed", false, part("Speed", 30)),
  ch("minesweeper", "Bomb disposal", "Clear an Expert field.", "E", "finish", true, part("Safe squares", 150)),
  // Thirteen (pyramid): pyramid cards 140 + cleared 15 + speed 25 (20 s) + pyramid pairs 20.
  ch("pyramid", "Lucky thirteen", "Clear the pyramid.", "C", "finish", false, part("Cleared", 15)),
  ch("pyramid", "Paired up", "Make ten pairs from two pyramid cards.", "C", "combo", false, part("Pyramid pairs", 20)),
  ch("pyramid", "Unlucky for some", "Clear the pyramid within 20 s.", "C", "speed", false, part("Speed", 25)),
  // Summit (tripeaks): cards 105 + peak tops 30 + longest run 10 + clear 10 + stock par 20 + speed 25 (20 s).
  ch("tripeaks", "Peak bagger", "Clear all three peak tops.", "C", "fullset", false, part("Peak tops", 30)),
  ch("tripeaks", "Up and down", "Make a run of ten cards.", "C", "streak", false, part("Longest run", 10)),
  ch("tripeaks", "Base camp", "Clear it within stock par.", "C", "par", false, part("Stock par", 20)),
  ch("tripeaks", "Summit sprint", "Clear a Hard deal within 20 s.", "H", "speed", true, part("Speed", 25)),

  /* ================================================================ Strategy */
  // Ball Tracker (balltrack): marbles home 140 + gold marbles 25 + combos 20 + boosted marbles 15.
  ch("balltrack", "Combo breaker", "Get ten combos: marbles home from the third in a row onwards.", "C", "combo", false, all(line("Combos", "gte", 10))),
  ch("balltrack", "Golden marbles", "Send all six gold marbles home.", "C", "fullset", false, all(full("Gold marbles", 25))),
  ch("balltrack", "Lost no marbles", "Send all 36 marbles home.", "C", "maxout", true, all(full("Marbles home", 140))),
  // Coral Pop (bubble): bubbles 120 + reef cleared 10 + speed 10 + chests 30 + bank shots 15 + combos 15.
  ch("bubble", "Reef raider", "Clear the whole reef.", "C", "finish", false, part("Reef cleared", 10), "bubble.clear"),
  ch("bubble", "Treasure chest", "Drop all six chests.", "C", "fullset", false, part("Chests", 30), "bubble.chests"),
  ch("bubble", "Off the wall", "Make 30 bank shots on Hard.", "H", "maxout", false, part("Bank shots", 15)),
  // Rainbow Bridge (inkbridge): levels 120 + ink par 30 + trick shots 20 + clovers 10 + speed 20.
  ch("inkbridge", "Lucky clover", "Collect both clovers.", "C", "fullset", false, all(full("Clovers", 10))),
  ch("inkbridge", "Ink saver", "Finish every level within ink par.", "C", "par", false, all(full("Ink par", 30))),
  ch("inkbridge", "Show-off", "Land all four trick shots.", "C", "fullset", true, all(full("Trick shots", 20))),
  // Gemstone (matchup): gems 108 + treasure 36 + goals 36 + ice 10 + big lines 10.
  ch("matchup", "Ice breaker", "Break all ten frozen cells.", "C", "maxout", false, all(full("Ice", 10))),
  ch("matchup", "Goal getter", "Meet all six colour goals.", "C", "fullset", false, all(full("Colour goals", 36))),
  ch("matchup", "Treasure hunter", "Bring all six treasures down on Expert.", "E", "fullset", false, all(full("Treasure", 36))),
  // Tilt (tilt): mazes 140 + par times 24 + clean run 12 + speed 24 (60 s).
  ch("tilt", "No falls", "Finish all four mazes without a marble falling.", "C", "clean", false, all(full("Clean run", 12))),
  ch("tilt", "Par four", "Beat par time in all four mazes.", "C", "par", false, all(full("Par", 24))),
  ch("tilt", "Marble madness", "Finish all four Hard mazes within 60 s.", "H", "speed", true, all(full("Speed", 24))),
];
/* eslint-enable max-len */

/** Levels whose challenges can be completed now (wave 2: Classic only; Hard and Expert wait for wave 3.5). */
export const LIVE_CHALLENGE_LEVELS: readonly ChallengeLevel[] = ["classic"];
