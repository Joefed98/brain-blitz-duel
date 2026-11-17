/**
 * empty-sports-runs-check (15 Nov 2026, Joe): an answer with no run in it (no inputs, no checkpoints, no end tick, no
 * claimed points) in any of the six Sports games is graded as a genuine 0, not flagged; real mismatches stay flagged.
 *
 *  1. the replays: every revision of Home Run, Top Bins, Apex, Crazy Golf, Cue Ball and Curl Champ grades "", a
 *     pre-first-tick draft ("<seed>|0||0|") and the same draft naming another seed as 0, unflagged, no desync, and
 *     prints no "client/server desync" line;
 *  2. practice (gradeAnswer), rooms (gradeRoomAnswer, in the puzzle phase and the reveal) and rated play (the stored
 *     extra through gradeFlagReason, the one reader rated matches and recorded runs use) on each game's dealt puzzle:
 *     score 0, extra.flagged false, no flag reason;
 *  3. what is not empty stays flagged: a played run with one checkpoint changed (caught at that tick), a run with
 *     no inputs but a claimed score, a fake checkpoint or an end tick, a played run with its inputs stripped, and a
 *     played run naming another seed;
 *  4. the rest of the arcade games are untouched: an empty answer in a non-Sports game on the shared run plumbing
 *     (Orbit) is judged exactly as before.
 *
 *   bun scripts/empty-sports-runs-check.ts
 */
import { inputAt, recordInput, type ArcadeGame, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { curlingCheckpoint, curlingGameFor } from "../src/lib/arcade/curling";
import { freekickCheckpoint, freekickGameFor, FREEKICK_CHECKPOINT_INTERVAL } from "../src/lib/arcade/freekick";
import { homerunCheckpoint, homerunGameFor, HOMERUN_CHECKPOINT_INTERVAL } from "../src/lib/arcade/homerun";
import { minigolfCheckpoint, minigolfGameFor } from "../src/lib/arcade/minigolf";
import { poolCheckpoint, poolGameFor } from "../src/lib/arcade/pool";
import { racingCheckpoint, racingGameFor, RACING_CHECKPOINT_INTERVAL } from "../src/lib/arcade/racing";
import { isEmptyRunAnswer, SPORTS_CHECKPOINT_INTERVAL } from "../src/lib/arcade/sportsKit";
import { encodeCurlingRun, replayCurlingRun } from "../src/lib/duel/curling";
import { encodeFreekickRun, replayFreekickRun } from "../src/lib/duel/freekick";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { encodeHomerunRun, replayHomerunRun } from "../src/lib/duel/homerun";
import { encodeMinigolfRun, replayMinigolfRun } from "../src/lib/duel/minigolf";
import { replayOrbitRun } from "../src/lib/duel/orbit";
import { encodePoolRun, replayPoolRun } from "../src/lib/duel/pool";
import { encodeRacingRun, replayRacingRun } from "../src/lib/duel/racing";
import { withSeededRandom } from "../src/lib/duel/random";
import { gradeRoomAnswer } from "../src/lib/duel/roomGrade.server";
import { gradeFlagReason } from "../src/lib/rated/match";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData } from "../src/lib/duel/types";

const failures: string[] = [];
let passed = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) passed++;
  else {
    failures.push(msg);
    console.log(`  FAIL ${msg}`);
  }
};

/** Runs `fn` with console.error captured; returns its value and the desync lines it printed. */
function quiet<T>(fn: () => T): { value: T; desync: number } {
  const original = console.error;
  let desync = 0;
  console.error = (...args: unknown[]) => {
    if (args.map(String).join(" ").includes("client/server desync")) desync++;
  };
  try {
    return { value: fn(), desync };
  } finally {
    console.error = original;
  }
}

