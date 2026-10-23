import { ChevronRight, Swords } from "lucide-react";

/**
 * The Play tab's "Challenge a friend" card (22 Oct 2026): opens the create screen. Hidden until
 * challenges are available (before the friend-challenge migration is applied it never shows).
 */
export function ChallengeCard({ available, onOpen }: { available: boolean; onOpen: () => void }) {
  if (!available) return null;
  return (
    <button
      type="button"
      data-challenge-card
      onClick={onOpen}
      data-icon="sq"
      className="ap-panel ap-row press"
    >
      <span data-tone="challenge" className="ap-icon-sq">
        <Swords aria-hidden="true" />
      </span>
      <span className="ap-row-text">
        <span className="ap-row-title">Challenge a friend</span>
        <span data-ellipsis className="ap-row-sub">
          Play a set, then dare them to beat it
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="ap-chevron" />
    </button>
  );
}
