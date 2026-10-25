/**
 * A puzzle board's box (Polish 2, 24 Oct 2026, display only): what the game frame's tray hugs and what
 * scripts/shots/frame-probe.ts compares between main and a branch. Self-contained (no imports, no
 * helpers outside the function), so the probe runs this exact function in the page on either tree.
 *
 * The arena ([data-game-arena]) itself when it paints (a background, border or shadow, or it is a
 * canvas, svg or img); otherwise the union of its in-flow children's boxes, found the same way:
 * a painted child is its own box, an unpainted wrapper is the union of what it holds, a text line is
 * its own box. Absolutely placed children (a dragged piece, an overlay, a flying effect) are left out,
 * so the box never follows a drag, and so is a stage bar (StageProgress, which a live round's goal line
 * draws instead). With nothing in flow, the arena's own box. Clipped to the screen's sides.
 */
export function boardBox(arena: Element): { left: number; top: number; right: number; bottom: number } {
  const opaque = (c: string) => c !== "" && c !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(c);
  const painted = (el: Element, cs: CSSStyleDeclaration) =>
    /^(CANVAS|svg|IMG|BUTTON|INPUT)$/i.test(el.tagName) ||
    opaque(cs.backgroundColor) ||
    cs.backgroundImage !== "none" ||
    ["top", "right", "bottom", "left"].some(
      (s) => parseFloat(cs.getPropertyValue(`border-${s}-width`)) > 0 && opaque(cs.getPropertyValue(`border-${s}-color`)),
    );
  const out = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  const add = (r: DOMRect) => {
    out.left = Math.min(out.left, r.left);
    out.top = Math.min(out.top, r.top);
    out.right = Math.max(out.right, r.right);
    out.bottom = Math.max(out.bottom, r.bottom);
  };
  const walk = (el: Element, depth: number) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.position === "absolute" || cs.position === "fixed") return;
    // A stage bar (StageProgress) is progress, not board: on a live round it moved to the goal line.
    if (/^Stage \d+ of \d+$/.test(el.getAttribute("aria-label") ?? "")) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const text = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
    if (painted(el, cs) || text || depth > 12) return add(r);
    for (const child of Array.from(el.children)) walk(child, depth + 1);
  };
  const acs = getComputedStyle(arena);
  const ar = arena.getBoundingClientRect();
  if (painted(arena, acs)) add(ar);
  else for (const child of Array.from(arena.children)) walk(child, 1);
  const box = Number.isFinite(out.left) ? out : { left: ar.left, top: ar.top, right: ar.right, bottom: ar.bottom };
  // Only what is on screen: a board drawn past the screen's sides (Tally's scattered shapes) counts to its edges.
  return { left: Math.max(0, box.left), top: box.top, right: Math.min(window.innerWidth, box.right), bottom: box.bottom };
}
