/**
 * action-demos-check (the Action overhaul, stage 3, 15 Nov 2026): the six Action games' intro demos
 * (scripts/fixtures/action-demos.json, recorded by scripts/action-demos-record.ts, saved by scripts/action-demos-save.ts).
 *
 *  1. Each stored run is on the stamp rooms deal (ACTION_DEMO_REVS in introDemo.functions.ts equals the intro example's
 *     stamp, dealt exactly as practiceGenerateFn's `example: true` path deals it) and on that very example (its digest).
 *  2. Each replays through the server's own replay to its stored score (170 or more, 200 for most), unflagged, and
 *     its seed is the puzzle's (saveIntroDemoFn stores runSeed(run)).
 *  3. The intro's window (ticks 1–480, runAtTick as the intro plays it): every frame's tick is the frame's, the score never
 *     falls, no slip (crash, miss, hit, life or base hit), the game's main moments (judgeWindow), and the stored moments.
 *  4. Every sampled frame draws through the intro-demo player's own path (ARCADE_REVEAL_RENDERERS[type].drawFinal with
 *     "demo", on @napi-rs/canvas): no throw, a picture, and the picture moves.
 *  5. The stop rules (introDemoFor): a demo saved as saveIntroDemoFn saves it plays on the live stamp; demos on older
 *     stamps that show other rules (and unstamped ones) stay stopped.
 *  6. The save, end to end on a local PostgreSQL through the server-function harness: action-demos-save's
 *     saveActionDemos drives the real practiceGenerateFn → saveIntroDemoFn → getIntroDemoFn handlers; a wrong key saves
 *     nothing, the right one saves all six and each reads back through the stop rules; a run on another example is refused.
 *
 *   bun scripts/action-demos-check.ts      # ~40 s (section 6 skipped locally without PostgreSQL; CI runs it)
 *   bun scripts/action-demos-check.ts --shots=<dir>   # also writes each game's frame strip
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => 10_000 } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    devicePixelRatio: 1,
    location: { pathname: "/", search: "", hash: "", href: "http://localhost/" },
    addEventListener() {},
    removeEventListener() {},
    getComputedStyle: (el: { style?: Record<string, string> }) => el.style ?? {},
  },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const H = await import("./server-fn-harness");
const pg = H.postgresBin();
// The harness's createServerFn must be in place before any *.functions.ts module loads (section 6 calls the handlers).
if (pg) await H.installServerFnPlugin();

const L = await import("./action-demos-lib");
const { ACTION_DEMO_REVS, introDemoFor } = await import("../src/lib/duel/introDemo.functions");
const { DEMO_LENGTH_TICKS, DEMO_MAX_CHARS, DEMO_START_TICK, runAtTick, runSeed } = await import("../src/lib/arcade/introDemo");
const { ARCADE_REVEAL_RENDERERS, revealWorldH } = await import("../src/lib/arcade/revealRenderers");
const { ORBIT_BELT_PERIOD_TICKS, ORBIT_BELT_REVISION } = await import("../src/lib/arcade/orbit");

let passes = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}
const section = (name: string) => console.log(`\n${name}`);
const shots = process.argv.find((a) => a.startsWith("--shots="))?.slice(8);

const file = JSON.parse(readFileSync(L.ACTION_DEMO_FIXTURE, "utf8")) as import("./action-demos-lib").ActionDemoFile;

/** Older stamps whose demos must stay stopped (they show other rules), per game. Skyline's 10 plays (its play until a miss, SAME_PLAY_DEMO_REVS). */
const STOPPED: Record<import("./action-demos-lib").ActionDemoType, (number | undefined)[]> = {
  flip: [12, 11, 10, 8, undefined],
  swing: [17, 16, 15, undefined],
  ricochet: [3, 2, undefined],
  bastion: [2, undefined],
  skyline: [9, 8, undefined],
  orbit: [14, 13, 12],
};

