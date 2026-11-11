/**
 * The notification ask (wave 2 train B, session B2; docs/push-notifications.md): a small pop-up on a tab page (never a
 * round, intro, reveal or result), shown once a useful moment marked it due (pushClient.ts notePushMoment) and never on
 * first open. On an iPhone in Safari it is a short how-to instead (web push needs the Home Screen app). Accounts only.
 * Nothing renders while the switch is off.
 */
import { useEffect, useState } from "react";

import { Button } from "@/design/components";
import { useAccount } from "@/lib/account/accountApi";
import {
  askKind,
  declineNotifications,
  dismissHomeScreenHowTo,
  enableNotifications,
  pendingAsk,
  type AskKind,
} from "@/lib/push/pushClient";
import type { AskMoment } from "@/lib/push/rules";

export function NotificationAsk() {
  const account = useAccount();
  const [due, setDue] = useState<{ moment: AskMoment; kind: Exclude<AskKind, null> } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (account.kind !== "account") return;
    const moment = pendingAsk();
    const kind = askKind();
    if (moment && kind) setDue({ moment, kind });
  }, [account.kind]);

  if (!due) return null;

  if (due.kind === "home-screen")
    return (
      <div role="dialog" aria-label="Notifications on iPhone" className="acct-popup" data-push-ask="home-screen">
        <p className="jz-card-title">Notifications on iPhone</p>
        <p className="acct-lede">
          Add Joulz to your Home Screen first: tap Share, then Add to Home Screen. Open Joulz from there and turn
          notifications on in Settings.
        </p>
        <Button
          variant="secondary"
          size={46}
          block
          data-push-ask-dismiss
          onClick={() => {
            dismissHomeScreenHowTo();
            setDue(null);
          }}
        >
          Got it
        </Button>
      </div>
    );

  return (
    <div role="dialog" aria-label="Turn on notifications" className="acct-popup" data-push-ask="ask">
      <p className="jz-card-title">Turn on notifications?</p>
      <p className="acct-lede">
        We’ll tell you when a friend wants to play and before your Daily streak ends. Three a day at most, never at night.
      </p>
      <div className="acct-popup-row">
        <Button
          variant="secondary"
          size={46}
          disabled={busy}
          data-push-ask-dismiss
          onClick={() => {
            void declineNotifications(due.moment);
            setDue(null);
          }}
        >
          Not now
        </Button>
        <Button
          variant="gold"
          size={46}
          disabled={busy}
          data-push-ask-allow
          onClick={() => {
            setBusy(true);
            void enableNotifications(due.moment).finally(() => setDue(null));
          }}
        >
          Turn on
        </Button>
      </div>
    </div>
  );
}
