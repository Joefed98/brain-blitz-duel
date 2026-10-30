/**
 * High Rise on the arcade scoring standard (skylineRev 9, 29 Oct 2026, docs/arcade-standard/skyline.md):
 *
 *  1. older revisions replay exactly as before: 28 skill-band runs saved on skylineRev 8 (weak → flawless), each
 *     replayed through the server path on every older revision (unstamped, 2–8), match the score, flag, floors,
 *     perfect drops and final-state digest recorded on the code before the change
 *     (scripts/fixtures/skyline-standard-legacy.json.gz, `bun scripts/skyline-standard-legacy.ts`);
 *  2. the same input logs on skylineRev 9 play exactly as on rev 8 (floors, perfect drops, widths, streak) wherever the
 *     schedule kept rev 8's narrow and wide blocks, and only the gold blocks moved;
 *  3. rev-9 runs replay through the server (replaySkylineRun and gradeSubmission) to the stored score: unflagged, the
 *     score the sum of the standard parts (held to 1…200), the extras (golds, milestones, no multiplier) and the
 *     reveal's lines one per part;
 *  4. what rooms deal (generatePuzzle) is skylineRev 9 and its game starts with exactly five gold blocks.
 *
 *   bun scripts/skyline-standard-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  skylineCheckpoint,
  skylineGameFor,
  skylineKinds,
  skylineKindsV9,
  skylineStdParts,
  SKYLINE_CHECKPOINT_INTERVAL,
  SKYLINE_KIND_GOLD,
  SKYLINE_REV_LIFT,
  SKYLINE_REV_STD,
  SKYLINE_RUN_TICKS,
  type SkylineState,
} from "../src/lib/arcade/skyline";
import { stdScore, stdSum } from "../src/lib/arcade/arcadeStandard";
import { decodeSkylineRun, encodeSkylineRun, replaySkylineRun } from "../src/lib/duel/skyline";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeSubmission } from "../src/lib/duel/grade";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { fnv, SKYLINE_LEGACY_REVS, type SkylineLegacyRun } from "./skyline-standard-legacy";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}

const runs = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/skyline-standard-legacy.json.gz", import.meta.url))).toString()) as SkylineLegacyRun[];
ok(runs.length === 28, `the legacy fixture holds 28 runs (${runs.length})`);

/* 1. Older revisions unchanged. */
const quiet = console.error;
console.error = () => {};
for (const r of runs)
  for (const rev of SKYLINE_LEGACY_REVS) {
    const want = r.revs[String(rev ?? 0)]!;
    const got = replaySkylineRun(r.seed, r.raw, rev);
    const same = got.score === want.score && got.flagged === want.flagged && got.blocks === want.blocks && got.perfects === want.perfects && fnv(JSON.stringify(got.state)) === want.stateHash;
    ok(same, `${r.level} ${r.n} on skylineRev ${rev ?? "unstamped"}: replays as before (score ${got.score} vs ${want.score})`);
  }
console.error = quiet;

/** Plays an input log on a revision's game (no client claim), keeping the phone's checkpoints. */
function play(rev: number, seed: number, taps: Set<number>, endTick: number): { state: SkylineState; checkpoints: ReturnType<typeof skylineCheckpoint>[] } {
  const game = skylineGameFor(rev);
  let state = game.init(seed);
  const checkpoints: ReturnType<typeof skylineCheckpoint>[] = [];
  for (let t = 1; t <= endTick; t++) {
    state = game.step(state, taps.has(t));
    if (state.tick % SKYLINE_CHECKPOINT_INTERVAL === 0) checkpoints.push(skylineCheckpoint(state));
    if (game.isOver(state)) break;
  }
  return { state, checkpoints };
}

const sameNarrowWide = (seed: number) => {
  const a = skylineKinds(seed);
  const b = skylineKindsV9(seed);
  return a.every((k, i) => k === b[i] || k === SKYLINE_KIND_GOLD || b[i] === SKYLINE_KIND_GOLD);
};

