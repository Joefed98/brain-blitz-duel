/**
 * Before / after review frames for Joe's iPhone 11 notes of 28 Oct 2026 (look only; docs/arcade-notes-oct28.md):
 * Hover, Breaker, Meteor, Wavefront, Orbit and Swish drawn by their real renderers (@napi-rs/canvas) at the iPhone 11
 * home-screen app's width (414 px, 2× pixels), from a skill-band bot run on the revision rooms deal (LIVE_BANDS), at
 * moments picked by what they show. Tempo's and Gemstone's notes are sound only. Not a check.
 *
 *   bun scripts/shots/arcade-notes-oct28-shots.ts --out=<dir> --tag=after      (this tree)
 *   bun scripts/shots/arcade-notes-oct28-shots.ts --out=<dir> --tag=before     (a main worktree with this file copied in)
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
const OUT = opt("out") ?? ".shots/arcade-notes-oct28";
const TAG = opt("tag") ?? "after";
mkdirSync(OUT, { recursive: true });

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const { GAME_BY_TYPE } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const { LIVE_BANDS } = await import("../../src/lib/arcade/liveBands");
const { ARCADE_REVEAL_RENDERERS, revealWorldH } = await import("../../src/lib/arcade/revealRenderers");
const { breakerArtGameFor } = await import("../../src/lib/arcade/breaker.renderer");
const { hoverArtGame } = await import("../../src/lib/arcade/hover.renderer");
const { snakeArtGame } = await import("../../src/lib/arcade/snake.renderer");
const { wavefrontArtGameFor } = await import("../../src/lib/arcade/wavefront.renderer");
const { orbitArtGameFor } = await import("../../src/lib/arcade/orbit.renderer");
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
  const { rev, frames } = await states("hover", 0);
  // A gap star still to take and a star chain in view.
  const both = (s: Any) => (s.chains ?? []).some((c: Any) => c.stars.some((st: Any) => st.x0 - s.distance > 0 && st.x0 - s.distance < 300 * 256)) && (s.pillars ?? []).some((p: Any, i: number) => p.star !== undefined && !(s.starsTaken ?? []).includes(i) && p.x0 - s.distance > 60 * 256 && p.x0 - s.distance < 380 * 256);
  shoot("hover-stars", "hover", rev, (c, s, z) => hoverArtGame.draw(c, s, z), frames, first(frames, both, 1200));
}
{
  const { rev, frames } = await states("breaker", 0);
  // A chain with a combo multiplier running (the gold COMBO text sat above the paddle here).
  shoot("breaker-combo", "breaker", rev, (c, s, z) => breakerArtGameFor(rev).draw(c, s, z), frames, first(frames, (s) => (s.chain ?? 0) >= 12, 1500) + 20);
}
{
  const { rev, frames } = await states("snake", 0);
  shoot("meteor-3-stars", "snake", rev, (c, s, z) => snakeArtGame.draw(c, s, z), frames, first(frames, (s) => s.eaten >= 3, 300) + 30);
  shoot("meteor-7-stars", "snake", rev, (c, s, z) => snakeArtGame.draw(c, s, z), frames, first(frames, (s) => s.eaten >= 7, 900) + 30);
  shoot("meteor-12-stars", "snake", rev, (c, s, z) => snakeArtGame.draw(c, s, z), frames, first(frames, (s) => s.eaten >= 12, 1500) + 30);
}
{
  const { rev, frames } = await states("wavefront", 0);
  shoot("wavefront-wave1", "wavefront", rev, (c, s, z) => wavefrontArtGameFor(rev).draw(c, s, z), frames, 200);
  shoot("wavefront-wave3", "wavefront", rev, (c, s, z) => wavefrontArtGameFor(rev).draw(c, s, z), frames, first(frames, (s) => s.wave >= 3, 2000) + 120);
}
{
  const { rev, frames } = await states("orbit", 0);
  shoot("orbit-start", "orbit", rev, (c, s, z) => orbitArtGameFor(s).draw(c, s, z), frames, 60);
  shoot("orbit-mid", "orbit", rev, (c, s, z) => orbitArtGameFor(s).draw(c, s, z), frames, Math.floor(frames.length / 3));
}
{
  const { rev, frames } = await states("bintoss", 0);
  const fly = first(frames, (s) => s.tick > 60 && (s.phase === 1 || s.phase === "fly") && s.y < 400 * 256, 200);
  shoot("swish-flight", "bintoss", rev, (c, s, z) => binTossArtGame.draw(c, s, z), frames, fly + 8);
  shoot("swish-aim", "bintoss", rev, (c, s, z) => binTossArtGame.draw(c, s, z), frames, 30);
}
