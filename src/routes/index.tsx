import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Dots } from "@/components/duel/Dots";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { Wordmark } from "@/components/duel/Wordmark";
import { MuteToggle } from "@/components/duel/MuteToggle";
import { createRoom, joinRoomByCode } from "@/lib/duel/api";
import { getStoredName, setStoredName } from "@/lib/duel/session";
import { unlockAudio } from "@/lib/sound";
import { buzz } from "@/lib/motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Duelz — Live Puzzle Rooms for 2–10 Players" },
      {
        name: "description",
        content:
          "Duelz is a live puzzle room: up to ten players solve the same six timed puzzles at the same moment. Share a room code and see who wins.",
      },
      { property: "og:title", content: "Duelz — Live Puzzle Rooms for 2–10 Players" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Up to 10 players. Six rounds. Fastest brain wins.",
      },
      { name: "twitter:description", content: "Up to 10 players. Six rounds. Fastest brain wins." },
    ],
  }),
  component: Home,
});

type Mode = "home" | "create" | "join";

const CODE_LENGTH = 4;

function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setName(getStoredName()), []);

  const fail = (message: string) => {
    setError(message);
    setShake((n) => n + 1);
    buzz([10, 50, 10]);
  };

  const start = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      fail("Enter a display name.");
      return;
    }
    if (mode === "join" && code.trim().length !== CODE_LENGTH) {
      fail("Room codes are 4 letters.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      setStoredName(trimmed);
      const duel =
        mode === "create"
          ? await createRoom(trimmed)
          : await joinRoomByCode(code.trim().toUpperCase(), trimmed);
      await navigate({ to: "/duel/$code", params: { code: duel.roomCode } });
    } catch (err) {
      setBusy(false);
      fail(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  };

  const openMode = (next: Mode) => {
    unlockAudio();
    setMode(next);
    setError(null);
  };

  return (
    <PhoneShell bare>
      <div className="flex justify-end">
        <MuteToggle />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-10">
        <div className="flex flex-col items-center text-center">
          <Wordmark size="lg" />
          <p className="mt-3 text-sm text-muted-foreground">
            Up to 10 players. Six rounds. Fastest brain wins.
          </p>
          <div className="mt-6 h-px w-16 bg-border" />
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            40+ puzzle types and 15 arcade games
          </p>
        </div>

        {mode === "home" ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => openMode("create")}
              className="press tap-target relative w-full overflow-hidden rounded-xl bg-primary py-4 font-display text-lg font-bold uppercase tracking-wide text-primary-foreground"
            >
              <span className="relative z-10">Create room</span>
              <span
                aria-hidden="true"
                className="animate-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-primary-foreground/20"
              />
            </button>
            <button
              type="button"
              onClick={() => openMode("join")}
              className="press tap-target w-full rounded-xl border border-border bg-card/70 py-4 font-display text-base font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Join room
            </button>
          </div>
        ) : (
          <div key={mode} className="flex flex-col gap-4 animate-phase-in">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="name"
                className="text-xs uppercase tracking-widest text-muted-foreground"
              >
                Display name
              </label>
              <input
                id="name"
                value={name}
                autoFocus
                maxLength={14}
                placeholder="Your name"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (mode === "join") codeRef.current?.focus();
                    else void start();
                  }
                }}
                className="tap-target w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            {mode === "join" && (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="code"
                  className="text-xs uppercase tracking-widest text-muted-foreground"
                >
                  Room code
                </label>
                <div
                  key={shake}
                  className={`relative ${error ? "animate-shake" : ""}`}
                  onClick={() => codeRef.current?.focus()}
                >
                  <div className="flex gap-2">
                    {Array.from({ length: CODE_LENGTH }, (_, i) => (
                      <div
                        key={i}
                        className={`flex h-16 flex-1 items-center justify-center rounded-xl border bg-card font-mono text-3xl font-bold ${
                          code.length === i
                            ? "border-primary text-primary"
                            : "border-border text-foreground"
                        }`}
                      >
                        {code[i] ?? ""}
                      </div>
                    ))}
                  </div>
                  <input
                    ref={codeRef}
                    id="code"
                    value={code}
                    maxLength={CODE_LENGTH}
                    inputMode="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    aria-label="Room code"
                    onChange={(e) => {
                      setError(null);
                      setCode(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase());
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void start();
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer bg-transparent text-transparent caret-transparent outline-none"
                  />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-warn">{error}</p>}

            <button
              type="button"
              onClick={() => void start()}
              disabled={busy}
              className="press tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-display text-lg font-bold uppercase tracking-wide text-primary-foreground"
            >
              {busy ? (
                <>
                  <span>Please wait</span>
                  <Dots className="bg-primary-foreground" />
                </>
              ) : mode === "create" ? (
                "Create room"
              ) : (
                "Join room"
              )}
            </button>
            <button
              type="button"
              onClick={() => openMode("home")}
              className="press tap-target w-full font-display text-sm uppercase tracking-widest text-muted-foreground"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </PhoneShell>
  );
}
