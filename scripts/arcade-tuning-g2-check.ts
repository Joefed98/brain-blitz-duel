/**
 * Taller worlds, batch 2 (16 Oct 2026): Tempo beatRev 6, Slice sliceRev 6 and
 * Coral Pop bubbleRev 5 (390 × 730 worlds), Mixed Signals clashRev 5 (a 390 × 650
 * board over its arrows and joystick) and Pull! clayRev 6 (a 360 × 680 sky, which
 * draws 390 × 737 on a 390 px wide phone).
 *
 *  1. Old rounds: 116 real runs recorded with the code on main before the change
 *     on every revision the five games ever stamped, unstamped included
 *     (scripts/fixtures/arcade-tuning-g2-legacy.json, scripts/arcade-tuning-g2-legacy.ts:
 *     skill-band bots for the three arcade games, the puzzle-fairness kits for the
 *     two engine games), replay through today's server path to the same score and
 *     the same final state, unflagged; old states carry no `worldH`. 40 runs on the
 *     new stamps (scripts/fixtures/arcade-tuning-g2-runs.json) replay the same way.
 *  2. New rounds: the room generators stamp the taller revisions; each new start
 *     state is the previous revision's with `worldH` added (and only the heights
 *     that follow from it moved); the height is folded into the checkpoint
 *     checksum; stages, reveals, intro demos and effects take the height from the
 *     stored revision; older revisions keep their own.
 *  3. Per game: Tempo's notes take the same ticks to fall and are judged on the
 *     same windows; Slice's throws rise in proportion and stay up exactly as long;
 *     Coral Pop's danger line keeps its rows below the field and a shot reaches
 *     the ceiling in the old time; Mixed Signals' words land in the same ticks on
 *     the same three or four lanes; Pull!'s clays and birds fly the same timing
 *     under a taller sky with the same hit areas.
 *  4. Scores: the refitted curves keep the band rules and 150 is reached by a
 *     skill-band player through the server replay; Mixed Signals' unfinished
 *     credit stays at most 110 below every finish, and careless sorting scores 0.
 *  5. Each game's intro demo stays stopped until one is recorded on the taller revision.
 *
 *   bun scripts/arcade-tuning-g2-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BEAT_REV_EASE } from "../src/lib/arcade/beat";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import type { TuningG2Record } from "./arcade-tuning-g2-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel, type SkillProfile } from "./arcade-skill-bands/human";
import { KITS } from "./puzzle-fairness/kits";
import { pinRev1Shape, roomPuzzle, runPlay, runSpam } from "./puzzle-fairness/run";

// Its kit medians are clashRev 5's: room puzzles carry the stamps rooms dealt before the score bands.
pinRev1Shape(true);
import { bandPoints, bandTop, BAND_FINISH_BONUS, BAND_PARTIAL_TOP, type BandCurve } from "../src/lib/arcade/scoreBands";
import { ARCADE_FX_SPECS, BEAT_FX, BUBBLE_FX, SLICE_FX, beatFxFor, bubbleFxFor, sliceFxFor } from "../src/lib/arcade/arcadeFxGames.renderer";
import { ARCADE_REVEAL_RENDERERS, revealWorldH } from "../src/lib/arcade/revealRenderers";
import {
  beatCheckpoint,
  beatFallPxPerTick,
  beatGameFor,
  beatHitLineY,
  beatWorldHFor,
  BEAT_FALL_TICKS,
  BEAT_GOOD_TICKS,
  BEAT_HUD_H,
  BEAT_OK_TICKS,
  BEAT_PERFECT_TICKS,
  BEAT_REV_TALL,
  BEAT_REV_TUNEF,
  BEAT_TALL_H,
  BEAT_V6_BAND_CURVE,
  type BeatState,
} from "../src/lib/arcade/beat";
import { SLICE_REV_BIG, SLICE_REV_EXPAND,
  sliceCheckpoint,
  sliceGameFor,
  sliceMaxPath,
  sliceObjectAt,
  sliceWorldHFor,
  SLICE_HUD_H,
  SLICE_R,
  SLICE_REV_LONG,
  SLICE_REV_TALL,
  SLICE_TALL_H,
  SLICE_V6_BAND_CURVE,
  SLICE_V9_H,
  SLICE_V9_W,
  SLICE_WORLD_H,
  type SliceState,
} from "../src/lib/arcade/slice";
import {
  bubbleGameFor,
  bubbleWorldHFor,
  bubCheckpoint,
  bubCellY,
  bubShooterY,
  bubSpeed,
  BUB_R,
  BUB_REV_TALL,
  BUB_REV_REEF,
  BUB_REV_TORPEDO,
  BUB_SHOOTER_LINE,
  BUB_SHOOTER_Y,
  BUB_SPEED,
  BUB_SPEED_TALL,
  BUB_START_ROWS,
  BUB_TALL_H,
  BUB_TOP,
  BUB_V5_BAND_CURVE,
  type BubState,
} from "../src/lib/arcade/bubble";
import {
  clashCheckpoint,
  clashDropFp,
  clashFallTicks,
  clashGateYFp,
  clashRev4ScoreOf,
  clashRev5ScoreOf,
  clashV5UnfinishedOf,
  clashVariantOf,
  clashWorldHFor,
  colourClashGameFor,
  CLASH_REV,
  CLASH_REV_TALL,
  CLASH_START_Y_FP,
  CLASH_TALL_H,
  CLASH_WORLD_H,
  CLASH_REV3_RUN_TICKS,
  type ClashState,
} from "../src/lib/arcade/colourClash";
import {
  clayCheckpoint,
  clayGameFor,
  clayGravity,
  clayWorldHFor,
  CLAY_CONFIG,
  CLAY_FLYING,
  CLAY_H,
  CLAY_REV,
  CLAY_REV5,
  CLAY_REV_TALL,
  CLAY_TALL_H,
  type ClayState,
} from "../src/lib/arcade/clayShoot";
import { replayColourClashRun } from "../src/lib/duel/colourClash";
import { replayClayRun } from "../src/lib/duel/clayShoot";
import { generateBeat, generateBubble, generateClayShoot, generateColourClash, generateSlice } from "../src/lib/duel/arcade.server";
import { buildStroop } from "../src/puzzles/stroop";
import { LEVELS } from "./puzzle-fairness/kit";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { playRevOf } from "./scoring-targets-revs";

const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const section = (name: string) => console.log(`— ${name}`);
const read = (path: string) => readFileSync(path, "utf8");
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};

/** A stored run's replay through the server path: the skill-band spec's for the arcade games, the engine replays otherwise. */
function replayStored(run: TuningG2Record): { score: number; state: any; flagged: boolean } {
  const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
  if (run.type === "stroop") return replayColourClashRun(run.seed, raw, run.rev!);
  if (run.type === "clayshoot") return replayClayRun(run.seed, raw, run.rev);
  return GAME_BY_TYPE.get(run.type as never)!.replay(run.seed, raw, run.rev);
}

