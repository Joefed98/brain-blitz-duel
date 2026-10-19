/**
 * Scoring report (19 Oct 2026, report only: nothing here changes a score, band, stamp or game).
 *
 * Plays every active game (the registry's 74, Pinball and Letterfall included) on room seeds
 * through the real server grader on the stamps rooms deal today, and measures each game against
 * the rule agreed on 19 Oct (docs/scoring-report-oct-2026.md):
 *
 *   - a correct finish scores 120 + up to 30 for speed; 150 only for a perfect, fast run;
 *   - unfinished scores up to 110 by real progress (about 55 half done, about 110 one step short);
 *   - random or careless play stays near 0; more progress, time or fewer mistakes never scores less;
 *   - rooms and practice grade the same result identically.
 *
 * Puzzles (scripts/puzzle-fairness kits, which build the answer strings the stages send):
 *   1. progress without a finish, clock run out: nothing, 10 % … 90 %, two and one step short
 *      (shares of a clean solve's actions, err 0);
 *   2. the clean finish with 90 / 75 / 50 / 25 / 10 / 0 % of the clock left (tap-log and action-log
 *      games replay a clean solve at the pace that finishes then), and the time left 150 needs;
 *   3. finishes with a few, some and many of the game's own mistakes (kit error rate 5 / 15 / 35 %),
 *      graded at half the clock left so only the mistakes differ;
 *   4. bad play: every kit spam strategy at the buzzer, and progress to 50 % then undone (where
 *      the game can take moves back);
 *   5. the kit players (careless, below average, average, good, great, near perfect);
 *   6. the phone's room path: each draft through the room's draft keeper (roomDraft.ts) and sender
 *      (roomSend.ts) into gradeRoomAnswer on a time-out (reveal-phase receipt), a reload at half
 *      done (restored draft), and a reload then one more action (the stage restarts from its
 *      opening board); every graded run is also graded as a room and compared with practice.
 * Speed and engine games (Flash, Bang On, Bonk, Pull!, Mixed Signals, Tenfall, Letterfall) play
 * the kit players and spam; arcade games run scripts/arcade-skill-bands.ts --rev=now (server
 * replay) plus a run with no input.
 *
 *   bun scripts/scoring-report.ts                         # everything (puzzles ~10 min, arcade ~10 min)
 *   bun scripts/scoring-report.ts --category=word,number  # parts
 *   bun scripts/scoring-report.ts --game=wordslide,trail --seeds=15
 *   bun scripts/scoring-report.ts --no-arcade --out=<dir> # runs-<part>.json in <dir>
 *   bun scripts/scoring-report.ts --combine=<dir> --write # merge every runs-*.json, write the CSV and
 *                                                         # the generated sections of the report
 *   bun scripts/scoring-report.ts --combine=<dir> --rev3-doc=docs/scoring-rev3-oct-2026.md
 *                                                         # puzzleScoreRev 3 (20 Oct 2026): the graded grid and
 *                                                         # Joe's pass marks for every helper game
 *
 * Optional (OPTIONAL in .github/ci/shards.ts): no pass/fail, never run in CI. Script-only: floats are fine.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { ACTIVE_PUZZLE_TYPES, PUZZLE_REGISTRY, puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { gradeRoomAnswer } from "../src/lib/duel/roomGrade.server";
import { createDraftKeeper, type DraftStorage } from "../src/lib/duel/roomDraft";
import { createRoomSender, type RoomSendPayload } from "../src/lib/duel/roomSend";
import { REV2_OPEN_GAMES, rev2ResultOf } from "../src/lib/duel/puzzleScoreRev2";
import { REV3_GAMES } from "../src/lib/duel/puzzleScoreRev3";
import { storedScoreParts } from "../src/lib/duel/puzzleScoreRev";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { GAMES } from "./arcade-skill-bands/games";
import { PROFILES } from "./arcade-skill-bands/human";
import { hashText, makeRng, type Play, type PuzzleKit, type Skill } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { KNOWN_SPAM } from "./puzzle-fairness";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 15);
const ARCADE_SEEDS = Number(opt("arcade-seeds") ?? 10);
const OUT = opt("out") ?? ".shots/scoring-report";
const COMBINE = opt("combine");
const WRITE = args.includes("--write");
const NO_ARCADE = args.includes("--no-arcade");
const ARCADE_JSON = opt("arcade-json");
/** With --combine: also fill the rev-3 results doc's generated sections (grid and pass marks). */
const REV3_DOC = opt("rev3-doc");
const ONLY_GAMES = opt("game")?.split(",").filter(Boolean) ?? [];
const ONLY_CATS = opt("category")?.split(",").filter(Boolean) ?? [];
const PART =
  opt("part") ??
  (ONLY_CATS.length ? ONLY_CATS.join("+") : ONLY_GAMES.length ? ONLY_GAMES.join("+") : "all");

/* ------------------------------------------------------------------ levels */

type Group = "progress" | "time" | "mistakes" | "bad" | "skill" | "phone" | "arcade";

export interface Run {
  game: PuzzleType;
  name: string;
  category: string;
  seed: number;
  group: Group;
  level: string;
  score: number;
  finished: boolean;
  /** Ms left the grade used (0 for a time-out). */
  msLeft: number;
  limitMs: number;
  /** puzzleScoreRev 2's result (0–99 unfinished, 100–200 finished; open games the rev-1 score). */
  result: number | null;
  rev1: number | null;
  /** puzzleScoreRev 3's progress share (0–1) on an unfinished run. */
  progress?: number | null;
  /** Share of the clean solve's actions this answer holds (progress levels). */
  share: number | null;
  /** Kit actions in the play (mistakes: actions beyond the clean solve). */
  actions: number | null;
  extraActions: number | null;
  /** Finished rev-2 runs: the time share (penalties included) and the efficiency share the result was built from. */
  timeShare?: number | null;
  effShare?: number | null;
  /** Room grade (gradeRoomAnswer) of the same answer and claim; null where not graded as a room. */
  roomScore: number | null;
  note: string;
}

const PROGRESS_LEVELS: [string, number][] = [
  ["nothing", 0],
  ["p10", 0.1],
  ["p25", 0.25],
  ["p40", 0.4],
  ["p50", 0.5],
  ["p60", 0.6],
  ["p75", 0.75],
  ["p90", 0.9],
];
const TIME_LEVELS: [string, number][] = [
  ["t90", 0.9],
  ["t75", 0.75],
  ["t50", 0.5],
  ["t25", 0.25],
  ["t10", 0.1],
  ["t0", 0],
];
const MISTAKE_LEVELS: [string, number][] = [
  ["few", 0.05],
  ["some", 0.15],
  ["many", 0.35],
];

