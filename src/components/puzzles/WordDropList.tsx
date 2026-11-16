import "@/polish-word/word-look.css";

/**
 * The Word games' round-end list (the Word overhaul, 15 Nov 2026): the found words drop in one by one (a soft tick is
 * the effects stage's), the longest on a gold chip. Display only; every item ends visible, and under reduced motion or
 * reduced effects nothing moves (word-look.css).
 */
export function WordDropList({ words, className = "" }: { words: readonly { word: string; points?: number | string; bonus?: boolean }[]; className?: string }) {
  const longest = words.reduce((best, entry, i) => (entry.word.length > (words[best]?.word.length ?? 0) ? i : best), 0);
  return (
    <ul data-word-drop="" className={className}>
      {words.map((entry, i) => (
        <li key={entry.word} data-word-longest={words.length > 1 && i === longest ? "" : undefined} style={{ ["--wd-i" as string]: Math.min(i, 24) }}>
          <span>
            {entry.word}
            {entry.bonus ? <span className="ml-1 text-[11px] normal-case text-muted-foreground">bonus</span> : null}
          </span>
          {entry.points !== undefined ? <span className="text-primary">{entry.points}</span> : null}
        </li>
      ))}
    </ul>
  );
}
