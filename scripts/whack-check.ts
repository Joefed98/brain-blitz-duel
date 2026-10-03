/** Whack-a-Target schedule checks and client/server identity proof only. */
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { inputAt, recordInput, rngBelow, type ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  whackCheckpoint, whackGame, whackRule, whackScore, whackLife,
  WHACK_BOMB, WHACK_CHECKPOINT_INTERVAL, WHACK_HOLES, WHACK_INPUT_TAP, WHACK_MAX_UP,
  WHACK_MIN_PERIOD_TICKS, WHACK_RUN_TICKS, WHACK_STATUS_UP,
} from "@/lib/arcade/whack";
import { encodeWhackRun, replayWhackRun } from "@/lib/duel/whack";
import { gradeAnswer } from "@/lib/duel/generate.server";

const RUNS = Number(process.argv[2] ?? 200);
let failures = 0;
const fail = (m: string) => { failures += 1; console.error("FAIL", m); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

if (whackLife(0) !== 54 || whackLife(WHACK_RUN_TICKS) !== 27) fail("life window");
if (whackScore(40, 0, 40) !== 150 || whackScore(40, 1, 40) !== 130 || whackScore(20, 0, 40) !== 68 || whackScore(0, 2, 40) !== 0) fail("score");

let slowest = 0, minT = 1e9, maxT = 0, pops = 0, bombs = 0;
for (let run = 0; run < RUNS; run++) {
  const seed = (run * 2654435761 + 97) | 0;
  let rng = seed ^ 0x4f1bbcdc;
  const draw = (b: number) => { const r = rngBelow(rng, b); rng = r.state; return r.value; };
  const s0 = whackGame.init(seed).schedule;
  if (!same(s0, whackGame.init(seed).schedule)) fail(`run ${run}: not deterministic`);
  const f = s0.flips;
  if (f.length < 3 || f.length > 5) fail(`run ${run}: flips ${f.length}`);
  [0, ...f].forEach((v, i, a) => { if (i && v - a[i - 1]! < WHACK_MIN_PERIOD_TICKS) fail(`run ${run}: short period`); });
  if (f[f.length - 1]! > WHACK_RUN_TICKS - 300) fail(`run ${run}: late flip`);
  let total = 0;
  for (let i = 0; i < s0.at.length; i++) {
    const t = s0.at[i]!, rule = whackRule(f, t);
    if (s0.kind[i] === rule) { total++; if (t >= WHACK_RUN_TICKS - 60) fail(`run ${run}: tail target`); }
    if (s0.kind[i] === WHACK_BOMB) { bombs++; if (t < 300) fail(`run ${run}: early bomb`); }
    if (f.some((x) => t < x && t + s0.life[i]! > x)) fail(`run ${run}: straddles flip`);
    if (i && s0.hole[i] === s0.hole[i - 1]) fail(`run ${run}: same hole twice`);
    let up = 0;
    for (let j = 0; j <= i; j++) if (s0.at[j]! + s0.life[j]! > t) up++;
    if (up > WHACK_MAX_UP) fail(`run ${run}: ${up} up`);
  }
  pops += s0.at.length;
  if (total !== s0.total) fail(`run ${run}: total`);
  minT = Math.min(minT, total); maxT = Math.max(maxT, total);

  let bot = whackGame.init(seed);
  while (!whackGame.isOver(bot)) {
    const t = bot.tick + 1;
    const i = bot.status.findIndex((st, j) => st === WHACK_STATUS_UP && bot.schedule.kind[j] === whackRule(f, bot.schedule.at[j]!) && bot.schedule.at[j]! + bot.schedule.life[j]! > t);
    bot = whackGame.step(bot, i >= 0 ? { t, k: WHACK_INPUT_TAP, a: bot.schedule.hole[i]!, b: 0, c: 0, d: 0 } : null);
  }
  if (bot.hits !== total || whackGame.score(bot) !== 150) fail(`run ${run}: perfect bot ${bot.hits}/${total}`);

  let state = whackGame.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: ReturnType<typeof whackCheckpoint>[] = [];
  while (!whackGame.isOver(state)) {
    const t = state.tick + 1;
    let c: ArcadeInputEvent | null = null;
    if (draw(100) < 30) {
      const live = state.status.map((st, i) => ({ st, i })).filter(({ st }) => st === WHACK_STATUS_UP);
      const ch = live.length > 0 && draw(100) < 85 ? live[draw(live.length)]?.i : undefined;
      c = { t, k: WHACK_INPUT_TAP, a: ch === undefined ? draw(WHACK_HOLES) : state.schedule.hole[ch]!, b: 0, c: 0, d: 0 };
    }
    recordInput(events, c, whackGame.inputRanges);
    state = whackGame.step(state, inputAt(events, t));
    if (state.tick % WHACK_CHECKPOINT_INTERVAL === 0) checkpoints.push(whackCheckpoint(state));
  }
  const score = whackGame.score(state);
  const raw = appendClientCounters(encodeWhackRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints }), arcadeCounters("whack", state, score));
  const t0 = performance.now();
  const replay = replayWhackRun(seed, raw);
  slowest = Math.max(slowest, performance.now() - t0);
  const graded = gradeAnswer({ type: "whack", seed }, raw, 0);
  if (!same(replay.state, state) || replay.score !== score || graded.score !== score || replay.flagged || replay.desyncTick !== null) fail(`run ${run}: replay mismatch ${replay.reason ?? ""}`);
}
console.log(`whack self-replay ${RUNS}/${RUNS}; targets ${minT}-${maxT}; avg pops ${(pops / RUNS).toFixed(1)}; bombs ${(100 * bombs / pops).toFixed(1)}%; slowest ${slowest.toFixed(1)}ms`);
console.log(failures ? `${failures} FAILURES` : "ALL OK");
process.exit(failures ? 1 : 0);
