import { useLayoutEffect, useMemo, useRef } from "react";
import type { RunSummaryProps } from "@/components/duel/runSummary";
import { curlingSummary, paintCurlingSummary } from "@/lib/arcade/curlingSummary.renderer";

/** The house's drawn size in device px (the canvas is shown at the column's width, up to 360 css px). */
const SIZE = 960;

/**
 * Curl Champ's run summary (the Sports overhaul, 15 Nov 2026): the house from above, large, with your stones numbered
 * by throw, the reds, a gold ring on each stone that counted and a grey ring on a near miss, then the key numbers.
 */
export default function CurlingSummary({ puzzle, myAnswer }: RunSummaryProps) {
  const sum = useMemo(() => {
    if (puzzle.type !== "curling" || !myAnswer) return null;
    try {
      return curlingSummary(puzzle.seed, myAnswer, puzzle.curlRev);
    } catch {
      return null;
    }
  }, [puzzle, myAnswer]);
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx && sum) paintCurlingSummary(ctx, SIZE, sum);
  }, [sum]);
  if (!sum) return null;
  const label = sum.rev >= 4 ? "Counting" : "Scored";
  const stats: { value: string; label: string }[] = [
    { value: `${sum.counting} of ${sum.thrown || 8}`, label },
    { value: String(sum.takeouts), label: sum.takeouts === 1 ? "Takeout" : "Takeouts" },
    ...(sum.closestCm !== null ? [{ value: `${sum.closestCm} cm`, label: "Closest" }] : []),
  ];
  return (
    <div data-curling-summary="" className="flex w-full flex-col items-center gap-3">
      <canvas
        ref={ref}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label={`The house at the end: ${sum.counting} of your stones counting, ${sum.takeouts} takeouts${sum.closestCm !== null ? `, your closest ${sum.closestCm} cm from the button` : ""}`}
        className="aspect-square w-full max-w-sm"
      />
      <div className="grid w-full max-w-sm grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} data-summary-stat={s.label} className="flex flex-col items-center gap-0.5">
            <span className="text-2xl font-extrabold tabular-nums text-foreground">{s.value}</span>
            <span className="text-sm font-semibold text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
