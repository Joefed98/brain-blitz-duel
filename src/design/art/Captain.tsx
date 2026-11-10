/**
 * Captain Joulz as a still picture (wave 1, first impressions, 10 Nov 2026): the approved art itself
 * (docs/art/svg/captain-joulz-*.svg), copied byte for byte into public/art/ and drawn as an <img>, so the
 * empty, error and onboarding screens show exactly the approved figure, cached like any public file (kept
 * by the offline worker, so the offline screen has it too) and costing one small request, no script.
 * first-impressions-check proves the copies equal the approved files.
 *
 * Only the approved poses exist: ready (arms at the sides), run and win (both arms up). The mockups' wave,
 * folded arms, head scratch, unplugged cable and spanner are not drawn yet; each screen uses the closest
 * approved pose (the wave screens `win`, the rest `ready`). Don't draw new poses here: new art comes from
 * the art canvas (docs/art/README.md).
 */
export type CaptainPose = "ready" | "win";

/** The approved files' public paths. */
export const CAPTAIN_ART: Record<CaptainPose, string> = {
  ready: "/art/captain-joulz-ready.svg",
  win: "/art/captain-joulz-win.svg",
};

/** The art's own box (viewBox -10 -40 180 240): width to height. */
const ASPECT = 240 / 180;

/**
 * The figure, `size` px wide (its height follows), decorative (the screen's title says what it means).
 * Width and height are set, so the page never moves when the picture arrives.
 */
export function Captain({ pose, size, className }: { pose: CaptainPose; size: number; className?: string }) {
  return (
    <img
      src={CAPTAIN_ART[pose]}
      alt=""
      aria-hidden="true"
      width={size}
      height={Math.round(size * ASPECT)}
      decoding="async"
      draggable={false}
      data-captain={pose}
      className={className ? `jz-captain ${className}` : "jz-captain"}
    />
  );
}
