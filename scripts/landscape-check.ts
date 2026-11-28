/**
 * landscape-check (P4 desktop size PR 2, 28 Nov 2026; docs/desktop-support.md "Landscape board"; src/lib/gameFrame/
 * landscape.ts). The landscape board turns a portrait game's own world 90° clockwise on a computer, at the player's
 * choice, per game, off by default. Presentation and input mapping only: the identical world, deal and rules. Proves,
 * for every game that offers it (Meteor today):
 *
 *   1. The setting: offered only where a game's desktop entry has `landscape`, off on a fresh device, kept per game;
 *      PhoneShell turns a board only on a computer (never a phone or a tablet) and only while the round is live, gives a
 *      turned board no HUD band, and turns its keys by the entry's `keys`; a turned board never draws its HUD in the world.
 *   2. Recorded runs replay identically with landscape on: every recorded Meteor run in the fixtures (replay-runs.json,
 *      retro-demos.json, d5-levels-legacy.json.gz: every revision and level there) is played again as a landscape player
 *      would make it (each turn pressed as the screen key, and swiped as the screen swipe, that moves that way on the
 *      turned board), through the stage's own mapping (rotatedKey, directionOf, snakeTurnOfDirection; arenaDelta,
 *      snakeTurnOfSwipe): the input log it builds is byte for byte the recorded one, and the server's replay scores it as
 *      stored.
 *   3. The same intended moves give byte-identical input logs upright and turned: 300 seeded scripts of intended turns
 *      (keys, WASD and swipes mixed, on their ticks), each made as the upright player and as the landscape player would
 *      make them, through the same mapping, encode to the same bytes (encodeSnakeRun) and replay to the same state.
 *   4. No text drawn rotated: Meteor's frames of a recorded run with warps, gold stars and combos, drawn by its own
 *      renderer inside the stage's upright-text wrapper (uprightText.ts) with the HUD in the panel: every text reads
 *      upright once the rotor turns the canvas a quarter clockwise; with no turn, the wrapper draws exactly the same pixels.
 *   5. The real stage (headless Chromium, practice at 1440x900 with a mouse): off by default (no rotor); the Controls
 *      card's Board choice turns the board (a rotor) and back; with landscape on, each screen arrow key and each mouse
 *      swipe queues the world turn that moves that way on screen, the same turns the upright board queues for the same
 *      intended moves; a phone (390x844) and a sideways tablet (1180x820, touch) with landscape stored on are never turned.
 *
 * The third proof of the brief, arcade-self-replay-check staying green, is that check's own run.
 *
 *   bun scripts/landscape-check.ts [--no-browser]
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { createCanvas, retroArtFor } from "./retro-render-lib";

const { DESKTOP_MODES } = await import("../src/lib/duel/desktopModes");
const { LANDSCAPE_KEY, landscapeChosen, landscapeOffered, setLandscape } = await import("../src/lib/gameFrame/landscape");
const { rotatedKey } = await import("../src/lib/desktopPresentation");
const { directionOf } = await import("../src/lib/desktop");
const { arenaDelta } = await import("../src/components/puzzles/tapMapping");
const { snakeTurnOfDirection, snakeTurnOfSwipe } = await import("../src/lib/arcade/snakeTurns");
const { recordInput } = await import("../src/lib/arcade/engine");
const { snakeGameFor, SNAKE_INPUT_TURN, SNAKE_SWIPE_PX, SNAKE_RUN_TICKS } = await import("../src/lib/arcade/snake");
const { decodeSnakeRun, encodeSnakeRun, replaySnakeRun } = await import("../src/lib/duel/snake");
const { withUprightText, UPRIGHT_ON_TURNED } = await import("../src/lib/arcade/uprightText");
const { withHudInWorld, takeHud } = await import("../src/lib/arcade/hudPlacement");

type Dir = "up" | "right" | "down" | "left";
type Event = { t: number; k: number; a: number; b: number; c: number; d: number };

let passes = 0;
const ok = (line: string) => {
  passes++;
  console.log(`  ok ${line}`);
};

// ---------------------------------------------------------------- the two players' gestures for one intended turn
const WORLD_DIRS: readonly Dir[] = ["up", "right", "down", "left"];
/** Where a world direction shows on the turned board (a quarter clockwise): the world's up is the screen's right. */
const SCREEN_OF: Record<Dir, Dir> = { up: "right", right: "down", down: "left", left: "up" };
const ARROW: Record<Dir, string> = { up: "ArrowUp", right: "ArrowRight", down: "ArrowDown", left: "ArrowLeft" };
const LETTER: Record<Dir, string> = { up: "w", right: "d", down: "s", left: "a" };
const UNIT: Record<Dir, [number, number]> = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
/** An element inside the rotor (tapMapping.ts reads only `closest`), and one outside it. */
const turnedEl = { closest: (sel: string) => (sel === "[data-arena-rotor]" ? {} : null) } as unknown as Element;
const uprightEl = { closest: () => null } as unknown as Element;

