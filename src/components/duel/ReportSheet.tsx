/**
 * Reporting a player (safety, 10 Nov 2026; docs/moderation.md "Reports"): the second of two taps. The first is the
 * player's name (lobby) or a chat message; this panel lists the three reasons, and one tap files the report. The same
 * thank-you whatever happens; the reported player is never told.
 */

import { useState } from "react";

import { Button } from "@/design/components";
import { NameplateFullCard, type NameplatePlayer } from "@/design/identity";
import { REPORT_REASON_LABELS, REPORT_REASONS, REPORT_THANKS, type ReportReason } from "@/lib/safety/reports";

export interface ReportSheetProps {
  /** Whom it is about, as shown ("Report Ali"). */
  name: string;
  /** Files the report; rejects or answers a message when it couldn't be sent. */
  onReport: (reason: ReportReason) => Promise<string | void>;
  onClose: () => void;
  /**
   * The player's full card, drawn above the reasons when they have one (13 Nov 2026, one identity everywhere: a tap on
   * a lobby name opens their card, and the reasons stay one tap away, so reporting is still two taps).
   */
  player?: NameplatePlayer | null;
}

/** The three reasons as buttons, for a panel of its own or inside the chat message menu. */
export function ReportReasons({ onPick }: { onPick: (reason: ReportReason) => void }) {
  return (
    <div data-report-reasons role="group" aria-label="Report reasons">
      {REPORT_REASONS.map((reason) => (
        <Button
          key={reason}
          variant="quiet"
          block
          data-report-reason={reason}
          onClick={() => onPick(reason)}
          className="justify-start text-warn"
        >
          Report: {REPORT_REASON_LABELS[reason].toLowerCase()}
        </Button>
      ))}
    </div>
  );
}

export function ReportSheet({ name, onReport, onClose, player }: ReportSheetProps) {
  const [done, setDone] = useState<string | null>(null);
  const pick = (reason: ReportReason) => {
    setDone(REPORT_THANKS);
    void onReport(reason)
      .then((message) => {
        if (typeof message === "string" && message) setDone(message);
      })
      .catch(() => setDone("Couldn’t send that report."))
      .finally(() => window.setTimeout(onClose, 1500));
  };
  return (
    <div
      data-report-sheet
      className="fixed inset-0 flex items-end justify-center bg-background/70 p-4"
      style={{ zIndex: 60 }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`Report ${name}`}
        className="w-full max-w-sm rounded-md border border-border bg-card p-2"
        onClick={(event) => event.stopPropagation()}
      >
        {player ? (
          <div className="px-2 pt-2" data-report-card>
            <NameplateFullCard player={player} />
          </div>
        ) : null}
        <p className="truncate px-3 py-2 text-center font-mono text-xs uppercase text-muted-foreground">
          Report {name}
        </p>
        {done ? (
          <p role="status" className="px-3 py-3 text-center text-sm text-foreground">
            {done}
          </p>
        ) : (
          <>
            <ReportReasons onPick={pick} />
            <Button variant="quiet" block data-report-cancel onClick={onClose} className="justify-start">
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
