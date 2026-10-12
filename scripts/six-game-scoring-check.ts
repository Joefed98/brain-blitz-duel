/** Formula, schedule and intro/reveal regressions for the six Oct 6 scoring changes; no identity proof here. */
import { readFileSync } from "node:fs";
import { btCheckpoint, btScoreOf, btScoreOfV2, BT_BALLS, BT_DROP_TICKS, BT_LAST_LAND_MIN, BT_REV, BT_RUN_TICKS, makeBallTrackGame } from "../src/lib/arcade/ballTrack";
import { decodeInputEvents, inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeBallTrackRun, replayBallTrackRun } from "../src/lib/duel/ballTrack";
import { matchupGame, matchupRev2Game, matchupRev3Game, MATCHUP_PAR_RAW, MATCHUP_V2_PAR_RAW, MATCHUP_V3_PAR_RAW } from "../src/lib/arcade/matchup";
import { juncScoreOf } from "../src/lib/arcade/junction";
import { rallyGame } from "../src/lib/arcade/rally";
import { skylineGame } from "../src/lib/arcade/skyline";
import { bullseyeScoreFor, BULLSEYE_RING_VALUES } from "../src/lib/arcade/bullseye";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { binTossGame, BINTOSS_THROWS } from "../src/lib/arcade/binToss";
import { tiltGame, tiltRev2Game, TILT_MAX_MAZES, TILT_V2_STARS } from "../src/lib/arcade/tilt";
import { breakerGame, BRK_BRICKS } from "../src/lib/arcade/breaker";
import { bubbleGame, bubbleRev2Game } from "../src/lib/arcade/bubble";
import { swingGame, swingMetres, SWING_FINISH_M } from "../src/lib/arcade/swing";
import { inkScoreOf, INK_LEVELS } from "../src/lib/arcade/inkBridge";
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
// Batch 4 (Oct 2026): Junction junctionRev 2 and High Rise skylineRev 2 intros state the new points.
for (const [type, text] of [["balltrack", "30"], ["junction", "±4"], ["rally", "2.5"], ["skyline", "+1 per perfect"]] as const) eq(INTRO_SCORE[type].includes(text), true, `${type} intro`);
// Formula detail lives in the "?" help since the intro was shortened (first-run audit, 11 Oct).
for (const [type, text] of [["matchup", MATCHUP_V3_PAR_RAW.toLocaleString("en-GB")], ["bullseye", "1.7 × ring total − 20"], ["junction", "−4"], ["skyline", "per perfect drop"]] as const) eq(PUZZLE_INSTRUCTIONS[type].score.includes(text), true, `${type} help`);
// Ruling B (11 Oct): the eight 130 / 150 split games state both parts in one line.
// Each split intro shows the real partial maximum: the score one unit short of a clear (Grappler rounds to 130).
const SPLIT_PARTIAL_MAX = { balltrack: 126, bintoss: 90, breaker: 128, bubble: 99, inkbridge: 99, orbit: 117, swing: 130, tilt: 115 } as const;
for (const [type, max] of Object.entries(SPLIT_PARTIAL_MAX) as [keyof typeof SPLIT_PARTIAL_MAX, number][]) {
  eq(INTRO_SCORE[type].includes(` for up to 150; otherwise up to ${max}.`), true, `${type} intro states the split with partial max ${max}`);
}
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
eq(binTossGame.score({ ...binTossGame.init(1), baskets: BINTOSS_THROWS - 1 }), SPLIT_PARTIAL_MAX.bintoss, "Swish partial max");
// tiltRev 2 (the intro's rules): three mazes and all eight stars; the original rules' partial max stays 90.
eq(tiltRev2Game.score({ ...tiltRev2Game.init(1), mazes: TILT_MAX_MAZES - 1, stars: TILT_V2_STARS }), SPLIT_PARTIAL_MAX.tilt, "Tilt partial max");
eq(tiltGame.score({ ...tiltGame.init(1), mazes: TILT_MAX_MAZES - 1 }), 90, "Tilt original partial max");
eq(inkScoreOf(INK_LEVELS - 1, 0), SPLIT_PARTIAL_MAX.inkbridge, "Rainbow Bridge partial max");
for (const game of [orbitGame, orbitRev3Game] as const) {
  eq(game.score({ ...game.init(1), best: ORBIT_TOTAL - 1, finished: 0 } as never), SPLIT_PARTIAL_MAX.orbit, "Orbit partial max");
}
for (const [type, goal] of [["balltrack", "Get all 30 marbles home"], ["bintoss", "Sink all 10 buckets"], ["breaker", "Clear all 80 bricks"], ["inkbridge", "Finish all 10 levels"], ["swing", "Reach 500 metres"], ["tilt", "Finish all 4 mazes"]] as const) {
  eq(INTRO_SCORE[type].includes(`${goal} for up to 150`), true, `${type} intro goal`);
}
// Scrumper and Mixed Signals are not on the split: no partial cap at 130.
for (const type of ["snip", "stroop"] as const) eq(INTRO_SCORE[type].includes("otherwise up to 130"), false, `${type} intro has no split line`);
eq(INTRO_SCORE.snip.includes("for 130"), false, "Scrumper intro: a full clear is not a flat 130");
eq(INTRO_SCORE.snip.includes("10 points for each apple") && INTRO_SCORE.snip.includes("3 for each leaf"), true, "Scrumper intro points");
for (const type of ["balltrack", "snip"] as const) eq(/75 s|÷ \d+ s/.test(PUZZLE_INSTRUCTIONS[type].score), false, `${type} help has no seconds divisor`);
const demoGuard = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
eq(demoGuard.includes('data.type === "balltrack"') && demoGuard.includes("course.balls.length !== BT_BALLS"), true, "Old Ball Track demo rejected");
for (const type of ["matchup", "junction", "rally", "skyline", "bullseye"]) eq(demoGuard.includes(`data.type === "${type}"`), false, `${type} demo not invalidated`);
console.log(`Six-game scoring: ${checks} formula/schedule/intro/reveal/demo checks passed; Bullseye anchors 100→150, 90→133, 70→99, 50→65`);