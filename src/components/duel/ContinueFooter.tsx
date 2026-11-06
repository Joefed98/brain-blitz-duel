import { Dots } from "./Dots";
import { RoomFooter } from "./RoomFooter";
import { Button } from "@/design/components";

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
 * every connected player has tapped it, or when its timer runs out. Drawn in the room footer
 * (RoomFooter, Polish batch R): the chat button, then Continue in gold.
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
    <RoomFooter>
      <div className="flex min-w-0 flex-1" data-continue-footer>
        {continued ? (
          <p className="rs-status h-[52px] whitespace-nowrap">
            <span>
              {continuedCount} of {waitingCount} ready · {next} in {autoSeconds}s
            </span>
            <Dots />
          </p>
        ) : (
          <Button
            variant="gold"
            size={52}
            onClick={onContinue}
          >
            {/* One flex item, so the button's gap doesn't widen the space. */}
            <span>
              Continue ({autoSeconds}s)
            </span>
          </Button>
        )}
      </div>
    </RoomFooter>
  );
}
