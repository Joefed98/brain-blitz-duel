import type { PuzzleCategory } from "@/lib/duel/types";

/** A category's label: a small uppercase pill tinted in the category's colour (polish-layout/theme.css). */
export function CategoryPill({
  category,
  className = "",
  label,
}: {
  category: PuzzleCategory;
  className?: string;
  /** The text, when it is not the category's own name. */
  label?: string;
}) {
  return (
    <span data-cat={category} data-category-pill={category} className={`th-pill ${className}`}>
      {label ?? category}
    </span>
  );
}
