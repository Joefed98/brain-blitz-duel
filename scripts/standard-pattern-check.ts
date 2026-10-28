/**
 * standard-pattern-check (27 Oct 2026): the scoring standard's Pattern and Logic games, first half
 * (docs/scoring-standard.md, "Pattern and Logic (first half) decisions"; src/lib/duel/standard/pattern.server.ts):
 * Gridlock, Tessellate, Skid, Topsy-Turvy, Gradient, Turntable, Lightbender, Chroma Lines, Pipeline and Heave.
 *
 *   1. Stamps: new deals carry the standard's stamp (live + 1); pinPreStandard deals the live one; the timed games
 *      append the draft timeline (Lightbender times its gems from its own action log).
 *   2. Worked examples through the real gradeAnswer with a phone-style answer (sentAnswer, the timeline built from
 *      the drafts): finished fast, finished slow, half done, each computed by hand in the comments; blank → 0.
 *   3. Rules and history: Gridlock's chain of blocks and waste, Tessellate's right-first-time, Chroma Lines' redraws,
 *      Lightbender's first shot, mirrors and buzzer layout, Heave's gold crate unfinished, Skid's gems unfinished,
 *      Topsy-Turvy's stars on cleared boards only, and every history bonus 0 without a timeline.
 *   4. Kit play (8 room seeds a game; Topsy-Turvy and Gradient with their own bots, the kits model their older
 *      boards; Pipeline's kit answers turned into the tap log its stamp grades): medians nothing ≤ spam (≤ 10) <
 *      average < good < great ≤ near, equality only where both are the top the players can reach; every finish
 *      beats every unfinished score.
 *
 *   bun scripts/standard-pattern-check.ts            (about 20 s)
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { STANDARD_STAMPS, pinPreStandard, standardTimesParts } from "../src/lib/duel/standard/stamps";
import { isPatternStdType, PATTERN_STD_TYPES, TILES_REV_FAST, type PatternStdType } from "../src/lib/duel/standard/patternRules";
import { PATTERN_STD_INTRO, patternStdHelp, patternStdIntro } from "../src/lib/duel/standard/patternText";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { gridlockChain, flowRedraws } from "../src/lib/duel/standard/pattern.server";
import { decodeMoves, replayUnblock } from "../src/lib/duel/unblock";
import { decodeSides, rotateMask, tileOpenings } from "../src/lib/duel/logic";
import { encodePipesTapAnswer, pipesAfterTaps } from "../src/lib/duel/depth4/pipesTaps";
import { encodeGradient, gradientLocked, gradientSwap, jumbledSolved, type GradientSwap } from "../src/lib/duel/jumbled";
import { gradientRoute } from "../src/lib/duel/jumbled.server";
import { topsyStart, topsyTilt, replayTopsyPuzzle, type TopsyBoard, type TopsyState } from "../src/lib/duel/topsy";
import { topsySearch } from "../src/lib/duel/topsy.server";
import { encodeActionLog, type LoggedAction } from "../src/lib/duel/actionLog";
import { laserAction } from "../src/lib/duel/laserLog";
import { encodeFlowPaths } from "../src/lib/duel/flow";
import { encodePlacements } from "../src/lib/duel/blockParty";
import { slideBoard, slideOutcome, slideSearch } from "../src/lib/duel/slide";
import { gemBits } from "../src/lib/duel/depth4/iceGems";
import { RING_UNDO } from "../src/lib/duel/rings";
import type { GravityDir, PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { LEVELS, hashText, makeRng, SKILLS, type Level, type Skill, type Step } from "./puzzle-fairness/kit";
import { gradeSteps, median, sentAnswer } from "./standard-lib";
import { JUMBLED_SKILLS, TOPSY_READ_S, TOPSY_SKILLS, TOPSY_TILT_S } from "./d5-remodels/bots";

const failures: string[] = [];
let checks = 0;
function ok(cond: boolean, msg: string): void {
  checks++;
  if (!cond) failures.push(msg);
}

type Of<T extends PuzzleType> = Extract<PuzzleData, { type: T }>;
const SEED = 6100;
const deal = <T extends PuzzleType>(type: T, seed = SEED): Of<T> => withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed })) as Of<T>;
const grade = (p: PuzzleData, answer: string, msLeft: number) => gradeAnswer(p, answer, msLeft);
/** The phone's answer after these drafts, every draft at round-clock `t` (so each part's early extra is plain to work out). */
const sentAt = (p: PuzzleData, answers: readonly string[], t: number) => sentAnswer(p, answers.map((answer) => ({ answer, atMs: t })));
const ex = (name: string, got: number, want: number) => ok(got === want, `${name}: scored ${got}, want ${want}`);

/* ------------------------------------------------------------------ players */

const PERFECT: Skill = { level: "near", pace: 0.2, err: 0, reactionMs: 150, reactionSd: 1 };

/** Pipeline's kit sends side-sets; its stamp grades the tap log, so each change becomes the clockwise taps it takes. */
function pipesTaps(p: Of<"pipes">, steps: readonly Step[]): Step[] {
  let prev = p.tiles.map(tileOpenings);
  const taps: number[] = [];
  return steps.map((s) => {
    const sides = decodeSides(p.tiles, s.answer).map(tileOpenings);
    sides.forEach((want, cell) => {
      for (let t = 0; t < 4; t++) if (rotateMask(prev[cell]!, t) === want) {
        for (let k = 0; k < t; k++) taps.push(cell);
        break;
      }
    });
    prev = sides;
    return { answer: encodePipesTapAnswer(pipesAfterTaps(p.tiles, taps), taps), atMs: s.atMs };
  });
}

