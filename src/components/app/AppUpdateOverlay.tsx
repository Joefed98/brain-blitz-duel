import { useAppUpdateStatus } from "@/lib/appUpdate";

/** Covers the screen for the moment between "a new version is out" and the reload. */
export function AppUpdateOverlay() {
  const status = useAppUpdateStatus();
  if (status !== "updating") return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-app-updating
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/90 font-display text-lg font-bold uppercase tracking-wide text-foreground"
    >
      Updating…
    </div>
  );
}
