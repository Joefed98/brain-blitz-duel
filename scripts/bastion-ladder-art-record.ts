/**
 * Records bastion-ladder-check's art fixture (scripts/fixtures/bastion-ladder-art.json): SHA-256 digests of Iron Wall's
 * world drawn by the renderer as it was BEFORE bastionRev 5's four-lane road (D5's ladder, 23 Nov 2026), on states of
 * every older stamp (bastionRev 2, 3 and 4 at Easy, Normal and Hard: the three-lane road, its tanks, shells, impacts,
 * HUD and end card) plus the play screen's scenery and the reveal's picture of a run. The check redraws the same
 * frames with today's renderer and fails on any changed pixel, so the four-lane road is new art beside the old, never a
 * repaint of it.
 *
 *   git show c550c1bb:src/lib/arcade/bastionTank.renderer.ts > src/lib/arcade/bastionTank.renderer.before.ts
 *   bun scripts/bastion-ladder-art-record.ts --renderer=../src/lib/arcade/bastionTank.renderer.before.ts
 *   rm src/lib/arcade/bastionTank.renderer.before.ts
 *
 * (recorded so on polish/d5 c550c1bb's renderer; without --renderer it prints today's digests, which the check compares).
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { bastionTankGameFor, BT2_WORLD_H, BT2_WORLD_W, type BastionTankState } from "../src/lib/arcade/bastionTank";
import { bastionOracleRun } from "./bastion-oracle";

// The HUD's and the intro still's text in the app's own font (self-hosted, public/fonts), as ricochet-overhaul-check and
// swing-overhaul-check do, so a frame's pixels don't depend on the machine's fallback font (CI's differs from a session's).
// Changed with Joe's approval, 27 Nov 2026 (the fixture re-recorded from c550c1bb's renderer with the font registered).
GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");

export const BASTION_LADDER_ART = "scripts/fixtures/bastion-ladder-art.json";

/** The frames: [label, stamp, level, seed, tick]. Played by the unlimited oracle (scripts/bastion-oracle.ts) to `tick`. */
export const ART_FRAMES: readonly [string, number, string | undefined, number, number][] = [
  ["rev4 normal intro still", 4, undefined, 7, 640],
  ["rev4 normal wave 2", 4, undefined, 21, 760],
  ["rev4 normal wave 3", 4, undefined, 21, 1340],
  ["rev4 normal wave 4", 4, undefined, 21, 1990],
  ["rev4 normal wave 5", 4, undefined, 21, 2620],
  ["rev4 normal end", 4, undefined, 21, 3600],
  ["rev4 easy wave 4", 4, "easy", 5, 2000],
  ["rev4 hard wave 5", 4, "hard", 5, 2700],
  ["rev3 wave 3", 3, undefined, 9, 1400],
  ["rev3 wave 5", 3, undefined, 9, 2650],
  ["rev2 wave 4", 2, undefined, 11, 2100],
];

type ArtModule = {
  bastionTankArtGameFor: (rev?: number | null, level?: unknown) => { draw: (ctx: CanvasRenderingContext2D, s: BastionTankState, size: { width: number; height: number }) => void };
  bastionScene: (ctx: CanvasRenderingContext2D, view: { left: number; right: number; top: number; bottom: number }, state?: Pick<BastionTankState, "tick">) => void;
  paintBastionSummary: (ctx: CanvasRenderingContext2D, d: unknown) => void;
  bastionSummaryHeight: (rev: number) => number;
  BT_SUMMARY_W: number;
};

/** The state a frame shows: the oracle's run on that stamp and level, stepped to `tick`. */
export function artState(rev: number, level: string | undefined, seed: number, tick: number): BastionTankState {
  const game = bastionTankGameFor(rev, level);
  const events = bastionOracleRun(seed, rev, level);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  while (s.tick < tick && !game.isOver(s)) s = game.step(s, at.get(s.tick + 1) ?? null);
  return s;
}

const sha = (data: Uint8ClampedArray | Buffer) => createHash("sha256").update(Buffer.from(data)).digest("hex");

/** Every frame's digest drawn by `art` (the renderer module), and the scene's and the reveal picture's. */
export function artDigests(art: ArtModule): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [label, rev, level, seed, tick] of ART_FRAMES) {
    const c = createCanvas(BT2_WORLD_W, BT2_WORLD_H);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    // Every frame from the run's start, as the play screen draws it (the art's memory of the run builds frame by frame).
    const game = bastionTankGameFor(rev, level);
    const events = bastionOracleRun(seed, rev, level);
    const at = new Map(events.map((e) => [e.t, e]));
    let s = game.init(seed);
    const draw = art.bastionTankArtGameFor(rev, level).draw;
    while (s.tick < tick && !game.isOver(s)) {
      s = game.step(s, at.get(s.tick + 1) ?? null);
      if (s.tick % 30 === 0 || s.tick === tick || game.isOver(s)) draw(ctx, s, { width: BT2_WORLD_W, height: BT2_WORLD_H });
    }
    out[label] = sha(c.getContext("2d").getImageData(0, 0, BT2_WORLD_W, BT2_WORLD_H).data as unknown as Uint8ClampedArray);
  }
  for (const tick of [100, 1400, 2700]) {
    const c = createCanvas(480, 860);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.translate(45, 70);
    art.bastionScene(ctx, { left: -45, right: 435, top: -70, bottom: 790 }, { tick });
    out[`scene ${tick}`] = sha(c.getContext("2d").getImageData(0, 0, 480, 860).data as unknown as Uint8ClampedArray);
  }
  return out;
}

/** The art's effects read the presentation clock: hold it still so a frame is the same on every run. */
export function holdArtClock(): void {
  Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => 10_000 } });
}

if (import.meta.main) {
  holdArtClock();
  const path = process.argv.find((a) => a.startsWith("--renderer="))?.slice(11) ?? "../src/lib/arcade/bastionTank.renderer";
  const art = (await import(path)) as ArtModule;
  const digests = artDigests(art);
  if (process.argv.some((a) => a.startsWith("--renderer="))) {
    writeFileSync(BASTION_LADDER_ART, JSON.stringify({ recordedOn: "polish/d5 c550c1bb's bastionTank.renderer.ts (before bastionRev 5's four-lane road)", digests }, null, 1) + "\n");
    console.log(`wrote ${BASTION_LADDER_ART} (${Object.keys(digests).length} frames)`);
  } else console.log(JSON.stringify(digests, null, 1));
}