function kitSteps(type: PuzzleType, p: PuzzleData, skill: Skill, seedText: string): { steps: Step[]; timed?: boolean } {
  const play = KITS[type]!.play(p, makeRng(hashText(seedText)), skill, puzzleTimeLimitMs(p));
  return type === "pipes" ? { steps: pipesTaps(p as Of<"pipes">, play.steps) } : play;
}

const DIRS: GravityDir[] = ["U", "D", "L", "R"];
function topsyRoute(board: TopsyBoard, state: TopsyState, withStars: boolean): GravityDir[] | null {
  const left = board.stars.filter((_, i) => !(state.starMask & (1 << i)));
  const found = topsySearch({ ...board, starts: state.balls, stars: withStars ? left : [] }, withStars, 12, 200_000);
  return found ? found.solution : null;
}

/** Topsy-Turvy's bot (scripts/d5-remodels/bots.ts playTopsy, recording each tilt as a draft). */
function topsySteps(p: Of<"gravity">, level: Level, rngSeed: number): Step[] {
  const skill = TOPSY_SKILLS[level];
  const rng = makeRng(rngSeed);
  const boards = p.boards!;
  const limits = p.tiltLimits ?? [];
  const limit = puzzleTimeLimitMs(p);
  const tokens: GravityDir[] = [];
  const steps: Step[] = [];
  const think = (s: number) => Math.round(s * skill.pace * (0.65 + 0.7 * rng.next()) * 1000);
  let at = 0;
  outer: for (const [b, board] of boards.entries()) {
    const walls = new Set(board.walls);
    at += think(TOPSY_READ_S);
    const wantStars = rng.next() < skill.stars;
    let state = topsyStart(board);
    let used = 0;
    while (used < limits[b]!) {
      if (at >= limit) break outer;
      if (state.balls.every((ball) => ball === -1)) break;
      let dir: GravityDir | null = null;
      if (rng.next() >= skill.err) {
        const route = (wantStars ? topsyRoute(board, state, true) : null) ?? topsyRoute(board, state, false);
        if (route && route.length) dir = route[0]!;
      }
      if (!dir) {
        const options = DIRS.filter((d) => topsyTilt(board, walls, state, d).moved);
        dir = options[rng.below(options.length)]!;
      }
      at += think(TOPSY_TILT_S);
      tokens.push(dir);
      steps.push({ answer: tokens.join(""), atMs: at });
      state = topsyTilt(board, walls, state, dir).state;
      used++;
    }
  }
  return steps;
}

/** Random tilts every 0.4 s until the round is over or the buzzer (d5 bots' spamTopsy). */
function topsySpam(p: Of<"gravity">, rngSeed: number): string {
  const rng = makeRng(rngSeed);
  const limit = puzzleTimeLimitMs(p);
  const tokens: GravityDir[] = [];
  for (let at = 400; at < limit; at += 400) {
    tokens.push(DIRS[rng.below(4)]!);
    if (replayTopsyPuzzle(p as never, tokens).over) break;
  }
  return tokens.join("");
}

/**
 * Gradient's player: a swap is the next of a shortest swap list from the board as it stands (gradientRoute), or, with
 * the level's mistake rate, two unlocked tiles swapped at random. A solid player takes GRADIENT_SWAP_S a swap (picking
 * two tiles by colour) and GRADIENT_READ_S to read the board; paces are the kit's (SKILLS).
 */
const GRADIENT_SWAP_S = 4.5;
const GRADIENT_READ_S = 10;
/** The D5 bots' Jumbled mistake rates (JUMBLED_SKILLS); a mistake here is one wasted swap. */
const GRADIENT_ERR: Record<Level, number> = { average: JUMBLED_SKILLS.average.err, good: JUMBLED_SKILLS.good.err, great: JUMBLED_SKILLS.great.err, near: JUMBLED_SKILLS.near.err };
function gradientSteps(p: Of<"tiles">, skill: Skill, err: number, rngSeed: number): Step[] {
  const rng = makeRng(rngSeed);
  const limit = puzzleTimeLimitMs(p);
  let frame = [...p.frame];
  const swaps: GradientSwap[] = [];
  const steps: Step[] = [];
  let at = Math.round(GRADIENT_READ_S * skill.pace * 1000);
  while (!jumbledSolved(frame) && at < limit + 10_000) {
    let swap: GradientSwap;
    if (rng.chance(err)) {
      const free = frame.map((_, c) => c).filter((c) => !gradientLocked(frame, c));
      const a = rng.pick(free);
      swap = { a, b: rng.pick(free.filter((c) => c !== a)) };
    } else {
      const n = gradientRoute(frame)[0]!;
      swap = { a: Math.floor(n / 100), b: n % 100 };
    }
    at += Math.max(250, Math.round(GRADIENT_SWAP_S * skill.pace * Math.exp(rng.normal(0, 0.35)) * 1000));
    const next = gradientSwap(frame, swap);
    if (!next) continue;
    frame = next;
    swaps.push(swap);
    steps.push({ answer: encodeGradient(swaps), atMs: at });
  }
  return steps;
}

