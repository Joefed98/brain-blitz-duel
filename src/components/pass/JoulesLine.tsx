import { useEffect, useState } from "react";

import { useAccount } from "@/lib/account/accountApi";
import { joulesSince } from "@/lib/pass/passApi";

import { JoulesBolt } from "./JoulesBolt";

/**
 * The small Joules line on results (wave 2, session D2): "+170 Joules" in electric lime with the bolt mark, for what
 * this game earned (the server's Joules from `sinceMs` on, after it has credited the stored results). Drawn only for an
 * account this device has seen a pass for (testers until Season 1); nothing at all otherwise, so other screens' markup
 * is unchanged. Never placed next to a rating.
 */
export function JoulesLine({ sinceMs }: { sinceMs: number | null }) {
  const account = useAccount();
  const playerNumber = account.kind === "account" ? account.playerNumber : null;
  const [joules, setJoules] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    if (sinceMs === null || !playerNumber) return;
    // The server stores the result first; ask a moment later.
    const timer = setTimeout(() => {
      void joulesSince(sinceMs, playerNumber).then((j) => {
        if (live) setJoules(j);
      });
    }, 800);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [sinceMs, playerNumber]);
  if (joules === null || joules <= 0) return null;
  return (
    <p className="joules-line" data-joules-line={joules}>
      <JoulesBolt size={16} />+{joules.toLocaleString("en-GB")} Joules
    </p>
  );
}
