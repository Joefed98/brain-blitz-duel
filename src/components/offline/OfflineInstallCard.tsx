
import { dismissOfflineInstall } from "@/lib/offline/online";
import { Icon } from "@/design/components";

/**
 * The Practice tab's Add to Home Screen card for offline play (offline practice, 31 Oct 2026): iPhone Safari
 * only, outside a home-screen app. Safari can clear a website's saved data after a few weeks unused, but not
 * a home-screen app's, so the practice packs and queued runs are safest there. Always in the markup; shown by
 * CSS from <html data-offline-install> (set before the first paint by OFFLINE_BOOT), so it never pops in; the
 * ✕ hides it for good on this device.
 */
export function OfflineInstallCard() {
  return (
    <section aria-label="Play offline" data-offline-install-card className="jz-panel relative flex-col gap-1.5 py-3.5 pl-4 pr-12">
      <button
        type="button"
        onClick={dismissOfflineInstall}
        aria-label="Dismiss"
        className="press absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-[var(--ap-faint)]"
      >
        <Icon name="close" size={20} />
      </button>
      <div className="flex items-center gap-2.5">
        <Icon name="add-home" size={20} className="shrink-0 text-muted-foreground" />
        <h2 className="jz-row-title">Play offline</h2>
      </div>
      <p className="flex flex-wrap items-center gap-x-1 text-[14px] text-muted-foreground">
        <span>Tap</span>
        <Icon name="share" size={18} label="Share" className="-m-px" />
        <span className="font-semibold text-foreground">Share</span>
        <span>then</span>
        <span className="font-semibold text-foreground">Add to Home Screen</span>
      </p>
      <p className="text-[13.5px] text-muted-foreground">
        Practice then works with no signal, and Safari can’t clear your saved games.
      </p>
    </section>
  );
}
