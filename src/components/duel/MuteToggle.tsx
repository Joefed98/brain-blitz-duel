import { useEffect, useState } from "react";

import { isMuted, onMuteChange, setMuted } from "@/lib/sound";

export function MuteToggle() {
  const [muted, setLocal] = useState(false);

  useEffect(() => {
    setLocal(isMuted());
    return onMuteChange(() => setLocal(isMuted()));
  }, []);

  return (
    <button
      type="button"
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      aria-pressed={muted}
      onClick={() => setMuted(!muted)}
      className="press flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 9v6h3l5 4V5L7 9H4Z" />
        {muted ? (
          <path d="m16 9 5 6m0-6-5 6" />
        ) : (
          <>
            <path d="M16.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 6a8.5 8.5 0 0 1 0 12" />
          </>
        )}
      </svg>
    </button>
  );
}
