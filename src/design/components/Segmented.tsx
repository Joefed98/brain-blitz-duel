import type { ReactNode } from "react";

/**
 * A segmented switch (DESIGN.md section 5): 2–4 options in a well, the chosen one a light fill (`tone="gold"`:
 * the metal, for a switch that is the way into play). `role="radio"` makes a radiogroup (aria-checked),
 * else a group of toggle buttons (aria-pressed). Each option may carry a count, data attributes and a
 * disabled flag. Every option is at least 44 px tall.
 */
export type SegmentOption<T extends string | number> = {
  value: T;
  label: ReactNode;
  count?: ReactNode;
  disabled?: boolean;
  data?: Record<`data-${string}`, string | number | undefined>;
};

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  radio = false,
  tone,
  className,
  data,
}: {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** The group's accessible name. */
  label: string;
  radio?: boolean;
  tone?: "gold";
  className?: string;
  data?: Record<`data-${string}`, string | number | undefined>;
}) {
  return (
    <div
      role={radio ? "radiogroup" : "group"}
      aria-label={label}
      data-jz="segmented"
      data-tone={tone}
      className={`jz-seg${className ? ` ${className}` : ""}`}
      {...data}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role={radio ? "radio" : undefined}
            aria-checked={radio ? on : undefined}
            aria-pressed={radio ? undefined : on}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            {...option.data}
          >
            {option.label}
            {option.count !== undefined ? <span className="jz-seg-count">{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
