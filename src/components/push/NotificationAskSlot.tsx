/**
 * Where the notification ask may appear (B2): the tab pages only, drawn by PhoneShell's `tabs`, as "Save your
 * progress" (which is for guests; this is for accounts, so the two never meet). Renders nothing, and loads nothing,
 * while the switch is off, for anyone outside the audience (pushConfig.ts: a guest, or a non-tester while
 * notifications are for testers only) or while no ask is due on this device.
 */
import { lazy, Suspense, useEffect, useState } from "react";

import { pushForPlayer, pushPublicKey } from "@/config/pushConfig";
import { useAccount } from "@/lib/account/accountApi";

const NotificationAsk = lazy(() => import("./NotificationAsk").then((m) => ({ default: m.NotificationAsk })));

export function NotificationAskSlot() {
  const account = useAccount();
  const player = account.kind === "account" ? account.playerNumber : null;
  const inAudience = pushForPlayer(player);
  const [due, setDue] = useState(false);
  useEffect(() => {
    if (!pushPublicKey() || !inAudience) return;
    void import("@/lib/push/pushClient").then((m) => setDue(m.pendingAsk() !== null));
  }, [inAudience]);
  if (!due || !inAudience) return null;
  return (
    <Suspense fallback={null}>
      <NotificationAsk />
    </Suspense>
  );
}
