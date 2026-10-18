import { useEffect, useState } from "react";

/**
 * The current time for schedule displays: updated at each of `moments` as it passes (a lobby
 * opening, a game starting) and at least once a minute, never every frame.
 */
export function useClock(moments: readonly number[] = []): number {
  const [now, setNow] = useState(() => Date.now());
  const key = moments.join(",");
  useEffect(() => {
    const next = moments.filter((at) => at > now).reduce((a, b) => Math.min(a, b), now + 60_000);
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(250, next - now + 50));
    return () => window.clearTimeout(timer);
  }, [now, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return now;
}
