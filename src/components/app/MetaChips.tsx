import type { HTMLAttributes } from "react";
import { Chip } from "@/design/components";

/**
 * Two or three short facts in a header as quiet status chips (copy pass, 7 Nov 2026; DESIGN.md section 3, text
 * emphasis rule 5: no " · " separators). The row's accessible name reads the facts with commas.
 */
export function MetaChips({ facts, className, ...rest }: { facts: readonly string[] } & Omit<HTMLAttributes<HTMLSpanElement>, "children">) {
  const shown = facts.filter(Boolean);
  return (
    <span role="group" aria-label={shown.join(", ")} className={`jz-facts${className ? ` ${className}` : ""}`} {...rest}>
      {shown.map((fact, i) => (
        <Chip key={`${i}-${fact}`} variant="status" label={fact} aria-hidden="true" />
      ))}
    </span>
  );
}
