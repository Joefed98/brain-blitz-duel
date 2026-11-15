/**
 * strategy-overhaul-check (phase 2 step 4, 15 Nov 2026; docs/design/pages-review/strategy/GALLERY.md): the Strategy
 * overhaul's first stage, the look and the game changes. Proves:
 *
 *  1. Coral Pop bubbleRev 12: rooms deal it; every seed's reef is the 86-bubble reef with its 6 chests; the fast shot
 *     (the release's `c`, 0–2) follows exactly the same path as a plain shot (the same landing cell, pops and drops)
 *     and only arrives sooner; `c` past 2 is clamped; bubbleRev 11 never reads `c` (a log with `c` replays as without);
 *     a run with fast shots replays through the server unflagged to the phone's own score; the round is at most 120 s.
 *  2. Rainbow Bridge inkRev 15: rooms deal it from its proved deal (INK_HILLS_DEAL); each run's pot plan uses all four
 *     placements, never the same twice running; the pot really moves (heights spread across a run, and in every
 *     placement the level is laid out as planned); a sample of dealt seeds re-proved level by level and their stored
 *     witnesses scoring exactly 200 through the server replay (CHECKS_FULL=1: every seed); bigger birds; 120 s.
 *  3. No words over the boards: every Strategy game's live effects spec draws its text in a strip off the board
 *     (Tilt above the disc, Gemstone between the board and its goals, Coral Pop under the gun, Rainbow Bridge under
 *     its counters, Ball Tracker in its waiting row's free end), and Coral Pop's own words sit beside the gun.
 *  4. Edge to edge: Tilt's table shade at the world's edges is the colour the scene round it starts from.
 *  5. The help and intro say what changed (the fast shot, the moving pot, the treasure chest and how it comes down).
 *  6. Older stamps replay exactly: bubbleRev 11 and inkRev 14 states are unchanged by the new code paths.
 *
 *   bun scripts/strategy-overhaul-check.ts
 */
import { readFileSync } from "node:fs";

import {
  bubbleGameFor,
  bubbleInputRangesFor,
  bubCheckpoint,
  BUB_CHEST,
  BUB_REV_FAST,
  BUB_REV_STD,
  BUB_RUN_TICKS,
  BUB_V12_REEF,
  BUB_V12_FAST_MAX,
  bubFastLevel,
  BUB_CHECKPOINT_INTERVAL,
  type BubState,
} from "../src/lib/arcade/bubble";
import { TICKS_PER_SECOND, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  inkBridgeGameFor,
  inkV15PotPlan,
  INK_REV_BIG,
  INK_REV_HILLS,
  INK_RUN_TICKS,
  INK_V15_BIRD_H_FP,
  type InkState,
} from "../src/lib/arcade/inkBridge";
import { encodeBubbleRun, replayBubbleRun } from "../src/lib/duel/bubble";
import { generateBubble, generateInkBridge } from "../src/lib/duel/arcade.server";
import { INK_HILLS_DEAL } from "../src/lib/duel/inkHillsDeal.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { STRATEGY_TEXT_BAND, BALLTRACK_TEXT_X, fxSpecAt, BUBBLE_FX, bubbleFxFor, balltrackFxFor, inkBridgeFxFor } from "../src/lib/arcade/arcadeFxGames.renderer";
import { TILT_X_FX, TILT_X_TEXT_Y, WALNUT_TABLE, WALNUT_TABLE_EDGE, TILT_TABLE_SHADE } from "../src/lib/arcade/tiltArt.renderer";
import { BT_HOPPER_H, BT_W } from "../src/lib/arcade/ballTrack";
import { MATCHUP_BOARD_Y, MATCHUP_CELL_PX, MATCHUP_V9_PANEL_Y, MATCHUP_V9_BOARD_H } from "../src/lib/arcade/matchup";
import { inkBigProved, inkBigVerdict, readInkBigWitnesses, INK_HILLS_WITNESS } from "./ink-big-deal";

let passes = 0;
const failures: string[] = [];
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else failures.push(message);
}
const section = (title: string) => console.log(`— ${title}`);
const FULL = process.env.CHECKS_FULL === "1";

