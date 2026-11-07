import { useEffect, useRef } from "react";

import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import { soundCue } from "@/lib/fx/soundCues";
import { prefersReducedMotion } from "@/lib/motion";
import { celebrationSound, showBanner } from "@/lib/fx/celebrations";
import { useCelebrationScope, useCelebrationsOn } from "@/components/fx/useCelebration";
import { queueVoice } from "@/lib/sound";

/** After the stored score's own cue (AnswerReveal's REVEAL_SCORE_DELAY_MS) has played. */
const DELAY_MS = 600;

/**
 * Practice's "New best!" moment on the reveal: a short pill over the top of the reveal with the
 * existing `shared.momentcard` cue, shown only when practiceBest.ts says this run beat an earlier
 * best under the same stamps. Laid over the reveal (absolute, pointer-events none), so nothing
 * moves. With reduced motion or reduced effects it is skipped entirely (the practice result card
 * still says "New best!"). Presentation only.
 *
 * Celebrations on (src/lib/fx/celebrations.ts): the shared kit's "New best!" banner with a spark
 * burst and the spark chime in place of the pill and its cue (reduced motion: the banner fades in,
 * no sparks; the chime still plays).
 */
export function NewBestMoment({ starLine = null }: { starLine?: string | null } = {}) {
  // The "New best" voice line (3 Nov 2026, roomVoices.ts): once, after the moment's own sound,
  // never over another voice line (a Perfect on the same reveal goes first). Reduced motion too.
  useEffect(() => {
    queueVoice("voice.newBest", DELAY_MS + 400);
  }, []);
  return useCelebrationsOn() ? <NewBestCelebration starLine={starLine} /> : <NewBestPill starLine={starLine} />;
}

function NewBestCelebration({ starLine }: { starLine: string | null }) {
  const scope = useCelebrationScope();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      showBanner(scope, "New best!", { burst: true, sub: starLine });
      celebrationSound("chime");
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [scope, starLine]);
  return null;
}

function NewBestPill({ starLine }: { starLine: string | null }) {
  const calm = useRef<boolean | null>(null);
  if (calm.current === null) calm.current = prefersReducedMotion() || arcadeReducedEffects();
  useEffect(() => {
    if (calm.current) return;
    const timer = window.setTimeout(() => soundCue("shared.momentcard"), DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);
  if (calm.current) return null;
  return (
    <div data-new-best="" aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-12 z-20 flex justify-center">
      <span
        className="new-best-moment rounded-full bg-primary px-4 py-1.5 font-display text-base font-bold uppercase tracking-wide text-primary-foreground shadow-lg"
        style={{ animationDelay: `${DELAY_MS}ms` }}
      >
        New best!
        {/* Practice goals (6 Nov 2026): a star earned by this run, a short line under the pill's words. */}
        {starLine ? (
          <span data-new-best-star="" className="new-best-star">
            {starLine}
          </span>
        ) : null}
      </span>
    </div>
  );
}
