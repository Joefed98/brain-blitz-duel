import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { prefersReducedMotion } from "@/lib/motion";

/**
 * Ranked rows that slide (FLIP transforms) from where they sat to their new place: the list first
 * draws `from` (the previous order), then `rows` on the next frame, each row eased from its old
 * offset to its new one over `slideMs`. Only transforms move, so nothing around the list shifts.
 * `skip` (a tap, the count-up's skip) puts every row in its final place at once. Reduced motion:
 * no slide. The rows drawn are always `rows`, in `rows`' order, after the first frame.
 */
export function useFlipRows<T extends { slot: number }>(
  rows: T[],
  { from, slideMs, skip = false }: { from: T[]; slideMs: number; skip?: boolean },
) {
  const nodes = useRef(new Map<number, HTMLElement>());
  const offsets = useRef(new Map<number, number>());
  const [displayRows, setDisplayRows] = useState(() => from);
  // Battery (31 Oct 2026): the screens hand a new `rows` array on every clock tick (10 a second) with the
  // same contents; only a change of contents moves the rows (and costs a frame).
  const latest = useRef(rows);
  latest.current = rows;
  const contents = JSON.stringify(rows);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDisplayRows(latest.current));
    return () => cancelAnimationFrame(frame);
  }, [contents]);

  useLayoutEffect(() => {
    nodes.current.forEach((node, slot) => {
      const top = node.offsetTop;
      const previous = offsets.current.get(slot);
      offsets.current.set(slot, top);
      if (previous === undefined || previous === top || prefersReducedMotion()) return;
      node.style.transition = "none";
      node.style.transform = `translateY(${previous - top}px)`;
      requestAnimationFrame(() => {
        node.style.transition = `transform ${slideMs}ms ease-out`;
        node.style.transform = "translateY(0)";
      });
    });
  }, [displayRows]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!skip) return;
    setDisplayRows(rows);
    nodes.current.forEach((node) => {
      node.style.transition = "none";
      node.style.transform = "translateY(0)";
    });
  }, [skip]); // eslint-disable-line react-hooks/exhaustive-deps

  const rowRef = (slot: number) => (node: HTMLElement | null) => {
    if (node) nodes.current.set(slot, node);
    else nodes.current.delete(slot);
  };
  return { displayRows, rowRef, nodes: nodes.current };
}
