import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Standing } from "@/lib/duel/scoring";
import {
  REVEAL_FIRST_COUNT_MS,
  REVEAL_ROW_MS,
  standingsRevealOrder,
  standingsRevealPlan,
} from "@/lib/duel/standingsReveal";
import { celebrationSound, movedUp, sparkBurstOn } from "@/lib/fx/celebrations";
import { shownCountFrom, shownTotal } from "@/lib/duel/resultPresentation";
import { prefersReducedMotion } from "@/lib/motion";

import { useTapToSkip } from "./useCelebration";

/** How a row is drawn during the reveal. */
export interface RevealRowState {
  /** "waiting": still in the order after the round before, showing the total before this round. */
  state: "waiting" | "landed";
  /** The total before the round: shown until the row lands, then counted up from. */
  from: number;
  /** When the row lands (ms from the screen opening): its count-up starts then. */
  delayMs: number;
  /** The count-up's length. */
  countMs: number;
  /** 1st place's gold light sweep. */
  sweep: boolean;
}

/**
 * The standings' broadcast reveal (src/lib/duel/standingsReveal.ts). `on` (celebrations on, full motion):
 * the rows start in the previous order and land one at a time from last place up, each sliding to its
 * place and counting up; a soft tick per row, the climbs' sparks and one overtake zap, then 1st
 * place with its sweep and the bigger hit (the count-up's ding). A tap anywhere skips to the final state.
 * Reduced motion: the final state from the first frame, no slides, ticks or sparks. Nothing runs once the
 * last row has landed: no timers, frames or transitions (the sweep rests transparent).
 */
export function useStandingsReveal(rows: Standing[], { on, scope, pinned }: { on: boolean; scope: number; pinned?: number | undefined }) {
  const animate = useState(() => on && !prefersReducedMotion())[0];
  const contents = JSON.stringify(rows.map((row) => [row.slot, row.position, row.previousPosition, row.total, row.roundScore, row.points, row.roundPoints]));
  const plan = useMemo(() => standingsRevealPlan(rows), [contents]); // eslint-disable-line react-hooks/exhaustive-deps
  const [landed, setLanded] = useState(0);
  const skipped = useTapToSkip(animate, plan.endMs + 100);
  const finished = !animate || skipped || landed >= plan.steps.length;
  const shown = finished ? plan.steps.length : landed;

  const nodes = useRef(new Map<number, HTMLElement>());
  const overtook = useRef(false);
  const timers = useRef<number[]>([]);
  const latest = useRef({ rows, plan });
  latest.current = { rows, plan };

  useEffect(() => {
    if (!animate) return;
    timers.current = plan.stepAt.map((at, index) =>
      window.setTimeout(() => {
        const { rows: now, plan: current } = latest.current;
        const slots = current.steps[index] ?? [];
        setLanded((value) => Math.max(value, index + 1));
        const first = index === current.steps.length - 1;
        celebrationSound(first ? "countDing" : "countTick", first ? 1 : 0.6);
        const climbers = slots.filter((slot) => {
          const row = now.find((r) => r.slot === slot);
          return row ? movedUp(row) : false;
        });
        if (climbers.length) {
          const landAt = window.setTimeout(() => {
            for (const slot of climbers) sparkBurstOn(scope, nodes.current.get(slot) ?? null, { row: true, count: 16 });
          }, REVEAL_ROW_MS);
          timers.current.push(landAt);
          if (!overtook.current) {
            overtook.current = true;
            celebrationSound("overtake");
          }
        }
      }, at),
    );
    return () => timers.current.forEach((timer) => window.clearTimeout(timer));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A skip draws the final state at once and stops the timers (no ticks or sparks after it).
  useEffect(() => {
    if (!skipped) return;
    timers.current.forEach((timer) => window.clearTimeout(timer));
    setLanded(plan.steps.length);
  }, [skipped]); // eslint-disable-line react-hooks/exhaustive-deps

  // The rows stay in the server's final order in the page (so a screen reader, and anything reading the
  // list, gets the result); each row is drawn at its place in the reveal's current order by a transform,
  // eased between steps (a slide cut short by the next step carries on from where it is drawn).
  const order = animate ? standingsRevealOrder(rows, plan, shown) : rows;
  const orderKey = order.map((row) => row.slot).join();
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (!animate) return;
    const instant = skipped || !placed.current;
    const move = (node: HTMLElement, delta: number) => {
      node.style.transition = instant ? "none" : `transform ${REVEAL_ROW_MS}ms var(--jz-ease)`;
      node.style.transform = `translateY(${delta}px)`;
    };
    // The player's own pinned row (compact rooms, sticky above the footer) keeps its place and counts up
    // there: a slide would push it under the footer. The other rows take the remaining places in turn.
    const pinNode = pinned !== undefined ? nodes.current.get(pinned) : undefined;
    if (pinNode) {
      const free = rows
        .map((row) => nodes.current.get(row.slot))
        .filter((node): node is HTMLElement => !!node && node !== pinNode)
        .map((node) => node.offsetTop);
      const moving = order.filter((row) => row.slot !== pinned).map((row) => nodes.current.get(row.slot)).filter((node): node is HTMLElement => !!node);
      moving.forEach((node, i) => move(node, (free[i] ?? node.offsetTop) - node.offsetTop));
      pinNode.style.transition = "none";
      pinNode.style.transform = "";
      placed.current = true;
      return;
    }
    const drawn = order.map((row) => nodes.current.get(row.slot)).filter((node): node is HTMLElement => !!node);
    if (!drawn.length) return;
    let y = Math.min(...drawn.map((node) => node.offsetTop));
    for (const node of drawn) {
      const delta = y - node.offsetTop;
      y += node.offsetHeight;
      move(node, delta);
    }
    placed.current = true;
  }, [orderKey, skipped]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = new Set(plan.steps.slice(0, shown).flat());
  const landAt = new Map(plan.steps.flatMap((slots, index) => slots.map((slot) => [slot, plan.stepAt[index] ?? 0] as const)));
  const firstStep = new Set(plan.steps[plan.steps.length - 1] ?? []);
  const rowState = (row: Standing): RevealRowState => {
    const isLanded = !animate || done.has(row.slot);
    return {
      state: isLanded ? "landed" : "waiting",
      // Placings rooms count their points, not the total score (room scoring, 6 Nov 2026).
      from: animate ? shownCountFrom(row) : shownTotal(row),
      delayMs: animate ? (landAt.get(row.slot) ?? 0) : 0,
      countMs: firstStep.has(row.slot) ? REVEAL_FIRST_COUNT_MS : REVEAL_ROW_MS,
      sweep: animate && !skipped && isLanded && firstStep.has(row.slot) && row.position === 1,
    };
  };
  const rowRef = (slot: number) => (node: HTMLElement | null) => {
    if (node) nodes.current.set(slot, node);
    else nodes.current.delete(slot);
  };
  return { animate, displayRows: rows, order, rowState, rowRef, skipped, finished, nodes: nodes.current };
}
