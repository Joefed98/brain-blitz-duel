/**
 * wavefront-wide-check (D5, 22 Nov 2026; no browser, ~1–2 min; `CHECKS_FULL=1` re-plays every witness's player): Wavefront
 * wavRev 16, the wider formation (docs/arcade-standard/wavefront.md "wavRev 16").
 *
 *  1. Legacy: every run recorded before wavRev 16 (scripts/fixtures/wavefront-wide-legacy.json.gz: wavRev 15 at Easy,
 *     Normal, Hard and Expert, wavRev 14 and 13) replays through the server's grade to exactly its recorded score and
 *     final state (checkpoint checksum and counters).
 *  2. The stamp and the pin: rooms and practice deal wavRev 16 at Normal and at every level; with `wavPreWide` pinned they
 *     deal wavRev 15 from WAV_DEAL exactly as before (the legacy fixture's own deals, puzzle for puzzle); with `preRetro`
 *     wavRev 13; LIVE_BANDS, the practice stamps and the intro-demo rule name wavRev 16; a level's settings apply on it.
 *  3. The geometry: the grid on a 52 px pitch, centred; every shaped wave WAV_V16_FORM_W wide by its rule, rows, slots and
 *     the armour core's 44 px spacing as wavRev 15, no new overlap; the escorts as WAV_FORMS_X's; the march's room; on
 *     every tick of runs at every level no formation ship drawn or hit outside the world; the art drawn on each ship's
 *     hit box (within the bounds rule's 2 px), the armour warship over its cells.
 *  4. The deal: every stored witness (scripts/fixtures/wavefront-wide-deal-witness.json.gz) scores exactly 200 through the
 *     server replay, unflagged, at every level, and is the flawless player held to HUMAN_LIMITS with its jitter (re-played
 *     and compared event for event); wavefrontDealV16.server.ts is exactly what scripts/wavefront-wide-deal.ts builds from
 *     them; 2,000 deals across the levels all land on a proved seed; every proved seed is reachable.
 *  5. The parts still sum to 200, and a proof run on a dealt puzzle scores 200 through gradeAnswer at every level.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import {
  wavefrontGameFor,
  wavFormSizeXW,
  wavPitchX,
  wavShapeBox,
  WAVEFRONT_STD_BIG,
  WAVEFRONT_STD_WIDE,
  WAV_ARMOUR_BY_WAVE,
  WAV_ARMOUR_CODE,
  WAV_CELL,
  WAV_COLS,
  WAV_FORMS,
  WAV_FORMS_W,
  WAV_FORMS_X,
  WAV_FORMS_XW,
  WAV_REV_BIG,
  WAV_REV_KEEP,
  WAV_REV_WIDE,
  WAV_V15_HIT_PAD,
  WAV_V16_FORM_W,
  WAV_V16_PITCH_X,
  WAV_V16_START_X,
  WAV_WORLD_W,
  type WavState,
} from "../src/lib/arcade/wavefront";
import { WAV_V15_HULL_BLEED, wavefrontArtGameFor } from "../src/lib/arcade/wavefront.renderer";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { retroLevelSettings } from "../src/lib/arcade/retroLevels";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { pinPreRetro, pinWavPreWide } from "../src/lib/duel/arcade.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { replayWavefrontRun } from "../src/lib/duel/wavefront";
import { WAV_DEAL } from "../src/lib/duel/wavefrontDeal.server";
import { WAV_DEAL_V16, wavDealSeedV16 } from "../src/lib/duel/wavefrontDealV16.server";
import { PRACTICE_STAMPS } from "../src/lib/duel/practiceStamps.data";
import { demoRevAccepted } from "../src/lib/duel/introDemo.functions";
import type { PuzzleData } from "../src/lib/duel/types";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { dealAt } from "./level-tune";
import { randomLog } from "./room-identity/wavefront";
import { wavLegacyDigest, type WavLegacyRun } from "./wavefront-wide-lib";
import { checkWideWitnesses, humanWitnessLog, proveWideWitness, readWideWitnesses, WAV_WIDE_DEAL_FILE, WAV_WIDE_JITTERS, WAV_WIDE_LEVELS, wavWideDealSource } from "./wavefront-wide-deal";

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  checks += 1;
  if (!cond) failures.push(`  ✗ ${label}`);
}
const FULL = process.env["CHECKS_FULL"] === "1" || process.argv.includes("--full");
const LEVELS: readonly Level[] = ["easy", "normal", "hard", "expert"];
const EDGE = 8;

/* 1. Legacy runs replay and score exactly as recorded. */
const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/wavefront-wide-legacy.json.gz")).toString()) as { runs: WavLegacyRun[] };
{
  let same = 0;
  const bad: string[] = [];
  const seen = new Set<string>();
  let heavies = 0;
  for (const r of legacy.runs) {
    const puzzle = r.puzzle as unknown as PuzzleData;
    const graded = gradeAnswer(puzzle, r.raw, 0);
    const digest = wavLegacyDigest(puzzle, r.raw);
    if (graded.score === r.score && digest === r.digest) same += 1;
    else bad.push(`${r.label}: ${graded.score} (recorded ${r.score})${digest === r.digest ? "" : " state differs"}`);
    seen.add(`${r.puzzle["wavRev"]}:${(r.puzzle["level"] as string | undefined) ?? "normal"}`);
    if (r.label.includes("charged")) {
      const p = r.puzzle as { seed: number; wavRev: number };
      heavies += (replayWavefrontRun(p.seed, r.raw, p.wavRev, puzzleLevel(puzzle)).state as WavState).heavies ?? 0;
    }
  }
  ok(legacy.runs.length >= 90 && bad.length === 0, `all ${legacy.runs.length} legacy runs replay to their recorded score and final state (${same} same; ${bad.slice(0, 4).join("; ")})`);
  for (const k of ["15:easy", "15:normal", "15:hard", "15:expert", `${WAV_REV_BIG - 1}:normal`, `${WAV_REV_KEEP}:normal`]) ok(seen.has(k), `the legacy fixture holds runs on wavRev ${k.replace(":", " at ")}`);
  ok(heavies > 0, `the legacy fixture's scripted runs fire the charged shot (${heavies} heavy blasts)`);
  ok(new Set(legacy.runs.map((r) => r.score)).size > 10, "the legacy runs span many scores (weak to flawless)");
}

