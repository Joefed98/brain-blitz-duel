import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

import { feedbackBase, feedbackUrl } from "@/lib/beta/feedback";
import { currentUserId } from "@/lib/duel/session";

/**
 * SEND FEEDBACK: opens the beta's Tally form in a new tab with this device's anonymous id and the app
 * version (lib/beta/feedback.ts). Renders nothing while TALLY_URL is empty. `small`: the quiet link
 * under the podium and the daily results; otherwise Profile's full-width row.
 */
export function FeedbackLink({ small = false }: { small?: boolean }) {
  const base = feedbackBase();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  useEffect(() => {
    if (!base) return;
    let live = true;
    currentUserId().then(
      (id) => live && setDeviceId(typeof id === "string" ? id : null),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [base]);
  const href = feedbackUrl(base, deviceId);
  if (!href) return null;
  if (small)
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-feedback-link="small"
        className="press tap-target mx-auto flex items-center justify-center gap-1.5 whitespace-nowrap px-3 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
        Send feedback
      </a>
    );
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-feedback-link="profile"
      className="th-btn-ghost press tap-target flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground"
    >
      <MessageSquare aria-hidden="true" className="h-4 w-4" />
      Send feedback
    </a>
  );
}