/** Kit players: the four puzzle-fairness levels plus two below them. */
const SKILL_LEVELS: Record<string, Skill> = {
  careless: {
    level: "careless" as Skill["level"],
    pace: 2.6,
    err: 0.45,
    reactionMs: 420,
    reactionSd: 90,
  },
  below: { level: "below" as Skill["level"], pace: 2.1, err: 0.3, reactionMs: 350, reactionSd: 70 },
  average: { level: "average", pace: 1.7, err: 0.2, reactionMs: 300, reactionSd: 55 },
  good: { level: "good", pace: 1.0, err: 0.1, reactionMs: 230, reactionSd: 40 },
  great: { level: "great", pace: 0.72, err: 0.05, reactionMs: 190, reactionSd: 30 },
  near: { level: "near", pace: 0.5, err: 0.015, reactionMs: 160, reactionSd: 20 },
};
// Pull!'s kit reads the arcade humans' touch error by level: the two lower levels get rougher figures.
const P = PROFILES as Record<string, (typeof PROFILES)["average"]>;
P.careless ??= {
  ...PROFILES.average,
  timingSdMs: 80,
  aimSdPx: 16,
  mistake: 0.25,
  lapse: 0.2,
  reactionMs: [420, 90],
};
P.below ??= {
  ...PROFILES.average,
  timingSdMs: 60,
  aimSdPx: 12,
  mistake: 0.17,
  lapse: 0.13,
  reactionMs: [350, 70],
};

const clean = (pace: number, err = 0): Skill => ({
  level: "near",
  pace,
  err,
  reactionMs: 160,
  reactionSd: 20,
});

/** Games scored by kit players only (no finish state worth a level grid). */
const SKILL_ONLY = new Set<PuzzleType>([
  "reaction",
  "stopwatch",
  "whack",
  "clayshoot",
  "stroop",
  "tendrop",
  "wordfall",
]);

/** Answers that are the board itself: undoing returns the opening answer (tries/hangs counters kept). */
const STATE_ANSWERS = new Set<PuzzleType>([
  "tilegrid",
  "equation",
  "balance",
  "numpyramid",
  "trail",
  "symscan",
  "countup",
  "flow",
  "pipes",
  "sudoku",
  "nonogram",
  "tents",
  "lightup",
  "shikaku",
  "blockparty",
  "codeword",
]);

/** Progress to `answer`, then the same moves taken back (games whose moves can be reversed). */
function undoAnswer(type: PuzzleType, nothing: string, answer: string): string | null {
  if (STATE_ANSWERS.has(type)) {
    const counters = answer.includes("#") ? answer.slice(answer.lastIndexOf("#")) : "";
    return counters && nothing.includes("#")
      ? nothing.slice(0, nothing.lastIndexOf("#")) + counters
      : nothing;
  }
  const list = answer ? answer.split(",") : [];
  switch (type) {
    case "wordslide": // r0+ is taken back by r0-
      return [
        ...list,
        ...list
          .slice()
          .reverse()
          .map((m) => m.replace(/[+-]$/, (s) => (s === "+" ? "-" : "+"))),
      ].join(",");
    case "tiles": // the tile just moved slides back
    case "lightsout": // a press toggles back
      return [...list, ...list.slice().reverse()].join(",");
    case "tower": // a>b back as b>a
      return [
        ...list,
        ...list
          .slice()
          .reverse()
          .map((m) => m.split(">").reverse().join(">")),
      ].join(",");
    case "maze": // walk back to the start
      return [...list, ...list.slice(0, -1).reverse()].join(",");
    default:
      return null;
  }
}

/* ---------------------------------------------------------------- grading */

function gradeBoth(puzzle: PuzzleData, answer: string, msLeft: number) {
  const g = gradeAnswer(puzzle, answer, msLeft);
  const limit = puzzleTimeLimitMs(puzzle);
  // As a room: received in the puzzle phase 80 ms after the claim, or in the reveal phase for a time-out.
  const startedAt = 1_000_000;
  const nowMs = msLeft > 0 ? startedAt + (limit - msLeft) + 80 : startedAt + limit + 100;
  const room = gradeRoomAnswer(
    puzzle,
    {
      phase: msLeft > 0 ? "puzzle" : "reveal",
      phaseStartedAt: new Date(startedAt).toISOString(),
      nowMs,
    },
    answer,
    msLeft,
  );
  const extra = (g.extra ?? {}) as Record<string, unknown>;
  // A finish's time and efficiency shares: rev 3 stores them; on rev 2 they come from the rev-1 grade the result is built on.
  let timeShare: number | null = typeof extra.time === "number" ? extra.time : null;
  let effShare: number | null = typeof extra.efficiency === "number" ? extra.efficiency : null;
  if (g.isCorrect && typeof extra.result === "number" && !REV2_OPEN_GAMES.has(puzzle.type)) {
    const g1 = gradeAnswer(
      { ...(puzzle as object), puzzleScoreRev: 1 } as PuzzleData,
      answer,
      msLeft,
    );
    const r = rev2ResultOf(
      puzzle.type,
      g1.score,
      storedScoreParts(g1.extra as Record<string, unknown>),
      g1.storedMs,
      limit,
    );
    timeShare = r.time ?? null;
    effShare = r.efficiency ?? null;
  }
  return {
    timeShare,
    effShare,
    score: g.score,
    finished: g.isCorrect,
    msLeft: g.isCorrect ? msLeft : 0,
    result: typeof extra.result === "number" ? extra.result : null,
    progress: typeof extra.progressShare === "number" ? extra.progressShare : null,
    rev1: typeof extra.rev1Score === "number" ? extra.rev1Score : null,
    roomScore: room.graded.score,
  };
}

function memoryStorage(): DraftStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

/** The room's time-out send: drafts through the keeper, the keeper's answer through the sender. */
function roomTimeoutAnswer(keeper: ReturnType<typeof createDraftKeeper>, key: string): string {
  let sent: RoomSendPayload | null = null;
  const sender = createRoomSender(async (p) => {
    sent = p;
  });
  sender.send(key, { duelId: "d", roundNumber: 1, answer: keeper.current(key), msRemaining: 0 }, 0);
  return (sent as RoomSendPayload | null)?.answer ?? "";
}

/* ---------------------------------------------------------------- puzzles */

function cutAt(play: Play, limit: number) {
  return play.steps.filter((s) => s.atMs <= limit);
}

/** First step that grades as a finish (graded at half the clock so time never decides it). */
function solveIndex(puzzle: PuzzleData, play: Play, limit: number): number {
  const steps = cutAt(play, limit);
  for (let i = 0; i < steps.length; i++) {
    const ms = play.timed ? Math.max(0, limit - steps[i]!.atMs) : limit / 2;
    if (gradeAnswer(puzzle, steps[i]!.answer, ms).isCorrect) return i;
  }
  return -1;
}