section("1–5. each stored demo");
for (const type of L.ACTION_DEMO_TYPES) {
  const e = file.demos[type];
  ok(Boolean(e), `${type}: a stored demo`);
  if (!e) continue;
  const live = L.introExample(type);
  const liveStamp = L.stampOf(type, live);
  const want = ACTION_DEMO_REVS[type];
  ok(want === liveStamp, `${type}: ACTION_DEMO_REVS (${want}) is the stamp the intro example deals (${liveStamp})`);
  ok(e.stamp === liveStamp && L.stampOf(type, e.puzzle) === e.stamp, `${type}: the run is on the live stamp ${liveStamp} (stored ${e.stamp}; re-record with bun scripts/action-demos-record.ts ${type})`);
  ok(L.puzzleDigest(live) === e.digest && L.puzzleDigest(e.puzzle) === e.digest, `${type}: the run is on today's intro example (re-record with bun scripts/action-demos-record.ts ${type})`);

  // 2. The whole run.
  const full = L.serverReplay(type, e.puzzle, e.run);
  ok(full.score === e.score && !full.flagged, `${type}: the server replay scores the stored ${e.score} (got ${full.score}${full.flagged ? ", flagged" : ""})`);
  ok(e.score >= L.DEMO_MIN_SCORE, `${type}: a good run (${e.score} ≥ ${L.DEMO_MIN_SCORE})`);
  ok(runSeed(e.run) === (e.puzzle as { seed: number }).seed, `${type}: the run's seed is the puzzle's`);
  ok(e.run.length > 0 && e.run.length <= DEMO_MAX_CHARS, `${type}: the run fits the demo allowance (${e.run.length} chars)`);
  const endTick = Number(e.run.split("~")[0]!.split("|")[3]);
  ok(L.serverReplay(type, e.puzzle, runAtTick(e.run, endTick)).score === e.score, `${type}: the run stopped at its own end tick scores the same (runAtTick)`);

  // 3. The window.
  let last = -1;
  let ticksOk = true;
  let monotone = true;
  for (let t = 1; t <= DEMO_LENGTH_TICKS; t += 7) {
    const f = L.demoFrame(type, e.puzzle, e.run, t);
    if (f.state.tick !== t) ticksOk = false;
    if (f.score < last) monotone = false;
    last = f.score;
  }
  ok(ticksOk, `${type}: every demo frame is at its own tick`);
  ok(monotone, `${type}: the score never falls in the window`);
  const verdict = L.judgeWindow(type, e.puzzle, e.run);
  ok(verdict.ok, `${type}: the window shows a clean run with the game's moments${verdict.ok ? "" : ` (${verdict.why.join("; ")})`}`);
  ok(JSON.stringify(verdict.moments) === JSON.stringify(e.moments), `${type}: the window's moments are the stored ones ${JSON.stringify(verdict.moments)}`);

  // 4. The intro-demo player's own drawing path.
  const renderer = ARCADE_REVEAL_RENDERERS[type];
  ok(Boolean(renderer), `${type}: has the demo renderer`);
  if (renderer) {
    const h = revealWorldH(renderer, e.puzzle);
    const W = renderer.worldW;
    const ticks = [1, 120, 240, 360, DEMO_LENGTH_TICKS];
    const strip = shots ? createCanvas(W * ticks.length, Math.ceil(h)) : null;
    const prints: string[] = [];
    let drew = true;
    for (const [i, t] of ticks.entries()) {
      const c = createCanvas(W, Math.ceil(h));
      const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
      try {
        renderer.drawFinal(ctx, e.puzzle, runAtTick(e.run, t), "demo");
      } catch (err) {
        drew = false;
        console.log(`  ${type} @${t}: ${err instanceof Error ? err.message : String(err)}`);
      }
      const px = (c.getContext("2d") as any).getImageData(0, 0, W, Math.ceil(h)).data as Uint8ClampedArray;
      const colours = new Set<number>();
      for (let p = 0; p < px.length; p += 4 * 97) colours.add((px[p]! << 16) | (px[p + 1]! << 8) | px[p + 2]!);
      prints.push(`${colours.size}:${hashOf(px)}`);
      if (colours.size < 8) drew = false;
      if (strip) (strip.getContext("2d") as any).drawImage(c, i * W, 0);
    }
    ok(h > 0 && drew, `${type}: every sampled frame draws a picture through drawFinal("demo")`);
    ok(new Set(prints).size === ticks.length, `${type}: the picture moves (5 different frames)`);
    if (strip && shots) {
      mkdirSync(shots, { recursive: true });
      writeFileSync(`${shots}/${type}-demo.png`, strip.toBuffer("image/png"));
    }
  }

  // 5. The stop rules, on a row as saveIntroDemoFn writes it.
  const row = (puzzle: unknown) => ({
    game_type: type,
    seed: runSeed(e.run),
    puzzle: puzzle as never,
    input_log: { run: e.run, ...(type === "orbit" ? { orbitBeltPeriodTicks: ORBIT_BELT_PERIOD_TICKS, orbitBeltRevision: ORBIT_BELT_REVISION } : {}) },
    start_tick: DEMO_START_TICK,
    length_ticks: DEMO_LENGTH_TICKS,
  });
  ok(introDemoFor({ type }, row(e.puzzle)) !== null, `${type}: a demo on stamp ${e.stamp} plays`);
  for (const old of STOPPED[type]) {
    const p = { ...(e.puzzle as object) } as Record<string, unknown>;
    if (old === undefined) delete p[L.stampField(type)];
    else p[L.stampField(type)] = old;
    ok(introDemoFor({ type }, row(p)) === null, `${type}: a demo on ${old === undefined ? "no stamp" : `stamp ${old}`} stays stopped`);
  }
  console.log(`  ${type} (${e.stamp}): ${e.level}#${e.humanSeed}, ${e.score} points, window ${e.windowScore} ${JSON.stringify(e.moments)}`);
}

