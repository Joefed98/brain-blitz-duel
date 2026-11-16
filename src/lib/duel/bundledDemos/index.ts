/**
 * Intro demos bundled with the app (the Pattern overhaul, 15 Nov 2026). Each file is one `intro_demos` row, recorded by
 * real play of the game's fixed intro example in dev practice and captured as the Save button sends it (the public half
 * of the example, the touch log with its presentation and layout). getIntroDemoFn plays one when the live row is missing
 * or refused for an older stamp or presentation; a live row recorded on today's stamp still wins, so a re-record through
 * the Save button replaces a bundled demo without a code change. Stored rows are never touched.
 *
 * Recorded on: Tessellate blockRev 4, Pipeline pipesRev 5, Chroma Lines flowRev 3, Skid slideRev 5, Topsy-Turvy
 * gravityRev 8, Gridlock unblockRev 4, Lightbender laserRev 4 (pattern-overhaul-demos-check proves each against today's
 * deal and rules; pattern-demos-check grades each run through practice's grader, scripts/fixtures/pattern-demos.json).
 */
import type { IntroDemoRow } from "../introDemo.functions";

import blockparty from "./blockparty.json";
import flow from "./flow.json";
import gravity from "./gravity.json";
import iceslide from "./iceslide.json";
import laser from "./laser.json";
import pipes from "./pipes.json";
import unblock from "./unblock.json";

export const BUNDLED_INTRO_DEMOS: Readonly<Record<string, IntroDemoRow>> = {
  blockparty: blockparty as unknown as IntroDemoRow,
  flow: flow as unknown as IntroDemoRow,
  gravity: gravity as unknown as IntroDemoRow,
  iceslide: iceslide as unknown as IntroDemoRow,
  laser: laser as unknown as IntroDemoRow,
  pipes: pipes as unknown as IntroDemoRow,
  unblock: unblock as unknown as IntroDemoRow,
};

/** The bundled demo for `type`, or null. */
export function bundledIntroDemo(type: string): IntroDemoRow | null {
  return Object.hasOwn(BUNDLED_INTRO_DEMOS, type) ? BUNDLED_INTRO_DEMOS[type]! : null;
}
