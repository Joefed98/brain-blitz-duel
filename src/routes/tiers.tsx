import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { TierLadder } from "@/components/rated/TierLadder";
import { Button, Icon, SkeletonPage } from "@/design/components";
import { APP_NAME } from "@/lib/brand";
import type { TierLadderRung } from "@/lib/data/ratings";
import { tierLadder } from "@/lib/rated/tiers";
import { backendNow, useRatedStatus } from "@/lib/rated/ratedApi";
import { useAccount } from "@/lib/account/accountApi";

/**
 * The tier ladder (wave 3, session W3c; mockup 14 in docs/mockups/wave-3/). Rated players only while rated play is
 * testers only: anyone it isn't open to (a guest, a non-tester, no rated server yet) is sent to Play.
 * tier_ladder_viewed is recorded where the ladder is opened from (Home, a result, the reveal, Profile).
 */
export const Route = createFileRoute("/tiers")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${APP_NAME} tiers` }, { name: "robots", content: "noindex" }],
  }),
  component: TiersScreen,
});

function TiersScreen() {
  const router = useRouter();
  const account = useAccount();
  const status = useRatedStatus();
  // W3a's ladder (getTierLadder); until it answers, the same rungs with no shares (tierLadder()).
  const [rungs, setRungs] = useState<TierLadderRung[]>(() => tierLadder());
  const [waited, setWaited] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    // Give the status a moment to arrive before deciding the page isn't for this player.
    const t = window.setTimeout(() => setWaited(true), 1500);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (account.kind === "guest" || account.kind === "incomplete" || (waited && !status))
      void router.navigate({ to: "/", replace: true });
  }, [account.kind, waited, status, router]);
  useEffect(() => {
    if (!status || asked.current) return;
    asked.current = true;
    void backendNow().then(async (b) => {
      const live = b ? await b.ladder().catch(() => null) : null;
      if (live) setRungs(live);
    });
  }, [status]);

  return (
    <PhoneShell skin="profile" bare>
      <div className="rt-page" data-tiers-page={status ? "ready" : "loading"}>
        <header className="cz-head">
          <span className="cz-head-title">
            <Button variant="icon" aria-label="Back" onClick={() => router.history.back()} className="-ml-2.5">
              <Icon name="back" size={22} />
            </Button>
            <h1>Tiers</h1>
          </span>
        </header>
        {status ? (
          <TierLadder rank={status.standing.state === "placed" ? status.standing.rank : null} rungs={rungs} />
        ) : (
          <SkeletonPage label="Loading the tiers" />
        )}
      </div>
    </PhoneShell>
  );
}
