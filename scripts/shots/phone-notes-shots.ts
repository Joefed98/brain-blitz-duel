/**
 * Before / after review frames for Joe's phone notes (27 Oct 2026, docs/phone-notes-oct-2026/): Breaker, Rally,
 * Tempo, Meteor, High Rise, Coral Pop, Slice and Swish drawn by their real renderers (@napi-rs/canvas) at the
 * iPhone 11 home-screen app's width (414 px, 2× pixels), from a "great" skill-band bot run on the revision rooms deal
 * (LIVE_BANDS), at moments picked by what they show. Not a check.
 *
 * It reads only names that exist before and after the phone notes, so the same file run in a worktree of main draws
 * the "before" frames on the old stamps:
 *
 *   bun scripts/shots/phone-notes-shots.ts --out=<dir> --tag=after      (this tree)
 *   bun scripts/shots/phone-notes-shots.ts --out=<dir> --tag=before     (a main worktree with this file copied in)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, GlobalFonts, Path2D as NapiPath2D } from "@napi-rs/canvas";

let clockMs = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clockMs } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), devicePixelRatio: 2, getComputedStyle: (el: { style?: Record<string, string> }) => el.style ?? {} },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });
for (const f of ["archivo-var-latin.woff2", "jetbrains-mono-600-700-latin.woff2", "manrope-500-800-latin.woff2"]) {
  try {
    GlobalFonts.registerFromPath(`public/fonts/${f}`);
  } catch {
    /* a missing font falls back */
  }
}
GlobalFonts.registerFromPath("public/fonts/jetbrains-mono-600-700-latin.woff2", "JetBrains Mono");

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const OUT = opt("out") ?? ".shots/phone-notes";
const TAG = opt("tag") ?? "after";
mkdirSync(OUT, { recursive: true });

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const { GAME_BY_TYPE } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const { LIVE_BANDS } = await import("../../src/lib/arcade/liveBands");
const { ARCADE_REVEAL_RENDERERS, revealWorldH } = await import("../../src/lib/arcade/revealRenderers");
const { breakerArtGameFor } = await import("../../src/lib/arcade/breaker.renderer");
const { rallyArtGame } = await import("../../src/lib/arcade/rally.renderer");
const { beatArtGame } = await import("../../src/lib/arcade/beat.renderer");
const { snakeArtGame } = await import("../../src/lib/arcade/snake.renderer");
const { skylineArtGame } = await import("../../src/lib/arcade/skyline.renderer");
const { bubbleArtGame } = await import("../../src/lib/arcade/bubble.renderer");
const { sliceArtGame } = await import("../../src/lib/arcade/slice.renderer");
const { binTossArtGame } = await import("../../src/lib/arcade/binTossArt.renderer");

/** Every state of a skill-band bot (great unless named)'s run on room sample n, on the revision rooms deal. */
async function states(type: string, n: number, level = "great"): Promise<{ rev: number; frames: Any[] }> {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const rev = (LIVE_BANDS as Any)[type].rev as number;
  const bot = (await import(`../arcade-skill-bands/bots/${type}.ts`)).bot;
  const seed = spec.seedForRev?.(n, rev) ?? spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: new Human(type as never, seed, level as never), fixes: true });
  const by = new Map((out.events ?? []).map((e: Any) => [e.t, e]));
  let s = game.init(seed);
  const all = [s];
  while (!game.isOver(s)) {
    s = game.step(s, by.get(s.tick + 1) ?? null);
    all.push(s);
  }
  return { rev, frames: all };
}

/** The play-screen size the reveal draws this revision at (390 wide), scaled to 414. */
function sizeFor(type: string, rev: number): { width: number; height: number } {
  const field = (LIVE_BANDS as Any)[type].field as string;
  const h = revealWorldH(ARCADE_REVEAL_RENDERERS[type]!, { type, [field]: rev } as Any);
  return { width: 414, height: Math.round((h * 414) / 390) };
}

