/**
 * Where "Save your progress" may appear (Joe's decision, 10 Nov 2026): the tab pages only (Play, Practice,
 * Tournaments, Profile), drawn by PhoneShell's `tabs`, never over a round, its intro or reveal, or any result, podium,
 * standings or share screen. Reads the device's record after mount; only when a prompt is due does it load the sheet
 * (SaveProgress.tsx), so the tab pages carry nothing extra otherwise.
 */
import { lazy, Suspense, useEffect, useState } from "react";

import { hasPendingPrompt } from "@/lib/account/saveProgress";

const SaveProgressPrompt = lazy(() => import("./SaveProgress").then((m) => ({ default: m.SaveProgressPrompt })));

export function SaveProgressSlot() {
  const [due, setDue] = useState(false);
  useEffect(() => {
    setDue(hasPendingPrompt());
  }, []);
  if (!due) return null;
  return (
    <Suspense fallback={null}>
      <SaveProgressPrompt />
    </Suspense>
  );
}
