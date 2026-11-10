/**
 * Small pieces the account screens share (wave 1 sign-up screens): the header with Back, the three-step bar, the
 * player card preview, the Founding Player line, the name suggestions and the username's live check.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { Button, Chip, Icon } from "@/design/components";
import { usernameShapeProblem } from "@/lib/names/username";

export const FOUNDING_BADGE_URL = "/art/badges/founding-player.svg";

/** "#0042": a player number as the welcome screen and settings show it. */
export function playerNumberText(n: number): string {
  return `#${String(Math.max(0, Math.floor(n))).padStart(4, "0")}`;
}

export function AccountHead({ title, onBack, backLabel = "Back" }: { title?: string; onBack?: () => void; backLabel?: string }) {
  return (
    <header className="acct-head">
      {onBack ? (
        <Button variant="icon" onClick={onBack} aria-label={backLabel} data-account-back>
          <Icon name="back" size={22} />
        </Button>
      ) : (
        <span />
      )}
      <p className="acct-head-title">{title ?? ""}</p>
      <span />
    </header>
  );
}

/** "Create your player": step n of 3 (username, birthday, welcome). */
export function StepBar({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="acct-steps" role="progressbar" aria-label="Create your player" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step}>
      {[1, 2, 3].map((n) => (
        <span key={n} data-on={n <= step ? "" : undefined} />
      ))}
    </div>
  );
}

/** The player's card as other players will see it (no rating or placement in wave 1). */
export function PlayerCard({ username, colour, sub, extra }: { username: string; colour: number; sub: string; extra?: ReactNode }) {
  const name = username || "Your name";
  return (
    <div data-account-card className="acct-card jz-cut-lg">
      <div className="flex items-center gap-4">
        <PlayerBadge look={{ colour, icon: null }} name={name} size={56} />
        <div className="flex min-w-0 flex-col">
          <span className="acct-card-name">{name}</span>
          <span className="acct-card-sub">{sub}</span>
        </div>
      </div>
      {extra}
    </div>
  );
}

/** The backend's three suggestions as chips; a tap puts the name in the box. */
export function NameSuggestions({ names, onPick }: { names: readonly string[] | undefined; onPick: (name: string) => void }) {
  if (!names?.length) return null;
  return (
    <div className="acct-suggestions" data-name-suggestions>
      {names.slice(0, 3).map((n) => (
        <Chip key={n} onClick={() => onPick(n)}>
          {n}
        </Chip>
      ))}
    </div>
  );
}

/** The suggestions a refused room name carries (joinRoomFn's field, or the "Try A, B or C." in a thrown message). */
export function suggestionsFrom(err: unknown): string[] {
  const own = (err as { suggestions?: unknown } | null)?.suggestions;
  if (Array.isArray(own)) return own.filter((s): s is string => typeof s === "string").slice(0, 3);
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const m = /Try (.+) or ([^.]+)\.$/.exec(message);
  if (!m) return [];
  return [...m[1]!.split(", "), m[2]!].map((s) => s.trim()).filter(Boolean).slice(0, 3);
}

/** The refusal's plain reason without the "Try …" tail (the chips carry the names). */
export function reasonFrom(message: string): string {
  return message.replace(/\s*Try .+ or [^.]+\.$/, "");
}

export type UsernameCheck =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; username: string }
  | { state: "refused"; message: string; suggestions: string[] };

const SHAPE_MESSAGES = {
  empty: "Pick a username.",
  length: "Usernames are 3 to 16 characters.",
  characters: "Use letters, numbers or underscores only.",
} as const;

/**
 * The username's live check as the player types: the shape at once (shared rules), then the server's full check
 * (filter, reserved names, look-alikes, availability) after a short pause. `current` (a signed-in player's own name)
 * is fine as it is.
 */
export function useUsernameCheck(value: string, current?: string): UsernameCheck {
  const [check, setCheck] = useState<UsernameCheck>({ state: "idle" });
  const seq = useRef(0);
  useEffect(() => {
    const name = value.trim();
    const n = ++seq.current;
    if (!name) {
      setCheck({ state: "idle" });
      return;
    }
    if (current && name === current) {
      setCheck({ state: "ok", username: name });
      return;
    }
    const shape = usernameShapeProblem(name);
    if (shape && shape !== "empty") {
      setCheck({ state: "refused", message: SHAPE_MESSAGES[shape], suggestions: [] });
      return;
    }
    setCheck({ state: "checking" });
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { checkUsernameFn } = await import("@/lib/account/account.functions");
          const res = (await checkUsernameFn({ data: { username: name } })) as
            | { ok: true; username: string }
            | { ok: false; message: string; suggestions?: string[] };
          if (n !== seq.current) return;
          setCheck(res.ok ? { state: "ok", username: res.username } : { state: "refused", message: res.message, suggestions: res.suggestions ?? [] });
        } catch {
          if (n === seq.current) setCheck({ state: "refused", message: "Couldn’t check that name. Try again.", suggestions: [] });
        }
      })();
    }, 350);
    return () => clearTimeout(timer);
  }, [value, current]);
  return check;
}

/** The live state inside the username box. */
export function UsernameState({ check }: { check: UsernameCheck }) {
  if (check.state === "ok")
    return (
      <span className="acct-input-state acct-ok" data-username-state="ok">
        <Icon name="check" size={18} tone="cyan" /> Available
      </span>
    );
  if (check.state === "checking")
    return (
      <span className="acct-input-state acct-hint" data-username-state="checking">
        Checking
      </span>
    );
  if (check.state === "refused")
    return (
      <span className="acct-input-state acct-error" data-username-state="refused">
        <Icon name="cross" size={18} tone="red" />
      </span>
    );
  return null;
}
