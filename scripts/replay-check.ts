/**
 * Round replays (display only), docs/replays.md:
 *
 *  1. Every replayable engine game (the 22 arcade games, Letterfall, Tenfall,
 *     Bonk, Pull! and Mixed Signals) has a stored fixture run on today's
 *     revision (scripts/fixtures/replay-runs.json), and the stored runs of the
 *     score-band and Tuning A/C/E/F fixtures cover the older revisions. For each,
 *     the phone's replay stepper (src/lib/replay/steppers.ts) reaches a final
 *     state deep-equal to the server replay's, on the same tick, with the same
 *     score, and that score is the stored score (today's fixtures: also what
 *     gradeAnswer stores).
 *  2. Seeking: the state at sampled ticks reached from a keyframe equals the
 *     state stepped straight from the start, and equals the server replay
 *     stopped at that tick (the intro-demo endTick cut).
 *  3. Moments: every game's moment table matches the success events it fires
 *     today (arcadeFxGames.renderer.ts) row for row; detection and picking are
 *     deterministic (two passes give identical lists) and use only sim state.
 *
 *   bun scripts/replay-check.ts
 */

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import "../src/lib/duel/wordfallDict.server";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { makeStepper, replayToEnd, REPLAY_TYPES } from "../src/lib/replay/steppers";
import { ReplayTimeline } from "../src/lib/replay/timeline";
import { runAtTick } from "../src/lib/arcade/introDemo";
import { bullseyeWinds } from "../src/lib/arcade/bullseye";
import { encodeRev3Planets, decodeRev3Planets } from "../src/lib/arcade/orbitRev3";
import { ORBIT_HOLE_BANK } from "../src/lib/duel/orbitHoleBank.server";
import { ORBIT_REV3_BANK } from "../src/lib/duel/orbitRev3Bank.server";
import { BALL_TRACK_BANK } from "../src/lib/duel/ballTrackBank.server";
import { serverReplay } from "./replay-server-table";
import { runMomentChecks } from "./replay-moments-lib";

const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};

const REV_KEY: Record<string, string> = {
  hover: "hoverRev",
  skyline: "skylineRev",
  bintoss: "binRev",
  bullseye: "bullRev",
  matchup: "matchupRev",
  breaker: "brkRev",
  rally: "rallyRev",
  slice: "sliceRev",
  bubble: "bubbleRev",
  beat: "beatRev",
  snake: "snakeRev",
  cross: "crossRev",
  wavefront: "wavRev",
  flip: "flipRev",
  junction: "junctionRev",
  inkbridge: "inkRev",
  burst: "burstRev",
  orbit: "orbitRev",
  swing: "swingRev",
  snip: "snipRev",
  tilt: "tiltRev",
  balltrack: "btRev",
};

/** The puzzle a live room stored for a legacy fixture run (seed + revision, plus the bank data it carries). */
function legacyPuzzle(type: string, seed: number, rev: number | null): PuzzleData {
  const p: Record<string, unknown> = { type, seed };
  if (rev !== null && rev !== undefined) p[REV_KEY[type]!] = rev;
  if (type === "bullseye") p["winds"] = bullseyeWinds(seed);
  if (type === "orbit") {
    p["planets"] = encodeRev3Planets(
      decodeRev3Planets(ORBIT_REV3_BANK.find((e) => e.seed === seed)!.planets),
    );
    p["holes"] = ORBIT_HOLE_BANK.find((e) => e.seed === seed)?.holes ?? [];
  }
  if (type === "balltrack") p["course"] = BALL_TRACK_BANK[seed % BALL_TRACK_BANK.length]!.course;
  return p as unknown as PuzzleData;
}

interface Case {
  label: string;
  puzzle: PuzzleData;
  answer: string;
  score: number;
  today: boolean;
}

const cases: Case[] = [];
const today = JSON.parse(readFileSync("scripts/fixtures/replay-runs.json", "utf8")) as {
  runs: { type: string; puzzle: PuzzleData; answer: string; score: number }[];
};
for (const run of today.runs)
  cases.push({
    label: `${run.type} (today)`,
    puzzle: run.puzzle,
    answer: run.answer,
    score: run.score,
    today: true,
  });
for (const file of [
  "arcade-score-bands-legacy",
  "arcade-tuning-a-legacy",
  "arcade-tuning-c-legacy",
  "arcade-tuning-e-legacy",
  "arcade-tuning-f-legacy",
]) {
  const fixture = JSON.parse(readFileSync(`scripts/fixtures/${file}.json`, "utf8")) as {
    runs: {
      type: string;
      rev: number | null;
      level: string;
      seed: number;
      score: number;
      raw: string;
    }[];
  };
  for (const run of fixture.runs) {
    cases.push({
      label: `${run.type} rev ${run.rev} ${run.level}${"when" in run ? ` ${(run as { when?: string }).when}` : ""} (${file})`,
      puzzle: legacyPuzzle(run.type, run.seed, run.rev),
      answer: gunzipSync(Buffer.from(run.raw, "base64")).toString(),
      score: run.score,
      today: false,
    });
  }
}