interface Replayed {
  score: number;
  flagged: boolean;
  desyncTick: number | null;
}
interface Game {
  name: string;
  revs: number[];
  replay: (seed: number, raw: string, rev: number) => Replayed;
  game: (rev: number) => ArcadeGame<{ tick: number }, ArcadeInputEvent | null>;
  checkpoint: (s: never) => { tick: number; checksum: number };
  interval: number;
  encode: (run: { seed: number; claimedScore: number; events: ArcadeInputEvent[]; endTick: number; checkpoints: never[] }) => string;
}
const PARS = [3, 4, 4, 3, 5];
const GAMES: Game[] = [
  { name: "homerun", revs: [1, 2, 3, 4], replay: replayHomerunRun, game: homerunGameFor as never, checkpoint: homerunCheckpoint as never, interval: HOMERUN_CHECKPOINT_INTERVAL, encode: encodeHomerunRun as never },
  { name: "freekick", revs: [1, 2, 3, 4], replay: replayFreekickRun, game: freekickGameFor as never, checkpoint: freekickCheckpoint as never, interval: FREEKICK_CHECKPOINT_INTERVAL, encode: encodeFreekickRun as never },
  { name: "racing", revs: [1, 2, 3, 4], replay: replayRacingRun, game: racingGameFor as never, checkpoint: racingCheckpoint as never, interval: RACING_CHECKPOINT_INTERVAL, encode: encodeRacingRun as never },
  { name: "minigolf", revs: [1, 2], replay: (s, r, rev) => replayMinigolfRun(s, r, PARS, rev), game: ((rev: number) => minigolfGameFor(PARS, rev)) as never, checkpoint: minigolfCheckpoint as never, interval: SPORTS_CHECKPOINT_INTERVAL, encode: encodeMinigolfRun as never },
  { name: "pool", revs: [1, 2, 3, 4], replay: replayPoolRun, game: poolGameFor as never, checkpoint: poolCheckpoint as never, interval: SPORTS_CHECKPOINT_INTERVAL, encode: encodePoolRun as never },
  { name: "curling", revs: [1, 2, 3, 4], replay: replayCurlingRun, game: curlingGameFor as never, checkpoint: curlingCheckpoint as never, interval: SPORTS_CHECKPOINT_INTERVAL, encode: encodeCurlingRun as never },
];

