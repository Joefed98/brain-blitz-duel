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
      data-tint="gold"
      onClick={onOpen}
      className="th-card press flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-card/80 px-4 py-3 text-left"
    >
      <Swords aria-hidden="true" className="h-6 w-6 shrink-0 text-primary" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="whitespace-nowrap font-display text-sm font-bold uppercase text-foreground">
          Challenge a friend
        </span>
        <span className="truncate text-xs text-muted-foreground">
          Play a set, then dare them to beat it.
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}
