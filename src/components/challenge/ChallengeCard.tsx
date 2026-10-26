import { ChevronRight } from "lucide-react";

import { ChallengeTile } from "@/components/app/TabIcons";

/**
 * The Play tab's "Challenge a friend" row (22 Oct 2026): opens the create screen. Hidden until
 * challenges are available (before the friend-challenge migration is applied it never shows). Under
 * the dailies it joins their Today panel (tab pages refresh, app-pages.css); alone it is its own panel.
 */
export function ChallengeCard({ available, onOpen }: { available: boolean; onOpen: () => void }) {
  if (!available) return null;
  return (
    <div className="ap-panel">
      <button type="button" data-challenge-card onClick={onOpen} data-icon="tile" className="ap-row press">
        <ChallengeTile />
        <span className="ap-row-text">
          <span className="ap-row-title">Challenge a friend</span>
          <span data-ellipsis className="ap-row-sub">
            Play a set, then dare them to beat it
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="ap-chevron" />
      </button>
    </div>
  );
}
