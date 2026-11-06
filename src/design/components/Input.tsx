import { forwardRef, type InputHTMLAttributes } from "react";
import { Search } from "lucide-react";

/**
 * A text field (DESIGN.md section 5): a well, the page colour sunk into its panel with an inset top
 * shadow (--jz-well), 50 px tall (`size` 44 for search). `search` draws the magnifier and pads for it.
 */
export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: 44 | 50;
  search?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 50, search = false, className, type, ...rest },
  ref,
) {
  const field = (
    <input
      ref={ref}
      type={type ?? (search ? "search" : "text")}
      data-jz="input"
      data-size={size === 50 ? undefined : size}
      data-search={search ? "" : undefined}
      className={`jz-input${className && !search ? ` ${className}` : ""}`}
      {...rest}
    />
  );
  if (!search) return field;
  return (
    <span className={`relative block${className ? ` ${className}` : ""}`}>
      <Search aria-hidden="true" className="jz-input-icon" />
      {field}
    </span>
  );
});
