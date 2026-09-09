import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { createDuel, joinDuelByCode } from "@/lib/duel/api";
import { getStoredName, setStoredName } from "@/lib/duel/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Duelz — 1v1 Puzzle Duels" },
      {
        name: "description",
        content:
          "Duelz is a 1v1 puzzle duel: three timed puzzles, thirty seconds each, fastest brain wins. Create a room code and duel a friend.",
      },
      { property: "og:title", content: "Duelz — 1v1 Puzzle Duels" },
      {
        property: "og:description",
        content: "Three puzzles. Thirty seconds each. Fastest brain wins.",
      },
    ],
  }),
  component: Home,
});

type Mode = "home" | "create" | "join";

function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("home");
  const [name, setName] = useState(() => getStoredName());
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Enter a display name.");
      return;
    }
    if (mode === "join" && code.trim().length !== 4) {
      setError("Room codes are 4 letters.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      setStoredName(trimmed);
      const duel =
        mode === "create"
          ? await createDuel(trimmed)
          : await joinDuelByCode(code.trim().toUpperCase(), trimmed);
      await navigate({ to: "/duel/$code", params: { code: duel.roomCode } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <PhoneShell>
      <div className="flex flex-1 flex-col justify-center gap-10">
        <div className="text-center">
          <h1 className="font-display text-5xl font-bold tracking-tight text-primary">Duelz</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Three puzzles. Thirty seconds each. Fastest brain wins.
          </p>
        </div>

        {mode === "home" ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setMode("create");
                setError(null);
              }}
              className="tap-target w-full rounded-xl bg-primary py-4 font-display text-lg font-bold uppercase tracking-wide text-primary-foreground"
            >
              Create duel
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("join");
                setError(null);
              }}
              className="tap-target w-full rounded-xl border border-border bg-card py-4 font-display text-lg font-semibold uppercase tracking-wide text-foreground"
            >
              Join duel
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
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
                <input
                  id="code"
                  value={code}
                  maxLength={4}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  placeholder="ABCD"
                  onChange={(e) =>
                    setCode(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void start();
                  }}
                  className="tap-target w-full rounded-xl border border-border bg-card px-4 py-3 text-center font-mono text-2xl uppercase tracking-[0.4em] text-foreground placeholder:tracking-[0.4em] placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
            )}

            {error && <p className="text-sm text-warn">{error}</p>}

            <button
              type="button"
              onClick={() => void start()}
              disabled={busy}
              className="tap-target w-full rounded-xl bg-primary py-4 font-display text-lg font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
            >
              {busy ? "Please wait…" : mode === "create" ? "Create duel" : "Join duel"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("home");
                setError(null);
              }}
              className="tap-target w-full font-display text-sm uppercase tracking-widest text-muted-foreground"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </PhoneShell>
  );
}
