/**
 * The phone's read of You's "Rated wins" gauge (P3, 22 Nov 2026): the server's count (ratedWinCountFn), held in memory
 * for this visit. Checks and screens set `window.__DUELZ_RATED_WINS__` ({ played, wins }) in place of the call; never
 * read in a production build. Under automation with no stand-in nothing is asked (no existing check gains a call).
 */
import { useEffect, useState } from "react";

export interface RatedWins {
  played: number;
  wins: number;
}

function standIn(): RatedWins | null | undefined {
  if (import.meta.env.PROD || typeof window === "undefined") return undefined;
  const v = (window as unknown as Record<string, unknown>)["__DUELZ_RATED_WINS__"];
  if (v && typeof v === "object") {
    const r = v as Partial<RatedWins>;
    return { played: Number(r.played) || 0, wins: Number(r.wins) || 0 };
  }
  return typeof navigator !== "undefined" && navigator.webdriver ? null : undefined;
}

/** The signed-in player's counted rated matches and wins, or null until (or unless) the server answers. */
export function useRatedWins(enabled: boolean): RatedWins | null {
  const [wins, setWins] = useState<RatedWins | null>(null);
  useEffect(() => {
    if (!enabled) return setWins(null);
    const stand = standIn();
    if (stand !== undefined) return setWins(stand);
    let live = true;
    void (async () => {
      try {
        const { ratedWinCountFn } = await import("./ratedWins.functions");
        const answer = await ratedWinCountFn();
        if (live) setWins(answer ?? null);
      } catch {
        if (live) setWins(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [enabled]);
  return wins;
}
