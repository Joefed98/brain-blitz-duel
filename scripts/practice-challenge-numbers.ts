/**
 * Numbers in goals match their checks (wave 2 C1b; practice-goals-check section 7): for every one of the 261
 * challenges, every number in its goal's text and every threshold its check reads, against the live game.
 *
 *  - Each number in the text ("Tap all 24", "within 40 s", "five times", "seventh") must be either a threshold its
 *    check reads (the same number) or declared here with the live value it stands for (`say`), which must match.
 *  - Each threshold the check reads must be either a number in the text, a maximum proved against the live spec
 *    (bonus / speed maxima against the standard's rules, part and line maxima against the arcade specs), or declared
 *    here with the live value it is (`th`), which must match.
 *  - The catalogue (names, goals, levels, coin marks, every score goal's number) must be docs/challenges/catalogue.md's.
 *
 * Live values come from the games' own constants and specs, or from each game's live help text (PUZZLE_INSTRUCTIONS,
 * generated from those constants). A retune that moves a number fails here.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";

import { ARCADE_STANDARD } from "../src/lib/arcade/standard";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { FLIP_V11 } from "../src/lib/arcade/flip";
import { BT_STD } from "../src/lib/arcade/ballTrack";
import { ORBIT_STD } from "../src/lib/arcade/orbitRev3";
import { inkStdSpecFor } from "../src/lib/arcade/inkBridge";
import { SWING_V17_CORE, SWING_V17_FULL, SWING_V17_GATES, SWING_V17_STREAK_BLOCK, SWING_V17_STREAK_EACH, SWING_V17_STREAK_MAX, SWING_V17_PAR_POINTS, SWING_V17_GATE_POINTS } from "../src/lib/arcade/swing";
import { MATCHUP_V12_GOALS, MATCHUP_V12_GOALS_MAX, MATCHUP_V12_ICE_MAX, MATCHUP_V12_TREASURES, MATCHUP_V12_TREASURE_MAX } from "../src/lib/arcade/matchup";
import { TILT_P_CLEAN_POINTS, TILT_P_PAR_MAX, TILT_P_SPEED_POINTS, TILT_S_MAZES } from "../src/lib/arcade/tilt";
import { CLASH_QUEUE, CLASH_STD_STREAK } from "../src/lib/arcade/colourClash";
import { CLAY_CONFIG, CLAY_QUICK_FULL_TICKS, CLAY_STREAK_POINTS } from "../src/lib/arcade/clayShoot";
import { WHACK_COMBO_FULL_PCT, WHACK_COMBO_POINTS, WHACK_QUICK_FULL_TICKS, whackComboMaxPips, whackComboMultiplier, whackGame } from "../src/lib/arcade/whack";
import { SKYLINE_V9_FULL_AT } from "../src/lib/arcade/skyline";
import { SLICE_V12_COMBO_FULL } from "../src/lib/arcade/slice";
import { SNAKE_STD_CORE_MAX, SNAKE_STD_GOLDS, SNAKE_V12_CORE_STARS, SNAKE_V12_GOLD_CORE } from "../src/lib/arcade/snake";
import { WAV_LIVES, WAV_X_SAUCERS } from "../src/lib/arcade/wavefront";
import { CROSS_V11_CLOSE_MAX, CROSS_V11_FLOW_EACH, CROSS_V11_FLOW_MAX } from "../src/lib/arcade/cross";
import { BURST_V10_GOLDENS, BURST_V10_WAVES } from "../src/lib/arcade/burst";
import { HOVER_STD_CHAINS } from "../src/lib/arcade/hover";
import { BF_LOW_FULL } from "../src/lib/arcade/blockfall";
import { TICKS_PER_SECOND } from "../src/lib/arcade/engine";
import { FLASH_STEADY_TIGHT_MS, FLASH_STEADY_TIGHT_POINTS } from "../src/lib/duel/depth/flash";
import { NUMHUNT_COUNT } from "../src/lib/duel/types";
import { ASCEND_STD, PAIR_STD, SCAN_STD, SPOT_STD } from "../src/lib/duel/standard/attention";
import { STD_INTERLOCK, STD_ROUNDABOUT, STD_STRIKEOUT } from "../src/lib/duel/standard/word";
import { PAR_MOVES_STD } from "../src/lib/duel/parMoves";
import { PATTERN_STD } from "../src/lib/duel/standard/patternRules";
import { LOGIC_STANDARD } from "../src/lib/duel/standard/logicRules";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { PRACTICE_CHALLENGES, type ChallengeCond, type PracticeChallenge } from "../src/lib/duel/practiceChallenges";

export interface NumberResult {
  ok: boolean;
  label: string;
}

const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twice: 2,
  fifteen: 15, twenty: 20, thirty: 30, fifty: 50, seventh: 7,
};

/** Every number a goal's text states (digits and number words; "1.4" style decimals are not used). */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d+(?:,\d{3})*/g)) out.push(Number(m[0].replace(/,/g, "")));
  for (const w of text.toLowerCase().match(/[a-z]+/g) ?? []) if (w in WORDS) out.push(WORDS[w]!);
  return out;
}