function playPuzzle(type: PuzzleType, kit: PuzzleKit, seed: number): Run[] {
  const puzzle = roomPuzzle(type, seed);
  const limit = puzzleTimeLimitMs(puzzle);
  const def = PUZZLE_REGISTRY[type];
  const runs: Run[] = [];
  const base = {
    game: type,
    name: gameDisplayName(type),
    category: def.category,
    seed,
    limitMs: limit,
  };
  const push = (
    group: Group,
    level: string,
    answer: string,
    msLeft: number,
    more: Partial<Run> = {},
  ) => {
    const g = gradeBoth(puzzle, answer, msLeft);
    const run: Run = {
      ...base,
      group,
      level,
      score: g.score,
      finished: g.finished,
      msLeft: g.msLeft,
      result: g.result,
      progress: g.progress,
      rev1: g.rev1,
      timeShare: g.timeShare,
      effShare: g.effShare,
      share: null,
      actions: null,
      extraActions: null,
      roomScore: g.roomScore,
      note: "",
      ...more,
    };
    runs.push(run);
    return run;
  };
  const nothing = kit.nothing(puzzle);
  const open = REV2_OPEN_GAMES.has(type);

  if (!SKILL_ONLY.has(type)) {
    // A clean solve (no mistakes, quick): its actions define progress.
    // Games with no finish state: a near-perfect player's actions within the clock define progress.
    const cleanPlay = kit.play(
      puzzle,
      makeRng(hashText(`${type}:clean:${seed}`)),
      clean(open ? 0.5 : 0.4),
      open ? limit : limit * 4,
    );
    if (open) cleanPlay.steps = cutAt(cleanPlay, limit);
    const steps = cleanPlay.steps;
    const solved = open ? -1 : solveIndex(puzzle, cleanPlay, Number.MAX_SAFE_INTEGER);
    const n = solved >= 0 ? solved + 1 : steps.length;
    const answerAt = (k: number) =>
      k <= 0 ? nothing : steps[Math.min(k, steps.length) - 1]!.answer;
    const short = solved >= 0 ? n - 1 : n; // the last unfinished action count
    // 1. Progress, clock run out.
    for (const [level, share] of PROGRESS_LEVELS) {
      const k = Math.min(short, Math.floor(share * n + 1e-9));
      push("progress", level, answerAt(k), 0, { share: n ? k / n : 0, actions: k });
    }
    if (solved >= 0) {
      if (n >= 3)
        push("progress", "two-short", answerAt(n - 2), 0, { share: (n - 2) / n, actions: n - 2 });
      if (n >= 2)
        push("progress", "one-short", answerAt(n - 1), 0, { share: (n - 1) / n, actions: n - 1 });
    } else {
      push("progress", "all", answerAt(n), 0, {
        share: 1,
        actions: n,
        note: open
          ? "no finish state: every action a near-perfect player makes in the clock"
          : "the clean play did not finish",
      });
    }
    // 2. Finishes with time left.
    if (solved >= 0) {
      const final = answerAt(n);
      if (!cleanPlay.timed) {
        for (const [level, left] of TIME_LEVELS)
          push("time", level, final, Math.round(left * limit), { actions: n });
        // The least time left that scores 150 (binary search on the clean finish).
        let lo = 0,
          hi = limit;
        if (gradeAnswer(puzzle, final, hi).score >= 150) {
          for (let i = 0; i < 14; i++) {
            const mid = (lo + hi) / 2;
            if (gradeAnswer(puzzle, final, mid).score >= 150) hi = mid;
            else lo = mid;
          }
          push("time", "for150", final, Math.round(hi), {
            note: `150 needs ${Math.round((100 * hi) / limit)} % of the clock left`,
          });
        } else push("time", "for150", final, limit, { note: "150 unreachable on a clean finish" });
      } else {
        // Tap/action logs carry their own times: replay the clean solve at the pace that finishes then.
        for (const [level, left] of TIME_LEVELS) {
          const target = Math.max(300, limit * (1 - left) - (left === 0 ? 250 : 0));
          let pace = 0.4;
          let best: { answer: string; at: number } | null = null;
          for (let it = 0; it < 6; it++) {
            const pl = kit.play(
              puzzle,
              makeRng(hashText(`${type}:clean:${seed}`)),
              clean(pace),
              limit * 4,
            );
            const si = solveIndex(puzzle, pl, Number.MAX_SAFE_INTEGER);
            if (si < 0) break;
            const at = pl.steps[si]!.atMs;
            if (!best || Math.abs(at - target) < Math.abs(best.at - target))
              best = { answer: pl.steps[si]!.answer, at };
            if (Math.abs(at - target) < limit * 0.02) break;
            pace = Math.max(0.05, pace * (target / Math.max(1, at)));
          }
          // A finish the pace could not bring near this time (Chain's momentum window breaks a slow chain) is kept
          // apart, so it never stands in for the level.
          if (best && best.at <= limit && Math.abs(best.at - target) <= limit * 0.08)
            push("time", level, best.answer, Math.max(0, Math.round(limit - best.at)), {
              note: `finished at ${Math.round(best.at / 1000)} s`,
            });
          else
            push(
              "time",
              `${level}-unreached`,
              best?.answer ?? nothing,
              best ? Math.max(0, Math.round(limit - best.at)) : 0,
              {
                note: best
                  ? `no clean finish near this time (closest at ${Math.round(best.at / 1000)} s)`
                  : "could not finish at this pace",
              },
            );
        }
      }
      // 3. Mistakes: a quick player with more slips, graded at half the clock left.
      for (const [level, err] of MISTAKE_LEVELS) {
        const pl = kit.play(
          puzzle,
          makeRng(hashText(`${type}:mistakes:${seed}:${level}`)),
          clean(0.4, err),
          limit * 4,
        );
        const si = solveIndex(puzzle, pl, Number.MAX_SAFE_INTEGER);
        const steps2 = pl.steps;
        if (si < 0) {
          push("mistakes", level, steps2.at(-1)?.answer ?? nothing, 0, {
            actions: steps2.length,
            note: "did not finish (kit gave up or ran out of tries)",
          });
          continue;
        }
        const ms = pl.timed
          ? Math.max(0, Math.round(limit - steps2[si]!.atMs))
          : Math.round(limit / 2);
        push("mistakes", level, steps2[si]!.answer, ms, {
          actions: si + 1,
          extraActions: si + 1 - n,
        });
      }
    }
    // 4. Bad play.
    const undo = undoAnswer(type, nothing, answerAt(Math.floor(n / 2)));
    if (undo !== null) push("bad", "undo", undo, 0, { note: "half done, then taken back" });
    // 6. The phone's room path.
    {
      const storage = memoryStorage();
      const key = `room-${type}-1`;
      const keeper = createDraftKeeper(
        () => storage,
        () => 0,
      );
      keeper.push(key, nothing);
      const half = Math.max(1, Math.floor(short / 2));
      for (let k = 1; k <= short; k++) keeper.push(key, answerAt(k));
      const timeout = roomTimeoutAnswer(keeper, key);
      push("phone", "timeout-one-short", timeout, 0, {
        share: short / Math.max(1, n),
        note: timeout === answerAt(short) ? "" : "draft sent differs from the last draft",
      });
      // Reload at half done: a new page restores the stored draft; the stage sends its opening board first.
      const storage2 = memoryStorage();
      const k1 = createDraftKeeper(
        () => storage2,
        () => 0,
      );
      k1.push(key, nothing);
      for (let k = 1; k <= half; k++) k1.push(key, answerAt(k));
      const reloaded = createDraftKeeper(
        () => storage2,
        () => 1000,
      );
      reloaded.push(key, nothing);
      const restored = roomTimeoutAnswer(reloaded, key);
      push("phone", "reload-half", restored, 0, {
        share: half / Math.max(1, n),
        note: restored === answerAt(half) ? "restored draft sent" : "restored draft lost",
      });
      // ...then one more action: the stage restarted from the opening board, so its draft holds one action.
      if (steps.length) {
        reloaded.push(key, answerAt(1));
        const after = roomTimeoutAnswer(reloaded, key);
        push("phone", "reload-half-then-one", after, 0, {
          share: 1 / Math.max(1, n),
          note: "stage restarts from the opening board after a reload",
        });
      }
    }
  }
  // 4. Spam at the buzzer.
  for (const s of kit.spam(puzzle, makeRng(hashText(`${type}:spam:${seed}`)), limit))
    push("bad", `spam:${s.label}`, s.answer, 0);
  push("bad", "nothing", nothing, 0);
  // 5. Kit players: the last answer by the buzzer; a finish submitted when it happened.
  for (const [level, skill] of Object.entries(SKILL_LEVELS)) {
    const pl = kit.play(puzzle, makeRng(hashText(`${type}:play:${seed}:${level}`)), skill, limit);
    const steps = cutAt(pl, limit);
    if (!steps.length) {
      push("skill", level, nothing, 0, { actions: 0 });
      continue;
    }
    let done: Run | null = null;
    if (pl.timed) {
      const last = steps.at(-1)!;
      const g = gradeAnswer(puzzle, last.answer, Math.max(0, limit - last.atMs));
      done = push(
        "skill",
        level,
        last.answer,
        g.isCorrect ? Math.max(0, Math.round(limit - last.atMs)) : 0,
        { actions: steps.length },
      );
    } else {
      for (const [i, st] of steps.entries()) {
        const ms = Math.max(0, Math.round(limit - st.atMs));
        if (gradeAnswer(puzzle, st.answer, ms).isCorrect) {
          done = push("skill", level, st.answer, ms, { actions: i + 1 });
          break;
        }
      }
      if (!done) push("skill", level, steps.at(-1)!.answer, 0, { actions: steps.length });
    }
  }
  return runs;
}

