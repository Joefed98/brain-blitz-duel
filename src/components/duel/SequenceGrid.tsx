interface SequenceGridProps {
  /** Tile indices in the order they are played / tapped. */
  order: number[];
  /** Grid width — 4 for the recall games, 5 for Spatial Memory. */
  cols?: number;
  tone?: "primary" | "opponent" | "warn";
  size?: "xs" | "sm" | "md";
  /** False for grids where order does not matter (Spatial Memory). */
  numbered?: boolean;
  /** Tiles to outline in red — wrong taps. */
  wrong?: number[];
}

/** Tile size for each grid width, so 4x4 and 5x5 both fit a 390px phone. */
const BOXES: Record<"xs" | "sm" | "md", Record<number, string>> = {
  xs: { 3: "h-9 w-9 text-xs", 4: "h-8 w-8 text-[10px]", 5: "h-7 w-7 text-[10px]" },
  sm: { 3: "h-14 w-14 text-base", 4: "h-11 w-11 text-sm", 5: "h-9 w-9 text-xs" },
  md: { 3: "h-[68px] w-[68px] text-lg", 4: "h-14 w-14 text-base", 5: "h-12 w-12 text-sm" },
};

/** Static square grid with marked tiles, optionally numbered in order. */
export function SequenceGrid({
  order,
  cols = 4,
  tone = "primary",
  size = "md",
  numbered = true,
  wrong = [],
}: SequenceGridProps) {
  const box = BOXES[size][Math.min(Math.max(cols, 3), 5)] ?? BOXES[size][4]!;
  const active =
    tone === "warn"
      ? "border-warn/60 bg-warn/15 text-warn"
      : tone === "opponent"
        ? "border-opponent/60 bg-opponent/15 text-opponent"
        : "border-primary/60 bg-primary/15 text-primary";

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
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