/** The live help's SCORE text for a game. */
const help = (type: string): string => String((PUZZLE_INSTRUCTIONS as any)[type]?.score ?? "");
/** A count the live help states as "all N <noun>" / "the N <noun>" / "N <noun>" (digits or words). */
function helpCount(type: string, noun: string): number {
  const text = help(type);
  const re = new RegExp(`(?:all |the |)(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen)\\s+${noun}`, "i");
  const m = re.exec(text);
  if (!m) return NaN;
  const v = m[1]!.toLowerCase();
  return /^\d+$/.test(v) ? Number(v) : v === "twelve" ? 12 : (WORDS[v] ?? NaN);
}

/** A live arcade spec's part (ARCADE_STANDARD, LIVE_BANDS std, or the reveal's own specs). */
function specPart(type: string, label: string): { max: number; of?: number; how?: string } | null {
  const specs: any[] = [ARCADE_STANDARD[type]?.spec, (LIVE_BANDS as any)[type]?.std];
  if (type === "flip") specs.push(FLIP_V11);
  if (type === "balltrack") specs.push(BT_STD);
  if (type === "orbit") specs.push(ORBIT_STD);
  if (type === "inkbridge") specs.push(inkStdSpecFor(14));
  if (type === "swing")
    specs.push({ parts: [{ label: "Course", max: SWING_V17_CORE }, { label: "Pars", max: SWING_V17_PAR_POINTS }, { label: "Gates", max: SWING_V17_GATE_POINTS * SWING_V17_GATES, of: SWING_V17_GATES }, { label: "Clean-swing streak", max: SWING_V17_STREAK_MAX }] });
  if (type === "matchup")
    specs.push({ parts: [{ label: "Treasure", max: MATCHUP_V12_TREASURE_MAX, of: MATCHUP_V12_TREASURES }, { label: "Colour goals", max: MATCHUP_V12_GOALS_MAX, of: MATCHUP_V12_GOALS }, { label: "Ice", max: MATCHUP_V12_ICE_MAX, of: MATCHUP_V12_ICE_MAX }] });
  if (type === "tilt")
    specs.push({ parts: [{ label: "Par", max: TILT_P_PAR_MAX, of: TILT_S_MAZES }, { label: "Clean run", max: TILT_P_CLEAN_POINTS, of: TILT_S_MAZES }, { label: "Speed", max: TILT_P_SPEED_POINTS }] });
  for (const s of specs) {
    const p = s?.parts?.find((x: any) => x.label === label);
    if (p) return { max: p.max, of: p.of, how: p.how };
  }
  return null;
}
const of = (type: string, label: string) => specPart(type, label)?.of ?? NaN;
const maxOf = (type: string, label: string) => specPart(type, label)?.max ?? NaN;
/** "within N s" in a spec part's how text. */
const withinS = (type: string, label: string) => Number(/within (\d+) s/.exec(specPart(type, label)?.how ?? "")?.[1] ?? NaN);