/** The turn the stage queues for a key press: useGameKeys turns the key on a turned board, then the stage's own mapping. */
function turnOfKey(key: string, turned: boolean): number | null {
  const keys = turned ? DESKTOP_MODES.snake.landscape!.keys : null;
  const dir = directionOf(rotatedKey(key, keys));
  return dir ? snakeTurnOfDirection(dir) : null;
}
/** The turn the stage queues for a swipe moved (dx, dy) on screen. */
function turnOfSwipe(dx: number, dy: number, turned: boolean): number | null {
  const move = arenaDelta(turned ? turnedEl : uprightEl, dx, dy);
  return snakeTurnOfSwipe(move.dx, move.dy, SNAKE_SWIPE_PX);
}
type Gesture = "arrow" | "letter" | "swipe";
/** What a player does on screen for an intended world direction: upright, the same direction; turned, where it shows. */
function gestureTurn(world: Dir, gesture: Gesture, turned: boolean, length = 40): number | null {
  const screen = turned ? SCREEN_OF[world] : world;
  if (gesture === "arrow") return turnOfKey(ARROW[screen], turned);
  if (gesture === "letter") return turnOfKey(LETTER[screen], turned);
  const [ux, uy] = UNIT[screen];
  return turnOfSwipe(ux * length + uy * 3, uy * length - ux * 3, turned);
}
/** The input log the stage records for a list of (tick, turn): its own recordInput, as the frame loop calls it. */
function logOf(turns: readonly { t: number; turn: number | null }[], rev: number | undefined): Event[] {
  const game = snakeGameFor(rev);
  const events: Event[] = [];
  for (const { t, turn } of turns) recordInput(events as never, turn === null ? null : { t, k: SNAKE_INPUT_TURN, a: turn, b: 0, c: 0, d: 0 }, game.inputRanges);
  return events;
}

