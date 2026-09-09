interface SequenceGridProps {
  /** Tile indices (0-8) in the order they are played / tapped. */
  order: number[];
  tone?: "primary" | "warn";
  size?: "sm" | "md";
}

/** Static 3x3 grid with the tiles of a sequence numbered in order. */
export function SequenceGrid({ order, tone = "primary", size = "md" }: SequenceGridProps) {
  const box = size === "sm" ? "h-14 w-14 text-base" : "h-[68px] w-[68px] text-lg";
  const active =
    tone === "warn"
      ? "border-warn/60 bg-warn/15 text-warn"
      : "border-primary/60 bg-primary/15 text-primary";

  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 9 }, (_, index) => {
        const position = order.indexOf(index);
        const on = position >= 0;
        return (
          <div
            key={index}
            className={`flex items-center justify-center rounded-xl border font-mono font-bold ${box} ${
              on ? active : "border-border bg-card text-muted-foreground/30"
            }`}
          >
            {on ? position + 1 : ""}
          </div>
        );
      })}
    </div>
  );
}
