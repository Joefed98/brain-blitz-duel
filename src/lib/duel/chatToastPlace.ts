/**
 * Where the room's chat toast sits (22 Oct 2026, display only): at the bottom of the screen, above
 * the home bar and above every control that stays on screen there (the chat bar, Ready, Play again,
 * Share, Continue, Leave...), never over one. Measured in the page when the toast shows and on resize.
 *
 * The controls it keeps clear of: visible ones (the point at their centre is theirs, so nothing
 * covers them) that are pinned (fixed or sticky, themselves or an ancestor) or end within
 * BOTTOM_ZONE_PX of the visible bottom. Starting from the home bar's top, the toast's box moves up
 * past each such control it would touch until it fits. Rows in a scrolling list are not kept clear
 * of (they pass under the toast for its 3.5 s, as they passed under it at the top).
 */
export const CHAT_TOAST_HEIGHT = 48;
export const CHAT_TOAST_GAP = 8;
const BOTTOM_ZONE_PX = 120;
const CONTROLS = 'button, a[href], input, textarea, select, [role="button"]';

function pinned(el: Element, win: Window): boolean {
  for (let node: Element | null = el; node && node !== win.document.body; node = node.parentElement) {
    const position = win.getComputedStyle(node).position;
    if (position === "fixed" || position === "sticky") return true;
  }
  return false;
}

/** The home bar's height (env(safe-area-inset-bottom)), measured with a probe. */
export function bottomInset(doc: Document): number {
  const probe = doc.createElement("div");
  probe.style.cssText = "position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);width:0;visibility:hidden;pointer-events:none";
  doc.body.appendChild(probe);
  const inset = probe.getBoundingClientRect().height;
  probe.remove();
  return inset;
}

/** The controls the toast keeps clear of, as rects (`exclude`: the toast itself). */
export function bottomControls(doc: Document, win: Window, exclude: Element | null): DOMRect[] {
  const vh = win.innerHeight;
  const out: DOMRect[] = [];
  for (const el of doc.querySelectorAll(CONTROLS)) {
    if (exclude && (exclude === el || exclude.contains(el))) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= vh) continue;
    const x = Math.min(Math.max(r.left + r.width / 2, 0), win.innerWidth - 1);
    const y = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1);
    const hit = doc.elementFromPoint(x, y);
    if (!hit || !(hit === el || el.contains(hit) || hit.contains(el) || (exclude && exclude.contains(hit)))) continue;
    if (!pinned(el, win) && r.bottom < vh - BOTTOM_ZONE_PX) continue;
    out.push(r);
  }
  return out;
}

/** The toast's distance from the viewport's bottom to its bottom edge, px. */
export function chatToastBottom(doc: Document, win: Window, toast: Element | null): number {
  const vh = win.innerHeight;
  const controls = bottomControls(doc, win, toast);
  let edge = vh - bottomInset(doc);
  for (let moved = true, guard = 0; moved && guard < 50; guard++) {
    moved = false;
    const bottom = edge - CHAT_TOAST_GAP;
    const top = bottom - CHAT_TOAST_HEIGHT;
    for (const r of controls)
      if (r.top < bottom + CHAT_TOAST_GAP && r.bottom > top - CHAT_TOAST_GAP && r.top < edge) {
        edge = Math.min(edge, r.top);
        moved = true;
      }
  }
  return Math.max(0, vh - edge + CHAT_TOAST_GAP);
}
