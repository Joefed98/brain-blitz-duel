import { AppWordmark } from "@/components/brand/AppWordmark";
import { MuteToggle } from "@/components/duel/MuteToggle";
import { useLayoutMode } from "@/lib/layoutMode";

import { CoinCounter, useCoinCount } from "./CoinCounter";

/**
 * The four tab screens' header (Prompt R, 23 Oct 2026): the wordmark on the left, the sound and music
 * controls (their menus unchanged) on the right in the secondary text colour. Drawn by PhoneShell on
 * every screen with `tabs`; game, room and results screens keep their own top bar.
 * Wave 2: an account's coin counter (CoinCounter) sits before the sound button where the Shop switch is on; without
 * it the header's markup is exactly the old one (no wrapper).
 */
export function AppHeader() {
  // The computer layout (31 Oct 2026): the left rail (AppRail) carries the logo and sound instead, so no header there.
  const desktop = useLayoutMode() === "desktop";
  const coins = useCoinCount();
  if (desktop) return null;
  // Without the counter the header is exactly as before (celebrations-off.json pins the home screen's markup).
  if (coins === null)
    return (
      <header data-app-header className="ap-header">
        <AppWordmark />
        <MuteToggle />
      </header>
    );
  return (
    <header data-app-header className="ap-header">
      <AppWordmark />
      <span className="ap-header-tools">
        <CoinCounter />
        <MuteToggle />
      </span>
    </header>
  );
}
