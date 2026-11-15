import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { RunSummaryProps } from "@/components/duel/runSummary";
import { FxCountUp } from "@/components/fx/GameFx";
import { gameFx } from "@/lib/fx/kit";
import { CURL_SUMMARY_RING, curlingSummary, curlSummaryAt, paintCurlingSummary } from "@/lib/arcade/curlingSummary.renderer";

/** The house's drawn size in device px (the canvas is shown at the column's width, up to 360 css px). */
const SIZE = 960;
/** The gap between counting stones lighting (ms). */
export const CURL_SUMMARY_LIGHT_MS = 220;

/**
 * Curl Champ's run summary (the Sports overhaul, 15 Nov 2026): the house from above, large, with your stones numbered
 * by throw, the reds, a gold ring on each stone that counted and a grey ring on a near miss, then the key numbers.
 *
 * The payoff (stage 2): the counting stones' gold rings light one by one with the count (the kit's "stars", each a step
 * higher; transform and opacity only), and the numbers count up. Every ring and number is in the markup at its final
 * state (reduced motion, screenshots and screen readers read the end); the kit plays the light-up once after mount.
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
  const rings = useRef<(HTMLSpanElement | null)[]>([]);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx && sum) paintCurlingSummary(ctx, SIZE, sum, true);
  }, [sum]);
  const counting = useMemo(() => (sum ? sum.stones.filter((st) => st.counting).sort((a, b) => (a.throw ?? 0) - (b.throw ?? 0)) : []), [sum]);
  useEffect(() => {
    counting.forEach((_, n) => {
      gameFx("stars", rings.current[n] ?? null, { count: n + 1, delayMs: 300 + n * CURL_SUMMARY_LIGHT_MS, inGame: false });
    });
  }, [counting]);
  if (!sum) return null;
  const label = sum.rev >= 4 ? "Counting" : "Scored";
  const ringPct = `${(CURL_SUMMARY_RING * 200).toFixed(3)}%`;
  return (
    <div data-curling-summary="" className="flex w-full flex-col items-center gap-3">
      <div className="relative aspect-square w-full max-w-sm">
        <canvas
          ref={ref}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={`The house at the end: ${sum.counting} of your stones counting, ${sum.takeouts} takeouts${sum.closestCm !== null ? `, your closest ${sum.closestCm} cm from the button` : ""}`}
          className="absolute inset-0 h-full w-full"
        />
        {counting.map((st, n) => {
          const at = curlSummaryAt(st);
          return (
            // The wrapper places and centres it; the ring inside is what the kit animates (its own transform).
            <span
              key={st.throw ?? n}
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{ left: `${(at.x * 100).toFixed(3)}%`, top: `${(at.y * 100).toFixed(3)}%`, width: ringPct, height: ringPct, transform: "translate(-50%, -50%)" }}
            >
              <span
                ref={(el) => {
                  rings.current[n] = el;
                }}
                data-count-ring={st.throw ?? ""}
                className="block h-full w-full rounded-full"
                style={{ border: "3px solid var(--jz-gold)" }}
              />
            </span>
          );
        })}
      </div>
      <div className="grid w-full max-w-sm grid-cols-3 gap-2">
        <div data-summary-stat={label} className="flex flex-col items-center gap-0.5">
          <span className="text-2xl font-extrabold tabular-nums text-foreground">
            <FxCountUp value={sum.counting} silent /> of {sum.thrown || 8}
          </span>
          <span className="text-sm font-semibold text-muted-foreground">{label}</span>
        </div>
        <div data-summary-stat={sum.takeouts === 1 ? "Takeout" : "Takeouts"} className="flex flex-col items-center gap-0.5">
          <span className="text-2xl font-extrabold tabular-nums text-foreground">
            <FxCountUp value={sum.takeouts} silent />
          </span>
          <span className="text-sm font-semibold text-muted-foreground">{sum.takeouts === 1 ? "Takeout" : "Takeouts"}</span>
        </div>
        {sum.closestCm !== null ? (
          <div data-summary-stat="Closest" className="flex flex-col items-center gap-0.5">
            <span className="text-2xl font-extrabold tabular-nums text-foreground">
              <FxCountUp value={sum.closestCm} silent /> cm
            </span>
            <span className="text-sm font-semibold text-muted-foreground">Closest</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
