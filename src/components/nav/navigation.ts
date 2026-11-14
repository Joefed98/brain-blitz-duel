import { useRouter } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useState } from "react";

import { TAB_PATHS, type AppTab } from "@/design/components/TabBar";
import { layoutModeNow, useLayoutMode } from "@/lib/layoutMode";
import { tournamentsBackend } from "@/lib/tournaments/tournamentsApi";

/**
 * The navigation frame's shared rules (phase 2 step 1, 14 Nov 2026).
 *
 * - Where the main destinations are drawn: the bottom tab bar on phones and tablets held upright; the left rail on
 *   computers and tablets turned sideways (Joe, 14 Nov 2026). Rooms and games on a tablet stay exactly the phone's.
 * - Back (Android's back button or gesture, the browser's back): one screen at a time; from a main tab it returns to
 *   Home before leaving the app. Tabs opened from Home are pushed and tabs opened from another tab replace it
 *   (goToTab), so a main tab always sits on Home; a main tab opened directly (a link, a reload, the home-screen app
 *   opening on it) gets Home put beneath it once (useHomeBeneath).
 * - A destination inside a page (the Play bar's play section, More's Challenges) is passed as `navScroll` in the
 *   history state and scrolled to once the page has drawn it (useNavScroll), so no page's contents change.
 */

/** The tablet's turned-sideways test: wider than tall. */
const LANDSCAPE = "(orientation: landscape)";

function landscapeNow(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(LANDSCAPE).matches;
}

/** "rail" on a computer or a landscape tablet, else "bar" (the server and hydration: "bar"). */
export function useNavPlacement(): "rail" | "bar" {
  const layout = useLayoutMode();
  const [landscape, setLandscape] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(LANDSCAPE);
    const read = () => setLandscape(list.matches);
    read();
    list.addEventListener?.("change", read);
    return () => list.removeEventListener?.("change", read);
  }, []);
  if (layout === "desktop") return "rail";
  return layout === "tablet" && landscape ? "rail" : "bar";
}

/** The same, read once (outside React). */
export function navPlacementNow(): "rail" | "bar" {
  const layout = layoutModeNow();
  return layout === "desktop" || (layout === "tablet" && landscapeNow()) ? "rail" : "bar";
}

const HOME_SEEDED = "duelz-nav-home-beneath";

/**
 * A main tab other than Home opened as the first screen of this visit: put Home beneath it in the history, so Back
 * returns to Home before leaving. Only on the real route (the address bar holds the tab's own path), once per entry.
 */
export function useHomeBeneath(tab: AppTab | undefined): void {
  const router = useRouter();
  useEffect(() => {
    if (!tab || tab === "play" || tab === "profile") return;
    if (window.location.pathname !== TAB_PATHS[tab]) return;
    const state = (window.history.state ?? {}) as Record<string, unknown>;
    if (state["__TSR_index"] !== 0 || state["fromPlayTab"] || state[HOME_SEEDED]) return;
    router?.history?.flush?.();
    const href = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const key = Math.random().toString(36).slice(2, 10);
    window.history.replaceState({ ...state, __TSR_index: 0 }, "", "/");
    const above = { ...state, __TSR_index: 1, key, __TSR_key: key, fromPlayTab: true, [HOME_SEEDED]: true };
    window.history.pushState(above, "", href);
    // TanStack's history reads the browser's entry on popstate: tell it the entry moved on (the same page, no reload).
    window.dispatchEvent(new PopStateEvent("popstate", { state: above }));
  }, [tab, router]);
}

/** Navigation state carried to a page: the element to scroll to once it is drawn. */
export interface NavState {
  fromPlayTab?: boolean;
  navScroll?: string;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

let pendingNavScroll: string | null = null;

/** A scroll target for the next page drawn (going back to Home, which has no state of its own to carry it). */
export function setPendingNavScroll(selector: string): void {
  pendingNavScroll = selector;
}

/** Scrolls the page to an element now (no animation under Reduce motion). */
export function scrollToNav(selector: string): boolean {
  const el = document.querySelector(selector);
  if (!el) return false;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  return true;
}

/** Scrolls to the history state's `navScroll` element (or a pending one) once it exists (at most 4 s), then forgets it. */
export function useNavScroll(active: boolean): void {
  const router = useRouter();
  // Optional chaining: the screen harness's stand-in router has no state, and some checks' none at all.
  const location = (router as { state?: { location?: { state?: NavState & { key?: string } } } } | null)?.state?.location;
  const target = location?.state?.navScroll;
  const key = location?.state?.key;
  useIsoLayoutEffect(() => {
    if (!active) return;
    const wanted = pendingNavScroll ?? target;
    pendingNavScroll = null;
    if (!wanted) return;
    let frame = 0;
    const started = performance.now();
    const look = () => {
      if (scrollToNav(wanted)) return;
      if (performance.now() - started < 4000) frame = requestAnimationFrame(look);
    };
    frame = requestAnimationFrame(look);
    return () => cancelAnimationFrame(frame);
  }, [active, target, key]);
}

const ACCESS_KEY = "duelz-tournaments-open:v1";

function rememberedAccess(): boolean {
  try {
    return localStorage.getItem(ACCESS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Whether this player has tournaments (today's switch: TOURNAMENTS_FOR_EVERYONE or the tester list, answered by the
 * server's hub as `open`). `known` is false until the server answers; until then the last answer on this device is
 * used, so a player with tournaments doesn't see the coming-soon page flash first. Read only: the hub itself is
 * the tournaments screens' own (useTournamentHub).
 */
export function useTournamentsAccess(): { open: boolean; known: boolean } {
  const [state, setState] = useState<{ open: boolean; known: boolean }>({ open: false, known: false });
  useEffect(() => {
    let live = true;
    setState({ open: rememberedAccess(), known: false });
    void (async () => {
      const backend = await tournamentsBackend();
      let open = false;
      if (backend) {
        try {
          const hub = await backend.hub();
          open = Boolean(hub && hub.open);
        } catch {
          // offline or refused: keep what this device last knew
          if (live) setState((s) => ({ ...s, known: true }));
          return;
        }
      }
      try {
        localStorage.setItem(ACCESS_KEY, open ? "1" : "0");
      } catch {
        /* storage blocked */
      }
      if (live) setState({ open, known: true });
    })();
    return () => {
      live = false;
    };
  }, []);
  return state;
}
