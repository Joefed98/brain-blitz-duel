/**
 * Creating or joining a room (phase 2 step 3, 14 Nov 2026): the Rooms page's Create a room and Join, and the Play
 * page's quick play for players without rated play, share one path, moved here unchanged from Home's Quick play:
 * a display name first (an account plays under its username), the beta terms before the first room
 * (lib/beta/terms.ts: the caller draws TermsScreen while `termsFor` is set), then the room route. A refused name
 * comes back with its three suggestions (names.server.ts).
 */
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { reasonFrom, suggestionsFrom } from "@/components/account/AccountParts";
import { termsAgreed } from "@/lib/beta/terms";
import { createRoom, joinRoomByCode } from "@/lib/duel/api";
import { ROOM_CODE_LENGTH } from "@/lib/duel/roomLink";
import { getStoredName, setStoredName } from "@/lib/duel/session";
import { unlockAudio } from "@/lib/sound";

export type RoomStartMode = "create" | "join";

export interface RoomStart {
  busy: RoomStartMode | null;
  error: string | null;
  /** Bumped on each refusal, so the code row can shake. */
  shake: number;
  suggestions: string[];
  /** Set while the beta terms are up (the caller draws TermsScreen with `agree`). */
  termsFor: RoomStartMode | null;
  /** Starts a room with this name (and the code, to join); `needName` runs when the name is empty. */
  start: (mode: RoomStartMode, name: string, code?: string, needName?: () => void) => Promise<void>;
  agree: () => void;
  clearError: () => void;
  clearSuggestions: () => void;
}

export function useRoomStart(): RoomStart {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<RoomStartMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pending, setPending] = useState<{ mode: RoomStartMode; name: string; code?: string } | null>(null);

  const fail = (message: string) => {
    setError(message);
    setShake((n) => n + 1);
  };

  const start = async (mode: RoomStartMode, name: string, code = "", needName?: () => void) => {
    unlockAudio();
    setSuggestions([]);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      needName?.();
      fail("Enter a display name.");
      return;
    }
    if (mode === "join" && code.trim().length !== ROOM_CODE_LENGTH) {
      fail("Room codes are 4 characters.");
      return;
    }
    if (!termsAgreed()) {
      setPending({ mode, name, code });
      return;
    }
    setBusy(mode);
    setError(null);
    try {
      setStoredName(trimmed);
      const duel = mode === "create" ? await createRoom(trimmed) : await joinRoomByCode(code.trim().toUpperCase(), trimmed, "code");
      await navigate({ to: "/duel/$code", params: { code: duel.roomCode } });
    } catch (err) {
      setBusy(null);
      const picks = suggestionsFrom(err);
      setSuggestions(picks);
      if (picks.length) needName?.();
      fail(err instanceof Error ? reasonFrom(err.message) : "That didn’t work. Try again.");
    }
  };

  return {
    busy,
    error,
    shake,
    suggestions,
    termsFor: pending?.mode ?? null,
    start,
    agree: () => {
      const p = pending;
      setPending(null);
      if (p) void start(p.mode, p.name, p.code);
    },
    clearError: () => setError(null),
    clearSuggestions: () => setSuggestions([]),
  };
}

/** The name a room would be made under on this device now: the account's username, else the stored guest name. */
export function storedRoomName(accountName: string | null | undefined): string {
  return (accountName ?? getStoredName()).trim();
}
