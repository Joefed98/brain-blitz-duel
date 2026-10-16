import { useEffect, useState } from "react";

import { arcadeScreenTickMs, onArcadeReducedChange } from "./lowEnd";

/** React: the clock tick for a wanted `ms` (arcadeScreenTickMs), re-read when the governor changes. */
export function useArcadeScreenTickMs(ms: number): number {
  const [tick, setTick] = useState(() => arcadeScreenTickMs(ms));
  useEffect(() => {
    setTick(arcadeScreenTickMs(ms));
    return onArcadeReducedChange(() => setTick(arcadeScreenTickMs(ms)));
  }, [ms]);
  return tick;
}
