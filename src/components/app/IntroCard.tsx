import { X } from "lucide-react";

import { topRoundMax } from "@/lib/duel/roundMax";

/**
 * The first-time intro as a card at the top of the Play tab (tab pages refresh, 26 Oct 2026; the design
 * canvas's T-PlayFirst): three numbered steps, Try a practice game, How it works (the three intro panels,
 * Onboarding.tsx) and a close button. Shown once per device on a plain visit (lib/onboarding.ts, reserved
 * before the first paint: the "intro" Play slot); a room link or a shared link marks it seen as before.
 */
export function IntroCard({
  onClose,
  onPractice,
  onHowItWorks,
}: {
  onClose: () => void;
  onPractice: () => void;
  onHowItWorks: () => void;
}) {
  const top = topRoundMax().top;
  return (
    <section aria-labelledby="intro-card-title" data-intro-card className="ap-panel ap-intro">
      <button type="button" aria-label="Close intro" data-intro-close onClick={onClose} className="ap-intro-close ap-icon-btn press">
        <X aria-hidden="true" strokeWidth={2} />
      </button>
      <div className="pr-10">
        <p className="ap-kicker">NEW HERE?</p>
        {/* Three set lines (each one line): the card's height never depends on the font's metrics. */}
        <h2 id="intro-card-title" aria-label="Quick-fire games, played live with friends" className="ap-intro-title">
          <span>Quick-fire games,</span> <span>played live</span> <span>with friends</span>
        </h2>
      </div>
      <ol className="ap-steps">
        {[
          "Create a room and share the code",
          "Everyone plays the same game at once",
          `Up to ${top} points a round; most wins`,
        ].map((step, i) => (
          // Each step is 56 px whether its text takes one line or two.
          <li key={i} data-wrap-ok>
            <span aria-hidden="true" className="ap-step-num">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" data-intro-practice onClick={onPractice} className="ap-btn-outline press tap-target h-11 px-2 text-[15px]">
          Try a practice game
        </button>
        <button type="button" data-intro-how onClick={onHowItWorks} className="ap-link-quiet press tap-target h-11 px-2">
          How it works
        </button>
      </div>
    </section>
  );
}
