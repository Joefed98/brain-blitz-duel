import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { SaveProgressOffer } from "@/components/account/SaveProgress";
import { MyMiniCard } from "@/components/identity/MyMiniCard";
import { useAccount } from "@/lib/account/accountApi";
import { getStoredName } from "@/lib/duel/session";
import { rememberedLook, type PlayerLook } from "@/lib/duel/playerLook";
import { unlockAudio } from "@/lib/sound";

/**
 * The player's avatar, top left on every main screen (Home, Games, Tournaments, Shop, More) and at the top of the
 * rail (phase 2 step 1, 14 Nov 2026). An account sees their card's avatar and it opens their Profile; a guest sees
 * their colour and initial and it opens the save-your-progress sheet, as Profile's Customise does for a guest.
 * Profile itself stays reachable for everyone from More.
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
  const [offer, setOffer] = useState(false);
  const guest = account.kind === "guest" || account.kind === "incomplete";
  const shown = account.kind === "account" ? account.username : name || "You";
  const label = guest ? "Your avatar: save your progress" : "Your profile";
  return (
    <>
      <a
        href="/profile"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          unlockAudio();
          if (guest) {
            setOffer(true);
            return;
          }
          if (window.location.pathname === "/profile") return;
          // Pushed, so Back returns to the screen the avatar was tapped on.
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
      {offer ? <SaveProgressOffer onClose={() => setOffer(false)} /> : null}
    </>
  );
}