/** Random swaps of two unlocked tiles, two a second, until solved or the buzzer. */
function gradientSpam(p: Of<"tiles">, rngSeed: number, perSecond: number): { answer: string; atMs: number } {
  const rng = makeRng(rngSeed);
  const limit = puzzleTimeLimitMs(p);
  let frame = [...p.frame];
  const swaps: GradientSwap[] = [];
  let at = 0;
  while (!jumbledSolved(frame) && at + 1000 / perSecond < limit) {
    at += 1000 / perSecond;
    const free = frame.map((_, c) => c).filter((c) => !gradientLocked(frame, c));
    const a = rng.pick(free);
    const swap = { a, b: rng.pick(free.filter((c) => c !== a)) };
    frame = gradientSwap(frame, swap)!;
    swaps.push(swap);
  }
  return { answer: encodeGradient(swaps), atMs: at };
}

/** Skid: the fewest slides from the start whose path crosses an ice gem (breadth-first over ball, broken ice and gems). */
function shortestGemPath(p: Of<"iceslide">): string | null {
  const board = slideBoard(p);
  const gems = p.gems ?? [];
  type S = { cell: number; mask: number; gems: number; path: string };
  const seen = new Set<string>();
  const queue: S[] = [{ cell: p.start, mask: 0, gems: 0, path: "" }];
  for (let i = 0; i < queue.length && i < 20_000; i++) {
    const s = queue[i]!;
    for (const dir of ["U", "D", "L", "R"] as const) {
      const out = slideOutcome(board, s.cell, s.mask, dir);
      if (!out.path.length || out.cell === board.exit) continue;
      const next = { cell: out.cell, mask: out.mask, gems: s.gems | gemBits(gems, out.path), path: s.path + dir };
      if (next.gems) return next.path;
      const key = `${next.cell}:${next.mask}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return null;
}

/* ------------------------------------------------------------------ 1. stamps and texts */

for (const type of PATTERN_STD_TYPES) {
  const st = STANDARD_STAMPS[type]!;
  ok(st.rev === st.live + 1, `${type}: ${st.key} ${st.live} → ${st.rev}`);
  const fresh = deal(type) as unknown as Record<string, unknown>;
  // Gradient is dealt tilesRev 6 (full speed within 30 s, 28 Oct 2026); every other game its standard stamp.
  const want = type === "tiles" ? TILES_REV_FAST : st.rev;
  ok(fresh[st.key] === want, `${type}: new deals carry ${st.key} ${want} (got ${String(fresh[st.key])})`);
  ok(standardTimesParts(fresh as unknown as PuzzleData) === (type !== "laser"), `${type}: the draft timeline ${type === "laser" ? "off (its own action log)" : "on"}`);
  const before = pinPreStandard(true);
  const old = deal(type) as unknown as Record<string, unknown>;
  pinPreStandard(before);
  ok(old[st.key] === st.live, `${type}: pinned before the standard, ${st.key} ${st.live} (got ${String(old[st.key])})`);
  ok(isPatternStdType(type), `${type}: a pattern standard game`);
  ok(PUZZLE_INSTRUCTIONS[type].score === patternStdHelp(type), `${type}: the "?" help is the standard's`);
  ok(INTRO_SCORE[type] === patternStdIntro(type) && PATTERN_STD_INTRO[type].length <= 90 && PATTERN_STD_INTRO[type].includes("{max}") && INTRO_SCORE[type].includes("200"), `${type}: the intro line`);
  ok(grade(fresh as unknown as PuzzleData, "", 0).score === 0, `${type}: a blank answer scores 0`);
}

/* ------------------------------------------------------------------ 2 and 3. worked examples and rules */

// Gridlock (60 s clock; full speed 30 within 40 s; par moves 20). Seed 6100: par 18, the chain of blocks in the gold
// block's way 9 (4 in its row ahead, 5 in their ways out); the stored solution's 18 moves.
{
  const p = deal("unblock");
  const sol = decodeMoves(p.solution ?? "").map((m) => `${m.id}:${m.to}`);
  ok(p.par === 18 && sol.length === 18 && gridlockChain(p.vehicles) === 9, `Gridlock facts: par ${p.par}, ${sol.length} moves, chain ${gridlockChain(p.vehicles)}`);
  const prefixes = sol.map((_, i) => sol.slice(0, i + 1).join(","));
  // Fast: 18 moves (par) in 10 s: 150 + 30 + 20 = 200.
  ex("Gridlock fast", grade(p, sentAt(p, prefixes, 10_000), 50_000).score, 200);
  // Slow: one move made and undone first (19 moves counted), solved after 50 s: speed 30 × 10 ÷ 20 = 15; par 20 × (36 − 19) ÷ 18 = 18.9 → 19.
  const wasted = [sol[0]!, `${sol[0]},-1:0`, ...prefixes.map((a) => `${sol[0]},-1:0,${a}`)];
  ex("Gridlock slow, one move over par", grade(p, sentAt(p, wasted, 40_000), 10_000).score, 150 + 15 + 19);
  // Half: the first 12 moves (4 of the 9 cleared), every draft at 30 s: 120 × 4 ÷ 9 = 53.33, + 4 × (10 ÷ 9) × ½ = 2.22 → 55.6 → 56.
  const half = gridlockChain(replayUnblock(p.vehicles, decodeMoves(prefixes[11]!)).vehicles);
  ok(half === 5, `Gridlock half: chain ${half} left`);
  ex("Gridlock half", grade(p, sentAt(p, prefixes.slice(0, 12), 30_000), 0).score, 56);
  // Without a timeline: no early extras, 53.
  ex("Gridlock half, no timeline", grade(p, prefixes[11]!, 0).score, 53);
  // Waste: the same 12 moves after 60 moves made and undone (72 counted, 4× the minimum): nothing left.
  const churn = Array.from({ length: 60 }, () => `${sol[0]},-1:0`).join(",");
  ex("Gridlock half after 60 wasted moves", grade(p, `${churn},${prefixes[11]}`, 0).score, 0);
}

// Tessellate (60 s; speed 40 within 40 s; right first time 10 over 9 pieces; 13 a piece + 1.4 early). Seed 6100:
// nine pieces, the stored solution's placements in order.
{
  const p = deal("blockparty");
  const sol = p.solution ?? [];
  ok(sol.length === 9, `Tessellate facts: ${sol.length} pieces`);
  const drafts = sol.map((_, i) => encodePlacements(sol.slice(0, i + 1).map((x) => ({ piece: x.piece, cells: [...x.cells] }))));
  // Fast: every piece placed once, done in 10 s: 150 + 40 + 10 = 200.
  ex("Tessellate fast", grade(p, sentAt(p, drafts, 10_000), 50_000).score, 200);
  // A legal spot for the first piece that is not its own (the same shape moved along the board).
  const first = sol[0]!;
  let wrong: number[] | null = null;
  for (const shift of [7, 14, -7, 1, -1, 2, -2, 21, 28, -14]) {
    const cells = first.cells.map((c) => c + shift);
    if (cells.some((c) => c < 0 || c >= 49)) continue;
    // Legal on its own and beside the solution's next three pieces.
    const four = encodePlacements([{ piece: first.piece, cells }, ...sol.slice(1, 4).map((x) => ({ piece: x.piece, cells: [...x.cells] }))]);
    if (grade(p, four, 0).extra?.["placements"] === four) {
      wrong = cells;
      break;
    }
  }
  ok(wrong !== null, "Tessellate: a wrong legal spot for the first piece");
  if (wrong) {
    const moved = [encodePlacements([{ piece: first.piece, cells: wrong }]), ...drafts];
    // Slow: the first piece placed wrong, then moved to its spot; solved after 50 s: 40 × 10 ÷ 20 = 20; first time 10 × 8 ÷ 9 = 8.9 → 9.
    ex("Tessellate slow, one piece moved", grade(p, sentAt(p, moved, 40_000), 10_000).score, 150 + 20 + 9);
    // A piece off its spot takes one off: three right and the wrong one: 13 × (2 × 3 − 4) = 26 (no timeline).
    const offSpot = encodePlacements([{ piece: first.piece, cells: wrong }, ...sol.slice(1, 4).map((x) => ({ piece: x.piece, cells: [...x.cells] }))]);
    ex("Tessellate three right, one off its spot", grade(p, offSpot, 0).score, 26);
  }
  // Half: four pieces, every draft at 30 s: 13 × 4 = 52, + 4 × 1.4 × ½ = 2.8, + right first time 10 × 4 ÷ 9 = 4.4 → 59.2 → 59.
  ex("Tessellate half", grade(p, sentAt(p, drafts.slice(0, 4), 30_000), 0).score, 59);
  // No timeline: no early extras and no right-first-time: 52; a finish without one: 150 + 40 = 190.
  ex("Tessellate half, no timeline", grade(p, drafts[3]!, 0).score, 52);
  ex("Tessellate fast, no timeline", grade(p, drafts[8]!, 50_000).score, 190);
}

// Skid (90 s; speed 30 within 60 s; ice gems 20 over the gems). Seed 6100: the fewest slides 18, three gems off the
// shortest route (the shortest route collects none).
{
  const p = deal("iceslide");
  const route = slideSearch(slideBoard(p))!.route;
  ok(route.length === 18 && (p.gems ?? []).length === 3, `Skid facts: route ${route.length}, gems ${(p.gems ?? []).length}`);
  const drafts = route.map((_, i) => route.slice(0, i + 1).join(""));
  // Fast: 18 slides in 10 s: 150 + 30 = 180 (no gem).
  ex("Skid fast", grade(p, sentAt(p, drafts, 10_000), 80_000).score, 180);
  // Slow: solved after 80 s: 30 × 10 ÷ 30 = 10: 160.
  ex("Skid slow", grade(p, sentAt(p, drafts, 70_000), 10_000).score, 160);
  // Half: 9 slides, every draft at 30 s: 120 × 9 ÷ 18 = 60, + 9 × (10 ÷ 18) × ⅔ = 3.3 → 63.3 → 63.
  ex("Skid half", grade(p, sentAt(p, drafts.slice(0, 9), 30_000), 0).score, 63);
  // A gem collected counts unfinished: the shortest slide list that crosses a gem, then stop.
  const gemPath = shortestGemPath(p);
  ok(gemPath !== null, "Skid: a slide list that collects a gem");
  if (gemPath) {
    const g = grade(p, gemPath, 0);
    const closed = Number(g.extra?.["routeClosed"]);
    const got = Number(g.extra?.["gemsCollected"]);
    const w = Number(g.extra?.["waste"]);
    ok(got >= 1 && !g.isCorrect, `Skid: ${got} gem(s) on the way`);
    // 120 × closed ÷ 18 × waste + 20 × gems ÷ 3 (no timeline, no early extras).
    ex("Skid unfinished with a gem", g.score, Math.round(((120 * closed) / 18) * w + (20 * got) / 3));
  }
}

// Topsy-Turvy (120 s; speed 30 within 80 s; stars 15 over 6; par tilts 5 at the boards' fewest tilts, 5 + 6 + 4 = 15).
// Seed 6100: the stored all-stars routes take 7 + 7 + 5 = 19 tilts.
{
  const p = deal("gravity");
  const route = (p.boardSolutions ?? []).join("").split("");
  ok(route.length === 19 && (p.boardMins ?? []).reduce((a, b) => a + b, 0) === 15, `Topsy-Turvy facts: route ${route.length}, par ${p.boardMins}`);
  const drafts = route.map((_, i) => route.slice(0, i + 1).join(""));
  // Fast: every star, 19 tilts, in 20 s: 150 + 30 + (15 stars + 5 × (30 − 19) ÷ 15 = 3.7) = 150 + 30 + 18.7 → 199.
  ex("Topsy-Turvy fast", grade(p, sentAt(p, drafts, 20_000), 100_000).score, 199);
  // Slow: solved after 100 s: 30 × 20 ÷ 40 = 15: 150 + 15 + 19 = 184.
  ex("Topsy-Turvy slow", grade(p, sentAt(p, drafts, 90_000), 20_000).score, 184);
  // Half: board 1 cleared with its 2 stars (7 tilts), every draft at 60 s: 120 × 6 ÷ 18 = 40, + 6 × (10 ÷ 18) × ½ = 1.7,
  // + 2 stars × 15 ÷ 6 = 5 → 46.7 → 47.
  ex("Topsy-Turvy half", grade(p, sentAt(p, drafts.slice(0, 7), 60_000), 0).score, 47);
  // Board 1 one tilt short (6 tilts, its fewest 5): stars on a board not cleared don't count (random tilting collects
  // them too), and the waste factor takes 1 ÷ 15 off the balls' credit: 120 × home ÷ 18 × 14 ÷ 15 (no timeline).
  const short = replayTopsyPuzzle(p as never, route.slice(0, 6) as GravityDir[]);
  ok(short.cleared === 0 && short.tilts === 6 && (p.boardMins ?? [])[0] === 5, `Topsy-Turvy one short facts: ${short.cleared} cleared, ${short.tilts} tilts`);
  ex("Topsy-Turvy one tilt short of board 1", grade(p, route.slice(0, 6).join(""), 0).score, Math.round(((120 * short.home) / 18) * (14 / 15)));
  // Random tilting until the buzzer (every board's tilts used up, 2× its limit): the waste factor leaves only the stars
  // of boards it happened to clear.
  const spam = topsySpam(p, hashText("std:gravity:example-spam"));
  const sr = replayTopsyPuzzle(p as never, spam.split("") as GravityDir[]);
  if (!sr.solved) ex("Topsy-Turvy random tilting", grade(p, spam, 0).score, Math.round((15 * sr.clearedStars) / 6));
}

// Gradient (120 s; speed 35 within 30 s on tilesRev 6, 80 s on tilesRev 5; par swaps 15 at the stored par, the fewest
// + 3). Seed 6100: 15 tiles out of place, the fewest swaps 14, par 17; the shortest list puts one tile home a swap (the last two).
{
  const p = deal("tiles");
  const route = gradientRoute(p.frame).map((n) => ({ a: Math.floor(n / 100), b: n % 100 }));
  ok(route.length === 14 && p.par === 17, `Gradient facts: ${route.length} swaps, par ${p.par}`);
  const drafts = route.map((_, i) => encodeGradient(route.slice(0, i + 1)));
  // Fast: 14 swaps in 20 s: 150 + 35 + 15 = 200.
  ex("Gradient fast", grade(p, sentAt(p, drafts, 20_000), 100_000).score, 200);
  // Slow: solved after 104 s: 35 × 16 ÷ 90 = 6.2 → 6: 150 + 6 + 15 = 171.
  ex("Gradient slow", grade(p, sentAt(p, drafts, 100_000), 16_000).score, 171);
  // Over par: one pair swapped and swapped back three times first (20 swaps), at 80 s: 35 × 40 ÷ 90 = 15.6 → 16;
  // par 15 × (34 − 20) ÷ 17 = 12.4 → 12: 178.
  const free = p.frame.map((_, c) => c).filter((c) => !gradientLocked(p.frame, c));
  const pair = free.flatMap((a) => free.map((b) => ({ a, b }))).find(({ a, b }) => a < b && p.frame[a] !== b && p.frame[b] !== a)!;
  ex("Gradient over par", grade(p, encodeGradient([pair, pair, pair, pair, pair, pair, ...route]), 40_000).score, 178);
  // A tilesRev 5 deal (full speed within 80 s, stored before 28 Oct 2026) grades exactly as it did: 179 and 197.
  const p5 = { ...p, tilesRev: 5 } as typeof p;
  ex("Gradient tilesRev 5 fast", grade(p5, sentAt(p5, drafts, 20_000), 100_000).score, 200);
  ex("Gradient tilesRev 5 slow", grade(p5, sentAt(p5, drafts, 100_000), 16_000).score, 179);
  ex("Gradient tilesRev 5 over par", grade(p5, encodeGradient([pair, pair, pair, pair, pair, pair, ...route]), 40_000).score, 197);
  // Half: 7 swaps (7 tiles home), every draft at 60 s: 120 × 7 ÷ 15 = 56, + 7 × (10 ÷ 15) × ½ = 2.3 → 58.3 → 58.
  ex("Gradient half", grade(p, sentAt(p, drafts.slice(0, 7), 60_000), 0).score, 58);
}

// Turntable (60 s; speed 35 within 40 s; par turns 15). Seed 6100: par 8; 13 of the 40 spoke segments in place at
// the start (27 to place); after the solution's first 4 turns, 19 (6 placed).
{
  const p = deal("rings");
  const sol = p.solution ?? [];
  ok(sol.length === 8 && p.par === 8, `Turntable facts: ${sol.length} turns, par ${p.par}`);
  const drafts = sol.map((_, i) => sol.slice(0, i + 1).join(","));
  // Fast: 8 turns in 10 s: 150 + 35 + 15 = 200.
  ex("Turntable fast", grade(p, sentAt(p, drafts, 10_000), 50_000).score, 200);
  // Slow: one turn made and undone first (9 counted), solved after 52 s: 35 × 8 ÷ 20 = 14; par 15 × (16 − 9) ÷ 8 = 13.1 → 13.
  ex("Turntable slow, one over par", grade(p, `${sol[0]},${RING_UNDO},${drafts[7]}`, 8_000).score, 150 + 14 + 13);
  // Half: the first 4 turns (6 of 27 segments placed), every draft at 30 s: 120 × 6 ÷ 27 = 26.7, + 6 × (10 ÷ 27) × ½ = 1.1 → 27.8 → 28.
  ex("Turntable half", grade(p, sentAt(p, drafts.slice(0, 4), 30_000), 0).score, 28);
}

// Lightbender (60 s; speed 40 within 15 s; fewer mirrors 5 at the solution's 7; first shot 5; 20 a gem + 1.5 early).
// Seed 6100: the stored solution's eight pieces (seven mirrors and the splitter); its first seven light 2 gems, its
// first five end on a bomb.
{
  const p = deal("laser");
  const sol = p.solution ?? [];
  ok(sol.length === 8 && p.par === 7, `Lightbender facts: ${sol.length} pieces, par ${p.par}`);
  const place = (from: number, to: number, t0: number): LoggedAction[] => sol.slice(from, to).map((m, i) => ({ a: laserAction.place(m.cell, m.kind), t: t0 + i * 100 }));
  const fire = (t: number): LoggedAction => ({ a: laserAction.fire(), t });
  // Fast: all eight placed and fired at 9 s: 150 + 40 + 5 + 5 = 200.
  ex("Lightbender fast", grade(p, encodeActionLog([...place(0, 8, 1000), fire(9_000)]), 51_000).score, 200);
  // Slow: a first shot at 20 s with seven pieces (2 gems), the eighth placed at 45 s and fired at 50 s:
  // 40 × 10 ÷ 45 = 8.9 → 9; mirrors 5 (seven, the solution's count), no first-shot 5: 150 + 9 + 5 = 164.
  ex("Lightbender slow, second shot", grade(p, encodeActionLog([...place(0, 7, 1000), fire(20_000), ...place(7, 8, 45_000), fire(50_000)]), 10_000).score, 164);
  // Half: one shot at 20 s lighting 2 gems: 20 × 2 = 40, + 2 × 1.5 × (1 − 20 ÷ 60) = 2 → 42.
  ex("Lightbender half", grade(p, encodeActionLog([...place(0, 7, 1000), fire(20_000)]), 0).score, 42);
  // The same board never fired: it counts at the buzzer (a shot left), with no early extra: 40.
  ex("Lightbender unfired at the buzzer", grade(p, encodeActionLog(place(0, 7, 1000)), 0).score, 40);
  // A shot that ends on a bomb counts nothing, nor does a bomb layout standing at the buzzer: 0.
  ex("Lightbender bomb shot", grade(p, encodeActionLog([...place(0, 5, 1000), fire(20_000)]), 0).score, 0);
  // Three shots used on the bomb layout, then two more pieces placed: the board at the buzzer is not a shot: 0.
  ex("Lightbender three shots used", grade(p, encodeActionLog([...place(0, 5, 1000), fire(10_000), fire(20_000), fire(30_000), ...place(5, 7, 40_000)]), 0).score, 0);
}

// Chroma Lines (75 s; speed 40 within 20 s; clean 10, 2.5 a redraw). Seed 6100: 11 pairs; the stored solution's paths.
{
  const p = deal("flow");
  const sol = (p.solution ?? []).map((path) => [...path]);
  ok(sol.length === 11 && p.pairs.length === 11, `Chroma Lines facts: ${sol.length} pairs`);
  const upTo = (k: number) => encodeFlowPaths(p.pairs.map((_, i) => (i < k ? sol[i]! : [])));
  const drafts = sol.map((_, i) => upTo(i + 1));
  // Fast: every pair joined once, done in 10 s: 150 + 40 + 10 = 200.
  ex("Chroma Lines fast", grade(p, sentAt(p, drafts, 10_000), 65_000).score, 200);
  // Slow: pair 1 joined, cleared, joined, cleared, joined (2 redraws), solved after 64 s: 40 × 11 ÷ 55 = 8; clean 10 − 5 = 5: 163.
  const redrawn = [drafts[0]!, upTo(0), drafts[0]!, upTo(0), ...drafts];
  ok(flowRedraws(p, redrawn.map((draft, i) => ({ t: i, draft }))) === 2, "Chroma Lines: two redraws counted");
  ex("Chroma Lines slow, two redraws", grade(p, sentAt(p, redrawn, 60_000), 11_000).score, 163);
  // Half: 5 pairs on their route, every draft at 30 s: 120 × 5 ÷ 11 = 54.5, + 5 × (10 ÷ 11) × (1 − 30 ÷ 75) = 2.7 → 57.3 → 57.
  ex("Chroma Lines half", grade(p, sentAt(p, drafts.slice(0, 5), 30_000), 0).score, 57);
  // A finish without a timeline: no clean bonus: 150 + 40 = 190.
  ex("Chroma Lines fast, no timeline", grade(p, drafts[10]!, 65_000).score, 190);
}

// Pipeline (120 s; speed 40 within 60 s; par taps 10). Seed 6100: par 86 taps, 49 tiles, 1 connected at the start;
// the kit's clean play (err 0) turns each tile the fewest taps, 86 in all; after its first 23 changes, 31 connected.
{
  const p = deal("pipes");
  const drafts = kitSteps("pipes", p, PERFECT, "std:pipes:example").steps.map((s) => s.answer);
  const last = drafts[drafts.length - 1]!;
  const taps = last.split("~")[1]!.split(",");
  ok(p.par === 86 && taps.length === 86 && drafts.length === 46, `Pipeline facts: par ${p.par}, ${taps.length} taps, ${drafts.length} steps`);
  // Fast: 86 taps (par) in 30 s: 150 + 40 + 10 = 200.
  ex("Pipeline fast", grade(p, sentAt(p, drafts, 30_000), 90_000).score, 200);
  // Slow: four extra taps turning tile 0 all the way round first (90 taps), solved after 100 s: 40 × 20 ÷ 60 = 13.3 → 13;
  // par 10 × (172 − 90) ÷ 86 = 9.5 → 10: 173.
  ex("Pipeline slow, four taps over", grade(p, `${last.split("~")[0]}~0,0,0,0,${taps.join(",")}`, 20_000).score, 150 + 13 + 10);
  // Half: 23 changes (30 more connected of 48), every draft at 60 s: 120 × 30 ÷ 48 = 75, + 30 × (10 ÷ 48) × ½ = 3.1 → 78.1 → 78.
  ex("Pipeline half", grade(p, sentAt(p, drafts.slice(0, 23), 60_000), 0).score, 78);
}

// Heave (120 s; speed 25 within 45 s; gold crate 10; par pushes 15 at the fewest, 25; 24 a crate + 2 early). Seed 6100:
// five crates; the kit's clean play pushes the stored solution (25 pushes); after its first 56 steps two crates are home
// and the gold crate is on the gold mark.
{
  const p = deal("push");
  const drafts = kitSteps("push", p, PERFECT, "std:push:example").steps.map((s) => s.answer);
  ok(p.minPushes === 25 && p.crates.length === 5, `Heave facts: ${p.minPushes} pushes, ${p.crates.length} crates`);
  // Fast: in 30 s: 150 + 25 + (10 gold + 15 par) = 200.
  ex("Heave fast", grade(p, sentAt(p, drafts, 30_000), 90_000).score, 200);
  // Slow: solved after 105 s: 25 × 15 ÷ 75 = 5: 180.
  ex("Heave slow", grade(p, sentAt(p, drafts, 100_000), 15_000).score, 180);
  // Half: two crates home and the gold crate on its mark, every draft at 60 s: 24 × 2 = 48, + 2 × 2 × ½ = 2, + 10 = 60.
  const half = grade(p, drafts[55]!, 0);
  ok(half.extra?.["cratesPlaced"] === 2 && half.extra?.["goldOnMark"] === true, `Heave half facts: ${String(half.extra?.["cratesPlaced"])} crates, gold ${String(half.extra?.["goldOnMark"])}`);
  ex("Heave half", grade(p, sentAt(p, drafts.slice(0, 56), 60_000), 0).score, 60);
}

/* ------------------------------------------------------------------ 4. kit play */

interface Run {
  score: number;
  finished: boolean;
}
type Bands = Record<"nothing" | "spam" | Level, Run[]>;
const SEEDS = Array.from({ length: 8 }, (_, i) => 6100 + i * 7);

function bands(type: PatternStdType): Bands {
  const out: Bands = { nothing: [], spam: [], average: [], good: [], great: [], near: [] };
  const add = (k: keyof Bands, g: { score: number; isCorrect: boolean }) => out[k].push({ score: g.score, finished: g.isCorrect });
  for (const seed of SEEDS) {
    if (type === "gravity" || type === "tiles") {
      const p = deal(type, seed);
      const limit = puzzleTimeLimitMs(p);
      add("nothing", grade(p, "", 0));
      if (type === "gravity") {
        const spam = topsySpam(p as Of<"gravity">, hashText(`std:gravity:spam:${seed}`));
        const r = replayTopsyPuzzle(p as never, spam.split("") as GravityDir[]);
        add("spam", grade(p, spam, r.solved ? Math.max(0, limit - spam.length * 400) : 0));
      } else {
        for (const rate of [2, 1]) {
          const sp = gradientSpam(p as Of<"tiles">, hashText(`std:tiles:spam:${seed}:${rate}`), rate);
          add("spam", grade(p, sp.answer, Math.max(0, limit - sp.atMs)));
        }
      }
      for (const level of LEVELS) {
        const rngSeed = hashText(`std:${type}:${seed}:${level}`);
        const steps = type === "gravity" ? topsySteps(p as Of<"gravity">, level, rngSeed) : gradientSteps(p as Of<"tiles">, SKILLS[level], GRADIENT_ERR[level], rngSeed);
        const r = gradeSteps(p, steps);
        out[level].push({ score: r.score, finished: r.isCorrect });
      }
      continue;
    }
    const p = roomPuzzle(type, seed);
    const limit = puzzleTimeLimitMs(p);
    const kit = KITS[type]!;
    const asSent = (answer: string) => (type === "pipes" ? pipesTaps(p as Of<"pipes">, [{ answer, atMs: 0 }])[0]!.answer : answer);
    add("nothing", grade(p, asSent(kit.nothing(p)), 0));
    for (const sp of kit.spam(p, makeRng(hashText(`std:${type}:spam:${seed}`)), limit)) add("spam", grade(p, asSent(sp.answer), 0));
    for (const level of LEVELS) {
      const play = kitSteps(type, p, SKILLS[level], `std:${type}:${seed}:${level}`);
      const r = gradeSteps(p, play.steps, play.timed);
      out[level].push({ score: r.score, finished: r.isCorrect });
    }
  }
  return out;
}

/**
 * Known exception (docs/scoring-standard.md, "Pattern and Logic (first half) decisions"): Gradient's tilesRev 4 rules
 * (Joe's phone notes) lock a tile once it is home, so random swapping always finishes the board, in 15–50 s at two
 * swaps a second (today it scores about 158 that way). No scoring rule can hold a finish under 150; the standard's
 * row has no swap limit, so this is reported, not fixed: here random swapping must finish with no par bonus.
 */
const SPAM_FINISHES: ReadonlySet<PatternStdType> = new Set(["tiles"]);
/** The top the players can reach, where the great and near-perfect players may both sit (equal medians allowed there). */
const TOP: Partial<Record<PatternStdType, number>> = {
  // The kit plays the shortest route and never detours for the ice gems: 150 + 30.
  iceslide: 180,
};
const med = (runs: Run[]) => median(runs.map((r) => r.score));
const table: string[] = [];
for (const type of PATTERN_STD_TYPES) {
  const b = bands(type);
  const m = { nothing: med(b.nothing), spam: med(b.spam), average: med(b.average), good: med(b.good), great: med(b.great), near: med(b.near) };
  table.push(`  ${type.padEnd(10)} nothing ${m.nothing}  spam ${m.spam}  average ${m.average}  good ${m.good}  great ${m.great}  near ${m.near}`);
  if (SPAM_FINISHES.has(type)) {
    ok(b.spam.every((r) => r.finished && r.score <= 150 + 35), `${type}: random swapping finishes with no par bonus (${b.spam.map((r) => r.score).join(", ")})`);
    console.log(`NOTE ${type}: random swapping finishes the board (median ${m.spam}); see the decisions in docs/scoring-standard.md`);
  } else {
    ok(m.nothing <= m.spam && m.spam <= 10, `${type}: nothing ${m.nothing} ≤ spam ${m.spam} ≤ 10`);
    ok(m.spam < m.average, `${type}: spam ${m.spam} < average ${m.average}`);
  }
  ok(m.nothing === 0 && m.average > 0, `${type}: nothing scores 0 (${m.nothing}), an average player more (${m.average})`);
  ok(m.average < m.good, `${type}: average ${m.average} < good ${m.good}`);
  ok(m.good < m.great, `${type}: good ${m.good} < great ${m.great}`);
  ok(m.great < m.near || (m.great === m.near && m.near >= (TOP[type] ?? 200)), `${type}: great ${m.great} < near ${m.near} (or both at the top, ${TOP[type] ?? 200})`);
  const all = Object.values(b).flat();
  const finishes = all.filter((r) => r.finished).map((r) => r.score);
  const unfinished = all.filter((r) => !r.finished).map((r) => r.score);
  if (finishes.length && unfinished.length) ok(Math.min(...finishes) > Math.max(...unfinished), `${type}: every finish (lowest ${Math.min(...finishes)}) beats every unfinished score (highest ${Math.max(...unfinished)})`);
}
console.log(`kit medians (${SEEDS.length} room seeds):\n${table.join("\n")}`);

if (failures.length) {
  console.log(failures.map((f) => `FAIL ${f}`).join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} checks`);
  process.exit(1);
}
console.log(`standard-pattern-check: ${checks} checks passed`);
