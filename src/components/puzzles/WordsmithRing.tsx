import { Button } from "@/components/ui/button";
import { WORDSMITH_CENTRE_INDEX } from "@/lib/duel/types";
import { gameDisplayName } from "@/lib/duel/gameNames";

/** Shared circular atom board for play, fixed examples and reveal. */
export function WordsmithRing({ letters, selected = [], disabled = true, onTap, order }: {
  letters: readonly string[];
  selected?: readonly number[];
  disabled?: boolean;
  onTap?: (index: number) => void;
  order?: readonly number[];
}) {
  const outer = (order ?? letters.map((_, index) => index)).filter(index => index !== WORDSMITH_CENTRE_INDEX);
  return <div className="wordsmith-ring relative aspect-square w-full select-none" aria-label={`${gameDisplayName("wordsmith")} atom board`}>
    <svg className="wordsmith-ring-lines" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="wordsmith-orbit" cx="50" cy="50" r="37" />
    </svg>
    {letters.map((letter, index) => {
      const centre = index === WORDSMITH_CENTRE_INDEX;
      const angle = -Math.PI / 2 + outer.indexOf(index) * Math.PI * 2 / outer.length;
      const x = centre ? 50 : 50 + Math.cos(angle) * 37;
      const y = centre ? 50 : 50 + Math.sin(angle) * 37;
      const used = selected.includes(index);
      return <Button key={index} type="button" variant="ghost" disabled={disabled}
        data-wordsmith-tile={index} aria-pressed={used}
        aria-label={centre ? `Centre letter ${letter}` : `Letter ${letter}, tile ${index + 1}`}
        onClick={() => onTap?.(index)}
        className={`wordsmith-ring-tile letter-shuffle-tile ${centre ? "wordsmith-ring-centre" : "wordsmith-ring-outer"} ${used ? "wordsmith-ring-used" : ""}`}
        style={{ left: `${x}%`, top: `${y}%` }}>
        <span className="wordsmith-ring-letter">{letter}</span>
      </Button>;
    })}
  </div>;
}
