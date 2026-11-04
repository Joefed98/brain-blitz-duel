import { HudPills, type HudPillItem } from "@/components/puzzles/HudPills";
import { useInFrame } from "@/components/puzzles/batchP/LiveSummary";

import "@/polish-layout/polish-nov3-pattern.css";

/**
 * Puzzle polish (3 Nov 2026, Joe's audit; display only): the Pattern games' live summary as separate pills
 * ("Moves 12" "Par 14") in place of batch P's one dotted line (`LiveSummary`). Drawn only inside a live round's
 * frame, exactly where the summary was (`data-after-arena`), so intros, demos and reveals are unchanged. The row's
 * height is fixed (HudPills), so nothing moves when a figure changes.
 */
export function FramePills({ testId, items, inArena = false }: { testId: string; items: ReadonlyArray<HudPillItem | false | null | undefined>; inArena?: boolean }) {
  const inFrame = useInFrame();
  if (!inFrame) return null;
  return (
    <div data-after-arena={inArena ? undefined : ""} data-pattern-pills={testId} className="pattern-pills">
      <HudPills testId={testId} items={items} />
    </div>
  );
}

/** "Moves n" (red once over par) and "Par p" (the category accent). */
export function parPills(label: string, used: number, par: number, id = "moves"): HudPillItem[] {
  return [
    { id, label, value: used, ...(par > 0 && used > par ? { tone: "warn" as const } : {}) },
    { id: "par", label: "Par", value: par, tone: "gold" },
  ];
}