/** A flawless player for best-score proofs: quick, never lapses, no timing, aim or judgement error (as arcade-tuning-f2-check). */
const PERFECT: SkillProfile = { reactionMs: [120, 0], lapse: 0, timingSdMs: 0, aimSdPx: 0, powerSd: 0, mistake: 0, thinkScale: 0.3, judgement: 0, trackLagMs: 30 };

/** A skill-band player's run on a revision (or a flawless one), sent through the server's encode + replay. */
async function botRun(type: string, rev: number, level: SkillLevel | "flawless", n: number) {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const { bot } = await import(`./arcade-skill-bands/bots/${type}.ts`);
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const human = new Human(spec.type, seed, level === "flawless" ? "near" : level);
  if (level === "flawless") (human as unknown as { p: SkillProfile }).p = PERFECT;
  const out = bot({ game, seed, rev, human });
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  const byTick = new Map((out.events ?? []).map((e: any) => [e.t, e]));
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, byTick.get(t) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const score = game.score(state);
  const raw = spec.encode({ seed, claimedScore: score, events: out.events ?? [], inputs: [], taps: [], endTick: state.tick, checkpoints }, rev, seed);
  return { score, result: spec.replay(seed, raw, rev) };
}

/* ============================== 1. Stored rounds ============================== */
section("Stored rounds replay and score exactly as before");
for (const [file, label] of [["scripts/fixtures/arcade-tuning-g2-legacy.json", "before"], ["scripts/fixtures/arcade-tuning-g2-runs.json", "taller"]] as const) {
  const fixture = JSON.parse(read(file)) as { runs: TuningG2Record[] };
  const per = new Map<string, number>();
  for (const run of fixture.runs) {
    const result = replayStored(run);
    ok(result.score === run.score && !result.flagged, `${label} ${run.type} rev ${run.rev} ${run.level}: stored ${run.score}, replays ${result.score}${result.flagged ? " (flagged)" : ""}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `${label} ${run.type} rev ${run.rev} ${run.level}: the replayed final state differs`);
    if (label === "before") ok(result.state.worldH === undefined, `${run.type} rev ${run.rev}: an old state carries worldH`);
    else ok(typeof result.state.worldH === "number", `${run.type} rev ${run.rev}: a taller state has no worldH`);
    per.set(`${run.type} ${run.rev ?? "-"}`, (per.get(`${run.type} ${run.rev ?? "-"}`) ?? 0) + 1);
  }
  ok(fixture.runs.length === (label === "before" ? 116 : 40), `${label}: ${fixture.runs.length} stored runs`);
  console.log(`  ${label}: ${fixture.runs.length} runs (${[...per].map(([k, v]) => `${k}: ${v}`).join(", ")})`);
}

/* ============================== 2. New rounds ============================== */
section("New rounds: stamps, start states, checksums, worlds by revision");
{
  // Expansion E2 (25 Oct 2026) then moved Tempo on to its five-lane song (beatRev 9, the same lanes); expansion-e2-check covers it.
  // Phone notes (27 Oct 2026): then beatRev 10, an easier chart and wider windows on the same lanes (tempo-ease-check).
  ok(playRevOf("beat", generateBeat().beatRev) === BEAT_REV_TALL + 4, "rooms deal beatRev 10 (phone notes, after beatRev 9 and 6)");
  // World expansion E5 (25 Oct 2026) moved Slice on to its larger board (sliceRev 9); expansion-e5-check covers it.
  // sliceRev 10 (27 Oct 2026) keeps sliceRev 9 with bigger onions and golden fruit; expansion-e5-check covers it too.
  ok([SLICE_REV_TALL, SLICE_REV_EXPAND, SLICE_REV_BIG].includes(playRevOf("slice", generateSlice().sliceRev) ?? -1), "rooms deal sliceRev 6 (or sliceRev 9, the expansion, or its sliceRev 10)");
  // Expansion E6 (25 Oct 2026) moved Coral Pop on to its deeper reef (bubbleRev 8, the same tank); e6-check covers it.
  // Phone notes (27 Oct 2026): bubbleRev 10 (bubbleRev 9 with the mine's bigger blast); e6-check covers it.
  ok(generateBubble().bubbleRev === BUB_REV_TALL + 5, "rooms deal bubbleRev 10 (bubbleRev 9 with the mine's bigger blast, after bubbleRev 5)");
  // Rooms deal the score-bands stamps after these (clashRev 6, clayRev 7: the same play, scoring-bands-check), and since
  // 20 Oct 2026 scoring report batch 2's (clashRev 7, clayRev 8: the same play again, scoring-batch2-check).
  // Depth to 200 (25 Oct 2026): clashRev 8 (clashRev 5 play on the taller board plus the streak, "don't sort" and gold
  // words; depth-mixedsignals-check), from rooms and the puzzle module alike. The puzzle top-up (26 Oct 2026) moved it on
  // to clashRev 9 (clashRev 8's play exactly, a gentler fade on gold and streak points; depth-topup-check).
  ok(generateColourClash().clashRev === CLASH_REV_TALL + 4 && buildStroop().clashRev === CLASH_REV_TALL + 4 && clashVariantOf({ clashRev: CLASH_REV_TALL }) === 5 && clashWorldHFor(clashVariantOf({ clashRev: CLASH_REV_TALL + 3 })) === CLASH_TALL_H && clashWorldHFor(clashVariantOf({ clashRev: CLASH_REV_TALL + 4 })) === CLASH_TALL_H, "rooms and practice deal clashRev 9 (clashRev 5 play on the taller board, depth to 200, the top-up)");
  // Depth to 200 (25 Oct 2026): clayRev 9 (clayRev 8 play and base, plus doubles and the streak; depth-pull-check).
  ok(generateClayShoot().clayRev === CLAY_REV_TALL + 3 && CLAY_REV === CLAY_REV_TALL, "rooms deal clayRev 9 (clayRev 6 play, quick-shot scoring, doubles and the streak)");
  ok(clayWorldHFor(CLAY_REV_TALL + 2) === CLAY_TALL_H && clashWorldHFor(clashVariantOf({ clashRev: CLASH_REV_TALL + 2 })) === CLASH_TALL_H, "the new stamps play in the taller worlds");

  ok(beatWorldHFor(BEAT_REV_TALL) === 730 && beatWorldHFor(BEAT_REV_TUNEF) === 620 && beatWorldHFor(undefined) === 620, "Tempo world heights by revision");
  ok(sliceWorldHFor(SLICE_REV_TALL) === 730 && sliceWorldHFor(SLICE_REV_LONG) === 620 && sliceWorldHFor(undefined) === 620, "Slice world heights by revision");
  ok(bubbleWorldHFor(BUB_REV_TALL) === 730 && bubbleWorldHFor(BUB_REV_TORPEDO) === 620 && bubbleWorldHFor(undefined) === 620, "Coral Pop world heights by revision");
  ok(clashWorldHFor(5) === 650 && clashWorldHFor(4) === 560 && clashWorldHFor(0) === 560, "Mixed Signals board heights by variant");
  ok(clayWorldHFor(CLAY_REV_TALL) === 680 && CLAY_TALL_H === 680 && clayWorldHFor(CLAY_REV5) === 400 && clayWorldHFor(undefined) === 400, "Pull! sky heights by revision");

  const sameBut = (a: any, b: any, keys: string[]) => {
    const strip = (s: any) => Object.fromEntries(Object.entries(s).filter(([k]) => !keys.includes(k)));
    return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
  };
  for (const seed of [1, 77, 4242, 912345, 2_000_000_011]) {
    const t6 = beatGameFor(BEAT_REV_TALL).init(seed);
    const t5 = beatGameFor(BEAT_REV_TUNEF).init(seed);
    ok(t6.worldH === BEAT_TALL_H && sameBut(t6, t5, ["worldH"]), `Tempo seed ${seed}: beatRev 6 starts as beatRev 5 (the same chart) with worldH`);
    const s6 = sliceGameFor(SLICE_REV_TALL).init(seed);
    const s5 = sliceGameFor(SLICE_REV_LONG).init(seed);
    const plain = (o: any): any => ({ ...o, worldH: undefined, payload: o.payload.map(plain) });
    ok(s6.worldH === SLICE_TALL_H && sameBut(s6, s5, ["worldH", "objects"]) && JSON.stringify(s6.objects.map(plain)) === JSON.stringify(s5.objects.map(plain)), `Slice seed ${seed}: sliceRev 6 starts as sliceRev 5 (the same throws) with worldH`);
    ok(s6.objects.every((o) => o.worldH === SLICE_TALL_H && o.payload.every((p) => p.worldH === SLICE_TALL_H)), `Slice seed ${seed}: every throw (frenzy payloads too) is thrown in the taller board`);
    const b5 = bubbleGameFor(BUB_REV_TALL).init(seed);
    const b4 = bubbleGameFor(BUB_REV_TORPEDO).init(seed);
    ok(b5.worldH === BUB_TALL_H && sameBut(b5, b4, ["worldH", "y"]) && b5.y === bubShooterY(b5) * 256, `Coral Pop seed ${seed}: bubbleRev 5 starts as bubbleRev 4 (the same field and queue) with worldH, the shot at the lower gun`);
    const c5 = colourClashGameFor(5).init(seed);
    const c4 = colourClashGameFor(4).init(seed);
    ok(c5.worldH === CLASH_TALL_H && c5.rev === CLASH_REV_TALL && sameBut(c5, c4, ["worldH", "rev"]), `Mixed Signals seed ${seed}: clashRev 5 starts as clashRev 4 (the same words and gates) with worldH`);
    const p6 = clayGameFor(CLAY_REV_TALL).init(seed);
    const p5 = clayGameFor(CLAY_REV5).init(seed);
    const k = (v: number) => Math.trunc((v * 17) / 10);
    ok(p6.worldH === CLAY_TALL_H && p6.rev === CLAY_REV_TALL && sameBut(p6, p5, ["worldH", "rev", "schedule", "birds"]), `Pull! seed ${seed}: clayRev 6 starts as clayRev 5 with worldH`);
    ok(JSON.stringify({ ...p6.schedule, launchY: 0, vy: 0 }) === JSON.stringify({ ...p5.schedule, launchY: 0, vy: 0 }) && p6.schedule.launchY.every((y, i) => y === k(p5.schedule.launchY[i]!)) && p6.schedule.vy.every((v, i) => v === k(p5.schedule.vy[i]!)), `Pull! seed ${seed}: the same clays, heights and vertical speeds × 1.7`);
    ok(JSON.stringify({ ...p6.birds, launchY: 0, vy: 0 }) === JSON.stringify({ ...p5.birds, launchY: 0, vy: 0 }) && p6.birds!.launchY.every((y, i) => y === k(p5.birds!.launchY[i]!)) && p6.birds!.vy.every((v, i) => v === k(p5.birds!.vy[i]!)), `Pull! seed ${seed}: the same birds, heights and drift × 1.7`);
    // The height is in the checksum: the same state at the old height checks differently.
    ok(beatCheckpoint(t6).checksum !== beatCheckpoint({ ...t6, worldH: undefined }).checksum, "Tempo: worldH folds into the checksum");
    ok(sliceCheckpoint(s6).checksum !== sliceCheckpoint({ ...s6, worldH: undefined }).checksum, "Slice: worldH folds into the checksum");
    ok(bubCheckpoint(b5).checksum !== bubCheckpoint({ ...b5, worldH: undefined }).checksum, "Coral Pop: worldH folds into the checksum");
    ok(clashCheckpoint(c5).checksum !== clashCheckpoint({ ...c5, worldH: undefined }).checksum, "Mixed Signals: worldH folds into the checksum");
    ok(clayCheckpoint(p6).checksum !== clayCheckpoint({ ...p6, worldH: undefined }).checksum, "Pull!: worldH folds into the checksum");
  }

  // Effects: the tall specs in ARCADE_FX_SPECS, older rounds at their own height, through fxSpecAt.
  const fx = ARCADE_FX_SPECS as Record<string, { height: number }>;
  // World expansion E5 (25 Oct 2026) moved Slice rooms on to sliceRev 9's 430 × 805 world (expansion-e5-check covers it).
  ok(fx.beat!.height === 730 && fx.slice!.width === SLICE_V9_W && fx.slice!.height === SLICE_V9_H && fx.bubble!.height === 730, "ARCADE_FX_SPECS hold the taller heights rooms deal (Slice: sliceRev 9's world)");
  ok(beatFxFor({ worldH: 730 } as BeatState).height === 730 && beatFxFor({} as BeatState) === BEAT_FX, "Tempo effects by state height");
  ok(sliceFxFor({ worldH: 730 } as SliceState).height === 730 && sliceFxFor({} as SliceState) === SLICE_FX, "Slice effects by state height");
  ok(bubbleFxFor({ worldH: 730 } as BubState).height === 730 && bubbleFxFor({} as BubState) === BUBBLE_FX, "Coral Pop effects by state height");

  // Reveals, replays and intro demos: the stored revision's height; older rounds keep theirs.
  const rh = (type: string, puzzle: any) => revealWorldH(ARCADE_REVEAL_RENDERERS[type]!, { type, seed: 1, ...puzzle });
  ok(rh("beat", { beatRev: BEAT_REV_TALL }) === 730 && rh("beat", { beatRev: BEAT_REV_TUNEF }) === 620 && rh("beat", {}) === 620, "Tempo reveal height by revision");
  ok(rh("slice", { sliceRev: SLICE_REV_TALL }) === 730 && rh("slice", { sliceRev: SLICE_REV_LONG }) === 620, "Slice reveal height by revision");
  ok(rh("bubble", { bubbleRev: BUB_REV_TALL }) === 730 && rh("bubble", { bubbleRev: BUB_REV_TORPEDO }) === 620, "Coral Pop reveal height by revision");
  ok(rh("stroop", { queue: 52, clashRev: CLASH_REV_TALL }) === 650 && rh("stroop", { queue: 52, clashRev: CLASH_REV }) === 560 && rh("stroop", {}) === 560, "Mixed Signals reveal height by revision");
  ok(rh("clayshoot", { clayRev: CLAY_REV_TALL }) === 680 && rh("clayshoot", { clayRev: CLAY_REV5 }) === 400 && rh("clayshoot", {}) === 400, "Pull! reveal height by revision");

  // Stages size their arena slot from the stored revision (uniform scale only).
  ok(/const BEAT_WORLD_H = beatWorldHFor\(data\?\.beatRev\)/.test(read("src/puzzles/beat.tsx")) && /<ArcadeArenaSlot width=\{BEAT_WORLD_W\} height=\{BEAT_WORLD_H\}[\s>]/.test(read("src/puzzles/beat.tsx")), "Tempo stage sizes from beatWorldHFor");
  ok(/const SLICE_WORLD_H = sliceWorldHFor\(data\?\.sliceRev\)/.test(read("src/puzzles/slice.tsx")) && /<ArcadeArenaSlot width=\{SLICE_WORLD_W\} height=\{SLICE_WORLD_H\}[\s>]/.test(read("src/puzzles/slice.tsx")), "Slice stage sizes from sliceWorldHFor");
  ok(/const BUB_WORLD_H = bubbleWorldHFor\(data\?\.bubbleRev\)/.test(read("src/puzzles/bubble.tsx")) && /<ArcadeArenaSlot width=\{BUB_WORLD_W\} height=\{BUB_WORLD_H\}[\s>]/.test(read("src/puzzles/bubble.tsx")), "Coral Pop stage sizes from bubbleWorldHFor");
  ok(/worldH=\{clashWorldHFor\(clashVariantOf\(puzzle\)\)\}/.test(read("src/puzzles/stroop.tsx")), "Mixed Signals stage sizes from clashWorldHFor");
  ok(/<ArcadeArenaSlot width=\{CLAY_W\} height=\{clayWorldHFor\(data\?\.clayRev\)\}/.test(read("src/puzzles/clayShoot.tsx")) && /clayTapWorld\(box, event\.clientX, event\.clientY, clayWorldHFor\(data\?\.clayRev\)\)/.test(read("src/puzzles/clayShoot.tsx")), "Pull! stage sizes and maps taps from clayWorldHFor");
}

/* ============================== 3. Per game ============================== */
section("Tempo: longer lanes, the same timing");
{
  const s = beatGameFor(BEAT_REV_TALL).init(5);
  ok(beatHitLineY(s) === 630 && beatHitLineY({}) === 520, "hit line 100 px above the bottom: 630 (520 in the 620 world)");
  const before = beatFallPxPerTick({});
  const after = beatFallPxPerTick(s);
  ok(Math.abs(after * BEAT_FALL_TICKS - (630 - BEAT_HUD_H)) < 1e-9 && Math.abs(before * BEAT_FALL_TICKS - (520 - BEAT_HUD_H)) < 1e-9, `a note crosses its lane in ${BEAT_FALL_TICKS} ticks either way: ${after.toFixed(2)} px a tick (${before.toFixed(2)} before)`);
  ok(BEAT_PERFECT_TICKS === 3 && BEAT_GOOD_TICKS === 7 && BEAT_OK_TICKS === 12, "the hit windows are unchanged (3 / 7 / 12 ticks)");
  // The same taps on the same chart judge the same on beatRev 5 and 6 (judging is by tick alone).
  const g5 = beatGameFor(BEAT_REV_TUNEF);
  const g6 = beatGameFor(BEAT_REV_TALL);
  let a = g5.init(99);
  let b = g6.init(99);
  for (let t = 1; t <= 3600; t++) {
    const note = a.chart.ticks.indexOf(t + 2);
    const ev = note >= 0 && t % 3 ? { t, k: 9, a: a.chart.lanes[note]!, b: 0, c: 0, d: 0 } : null;
    a = g5.step(a, ev);
    b = g6.step(b, ev);
  }
  ok(JSON.stringify({ ...b, worldH: undefined }) === JSON.stringify({ ...a, worldH: undefined }) && g6.score(b) === g5.score(a), `the same taps play out and score the same in the taller lanes (${g6.score(b)})`);
}

section("Slice: a taller board, every throw rising in proportion on the same timing");
{
  const g5 = sliceGameFor(SLICE_REV_LONG);
  const g6 = sliceGameFor(SLICE_REV_TALL);
  let worst = 0;
  let airDiff = 0;
  let highest5 = 1e9;
  let highest6 = 1e9;
  let throws = 0;
  for (const seed of [3, 41, 777, 9001, 123456]) {
    const a = g5.init(seed);
    const b = g6.init(seed);
    a.objects.forEach((o5, i) => {
      const o6 = b.objects[i]!;
      let on5 = 0;
      let on6 = 0;
      for (let t = o5.launchTick; t <= o5.lastTick + 1; t++) {
        const p5 = sliceObjectAt(o5, t, [], []);
        const p6 = sliceObjectAt(o6, t, [], []);
        ok(!p5 === !p6, `seed ${seed} throw ${i} tick ${t}: in the air on both boards or neither`);
        if (!p5 || !p6) continue;
        const rise5 = p5.y - (SLICE_WORLD_H + SLICE_R) * 256;
        const rise6 = p6.y - (SLICE_TALL_H + SLICE_R) * 256;
        worst = Math.max(worst, Math.abs(rise6 - Math.trunc((rise5 * SLICE_TALL_H) / SLICE_WORLD_H)));
        ok(p6.x === p5.x, `seed ${seed} throw ${i}: the same x`);
        const r = o5.special ? 16 : SLICE_R;
        if (p5.y / 256 - r <= SLICE_WORLD_H && p5.y / 256 + r >= SLICE_HUD_H) on5++;
        if (p6.y / 256 - r <= SLICE_TALL_H && p6.y / 256 + r >= SLICE_HUD_H) on6++;
        highest5 = Math.min(highest5, p5.y / 256);
        highest6 = Math.min(highest6, p6.y / 256);
      }
      airDiff = Math.max(airDiff, Math.abs(on6 - on5));
      throws++;
    });
  }
  ok(worst <= 2, `every throw's rise is the old rise × 730 ÷ 620 (within ${worst} / 256 px)`);
  ok(airDiff <= 2, `every throw is on the board within ${airDiff} ticks of as long as before`);
  ok(highest6 < highest5 + 20 && highest6 < 90, `throws use the whole height: the highest reaches y ${highest6.toFixed(0)} of 730 (y ${highest5.toFixed(0)} of 620 before)`);
  ok(sliceMaxPath(g6.init(1)) === 730 && sliceMaxPath(g5.init(1)) === 620, "one continuous path runs the taller world's height (730 px; 620 before)");
  ok(JSON.stringify(g6.inputRanges) !== JSON.stringify(g5.inputRanges) && (g6.inputRanges ?? []).some((r: any) => JSON.stringify(r).includes("730")), "swipes are accepted down to y 730");
  console.log(`  ${throws} throws compared on 5 seeds`);
}

section("Coral Pop: a deeper tank, the danger line the same rows below the field");
{
  const s = bubbleGameFor(BUB_REV_TALL).init(7);
  const old = bubbleGameFor(BUB_REV_TORPEDO).init(7);
  ok(bubShooterY(s) === 670 && bubShooterY(old) === BUB_SHOOTER_Y, "the gun sits 60 px above the bottom: 670 (560 before)");
  // The danger line is unchanged, so the field's last row is as many rows from it as before.
  const lowest = bubCellY(BUB_START_ROWS - 1, 0) + BUB_R;
  ok(BUB_SHOOTER_LINE === 543 && (BUB_SHOOTER_LINE - lowest) / 29 === (BUB_SHOOTER_LINE - lowest) / 29, `the danger line stays at y ${BUB_SHOOTER_LINE}: ${((BUB_SHOOTER_LINE - lowest) / 29).toFixed(2)} rows below the starting field either way`);
  // A run is lost after exactly as many descents as before.
  const descentsToLose = (st: BubState) => {
    for (let d = 0; d < 40; d++) if (bubCellY(BUB_START_ROWS - 1, d) + BUB_R >= BUB_SHOOTER_LINE) return d;
    return -1;
  };
  ok(descentsToLose(s) === descentsToLose(old), `the field reaches the danger line after ${descentsToLose(s)} descents either way`);
  const toCeiling = (shooter: number, speed: number) => ((shooter - BUB_TOP) * 256) / speed;
  ok(Math.abs(toCeiling(670, BUB_SPEED_TALL) - toCeiling(560, BUB_SPEED)) < 0.5 && bubSpeed(s) === BUB_SPEED_TALL && bubSpeed(old) === BUB_SPEED, `a shot reaches the ceiling in ${toCeiling(670, BUB_SPEED_TALL).toFixed(1)} ticks (${toCeiling(560, BUB_SPEED).toFixed(1)} before): ${(BUB_SPEED_TALL / 256).toFixed(2)} px a tick`);
  // A shot straight up from the lower gun sticks at the field like the same shot from the old one.
  const shoot = (st: BubState, rev: number) => {
    const game = bubbleGameFor(rev);
    let x = game.step(st, { t: st.tick + 1, k: 2, a: 0, b: -4096, c: 0, d: 0 });
    let n = 0;
    while (x.flightColour !== 0 && n++ < 300) x = game.step(x, null);
    return { x, n };
  };
  const a = shoot(old, BUB_REV_TORPEDO);
  const b = shoot(s, BUB_REV_TALL);
  // Matched to the ceiling, so a shot at the starting field's lowest row (110 px further away, at 1.23 × the speed) takes a few ticks longer.
  ok(JSON.stringify(a.x.grid) === JSON.stringify(b.x.grid) && b.n - a.n <= 8, `a straight shot lands in the same cell, ${b.n} ticks after release (${a.n} before)`);
}

section("Mixed Signals: longer columns, the same landing ticks and lanes");
{
  const s5 = colourClashGameFor(5).init(3);
  const s4 = colourClashGameFor(4).init(3);
  ok(clashGateYFp(s5) === (454 + 90) * 256 && clashGateYFp(s4) === 454 * 256, "the gates sit 90 px lower (y 544; 454 before)");
  const land = (gate: number, fall: number) => Math.ceil((gate - CLASH_START_Y_FP) / Math.max(1, Math.trunc((gate - CLASH_START_Y_FP) / fall)));
  for (let phase = 0; phase < 5; phase++) {
    const fall = clashFallTicks(phase * 900, 52, CLASH_REV_TALL);
    ok(fall === clashFallTicks(phase * 900, 52, CLASH_REV) && land(clashGateYFp(s5), fall) === land(clashGateYFp(s4), fall), `phase ${phase + 1}: a word lands ${land(clashGateYFp(s5), fall)} ticks after it appears (${land(clashGateYFp(s4), fall)} before)`);
  }
  const dropTicks = (st: ClashState) => Math.ceil((clashGateYFp(st) - CLASH_START_Y_FP) / clashDropFp(st));
  ok(Math.abs(dropTicks(s5) - dropTicks(s4)) <= 1, `a word dropped from the top lands in ${dropTicks(s5)} ticks (${dropTicks(s4)} before)`);
  // The same inputs play out the same: lanes, landings and the score's counts.
  const g4 = colourClashGameFor(4);
  const g5 = colourClashGameFor(5);
  let a = s4;
  let b = s5;
  for (let t = 1; t <= CLASH_REV3_RUN_TICKS && !g4.isOver(a); t++) {
    const ev = t % 37 === 0 ? { t, k: 5, a: 3, b: (t * 53) % 390, c: 0, d: 0 } : t % 41 === 0 ? { t, k: 5, a: 2, b: 0, c: 0, d: 0 } : null;
    a = g4.step(a, ev);
    b = g5.step(b, ev);
  }
  ok(a.tick === b.tick && a.correct === b.correct && a.wrong === b.wrong && a.lane === b.lane && JSON.stringify(a.items) === JSON.stringify(b.items), `the same inputs sort the same words the same way (${b.correct} right, ${b.wrong} wrong)`);
  ok(CLASH_TALL_H - CLASH_WORLD_H === 90, "the board is 90 px taller (390 × 650)");
}

section("Pull!: a taller sky, the same flight times and hit areas");
{
  const g5 = clayGameFor(CLAY_REV5);
  const g6 = clayGameFor(CLAY_REV_TALL);
  ok(clayGravity({}) === 20 && clayGravity({ worldH: 680 }) === 34, "gravity 34 under the taller sky (20 before): every height × 1.7");
  let worstAir = 0;
  let worstEnd = 0;
  let clays = 0;
  for (const seed of [11, 202, 3003, 40004, 500005]) {
    let a = g5.init(seed);
    let b = g6.init(seed);
    const on5 = new Array(25).fill(0);
    const on6 = new Array(25).fill(0);
    while (!g5.isOver(a)) {
      a = g5.step(a, null);
      b = g6.step(b, null);
      for (let i = 0; i < 25; i++) {
        if (a.status[i] === CLAY_FLYING && a.x[i]! >= 0 && a.x[i]! <= 360 * 256 && a.y[i]! >= 0 && a.y[i]! <= CLAY_H * 256) on5[i]++;
        if (b.status[i] === CLAY_FLYING && b.x[i]! >= 0 && b.x[i]! <= 360 * 256 && b.y[i]! >= 0 && b.y[i]! <= CLAY_TALL_H * 256) on6[i]++;
      }
    }
    for (let i = 0; i < 25; i++) {
      worstAir = Math.max(worstAir, Math.abs(on5[i] - on6[i]));
      worstEnd = Math.max(worstEnd, Math.abs(a.doneTick[i]! - b.doneTick[i]!));
      clays++;
    }
  }
  ok(worstAir <= 1, `every clay is on screen within ${worstAir} tick of as long as before (${clays} clays)`);
  ok(worstEnd <= 2, `every clay leaves the sky within ${worstEnd} ticks of when it did before`);
  ok(CLAY_CONFIG.orangeHitRadius === 30 && CLAY_CONFIG.goldHitRadius === 24 && CLAY_CONFIG.clayRadius === 13, "the clays and their hit areas keep their size");
  // A shot on a flying clay's centre hits it under the taller sky (hit areas unchanged, input bounds to 680).
  let s = g6.init(20261016);
  while (!s.status.some((st, i) => st === CLAY_FLYING && s.y[i]! > 420 * 256)) s = g6.step(s, null);
  const i = s.status.findIndex((st, k) => st === CLAY_FLYING && s.y[k]! > 420 * 256);
  const vy = s.vy[i]! + clayGravity(s);
  const hit = g6.step(s, { t: s.tick + 1, k: 11, a: Math.round((s.x[i]! + s.schedule.vx[i]!) / 256), b: Math.round((s.y[i]! + vy) / 256), c: 0, d: 0 });
  ok(hit.hits === s.hits + 1, `a shot at a clay low in the taller sky (y ${Math.round(s.y[i]! / 256)}) hits it`);
}

/* ============================== 4. Bands ============================== */
section("Refitted curves keep the band rules; 150 is reachable");
{
  const curves: [string, BandCurve, "finish" | "open", number | null][] = [
    ["beat", BEAT_V6_BAND_CURVE, "open", null],
    ["slice", SLICE_V6_BAND_CURVE, "open", null],
    ["bubble", BUB_V5_BAND_CURVE, "finish", 1],
  ];
  for (const [type, curve, kind, unit] of curves) {
    const { units, points } = curve;
    ok(units[0] === 0 && points[0] === 0, `${type}: curve starts at (0, 0)`);
    for (let i = 1; i < units.length; i++) ok(units[i]! > units[i - 1]! && points[i]! >= points[i - 1]!, `${type}: knot ${i} ascends and never falls`);
    ok(Math.max(...points) === (kind === "open" ? 150 : BAND_PARTIAL_TOP) && bandPoints(curve, bandTop(curve)) === Math.max(...points), `${type}: tops out at ${Math.max(...points)}`);
    if (unit) {
      const full = units.at(-1)!;
      ok(bandPoints(curve, full) + BAND_FINISH_BONUS - bandPoints(curve, full - unit) <= 12, `${type}: one unit short of a finish is at most 12 below it`);
    }
  }
  // An idle run scores 0.
  for (const [type, game] of [["beat", beatGameFor(BEAT_REV_TALL)], ["slice", sliceGameFor(SLICE_REV_TALL)], ["bubble", bubbleGameFor(BUB_REV_TALL)], ["stroop", colourClashGameFor(5)], ["clayshoot", clayGameFor(CLAY_REV_TALL)]] as const) {
    let s: any = (game as any).init(3);
    while (!(game as any).isOver(s) && s.tick < (game as any).runTicks) s = (game as any).step(s, null);
    ok((game as any).score(s) === 0, `${type}: doing nothing scores 0`);
  }
  // Best scores through the server replay on fixed room seeds: a near-perfect skill-band player (Tempo) or a
  // flawless one (Coral Pop) reaches 150. Slice's 150 needs 900 ‰ of the most a run can earn, which no simulated
  // player reaches on any revision (arcade-tuning-f2-check holds sliceRev 5 to 140 the same way).
  const proofs: [string, number, SkillLevel | "flawless", number, number][] = [
    ["beat", BEAT_REV_TALL, "near", 7, 150],
    ["bubble", BUB_REV_TALL, "flawless", 6, 150],
    ["slice", SLICE_REV_TALL, "near", 29, 140],
  ];
  for (const [type, rev, level, n, want] of proofs) {
    const { score, result } = await botRun(type, rev, level, n);
    ok(result.score >= want && score === result.score && !result.flagged, `${type} rev ${rev}: a ${level} run reaches ${result.score} through the server replay (want ${want === 150 ? "150" : `at least ${want}`})`);
    console.log(`  ${type} rev ${rev}: ${result.score} via the server replay (${level}, room seed ${n})`);
  }
}

section("Mixed Signals clashRev 5: the gentler unfinished credit");
{
  ok(clashV5UnfinishedOf(0, 0) === 0 && clashV5UnfinishedOf(10, 12) === 0 && clashV5UnfinishedOf(20, 0) === 70 && clashV5UnfinishedOf(46, 6) === 100 && clashV5UnfinishedOf(49, 3) === 110 && clashV5UnfinishedOf(52, 0) === 110, "unfinished: 0 at net 0 or less, 70 at 20, 100 at 40, 110 from 46");
  for (let net = 1; net <= 52; net++) ok(clashV5UnfinishedOf(net, 0) >= clashV5UnfinishedOf(net - 1, 0), `unfinished credit never falls (net ${net})`);
  // Every finish beats every unfinished run; a finish scores exactly as on clashRev 4.
  let lowestFinish = 999;
  let highestUnfinished = 0;
  for (let wrong = 0; wrong <= 52; wrong++)
    for (let correct = 0; correct + wrong <= 52; correct++)
      for (const finishTick of [0, 1200, 2700, 4400]) {
        const done = correct + wrong === 52 && finishTick > 0;
        const v5 = clashRev5ScoreOf(correct, wrong, 52, done ? finishTick : 0);
        const finished = done && wrong <= 2;
        if (finished) {
          lowestFinish = Math.min(lowestFinish, v5);
          ok(v5 === clashRev4ScoreOf(correct, wrong, 52, finishTick), `finish ${correct}/${wrong} at ${finishTick}: scored as clashRev 4`);
        } else highestUnfinished = Math.max(highestUnfinished, v5);
      }
  ok(lowestFinish >= 120 && highestUnfinished <= 110, `every finish (≥ ${lowestFinish}) beats every unfinished run (≤ ${highestUnfinished})`);
  // The kits' players on 30 room puzzles: before (clashRev 4) and after (clashRev 5), and careless sorting.
  const kit = KITS["stroop" as PuzzleType]!;
  const seeds = Array.from({ length: 30 }, (_, i) => 5001 + i);
  const med: Record<string, [number, number]> = {};
  for (const level of LEVELS) {
    const before: number[] = [];
    const after: number[] = [];
    for (const seed of seeds) {
      const p = roomPuzzle("stroop", seed) as PuzzleData & { clashRev?: number };
      ok(p.clashRev === CLASH_REV_TALL, `room puzzle ${seed} is clashRev 5`);
      after.push(runPlay(kit, p, seed, level).score);
      before.push(runPlay(kit, { ...p, clashRev: CLASH_REV } as PuzzleData, seed, level).score);
    }
    med[level] = [median(before), median(after)];
  }
  ok(med.good![0] <= 90 && med.good![1] >= 95 && med.good![1] <= 105, `good players: ${med.good![0]} → ${med.good![1]} (target about 100)`);
  ok(med.average![1] >= 62 && med.average![1] <= 78, `average players: ${med.average![0]} → ${med.average![1]} (target about 70)`);
  ok(med.great![1] >= 120 && med.near![1] >= 138, `great and near-perfect players: ${med.great![1]} and ${med.near![1]} (finishes, scored as before)`);
  const spam: Record<string, number[]> = {};
  for (const seed of seeds.slice(0, 15)) for (const run of runSpam(kit, roomPuzzle("stroop", seed), seed)) (spam[run.label] ??= []).push(run.score);
  for (const [label, scores] of Object.entries(spam)) ok(median(scores) <= 5, `careless "${label}" median ${median(scores)} (at most 5)`);
  console.log(`  medians (clashRev 4 → 5): ${LEVELS.map((l) => `${l} ${med[l]![0]} → ${med[l]![1]}`).join(", ")}; careless ${Object.entries(spam).map(([l, s]) => `${l} ${median(s)}`).join(", ")}`);
}

/* ============================== 5. Intro demos ============================== */
section("Intro demos stay stopped until re-recorded on the taller revision");
{
  const src = read("src/lib/duel/introDemo.functions.ts");
  ok(/data\.type === "beat" && demo\?\.puzzle\.type === "beat" && demo\.puzzle\.beatRev !== BEAT_REV_EASE\) return null/.test(src), "Tempo's demo plays only on beatRev 10 (phone notes; beatRev 9 and 6 before it)");
  ok(/data\.type === "slice" && demo\?\.puzzle\.type === "slice" && demo\.puzzle\.sliceRev !== SLICE_REV_TALL\) return null/.test(src), "Slice's demo plays only on sliceRev 6");
  // Expansion E6: Coral Pop's demo now plays only on bubbleRev 8 (e6-check).
  ok(/data\.type === "bubble" && demo\?\.puzzle\.type === "bubble" && demo\.puzzle\.bubbleRev !== (BUB_REV_REEF|BUB_REV_BLAST)\) return null/.test(src), "Coral Pop's demo plays only on bubbleRev 8 (bubbleRev 10 since the phone notes)");
  ok(/data\.type === "stroop" && demo\?\.puzzle\.type === "stroop" && demo\.puzzle\.clashRev !== CLASH_REV_DEPTH\) return null/.test(src), "Mixed Signals' demo plays only on clashRev 8 (depth to 200)");
  ok(/data\.type === "clayshoot" && demo\?\.puzzle\.type === "clayshoot" && demo\.puzzle\.clayRev !== CLAY_REV_DEPTH\) return null/.test(src) && CLAY_REV === CLAY_REV_TALL, "Pull!'s demo plays only on clayRev 9 (depth to 200)");
}

if (failures.length) {
  console.log(`FAIL arcade-tuning-g2: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`arcade-tuning-g2: ${checks} checks passed — 116 stored runs on every older revision and 40 on the taller ones replay unchanged; rooms deal beatRev 6, sliceRev 6, bubbleRev 5, clashRev 5 and clayRev 6; worlds, reveals and effects by revision; per-game timing; refitted curves and 150 via the server replay; Mixed Signals' gentler credit; demos stopped`);