/* ------------------------------------------------------------------ 1. Coral Pop */
section("Coral Pop bubbleRev 12: the reef, the fast shot on the same path, replay");
{
  ok(generateBubble().bubbleRev === BUB_REV_FAST && BUB_REV_FAST === BUB_REV_STD + 1, "rooms deal bubbleRev 12, one above bubbleRev 11");
  ok(BUB_RUN_TICKS <= 120 * TICKS_PER_SECOND, `the round is at most 120 s (${BUB_RUN_TICKS / TICKS_PER_SECOND} s)`);
  const game = bubbleGameFor(BUB_REV_FAST);
  let reefs = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const s = game.init(seed) as BubState;
    if (s.startCount === BUB_V12_REEF && s.grid.filter((v) => v === BUB_CHEST).length === 6 && s.fast === 1) reefs++;
  }
  ok(reefs === 200, `every seed's reef is ${BUB_V12_REEF} bubbles with 6 chests (${reefs} of 200)`);

  // The same path: a plain and a fast release from the same state land on the same cell with the same outcome.
  const flight = (s0: BubState, a: number, b: number, c: number) => {
    let s = game.step(s0, { t: s0.tick + 1, k: 2, a, b, c, d: 0 }) as BubState;
    let ticks = 1;
    while (s.flightColour !== 0 && !game.isOver(s) && ticks < 2000) {
      s = game.step(s, null) as BubState;
      ticks++;
    }
    return { s, ticks };
  };
  let same = 0;
  let sooner = 0;
  let tried = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const s0 = { ...(game.init(seed) as BubState), acted: 1 };
    for (const [a, b] of [[-3600, -1200], [-1500, -3000], [0, -4000], [900, -2500], [3300, -1400]] as const) {
      tried++;
      const plain = flight(s0, a, b, 0);
      for (const c of [1, 2]) {
        const fast = flight(s0, a, b, c);
        if (JSON.stringify(fast.s.grid) === JSON.stringify(plain.s.grid) && fast.s.popped === plain.s.popped && fast.s.dropped === plain.s.dropped && fast.s.shots === plain.s.shots && (fast.s.banks ?? 0) === (plain.s.banks ?? 0)) same++;
        if (fast.ticks < plain.ticks) sooner++;
      }
    }
  }
  ok(same === tried * 2, `a fast shot lands exactly where a plain one does (${same} of ${tried * 2})`);
  ok(sooner === tried * 2, `a fast shot arrives sooner (${sooner} of ${tried * 2})`);
  // Level 2 is quicker than level 1.
  {
    const s0 = { ...(game.init(7) as BubState), acted: 1 };
    const t1 = flight(s0, 0, -4000, 1).ticks;
    const t2 = flight(s0, 0, -4000, 2).ticks;
    ok(t2 < t1, `level 2 arrives before level 1 (${t2} < ${t1} ticks)`);
  }
  ok(bubbleInputRangesFor(BUB_REV_FAST).find((r) => r.k === 2)?.c[1] === BUB_V12_FAST_MAX, "bubbleRev 12's input range carries c 0–2");
  ok(bubbleInputRangesFor(BUB_REV_STD).find((r) => r.k === 2)?.c[1] === 0, "bubbleRev 11's input range clamps c to 0 (it never reads it)");
  ok(bubFastLevel(0) === 0 && bubFastLevel(109) === 0 && bubFastLevel(110) === 1 && bubFastLevel(189) === 1 && bubFastLevel(190) === 2 && bubFastLevel(600) === 2, "the phone's drag lengths map to levels 0, 1, 2");

  // A played run with fast shots, through the server replay.
  const play = (rev: number, cOf: (i: number) => number) => {
    const g = bubbleGameFor(rev);
    let s = g.init(4242) as BubState;
    const events: ArcadeInputEvent[] = [];
    const checkpoints: ReturnType<typeof bubCheckpoint>[] = [];
    let i = 0;
    while (!g.isOver(s) && s.tick < BUB_RUN_TICKS) {
      let ev: ArcadeInputEvent | null = null;
      if (s.flightColour === 0 && s.tick % 40 === 0) {
        ev = { t: s.tick + 1, k: 2, a: ((i * 977) % 6000) - 3000, b: -2000 - ((i * 331) % 1800), c: cOf(i), d: 0 };
        i++;
      }
      if (ev) events.push(ev);
      s = g.step(s, ev) as BubState;
      if (s.tick % BUB_CHECKPOINT_INTERVAL === 0) checkpoints.push(bubCheckpoint(s));
    }
    const raw = encodeBubbleRun({ seed: 4242, claimedScore: g.score(s), events, endTick: s.tick, checkpoints });
    return { s, raw, score: g.score(s) };
  };
  const fastRun = play(BUB_REV_FAST, (i) => i % 3);
  const verdict = replayBubbleRun(4242, fastRun.raw, BUB_REV_FAST);
  ok(!verdict.flagged && verdict.score === fastRun.score, `a run with fast shots replays unflagged to its own score (${verdict.score}, flagged ${verdict.flagged}${verdict.reason ? `: ${verdict.reason}` : ""})`);
  // bubbleRev 11 ignores c: the same log with and without c replays to the same state.
  const with11 = play(BUB_REV_STD, (i) => i % 3);
  const without11 = play(BUB_REV_STD, () => 0);
  ok(JSON.stringify(bubCheckpoint(with11.s)) === JSON.stringify(bubCheckpoint(without11.s)) && with11.score === without11.score, "bubbleRev 11 plays a log with c exactly as without it");
  const r11 = replayBubbleRun(4242, with11.raw, BUB_REV_STD);
  ok(r11.score === without11.score, "bubbleRev 11's server replay scores the c-carrying log as before");
}

