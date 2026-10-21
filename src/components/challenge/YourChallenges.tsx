import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { challengeEndsIn, challengeResultLine, type ChallengeSummary } from "@/lib/duel/challenge";
import { myChallenges } from "@/lib/duel/challengeApi";
import { readChallengeRecord } from "@/lib/duel/challengeRecord";

/** Friends shown on a challenge's card before "and N more". */
const SHOWN = 4;

/**
 * Profile's "Your challenges" (22 Oct 2026): the challenges this device made or sent (device storage)
 * with each friend's result from the server ("Sam beat you 612–580"). Hidden until challenges are
 * available, and while the device has none.
 */
export function YourChallenges({
  available,
  onOpen,
}: {
  available: boolean;
  onOpen: (code: string) => void;
}) {
  const [list, setList] = useState<ChallengeSummary[] | null>(null);
  useEffect(() => {
    if (!available) return;
    let live = true;
    const codes = readChallengeRecord().mine.map((m) => m.code);
    void myChallenges(codes).then(
      (next) => live && setList(next),
      () => live && setList([]),
    );
    return () => {
      live = false;
    };
  }, [available]);
  if (!available || !list || list.length === 0) return null;
  const now = Date.now();
  return (
    <section aria-label="Your challenges" data-your-challenges className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-bold">Your challenges</h2>
      <ul className="flex flex-col gap-2">
        {list.map((c) => (
          <li key={c.code}>
            <button
              type="button"
              data-your-challenge={c.code}
              onClick={() => onOpen(c.code)}
              className="th-card press flex w-full items-center gap-3 rounded-xl border border-border bg-card/80 px-4 py-3 text-left"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-sm font-bold tracking-widest text-foreground">
                    {c.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {c.roundCount} rounds ·{" "}
                    {c.myTotal === null ? "not finished" : `you ${c.myTotal}`}
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-mono text-[11px] uppercase text-muted-foreground">
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
              <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
