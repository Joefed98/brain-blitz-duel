/** The one waiting / loading indicator used everywhere. */
export function Dots({ className = "bg-muted-foreground" }: { className?: string }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full animate-dot-bounce ${className}`}
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

export function WaitingLine({ label, className = "" }: { label: string; className?: string }) {
  return (
    <p
      className={`flex items-center justify-center gap-2 text-sm text-muted-foreground ${className}`}
    >
      <span>{label}</span>
      <Dots />
    </p>
  );
}
