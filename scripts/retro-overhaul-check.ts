/**
 * retro-overhaul-check (15 Nov 2026, the Retro overhaul, phase 2 step 4; docs/design/game-reviews/retro.md,
 * docs/design/retro-overhaul.md): the Retro games' new stamps and shared look rules.
 *
 *  Tempo beatRev 12 (a missed note scores 0 rather than −2):
 *   1. wiring: rooms deal beatRev 12, preRetro deals beatRev 11, the help reads beatRev 12's spec, playRevOf maps 12
 *      to beatRev 11's play; beatRev 12's init is beatRev 11's plus `floor: 1`;
 *   2. play unchanged: the skill-band bots' logs at every level give the same judgements, counters and every
 *      checkpoint checksum on beatRev 11 and 12;
 *   3. never lower: the same log scores at least as much on beatRev 12, and exactly as much with no miss;
 *   4. a miss-heavy run earns its hits (a third of the notes Perfect is 333 of 1,000, not 0);
 *   5. the server replay (replayBeatRun on beatRev 12) scores every bot run to its sim score, unflagged, 1–200, and a
 *      flawless run still reaches 200; the 120 s rule holds (the song is 75 s).
 *  The shared Retro HUD: every count it draws is at least 11 px (retroHudFloorPx).
 *
 *   bun scripts/retro-overhaul-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { bot as beatBot } from "./arcade-skill-bands/bots/beat";
import { playRevOf } from "./scoring-targets-revs";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { pinPreRetro } from "../src/lib/duel/arcade.server";
import { replayBeatRun } from "../src/lib/duel/beat";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { ARCADE_STANDARD } from "../src/lib/arcade/standard";
import { TICKS_PER_SECOND } from "../src/lib/arcade/engine";
import {
  beatAccuracy,
  beatCheckpoint,
  beatGameFor,
  beatStdParts,
  BEAT_REV_FLOOR,
  BEAT_REV_STD,
  BEAT_STD_SPEC_V12,
  type BeatState,
} from "../src/lib/arcade/beat";
import { RETRO_HUD_MIN_PX, retroHudFloorPx } from "../src/lib/arcade/retro.renderer";

let checks = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
};

const LEVELS = ["weak", "average", "good", "great", "near", "elite", "perfect"] as const;

/* ============================ Tempo beatRev 12 ============================ */
{
  // 1. Wiring.
  ok((generatePuzzle("beat") as any).beatRev === BEAT_REV_FLOOR && BEAT_REV_FLOOR === BEAT_REV_STD + 1, "beat: rooms deal beatRev 12");
  pinPreRetro(true);
  ok((generatePuzzle("beat") as any).beatRev === BEAT_REV_STD, "beat: preRetro deals beatRev 11");
  pinPreRetro(false);
  ok((generatePuzzle("beat") as any).beatRev === BEAT_REV_FLOOR, "beat: unpinned again, rooms deal beatRev 12");
  ok(LIVE_BANDS.beat.rev === BEAT_REV_FLOOR && LIVE_BANDS.beat.std === BEAT_STD_SPEC_V12 && ARCADE_STANDARD.beat.spec === BEAT_STD_SPEC_V12, "beat: the help and the reveal read beatRev 12's spec");
  ok(/missed note scores nothing/.test(BEAT_STD_SPEC_V12.parts[0]!.how), "beat: the help says a missed note scores nothing");
  ok(playRevOf("beat", BEAT_REV_FLOOR) === playRevOf("beat", BEAT_REV_STD), "beat: playRevOf maps beatRev 12 to beatRev 11's play");
  const g11 = beatGameFor(BEAT_REV_STD);
  const g12 = beatGameFor(BEAT_REV_FLOOR);
  ok(g12.runTicks === g11.runTicks && g12.inputRanges === g11.inputRanges, "beat: beatRev 12 keeps beatRev 11's song and inputs");
  ok(g12.runTicks <= 120 * TICKS_PER_SECOND, `beat: the run is at most 120 s (${g12.runTicks / TICKS_PER_SECOND} s)`);
  for (const seed of [1, 77, 4242, 99991]) {
    const { floor, ...rest } = g12.init(seed) as BeatState;
    ok(floor === 1 && JSON.stringify(rest) === JSON.stringify(g11.init(seed)), `beat seed ${seed}: beatRev 12's init is beatRev 11's plus floor: 1`);
  }

  // 2–5. Bot runs.
  const spec = GAME_BY_TYPE.get("beat" as never)!;
  const replayOn = (rev: number, seed: number, events: any[]) => {
    const game = beatGameFor(rev);
    const by = new Map(events.map((e: any) => [e.t, e]));
    let s = game.init(seed) as BeatState;
    const sums: number[] = [];
    while (!game.isOver(s)) {
      s = game.step(s, by.get(s.tick + 1) ?? null) as BeatState;
      if (s.tick % 300 === 0) sums.push(beatCheckpoint(s).checksum);
    }
    return { state: s, sums, score: game.score(s), checkpoints: [] as unknown[] };
  };
  let top = 0;
  let missRuns = 0;
  for (const level of LEVELS)
    for (let n = 0; n < 4; n++) {
      const seed = spec.seedFor(n);
      const tag = `beat ${level} seed ${seed}`;
      const game = spec.gameFor(BEAT_REV_FLOOR, seed);
      const out = beatBot({ game, seed, rev: BEAT_REV_FLOOR, human: new Human("beat", seed, level as never), fixes: true });
      const events = out.events ?? [];
      const a = replayOn(BEAT_REV_STD, seed, events);
      const b = replayOn(BEAT_REV_FLOOR, seed, events);
      ok(JSON.stringify(a.sums) === JSON.stringify(b.sums), `${tag}: every checkpoint checksum the same on beatRev 11 and 12`);
      ok(JSON.stringify([a.state.judged, a.state.perfect, a.state.good, a.state.ok, a.state.misses, a.state.fevers, a.state.maxStreak]) === JSON.stringify([b.state.judged, b.state.perfect, b.state.good, b.state.ok, b.state.misses, b.state.fevers, b.state.maxStreak]), `${tag}: the same judgements on both stamps`);
      ok(b.score >= a.score, `${tag}: beatRev 12 never scores less (${a.score} → ${b.score})`);
      if (b.state.misses === 0) ok(b.score === a.score, `${tag}: with no miss the score is unchanged`);
      else {
        missRuns++;
        ok(beatAccuracy(b.state) > beatAccuracy(a.state) || beatAccuracy(a.state) === beatAccuracy({ ...a.state, misses: 0 }), `${tag}: misses no longer take accuracy away`);
      }
      const checkpoints: unknown[] = [];
      {
        const by = new Map(events.map((e: any) => [e.t, e]));
        let s = game.init(seed);
        while (!game.isOver(s)) {
          s = game.step(s, by.get(s.tick + 1) ?? null);
          if (s.tick % 300 === 0) checkpoints.push(spec.checkpoint(s));
        }
      }
      const raw = spec.encode({ seed, claimedScore: b.score, events, endTick: b.state.tick, checkpoints }, BEAT_REV_FLOOR, seed);
      const res = replayBeatRun(seed, raw, BEAT_REV_FLOOR);
      ok(!res.flagged && res.score === b.score, `${tag}: replays through the server to ${b.score} (got ${res.score}${res.flagged ? ", flagged" : ""})`);
      if (events.length) ok(res.score >= 1 && res.score <= 200, `${tag}: a played run scores 1–200 (${res.score})`);
      top = Math.max(top, res.score);
    }
  ok(missRuns >= 8, `beat: misses compared on ${missRuns} runs`);
  ok(top >= 195, `beat: a flawless run still reaches ${top}`);

  // 4. A miss-heavy run earns its hits.
  const s = g12.init(4242) as BeatState;
  const n = s.chart.ticks.length;
  const third = Math.floor(n / 3);
  const heavy = { ...s, tick: g12.runTicks, acted: 1, perfect: third, good: 0, ok: 0, misses: n - third } as BeatState;
  const acc = beatAccuracy(heavy);
  ok(acc === Math.floor((1000 * 4 * third) / (4 * n)) && acc >= 330, `beat: a third of the notes Perfect is ${acc} of 1,000 on beatRev 12`);
  ok(beatAccuracy({ ...heavy, floor: undefined }) === 0, "beat: the same run scored 0 accuracy on beatRev 11");
  ok((beatStdParts(heavy)?.[0]?.points ?? 0) >= 40, "beat: its accuracy points are real (≥ 40 of 130)");
}

/* ============================ The shared Retro HUD ============================ */
{
  ok(RETRO_HUD_MIN_PX === 11, `the Retro HUD's smallest count is 11 px (${RETRO_HUD_MIN_PX})`);
  for (const want of [6, 8, 10, 11, 14, 20]) {
    const got = retroHudFloorPx(want);
    ok(got >= 11 && got >= Math.min(want, 11) && (want < 11 || got === want), `retroHudFloorPx(${want}) = ${got}, never under 11`);
  }
}

if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL retro-overhaul-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS retro-overhaul-check: ${checks} checks (Tempo beatRev 12 plays as beatRev 11, never scores less; the Retro HUD floor)`);
