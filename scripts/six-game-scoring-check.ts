/** Formula, schedule and intro/reveal regressions for the six Oct 6 scoring changes; no identity proof here. */
import { readFileSync } from "node:fs";
import { btCheckpoint, btScoreOf, btScoreOfV2, BT_BALLS, BT_DROP_TICKS, BT_LAST_LAND_MIN, BT_REV, BT_REV_BAND, BT_RUN_TICKS, makeBallTrackGame } from "../src/lib/arcade/ballTrack";
import { decodeInputEvents, inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeBallTrackRun, replayBallTrackRun } from "../src/lib/duel/ballTrack";
import { matchupGame, matchupRev2Game, matchupRev3Game, matchupGameFor, MATCHUP_PAR_RAW, MATCHUP_V2_PAR_RAW, MATCHUP_V3_PAR_RAW, MATCHUP_REV_BAND } from "../src/lib/arcade/matchup";
import { juncScoreOf, junctionGameFor, JUNC_REV_BAND } from "../src/lib/arcade/junction";
import { rallyGame, rallyGameFor, RALLY_REV_BAND } from "../src/lib/arcade/rally";
import { skylineGame, skylineGameFor, SKYLINE_REV_BAND } from "../src/lib/arcade/skyline";
import { bullseyeGameFor, bullseyeScoreFor, BULLSEYE_REV_BAND, BULLSEYE_RING_VALUES } from "../src/lib/arcade/bullseye";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { binTossGame, binTossGameFor, BINTOSS_REV3, BINTOSS_THROWS, BINTOSS_V3_PARTIAL_MAX } from "../src/lib/arcade/binToss";
import { tiltGame, tiltRev2Game, TILT_MAX_MAZES, TILT_V2_STARS } from "../src/lib/arcade/tilt";
import { breakerGame, BRK_BRICKS } from "../src/lib/arcade/breaker";
import { bubbleGame, bubbleRev2Game } from "../src/lib/arcade/bubble";
import { swingGame, swingMetres, SWING_FINISH_M } from "../src/lib/arcade/swing";
import { inkRev4Score, inkScoreOf, INK_LEVELS, INK_STAR_LEVELS, INK_V4_PARTIAL_MAX } from "../src/lib/arcade/inkBridge";
import { orbitGame, ORBIT_TOTAL } from "../src/lib/arcade/orbit";
import { orbitRev3Game } from "../src/lib/arcade/orbitRev3";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { BALL_TRACK_BANK } from "../src/lib/duel/ballTrackBank.server";