/* ----------------------------------------------------------------- arcade */

function arcadeRuns(types: PuzzleType[]): Run[] {
  if (!types.length) return [];
  let path = ARCADE_JSON;
  if (!path) {
    mkdirSync(OUT, { recursive: true });
    path = join(OUT, `arcade-bands-${PART}.json`);
    const jobs = Math.max(1, Math.min(4, cpus().length));
    console.error(
      `arcade: scripts/arcade-skill-bands.ts --rev=now --seeds=${ARCADE_SEEDS} (${types.length} games, ${jobs} jobs)`,
    );
    const r = spawnSync(
      "bun",
      [
        "scripts/arcade-skill-bands.ts",
        "--rev=now",
        `--seeds=${ARCADE_SEEDS}`,
        `--jobs=${jobs}`,
        `--json=${path}`,
        ...types,
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    if (r.status !== 0) throw new Error("arcade-skill-bands failed");
  }
  const data = JSON.parse(readFileSync(path, "utf8")) as {
    records: {
      type: PuzzleType;
      level: string;
      seed: number;
      score: number;
      flagged: boolean;
      mismatch: boolean;
      finished: boolean;
    }[];
  };
  const runs: Run[] = [];
  for (const r of data.records) {
    if (!types.includes(r.type)) continue;
    const def = PUZZLE_REGISTRY[r.type];
    runs.push({
      game: r.type,
      name: gameDisplayName(r.type),
      category: def.category,
      seed: r.seed,
      group: "arcade",
      level: r.level,
      score: r.score,
      finished: r.finished,
      msLeft: 0,
      limitMs: def.timeLimitMs,
      result: null,
      rev1: null,
      share: null,
      actions: null,
      extraActions: null,
      roomScore: null,
      note: r.flagged || r.mismatch ? "flagged or bot/replay mismatch" : "",
    });
  }
  // No input at all: the sim run to its end with an empty log, replayed by the server.
  for (const type of types) {
    const spec = GAMES.find((g) => g.type === type);
    const rev = (LIVE_BANDS as Record<string, { rev: number }>)[type]?.rev;
    if (!spec || rev === undefined) continue;
    for (let n = 0; n < ARCADE_SEEDS; n++) {
      const seed = spec.seedFor(n);
      const game = spec.gameFor(rev, seed);
      let state = game.init(seed);
      while (!game.isOver(state) && state.tick < game.runTicks)
        state = game.step(state, spec.taps ? false : null);
      const score = game.score(state);
      const raw = appendClientCounters(
        spec.encode(
          {
            seed,
            claimedScore: score,
            events: [],
            inputs: [],
            taps: [],
            endTick: state.tick,
            checkpoints: [],
          },
          rev,
          seed,
        ),
        arcadeCounters(type, state, score),
      );
      const replay = spec.replay(seed, raw, rev);
      const def = PUZZLE_REGISTRY[type];
      runs.push({
        game: type,
        name: gameDisplayName(type),
        category: def.category,
        seed,
        group: "arcade",
        level: "no-input",
        score: replay.score,
        finished: false,
        msLeft: 0,
        limitMs: def.timeLimitMs,
        result: null,
        rev1: null,
        share: null,
        actions: 0,
        extraActions: null,
        roomScore: null,
        note: "",
      });
    }
  }
  return runs;
}

/* --------------------------------------------------------------- analysis */

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};
const q = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};
const fmt = (x: number) => (Number.isFinite(x) ? String(x) : "—");
const range = (xs: number[]) =>
  xs.length ? `${median(xs)} (${Math.min(...xs)}–${Math.max(...xs)})` : "—";

export interface GameSummary {
  game: PuzzleType;
  name: string;
  category: string;
  kind: "puzzle" | "open" | "skill" | "arcade";
  runs: number;
  seeds: number;
  levels: Record<string, number[]>;
  checks: { part: string; pass: boolean | null; detail: string }[];
  severity: number;
  /** Proposed shared-helper scores (puzzles with a finish). */
  proposal: Record<string, number> | null;
  for150: string;
  bandFit: string;
}

const BAND_TARGET: Record<string, [number, number]> = {
  average: [60, 79],
  good: [90, 109],
  great: [110, 129],
  near: [130, 149],
};

/**
 * The proposed shared puzzle helper (docs §3): progress, time left and mistakes → score.
 *   unfinished: 110 × progress ÷ the progress one step short holds (so one short = 110, half done ≈ 55);
 *   finished:   120 + 30 × min(1, time share ÷ the fast share) × the efficiency share (1 when the game has none).
 */