/** Bonk: the shortest unbroken run from the start, every hit at full quickness, that fills the combo part, on the deal with the most targets. */
function whackComboRun(): number {
  let worst = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const total = (whackGame.init(seed * 7919) as any).schedule.total as number;
    const maxPips = whackComboMaxPips(total);
    let pips = 0;
    let n = 0;
    while (n < total && Math.floor((WHACK_COMBO_POINTS * 100 * pips) / (maxPips * WHACK_COMBO_FULL_PCT)) < WHACK_COMBO_POINTS) {
      n += 1;
      pips += (whackComboMultiplier(n) - 1) * 8;
    }
    worst = Math.max(worst, n);
  }
  return worst;
}

/** Per challenge: the text's numbers (`say`) and the check's thresholds (`th`) that aren't the same number, with live values. */
interface Expect {
  say?: [number, number][];
  th?: [number, number][];
}

const ms = (ticks: number) => Math.round((ticks * 1000) / TICKS_PER_SECOND);

function expectations(): Record<string, Expect> {
  const whack42 = whackComboRun();
  return {
    // Speed and finish counts from the live help text.
    "sudoku.box-clever": { say: [[45, LOGIC_STANDARD.sudoku.fullByS]] },
    "numhunt.no-slips": { say: [[24, NUMHUNT_COUNT]] },
    "numhunt.in-the-flow": { say: [[24, NUMHUNT_COUNT], [1, 1]], th: [[24, NUMHUNT_COUNT]] },
    "numhunt.stairway": { say: [[24, NUMHUNT_COUNT]] },
    "chain.unbroken": { say: [[40, helpCount("chain", "links")]] },
    "chain.chain-reaction": { say: [[40, helpCount("chain", "links")]] },
    "chain.iron-links": { say: [[40, helpCount("chain", "links")]] },
    "reaction.steady-hand": { say: [[50, FLASH_STEADY_TIGHT_MS]], th: [[15, FLASH_STEADY_TIGHT_POINTS]] },
    "stopwatch.in-the-zone": { say: [[10, helpCount("stopwatch", "watches") || 10]], th: [[10, Number(/over the (\w+)/.exec(help("stopwatch"))?.[1] === "ten" ? 10 : NaN)]] },
    "stopwatch.ten-in-a-row": { say: [[10, 10]] },
    "whack.combo-king": { say: [[47, whack42], [150, ms(WHACK_QUICK_FULL_TICKS)]], th: [[44, WHACK_COMBO_POINTS]] },
    "whack.diamond-geezer": { th: [[1, 1]] },
    "clayshoot.double-trouble": { th: [[1, 1]] },
    "clayshoot.dead-eye": { say: [[25, CLAY_CONFIG.clays]], th: [[36, CLAY_STREAK_POINTS]] },
    "stroop.sorted": { say: [[52, CLASH_QUEUE]], th: [[1, 1]] },
    "stroop.all-that-glitters": { th: [[1, 1]] },
    "stroop.colour-blind": { say: [[52, CLASH_QUEUE]], th: [[20, CLASH_STD_STREAK]] },
    "symscan.sharp-eyes": { say: [[3, helpCount("symscan", "grids")]], th: [[3, helpCount("symscan", "grids")]] },
    "spotdiff.seventh-sense": { say: [[7, help("spotdiff").includes("seventh") ? 7 : NaN]], th: [[20, SPOT_STD.hidden]] },
    "countup.head-count": { say: [[4, helpCount("countup", "trays")]], th: [[4, helpCount("countup", "trays")]] },
    "countup.quick-count": { say: [[4, helpCount("countup", "trays")]] },
    "maze.shortest-way-out": {},
    "pairmatch.golden-couple": { say: [[30, PAIR_STD.goldWindowMs / 1000]], th: [[15, PAIR_STD.gold]] },
    "pairmatch.total-recall": { say: [[8, PAIR_STD.streakFrom + PAIR_STD.streak]], th: [[5, PAIR_STD.streak]] },
    "pairmatch.speed-dating": { say: [[15, helpCount("pairmatch", "pairs")]] },
    "laser.one-shot": { say: [[6, helpCount("laser", "gems")]], th: [[1, 1]] },
    "laser.hall-of-mirrors": { say: [[6, helpCount("laser", "gems")]], th: [[10, Number(/Mirrors:[^.]*up to (\d+)/.exec(help("laser"))?.[1]) + Number(/First shot:[^.]*up to (\d+)/.exec(help("laser"))?.[1])]] },
    "laser.speed-of-light": { say: [[6, helpCount("laser", "gems")]] },
    "blockparty.no-second-thoughts": { say: [[2, 2]], th: [[10, Number(/First time:[^.]*up to (\d+)/.exec(help("blockparty"))?.[1] ?? 10)]] },
    "push.heavy-lifting": { th: [[25, Number(/Gold crate:[^.]*up to (\d+)/.exec(help("push"))?.[1]) + (PATTERN_STD.push.par ?? NaN)]] },
    "gravity.right-way-up": { th: [[20, PAR_MOVES_STD.par]] },
    "wordsmith.every-last-letter": { th: [[0, 0]] },
    "wordhunt.gold-digger": { th: [[1, 1]] },
    "tilegrid.locked-in": { say: [[15, helpCount("tilegrid", "tiles")]] },
    "tilegrid.big-words": { th: [[30, STD_INTERLOCK.bigMax]] },
    "wordslide.slick": { say: [[5, helpCount("wordslide", "rows")]] },
    "wordslide.par": { say: [[5, helpCount("wordslide", "rows")]] },
    "wordslide.speed": { say: [[5, helpCount("wordslide", "rows")]] },
    "wordsearch.hidden-gem": { say: [[7, helpCount("wordsearch", "listed") + 1]] },
    "wordsearch.eagle-eyed": { say: [[6, helpCount("wordsearch", "listed")]] },
    "letterwheel.jar-full": { th: [[30, STD_ROUNDABOUT.jar]] },
    "strikeout.five-for-five": { say: [[5, helpCount("strikeout", "words")]] },
    "strikeout.strike-light": { say: [[5, helpCount("strikeout", "words")], [2, STD_STRIKEOUT.strikeMax / STD_STRIKEOUT.strikeLeft === 10 ? 2 : NaN]], th: [[10, STD_STRIKEOUT.strikeMax]] },
    "strikeout.early-bird": { say: [[5, helpCount("strikeout", "words")], [3, STD_STRIKEOUT.earlyHidden]], th: [[20, STD_STRIKEOUT.earlySolveMax]] },
    "equation.first-time-right": { say: [[4, helpCount("equation", "equations")]], th: [[4, helpCount("equation", "equations")]] },
    "equation.smooth-operator": {},
    "balance.perfectly-balanced": { say: [[4, helpCount("balance", "scales")]] },
    "balance.heavyweight": { say: [[4, helpCount("balance", "scales")]] },
    "numpyramid.solid-base": { say: [[4, helpCount("numpyramid", "pyramids")]], th: [[4, helpCount("numpyramid", "pyramids")]] },
    "measure.fill-her-up": { say: [[4, helpCount("measure", "puzzles")]] },
    "measure.not-a-drop-spilt": { say: [[4, helpCount("measure", "puzzles")]] },
    "measure.quick-pint": { say: [[4, helpCount("measure", "puzzles")]] },
    "checkout.game-shot": { say: [[5, helpCount("checkout", "boards")]] },
    "checkout.fewest-darts": { say: [[5, helpCount("checkout", "boards")]] },
    "checkout.big-fish": { th: [[1, 1]] },
    "numline.in-the-ballpark": { say: [[15, helpCount("numline", "numbers")]] },
    "numline.fifteen-bulls": { th: [[15, helpCount("numline", "numbers")]] },
    "tendrop.ten-out-of-ten": { th: [[10, helpCount("tendrop", "targets")]] },
    "tendrop.no-overshoot": { th: [[10, helpCount("tendrop", "targets")]] },
    "tendrop.gold-tens": { th: [[10, helpCount("tendrop", "targets")]] },
    // Arcade: counts from the spec parts' `of`.
    "bastion.drones": { say: [[3, of("bastion", "Drones")]] },
    "bastion.quick-hands": { say: [[10, of("bastion", "Fast reloads")]] },
    "bastion.weak-at-the-knees": { say: [[30, of("bastion", "Weak spots")]] },
    "flip.double-or-nothing": { say: [[8, of("flip", "Double flips")]] },
    "flip.flow-rider": { say: [[50, of("flip", "Flow streak")]] },
    "swing.vine-time": { say: [[10, 20 / SWING_V17_STREAK_EACH], [8, SWING_V17_STREAK_BLOCK]], th: [[20, 10 * SWING_V17_STREAK_EACH]] },
    "swing.king-of-the-swingers": { say: [[70, SWING_V17_FULL / 10]] },
    "ricochet.scroll-keeper": { say: [[3, of("ricochet", "Scrolls")]] },
    "ricochet.lantern-lift": { say: [[6, of("ricochet", "Lantern rides")]] },
    "ricochet.moonwalker": { say: [[245, of("ricochet", "Height")]] },
    "skyline.gold": { say: [[5, Number(/of the (\d+) gold/.exec(specPart("skyline", "Gold blocks")?.how ?? "")?.[1])]] },
    "skyline.steady-crane": { say: [[10, maxOf("skyline", "Perfect streak")]] },
    "skyline.skyscraper": { say: [[61, SKYLINE_V9_FULL_AT]] },
    "slice.combo-chef": { say: [[110, SLICE_V12_COMBO_FULL]] },
    "slice.golden-delicious": { th: [[1, 1]] },
    "orbit.slingshot": { say: [[4, of("orbit", "Slingshots")]] },
    "beat.fever-pitch": { say: [[4, Number(/all of it for (\d+) fevers/.exec(specPart("beat", "Fever")?.how ?? "")?.[1])]] },
    "blockfall.low": { say: [[4, BF_LOW_FULL]] },
    "blockfall.multi": { say: [[4, 4], [2, 24 / 12], [6, 24 / 4]] },
    "breaker.twenty-four-carat": { th: [[1, 1]] },
    "burst.golden-touch": { say: [[5, BURST_V10_GOLDENS]], th: [[5, BURST_V10_GOLDENS]] },
    "burst.sharpshooter": { th: [[0, 0]] },
    "burst.meltdown": { say: [[5, BURST_V10_WAVES]], th: [[1, 1]] },
    "cross.near-miss": { say: [[10, CROSS_V11_CLOSE_MAX]] },
    "cross.keep-moving": { say: [[4, CROSS_V11_FLOW_MAX / CROSS_V11_FLOW_EACH]], th: [[40, CROSS_V11_FLOW_MAX]] },
    "hover.tight-squeeze": { say: [[5, helpCount("hover", "tight gates") || 5]] },
    "hover.chain-gang": { say: [[5, 5]], th: [[30, HOVER_STD_CHAINS]] },
    "hover.all-the-way": { th: [[1, 1]] },
    "pinball.joulz": { say: [[2, maxOf("pinball", "J-O-U-L-Z") / 10]] },
    "pinball.jackpot": { say: [[3, maxOf("pinball", "Jackpots") / 5]] },
    "rally.pink-pong": { say: [[5, 15 / 3]], th: [[15, 5 * Number(/(\d+) each time/.exec(specPart("rally", "Pink pads")?.how ?? "")?.[1])]] },
    "rally.target-practice": { say: [[6, Number(/of the (\d+) gold targets/.exec(specPart("rally", "Gold targets")?.how ?? "")?.[1])]] },
    "rally.rally-king": { say: [[23, Number(/for (\d+) hits/.exec(specPart("rally", "Gold-ball hits")?.how ?? "")?.[1])]] },
    "snake.star-eater": { say: [[28, SNAKE_V12_CORE_STARS], [2, SNAKE_V12_GOLD_CORE]], th: [[120, SNAKE_STD_CORE_MAX]] },
    "snake.golden-comet": { say: [[7, SNAKE_STD_GOLDS]], th: [[7, SNAKE_STD_GOLDS]] },
    "wavefront.boss-fight": { th: [[1, 1]] },
    "wavefront.saucer-spotter": { say: [[5, WAV_X_SAUCERS]] },
    "wavefront.not-a-scratch": { th: [[1, 1], [3, WAV_LIVES]] },
    "alleyroll.pocket-rocket": { say: [[100, Number(/each (\d+) pocket/.exec(specPart("alleyroll", "Pocket hits")?.how ?? "")?.[1])]] },
    "alleyroll.hot-hand": { say: [[30, Number(/scoring (\d+) or more/.exec(specPart("alleyroll", "Roll streak")?.how ?? "")?.[1])], [5, of("alleyroll", "Roll streak")]] },
    "alleyroll.gold-cup-final": { say: [[3, of("alleyroll", "Gold cup")]] },
    "bintoss.hoops": { say: [[3, Number(/of the (\d+) hoops/.exec(specPart("bintoss", "Hoops")?.how ?? "")?.[1])]] },
    "bintoss.finish": { say: [[10, 10]] },
    "bintoss.long-range": { say: [[6, Number(/throws 1 to (\d+)/.exec(specPart("bintoss", "Far buckets")?.how ?? "")?.[1])]] },
    "bullseye.on-a-roll": { say: [[4, 4]], th: [[6, 2 + 4]] },
    "bullseye.one-hundred-and-twelve": { say: [[112, Number(/total of (\d+)/.exec(specPart("bullseye", "Dart total")?.how ?? "")?.[1])], [10, 10]] },
    "minigolf.birdie": { say: [[1, 1]], th: [[4, Number(/(\d+) for each hole under par/.exec(specPart("minigolf", "Under par")?.how ?? "")?.[1])]] },
    "minigolf.par-for-the-course": { say: [[5, of("minigolf", "Par")]] },
    "minigolf.quick-round": { say: [[5, of("minigolf", "Holes")], [53, withinS("minigolf", "Speed")]] },
    "minigolf.under-under": { say: [[5, of("minigolf", "Under par")]] },
    "pool.run-out": { say: [[6, of("pool", "Pots in a row")]] },
    "pool.streak": { say: [[6, of("pool", "Pots in a row")]] },
    "bullseye.dead": { say: [[1, 1]] },
    "wordhunt.long-haul": { say: [[6, Number(/extra for (\d)-letter words/.exec(help("wordhunt"))?.[1])]] },
    "pool.clean-break": { th: [[0, 0]] },
    "curling.red-ring-circus": { say: [[8, of("curling", "Red ring")]] },
    "homerun.sign-here": { say: [[5, 10 / Number(/(\d+) each time/.exec(specPart("homerun", "Bonus signs")?.how ?? "")?.[1])]], th: [[10, 10]] },
    "homerun.homers": { say: [[10, of("homerun", "Home runs")]] },
    "homerun.streak": { say: [[10, of("homerun", "Perfect streak")]] },
    "freekick.five-alive": { say: [[5, 5]] },
    "freekick.bend-it": { say: [[5, 10 / Number(/(\d+) for each goal from a well-bent/.exec(specPart("freekick", "Curl bonus")?.how ?? "")?.[1])]], th: [[10, 10]] },
    "freekick.top-bins": { say: [[4, of("freekick", "Targets")]] },
    "racing.clean-half": { say: [[4, 20 / 5]], th: [[20, 4 * (maxOf("racing", "Clean sectors") / of("racing", "Clean sectors"))]] },
    "racing.two-hundred-club": { say: [[200, 200]], th: [[110, Math.floor((160 * (2000 - 1520)) / 695)]] },
    "racing.grand-slam": { say: [[8, of("racing", "Clean sectors")]] },
    "fivehands.pick-of-the-bunch": { th: [[0, 0]] },
    "freecell.all-home": { say: [[40, Number(/all (\d+) home/.exec(specPart("freecell", "Cards")?.how ?? "")?.[1])]] },
    "freecell.card-sharp": { say: [[32, withinS("freecell", "Speed")]] },
    "mahjong.tile-rush": { say: [[65, withinS("mahjong", "Speed")]] },
    "minesweeper.sweep": { say: [[50, withinS("minesweeper", "Speed")]] },
    "pyramid.paired-up": { say: [[10, of("pyramid", "Pyramid pairs")], [2, 2]] },
    "pyramid.unlucky-for-some": { say: [[20, withinS("pyramid", "Speed")]] },
    "tripeaks.peak-bagger": { say: [[3, of("tripeaks", "Peak tops")]] },
    "tripeaks.up-and-down": { say: [[10, of("tripeaks", "Longest run")]] },
    "tripeaks.summit-sprint": { say: [[20, withinS("tripeaks", "Speed")]] },
    "balltrack.combo-breaker": { say: [[10, 10]], th: [[10, 10 * (maxOf("balltrack", "Combos") / of("balltrack", "Combos"))]] },
    "balltrack.golden-marbles": { say: [[6, of("balltrack", "Gold marbles")]] },
    "balltrack.lost-no-marbles": { say: [[36, of("balltrack", "Marbles home")]] },
    "bubble.chests": { say: [[6, of("bubble", "Chests") || Number(/of the (\d+) chests/.exec(specPart("bubble", "Chests")?.how ?? "")?.[1])]] },
    "bubble.off-the-wall": { say: [[30, 2 * maxOf("bubble", "Bank shots")]] },
    "inkbridge.show-off": { say: [[4, of("inkbridge", "Trick shots")]] },
    "matchup.ice-breaker": { say: [[10, of("matchup", "Ice")]] },
    "matchup.goal-getter": { say: [[6, of("matchup", "Colour goals")]] },
    "matchup.treasure-hunter": { say: [[6, of("matchup", "Treasure")]] },
    "tilt.no-falls": { say: [[4, of("tilt", "Clean run")]] },
    "tilt.par-four": { say: [[4, of("tilt", "Par")]] },
    "tilt.marble-madness": { say: [[4, TILT_S_MAZES], [60, Number(/all 4 within (\d+) s/.exec(help("tilt"))?.[1])]] },
    "clayshoot.bird-lover": {},
    "skyline.perfects": {},
  };
}

