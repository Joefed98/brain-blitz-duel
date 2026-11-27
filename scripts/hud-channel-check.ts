/**
 * hud-channel-check (22 Nov 2026, the arcade HUD value channel for the arena's panel; P4's "The canvas HUD in the
 * panel" in docs/desktop-support.md; display only, ~10 s, no browser). Proves, with ARENA_HUD_IN_PANEL on (Changed with Joe's approval, 27 Nov 2026):
 *
 *   1. Each HUD painter (retroHud, drawActionHud, drawHudPill, drawHudPillRow, drawHudTextPillRow and the cards'
 *      drawChip) notes exactly its items into hudPlacement.ts inside a stage's draw (`withHudInWorld`), both in the
 *      world and off it, with a pill row's second-row pills noted once;
 *   2. off the world nothing is drawn (every pixel left clear), and drawHudPill now honours the flag like the others;
 *   3. nothing is kept outside a stage's draw (replays, reveals, stills), and each draw starts a fresh list;
 *   4. what each painter draws is unchanged: every pixel identical drawn inside a stage's draw and outside one, for the
 *      painters and for all ten Retro games' own renderers on a skill-band bot's run (retro-render-lib.ts), and each of
 *      those games notes its main count;
 *   5. the panel's store (src/lib/rated/liveHud.ts) publishes at most 4 times a second, only on a change, publishes a
 *      held-back change on a later offer, and clears;
 *   6. the flag is on, and the stage offers the values only on the arena and clears them when it goes (Changed with Joe's approval, 27 Nov 2026).
 *
 *   bun scripts/hud-channel-check.ts
 */
import { createCanvas, RETRO_TYPES, retroArtFor, retroRun, retroWorldSize } from "./retro-render-lib";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { noteHud, takeHud, withHudInWorld, hudInWorld } = await import("../src/lib/arcade/hudPlacement");
const { retroHud } = await import("../src/lib/arcade/retro.renderer");
const { drawActionHud } = await import("../src/lib/arcade/actionHud.renderer");
const { drawHudPill, drawHudPillRow, drawHudTextPillRow } = await import("../src/lib/arcade/hudPill.renderer");
const { drawChip } = await import("../src/lib/arcade/cards/cards.renderer");
const live = await import("../src/lib/rated/liveHud");
const { ARENA_HUD_IN_PANEL } = await import("../src/lib/gameFrame/arena");

let passes = 0;
const ok = (line: string) => {
  passes++;
  console.log(`  ok ${line}`);
};

type Ctx = CanvasRenderingContext2D;
const W = 390;
const H = 120;
const pixels = (paint: (ctx: Ctx) => void, w = W, h = H): Buffer => {
  const c = createCanvas(w, h);
  paint(c.getContext("2d") as unknown as Ctx);
  return Buffer.from(c.getContext("2d").getImageData(0, 0, w, h).data);
};
const blank = pixels(() => {});