function hashOf(px: Uint8ClampedArray): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < px.length; i += 13) h = Math.imul(h ^ px[i]!, 16777619) >>> 0;
  return h.toString(16);
}

section("6. the save, end to end (server-function harness, local PostgreSQL)");
if (!pg) {
  if (process.env["CI"]) ok(false, "no PostgreSQL binaries on the CI runner");
  else console.log("  NOTE no PostgreSQL binaries found: the save is not run here (CI runs it)");
} else {
  const quiet = { log: console.log, error: console.error, warn: console.warn };
  let db: import("./server-fn-harness").LocalDb | null = null;
  let rest: import("./server-fn-harness").RestServer | null = null;
  try {
    db = H.startLocalDb("action-demos-check-");
    ok(db.failed === null, `all migrations apply${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
    rest = await H.startRestServer(db.socketDir);
    process.env["SUPABASE_URL"] = rest.url;
    process.env["SUPABASE_PUBLISHABLE_KEY"] = H.ANON_KEY;
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = H.SERVICE_KEY;
    process.env["INTRO_DEMO_KEY"] = "action-demos-check-key";
    const practice = await import("../src/lib/duel/practice.functions");
    const intro = await import("../src/lib/duel/introDemo.functions");
    const { saveActionDemos } = await import("./action-demos-save");
    const fns = { practiceGenerateFn: practice.practiceGenerateFn, saveIntroDemoFn: practice.saveIntroDemoFn, getIntroDemoFn: intro.getIntroDemoFn };
    const call: import("./action-demos-save").DemoCall = (fn, data) => H.callServerFn(fns[fn], data, null, { "cf-connecting-ip": "203.0.113.7" });
    console.error = () => {};
    console.warn = () => {};
    const wrong = await saveActionDemos(call, { key: "not-the-key" });
    const count = () => Number(db!.psql("SELECT count(*) FROM public.intro_demos").out.trim());
    ok(wrong.every((r) => !r.ok && /Forbidden/.test(r.text)) && count() === 0, `a wrong key saves nothing (${wrong.map((r) => r.text).join(" / ")})`);
    const dry = await saveActionDemos(call, { key: "", dry: true });
    ok(dry.every((r) => r.ok) && count() === 0, `--dry deals every game's example and saves nothing (${dry.filter((r) => !r.ok).map((r) => `${r.type}: ${r.text}`).join(" / ")})`);
    const saved = await saveActionDemos(call, { key: "action-demos-check-key" });
    for (const r of saved) ok(r.ok, `${r.type}: saved through saveIntroDemoFn and read back through getIntroDemoFn (${r.text})`);
    ok(count() === L.ACTION_DEMO_TYPES.length, `six rows in intro_demos (${count()})`);
    const stored = db.psql("SELECT game_type || ':' || seed || ':' || start_tick || ':' || length_ticks FROM public.intro_demos ORDER BY game_type").out.trim().split("\n");
    const want = L.ACTION_DEMO_TYPES.map((t) => `${t}:${runSeed(file.demos[t]!.run)}:${DEMO_START_TICK}:${DEMO_LENGTH_TICKS}`).sort();
    ok(JSON.stringify(stored) === JSON.stringify(want), `each row holds the run's seed and the intro's window (${stored.join(", ")})`);
    // A run recorded on another example (its digest moved) is refused before anything is sent.
    const moved = JSON.parse(JSON.stringify(file)) as typeof file;
    moved.demos.flip!.digest = "0000000000000000";
    const refused = await saveActionDemos(call, { key: "action-demos-check-key", games: ["flip"], file: moved });
    ok(refused.length === 1 && !refused[0]!.ok && /intro example/.test(refused[0]!.text), `a run on another example is refused (${refused[0]?.text})`);
    const offStamp = JSON.parse(JSON.stringify(file)) as typeof file;
    offStamp.demos.orbit!.stamp = 14;
    const refusedStamp = await saveActionDemos(call, { key: "action-demos-check-key", games: ["orbit"], file: offStamp });
    ok(!refusedStamp[0]!.ok && /plays only/.test(refusedStamp[0]!.text), `a run on a stamp the intro does not play is refused (${refusedStamp[0]?.text})`);
  } catch (err) {
    ok(false, `harness: ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 3).join(" | ") : String(err)}`);
  } finally {
    console.error = quiet.error;
    console.warn = quiet.warn;
    await rest?.stop();
    db?.stop();
  }
}

// The docs name the commands Joe runs.
const audit = readFileSync("docs/demo-replay-audit.md", "utf8");
ok(audit.includes("bun scripts/action-demos-save.ts --url=") && audit.includes("bun scripts/action-demos-record.ts"), "docs/demo-replay-audit.md gives the record and save commands");

console.log(`\naction-demos-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: the six Action intro demos are on the live stamps and examples, replay to good scores with clean windows, draw through the demo player, pass the stop rules, and save end to end.");
process.exit(0);
