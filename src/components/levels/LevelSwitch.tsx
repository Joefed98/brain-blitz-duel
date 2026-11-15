import { Segmented } from "@/design/components";
import { LEVELS, LEVEL_LABEL, type Level } from "@/lib/levels/levels";

/**
 * The level switch (phase 2 step 4, 15 Nov 2026; DESIGN.md section 5's Segmented): Easy · Normal · Hard · Expert, or
 * only the levels a game has (`levels`). Used by the Games catalogue (the whole catalogue's level), a game's page
 * (above Play) and the room settings sheet (the room's level). Every option carries `data-level-option`.
 */
export function LevelSwitch({
  value,
  onChange,
  levels = LEVELS,
  label = "Difficulty",
  data,
  className,
}: {
  value: Level;
  onChange: (level: Level) => void;
  /** The levels to offer, in LEVELS order (default all four). */
  levels?: readonly Level[];
  label?: string;
  data?: Record<`data-${string}`, string | number | undefined>;
  className?: string;
}) {
  const shown = LEVELS.filter((l) => levels.includes(l));
  return (
    <Segmented
      label={label}
      value={value}
      onChange={onChange}
      {...(className ? { className } : {})}
      data={{ "data-level-switch": "", ...data }}
      options={shown.map((level) => ({ value: level, label: LEVEL_LABEL[level], data: { "data-level-option": level } }))}
    />
  );
}
