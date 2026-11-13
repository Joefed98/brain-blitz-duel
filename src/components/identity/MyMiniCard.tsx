/**
 * This player's own mini card in app chrome (13 Nov 2026, one identity everywhere): the desktop rail's account button
 * and the Play tab's "Playing as" line. An account draws its card's mini card (their saved loadout, A1's, through the
 * identity backend); a guest keeps their colour and initial (or icon), as before.
 */
import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { MiniCard } from "@/design/identity";
import { useAccount } from "@/lib/account/accountApi";
import type { PlayerLook } from "@/lib/duel/playerLook";
import { useMyIdentity } from "@/lib/identity/identityApi";

import { lookFromLoadout } from "@/lib/identity/cardLook";

export function MyMiniCard({ guestLook, guestName, size }: { guestLook: PlayerLook; guestName: string; size: number }) {
  const account = useAccount();
  const identity = useMyIdentity();
  if (account.kind === "account")
    return (
      <span data-my-card="" className="inline-flex shrink-0">
        <MiniCard look={lookFromLoadout(identity.loadout, account.colour ?? null)} size={size} />
      </span>
    );
  return <PlayerBadge look={guestLook} name={guestName} size={size} />;
}