/* ------------------------------------------------------------------ 2. Rainbow Bridge */
section("Rainbow Bridge inkRev 15: the deal, the pot plan, the moving pot, proofs and witnesses");
{
  const deal = new Set(INK_HILLS_DEAL);
  const dealt = Array.from({ length: 30 }, () => generateInkBridge());
  ok(dealt.every((p) => p.inkRev === INK_REV_HILLS && deal.has(p.seed)), "rooms deal inkRev 15 on seeds of its proved deal");
  ok(INK_HILLS_DEAL.length === 100 && new Set(INK_HILLS_DEAL).size === 100, "the deal holds 100 distinct proved seeds");
  ok(INK_RUN_TICKS <= 120 * TICKS_PER_SECOND, "the round is at most 120 s");
  ok(INK_V15_BIRD_H_FP === 14 * 256, "inkRev 15's birds are 14 px thick (fewer, bigger)");
  for (const seed of INK_HILLS_DEAL.slice(0, 40)) {
    const plan = inkV15PotPlan(seed);
    const uses = [0, 1, 2, 3].map((p) => plan.filter((v) => v === p).length);
    ok(plan.length === 10 && uses.every((n) => n >= 2) && plan.every((v, i) => i === 0 || v !== plan[i - 1]), `seed ${seed}: the plan uses all four placements, never twice running (${plan.join("")})`);
  }
  const game = inkBridgeGameFor(INK_REV_HILLS);
  let spreadOk = 0;
  const sample = INK_HILLS_DEAL.slice(0, 12);
  for (const seed of sample) {
    const s = game.init(seed) as InkState;
    const ys = s.list.map((l) => l.bucketY);
    if (Math.max(...ys) - Math.min(...ys) >= 100) spreadOk++;
  }
  ok(spreadOk === sample.length, `the pot's height varies by 100 px or more across each run (${spreadOk} of ${sample.length})`);
  // inkRev 14 keeps its own pots (the plan is in force only for inkRev 15).
  const big = inkBridgeGameFor(INK_REV_BIG).init(sample[0]!) as InkState;
  const hills = game.init(sample[0]!) as InkState;
  ok(JSON.stringify(big.list.map((l) => [l.bucketX, l.bucketY])) !== JSON.stringify(hills.list.map((l) => [l.bucketX, l.bucketY])), "inkRev 14 and 15 lay out their pots differently");
  ok(big.list.every((l) => l.blocks.every((b) => !b.h || b.h === 10 * 256)), "inkRev 14 keeps its 10 px birds");
  ok(hills.list.every((l) => l.blocks.every((b) => !b.h || b.h === INK_V15_BIRD_H_FP)), "inkRev 15 draws 14 px birds");
  const witnesses = readInkBigWitnesses(INK_HILLS_WITNESS);
  ok(witnesses.length === INK_HILLS_DEAL.length && witnesses.every((w, i) => w.seed === INK_HILLS_DEAL[i]), "the stored witnesses are exactly the deal's seeds in order");
  const proveSome = FULL ? witnesses : witnesses.filter((_, i) => i % 25 === 0);
  for (const w of proveSome) {
    const v = inkBigVerdict(w.seed, w.events, INK_REV_HILLS);
    ok(v.score === 200 && !v.flagged, `seed ${w.seed}: its witness scores exactly 200 through the server replay (${v.score}${v.flagged ? ", flagged" : ""})`);
    ok(inkBigProved(w.seed, INK_REV_HILLS), `seed ${w.seed}: every level proved (drawable within its ink, bonus line, two clovers, ink pars)`);
  }
}