/* 2 and 3. The same logs on rev 9. */
let comparable = 0;
const scores: number[] = [];
for (const r of runs) {
  const run = decodeSkylineRun(r.raw);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, SKYLINE_RUN_TICKS) : SKYLINE_RUN_TICKS;
  const taps = new Set(run.inputs);
  const v8 = play(SKYLINE_REV_LIFT, r.seed, taps, endTick).state;
  const { state: v9, checkpoints } = play(SKYLINE_REV_STD, r.seed, taps, endTick);
  ok(v8.placed === r.revs["8"]!.blocks, `${r.level} ${r.n}: the rev-8 log replays to its stored floors`);
  if (sameNarrowWide(r.seed)) {
    comparable++;
    const playSame =
      v9.placed === v8.placed &&
      v9.perfects === v8.perfects &&
      v9.bestStreak === v8.bestStreak &&
      v9.missed === v8.missed &&
      v9.tick === v8.tick &&
      JSON.stringify(v9.blocks) === JSON.stringify(v8.blocks);
    ok(playSame, `${r.level} ${r.n}: rev 9 plays the log exactly as rev 8 (floors ${v9.placed} vs ${v8.placed})`);
  }
  const parts = skylineStdParts(v9)!;
  ok(parts !== null && v9.expandRev === SKYLINE_REV_STD, `${r.level} ${r.n}: a rev-9 state has standard parts`);
  const want = stdScore(parts, Boolean(v9.acted));
  ok(want === Math.min(200, Math.max(1, stdSum(parts))), `${r.level} ${r.n}: the score is the parts' sum held to 1…200`);
  const raw = encodeSkylineRun({ seed: r.seed, claimedScore: skylineGameFor(SKYLINE_REV_STD).score(v9), inputs: run.inputs, endTick: run.endTick, checkpoints });
  const replay = replaySkylineRun(r.seed, raw, SKYLINE_REV_STD);
  ok(!replay.flagged && replay.score === want, `${r.level} ${r.n}: the server replay stores ${replay.score} (${want}), unflagged`);
  ok(replay.golds === (v9.golds ?? 0), `${r.level} ${r.n}: the replay reports the gold blocks landed`);
  scores.push(replay.score);
  const graded = gradeSubmission({ type: "skyline", seed: r.seed, skylineRev: SKYLINE_REV_STD }, raw, 0);
  ok(graded.score === want, `${r.level} ${r.n}: gradeSubmission stores ${graded.score} (${want})`);
  const extra = graded.extra ?? {};
  ok(extra["skylineRev"] === SKYLINE_REV_STD && extra["golds"] === (v9.golds ?? 0) && "milestones" in extra && !("bestMult" in extra), `${r.level} ${r.n}: rev-9 extras carry golds and milestones, no multiplier`);
  const reveal = buildArcadeReveal("skyline", replay, replay.score);
  ok(Boolean(reveal) && reveal!.lines.length === parts.length + 1 && reveal!.lines[0]!.startsWith("Floors:"), `${r.level} ${r.n}: the reveal shows one line per part and the total`);
  ok(Boolean(reveal) && reveal!.tiles.some((t) => t.label === "Gold blocks" && t.value === `${v9.golds ?? 0} / 5`), `${r.level} ${r.n}: the reveal's gold tile counts of 5`);
}
ok(comparable >= 20, `at least 20 of the 28 logs compared play on rev 8 and 9 (${comparable})`);
ok(scores.every((s) => s >= 1 && s <= 200), "every played rev-9 run scores 1…200");

/* 4. What rooms deal. */
const dealt = generatePuzzle("skyline") as { skylineRev?: number; seed: number };
ok(dealt.skylineRev === SKYLINE_REV_STD, `rooms deal skylineRev ${dealt.skylineRev}`);
ok((skylineGameFor(SKYLINE_REV_STD).init(dealt.seed).kinds ?? []).filter((k) => k === SKYLINE_KIND_GOLD).length === 5, "a dealt run has exactly five gold blocks");

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} High Rise standard checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} High Rise standard checks (older revisions unchanged on 28 logs × 8 revisions; rev 9 = rev 8 play on ${comparable} logs; rev-9 scores ${scores.join(" ")})`);
