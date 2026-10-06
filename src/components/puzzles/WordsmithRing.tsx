import { Button } from "@/components/ui/button";
import { WORDSMITH_CENTRE_INDEX } from "@/lib/duel/types";

/** Shared live and fixed-example newspaper wheel; positions scale with its square. */
export function WordsmithRing({ letters, selected = [], disabled = true, onTap }: {
  letters: readonly string[];
  selected?: readonly number[];
  disabled?: boolean;
  onTap?: (index: number) => void;
}) {
  const outer = letters.map((_, index) => index).filter(index => index !== WORDSMITH_CENTRE_INDEX);
  return <div className="wordsmith-ring relative aspect-square w-full select-none" aria-label="Wordsmith letter ring">
    {letters.map((letter, index) => {
      const centre = index === WORDSMITH_CENTRE_INDEX;
      const angle = outer.indexOf(index) * Math.PI / 4 - Math.PI / 2;
      const used = selected.includes(index);
      return <Button key={index} type="button" variant="ghost" disabled={disabled}
        data-wordsmith-tile={index} aria-pressed={used}
        aria-label={centre ? `Centre letter ${letter}` : `Letter ${letter}, tile ${index + 1}`}
        onClick={() => onTap?.(index)}
        className={`wordsmith-ring-tile ${centre ? "wordsmith-ring-centre" : "wordsmith-ring-outer"} ${used ? "wordsmith-ring-used" : ""}`}
        style={{ left: `${centre ? 50 : 50 + 35 * Math.cos(angle)}%`, top: `${centre ? 50 : 50 + 35 * Math.sin(angle)}%` }}>
        {letter}
      </Button>;
    })}
  </div>;
}