import { Clock3 } from "lucide-react";

/** The small clock on a score the server hasn't confirmed yet (offline practice). */
export function PendingClock({ className = "of-clock" }: { className?: string }) {
  return <Clock3 aria-label="Pending" data-pending-clock className={className} />;
}
