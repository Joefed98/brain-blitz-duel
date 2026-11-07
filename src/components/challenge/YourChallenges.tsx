import { useEffect, useState } from "react";

import { challengeEndsIn, challengeResultLine, type ChallengeSummary } from "@/lib/duel/challenge";
import { myChallenges } from "@/lib/duel/challengeApi";
import { readChallengeRecord } from "@/lib/duel/challengeRecord";
import { Icon } from "@/design/components";

/** Friends shown on a challenge's card before "and N more". */
const SHOWN = 4;

/**
 * Profile's "Your challenges" (22 Oct 2026): the challenges this device made or sent (device storage)
 * with each friend's result from the server ("Sam beat you 612–580"). Hidden until challenges are
 * available, and while the device has none.
 */
export function YourChallenges({ onOpen }: { onOpen: (code: string) => void }) {
  const [list, setList] = useState<ChallengeSummary[] | null>(null);
  useEffect(() => {
    // Only a device that has made or sent a challenge asks the server (an error, e.g. before the
    // migration, hides the section).
    const codes = readChallengeRecord().mine.map((m) => m.code);
    if (!codes.length) return;
    let live = true;
    void myChallenges(codes).then(
      (next) => live && setList(next),
      () => live && setList([]),
    );
    return () => {
      live = false;
    };
  }, []);
  if (!list || list.length === 0) return null;
  const now = Date.now();
  return (
    <section aria-label="Your challenges" data-your-challenges className="ap-section">
      <div className="ap-section-head">
        <h2 className="ap-section-title">Your challenges</h2>
      </div>
      <ul className="jz-panel">
        {list.map((c) => (
          <li key={c.code}>
            <button
              type="button"
              data-your-challenge={c.code}
              onClick={() => onOpen(c.code)}
              className="jz-row press"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-[16px] font-semibold tracking-[0.12em] text-foreground">
                    {c.code}
                  </span>
                  <span data-ellipsis className="min-w-0 flex-1 truncate text-[13.5px] text-muted-foreground">
                    {c.roundCount} rounds,{" "}
                    {c.myTotal === null ? "not finished" : `you ${c.myTotal}`}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[12.5px] text-muted-foreground">
                    {challengeEndsIn(c.expiresAt, now)}
                  </span>
                </span>
                {c.friends.length === 0 ? (
                  <span className="truncate text-sm text-muted-foreground">
                    No one yet. Send the link.
                  </span>
                ) : (
                  <>
                    {c.friends.slice(0, SHOWN).map((friend, i) => (
                      <span
                        key={`${friend.name}-${i}`}
                        data-challenge-line
                        data-ellipsis
                        className={`truncate text-sm ${friend.finished && c.myTotal !== null && (friend.total ?? 0) > c.myTotal ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {challengeResultLine(friend, c.myTotal)}
                      </span>
                    ))}
                    {c.friends.length > SHOWN ? (
                      <span className="truncate text-xs text-muted-foreground">
                        and {c.friends.length - SHOWN} more
                      </span>
                    ) : null}
                  </>
                )}
              </span>
              <Icon name="chevron-right" size={20} className="ap-chevron" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