let checks = 0;
const eq = (actual: unknown, expected: unknown, label: string) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error(`${label}: ${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
};
const clamp = (n: number) => Math.max(0, Math.min(150, n));
for (let home = 0; home <= 30; home++) for (let wrong = 0; wrong <= 30 - home; wrong++) {
  eq(btScoreOf(home, wrong), Math.round(130 * home / 30), "Ball Track base/no penalty");
}
for (const last of [0, 1800, 2988, 3600]) eq(btScoreOf(30, 0, last), 130 + Math.round(20 * Math.min(1, (3600 - last) / 1800)), "Ball Track finish (speed par)");
const first = BALL_TRACK_BANK[0];
if (!first) throw Error("Missing Ball Track course");
const game = makeBallTrackGame(first.course);
let state = game.init(1);
const releases: number[] = [];
while (state.tick < 3000) {
  const before = state.next;
  state = game.step(state, null);
  if (state.next > before) releases.push(state.tick);
}
eq([BT_BALLS, BT_DROP_TICKS, BT_RUN_TICKS, releases.length, releases[0], releases.at(-1)], [30, 103, 3600, 30, 1, 2988], "Ball Track actual release schedule");
eq(MATCHUP_PAR_RAW, 2500, "Matchup par");
const match = matchupGame.init(1);
for (let raw = 0; raw <= 4000; raw++) eq(matchupGame.score({ ...match, raw }), clamp(Math.floor(150 * raw / 2500)), "Matchup");
// matchupRev 2 (constant play) scores against its own par; the "?" help states it.
const match2 = matchupRev2Game.init(1);
for (let raw = 0; raw <= 8000; raw += 7) eq(matchupRev2Game.score({ ...match2, raw }), clamp(Math.floor(150 * raw / MATCHUP_V2_PAR_RAW)), "Matchup rev 2");
// matchupRev 3 (original fall speed) has its own par, stated in the help.
const match3 = matchupRev3Game.init(1);
for (let raw = 0; raw <= 9000; raw += 7) eq(matchupRev3Game.score({ ...match3, raw }), clamp(Math.floor(150 * raw / MATCHUP_V3_PAR_RAW)), "Matchup rev 3");
for (let cars = 0; cars <= 90; cars++) for (const gave of [0, 1, 50]) for (const through of [0, 1, 4]) for (const stopped of [0, 1, 4]) for (const survived of [false, true]) {
  eq(juncScoreOf(cars, gave, survived, through, stopped), clamp(2 * cars + 4 * through - 4 * stopped - gave + (survived ? 40 : 0)), "Junction");
}
const rally = rallyGame.init(1), skyline = skylineGame.init(1);
for (let goldHits = 0; goldHits <= 100; goldHits++) eq(rallyGame.score({ ...rally, goldHits }), clamp(Math.floor(2.5 * goldHits)), "Rally");
for (let placed = 0; placed <= 100; placed++) for (let perfects = 0; perfects <= placed; perfects++) eq(skylineGame.score({ ...skyline, placed, perfects }), clamp(Math.floor(2.5 * placed + 3 * perfects)), "Skyline");
for (let total = 0; total <= 100; total++) eq(bullseyeScoreFor(total), clamp(Math.floor(17 * total / 10 - 20)), "Bullseye");
for (const [total, score] of [[100, 150], [90, 133], [70, 99], [50, 65]]) eq(bullseyeScoreFor(total), score, "Bullseye anchor");
eq(BULLSEYE_RING_VALUES, [10, 9, 8, 3, 2, 1], "Unchanged rings");
for (const home of [0, 15, 29, 30]) {
  const reveal = buildArcadeReveal("balltrack", { home, wrong: 0, lost: 0 }, btScoreOf(home, 0));
  eq(reveal?.axis.max, 30, "Ball Track reveal axis");
  eq(reveal?.tiles[0]?.value, `${home} / 30`, "Ball Track reveal tile");
  eq(reveal?.lines[0]?.startsWith(`${home} / 30 home`), true, "Ball Track breakdown");
}
eq(buildArcadeReveal("matchup", { raw: 2500 }, 150)?.axis.max, 2500, "Matchup reveal par");
// Oct 2026 score bands: intros describe the band rules in plain words (the exact knots live in the "?" help).
for (const [type, text] of [["balltrack", "all 30 home"], ["junction", "± for ambulances"], ["rally", "pink target"], ["skyline", "perfects in a row"]] as const) eq(INTRO_SCORE[type].includes(text), true, `${type} intro`);
for (const [type, text] of [["matchup", "1,300"], ["bullseye", "inner bull or a balloon 12"], ["junction", "−4"], ["skyline", "perfect drop counts 5"], ["rally", "gold-ball hit counts 5"], ["balltrack", "56.5 s"]] as const) eq(PUZZLE_INSTRUCTIONS[type].score.includes(text), true, `${type} help`);
// The 11 Oct 130 / 150 split is gone from every intro: no partial cap is stated any more.
for (const type of ["balltrack", "bintoss", "breaker", "bubble", "inkbridge", "orbit", "swing", "tilt"] as const) eq(/otherwise up to \d+/.test(INTRO_SCORE[type]), false, `${type} intro has no partial cap`);
// The legacy split figures still hold for stored rounds (they replay on their original rules).
const SPLIT_PARTIAL_MAX = { balltrack: 126, bintoss: BINTOSS_V3_PARTIAL_MAX, breaker: 128, bubble: 99, inkbridge: INK_V4_PARTIAL_MAX, orbit: 117, swing: 130, tilt: 115 } as const;
eq(btScoreOf(BT_BALLS - 1, 0), SPLIT_PARTIAL_MAX.balltrack, "Ball Tracker partial max");
// btRev 2: the full-clear speed bonus is timed over the window the last marble can land in
// (tick 3180 to 3600), so a perfect, fast run reaches 150; the partial maximum stays 126.
eq(BT_LAST_LAND_MIN, 3180, "Ball Tracker earliest last landing");
for (let home = 0; home < BT_BALLS; home++) eq(btScoreOfV2(home, 0), Math.round(130 * home / 30), "Ball Tracker rev 2 partial");
eq(btScoreOfV2(BT_BALLS - 1, BT_LAST_LAND_MIN), SPLIT_PARTIAL_MAX.balltrack, "Ball Tracker rev 2 partial max");
for (let last = BT_LAST_LAND_MIN - 200; last <= BT_RUN_TICKS; last += 7) {
  const left = BT_RUN_TICKS - Math.max(BT_LAST_LAND_MIN, last);
  eq(btScoreOfV2(BT_BALLS, last), 130 + Math.round(20 * Math.min(1, left / 210)), "Ball Tracker rev 2 finish (par over the landing window)");
}
eq(btScoreOfV2(BT_BALLS, BT_LAST_LAND_MIN), 150, "Ball Tracker rev 2 full clear at the earliest landing = 150");
eq(btScoreOfV2(BT_BALLS, 3390), 150, "Ball Tracker rev 2 full bonus through 56.5 s");
eq(btScoreOfV2(BT_BALLS, BT_RUN_TICKS), 130, "Ball Tracker rev 2 bonus 0 at the buzzer");
// Proof on real logs: banked playbooks replayed through the server path under rev 2 reach 150.
let bt150 = 0;
for (const [index, entry] of BALL_TRACK_BANK.entries()) {
  if (index % 20 !== 0) continue;
  const g = makeBallTrackGame(entry.course, BT_REV);
  const byTick = new Map(decodeInputEvents(entry.playbook).map((e) => [e.t, e]));
  let st = g.init(1);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: ReturnType<typeof btCheckpoint>[] = [];
  while (!g.isOver(st)) {
    const t = st.tick + 1;
    const e = byTick.get(t);
    if (e) recordInput(events, e, g.inputRanges);
    st = g.step(st, inputAt(events, t));
    if (st.tick % 300 === 0) checkpoints.push(btCheckpoint(st));
  }
  const score = g.score(st);
  const replay = replayBallTrackRun(entry.course, index + 1, encodeBallTrackRun(entry.course, { seed: index + 1, claimedScore: score, events, endTick: st.tick, checkpoints }, BT_REV), BT_REV);
  eq([replay.score, replay.flagged, replay.home], [score, false, 30], "Ball Tracker rev 2 playbook replay");
  if (score === 150) bt150++;
}
eq(bt150 > 0, true, "Ball Tracker rev 2: a real perfect run reaches 150 through the server replay");
// Unstamped rounds keep the original 60 s timing (a perfect run tops out at 135).
eq(btScoreOf(BT_BALLS, 0, BT_LAST_LAND_MIN), 135, "Ball Tracker original perfect-run maximum unchanged");
const brk = breakerGame.init(1);
eq(brk.bricks.length, BRK_BRICKS, "Breaker brick count");
eq(breakerGame.score({ ...brk, bricks: brk.bricks.map((_, i) => (i === 0 ? 1 : 0)) }), SPLIT_PARTIAL_MAX.breaker, "Breaker partial max");
const bub = bubbleGame.init(1);
const lastBubble = bub.grid.findIndex((cell) => cell !== 0);
// Coral Pop: rounds stamped bubbleRev 2 (current) cap a part-cleared field at 99; original rounds keep 128.
eq(bubbleRev2Game.score({ ...bubbleRev2Game.init(1), cleared: false, grid: bub.grid.map((cell, i) => (i === lastBubble ? cell : 0)) }), SPLIT_PARTIAL_MAX.bubble, "Coral Pop partial max");
eq(bubbleGame.score({ ...bub, cleared: false, grid: bub.grid.map((cell, i) => (i === lastBubble ? cell : 0)) }), 128, "Coral Pop original partial max");
for (let seed = 1; seed <= 200; seed++) eq(bubbleGame.init(seed).startCount, bub.startCount, "Coral Pop field size is fixed");
const sw = swingGame.init(1);
const sw499 = { ...sw, maxX: sw.maxX + (SWING_FINISH_M - 1) * 40 * 256 + 39 * 256 };
eq(swingMetres(sw499), SWING_FINISH_M - 1, "Grappler test state is 499 m");
eq(swingGame.score(sw499), SPLIT_PARTIAL_MAX.swing, "Grappler partial max (499 m)");
eq(binTossGame.score({ ...binTossGame.init(1), baskets: BINTOSS_THROWS - 1 }), 90, "Swish partial max (unstamped and rev 2)");
// binRev 3: nine in plus all three hoop bonuses.
eq(binTossGameFor(BINTOSS_REV3).score({ ...binTossGameFor(BINTOSS_REV3).init(1), baskets: BINTOSS_THROWS - 1, swishes: 3 }), SPLIT_PARTIAL_MAX.bintoss, "Swish rev 3 partial max");
// tiltRev 2 (the intro's rules): three mazes and all eight stars; the original rules' partial max stays 90.
eq(tiltRev2Game.score({ ...tiltRev2Game.init(1), mazes: TILT_MAX_MAZES - 1, stars: TILT_V2_STARS }), SPLIT_PARTIAL_MAX.tilt, "Tilt partial max");
eq(tiltGame.score({ ...tiltGame.init(1), mazes: TILT_MAX_MAZES - 1 }), 90, "Tilt original partial max");
eq(inkScoreOf(INK_LEVELS - 1, 0), 99, "Rainbow Bridge partial max (inkRev 3 and older)");
// inkRev 4: nine levels plus every gold star.
eq(inkRev4Score(INK_LEVELS - 1, INK_STAR_LEVELS, 0), SPLIT_PARTIAL_MAX.inkbridge, "Rainbow Bridge rev 4 partial max");
for (const game of [orbitGame, orbitRev3Game] as const) {
  eq(game.score({ ...game.init(1), best: ORBIT_TOTAL - 1, finished: 0 } as never), SPLIT_PARTIAL_MAX.orbit, "Orbit partial max");
}
for (const [type, goal] of [["balltrack", "Get all 30 home quickly for up to 150"], ["bintoss", "All 10 in for 10 more"], ["breaker", "Clear all 80 quickly for up to 150"], ["inkbridge", "All 10 levels quickly: up to 150"], ["swing", "Reach 500 metres for 10 more"], ["tilt", "All 4 quickly: up to 150"]] as const) {
  eq(INTRO_SCORE[type].includes(goal), true, `${type} intro goal`);
}
// Scrumper and Mixed Signals are not on the split: no partial cap at 130.
for (const type of ["snip", "stroop"] as const) eq(INTRO_SCORE[type].includes("otherwise up to 130"), false, `${type} intro has no split line`);
eq(INTRO_SCORE.snip.includes("for 130"), false, "Scrumper intro: a full clear is not a flat 130");
eq(INTRO_SCORE.snip.includes("each apple and leaf"), true, "Scrumper intro points");
eq(PUZZLE_INSTRUCTIONS.snip.score.includes("Each apple counts 10 and each leaf 2"), true, "Scrumper help points");
for (const type of ["balltrack", "snip"] as const) eq(/75 s|÷ \d+ s/.test(PUZZLE_INSTRUCTIONS[type].score), false, `${type} help has no seconds divisor`);
// Oct 2026 score bands for the six games: each formula against an independent straight-line reading of its knots.
const line = (units: readonly number[], points: readonly number[], a: number) => {
  if (a <= 0) return 0;
  for (let i = 1; i < units.length; i++) if (a <= units[i]!) return points[i - 1]! + Math.floor(((points[i]! - points[i - 1]!) * (a - units[i - 1]!)) / (units[i]! - units[i - 1]!));
  return points.at(-1)!;
};
const acted = { band: 1, acted: 1 } as const;
const btBand = makeBallTrackGame(first.course, BT_REV_BAND);
const bt0 = btBand.init(1);
for (let home = 0; home <= BT_BALLS; home++) for (const lastLand of [BT_LAST_LAND_MIN, 3390, 3391, 3500, BT_RUN_TICKS]) {
  const left = BT_RUN_TICKS - Math.max(BT_LAST_LAND_MIN, lastLand);
  const bonus = home >= BT_BALLS ? (2 * left >= BT_RUN_TICKS - BT_LAST_LAND_MIN ? 10 : Math.round((20 * left) / (BT_RUN_TICKS - BT_LAST_LAND_MIN))) : 0;
  eq(btBand.score({ ...bt0, ...acted, home, lastLand }), clamp(line([0, 10, 19, 26, 28, 29, 30], [0, 32, 70, 104, 126, 138, 140], home) + bonus), "Ball Tracker band");
}
eq(btBand.score({ ...bt0, ...acted, home: BT_BALLS, lastLand: BT_LAST_LAND_MIN }), 150, "Ball Tracker band: a fast full clear is 150");
eq(btBand.score({ ...bt0, ...acted, home: BT_BALLS - 1, lastLand: BT_LAST_LAND_MIN }), 138, "Ball Tracker band: one short is 138");
eq(btBand.score({ ...bt0, home: 7, lastLand: 3000 }), 0, "Ball Tracker band: no input scores 0");
const mBand = matchupGameFor(MATCHUP_REV_BAND);
const m0 = mBand.init(1);
for (let raw = 0; raw <= 2000; raw += 3) eq(mBand.score({ ...m0, ...acted, raw }), clamp(line([0, 560, 760, 980, 1150, 1300], [0, 70, 100, 125, 145, 150], raw)), "Gemstone band");
const jBand = junctionGameFor(JUNC_REV_BAND);
const j0 = jBand.init(1);
for (let cars = 0; cars <= 90; cars += 3) for (const bus of [0, 5]) for (const gave of [0, 1, 50]) for (const through of [0, 4]) for (const stopped of [0, 4]) for (const ended of [0, 1, 2]) {
  const u = Math.max(0, 2 * (cars - bus) + 3 * bus - gave + 4 * (through - stopped));
  eq(jBand.score({ ...j0, ...acted, cleared: cars, busCleared: bus, gaveUp: gave, ambThrough: through, ambStopped: stopped, ended }), clamp(line([0, 50, 89, 108, 118, 130], [0, 40, 70, 100, 120, 140], u) + (ended === 1 ? 10 : 0)), "Junction band");
}
const rBand = rallyGameFor(RALLY_REV_BAND);
const r0 = rBand.init(1);
for (let goldHits = 0; goldHits <= 60; goldHits++) for (const targetHits of [0, 3, 10]) eq(rBand.score({ ...r0, ...acted, goldHits, targetHits }), clamp(line([0, 100, 130, 155, 185, 220], [0, 70, 100, 125, 145, 150], 5 * goldHits + 6 * targetHits)), "Rally band");
const sBand = skylineGameFor(SKYLINE_REV_BAND);
const s0 = sBand.init(1);
for (let placed = 0; placed <= 80; placed += 2) for (let perfects = 0; perfects <= placed; perfects += 5) for (const streakPoints of [0, 7]) eq(sBand.score({ ...s0, ...acted, placed, perfects, streakPoints }), clamp(line([0, 100, 165, 280, 480, 600], [0, 70, 100, 125, 145, 150], 5 * placed + 5 * perfects + 2 * streakPoints)), "High Rise band");
const bBand = bullseyeGameFor(BULLSEYE_REV_BAND);
const b0 = bBand.init(1);
for (let total = 0; total <= 120; total++) eq(bBand.score({ ...b0, ...acted, total }), clamp(line([0, 72, 82, 94, 102, 110], [0, 70, 100, 125, 145, 150], total)), "Flightpath band");
for (const [score, total] of [[150, 110], [70, 72]] as const) eq(bBand.score({ ...b0, ...acted, total }), score, "Flightpath band anchor");
const demoGuard = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
eq(demoGuard.includes('data.type === "balltrack"') && demoGuard.includes("course.balls.length !== BT_BALLS"), true, "Old Ball Track demo rejected");
for (const type of ["matchup", "junction", "rally", "skyline", "bullseye"]) eq(demoGuard.includes(`data.type === "${type}"`), false, `${type} demo not invalidated`);
console.log(`Six-game scoring: ${checks} formula/schedule/intro/reveal/demo checks passed (legacy rules and the Oct 2026 score bands); Bullseye anchors 100→150, 90→133, 70→99, 50→65; band 110→150, 72→70`);