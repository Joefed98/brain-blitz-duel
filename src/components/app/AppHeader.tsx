import { AppWordmark } from "@/components/brand/AppWordmark";
import { MuteToggle } from "@/components/duel/MuteToggle";

/**
 * The four tab screens' header (Prompt R, 23 Oct 2026): the wordmark on the left, the sound and music
 * controls (their menus unchanged) on the right in the secondary text colour. Drawn by PhoneShell on
 * every screen with `tabs`; game, room and results screens keep their own top bar.
 */
export function AppHeader() {
  return (
    <header data-app-header className="ap-header">
      <AppWordmark />
      <MuteToggle />
    </header>
  );
}