/* ------------------------------------------------------------------ 3. No words over the boards */
section("Words off the boards");
{
  // Tilt: the text strip sits above the disc, which fills the width (radius at most half the 440 world, centre 410).
  ok(TILT_X_FX.textBand === TILT_X_TEXT_Y && TILT_X_TEXT_Y + 14 < 410 - 220, `Tilt's words sit above the disc (y ${TILT_X_TEXT_Y})`);
  // Gemstone: between the board's bottom and the goals panel.
  const boardBottom = MATCHUP_BOARD_Y + MATCHUP_V9_BOARD_H;
  ok(STRATEGY_TEXT_BAND.matchup > boardBottom && STRATEGY_TEXT_BAND.matchup < MATCHUP_V9_PANEL_Y && MATCHUP_V9_BOARD_H % MATCHUP_CELL_PX === 0, `Gemstone's words sit between the board (bottom ${boardBottom}) and its goals (${MATCHUP_V9_PANEL_Y})`);
  // Coral Pop: under the gun, inside the world.
  const bubState = bubbleGameFor(BUB_REV_FAST).init(1) as BubState;
  const bubSpec = bubbleFxFor(bubState);
  ok(bubSpec.textBand !== undefined && bubSpec.textBand > 690 && bubSpec.textBand < bubSpec.height, `Coral Pop's words sit under the gun (y ${bubSpec.textBand} of ${bubSpec.height})`);
  ok(fxSpecAt(BUBBLE_FX, bubSpec.height).textBand === undefined, "older Coral Pop rounds keep their words where they were");
  const coral = readFileSync("src/lib/arcade/bubble.renderer.ts", "utf8");
  ok(/if \(state\?\.fast\)[\s\S]{0,400}BUB_SHOOTER_X \+ side \* 104/.test(coral), "Coral Pop's BANK, COMBO and TREASURE words sit beside the gun on bubbleRev 12");
  // Rainbow Bridge: under the HUD, above every bird (birds start at y 130) and the pots.
  const ink = inkBridgeGameFor(INK_REV_HILLS).init(INK_HILLS_DEAL[0]!) as InkState;
  const inkSpec = inkBridgeFxFor(ink);
  const topBird = Math.min(...ink.list.flatMap((l) => l.blocks.filter((b) => b.h).map((b) => b.y)));
  ok(inkSpec.textBand === STRATEGY_TEXT_BAND.inkbridge && STRATEGY_TEXT_BAND.inkbridge + 12 < topBird, `Rainbow Bridge's words sit above the birds (y ${STRATEGY_TEXT_BAND.inkbridge}, first bird ${topBird})`);
  // Ball Tracker: in its waiting row's strip.
  const bt = balltrackFxFor({ r7: 1 } as never);
  ok(bt.textBand === STRATEGY_TEXT_BAND.balltrack && STRATEGY_TEXT_BAND.balltrack < BT_HOPPER_H && bt.textX === BALLTRACK_TEXT_X && BALLTRACK_TEXT_X > BT_W / 2, "Ball Tracker's words sit in its waiting row's free right half, above the board");
  ok(bt.textBand === STRATEGY_TEXT_BAND.balltrack, "Ball Tracker's words sit in the strip over its board (btRev 7 on; older rounds unchanged)");
  ok(balltrackFxFor({} as never).textBand === undefined, "older Ball Tracker rounds keep their words where they were");
  const gem = readFileSync("src/lib/arcade/matchup.renderer.ts", "utf8");
  ok(/MATCHUP_BOARD_Y \+ L\.boardH \+ 9/.test(gem) && !/MATCHUP_BOARD_Y \+ L\.boardH \* 0\.42/.test(gem), "Gemstone's GOAL! and TREASURE! sit under the board, never over the gems");
}

