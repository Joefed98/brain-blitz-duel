/**
 * Where the notification ask may appear (B2): the tab pages only, drawn by PhoneShell's `tabs`, as "Save your
 * progress" (which is for guests; this is for accounts, so the two never meet). Renders nothing, and loads nothing,
 * while the switch is off or no ask is due on this device.
 */
import { lazy, Suspense, useEffect, useState } from "react";

import { pushPublicKey } from "@/config/pushConfig";

const NotificationAsk = lazy(() => import("./NotificationAsk").then((m) => ({ default: m.NotificationAsk })));

export function NotificationAskSlot() {
  const [due, setDue] = useState(false);
  useEffect(() => {
    if (!pushPublicKey()) return;
    void import("@/lib/push/pushClient").then((m) => setDue(m.pendingAsk() !== null));
  }, []);
  if (!due) return null;
  return (
    <Suspense fallback={null}>
      <NotificationAsk />
    </Suspense>
  );
}
