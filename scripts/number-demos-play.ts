/**
 * The in-page replay of a puzzle demo log, shared by number-demos-record.ts (which stores the answer the log itself
 * produces) and number-demos-check.ts (which proves it): PuzzleDemoPlayer's dispatch (src/components/duel/PuzzleDemo.tsx:
 * the expanded events, touch pointer events at elementFromPoint with pointer capture emulated, a click on each tap's
 * release), fired into the practice stage's region from the moment it is called. Resolves with the region's size.
 * Use as page.evaluate(`(${PLAY})(${JSON.stringify({ log })})`).
 */
export const PLAY = `async ({ log }) => {
  const mod = await import("/src/lib/duel/puzzleDemo.ts");
  const region = document.querySelector("[data-game-region]");
  const events = mod.expandActions(log.actions);
  const start = Date.now();
  let captured = null;
  const fire = (ev) => {
    const r = region.getBoundingClientRect();
    const cx = r.left + ev.x * r.width;
    const cy = r.top + ev.y * r.height;
    const hit = document.elementFromPoint(cx, cy);
    const inside = hit && region.contains(hit) ? hit : null;
    const target = ev.kind === "down" ? inside : (captured ?? inside);
    if (ev.kind === "down") captured = null;
    if (!target) return;
    const proto = Element.prototype;
    const saved = [proto.setPointerCapture, proto.releasePointerCapture, proto.hasPointerCapture];
    proto.setPointerCapture = function () { captured = this; };
    proto.releasePointerCapture = function () { captured = null; };
    proto.hasPointerCapture = function () { return captured === this; };
    try {
      const init = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, pointerId: 7331, pointerType: "touch", isPrimary: true, button: 0, buttons: ev.kind === "up" ? 0 : 1 };
      const name = ev.kind === "down" ? "pointerdown" : ev.kind === "move" ? "pointermove" : "pointerup";
      target.dispatchEvent(new PointerEvent(name, init));
      if (ev.kind === "up") {
        if (ev.tap !== false) (inside ?? target).dispatchEvent(new MouseEvent("click", init));
        captured = null;
      }
    } finally {
      [proto.setPointerCapture, proto.releasePointerCapture, proto.hasPointerCapture] = saved;
    }
  };
  const size = { w: region.getBoundingClientRect().width, h: region.getBoundingClientRect().height };
  await new Promise((done) => {
    let next = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      while (next < events.length && events[next].t <= elapsed) {
        const ev = events[next++];
        if (ev.kind !== "type" && ev.kind !== "select") fire(ev);
      }
      if (next < events.length) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
  return size;
}`;