/* 2. The stamp and the pin. */
{
  const v16 = new Set(WAV_DEAL_V16);
  for (const level of LEVELS) {
    const p = withSeededRandom(0x5eed, () => generatePuzzle("wavefront", level === "normal" ? {} : { level })) as unknown as Record<string, unknown>;
    ok(p["wavRev"] === WAV_REV_WIDE && v16.has(p["seed"] as number), `${level} deals wavRev 16 on a proved seed (wavRev ${String(p["wavRev"])})`);
    ok((p["level"] ?? "normal") === level, `${level}: the deal carries its level`);
  }
  // wavPreWide: today's wavRev 15 deal exactly: the legacy fixture's own deals (dealAt, recorded before wavRev 16).
  pinWavPreWide(true);
  const recorded = legacy.runs.filter((r) => r.puzzle["wavRev"] === WAV_REV_BIG);
  let identical = 0;
  const byKey = new Map<string, Record<string, unknown>>();
  for (const r of recorded) {
    const m = /^wavRev 15 (\w+) deal #(\d+)/.exec(r.label);
    if (m) byKey.set(`${m[1]}:${m[2]}`, r.puzzle);
  }
  for (const [key, puzzle] of byKey) {
    const [level, n] = key.split(":") as [Level, string];
    if (JSON.stringify(dealAt("wavefront", level, Number(n))) === JSON.stringify(puzzle)) identical += 1;
  }
  const p15 = withSeededRandom(0x5eed, () => generatePuzzle("wavefront")) as unknown as Record<string, number>;
  pinWavPreWide(false);
  ok(byKey.size >= 20 && identical === byKey.size, `wavPreWide deals wavRev 15 exactly as before: ${identical} of ${byKey.size} recorded deals identical`);
  ok(p15["wavRev"] === WAV_REV_BIG && WAV_DEAL.includes(p15["seed"]!), `wavPreWide deals wavRev 15 from WAV_DEAL (${p15["wavRev"]})`);
  pinPreRetro(true);
  const p13 = withSeededRandom(0x5eed, () => generatePuzzle("wavefront")) as unknown as Record<string, number>;
  pinPreRetro(false);
  ok(p13["wavRev"] === WAV_REV_KEEP, `preRetro still deals wavRev 13 (${p13["wavRev"]})`);
  const after = withSeededRandom(0x5eed, () => generatePuzzle("wavefront")) as unknown as Record<string, number>;
  ok(after["wavRev"] === WAV_REV_WIDE, "the pins restore: wavRev 16 again");
  ok(LIVE_BANDS.wavefront.rev === WAV_REV_WIDE, `LIVE_BANDS names wavRev 16 (${LIVE_BANDS.wavefront.rev})`);
  ok(/wavRev=16\b/.test(PRACTICE_STAMPS["wavefront"] ?? ""), `the practice stamps name wavRev 16 (${PRACTICE_STAMPS["wavefront"]})`);
  ok(demoRevAccepted("wavefront", WAV_REV_WIDE) && !demoRevAccepted("wavefront", WAV_REV_BIG), "only an intro demo recorded on wavRev 16 plays (a wavRev 15 demo shows the narrower formation)");
  for (const level of ["easy", "hard", "expert"] as const) {
    const lv = retroLevelSettings("wavefront", level)!;
    const s16 = wavefrontGameFor(WAV_REV_WIDE, level).init(7) as WavState;
    const s15 = wavefrontGameFor(WAV_REV_BIG, level).init(7) as WavState;
    ok(s16.lives === lv.lives && s16.redSpeed === s15.redSpeed && s16.lv?.killS === lv.killS && s16.lv?.bossPct === lv.bossPct, `${level}: wavRev 16 takes the level's settings as wavRev 15 does (${s16.lives} lives)`);
  }
  const n16 = wavefrontGameFor(WAV_REV_WIDE).init(7) as WavState;
  const n15 = wavefrontGameFor(WAV_REV_BIG).init(7) as WavState;
  const { wide, fx, ...rest16 } = n16;
  const { fx: fx15, ...rest15 } = n15;
  ok(wide === 1 && fx === WAV_V16_START_X && fx15 !== fx && JSON.stringify(rest16) === JSON.stringify(rest15), "wavRev 16's first state is wavRev 15's with `wide: 1` and the wider grid's start");
}

