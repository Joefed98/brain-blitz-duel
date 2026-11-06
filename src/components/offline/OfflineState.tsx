import { useNavigate } from "@tanstack/react-router";
import { CloudOff } from "lucide-react";

/**
 * What an online-only screen shows with no connection (offline practice, 31 Oct 2026): Play, Tournaments,
 * rooms, the daily and challenges. The error screens' layout (ErrorState) with one gold action, to Practice.
 */
export function OfflineState({ body }: { body: string }) {
  const navigate = useNavigate();
  return (
    <div data-offline-state className="flex w-full flex-1 flex-col items-center justify-center gap-5 py-6 text-center">
      <span className="rs-error-mark" aria-hidden="true">
        <CloudOff className="h-7 w-7" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-extrabold leading-tight text-foreground">You’re offline{/* design-lint-ignore: styles unchanged, curly quotes only (F4) */}</h1>
        <p className="mx-auto max-w-[300px] text-[15px] leading-snug text-[var(--ap-text-2)]">{body}</p>
      </div>
      <div className="flex w-full max-w-[320px] flex-col gap-2.5">
        <button
          type="button"
          data-offline-practice
          onClick={() => void navigate({ to: "/practice" })}
          className="th-btn-gold ap-btn-gold press tap-target h-[52px] w-full rounded-[14px] text-[17px]"
        >
          Go to Practice
        </button>
      </div>
    </div>
  );
}
