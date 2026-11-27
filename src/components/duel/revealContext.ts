/**
 * The reveal template's two contexts for a game's own Reveal (moved out of RevealScreen.tsx by A2, 27 Nov 2026, unchanged):
 * the game's views on the template's control and the stage's size. React only, so the puzzles that read them import
 * nothing of the template's design or identity modules (plus-check walks the puzzles' imports).
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * A game's own views on the template's stage (P2, 22 Nov 2026, for the art sessions: A1's Word pairs, Interlock, Slider,
 * Cryptogrid and Swapword, in place of the shared Solution / Yours switch). A game's Reveal calls `useRevealViews`
 * with its views' ids and labels; the template draws the one views control above the stage and the hook answers the
 * chosen id, so the game draws that view itself. While a game has views the shared switch (SolutionSwitch) is not
 * drawn. Outside a template (a check's bare render) the hook answers the first view.
 */
export interface RevealViewLabel {
  id: string;
  label: string;
}

interface GameViewsHost {
  register: (views: RevealViewLabel[] | null) => void;
  current: string | null;
}

const GameViewsContext = createContext<GameViewsHost | null>(null);

/** For a game's Reveal: its views (two or more) on the template's control; answers the chosen view's id. */
export function useRevealViews(views: readonly RevealViewLabel[]): string {
  const host = useContext(GameViewsContext);
  const key = views.map((v) => `${v.id}:${v.label}`).join("|");
  useEffect(() => {
    if (!host) return;
    host.register(views.length > 1 ? [...views] : null);
    return () => host.register(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host?.register, key]);
  const current = host?.current;
  return current && views.some((v) => v.id === current) ? current : (views[0]?.id ?? "");
}

/**
 * Whether a game's Reveal is inside the reveal template (AnswerReveal), which draws its views control (A2, 27 Nov 2026).
 * Outside it (the results screen's replays, a check's bare render) there is no control, so a game draws every view, as
 * it did before the template: a replay shows the player's own board beside the solution.
 */
export function useRevealHosted(): boolean {
  return useContext(GameViewsContext) !== null;
}

/** For the reveal that holds a game's Reveal (AnswerReveal): the host the hook registers with, and its control. */
export function useGameViewsHost(): {
  host: GameViewsHost;
  views: RevealViewLabel[] | null;
  current: string | null;
  setCurrent: (id: string) => void;
} {
  const [views, setViews] = useState<RevealViewLabel[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const host = useMemo<GameViewsHost>(
    () => ({
      register: (next) => {
        setViews(next);
        setCurrent((was) => (next && was && next.some((v) => v.id === was) ? was : (next?.[0]?.id ?? null)));
      },
      current,
    }),
    [current],
  );
  return { host, views, current, setCurrent };
}

/** The provider a reveal wraps its game's Reveal in (AnswerReveal). */
export const RevealGameViewsProvider = GameViewsContext.Provider;

/**
 * The stage's size for a game's Reveal (P2, 22 Nov 2026, for A2's Pattern boards, G4): the template's stage box in CSS
 * px, measured on layout and every resize (never a frame). `{ w: 0, h: 0 }` outside a template or before it is laid out.
 * The stage's height is what the template gives the board on a puzzle reveal (the space under the score card).
 */
export const StageSizeContext = createContext<{ w: number; h: number }>({ w: 0, h: 0 });
export function useRevealStageSize(): { w: number; h: number } {
  return useContext(StageSizeContext);
}