/* 3. The geometry. */
{
  const s16 = wavefrontGameFor(WAV_REV_WIDE).init(11) as WavState;
  const s15 = wavefrontGameFor(WAV_REV_BIG).init(11) as WavState;
  ok(wavPitchX(s16) === WAV_V16_PITCH_X && WAV_V16_PITCH_X === 52 && wavPitchX(s15) === 44, "the grid's pitch: 52 on wavRev 16, 44 before");
  const gridW = (WAV_COLS - 1) * WAV_V16_PITCH_X + WAV_CELL;
  ok(gridW === 288 && WAV_V16_START_X * 2 + gridW === WAV_WORLD_W, `the wider grid is ${gridW} px, centred (start ${WAV_V16_START_X})`);
  let gridOk = true;
  for (let i = 0; i < 36; i++) {
    if (wavShapeBox(s16, i).x !== WAV_V16_START_X + (i % WAV_COLS) * 52) gridOk = false;
    if (wavShapeBox(s15, i).x !== s15.fx + (i % WAV_COLS) * 44) gridOk = false;
  }
  ok(gridOk, "wave 1's boxes on wavRev 16 sit on the 52 px pitch, wavRev 15's on 44");
  const roundHalfUp = (n: number, d: number) => Math.floor((2 * n + d) / (2 * d));
  for (let wave = 2; wave <= 5; wave++) {
    const old = WAV_FORMS[wave]!;
    const wide = WAV_FORMS_W[wave]!;
    const cells = WAV_ARMOUR_BY_WAVE[Math.min(wave - 2, 3)]![0];
    ok(wide.length === old.length && wide.every((p, i) => p[1] === old[i]![1]), `wave ${wave}: the same ${old.length} slots on the same rows`);
    const w = Math.max(...wide.map((p) => p[0])) + WAV_CELL;
    ok(w === WAV_V16_FORM_W && Math.min(...wide.map((p) => p[0])) === 0, `wave ${wave}: ${w} px wide from 0 (was ${Math.max(...old.map((p) => p[0])) + WAV_CELL})`);
    ok(wide.slice(0, cells).every((p, i) => p[0] - wide[0]![0] === old[i]![0] - old[0]![0]), `wave ${wave}: the armour core keeps its 44 px spacing`);
    // The rule, recomputed: outline about the centre by (W − 28) / (w − 28), the core's centre alike, then from 0.
    const xs = old.map((p) => p[0]);
    const s2 = Math.min(...xs) + Math.max(...xs);
    const num = WAV_V16_FORM_W - WAV_CELL;
    const den = Math.max(...xs) - Math.min(...xs);
    const core = old.slice(0, cells).map((p) => p[0]);
    const c2 = Math.min(...core) + Math.max(...core);
    const built = old.map((p, i) => (i < cells ? roundHalfUp(2 * den * p[0] - den * c2 + den * s2 + num * (c2 - s2), 2 * den) : roundHalfUp(den * s2 + num * (2 * p[0] - s2), 2 * den)));
    const mn = Math.min(...built);
    ok(built.every((x, i) => x - mn === wide[i]![0]), `wave ${wave}: WAV_FORMS_W is the spread rule's table`);
    const overlaps = (f: readonly (readonly [number, number])[]) => {
      const out = new Set<string>();
      for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) if (Math.abs(f[i]![0] - f[j]![0]) < WAV_CELL && Math.abs(f[i]![1] - f[j]![1]) < WAV_CELL) out.add(`${i}-${j}`);
      return out;
    };
    const before = overlaps(old);
    const now = [...overlaps(wide)];
    ok(now.every((k) => before.has(k)), `wave ${wave}: no two cells overlap that did not before (${now.length} pairs, ${before.size} before)`);
    const xw = WAV_FORMS_XW[wave]!;
    const xo = WAV_FORMS_X[wave]!;
    ok(xw.length === xo.length && xw.slice(old.length).every((p, k) => p[0] === Math.round((k * (w - WAV_CELL)) / 5) && p[1] === xo[old.length + k]![1]), `wave ${wave}: six escorts spread under the wider shape, on WAV_FORMS_X's row`);
    ok(wavFormSizeXW(wave).w === WAV_V16_FORM_W && WAV_WORLD_W - 2 * EDGE - WAV_V16_FORM_W >= 6 * 8, `wave ${wave}: the march keeps ${WAV_WORLD_W - 2 * EDGE - WAV_V16_FORM_W} px of room, six 8 px steps a pass`);
  }

  // Every tick of runs at every level: no formation ship drawn (its hull, 4 px past the cell) or hit (3 px past) outside
  // the world, nor past the march's walls; every wave's shape shows.
  let outside = 0;
  let ticks = 0;
  const waves = new Set<number>();
  const where: string[] = [];
  const sweep = (seed: number, level: Level, events: readonly ArcadeInputEvent[], label: string) => {
    const game = wavefrontGameFor(WAV_REV_WIDE, level);
    const byTick = new Map(events.map((e) => [e.t, e]));
    let s = game.init(seed) as WavState;
    while (!game.isOver(s) && s.tick < game.runTicks) {
      s = game.step(s, byTick.get(s.tick + 1) ?? null) as WavState;
      ticks += 1;
      const away = new Set((s.divers ?? []).map((d) => d.cell));
      s.shapes.forEach((code, i) => {
        if (code === 0 || away.has(i)) return;
        waves.add(s.wave);
        const box = wavShapeBox(s, i);
        const art = box.x - WAV_V15_HULL_BLEED >= 0 && box.x + WAV_CELL + WAV_V15_HULL_BLEED <= WAV_WORLD_W;
        const hit = box.x - WAV_V15_HIT_PAD >= 0 && box.x + WAV_CELL + WAV_V15_HIT_PAD <= WAV_WORLD_W;
        const walls = box.x >= EDGE && box.x + WAV_CELL <= WAV_WORLD_W - EDGE;
        if (!art || !hit || !walls) {
          outside += 1;
          if (where.length < 4) where.push(`${label} tick ${s.tick} wave ${s.wave} ship ${i} at x ${box.x}`);
        }
      });
    }
  };
  const witnesses = readWideWitnesses().witnesses;
  for (const level of LEVELS) {
    for (const w of witnesses.slice(0, 6)) sweep(w.seed, level, w.runs.find((r) => r.level === level)!.events, `witness ${w.seed} ${level}`);
    for (let k = 0; k < 4; k++) {
      const seed = WAV_DEAL_V16[k * 7]!;
      sweep(seed, level, randomLog(seed), `random ${seed} ${level}`);
      sweep(seed, level, [], `idle ${seed} ${level}`);
    }
  }
  ok(outside === 0, `on ${ticks} ticks at every level no formation ship is drawn or hit outside the world or past the walls (${where.join("; ")})`);
  ok([1, 2, 3, 4, 5].every((w) => waves.has(w)), `the runs show every wave's formation (${[...waves].sort().join(", ")})`);

  // The art follows the hit cells: each ship's drawing (what the frame draws with it, less the frame without it) lies on
  // its hit box (the cell plus 3 px), within the bounds rule's 2 px; the armour warship over its cells.
  const recorder = () => {
    const pts: string[] = [];
    const target: Record<string, unknown> = {};
    const ctx = new Proxy(target, {
      get(_, k) {
        if (k === "fillRect" || k === "strokeRect" || k === "drawImage") {
          return (...a: unknown[]) => {
            const n = a.map(Number);
            const [x, y, w, h] = k === "drawImage" ? [n[1]!, n[2]!, n[3]!, n[4]!] : [n[0]!, n[1]!, n[2]!, n[3]!];
            pts.push(`${x},${y}`, `${x + w},${y + h}`);
          };
        }
        if (k === "moveTo" || k === "lineTo") return (x: number, y: number) => pts.push(`${x},${y}`);
        if (k === "quadraticCurveTo") return (cx: number, cy: number, x: number, y: number) => pts.push(`${cx},${cy}`, `${x},${y}`);
        if (k === "bezierCurveTo") return (a: number, b: number, c: number, d: number, x: number, y: number) => pts.push(`${a},${b}`, `${c},${d}`, `${x},${y}`);
        if (k === "arc") return (x: number, y: number, r: number) => pts.push(`${x - r},${y - r}`, `${x + r},${y + r}`);
        if (k === "ellipse") return (x: number, y: number, rx: number, ry: number) => pts.push(`${x - rx},${y - ry}`, `${x + rx},${y + ry}`);
        if (k === "createLinearGradient" || k === "createRadialGradient" || k === "createPattern") return () => ({ addColorStop() {} });
        if (k === "measureText") return (t: string) => ({ width: String(t).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
        if (k === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
        if (k in target) return target[k as string];
        return () => {};
      },
      set(_, k, v) {
        target[k as string] = v;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, pts };
  };
  const art = wavefrontArtGameFor(WAV_REV_WIDE);
  const size = { width: WAV_WORLD_W, height: 800 };
  const drawn = (state: WavState): string[] => {
    const { ctx, pts } = recorder();
    art.draw(ctx, state, size);
    return pts;
  };
  const less = (a: string[], b: string[]) => {
    const left = new Map<string, number>();
    for (const p of b) left.set(p, (left.get(p) ?? 0) + 1);
    const out: [number, number][] = [];
    for (const p of a) {
      const n = left.get(p) ?? 0;
      if (n > 0) left.set(p, n - 1);
      else out.push(p.split(",").map(Number) as [number, number]);
    }
    return out;
  };
  // States from a witness's run, one settled frame on each formation wave.
  const w0 = witnesses[0]!;
  const game = wavefrontGameFor(WAV_REV_WIDE);
  const events = w0.runs.find((r) => r.level === "normal")!.events;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const frames: WavState[] = [];
  let s = game.init(w0.seed) as WavState;
  let lastWave = 0;
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null) as WavState;
    if (!s.boss && (s.enter ?? 0) === 0 && s.wave !== lastWave && s.shapes.filter((c) => c !== 0).length > 20) {
      frames.push(s);
      lastWave = s.wave;
    }
  }
  ok(frames.length === 5, `one settled frame on each of the five formation waves (${frames.length})`);
  let ships = 0;
  let offBox = 0;
  let empty = 0;
  const off: string[] = [];
  for (const f of frames) {
    const full = drawn(f);
    const away = new Set((f.divers ?? []).map((d) => d.cell));
    f.shapes.forEach((code, i) => {
      if (code === 0 || code === WAV_ARMOUR_CODE || away.has(i)) return;
      ships += 1;
      const box = wavShapeBox(f, i);
      const without = drawn({ ...f, shapes: f.shapes.map((c, j) => (j === i ? 0 : c)) });
      const mine = less(full, without);
      if (!mine.length) empty += 1;
      const slack = WAV_V15_HIT_PAD + 2;
      const bad = mine.filter(([x, y]) => x < box.x - slack - 0.01 || x > box.x + WAV_CELL + slack + 0.01 || y < box.y - slack - 0.01 || y > box.y + WAV_CELL + slack + 0.01);
      if (bad.length) {
        offBox += 1;
        if (off.length < 3) off.push(`wave ${f.wave} ship ${i} box ${box.x},${box.y}: ${JSON.stringify(bad.slice(0, 2))}`);
      }
    });
    if (f.armour) {
      const cells = f.shapes.map((c, i) => (c === WAV_ARMOUR_CODE ? wavShapeBox(f, i) : null)).filter((b): b is { x: number; y: number } => b !== null);
      const without = drawn({ ...f, armour: null, shapes: f.shapes.map((c) => (c === WAV_ARMOUR_CODE ? 0 : c)) });
      const mine = less(full, without);
      const x0 = Math.min(...cells.map((b) => b.x)) - WAV_V15_HIT_PAD - 2;
      const x1 = Math.max(...cells.map((b) => b.x)) + WAV_CELL + WAV_V15_HIT_PAD + 2;
      const y0 = Math.min(...cells.map((b) => b.y)) - WAV_V15_HIT_PAD - 2;
      const y1 = Math.max(...cells.map((b) => b.y)) + WAV_CELL + WAV_V15_HIT_PAD + 2;
      const bad = mine.filter(([x, y]) => x < x0 - 0.01 || x > x1 + 0.01 || y < y0 - 0.01 || y > y1 + 0.01);
      ok(mine.length > 0 && bad.length === 0, `wave ${f.wave}: the armour warship is drawn over its ${cells.length} cells' hit boxes (${bad.length} points off)`);
    }
  }
  ok(ships > 100 && empty === 0, `every one of ${ships} formation ships is drawn (${empty} with nothing drawn)`);
  ok(offBox === 0, `every formation ship's drawing lies on its hit box within 2 px (${offBox} off: ${off.join("; ")})`);
}

/* 4. The deal. */
{
  const { seeds, tried, bad } = checkWideWitnesses();
  ok(seeds.length >= 60, `at least 60 seeds dealt (${seeds.length} of ${tried} candidates)`);
  ok(bad.length === 0, `every witness scores 200 through the server replay at ${WAV_WIDE_LEVELS.join(", ")} (${bad.slice(0, 5).join("; ")})`);
  ok(new Set(seeds).size === seeds.length, "no seed twice");
  ok(readFileSync(WAV_WIDE_DEAL_FILE, "utf8") === wavWideDealSource(seeds, tried), "wavefrontDealV16.server.ts is exactly the witnessed seeds");
  ok(WAV_DEAL_V16.join() === seeds.join(), "WAV_DEAL_V16 lists the witnessed seeds in order");
  // Each witness is the flawless player held to the human limits (its saucer reaction only ever later): re-played.
  const data = readWideWitnesses();
  const sample = FULL ? data.witnesses : data.witnesses.filter((_, k) => k % 8 === 0);
  let same = 0;
  let runs = 0;
  const diff: string[] = [];
  for (const w of sample) {
    for (const r of w.runs) {
      runs += 1;
      const again = await humanWitnessLog(w.seed, r.level, r.jitter);
      if (WAV_WIDE_JITTERS.includes(r.jitter) && JSON.stringify(again) === JSON.stringify(r.events)) same += 1;
      else if (diff.length < 3) diff.push(`${w.seed} ${r.level} j${r.jitter}`);
    }
  }
  ok(runs > 0 && same === runs, `${same} of ${runs} witnesses (${FULL ? "all" : "every eighth seed"}) are the human-limited flawless player's own logs (${diff.join("; ")})`);
  const dealt = new Set(WAV_DEAL_V16);
  let outside = 0;
  let wrongRev = 0;
  for (const level of LEVELS) {
    for (let i = 0; i < 500; i++) {
      const p = withSeededRandom(0x5eed + i * 7919, () => generatePuzzle("wavefront", level === "normal" ? {} : { level })) as unknown as Record<string, number>;
      if (!dealt.has(p["seed"]!)) outside += 1;
      if (p["wavRev"] !== WAV_REV_WIDE) wrongRev += 1;
    }
  }
  ok(outside === 0, `2,000 deals across the levels all on a witnessed seed (${outside} outside)`);
  ok(wrongRev === 0, `every deal is wavRev 16 (${wrongRev} not)`);
  const reach = new Set(Array.from({ length: WAV_DEAL_V16.length * 3 }, (_, k) => wavDealSeedV16(k * 104729 + 17)));
  ok(reach.size === WAV_DEAL_V16.length, `every dealt seed reachable from a room seed (${reach.size} of ${WAV_DEAL_V16.length})`);
}

/* 5. The parts and a proof run through gradeAnswer on a dealt puzzle. */
{
  const sum = WAVEFRONT_STD_WIDE.parts.reduce((a, p) => a + p.max, 0);
  ok(sum === 200 && WAVEFRONT_STD_WIDE.rev === WAV_REV_WIDE, `wavRev 16's parts sum to ${sum}`);
  ok(JSON.stringify(WAVEFRONT_STD_WIDE.parts) === JSON.stringify(WAVEFRONT_STD_BIG.parts), "wavRev 16's parts are wavRev 15's");
  const byseed = new Map(readWideWitnesses().witnesses.map((w) => [w.seed, w]));
  for (const level of LEVELS) {
    const puzzle = withSeededRandom(0xc0ffee, () => generatePuzzle("wavefront", level === "normal" ? {} : { level }));
    const loose = puzzle as unknown as { seed: number };
    const w = byseed.get(loose.seed)!;
    const run = w.runs.find((r) => r.level === level)!;
    const raw = proveWideWitness(loose.seed, level, run.events).raw;
    const graded = gradeAnswer(puzzle, raw, 0);
    ok(graded.score === 200 && !(graded.extra as { flagged?: boolean } | undefined)?.flagged, `${level}: the dealt seed's witness scores 200 through gradeAnswer on the dealt puzzle (${graded.score})`);
  }
}

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL wavefront-wide-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS wavefront-wide-check: ${checks} checks — wavRev 15, 14 and 13 replay as recorded; rooms deal wavRev 16 (the wider formation) only on seeds the human-limited flawless player takes to 200 at every level; the formation stays in the world and its art on its hit boxes`);