export function proposedScore(
  run: Pick<Run, "result" | "finished" | "timeShare" | "effShare">,
  oneShort: number,
  tFast: number,
): number | null {
  if (run.result === null) return null;
  if (!run.finished)
    return Math.round(Math.min(110, (110 * (run.result / 99)) / Math.max(0.05, oneShort)));
  const time = run.timeShare ?? Math.max(0, (run.result - 100) / 100);
  return Math.round(120 + 30 * Math.min(1, time / tFast) * (run.effShare ?? 1));
}

export function summarise(runs: Run[]): GameSummary[] {
  const games = [...new Set(runs.map((r) => r.game))];
  const out: GameSummary[] = [];
  for (const game of games) {
    const rs = runs.filter((r) => r.game === game);
    const kind: GameSummary["kind"] =
      rs[0]!.group === "arcade"
        ? "arcade"
        : SKILL_ONLY.has(game)
          ? "skill"
          : REV2_OPEN_GAMES.has(game)
            ? "open"
            : "puzzle";
    const levels: Record<string, number[]> = {};
    for (const r of rs) (levels[`${r.group}:${r.level}`] ??= []).push(r.score);
    const L = (k: string) => levels[k] ?? [];
    const checks: GameSummary["checks"] = [];
    let severity = 0;
    const roomRuns = rs.filter((r) => r.roomScore !== null);
    const roomDiff = roomRuns.filter((r) => r.roomScore !== r.score);
    if (roomRuns.length) {
      checks.push({
        part: "room = practice",
        pass: roomDiff.length === 0,
        detail: `${roomRuns.length - roomDiff.length}/${roomRuns.length} identical`,
      });
      if (roomDiff.length) severity += 40;
    }
    // Random near 0: the worst spam strategy's median and 90th percentile.
    // Strategies that read the screen's feedback (KNOWN_SPAM in scripts/puzzle-fairness.ts) are reported, not judged.
    const known = KNOWN_SPAM[game] ?? {};
    const spamKeys = Object.keys(levels).filter(
      (k) => k.startsWith("bad:spam:") && !(k.slice(9) in known),
    );
    const knownKeys = Object.keys(levels).filter(
      (k) => k.startsWith("bad:spam:") && k.slice(9) in known,
    );
    if (knownKeys.length)
      checks.push({
        part: "screen-reading strategies (reported)",
        pass: null,
        detail: knownKeys.map((k) => `${k.slice(9)} median ${median(L(k))}`).join(", "),
      });
    const noInput = kind === "arcade" ? L("arcade:no-input") : [];
    const randomMed = Math.max(
      ...spamKeys.map((k) => median(L(k))),
      ...(noInput.length ? [median(noInput)] : []),
      -Infinity,
    );
    const randomP90 = Math.max(
      ...spamKeys.map((k) => q(L(k), 0.9)),
      ...(noInput.length ? [q(noInput, 0.9)] : []),
      -Infinity,
    );
    if (Number.isFinite(randomMed)) {
      const pass = randomMed <= 10 && randomP90 <= 25;
      checks.push({
        part: "random near 0",
        pass,
        detail: `worst strategy median ${randomMed}, p90 ${randomP90}`,
      });
      if (!pass) severity += Math.max(0, randomMed - 10) + Math.max(0, randomP90 - 25) / 2;
    }
    if (kind === "puzzle" || kind === "open") {
      // Monotonic progress: per seed, more actions of the clean solve never score less (2-point slack).
      const seeds = [...new Set(rs.map((r) => r.seed))];
      let drops = 0;
      for (const s of seeds) {
        const series = rs
          .filter((r) => r.seed === s && r.group === "progress" && r.actions !== null)
          .sort((a, b) => a.actions! - b.actions!)
          .map((r) => r.score);
        if (series.some((v, i) => i > 0 && v < series[i - 1]! - 2)) drops++;
      }
      const timeOrder = ["t0", "t10", "t25", "t50", "t75", "t90"];
      let tDrops = 0;
      for (const s of seeds) {
        const series = timeOrder
          .map(
            (lv) =>
              rs.find((r) => r.seed === s && r.group === "time" && r.level === lv && r.finished)
                ?.score,
          )
          .filter((x): x is number => x !== undefined);
        if (series.some((v, i) => i > 0 && v < series[i - 1]! - 2)) tDrops++;
      }
      const mFew = median(rs.filter((r) => r.level === "few" && r.finished).map((r) => r.score));
      const mMany = median(rs.filter((r) => r.level === "many" && r.finished).map((r) => r.score));
      const monoPass = drops === 0 && tDrops === 0 && !(mMany > mFew + 2);
      checks.push({
        part: "monotonic",
        pass: monoPass,
        detail: `progress drops on ${drops}/${seeds.length} seeds; time drops on ${tDrops}; mistakes few ${fmt(mFew)} → many ${fmt(mMany)}`,
      });
      if (!monoPass)
        severity +=
          (30 * (drops + tDrops)) / Math.max(1, seeds.length) +
          (Number.isFinite(mMany - mFew) ? Math.max(0, mMany - mFew) : 0);
      if (kind === "puzzle") {
        const finished = rs.filter((r) => r.finished && r.group !== "skill");
        const t0 = rs.filter((r) => r.level === "t0" && r.finished).map((r) => r.score);
        const minFinish = finished.length ? Math.min(...finished.map((r) => r.score)) : NaN;
        const floorPass = finished.length > 0 && minFinish >= 120;
        checks.push({
          part: "finish floor 120",
          pass: finished.length ? floorPass : null,
          detail: `buzzer finish ${range(t0)}; lowest finish ${fmt(minFinish)}`,
        });
        if (!floorPass && Number.isFinite(minFinish))
          severity += Math.max(0, 120 - median(t0.length ? t0 : [minFinish])) * 1.5;
        const p50 = median(L("progress:p50"));
        const one = median(L("progress:one-short"));
        const unfinishedMax = Math.max(
          ...rs.filter((r) => !r.finished && r.group === "progress").map((r) => r.score),
        );
        const scalePass =
          p50 >= 40 &&
          p50 <= 70 &&
          (!Number.isFinite(one) || (one >= 95 && one <= 115)) &&
          unfinishedMax <= 115;
        checks.push({
          part: "partial scale",
          pass: scalePass,
          detail: `50 % → ${fmt(p50)} (target ~55); one short → ${fmt(one)} (target ~110); top unfinished ${fmt(unfinishedMax)}`,
        });
        if (!scalePass)
          severity +=
            Math.abs(55 - (Number.isFinite(p50) ? p50 : 55)) +
            (Number.isFinite(one) ? Math.abs(110 - one) / 2 : 0);
      }
    }
    // Skill bands (kit players or arcade bots).
    const prefix = kind === "arcade" ? "arcade:" : "skill:";
    const fits: string[] = [];
    let prev = -Infinity;
    let sepFail = false;
    for (const lv of ["careless", "below", "average", "good", "great", "near"]) {
      const xs = L(prefix + lv);
      if (!xs.length) continue;
      const m = median(xs);
      const t = BAND_TARGET[lv];
      fits.push(
        `${lv} ${m}${t ? (m >= t[0] && m <= t[1] ? " ✓" : ` (target ${t[0]}–${t[1]})`) : ""}`,
      );
      if (m < prev + 5 && lv !== "careless") sepFail = true;
      prev = Math.max(prev, m);
    }
    if (kind === "skill" || kind === "arcade" || kind === "open") {
      const avg = median(L(prefix + "average"));
      const pass = avg >= 60 && avg <= 79;
      checks.push({
        part: "average player 60–79",
        pass: Number.isFinite(avg) ? pass : null,
        detail: fits.join(", "),
      });
      if (Number.isFinite(avg) && !pass)
        severity += Math.min(Math.abs(avg - 60), Math.abs(avg - 79));
      checks.push({
        part: "levels separate",
        pass: !sepFail,
        detail: sepFail
          ? "two neighbouring levels within 5 points"
          : "each level ≥ 5 above the one below",
      });
      if (sepFail) severity += 5;
    }
    // Time for 150 on a clean finish.
    const f150 = rs.filter((r) => r.level === "for150");
    const reach = f150.filter((r) => r.msLeft < r.limitMs);
    const for150 = f150.length
      ? reach.length
        ? `${median(reach.map((r) => Math.round((100 * r.msLeft) / r.limitMs)))} % left (${Math.round(median(reach.map((r) => (r.limitMs - r.msLeft) / 1000)))} s of ${Math.round(rs[0]!.limitMs / 1000)} s)${reach.length < f150.length ? `; unreachable on ${f150.length - reach.length} seeds` : ""}`
        : "unreachable"
      : "—";
    // Proposal: the shared helper scaled on this game's own one-short progress and near-perfect quality.
    // On puzzleScoreRev 3 (the helper is live) the grid is the graded scores themselves.
    let proposal: GameSummary["proposal"] = null;
    const live = kind === "puzzle" && rs.some((r) => typeof r.progress === "number");
    if (live) {
      const oneShortProg = median(
        rs.filter((r) => r.level === "one-short" && typeof r.progress === "number").map((r) => r.progress!),
      );
      const g = REV3_GAMES[game];
      proposal = {
        oneShort: Math.round(oneShortProg * 100) / 100,
        tFast: g ? g.fastShare : NaN,
        dataOneShort: g ? Math.round(g.oneShort * 100) / 100 : NaN,
        broken: 0,
      };
      const pk = (k: string) => median(rs.filter((r) => `${r.group}:${r.level}` === k).map((r) => r.score));
      for (const k of [
        "progress:p25",
        "progress:p50",
        "progress:p75",
        "progress:one-short",
        "time:t0",
        "time:t50",
        "time:t90",
        "skill:average",
        "skill:good",
        "skill:great",
        "skill:near",
      ])
        proposal[k] = pk(k);
      proposal.random = Math.max(...spamKeys.map((k) => median(L(k))), 0);
      proposal.randomP90 = Math.max(...spamKeys.map((k) => q(L(k), 0.9)), 0);
    } else if (kind === "puzzle") {
      const oneShortProg = median(
        rs.filter((r) => r.level === "one-short" && r.result !== null).map((r) => r.result! / 99),
      );
      const nearT = rs
        .filter((r) => r.level === "near" && r.finished && r.timeShare != null)
        .map((r) => r.timeShare!);
      const tFast = Math.min(0.9, Math.max(0.25, nearT.length ? q(nearT, 0.75) : 0.6));
      const broken = !(Number.isFinite(oneShortProg) && oneShortProg > 0.3);
      const one = broken ? 0.9 : oneShortProg;
      proposal = {
        oneShort: Math.round((Number.isFinite(oneShortProg) ? oneShortProg : NaN) * 100) / 100,
        tFast: Math.round(tFast * 100) / 100,
        broken: broken ? 1 : 0,
      };
      for (const r of rs)
        (r as Run & { proposed?: number | null }).proposed = proposedScore(r, one, tFast);
      const pk = (k: string) =>
        median(
          rs
            .filter((r) => `${r.group}:${r.level}` === k)
            .map((r) => (r as Run & { proposed?: number }).proposed ?? NaN)
            .filter(Number.isFinite),
        );
      for (const k of [
        "progress:p25",
        "progress:p50",
        "progress:p75",
        "progress:one-short",
        "time:t0",
        "time:t50",
        "time:t90",
        "skill:average",
        "skill:good",
        "skill:great",
        "skill:near",
      ])
        proposal[k] = pk(k);
      proposal.random = Math.max(
        ...spamKeys.map((k) =>
          median(
            rs
              .filter((r) => `${r.group}:${r.level}` === k)
              .map((r) => (r as Run & { proposed?: number }).proposed ?? 0),
          ),
        ),
        0,
      );
    }
    out.push({
      game,
      name: gameDisplayName(game),
      category: rs[0]!.category,
      kind,
      runs: rs.length,
      seeds: new Set(rs.map((r) => r.seed)).size,
      levels,
      checks,
      severity: Math.round(severity),
      proposal,
      for150,
      bandFit: fits.join(", "),
    });
  }
  return out;
}