// The painters, each with the items it must note.
const PAINTERS: { name: string; paint: (ctx: Ctx) => void; items: { label: string; value: string; gold?: boolean; main?: boolean }[] }[] = [
  {
    name: "retroHud",
    paint: (ctx) => retroHud(ctx, W, { text: "SCORE 1200" }, [{ text: "WAVE 2 OF 5" }, null, { text: "LIVES 3" }]),
    items: [{ label: "", value: "SCORE 1200", main: true }, { label: "", value: "WAVE 2 OF 5" }, { label: "", value: "LIVES 3" }],
  },
  {
    name: "drawActionHud",
    paint: (ctx) =>
      drawActionHud(ctx, W, [
        { left: [{ label: "HEIGHT", value: "120 m" }, { label: "FLOW", value: "×3", tone: "gold" }], right: [{ label: "", value: "0:42" }] },
        { left: [{ label: "RIDES", value: "2/6" }] },
      ]),
    items: [{ label: "HEIGHT", value: "120 m" }, { label: "FLOW", value: "×3", gold: true }, { label: "", value: "0:42" }, { label: "RIDES", value: "2/6" }],
  },
  {
    name: "drawHudPill",
    paint: (ctx) => drawHudPill(ctx, 10, 10, "Maze", "1 / 4", { gold: true }),
    items: [{ label: "Maze", value: "1 / 4", gold: true }],
  },
  {
    name: "drawHudPillRow (with a second row handed back)",
    paint: (ctx) => {
      const pills = [{ label: "Score", value: "142" }, { label: "Popped", value: "12" }, { label: "Shots", value: "8" }, { label: "Combo", value: "×2", opts: { gold: true } }];
      const first = drawHudPillRow(ctx, 10, 10, pills, 200);
      drawHudPillRow(ctx, 10, 44, first.rest);
    },
    items: [{ label: "Score", value: "142" }, { label: "Popped", value: "12" }, { label: "Shots", value: "8" }, { label: "Combo", value: "×2", gold: true }],
  },
  {
    name: "drawHudTextPillRow",
    paint: (ctx) => drawHudTextPillRow(ctx, [{ text: "Fuel 80%" }, { text: "Planets 3" }], 10, 10, W - 10),
    items: [{ label: "", value: "Fuel 80%" }, { label: "", value: "Planets 3" }],
  },
  {
    name: "the cards' drawChip",
    paint: (ctx) => {
      drawChip(ctx, 10, 10, "HOME", "12", { gold: true });
      drawChip(ctx, 120, 10, "MOVES", "40");
    },
    items: [{ label: "HOME", value: "12", gold: true }, { label: "MOVES", value: "40" }],
  },
];

// 1–4: the painters.
for (const p of PAINTERS) {
  const order = (items: { label: string; value: string }[]) => items.map((i) => `${i.label}|${i.value}`).sort();
  const plain = pixels(p.paint);
  assert.notDeepEqual(plain, blank, `${p.name}: draws something in the world`);
  const scoped = pixels((ctx) => withHudInWorld(true, () => p.paint(ctx)));
  const inWorld = takeHud();
  assert.ok(scoped.equals(plain), `${p.name}: every pixel identical drawn inside a stage's draw`);
  const hidden = pixels((ctx) => withHudInWorld(false, () => p.paint(ctx)));
  const off = takeHud();
  assert.ok(hidden.equals(blank), `${p.name}: off the world nothing is drawn`);
  assert.deepEqual(order(off), order(p.items), `${p.name}: off the world it notes its items`);
  assert.deepEqual(order(inWorld), order(p.items), `${p.name}: in the world it notes its items, each once`);
  for (const want of p.items) {
    const got = off.find((i) => i.label === want.label && i.value === want.value)!;
    assert.equal(!!got.gold, !!want.gold, `${p.name}: ${want.label} ${want.value}'s gold`);
    assert.equal(!!got.main, !!want.main, `${p.name}: ${want.label} ${want.value}'s main`);
  }
  ok(`${p.name}: ${p.items.length} item(s) noted in and off the world, nothing drawn off it, pixels identical in a stage's draw`);
}

// 3: nothing kept outside a stage's draw; each draw starts fresh; the flag is restored.
{
  withHudInWorld(true, () => noteHud({ label: "A", value: "1" }));
  noteHud({ label: "stray", value: "x" });
  pixels((ctx) => PAINTERS[0]!.paint(ctx));
  assert.deepEqual(takeHud(), [{ label: "A", value: "1" }], "outside a stage's draw nothing is noted");
  withHudInWorld(false, () => {});
  assert.deepEqual(takeHud(), [], "each stage draw starts a fresh list");
  assert.equal(hudInWorld(), true, "the placement is back in the world after a draw");
  const a = takeHud();
  a.push({ label: "mutated", value: "!" });
  assert.deepEqual(takeHud(), [], "takeHud hands out a copy");
  ok("nothing is kept outside a stage's draw, each draw starts fresh, the flag is restored and takeHud copies");
}

