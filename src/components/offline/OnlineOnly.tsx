import { useEffect, useState, type ReactNode } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { isOnline, useOnline } from "@/lib/offline/online";

import { OfflineState } from "./OfflineState";

type Tab = "play" | "practice" | "tournaments" | "profile";

/**
 * An online-only screen (offline practice, 31 Oct 2026). With no connection it shows the offline state, with a
 * button to Practice, instead of failing or spinning. `live`: the screen follows the connection both ways
 * (Play, Tournaments); otherwise it is decided on entry only, so a room already open is never swapped out from
 * under a round by a moment without signal.
 */
export function OnlineOnly({ children, tabs, live = false, body }: { children: ReactNode; tabs?: Tab; live?: boolean; body: string }) {
  const online = useOnline();
  const [entered, setEntered] = useState(false);
  // The browser's own answer, not the first render's (which says online to match the server's page).
  useEffect(() => {
    if (isOnline()) setEntered(true);
  }, [online]);
  const show = live ? online : online || entered;
  if (show) return <>{children}</>;
  return (
    <PhoneShell {...(tabs ? { tabs } : { skin: "room" as const })}>
      <OfflineState body={body} />
    </PhoneShell>
  );
}