// ---------------------------------------------------------------- 1: the setting and where it applies
{
  const offering = Object.entries(DESKTOP_MODES).filter(([, info]) => info.landscape).map(([type]) => type);
  assert.deepEqual(offering, ["snake"], "Meteor alone offers the landscape board today");
  for (const type of offering) {
    assert.ok(landscapeOffered(type), `${type}: offered`);
    assert.equal(DESKTOP_MODES[type as "snake"].mode, "tall", `${type}: upright by default (mode tall)`);
  }
  assert.ok(!landscapeOffered("pool") && !landscapeOffered("flip"), "nothing else is offered it");
  // Off on a fresh device, kept per game (a stand-in localStorage; the module reads storage lazily).
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } });
  assert.equal(landscapeChosen("snake"), false, "off on a fresh device");
  setLandscape("snake", true);
  assert.equal(landscapeChosen("snake"), true, "on once chosen");
  assert.equal(store.get(LANDSCAPE_KEY), '["snake"]', "kept on the device under duelz-landscape:v1");
  setLandscape("pool", true);
  assert.equal(landscapeChosen("pool"), false, "a game that doesn't offer it can't be switched on");
  setLandscape("snake", false);
  assert.equal(landscapeChosen("snake"), false, "and off again");
  const shell = readFileSync("src/components/duel/PhoneShell.tsx", "utf8");
  assert.match(shell, /const landscape = Boolean\(desktop && gameScreen && landscapeChoice && modeInfo\?\.landscape\);/, "a computer's game screen only, where the game offers it");
  assert.match(shell, /const turnedPlay = Boolean\(presented && play && \(modeInfo\?\.mode === "rotate" \|\| landscape\)\);/, "turned only while the round is live");
  assert.match(shell, /landscape \? \(modeInfo\?\.landscape\?\.keys \?\? null\)/, "its keys turn as the entry says");
  assert.match(shell, /hudBand: arena && arcadePlay && !turnedPlay \? hudBandFor\(gameType\) : undefined,/, "a turned board has no HUD band");
  const hud = readFileSync("src/lib/gameFrame/arenaHud.ts", "utf8");
  assert.match(hud, /withHudInWorld\(!\(onArena && ARENA_HUD_IN_PANEL\) \|\| \(arenaPanelsHidden\(\) && !turnedRef\.current\)/, "a turned board never draws its HUD in the world");
  const stage = readFileSync("src/puzzles/snake.tsx", "utf8");
  assert.match(stage, /queueTurn\(snakeTurnOfDirection\(dir\)\)/, "the stage queues a key's turn through snakeTurnOfDirection");
  assert.match(stage, /const move = arenaDelta\(wrap\.current, event\.clientX - from\.x, event\.clientY - from\.y\);\s*const turn = snakeTurnOfSwipe\(move\.dx, move\.dy, SNAKE_SWIPE_PX\);/, "and a swipe's through arenaDelta and snakeTurnOfSwipe");
  assert.match(stage, /withUprightText\(context, turnedRef\.current \? UPRIGHT_ON_TURNED : 0,/, "and draws inside the upright-text wrapper when turned");
  ok("offered by Meteor alone, off by default and kept per game; computers only, live rounds only, no band, HUD out of the world; the stage maps through the shared functions");
}

// ---------------------------------------------------------------- 2: recorded runs, played again on the landscape board
{
  const parse = (path: string) => JSON.parse(path.endsWith(".gz") ? gunzipSync(readFileSync(path)).toString("utf8") : readFileSync(path, "utf8"));
  const runs: { source: string; rev?: number; level?: string; raw: string }[] = [];
  for (const r of parse("scripts/fixtures/replay-runs.json").runs) if (r.type === "snake") runs.push({ source: `replay-runs.json "${r.label}"`, rev: r.puzzle.snakeRev, level: r.puzzle.level, raw: r.answer });
  for (const d of parse("scripts/retro-demos.json").demos) if (d.type === "snake") runs.push({ source: "retro-demos.json", rev: d.puzzle.snakeRev, level: d.puzzle.level, raw: d.run });
  for (const r of parse("scripts/fixtures/d5-levels-legacy.json.gz")) if (r.game === "snake") runs.push({ source: `d5-levels-legacy (${r.level}, ${r.who})`, rev: r.puzzle.snakeRev, level: r.puzzle.level, raw: r.answer });
  assert.ok(runs.length >= 30, `at least 30 recorded Meteor runs (${runs.length})`);
  const gestures: Gesture[] = ["arrow", "letter", "swipe"];
  let turns = 0;
  for (const [i, r] of runs.entries()) {
    const run = decodeSnakeRun(r.raw);
    const recorded = encodeSnakeRun(run);
    assert.equal(recorded, r.raw.split("~")[0], `${r.source}: the recorded run's bytes (its encoding is canonical)`);
    const replayed = logOf(
      run.events.map((e, j) => {
        assert.equal(e.k, SNAKE_INPUT_TURN, `${r.source}: a turn event`);
        turns++;
        return { t: e.t, turn: gestureTurn(WORLD_DIRS[e.a]!, gestures[(i + j) % 3]!, true) };
      }),
      r.rev,
    );
    const again = encodeSnakeRun({ ...run, events: replayed });
    assert.equal(again, recorded, `${r.source}: the landscape player's log is the recorded log, byte for byte`);
    const score = replaySnakeRun(run.seed, again, r.rev, (r.level ?? null) as never).score;
    assert.equal(score, run.claimedScore, `${r.source}: replays to its stored score (${score} / ${run.claimedScore})`);
  }
  ok(`${runs.length} recorded Meteor runs (${turns} turns), each turn pressed or swiped on the landscape board: the same bytes, the same stored score`);
}

// ---------------------------------------------------------------- 3: the same intended moves, upright and turned
{
  let rng = 20261128;
  const next = (n: number) => {
    rng = (Math.imul(rng ^ (rng >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return rng % n;
  };
  const gestures: Gesture[] = ["arrow", "letter", "swipe"];
  let compared = 0;
  for (let s = 0; s < 300; s++) {
    const intents: { t: number; world: Dir; gesture: Gesture; length: number }[] = [];
    let t = 0;
    for (let n = 0, count = 5 + next(60); n < count; n++) {
      t += 1 + next(90);
      if (t > SNAKE_RUN_TICKS) break;
      intents.push({ t, world: WORLD_DIRS[next(4)]!, gesture: gestures[next(3)]!, length: SNAKE_SWIPE_PX + next(120) });
    }
    const seed = 1 + next(2_000_000_000);
    const upright = logOf(intents.map((i) => ({ t: i.t, turn: gestureTurn(i.world, i.gesture, false, i.length) })), undefined);
    const turned = logOf(intents.map((i) => ({ t: i.t, turn: gestureTurn(i.world, i.gesture, true, i.length) })), undefined);
    const a = encodeSnakeRun({ seed, claimedScore: 0, events: upright });
    const b = encodeSnakeRun({ seed, claimedScore: 0, events: turned });
    assert.equal(b, a, `script ${s}: the turned board's log is the upright board's, byte for byte`);
    assert.equal(upright.length, intents.length, `script ${s}: every intended turn was queued`);
    const ra = replaySnakeRun(seed, a);
    const rb = replaySnakeRun(seed, b);
    assert.equal(JSON.stringify(rb.state), JSON.stringify(ra.state), `script ${s}: the same end state`);
    compared += intents.length;
  }
  // A swipe shorter than the swipe threshold queues nothing, upright and turned alike.
  for (const world of WORLD_DIRS) {
    assert.equal(gestureTurn(world, "swipe", false, SNAKE_SWIPE_PX - 4), null, "a short swipe upright: nothing");
    assert.equal(gestureTurn(world, "swipe", true, SNAKE_SWIPE_PX - 4), null, "a short swipe turned: nothing");
  }
  ok(`300 scripts of intended moves (${compared} turns by arrows, WASD and swipes): the same bytes and end state upright and turned`);
}

// ---------------------------------------------------------------- 4: no text drawn rotated
{
  const { snakeArtGame } = await import("../src/lib/arcade/snake.renderer");
  void retroArtFor;
  const parse = (path: string) => JSON.parse(readFileSync(path, "utf8"));
  // A recorded run with warps, gold stars and combos (their pops are text).
  const r = parse("scripts/fixtures/replay-runs.json").runs.filter((x: { type: string }) => x.type === "snake").at(-1);
  const run = decodeSnakeRun(r.answer);
  const game = snakeGameFor(r.puzzle.snakeRev);
  const byTick = new Map(run.events.map((e) => [e.t, e]));
  const proto = Object.getPrototypeOf(createCanvas(1, 1).getContext("2d")) as Record<string, (...a: unknown[]) => unknown>;
  const angles: { text: string; angle: number }[] = [];
  const spy = (name: string) => {
    const original = proto[name]!;
    proto[name] = function (this: CanvasRenderingContext2D, ...a: unknown[]) {
      const m = this.getTransform();
      angles.push({ text: String(a[0]), angle: Math.atan2(m.b, m.a) });
      return original.apply(this, a);
    };
    return () => void (proto[name] = original);
  };
  const W = 468;
  const H = 868;
  const size = { width: W, height: H };
  let state = game.init(run.seed);
  let frames = 0;
  // One canvas for the run, as on screen: the renderer's pops fire when a counter rises between two draws on it.
  const turnedCanvas = createCanvas(W, H);
  let identical = 0;
  const turnedTexts = new Set<string>();
  const undo = [spy("fillText"), spy("strokeText")];
  try {
    for (let t = 1; t <= Math.min(SNAKE_RUN_TICKS, run.endTick || SNAKE_RUN_TICKS) && !game.isOver(state); t++) {
      state = game.step(state, (byTick.get(t) ?? null) as never);
      if (t % 15 !== 0) continue;
      frames++;
      // Turned: the stage's wrapper (the HUD in the panel, as on the arena).
      turnedCanvas.width = W;
      const turnedCtx = turnedCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      const before = angles.length;
      withHudInWorld(false, () => withUprightText(turnedCtx, UPRIGHT_ON_TURNED, () => snakeArtGame.draw(turnedCtx, state, size)));
      takeHud();
      for (const { text, angle } of angles.slice(before)) {
        turnedTexts.add(text);
        // The rotor turns the canvas a quarter clockwise: on screen the text's angle is its own plus π/2.
        const screen = Math.atan2(Math.sin(angle + Math.PI / 2), Math.cos(angle + Math.PI / 2));
        assert.ok(Math.abs(screen) < 1e-9, `tick ${t}: "${text}" drawn at ${((screen * 180) / Math.PI).toFixed(2)}° on screen`);
      }
      // No turn: the wrapper draws exactly the same pixels as no wrapper.
      if (frames % 8 === 0) {
        const plain = createCanvas(W, H);
        const wrapped = createCanvas(W, H);
        snakeArtGame.draw(plain.getContext("2d") as never, state, size);
        const wctx = wrapped.getContext("2d") as unknown as CanvasRenderingContext2D;
        withUprightText(wctx, 0, () => snakeArtGame.draw(wctx, state, size));
        assert.ok(Buffer.from(plain.getContext("2d").getImageData(0, 0, W, H).data).equals(Buffer.from(wrapped.getContext("2d").getImageData(0, 0, W, H).data)), `tick ${t}: no turn, the same pixels`);
        identical++;
      }
    }
  } finally {
    for (const u of undo) u();
  }
  assert.ok(turnedTexts.size >= 1, "Meteor's turned frames drew text to check");
  assert.ok(![...turnedTexts].some((t) => /^(STARS|ROCKS|BONUS)\b/.test(t)), `no HUD text drawn in a turned world (${[...turnedTexts].join(", ")})`);
  ok(`${frames} turned frames of a recorded run: every text upright on screen (${[...turnedTexts].slice(0, 8).join(", ")}), no HUD text in the world; ${identical} unturned frames pixel-identical through the wrapper`);
}

// ---------------------------------------------------------------- 5: the real stage
if (!process.argv.includes("--no-browser")) {
  const { CHROMIUM_PATHS, fixThemeClock } = await import("./theme-screens");
  const { startSafeAreaServer } = await import("./safe-area-server");
  const { ONBOARDING_KEY } = await import("../src/lib/onboarding");
  const { generatePuzzle } = await import("../src/lib/duel/generate.server");
  const { withSeededRandom } = await import("../src/lib/duel/random");
  const { splitPuzzle } = await import("../src/lib/duel/secrets");
  const chromiumPath = CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p)));
  if (!chromiumPath) {
    console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
    process.exit(1);
  }
  const puzzles = { snake: splitPuzzle(withSeededRandom(41, () => generatePuzzle("snake" as never))).pub };
  const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-landscape", buildId: "landscape-check" });
  fixThemeClock();
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: chromiumPath });
  type Opts = { w: number; h: number; land: boolean; touch?: boolean };
  const open = async (o: Opts) => {
    const context = await browser.newContext({ viewport: { width: o.w, height: o.h }, hasTouch: Boolean(o.touch), isMobile: Boolean(o.touch) });
    await context.addInitScript((r) => {
      (window as unknown as Record<string, unknown>).__harness = { puzzles: r.puzzles, verdict: { isCorrect: true, score: 150 }, latencyMs: 50, submissions: [], verdictAt: null, room: null, search: { game: "snake" } };
      try {
        localStorage.setItem(r.key, "1");
        if (r.land) localStorage.setItem("duelz-landscape:v1", '["snake"]');
      } catch {
        /* none */
      }
    }, { puzzles, key: ONBOARDING_KEY, land: o.land });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${server.origin}/safe-area.html?mode=practice`, { timeout: 180_000 });
    const ready = page.getByRole("button", { name: /^Ready/ }).first();
    await ready.waitFor({ timeout: 60_000 });
    await ready.click();
    await page.locator("[data-game-stage] canvas").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    return { context, page, errors };
  };
  const turned = (page: import("playwright").Page) => page.evaluate(() => Boolean(document.querySelector("[data-arena-rotor] [data-game-arena]")));
  const queued = async (page: import("playwright").Page, act: () => Promise<void>) => {
    await page.evaluate(() => ((window as unknown as Record<string, unknown>).__duelzPayloads = []));
    await act();
    await page.waitForTimeout(150);
    return page.evaluate(() => ((window as unknown as { __duelzPayloads: { a: number }[] }).__duelzPayloads ?? []).map((p) => p.a));
  };
  const keysFor = async (page: import("playwright").Page, keys: readonly string[]) =>
    queued(page, async () => {
      for (const key of keys) {
        await page.keyboard.press(key);
        await page.waitForTimeout(120);
      }
    });
  const swipesFor = async (page: import("playwright").Page, dirs: readonly Dir[]) =>
    queued(page, async () => {
      const box = (await page.locator("[data-game-stage] canvas").first().boundingBox())!;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      for (const d of dirs) {
        const [ux, uy] = UNIT[d];
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx + ux * 40, cy + uy * 40, { steps: 6 });
        await page.mouse.up();
        await page.waitForTimeout(120);
      }
    });
  const intended: Dir[] = ["up", "right", "down", "left"];
  const want = intended.map((d) => snakeTurnOfDirection(d));
  try {
    // Off by default: a fresh computer draws the upright board; the same intended moves queue the world turns.
    {
      const { context, page, errors } = await open({ w: 1440, h: 900, land: false });
      assert.equal(await turned(page), false, "1440x900, fresh: the board upright (off by default)");
      assert.deepEqual(await keysFor(page, intended.map((d) => ARROW[d])), want, "upright: the arrows queue the world turns");
      assert.deepEqual(await swipesFor(page, intended), want, "upright: swipes queue the world turns");
      // The Controls card's Board choice turns it, and back.
      await page.getByRole("button", { name: "Landscape", exact: true }).first().click();
      await page.waitForTimeout(400);
      assert.equal(await turned(page), true, "the Board choice turns the board");
      const upright = page.getByRole("button", { name: "Upright", exact: true }).first();
      if (!(await upright.isVisible())) await page.locator("[data-controls-toggle]").first().click();
      await upright.click();
      await page.waitForTimeout(400);
      assert.equal(await turned(page), false, "and back upright");
      assert.deepEqual(errors, [], "no page errors");
      await context.close();
    }
    // On: the same intended moves, made where they show on the turned board, queue the same world turns.
    for (const [w, h] of [[1440, 900], [1366, 768], [1920, 1080]] as const) {
      const { context, page, errors } = await open({ w, h, land: true });
      assert.equal(await turned(page), true, `${w}x${h}, landscape on: the board turned`);
      assert.deepEqual(await keysFor(page, intended.map((d) => ARROW[SCREEN_OF[d]])), want, `${w}x${h}: the screen arrows queue the world turns they show`);
      assert.deepEqual(await keysFor(page, intended.map((d) => LETTER[SCREEN_OF[d]])), want, `${w}x${h}: WASD as well`);
      assert.deepEqual(await swipesFor(page, intended.map((d) => SCREEN_OF[d])), want, `${w}x${h}: and mouse swipes`);
      assert.equal(await page.evaluate(() => document.querySelector("[data-arena-slot]")?.hasAttribute("data-arena-crop") ?? false), false, `${w}x${h}: no HUD band on a turned board`);
      assert.deepEqual(errors, [], `${w}x${h}: no page errors`);
      await context.close();
    }
    // Never on a phone or a sideways tablet, whatever is stored.
    for (const o of [{ w: 390, h: 844, land: true, touch: true }, { w: 1180, h: 820, land: true, touch: true }] as const) {
      const { context, page, errors } = await open(o);
      assert.equal(await turned(page), false, `${o.w}x${o.h} touch, landscape stored on: never turned`);
      assert.deepEqual(errors, [], `${o.w}x${o.h}: no page errors`);
      await context.close();
    }
    ok("the real stage: off by default; the Board choice turns it and back; turned at 1440x900, 1366x768 and 1920x1080 the screen's arrows, WASD and swipes queue the world turns the upright board queues; never turned on a phone or tablet");
  } finally {
    await browser.close();
    await server.close();
  }
}

console.log(`PASS landscape-check: ${passes} sections`);
process.exit(0);