const covered = new Set(today.runs.map((r) => r.type));
for (const type of REPLAY_TYPES)
  ok(covered.has(type), `${type}: no stored fixture run on today's revision`);

/**
 * Today's revisions: for every game, a stored run carries exactly the revision
 * stamps the live room generator puts on a new puzzle now (generatePuzzle).
 * puzzleScoreRev is the puzzle-scoring stamp; engine replays don't read it.
 */
const stamps = (p: PuzzleData) =>
  JSON.stringify(
    Object.entries(p as unknown as Record<string, unknown>)
      .filter(([k]) => /Rev$/.test(k) && k !== "puzzleScoreRev")
      .sort(),
  );
const currentLines: string[] = [];
for (const type of REPLAY_TYPES) {
  const live = stamps(generatePuzzle(type as PuzzleType));
  const run = today.runs.find((r) => r.type === type && stamps(r.puzzle) === live);
  ok(run !== undefined, `${type}: no stored run on the revision rooms stamp today (${live})`);
  if (run && ["tendrop", "stroop", "snip"].includes(type))
    currentLines.push(`${type} ${live} → ${run.score}`);
}

const quiet = <T>(fn: () => T): T => {
  const error = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = error;
  }
};

const stable = (value: unknown) => JSON.stringify(value);
let ticksStepped = 0;
const started = performance.now();
for (const c of cases) {
  const stepper = makeStepper(c.puzzle, c.answer);
  ok(stepper !== null, `${c.label}: no replay stepper`);
  if (!stepper) continue;
  const end = replayToEnd(stepper);
  ticksStepped += end.ticks;
  const server = quiet(() => serverReplay(c.puzzle, c.answer));
  ok(end.score === c.score, `${c.label}: replay scores ${end.score}, stored ${c.score}`);
  ok(
    end.score === server.score,
    `${c.label}: replay scores ${end.score}, server replay ${server.score}`,
  );
  ok(
    end.ticks === server.replayTick,
    `${c.label}: replay ends on tick ${end.ticks}, server on ${server.replayTick}`,
  );
  ok(
    stable(end.state) === stable(server.state),
    `${c.label}: final state differs from the server replay's`,
  );
  if (c.today) {
    const graded = quiet(() => gradeAnswer(c.puzzle, c.answer, 0));
    ok(
      graded.score === c.score,
      `${c.label}: gradeAnswer stores ${graded.score}, fixture says ${c.score}`,
    );
  }
}

/* 2: seeking from keyframes, against straight stepping and the server's endTick cut */
for (const c of cases.filter((x) => x.today)) {
  const stepper = makeStepper(c.puzzle, c.answer)!;
  const timeline = new ReplayTimeline(stepper);
  timeline.scanAll();
  const last = timeline.endTick;
  for (const t of [1, Math.floor(last / 3), Math.floor(last / 2) + 7, last - 1, last]) {
    if (t < 1 || t > last) continue;
    const viaTimeline = timeline.stateAt(t);
    let s = stepper.init();
    for (let k = 1; k <= t; k++) s = stepper.step(s, k);
    ok(
      stable(viaTimeline) === stable(s),
      `${c.label}: seek to ${t} differs from stepping from the start`,
    );
    if (t < last) {
      const cut = quiet(() => serverReplay(c.puzzle, runAtTick(c.answer, t)));
      ok(
        stable(cut.state) === stable(s),
        `${c.label}: state at ${t} differs from the server replay cut at ${t}`,
      );
    }
  }
  // Seeking backwards then forwards lands on the same state.
  const mid = Math.max(1, Math.floor(last / 2));
  const a = stable(timeline.stateAt(mid));
  timeline.stateAt(1);
  ok(stable(timeline.stateAt(mid)) === a, `${c.label}: seek back and forth to ${mid} differs`);
}

/* 3: moments */
const moment = runMomentChecks(cases.filter((c) => c.today));
checks += moment.checks;
failures.push(...moment.failures);

const seconds = (performance.now() - started) / 1000;
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} replay checks`);
  process.exit(1);
}
console.log(
  `Replays: ${checks} checks passed — ${cases.length} stored runs (${today.runs.length} in replay-runs.json, every one of the ${REPLAY_TYPES.length} replayable games on the revision rooms stamp today: ${currentLines.join("; ")}) replay to the server's final state and the stored score; seeks match; ${moment.summary} (${ticksStepped} ticks, ${seconds.toFixed(1)} s)`,
);