// 4: the ten Retro games' own renderers.
for (const type of RETRO_TYPES) {
  const run = await retroRun(type, { every: 600, until: 0.4 });
  const draw = await retroArtFor(type, run.rev);
  const state = run.states.at(-1)!;
  const size = await retroWorldSize(type, state);
  const w = Math.round(size.width);
  const h = Math.round(size.height);
  const paint = (ctx: Ctx) => draw(ctx, state, { width: w, height: h });
  const before = pixels(paint, w, h);
  const scoped = pixels((ctx) => withHudInWorld(true, () => paint(ctx)), w, h);
  const items = takeHud();
  const after = pixels(paint, w, h);
  assert.ok(after.equals(before), `${type}: the renderer draws the same frame twice (the comparison is sound)`);
  assert.ok(scoped.equals(before), `${type}: every pixel identical drawn inside a stage's draw`);
  assert.ok(items.some((i) => i.main && i.value.length > 0), `${type}: its HUD notes a main count (${JSON.stringify(items)})`);
  ok(`${type} (rev ${run.rev}): pixels identical inside a stage's draw; noted ${items.map((i) => i.value).join(" · ")}`);
}

// 5: the panel's store.
{
  let calls = 0;
  const off = live.subscribeLiveHud(() => calls++);
  live.clearLiveHud();
  calls = 0;
  const a = [{ label: "Score", value: "1" }];
  const b = [{ label: "Score", value: "2" }];
  const c = [{ label: "Score", value: "3" }];
  live.offerLiveHud(a, 1_000);
  assert.equal(calls, 1, "the first list publishes");
  assert.deepEqual(live.readLiveHud(), a, "and reads back");
  const snap = live.readLiveHud();
  live.offerLiveHud([{ label: "Score", value: "1" }], 2_000);
  assert.equal(calls, 1, "an unchanged list publishes nothing");
  assert.equal(live.readLiveHud(), snap, "and keeps the same array");
  live.offerLiveHud(b, 2_100);
  assert.equal(calls, 2, "a change publishes");
  live.offerLiveHud(c, 2_100 + live.LIVE_HUD_MIN_GAP_MS - 1);
  assert.deepEqual(live.readLiveHud(), b, "a change inside 250 ms is held back");
  live.offerLiveHud(c, 2_100 + live.LIVE_HUD_MIN_GAP_MS);
  assert.deepEqual(live.readLiveHud(), c, "and published on a later offer");
  assert.equal(calls, 3, "one publish for it");
  live.offerLiveHud([{ label: "Score", value: "3", gold: true }], 9_000);
  assert.equal(calls, 4, "gold counts as a change");
  live.clearLiveHud();
  assert.deepEqual(live.readLiveHud(), [], "clear empties it");
  assert.equal(calls, 5, "and tells the panel");
  live.offerLiveHud(a, 9_001);
  assert.deepEqual(live.readLiveHud(), a, "after a clear the next list publishes at once");
  off();
  live.offerLiveHud(b, 20_000);
  assert.equal(calls, 6, "an unsubscribed listener hears nothing");
  live.clearLiveHud();
  // At most 4 publishes a second whatever is offered.
  let n = 0;
  const off2 = live.subscribeLiveHud(() => n++);
  for (let t = 0; t < 10_000; t += 16) live.offerLiveHud([{ label: "t", value: String(t) }], 100_000 + t);
  off2();
  live.clearLiveHud();
  assert.ok(n <= 41, `at most 4 publishes a second (${n} in 10 s)`);
  ok(`the panel's store: on a change only, at most 4 a second (${n} publishes in 10 s of 60 fps offers), held-back changes published, clears`);
}

// 6: the flag is on; the stage offers on the arena only and clears on unmount (Changed with Joe's approval, 27 Nov 2026).
{
  assert.equal(ARENA_HUD_IN_PANEL, true, "ARENA_HUD_IN_PANEL is on"); // Changed with Joe's approval, 27 Nov 2026
  const stage = readFileSync("src/components/puzzles/ArcadeCanvasStage.tsx", "utf8");
  assert.match(stage, /withHudInWorld\(!\(arenaRef\.current && ARENA_HUD_IN_PANEL\)/, "the stage's draw sets the placement");
  assert.match(stage, /if \(arenaRef\.current\) offerLiveHud\(takeHud\(\), performance\.now\(\)\);/, "the stage offers the noted values on the arena only");
  assert.match(stage, /cancelArenaFrame\(loop, frame\);\s*clearLiveHud\(\);/, "the stage clears the store when it goes");
  ok("ARENA_HUD_IN_PANEL is on; the stage offers its values on the arena only and clears them when it goes"); // Changed with Joe's approval, 27 Nov 2026
}

console.log(`PASS hud-channel-check: ${passes} sections`);
