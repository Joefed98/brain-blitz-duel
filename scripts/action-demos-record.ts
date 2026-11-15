/**
 * Records the six Action games' intro demos (the Action overhaul, stage 3, 15 Nov 2026) into
 * scripts/fixtures/action-demos.json: for each game, the intro example dealt exactly as the practice deal function deals
 * it (`practiceGenerateFn` with `example: true`, the stamps rooms deal), played by the game's skill-band bot at strong
 * levels (perfect, elite, near; a few human seeds each), every candidate encoded as the phone submits it and replayed by
 * the server's own replay. A candidate is kept only when the server's score equals the bot's, nothing is flagged, the
 * whole run scores at least DEMO_MIN_SCORE, and the intro's window (ticks 1–480, what the intro plays) holds no slip and
 * the game's main moments (`judgeWindow` in action-demos-lib.ts); the best kept one (whole score, then window score)
 * is stored. Deterministic: the same tree records the same file.
 *
 *   bun scripts/action-demos-record.ts [games…] [--rev=<n>] [--pin=<deal pin>] [--dry]
 *
 * `--rev=<n>` (one game) refuses unless the dealt example carries stamp n (Orbit's next stamp: record with
 * `bun scripts/action-demos-record.ts orbit --rev=16` once rooms deal it). `--pin=<name>` deals under a DEAL_PINS era
 * (src/lib/duel/dealEra.ts) instead, for recording an older stamp on purpose (the check then refuses it: the stop rule
 * plays only ACTION_DEMO_REVS). Games not named keep their stored entries.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  ACTION_DEMO_FIXTURE,
  ACTION_DEMO_TYPES,
  DEMO_LEVELS,
  DEMO_HUMAN_SEEDS,
  DEMO_MIN_SCORE,
  botFor,
  demoFrame,
  introExample,
  judgeWindow,
  playDemoRun,
  puzzleDigest,
  serverReplay,
  stampOf,
  DEMO_LENGTH_TICKS,
  type ActionDemoEntry,
  type ActionDemoFile,
  type ActionDemoType,
} from "./action-demos-lib";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const only = args.filter((a) => !a.startsWith("--")) as ActionDemoType[];
for (const t of only) if (!ACTION_DEMO_TYPES.includes(t)) throw new Error(`unknown game ${t} (one of ${ACTION_DEMO_TYPES.join(", ")})`);
const wantRev = opt("rev") === undefined ? null : Number(opt("rev"));
const pin = opt("pin");
if (wantRev !== null && only.length !== 1) throw new Error("--rev=<n> takes exactly one game");
const dry = args.includes("--dry");

const file: ActionDemoFile = existsSync(ACTION_DEMO_FIXTURE) ? JSON.parse(readFileSync(ACTION_DEMO_FIXTURE, "utf8")) : { note: "", demos: {} };

for (const type of only.length ? only : ACTION_DEMO_TYPES) {
  const puzzle = introExample(type, pin ? [pin] : []);
  const stamp = stampOf(type, puzzle);
  if (wantRev !== null && stamp !== wantRev)
    throw new Error(`${type}: the intro example deals stamp ${stamp}, not ${wantRev} (record once rooms deal it, or deal it under its pin with --pin=<name>)`);
  const bot = await botFor(type);
  let best: (ActionDemoEntry & { rank: number[] }) | null = null;
  const tried: string[] = [];
  for (const level of DEMO_LEVELS)
    for (const humanSeed of DEMO_HUMAN_SEEDS) {
      const { raw, score } = playDemoRun(type, puzzle, bot, level, humanSeed);
      const replay = serverReplay(type, puzzle, raw);
      const end = demoFrame(type, puzzle, raw, DEMO_LENGTH_TICKS);
      const verdict = judgeWindow(type, puzzle, raw);
      const ok = replay.score === score && !replay.flagged && score >= DEMO_MIN_SCORE && verdict.ok;
      tried.push(`${level}#${humanSeed}: ${score}${replay.score !== score ? ` (server ${replay.score})` : ""}${replay.flagged ? " flagged" : ""}, window ${end.score} ${verdict.ok ? "ok" : `(${verdict.why.join("; ")})`}`);
      if (!ok) continue;
      const rank = [score, end.score];
      if (best && (best.rank[0]! > rank[0]! || (best.rank[0] === rank[0] && best.rank[1]! >= rank[1]!))) continue;
      best = { rank, type, stamp: stamp ?? 0, level, humanSeed, score, windowScore: end.score, moments: verdict.moments, digest: puzzleDigest(puzzle), puzzle, run: raw };
    }
  console.log(`${type} (${stamp}):\n  ${tried.join("\n  ")}`);
  if (!best) throw new Error(`${type}: no candidate passed (see above)`);
  const { rank: _rank, ...entry } = best;
  void _rank;
  file.demos[type] = entry;
  console.log(`  -> ${entry.level}#${entry.humanSeed}: ${entry.score}, window ${entry.windowScore} ${JSON.stringify(entry.moments)}`);
}

file.note =
  "The six Action games' intro demos (bun scripts/action-demos-record.ts; saved to the live table by scripts/action-demos-save.ts through saveIntroDemoFn; proved by scripts/action-demos-check.ts). Each run is on the intro example the practice deal function deals.";
if (!dry) {
  writeFileSync(ACTION_DEMO_FIXTURE, JSON.stringify(file, null, 1) + "\n");
  console.log(`wrote ${ACTION_DEMO_FIXTURE}`);
}