function shoot(name: string, type: string, rev: number, draw: (ctx: Any, s: Any, size: { width: number; height: number }) => void, frames: Any[], pick: number): void {
  const size = sizeFor(type, rev);
  const at = Math.max(0, Math.min(frames.length - 1, pick));
  const canvas = createCanvas(size.width * 2, size.height * 2);
  const ctx = canvas.getContext("2d") as Any;
  // Warm the renderer's memories (trails, pops, pulses) over the half second before the frame.
  for (let i = Math.max(0, at - 30); i <= at; i++) {
    clockMs = 10_000 + i * (1000 / 60);
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    draw(ctx, frames[i], size);
  }
  const file = `${OUT}/${name}-414-${TAG}.png`;
  writeFileSync(file, canvas.toBuffer("image/png"));
  console.log(`${file} (${type} rev ${rev}, tick ${frames[at].tick})`);
}

const first = (frames: Any[], test: (s: Any) => boolean, fallback: number) => {
  const i = frames.findIndex(test);
  return i >= 0 ? i : fallback;
};

{
  const { rev, frames } = await states("breaker", 0);
  shoot("breaker-start", "breaker", rev, (c, s, z) => breakerArtGameFor(rev).draw(c, s, z), frames, 90);
  shoot("breaker-mid", "breaker", rev, (c, s, z) => breakerArtGameFor(rev).draw(c, s, z), frames, 1500);
}
{
  const { rev, frames } = await states("rally", 0, "elite");
  // The hardest spin return of the run, 25 ticks after it leaves the paddle (the curve, or rev 10's kink, in view).
  let spin = 1200;
  frames.forEach((s, i) => {
    if (s.spun && Math.abs(s.spin ?? 0) > Math.abs(frames[spin]?.spun ? frames[spin].spin ?? 0 : 0)) spin = i;
  });
  while (spin > 0 && frames[spin - 1]?.spun) spin--;
  shoot("rally-spin", "rally", rev, (c, s, z) => rallyArtGame.draw(c, s, z), frames, spin + 25);
  // The longest rally of the run (the ball at its warmest).
  const hot = frames.reduce((best, s, i) => ((s.hits ?? 0) > (frames[best].hits ?? 0) ? i : best), 0);
  shoot("rally-hot-ball", "rally", rev, (c, s, z) => rallyArtGame.draw(c, s, z), frames, hot + 10);
}
{
  const { rev, frames } = await states("beat", 0);
  shoot("tempo-five-lanes", "beat", rev, (c, s, z) => beatArtGame.draw(c, s, z), frames, 2900);
}
{
  const { rev, frames } = await states("snake", 0);
  shoot("meteor-start", "snake", rev, (c, s, z) => snakeArtGame.draw(c, s, z), frames, 40);
  shoot("meteor-mid", "snake", rev, (c, s, z) => snakeArtGame.draw(c, s, z), frames, Math.min(frames.length - 2, 2110));
}
{
  const { rev, frames } = await states("skyline", 0);
  shoot("high-rise-mid", "skyline", rev, (c, s, z) => skylineArtGame.draw(c, s, z), frames, Math.floor(frames.length / 2));
}
{
  const { rev, frames } = await states("bubble", 0);
  shoot("coral-pop-start", "bubble", rev, (c, s, z) => bubbleArtGame.draw(c, s, z), frames, 60);
}
{
  const { rev, frames } = await states("slice", 0);
  // The moment with the most onions (colour 2) and golden fruit (colour 4) in the air.
  const small = (st: Any) => (st.objects ?? []).filter((o: Any) => !o.bomb && !o.special && (o.colour === 2 || o.colour === 4) && o.launchTick + 20 <= st.tick && st.tick <= o.lastTick - 20).length;
  let big = 900;
  for (let i = 300; i < frames.length - 60; i++) if (small(frames[i]) > small(frames[big])) big = i;
  shoot("slice-mid", "slice", rev, (c, s, z) => sliceArtGame.draw(c, s, z), frames, big);
}
{
  const { rev, frames } = await states("bintoss", 0);
  const fly = first(frames, (s) => s.tick > 60 && (s.phase === 1 || s.phase === "fly") && s.y < 400 * 256, 200);
  shoot("swish-flight", "bintoss", rev, (c, s, z) => binTossArtGame.draw(c, s, z), frames, fly + 8);
}
