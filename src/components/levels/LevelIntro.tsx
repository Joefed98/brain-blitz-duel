import { Button } from "@/design/components";
import { LEVEL_INTRO_TEXT, LEVEL_INTRO_TITLE, useLevelIntro } from "@/lib/levels/levelIntro";

/**
 * The first-time explanation of difficulty levels (Joe, 15 Nov 2026; levelIntro.ts): a small panel under the level
 * selector, shown once on a device, the first time any selector is seen. "Got it" closes it.
 */
export function LevelIntro() {
  const { show, dismiss } = useLevelIntro();
  if (!show) return null;
  return (
    <aside role="note" aria-label={LEVEL_INTRO_TITLE} data-level-intro className="jz-panel lv-intro">
      <p className="lv-intro-title">{LEVEL_INTRO_TITLE}</p>
      <p className="lv-intro-text" data-wrap-ok="">
        {LEVEL_INTRO_TEXT}
      </p>
      <Button variant="secondary" size={44} onClick={dismiss} data-level-intro-dismiss className="lv-intro-ok">
        Got it
      </Button>
    </aside>
  );
}
