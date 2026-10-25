/**
 * Review screenshots for expansion E8 (25 Oct 2026; a design tool, not a check): Wavefront wavRev 9,
 * Scrumper snipRev 10 and Tilt tiltRev 7 mid-play at 414×896, each new feature on screen.
 *
 *   bun scripts/shots/e8-shots.ts --url=<origin> [--out=screenshots/expansions-e8]
 *
 * Each frame is a practice run opened through the dev-only warp (src/lib/arcade/devWarp.ts): the page
 * plays a stored run (the expansion fixtures) up to a tick chosen here from the replayed states, so
 * the stage opens on that moment with the real renderer, frame and fill.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

import { gameDisplayName } from "../../src/lib/duel/gameNames";
import type { PuzzleType } from "../../src/lib/duel/types";
import type { ArcadeGame, ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { wavefrontGameFor, WAV_REV_EXPAND, type WavState } from "../../src/lib/arcade/wavefront";
import { snipGameFor, SNIP_REV_EXPAND, type SnipState } from "../../src/lib/arcade/snip";
import { tiltGameFor, TILT_REV_EXPAND, type TiltState } from "../../src/lib/arcade/tilt";
import { decodeWavefrontRun } from "../../src/lib/duel/wavefront";
import { decodeSnipRun } from "../../src/lib/duel/snip";
import { decodeTiltRun } from "../../src/lib/duel/tilt";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5191").replace(/\/$/, "");
const OUT = opt("out") ?? "screenshots/expansions-e8";
mkdirSync(OUT, { recursive: true });

const fixture = (name: string) => JSON.parse(gunzipSync(readFileSync(`scripts/fixtures/${name}.json.gz`)).toString());

interface Shot {
  game: PuzzleType;
  name: string;
  seed: number;
  events: readonly ArcadeInputEvent[];
  tick: number;
}

/** The first tick (from `from`) whose state passes `want`, playing the run on `game`. */
function findTick<S>(game: ArcadeGame<S, ArcadeInputEvent | null>, seed: number, events: readonly ArcadeInputEvent[], want: (s: S) => boolean, from = 1): number {
  const map = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  for (let t = 1; !game.isOver(s); t++) {
    s = game.step(s, map.get(t) ?? null);
    if (t >= from && want(s)) return t;
  }
  throw new Error("no tick shows the wanted moment");
}

const shots: Shot[] = [];
{
  const ace = fixture("wavefront-expand-runs").ace as { seed: number; raw: string };
  const events = decodeWavefrontRun(ace.raw).events;
  const g = wavefrontGameFor(WAV_REV_EXPAND);
  const add = (name: string, want: (s: WavState) => boolean) => shots.push({ game: "wavefront", name, seed: ace.seed, events, tick: findTick(g, ace.seed, events, want) });
  add("streak-spread", (s) => (s.spread ?? 0) > 0 && (s.streak ?? 0) >= 8 && !s.boss && s.bolts.length >= 2);
  add("shield", (s) => (s.shield ?? 0) > 0 && !s.boss && (s.streak ?? 0) >= 4);
  add("gunship", (s) => Boolean(s.boss) && (s.enter ?? 0) === 0 && s.wave <= 5);
  add("boss-weak-points", (s) => Boolean(s.boss) && (s.enter ?? 0) === 0 && s.wave > 5 && (s.weakHits ?? 0) > 0);
}
{
  const runs = fixture("snip-expand-runs").runs as { score: number; seed: number; raw: string }[];
  const best = runs.reduce((a, b) => (b.score > a.score ? b : a));
  const events = decodeSnipRun(best.raw).events;
  const g = snipGameFor(SNIP_REV_EXPAND);
  const add = (name: string, want: (s: SnipState) => boolean, from = 1) => shots.push({ game: "snip", name, seed: best.seed, events, tick: findTick(g, best.seed, events, want, from) });
  add("course-pan", (s) => s.levelTick === 30);
  add("golden-wind", (s) => (s.fruits ?? []).some((f) => f.gold > 0) && s.levelTick > 75 && (s.fruits?.length ?? 0) >= 2);
  add("several-fruits", (s) => (s.fruits?.length ?? 0) >= 3 && s.levelTick > 90);
}
{
  const best = (fixture("tilt-expand-best").runs as { seed: number; raw: string }[])[0]!;
  const events = decodeTiltRun(best.raw).events;
  const g = tiltGameFor(TILT_REV_EXPAND);
  const add = (name: string, want: (s: TiltState) => boolean) => shots.push({ game: "tilt", name, seed: best.seed, events, tick: findTick(g, best.seed, events, want) });
  add("quick-stars-ice", (s) => s.tick >= 200);
  add("key-gate", (s) => (s.keysTaken ?? 0) >= 1 && s.level === 0);
  add("two-marbles", (s) => s.level >= 1 && Boolean(s.b) && !s.bHome && !s.aHome && (s.quickTaken ?? 0) >= 3);
}

async function open(page: Page, game: PuzzleType): Promise<void> {
  await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
  await button.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1200);
  await button.click();
  await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 90_000 });
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
}

const browser = await chromium.launch();
for (const shot of shots) {
  const context = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await context.addInitScript((w) => {
    (window as unknown as { __duelzArcadeWarp: unknown }).__duelzArcadeWarp = w;
    (window as unknown as { __duelzEffects: string }).__duelzEffects = "full";
    try {
      localStorage.setItem("duelz-terms:v1", JSON.stringify({ agreed: true, at: "2026-10-25" }));
    } catch {
      /* private window */
    }
  }, { game: shot.game, seed: shot.seed, tick: shot.tick, events: shot.events });
  const page = await context.newPage();
  await open(page, shot.game);
  // The round's intro countdown, then a moment's play from the warped tick.
  await page.waitForTimeout(450);
  const file = join(OUT, `${shot.game}-${shot.name}-414x896.png`);
  await page.screenshot({ path: file });
  console.log(`${file}  (tick ${shot.tick})`);
  await context.close();
}
await browser.close();
