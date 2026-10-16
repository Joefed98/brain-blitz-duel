import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** useLayoutEffect in the browser (the form is chosen before paint), a no-op on the server. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The header's existing text styles (GameLayout's label and title). */
const ROUND_TEXT = "font-mono text-xs uppercase tracking-widest text-muted-foreground";
const NAME_TEXT = "font-display text-xs font-bold text-foreground";
const NAME_SMALL = "font-display text-[10px] font-bold text-foreground";

/**
 * The score's minimum width beside the label (px): a 4-digit total with the start of the
 * player's name, and a ten-player room's whole "10TH OF 10" place line.
 */
export const ROOM_SCORE_MIN = 96;

/**
 * The label's four forms, widest first (16 Oct 2026): one line, two lines, compact one
 * line, compact over the name (the name truncated with an ellipsis).
 */
export const ROUND_LABEL_FORMS = ["line", "stack", "compact-line", "compact-stack"] as const;
export type RoundLabelForm = (typeof ROUND_LABEL_FORMS)[number];

function Lines({ form, long, short, name }: { form: RoundLabelForm; long: string; short: string; name: string }) {
  if (form === "line" || form === "compact-line")
    return (
      <span className="flex items-baseline gap-1 whitespace-nowrap leading-none">
        <span className={ROUND_TEXT}>{form === "line" ? long : short}</span>
        <span className={ROUND_TEXT} aria-hidden="true">·</span>
        <span className={NAME_TEXT}>{name}</span>
      </span>
    );
  return (
    <span className="flex min-w-0 flex-col items-end gap-0.5 whitespace-nowrap leading-none">
      <span className={ROUND_TEXT}>{form === "stack" ? long : short}</span>
      <span className={`block max-w-full truncate ${NAME_SMALL}`}>{name}</span>
    </span>
  );
}

/**
 * A room's round and game beside the arcade play header's timer (16 Oct 2026, display
 * only): "Round 2 of 6 · Gemstone" where it fits, else "Round 2 of 6" over the name,
 * else "2/6 · Gemstone", else "2/6" over the name truncated. The final round reads
 * "Final round". It takes what its header column leaves after the score's minimum
 * (`scoreMin`) and the 8px gap to it; nothing wraps onto a third line or overlaps.
 */
export function RoundLabel({ round, total, name, scoreMin = ROOM_SCORE_MIN }: { round: number; total: number; name: string; scoreMin?: number }) {
  const long = round >= total ? "Final round" : `Round ${round} of ${total}`;
  const short = `${round}/${total}`;
  const measureRef = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<number[] | null>(null);
  const [room, setRoom] = useState(0);
  useIsoLayoutEffect(() => {
    const measure = measureRef.current;
    const column = measure?.parentElement?.parentElement;
    if (!measure || !column) return;
    const read = () => {
      const next = Array.from(measure.children, (child) => Math.ceil((child as HTMLElement).getBoundingClientRect().width));
      setWidths((prev) => (prev && prev.length === next.length && prev.every((w, i) => w === next[i]) ? prev : next));
      // The column's content box less the score's minimum and the 8px between them.
      const style = getComputedStyle(column);
      const content = column.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setRoom(Math.floor(content - scoreMin - (parseFloat(style.columnGap) || 0)));
    };
    read();
    // The column resizing (rotation, a resized window) and web fonts arriving change the fit.
    const observer = new ResizeObserver(read);
    observer.observe(column);
    for (const child of Array.from(measure.children)) observer.observe(child);
    void document.fonts?.ready.then(read);
    return () => observer.disconnect();
  }, [long, short, name, scoreMin]);
  // Before the first measurement (and on the server) the most compact form.
  const index = widths ? widths.findIndex((w) => w <= room) : -1;
  const form: RoundLabelForm = ROUND_LABEL_FORMS[index < 0 ? ROUND_LABEL_FORMS.length - 1 : index]!;
  return (
    <div data-round-label={form} className="relative flex min-w-0 justify-end" style={{ maxWidth: Math.max(0, room) }}>
      <Lines form={form} long={long} short={short} name={name} />
      <span ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute right-0 top-0 flex flex-col">
        {ROUND_LABEL_FORMS.map((f) => (
          <span key={f} className="w-max">
            <Lines form={f} long={long} short={short} name={f === "compact-stack" ? "" : name} />
          </span>
        ))}
      </span>
    </div>
  );
}