/* ---------------------------------------------------------------- writing */

const CAT_ORDER = ["word", "number", "speed", "attention", "pattern", "logic", "arcade"];
const sortGames = (a: GameSummary, b: GameSummary) =>
  CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category) || a.name.localeCompare(b.name);

function cell(xs: number[] | undefined, bad: (m: number) => boolean): string {
  if (!xs || !xs.length) return "—";
  const m = median(xs);
  return bad(m) ? `**${m}** ⚠` : String(m);
}

export function gridMarkdown(sums: GameSummary[]): string {
  const head =
    "| Game | Cat | 25 % | 50 % | 75 % | one short | finish at buzzer | finish 50 % left | perfect (90 % left) | random | avg | good | great | near |";
  const rows = [head, "|" + " --- |".repeat(14)];
  for (const s of [...sums].sort(sortGames)) {
    const L = (k: string) => s.levels[k];
    const sk = s.kind === "arcade" ? "arcade:" : "skill:";
    const known = KNOWN_SPAM[s.game] ?? {};
    const spam = Object.keys(s.levels).filter(
      (k) => (k.startsWith("bad:spam:") && !(k.slice(9) in known)) || k === "arcade:no-input",
    );
    // With only screen-reading strategies (Strikeout, Tally), the worst of those, marked ˢ.
    const pool = spam.length
      ? spam
      : Object.keys(s.levels).filter((k) => k.startsWith("bad:spam:"));
    const worst = pool.map((k) => s.levels[k]!).sort((a, b) => median(b) - median(a))[0];
    const randomCell = spam.length ? cell(worst, (m) => m > 10) : worst ? `${median(worst)}ˢ` : "—";
    const finishGame = s.kind === "puzzle";
    const band = (lv: string) => (m: number) => {
      const t = BAND_TARGET[lv]!;
      return s.kind === "puzzle" ? false : m < t[0] - 10 || m > t[1] + 10;
    };
    rows.push(
      `| ${s.name} | ${s.category} | ${cell(L("progress:p25"), (m) => finishGame && (m < 15 || m > 40))} | ${cell(L("progress:p50"), (m) => finishGame && (m < 40 || m > 70))} | ${cell(L("progress:p75"), (m) => finishGame && (m < 65 || m > 95))} | ${cell(L("progress:one-short"), (m) => finishGame && (m < 95 || m > 115))} | ${cell(L("time:t0"), (m) => finishGame && m < 120)} | ${cell(L("time:t50"), (m) => finishGame && m < 120)} | ${cell(L("time:t90"), (m) => finishGame && m < 145)} | ${randomCell} | ${cell(L(sk + "average"), band("average"))} | ${cell(L(sk + "good"), band("good"))} | ${cell(L(sk + "great"), band("great"))} | ${cell(L(sk + "near"), band("near"))} |`,
    );
  }
  return rows.join("\n");
}

