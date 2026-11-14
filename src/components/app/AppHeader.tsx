import { AppWordmark } from "@/components/brand/AppWordmark";
import { MuteToggle } from "@/components/duel/MuteToggle";
import { AvatarButton } from "@/components/nav/AvatarButton";
import { useNavPlacement } from "@/components/nav/navigation";

import { CoinCounter, useCoinCount } from "./CoinCounter";

/**
 * The main screens' header (Prompt R, 23 Oct 2026; the navigation step, 14 Nov 2026): the player's avatar top left
 * (AvatarButton: Profile for an account, the save-your-progress sheet for a guest), the wordmark beside it, and the
 * sound and music controls (their menus unchanged) on the right; an account's coin counter (CoinCounter) sits before
 * the sound button where the Shop switch is on. Drawn by PhoneShell on every screen with `tabs`; game, room and
 * results screens keep their own top bar. Where the rail is drawn (a computer, a sideways tablet) the rail carries
 * the avatar, logo and sound instead, so no header there.
 */
export function AppHeader() {
  const placement = useNavPlacement();
  const coins = useCoinCount();
  if (placement === "rail") return null;
  return (
    <header data-app-header className="ap-header jz-nav jz-nav-header">
      <span className="jz-nav-header-left">
        <AvatarButton size={36} />
        <AppWordmark />
      </span>
      {coins === null ? (
        <MuteToggle />
      ) : (
        <span className="ap-header-tools">
          <CoinCounter />
          <MuteToggle />
        </span>
      )}
    </header>
  );
}
