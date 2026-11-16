/**
 * Records Ball Tracker runs on the code before levels (recorded with the sim, plumbing and bot of 6987d8bb, the branch
 * head before stage 3), for balltrack-levels-check's "older stamps unchanged" section: the skill-band bot (fixed bots)
 * at three levels on bank courses of every btRev, each run's server-replay score and final checkpoint.
 *
 *   bun scripts/balltrack-levels-legacy-record.ts > scripts/fixtures/balltrack-levels-legacy.json
 */
import { btCheckpoint, makeBallTrackGame, BT_CHECKPOINT_INTERVAL, type BtCourse } from "../src/lib/arcade/ballTrack";
import { encodeBallTrackRun, replayBallTrackRun } from "../src/lib/duel/ballTrack";
import { BALL_TRACK_BANK } from "../src/lib/duel/ballTrackBank.server";
import { BALL_TRACK_BANK_TALL } from "../src/lib/duel/ballTrackBankTall.server";
import { BALL_TRACK_BANK_V7 } from "../src/lib/duel/ballTrackBankV7.server";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/balltrack";

export const LEGACY_CASES: { rev: number | null; bank: "v1" | "tall" | "v7"; index: number }[] = [];
for (const rev of [null, 2, 3]) for (const index of [0, 57, 211]) LEGACY_CASES.push({ rev, bank: "v1", index });
for (const rev of [4, 5, 6]) for (const index of [3, 140]) LEGACY_CASES.push({ rev, bank: "tall", index });
for (const rev of [7, 8]) for (const index of [0, 41, 99, 177, 260]) LEGACY_CASES.push({ rev, bank: "v7", index });
export const LEGACY_SKILLS: SkillLevel[] = ["average", "near", "elite"];

export function courseOf(bank: "v1" | "tall" | "v7", index: number): BtCourse {
  return (bank === "v1" ? BALL_TRACK_BANK : bank === "tall" ? BALL_TRACK_BANK_TALL : BALL_TRACK_BANK_V7)[index]!.course;
}

export function legacyRun(rev: number | null, course: BtCourse, seed: number, skill: SkillLevel) {
  const game = makeBallTrackGame(course, rev);
  const out = bot({ game, seed, rev, human: new Human("balltrack", seed, skill), fixes: true });
  const events = out.events ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints = [];
  while (!game.isOver(s)) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % BT_CHECKPOINT_INTERVAL === 0) checkpoints.push(btCheckpoint(s));
  }
  const raw = encodeBallTrackRun(course, { seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints }, rev);
  const r = replayBallTrackRun(course, seed, raw, rev);
  return { score: r.score, home: r.home, end: btCheckpoint(r.state), events: events.length };
}

if (import.meta.main) {
  const rows = [];
  for (const c of LEGACY_CASES) for (const skill of LEGACY_SKILLS) rows.push({ ...c, skill, ...legacyRun(c.rev, courseOf(c.bank, c.index), c.index + 1, skill) });
  console.log(JSON.stringify(rows));
}