const LEVEL_TITLES: [string, string][] = [
  ["progress:nothing", "nothing"],
  ["progress:p10", "10 %"],
  ["progress:p25", "25 %"],
  ["progress:p40", "40 %"],
  ["progress:p50", "50 %"],
  ["progress:p60", "60 %"],
  ["progress:p75", "75 %"],
  ["progress:p90", "90 %"],
  ["progress:two-short", "two short"],
  ["progress:one-short", "one short"],
  ["progress:all", "every action (no finish)"],
  ["time:t90", "finish, 90 % left"],
  ["time:t75", "finish, 75 % left"],
  ["time:t50", "finish, 50 % left"],
  ["time:t25", "finish, 25 % left"],
  ["time:t10", "finish, 10 % left"],
  ["time:t0", "finish at the buzzer"],
  ["mistakes:few", "finish, few mistakes"],
  ["mistakes:some", "finish, some mistakes"],
  ["mistakes:many", "finish, many mistakes"],
  ["bad:undo", "half done, then undone"],
  ["bad:nothing", "no input"],
  ["phone:timeout-one-short", "phone: time-out one short"],
  ["phone:reload-half", "phone: reload at half"],
  ["phone:reload-half-then-one", "phone: reload, then one action"],
  ["skill:careless", "kit careless"],
  ["skill:below", "kit below average"],
  ["skill:average", "kit average"],
  ["skill:good", "kit good"],
  ["skill:great", "kit great"],
  ["skill:near", "kit near perfect"],
  ["arcade:no-input", "no input"],
  ["arcade:average", "bot average"],
  ["arcade:good", "bot good"],
  ["arcade:great", "bot great"],
  ["arcade:near", "bot near perfect"],
];

export function detailMarkdown(sums: GameSummary[], meaning: Record<string, string>): string {
  const parts: string[] = [];
  for (const s of [...sums].sort(sortGames)) {
    parts.push(
      `#### ${s.name} (\`${s.game}\`, ${s.category}, ${s.kind === "puzzle" ? "finish puzzle" : s.kind === "open" ? "no finish state" : s.kind === "skill" ? "speed / engine game" : "arcade"}) — ${s.runs} runs, ${s.seeds} seeds`,
    );
    if (meaning[s.game]) parts.push(`Progress means: ${meaning[s.game]}`);
    const rows = ["| Level | median (min–max) |", "| --- | --- |"];
    for (const [k, title] of LEVEL_TITLES)
      if (s.levels[k]) rows.push(`| ${title} | ${range(s.levels[k]!)} |`);
    for (const k of Object.keys(s.levels)
      .filter((k) => k.startsWith("bad:spam:"))
      .sort())
      rows.push(
        `| random: ${k.slice(9)}${k.slice(9) in (KNOWN_SPAM[s.game] ?? {}) ? " (reads the screen)" : ""} | ${range(s.levels[k]!)} |`,
      );
    parts.push(rows.join("\n"));
    if (s.for150 !== "—") parts.push(`150 on a clean finish needs: ${s.for150}.`);
    parts.push(
      s.checks
        .map(
          (c) =>
            `- ${c.pass === null ? "n/a" : c.pass ? "PASS" : "**FAIL**"} ${c.part}: ${c.detail}`,
        )
        .join("\n"),
    );
  }
  return parts.join("\n\n");
}

const CSV_COLS: (keyof Run | "proposed")[] = [
  "game",
  "name",
  "category",
  "seed",
  "group",
  "level",
  "score",
  "finished",
  "msLeft",
  "limitMs",
  "result",
  "rev1",
  "share",
  "actions",
  "extraActions",
  "timeShare",
  "effShare",
  "roomScore",
  "proposed",
  "note",
];
export function csv(runs: Run[]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "number" ? String(Math.round(v * 1000) / 1000) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    [
      CSV_COLS.join(","),
      ...runs.map((r) =>
        CSV_COLS.map((c) => esc((r as unknown as Record<string, unknown>)[c])).join(","),
      ),
    ].join("\n") + "\n"
  );
}

/** Replaces the text between <!-- generated:<id> --> and <!-- /generated:<id> --> in the report. */
function fill(doc: string, id: string, body: string): string {
  const open = `<!-- generated:${id} -->`;
  const close = `<!-- /generated:${id} -->`;
  const a = doc.indexOf(open);
  const b = doc.indexOf(close);
  if (a < 0 || b < 0) return doc;
  return doc.slice(0, a + open.length) + "\n" + body + "\n" + doc.slice(b);
}

/* ------------------------------------------------------------------- main */

function selected(): PuzzleType[] {
  return ACTIVE_PUZZLE_TYPES.filter(
    (t) =>
      (ONLY_GAMES.length === 0 || ONLY_GAMES.includes(t)) &&
      (ONLY_CATS.length === 0 || ONLY_CATS.includes(PUZZLE_REGISTRY[t].category)),
  );
}

