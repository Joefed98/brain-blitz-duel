
import { ChallengeTile } from "@/components/app/TabIcons";
import { Icon } from "@/design/components";

/**
 * The Play tab's "Challenge a friend" row (22 Oct 2026): opens the create screen. Hidden until
 * challenges are available (before the friend-challenge migration is applied it never shows). Under
 * the dailies it joins their Today panel (tab pages refresh, app-pages.css); alone it is its own panel.
 */
export function ChallengeCard({ available, onOpen }: { available: boolean; onOpen: () => void }) {
  if (!available) return null;
  return (
    <div className="jz-panel">
      <button type="button" data-challenge-card onClick={onOpen} data-icon="tile" className="jz-row press">
        <ChallengeTile />
        <span className="jz-row-text">
          <span className="jz-row-title">Challenge a friend</span>
          <span data-ellipsis className="jz-row-sub">
            Play a set, then dare them to beat it
          </span>
        </span>
        <Icon name="chevron-right" size={20} className="ap-chevron" />
      </button>
    </div>
  );
}
