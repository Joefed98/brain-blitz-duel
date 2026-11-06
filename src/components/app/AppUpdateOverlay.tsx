import { AppWordmark } from "@/components/brand/AppWordmark";
import { useAppUpdateStatus } from "@/lib/appUpdate";

/**
 * Covers the screen for the moment between "a new version is out" and the reload: the one wordmark
 * (design foundation F4; `still`, so it never charges in) over the line (polish-layout/app-pages.css).
 */
export function AppUpdateOverlay() {
  const status = useAppUpdateStatus();
  if (status !== "updating") return null;
  return (
    <div role="status" aria-live="polite" data-app-updating className="app-update-overlay">
      <AppWordmark still />
      <span className="app-update-overlay-line">Updating…</span>
    </div>
  );
}