/* ------------------------------------------------------------------ 4. Edge to edge */
section("Edge to edge");
{
  const hex = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
  const table = hex(WALNUT_TABLE);
  const edge = hex(WALNUT_TABLE_EDGE);
  ok(table.every((v, i) => Math.abs(Math.round(v * (1 - TILT_TABLE_SHADE)) - edge[i]!) <= 1), `Tilt's shaded table at the world's edge is ${WALNUT_TABLE_EDGE}`);
  const fills = readFileSync("src/lib/arcade/arenaFills.renderer.ts", "utf8");
  ok(fills.includes(`ctx.fillStyle = "${WALNUT_TABLE_EDGE}";`), "the scene round Tilt's world starts from that same colour");
  const stage = readFileSync("src/puzzles/tilt.tsx", "utf8");
  ok(stage.includes("WALNUT_TABLE_EDGE"), "Tilt's stage background is that colour too");
  const inkStage = readFileSync("src/puzzles/inkBridge.tsx", "utf8");
  ok(/inkArenaScene\(ctx, view, inkSceneGround\(state\), inkWorldH\(state\), inkSunset\(state\)\)/.test(inkStage) && /inkSunset\(state\) \* 9/.test(inkStage), "Rainbow Bridge's scene round the world takes the same sunset and repaints as it changes");
}

/* ------------------------------------------------------------------ 5. Help and intro */
section("The help and intro say what changed");
{
  const text = (type: string) => {
    const h = PUZZLE_INSTRUCTIONS[type as keyof typeof PUZZLE_INSTRUCTIONS] as { goal: string; how: { action: string; detail: string }[] };
    return `${h.goal} ${h.how.map((x) => `${x.action} ${x.detail}`).join(" ")}`;
  };
  ok(/drag further for a faster shot/i.test(text("bubble")) && /same path/.test(text("bubble")) && /86 bubbles/.test(text("bubble")), "Coral Pop's help explains the fast shot and the 86-bubble reef");
  ok(/pot moves between levels/i.test(text("inkbridge")), "Rainbow Bridge's help says the pot moves between levels");
  ok(/treasure chest/i.test(text("matchup")) && /Bring chests down/.test(text("matchup")) && /swap it with a neighbour/.test(text("matchup")), "Gemstone's intro and help explain how to bring the treasure chest down");
  const intro = (type: string) => (PUZZLE_INSTRUCTIONS[type as keyof typeof PUZZLE_INSTRUCTIONS] as { how: { helpOnly?: boolean }[] }).how.filter((x) => !x.helpOnly).length;
  for (const type of ["tilt", "matchup", "bubble", "inkbridge", "balltrack"]) ok(intro(type) <= 4, `${type}: at most four intro HOW lines`);
}

/* ------------------------------------------------------------------ 6. Older stamps */
section("Older stamps unchanged");
{
  const s11 = bubbleGameFor(BUB_REV_STD).init(99) as BubState;
  ok(s11.startCount === 95 && s11.fast === undefined && s11.boost === undefined, "bubbleRev 11 keeps its 95-bubble reef and no fast-shot fields");
  const i14 = inkBridgeGameFor(INK_REV_BIG).init(1655421732) as InkState;
  ok(i14.rev === INK_REV_BIG && i14.list.length === 10, "inkRev 14 still builds its ten levels");
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  console.log(`FAIL strategy-overhaul-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS strategy-overhaul-check: ${passes} checks — Coral Pop's fast shot on the same path and its 86-bubble reef, Rainbow Bridge's moving pot from its proved deal, words off the boards, edge-to-edge fills, the help`);
