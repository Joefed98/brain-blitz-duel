/** Whack-a-Target queue checks and client/server identity proof only. */
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { inputAt, recordInput, rngBelow, type ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  whackCheckpoint,
  whackGame,
  whackRule,
  whackScore,
  WHACK_CHECKPOINT_INTERVAL,
  WHACK_DECOY_LIFETIME_TICKS,
  WHACK_TARGETS,
  WHACK_FLIP_TICKS,
  WHACK_GOLD,
  WHACK_HOLES,
  WHACK_INPUT_TAP,
  WHACK_QUEUE_SIZE,
  WHACK_RED,
  WHACK_POP_LIFETIME_TICKS,
  WHACK_STATUS_RETIRED,
  WHACK_STATUS_UP,
} from "@/lib/arcade/whack";
import { encodeWhackRun, replayWhackRun } from "@/lib/duel/whack";
import { gradeAnswer } from "@/lib/duel/generate.server";

const RUNS = Number(process.argv[2] ?? 200);
let failures = 0;
const fail = (message: string) => {
  failures += 1;
  console.error("FAIL", message);
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

if (whackRule(WHACK_FLIP_TICKS[0] - 1) !== WHACK_GOLD) fail("rule before first flip");
if (whackRule(WHACK_FLIP_TICKS[0]) !== WHACK_RED) fail("rule at first flip");
if (whackRule(WHACK_FLIP_TICKS[1]) !== WHACK_GOLD) fail("rule at second flip");
if (whackScore(45, 0) !== 150 || whackScore(45, 1) !== 130 || whackScore(44, 0) !== 132 || whackScore(0, 1) !== 0) fail("score boundaries");

let slowest = 0;
let maxFed = 0;
for (let run = 0; run < RUNS; run++) {
  const seed = (run * 2654435761 + 97) | 0;
  let rng = seed ^ 0x4f1bbcdc;
  const draw = (bound: number) => {
    const result = rngBelow(rng, bound);
    rng = result.state;
    return result.value;
  };
  let state = whackGame.init(seed);
  const sameSeed = whackGame.init(seed);
  if (state.schedule.kind.length !== WHACK_QUEUE_SIZE) fail(`run ${run}: queue length`);
  if (!same(state.schedule, sameSeed.schedule)) fail(`run ${run}: queue not deterministic`);
  if (state.schedule.kind.some((kind) => kind !== WHACK_GOLD && kind !== WHACK_RED)) fail(`run ${run}: invalid colour`);

  if (state.next !== 0 || state.status.some((status) => status === WHACK_STATUS_UP)) fail(`run ${run}: balls started up`);
  const targets = state.schedule.kind.filter((k, i) => k === whackRule(state.schedule.at[i]!)).length;
  const goldTargets = state.schedule.kind.filter((k, i) => k === WHACK_GOLD && whackRule(state.schedule.at[i]!) === WHACK_GOLD).length;
  if (targets !== WHACK_TARGETS || goldTargets !== 27) fail(`run ${run}: target counts ${targets}/${goldTargets}`);
  // Idle run: every ball pops on its tick, targets live 3 s, decoys 1.5 s, nothing changes role while up.
  let idle = whackGame.init(seed);
  while (!whackGame.isOver(idle)) {
    idle = whackGame.step(idle, null);
    for (let i = 0; i < idle.next; i++) {
      if (idle.status[i] !== WHACK_STATUS_UP) continue;
      const target = idle.schedule.kind[i] === whackRule(idle.spawn[i]!);
      if (idle.schedule.kind[i] !== whackRule(idle.tick) && target) fail(`run ${run}: ball ${i} changed role while up`);
    }
  }
  for (let i = 0; i < WHACK_QUEUE_SIZE; i++) {
    if (idle.spawn[i] !== idle.schedule.at[i]) { fail(`run ${run}: ball ${i} popped late`); break; }
    const life = idle.doneTick[i]! - idle.spawn[i]!;
    const target = idle.schedule.kind[i] === whackRule(idle.spawn[i]!);
    const cutAtFlip = target && WHACK_FLIP_TICKS.includes(idle.doneTick[i]!) && life >= WHACK_DECOY_LIFETIME_TICKS && life < WHACK_POP_LIFETIME_TICKS;
    if (idle.status[i] !== WHACK_STATUS_RETIRED || (!cutAtFlip && life !== (target ? WHACK_POP_LIFETIME_TICKS : WHACK_DECOY_LIFETIME_TICKS))) { fail(`run ${run}: ball ${i} lifetime ${life}`); break; }
  }
  // Perfect bot: whacks every target on its first tick, never a decoy.
  let bot = whackGame.init(seed);
  while (!whackGame.isOver(bot)) {
    const t = bot.tick + 1;
    const i = bot.status.findIndex((st, j) => st === WHACK_STATUS_UP && bot.spawn[j]! < t && bot.schedule.kind[j] === whackRule(t));
    bot = whackGame.step(bot, i >= 0 ? { t, k: WHACK_INPUT_TAP, a: bot.hole[i]!, b: 0, c: 0, d: 0 } : null);
  }
  if (bot.hits !== WHACK_TARGETS || whackGame.score(bot) !== 150) fail(`run ${run}: perfect bot ${bot.hits}`);

  state = whackGame.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: ReturnType<typeof whackCheckpoint>[] = [];
  while (!whackGame.isOver(state)) {
    const t = state.tick + 1;
    let candidate: ArcadeInputEvent | null = null;
    if (draw(100) < 36) {
      const live = state.status
        .map((status, i) => ({ status, i }))
        .filter(({ status }) => status === WHACK_STATUS_UP);
      const chosen = live.length > 0 && draw(100) < 85 ? live[draw(live.length)]?.i : undefined;
      const hole = chosen === undefined ? draw(WHACK_HOLES) : state.hole[chosen] ?? 0;
      candidate = { t, k: WHACK_INPUT_TAP, a: hole, b: 0, c: 0, d: 0 };
    }
    recordInput(events, candidate, whackGame.inputRanges);
    state = whackGame.step(state, inputAt(events, t));
    if (state.tick % WHACK_CHECKPOINT_INTERVAL === 0) checkpoints.push(whackCheckpoint(state));
  }
  maxFed = Math.max(maxFed, state.next);
  const score = whackGame.score(state);
  const raw = appendClientCounters(
    encodeWhackRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints }),
    arcadeCounters("whack", state, score),
  );
  const started = performance.now();
  const replay = replayWhackRun(seed, raw);
  slowest = Math.max(slowest, performance.now() - started);
  const graded = gradeAnswer({ type: "whack", seed }, raw, 0);
  if (!same(replay.state, state) || replay.score !== score || graded.score !== score || replay.flagged || replay.desyncTick !== null) {
    fail(`run ${run}: replay mismatch ${replay.reason ?? ""}`);
  }
}
console.log(`whack self-replay ${RUNS}/${RUNS}; queue ${WHACK_QUEUE_SIZE}; max fed ${maxFed}; slowest ${slowest.toFixed(1)}ms`);
console.log(failures ? `${failures} FAILURES` : "ALL OK");
process.exit(failures ? 1 : 0);
