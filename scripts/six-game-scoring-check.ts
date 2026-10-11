/** Formula, schedule and intro/reveal regressions for the six Oct 6 scoring changes; no identity proof here. */
import { readFileSync } from "node:fs";
import { btScoreOf, BT_BALLS, BT_DROP_TICKS, BT_RUN_TICKS, makeBallTrackGame } from "../src/lib/arcade/ballTrack";
import { matchupGame, MATCHUP_PAR_RAW } from "../src/lib/arcade/matchup";
import { juncScoreOf } from "../src/lib/arcade/junction";
import { rallyGame } from "../src/lib/arcade/rally";
import { skylineGame } from "../src/lib/arcade/skyline";
import { bullseyeScoreFor, BULLSEYE_RING_VALUES } from "../src/lib/arcade/bullseye";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { binTossGame, BINTOSS_THROWS } from "../src/lib/arcade/binToss";
import { tiltGame, TILT_MAX_MAZES } from "../src/lib/arcade/tilt";
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
for (const [type, text] of [["balltrack", "30"], ["matchup", "2,500"], ["junction", "lose 4"], ["rally", "2.5"], ["skyline", "3 per perfect"], ["bullseye", "subtract 20"]] as const) eq(INTRO_SCORE[type].includes(text), true, `${type} intro`);
// Ruling B (11 Oct): the eight 130 / 150 split games state both parts in one line.
// Swish, Tilt, Rainbow Bridge and Orbit show their real partial maximum (one unit short of a clear).
const SPLIT_PARTIAL_MAX = { balltrack: 130, bintoss: 90, breaker: 130, bubble: 130, inkbridge: 99, orbit: 117, swing: 130, tilt: 90 } as const;
for (const [type, max] of Object.entries(SPLIT_PARTIAL_MAX) as [keyof typeof SPLIT_PARTIAL_MAX, number][]) {
  eq(INTRO_SCORE[type].includes(` for up to 150; otherwise up to ${max}.`), true, `${type} intro states the split with partial max ${max}`);
}
eq(binTossGame.score({ ...binTossGame.init(1), baskets: BINTOSS_THROWS - 1 }), SPLIT_PARTIAL_MAX.bintoss, "Swish partial max");
eq(tiltGame.score({ ...tiltGame.init(1), mazes: TILT_MAX_MAZES - 1 }), SPLIT_PARTIAL_MAX.tilt, "Tilt partial max");
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