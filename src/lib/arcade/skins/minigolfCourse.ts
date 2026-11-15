/**
 * Crazy Golf's redrawn default course (docs/design/cosmetics-redraws/ART-DIRECTION.md, SAMPLES.md): Blender-rendered
 * turf, paving, stone coping, sand, boulders, planters and garden shrubs (docs/design/cosmetics-redraws/blender/
 * crazy_golf.py → public/cosmetics/redrawn/mg.*.webp), painted by minigolf.renderer.ts into its cached hole canvas.
 *
 * Behind its switch, `default.crazy-golf.course` in src/config/cosmeticRedraws.ts (off: every pixel is today's).
 * Display only: no sim, grader or deal reads this. With the switch on the redraw is drawn only once every image has
 * arrived; until then (and wherever there is no `Image`) today's course is drawn.
 */
import { redrawnDefaultOn } from "@/config/cosmeticRedraws";

import { sceneImage, sceneImagesVersion } from "./sceneImages";

export const CRAZY_GOLF_COURSE = "default.crazy-golf.course";

/** Every image the redrawn course draws. */
export const COURSE_IMAGES = ["mg.turf", "mg.paving", "mg.stone", "mg.sand", "mg.boulder-0", "mg.boulder-1", "mg.boulder-2", "mg.planter", "mg.shrub-0", "mg.shrub-1"] as const;

let preview: boolean | null = null;
/** Script-only (the samples' shots): force the redrawn course on or off, or null to follow the switch. */
export function setCourseRedrawPreview(on: boolean | null): void {
  preview = on;
}

export function courseRedrawOn(): boolean {
  return preview ?? redrawnDefaultOn(CRAZY_GOLF_COURSE);
}

export interface CourseArt {
  turf: HTMLImageElement;
  paving: HTMLImageElement;
  stone: HTMLImageElement;
  sand: HTMLImageElement;
  boulders: readonly HTMLImageElement[];
  planter: HTMLImageElement;
  shrubs: readonly HTMLImageElement[];
}

/** The redrawn course's images when the switch is on and every one has arrived, else null (draw today's course). */
export function courseArt(): CourseArt | null {
  if (!courseRedrawOn()) return null;
  const got = COURSE_IMAGES.map((n) => sceneImage(n));
  if (got.some((g) => !g)) return null;
  const [turf, paving, stone, sand, b0, b1, b2, planter, s0, s1] = got as HTMLImageElement[];
  return { turf: turf!, paving: paving!, stone: stone!, sand: sand!, boulders: [b0!, b1!, b2!], planter: planter!, shrubs: [s0!, s1!] };
}

/** What a cached hole keys on for the redraw ("" with the switch off, so today's cache keys are unchanged). */
export function courseArtKey(): string {
  return courseRedrawOn() ? `:course2:${sceneImagesVersion()}` : "";
}