/** A played run recorded as the phone records it: inputs of the game's first kind every 0.75 s, a checkpoint each interval. */
function played(g: Game, seed: number, rev: number): string {
  const game = g.game(rev);
  const range = game.inputRanges![0]!;
  const mid = (r: readonly [number, number], k: number) => r[0] + Math.floor(((r[1] - r[0]) * ((k * 37) % 100)) / 100);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: never[] = [];
  let s = game.init(seed);
  let k = 0;
  while (!game.isOver(s) && s.tick < game.runTicks) {
    if ((s.tick + 1) % 45 === 0) {
      k++;
      recordInput(events, { t: s.tick + 1, k: range.k, a: mid(range.a, k), b: mid(range.b, k + 1), c: Math.max(range.c[0], mid(range.c, k + 2)), d: mid(range.d, k) }, game.inputRanges);
    }
    s = game.step(s, inputAt(events, s.tick + 1));
    if (s.tick % g.interval === 0) checkpoints.push(g.checkpoint(s as never) as never);
  }
  return g.encode({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
}

const SEED = 271828;
for (const g of GAMES) {
  for (const rev of g.revs) {
    const tag = `${g.name} rev ${rev}`;
    /* 1. empty answers */
    for (const raw of ["", `${SEED}|0||0|`, `${SEED + 1}|0||0|`, `${SEED}|0||0|~score=0;tick=0`]) {
      const { value: r, desync } = quiet(() => g.replay(SEED, raw, rev));
      ok(isEmptyRunAnswer(raw), `${tag}: ${JSON.stringify(raw)} is an empty answer`);
      ok(r.score === 0 && !r.flagged && r.desyncTick === null, `${tag}: empty answer ${JSON.stringify(raw)} grades 0, unflagged (${r.score}, flagged ${r.flagged}, desync ${r.desyncTick})`);
      ok(desync === 0, `${tag}: empty answer ${JSON.stringify(raw)} logs no desync`);
    }
    /* 3. what is not empty stays flagged */
    const real = played(g, SEED, rev);
    const honest = quiet(() => g.replay(SEED, real, rev)).value;
    ok(!honest.flagged && honest.desyncTick === null, `${tag}: a played run replays unflagged (sanity; flagged ${honest.flagged})`);
    const parts = real.split("|");
    const cps = parts[4]!.split(",");
    ok(cps.length >= 2, `${tag}: the played run carries checkpoints`);
    const at = cps.length >> 1;
    const fields = cps[at]!.split(":");
    fields[fields.length - 1] = String((Number(fields[fields.length - 1]) ^ 1) >>> 0);
    const tick = Number(fields[0]);
    cps[at] = fields.join(":");
    const tampered = quiet(() => g.replay(SEED, [...parts.slice(0, 4), cps.join(",")].join("|"), rev));
    ok(tampered.value.flagged && tampered.value.desyncTick === tick, `${tag}: a changed checkpoint is flagged at its tick (${tampered.value.desyncTick}, want ${tick})`);
    ok(tampered.desync === 1, `${tag}: and logged as a desync`);
    const notEmpty: [string, string][] = [
      ["a claimed score with no inputs", `${SEED}|5||0|`],
      ["a fake checkpoint with no inputs", `${SEED}|0||0|${parts[4]!.split(",")[0]!.replace(/\d+$/, "1")}`],
      ["an end tick with no inputs", `${SEED}|0||600|`],
      ["a played run with its inputs stripped", [parts[0], parts[1], "", parts[3], parts[4]].join("|")],
      ["a played run naming another seed", [SEED + 7, ...parts.slice(1)].join("|")],
    ];
    for (const [what, raw] of notEmpty) {
      ok(!isEmptyRunAnswer(raw), `${tag}: ${what} is not an empty answer`);
      const r = quiet(() => g.replay(SEED, raw, rev)).value;
      // A played run with nothing stripped that the replay still scores the same could only pass if it was honest.
      if (what === "a played run with its inputs stripped" && honest.score === 0) continue;
      ok(r.flagged, `${tag}: ${what} stays flagged`);
    }
  }

  /* 2. practice, rooms and rated on the dealt puzzle */
  const puzzle = withSeededRandom(17, () => generatePuzzle(g.name as never)) as PuzzleData;
  const limit = puzzleTimeLimitMs(puzzle);
  for (const raw of ["", `${(puzzle as { seed: number }).seed}|0||0|`]) {
    const label = `${g.name} (dealt): ${JSON.stringify(raw)}`;
    const practice = quiet(() => gradeAnswer(puzzle, raw, 0)).value;
    ok(practice.score === 0 && practice.extra?.["flagged"] === false, `${label} in practice: 0, unflagged (${practice.score}, ${String(practice.extra?.["flagged"])})`);
    const now = Date.now();
    for (const [phase, startedAgo] of [["puzzle", limit - 200], ["reveal", 1000]] as const) {
      const room = quiet(() => gradeRoomAnswer(puzzle, { phase, phaseStartedAt: new Date(now - startedAgo).toISOString(), nowMs: now }, raw, 0)).value.graded;
      ok(room.score === 0 && room.extra?.["flagged"] === false, `${label} in a room (${phase}): 0, unflagged (${room.score}, ${String(room.extra?.["flagged"])})`);
      ok(gradeFlagReason(room.extra as Record<string, unknown>) === null, `${label} in a rated room (${phase}): no flag, so it counts as a genuine 0`);
    }
  }
}

/* 4. not the Sports games: Orbit's empty answer is judged as before (flagged, on the shared plumbing without the opt-in). */
{
  const r = quiet(() => replayOrbitRun(SEED, "", 14)).value as { flagged: boolean };
  ok(r.flagged, "a non-Sports game (Orbit) still flags an empty answer as before");
}

if (failures.length) {
  console.log(`FAIL: empty-sports-runs: ${failures.length} of ${failures.length + passed} assertions failed`);
  process.exit(1);
}
console.log(
  `PASS: empty-sports-runs: ${passed} assertions. In all six Sports games, on every revision, an answer with no run in it ` +
    `grades as 0 unflagged (practice, rooms in the puzzle phase and the reveal, and rated play's flag reader) and logs no ` +
    `desync; a changed checkpoint, a claim, a fake checkpoint, an end tick, stripped inputs or another seed stay flagged; ` +
    `Orbit's empty answer is judged as before.`,
);
