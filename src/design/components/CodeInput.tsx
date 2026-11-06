import { forwardRef, useState, type InputHTMLAttributes } from "react";

/**
 * The room code (DESIGN.md section 5): four wells, one a character, over one real input, so typing,
 * pasting, autofill and a screen reader all meet an ordinary text field (aria-label "Room code").
 * The caller cleans the value (codeFromInput) and keeps it in state; the boxes only draw it.
 */
export type CodeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "size"> & {
  value: string;
  length?: number;
};

export const CodeInput = forwardRef<HTMLInputElement, CodeInputProps>(function CodeInput(
  { value, length = 4, className, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const chars = value.slice(0, length).split("");
  return (
    <span data-jz="code-input" className={`jz-code${className ? ` ${className}` : ""}`}>
      {Array.from({ length }, (_, i) => (
        <span key={i} aria-hidden="true" data-current={focused && i === Math.min(chars.length, length - 1) ? "" : undefined}>
          {chars[i] ?? ""}
        </span>
      ))}
      <input
        ref={ref}
        type="text"
        value={value}
        maxLength={length}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
    </span>
  );
});
