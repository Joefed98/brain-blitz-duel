import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { LogoMark } from "@/components/brand/LogoMark";
import { roomCodeChars } from "@/lib/duel/roomCode";

/**
 * One layout for the error screens (Polish batch R, 25 Oct 2026, presentation only): the 404 page, a room
 * link whose room is not found and a challenge link that doesn't work. Under the screen's header: a dimmed
 * logo mark in a rounded square, a title, a plain explanation, where it helps a room-code box to try again,
 * then Back to Play (secondary) and one gold action (Create a room, or Make your own challenge).
 */
export function ErrorState({
  title,
  body,
  codeBox = false,
  action,
}: {
  title: string;
  body: string;
  /** A room-code box to try another code (the room's link). */
  codeBox?: boolean;
  /** The one gold action. */
  action: { label: string; onClick: () => void };
}) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const tryCode = () => {
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) return;
    void navigate({ to: "/duel/$code", params: { code: clean } });
  };
  return (
    <div data-error-screen className="flex w-full flex-1 flex-col items-center justify-center gap-5 py-6 text-center">
      <span className="rs-error-mark" aria-hidden="true">
        <LogoMark width={30} height={39} />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-extrabold leading-tight text-foreground">{title}</h1>
        <p className="mx-auto max-w-[300px] text-[15px] leading-snug text-[var(--ap-text-2)]">{body}</p>
      </div>
      {codeBox ? (
        <form
          className="flex w-full max-w-[320px] gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            tryCode();
          }}
        >
          <input
            value={code}
            onChange={(event) => setCode(roomCodeChars(event.target.value).slice(0, 6))}
            placeholder="Room code"
            aria-label="Room code"
            autoCapitalize="characters"
            autoComplete="off"
            className="ap-input ap-code min-w-0 flex-1"
          />
          <button type="submit" disabled={code.trim().length < 4} className="rs-btn press tap-target h-[50px] w-[84px] disabled:opacity-50">
            Join
          </button>
        </form>
      ) : null}
      <div className="flex w-full max-w-[320px] flex-col gap-2.5">
        <button type="button" onClick={() => void navigate({ to: "/" })} className="rs-btn press tap-target h-[50px] w-full">
          Back to Play
        </button>
        <button type="button" onClick={action.onClick} className="th-btn-gold ap-btn-gold press tap-target h-[52px] w-full rounded-[14px] text-[17px]">
          {action.label}
        </button>
      </div>
    </div>
  );
}
