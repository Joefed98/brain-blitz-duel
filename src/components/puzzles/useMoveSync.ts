import { useCallback, useRef } from "react";

import type { MovesView } from "@/lib/duel/moves";
import type { CheckMoves } from "@/puzzles/types";

/**
 * Sends the whole move list to the server after each action and hands back the
 * newest reply. Replies can arrive out of order on a phone connection, so a
 * reply to an older request than one already applied is dropped; a failed
 * request is retried while it is still the latest.
 */
export function useMoveSync<T extends MovesView["type"]>(
  checkMoves: CheckMoves | undefined,
  type: T,
  /** Called with the reply and the exact move string it answers. */
  onView: (view: Extract<MovesView, { type: T }>, moves: string) => void,
): (moves: string) => void {
  const sent = useRef(0);
  const applied = useRef(0);
  const handler = useRef(onView);
  handler.current = onView;
  return useCallback(
    (moves: string) => {
      if (!checkMoves) return;
      const seq = ++sent.current;
      const attempt = (tries: number) => {
        checkMoves(moves)
          .then((view) => {
            if (!view || view.type !== type || seq <= applied.current) return;
            applied.current = seq;
            handler.current(view as Extract<MovesView, { type: T }>, moves);
          })
          .catch(() => {
            if (tries < 3 && seq === sent.current) setTimeout(() => attempt(tries + 1), 500 * (tries + 1));
          });
      };
      attempt(0);
    },
    [checkMoves, type],
  );
}
