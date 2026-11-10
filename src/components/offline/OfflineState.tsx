import { useNavigate } from "@tanstack/react-router";
import { EmptyState } from "@/design/components";

/**
 * What an online-only screen shows with no connection (offline practice, 31 Oct 2026): Play, Tournaments,
 * rooms, the daily and challenges. Wave 1's look (10 Nov 2026, docs/mockups/wave-1/X1-Offline.png): Captain
 * Joulz on a red halo, "No signal", the screen's own line and one gold action, to Practice. Behaviour is
 * unchanged: OnlineOnly decides when it shows, and the screen comes back by itself when the connection does.
 */
export function OfflineState({ body }: { body: string }) {
  const navigate = useNavigate();
  return (
    <EmptyState
      data-offline-state
      heading={1}
      pose="ready"
      tone="alert"
      title="No signal"
      body={body}
      action={{ label: "Go to Practice", onClick: () => void navigate({ to: "/practice" }), data: { "data-offline-practice": "" } }}
    />
  );
}
