import type { ReactNode } from "react";

import { AvatarButton } from "@/components/nav/AvatarButton";
import { useNavPlacement } from "@/components/nav/navigation";

import { CoinCounter, useCoinCount } from "./CoinCounter";

/**
 * The main screens' header (Prompt R, 23 Oct 2026; the navigation step and the components step, 14 Nov 2026): the
 * player's avatar top left (AvatarButton: Profile for an account, the save-your-progress sheet for a guest) and the
 * page's title (`title`, the page's one h1). Joe, 14 Nov 2026: no wordmark (the brand stays on the launch screen and in
 * More) and no sound or music controls (they live in Settings and each game's own menu). An account's coin counter
 * (CoinCounter) stays on the right where the Shop switch is on, and a page may add one control there (`action`,
 * Profile's settings). Drawn by PhoneShell on every screen with `tabs`. Where the rail is drawn (a computer, a
 * sideways tablet) the rail carries the avatar, so the header is the title alone (no data-app-header).
 */
export function AppHeader({ title, action }: { title?: string | undefined; action?: ReactNode }) {
  const placement = useNavPlacement();
  const coins = useCoinCount();
  if (placement === "rail") {
    if (!title) return action ?? null;
    const heading = (
      <h1 data-page-title className="ap-title">
        {title}
      </h1>
    );
    return action ? (
      <div className="flex items-center justify-between gap-2">
        {heading}
        {action}
      </div>
    ) : (
      heading
    );
  }
  return (
    <header data-app-header className="ap-header jz-nav jz-nav-header">
      <span className="jz-nav-header-left">
        <AvatarButton size={36} />
        {title ? (
          <h1 data-page-title className="jz-page-title">
            {title}
          </h1>
        ) : null}
      </span>
      {coins === null && !action ? null : (
        <span className="ap-header-tools">
          {coins === null ? null : <CoinCounter />}
          {action}
        </span>
      )}
    </header>
  );
}
