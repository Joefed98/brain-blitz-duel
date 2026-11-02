import { GameIcon } from "@/components/app/GameIcon";
import { PUZZLE_REGISTRY } from "@/lib/duel/registry";
import type { QueuedRun } from "@/lib/offline/queue";

import { PendingClock } from "./PendingClock";

/** Runs shown on the Practice tab: every queued one, and those the server answered in the last day. */
export const RECENT_RESOLVED_MS = 24 * 3600_000;
const MAX_SHOWN = 5;

export function shownOfflineRuns(runs: readonly QueuedRun[], now: number): QueuedRun[] {
  return runs
    .filter((r) => r.status === "queued" || (r.resolvedAt ?? 0) > now - RECENT_RESOLVED_MS)
    .sort((a, b) => b.playedAt - a.playedAt)
    .slice(0, MAX_SHOWN);
}

/** A run's score as the app may show it: the server's once confirmed, else pending (with the phone's own as provisional). */
export function RunScore({ run }: { run: QueuedRun }) {
  if (run.status === "confirmed") {
    return (
      <span data-run-status="confirmed" className="ap-best">
        {run.score}
      </span>
    );
  }
  if (run.status === "rejected") {
    return (
      <span data-run-status="rejected" className="of-mark">
        Couldn't be confirmed
      </span>
    );
  }
  return (
    <span data-run-status="queued" className="of-mark">
      <PendingClock />
      {run.provisional !== null ? <span className="text-[15px] text-[var(--ap-text-2)]">{run.provisional}</span> : "Pending"}
    </span>
  );
}

/**
 * "Played offline" on the Practice tab (offline practice, 31 Oct 2026): runs waiting for the server (a clock,
 * the phone's provisional score for an arcade run) and, for a day, what the server made of them: the
 * confirmed score, or "Couldn't be confirmed" (never a score).
 */
export function OfflineRuns({ runs, now }: { runs: readonly QueuedRun[]; now: number }) {
  const shown = shownOfflineRuns(runs, now);
  if (shown.length === 0) return null;
  return (
    <section aria-label="Played offline" data-offline-runs className="ap-section">
      <h2 className="ap-section-title">Played offline</h2>
      <div className="ap-panel">
        {shown.map((run) => (
          <div key={run.id} data-offline-run={run.type} data-run-id={run.id} className="ap-row">
            <GameIcon type={run.type} size={36} />
            <span data-ellipsis className="ap-row-title min-w-0 flex-1">
              {PUZZLE_REGISTRY[run.type]?.name ?? run.type}
            </span>
            <RunScore run={run} />
          </div>
        ))}
      </div>
    </section>
  );
}
