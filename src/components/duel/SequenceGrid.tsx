interface SequenceGridProps {
  /** Tile indices in the order they are played / tapped. */
  order: number[];
  /** Grid width — 3 for Sequence Recall, 4 for Spatial Memory. */
  cols?: number;
  tone?: "primary" | "warn";
  size?: "sm" | "md";
  /** False for grids where order does not matter (Spatial Memory). */
  numbered?: boolean;
  /** Tiles to outline in red — wrong taps. */
  wrong?: number[];
}

/** Static square grid with marked tiles, optionally numbered in order. */
export function SequenceGrid({
  order,
  cols = 3,
  tone = "primary",
  size = "md",
  numbered = true,
  wrong = [],
}: SequenceGridProps) {
  const box =
    cols >= 4
      ? size === "sm"
        ? "h-11 w-11 text-sm"
        : "h-14 w-14 text-base"
      : size === "sm"
        ? "h-14 w-14 text-base"
        : "h-[68px] w-[68px] text-lg";
  const active =
    tone === "warn"
      ? "border-warn/60 bg-warn/15 text-warn"
      : "border-primary/60 bg-primary/15 text-primary";

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: cols * cols }, (_, index) => {
        const position = order.indexOf(index);
        const on = position >= 0;
        const isWrong = wrong.includes(index);
        return (
          <div
            key={index}
            className={`flex items-center justify-center rounded-xl border font-mono font-bold ${box} ${
              isWrong
                ? "border-warn bg-warn/10 text-warn"
                : on
                  ? active
                  : "border-border bg-card text-muted-foreground/30"
            }`}
          >
            {on && numbered ? position + 1 : ""}
          </div>
        );
      })}
    </div>
  );
}