/** The numbers a challenge's check reads, each with whether it's already proved against the live game elsewhere. */
function thresholds(c: PracticeChallenge): { v: number; proved: boolean; what: string }[] {
  const g = c.goal;
  if (g.kind === "part") return [{ v: g.max, proved: true, what: `part ${g.label} max` }];
  if (g.kind === "bonus") return [{ v: g.max, proved: true, what: "bonus max" }];
  if (g.kind === "speed") return [{ v: g.max, proved: true, what: "speed max" }, { v: g.withinS, proved: true, what: "full by" }];
  if (g.kind === "score") return [{ v: g.score, proved: false, what: "score" }];
  const out: { v: number; proved: boolean; what: string }[] = [];
  for (const cond of g.all as readonly ChallengeCond[]) {
    if (cond.c === "full") out.push({ v: cond.max, proved: true, what: `full ${cond.label}` });
    else if ("v" in cond && typeof cond.v === "number") out.push({ v: cond.v, proved: false, what: `${cond.c} ${"path" in cond ? cond.path : "label" in cond ? cond.label : ""}` });
  }
  return out;
}

/** The catalogue doc's rows: name → goal, level, coin mark. */
function docRows(): Map<string, { type: string; goal: string; level: string; coin: boolean }> {
  const rows = new Map<string, { type: string; goal: string; level: string; coin: boolean }>();
  let type = "";
  for (const line of readFileSync("docs/challenges/catalogue.md", "utf8").split("\n")) {
    const h = /^#### .*\(`([a-z0-9]+)`\)/.exec(line);
    if (h) type = h[1]!;
    const cells = line.split("|").map((x) => x.trim());
    if (cells.length > 8 && /^(Classic|Hard|Expert)$/.test(cells[3] ?? "")) rows.set(cells[1]!, { type, goal: cells[2]!, level: cells[3]!.toLowerCase(), coin: line.includes("●") });
  }
  return rows;
}

