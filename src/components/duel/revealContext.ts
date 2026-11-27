/**
 * The reveal template's two contexts for a game's own Reveal (moved out of RevealScreen.tsx by A2, 27 Nov 2026, unchanged):
 * the game's views on the template's control and the stage's size. React only, so the puzzles that read them import
 * nothing of the template's design or identity modules (plus-check walks the puzzles' imports).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * A game's own views on the template's stage (P2, 22 Nov 2026, for the art sessions: A1's Word pairs, Interlock, Slider,
 * Cryptogrid and Swapword, in place of the shared Solution / Yours switch). A game's Reveal calls `useRevealViews`
 * with its views' ids and labels; the template draws the views control above the stage and the hook answers the
 * chosen id, so the game draws that view itself. While a game has views the shared switch (SolutionSwitch) is not
 * drawn. Outside a template (a check's bare render) the hook answers the view it opens on.
 *
 * A2's additions (27 Nov 2026, for the Attention reveals, G6): a view may carry a tone (`good` / `bad`: a tray, grid or
 * picture the player got right or wrong, drawn as a dot on its option); `initial` is the view a reveal opens on (the
 * first one the player got wrong); and a reveal may have more than one control (`group`: Double Take's picture, then its
 * top or bottom panel), each its own row above the stage, in the order the game calls the hook.
 */
export interface RevealViewLabel {
  id: string;
  label: string;
  /** A view the player got right (`good`) or wrong (`bad`): a dot on its option. */
  tone?: "good" | "bad" | undefined;
}

/** One control above the stage: a game's views under one name, and the one chosen. */
export interface RevealViewGroup {
  group: string;
  /** The control's accessible name. */
  label: string;
  views: RevealViewLabel[];
  current: string;
}

interface GameViewsHost {
  register: (group: string, label: string, views: RevealViewLabel[] | null, initial: string | undefined) => void;
  current: Readonly<Record<string, string>>;
}

const GameViewsContext = createContext<GameViewsHost | null>(null);

/** The main control's group (a reveal's first, and the one most games have alone). */
export const MAIN_VIEW_GROUP = "views";

/**
 * For a game's Reveal: its views (two or more) on the template's control; answers the chosen view's id. `initial` is
 * the view it opens on (else the first); `group` and `label` name a second control.
 */
export function useRevealViews(
  views: readonly RevealViewLabel[],
  { initial, group = MAIN_VIEW_GROUP, label = "What to show" }: { initial?: string | undefined; group?: string; label?: string } = {},
): string {
  const host = useContext(GameViewsContext);
  const key = views.map((v) => `${v.id}:${v.label}:${v.tone ?? ""}`).join("|");
  useEffect(() => {
    if (!host) return;
    host.register(group, label, views.length > 1 ? [...views] : null, initial);
    return () => host.register(group, label, null, undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host?.register, key, group, label]);
  const opens = initial !== undefined && views.some((v) => v.id === initial) ? initial : (views[0]?.id ?? "");
  const current = host?.current[group];
  return current && views.some((v) => v.id === current) ? current : opens;
}

/** For the reveal that holds a game's Reveal (AnswerReveal): the host the hook registers with, and its controls. */
export function useGameViewsHost(): {
  host: GameViewsHost;
  /** Every control the game registered, in order. */
  groups: RevealViewGroup[];
  /** The main control's views (null without one). */
  views: RevealViewLabel[] | null;
  /** The main control's chosen view. */
  current: string | null;
  /** Choose a view in the main control. */
  setCurrent: (id: string) => void;
  /** Choose a view in any control. */
  setView: (group: string, id: string) => void;
} {
  const [registered, setRegistered] = useState<{ group: string; label: string; views: RevealViewLabel[] }[]>([]);
  const [current, setCurrentMap] = useState<Record<string, string>>({});
  const register = useCallback((group: string, label: string, next: RevealViewLabel[] | null, initial: string | undefined) => {
    setRegistered((was) => {
      const at = was.findIndex((g) => g.group === group);
      if (!next) return at < 0 ? was : was.filter((g) => g.group !== group);
      const entry = { group, label, views: next };
      return at < 0 ? [...was, entry] : was.map((g, i) => (i === at ? entry : g));
    });
    setCurrentMap((was) => {
      const kept = was[group];
      if (!next) {
        if (kept === undefined) return was;
        const rest = { ...was };
        delete rest[group];
        return rest;
      }
      if (kept !== undefined && next.some((v) => v.id === kept)) return was;
      const opens = initial !== undefined && next.some((v) => v.id === initial) ? initial : next[0]!.id;
      return { ...was, [group]: opens };
    });
  }, []);
  const host = useMemo<GameViewsHost>(() => ({ register, current }), [register, current]);
  const setView = useCallback((group: string, id: string) => setCurrentMap((was) => (was[group] === id ? was : { ...was, [group]: id })), []);
  const setCurrent = useCallback((id: string) => setView(MAIN_VIEW_GROUP, id), [setView]);
  const groups = useMemo(
    () => registered.map((g) => ({ ...g, current: current[g.group] ?? g.views[0]!.id })),
    [registered, current],
  );
  const main = groups.find((g) => g.group === MAIN_VIEW_GROUP) ?? null;
  return { host, groups, views: main?.views ?? null, current: main?.current ?? null, setCurrent, setView };
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
