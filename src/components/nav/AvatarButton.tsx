import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { goToTab } from "@/components/app/AppTabBar";
import { TAB_PATHS, type AppTab } from "@/design/components/TabBar";
import { MyMiniCard } from "@/components/identity/MyMiniCard";
import { useAccount } from "@/lib/account/accountApi";
import { getStoredName } from "@/lib/duel/session";
import { rememberedLook, type PlayerLook } from "@/lib/duel/playerLook";
import { unlockAudio } from "@/lib/sound";

/**
 * The player's avatar, top left on every main screen (Home, Games, Compete, Shop, You) and at the top of the rail
 * (phase 2 step 1, 14 Nov 2026). An account sees their card's avatar, a guest their colour and initial; for both it
 * opens You (the Profile page), as the You tab does (P1, 21 Nov 2026, plan section 3.2: no sheet on a tap). A guest's
 * You page carries the one calm "Save your progress" row.
 */
export function useGuestLook(): { look: PlayerLook; name: string } {
  const [state, setState] = useState<{ look: PlayerLook; name: string }>({ look: { colour: 0, icon: null }, name: "" });
  useEffect(() => {
    const remembered = rememberedLook();
    setState({ look: { colour: remembered.colour ?? 0, icon: remembered.icon ?? null }, name: getStoredName() });
  }, []);
  return state;
}

export function AvatarButton({
  size = 40,
  showName = false,
  className = "",
  data,
}: {
  size?: number;
  /** The rail's wide form: the name beside the avatar. */
  showName?: boolean;
  className?: string;
  data?: Record<string, string>;
}) {
  const router = useRouter();
  const account = useAccount();
  const { look, name } = useGuestLook();
  const guest = account.kind === "guest" || account.kind === "incomplete";
  const shown = account.kind === "account" ? account.username : name || "You";
  const label = "Your profile";
  return (
    <>
      <a
        href="/profile"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          unlockAudio();
          if (window.location.pathname === "/profile") return;
          // From a main tab: as the You tab (tabs opened from Home are pushed, from another tab replace it).
          const from = tabAt(window.location.pathname);
          if (from) return goToTab(router, from, "you");
          // Elsewhere (a room's rail): pushed, so Back returns to the screen the avatar was tapped on.
          void router.navigate({ to: "/profile", state: { fromPlayTab: true } as never });
        }}
        aria-label={label}
        title={showName ? undefined : label}
        data-nav-avatar={guest ? "guest" : account.kind === "account" ? "account" : "loading"}
        {...data}
        className={`jz-nav-avatar press ${className}`}
      >
        <MyMiniCard guestLook={look} guestName={name || "You"} size={size} />
        {showName ? (
          <span data-ellipsis className="dk-rail-name">
            {shown}
          </span>
        ) : null}
      </a>
    </>
  );
}

/** The main tab a path is (Home, Games, Compete, Shop), or null. */
function tabAt(path: string): AppTab | null {
  const tabs: AppTab[] = ["play", "practice", "tournaments", "shop"];
  return tabs.find((t) => TAB_PATHS[t] === path) ?? null;
}
