import { useEffect } from "react";

import { setCrashContext } from "./crashReporting";

/**
 * Tags crash reports with the game and round on screen (crashReporting.ts) while the calling screen
 * is up; cleared when it leaves. Ids and numbers only. A no-op cost while reporting is off.
 */
export function useCrashContext(
  gameId: string | null | undefined,
  round: number | null | undefined,
): void {
  useEffect(() => {
    setCrashContext({ gameId: gameId ?? null, round: round ?? null });
  }, [gameId, round]);
  useEffect(() => () => setCrashContext({ gameId: null, round: null }), []);
}
