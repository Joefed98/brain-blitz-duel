/**
 * "Save your progress" (wave 1 sign-up screens; docs/mockups/wave-1/ S1 and its README): mounted on the result of a
 * finished room, Daily or challenge. The rules are saveProgress.ts: the sheet after the first finished game, a small
 * pop-up once more after the third if the sheet was answered "Not now", never before the first game, never for an
 * account. The list is only what's real today (games, bests, stars and challenges on every phone); ratings,
 * placement and coins join it as waves 2 and 3 land.
 */
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button, Icon, Sheet } from "@/design/components";
import { APPLE_SIGN_IN_ENABLED, GOOGLE_SIGN_IN_ENABLED } from "@/config/accountConfig";
import { recordSaveProgress, useAccount } from "@/lib/account/accountApi";
import { answerPrompt, noteFinishedGame, type SaveProgressFrom, type SaveProgressMethod, type SaveProgressPrompt } from "@/lib/account/saveProgress";

const PERKS = [
  { icon: "practice", text: "Your games and results, on every phone" },
  { icon: "star", text: "Your stars and practice bests" },
  { icon: "challenge", text: "Your challenges and Daily streak" },
] as const;

/** How long the result is on screen before the game counts and a prompt shows. */
export const SHOW_AFTER_MS = 1200;

/** Where the sign-up should come back to: the screen the player is on. */
function here(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

export function SaveProgressPrompt({ gameKey, from }: { gameKey: string; from: SaveProgressFrom }) {
  const account = useAccount();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState<SaveProgressPrompt | null>(null);

  useEffect(() => {
    if (account.kind === "unknown" || !gameKey) return;
    // The result lands first (its medals, totals and the Captain's moment), then the game is counted and the
    // prompt, if one is due, slides up. Leaving the result sooner counts nothing.
    const timer = setTimeout(() => {
      const due = noteFinishedGame(gameKey, { signedIn: account.kind === "account" });
      if (!due) return;
      setPrompt(due);
      recordSaveProgress("save_progress_shown", { prompt: due, from });
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
    // Counted once per game: the account's kind settles once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.kind === "unknown", gameKey]);

  if (!prompt) return null;

  const dismiss = () => {
    answerPrompt(prompt, "dismissed");
    recordSaveProgress("save_progress_dismissed", { prompt, from });
    setPrompt(null);
  };
  const tap = (method: SaveProgressMethod) => {
    answerPrompt(prompt, "tapped");
    recordSaveProgress("save_progress_tapped", { prompt, from, method });
    setPrompt(null);
    void navigate({ to: "/account", search: { from: here(), start: method === "email" ? "email" : "signin" } });
  };

  if (prompt === "popup")
    return (
      <div role="dialog" aria-label="Save your progress" className="acct-popup" data-save-progress="popup">
        <p className="jz-card-title">Save your progress?</p>
        <p className="acct-lede">Make an account and keep your games, bests and stars on every phone.</p>
        <div className="acct-popup-row">
          <Button variant="secondary" size={46} onClick={dismiss} data-save-progress-dismiss>
            Not now
          </Button>
          <Button variant="gold" size={46} onClick={() => tap("email")} data-save-progress-tap>
            Save progress
          </Button>
        </div>
      </div>
    );

  return (
    <Sheet open onClose={dismiss} title="Save your progress" closeLabel="Not now" data={{ "data-save-progress": "sheet" }}>
      <div className="acct-sheet-body">
        <p className="acct-sheet-lede">Make an account to keep what you’ve played.</p>
        <ul className="acct-perks">
          {PERKS.map((p) => (
            <li key={p.text} className="acct-perk">
              <span>
                <Icon name={p.icon} size={20} tone="gold" />
              </span>
              <span>{p.text}</span>
            </li>
          ))}
        </ul>
        <div className="acct-actions">
          {APPLE_SIGN_IN_ENABLED ? (
            <Button variant="secondary" size={52} block onClick={() => tap("apple")}>
              Continue with Apple
            </Button>
          ) : null}
          {GOOGLE_SIGN_IN_ENABLED ? (
            <Button variant="secondary" size={52} block onClick={() => tap("google")}>
              Continue with Google
            </Button>
          ) : null}
          <Button variant="gold" size={52} block onClick={() => tap("email")} data-save-progress-tap>
            <Icon name="send" size={20} /> Continue with email
          </Button>
          <Button variant="quiet" size={48} block onClick={dismiss} data-save-progress-dismiss>
            Not now
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
