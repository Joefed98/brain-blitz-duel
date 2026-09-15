/** Shared plain-text "your answer" line used by the typed puzzle types. */
export function MyAnswerLine({
  myAnswer,
  myCorrect,
}: {
  myAnswer: string | null;
  myCorrect: boolean;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-card px-4 py-5">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your answer</p>
      {!myAnswer ? (
        <p className="font-display text-2xl font-bold text-warn">No answer</p>
      ) : (
        <p
          className={`font-display text-2xl font-bold ${myCorrect ? "text-primary" : "text-warn"}`}
        >
          {myAnswer} {myCorrect ? "✓" : "✗"}
        </p>
      )}
    </div>
  );
}
