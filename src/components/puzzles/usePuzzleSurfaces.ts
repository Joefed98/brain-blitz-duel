import { useEffect, type RefObject } from "react";
import { animateFx } from "@/lib/fx/motion";
import { MEANINGFUL_SURFACE_GAMES, pathWidth, PUZZLE_ACTIONS, PUZZLE_PRIMARY_ACTIONS, PUZZLE_TOUCH_MIN, surfaceState } from "@/lib/puzzleSurface";

/** Exported for browser-free markup audits; no input handlers are registered. */
export function applyPuzzleSurfaces(root: HTMLElement, type: string) {
    const set = (node: Element, name: string, value: string) => {
      if (node.getAttribute(name) !== value) node.setAttribute(name, value);
    };
      const candidates = root.querySelectorAll<HTMLElement>("button, [data-cell], [data-pointer-index], [data-np-cell], .grid > div, .grid > span, .grid > button, .rounded-md.font-mono, .rounded-lg.font-display");
      for (const ghost of root.querySelectorAll<HTMLElement>("[data-puzzle-ghost]")) {
        if (!(ghost.style.pointerEvents === "none" && ghost.style.zIndex === "40") && !ghost.classList.contains("fixed")) ghost.removeAttribute("data-puzzle-ghost");
      }
      // Scattered round nodes keep their shape and coordinates but share state edges.
      for (const node of root.querySelectorAll<HTMLElement>(".rounded-full.font-mono, button.absolute.rounded-full")) {
        if (!["numhunt", "chain", "bomb"].includes(type)) continue;
        set(node, "data-puzzle-node", "true");
        set(node, "data-puzzle-state", surfaceState(node.className));
      }
      const cells: HTMLElement[] = [];
      for (const node of candidates) {
        if (node.closest("[role='dialog'], .screen-background") || node.closest("button") !== null && node.tagName !== "BUTTON") continue;
        const classes = node.className;
        const text = node.textContent?.trim() ?? "";
        const actionName = PUZZLE_ACTIONS.test(text) ? text : node.getAttribute("aria-label") ?? "";
        const command = node.tagName === "BUTTON" && PUZZLE_ACTIONS.test(actionName);
        if (command) {
          set(node, "data-puzzle-action", PUZZLE_PRIMARY_ACTIONS.test(actionName) ? "primary" : "secondary");
          if (/^(undo|reset|restart|erase)$/i.test(text) && !node.querySelector("svg")) {
            set(node, "data-puzzle-icon", /undo/i.test(text) ? "undo" : /erase/i.test(text) ? "erase" : "reset");
            if (!node.hasAttribute("aria-label")) set(node, "aria-label", text);
            set(node, "title", text);
          }
          // Preserve dimensions: only a vacant halo around an isolated control is interactive.
          const rect = node.getBoundingClientRect();
          const x = Math.max(0, (PUZZLE_TOUCH_MIN - rect.width) / 2);
          const y = Math.max(0, (PUZZLE_TOUCH_MIN - rect.height) / 2);
          const siblings = [...root.querySelectorAll<HTMLElement>("button, input, [data-cell], [data-pointer-index], [data-np-cell]")].filter(n => n !== node && !node.contains(n));
          const safe = rect.width > 0 && rect.height > 0 && siblings.every(n => {
            const b = n.getBoundingClientRect();
            return b.right <= rect.left - x || b.left >= rect.right + x || b.bottom <= rect.top - y || b.top >= rect.bottom + y;
          });
          set(node, "data-puzzle-hit", safe ? "halo" : "dense");
          if (safe) {
            node.style.setProperty("--puzzle-hit-x", `${x}px`);
            node.style.setProperty("--puzzle-hit-y", `${y}px`);
          }
          continue;
        }
        const isGridChild = node.parentElement?.classList.contains("grid");
        const isTile = /rounded-(?:md|lg).*font-(?:mono|display)/.test(classes) && /items-center.*justify-center|justify-center.*items-center/.test(classes);
        const isCell = (isGridChild || isTile || node.hasAttribute("data-cell") || node.hasAttribute("data-pointer-index") || node.hasAttribute("data-np-cell")) && /bg-|border|rounded/.test(classes) && !/rounded-full/.test(classes);
        if (!isCell) continue;
        cells.push(node);
        set(node, "data-puzzle-cell", MEANINGFUL_SURFACE_GAMES.has(type) ? "meaningful" : "standard");
        // Never infer correctness or disable given-cell callbacks: the existing game owns both.
        const given = (type === "sudoku" && /text-foreground/.test(classes)) || (type === "trail" && /bg-foreground/.test(classes)) || (type === "numpyramid" && /bg-foreground/.test(classes));
        const state = surfaceState(classes, given);
        set(node, "data-puzzle-state", state);
        // Number Pyramid's input overlay is transparent: never paint over its number below.
        if (node.hasAttribute("data-np-cell")) set(node, "data-puzzle-cell", "overlay");
        if (["tubes", "tower", "balance", "rings", "unblock", "blockparty"].includes(type)) set(node, "data-puzzle-object", "true");
        const rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) node.style.setProperty("--puzzle-cell-radius", `${Math.min(8, Math.max(3, Math.min(rect.width, rect.height) * 0.14))}px`);
        if (/^\d+(?:\s*[+×−÷=]\s*\d+)*$/.test(text)) set(node, "data-puzzle-numeric", "true");
      }
      // Only full-board route overlays; never mirror glyphs, walls or icons.
      if (["flow", "wordhunt", "laser", "iceslide", "maze", "trail", "wordsearch", "pipes"].includes(type)) {
        for (const svg of root.querySelectorAll<SVGSVGElement>("svg")) {
          const overlay = svg.classList.contains("absolute") || type === "maze" || type === "pipes";
          if (!overlay) continue;
          const values = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
          const viewWidth = values?.[2] ?? 0;
          const cols = type === "wordhunt" ? (root.querySelectorAll("[data-cell]").length === 36 ? 6 : 5) : type === "pipes" ? 1 : 0;
          const cell = cols ? viewWidth / cols : viewWidth > 0 && viewWidth < 30 ? 1 : Math.min(...cells.map(n => n.getBoundingClientRect().width).filter(w => w > 0));
          if (!Number.isFinite(cell) || cell <= 0) continue;
          const selector = type === "pipes" ? "line" : type === "wordhunt" || type === "trail" ? "polyline, line" : "polyline";
          for (const path of svg.querySelectorAll<SVGElement>(selector)) {
            set(path, "data-puzzle-path", "true");
            path.style.setProperty("--puzzle-path-width", String(pathWidth(cell)));
            path.style.setProperty("--puzzle-path-colour", path.getAttribute("stroke") ?? "var(--category-accent)");
          }
        }
      }
      for (const node of root.querySelectorAll<HTMLElement>("[style*='translate3d'], .pointer-events-none.fixed.z-50.font-mono")) {
        if (!(node.style.pointerEvents === "none" && node.style.zIndex === "40") && !node.classList.contains("fixed")) continue;
        const fresh = !node.hasAttribute("data-puzzle-ghost");
        set(node, "data-puzzle-ghost", "true");
        if (fresh) animateFx(node, "trail");
      }
      for (const node of root.querySelectorAll<HTMLElement>(".border-dashed.pointer-events-none")) {
        if (node.classList.contains("absolute")) set(node, "data-puzzle-drop", "valid");
      }
}

/** Decorates existing DOM without wrappers, changed events, coordinates or game state. */
export function usePuzzleSurfaces(ref: RefObject<HTMLDivElement | null>, type: string | undefined, enabled: boolean) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled || !type) return;
    let scheduled = 0;
    const decorate = () => { scheduled = 0; applyPuzzleSurfaces(root, type); };
    const queue = () => { if (!scheduled) scheduled = requestAnimationFrame(decorate); };
    decorate();
    // Observe React changes only, not the adapter's attributes or style variables.
    const observer = new MutationObserver(records => {
      if (records.some(r => r.type !== "attributes" || r.attributeName === "class" || r.attributeName === "stroke")) queue();
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "stroke"] });
    const resize = new ResizeObserver(queue);
    resize.observe(root);
    return () => { observer.disconnect(); resize.disconnect(); if (scheduled) cancelAnimationFrame(scheduled); };
  }, [ref, type, enabled]);
}