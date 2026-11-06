import { CloudOff } from "lucide-react";

import { GameIcon } from "@/components/app/GameIcon";
import { PUZZLE_REGISTRY } from "@/lib/duel/registry";
import type { PuzzleType } from "@/lib/duel/types";

import { PendingClock } from "./PendingClock";
import { useQueuedRun } from "./useOfflinePractice";
import { Button } from "@/design/components";

/**
 * The end of a practice run played away from the server (offline practice, 31 Oct 2026), in place of the
 * answer reveal (which needs the graded puzzle). An arcade run shows the phone's own score as provisional; a
 * puzzle shows "Score pending". Both carry the clock until the server has graded the run (sent as soon as
 * there is a connection, even while this screen is up); then the server's score shows, or "Couldn't be
 * confirmed" if it rejected the run. Back and Play again as on the practice reveal.
 */
export function OfflineRunResult({
  runId,
  type,
  onPlayAgain,
  onBack,
}: {
  runId: string | null;
  type: PuzzleType;
  onPlayAgain: () => void;
  onBack: () => void;
}) {
  const run = useQueuedRun(runId);
  const status = run?.status ?? "queued";
  return (
    <div data-offline-result={status} className="flex w-full flex-1 flex-col items-center justify-center gap-5 py-6 text-center">
      <GameIcon type={type} size={72} />
      <h1 className="text-[22px] font-extrabold leading-tight text-foreground">{PUZZLE_REGISTRY[type]?.name ?? type}</h1>
      {status === "confirmed" ? (
        <div className="flex flex-col items-center gap-2">
          <span data-offline-score className="of-result-score">
            {run?.score}
          </span>
          <span className="ap-meta">{run?.improved ? "Confirmed · new best" : "Confirmed"}</span>
        </div>
      ) : status === "rejected" ? (
        <div className="flex flex-col items-center gap-2">
          <span data-offline-score data-pending className="of-result-score">
            Couldn’t be confirmed
          </span>
          <span className="ap-meta max-w-[300px] whitespace-normal">The server couldn’t check this run, so it doesn’t count.{/* design-lint-ignore: styles unchanged, curly quotes only (F4) */}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <span data-offline-score data-pending={run?.provisional == null || undefined} className="of-result-score inline-flex items-center gap-2">
            <PendingClock className="h-6 w-6 text-[var(--ap-faint)]" />
            {run?.provisional != null ? run.provisional : "Score pending"}
          </span>
          <span data-offline-note className="ap-meta flex max-w-[300px] flex-col items-center gap-0.5 whitespace-normal">
            {run?.provisional != null ? <span>Provisional score</span> : null}
            <span>
              <CloudOff aria-hidden="true" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
              Confirmed when you’re back online
            </span>
          </span>
        </div>
      )}
      <div data-practice-reveal-actions className="flex w-full max-w-[320px] gap-2.5">
        <Button variant="secondary" size={50} onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button variant="gold" size={50} onClick={onPlayAgain} className="flex-1">
          Play again
        </Button>
      </div>
    </div>
  );
}
