import { CloudOff } from "lucide-react";

/**
 * The slim offline banner (offline practice, 31 Oct 2026): in the markup of every page screen, shown by CSS
 * only while <html data-offline> is set (polish-layout/offline.css), so it never pops in from a script or
 * moves the page when it isn't needed. Never on a game screen.
 */
export function OfflineBanner() {
  return (
    <div data-offline-banner role="status" className="of-banner">
      <CloudOff aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span>You're offline. Practice still works.</span>
    </div>
  );
}
