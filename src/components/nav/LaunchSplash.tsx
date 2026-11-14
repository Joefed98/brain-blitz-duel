import { useEffect, useState } from "react";

import { AppWordmark } from "@/components/brand/AppWordmark";

import { NavArt } from "./NavArt";

/**
 * The launch screen (phase 2 step 1, 14 Nov 2026): the Joulz bolt from the art kit on navy over the wordmark, drawn with the
 * server-rendered page and gone the moment the app has started in the browser (hydrated), never held for a fixed
 * time. Under Reduce motion the bolt doesn't scale in. It covers the page only while its buttons can't yet answer.
 */
export function LaunchSplash({ hold = false }: { hold?: boolean }) {
  const [started, setStarted] = useState(false);
  // `hold`: the screen checks' review draw only (scripts/safe-area-harness.tsx).
  useEffect(() => setStarted(!hold), [hold]);
  return (
    <div className="jz-nav jz-launch" data-launch data-skin="play" data-done={started ? "" : undefined} role="status" aria-label="Joulz is starting" aria-hidden={started ? true : undefined}>
      <NavArt name="bolt" size={96} />
      <span data-one-line className="jz-launch-name">
        <AppWordmark still />
      </span>
    </div>
  );
}
