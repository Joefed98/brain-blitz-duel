import { useEffect, useState } from "react";

import { Toast } from "@/design/components";
import { markLevelSeen, usePass } from "@/lib/pass/passApi";

/**
 * The level-up notice (wave 2, session D2): "Level 12 reached" with what's waiting, once per level, above the tab bar on
 * tab pages only (AppTabBar), so never over a round, a reveal or any result, podium, standings or share screen. Reads
 * the pass only where it is already known (no request of its own). Gone after a few seconds, or on a tap (which opens
 * the pass).
 */
const SHOW_MS = 6_000;

export function PassLevelNotice({ onOpen }: { onOpen: () => void }) {
  const pass = usePass(false);
  const [shown, setShown] = useState<number | null>(null);
  const level = pass.state === "open" ? pass.view.levelNotice : null;
  useEffect(() => {
    if (level === null) return;
    setShown(level);
    void markLevelSeen(level);
  }, [level]);
  useEffect(() => {
    if (shown === null) return;
    const timer = window.setTimeout(() => setShown(null), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);
  if (shown === null) return null;
  const waiting = pass.state === "open" ? pass.view.claimable : 0;
  return (
    <Toast
      as="button"
      tone="live"
      className="shop-back-toast pass-level-toast"
      data-pass-level-notice={shown}
      onClick={() => {
        setShown(null);
        onOpen();
      }}
    >
      Level {shown} reached in the pass{waiting > 0 ? ` · ${waiting} to claim` : ""}
    </Toast>
  );
}
