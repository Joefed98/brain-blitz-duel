import { Button } from "@/components/ui/button";

import { Dots } from "./Dots";

export interface ContinueState {
  /** This player has tapped Continue on the current screen. */
  continued: boolean;
  /** Players the screen waits for who have tapped Continue. */
  continuedCount: number;
  /** Players the screen waits for (connected and active). */
  waitingCount: number;
  onContinue: () => void;
}

/**
 * Everyone's button on the between-round screens. The screen moves on when
 * every connected player has tapped it, or when its timer runs out.
 */
export function ContinueFooter({
  next,
  autoSeconds,
  state,
}: {
  /** What comes next: "Standings", "Next round" or "Winner". */
  next: string;
  autoSeconds: number;
  state: ContinueState;
}) {
  const { continued, continuedCount, waitingCount, onContinue } = state;
  return (
    <footer className="shrink-0 pt-1" data-continue-footer>
      {continued ? (
        <p className="flex h-10 items-center justify-center gap-2 whitespace-nowrap text-center font-mono text-xs uppercase text-foreground/80">
          <span>
            {continuedCount} of {waitingCount} ready · {next} in{" "}
            <span className="normal-case">{autoSeconds}s</span>
          </span>
          <Dots />
        </p>
      ) : (
        <Button
          className="th-btn-gold press tap-target w-full font-display font-extrabold uppercase tracking-wide"
          onClick={onContinue}
        >
          {/* One flex item, so the button's gap doesn't widen the space; "(5s)" not uppercased to "5S". */}
          <span>
            Continue <span className="normal-case">({autoSeconds}s)</span>
          </span>
        </Button>
      )}
    </footer>
  );
}