async function main() {
  if (COMBINE) {
    const files = readdirSync(COMBINE).filter((f) => /^runs-.*\.json$/.test(f));
    const byKey = new Map<string, Run>();
    for (const f of files)
      for (const r of JSON.parse(readFileSync(join(COMBINE, f), "utf8")) as Run[])
        byKey.set(`${r.game}|${r.seed}|${r.group}|${r.level}`, r);
    const runs = [...byKey.values()];
    const sums = summarise(runs);
    const order = new Map(sums.sort(sortGames).map((s, i) => [s.game, i]));
    runs.sort((a, b) => order.get(a.game)! - order.get(b.game)! || a.seed - b.seed);
    writeFileSync(join(COMBINE, "summary.json"), JSON.stringify(sums, null, 1));
    console.log(`${runs.length} runs, ${sums.length} games → ${join(COMBINE, "summary.json")}`);
    if (WRITE) {
      writeFileSync("docs/scoring-report-oct-2026.csv", csv(runs));
      const docPath = "docs/scoring-report-oct-2026.md";
      if (existsSync(docPath)) {
        const meaning = (await import("./scoring-report-meaning")).PROGRESS_MEANING as Record<
          string,
          string
        >;
        let doc = readFileSync(docPath, "utf8");
        doc = fill(doc, "coverage", coverageMarkdown(sums));
        doc = fill(doc, "ranking", rankingMarkdown(sums));
        doc = fill(doc, "grid", gridMarkdown(sums));
        doc = fill(doc, "detail", detailMarkdown(sums, meaning));
        doc = fill(doc, "proposal", proposalMarkdown(sums));
        writeFileSync(docPath, doc);
      }
      console.log("wrote docs/scoring-report-oct-2026.csv (and the generated sections of the .md)");
    }
    if (REV3_DOC) {
      let doc = existsSync(REV3_DOC) ? readFileSync(REV3_DOC, "utf8") : "<!-- generated:rev3-grid -->\n<!-- /generated:rev3-grid -->\n\n<!-- generated:rev3-marks -->\n<!-- /generated:rev3-marks -->\n";
      doc = fill(doc, "rev3-grid", proposalMarkdown(sums));
      doc = fill(doc, "rev3-marks", rev3MarksMarkdown(sums));
      writeFileSync(REV3_DOC, doc);
      console.log(`wrote the rev-3 sections of ${REV3_DOC}`);
    }
    return;
  }
  const types = selected();
  const runs: Run[] = [];
  for (const type of types) {
    if (PUZZLE_REGISTRY[type].category === "arcade") continue;
    const kit = KITS[type];
    if (!kit) {
      console.error(`${type}: no kit (skipped)`);
      continue;
    }
    const t0 = performance.now();
    for (let n = 0; n < SEEDS; n++) runs.push(...playPuzzle(type, kit, 9001 + n * 7));
    console.error(
      `${type}: ${runs.filter((r) => r.game === type).length} runs in ${((performance.now() - t0) / 1000).toFixed(1)} s`,
    );
  }
  if (!NO_ARCADE)
    runs.push(...arcadeRuns(types.filter((t) => PUZZLE_REGISTRY[t].category === "arcade")));
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `runs-${PART}.json`);
  writeFileSync(file, JSON.stringify(runs));
  for (const s of summarise(runs).sort(sortGames))
    console.log(
      `${s.name.padEnd(22)} ${s.checks.map((c) => `${c.pass === null ? "·" : c.pass ? "✓" : "✗"} ${c.part}`).join("  ")}`,
    );
  console.log(`${runs.length} runs → ${file}`);
}

export function coverageMarkdown(sums: GameSummary[]): string {
  const rows = [
    "| # | Game | id | Category | How played | Seeds | Runs |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  const how = {
    puzzle: "level grid + kit players + phone path",
    open: "progress + kit players + phone path (no finish)",
    skill: "kit players + spam",
    arcade: "arcade bots (server replay) + no input",
  };
  const seen = new Set(sums.map((s) => s.game));
  let i = 0;
  for (const s of [...sums].sort(sortGames))
    rows.push(
      `| ${++i} | ${s.name} | \`${s.game}\` | ${s.category} | ${how[s.kind]} | ${s.seeds} | ${s.runs} |`,
    );
  for (const t of ACTIVE_PUZZLE_TYPES.filter((t) => !seen.has(t)))
    rows.push(
      `| ${++i} | ${gameDisplayName(t)} | \`${t}\` | ${PUZZLE_REGISTRY[t].category} | **skipped**: no kit or bot | 0 | 0 |`,
    );
  return rows.join("\n");
}

export function rankingMarkdown(sums: GameSummary[]): string {
  const failing = sums
    .filter((s) => s.checks.some((c) => c.pass === false))
    .sort((a, b) => b.severity - a.severity);
  const rows = ["| Rank | Game | Severity | Parts failed |", "| --- | --- | --- | --- |"];
  failing.forEach((s, i) =>
    rows.push(
      `| ${i + 1} | ${s.name} | ${s.severity} | ${s.checks
        .filter((c) => c.pass === false)
        .map((c) => `${c.part} (${c.detail})`)
        .join("; ")} |`,
    ),
  );
  return rows.join("\n");
}

export function proposalMarkdown(sums: GameSummary[]): string {
  const rows = [
    "| Game | one-short progress | fast time share | 25 % | 50 % | 75 % | one short | buzzer finish | 50 % left | 90 % left | random | avg | good | great | near |",
    "|" + " --- |".repeat(15),
  ];
  for (const s of [...sums].sort(sortGames)) {
    const p = s.proposal;
    if (!p) continue;
    const v = (k: string) => fmt(p[k]!);
    rows.push(
      `| ${s.name} | ${p.oneShort}${p.broken ? " ⚠ needs a progress measure" : ""} | ${p.tFast} | ${v("progress:p25")} | ${v("progress:p50")} | ${v("progress:p75")} | ${v("progress:one-short")} | ${v("time:t0")} | ${v("time:t50")} | ${v("time:t90")} | ${v("random")} | ${v("skill:average")} | ${v("skill:good")} | ${v("skill:great")} | ${v("skill:near")} |`,
    );
  }
  return rows.join("\n");
}

/**
 * puzzleScoreRev 3's pass marks (Joe, 20 Oct 2026) for every helper game: one short 105–110, a finish at the
 * buzzer 120, a perfect fast run (90 % of the clock left, no mistakes) 150, half done 40–70, random at most 10
 * (the worst spam strategy's median), never lower for more progress, time or fewer mistakes, rooms = practice.
 */
export function rev3MarksMarkdown(sums: GameSummary[]): string {
  const rows = [
    "| Game | one short | buzzer finish | perfect fast | half done | random (median / p90) | monotonic | rooms = practice | misses |",
    "|" + " --- |".repeat(9),
  ];
  for (const s of [...sums].sort(sortGames)) {
    const p = s.proposal;
    if (!p || !("dataOneShort" in p)) continue;
    const misses: string[] = [];
    const mark = (label: string, v: number, ok: (x: number) => boolean) => {
      if (!Number.isFinite(v)) return "—";
      if (!ok(v)) misses.push(label);
      return ok(v) ? `${v}` : `**${v}** ✗`;
    };
    const one = mark("one short", p["progress:one-short"]!, (x) => x >= 105 && x <= 110);
    const buzzer = mark("buzzer finish", p["time:t0"]!, (x) => x === 120);
    const fast = mark("perfect fast", p["time:t90"]!, (x) => x === 150);
    const half = mark("half done", p["progress:p50"]!, (x) => x >= 40 && x <= 70);
    const rnd = mark("random", p.random!, (x) => x <= 10);
    const mono = s.checks.find((c) => c.part === "monotonic");
    const room = s.checks.find((c) => c.part === "room = practice");
    if (mono && mono.pass === false) misses.push("monotonic");
    if (room && room.pass === false) misses.push("rooms = practice");
    rows.push(
      `| ${s.name} | ${one} | ${buzzer} | ${fast} | ${half} | ${rnd} / ${fmt(p.randomP90!)} | ${mono ? (mono.pass ? "✓" : `✗ ${mono.detail}`) : "—"} | ${room ? (room.pass ? "✓" : `✗ ${room.detail}`) : "—"} | ${misses.length ? misses.join(", ") : "none"} |`,
    );
  }
  return rows.join("\n");
}

if (import.meta.main) await main();
