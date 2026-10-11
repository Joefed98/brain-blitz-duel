import { APP_NAME } from "@/lib/brand";

/** The app mark: tight Space Grotesk with a gold bolt beside it. */
export function BoltGlyph({ className = "h-4 w-4", viewBox = "0 0 24 24" }: { className?: string; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} className={className} aria-hidden="true">
      <path d="M14 2 5 14h6l-2 8 10-13h-6l1-7Z" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  const large = size === "lg";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`font-display font-bold tracking-[-0.04em] text-foreground ${
          large ? "text-5xl" : "text-base"
        }`}
      >
        {APP_NAME}
      </span>
      <BoltGlyph className={`${large ? "h-7 w-7" : "h-3.5 w-3.5"} text-primary`} />
    </span>
  );
}