export async function numbersReport(): Promise<{ results: NumberResult[]; challenges: number }> {
  const results: NumberResult[] = [];
  const ok = (cond: boolean, label: string) => results.push({ ok: cond, label });
  const exp = expectations();
  const doc = docRows();
  let covered = 0;
  // Speed goals' "within N s" and the maxima are proved in practice-goals-check section 3 (bonus, speed, part) and
  // here for `full` conditions; every other threshold must be a text number or declared.
  for (const c of PRACTICE_CHALLENGES) {
    covered += 1;
    const e = exp[c.id] ?? {};
    const say = new Map((e.say ?? []).map(([n, live]) => [n, live]));
    const th = new Map((e.th ?? []).map(([n, live]) => [n, live]));
    const textNums = numbersIn(c.text);
    const ths = thresholds(c);
    for (const n of textNums) {
      const asThreshold = ths.some((t) => t.v === n);
      const declared = say.has(n);
      ok(asThreshold || declared, `${c.id}: the ${n} in "${c.text}" is what its check reads or a live count`);
      if (declared) ok(say.get(n) === n, `${c.id}: the ${n} in its text is the live ${say.get(n)}`);
    }
    for (const n of say.keys()) ok(textNums.includes(n), `${c.id}: declared ${n} is in its text`);
    for (const t of ths) {
      if (t.proved) continue;
      // 0 ("no", "without", "none") and 1 (a yes / no fact, or "at least one") are the goal's words, not a number in it.
      if ((t.v === 0 || t.v === 1) && !th.has(t.v)) {
        ok(/\b(no|not|without|none|never|every|all|clean|first|both|reach|destroy|finish|clear|pass|pick|on)\b/i.test(c.text), `${c.id}: its ${t.what} ${t.v} is a yes / no its words state`);
        continue;
      }
      const inText = textNums.includes(t.v);
      const declared = th.has(t.v);
      ok(inText || declared, `${c.id}: its ${t.what} threshold ${t.v} is in its text or proved live`);
      if (declared) ok(th.get(t.v) === t.v, `${c.id}: its ${t.what} threshold ${t.v} is the live ${th.get(t.v)}`);
    }
    // `full` maxima against the live spec.
    if (c.goal.kind === "check")
      for (const cond of c.goal.all) if (cond.c === "full" || cond.c === "line") {
        const p = specPart(c.type, cond.label);
        ok(Boolean(p), `${c.id}: "${cond.label}" is a part of the live ${c.type} spec`);
        if (cond.c === "full") ok(p?.max === cond.max, `${c.id}: "${cond.label}" full at ${cond.max} is the live maximum ${p?.max}`);
        else ok(!p || cond.v <= p.max, `${c.id}: "${cond.label}" ≥ ${cond.v} within its live maximum ${p?.max}`);
      }
    // Speed goals: "within N s" in the text.
    if (c.goal.kind === "speed") ok(c.text.includes(`within ${c.goal.withinS} s`), `${c.id}: its text says within ${c.goal.withinS} s`);
    // Against the catalogue doc.
    const row = doc.get(c.name);
    ok(Boolean(row), `${c.id}: "${c.name}" is in docs/challenges/catalogue.md`);
    if (row) {
      ok(row.type === c.type, `${c.id}: the doc lists it under ${c.type}`);
      ok(row.goal === c.text, `${c.id}: the doc's goal is "${c.text}" (got "${row.goal}")`);
      ok(row.level === c.level, `${c.id}: the doc's level is ${c.level}`);
      ok(row.coin === c.coins > 0, `${c.id}: the doc's coin mark matches`);
      if (c.goal.kind === "score") ok(numbersIn(row.goal).includes(c.goal.score), `${c.id}: the doc's goal states the score ${c.goal.score}`);
    }
  }
  ok(doc.size === PRACTICE_CHALLENGES.length, `the doc lists ${doc.size} challenges, the code ${PRACTICE_CHALLENGES.length}`);
  // Live sources sanity: a source that failed to parse would make its checks pass on NaN never; prove a few directly.
  ok(CLAY_QUICK_FULL_TICKS === 15, "Pull!'s quick hit is a quarter second (15 ticks)");
  ok(ASCEND_STD.flow === 10 && SCAN_STD.clean === 40, "Ascend's flow 10 and Eagle Eye's clean 40");
  return { results, challenges: covered };
}

if (import.meta.main) {
  const r = await numbersReport();
  const bad = r.results.filter((x) => !x.ok);
  for (const b of bad) console.log(`FAIL ${b.label}`);
  console.log(`${r.results.length - bad.length} passed, ${bad.length} failed, ${r.challenges} challenges`);
}
